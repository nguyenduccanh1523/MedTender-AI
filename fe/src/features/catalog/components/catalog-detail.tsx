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
  { label: string; pillClass: string; desc: string }
> = {
  DRAFT: {
    label: 'Bản nháp (Có thể chỉnh sửa)',
    pillClass: 'is-draft',
    desc: 'Phiên bản đang trong quá trình biên tập thông số. Có thể thêm, sửa, xóa thông số trước khi xuất bản.',
  },
  PUBLISHED: {
    label: 'Đã xuất bản (Khóa bất biến)',
    pillClass: 'is-published',
    desc: 'Phiên bản chuẩn hiện hành dùng để đối chiếu hồ sơ thầu. Mọi thông số đã được khóa bất biến.',
  },
  SUPERSEDED: {
    label: 'Lịch sử (Đã thay thế)',
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
      strokeWidth="2"
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
      strokeWidth="2"
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
      <section className="tender-panel" aria-busy="true">
        <div className="tender-detail-skeleton" aria-label="Đang tải chi tiết sản phẩm catalog">
          <div className="tender-skeleton-hero" />
          <div className="tender-skeleton-strip" />
          <div className="tender-skeleton-list">
            <i />
            <i />
            <i />
          </div>
        </div>
      </section>
    )
  }

  if (!product) {
    return (
      <section className="tender-panel">
        <p className="form-error" role="alert">
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
    <div className="tender-detail-stack">
      <div className="tender-breadcrumb">
        <Link href={`/${slug}/catalog`}>← Danh mục sản phẩm (Catalog)</Link>
      </div>

      <section className="tender-panel tender-hero-panel">
        <div className="tender-panel-head">
          <div>
            <div className="tender-card-meta">
              <span className="tender-code">{product.sku}</span>
              <span className="tender-stage-pill">{product.brand}</span>
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
            <h2>{product.name}</h2>
            <p className="muted">
              {product.manufacturer
                ? `Nhà sản xuất: ${product.manufacturer}`
                : 'Chưa khai báo nhà sản xuất chi tiết'}
              {' · '}
              Tổng cộng <strong>{product.versionCount}</strong> phiên bản được lưu trữ lịch sử.
            </p>
          </div>

          {canWrite && (
            <div className="tender-action-row">
              <button
                className="button button-secondary"
                type="button"
                disabled={busy}
                onClick={() => setEditingProduct((v) => !v)}
              >
                {editingProduct ? 'Đóng' : 'Sửa định danh SKU'}
              </button>
              <button
                className="button button-primary"
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

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="governance-success-banner" role="status">
            {notice}
          </p>
        )}

        {editingProduct && canWrite && (
          <form className="tender-form" onSubmit={handleUpdateProduct} aria-label="Cập nhật sản phẩm">
            <div className="tender-form-grid">
              <label className="field">
                <span>Mã SKU</span>
                <input
                  required
                  maxLength={100}
                  value={prodSku}
                  onChange={(event) => setProdSku(event.target.value)}
                />
              </label>
              <label className="field">
                <span>Hãng / Thương hiệu</span>
                <input
                  required
                  maxLength={120}
                  value={prodBrand}
                  onChange={(event) => setProdBrand(event.target.value)}
                />
              </label>
              <label className="field field-wide">
                <span>Tên thiết bị</span>
                <input
                  required
                  maxLength={200}
                  value={prodName}
                  onChange={(event) => setProdName(event.target.value)}
                />
              </label>
              <label className="field">
                <span>Nhà sản xuất</span>
                <input
                  maxLength={200}
                  value={prodManufacturer}
                  onChange={(event) => setProdManufacturer(event.target.value)}
                />
              </label>
              <label className="field">
                <span>Nhóm thiết bị</span>
                <input
                  maxLength={120}
                  value={prodCategory}
                  onChange={(event) => setProdCategory(event.target.value)}
                />
              </label>
              <label className="field">
                <span>Trạng thái vòng đời SKU</span>
                <select
                  value={prodStatus}
                  onChange={(event) => setProdStatus(event.target.value as 'ACTIVE' | 'ARCHIVED')}
                >
                  <option value="ACTIVE">Đang hoạt động (ACTIVE)</option>
                  <option value="ARCHIVED">Lưu trữ / Ngừng kinh doanh (ARCHIVED)</option>
                </select>
              </label>
            </div>
            <div className="tender-form-actions">
              <button
                className="button button-secondary"
                type="button"
                onClick={() => setEditingProduct(false)}
              >
                Hủy
              </button>
              <button className="button button-primary" disabled={busy} type="submit">
                Lưu thay đổi
              </button>
            </div>
          </form>
        )}

        {creatingVersion && canWrite && (
          <form
            className="tender-form"
            onSubmit={handleCreateVersion}
            aria-label="Tạo phiên bản sản phẩm mới"
          >
            <div className="tender-form-grid">
              <label className="field">
                <span>Mã Model của phiên bản mới</span>
                <input
                  required
                  maxLength={120}
                  value={newVersionModel}
                  onChange={(event) => setNewVersionModel(event.target.value)}
                  placeholder="VD: MEC-1200 Pro (2026)"
                />
              </label>
              <label className="field">
                <span>Sao chép thông số nền từ phiên bản</span>
                <select
                  value={cloneFromId}
                  onChange={(event) => setCloneFromId(event.target.value)}
                >
                  <option value="">Khởi tạo trống (0 thông số)</option>
                  {product.versions.map((ver) => (
                    <option key={ver.id} value={ver.id}>
                      {ver.versionLabel} · {ver.modelCode} ({ver.specificationCount} thông số ·{' '}
                      {versionStatusMeta[ver.status].label})
                    </option>
                  ))}
                </select>
              </label>
              <label className="field field-wide">
                <span>Ghi chú thay đổi của phiên bản mới</span>
                <input
                  maxLength={2000}
                  value={newVersionNotes}
                  onChange={(event) => setNewVersionNotes(event.target.value)}
                  placeholder="VD: Bổ sung thông số từ tờ khai CFS và cập nhật dải đo SpO2"
                />
              </label>
            </div>
            <div className="tender-form-actions">
              <button
                className="button button-secondary"
                type="button"
                onClick={() => setCreatingVersion(false)}
              >
                Hủy
              </button>
              <button className="button button-primary" disabled={busy} type="submit">
                Khởi tạo phiên bản mới
              </button>
            </div>
          </form>
        )}
      </section>

      <section className="tender-panel">
        <div className="tender-panel-head">
          <div>
            <p className="eyebrow">Lịch sử Phiên bản Bất biến</p>
            <h2>Chọn phiên bản để tra cứu hoặc biên tập ({product.versions.length})</h2>
            <p className="muted">
              Khi tạo phiên bản mới (VD: v2), phiên bản cũ (v1) vẫn giữ nguyên mọi giá trị model và thông số để đảm bảo
              tính toàn vẹn lịch sử đấu thầu.
            </p>
          </div>
        </div>

        <div className="catalog-version-tabs" role="tablist" aria-label="Danh sách phiên bản sản phẩm">
          {product.versions.map((ver) => {
            const isSelected = ver.id === activeVersion?.id
            const statusInfo = versionStatusMeta[ver.status]
            return (
              <button
                key={ver.id}
                role="tab"
                type="button"
                aria-selected={isSelected}
                className={isSelected ? 'catalog-version-tab is-active' : 'catalog-version-tab'}
                onClick={() => {
                  setSelectedVersionId(ver.id)
                  setEditingVersionMeta(false)
                  setAddingSpec(false)
                  setEditingSpecId(null)
                }}
              >
                <div className="catalog-version-tab-top">
                  <strong>{ver.versionLabel}</strong>
                  <span className={`catalog-status-pill ${statusInfo.pillClass}`}>
                    {ver.status === 'PUBLISHED'
                      ? 'Đã xuất bản'
                      : ver.status === 'DRAFT'
                        ? 'Bản nháp'
                        : 'Đã thay thế'}
                  </span>
                </div>
                <span className="catalog-version-tab-model">Model: {ver.modelCode}</span>
                <span className="catalog-version-tab-meta">
                  {ver.specificationCount} thông số
                  {ver.conflictCount > 0 ? ` · ⚠ ${ver.conflictCount} xung đột` : ''}
                </span>
              </button>
            )
          })}
        </div>

        {activeVersion && (
          <div className="catalog-active-version-box">
            <div className="catalog-active-version-head">
              <div>
                <div className="tender-card-meta">
                  <span className="tender-code">{activeVersion.versionLabel}</span>
                  <span
                    className={`catalog-status-pill ${versionStatusMeta[activeVersion.status].pillClass}`}
                  >
                    {versionStatusMeta[activeVersion.status].label}
                  </span>
                  <span className="catalog-fingerprint" title="Mã băm kiểm chứng tính toàn vẹn phiên bản">
                    Fingerprint: <code>{activeVersion.fingerprint}</code>
                  </span>
                </div>
                <h3>Model: {activeVersion.modelCode}</h3>
                <p className="muted">
                  {activeVersion.notes || versionStatusMeta[activeVersion.status].desc}
                </p>
                {activeVersion.publishedAt && (
                  <p className="muted">
                    Xuất bản lúc: {new Date(activeVersion.publishedAt).toLocaleString('vi-VN')}
                  </p>
                )}
              </div>

              {canWrite && (
                <div className="tender-action-row">
                  {isDraft ? (
                    <>
                      <button
                        className="button button-secondary"
                        type="button"
                        disabled={busy}
                        onClick={() => startEditVersionMeta(activeVersion)}
                      >
                        Sửa Model / Ghi chú
                      </button>
                      <button
                        className="button button-secondary"
                        type="button"
                        disabled={busy}
                        onClick={() => setAddingSpec((v) => !v)}
                      >
                        {addingSpec ? 'Đóng thêm thông số' : '+ Thêm thông số'}
                      </button>
                      <button
                        className="button button-primary"
                        type="button"
                        disabled={busy}
                        onClick={handlePublishVersion}
                      >
                        Xuất bản {activeVersion.versionLabel}
                      </button>
                    </>
                  ) : (
                    <span className="catalog-immutable-lock">
                      🔒 Đã khóa bất biến — Tạo phiên bản mới nếu cần cập nhật thông số
                    </span>
                  )}
                </div>
              )}
            </div>

            {editingVersionMeta && isDraft && canWrite && (
              <form
                className="tender-form"
                onSubmit={handleSaveVersionMeta}
                aria-label="Cập nhật model phiên bản"
              >
                <div className="tender-form-grid">
                  <label className="field">
                    <span>Mã Model thiết bị</span>
                    <input
                      required
                      maxLength={120}
                      value={verModel}
                      onChange={(event) => setVerModel(event.target.value)}
                    />
                  </label>
                  <label className="field">
                    <span>Ghi chú phiên bản</span>
                    <input
                      maxLength={2000}
                      value={verNotes}
                      onChange={(event) => setVerNotes(event.target.value)}
                    />
                  </label>
                </div>
                <div className="tender-form-actions">
                  <button
                    className="button button-secondary"
                    type="button"
                    onClick={() => setEditingVersionMeta(false)}
                  >
                    Hủy
                  </button>
                  <button className="button button-primary" disabled={busy} type="submit">
                    Lưu phiên bản
                  </button>
                </div>
              </form>
            )}

            {addingSpec && isDraft && canWrite && (
              <form
                className="tender-form"
                onSubmit={handleAddSpec}
                aria-label="Thêm thông số kỹ thuật"
              >
                <div className="tender-form-grid">
                  <label className="field">
                    <span>Tên thông số kỹ thuật (specKey)</span>
                    <input
                      required
                      maxLength={120}
                      value={specKey}
                      onChange={(event) => setSpecKey(event.target.value)}
                      placeholder="VD: Thời lượng pin dự phòng"
                    />
                  </label>
                  <label className="field">
                    <span>Giá trị thông số (specValue)</span>
                    <input
                      required
                      maxLength={1000}
                      value={specValue}
                      onChange={(event) => setSpecValue(event.target.value)}
                      placeholder="VD: ≥ 120"
                    />
                  </label>
                  <label className="field">
                    <span>Đơn vị tính</span>
                    <input
                      maxLength={50}
                      value={specUnit}
                      onChange={(event) => setSpecUnit(event.target.value)}
                      placeholder="VD: phút / inch / %"
                    />
                  </label>
                  <label className="field">
                    <span>Nguồn tài liệu (sourceLabel — Bắt buộc)</span>
                    <input
                      required
                      maxLength={200}
                      value={sourceLabel}
                      onChange={(event) => setSourceLabel(event.target.value)}
                      placeholder="VD: Brochure nhà sản xuất v2.1 (Trang 4)"
                    />
                  </label>
                  <label className="field field-wide">
                    <span>Trích dẫn nguyên văn từ tài liệu (sourceQuote)</span>
                    <input
                      maxLength={2000}
                      value={sourceQuote}
                      onChange={(event) => setSourceQuote(event.target.value)}
                      placeholder="VD: Rechargeable Li-ion battery providing at least 120 minutes of continuous monitoring"
                    />
                  </label>
                </div>
                <div className="tender-form-actions">
                  <button
                    className="button button-secondary"
                    type="button"
                    onClick={() => setAddingSpec(false)}
                  >
                    Hủy
                  </button>
                  <button className="button button-primary" disabled={busy} type="submit">
                    Lưu thông số & Nguồn
                  </button>
                </div>
              </form>
            )}

            <div className="catalog-spec-toolbar">
              <div className="catalog-spec-summary">
                <strong>
                  Danh sách thông số kỹ thuật ({activeVersion.specificationCount} thông số)
                </strong>
                {activeVersion.conflictCount > 0 && (
                  <span className="catalog-conflict-badge">
                    ⚠ Phát hiện {activeVersion.conflictCount} thông số có giá trị khác nhau giữa các nguồn tài liệu
                  </span>
                )}
              </div>

              {activeVersion.conflictCount > 0 && (
                <div className="tender-stage-filters">
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
              )}
            </div>

            {displayedSpecs.length === 0 ? (
              <div className="tender-empty">
                <h3>Chưa có thông số kỹ thuật nào trong phiên bản {activeVersion.versionLabel}</h3>
                <p className="muted">
                  {isDraft && canWrite
                    ? 'Nhấn "+ Thêm thông số" để khai báo thông số kỹ thuật kèm nguồn trích dẫn tài liệu.'
                    : 'Phiên bản này hiện chưa có thông số kỹ thuật được ghi nhận.'}
                </p>
              </div>
            ) : (
              <div className="tender-item-table" role="table" aria-label="Bảng thông số kỹ thuật có truy vết nguồn">
                {displayedSpecs.map((spec) =>
                  editingSpecId === spec.id && isDraft && canWrite ? (
                    <form
                      key={spec.id}
                      className="tender-form"
                      onSubmit={(event) => handleSaveSpec(event, spec.id)}
                    >
                      <div className="tender-form-grid">
                        <label className="field">
                          <span>Tên thông số</span>
                          <input
                            required
                            maxLength={120}
                            value={editSpecKey}
                            onChange={(e) => setEditSpecKey(e.target.value)}
                          />
                        </label>
                        <label className="field">
                          <span>Giá trị</span>
                          <input
                            required
                            maxLength={1000}
                            value={editSpecValue}
                            onChange={(e) => setEditSpecValue(e.target.value)}
                          />
                        </label>
                        <label className="field">
                          <span>Đơn vị</span>
                          <input
                            maxLength={50}
                            value={editSpecUnit}
                            onChange={(e) => setEditSpecUnit(e.target.value)}
                          />
                        </label>
                        <label className="field">
                          <span>Nguồn tài liệu</span>
                          <input
                            required
                            maxLength={200}
                            value={editSourceLabel}
                            onChange={(e) => setEditSourceLabel(e.target.value)}
                          />
                        </label>
                        <label className="field field-wide">
                          <span>Trích dẫn nguyên văn</span>
                          <input
                            maxLength={2000}
                            value={editSourceQuote}
                            onChange={(e) => setEditSourceQuote(e.target.value)}
                          />
                        </label>
                      </div>
                      <div className="tender-form-actions">
                        <button
                          className="button button-secondary"
                          type="button"
                          onClick={() => setEditingSpecId(null)}
                        >
                          Hủy
                        </button>
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
                          ? 'catalog-spec-row is-conflict'
                          : 'catalog-spec-row'
                      }
                      role="row"
                    >
                      <div className="catalog-spec-key" role="cell">
                        <strong>{spec.specKey}</strong>
                        {spec.hasConflict && (
                          <span className="catalog-conflict-badge">
                            ⚠ Xung đột giá trị giữa các nguồn
                          </span>
                        )}
                      </div>
                      <div className="catalog-spec-value" role="cell">
                        <strong>
                          {spec.specValue}
                          {spec.unit ? ` ${spec.unit}` : ''}
                        </strong>
                      </div>
                      <div className="catalog-spec-source" role="cell">
                        <span className="catalog-source-pill">Nguồn: {spec.sourceLabel}</span>
                        {spec.sourceQuote && <p className="muted">“{spec.sourceQuote}”</p>}
                      </div>
                      {isDraft && canWrite && (
                        <div className="tender-item-actions" role="cell">
                          <button
                            className="button button-secondary button-icon"
                            type="button"
                            disabled={busy}
                            onClick={() => startEditSpec(spec)}
                            aria-label={`Sửa thông số ${spec.specKey}`}
                            title="Sửa thông số"
                          >
                            <EditIcon />
                          </button>
                          <button
                            className="button button-danger button-icon"
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
                  ),
                )}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
