import { randomUUID } from 'node:crypto'
import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common'

import { generateToken, hashToken } from '../../../common/security/opaque-token'
import { DatabaseService } from '../../../database/database.service'
import { Prisma } from '../../../database/generated/client'
import { issueAccessToken, verifyAccessToken } from '../domain/access-token'
import { hashPassword, verifyPassword } from '../domain/password'

type LoginInput = { email: string; password: string }
type RegisterInput = LoginInput & { name: string }
export type AuthenticatedIdentity = { id: string; email: string; name: string; systemRole?: 'SYSTEM_ADMIN' }

const accessTtl = 15 * 60 * 1000
const sessionTtl = 7 * 24 * 60 * 60 * 1000
const userFields = { id: true, email: true, displayName: true, globalRole: true } as const

function toPublic(user: { id: string; email: string; displayName: string; globalRole: 'SYSTEM_ADMIN' | null }): AuthenticatedIdentity {
  return { id: user.id, email: user.email, name: user.displayName, ...(user.globalRole ? { systemRole: user.globalRole } : {}) }
}

function issueTokens(now: Date, userId: string, sessionId: string, expiresAt = new Date(now.getTime() + sessionTtl)) {
  const accessExpiresAt = new Date(Math.min(now.getTime() + accessTtl, expiresAt.getTime()))
  return {
    access: issueAccessToken(userId, sessionId, accessExpiresAt),
    refresh: generateToken(),
    accessExpiresAt,
    expiresAt,
  }
}

function tokenFields(tokens: ReturnType<typeof issueTokens>) {
  return {
    accessTokenHash: hashToken(tokens.access),
    refreshTokenHash: hashToken(tokens.refresh),
    accessExpiresAt: tokens.accessExpiresAt,
  }
}

@Injectable()
export class IdentityService {
  constructor(private readonly database: DatabaseService) {}

  async register(input: RegisterInput) {
    const passwordHash = await hashPassword(input.password)
    try {
      return await this.database.db.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: { email: input.email, displayName: input.name, passwordHash },
          select: userFields,
        })
        return this.startSession(tx, user)
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Email đã được sử dụng.')
      }
      throw error
    }
  }

  async login(input: LoginInput) {
    const db = this.database.db
    const user = await db.user.findUnique({
      where: { email: input.email },
      select: { ...userFields, passwordHash: true },
    })
    const valid = await verifyPassword(input.password, user?.passwordHash)
    if (!user || !valid) throw new UnauthorizedException('Email hoặc mật khẩu không đúng.')
    return this.startSession(db, user)
  }

  async activate(token: string, password: string) {
    if (!/^[A-Za-z0-9_-]{43}$/.test(token) || password.length < 12 || password.length > 128) {
      throw new UnauthorizedException('Liên kết kích hoạt không hợp lệ.')
    }
    const tokenHash = hashToken(token)
    const passwordHash = await hashPassword(password)
    return this.database.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT set_config('app.activation_token_hash', ${tokenHash}, true)`
      const record = await tx.accountActivationToken.findFirst({
        where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
        select: { id: true, user: { select: userFields } },
      })
      if (!record) throw new UnauthorizedException('Liên kết kích hoạt đã hết hạn hoặc đã được sử dụng.')
      const changed = await tx.accountActivationToken.updateMany({
        where: { id: record.id, usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() },
      })
      if (changed.count !== 1) throw new UnauthorizedException('Liên kết kích hoạt đã được sử dụng.')
      const user = await tx.user.update({
        where: { id: record.user.id }, data: { passwordHash }, select: userFields,
      })
      return this.startSession(tx, user)
    })
  }

  private async startSession(db: Prisma.TransactionClient, user: Parameters<typeof toPublic>[0]) {
    const sessionId = randomUUID()
    const tokens = issueTokens(new Date(), user.id, sessionId)
    await db.authSession.create({
      data: { id: sessionId, ...tokenFields(tokens), expiresAt: tokens.expiresAt, userId: user.id },
    })
    return { user: toPublic(user), tokens }
  }

  async authenticate(access: string | undefined) {
    const claims = access ? verifyAccessToken(access) : undefined
    if (!access || !claims) throw new UnauthorizedException('Phiên đăng nhập không hợp lệ.')
    const now = new Date()
    const session = await this.database.db.authSession.findFirst({
      where: {
        id: claims.sessionId, userId: claims.userId, accessTokenHash: hashToken(access),
        accessExpiresAt: { gt: now }, expiresAt: { gt: now }, revokedAt: null,
      },
      select: { user: { select: userFields } },
    })
    if (!session) throw new UnauthorizedException('Phiên đăng nhập đã hết hạn.')
    return toPublic(session.user)
  }

  async refresh(refresh: string | undefined) {
    if (!refresh) throw new UnauthorizedException('Phiên đăng nhập đã hết hạn.')
    const refreshTokenHash = hashToken(refresh)
    const now = new Date()
    const db = this.database.db
    const session = await db.authSession.findFirst({
      where: { refreshTokenHash, expiresAt: { gt: now }, revokedAt: null },
      select: { id: true, expiresAt: true, user: { select: userFields } },
    })
    if (!session) throw new UnauthorizedException('Phiên đăng nhập đã hết hạn.')

    const tokens = issueTokens(now, session.user.id, session.id, session.expiresAt)
    const updated = await db.authSession.updateMany({
      where: { id: session.id, refreshTokenHash, revokedAt: null, expiresAt: { gt: now } },
      data: tokenFields(tokens),
    })
    if (updated.count !== 1) throw new UnauthorizedException('Phiên đăng nhập đã thay đổi.')
    return { user: toPublic(session.user), tokens }
  }

  async logout(access?: string, refresh?: string) {
    const claims = access?.includes('.') ? verifyAccessToken(access) : undefined
    const tokens = [
      ...(claims ? [{ id: claims.sessionId, userId: claims.userId }] : []),
      ...(access ? [{ accessTokenHash: hashToken(access) }] : []),
      ...(refresh ? [{ refreshTokenHash: hashToken(refresh) }] : []),
    ]
    if (!tokens.length) return
    await this.database.db.authSession.updateMany({
      where: { OR: tokens, revokedAt: null },
      data: { revokedAt: new Date() },
    })
  }
}
