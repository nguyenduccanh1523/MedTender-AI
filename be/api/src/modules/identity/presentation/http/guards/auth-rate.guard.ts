import type { IncomingMessage } from 'node:http'
import { HttpException, HttpStatus, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common'

const windowMs = 5 * 60 * 1000
const maxAttempts = 30

@Injectable()
export class AuthRateGuard implements CanActivate {
  private windowEndsAt = 0
  private readonly attempts = new Map<string, number>()

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<IncomingMessage>()
    const now = Date.now()
    if (now >= this.windowEndsAt) {
      this.attempts.clear()
      this.windowEndsAt = now + windowMs
    }
    const key = request.socket.remoteAddress ?? 'unknown'
    const count = this.attempts.get(key) ?? 0
    if (count >= maxAttempts || (count === 0 && this.attempts.size >= 4096)) {
      throw new HttpException('Quá nhiều yêu cầu. Vui lòng thử lại sau.', HttpStatus.TOO_MANY_REQUESTS)
    }
    this.attempts.set(key, count + 1)
    return true
  }
}
