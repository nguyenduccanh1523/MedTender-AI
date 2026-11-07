'use client'

import Link from 'next/link'
import { useEffect, useState, type FormEvent } from 'react'

import { ConfirmDialog } from '../../../components/ui/confirm-dialog'
import { loadResource, readResource, writeResource } from '../../../lib/api/resource-cache'
import { roleLabels } from '../../organizations/roles'
import {
  canCreateTender,
  canViewTenderAudits,
  useWorkspaceRole,
} from '../../organizations/workspace-permissions'
import {
  createTenderItem,
  createTenderLot,
  deleteTender,
  deleteTenderItem,
  deleteTenderLot,
  getTender,
  listTenderAudits,
  updateTender,
  updateTenderItem,
  updateTenderLot,
  type ProcurementStage,
  type Tender,
  type TenderAuditLog,
  type TenderAuditPage,
  type TenderDetail,
  type TenderItem,
  type TenderLot,
} from '../api'

const stageLabels: Record<ProcurementStage, string> = {
  RFQ: 'RFQ · Yêu cầu báo giá',
  FORMAL_TENDER: 'E-HSMT · Hồ sơ mời thầu',
  INTERNAL: 'Hồ sơ nội bộ',
}

function message(cause: unknown) {
  return cause instanceof Error ? cause.message : 'Không lưu được thông tin. Vui lòng thử lại.'
}

function formatQuantity(raw: string | number) {
  const str = String(raw).trim()
  if (!str.includes('.')) return str
  return str.replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.0+$/, '')
}

function formatAuditTime(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function EditIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="15"
      height="15"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="15"
      height="15"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <line x1="10" x2="10" y1="11" y2="17" />
      <line x1="14" x2="14" y1="11" y2="17" />
    </svg>
  )
}

type DetailTab = 'structure' | 'audits'
type AuditActionFilter = 'ALL' | 'TENDER' | 'LOT' | 'ITEM'

const auditFilterLabels: Record<AuditActionFilter, string> = {
  ALL: 'Tất cả',
  TENDER: 'Hồ sơ',
  LOT: 'Lot',
  ITEM: 'Hàng hóa',
}

function normalizeAuditResponse(
  response: TenderAuditPage | TenderAuditLog[] | undefined,
): { items: TenderAuditLog[]; nextCursor: string | null; total: number } {
  if (!response) return { items: [], nextCursor: null, total: 0 }
  if (Array.isArray(response)) {
    return { items: response, nextCursor: null, total: response.length }
  }
  return {
    items: response.items ?? [],
    nextCursor: response.nextCursor ?? null,
    total: typeof response.total === 'number' ? response.total : (response.items?.length ?? 0),
  }
}

