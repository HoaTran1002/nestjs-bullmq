/**
 * Custom error classes for SMS OTP processing
 */

/**
 * Retryable SMS error - temporary issues that should be retried
 */
export class RetryableSmsError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'RetryableSmsError';
  }
}

/**
 * Non-retryable SMS error - permanent issues that should not be retried
 */
export class NonRetryableSmsError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'NonRetryableSmsError';
  }
}
