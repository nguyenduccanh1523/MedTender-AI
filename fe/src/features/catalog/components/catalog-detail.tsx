'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState, type FormEvent } from 'react'

import { ApiError } from '../../../lib/api/client'
import { canManageCatalog, useWorkspaceRole } from '../../organizations/workspace-permissions'
import {
  addCatalogSpecification,
  createCatalogProductVersion,
  getCatalogProduct,
  publishCatalogProductVersion,
  removeCatalogSpecification,
  updateCatalogProduct,
  updateCatalogProductVersion,
  updateCatalogSpecification,
  type ProductDetail,
  type ProductSpecification,
  type ProductVersionDetail,
} from '../api'

const versionStatusMeta: Record<
  'DRAFT' | 'PUBLISHED' | 'SUPERSEDED',
  { label: string; shortLabel: string; pillClass: string; desc: string }
> = {
  DRAFT: {
    label: 'Bản nháp (Có thể chỉnh sửa)',
    shortLabel: 'Bản nháp',
    pillClass: 'is-draft',
    desc: 'Phiên bản đang trong quá trình biên tập thông số. Có thể thêm, sửa, xóa thông số trước khi xuất bản.',
  },
  PUBLISHED: {
    label: 'Đã xuất bản (Khóa bất biến)',
    shortLabel: 'Đã xuất bản',
    pillClass: 'is-published',
    desc: 'Phiên bản chuẩn hiện hành dùng để đối chiếu hồ sơ thầu. Mọi thông số đã được khóa bất biến.',
  },
  SUPERSEDED: {
    label: 'Lịch sử (Đã thay thế)',
    shortLabel: 'Đã thay thế',
    pillClass: 'is-superseded',
    desc: 'Phiên bản cũ được bảo toàn nguyên vẹn để phục vụ truy vết các gói thầu đã tham chiếu trước đó.',
  },
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
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
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
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  )
}

