export class NonRetryableMailError extends Error {
  constructor(message: string, cause?: any) {
    super(message);
  }
}