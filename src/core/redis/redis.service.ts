import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { createKeyv } from '@keyv/redis';
import type Keyv from 'keyv';
import Redis from 'ioredis';
import type { RedisOptions } from 'ioredis';

import { ConfigService } from '@/core/config/config.service';

type RedisClientKey = 'app' | 'better-auth' | 'bull' | string;

type ClientOptions = {
  db: number;
  keyPrefix?: string;
  overrides?: RedisOptions;
};

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly clients = new Map<RedisClientKey, Redis>();
  private readonly baseOptions: RedisOptions;
  private cacheStore?: Keyv;

  constructor(private readonly configService: ConfigService) {
    this.baseOptions = this.createBaseOptions();
  }

  getCacheStore(): Keyv {
    if (!this.cacheStore) {
      const newStore = createKeyv({
        url: this.configService.redisUrl,
        database: this.configService.cacheDB.appDB,
      }) as Keyv;
      newStore.on('error', (error) => {
        this.logger.error('Redis cache store error', error);
      });
      this.cacheStore = newStore;
    }
    return this.cacheStore as Keyv;
  }

  getAppClient(): Redis {
    return this.ensureClient('app', {
      db: this.configService.cacheDB.appDB,
    });
  }

  getBetterAuthClient(): Redis {
    return this.ensureClient('better-auth', {
      db: this.configService.cacheDB.appDB,
      keyPrefix: 'better-auth:',
    });
  }

  getBullClient(): Redis {
    return this.ensureClient('bull', {
      db: this.configService.cacheDB.bullDB,
      overrides: {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      },
    });
  }

  getBullConnectionOptions(): RedisOptions {
    return this.buildOptions({
      db: this.configService.cacheDB.bullDB,
      overrides: {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      },
    });
  }

  private ensureClient(key: RedisClientKey, options: ClientOptions): Redis {
    const existing = this.clients.get(key);
    if (existing) {
      return existing;
    }

    const client = new Redis(
      this.configService.redisUrl,
      this.buildOptions(options),
    );
    client.on('error', (error) => {
      this.logger.error(`Redis client (${key}) error`, error);
    });

    this.clients.set(key, client);
    return client;
  }

  private buildOptions(options: ClientOptions): RedisOptions {
    const base: RedisOptions = {
      ...this.baseOptions,
      db: options.db,
      lazyConnect: options.overrides?.lazyConnect ?? true,
      maxRetriesPerRequest:
        options.overrides?.maxRetriesPerRequest ??
        this.baseOptions.maxRetriesPerRequest ??
        3,
    };

    if (options.keyPrefix) {
      base.keyPrefix = options.keyPrefix;
    }

    if (options.overrides) {
      Object.assign(base, options.overrides);
    }

    return base;
  }

  private createBaseOptions(): RedisOptions {
    try {
      const url = new URL(this.configService.redisUrl);
      const tlsEnabled =
        url.protocol === 'rediss:' || url.searchParams.get('tls') === 'true';

      const base: RedisOptions = {
        host: url.hostname,
        port: url.port ? Number(url.port) : 6379,
      };

      if (url.username) {
        base.username = url.username;
      }

      if (url.password) {
        base.password = url.password;
      }

      if (tlsEnabled) {
        base.tls = {};
      }

      return base;
    } catch (error) {
      this.logger.warn(
        `Failed to parse REDIS_URL. Falling back to defaults. ${(error as Error).message}`,
      );

      return {
        host: '127.0.0.1',
        port: 6379,
      };
    }
  }

  async onModuleDestroy() {
    await Promise.allSettled(
      Array.from(this.clients.entries()).map(async ([key, client]) => {
        try {
          if (client.status !== 'end' && client.status !== 'close') {
            await client.quit();
          }
        } catch (error) {
          this.logger.error(`Failed to close Redis client (${key})`, error);
        }
      }),
    );

    if (this.cacheStore) {
      const store = this.cacheStore.opts.store as {
        disconnect?: (force?: boolean) => Promise<void> | void;
      };

      try {
        await store?.disconnect?.();
      } catch (error) {
        this.logger.error('Failed to disconnect Redis cache store', error);
      }
    }
  }
}
