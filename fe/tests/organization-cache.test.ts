import { afterEach, expect, it } from 'vitest'

import { clearOrganizationCache, primeOrganizations, readCachedOrganization } from '../src/features/organizations/organization-cache'

afterEach(() => clearOrganizationCache())

it('serves an organization from the navigation cache before a workspace refetch completes', () => {
  primeOrganizations([{ id: 'org-a', slug: 'benh-vien-a', name: 'Bệnh viện A', role: 'BID_MANAGER' }])

  expect(readCachedOrganization('benh-vien-a')).toEqual({ id: 'org-a', slug: 'benh-vien-a', name: 'Bệnh viện A', role: 'BID_MANAGER' })
})
