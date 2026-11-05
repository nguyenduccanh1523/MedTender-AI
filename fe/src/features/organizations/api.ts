import type { components } from '@medtender/contracts/api'

import { api } from '../../lib/api/client'

export type Organization = components['schemas']['OrganizationDto']
export type OrganizationMember = components['schemas']['OrganizationMemberDto']

export function listOrganizations() {
  return api<Organization[]>('/organizations')
}

export function createOrganization(name: string) {
  return api<Organization>('/organizations', { method: 'POST', body: JSON.stringify({ name }) })
}

export function getOrganization(slug: string) {
  return api<Organization>(`/organizations/${encodeURIComponent(slug)}`)
}

export function listOrganizationMembers(slug: string) {
  return api<OrganizationMember[]>(`/organizations/${encodeURIComponent(slug)}/members`)
}
