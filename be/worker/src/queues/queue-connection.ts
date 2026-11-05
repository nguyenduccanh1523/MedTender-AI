import Redis from 'ioredis'

export function createQueueConnection(value: string | undefined): Redis {
  const url = value ? URL.parse(value) : null
  if (!url?.hostname || !['redis:', 'rediss:'].includes(url.protocol)) {
    throw new Error('REDIS_URL must be a redis:// or rediss:// URL with a hostname')
  }

  return new Redis(url.href, {
    lazyConnect: true,
    connectTimeout: 5_000,
    maxRetriesPerRequest: null,
  })
}
