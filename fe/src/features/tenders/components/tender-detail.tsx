'use client'

import Link from 'next/link'
import { useEffect, useState, type FormEvent } from 'react'

import { loadResource, readResource, writeResource } from '../../../lib/api/resource-cache'
import { canCreateTender, useWorkspaceRole } from '../../organizations/workspace-permissions'
import {
  createTenderItem,
  createTenderLot,
  getTender,
  type Tender,
  type TenderDetail,
} from '../api'

const stageLabels = {
  RFQ: 'RFQ · Yêu cầu báo giá',
  FORMAL_TENDER: 'E-HSMT · Hồ sơ mời thầu',
  INTERNAL: 'Hồ sơ nội bộ',
}

function message(cause: unknown) {
  return cause instanceof Error ? cause.message : 'Không lưu được thông tin. Vui lòng thử lại.'
}

export function TenderDetailView({ slug, id }: { slug: string; id: string }) {
  const role = useWorkspaceRole()
  const canWrite = canCreateTender(role)
  const key = `tender:${slug}:${id}`
  const [tender, setTender] = useState<TenderDetail | undefined>(() => readResource(key))
  const [loadError, setLoadError] = useState('')
  const [lotError, setLotError] = useState('')
  const [itemError, setItemError] = useState('')
  const [lotFormOpen, setLotFormOpen] = useState(false)
  const [itemFormFor, setItemFormFor] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    loadResource(key, () => getTender(slug, id))
      .then((result) => { if (active) setTender(result) })
      .catch((cause: unknown) => { if (active) setLoadError(message(cause)) })
    return () => { active = false }
  }, [id, key, slug])

  async function addLot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canWrite || !tender || busy) return
    const form = event.currentTarget
    const fields = new FormData(form)
    setBusy(true)
    setLotError('')
    try {
      const created = await createTenderLot(slug, id, {
        code: String(fields.get('code') ?? '').trim(),
        name: String(fields.get('name') ?? '').trim(),
      })
      const next = {
        ...tender,
        lots: [...tender.lots, { ...created, items: [] }].sort((a, b) => a.code.localeCompare(b.code, 'vi', { numeric: true })),
      }
      setTender(next)
      writeResource(key, next)
      const listKey = `tenders:${slug}`
      const list = readResource<Tender[]>(listKey)
      if (list) writeResource(listKey, list.map((entry) => entry.id === id ? { ...entry, _count: { lots: next.lots.length } } : entry))
      form.reset()
      setLotFormOpen(false)
    } catch (cause) {
      setLotError(message(cause))
    } finally {
      setBusy(false)
    }
  }

  async function addItem(event: FormEvent<HTMLFormElement>, lotId: string) {
    event.preventDefault()
    if (!canWrite || !tender || busy) return
    const form = event.currentTarget
    const fields = new FormData(form)
    setBusy(true)
    setItemError('')
    try {
      const created = await createTenderItem(slug, id, lotId, {
        itemNo: String(fields.get('itemNo') ?? '').trim(),
        name: String(fields.get('name') ?? '').trim(),
        quantity: Number(fields.get('quantity')),
        unit: String(fields.get('unit') ?? '').trim(),
        description: String(fields.get('description') ?? '').trim(),
      })
      const next = {
        ...tender,
        lots: tender.lots.map((lot) => lot.id === lotId
          ? { ...lot, items: [...lot.items, created].sort((a, b) => a.itemNo.localeCompare(b.itemNo, 'vi', { numeric: true })) }
          : lot),
      }
      setTender(next)
      writeResource(key, next)
      form.reset()
    } catch (cause) {
      setItemError(message(cause))
    } finally {
      setBusy(false)
    }
  }

  if (loadError && !tender) return <p className="notice notice-error" role="alert">{loadError}</p>
  if (!tender) return <div className="loading-skeleton" aria-label="Đang tải hồ sơ thầu" aria-busy="true" />

  const itemCount = tender.lots.reduce((sum, lot) => sum + lot.items.length, 0)

  return <div className="tender-detail-page">
    <Link className="tender-back-link" href={`/${slug}/tenders`}>← Danh sách hồ sơ thầu</Link>
    <section className="surface tender-detail-head">
      <div><p className="eyebrow">Chi tiết hồ sơ thầu</p><h1>{tender.title}</h1><p className="muted">{tender.reference || 'Chưa có mã tham chiếu'}</p></div>
      <span className="tender-stage-badge">{stageLabels[tender.procurementStage]}</span>
    </section>
    <div className="tender-summary" aria-label="Tóm tắt cấu trúc hồ sơ">
      <div><strong>{tender.lots.length}</strong><span>Lot</span></div>
      <div><strong>{itemCount}</strong><span>Dòng hàng hóa</span></div>
      <p>{tender.lots.length === 0 ? 'Bắt đầu bằng cách thêm lot theo tài liệu gốc.' : 'Các dòng hàng hóa được nhóm theo từng lot.'}</p>
    </div>
    <section className="tender-structure" aria-label="Cấu trúc lot và dòng hàng hóa">
      <div className="section-heading"><div><p className="eyebrow">Cấu trúc hồ sơ</p><h2>Lot và dòng hàng hóa</h2><p className="muted">Giữ nguyên cách chia lot và STT trong tài liệu nguồn.</p></div>{canWrite && !lotFormOpen && <button className="button button-primary" type="button" onClick={() => setLotFormOpen(true)}>+ Thêm lot</button>}</div>
      {canWrite && lotFormOpen && <form className="tender-entry-form" onSubmit={addLot} aria-label="Tạo lot">
        <div className="tender-entry-heading"><div><strong>Thêm lot mới</strong><p className="muted">Một lot có thể chứa nhiều dòng hàng hóa.</p></div><button type="button" className="tender-text-button" onClick={() => { setLotFormOpen(false); setLotError('') }}>Đóng</button></div>
        <div className="tender-form-grid"><label>Mã lot<input name="code" placeholder="Ví dụ: LOT-01" required maxLength={50} /></label><label>Tên lot<input name="name" placeholder="Ví dụ: Thiết bị theo dõi" required maxLength={200} /></label></div>
        {lotError && <p className="notice notice-error" role="alert">{lotError}</p>}
        <button className="button button-primary" type="submit" disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu lot'}</button>
      </form>}
      <div className="tender-lots">
        {tender.lots.length === 0 && <div className="tender-empty-lot"><strong>Chưa có lot</strong><p>Hãy thêm lot đầu tiên trước khi nhập dòng hàng hóa.</p></div>}
        {tender.lots.map((lot) => <article className="tender-lot-card" key={lot.id}>
          <div className="tender-lot-heading"><div><span className="tender-lot-code">{lot.code}</span><h3>{lot.name}</h3><p>{lot.items.length} dòng hàng hóa</p></div>{canWrite && itemFormFor !== lot.id && <button className="button button-secondary" type="button" onClick={() => { setItemFormFor(lot.id); setItemError('') }}>+ Thêm dòng hàng hóa</button>}</div>
          {lot.items.length === 0 ? <p className="tender-empty-item">Chưa có dòng hàng hóa trong lot này.</p> : <div className="tender-items-list">{lot.items.map((item) => <div className="tender-item-row" key={item.id}><span className="tender-item-no">{item.itemNo}</span><div><strong>{item.name}</strong>{item.description && <p>{item.description}</p>}</div><span className="tender-item-quantity">{item.quantity} {item.unit}</span></div>)}</div>}
          {canWrite && itemFormFor === lot.id && <form className="tender-entry-form tender-item-form" onSubmit={(event) => addItem(event, lot.id)} aria-label={`Thêm dòng hàng hóa vào ${lot.code}`}>
            <div className="tender-entry-heading"><div><strong>Thêm dòng hàng hóa</strong><p className="muted">STT chỉ cần duy nhất trong lot này.</p></div><button type="button" className="tender-text-button" onClick={() => { setItemFormFor(null); setItemError('') }}>Đóng</button></div>
            <div className="tender-form-grid tender-item-fields"><label>STT<input name="itemNo" placeholder="01" required maxLength={50} /></label><label>Tên hàng hóa<input name="name" placeholder="Tên theo hồ sơ gốc" required maxLength={200} /></label><label>Số lượng<input name="quantity" type="number" min="0.001" step="0.001" required placeholder="1" /></label><label>Đơn vị<input name="unit" placeholder="cái, bộ…" required maxLength={50} /></label><label className="span-2">Mô tả thêm <span>(không bắt buộc)</span><textarea name="description" rows={3} placeholder="Thông tin ngắn từ dòng hàng hóa" /></label></div>
            {itemError && <p className="notice notice-error" role="alert">{itemError}</p>}
            <button className="button button-primary" type="submit" disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu dòng hàng hóa'}</button>
          </form>}
        </article>)}
      </div>
    </section>
  </div>
}
