import { randomBytes, randomUUID } from 'node:crypto'
import { ConflictException, ForbiddenException, Injectable } from '@nestjs/common'

import { DatabaseService } from '../../../database/database.service'
import { Prisma, type MembershipRole } from '../../../database/generated/client'
import { setTenantUserContext, TenantAccessDeniedError, withTenantTransaction } from '../../../database/tenant-transaction'

const orgFields = { id: true, slug: true, name: true } as const

@Injectable()
export class OrganizationsService {
  constructor(private readonly database: DatabaseService) {}

  async list(userId: string) {
    return this.database.db.$transaction(async (tx) => {
      await setTenantUserContext(tx, userId)
      const memberships = await tx.organizationMembership.findMany({
        where: { userId, status: 'ACTIVE', organization: { status: 'ACTIVE' } },
        select: { role: true, organization: { select: orgFields } },
        orderBy: [{ joinedAt: 'asc' }, { id: 'asc' }],
      })
      return memberships.map(({ organization, role }) => ({ ...organization, role }))
    })
  }

  async create(userId: string, name: string) {
    const id = randomUUID()
    const base = name.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/đ/g, 'd')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48)
    const slug = `${base || 'to-chuc'}-${randomBytes(5).toString('hex')}`

    try {
      return await this.database.db.$transaction(async (tx) => {
        await setTenantUserContext(tx, userId)
        await tx.$queryRaw`SELECT set_config('app.provisioning_org_id', ${id}, true)`
        const org = await tx.organization.create({
          data: { id, name, slug, createdByUserId: userId },
          select: orgFields,
        })
        await tx.organizationMembership.create({ data: { userId, organizationId: id, role: 'OWNER' } })
        return { ...org, role: 'OWNER' as const }
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Chưa tạo được định danh tổ chức. Vui lòng thử lại.')
      }
      throw error
    }
  }

  async get(userId: string, slug: string) {
    return this.withWorkspace(userId, slug, async (tx, id, role) => ({
      ...(await tx.organization.findUniqueOrThrow({ where: { id }, select: orgFields })),
      role,
    }))
  }

  async members(userId: string, slug: string) {
    return this.withWorkspace(userId, slug, async (tx, id, role) => {
      if (role !== 'OWNER' && role !== 'ADMIN') {
        throw new ForbiddenException('Bạn không có quyền xem danh sách thành viên.')
      }
      const memberships = await tx.organizationMembership.findMany({
        where: { organizationId: id },
        select: { userId: true, role: true, status: true, user: { select: { displayName: true } } },
        orderBy: [{ joinedAt: 'asc' }, { id: 'asc' }],
      })
      return memberships.map(({ user, ...membership }) => ({ ...membership, name: user.displayName }))
    })
  }

  async withWorkspace<T>(
    userId: string,
    slug: string,
    operation: (tx: Prisma.TransactionClient, id: string, role: MembershipRole) => Promise<T>,
  ): Promise<T> {
    const db = this.database.db
    const org = await db.$transaction(async (tx) => {
      await setTenantUserContext(tx, userId)
      return tx.organization.findUnique({ where: { slug }, select: { id: true } })
    })
    if (!org) throw new ForbiddenException('Bạn không có quyền truy cập tổ chức này.')

    try {
      return await withTenantTransaction(db, { userId, organizationId: org.id },
        (tx, role) => operation(tx, org.id, role))
    } catch (error) {
      if (error instanceof TenantAccessDeniedError) {
        throw new ForbiddenException('Bạn không có quyền truy cập tổ chức này.')
      }
      throw error
    }
  }
}
