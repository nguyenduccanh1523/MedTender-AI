import { randomBytes, randomUUID } from 'node:crypto'
import type { INestApplication } from '@nestjs/common'
import request from 'supertest'

import { createApp } from '../../src/bootstrap'
import { createPrismaClient } from '../../src/database/prisma-client'
import { localTestDatabaseUrl } from '../../../database/test-database-url'

const runId = randomUUID()
const email = `applicant-${runId}@example.test`
const adminEmail = `system-admin-${runId}@example.test`
const memberEmail = `member-${runId}@example.test`
const rejectedEmail = `rejected-${runId}@example.test`
const password = 'ExamplePass2026!'
const web = { 'x-medtender-request': 'web' }
const database = createPrismaClient(localTestDatabaseUrl('TEST_DATABASE_MIGRATION_URL'))
let app: INestApplication

beforeAll(async () => {
  process.env.DATABASE_URL = localTestDatabaseUrl('TEST_DATABASE_URL')
  process.env.AUTH_JWT_SECRET = randomBytes(32).toString('hex')
  process.env.EMAIL_DELIVERY_MODE = 'LOG'
  process.env.APP_ORIGIN = 'http://127.0.0.1:3000'
  app = await createApp({ logger: ['error'] })
  await app.init()
})

afterAll(async () => {
  try {
    await app?.close()
    const users = await database.user.findMany({
      where: { email: { in: [email, adminEmail, memberEmail, rejectedEmail] } }, select: { id: true },
    })
    const userIds = users.map(({ id }) => id)
    const applications = await database.organizationApplication.findMany({
      where: { contactEmail: { in: [email, rejectedEmail] } }, select: { id: true, organizationId: true },
    })
    const organizationIds = applications.flatMap(({ organizationId }) => organizationId ? [organizationId] : [])
    await database.$transaction([
      database.accountActivationToken.deleteMany({ where: { userId: { in: userIds } } }),
      database.organizationMembership.deleteMany({ where: { OR: [{ userId: { in: userIds } }, { organizationId: { in: organizationIds } }] } }),
      database.organizationApplication.deleteMany({ where: { id: { in: applications.map(({ id }) => id) } } }),
      database.organization.deleteMany({ where: { id: { in: organizationIds } } }),
      database.authSession.deleteMany({ where: { userId: { in: userIds } } }),
      database.user.deleteMany({ where: { id: { in: userIds } } }),
    ])
  } finally {
    await database.$disconnect()
  }
})

function cookies(response: request.Response): string {
  const values: unknown = response.headers['set-cookie']
  if (!Array.isArray(values)) throw new Error('Expected session cookies')
  return values.map((cookie: string) => cookie.split(';', 1)[0]).join('; ')
}

it('accepts a public organization application and returns a tracking reference', async () => {
  const response = await request(app.getHttpServer())
    .post('/api/v1/organization-applications')
    .set(web)
    .send({
      organizationName: 'Bệnh viện Minh Tâm',
      taxCode: `TAX-${runId}`,
      website: 'https://minhtam.example',
      address: '12 Nguyễn Huệ, Quận 1, TP.HCM',
      contactName: 'Nguyễn Minh Anh',
      contactEmail: email,
      contactPhone: '0901234567',
    })
    .expect(201)

  expect(response.body).toMatchObject({ status: 'PENDING' })
  expect(response.body.reference).toMatch(/^MTA-[A-Z0-9]{8}$/)
  await request(app.getHttpServer()).post('/api/v1/organization-applications').set(web).send({
    organizationName: 'Tổ chức trùng email', taxCode: `OTHER-${runId.slice(0, 20)}`,
    address: '99 Lê Lợi, TP.HCM', contactName: 'Người trùng',
    contactEmail: email, contactPhone: '0900000000',
  }).expect(409)
})

