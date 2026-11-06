import { randomBytes, randomUUID } from 'node:crypto'
import type { INestApplication } from '@nestjs/common'
import request from 'supertest'

import { createApp } from '../../src/bootstrap'
import { createPrismaClient } from '../../src/database/prisma-client'
import { localTestDatabaseUrl } from '../../../database/test-database-url'

const admin = createPrismaClient(localTestDatabaseUrl('TEST_DATABASE_MIGRATION_URL'))
const previousUrl = process.env.DATABASE_URL
const previousJwtSecret = process.env.AUTH_JWT_SECRET
const runId = randomUUID()
const emails = ['writer-a', 'viewer-a', 'writer-b'].map((label) => `tender-${label}-${runId}@example.test`)
const password = 'ExamplePass2026!'
const web = { 'x-medtender-request': 'web' }
let app: INestApplication

beforeAll(async () => {
  process.env.DATABASE_URL = localTestDatabaseUrl('TEST_DATABASE_URL')
  process.env.AUTH_JWT_SECRET = randomBytes(32).toString('hex')
  app = await createApp({ logger: false })
  await app.init()
})

afterAll(async () => {
  try {
    await app?.close()
    const users = await admin.user.findMany({ where: { email: { in: emails } }, select: { id: true } })
    const ids = users.map(({ id }) => id)
    const memberships = await admin.organizationMembership.findMany({
      where: { userId: { in: ids } },
      select: { organizationId: true },
    })
    const orgIds = memberships.map((m) => m.organizationId)
    await admin.$transaction([
      admin.tenderAuditLog.deleteMany({ where: { organizationId: { in: orgIds } } }),
      admin.tender.deleteMany({ where: { organizationId: { in: orgIds } } }),
      admin.organizationMembership.deleteMany({ where: { userId: { in: ids } } }),
      admin.organization.deleteMany({ where: { id: { in: orgIds } } }),
      admin.user.deleteMany({ where: { id: { in: ids } } }),
    ])
  } finally {
    if (previousUrl === undefined) delete process.env.DATABASE_URL
    else process.env.DATABASE_URL = previousUrl
    if (previousJwtSecret === undefined) delete process.env.AUTH_JWT_SECRET
    else process.env.AUTH_JWT_SECRET = previousJwtSecret
    await admin.$disconnect()
  }
})

function cookies(response: request.Response): string {
  const values: unknown = response.headers['set-cookie']
  if (!Array.isArray(values)) throw new Error('Expected session cookies')
  return values.map((cookie: string) => cookie.split(';', 1)[0]).join('; ')
}

