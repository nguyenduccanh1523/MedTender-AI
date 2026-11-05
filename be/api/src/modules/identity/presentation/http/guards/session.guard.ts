import type { IncomingMessage } from 'node:http'
import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common'

import { IdentityService, type AuthenticatedIdentity } from '../../../application/identity.service'
import { accessCookie, readSessionCookie } from '../session-cookies'

export type IdentityRequest = IncomingMessage & { identity: AuthenticatedIdentity }

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly identity: IdentityService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<IdentityRequest>()
    request.identity = await this.identity.authenticate(readSessionCookie(request, accessCookie))
    return true
  }
}
