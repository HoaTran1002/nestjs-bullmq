import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { I18nService } from 'nestjs-i18n';

import { OtpPushMessage, PushService } from '@/core/aws/services/push.service';
import { LoggerService } from '@/core/logging/logger.service';
import { PhoneOtpPayload } from '@/lib/otp/';
import {
  NonRetryableMailError,
  RetryableMailError,
} from '@/modules/mailer/errors';
import { MailerService } from '@/modules/mailer/mailer.service';
import { PrismaService } from '@/core/database/prisma.service';
import { SnsSmsService } from '@/core/aws/services/sns-sms.service';
import { NonRetryableSmsError, RetryableSmsError } from './error';
import { OTP_QUEUE_NAME, OtpQueueJob } from './otp-queue.types';

@Processor(OTP_QUEUE_NAME)
export class OtpQueueProcessor extends WorkerHost {
  constructor(
    private readonly logger: LoggerService,
    private readonly mailerService: MailerService,
    private readonly pushService: PushService,
    private readonly i18n: I18nService,
    private readonly prisma: PrismaService,
    private readonly snsSmsService: SnsSmsService,
  ) {
    super();
    this.logger.setContext(OtpQueueProcessor.name);
  }

  override async process(job: Job<OtpQueueJob>): Promise<void> {
    this.logger.log(`Processing OTP job ${job.id} [type=${job.data.channel}]`);
    if (job.data.channel === 'email') {
      await this.handleEmailOtp(job);
      return;
    }

    if (job.data.channel === 'sms') {
      await this.handleSmsOtp(job);
      return;
    }

    if (job.data.channel === 'phone') {
      await this.handlePhoneOtp(job);
      return;
    }

    this.logger.warn(`Unknown OTP channel received for job ${job.id}`);
  }

  private async handleEmailOtp(job: Job<OtpQueueJob>): Promise<void> {
    if (job.data.channel !== 'email') {
      return;
    }

    const { payload } = job.data;
    this.logger.debug(
      `Received email OTP job ${job.id} for ${payload.email} [type=${payload.type}]`,
    );

    try {
      switch (payload.type) {
        case 'sign-in':
          await this.mailerService.sendOtpEmail({
            context: 'sign-in',
            recipient: { email: payload.email },
            acceptLanguage: job.data.requestContext?.acceptLanguage,
            ...payload,
          });
          break;
        case 'email-verification':
          await this.mailerService.sendOtpEmail({
            context: 'email-verification',
            recipient: { email: payload.email },
            acceptLanguage: job.data.requestContext?.acceptLanguage,
            ...payload,
          });
          break;
        case 'forget-password':
          await this.mailerService.sendOtpEmail({
            context: 'forget-password',
            recipient: { email: payload.email },
            acceptLanguage: job.data.requestContext?.acceptLanguage,
            otp: payload.otp,
            correlationId: job.data.correlationId,
          });
          break;
        default:
          throw new Error(`Unknown OTP type: ${payload.type}`);
      }

      this.logger.log(`OTP email sent successfully (jobId=${job.id})`);
    } catch (error: unknown) {
      const mailerError = error as { responseCode?: number; code?: string };

      if (
        typeof mailerError.responseCode === 'number' &&
        [421, 450].includes(mailerError.responseCode)
      ) {
        this.logger.warn(
          `Provider throttling (code=${mailerError.responseCode}), will retry...`,
        );
        throw new RetryableMailError('SMTP throttling', error);
      }

      if (error instanceof NonRetryableMailError) {
        this.logger.warn(
          `Non-retryable mail error (jobId=${job.id}): ${error.message}`,
        );
        return;
      }

      if (error instanceof RetryableMailError) {
        this.logger.warn(
          `Temporary mail error (jobId=${job.id}), will retry...`,
        );
        throw error;
      }

      if (
        mailerError.code === 'ECONNECTION' ||
        mailerError.code === 'ETIMEDOUT'
      ) {
        this.logger.error(
          `Network/connection issue on job ${job.id}, will retry.`,
        );
        throw new RetryableMailError('Network issue', error);
      }

      this.logger.error(
        `Unexpected error while processing job ${job.id}`,
        this.serializeError(error),
      );
      throw error;
    }
  }

  private async handlePhoneOtp(job: Job<OtpQueueJob>): Promise<void> {
    if (job.data.channel !== 'phone') {
      return;
    }

    const { payload, requestContext, correlationId } = job.data;
    const endpointArn =
      requestContext?.deviceEndpointId ??
      (typeof payload.metadata?.pushEndpointId === 'string'
        ? payload.metadata.pushEndpointId
        : undefined);

    if (!endpointArn) {
      this.logger.warn(
        `No endpoint ARN for phone OTP job ${job.id}; attempting email fallback.`,
      );
      const sentFallback = await this.sendFallbackEmail(job);
      if (!sentFallback) {
        this.logger.warn(
          `OTP fallback email not sent for job ${job.id}; leaving for manual resend.`,
        );
      }
      return;
    }

    const context = this.mapPurposeToOtpContext(payload.purpose);
    const locale = (requestContext?.acceptLanguage?.split('-')[0] ?? 'en') as
      | 'en'
      | 'ko';

    const { title, body } = await this.getLocalizedOtpMessage(
      context,
      payload.code,
      locale,
    );

    const message: OtpPushMessage = {
      type: 'otp',
      otp: payload.code,
      context,
      title,
      body,
      data: {
        channel: 'push',
        purpose: payload.purpose,
        phoneNumber: payload.phoneNumber,
        correlationId,
      },
    };

    try {
      await this.pushService.sendOtpPushNotification(endpointArn, message);
      this.logger.log(
        `OTP push dispatched successfully for job ${job.id} (endpoint=${endpointArn})`,
      );
    } catch (error: unknown) {
      // Handle specific endpoint disabled error
      if (
        error instanceof Error &&
        error.message.includes('EndpointDisabledException')
      ) {
        this.logger.warn(
          `Endpoint ${endpointArn} is disabled for job ${job.id}. User may have uninstalled the app or revoked permissions.`,
        );
        // Don't retry - this is a permanent failure
        return;
      }

      if (
        error instanceof Error &&
        error.message.includes('disabled and cannot be re-enabled')
      ) {
        this.logger.warn(
          `Endpoint ${endpointArn} is permanently disabled for job ${job.id}. Skipping push notification.`,
        );
        // Don't retry - this is a permanent failure
        return;
      }

      this.logger.error(
        `Failed to send OTP push notification for job ${job.id}`,
        this.serializeError(error),
      );
      throw error;
    }
  }

