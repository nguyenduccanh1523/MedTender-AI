import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { createApp } from './bootstrap'
import { createOpenApiDocument } from './openapi-document'

async function generate() {
  const app = await createApp({ logger: false })
  try {
    await app.init()
    const document = createOpenApiDocument(app)
    const target = resolve(__dirname, '../../contracts/openapi.json')
    await writeFile(target, JSON.stringify(document, null, 2) + '\n')
  } finally {
    await app.close()
  }
}

void generate()
