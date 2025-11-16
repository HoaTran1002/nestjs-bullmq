import { Module } from '@nestjs/common';
import { PrismaModule } from '@/core/database/prisma.module';
import { UserRepository } from './repository/user-repository';
import { UserService } from './user.service';
import { UserController } from './user.controller';

@Module({
  imports: [PrismaModule],
  controllers: [UserController],
  providers: [UserService, UserRepository],
  exports: [UserService, UserRepository],
})
export class UserModule {}
