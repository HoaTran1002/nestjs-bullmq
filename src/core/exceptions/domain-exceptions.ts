// src/common/exceptions/domain-exceptions.ts
import { HttpException, HttpStatus } from '@nestjs/common';

// ❌ User-related domain errors
export class UserNotFoundException extends HttpException {
  constructor(userId: number | string) {
    super(`User with ID ${userId} not found`, HttpStatus.NOT_FOUND);
  }
}

export class EmailAlreadyExistsException extends HttpException {
  constructor(email: string) {
    super(`Email ${email} already exists`, HttpStatus.CONFLICT);
  }
}

// ⚙️ Business logic errors
export class JobAlreadyAppliedException extends HttpException {
  constructor(jobId: string) {
    super(`Already applied to job ${jobId}`, HttpStatus.BAD_REQUEST);
  }
}

export class JobExpiredException extends HttpException {
  constructor(jobId: string) {
    super(`Job ${jobId} is expired`, HttpStatus.GONE);
  }
}
