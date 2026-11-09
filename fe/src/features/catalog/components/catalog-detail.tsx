'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState, type FormEvent } from 'react'

import { ApiError } from '../../../lib/api/client'
import { ConfirmDialog } from '../../../components/ui/confirm-dialog'
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
import { getDocumentDownloadLink, listDocuments, type DocumentDetail } from '../../documents/api'
import { UploadWizardModal } from '../../documents/components/upload-wizard-modal'

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
  const [pendingDeleteSpec, setPendingDeleteSpec] = useState<ProductSpecification | null>(null)
  const [savingSpecBusy, setSavingSpecBusy] = useState(false)

  const [onlyConflicts, setOnlyConflicts] = useState(false)

  // Step 05: Linked documents state
  const [linkedDocs, setLinkedDocs] = useState<DocumentDetail[]>([])
  const [docsLoading, setDocsLoading] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)

  const loadDocs = useCallback(async () => {
    setDocsLoading(true)
    try {
      const docs = await listDocuments(slug, { productId })
      setLinkedDocs(docs)
    } catch {
      setLinkedDocs([])
    } finally {
      setDocsLoading(false)
    }
  }, [slug, productId])

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
    void loadDocs()
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

  const visibleVersions = canWrite
    ? product.versions
    : product.versions.filter((v) => v.status !== 'DRAFT')

  const activeVersion: ProductVersionDetail | null =
    visibleVersions.find((v) => v.id === selectedVersionId) ?? visibleVersions[0] ?? null
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
    if (!canWrite || !activeVersion || savingSpecBusy) return
    const savedName = specKey.trim()
    setBusy(true)
    setSavingSpecBusy(true)
    setError(null)
    setNotice(null)
    try {
      await addCatalogSpecification(slug, productId, activeVersion.id, {
        specKey: savedName,
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
      setNotice(`Đã lưu thông số kỹ thuật "${savedName}" kèm truy vết nguồn vào ${activeVersion.versionLabel}.`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không thêm được thông số kỹ thuật.')
    } finally {
      setBusy(false)
      setSavingSpecBusy(false)
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
    if (!canWrite || !activeVersion || savingSpecBusy) return
    const savedName = editSpecKey.trim()
    setBusy(true)
    setSavingSpecBusy(true)
    setError(null)
    setNotice(null)
    try {
      await updateCatalogSpecification(slug, productId, activeVersion.id, specId, {
        specKey: savedName,
        specValue: editSpecValue.trim(),
        unit: editSpecUnit.trim() || null,
        sourceLabel: editSourceLabel.trim(),
        sourceQuote: editSourceQuote.trim() || null,
      })
      setEditingSpecId(null)
      await loadProduct(activeVersion.id)
      setNotice(`Đã cập nhật thông số kỹ thuật "${savedName}" và nguồn tài liệu.`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không cập nhật được thông số.')
    } finally {
      setBusy(false)
      setSavingSpecBusy(false)
    }
  }

  async function confirmDeleteSpec() {
    if (!canWrite || !activeVersion || !pendingDeleteSpec) return
    const target = pendingDeleteSpec
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      await removeCatalogSpecification(slug, productId, activeVersion.id, target.id)
      setPendingDeleteSpec(null)
      setOnlyConflicts(false)
      await loadProduct(activeVersion.id)
      setNotice(`Đã xóa thông số "${target.specKey}" (Nguồn: ${target.sourceLabel}) khỏi ${activeVersion.versionLabel}.`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không xóa được thông số.')
    } finally {
      setBusy(false)
    }
  }

  const effectiveOnlyConflicts = onlyConflicts && (activeVersion?.conflictCount ?? 0) > 0
  const displayedSpecs = activeVersion
    ? effectiveOnlyConflicts
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
                {busy ? 'Đang lưu thay đổi…' : 'Lưu thay đổi'}
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
              {busy ? 'Đang khởi tạo phiên bản…' : 'Khởi tạo phiên bản mới'}
            </button>
          </div>
        </form>
      )}

      <div className="tender-subtabs-bar">
        <div className="tender-subtabs" role="tablist" aria-label="Danh sách phiên bản sản phẩm">
          {visibleVersions.map((ver) => {
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
                  setOnlyConflicts(false)
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
              {busy ? 'Đang xuất bản…' : `Xuất bản ${activeVersion.versionLabel}`}
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

            {!isDraft ? (
              <span className="catalog-immutable-lock">
                🔒 Đã khóa bất biến — Tạo phiên bản mới nếu cần cập nhật thông số
              </span>
            ) : (
              <span className="catalog-immutable-lock">
                👁 Bản nháp nội bộ (Chỉ người quản lý Catalog mới thấy — Xuất bản để mở cho toàn tổ chức)
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
                  {busy ? 'Đang lưu phiên bản…' : 'Lưu phiên bản'}
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
                <button className="button button-primary" disabled={busy || savingSpecBusy} type="submit">
                  {savingSpecBusy ? 'Đang lưu thông số & nguồn…' : 'Lưu thông số & Nguồn'}
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
                      <button className="button button-primary" disabled={busy || savingSpecBusy} type="submit">
                        {savingSpecBusy ? 'Đang lưu thông số…' : 'Lưu thông số'}
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
                            onClick={() => setPendingDeleteSpec(spec)}
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

      {/* Step 05: Linked Documents & Evidence Section */}
      <section className="surface tender-list-panel" style={{ marginTop: '1.5rem' }} aria-label="Tài liệu và bằng chứng kỹ thuật">
        <div className="tender-entry-heading">
          <div>
            <strong>Tài liệu & Brochure kỹ thuật đính kèm ({linkedDocs.length})</strong>
            <p className="muted">
              Catalogue, hướng dẫn sử dụng và chứng chỉ CFS/ISO liên kết trực tiếp với thiết bị này để phục vụ đối chiếu thông số.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <button
              type="button"
              className={docsLoading ? 'tender-icon-button is-spinning' : 'tender-icon-button'}
              onClick={() => void loadDocs()}
              disabled={docsLoading}
              aria-label="Làm mới tài liệu"
              title="Làm mới danh sách tài liệu"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
                <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                <path d="M16 16h5v5" />
              </svg>
            </button>
            {canWrite && (
              <button
                className="button button-primary tender-add-lot-btn"
                type="button"
                onClick={() => setShowUploadModal(true)}
              >
                + Tải Brochure
              </button>
            )}
          </div>
        </div>

        {docsLoading && linkedDocs.length === 0 ? (
          <div className="tender-skeleton-list"><i /><i /></div>
        ) : linkedDocs.length === 0 ? (
          <div className="tender-empty-state" style={{ padding: '2rem 1rem', textAlign: 'center' }}>
            <p className="muted" style={{ marginBottom: '0.75rem' }}>
              Chưa có tài liệu hoặc Brochure nào được gắn với thiết bị này.
            </p>
            {canWrite && (
              <button
                type="button"
                className="button button-secondary"
                style={{ fontSize: '13px' }}
                onClick={() => setShowUploadModal(true)}
              >
                + Tải Catalogue đầu tiên
              </button>
            )}
          </div>
        ) : (
          <ul className="organization-list tender-cards-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
            {linkedDocs.map((doc) => {
              const latest = doc.latestVersion
              const isClean = latest?.scanStatus === 'CLEAN'
              const isQuarantined = latest?.scanStatus === 'QUARANTINED'

              return (
                <li key={doc.id} style={{ listStyle: 'none' }}>
                  <div className={`doc-vault-card${isQuarantined ? ' is-quarantined' : ''}`}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                        <strong className="doc-vault-title" style={{ fontSize: '1rem' }}>{doc.title}</strong>
                        <span
                          className={`doc-class-badge ${
                            doc.classification === 'CONFIDENTIAL' ? 'confidential' : 'internal'
                          }`}
                        >
                          {doc.classification}
                        </span>
                        {isClean ? (
                          <span className="doc-status-pill is-clean" style={{ fontSize: '10px', padding: '2px 8px' }}>
                            ✓ SHA-256 Sạch
                          </span>
                        ) : isQuarantined ? (
                          <span className="doc-status-pill is-quarantined" style={{ fontSize: '10px', padding: '2px 8px' }}>
                            ⚠ Đã cách ly
                          </span>
                        ) : null}
                      </div>
                      {latest && (
                        <div className="doc-meta-row">
                          <span className="doc-filename-badge">{latest.originalFilename}</span>
                          <span>{latest.versionLabel}</span>
                          <span>{new Date(doc.createdAt).toLocaleDateString('vi-VN')}</span>
                        </div>
                      )}
                    </div>

                    {isClean && latest && (
                      <button
                        type="button"
                        className="button button-secondary"
                        style={{ fontSize: '12px', padding: '6px 14px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                        onClick={async () => {
                          try {
                            const link = await getDocumentDownloadLink(slug, doc.id, latest.id)
                            const a = document.createElement('a')
                            a.href = link.downloadUrl
                            a.download = latest.originalFilename
                            document.body.appendChild(a)
                            a.click()
                            document.body.removeChild(a)
                          } catch {
                            alert('Không thể tạo link tải xuống.')
                          }
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        Tải xuống
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {showUploadModal && (
        <UploadWizardModal
          slug={slug}
          defaultProductId={productId}
          onSuccess={() => {
            setShowUploadModal(false)
            void loadDocs()
          }}
          onClose={() => setShowUploadModal(false)}
        />
      )}

      <ConfirmDialog
        open={Boolean(pendingDeleteSpec)}
        badge={activeVersion ? `${product.sku} · ${activeVersion.versionLabel}` : product.sku}
        title={
          pendingDeleteSpec
            ? `Xóa thông số "${pendingDeleteSpec.specKey}"?`
            : 'Xác nhận xóa thông số'
        }
        description={
          pendingDeleteSpec
            ? `Thông số có giá trị "${pendingDeleteSpec.specValue}${pendingDeleteSpec.unit ? ` ${pendingDeleteSpec.unit}` : ''}" trích dẫn từ nguồn "${pendingDeleteSpec.sourceLabel}" sẽ bị xóa khỏi phiên bản nháp ${activeVersion?.versionLabel ?? ''}.`
            : ''
        }
        busy={busy}
        onCancel={() => setPendingDeleteSpec(null)}
        onConfirm={() => void confirmDeleteSpec()}
      />
    </div>
  )
}
