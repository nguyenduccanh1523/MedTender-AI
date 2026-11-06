import type { components } from '@medtender/contracts/api'

import { api } from '../../lib/api/client'

export type PublicUser = components['schemas']['PublicUser']
type LoginInput = components['schemas']['LoginDto']
type RegisterInput = components['schemas']['RegisterDto']
type UpdateProfileInput = components['schemas']['UpdateProfileDto']
type ChangePasswordInput = components['schemas']['ChangePasswordDto']

export function submitAuth(mode: 'login' | 'register', input: LoginInput | RegisterInput) {
  return api<PublicUser>(`/auth/${mode}`, { method: 'POST', body: JSON.stringify(input) }, false)
}

export function getCurrentUser() {
  return api<PublicUser>('/auth/me')
}

export function updateProfile(input: UpdateProfileInput) {
  return api<PublicUser>('/auth/profile', { method: 'PATCH', body: JSON.stringify(input) })
}

export function changePassword(input: ChangePasswordInput) {
  return api<void>('/auth/change-password', { method: 'POST', body: JSON.stringify(input) })
}

export function logout() {
  return api<void>('/auth/logout', { method: 'POST' }, false)
}
