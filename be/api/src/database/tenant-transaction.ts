import type { MembershipRole, Prisma, PrismaClient } from './generated/client'

interface TenantScope {
  userId: string
  organizationId: string
}

interface WorkspaceScope {
  userId: string
  slug: string
}

export class TenantAccessDeniedError extends Error {
  constructor() {
    super('Active organization membership required')
    this.name = 'TenantAccessDeniedError'
  }
}

export async function setTenantUserContext(tx: Prisma.TransactionClient, userId: string) {
  await tx.$queryRaw`SELECT set_config('app.org_id', '', true), set_config('app.user_id', ${userId}, true)`
}

// The caller derives userId from verified identity, never from a request body.
export function withTenantTransaction<T>(
  db: PrismaClient,
  { userId, organizationId }: TenantScope,
  operation: (tx: Prisma.TransactionClient, role: MembershipRole) => Promise<T>,
): Promise<T> {
  return db.$transaction(
    async (tx) => {
      await setTenantUserContext(tx, userId)

      const membership = await tx.organizationMembership.findFirst({
        where: { userId, organizationId, status: 'ACTIVE', organization: { status: 'ACTIVE' } },
        select: { role: true },
      })
      if (!membership) throw new TenantAccessDeniedError()

      await tx.$queryRaw`SELECT set_config('app.org_id', ${organizationId}, true)`
      return operation(tx, membership.role)
    },
    { timeout: 30000, maxWait: 10000 },
  )
}

export function withTenantWorkspaceTransaction<T>(
  db: PrismaClient,
  { userId, slug }: WorkspaceScope,
  operation: (tx: Prisma.TransactionClient, organizationId: string, role: MembershipRole) => Promise<T>,
): Promise<T> {
  return db.$transaction(
    async (tx) => {
      await setTenantUserContext(tx, userId)
      const organization = await tx.organization.findUnique({ where: { slug }, select: { id: true } })
      if (!organization) throw new TenantAccessDeniedError()

      const membership = await tx.organizationMembership.findFirst({
        where: { userId, organizationId: organization.id, status: 'ACTIVE', organization: { status: 'ACTIVE' } },
        select: { role: true },
      })
      if (!membership) throw new TenantAccessDeniedError()

      await tx.$queryRaw`SELECT set_config('app.org_id', ${organization.id}, true)`
      return operation(tx, organization.id, membership.role)
    },
    { timeout: 30000, maxWait: 10000 },
  )
}
