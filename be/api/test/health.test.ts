import type { INestApplication } from '@nestjs/common'
import request from 'supertest'

import { createApp } from '../src/bootstrap'
import { createOpenApiDocument } from '../src/openapi-document'

describe('API foundation', () => {
  let app: INestApplication

  beforeAll(async () => {
    app = await createApp({ logger: false })
    await app.init()
  })

  afterAll(async () => {
    await app?.close()
  })

  it('returns the health response over HTTP', async () => {
    await request(app.getHttpServer())
      .get('/health/live')
      .expect(200, { service: 'api', status: 'ok' })
  })

  it('documents the health response in OpenAPI', () => {
    const document = createOpenApiDocument(app)
    expect(document.paths['/health/live'].get?.responses?.['200']).toBeDefined()
    expect(document.components?.schemas?.HealthResponse).toMatchObject({
      required: ['service', 'status'],
    })
  })
})
