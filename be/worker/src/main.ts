import 'reflect-metadata'

import { Logger } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'

import { WorkerModule } from './worker.module'

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerModule, { abortOnError: false })
  app.enableShutdownHooks()
}

void bootstrap().catch((error: unknown) => {
  Logger.error(error instanceof Error ? error.message : 'Worker failed to start')
  process.exitCode = 1
})
