import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common'

import { createQueueConnection } from './queue-connection'

@Injectable()
export class QueueConnectionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueConnectionService.name)
  readonly connection = createQueueConnection(process.env.REDIS_URL)

  async onModuleInit() {
    this.connection.on('error', () => this.logger.error('Redis connection error'))
    try {
      await this.connection.connect()
    } catch {
      this.connection.disconnect()
      throw new Error('Unable to initialize the Redis connection')
    }
    this.logger.log('Redis connection is ready')
  }

  onModuleDestroy() {
    this.connection.disconnect()
  }
}