export function TenderDetailView({
  slug,
  id,
  onDeleted,
}: {
  slug: string
  id: string
  onDeleted?: () => void
}) {
  const role = useWorkspaceRole()
  const canWrite = canCreateTender(role)
  const canSeeAudits = canViewTenderAudits(role)
  const key = `tender:${slug}:${id}`

  const [tender, setTender] = useState<TenderDetail | undefined>(() => readResource(key))
  const [loadError, setLoadError] = useState('')
  const [tenderError, setTenderError] = useState('')
  const [lotError, setLotError] = useState('')
  const [itemError, setItemError] = useState('')

  const [activeTab, setActiveTab] = useState<DetailTab>('structure')
  const [editingTender, setEditingTender] = useState(false)
  const [lotFormOpen, setLotFormOpen] = useState(false)
  const [editingLotId, setEditingLotId] = useState<string | null>(null)
  const [itemFormFor, setItemFormFor] = useState<string | null>(null)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [deleted, setDeleted] = useState(false)
  const [confirmTarget, setConfirmTarget] = useState<
    | { kind: 'tender' }
    | { kind: 'lot'; lot: TenderLot }
    | { kind: 'item'; lotId: string; item: TenderItem }
    | null
  >(null)

  const [audits, setAudits] = useState<TenderAuditLog[] | undefined>(undefined)
  const [auditsLoading, setAuditsLoading] = useState(false)
  const [auditsError, setAuditsError] = useState('')
  const [auditLimit, setAuditLimit] = useState<number>(10)
  const [auditActionFilter, setAuditActionFilter] = useState<AuditActionFilter>('ALL')
  const [auditPage, setAuditPage] = useState<number>(1)
  const [auditNextCursor, setAuditNextCursor] = useState<string | null>(null)
  const [auditTotal, setAuditTotal] = useState<number>(0)

  useEffect(() => {
    let active = true
    loadResource(key, () => getTender(slug, id))
      .then((result) => {
        if (active) setTender(result)
      })
      .catch((cause: unknown) => {
        if (active) setLoadError(message(cause))
      })
    return () => {
      active = false
    }
  }, [id, key, slug])

  function syncListCache(nextTender: TenderDetail) {
    const listKey = `tenders:${slug}`
    const list = readResource<Tender[]>(listKey)
    if (!list) return
    const itemsTotal = nextTender.lots.reduce((sum, lot) => sum + lot.items.length, 0)
    writeResource(
      listKey,
      list.map((entry) =>
        entry.id === id
          ? {
            ...entry,
            title: nextTender.title,
            reference: nextTender.reference,
            procurementStage: nextTender.procurementStage,
            _count: { lots: nextTender.lots.length, items: itemsTotal },
          }
          : entry,
      ),
    )
  }

  async function fetchAudits(options?: {
    limit?: number
    action?: AuditActionFilter
    cursor?: string
    append?: boolean
  }) {
    if (!canSeeAudits || typeof listTenderAudits !== 'function') return
    const nextLimit = options?.limit ?? auditLimit
    const nextAction = options?.action ?? auditActionFilter
    setAuditsLoading(true)
    setAuditsError('')
    try {
      const raw = await listTenderAudits(slug, id, {
        limit: nextLimit,
        action: nextAction,
        cursor: options?.cursor,
        pageMode: 'cursor',
      })
      const normalized = normalizeAuditResponse(raw)
      if (options?.append) {
        setAudits((prev) => {
          const current = prev ?? []
          const seen = new Set(current.map((item) => item.id))
          const merged = [...current]
          for (const item of normalized.items) {
            if (!seen.has(item.id)) merged.push(item)
          }
          return merged
        })
      } else {
        setAudits(normalized.items)
        setAuditPage(1)
      }
      setAuditNextCursor(normalized.nextCursor)
      setAuditTotal(normalized.total)
    } catch (cause) {
      setAuditsError(message(cause))
    } finally {
      setAuditsLoading(false)
    }
  }

  function selectTab(next: DetailTab) {
    setActiveTab(next)
    if (next === 'audits' && !audits && canSeeAudits) {
      void fetchAudits()
    }
  }

  async function refreshAuditsIfOpen() {
    if (!canSeeAudits || activeTab !== 'audits' || typeof listTenderAudits !== 'function') return
    try {
      const raw = await listTenderAudits(slug, id, {
        limit: auditLimit,
        action: auditActionFilter,
        pageMode: 'cursor',
      })
      const normalized = normalizeAuditResponse(raw)
      setAudits(normalized.items)
      setAuditNextCursor(normalized.nextCursor)
      setAuditTotal(normalized.total)
      setAuditPage(1)
    } catch {
      /* optional audit refresh */
    }
  }

  async function changeAuditLimit(nextLimit: number) {
    setAuditLimit(nextLimit)
    setAuditPage(1)
    await fetchAudits({ limit: nextLimit, action: auditActionFilter })
  }

  async function changeAuditAction(nextAction: AuditActionFilter) {
    setAuditActionFilter(nextAction)
    setAuditPage(1)
    await fetchAudits({ limit: auditLimit, action: nextAction })
  }

  async function goToNextAuditPage() {
    if (!audits) return
    const nextPage = auditPage + 1
    const neededCount = nextPage * auditLimit
    if (audits.length < neededCount && auditNextCursor) {
      await fetchAudits({
        limit: auditLimit,
        action: auditActionFilter,
        cursor: auditNextCursor,
        append: true,
      })
    }
    setAuditPage(nextPage)
  }

  async function saveTender(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canWrite || !tender || busy || typeof updateTender !== 'function') return
    const fields = new FormData(event.currentTarget)
    setBusy(true)
    setTenderError('')
    try {
      const updated = await updateTender(slug, id, {
        title: String(fields.get('title') ?? '').trim(),
        reference: String(fields.get('reference') ?? '').trim() || null,
        procurementStage: String(fields.get('stage') ?? tender.procurementStage) as ProcurementStage,
      })
      const next: TenderDetail = {
        ...tender,
        title: updated.title,
        reference: updated.reference,
        procurementStage: updated.procurementStage,
      }
      setTender(next)
      writeResource(key, next)
      syncListCache(next)
      setEditingTender(false)
      void refreshAuditsIfOpen()
    } catch (cause) {
      setTenderError(message(cause))
    } finally {
      setBusy(false)
    }
  }

  async function executeRemoveCurrentTender() {
    if (!canWrite || !tender || busy || typeof deleteTender !== 'function') return
    setBusy(true)
    setTenderError('')
    try {
      await deleteTender(slug, id)
      const listKey = `tenders:${slug}`
      const list = readResource<Tender[]>(listKey)
      if (list) writeResource(listKey, list.filter((entry) => entry.id !== id))
      setConfirmTarget(null)
      setDeleted(true)
      setBusy(false)
      if (onDeleted) onDeleted()
    } catch (cause) {
      setTenderError(message(cause))
      setBusy(false)
    }
  }

  function removeCurrentTender() {
    if (!canWrite || !tender || busy || typeof deleteTender !== 'function') return
    setConfirmTarget({ kind: 'tender' })
  }

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
      const next: TenderDetail = {
        ...tender,
        lots: [...tender.lots, { ...created, items: [] }].sort((a, b) =>
          a.code.localeCompare(b.code, 'vi', { numeric: true }),
        ),
      }
      setTender(next)
      writeResource(key, next)
      syncListCache(next)
      form.reset()
      setLotFormOpen(false)
      void refreshAuditsIfOpen()
    } catch (cause) {
      setLotError(message(cause))
    } finally {
      setBusy(false)
    }
  }

  async function saveLot(event: FormEvent<HTMLFormElement>, lot: TenderLot) {
    event.preventDefault()
    if (!canWrite || !tender || busy || typeof updateTenderLot !== 'function') return
    const fields = new FormData(event.currentTarget)
    setBusy(true)
    setLotError('')
    try {
      const updated = await updateTenderLot(slug, id, lot.id, {
        code: String(fields.get('code') ?? '').trim(),
        name: String(fields.get('name') ?? '').trim(),
      })
      const next: TenderDetail = {
        ...tender,
        lots: tender.lots
          .map((entry) =>
            entry.id === lot.id ? { ...entry, code: updated.code, name: updated.name } : entry,
          )
          .sort((a, b) => a.code.localeCompare(b.code, 'vi', { numeric: true })),
      }
      setTender(next)
      writeResource(key, next)
      setEditingLotId(null)
      void refreshAuditsIfOpen()
    } catch (cause) {
      setLotError(message(cause))
    } finally {
      setBusy(false)
    }
  }

  async function executeRemoveLot(lot: TenderLot) {
    if (!canWrite || !tender || busy || typeof deleteTenderLot !== 'function') return
    setBusy(true)
    setLotError('')
    try {
      await deleteTenderLot(slug, id, lot.id)
      const next: TenderDetail = {
        ...tender,
        lots: tender.lots.filter((entry) => entry.id !== lot.id),
      }
      setTender(next)
      writeResource(key, next)
      syncListCache(next)
      setConfirmTarget(null)
      void refreshAuditsIfOpen()
    } catch (cause) {
      setLotError(message(cause))
    } finally {
      setBusy(false)
    }
  }

  function removeLot(lot: TenderLot) {
    if (!canWrite || !tender || busy || typeof deleteTenderLot !== 'function') return
    setConfirmTarget({ kind: 'lot', lot })
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
      const next: TenderDetail = {
        ...tender,
        lots: tender.lots.map((lot) =>
          lot.id === lotId
            ? {
              ...lot,
              items: [...lot.items, created].sort((a, b) =>
                a.itemNo.localeCompare(b.itemNo, 'vi', { numeric: true }),
              ),
            }
            : lot,
        ),
      }
      setTender(next)
      writeResource(key, next)
      syncListCache(next)
      form.reset()
      void refreshAuditsIfOpen()
    } catch (cause) {
      setItemError(message(cause))
    } finally {
      setBusy(false)
    }
  }

  async function saveItem(event: FormEvent<HTMLFormElement>, lotId: string, item: TenderItem) {
    event.preventDefault()
    if (!canWrite || !tender || busy || typeof updateTenderItem !== 'function') return
    const fields = new FormData(event.currentTarget)
    setBusy(true)
    setItemError('')
    try {
      const updated = await updateTenderItem(slug, id, lotId, item.id, {
        itemNo: String(fields.get('itemNo') ?? '').trim(),
        name: String(fields.get('name') ?? '').trim(),
        quantity: Number(fields.get('quantity')),
        unit: String(fields.get('unit') ?? '').trim(),
        description: String(fields.get('description') ?? '').trim() || null,
      })
      const next: TenderDetail = {
        ...tender,
        lots: tender.lots.map((lot) =>
          lot.id === lotId
            ? {
              ...lot,
              items: lot.items
                .map((entry) => (entry.id === item.id ? updated : entry))
                .sort((a, b) => a.itemNo.localeCompare(b.itemNo, 'vi', { numeric: true })),
            }
            : lot,
        ),
      }
      setTender(next)
      writeResource(key, next)
      setEditingItemId(null)
      void refreshAuditsIfOpen()
    } catch (cause) {
      setItemError(message(cause))
    } finally {
      setBusy(false)
    }
  }

  async function executeRemoveItem(lotId: string, item: TenderItem) {
    if (!canWrite || !tender || busy || typeof deleteTenderItem !== 'function') return
    setBusy(true)
    setItemError('')
    try {
      await deleteTenderItem(slug, id, lotId, item.id)
      const next: TenderDetail = {
        ...tender,
        lots: tender.lots.map((lot) =>
          lot.id === lotId
            ? { ...lot, items: lot.items.filter((entry) => entry.id !== item.id) }
            : lot,
        ),
      }
      setTender(next)
      writeResource(key, next)
      syncListCache(next)
      setConfirmTarget(null)
      void refreshAuditsIfOpen()
    } catch (cause) {
      setItemError(message(cause))
    } finally {
      setBusy(false)
    }
  }

  function removeItem(lotId: string, item: TenderItem) {
    if (!canWrite || !tender || busy || typeof deleteTenderItem !== 'function') return
    setConfirmTarget({ kind: 'item', lotId, item })
  }

  if (deleted) {
    return (
      <section className="surface empty-state" role="status">
        <h2>Đã xóa hồ sơ thầu</h2>
        <p className="muted">Hồ sơ và các lot/dòng hàng hóa liên quan đã được xóa khỏi tổ chức.</p>
        <Link className="button button-primary" href={`/${slug}/tenders`}>
          Về danh sách hồ sơ
        </Link>
      </section>
    )
  }
  if (loadError && !tender) return <p className="notice notice-error" role="alert">{loadError}</p>
  if (!tender) {
    return (
      <div className="tender-detail-skeleton" aria-label="Đang tải hồ sơ thầu" aria-busy="true">
        <div className="surface tender-skeleton-head">
          <div className="skeleton-line skeleton-kicker" />
          <div className="skeleton-line skeleton-title" />
        </div>
        <div className="tender-skeleton-list">
          <i />
          <i />
          <i />
        </div>
      </div>
    )
  }

  const itemCount = tender.lots.reduce((sum, lot) => sum + lot.items.length, 0)
  const filteredAudits = (audits ?? []).filter((entry) =>
    auditActionFilter === 'ALL' ? true : entry.action.startsWith(`${auditActionFilter}_`),
  )
  const effectiveAuditTotal =
    auditActionFilter === 'ALL' ? Math.max(auditTotal, filteredAudits.length) : filteredAudits.length
  const totalAuditPages = Math.max(1, Math.ceil(effectiveAuditTotal / auditLimit))
  const safeAuditPage = Math.min(auditPage, totalAuditPages)
  const auditStartIndex = (safeAuditPage - 1) * auditLimit
  const visibleAudits = filteredAudits.slice(auditStartIndex, auditStartIndex + auditLimit)
  const canGoNextAuditPage = safeAuditPage < totalAuditPages || Boolean(auditNextCursor)

  return (
    <div className="tender-detail-page">
      <div className="tender-breadcrumb-bar">
        <Link className="tender-back-link" href={`/${slug}/tenders`}>
          ← Danh sách hồ sơ thầu
        </Link>
        <div className="tender-inline-metrics" aria-label="Tóm tắt cấu trúc hồ sơ">
          <span>
            <strong>{tender.lots.length}</strong>/20 Lot
          </span>
          <i>·</i>
          <span>
            <strong>{itemCount}</strong>/100 Dòng hàng hóa
          </span>
        </div>
      </div>

      <section className="surface tender-detail-head">
        {editingTender ? (
          <form className="tender-edit-head-form" onSubmit={saveTender} aria-label="Chỉnh sửa hồ sơ thầu">
            <div className="tender-entry-heading">
              <strong>Chỉnh sửa thông tin hồ sơ</strong>
              <button
                type="button"
                className="tender-text-button"
                onClick={() => {
                  setEditingTender(false)
                  setTenderError('')
                }}
              >
                Hủy
              </button>
            </div>
            <div className="tender-form-grid">
              <label className="span-2">
                Tên hồ sơ
                <input name="title" defaultValue={tender.title} required maxLength={200} />
              </label>
              <label>
                Mã tham chiếu
                <input name="reference" defaultValue={tender.reference ?? ''} maxLength={200} />
              </label>
              <label>
                Loại hồ sơ
                <select name="stage" defaultValue={tender.procurementStage}>
                  <option value="RFQ">RFQ — Yêu cầu báo giá</option>
                  <option value="FORMAL_TENDER">E-HSMT — Hồ sơ mời thầu</option>
                  <option value="INTERNAL">Nội bộ</option>
                </select>
              </label>
            </div>
            {tenderError && <p className="notice notice-error" role="alert">{tenderError}</p>}
            <div className="tender-inline-actions">
              <button className="button button-primary" type="submit" disabled={busy}>
                {busy ? 'Đang lưu…' : 'Lưu thay đổi'}
              </button>
            </div>
          </form>
        ) : (
          <div className="tender-head-compact">
            <div className="tender-head-copy">
              <div className="tender-head-badges">
                <span className="tender-stage-badge">{stageLabels[tender.procurementStage]}</span>
                <span className="tender-ref-chip">
                  {tender.reference ? `Mã: ${tender.reference}` : 'Chưa có mã tham chiếu'}
                </span>
              </div>
              <h1>{tender.title}</h1>
            </div>
            {canWrite && (
              <div className="tender-head-actions">
                <button
                  type="button"
                  className="tender-icon-button"
                  aria-label="Sửa hồ sơ"
                  title="Chỉnh sửa thông tin hồ sơ"
                  onClick={() => {
                    setEditingTender(true)
                    setTenderError('')
                  }}
                >
                  <EditIcon />
                </button>
                <button
                  type="button"
                  className="tender-icon-button is-danger"
                  aria-label="Xóa hồ sơ"
                  title="Xóa hồ sơ thầu"
                  disabled={busy}
                  onClick={removeCurrentTender}
                >
                  <TrashIcon />
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {tenderError && !editingTender && <p className="notice notice-error" role="alert">{tenderError}</p>}

      <div className="tender-subtabs-bar">
        <div className="tender-subtabs" role="tablist" aria-label="Chế độ xem chi tiết hồ sơ">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'structure'}
            className={activeTab === 'structure' ? 'tender-subtab is-active' : 'tender-subtab'}
            onClick={() => selectTab('structure')}
          >
            Lot & dòng hàng hóa
            <span className="tender-subtab-badge">{itemCount}</span>
          </button>
          {canSeeAudits && (
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'audits'}
              className={activeTab === 'audits' ? 'tender-subtab is-active' : 'tender-subtab'}
              onClick={() => selectTab('audits')}
            >
              Nhật ký thay đổi
              {audits && <span className="tender-subtab-badge">{effectiveAuditTotal}</span>}
            </button>
          )}
        </div>
        {activeTab === 'structure' && canWrite && !lotFormOpen && (
          <button
            className="button button-primary tender-add-lot-btn"
            type="button"
            onClick={() => {
              setLotFormOpen(true)
              setLotError('')
            }}
          >
            + Thêm lot
          </button>
        )}
      </div>

      {activeTab === 'audits' && canSeeAudits ? (
        <section className="surface tender-audit-panel" aria-label="Nhật ký thay đổi hồ sơ">
          <div className="tender-entry-heading">
            <div>
              <strong>Nhật ký kiểm toán (Audit log)</strong>
              <p className="muted">
                Chỉ hiển thị cho OWNER và ADMIN để kiểm soát lịch sử tạo, sửa và xóa trên hồ sơ thầu.
              </p>
            </div>
            <button
              type="button"
              className={auditsLoading ? 'tender-icon-button is-spinning' : 'tender-icon-button'}
              onClick={() => void fetchAudits({ limit: auditLimit, action: auditActionFilter })}
              aria-label="Làm mới nhật ký"
              title="Làm mới nhật ký"
            >
              <svg
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
                <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                <path d="M16 16h5v5" />
              </svg>
            </button>
          </div>

          <div className="tender-audit-toolbar" role="region" aria-label="Bộ lọc và giới hạn nhật ký">
            <div className="tender-stage-tabs" role="group" aria-label="Phạm vi nhật ký">
              {(['ALL', 'TENDER', 'LOT', 'ITEM'] as AuditActionFilter[]).map((scope) => (
                <button
                  key={scope}
                  type="button"
                  className={
                    auditActionFilter === scope
                      ? 'tender-filter-chip is-active'
                      : 'tender-filter-chip'
                  }
                  onClick={() => void changeAuditAction(scope)}
                >
                  {auditFilterLabels[scope]}
                </button>
              ))}
            </div>

            <label className="tender-audit-limit-control">
              <span>Hiển thị</span>
              <select
                aria-label="Số dòng nhật ký mỗi trang"
                value={String(auditLimit)}
                onChange={(event) => void changeAuditLimit(Number(event.target.value))}
              >
                <option value="5">5 dòng / trang</option>
                <option value="10">10 dòng / trang</option>
                <option value="20">20 dòng / trang</option>
                <option value="50">50 dòng / trang</option>
              </select>
            </label>
          </div>

          {auditsLoading && (
            <div className="tender-skeleton-list" aria-label="Đang tải nhật ký" aria-busy="true">
              <i />
              <i />
              <i />
            </div>
          )}
          {auditsError && <p className="notice notice-error" role="alert">{auditsError}</p>}
          {!auditsLoading && audits && visibleAudits.length === 0 && (
            <p className="muted">Chưa có bản ghi kiểm toán phù hợp với bộ lọc này.</p>
          )}
          {!auditsLoading && audits && visibleAudits.length > 0 && (
            <>
              <ul className="tender-audit-list">
                {visibleAudits.map((entry) => (
                  <li key={entry.id} className="tender-audit-row">
                    <div>
                      <strong>{entry.summary}</strong>
                      <small>
                        {entry.actorName} · {roleLabels[entry.actorRole] ?? entry.actorRole} ·{' '}
                        <span className="tender-audit-action">{entry.action}</span>
                      </small>
                    </div>
                    <time dateTime={entry.createdAt}>{formatAuditTime(entry.createdAt)}</time>
                  </li>
                ))}
              </ul>

              <div className="tender-audit-pagination" aria-label="Phân trang nhật ký">
                <span className="muted">
                  Hiển thị{' '}
                  <strong>
                    {auditStartIndex + 1}–{auditStartIndex + visibleAudits.length}
                  </strong>{' '}
                  trên tổng <strong>{effectiveAuditTotal}</strong> bản ghi
                </span>
                <div className="tender-audit-page-controls">
                  <button
                    type="button"
                    className="tender-chip-button"
                    disabled={safeAuditPage <= 1 || auditsLoading}
                    onClick={() => setAuditPage((prev) => Math.max(1, prev - 1))}
                  >
                    ← Trang trước
                  </button>
                  <span className="tender-audit-page-indicator">
                    Trang {safeAuditPage} / {totalAuditPages}
                  </span>
                  <button
                    type="button"
                    className="tender-chip-button"
                    disabled={!canGoNextAuditPage || auditsLoading}
                    onClick={() => void goToNextAuditPage()}
                  >
                    Trang sau →
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      ) : (
        <section className="tender-structure" aria-label="Cấu trúc lot và dòng hàng hóa">
          {canWrite && lotFormOpen && (
            <form className="tender-entry-form" onSubmit={addLot} aria-label="Tạo lot">
              <div className="tender-entry-heading">
                <div>
                  <strong>Thêm lot mới</strong>
                  <p className="muted">Một lot có thể chứa nhiều dòng hàng hóa.</p>
                </div>
                <button
                  type="button"
                  className="tender-text-button"
                  onClick={() => {
                    setLotFormOpen(false)
                    setLotError('')
                  }}
                >
                  Đóng
                </button>
              </div>
              <div className="tender-form-grid">
                <label>
                  Mã lot
                  <input name="code" placeholder="Ví dụ: LOT-01" required maxLength={50} />
                </label>
                <label>
                  Tên lot
                  <input name="name" placeholder="Ví dụ: Thiết bị theo dõi" required maxLength={200} />
                </label>
              </div>
              {lotError && <p className="notice notice-error" role="alert">{lotError}</p>}
              <button className="button button-primary" type="submit" disabled={busy}>
                {busy ? 'Đang lưu…' : 'Lưu lot'}
              </button>
            </form>
          )}

          {lotError && !lotFormOpen && !editingLotId && (
            <p className="notice notice-error" role="alert">{lotError}</p>
          )}

          <div className="tender-lots">
            {tender.lots.length === 0 && (
              <div className="tender-empty-lot">
                <strong>Chưa có lot</strong>
                <p>Hãy thêm lot đầu tiên trước khi nhập dòng hàng hóa.</p>
              </div>
            )}

            {tender.lots.map((lot) => (
              <article className="tender-lot-card" key={lot.id}>
                {editingLotId === lot.id ? (
                  <form
                    className="tender-entry-form tender-lot-edit-form"
                    onSubmit={(event) => saveLot(event, lot)}
                    aria-label={`Sửa lot ${lot.code}`}
                  >
                    <div className="tender-entry-heading">
                      <strong>Chỉnh sửa {lot.code}</strong>
                      <button
                        type="button"
                        className="tender-text-button"
                        onClick={() => {
                          setEditingLotId(null)
                          setLotError('')
                        }}
                      >
                        Hủy
                      </button>
                    </div>
                    <div className="tender-form-grid">
                      <label>
                        Mã lot
                        <input name="code" defaultValue={lot.code} required maxLength={50} />
                      </label>
                      <label>
                        Tên lot
                        <input name="name" defaultValue={lot.name} required maxLength={200} />
                      </label>
                    </div>
                    {lotError && <p className="notice notice-error" role="alert">{lotError}</p>}
                    <div className="tender-inline-actions">
                      <button className="button button-primary" type="submit" disabled={busy}>
                        {busy ? 'Đang lưu…' : 'Lưu lot'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="tender-lot-heading">
                    <div className="tender-lot-title-wrap">
                      <span className="tender-lot-code">{lot.code}</span>
                      <h3>{lot.name}</h3>
                      <span className="tender-lot-count">{lot.items.length} mục</span>
                    </div>
                    {canWrite && (
                      <div className="tender-lot-actions">
                        <button
                          type="button"
                          className="tender-icon-button"
                          aria-label={`Sửa lot ${lot.code}`}
                          title={`Sửa lot ${lot.code}`}
                          onClick={() => {
                            setEditingLotId(lot.id)
                            setLotError('')
                          }}
                        >
                          <EditIcon />
                        </button>
                        <button
                          type="button"
                          className="tender-icon-button is-danger"
                          aria-label={`Xóa lot ${lot.code}`}
                          title={`Xóa lot ${lot.code}`}
                          disabled={busy}
                          onClick={() => removeLot(lot)}
                        >
                          <TrashIcon />
                        </button>
                        {itemFormFor !== lot.id && (
                          <button
                            className="button button-secondary tender-add-item-btn"
                            type="button"
                            onClick={() => {
                              setItemFormFor(lot.id)
                              setEditingItemId(null)
                              setItemError('')
                            }}
                          >
                            + Thêm dòng hàng hóa
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {lot.items.length === 0 ? (
                  <p className="tender-empty-item">Chưa có dòng hàng hóa trong lot này.</p>
                ) : (
                  <div className="tender-items-list">
                    {lot.items.map((item) =>
                      editingItemId === item.id ? (
                        <form
                          key={item.id}
                          className="tender-entry-form tender-item-form"
                          onSubmit={(event) => saveItem(event, lot.id, item)}
                          aria-label={`Sửa dòng hàng hóa ${item.itemNo}`}
                        >
                          <div className="tender-entry-heading">
                            <strong>Chỉnh sửa dòng hàng hóa #{item.itemNo}</strong>
                            <button
                              type="button"
                              className="tender-text-button"
                              onClick={() => {
                                setEditingItemId(null)
                                setItemError('')
                              }}
                            >
                              Hủy
                            </button>
                          </div>
                          <div className="tender-form-grid tender-item-fields">
                            <label>
                              STT
                              <input name="itemNo" defaultValue={item.itemNo} required maxLength={50} />
                            </label>
                            <label>
                              Tên hàng hóa
                              <input name="name" defaultValue={item.name} required maxLength={200} />
                            </label>
                            <label>
                              Số lượng
                              <input
                                name="quantity"
                                type="number"
                                min="0.001"
                                step="0.001"
                                required
                                defaultValue={formatQuantity(item.quantity)}
                              />
                            </label>
                            <label>
                              Đơn vị
                              <input name="unit" defaultValue={item.unit} required maxLength={50} />
                            </label>
                            <label className="span-2">
                              Mô tả thêm <span>(không bắt buộc)</span>
                              <textarea name="description" rows={2} defaultValue={item.description ?? ''} />
                            </label>
                          </div>
                          {itemError && <p className="notice notice-error" role="alert">{itemError}</p>}
                          <div className="tender-inline-actions">
                            <button className="button button-primary" type="submit" disabled={busy}>
                              {busy ? 'Đang lưu…' : 'Cập nhật dòng hàng hóa'}
                            </button>
                          </div>
                        </form>
                      ) : (
                        <div className="tender-item-row" key={item.id}>
                          <span className="tender-item-no">{item.itemNo}</span>
                          <div>
                            <strong>{item.name}</strong>
                            {item.description && <p>{item.description}</p>}
                          </div>
                          <div className="tender-item-meta">
                            <span className="tender-item-quantity">
                              {formatQuantity(item.quantity)} {item.unit}
                            </span>
                            {canWrite && (
                              <div className="tender-item-actions">
                                <button
                                  type="button"
                                  className="tender-icon-button is-sm"
                                  aria-label={`Sửa ${item.name}`}
                                  title={`Sửa ${item.name}`}
                                  onClick={() => {
                                    setEditingItemId(item.id)
                                    setItemFormFor(null)
                                    setItemError('')
                                  }}
                                >
                                  <EditIcon />
                                </button>
                                <button
                                  type="button"
                                  className="tender-icon-button is-sm is-danger"
                                  aria-label={`Xóa ${item.name}`}
                                  title={`Xóa ${item.name}`}
                                  disabled={busy}
                                  onClick={() => removeItem(lot.id, item)}
                                >
                                  <TrashIcon />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                )}

                {canWrite && itemFormFor === lot.id && (
                  <form
                    className="tender-entry-form tender-item-form"
                    onSubmit={(event) => addItem(event, lot.id)}
                    aria-label={`Thêm dòng hàng hóa vào ${lot.code}`}
                  >
                    <div className="tender-entry-heading">
                      <div>
                        <strong>Thêm dòng hàng hóa</strong>
                        <p className="muted">STT chỉ cần duy nhất trong lot này.</p>
                      </div>
                      <button
                        type="button"
                        className="tender-text-button"
                        onClick={() => {
                          setItemFormFor(null)
                          setItemError('')
                        }}
                      >
                        Đóng
                      </button>
                    </div>
                    <div className="tender-form-grid tender-item-fields">
                      <label>
                        STT
                        <input name="itemNo" placeholder="01" required maxLength={50} />
                      </label>
                      <label>
                        Tên hàng hóa
                        <input name="name" placeholder="Tên theo hồ sơ gốc" required maxLength={200} />
                      </label>
                      <label>
                        Số lượng
                        <input
                          name="quantity"
                          type="number"
                          min="0.001"
                          step="0.001"
                          required
                          placeholder="1"
                        />
                      </label>
                      <label>
                        Đơn vị
                        <input name="unit" placeholder="cái, bộ…" required maxLength={50} />
                      </label>
                      <label className="span-2">
                        Mô tả thêm <span>(không bắt buộc)</span>
                        <textarea
                          name="description"
                          rows={2}
                          placeholder="Thông tin ngắn từ dòng hàng hóa"
                        />
                      </label>
                    </div>
                    {itemError && <p className="notice notice-error" role="alert">{itemError}</p>}
                    <button className="button button-primary" type="submit" disabled={busy}>
                      {busy ? 'Đang lưu…' : 'Lưu dòng hàng hóa'}
                    </button>
                  </form>
                )}
              </article>
            ))}
          </div>
        </section>
      )}

      <ConfirmDialog
        open={Boolean(confirmTarget)}
        badge={
          confirmTarget?.kind === 'tender'
            ? tender.reference || 'HỒ SƠ THẦU'
            : confirmTarget?.kind === 'lot'
              ? confirmTarget.lot.code
              : confirmTarget?.kind === 'item'
                ? `STT #${confirmTarget.item.itemNo}`
                : undefined
        }
        title={
          confirmTarget?.kind === 'tender'
            ? `Xóa hồ sơ thầu "${tender.title}"?`
            : confirmTarget?.kind === 'lot'
              ? `Xóa lot ${confirmTarget.lot.code} (${confirmTarget.lot.name})?`
              : confirmTarget?.kind === 'item'
                ? `Xóa dòng hàng hóa "${confirmTarget.item.name}"?`
                : 'Xác nhận xóa'
        }
        description={
          confirmTarget?.kind === 'tender'
            ? 'Toàn bộ cấu trúc Lot, các dòng hàng hóa và lịch sử bên trong hồ sơ thầu này sẽ bị xóa vĩnh viễn.'
            : confirmTarget?.kind === 'lot'
              ? `Lot ${confirmTarget.lot.code} cùng ${confirmTarget.lot.items.length} dòng hàng hóa bên trong sẽ bị xóa khỏi hồ sơ thầu.`
              : confirmTarget?.kind === 'item'
                ? `Dòng hàng hóa #${confirmTarget.item.itemNo} (${formatQuantity(confirmTarget.item.quantity)} ${confirmTarget.item.unit}) sẽ bị xóa khỏi lot.`
                : ''
        }
        busy={busy}
        onCancel={() => setConfirmTarget(null)}
        onConfirm={() => {
          if (!confirmTarget) return
          if (confirmTarget.kind === 'tender') {
            void executeRemoveCurrentTender()
          } else if (confirmTarget.kind === 'lot') {
            void executeRemoveLot(confirmTarget.lot)
          } else {
            void executeRemoveItem(confirmTarget.lotId, confirmTarget.item)
          }
        }}
      />
    </div>
  )
}
