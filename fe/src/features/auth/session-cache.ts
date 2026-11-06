import type { PublicUser } from './api'

const key = 'medtender.auth.user'

function isPublicUser(value: unknown): value is PublicUser {
  return typeof value === 'object' && value !== null &&
    typeof (value as PublicUser).id === 'string' && typeof (value as PublicUser).name === 'string' &&
    typeof (value as PublicUser).email === 'string'
}

export function saveCachedUser(user: PublicUser) {
  if (typeof window !== 'undefined') sessionStorage.setItem(key, JSON.stringify(user))
}

export function readCachedUser(): PublicUser | undefined {
  if (typeof window === 'undefined') return undefined
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(key) ?? 'null')
    return isPublicUser(value) ? value : undefined
  } catch { return undefined }
}

export function clearCachedUser() {
  if (typeof window !== 'undefined') sessionStorage.removeItem(key)
}
