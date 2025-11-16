import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';

export class RepositoryHelper {
  static handleError(err: unknown) {
    if (err instanceof PrismaClientKnownRequestError) {
      switch (err.code) {
        case 'P2002':
          throw new ConflictException('Duplicate key value');
        case 'P2003':
          throw new BadRequestException('Invalid foreign key');
      }
    }

    throw new InternalServerErrorException('Database error');
  }
}
