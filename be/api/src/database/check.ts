import { createPrismaClient } from './prisma-client'

async function checkDatabase() {
  const value = process.env.DATABASE_URL
  if (!value) {
    console.error('Điền DATABASE_URL trong file env đang dùng.')
    process.exitCode = 1
    return
  }

  const url = URL.parse(value)
  if (!url?.hostname || !['postgres:', 'postgresql:'].includes(url.protocol)) {
    console.error('DATABASE_URL phải là chuỗi PostgreSQL từ Supabase → Connect, ví dụ bắt đầu bằng postgresql://.')
    process.exitCode = 1
    return
  }

  const db = createPrismaClient(value)
  try {
    const [role] = await db.$queryRaw<Array<{ name: string; elevated: boolean }>>`
      SELECT rolname::text AS name, (rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb) AS elevated
      FROM pg_roles WHERE rolname = current_user
    `
    if (role?.name !== 'medtender_app' || role.elevated) {
      console.error('DATABASE_URL phải dùng runtime role medtender_app có quyền giới hạn.')
      process.exitCode = 1
      return
    }

    const unscopedMemberships = await db.organizationMembership.count()
    if (unscopedMemberships !== 0) {
      console.error('Kiểm tra RLS thất bại: runtime đọc được membership khi chưa có tenant context.')
      process.exitCode = 1
      return
    }

    await db.authSession.findFirst({ select: { id: true } })
    await db.organizationInvitation.findFirst({ select: { id: true } })
    await db.organizationApplication.findFirst({ select: { id: true } })
    await db.accountActivationToken.findFirst({ select: { id: true } })
    console.log('Kết nối Supabase qua medtender_app thành công. Đã kiểm tra membership, session, lời mời và phê duyệt tổ chức.')
  } finally {
    await db.$disconnect()
  }
}

void checkDatabase().catch(() => {
  console.error('Kết nối PostgreSQL thất bại. Kiểm tra URL runtime, mật khẩu, SSL, schema và migration.')
  process.exitCode = 1
})
