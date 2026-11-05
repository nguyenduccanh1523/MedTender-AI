import { createApp } from './bootstrap'

async function bootstrap() {
  const app = await createApp()
  app.enableShutdownHooks()
  await app.listen(Number(process.env.API_PORT ?? '3001'), '127.0.0.1')
}

void bootstrap()