it('manages tenders, lots, items, duplicate STT per lot, cross-tenant composite FK, cursor pagination and audit logs', async () => {
  const client = request(app.getHttpServer())
  const writerA = await client.post('/api/v1/auth/register').set(web)
    .send({ name: 'Bid Manager A', email: emails[0], password }).expect(201)
  const viewerA = await client.post('/api/v1/auth/register').set(web)
    .send({ name: 'Viewer A', email: emails[1], password }).expect(201)
  const writerB = await client.post('/api/v1/auth/register').set(web)
    .send({ name: 'Owner B', email: emails[2], password }).expect(201)

  const orgA = await admin.organization.create({
    data: { id: randomUUID(), slug: `tender-a-${runId}`, name: 'Bệnh viện A', createdByUserId: writerA.body.id },
  })
  const orgB = await admin.organization.create({
    data: { id: randomUUID(), slug: `tender-b-${runId}`, name: 'Bệnh viện B', createdByUserId: writerB.body.id },
  })
  await admin.organizationMembership.createMany({
    data: [
      { organizationId: orgA.id, userId: writerA.body.id, role: 'BID_MANAGER' },
      { organizationId: orgA.id, userId: viewerA.body.id, role: 'VIEWER' },
      { organizationId: orgB.id, userId: writerB.body.id, role: 'OWNER' },
    ],
  })

  const aCookie = cookies(writerA)
  const viewerCookie = cookies(viewerA)
  const bCookie = cookies(writerB)

  // Viewer cannot create tender
  await client.post(`/api/v1/organizations/${orgA.slug}/tenders`).set(web).set('Cookie', viewerCookie)
    .send({ title: 'Không được phép', procurementStage: 'RFQ' }).expect(403)

  // Writer A creates an RFQ tender
  const createdTender = await client.post(`/api/v1/organizations/${orgA.slug}/tenders`).set(web).set('Cookie', aCookie)
    .send({ title: 'Mua sắm thiết bị ICU 2026', reference: 'RFQ-ICU-2026-001', procurementStage: 'RFQ' }).expect(201)

  // Add two lots
  const lot1 = await client.post(`/api/v1/organizations/${orgA.slug}/tenders/${createdTender.body.id}/lots`)
    .set(web).set('Cookie', aCookie).send({ code: 'LOT-01', name: 'Thiết bị theo dõi' }).expect(201)
  const lot2 = await client.post(`/api/v1/organizations/${orgA.slug}/tenders/${createdTender.body.id}/lots`)
    .set(web).set('Cookie', aCookie).send({ code: 'LOT-02', name: 'Thiết bị hô hấp' }).expect(201)

  // Duplicate lot code in same tender blocked
  await client.post(`/api/v1/organizations/${orgA.slug}/tenders/${createdTender.body.id}/lots`)
    .set(web).set('Cookie', aCookie).send({ code: 'LOT-01', name: 'Trùng mã' }).expect(409)

  // Multiple items in lot 1, and same STT "01" allowed in lot 2, but duplicate STT in lot 1 blocked
  await client.post(`/api/v1/organizations/${orgA.slug}/tenders/${createdTender.body.id}/lots/${lot1.body.id}/items`)
    .set(web).set('Cookie', aCookie)
    .send({ itemNo: '01', name: 'Monitor 5 thông số', quantity: 10, unit: 'cái' }).expect(201)
  const item1b = await client.post(`/api/v1/organizations/${orgA.slug}/tenders/${createdTender.body.id}/lots/${lot1.body.id}/items`)
    .set(web).set('Cookie', aCookie)
    .send({ itemNo: '02', name: 'Gel siêu âm', quantity: 12.5, unit: 'lít' }).expect(201)
  await client.post(`/api/v1/organizations/${orgA.slug}/tenders/${createdTender.body.id}/lots/${lot2.body.id}/items`)
    .set(web).set('Cookie', aCookie)
    .send({ itemNo: '01', name: 'Máy thở xâm nhập', quantity: 3, unit: 'bộ' }).expect(201)
  await client.post(`/api/v1/organizations/${orgA.slug}/tenders/${createdTender.body.id}/lots/${lot1.body.id}/items`)
    .set(web).set('Cookie', aCookie)
    .send({ itemNo: '01', name: 'Trùng STT trong lot 1', quantity: 1, unit: 'cái' }).expect(409)

  // Cross-tenant composite FK is blocked at the database level
  await expect(
    admin.tenderLot.create({
      data: {
        id: randomUUID(),
        organizationId: orgB.id,
        tenderId: createdTender.body.id,
        code: 'LOT-X',
        name: 'Cross-tenant lot',
      },
    }),
  ).rejects.toThrow()
  await expect(
    admin.tenderItem.create({
      data: {
        id: randomUUID(),
        organizationId: orgB.id,
        lotId: lot1.body.id,
        itemNo: '99',
        name: 'Cross-tenant item',
        quantity: 1,
        unit: 'cái',
      },
    }),
  ).rejects.toThrow()

  // Outsider B cannot read A's tender even via B's own workspace slug
  await client.get(`/api/v1/organizations/${orgB.slug}/tenders/${createdTender.body.id}`)
    .set('Cookie', bCookie).expect(404)

  // Stable cursor pagination when two records share the exact same created_at timestamp
  const sharedTimestamp = new Date('2026-11-06T08:00:00.000Z')
  const tSame1 = await admin.tender.create({
    data: {
      id: '00000000-0000-4000-8000-000000000001',
      organizationId: orgA.id,
      title: 'Cùng thời điểm 1',
      procurementStage: 'FORMAL_TENDER',
      createdByUserId: writerA.body.id,
      createdAt: sharedTimestamp,
      updatedAt: sharedTimestamp,
    },
  })
  const tSame2 = await admin.tender.create({
    data: {
      id: '00000000-0000-4000-8000-000000000002',
      organizationId: orgA.id,
      title: 'Cùng thời điểm 2',
      procurementStage: 'INTERNAL',
      createdByUserId: writerA.body.id,
      createdAt: sharedTimestamp,
      updatedAt: sharedTimestamp,
    },
  })

  const page1 = await client.get(`/api/v1/organizations/${orgA.slug}/tenders?limit=2`)
    .set('Cookie', viewerCookie).expect(200)
  expect(page1.body.items).toHaveLength(2)
  expect(page1.body.nextCursor).toBeTruthy()

  const page2 = await client.get(
    `/api/v1/organizations/${orgA.slug}/tenders?limit=2&cursor=${encodeURIComponent(page1.body.nextCursor)}`,
  ).set('Cookie', viewerCookie).expect(200)
  const seenIds = [...page1.body.items, ...page2.body.items].map((entry: { id: string }) => entry.id)
  expect(new Set(seenIds).size).toBe(3)
  expect(seenIds).toEqual([createdTender.body.id, tSame2.id, tSame1.id])

  // Update item & check audit trail (viewer/bid-manager blocked from audits, owner/admin allowed)
  await client.patch(`/api/v1/organizations/${orgA.slug}/tenders/${createdTender.body.id}/lots/${lot1.body.id}/items/${item1b.body.id}`)
    .set(web).set('Cookie', aCookie)
    .send({ quantity: 15, description: 'Bình 5L' }).expect(200)

  await client.get(`/api/v1/organizations/${orgA.slug}/tenders/${createdTender.body.id}/audits`)
    .set('Cookie', viewerCookie).expect(403)
  await client.get(`/api/v1/organizations/${orgA.slug}/tenders/${createdTender.body.id}/audits`)
    .set('Cookie', aCookie).expect(403)

  await admin.organizationMembership.update({
    where: { organizationId_userId: { organizationId: orgA.id, userId: writerA.body.id } },
    data: { role: 'ADMIN' },
  })

  const audits = await client.get(`/api/v1/organizations/${orgA.slug}/tenders/${createdTender.body.id}/audits`)
    .set('Cookie', aCookie).expect(200)
  expect(audits.body.map((a: { action: string }) => a.action)).toEqual(
    expect.arrayContaining(['TENDER_CREATED', 'LOT_CREATED', 'ITEM_CREATED', 'ITEM_UPDATED']),
  )
})
