'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'

import { readResource, writeResource } from '../../../lib/api/resource-cache'
import { canCreateTender, useWorkspaceRole } from '../../organizations/workspace-permissions'
import { createTender, type Tender } from '../api'

export function TenderForm({ slug }: { slug: string }) {
  const role = useWorkspaceRole()
  const router = useRouter()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || !canCreateTender(role)) return
    const form = new FormData(event.currentTarget)
    setBusy(true)
    try {
      const tender = await createTender(slug, {
        title: String(form.get('title')),
        reference: String(form.get('reference') || ''),
        procurementStage: String(form.get('stage')) as 'RFQ' | 'FORMAL_TENDER' | 'INTERNAL',
      })
      const key = `tenders:${slug}`
      const current = readResource<Tender[]>(key)
      if (current) writeResource(key, [{ ...tender, _count: { lots: 0 } }, ...current])
      router.replace(`/${slug}/tenders/${tender.id}`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không tạo được hồ sơ.')
      setBusy(false)
    }
  }

  if (!canCreateTender(role)) return <section className="surface empty-state" role="alert">
    <h2>Bạn không có quyền tạo hồ sơ thầu</h2>
    <p className="muted">Vai trò hiện tại chỉ được xem hồ sơ trong tổ chức này.</p>
    <Link className="button button-secondary" href={`/${slug}/tenders`}>Về danh sách hồ sơ</Link>
  </section>

  return <form className="surface stack-form" onSubmit={submit}>
    <p className="eyebrow">Hồ sơ mới</p><h1>Tạo hồ sơ thầu</h1>
    <label>Tên hồ sơ<input name="title" required maxLength={200} /></label>
    <label>Mã tham chiếu<input name="reference" maxLength={200} /></label>
    <label>Loại hồ sơ<select name="stage" defaultValue="RFQ"><option value="RFQ">RFQ — Yêu cầu báo giá</option><option value="FORMAL_TENDER">E-HSMT — Hồ sơ mời thầu</option><option value="INTERNAL">Nội bộ</option></select></label>
    {error && <p className="notice notice-error" role="alert">{error}</p>}
    <button className="button button-primary" disabled={busy}>{busy ? 'Đang tạo…' : 'Tạo hồ sơ'}</button>
  </form>
}
