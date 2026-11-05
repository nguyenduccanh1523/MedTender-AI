import 'reflect-metadata'

import type { NestApplicationOptions } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'

import { AppModule } from './app.module'

export function createApp(options?: NestApplicationOptions) {
  return NestFactory.create(AppModule, options)
}
