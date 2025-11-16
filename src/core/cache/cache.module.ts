import { Module, Global } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { CoreConfigModule } from '../config/config.module';
import { ConfigService } from '../config/config.service';
import { LoggerModule } from '../logging/logger.module';
import { RedisModule } from '../redis/redis.module';
import { RedisService } from '../redis/redis.service';
import { CacheService } from './cache.service';

@Global()
@Module({
  imports: [
    CacheModule.registerAsync({
      imports: [CoreConfigModule, LoggerModule, RedisModule],
      useFactory: (
        configService: ConfigService,
        redisService: RedisService,
      ) => {
        return {
          stores: [redisService.getCacheStore()],
          ttl: configService.cacheTtl,
          max: configService.cacheMax,
        };
      },
      inject: [ConfigService, RedisService],
    }),
  ],
  providers: [CacheService],
  exports: [CacheModule, CacheService],
})
export class CoreCacheModule {}
