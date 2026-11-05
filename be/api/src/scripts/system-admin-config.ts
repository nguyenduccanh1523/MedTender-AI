type Environment = Record<string, string | undefined>

export function systemAdminInput(environment: Environment) {
  const email = environment.SYSTEM_ADMIN_EMAIL?.trim().toLowerCase() ?? ''
  const name = environment.SYSTEM_ADMIN_NAME?.trim() ?? ''
  const password = environment.SYSTEM_ADMIN_PASSWORD ?? ''
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || name.length < 2 || name.length > 100 || password.length < 12 || password.length > 128) {
    throw new Error('SYSTEM_ADMIN_EMAIL, SYSTEM_ADMIN_NAME và SYSTEM_ADMIN_PASSWORD (12–128 ký tự) phải hợp lệ.')
  }
  return { email, name, password }
}