export function CatalogDetailView({ slug, productId }: { slug: string; productId: string }) {
  const role = useWorkspaceRole()
  const canWrite = canManageCatalog(role)

  const [product, setProduct] = useState<ProductDetail | null>(null)
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [editingProduct, setEditingProduct] = useState(false)
  const [prodSku, setProdSku] = useState('')
  const [prodName, setProdName] = useState('')
  const [prodBrand, setProdBrand] = useState('')
  const [prodManufacturer, setProdManufacturer] = useState('')
  const [prodCategory, setProdCategory] = useState('')
  const [prodStatus, setProdStatus] = useState<'ACTIVE' | 'ARCHIVED'>('ACTIVE')

  const [creatingVersion, setCreatingVersion] = useState(false)
  const [newVersionModel, setNewVersionModel] = useState('')
  const [newVersionNotes, setNewVersionNotes] = useState('')
  const [cloneFromId, setCloneFromId] = useState<string>('')

  const [editingVersionMeta, setEditingVersionMeta] = useState(false)
  const [verModel, setVerModel] = useState('')
  const [verNotes, setVerNotes] = useState('')

  const [addingSpec, setAddingSpec] = useState(false)
  const [specKey, setSpecKey] = useState('')
  const [specValue, setSpecValue] = useState('')
  const [specUnit, setSpecUnit] = useState('')
  const [sourceLabel, setSourceLabel] = useState('')
  const [sourceQuote, setSourceQuote] = useState('')

  const [editingSpecId, setEditingSpecId] = useState<string | null>(null)
  const [editSpecKey, setEditSpecKey] = useState('')
  const [editSpecValue, setEditSpecValue] = useState('')
  const [editSpecUnit, setEditSpecUnit] = useState('')
  const [editSourceLabel, setEditSourceLabel] = useState('')
  const [editSourceQuote, setEditSourceQuote] = useState('')

  const [onlyConflicts, setOnlyConflicts] = useState(false)

  const loadProduct = useCallback(
    async (preferredVersionId?: string) => {
      setLoading(true)
      setError(null)
      try {
        const detail = await getCatalogProduct(slug, productId)
        setProduct(detail)
        setProdSku(detail.sku)
        setProdName(detail.name)
        setProdBrand(detail.brand)
        setProdManufacturer(detail.manufacturer ?? '')
        setProdCategory(detail.category ?? '')
        setProdStatus(detail.status)

        const targetVer =
          (preferredVersionId && detail.versions.find((v) => v.id === preferredVersionId)) ||
          detail.versions.find((v) => v.id === selectedVersionId) ||
          detail.versions.find((v) => v.status === 'PUBLISHED') ||
          detail.versions[0] ||
          null
        if (targetVer) {
          setSelectedVersionId(targetVer.id)
          setCloneFromId(targetVer.id)
        }
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Không tải được chi tiết sản phẩm.')
      } finally {
        setLoading(false)
      }
    },
    [slug, productId, selectedVersionId],
  )

  useEffect(() => {
    let active = true
    getCatalogProduct(slug, productId)
      .then((detail) => {
        if (!active) return
        setProduct(detail)
        setProdSku(detail.sku)
        setProdName(detail.name)
        setProdBrand(detail.brand)
        setProdManufacturer(detail.manufacturer ?? '')
        setProdCategory(detail.category ?? '')
        setProdStatus(detail.status)
        const targetVer =
          detail.versions.find((v) => v.status === 'PUBLISHED') ?? detail.versions[0] ?? null
        if (targetVer) {
          setSelectedVersionId(targetVer.id)
          setCloneFromId(targetVer.id)
        }
      })
      .catch((err: unknown) => {
        if (active) {
          setError(err instanceof ApiError ? err.message : 'Không tải được chi tiết sản phẩm.')
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [slug, productId])

  if (loading && !product) {
    return (
      <div className="tender-detail-skeleton" aria-label="Đang tải chi tiết sản phẩm catalog" aria-busy="true">
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

  if (!product) {
    return (
      <section className="surface tender-list-panel">
        <p className="notice notice-error" role="alert">
          {error ?? 'Không tìm thấy sản phẩm trong catalog.'}
        </p>
        <Link className="button button-secondary" href={`/${slug}/catalog`}>
          Quay lại danh mục
        </Link>
      </section>
    )
  }

  const activeVersion: ProductVersionDetail | null =
    product.versions.find((v) => v.id === selectedVersionId) ?? product.versions[0] ?? null
  const isDraft = activeVersion?.status === 'DRAFT'

  async function handleUpdateProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canWrite) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const updated = await updateCatalogProduct(slug, productId, {
        sku: prodSku.trim(),
        name: prodName.trim(),
        brand: prodBrand.trim(),
        manufacturer: prodManufacturer.trim() || null,
        category: prodCategory.trim() || null,
        status: prodStatus,
      })
      setProduct(updated)
      setEditingProduct(false)
      setNotice('Đã cập nhật thông tin định danh sản phẩm.')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không cập nhật được sản phẩm.')
    } finally {
      setBusy(false)
    }
  }

  async function handleCreateVersion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canWrite) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const created = await createCatalogProductVersion(slug, productId, {
        modelCode: newVersionModel.trim(),
        notes: newVersionNotes.trim() || undefined,
        cloneFromVersionId: cloneFromId || undefined,
      })
      setCreatingVersion(false)
      setNewVersionModel('')
      setNewVersionNotes('')
      await loadProduct(created.id)
      setNotice(
        `Đã khởi tạo phiên bản ${created.versionLabel} (${created.modelCode}) ở trạng thái Bản nháp. Phiên bản cũ vẫn được giữ nguyên vẹn.`,
      )
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không tạo được phiên bản mới.')
    } finally {
      setBusy(false)
    }
  }

  async function handlePublishVersion() {
    if (!canWrite || !activeVersion) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const published = await publishCatalogProductVersion(slug, productId, activeVersion.id)
      await loadProduct(published.id)
      setNotice(
        `Đã xuất bản phiên bản ${published.versionLabel} (${published.modelCode}). Dữ liệu phiên bản đã được khóa bất biến (${published.fingerprint}).`,
      )
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không thể xuất bản phiên bản.')
    } finally {
      setBusy(false)
    }
  }

  function startEditVersionMeta(version: ProductVersionDetail) {
    setEditingVersionMeta(true)
    setVerModel(version.modelCode)
    setVerNotes(version.notes ?? '')
  }

  async function handleSaveVersionMeta(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canWrite || !activeVersion) return
    setBusy(true)
    setError(null)
    try {
      const updated = await updateCatalogProductVersion(slug, productId, activeVersion.id, {
        modelCode: verModel.trim(),
        notes: verNotes.trim() || null,
      })
      setEditingVersionMeta(false)
      await loadProduct(updated.id)
      setNotice(`Đã cập nhật model và ghi chú của ${updated.versionLabel}.`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không cập nhật được thông tin phiên bản.')
    } finally {
      setBusy(false)
    }
  }

  async function handleAddSpec(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canWrite || !activeVersion) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      await addCatalogSpecification(slug, productId, activeVersion.id, {
        specKey: specKey.trim(),
        specValue: specValue.trim(),
        unit: specUnit.trim() || undefined,
        sourceLabel: sourceLabel.trim(),
        sourceQuote: sourceQuote.trim() || undefined,
      })
      setSpecKey('')
      setSpecValue('')
      setSpecUnit('')
      setSourceLabel('')
      setSourceQuote('')
      setAddingSpec(false)
      await loadProduct(activeVersion.id)
      setNotice('Đã thêm thông số kỹ thuật kèm truy vết nguồn.')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không thêm được thông số kỹ thuật.')
    } finally {
      setBusy(false)
    }
  }

  function startEditSpec(spec: ProductSpecification) {
    setEditingSpecId(spec.id)
    setEditSpecKey(spec.specKey)
    setEditSpecValue(spec.specValue)
    setEditSpecUnit(spec.unit ?? '')
    setEditSourceLabel(spec.sourceLabel)
    setEditSourceQuote(spec.sourceQuote ?? '')
  }

  async function handleSaveSpec(event: FormEvent<HTMLFormElement>, specId: string) {
    event.preventDefault()
    if (!canWrite || !activeVersion) return
    setBusy(true)
    setError(null)
    try {
      await updateCatalogSpecification(slug, productId, activeVersion.id, specId, {
        specKey: editSpecKey.trim(),
        specValue: editSpecValue.trim(),
        unit: editSpecUnit.trim() || null,
        sourceLabel: editSourceLabel.trim(),
        sourceQuote: editSourceQuote.trim() || null,
      })
      setEditingSpecId(null)
      await loadProduct(activeVersion.id)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không cập nhật được thông số.')
    } finally {
      setBusy(false)
    }
  }

  async function handleDeleteSpec(spec: ProductSpecification) {
    if (!canWrite || !activeVersion) return
    if (!window.confirm(`Xóa thông số "${spec.specKey}" khỏi phiên bản ${activeVersion.versionLabel}?`)) return
    setBusy(true)
    setError(null)
    try {
      await removeCatalogSpecification(slug, productId, activeVersion.id, spec.id)
      await loadProduct(activeVersion.id)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không xóa được thông số.')
    } finally {
      setBusy(false)
    }
  }

  const displayedSpecs = activeVersion
    ? onlyConflicts
      ? activeVersion.specifications.filter((s) => s.hasConflict)
      : activeVersion.specifications
    : []

  return (
    <div className="tender-detail-page">
      <div className="tender-breadcrumb-bar">
        <Link className="tender-back-link" href={`/${slug}/catalog`}>
          ← Danh mục sản phẩm (Catalog)
        </Link>
        <div className="tender-inline-metrics" aria-label="Tóm tắt sản phẩm">
          <span>
            <strong>{product.versionCount}</strong> Phiên bản
          </span>
          <i>·</i>
          <span>
            <strong>{activeVersion?.specificationCount ?? 0}</strong>/200 Thông số
          </span>
        </div>
      </div>

      <section className="surface tender-detail-head">
        {editingProduct && canWrite ? (
          <form className="tender-edit-head-form" onSubmit={handleUpdateProduct} aria-label="Cập nhật sản phẩm">
            <div className="tender-entry-heading">
              <strong>Chỉnh sửa định danh sản phẩm</strong>
              <button
                type="button"
                className="tender-text-button"
                onClick={() => setEditingProduct(false)}
              >
                Hủy
              </button>
            </div>
            <div className="tender-form-grid">
              <label>
                Mã SKU
                <input
                  required
                  maxLength={100}
                  value={prodSku}
                  onChange={(event) => setProdSku(event.target.value)}
                />
              </label>
              <label>
                Hãng / Thương hiệu
                <input
                  required
                  maxLength={120}
                  value={prodBrand}
                  onChange={(event) => setProdBrand(event.target.value)}
                />
              </label>
              <label className="span-2">
                Tên thiết bị
                <input
                  required
                  maxLength={200}
                  value={prodName}
                  onChange={(event) => setProdName(event.target.value)}
                />
              </label>
              <label>
                Nhà sản xuất
                <input
                  maxLength={200}
                  value={prodManufacturer}
                  onChange={(event) => setProdManufacturer(event.target.value)}
                />
              </label>
              <label>
                Nhóm thiết bị
                <input
                  maxLength={120}
                  value={prodCategory}
                  onChange={(event) => setProdCategory(event.target.value)}
                />
              </label>
              <label>
                Trạng thái vòng đời SKU
                <select
                  value={prodStatus}
                  onChange={(event) => setProdStatus(event.target.value as 'ACTIVE' | 'ARCHIVED')}
                >
                  <option value="ACTIVE">Đang hoạt động (ACTIVE)</option>
                  <option value="ARCHIVED">Lưu trữ / Ngừng kinh doanh (ARCHIVED)</option>
                </select>
              </label>
            </div>
            <div className="tender-inline-actions">
              <button className="button button-primary" disabled={busy} type="submit">
                Lưu thay đổi
              </button>
            </div>
          </form>
        ) : (
          <div className="tender-head-compact">
            <div className="tender-head-copy">
              <div className="tender-head-badges">
                <span className="tender-lot-code">{product.sku}</span>
                <span className="tender-stage-badge">{product.brand}</span>
                {product.category && <span className="catalog-category-pill">{product.category}</span>}
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
              <h1>{product.name}</h1>
              <p className="muted" style={{ fontSize: '.84rem', margin: 0 }}>
                {product.manufacturer
                  ? `Nhà sản xuất: ${product.manufacturer}`
                  : 'Chưa khai báo nhà sản xuất chi tiết'}
                {' · '}
                Lưu trữ <strong>{product.versionCount}</strong> phiên bản bất biến.
              </p>
            </div>

            {canWrite && (
              <div className="tender-head-actions">
                <button
                  className="tender-icon-button"
                  type="button"
                  disabled={busy}
                  onClick={() => setEditingProduct((v) => !v)}
                  aria-label="Sửa định danh SKU"
                  title="Chỉnh sửa định danh SKU"
                >
                  <EditIcon />
                </button>
                <button
                  className="button button-primary tender-add-lot-btn"
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setCreatingVersion((v) => !v)
                    if (activeVersion && !newVersionModel) {
                      setNewVersionModel(activeVersion.modelCode)
                      setCloneFromId(activeVersion.id)
                    }
                  }}
                >
                  {creatingVersion ? 'Đóng tạo phiên bản' : '+ Tạo phiên bản mới'}
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {error && (
        <p className="notice notice-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="governance-success-banner" role="status">
          {notice}
        </p>
      )}

      {creatingVersion && canWrite && (
        <form
          className="tender-entry-form"
          onSubmit={handleCreateVersion}
          aria-label="Tạo phiên bản sản phẩm mới"
        >
          <div className="tender-entry-heading">
            <div>
              <strong>Khởi tạo phiên bản sản phẩm mới</strong>
              <p className="muted">
                Phiên bản cũ vẫn được bảo toàn nguyên vẹn. Bạn có thể sao chép bộ thông số nền từ phiên bản trước để chỉnh sửa nhanh.
              </p>
            </div>
            <button
              type="button"
              className="tender-text-button"
              onClick={() => setCreatingVersion(false)}
            >
              Đóng
            </button>
          </div>
          <div className="tender-form-grid">
            <label>
              Mã Model của phiên bản mới
              <input
                required
                maxLength={120}
                value={newVersionModel}
                onChange={(event) => setNewVersionModel(event.target.value)}
                placeholder="VD: MEC-1200 Pro (2026)"
              />
            </label>
            <label>
              Sao chép thông số nền từ phiên bản
              <select
                value={cloneFromId}
                onChange={(event) => setCloneFromId(event.target.value)}
              >
                <option value="">Khởi tạo trống (0 thông số)</option>
                {product.versions.map((ver) => (
                  <option key={ver.id} value={ver.id}>
                    {ver.versionLabel} · {ver.modelCode} ({ver.specificationCount} thông số ·{' '}
                    {versionStatusMeta[ver.status].shortLabel})
                  </option>
                ))}
              </select>
            </label>
            <label className="span-2">
              Ghi chú thay đổi của phiên bản mới
              <input
                maxLength={2000}
                value={newVersionNotes}
                onChange={(event) => setNewVersionNotes(event.target.value)}
                placeholder="VD: Bổ sung thông số từ tờ khai CFS và cập nhật dải đo SpO2"
              />
            </label>
          </div>
          <div className="tender-inline-actions">
            <button className="button button-primary" disabled={busy} type="submit">
              Khởi tạo phiên bản mới
            </button>
          </div>
        </form>
      )}

      <div className="tender-subtabs-bar">
        <div className="tender-subtabs" role="tablist" aria-label="Danh sách phiên bản sản phẩm">
          {product.versions.map((ver) => {
            const isSelected = ver.id === activeVersion?.id
            return (
              <button
                key={ver.id}
                role="tab"
                type="button"
                aria-selected={isSelected}
                className={isSelected ? 'tender-subtab is-active' : 'tender-subtab'}
                onClick={() => {
                  setSelectedVersionId(ver.id)
                  setEditingVersionMeta(false)
                  setAddingSpec(false)
                  setEditingSpecId(null)
                }}
              >
                <span>
                  {ver.versionLabel} · {ver.modelCode}
                </span>
                <span className="tender-subtab-badge">
                  {versionStatusMeta[ver.status].shortLabel} ({ver.specificationCount})
                </span>
              </button>
            )
          })}
        </div>

        {activeVersion && canWrite && isDraft && (
          <div className="tender-head-actions">
            <button
              className="button button-secondary tender-add-item-btn"
              type="button"
              disabled={busy}
              onClick={() => startEditVersionMeta(activeVersion)}
            >
              Sửa Model
            </button>
            <button
              className="button button-secondary tender-add-item-btn"
              type="button"
              disabled={busy}
              onClick={() => setAddingSpec((v) => !v)}
            >
              {addingSpec ? 'Đóng thêm thông số' : '+ Thêm thông số'}
            </button>
            <button
              className="button button-primary tender-add-lot-btn"
              type="button"
              disabled={busy}
              onClick={handlePublishVersion}
            >
              Xuất bản {activeVersion.versionLabel}
            </button>
          </div>
        )}
      </div>

      {activeVersion && (
        <article className="tender-lot-card">
          <div className="tender-lot-heading">
            <div className="catalog-version-header-info">
              <div className="tender-lot-title-wrap">
                <span className="tender-lot-code">{activeVersion.versionLabel}</span>
                <h3>Model: {activeVersion.modelCode}</h3>
                <span
                  className={`catalog-status-pill ${versionStatusMeta[activeVersion.status].pillClass}`}
                >
                  {versionStatusMeta[activeVersion.status].label}
                </span>
                <span className="catalog-fingerprint" title="Mã băm kiểm chứng tính toàn vẹn phiên bản">
                  Fingerprint: <code>{activeVersion.fingerprint}</code>
                </span>
              </div>
              <p className="muted" style={{ fontSize: '.82rem', margin: '.25rem 0 0' }}>
                {activeVersion.notes || versionStatusMeta[activeVersion.status].desc}
                {activeVersion.publishedAt
                  ? ` · Xuất bản lúc: ${new Date(activeVersion.publishedAt).toLocaleString('vi-VN')}`
                  : ''}
              </p>
            </div>

            {!isDraft && (
              <span className="catalog-immutable-lock">
                🔒 Đã khóa bất biến — Tạo phiên bản mới nếu cần cập nhật thông số
              </span>
            )}
          </div>

          {editingVersionMeta && isDraft && canWrite && (
            <form
              className="tender-entry-form tender-lot-edit-form"
              onSubmit={handleSaveVersionMeta}
              aria-label="Cập nhật model phiên bản"
            >
              <div className="tender-entry-heading">
                <strong>Cập nhật thông tin {activeVersion.versionLabel}</strong>
                <button
                  type="button"
                  className="tender-text-button"
                  onClick={() => setEditingVersionMeta(false)}
                >
                  Hủy
                </button>
              </div>
              <div className="tender-form-grid">
                <label>
                  Mã Model thiết bị
                  <input
                    required
                    maxLength={120}
                    value={verModel}
                    onChange={(event) => setVerModel(event.target.value)}
                  />
                </label>
                <label>
                  Ghi chú phiên bản
                  <input
                    maxLength={2000}
                    value={verNotes}
                    onChange={(event) => setVerNotes(event.target.value)}
                  />
                </label>
              </div>
              <div className="tender-inline-actions">
                <button className="button button-primary" disabled={busy} type="submit">
                  Lưu phiên bản
                </button>
              </div>
            </form>
          )}

          {addingSpec && isDraft && canWrite && (
            <form
              className="tender-entry-form tender-item-form"
              onSubmit={handleAddSpec}
              aria-label="Thêm thông số kỹ thuật"
            >
              <div className="tender-entry-heading">
                <div>
                  <strong>Thêm thông số kỹ thuật kèm truy vết nguồn</strong>
                  <p className="muted">
                    Nếu cùng một thông số có hai giá trị khác nhau từ hai nguồn tài liệu, hệ thống sẽ giữ cả hai và cảnh báo xung đột.
                  </p>
                </div>
                <button
                  type="button"
                  className="tender-text-button"
                  onClick={() => setAddingSpec(false)}
                >
                  Đóng
                </button>
              </div>
              <div className="tender-form-grid tender-item-fields">
                <label>
                  Tên thông số kỹ thuật (specKey)
                  <input
                    required
                    maxLength={120}
                    value={specKey}
                    onChange={(event) => setSpecKey(event.target.value)}
                    placeholder="VD: Thời lượng pin dự phòng"
                  />
                </label>
                <label>
                  Giá trị thông số (specValue)
                  <input
                    required
                    maxLength={1000}
                    value={specValue}
                    onChange={(event) => setSpecValue(event.target.value)}
                    placeholder="VD: ≥ 120"
                  />
                </label>
                <label>
                  Đơn vị tính
                  <input
                    maxLength={50}
                    value={specUnit}
                    onChange={(event) => setSpecUnit(event.target.value)}
                    placeholder="VD: phút / inch / %"
                  />
                </label>
                <label>
                  Nguồn tài liệu (sourceLabel — Bắt buộc)
                  <input
                    required
                    maxLength={200}
                    value={sourceLabel}
                    onChange={(event) => setSourceLabel(event.target.value)}
                    placeholder="VD: Brochure nhà sản xuất v2.1 (Trang 4)"
                  />
                </label>
                <label className="span-2">
                  Trích dẫn nguyên văn từ tài liệu (sourceQuote)
                  <input
                    maxLength={2000}
                    value={sourceQuote}
                    onChange={(event) => setSourceQuote(event.target.value)}
                    placeholder="VD: Rechargeable Li-ion battery providing at least 120 minutes of continuous monitoring"
                  />
                </label>
              </div>
              <div className="tender-inline-actions">
                <button className="button button-primary" disabled={busy} type="submit">
                  Lưu thông số & Nguồn
                </button>
              </div>
            </form>
          )}

          {activeVersion.conflictCount > 0 && (
            <div className="catalog-conflict-bar">
              <span className="catalog-conflict-badge">
                ⚠ Phát hiện {activeVersion.conflictCount} thông số có giá trị khác nhau giữa các nguồn tài liệu
              </span>
              <div className="tender-stage-tabs">
                <button
                  type="button"
                  className={!onlyConflicts ? 'tender-filter-chip is-active' : 'tender-filter-chip'}
                  onClick={() => setOnlyConflicts(false)}
                >
                  Tất cả ({activeVersion.specificationCount})
                </button>
                <button
                  type="button"
                  className={onlyConflicts ? 'tender-filter-chip is-active' : 'tender-filter-chip'}
                  onClick={() => setOnlyConflicts(true)}
                >
                  Chỉ hiện xung đột
                </button>
              </div>
            </div>
          )}

          {displayedSpecs.length === 0 ? (
            <p className="tender-empty-item">
              {isDraft && canWrite
                ? `Chưa có thông số kỹ thuật nào trong ${activeVersion.versionLabel}. Nhấn "+ Thêm thông số" để khai báo thông số kèm nguồn trích dẫn.`
                : `Phiên bản ${activeVersion.versionLabel} hiện chưa có thông số kỹ thuật được ghi nhận.`}
            </p>
          ) : (
            <div className="tender-items-list" role="table" aria-label="Bảng thông số kỹ thuật có truy vết nguồn">
              {displayedSpecs.map((spec, index) =>
                editingSpecId === spec.id && isDraft && canWrite ? (
                  <form
                    key={spec.id}
                    className="tender-entry-form tender-item-form"
                    onSubmit={(event) => handleSaveSpec(event, spec.id)}
                  >
                    <div className="tender-entry-heading">
                      <strong>Chỉnh sửa thông số: {spec.specKey}</strong>
                      <button
                        type="button"
                        className="tender-text-button"
                        onClick={() => setEditingSpecId(null)}
                      >
                        Hủy
                      </button>
                    </div>
                    <div className="tender-form-grid tender-item-fields">
                      <label>
                        Tên thông số
                        <input
                          required
                          maxLength={120}
                          value={editSpecKey}
                          onChange={(e) => setEditSpecKey(e.target.value)}
                        />
                      </label>
                      <label>
                        Giá trị
                        <input
                          required
                          maxLength={1000}
                          value={editSpecValue}
                          onChange={(e) => setEditSpecValue(e.target.value)}
                        />
                      </label>
                      <label>
                        Đơn vị
                        <input
                          maxLength={50}
                          value={editSpecUnit}
                          onChange={(e) => setEditSpecUnit(e.target.value)}
                        />
                      </label>
                      <label>
                        Nguồn tài liệu
                        <input
                          required
                          maxLength={200}
                          value={editSourceLabel}
                          onChange={(e) => setEditSourceLabel(e.target.value)}
                        />
                      </label>
                      <label className="span-2">
                        Trích dẫn nguyên văn
                        <input
                          maxLength={2000}
                          value={editSourceQuote}
                          onChange={(e) => setEditSourceQuote(e.target.value)}
                        />
                      </label>
                    </div>
                    <div className="tender-inline-actions">
                      <button className="button button-primary" disabled={busy} type="submit">
                        Lưu thông số
                      </button>
                    </div>
                  </form>
                ) : (
                  <div
                    key={spec.id}
                    className={
                      spec.hasConflict
                        ? 'tender-item-row catalog-spec-item-row is-conflict'
                        : 'tender-item-row catalog-spec-item-row'
                    }
                    role="row"
                  >
                    <span className="tender-item-no">{String(index + 1).padStart(2, '0')}</span>
                    <div role="cell">
                      <div className="catalog-spec-title-line">
                        <strong>{spec.specKey}</strong>
                        <span className="catalog-source-pill">Nguồn: {spec.sourceLabel}</span>
                        {spec.hasConflict && (
                          <span className="catalog-conflict-badge">
                            ⚠ Xung đột giá trị giữa các nguồn
                          </span>
                        )}
                      </div>
                      {spec.sourceQuote && <p>“{spec.sourceQuote}”</p>}
                    </div>
                    <div className="tender-item-meta" role="cell">
                      <span className="tender-item-quantity">
                        {spec.specValue}
                        {spec.unit ? ` ${spec.unit}` : ''}
                      </span>
                      {isDraft && canWrite && (
                        <div className="tender-item-actions">
                          <button
                            className="tender-icon-button is-sm"
                            type="button"
                            disabled={busy}
                            onClick={() => startEditSpec(spec)}
                            aria-label={`Sửa thông số ${spec.specKey}`}
                            title="Sửa thông số"
                          >
                            <EditIcon />
                          </button>
                          <button
                            className="tender-icon-button is-sm is-danger"
                            type="button"
                            disabled={busy}
                            onClick={() => void handleDeleteSpec(spec)}
                            aria-label={`Xóa thông số ${spec.specKey}`}
                            title="Xóa thông số"
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
        </article>
      )}
    </div>
  )
}
