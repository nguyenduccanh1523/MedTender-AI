import { randomUUID } from 'node:crypto'
import { Queue, QueueEvents, Worker } from 'bullmq'

import { createQueueConnection } from '../../src/queues/queue-connection'

it('processes a job through BullMQ and the local Redis instance', async () => {
  const name = `medtender-smoke-${randomUUID()}`
  const connection = createQueueConnection(process.env.REDIS_URL)

  try {
    await connection.connect()
    const queue = new Queue(name, { connection })
    const events = new QueueEvents(name, { connection })
    const worker = new Worker(name, async (job) => job.data.message, { connection })

    try {
      await Promise.all([events.waitUntilReady(), worker.waitUntilReady()])
      const job = await queue.add('ping', { message: 'pong' })

      await expect(job.waitUntilFinished(events, 4_000)).resolves.toBe('pong')
    } finally {
      await Promise.all([worker.close(), events.close()])
      try {
        await queue.obliterate({ force: true })
      } finally {
        await queue.close()
      }
    }
  } finally {
    connection.disconnect()
  }
}, 12_000)
