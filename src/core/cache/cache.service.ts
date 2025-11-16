import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

@Injectable()
export class CacheService {
  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  async get<T>(key: string): Promise<T | undefined> {
    const result = await this.cacheManager.get<T>(key);
    return result ?? undefined;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    await this.cacheManager.set(key, value, ttl);
  }

  async del(key: string): Promise<void> {
    await this.cacheManager.del(key);
  }

  async reset(): Promise<void> {
    await this.cacheManager.clear();
  }

  async testConnection(): Promise<boolean> {
    try {
      const testKey = 'redis:connection:test';
      const testValue = 'connected-' + Date.now();

      await this.set(testKey, testValue);
      const retrievedValue = await this.get<string>(testKey);
      await this.del(testKey);

      return retrievedValue === testValue;
    } catch (error) {
      console.error('Redis connection test failed:', error);
      return false;
    }
  }
}
