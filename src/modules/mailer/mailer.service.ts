import { Injectable, Logger } from '@nestjs/common';
import { MailerService as NestMailerService } from '@nestjs-modules/mailer';
import { OtpMailRenderer } from './templates/otp-email.template';
import { renderOrganizationInvitationEmail } from './templates/organization-invitation.template';
import { I18nService } from 'nestjs-i18n/dist/services/i18n.service';
import { PasswordResetMailRenderer } from './templates/password-reset.template';
import { ConfigService } from '@/core/config/config.service';

export type MailPriority = 'low' | 'normal' | 'high';

export interface MailRecipient {
  email: string;
  name?: string;
}

export interface BaseMailPayload {
  recipient: MailRecipient;
  cc?: MailRecipient[];
  bcc?: MailRecipient[];
  priority?: MailPriority;
  correlationId?: string;
}

export interface OtpMailPayload extends BaseMailPayload {
  otp?: string;
  context: 'sign-in' | 'email-verification' | 'forget-password';
  acceptLanguage?: string;
  resetLink?: string;
}

export interface OrganizationInvitationPayload extends BaseMailPayload {
  organizationName: string;
  inviterName: string;
  inviteLink: string;
}

export interface PasswordResetPayload extends BaseMailPayload {
  resetLink: string;
  expiresInMinutes: number;
  acceptLanguage?: string;
}

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  constructor(
    private readonly mailerService: NestMailerService,
    private readonly i18n: I18nService,
    private readonly configService: ConfigService,
  ) {}

  private get fromAddress(): string {
    const name = this.configService.mailerDefaultFromName;
    const email = this.configService.mailerDefaultFromEmail;
    return `${name} <${email}>`;
  }

  async sendOtpEmail(payload: OtpMailPayload): Promise<void> {
    const correlationId = payload.correlationId ?? 'no-id';
    const maskedOtp = payload.otp?.replace(/./g, '*') ?? 'no-otp';
    const locale = payload.acceptLanguage?.split('-')[0] ?? 'en';

    this.logger.log(
      `[${correlationId}] Queued OTP email for ${payload.recipient.email} [OTP=${payload.otp}] locale=${locale} payload: ${JSON.stringify(
        {
          context: payload.context,
          email: payload.recipient.email,
        },
      )}`,
    );

    try {
      const renderer = new OtpMailRenderer(this.i18n);
      const { subject, html, text, attachments } =
        await renderer.render(payload);

      await this.mailerService.sendMail({
        from: this.fromAddress,
        to: payload.recipient.email,
        subject,
        text,
        html,
        attachments,
      });
    } catch (error) {
      this.logger.error(
        `[${correlationId}] Failed to send OTP email for ${payload.recipient.email}`,
        error,
      );
      throw error;
    }

    this.logger.log(
      `[${correlationId}] Sent OTP email for ${payload.recipient.email} [locale=${locale}]`,
    );
  }

  async sendPasswordResetEmail(payload: PasswordResetPayload): Promise<void> {
    this.logger.log(
      `Queued password reset email for ${payload.recipient.email} ` +
        `[expiresIn=${payload.expiresInMinutes}m]`,
    );
    const lang = (payload.acceptLanguage?.split('-')[0] ?? 'en') as 'en' | 'ko';
    const correlationId = payload.correlationId ?? 'no-id';
    const renderer = new PasswordResetMailRenderer(this.i18n);
    const email = await renderer.render({
      ...payload,
      acceptLanguage: lang,
      context: 'forget-password',
    });

    try {
      await this.mailerService.sendMail({
        from: this.fromAddress,
        to: payload.recipient.email,
        subject: email.subject,
        text: email.text,
        html: email.html,
        attachments: email.attachments,
      });
    } catch (error) {
      this.logger.error(
        `[${correlationId}] Failed to send password reset email for ${payload.recipient.email}`,
        error,
      );
      throw error;
    }

    this.logger.log(
      `[${correlationId}] Sent password reset email for ${payload.recipient.email}`,
    );
  }

  async sendOrganizationInvitationEmail(
    payload: OrganizationInvitationPayload,
  ): Promise<void> {
    this.logger.log(
      `Queued organization invitation email for ${payload.recipient.email} ` +
        `[organization=${payload.organizationName}]`,
    );
    const correlationId = payload.correlationId ?? 'no-id';
    const { subject, text, html, attachments } =
      renderOrganizationInvitationEmail(payload);

    try {
      await this.mailerService.sendMail({
        from: this.fromAddress,
        to: payload.recipient.email,
        subject,
        text,
        html,
        attachments,
      });
    } catch (error) {
      this.logger.error(
        `[${correlationId}] Failed to send organization invitation email for ${payload.recipient.email}`,
        error,
      );
      throw error;
    }

    this.logger.log(
      `[${correlationId}] Sent organization invitation email for ${payload.recipient.email}`,
    );
  }
}