  private async handleSmsOtp(job: Job<OtpQueueJob>): Promise<void> {
    if (job.data.channel !== 'sms') {
      return;
    }

    const { payload, requestContext, correlationId } = job.data;
    const locale = (requestContext?.acceptLanguage?.split('-')[0] ?? 'en') as
      | 'en'
      | 'ko';

    // Get localized SMS message
    const messageTemplate = await this.i18n.translate(
      `sms.otp.body.${payload.purpose}`,
      {
        lang: locale,
      },
    );

    // Manually replace template variables (same approach as email/push templates)
    const message = messageTemplate.replace('{{code}}', payload.code);

    try {
      const messageId = await this.snsSmsService.sendOtpSms(
        payload.phoneNumber,
        message,
      );
      this.logger.log(
        `OTP SMS sent successfully for job ${job.id} to ${payload.phoneNumber} (messageId=${messageId})`,
      );
    } catch (error: unknown) {
      const smsError = error as { code?: string; message?: string };

      // Handle specific SNS error codes
      if (
        smsError.code === 'InvalidParameterException' ||
        smsError.code === 'BadRequestException'
      ) {
        this.logger.warn(
          `Invalid phone number or parameters for SMS job ${job.id}: ${smsError.message}`,
        );
        throw new NonRetryableSmsError(
          'Invalid phone number or parameters',
          error,
        );
      }

      if (
        smsError.code === 'ThrottlingException' ||
        smsError.code === 'InternalError'
      ) {
        this.logger.warn(
          `SNS throttling or internal error for job ${job.id}, will retry: ${smsError.message}`,
        );
        throw new RetryableSmsError('SNS temporary failure', error);
      }

      if (error instanceof NonRetryableSmsError) {
        this.logger.warn(
          `Non-retryable SMS error (jobId=${job.id}): ${error.message}`,
        );
        return;
      }

      if (error instanceof RetryableSmsError) {
        this.logger.warn(
          `Temporary SMS error (jobId=${job.id}), will retry...`,
        );
        throw error;
      }

      // Network/connection issues
      if (smsError.code === 'ECONNRESET' || smsError.code === 'ETIMEDOUT') {
        this.logger.error(`Network issue on SMS job ${job.id}, will retry.`);
        throw new RetryableSmsError('Network issue', error);
      }

      this.logger.error(
        `Unexpected error while processing SMS job ${job.id}`,
        this.serializeError(error),
      );
      throw error;
    }
  }

  private mapPurposeToOtpContext(
    purpose: PhoneOtpPayload['purpose'],
  ): OtpPushMessage['context'] {
    if (purpose === 'password-reset') {
      return 'forget-password';
    }

    return 'sign-in';
  }

  private async getLocalizedOtpMessage(
    context: OtpPushMessage['context'],
    code: string,
    locale: 'en' | 'ko',
  ) {
    const title = await this.i18n.translate(`push.otp.title.${context}`, {
      lang: locale,
    });
    const bodyTemplate = await this.i18n.translate(`push.otp.body.${context}`, {
      lang: locale,
    });

    // Manually replace template variables (same approach as email template)
    const body = bodyTemplate.replace('{{code}}', code);

    return { title, body };
  }

  private serializeError(error: unknown): string {
    if (error instanceof Error) {
      return error.stack ?? error.message;
    }

    return String(error);
  }

  private async sendFallbackEmail(job: Job<OtpQueueJob>): Promise<boolean> {
    if (job.data.channel !== 'phone') {
      return false;
    }

    const { payload, requestContext, correlationId } = job.data;
    const user = await this.prisma.user.findFirst({
      where: { phoneNumber: payload.phoneNumber },
      select: { email: true, name: true },
    });

    if (!user?.email) {
      this.logger.warn(
        `No email found for phone OTP fallback (jobId=${job.id}, phone=${payload.phoneNumber}).`,
      );
      return false;
    }

    try {
      await this.mailerService.sendOtpEmail({
        recipient: {
          email: user.email,
          name: user.name ?? undefined,
        },
        otp: payload.code,
        context: this.mapPurposeToOtpContext(payload.purpose),
        acceptLanguage: requestContext?.acceptLanguage,
        correlationId,
      });
      this.logger.log(
        `Fallback OTP email sent for job ${job.id} to ${user.email}.`,
      );
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to send fallback OTP email for job ${job.id}`,
        this.serializeError(error),
      );
      return false;
    }
  }
}
