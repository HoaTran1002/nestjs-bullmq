export class RetryableMailError extends Error {

  constructor(message: string, cause?: any) {
    super(message);
  }
}