import { randomBytes, randomUUID } from 'node:crypto'
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'

import { generateToken, hashToken } from '../../../common/security/opaque-token'
import { DatabaseService } from '../../../database/database.service'
import { ApprovalMailer } from '../infrastructure/approval-mailer'

type PendingApplication = {
  id: string
  organizationName: string
  contactName: string
  contactEmail: string
}

function organizationSlug(name: string) {
  const base = name.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48)
  return `${base || 'to-chuc'}-${randomBytes(5).toString('hex')}`
}

@Injectable()
export class AdminApplicationsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly mailer: ApprovalMailer,
  ) {}

  list(adminId: string) {
    return this.database.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT set_config('app.system_admin_id', ${adminId}, true)`
      return tx.organizationApplication.findMany({
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        select: {
          id: true, reference: true, organizationName: true, taxCode: true, website: true,
          address: true, contactName: true, contactEmail: true, contactPhone: true,
          status: true, rejectionReason: true, reviewedAt: true, createdAt: true,
        },
      })
    })
  }

  async approve(adminId: string, applicationId: string) {
    const token = generateToken()
    const tokenHash = hashToken(token)
    const provisioned = await this.database.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT set_config('app.system_admin_id', ${adminId}, true)`
      const rows = await tx.$queryRaw<PendingApplication[]>`
        SELECT id, organization_name AS "organizationName", contact_name AS "contactName", contact_email::text AS "contactEmail"
        FROM organization_applications
        WHERE id::text = ${applicationId} AND status = 'PENDING'
        FOR UPDATE
      `
      const application = rows[0]
      if (!application) throw new ConflictException('Hồ sơ đã được xử lý hoặc không tồn tại.')
      const existing = await tx.user.findUnique({ where: { email: application.contactEmail }, select: { id: true } })
      if (existing) throw new ConflictException('Email người phụ trách đã có tài khoản.')

      const ownerId = randomUUID()
      const organizationId = randomUUID()
      await tx.$queryRaw`SELECT set_config('app.provisioning_org_id', ${organizationId}, true)`
      await tx.$queryRaw`SELECT set_config('app.provisioning_owner_id', ${ownerId}, true)`
      const owner = await tx.user.create({
        data: { id: ownerId, email: application.contactEmail, displayName: application.contactName, passwordHash: null },
        select: { id: true },
      })
      const organization = await tx.organization.create({
        data: {
          id: organizationId, name: application.organizationName,
          slug: organizationSlug(application.organizationName), createdByUserId: owner.id,
        },
        select: { id: true, slug: true, name: true },
      })
      await tx.organizationMembership.create({
        data: { id: randomUUID(), organizationId, userId: owner.id, role: 'OWNER' }, select: { id: true },
      })
      await tx.accountActivationToken.create({
        data: {
          id: randomUUID(), userId: owner.id, tokenHash,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
        select: { id: true },
      })
      await tx.organizationApplication.update({
        where: { id: application.id },
        data: {
          status: 'APPROVED', reviewedByUserId: adminId, reviewedAt: new Date(), organizationId,
        },
        select: { id: true },
      })
      return { application, organization }
    })

    const origin = process.env.APP_ORIGIN || 'http://127.0.0.1:3000'
    const activationLink = `${origin.replace(/\/$/, '')}/activate#${token}`
    const emailDelivery = await this.mailer.sendActivation(
      provisioned.application.contactEmail, provisioned.application.organizationName, activationLink,
    )
    return {
      status: 'APPROVED' as const,
      emailDelivery,
      organization: provisioned.organization,
      ...(emailDelivery === 'LOGGED' ? { activationLink } : {}),
    }
  }

  async reject(adminId: string, applicationId: string, reason: string) {
    return this.database.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT set_config('app.system_admin_id', ${adminId}, true)`
      const changed = await tx.organizationApplication.updateMany({
        where: { id: applicationId, status: 'PENDING' },
        data: { status: 'REJECTED', reviewedByUserId: adminId, reviewedAt: new Date(), rejectionReason: reason },
      })
      if (changed.count !== 1) throw new NotFoundException('Không tìm thấy hồ sơ đang chờ duyệt.')
    })
  }

}
