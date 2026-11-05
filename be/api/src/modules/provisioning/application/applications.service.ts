import { randomBytes, randomUUID } from 'node:crypto'
import { ConflictException, Injectable } from '@nestjs/common'

import { DatabaseService } from '../../../database/database.service'
import { Prisma } from '../../../database/generated/client'

type ApplicationInput = {
  organizationName: string
  taxCode: string
  website?: string
  address: string
  contactName: string
  contactEmail: string
  contactPhone: string
}

@Injectable()
export class ApplicationsService {
  constructor(private readonly database: DatabaseService) {}

  async create(input: ApplicationInput) {
    try {
      const reference = `MTA-${randomBytes(4).toString('hex').toUpperCase()}`
      await this.database.db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT set_config('app.application_reference', ${reference}, true)`
        await tx.organizationApplication.create({
          data: { id: randomUUID(), reference, ...input },
          select: { id: true },
        })
      })
      return { reference, status: 'PENDING' as const }
    } catch (error) {
      if (error instanceof ConflictException) throw error
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Email hoặc mã số thuế đang có hồ sơ chờ duyệt.')
      }
      throw error
    }
  }
}
