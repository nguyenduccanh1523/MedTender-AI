import { createQueueConnection } from '../src/queues/queue-connection'

describe('worker Redis connection', () => {
  it.each([undefined, '', 'http://127.0.0.1:56379', 'redis://'])(
    'rejects a missing or invalid Redis URL (%p)',
    (value) => {
      expect(() => createQueueConnection(value)).toThrow(/REDIS_URL/)
    },
  )

  it('configures a lazy connection compatible with BullMQ workers', () => {
    const connection = createQueueConnection('redis://127.0.0.1:56379/2')
    try {
      expect(connection.options).toMatchObject({
        host: '127.0.0.1',
        port: 56379,
        db: 2,
        lazyConnect: true,
        maxRetriesPerRequest: null,
      })
      expect(connection.status).toBe('wait')
    } finally {
      connection.disconnect()
    }
  })
})
