import { demoAccounts } from '../src/scripts/demo-seed'

describe('demo seed accounts', () => {
  it('contains System Admin and every organization role exactly once', () => {
    expect(demoAccounts.map(({ role }) => role)).toEqual([
      'SYSTEM_ADMIN', 'OWNER', 'ADMIN', 'BID_MANAGER', 'ANALYST', 'CATALOG_MANAGER', 'REVIEWER', 'VIEWER',
    ])
    expect(new Set(demoAccounts.map(({ email }) => email)).size).toBe(demoAccounts.length)
  })
})
