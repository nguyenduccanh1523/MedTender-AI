import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'

import { generateToken, hashToken } from '../../../common/security/opaque-token'
import { DatabaseService } from '../../../database/database.service'
import { Prisma } from '../../../database/generated/client'
import { setTenantUserContext } from '../../../database/tenant-transaction'
import { canInviteRole, type InvitableRole } from '../domain/invitation-roles'
import { OrganizationsService } from './organizations.service'

const lifetime = 7 * 24 * 60 * 60 * 1000
const fields = { id: true, email: true, role: true, expiresAt: true, acceptedAt: true, revokedAt: true } as const

@Injectable()
export class InvitationsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly organizations: OrganizationsService,
  ) {}

  list(userId: string, slug: string) {
    return this.organizations.withWorkspace(userId, slug, (tx, organizationId, actor) => {
      if (!canInviteRole(actor, 'VIEWER')) throw new ForbiddenException('Bạn không có quyền xem lời mời.')
      return tx.organizationInvitation.findMany({
        where: { organizationId },
        select: fields,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 50,
      })
    })
  }

  create(userId: string, slug: string, email: string, role: InvitableRole) {
    return this.organizations.withWorkspace(userId, slug, async (tx, organizationId, actor) => {
      if (!canInviteRole(actor, role)) throw new ForbiddenException('Bạn không có quyền cấp vai trò này.')
      const member = await tx.organizationMembership.findFirst({
        where: { organizationId, user: { email } },
        select: { id: true },
      })
      if (member) throw new ConflictException('Tài khoản này đã có membership trong tổ chức.')

      const token = generateToken()
      const invite = await tx.organizationInvitation.create({
        data: {
          organizationId, email, role, invitedBy: userId, tokenHash: hashToken(token),
          expiresAt: new Date(Date.now() + lifetime),
        },
        select: fields,
      })
      return { ...invite, token }
    })
  }

  revoke(userId: string, slug: string, invitationId: string) {
    return this.organizations.withWorkspace(userId, slug, async (tx, organizationId, actor) => {
      if (!canInviteRole(actor, 'VIEWER')) throw new ForbiddenException('Bạn không có quyền thu hồi lời mời.')
      const changed = await tx.organizationInvitation.updateMany({
        where: {
          id: invitationId, organizationId, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() },
          ...(actor === 'ADMIN' ? { role: { not: 'ADMIN' } } : {}),
        },
        data: { revokedAt: new Date() },
      })
      if (changed.count !== 1) throw new NotFoundException('Không tìm thấy lời mời còn hiệu lực để thu hồi.')
    })
  }

  async accept(userId: string, token: string) {
    const tokenHash = hashToken(token)
    const unavailable = 'Lời mời không còn hiệu lực hoặc không dành cho email của tài khoản này.'

    try {
      return await this.database.db.$transaction(async (tx) => {
        await setTenantUserContext(tx, userId)
        await tx.$queryRaw`SELECT set_config('app.invitation_token_hash', ${tokenHash}, true)`
        const active = { tokenHash, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } }
        const invite = await tx.organizationInvitation.findFirst({
          where: active,
          select: { id: true, organizationId: true, role: true },
        })
        if (!invite) throw new NotFoundException(unavailable)
        const organization = await tx.organization.findFirst({
          where: { id: invite.organizationId, status: 'ACTIVE' },
          select: { id: true, slug: true, name: true },
        })
        if (!organization) throw new NotFoundException(unavailable)

        const changed = await tx.organizationInvitation.updateMany({
          where: { ...active, id: invite.id, expiresAt: { gt: new Date() } },
          data: { acceptedAt: new Date() },
        })
        if (changed.count !== 1) throw new NotFoundException(unavailable)

        await tx.organizationMembership.create({
          data: { userId, organizationId: organization.id, role: invite.role },
        })
        return { ...organization, role: invite.role }
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Tài khoản này đã có membership trong tổ chức.')
      }
      throw error
    }
  }
}
