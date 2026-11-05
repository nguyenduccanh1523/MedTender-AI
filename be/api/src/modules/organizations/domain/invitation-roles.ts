import type { MembershipRole } from '../../../database/generated/client'

export const invitableRoles = ['ADMIN', 'BID_MANAGER', 'ANALYST', 'CATALOG_MANAGER', 'REVIEWER', 'VIEWER'] as const
export type InvitableRole = typeof invitableRoles[number]

export function isInvitableRole(value: unknown): value is InvitableRole {
  return invitableRoles.some((role) => role === value)
}

export function canInviteRole(actor: MembershipRole, target: MembershipRole) {
  return target !== 'OWNER' && (actor === 'OWNER' || (actor === 'ADMIN' && target !== 'ADMIN'))
}
