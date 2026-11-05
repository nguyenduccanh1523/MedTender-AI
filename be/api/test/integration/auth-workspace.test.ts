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
const emails = ['session', 'owner', 'reviewer', 'inviter', 'invitee', 'outsider'].map((label) => `auth-${label}-${runId}@example.test`)
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
      where: { userId: { in: ids } }, select: { organizationId: true },
    })
    await admin.$transaction([
      admin.organizationMembership.deleteMany({ where: { userId: { in: ids } } }),
      admin.organization.deleteMany({ where: { id: { in: memberships.map((m) => m.organizationId) } } }),
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

async function seedOrganization(userId: string, name: string) {
  const id = randomUUID()
  const slug = `test-${id}`
  const organization = await admin.organization.create({
    data: { id, name, slug, createdByUserId: userId },
    select: { id: true, name: true, slug: true },
  })
  await admin.organizationMembership.create({ data: { organizationId: id, userId, role: 'OWNER' } })
  return { ...organization, role: 'OWNER' as const }
}

it('validates login, rotates an expired session and revokes it on logout', async () => {
  const client = request(app.getHttpServer())
  await client.post('/api/v1/auth/register').send({ name: 'Analyst A', email: emails[0], password }).expect(403)
  await client.post('/api/v1/auth/register').set(web)
    .send({ name: 'Analyst A', email: emails[0], password }).expect(201)
  await client.post('/api/v1/auth/login').set(web).send({ email: emails[0], password: 'wrong' }).expect(401)
  const login = await client.post('/api/v1/auth/login').set(web).send({ email: emails[0], password }).expect(200)
  expect(login.headers['set-cookie']).toEqual(expect.arrayContaining([expect.stringContaining('HttpOnly')]))
  const initialCookies = cookies(login)
  const jwt = initialCookies.match(/medtender_access=([^;]+)/)?.[1]
  expect(jwt?.split('.')).toHaveLength(3)
  const claims = JSON.parse(Buffer.from(jwt!.split('.')[1], 'base64url').toString())
  expect(claims.sub).toBe(login.body.id)
  expect(claims.role).toBeUndefined()
  const tampered = jwt!.replace(/\.[^.]+$/, '.invalid-signature')
  await client.get('/api/v1/auth/me').set('Cookie', `medtender_access=${tampered}`).expect(401)
  await client.get('/api/v1/auth/me').set('Cookie', initialCookies).expect(200)
  await admin.$executeRaw`UPDATE auth_sessions SET access_expires_at = now() - interval '1 second' WHERE user_id::text = ${login.body.id}`
  await client.get('/api/v1/auth/me').set('Cookie', initialCookies).expect(401)
  const attempts = await Promise.all([
    client.post('/api/v1/auth/refresh').set(web).set('Cookie', initialCookies),
    client.post('/api/v1/auth/refresh').set(web).set('Cookie', initialCookies),
  ])
  expect(attempts.map((response) => response.status).sort()).toEqual([200, 401])
  const refresh = attempts.find((response) => response.status === 200)
  if (!refresh) throw new Error('Expected a single successful refresh')
  await client.post('/api/v1/auth/refresh').set(web).set('Cookie', initialCookies).expect(401)
  const rotatedCookies = cookies(refresh)
  await client.get('/api/v1/auth/me').set('Cookie', rotatedCookies).expect(200)
  await client.post('/api/v1/auth/logout').set(web).set('Cookie', rotatedCookies).expect(204)
  await client.get('/api/v1/auth/me').set('Cookie', rotatedCookies).expect(401)
})

it('enforces tenant and role boundaries for a provisioned OWNER membership', async () => {
  const client = request(app.getHttpServer())
  const a = await client.post('/api/v1/auth/register').set(web)
    .send({ name: 'Owner A', email: emails[1], password }).expect(201)
  const b = await client.post('/api/v1/auth/register').set(web)
    .send({ name: 'Analyst B', email: emails[2], password }).expect(201)
  const aCookies = cookies(a)
  const bCookies = cookies(b)
  const org = await seedOrganization(a.body.id, 'Tổ chức A')
  expect(org.role).toBe('OWNER')
  await client.get(`/api/v1/organizations/${org.slug}`).set('Cookie', bCookies).expect(403)
  await admin.organizationMembership.create({
    data: { organizationId: org.id, userId: b.body.id, role: 'REVIEWER' },
  })
  const membersUrl = `/api/v1/organizations/${org.slug}/members`
  await client.get(membersUrl).expect(401)
  await client.get(membersUrl).set('Cookie', aCookies).expect(200, [
    { userId: a.body.id, name: 'Owner A', role: 'OWNER', status: 'ACTIVE' },
    { userId: b.body.id, name: 'Analyst B', role: 'REVIEWER', status: 'ACTIVE' },
  ])
  await client.get(`/api/v1/organizations/${org.slug}`).set('Cookie', bCookies).expect(200)
  await client.get(`/api/v1/organizations/${org.slug}/members`).set('Cookie', bCookies).expect(403)
})

it('assigns an invited role only to the matching authenticated email and consumes the token once', async () => {
  const client = request(app.getHttpServer())
  const register = (email: string, name: string) =>
    client.post('/api/v1/auth/register').set(web).send({ name, email, password }).expect(201)
  const owner = await register(emails[3], 'Inviting Owner')
  const invitee = await register(emails[4], 'Invited Admin')
  const outsider = await register(emails[5], 'Other User')
  const ownerCookies = cookies(owner)
  const org = await seedOrganization(owner.body.id, 'Invitation Test')
  const invitations = `/api/v1/organizations/${org.slug}/invitations`
  const accept = '/api/v1/organizations/invitations/accept'
  await client.post(invitations).set(web).set('Cookie', ownerCookies)
    .send({ email: emails[4], role: 'OWNER' }).expect(400)
  const invite = await client.post(invitations).set(web).set('Cookie', ownerCookies)
    .send({ email: emails[4].toUpperCase(), role: 'ADMIN' }).expect(201)
  expect(invite.body.token).toMatch(/^[A-Za-z0-9_-]{43}$/)
  await client.post(accept).set(web).set('Cookie', cookies(outsider)).send({ token: invite.body.token }).expect(404)
  const outcomes = await Promise.all([
    client.post(accept).set(web).set('Cookie', cookies(invitee)).send({ token: invite.body.token }),
    client.post(accept).set(web).set('Cookie', cookies(invitee)).send({ token: invite.body.token }),
  ])
  expect(outcomes.map((result) => result.status).sort()).toEqual([200, 404])
  const accepted = outcomes.find((result) => result.status === 200)
  expect(accepted?.body).toMatchObject({ slug: org.slug, role: 'ADMIN' })
  const inviteeCookies = cookies(invitee)
  await client.get(`/api/v1/organizations/${org.slug}`).set('Cookie', inviteeCookies)
    .expect(200, { id: org.id, slug: org.slug, name: org.name, role: 'ADMIN' })
  await client.post(invitations).set(web).set('Cookie', inviteeCookies)
    .send({ email: emails[5], role: 'ADMIN' }).expect(403)
  const lower = await client.post(invitations).set(web).set('Cookie', inviteeCookies)
    .send({ email: emails[5], role: 'VIEWER' }).expect(201)
  const list = await client.get(invitations).set('Cookie', ownerCookies).expect(200)
  expect(list.body.find((record: { id: string }) => record.id === lower.body.id)).not.toHaveProperty('token')
  await client.post(`${invitations}/${lower.body.id}/revoke`).set(web).set('Cookie', inviteeCookies).expect(204)
  await client.post(accept).set(web).set('Cookie', cookies(outsider)).send({ token: lower.body.token }).expect(404)
  const expired = await client.post(invitations).set(web).set('Cookie', ownerCookies)
    .send({ email: emails[5], role: 'REVIEWER' }).expect(201)
  await admin.organizationInvitation.update({
    where: { id: expired.body.id }, data: { expiresAt: new Date(Date.now() - 1000) },
  })
  await client.post(accept).set(web).set('Cookie', cookies(outsider)).send({ token: expired.body.token }).expect(404)
})
