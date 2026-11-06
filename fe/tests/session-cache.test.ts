import { afterEach, expect, it } from 'vitest'

import { clearCachedUser, readCachedUser, saveCachedUser } from '../src/features/auth/session-cache'

afterEach(() => clearCachedUser())

it('stores the authenticated user for the post-login transition', () => {
  saveCachedUser({ id: 'user-1', name: 'Lan', email: 'lan@example.test', systemRole: 'SYSTEM_ADMIN' })

  expect(readCachedUser()).toEqual({ id: 'user-1', name: 'Lan', email: 'lan@example.test', systemRole: 'SYSTEM_ADMIN' })
})

it('ignores malformed cached values', () => {
  sessionStorage.setItem('medtender.auth.user', '{bad json')
  expect(readCachedUser()).toBeUndefined()
})
