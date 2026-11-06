'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

import { loadResource, readResource, writeResource } from '../../../lib/api/resource-cache'
import { canCreateTender, useWorkspaceRole } from '../../organizations/workspace-permissions'
import {
  listTenders,
  type ProcurementStage,
  type Tender,
  type TenderPage,
} from '../api'

const stageLabels: Record<ProcurementStage, string> = {
  RFQ: 'RFQ · Yêu cầu báo giá',
  FORMAL_TENDER: 'E-HSMT · Hồ sơ mời thầu',
  INTERNAL: 'Nội bộ',
}

const stageTabs: ReadonlyArray<{ value: 'ALL' | ProcurementStage; label: string }> = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'RFQ', label: 'RFQ' },
  { value: 'FORMAL_TENDER', label: 'E-HSMT' },
  { value: 'INTERNAL', label: 'Nội bộ' },
]

function normalizeResponse(result: Tender[] | TenderPage): TenderPage {
  if (Array.isArray(result)) {
    return { items: result, nextCursor: null, total: result.length }
  }
  return {
    items: result.items ?? [],
    nextCursor: result.nextCursor ?? null,
    total: typeof result.total === 'number' ? result.total : (result.items?.length ?? 0),
  }
}

export function TenderList({ slug }: { slug: string }) {
  const role = useWorkspaceRole()
  const key = `tenders:${slug}`
  const [items, setItems] = useState<Tender[] | undefined>(() => readResource(key))
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [totalCount, setTotalCount] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  const [stageFilter, setStageFilter] = useState<'ALL' | ProcurementStage>('ALL')
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  useEffect(() => {
    let active = true
    loadResource(key, async () => {
      const response = await listTenders(slug)
      const normalized = normalizeResponse(response)
      if (active) {
        setNextCursor(normalized.nextCursor)
        setTotalCount(normalized.total)
      }
      return normalized.items
    })
      .then((result) => {
        if (active) setItems(result)
      })
      .catch((cause: Error) => {
        if (active) setError(cause.message)
      })
    return () => {
      active = false
    }
  }, [key, slug])

  async function refresh() {
    if (refreshing) return
    setRefreshing(true)
    setError('')
    try {
      const trimmed = query.trim()
      const hasRemoteFilter = Boolean(trimmed || stageFilter !== 'ALL')
      const response = hasRemoteFilter
        ? await listTenders(slug, { q: trimmed || undefined, stage: stageFilter })
        : await listTenders(slug)
      const normalized = normalizeResponse(response)
      if (!hasRemoteFilter) {
        writeResource(key, normalized.items)
      }
      setItems(normalized.items)
      setNextCursor(normalized.nextCursor)
      setTotalCount(normalized.total)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không làm mới được danh sách hồ sơ.')
    } finally {
      setRefreshing(false)
    }
  }

  async function loadMore() {
    if (!nextCursor || loadingMore || !items) return
    setLoadingMore(true)
    setError('')
    try {
      const response = await listTenders(slug, {
        q: query.trim() || undefined,
        stage: stageFilter,
        cursor: nextCursor,
      })
      const normalized = normalizeResponse(response)
      const merged = [
        ...items,
        ...normalized.items.filter((entry) => !items.some((existing) => existing.id === entry.id)),
      ]
      setItems(merged)
      setNextCursor(normalized.nextCursor)
      setTotalCount(normalized.total)
      if (!query.trim() && stageFilter === 'ALL') {
        writeResource(key, merged)
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không tải thêm được hồ sơ.')
    } finally {
      setLoadingMore(false)
    }
  }

  const visibleItems = useMemo(() => {
    if (!items) return []
    const needle = query.trim().toLowerCase()
    return items.filter((item) => {
      if (stageFilter !== 'ALL' && item.procurementStage !== stageFilter) return false
      if (!needle) return true
      const inTitle = item.title.toLowerCase().includes(needle)
      const inRef = (item.reference ?? '').toLowerCase().includes(needle)
      return inTitle || inRef
    })
  }, [items, query, stageFilter])

  const hasFilters = Boolean(query.trim() || stageFilter !== 'ALL')
  const isLoading = !items || refreshing

  return (
    <section className="surface tender-list-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Danh sách hồ sơ</p>
          <h2>Hồ sơ mua sắm</h2>
          <p className="muted">
            Quản lý RFQ, E-HSMT và hồ sơ nội bộ theo lot và dòng hàng hóa.
          </p>
        </div>
        <div className="tender-list-actions">
          <button
            className={refreshing ? 'tender-icon-button is-spinning' : 'tender-icon-button'}
            type="button"
            disabled={isLoading}
            onClick={refresh}
            aria-label="Làm mới"
            title="Làm mới danh sách hồ sơ"
          >
            <svg
              viewBox="0 0 24 24"
              width="17"
              height="17"
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
          {canCreateTender(role) && (
            <Link className="button button-primary" href={`/${slug}/tenders/new`}>
              Tạo hồ sơ
            </Link>
          )}
        </div>
      </div>

      {items && items.length > 0 && (
        <div className="tender-toolbar" role="search" aria-label="Tìm kiếm và lọc hồ sơ">
          <label className="tender-search-box">
            <span className="sr-only">Tìm theo tên hoặc mã tham chiếu</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm theo tên hồ sơ hoặc mã tham chiếu…"
              aria-label="Tìm kiếm hồ sơ"
            />
          </label>
          <div className="tender-stage-tabs" role="group" aria-label="Lọc theo loại hồ sơ">
            {stageTabs.map((tab) => (
              <button
                key={tab.value}
                type="button"
                className={stageFilter === tab.value ? 'tender-filter-chip is-active' : 'tender-filter-chip'}
                aria-pressed={stageFilter === tab.value}
                onClick={() => setStageFilter(tab.value)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && <p className="notice notice-error" role="alert">{error}</p>}

      {isLoading ? (
        <div className="tender-skeleton-list" aria-label="Đang tải hồ sơ thầu" aria-busy="true">
          <i />
          <i />
          <i />
          <i />
        </div>
      ) : items.length === 0 ? (
        <p className="muted empty-state">
          {canCreateTender(role)
            ? 'Chưa có hồ sơ. Tạo RFQ, E-HSMT hoặc hồ sơ nội bộ đầu tiên.'
            : 'Chưa có hồ sơ thầu để xem trong tổ chức này.'}
        </p>
      ) : visibleItems.length === 0 ? (
        <div className="tender-empty-filter">
          <p className="muted">Không tìm thấy hồ sơ khớp bộ lọc hiện tại.</p>
          {hasFilters && (
            <button
              type="button"
              className="tender-text-button"
              onClick={() => {
                setQuery('')
                setStageFilter('ALL')
              }}
            >
              Xóa bộ lọc
            </button>
          )}
        </div>
      ) : (
        <ul className="organization-list tender-cards-list">
          {visibleItems.map((item) => {
            const lotsCount = item._count?.lots ?? 0
            const itemsCount = item._count?.items
            return (
              <li key={item.id}>
                <Link href={`/${slug}/tenders/${item.id}`} className="tender-list-card">
                  <div className="tender-list-card-main">
                    <strong>{item.title}</strong>
                    <small className="tender-list-card-meta">
                      {item.reference ? `Mã: ${item.reference}` : 'Chưa có mã tham chiếu'}
                      {' · '}
                      {stageLabels[item.procurementStage] ?? item.procurementStage}
                    </small>
                  </div>
                  <span className="tender-list-card-counts">
                    {item.procurementStage} · {lotsCount} lot
                    {typeof itemsCount === 'number' ? ` · ${itemsCount} mục` : ''} →
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      {nextCursor && (
        <div className="tender-pagination-bar">
          <span className="muted">
            Đang hiển thị {visibleItems.length}
            {typeof totalCount === 'number' ? ` / ${totalCount}` : ''} hồ sơ
          </span>
          <button
            type="button"
            className="button button-secondary"
            disabled={loadingMore}
            onClick={loadMore}
          >
            {loadingMore ? 'Đang tải thêm…' : 'Tải thêm hồ sơ'}
          </button>
        </div>
      )}
    </section>
  )
}
