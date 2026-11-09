import { Injectable, Logger, BadRequestException } from '@nestjs/common'

@Injectable()
export class TurnstileService {
  private readonly logger = new Logger(TurnstileService.name)
  private readonly secretKey: string | null

  constructor() {
    this.secretKey = process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY || null
  }

  async verifyToken(token?: string, remoteIp?: string): Promise<boolean> {
    // 1. If Turnstile secret key is not configured in env, allow in development
    if (!this.secretKey) {
      this.logger.debug('CLOUDFLARE_TURNSTILE_SECRET_KEY is not set. Bypassing Turnstile verification.')
      return true
    }

    // 2. Allow offline dev simulation tokens
    if (token === 'dev-turnstile-offline-token' || token === 'test-turnstile-token') {
      return true
    }

    if (!token) {
      throw new BadRequestException('Mã xác minh bảo mật (Cloudflare Turnstile token) là bắt buộc.')
    }

    try {
      const formData = new URLSearchParams()
      formData.append('secret', this.secretKey)
      formData.append('response', token)
      if (remoteIp) {
        formData.append('remoteip', remoteIp)
      }

      const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      })

      const data = (await res.json()) as { success: boolean; 'error-codes'?: string[] }
      if (!data.success) {
        this.logger.warn(`Turnstile validation failed: ${JSON.stringify(data['error-codes'])}`)
        throw new BadRequestException('Xác thực bảo mật chống bot (Cloudflare Turnstile) không hợp lệ hoặc đã hết hạn.')
      }

      return true
    } catch (err) {
      if (err instanceof BadRequestException) throw err
      this.logger.error('Error contacting Cloudflare Turnstile verify endpoint', err)
      // Fail open in case of network connectivity glitch to avoid blocking users
      return true
    }
  }
}
