import { EmailOtpPayload, PhoneOtpPayload } from '@/lib/otp/index';

export type OtpRequestContext = {
  ip?: string;
  userAgent?: string;
  acceptLanguage?: string;
  requestId?: string;
  deviceEndpointId?: string;
};

export type EmailOtpQueueJob = {
  channel: 'email';
  payload: EmailOtpPayload;
  requestedAt: string;
  requestContext?: OtpRequestContext;
  correlationId: string;
};

export type PhoneOtpQueueJob = {
  channel: 'phone';
  payload: PhoneOtpPayload;
  requestedAt: string;
  requestContext?: OtpRequestContext;
  correlationId: string;
};

export type SmsOtpQueueJob = {
  channel: 'sms';
  payload: PhoneOtpPayload;
  requestedAt: string;
  requestContext?: OtpRequestContext;
  correlationId: string;
};

export type OtpQueueJob = EmailOtpQueueJob | PhoneOtpQueueJob | SmsOtpQueueJob;

export const OTP_QUEUE_NAME = 'OTP_DISPATCH';
