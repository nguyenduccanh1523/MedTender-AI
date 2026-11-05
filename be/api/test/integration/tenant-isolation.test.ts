import { randomUUID } from 'node:crypto'

import { localTestDatabaseUrl } from '../../../database/test-database-url'
import { createPrismaClient } from '../../src/database/prisma-client'
import { withTenantTransaction } from '../../src/database/tenant-transaction'

const admin = createPrismaClient(localTestDatabaseUrl('TEST_DATABASE_MIGRATION_URL'))
const runtime = createPrismaClient(localTestDatabaseUrl('TEST_DATABASE_URL'), 1)

const userA = randomUUID()
const userB = randomUUID()
const orgA = randomUUID()
const orgB = randomUUID()
const scopeA = { userId: userA, organizationId: orgA }
const scopeB = { userId: userB, organizationId: orgB }

beforeAll(async () => {
  await admin.$transaction(async (tx) => {
    await tx.user.createMany({
      data: [
        { id: userA, email: `${userA}@example.test`, displayName: 'Fixture A' },
        { id: userB, email: `${userB}@example.test`, displayName: 'Fixture B' },
      ],
    })
    await tx.organization.createMany({
      data: [
        { id: orgA, slug: orgA, name: 'Tenant A' },
        { id: orgB, slug: orgB, name: 'Tenant B' },
      ],
    })
    await tx.organizationMembership.createMany({
      data: [{ ...scopeA, role: 'OWNER' }, { ...scopeB, role: 'REVIEWER' }],
    })
  })
})

afterAll(async () => {
  try {
    await admin.$transaction([
      admin.organizationMembership.deleteMany({ where: { organizationId: { in: [orgA, orgB] } } }),
      admin.organization.deleteMany({ where: { id: { in: [orgA, orgB] } } }),
      admin.user.deleteMany({ where: { id: { in: [userA, userB] } } }),
    ])
  } finally {
    await Promise.all([admin.$disconnect(), runtime.$disconnect()])
  }
})

it('limits reads to the verified organization and clears context on the same connection', async () => {
  const a = await withTenantTransaction(runtime, scopeA, async (tx, role) => ({
    role,
    organizations: await tx.organization.findMany({ select: { id: true } }),
    memberships: await tx.organizationMembership.findMany({ select: { userId: true } }),
    connection: await tx.$queryRaw`SELECT pg_backend_pid() AS pid`,
  }))
  const b = await withTenantTransaction(runtime, scopeB, async (tx, role) => ({
    role,
    organizations: await tx.organization.findMany({ select: { id: true } }),
    connection: await tx.$queryRaw`SELECT pg_backend_pid() AS pid`,
  }))
  const unscoped = await runtime.$transaction(async (tx) => ({
    count: await tx.organizationMembership.count(),
    connection: await tx.$queryRaw`SELECT pg_backend_pid() AS pid`,
  }))

  expect(a).toMatchObject({ role: 'OWNER', organizations: [{ id: orgA }], memberships: [{ userId: userA }] })
  expect(b).toMatchObject({ role: 'REVIEWER', organizations: [{ id: orgB }] })
  expect(b.connection).toEqual(a.connection)
  expect(unscoped).toEqual({ count: 0, connection: a.connection })
})

it('rejects cross-organization membership writes and allows scoped writes', async () => {
  await expect(withTenantTransaction(runtime, scopeA, (tx) =>
    tx.organizationMembership.create({ data: { userId: userA, organizationId: orgB, role: 'VIEWER' } }),
  )).rejects.toThrow(/row-level security/i)
  await withTenantTransaction(runtime, scopeA, (tx) =>
    tx.organizationMembership.create({ data: { userId: userB, organizationId: orgA, role: 'VIEWER' } }),
  )
  await expect(withTenantTransaction(runtime, scopeB, (tx) =>
    tx.organizationMembership.count({ where: { organizationId: orgA } }),
  )).resolves.toBe(0)
})

it('rejects a forged organization and a revoked membership', async () => {
  const operation = jest.fn()
  await expect(withTenantTransaction(runtime, { userId: userA, organizationId: orgB }, operation))
    .rejects.toThrow('Active organization membership required')
  await admin.organizationMembership.update({
    where: { organizationId_userId: { organizationId: orgB, userId: userB } },
    data: { status: 'DISABLED' },
  })
  await expect(withTenantTransaction(runtime, scopeB, operation))
    .rejects.toThrow('Active organization membership required')
  expect(operation).not.toHaveBeenCalled()
})
