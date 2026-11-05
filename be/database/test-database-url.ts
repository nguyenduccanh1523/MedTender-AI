export function localTestDatabaseUrl(name: 'TEST_DATABASE_URL' | 'TEST_DATABASE_MIGRATION_URL'): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing ${name} for local DB tests`)

  const url = URL.parse(value)
  if (
    !url || !['postgres:', 'postgresql:'].includes(url.protocol) ||
    url.hostname !== '127.0.0.1' || url.port !== '55432' || url.pathname !== '/medtender'
  ) {
    throw new Error(`${name} must target the default local MedTender PostgreSQL`)
  }

  return url.href
}
