import { Injectable } from '@nestjs/common';
import {
  CreatePlatformEndpointCommand,
  DeleteEndpointCommand,
  GetEndpointAttributesCommand,
  ListEndpointsByPlatformApplicationCommand,
  PublishCommand,
  SNSClient,
  SetEndpointAttributesCommand,
} from '@aws-sdk/client-sns';

import { ConfigService } from '@/core/config/config.service';
import { LoggerService } from '@/core/logging/logger.service';

export interface DeviceToken {
  token: string;
  platform: 'ios' | 'android';
  userId?: string;
  customData?: Record<string, string>;
}

export interface PushMessage {
  title: string;
  body: string;
  data?: Record<string, string>;
  sound?: string;
  badge?: number;
  priority?: 'normal' | 'high';
  ttl?: number; // Time to live in seconds
  collapseKey?: string;
}

export interface PushNotificationOptions {
  traceId?: string;
}

export interface EndpointInfo {
  endpointArn: string;
  token: string;
  platform: 'ios' | 'android';
  enabled: boolean;
  customData?: Record<string, string>;
}

export interface OtpPushMessage extends PushMessage {
  type: 'otp';
  otp: string;
  context: 'sign-in' | 'email-verification' | 'forget-password';
  expiresAt?: Date;
}

/**
 * Service for managing AWS SNS push notifications
 * Provides a high-level interface for sending push notifications through Amazon SNS
 * Supports iOS (APNs) and Android (FCM) push notifications
 */
@Injectable()
export class PushService {
  private readonly snsClient: SNSClient;
  private readonly region: string;
  private readonly iosPlatformApplicationArn?: string;
  private readonly androidPlatformApplicationArn?: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(PushService.name);
    this.region = this.configService.awsRegion;
    this.iosPlatformApplicationArn =
      this.configService.snsIosPlatformApplicationArn;
    this.androidPlatformApplicationArn =
      this.configService.snsAndroidPlatformApplicationArn;

    this.snsClient = new SNSClient({
      region: this.region,
      credentials: {
        accessKeyId: this.configService.awsAccessKeyId,
        secretAccessKey: this.configService.awsSecretAccessKey,
      },
    });

