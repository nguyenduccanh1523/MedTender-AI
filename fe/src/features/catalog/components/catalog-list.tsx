'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState, type FormEvent } from 'react'

import { ApiError } from '../../../lib/api/client'
import { canManageCatalog, useWorkspaceRole } from '../../organizations/workspace-permissions'
import {
  createCatalogProduct,
  listCatalogProductsPage,
  type ProductSummary,
} from '../api'

const versionStatusLabels: Record<'DRAFT' | 'PUBLISHED' | 'SUPERSEDED', string> = {
  DRAFT: 'Bản nháp',
  PUBLISHED: 'Đã xuất bản',
  SUPERSEDED: 'Đã thay thế',
}

export function CatalogList({ slug }: { slug: string }) {
  const router = useRouter()
  const role = useWorkspaceRole()
  const canWrite = canManageCatalog(role)

  const [products, setProducts] = useState<ProductSummary[]>([])
  const [total, setTotal] = useState(0)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [searchInput, setSearchInput] = useState('')
  const [activeQuery, setActiveQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'ARCHIVED'>('ACTIVE')

  const [creating, setCreating] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [sku, setSku] = useState('')
  const [name, setName] = useState('')
  const [brand, setBrand] = useState('')
  const [manufacturer, setManufacturer] = useState('')
  const [category, setCategory] = useState('')
  const [modelCode, setModelCode] = useState('')
  const [notes, setNotes] = useState('')

  const loadFirstPage = useCallback(
    async (queryText: string, status: 'ALL' | 'ACTIVE' | 'ARCHIVED') => {
      setLoading(true)
      setError(null)
      try {
        const page = await listCatalogProductsPage(slug, {
          q: queryText || undefined,
          status,
        })
        setProducts(page.items)
        setTotal(page.total)
        setNextCursor(page.nextCursor)
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Không tải được danh mục sản phẩm.')
      } finally {
        setLoading(false)
      }
    },
    [slug],
  )

  useEffect(() => {
    let active = true
    listCatalogProductsPage(slug, {
      q: activeQuery || undefined,
      status: statusFilter,
    })
      .then((page) => {
        if (active) {
          setProducts(page.items)
          setTotal(page.total)
          setNextCursor(page.nextCursor)
          setError(null)
        }
      })
      .catch((err: unknown) => {
        if (active) {
          setError(err instanceof ApiError ? err.message : 'Không tải được danh mục sản phẩm.')
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [slug, activeQuery, statusFilter])

  async function handleLoadMore() {
    if (!nextCursor || loadingMore) return
    setLoadingMore(true)
    setError(null)
    try {
      const page = await listCatalogProductsPage(slug, {
        q: activeQuery || undefined,
        status: statusFilter,
        cursor: nextCursor,
      })
      setProducts((current) => [...current, ...page.items])
      setTotal(page.total)
      setNextCursor(page.nextCursor)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không tải thêm được danh sách sản phẩm.')
    } finally {
      setLoadingMore(false)
    }
  }

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setActiveQuery(searchInput.trim())
  }

  function resetSearch() {
    setSearchInput('')
    setActiveQuery('')
    setStatusFilter('ACTIVE')
  }

  async function handleCreateProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canWrite) return
    setSubmitting(true)
    setError(null)
    try {
      const created = await createCatalogProduct(slug, {
        sku: sku.trim(),
        name: name.trim(),
        brand: brand.trim(),
        manufacturer: manufacturer.trim() || undefined,
        category: category.trim() || undefined,
        modelCode: modelCode.trim() || sku.trim(),
        notes: notes.trim() || undefined,
      })
      setCreating(false)
      setSku('')
      setName('')
      setBrand('')
      setManufacturer('')
      setCategory('')
      setModelCode('')
      setNotes('')
      router.push(`/${slug}/catalog/${created.id}`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không tạo được sản phẩm catalog.')
    } finally {
      setSubmitting(false)
    }
  }

  const hasFilters = Boolean(activeQuery || statusFilter !== 'ACTIVE')

  return (
    <section className="tender-panel" aria-busy={loading}>
      <div className="tender-panel-head">
        <div>
          <p className="eyebrow">Danh mục chuẩn hóa kỹ thuật</p>
          <h2>Sản phẩm & Phiên bản thông số ({total})</h2>
          <p className="muted">
            Mỗi sản phẩm quản lý theo SKU duy nhất khi đang hoạt động và lưu lịch sử phiên bản bất biến để phục vụ đối
            chiếu hồ sơ thầu.
          </p>
        </div>
        <div className="tender-head-actions">
          <button
            className="button button-secondary button-icon"
            type="button"
            onClick={() => void loadFirstPage(activeQuery, statusFilter)}
            disabled={loading}
            aria-label="Làm mới catalog"
            title="Làm mới danh sách"
          >
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
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
          {canWrite && (
            <button
              className="button button-primary"
              type="button"
              onClick={() => setCreating((value) => !value)}
            >
              {creating ? 'Đóng biểu mẫu' : '+ Thêm sản phẩm'}
            </button>
          )}
        </div>
      </div>

      <form className="tender-filter-bar" onSubmit={handleSearchSubmit} role="search">
        <div className="tender-search-input">
          <input
            aria-label="Tìm sản phẩm catalog"
            placeholder="Tìm theo mã SKU, tên thiết bị, hãng hoặc nhóm thiết bị..."
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
          <button className="button button-secondary" type="submit" disabled={loading}>
            Tìm
          </button>
          {hasFilters && (
            <button
              className="button button-secondary"
              type="button"
              onClick={resetSearch}
              disabled={loading}
            >
              Xóa lọc
            </button>
          )}
        </div>
        <div className="tender-stage-filters" role="group" aria-label="Lọc theo trạng thái sản phẩm">
          {(
            [
              ['ACTIVE', 'Đang hoạt động'],
              ['ARCHIVED', 'Đã lưu trữ'],
              ['ALL', 'Tất cả'],
            ] as const
          ).map(([statusKey, label]) => (
            <button
              key={statusKey}
              type="button"
              className={
                statusFilter === statusKey ? 'tender-filter-chip is-active' : 'tender-filter-chip'
              }
              onClick={() => setStatusFilter(statusKey)}
            >
              {label}
            </button>
          ))}
        </div>
      </form>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      {creating && canWrite && (
        <form
          className="tender-form"
          onSubmit={handleCreateProduct}
          aria-label="Tạo sản phẩm catalog mới"
        >
          <div className="tender-form-grid">
            <label className="field">
              <span>Mã SKU (duy nhất khi đang hoạt động)</span>
              <input
                required
                maxLength={100}
                value={sku}
                onChange={(event) => setSku(event.target.value)}
                placeholder="VD: MON-MINDRAY-MEC12"
              />
            </label>
            <label className="field">
              <span>Hãng / Thương hiệu</span>
              <input
                required
                maxLength={120}
                value={brand}
                onChange={(event) => setBrand(event.target.value)}
                placeholder="VD: Mindray / Philips / GE Healthcare"
              />
            </label>
            <label className="field field-wide">
              <span>Tên thiết bị / Sản phẩm y tế</span>
              <input
                required
                maxLength={200}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="VD: Monitor theo dõi bệnh nhân 5 thông số tại giường"
              />
            </label>
            <label className="field">
              <span>Nhà sản xuất / Xuất xứ</span>
              <input
                maxLength={200}
                value={manufacturer}
                onChange={(event) => setManufacturer(event.target.value)}
                placeholder="VD: Shenzhen Mindray Bio-Medical Electronics"
              />
            </label>
            <label className="field">
              <span>Nhóm thiết bị</span>
              <input
                maxLength={120}
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                placeholder="VD: Thiết bị hồi sức cấp cứu (ICU)"
              />
            </label>
            <label className="field">
              <span>Mã Model cho phiên bản khởi tạo (v1)</span>
              <input
                maxLength={120}
                value={modelCode}
                onChange={(event) => setModelCode(event.target.value)}
                placeholder="Mặc định lấy theo SKU nếu để trống"
              />
            </label>
            <label className="field">
              <span>Ghi chú phiên bản khởi tạo (v1)</span>
              <input
                maxLength={2000}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="VD: Cấu hình tiêu chuẩn theo brochure 2026"
              />
            </label>
          </div>
          <div className="tender-form-actions">
            <button
              className="button button-secondary"
              type="button"
              onClick={() => setCreating(false)}
            >
              Hủy
            </button>
            <button className="button button-primary" disabled={submitting} type="submit">
              {submitting ? 'Đang khởi tạo...' : 'Tạo sản phẩm & Mở phiên bản v1'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="tender-skeleton-list" aria-label="Đang tải danh mục sản phẩm">
          <i />
          <i />
          <i />
          <i />
        </div>
      ) : products.length === 0 ? (
        <div className="tender-empty">
          <h3>
            {hasFilters
              ? 'Không tìm thấy sản phẩm phù hợp bộ lọc'
              : 'Chưa có sản phẩm nào trong Catalog của tổ chức'}
          </h3>
          <p className="muted">
            {hasFilters
              ? 'Thử đổi từ khóa tìm kiếm hoặc chuyển bộ lọc trạng thái sản phẩm.'
              : canWrite
                ? 'Tạo sản phẩm đầu tiên để quản lý phiên bản model và thông số kỹ thuật có truy vết nguồn.'
                : 'Liên hệ OWNER, ADMIN hoặc CATALOG_MANAGER để khởi tạo sản phẩm trong danh mục.'}
          </p>
        </div>
      ) : (
        <>
          <div className="tender-grid">
            {products.map((product) => {
              const activeVer = product.publishedVersion ?? product.latestVersion
              const conflictCount = activeVer?.conflictCount ?? 0
              return (
                <article key={product.id} className="tender-card catalog-product-card">
                  <div>
                    <div className="tender-card-meta">
                      <span className="tender-code">{product.sku}</span>
                      <span className="tender-stage-pill">{product.brand}</span>
                      {product.category && (
                        <span className="catalog-category-pill">{product.category}</span>
                      )}
                      <span
                        className={
                          product.status === 'ACTIVE'
                            ? 'catalog-status-pill is-published'
                            : 'catalog-status-pill is-superseded'
                        }
                      >
                        {product.status === 'ACTIVE' ? 'Đang hoạt động' : 'Đã lưu trữ'}
                      </span>
                    </div>
                    <h3>
                      <Link href={`/${slug}/catalog/${product.id}`}>{product.name}</Link>
                    </h3>
                    <div className="catalog-version-strip">
                      {product.publishedVersion ? (
                        <span className="catalog-version-tag is-published">
                          Phiên bản chuẩn: <strong>{product.publishedVersion.versionLabel}</strong> · Model{' '}
                          <code>{product.publishedVersion.modelCode}</code>
                        </span>
                      ) : product.latestVersion ? (
                        <span className="catalog-version-tag is-draft">
                          Đang soạn thảo: <strong>{product.latestVersion.versionLabel}</strong> (
                          {versionStatusLabels[product.latestVersion.status]}) · Model{' '}
                          <code>{product.latestVersion.modelCode}</code>
                        </span>
                      ) : null}
                      {conflictCount > 0 && (
                        <span className="catalog-conflict-badge" title="Có thông số xung đột giữa các nguồn">
                          ⚠ {conflictCount} thông số xung đột nguồn
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="tender-card-stats">
                    <span>
                      <strong>{product.versionCount}</strong> phiên bản
                    </span>
                    <span>
                      <strong>{activeVer?.specificationCount ?? 0}</strong> thông số
                    </span>
                    <Link className="tender-open-link" href={`/${slug}/catalog/${product.id}`}>
                      Mở phiên bản →
                    </Link>
                  </div>
                </article>
              )
            })}
          </div>

          {nextCursor && (
            <div className="tender-pagination">
              <button
                className="button button-secondary"
                type="button"
                disabled={loadingMore}
                onClick={handleLoadMore}
              >
                {loadingMore
                  ? 'Đang tải thêm...'
                  : `Tải thêm sản phẩm (${products.length}/${total})`}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  )
}
