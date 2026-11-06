import { createApp } from './bootstrap'
import { DatabaseService } from './database/database.service'

async function bootstrap() {
  const app = await createApp()
  app.enableShutdownHooks()
  await app.listen(Number(process.env.API_PORT ?? '3001'), '127.0.0.1')
  void app.get(DatabaseService).prewarm()
}

void bootstrap()
