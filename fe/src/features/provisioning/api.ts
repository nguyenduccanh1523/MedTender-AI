import { api } from '../../lib/api/client'

export interface OrganizationApplicationInput {
  organizationName: string
  taxCode: string
  website?: string
  address: string
  contactName: string
  contactEmail: string
  contactPhone: string
}

export interface OrganizationApplication extends OrganizationApplicationInput {
  id: string
  reference: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  rejectionReason?: string | null
  reviewedAt?: string | null
  createdAt: string
}

export interface ApprovalResult {
  status: 'APPROVED'
  emailDelivery: 'LOGGED' | 'SENT'
  activationLink?: string
  organization: { id: string; slug: string; name: string }
}

export function submitOrganizationApplication(input: OrganizationApplicationInput) {
  return api<{ reference: string; status: 'PENDING' }>('/organization-applications', {
    method: 'POST', body: JSON.stringify(input),
  }, false)
}

export function listOrganizationApplications() {
  return api<OrganizationApplication[]>('/system-admin/organization-applications')
}

export function approveOrganizationApplication(id: string) {
  return api<ApprovalResult>(`/system-admin/organization-applications/${encodeURIComponent(id)}/approve`, { method: 'POST' })
}

export function rejectOrganizationApplication(id: string, reason: string) {
  return api<void>(`/system-admin/organization-applications/${encodeURIComponent(id)}/reject`, {
    method: 'POST', body: JSON.stringify({ reason }),
  })
}

export function activateAccount(token: string, password: string) {
  return api<{ id: string; email: string; name: string }>('/auth/activate', {
    method: 'POST', body: JSON.stringify({ token, password }),
  }, false)
}
