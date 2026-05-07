import type { MiddlewareHandler } from 'hono';
import { getRedis } from '../lib/redis.js';

export function cache(buildKey: (c: Parameters<MiddlewareHandler>[0]) => string, ttlSeconds = 60): MiddlewareHandler {
  return async (c, next) => {
    if (c.req.method !== 'GET') return next();
    const redis = await getRedis();
    const key = buildKey(c);

    if (redis) {
      try {
        const hit = await redis.get(key);
        if (hit) {
          c.header('X-Cache', 'HIT');
          c.header('Content-Type', 'application/json');
          return c.body(hit);
        }
      } catch (error) {
        console.warn('cache read failed:', error);
      }
    }

    await next();

    if (redis && c.res.ok && c.res.headers.get('Content-Type')?.includes('application/json')) {
      try {
        const body = await c.res.clone().text();
        await redis.set(key, body, { EX: ttlSeconds });
        c.header('X-Cache', 'MISS');
      } catch (error) {
        console.warn('cache write failed:', error);
      }
    }
  };
}
