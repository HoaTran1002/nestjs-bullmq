import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

import { AwsModule } from '@/core/aws/aws.module';
import { CoreConfigModule } from '@/core/config/config.module';
import { ConfigService } from '@/core/config/config.service';
import { LoggerModule } from '@/core/logging/logger.module';
import { RedisModule } from '@/core/redis/redis.module';
import { RedisService } from '@/core/redis/redis.service';
import { MailerModule } from '../mailer/mailer.module';
import { OtpQueueService } from './otp/otp-queue.service';
import { OTP_QUEUE_NAME } from './otp/otp-queue.types';
import { OtpQueueProcessor } from './otp/otp.processor';

@Global()
@Module({
  imports: [
    ScheduleModule.forRoot(),
    BullModule.forRootAsync({
      imports: [CoreConfigModule, RedisModule],
      inject: [RedisService],
      useFactory: (redisService: RedisService) => ({
        connection: redisService.getBullConnectionOptions(),
        defaultJobOptions: {
          removeOnComplete: 10,
          removeOnFail: 5,
        },
      }),
    }),
    BullModule.registerQueueAsync({
      name: OTP_QUEUE_NAME,
      imports: [CoreConfigModule],
      useFactory: (configService: ConfigService) => ({
        defaultJobOptions: {
          attempts: configService.bullmqDefaultJobAttempts,
          backoff: {
            type: 'exponential' as const,
            delay: configService.bullmqDefaultBackoffDelay,
          },
          removeOnComplete: 100,
          removeOnFail: 500,
        },
      }),
      inject: [ConfigService],
    }),
    LoggerModule,
    MailerModule,
    AwsModule,
  ],
  providers: [OtpQueueService, OtpQueueProcessor],
  exports: [OtpQueueService, BullModule],
})
export class WorkersModule {}
