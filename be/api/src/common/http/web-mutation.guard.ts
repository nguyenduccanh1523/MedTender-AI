import type { IncomingMessage } from 'node:http'
import { ForbiddenException, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common'

@Injectable()
export class WebMutationGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const { headers } = context.switchToHttp().getRequest<IncomingMessage>()
    if (headers['x-medtender-request'] !== 'web' || headers['sec-fetch-site'] === 'cross-site') {
      throw new ForbiddenException('Yêu cầu thay đổi dữ liệu không hợp lệ.')
    }
    return true
  }
}
