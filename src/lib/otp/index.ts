/**
 * Central OTP handler registry so Better Auth stays transport agnostic.
 * Each channel is responsible for registering its sender during module boot.
 */

export type EmailOtpContext =
  | 'sign-in'
  | 'email-verification'
  | 'forget-password';

export type OtpMetadata = {
  correlationId?: string;
  [key: string]: unknown;
};

export type EmailOtpPayload = {
  email: string;
  otp: string;
  type: EmailOtpContext;
  metadata?: OtpMetadata;
};

export type PhoneOtpPurpose = 'verification' | 'password-reset';

export type PhoneOtpPayload = {
  phoneNumber: string;
  code: string;
  purpose: PhoneOtpPurpose;
  metadata?: OtpMetadata;
};

export type EmailOtpHandler = (
  payload: EmailOtpPayload,
  request?: unknown,
) => Promise<void>;
export type PhoneOtpHandler = (
  payload: PhoneOtpPayload,
  request?: unknown,
) => Promise<void>;

let emailOtpHandler: EmailOtpHandler | null = null;
let phoneOtpHandler: PhoneOtpHandler | null = null;

export const registerEmailOtpSender = (handler: EmailOtpHandler): void => {
  emailOtpHandler = handler;
};

export const registerPhoneOtpSender = (handler: PhoneOtpHandler): void => {
  phoneOtpHandler = handler;
};

export const resolveEmailOtpSender = (): EmailOtpHandler => {
  if (!emailOtpHandler) {
    throw new Error('Email OTP handler not registered');
  }

  return emailOtpHandler;
};

export const resolvePhoneOtpSender = (): PhoneOtpHandler => {
  if (!phoneOtpHandler) {
    throw new Error('Phone OTP handler not registered');
  }

  return phoneOtpHandler;
};

export const resetOtpHandlers = (): void => {
  emailOtpHandler = null;
  phoneOtpHandler = null;
};
