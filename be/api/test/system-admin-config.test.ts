import { systemAdminInput } from '../src/scripts/system-admin-config'

describe('System Admin bootstrap configuration', () => {
  it('rejects missing or weak credentials', () => {
    expect(() => systemAdminInput({})).toThrow('SYSTEM_ADMIN')
    expect(() => systemAdminInput({
      SYSTEM_ADMIN_EMAIL: 'admin@example.test', SYSTEM_ADMIN_NAME: 'Admin', SYSTEM_ADMIN_PASSWORD: 'short',
    })).toThrow('SYSTEM_ADMIN')
  })

  it('normalizes a valid email without returning extra environment values', () => {
    expect(systemAdminInput({
      SYSTEM_ADMIN_EMAIL: ' ADMIN@Example.Test ',
      SYSTEM_ADMIN_NAME: ' System Admin ',
      SYSTEM_ADMIN_PASSWORD: 'ExamplePass2026!',
      DATABASE_URL: 'should-not-be-returned',
    })).toEqual({ email: 'admin@example.test', name: 'System Admin', password: 'ExamplePass2026!' })
  })
})
