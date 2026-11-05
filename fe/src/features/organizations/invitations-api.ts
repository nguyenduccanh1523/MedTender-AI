import type { components } from '@medtender/contracts/api'

import { api } from '../../lib/api/client'
import type { Organization } from './api'

export type Invitation = components['schemas']['InvitationDto']
export type InviteInput = components['schemas']['CreateInvitationDto']
type CreatedInvitation = components['schemas']['CreatedInvitationDto']

function collection(slug: string) {
  return `/organizations/${encodeURIComponent(slug)}/invitations`
}

export function listInvitations(slug: string) {
  return api<Invitation[]>(collection(slug))
}

export function createInvitation(slug: string, input: InviteInput) {
  return api<CreatedInvitation>(collection(slug), { method: 'POST', body: JSON.stringify(input) })
}

export function revokeInvitation(slug: string, id: string) {
  return api<void>(`${collection(slug)}/${encodeURIComponent(id)}/revoke`, { method: 'POST' })
}

export function acceptInvitation(token: string) {
  return api<Organization>('/organizations/invitations/accept', { method: 'POST', body: JSON.stringify({ token }) })
}
