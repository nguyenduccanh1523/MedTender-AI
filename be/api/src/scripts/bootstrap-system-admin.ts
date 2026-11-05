import { createPrismaClient } from '../database/prisma-client'
import { hashPassword } from '../modules/identity/domain/password'
import { systemAdminInput } from './system-admin-config'

async function main() {
  const input = systemAdminInput(process.env)
  const connection = process.env.DATABASE_MIGRATION_URL || process.env.DATABASE_URL
  if (!connection) throw new Error('Cần DATABASE_MIGRATION_URL hoặc DATABASE_URL để bootstrap System Admin.')
  const database = createPrismaClient(connection, 1)
  try {
    const passwordHash = await hashPassword(input.password)
    const user = await database.user.upsert({
      where: { email: input.email },
      update: { displayName: input.name, passwordHash, globalRole: 'SYSTEM_ADMIN' },
      create: { email: input.email, displayName: input.name, passwordHash, globalRole: 'SYSTEM_ADMIN' },
      select: { email: true },
    })
    console.log(`System Admin đã sẵn sàng: ${user.email}`)
  } finally {
    await database.$disconnect()
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Không bootstrap được System Admin.')
  process.exitCode = 1
})