it('allows only SYSTEM_ADMIN to approve once and lets the OWNER activate once', async () => {
  const client = request(app.getHttpServer())
  const register = (name: string, address: string) => client.post('/api/v1/auth/register').set(web)
    .send({ name, email: address, password }).expect(201)
  const admin = await register('System Admin', adminEmail)
  const member = await register('Regular Member', memberEmail)
  await database.user.update({ where: { id: admin.body.id }, data: { globalRole: 'SYSTEM_ADMIN' } })
  const adminSession = await client.post('/api/v1/auth/login').set(web)
    .send({ email: adminEmail, password }).expect(200)
  expect(adminSession.body.systemRole).toBe('SYSTEM_ADMIN')

  const queue = '/api/v1/system-admin/organization-applications'
  await client.get(queue).set('Cookie', cookies(member)).expect(403)
  const list = await client.get(queue).set('Cookie', cookies(adminSession)).expect(200)
  const application = list.body.find((item: { contactEmail: string }) => item.contactEmail === email)
  expect(application).toMatchObject({ organizationName: 'Bệnh viện Minh Tâm', status: 'PENDING' })

  const approvals = await Promise.all([
    client.post(`${queue}/${application.id}/approve`).set(web).set('Cookie', cookies(adminSession)),
    client.post(`${queue}/${application.id}/approve`).set(web).set('Cookie', cookies(adminSession)),
  ])
  expect(approvals.map(({ status }) => status).sort()).toEqual([200, 409])
  const approved = approvals.find(({ status }) => status === 200)
  expect(approved?.body).toMatchObject({ status: 'APPROVED', emailDelivery: 'LOGGED' })
  expect(approved?.body.activationLink).toMatch(/^http:\/\/127\.0\.0\.1:3000\/activate#[A-Za-z0-9_-]{43}$/)
  const token = approved!.body.activationLink.split('#')[1]

  const activated = await client.post('/api/v1/auth/activate').set(web)
    .send({ token, password }).expect(200)
  expect(activated.body).toMatchObject({ email, name: 'Nguyễn Minh Anh' })
  expect(cookies(activated)).toContain('medtender_access=')
  await client.post('/api/v1/auth/activate').set(web).send({ token, password }).expect(401)
  const organizations = await client.get('/api/v1/organizations').set('Cookie', cookies(activated)).expect(200)
  expect(organizations.body).toEqual([
    expect.objectContaining({ name: 'Bệnh viện Minh Tâm', role: 'OWNER' }),
  ])
  await client.post('/api/v1/organizations').set(web).set('Cookie', cookies(activated))
    .send({ name: 'Không được tự tạo' }).expect(403)
})

it('records a System Admin rejection reason without provisioning an account', async () => {
  const client = request(app.getHttpServer())
  await client.post('/api/v1/organization-applications').set(web).send({
    organizationName: 'Phòng khám Chưa Đạt', taxCode: `REJ-${runId.slice(0, 20)}`,
    address: '45 Hai Bà Trưng, Hà Nội', contactName: 'Trần Thu Hà',
    contactEmail: rejectedEmail, contactPhone: '0912345678',
  }).expect(201)
  const admin = await client.post('/api/v1/auth/login').set(web).send({ email: adminEmail, password }).expect(200)
  const queue = '/api/v1/system-admin/organization-applications'
  const list = await client.get(queue).set('Cookie', cookies(admin)).expect(200)
  const application = list.body.find((item: { contactEmail: string }) => item.contactEmail === rejectedEmail)
  await client.post(`${queue}/${application.id}/reject`).set(web).set('Cookie', cookies(admin))
    .send({ reason: 'Thông tin pháp lý chưa đầy đủ.' }).expect(204)
  const updated = await client.get(queue).set('Cookie', cookies(admin)).expect(200)
  expect(updated.body.find((item: { id: string }) => item.id === application.id)).toMatchObject({
    status: 'REJECTED', rejectionReason: 'Thông tin pháp lý chưa đầy đủ.',
  })
  expect(await database.user.count({ where: { email: rejectedEmail } })).toBe(0)
})
