import { randomUUID } from 'node:crypto'
import { ServiceUnavailableException } from '@nestjs/common'
import jwt from 'jsonwebtoken'

const issuer = 'medtender-ai'
const audience = 'medtender-web'
const uuid = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i

function signingKey() {
  const value = process.env.AUTH_JWT_SECRET
  if (!value || !/^[a-f0-9]{64}$/i.test(value)) {
    throw new ServiceUnavailableException('Backend chưa được cấu hình khóa ký phiên.')
  }
  return Buffer.from(value, 'hex')
}

export function issueAccessToken(userId: string, sessionId: string, expiresAt: Date) {
  return jwt.sign({ sid: sessionId, exp: Math.floor(expiresAt.getTime() / 1000) }, signingKey(), {
    algorithm: 'HS256',
    issuer,
    audience,
    subject: userId,
    jwtid: randomUUID(),
  })
}

export function verifyAccessToken(token: string) {
  const key = signingKey()
  try {
    const claims = jwt.verify(token, key, { algorithms: ['HS256'], issuer, audience })
    if (
      typeof claims === 'string' || typeof claims.sub !== 'string' || !uuid.test(claims.sub) ||
      typeof claims.sid !== 'string' || !uuid.test(claims.sid) || typeof claims.exp !== 'number'
    ) return undefined
    return { userId: claims.sub, sessionId: claims.sid as string }
  } catch {
    return undefined
  }
}
