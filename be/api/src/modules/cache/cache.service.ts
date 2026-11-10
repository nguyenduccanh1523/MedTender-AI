import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common'
import Redis from 'ioredis'

interface CacheEntry<T> {
  value: T
  expiresAt: number
}

@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name)
  private readonly memoryCache = new Map<string, CacheEntry<unknown>>()
  private redisClient: Redis | null = null
  private redisAvailable = false

  async onModuleInit() {
    const redisUrl = process.env.REDIS_URL
    if (redisUrl) {
      try {
        const client = new Redis(redisUrl, {
          lazyConnect: true,
          connectTimeout: 2000,
          maxRetriesPerRequest: 1,
          retryStrategy: () => null,
        })

        client.on('error', (err) => {
          if (this.redisAvailable) {
            this.logger.warn(`Redis connection lost: ${err.message}. Falling back to in-memory cache.`)
          }
          this.redisAvailable = false
        })

        await client.connect()
        this.redisClient = client
        this.redisAvailable = true
        this.logger.log(`Connected to Redis at ${redisUrl}. L2 Distributed Cache is active.`)
      } catch {
        this.logger.log(`Redis not available at ${redisUrl}. Using high-performance L1 In-Memory Cache.`)
      }
    } else {
      this.logger.log('REDIS_URL not configured. Operating in high-performance L1 In-Memory Cache mode.')
    }
  }

  async get<T>(key: string): Promise<T | undefined> {
    // 1. L1 In-Memory Cache check
    const mem = this.memoryCache.get(key)
    if (mem) {
      if (mem.expiresAt > Date.now()) {
        return mem.value as T
      }
      this.memoryCache.delete(key)
    }

    // 2. L2 Redis check
    if (this.redisAvailable && this.redisClient) {
      try {
        const raw = await this.redisClient.get(key)
        if (raw) {
          const parsed = JSON.parse(raw) as T
          this.memoryCache.set(key, { value: parsed, expiresAt: Date.now() + 30_000 })
          return parsed
        }
      } catch (err) {
        this.logger.warn(`Redis get error: ${(err as Error).message}`)
      }
    }

    return undefined
  }

  async set<T>(key: string, value: T, ttlSeconds = 60): Promise<void> {
    // 1. Store in L1 In-Memory Cache
    this.memoryCache.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 })

    // 2. Store in L2 Redis if available
    if (this.redisAvailable && this.redisClient) {
      try {
        await this.redisClient.set(key, JSON.stringify(value), 'EX', ttlSeconds)
      } catch (err) {
        this.logger.warn(`Redis set error: ${(err as Error).message}`)
      }
    }
  }

  async del(key: string): Promise<void> {
    this.memoryCache.delete(key)
    if (this.redisAvailable && this.redisClient) {
      try {
        await this.redisClient.del(key)
      } catch {
        // ignore
      }
    }
  }

  async invalidatePrefix(prefix: string): Promise<void> {
    for (const key of this.memoryCache.keys()) {
      if (key.startsWith(prefix) || key.includes(prefix)) {
        this.memoryCache.delete(key)
      }
    }

    if (this.redisAvailable && this.redisClient) {
      try {
        const keys = await this.redisClient.keys(`*${prefix}*`)
        if (keys.length > 0) {
          await this.redisClient.del(...keys)
        }
      } catch (err) {
        this.logger.warn(`Redis prefix invalidation error: ${(err as Error).message}`)
      }
    }
  }

  async wrap<T>(key: string, ttlSeconds: number, fetcher: () => Promise<T>): Promise<T> {
    const cached = await this.get<T>(key)
    if (cached !== undefined) {
      return cached
    }
    const fresh = await fetcher()
    await this.set(key, fresh, ttlSeconds)
    return fresh
  }

  async onModuleDestroy() {
    if (this.redisClient) {
      try {
        await this.redisClient.quit()
      } catch {
        // ignore
      }
    }
  }
}
