import type { components } from '@medtender/contracts/api'

import { api } from '../../lib/api/client'

export type Organization = components['schemas']['OrganizationDto']
export type OrganizationMember = components['schemas']['OrganizationMemberDto']
export type WorkspaceActivity = components['schemas']['WorkspaceActivityDto']
export type OrganizationGovernance = components['schemas']['OrganizationGovernanceDto']
export type UpdateOrganizationGovernanceInput = components['schemas']['UpdateOrganizationGovernanceDto']
export type UpdateOrganizationMemberInput = components['schemas']['UpdateOrganizationMemberDto']

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

export function getWorkspaceActivity(slug: string) {
  return api<WorkspaceActivity>(`/organizations/${encodeURIComponent(slug)}/activity`)
}

export function getOrganizationGovernance(slug: string) {
  return api<OrganizationGovernance>(`/organizations/${encodeURIComponent(slug)}/governance`)
}

export function updateOrganizationGovernance(
  slug: string,
  input: UpdateOrganizationGovernanceInput,
) {
  return api<OrganizationGovernance>(`/organizations/${encodeURIComponent(slug)}/governance`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export function updateOrganizationMember(
  slug: string,
  memberUserId: string,
  input: UpdateOrganizationMemberInput,
) {
  return api<OrganizationMember>(
    `/organizations/${encodeURIComponent(slug)}/members/${encodeURIComponent(memberUserId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    },
  )
}

