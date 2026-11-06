import type { Organization } from './api'

const cache = new Map<string, Organization>()

export function primeOrganizations(organizations: Organization[]) {
  organizations.forEach((organization) => cache.set(organization.slug, organization))
}

export function readCachedOrganization(slug: string) {
  return cache.get(slug)
}

export function clearOrganizationCache() {
  cache.clear()
}
