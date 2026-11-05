import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'

import type { IdentityRequest } from '../../../../identity/presentation/http/guards/session.guard'

@Injectable()
export class SystemAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<IdentityRequest>()
    if (request.identity?.systemRole !== 'SYSTEM_ADMIN') {
      throw new ForbiddenException('Chỉ System Admin được thực hiện thao tác này.')
    }
    return true
  }
}
