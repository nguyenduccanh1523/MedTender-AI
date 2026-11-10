import { PrismaPg } from '@prisma/adapter-pg'

import { PrismaClient } from './generated/client'

export function createPrismaClient(value = process.env.DATABASE_URL, poolSize?: number): PrismaClient {
  if (!value) throw new Error('DATABASE_URL is required')

  const url = URL.parse(value)
  if (!url?.hostname || !['postgres:', 'postgresql:'].includes(url.protocol)) {
    throw new Error('DATABASE_URL must be a PostgreSQL connection string')
  }

  const schema = url.searchParams.get('schema') ?? 'public'
  url.searchParams.delete('schema')
  const adapter = new PrismaPg(
    {
      connectionString: url.href,
      connectionTimeoutMillis: 15_000,
      idleTimeoutMillis: 300_000,
      max: poolSize ?? 10,
      keepAlive: true,
      keepAliveInitialDelayMillis: 5_000,
    },
    {
      schema,
      onPoolError: (err) => {
        console.warn('[PrismaPg Pool] Idle pool connection reset:', err.message)
      },
      onConnectionError: (err) => {
        console.warn('[PrismaPg Connection] Connection reset:', err.message)
      },
    },
  )
  return new PrismaClient({ adapter })
}