    this.logger.log(
      `PushService initialized in region: ${this.region} with SNS platform applications`,
      'PushService',
    );
  }

  /**
   * Register or update a device token as an SNS endpoint
   * @param deviceToken - Device token information
   * @returns Promise<string> - Endpoint ARN
   */
  async registerDeviceToken(deviceToken: DeviceToken): Promise<string> {
    const platformApplicationArn = this.getPlatformApplicationArn(
      deviceToken.platform,
    );

    // Create custom user data for the endpoint
    const customUserData = JSON.stringify({
      userId: deviceToken.userId,
      customData: deviceToken.customData,
      platform: deviceToken.platform,
    });

    const attributes: Record<string, string> = {
      Enabled: 'true',
      ...(deviceToken.customData
        ? this.buildSnsAttributes(deviceToken.customData)
        : {}),
    };

    try {
      const command = new CreatePlatformEndpointCommand({
        PlatformApplicationArn: platformApplicationArn,
        Token: deviceToken.token,
        CustomUserData: customUserData,
        Attributes: attributes,
      });

      const response = await this.snsClient.send(command);
      const endpointArn = response.EndpointArn;

      if (!endpointArn) {
        throw new Error('Failed to create SNS endpoint');
      }

      this.logger.log(
        `Device token registered successfully: ${deviceToken.platform} - ${endpointArn}`,
        'PushService',
      );

      return endpointArn;
    } catch (error) {
      const existingEndpointArn = this.extractExistingEndpointArn(error);
      if (existingEndpointArn) {
        this.logger.warn(
          `Endpoint already exists for token ${deviceToken.token}. Updating attributes instead.`,
          'PushService',
        );
        await this.updateExistingEndpoint(
          existingEndpointArn,
          deviceToken,
          customUserData,
        );
        return existingEndpointArn;
      }

      this.logger.error(
        `Failed to register device token: ${deviceToken.token}`,
        error instanceof Error ? error.stack : undefined,
        'PushService',
      );
      throw error;
    }
  }

  /**
   * Unregister/remove an SNS endpoint
   * @param endpointArn - The endpoint ARN to remove
   * @returns Promise<void>
   */
  async unregisterDeviceToken(endpointArn: string): Promise<void> {
    try {
      const command = new DeleteEndpointCommand({
        EndpointArn: endpointArn,
      });

      await this.snsClient.send(command);

      this.logger.log(
        `Device token unregistered successfully: ${endpointArn}`,
        'PushService',
      );
    } catch (error) {
      this.logger.error(
        `Failed to unregister device token: ${endpointArn}`,
        error instanceof Error ? error.stack : undefined,
        'PushService',
      );
      throw error;
    }
  }

  /**
   * Check endpoint status and re-enable if disabled
   * @param endpointArn - Target endpoint ARN
   * @returns Promise<boolean> - True if endpoint is enabled
   */
  async ensureEndpointEnabled(endpointArn: string): Promise<boolean> {
    try {
      const command = new GetEndpointAttributesCommand({
        EndpointArn: endpointArn,
      });

      const response = await this.snsClient.send(command);
      const attributes = response.Attributes || {};

      if (attributes.Enabled === 'false') {
        this.logger.warn(
          `Endpoint ${endpointArn} is disabled, attempting to re-enable`,
        );

        await this.updateEndpointAttributes(endpointArn, { enabled: true });
        this.logger.log(`Successfully re-enabled endpoint ${endpointArn}`);
        return true;
      }

      return attributes.Enabled === 'true';
    } catch (error) {
      this.logger.error(
        `Failed to check endpoint status: ${endpointArn}`,
        error,
      );
      return false;
    }
  }

  /**
   * Send a push notification to a specific endpoint
   * @param endpointArn - Target endpoint ARN
   * @param message - Push message content
   * @param options - Additional options
   * @returns Promise<string> - Message ID
   */
  async sendPushNotification(
    endpointArn: string,
    message: PushMessage,
    options: PushNotificationOptions = {},
  ): Promise<string> {
    try {
      // Ensure endpoint is enabled before sending
      const isEnabled = await this.ensureEndpointEnabled(endpointArn);
      if (!isEnabled) {
        throw new Error(
          `Endpoint ${endpointArn} is disabled and cannot be re-enabled`,
        );
      }

      const messagePayload = this.buildSnsMessage(message);

      const command = new PublishCommand({
        TargetArn: endpointArn,
        Message: JSON.stringify(messagePayload),
        MessageStructure: 'json',
        MessageAttributes: {
          ...(options.traceId && {
            'AWS.SNS.MOBILE.TraceId': {
              DataType: 'String',
              StringValue: options.traceId,
            },
          }),
        },
      });

      const response = await this.snsClient.send(command);
      const messageId = response.MessageId;

      if (!messageId) {
        throw new Error('Failed to send push notification');
      }

      this.logger.log(
        `Push notification sent successfully: ${messageId} to ${endpointArn}`,
        'PushService',
      );

      return messageId;
    } catch (error) {
      this.logger.error(
        `Failed to send push notification to ${endpointArn}`,
        error instanceof Error ? error.stack : undefined,
        'PushService',
      );
      throw error;
    }
  }

  /**
   * Send OTP via push notification
   * @param endpointArn - Target endpoint ARN
   * @param otpMessage - OTP-specific message
   * @returns Promise<string> - Message ID
   */
  async sendOtpPushNotification(
    endpointArn: string,
    otpMessage: OtpPushMessage,
  ): Promise<string> {
    try {
      const enhancedMessage: PushMessage = {
        ...otpMessage,
        data: {
          ...otpMessage.data,
          type: 'otp',
          otp: otpMessage.otp,
          context: otpMessage.context,
          ...(otpMessage.expiresAt && {
            expiresAt: otpMessage.expiresAt.toISOString(),
          }),
        },
        priority: 'high', // OTP messages should be high priority
        ttl: 300, // 5 minutes TTL for OTP
      };

      return this.sendPushNotification(endpointArn, enhancedMessage);
    } catch (error) {
      this.logger.error(
        `Failed to send OTP push notification to ${endpointArn}`,
        error instanceof Error ? error.stack : undefined,
        'PushService',
      );
      throw error;
    }
  }

  /**
   * Send push notification to multiple endpoints
   * @param endpointArns - Array of target endpoint ARNs
   * @param message - Push message content
   * @returns Promise<string[]> - Array of message IDs
   */
  async sendBulkPushNotification(
    endpointArns: string[],
    message: PushMessage,
  ): Promise<
    Array<{
      endpointArn: string;
      status: 'fulfilled' | 'rejected';
      messageId?: string;
      reason?: any;
    }>
  > {
    try {
      const promises = endpointArns.map((endpointArn) =>
        this.sendPushNotification(endpointArn, message),
      );

      const results = await Promise.allSettled(promises);
      const response = endpointArns.map((endpointArn, index) => {
        const result = results[index];

        if (!result) {
          return {
            endpointArn,
            status: 'rejected' as const,
            reason: `No result returned for endpoint index ${index}`,
          };
        }

        if (result.status === 'fulfilled') {
          return {
            endpointArn,
            status: 'fulfilled' as const,
            messageId: result.value,
          };
        }

        return {
          endpointArn,
          status: 'rejected' as const,
          reason: result.reason,
        };
      });

      const successCount = response.filter(
        (item) => item.status === 'fulfilled',
      ).length;
      const failureCount = response.length - successCount;

      this.logger.log(
        `Bulk push notification completed: ${successCount} sent, ${failureCount} failed`,
        'PushService',
      );

      return response;
    } catch (error) {
      this.logger.error(
        `Failed to send bulk push notification`,
        error instanceof Error ? error.stack : undefined,
        'PushService',
      );
      throw error;
    }
  }

  /**
   * Clean up disabled endpoints that have been disabled for more than 30 days
   * @param platform - Platform type
   * @returns Promise<number> - Number of endpoints cleaned up
   */
  async cleanupDisabledEndpoints(platform: 'ios' | 'android'): Promise<number> {
    try {
      const platformApplicationArn = this.getPlatformApplicationArn(platform);
      const command = new ListEndpointsByPlatformApplicationCommand({
        PlatformApplicationArn: platformApplicationArn,
      });

      const response = await this.snsClient.send(command);
      const endpoints = response.Endpoints || [];

      let cleanedCount = 0;
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      for (const endpoint of endpoints) {
        if (endpoint.Attributes?.Enabled === 'false') {
          const disabledDate = new Date(endpoint.Attributes?.Token || '');
          if (disabledDate < thirtyDaysAgo) {
            await this.unregisterDeviceToken(endpoint.EndpointArn!);
            cleanedCount++;
          }
        }
      }

      this.logger.log(
        `Cleaned up ${cleanedCount} disabled endpoints for ${platform}`,
      );
      return cleanedCount;
    } catch (error) {
      this.logger.error(
        `Failed to cleanup disabled endpoints for ${platform}`,
        error,
      );
      return 0;
    }
  }

  /**
   * Listing endpoints isn't supported directly via SNS without using platform application list endpoints.
   * This method returns an empty list and logs a warning to highlight the limitation.
   */
  async listEndpoints(_platform: 'ios' | 'android'): Promise<EndpointInfo[]> {
    this.logger.warn(
      'Listing endpoints by platform is not supported via the SNS API. Use SNS ListEndpointsByPlatformApplication or stored endpoint metadata instead.',
      'PushService',
    );
    return [];
  }

  /**
   * Update endpoint attributes such as enabling/disabling or updating custom data
   * @param endpointArn - Target endpoint ARN
   * @param attributes - Attributes to update
   * @returns Promise<void>
   */
  async updateEndpointAttributes(
    endpointArn: string,
    attributes: { enabled?: boolean; customData?: Record<string, string> },
  ): Promise<void> {
    try {
      const snsAttributes: Record<string, string> = {};

      if (attributes.enabled !== undefined) {
        snsAttributes.Enabled = attributes.enabled ? 'true' : 'false';
      }

      if (attributes.customData !== undefined) {
        Object.assign(
          snsAttributes,
          this.buildSnsAttributes(attributes.customData),
        );
      }

      const command = new SetEndpointAttributesCommand({
        EndpointArn: endpointArn,
        Attributes: snsAttributes,
      });

      await this.snsClient.send(command);

      this.logger.log(
        `Endpoint attributes updated successfully: ${endpointArn}`,
        'PushService',
      );
    } catch (error) {
      this.logger.error(
        `Failed to update endpoint attributes: ${endpointArn}`,
        error instanceof Error ? error.stack : undefined,
        'PushService',
      );
      throw error;
    }
  }

  /**
   * Get the AWS region configured for the service
   * @returns string - AWS region
   */
  getRegion(): string {
    return this.region;
  }

  /**
   * Check if a platform is supported
   * @param platform - Platform type
   * @returns boolean - True if supported
   */
  isPlatformConfigured(platform: 'ios' | 'android'): boolean {
    try {
      this.getPlatformApplicationArn(platform);
      return true;
    } catch {
      return false;
    }
  }

  private buildSnsMessage(message: PushMessage): Record<string, string> {
    const apnsPayload = this.buildApnsPayload(message);
    const gcmPayload = this.buildGcmPayload(message);

    return {
      default: message.body,
      APNS: JSON.stringify(apnsPayload),
      APNS_SANDBOX: JSON.stringify(apnsPayload),
      GCM: JSON.stringify(gcmPayload),
    };
  }

  private buildApnsPayload(message: PushMessage): Record<string, any> {
    const hasAlertPayload = Boolean(message.title ?? message.body);
    const priority = message.priority === 'high' ? '10' : '5';

    const apnsPayload: Record<string, any> = {
      aps: {
        alert: {
          title: message.title,
          body: message.body,
        },
        sound: message.sound ?? 'default',
        badge: message.badge,
        'push-type': hasAlertPayload ? 'alert' : 'background',
        priority: priority,
      },
      ...(message.data && { custom_data: message.data }),
    };

    if (message.collapseKey) {
      apnsPayload.collapseId = message.collapseKey;
    }

    if (message.ttl !== undefined) {
      apnsPayload.expiration = Math.floor(Date.now() / 1000) + message.ttl;
    }

    return apnsPayload;
  }

  private buildGcmPayload(message: PushMessage): Record<string, any> {
    const gcmPayload: Record<string, any> = {
      notification: {
        title: message.title,
        body: message.body,
        sound: message.sound ?? 'default',
      },
      data: message.data || {},
      android: {
        priority: message.priority ?? 'normal',
        ttl: message.ttl ? `${message.ttl}s` : undefined,
        collapse_key: message.collapseKey,
      },
    };

    return gcmPayload;
  }

  private buildSnsAttributes(
    customData: Record<string, string>,
  ): Record<string, string> {
    return Object.entries(customData).reduce<Record<string, string>>(
      (acc, [key, value]) => {
        acc[key] = value;
        return acc;
      },
      {},
    );
  }

  private extractExistingEndpointArn(error: unknown): string | null {
    if (!error || typeof error !== 'object') {
      return null;
    }

    const name =
      (error as { name?: string; Code?: string }).name ??
      (error as { Code?: string }).Code;
    if (name !== 'InvalidParameterException' && name !== 'InvalidParameter') {
      return null;
    }

    const message =
      (error as { message?: string }).message ??
      (error as { Message?: string }).Message;

    if (typeof message !== 'string') {
      return null;
    }

    const match = message.match(/Endpoint (arn:aws:sns:[^ ]+) already exists/i);

    return match?.[1] ?? null;
  }

  private async updateExistingEndpoint(
    endpointArn: string,
    deviceToken: DeviceToken,
    customUserData: string,
  ): Promise<void> {
    const attributes: Record<string, string> = {
      Token: deviceToken.token,
      Enabled: 'true',
      CustomUserData: customUserData,
      ...(deviceToken.customData
        ? this.buildSnsAttributes(deviceToken.customData)
        : {}),
    };

    try {
      const command = new SetEndpointAttributesCommand({
        EndpointArn: endpointArn,
        Attributes: attributes,
      });

      await this.snsClient.send(command);

      this.logger.log(
        `Existing endpoint updated successfully: ${endpointArn}`,
        'PushService',
      );
    } catch (error) {
      this.logger.error(
        `Failed to update existing endpoint: ${endpointArn}`,
        error instanceof Error ? error.stack : undefined,
        'PushService',
      );
      throw error;
    }
  }

  private getPlatformApplicationArn(platform: DeviceToken['platform']): string {
    switch (platform) {
      case 'ios':
        if (!this.iosPlatformApplicationArn) {
          throw new Error(
            'iOS platform application ARN not configured. Please set AWS_SNS_IOS_PLATFORM_APPLICATION_ARN environment variable.',
          );
        }
        return this.iosPlatformApplicationArn;
      case 'android':
        if (!this.androidPlatformApplicationArn) {
          throw new Error(
            'Android platform application ARN not configured. Please set AWS_SNS_ANDROID_PLATFORM_APPLICATION_ARN environment variable.',
          );
        }
        return this.androidPlatformApplicationArn;
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }
}
