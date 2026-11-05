'use client'

import Link from 'next/link'
import { useState, type FormEvent } from 'react'

import { submitOrganizationApplication } from '../api'

export function OrganizationApplicationForm() {
  const [receipt, setReceipt] = useState<{ reference: string }>()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    const fields = new FormData(event.currentTarget)
    setPending(true)
    setError('')
    try {
      const result = await submitOrganizationApplication({
        organizationName: String(fields.get('organizationName') ?? ''),
        taxCode: String(fields.get('taxCode') ?? ''),
        website: String(fields.get('website') ?? '') || undefined,
        address: String(fields.get('address') ?? ''),
        contactName: String(fields.get('contactName') ?? ''),
        contactEmail: String(fields.get('contactEmail') ?? ''),
        contactPhone: String(fields.get('contactPhone') ?? ''),
      })
      setReceipt(result)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không gửi được hồ sơ.')
      setPending(false)
    }
  }

  if (receipt) return (
    <section className="application-success" aria-live="polite">
      <span className="success-icon">✓</span>
      <p className="eyebrow">Đã ghi nhận</p>
      <h1>Hồ sơ đã được tiếp nhận</h1>
      <p>System Admin sẽ kiểm tra thông tin và gửi email kích hoạt tài khoản OWNER khi hồ sơ được duyệt.</p>
      <div className="tracking-code"><span>Mã hồ sơ</span><strong>{receipt.reference}</strong></div>
      <p className="muted">Hãy lưu mã này để đối chiếu khi cần hỗ trợ.</p>
      <Link className="button button-secondary" href="/">Về trang chủ</Link>
    </section>
  )

  return (
    <form className="application-form" onSubmit={submit} aria-busy={pending}>
      <fieldset>
        <legend>Thông tin tổ chức</legend>
        <div className="form-grid">
          <label className="span-2">Tên tổ chức<input name="organizationName" required minLength={2} maxLength={160} placeholder="Ví dụ: Bệnh viện Minh Tâm" /></label>
          <label>Mã số thuế<input name="taxCode" required minLength={3} maxLength={40} /></label>
          <label>Website <span>(không bắt buộc)</span><input name="website" type="url" placeholder="https://tochuc.vn" /></label>
          <label className="span-2">Địa chỉ<textarea name="address" required minLength={5} maxLength={300} rows={3} /></label>
        </div>
      </fieldset>
      <fieldset>
        <legend>Người phụ trách</legend>
        <div className="form-grid">
          <label>Người phụ trách<input name="contactName" required minLength={2} maxLength={100} /></label>
          <label>Số điện thoại<input name="contactPhone" required minLength={8} maxLength={30} autoComplete="tel" /></label>
          <label className="span-2">Email công việc<input name="contactEmail" type="email" required maxLength={254} autoComplete="email" /></label>
        </div>
      </fieldset>
      <label className="consent"><input type="checkbox" required /> Tôi xác nhận thông tin trên là chính xác và đồng ý để MedTender AI liên hệ xác minh.</label>
      {error && <p className="notice notice-error" role="alert">{error}</p>}
      <button className="button button-primary" disabled={pending}>{pending ? 'Đang gửi hồ sơ…' : 'Gửi hồ sơ xét duyệt'}</button>
    </form>
  )
}
