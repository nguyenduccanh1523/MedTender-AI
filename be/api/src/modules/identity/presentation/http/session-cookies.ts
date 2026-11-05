import type { IncomingMessage, ServerResponse } from 'node:http'

export const accessCookie = 'medtender_access'
export const refreshCookie = 'medtender_refresh'

export function readSessionCookie(request: IncomingMessage, name: string): string | undefined {
  const prefix = `${name}=`
  const value = request.headers.cookie?.split(';').map((item) => item.trim())
    .find((item) => item.startsWith(prefix))?.slice(prefix.length)
  if (!value || value.length > 2048) return undefined
  const opaque = /^[A-Za-z0-9_-]{43}$/.test(value)
  const jwt = name === accessCookie && /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value)
  return opaque || jwt ? value : undefined
}

export function setSessionCookies(
  response: ServerResponse,
  tokens?: { access: string; refresh: string; accessExpiresAt: Date; expiresAt: Date },
) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  const age = (expiration?: Date) => expiration
    ? Math.max(0, Math.ceil((expiration.getTime() - Date.now()) / 1000))
    : 0

  response.setHeader('Set-Cookie', [
    `${accessCookie}=${tokens?.access ?? ''}; Path=/; Max-Age=${age(tokens?.accessExpiresAt)}; HttpOnly; SameSite=Lax${secure}`,
    `${refreshCookie}=${tokens?.refresh ?? ''}; Path=/api/v1/auth; Max-Age=${age(tokens?.expiresAt)}; HttpOnly; SameSite=Lax${secure}`,
  ])
}
