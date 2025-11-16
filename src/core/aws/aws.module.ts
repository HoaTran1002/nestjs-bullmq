import { Module } from '@nestjs/common';
import { CoreConfigModule } from '@/core/config/config.module';
import { PushService } from './services/push.service';
import { LoggerModule } from '@/core/logging/logger.module';
import { BucketService } from './services/buket.service';
import { SnsSmsService } from './services/sns-sms.service';

/**
 * AWS module providing cloud services integration
 * Contains services for S3, SNS, and other AWS services
 */
@Module({
  imports: [CoreConfigModule, LoggerModule],
  providers: [BucketService, PushService, SnsSmsService],
  exports: [BucketService, PushService, SnsSmsService],
})
export class AwsModule {}
