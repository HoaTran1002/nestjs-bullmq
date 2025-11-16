import { Inject } from '@nestjs/common';
import { CacheService } from '../cache.service';

type CacheDecoratedInstance = { _cacheService?: CacheService };

export function Cached(
  cacheKeyOrGenerator: string | ((...args: any[]) => string),
  ttl?: number,
) {
  const injectCache = Inject(CacheService);

  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    injectCache(target, '_cacheService'); // Inject CacheService into the class using the decorator

    const originalMethod = descriptor.value;

    descriptor.value = async function (
      this: CacheDecoratedInstance,
      ...args: any[]
    ) {
      const cacheService = this._cacheService;
      if (!cacheService) {
        console.error(
          `CacheService not injected in ${target.constructor.name}. Bypassing cache for ${propertyKey}.`,
        );
        return originalMethod.apply(this, args);
      }

      let cacheKey: string;
      if (typeof cacheKeyOrGenerator === 'function') {
        cacheKey = cacheKeyOrGenerator(...args);
      } else {
        cacheKey = cacheKeyOrGenerator;
      }

      try {
        const cachedValue = await cacheService.get(cacheKey);
        if (cachedValue !== undefined) {
          return cachedValue;
        }

        // console.log(`Cache MISS for key: ${cacheKey}`);
        const result = await originalMethod.apply(this, args);
        await cacheService.set(cacheKey, result, ttl);
        return result;
      } catch (error) {
        console.error(`Cache operation failed for key ${cacheKey}:`, error);
        // Fallback to original method if cache fails
        const result = await originalMethod.apply(this, args);
        try {
          await cacheService.set(cacheKey, result, ttl);
        } catch (setError) {
          console.error(`Cache set failed for key ${cacheKey}:`, setError);
        }
        return result;
      }
    };

    return descriptor;
  };
}

// We'll also need a way to invalidate this cache.
// Let's create a decorator for that as well, or provide guidance.

export function InvalidateCache(
  cacheKeyOrGenerator: string | ((...args: any[]) => string | string[]),
) {
  const injectCache = Inject(CacheService);

  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    injectCache(target, '_cacheService');

    const originalMethod = descriptor.value;

    descriptor.value = async function (
      this: CacheDecoratedInstance,
      ...args: any[]
    ) {
      const cacheService = this._cacheService;
      if (!cacheService) {
        console.error(
          `CacheService not injected in ${target.constructor.name}. Cannot invalidate cache for ${propertyKey}.`,
        );
        return originalMethod.apply(this, args);
      }
      let cacheKeys: string | string[];
      if (typeof cacheKeyOrGenerator === 'function') {
        cacheKeys = cacheKeyOrGenerator(...args);
      } else {
        cacheKeys = cacheKeyOrGenerator;
      }

      try {
        const result = await originalMethod.apply(this, args);
        // Invalidate one or multiple cache keys
        if (Array.isArray(cacheKeys)) {
          await Promise.all(cacheKeys.map((key) => cacheService.del(key)));
        } else {
          await cacheService.del(cacheKeys);
        }
        return result;
      } catch (error) {
        console.error(
          `Cache invalidation failed for key(s) ${cacheKeys}:`,
          error,
        );
        // Still execute original method even if invalidation fails
        return originalMethod.apply(this, args);
      }
    };
    return descriptor;
  };
}
