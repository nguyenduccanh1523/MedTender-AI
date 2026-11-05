import type { INestApplication } from '@nestjs/common'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'

import { accessCookie } from './modules/identity/presentation/http/session-cookies'

export function createOpenApiDocument(app: INestApplication) {
  const config = new DocumentBuilder().setTitle('MedTender AI API').setVersion('0.1.0').addCookieAuth(accessCookie, { type: 'apiKey' }, accessCookie).build()
  return SwaggerModule.createDocument(app, config)
}
