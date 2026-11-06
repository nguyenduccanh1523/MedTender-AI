import { createPrismaClient } from '../database/prisma-client'
import { hashPassword } from '../modules/identity/domain/password'

type DemoRole = 'SYSTEM_ADMIN' | 'OWNER' | 'ADMIN' | 'BID_MANAGER' | 'ANALYST' | 'CATALOG_MANAGER' | 'REVIEWER' | 'VIEWER'
type OrganizationRole = Exclude<DemoRole, 'SYSTEM_ADMIN'>

export const demoAccounts: ReadonlyArray<{ role: DemoRole; email: string; name: string }> = [
  { role: 'SYSTEM_ADMIN', email: 'system.admin@medtender.demo', name: 'System Admin Demo' },
  { role: 'OWNER', email: 'owner@medtender.demo', name: 'Nguyễn Minh Owner' },
  { role: 'ADMIN', email: 'admin@medtender.demo', name: 'Trần An Admin' },
  { role: 'BID_MANAGER', email: 'bid.manager@medtender.demo', name: 'Lê Bình Bid Manager' },
  { role: 'ANALYST', email: 'analyst@medtender.demo', name: 'Phạm Chi Analyst' },
  { role: 'CATALOG_MANAGER', email: 'catalog.manager@medtender.demo', name: 'Vũ Dung Catalog Manager' },
  { role: 'REVIEWER', email: 'reviewer@medtender.demo', name: 'Hoàng Giang Reviewer' },
  { role: 'VIEWER', email: 'viewer@medtender.demo', name: 'Đỗ Hương Viewer' },
]

const organizationSlug = 'benh-vien-med-tender-demo'
const isOrganizationAccount = (account: { role: DemoRole }): account is { role: OrganizationRole; email: string; name: string } => account.role !== 'SYSTEM_ADMIN'

async function main() {
  const connection = process.env.DATABASE_MIGRATION_URL || process.env.DATABASE_URL
  if (!connection) throw new Error('Cần DATABASE_MIGRATION_URL hoặc DATABASE_URL để seed dữ liệu demo.')
  const password = process.env.DEMO_SEED_PASSWORD || 'MedTenderDemo2026!'
  if (password.length < 12 || password.length > 128) throw new Error('DEMO_SEED_PASSWORD phải dài 12–128 ký tự.')
  const database = createPrismaClient(connection, 1)

  try {
    const passwordHash = await hashPassword(password)
    const users = await Promise.all(demoAccounts.map(async ({ email, name, role }) => [role, await database.user.upsert({
      where: { email },
      update: { displayName: name, passwordHash, globalRole: role === 'SYSTEM_ADMIN' ? 'SYSTEM_ADMIN' : null },
      create: { email, displayName: name, passwordHash, globalRole: role === 'SYSTEM_ADMIN' ? 'SYSTEM_ADMIN' : null },
      select: { id: true, email: true },
    })] as const))
    const byRole = new Map(users)
    const owner = byRole.get('OWNER')
    if (!owner) throw new Error('Không tìm thấy demo OWNER.')
    const organization = await database.organization.upsert({
      where: { slug: organizationSlug },
      update: { name: 'Bệnh viện MedTender Demo', status: 'ACTIVE', createdByUserId: owner.id },
      create: { slug: organizationSlug, name: 'Bệnh viện MedTender Demo', createdByUserId: owner.id },
      select: { id: true, slug: true },
    })
    await Promise.all(demoAccounts.filter(isOrganizationAccount).map(async ({ role }) => {
      const user = byRole.get(role)
      if (!user) throw new Error(`Không tìm thấy demo ${role}.`)
      return database.organizationMembership.upsert({
        where: { organizationId_userId: { organizationId: organization.id, userId: user.id } },
        update: { role, status: 'ACTIVE' },
        create: { organizationId: organization.id, userId: user.id, role },
      })
    }))
    console.log(`Đã seed ${demoAccounts.length} tài khoản demo và workspace /${organization.slug}.`)
    console.log(`Mật khẩu demo: ${password}`)
    demoAccounts.forEach(({ role, email }) => console.log(`${role.padEnd(16)} ${email}`))
  } finally {
    await database.$disconnect()
  }
}

if (require.main === module) void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Không seed được dữ liệu demo.')
  process.exitCode = 1
})
