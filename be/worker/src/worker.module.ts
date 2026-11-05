import { Module } from '@nestjs/common'

import { QueueConnectionService } from './queues/queue-connection.service'

@Module({ providers: [QueueConnectionService] })
export class WorkerModule {}
