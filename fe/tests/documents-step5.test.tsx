import { describe, expect, it } from 'vitest'
import { canManageDocuments } from '../src/features/organizations/workspace-permissions'

describe('Step 05 - Role Permissions & Document Vault Guardrails', () => {
  it('allows OWNER, ADMIN, BID_MANAGER and CATALOG_MANAGER to upload/manage documents', () => {
    expect(canManageDocuments('OWNER')).toBe(true)
    expect(canManageDocuments('ADMIN')).toBe(true)
    expect(canManageDocuments('BID_MANAGER')).toBe(true)
    expect(canManageDocuments('CATALOG_MANAGER')).toBe(true)
  })

  it('prohibits ANALYST, REVIEWER and VIEWER from uploading documents', () => {
    expect(canManageDocuments('ANALYST')).toBe(false)
    expect(canManageDocuments('REVIEWER')).toBe(false)
    expect(canManageDocuments('VIEWER')).toBe(false)
  })
})
