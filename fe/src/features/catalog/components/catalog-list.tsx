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
    <section className="surface tender-list-panel" aria-busy={loading}>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Danh mục chuẩn hóa kỹ thuật</p>
          <h2>Sản phẩm & Phiên bản thông số ({total})</h2>
          <p className="muted">
            Quản lý thiết bị theo mã SKU duy nhất khi đang hoạt động và lưu lịch sử phiên bản bất biến để đối chiếu hồ sơ thầu.
          </p>
        </div>
        <div className="tender-list-actions">
          <button
            className={loading ? 'tender-icon-button is-spinning' : 'tender-icon-button'}
            type="button"
            onClick={() => void loadFirstPage(activeQuery, statusFilter)}
            disabled={loading}
            aria-label="Làm mới catalog"
            title="Làm mới danh sách sản phẩm"
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

      <form className="tender-toolbar" onSubmit={handleSearchSubmit} role="search" aria-label="Tìm kiếm và lọc sản phẩm">
        <div className="catalog-search-group">
          <label className="tender-search-box">
            <span className="sr-only">Tìm sản phẩm catalog</span>
            <input
              type="search"
              aria-label="Tìm sản phẩm catalog"
              placeholder="Tìm theo mã SKU, tên thiết bị, hãng hoặc nhóm thiết bị…"
              value={searchInput}
              onChange={(event) => {
                setSearchInput(event.target.value)
                if (event.target.value === '') setActiveQuery('')
              }}
            />
          </label>
          <button className="tender-chip-button" type="submit" disabled={loading}>
            Tìm
          </button>
          {hasFilters && (
            <button
              className="tender-text-button"
              type="button"
              onClick={resetSearch}
              disabled={loading}
            >
              Xóa lọc
            </button>
          )}
        </div>

        <div className="tender-stage-tabs" role="group" aria-label="Lọc theo trạng thái sản phẩm">
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
              aria-pressed={statusFilter === statusKey}
              onClick={() => setStatusFilter(statusKey)}
            >
              {label}
            </button>
          ))}
        </div>
      </form>

      {error && (
        <p className="notice notice-error" role="alert">
          {error}
        </p>
      )}

      {creating && canWrite && (
        <form
          className="tender-entry-form catalog-create-form"
          onSubmit={handleCreateProduct}
          aria-label="Tạo sản phẩm catalog mới"
        >
          <div className="tender-entry-heading">
            <div>
              <strong>Khởi tạo sản phẩm mới trong Catalog</strong>
              <p className="muted">
                Hệ thống sẽ tự động tạo phiên bản đầu tiên (v1 · Bản nháp) theo mã Model bạn nhập bên dưới.
              </p>
            </div>
            <button
              type="button"
              className="tender-text-button"
              onClick={() => setCreating(false)}
            >
              Đóng
            </button>
          </div>

          <div className="tender-form-grid">
            <label>
              Mã SKU (duy nhất khi đang hoạt động)
              <input
                required
                maxLength={100}
                value={sku}
                onChange={(event) => setSku(event.target.value)}
                placeholder="VD: MON-MINDRAY-MEC12"
              />
            </label>
            <label>
              Hãng / Thương hiệu
              <input
                required
                maxLength={120}
                value={brand}
                onChange={(event) => setBrand(event.target.value)}
                placeholder="VD: Mindray / Philips / GE Healthcare"
              />
            </label>
            <label className="span-2">
              Tên thiết bị / Sản phẩm y tế
              <input
                required
                maxLength={200}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="VD: Monitor theo dõi bệnh nhân 5 thông số tại giường"
              />
            </label>
            <label>
              Nhà sản xuất / Xuất xứ
              <input
                maxLength={200}
                value={manufacturer}
                onChange={(event) => setManufacturer(event.target.value)}
                placeholder="VD: Shenzhen Mindray Bio-Medical"
              />
            </label>
            <label>
              Nhóm thiết bị
              <input
                maxLength={120}
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                placeholder="VD: Thiết bị hồi sức cấp cứu (ICU)"
              />
            </label>
            <label>
              Mã Model khởi tạo (v1)
              <input
                maxLength={120}
                value={modelCode}
                onChange={(event) => setModelCode(event.target.value)}
                placeholder="Mặc định lấy theo SKU nếu để trống"
              />
            </label>
            <label>
              Ghi chú phiên bản (v1)
              <input
                maxLength={2000}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="VD: Cấu hình tiêu chuẩn theo brochure 2026"
              />
            </label>
          </div>
          <div className="tender-inline-actions">
            <button
              className="button button-secondary"
              type="button"
              onClick={() => setCreating(false)}
            >
              Hủy
            </button>
            <button className="button button-primary" disabled={submitting} type="submit">
              {submitting ? 'Đang khởi tạo…' : 'Tạo sản phẩm & Mở phiên bản v1'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="tender-skeleton-list" aria-label="Đang tải danh mục sản phẩm" aria-busy="true">
          <i />
          <i />
          <i />
          <i />
        </div>
      ) : products.length === 0 ? (
        <div className="tender-empty-lot catalog-empty-box">
          <strong>
            {hasFilters
              ? 'Không tìm thấy sản phẩm phù hợp bộ lọc'
              : 'Chưa có sản phẩm nào trong Catalog của tổ chức'}
          </strong>
          <p className="muted">
            {hasFilters
              ? 'Thử đổi từ khóa tìm kiếm hoặc chuyển bộ lọc trạng thái sản phẩm.'
              : canWrite
                ? 'Nhấn "+ Thêm sản phẩm" ở góc trên bên phải để khởi tạo thiết bị và quản lý phiên bản thông số kỹ thuật.'
                : 'Vai trò của bạn là chỉ xem Catalog. Liên hệ OWNER, ADMIN hoặc CATALOG_MANAGER để khởi tạo sản phẩm trong danh mục.'}
          </p>
        </div>
      ) : (
        <>
          <ul className="organization-list tender-cards-list">
            {products.map((product) => {
              const activeVer = product.publishedVersion ?? product.latestVersion
              const conflictCount = activeVer?.conflictCount ?? 0
              return (
                <li key={product.id}>
                  <Link href={`/${slug}/catalog/${product.id}`} className="tender-list-card catalog-list-card">
                    <div className="tender-list-card-main">
                      <div className="catalog-card-badges">
                        <span className="tender-lot-code">{product.sku}</span>
                        <span className="tender-stage-badge">{product.brand}</span>
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
                        {conflictCount > 0 && (
                          <span className="catalog-conflict-badge">
                            ⚠ {conflictCount} thông số xung đột nguồn
                          </span>
                        )}
                      </div>
                      <strong>{product.name}</strong>
                      <small className="tender-list-card-meta">
                        {product.publishedVersion
                          ? `Phiên bản chuẩn: ${product.publishedVersion.versionLabel} · Model: ${product.publishedVersion.modelCode}`
                          : product.latestVersion
                            ? `Đang soạn thảo: ${product.latestVersion.versionLabel} (${versionStatusLabels[product.latestVersion.status]}) · Model: ${product.latestVersion.modelCode}`
                            : 'Chưa có phiên bản'}
                      </small>
                    </div>
                    <span className="tender-list-card-counts">
                      {product.versionCount} phiên bản · {activeVer?.specificationCount ?? 0} thông số
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>

          {nextCursor && (
            <div className="tender-pagination-bar">
              <span className="muted">
                Đang hiển thị {products.length} / {total} sản phẩm
              </span>
              <button
                className="button button-secondary"
                type="button"
                disabled={loadingMore}
                onClick={handleLoadMore}
              >
                {loadingMore ? 'Đang tải thêm…' : 'Tải thêm sản phẩm'}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  )
}
