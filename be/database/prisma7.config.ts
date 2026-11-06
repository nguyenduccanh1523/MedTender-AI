import { existsSync } from 'node:fs'
import { loadEnvFile } from 'node:process'
import { resolve } from 'node:path'
import { defineConfig } from 'prisma/config'

import { localTestDatabaseUrl } from './test-database-url'

const envFile = resolve(__dirname, '../../.env')
if (existsSync(envFile)) loadEnvFile(envFile)

const databaseUrl = process.env.MEDTENDER_TEST_DATABASE === '1'
  ? localTestDatabaseUrl('TEST_DATABASE_MIGRATION_URL')
  : process.env.DATABASE_MIGRATION_URL || undefined

function useMedTenderSchema(connection: string | undefined) {
  if (!connection || process.env.MEDTENDER_TEST_DATABASE === '1') return connection

  const url = new URL(connection)
  // Keep migrations in the same private schema as the runtime connection.
  // This prevents a direct Supabase URL without `schema` from silently
  // creating/checking tables in `public`.
  if (!url.searchParams.has('schema')) url.searchParams.set('schema', 'medtender')
  return url.toString()
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: useMedTenderSchema(databaseUrl) },
})
