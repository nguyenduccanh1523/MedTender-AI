import { Injectable, ServiceUnavailableException } from '@nestjs/common'

@Injectable()
export class ApprovalMailer {
  async sendActivation(to: string, organizationName: string, link: string): Promise<'LOGGED' | 'SENT'> {
    const mode = process.env.EMAIL_DELIVERY_MODE || 'LOG'
    if (mode === 'LOG') return 'LOGGED'
    if (mode !== 'RESEND' || !process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
      throw new ServiceUnavailableException('Cấu hình gửi email chưa đầy đủ.')
    }
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: [to],
        subject: `Tổ chức ${organizationName} đã được phê duyệt`,
        html: `<p>Hồ sơ tổ chức <strong>${organizationName}</strong> đã được phê duyệt.</p><p><a href="${link}">Kích hoạt tài khoản OWNER</a></p><p>Liên kết hết hạn sau 24 giờ.</p>`,
      }),
    })
    if (!response.ok) throw new ServiceUnavailableException('Tổ chức đã được duyệt nhưng gửi email kích hoạt thất bại.')
    return 'SENT'
  }
}
