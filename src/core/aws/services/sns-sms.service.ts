import { Injectable } from '@nestjs/common';
import { PublishCommand, SNSClient } from '@aws-sdk/client-sns';

import { ConfigService } from '@/core/config/config.service';
import { LoggerService } from '@/core/logging/logger.service';

/**
 * Service for sending SMS messages via AWS SNS
 * Supports OTP delivery with internationalization and error handling
 */
@Injectable()
export class SnsSmsService {
  private readonly snsClient: SNSClient;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(SnsSmsService.name);

    this.snsClient = new SNSClient({
      region: this.configService.awsRegion,
      credentials: {
        accessKeyId: this.configService.awsAccessKeyId,
        secretAccessKey: this.configService.awsSecretAccessKey,
      },
    });

    this.logger.log(
      `SnsSmsService initialized in region: ${this.configService.awsRegion}`,
    );
  }

  /**
   * Send OTP SMS to a phone number
   * @param phoneNumber - Phone number in E.164 format
   * @param message - SMS message content
   * @returns Promise<string> - Message ID from SNS
   */
  async sendOtpSms(phoneNumber: string, message: string): Promise<string> {
    try {
      const params = {
        PhoneNumber: phoneNumber,
        Message: message,
        MessageAttributes: {
          'AWS.SNS.SMS.SMSType': {
            DataType: 'String',
            StringValue: 'Transactional',
          },
          'AWS.SNS.SMS.SenderID': {
            DataType: 'String',
            StringValue: this.configService.snsSmsSenderId,
          },
        },
      };

      const result = await this.snsClient.send(new PublishCommand(params));

      this.logger.log(
        `SMS sent successfully to ${phoneNumber}, MessageId: ${result.MessageId}`,
      );

      return result.MessageId!;
    } catch (error) {
      this.logger.error(
        `Failed to send SMS to ${phoneNumber}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  /**
   * Test SNS connectivity with a minimal message
   * Used for health checks
   */
  async testConnectivity(): Promise<string> {
    const testPhoneNumber = this.configService.snsTestPhoneNumber;

    if (!testPhoneNumber) {
      throw new Error(
        'No test phone number configured for SMS connectivity test',
      );
    }

    return this.sendOtpSms(testPhoneNumber, 'SNS SMS connectivity test');
  }

  /**
   * Extract country code from phone number for metrics
   */
  private extractCountryCode(phoneNumber: string): string {
    // E.164 format: +849032471234 → VN
    if (phoneNumber.startsWith('+84')) {
      return 'VN';
    }
    // Default to US for other numbers
    return 'US';
  }
}
