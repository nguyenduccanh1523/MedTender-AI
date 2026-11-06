import { Injectable, ServiceUnavailableException, type OnModuleDestroy } from '@nestjs/common'

import type { PrismaClient } from './generated/client'
import { createPrismaClient } from './prisma-client'

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private client?: PrismaClient

  get db(): PrismaClient {
    try {
      return this.client ??= createPrismaClient()
    } catch {
      throw new ServiceUnavailableException('Kết nối database chưa được cấu hình.')
    }
  }

  async prewarm() {
    try {
      await this.db.$queryRawUnsafe('SELECT 1')
    } catch {
      // The first user request can still retry normally if a remote pooler is briefly unavailable.
    }
  }

  async onModuleDestroy() {
    await this.client?.$disconnect()
  }
}
