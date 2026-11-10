'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ApiError } from '../../../lib/api/client'
import {
  loadResource,
  readResource,
  writeResource,
  invalidateResource,
} from '../../../lib/api/resource-cache'
import {
  canManageDocuments,
  useWorkspaceRole,
} from '../../organizations/workspace-permissions'
import {
  acceptPolicyConsent,
  deleteDocument,
  getDocumentDownloadLink,
  getPolicyConsentStatus,
  listDocuments,
  type DocumentDetail,
  type PolicyConsentStatus,
} from '../api'
import { PolicyConsentModal } from './policy-consent-modal'
import { UploadWizardModal } from './upload-wizard-modal'

type DocTypeFilter = 'ALL' | 'TENDER_DOC' | 'CATALOG_EVIDENCE' | 'CERTIFICATE' | 'OTHER'
type ClassificationFilter = 'ALL' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED'

const docTypeShortBadges: Record<string, string> = {
  TENDER_DOC: 'E-HSMT',
  CATALOG_EVIDENCE: 'BROCHURE',
  CERTIFICATE: 'CFS / ISO',
  OTHER: 'TÀI LIỆU',
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function DocumentsManagementView({ slug }: { slug: string }) {
  const role = useWorkspaceRole()
  const canUpload = canManageDocuments(role)
  const isOwner = role === 'OWNER'

  const docsCacheKey = `documents:${slug}`
  const consentCacheKey = `consent:${slug}`

  const cachedDocs = readResource<DocumentDetail[]>(docsCacheKey)
  const cachedConsent = readResource<PolicyConsentStatus>(consentCacheKey)

  const [documents, setDocuments] = useState<DocumentDetail[]>(cachedDocs ?? [])
  const [loading, setLoading] = useState(cachedDocs === undefined)
  const [error, setError] = useState<string | null>(null)
  const [docToDelete, setDocToDelete] = useState<DocumentDetail | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<DocTypeFilter>('ALL')
  const [classFilter, setClassFilter] = useState<ClassificationFilter>('ALL')

  // Policy consent status & modals
  const [consentStatus, setConsentStatus] = useState<PolicyConsentStatus | null>(cachedConsent ?? null)
  const [showConsentModal, setShowConsentModal] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)

  const loadData = useCallback(async (force = false) => {
    if (force) {
      invalidateResource(docsCacheKey)
      invalidateResource(consentCacheKey)
      setLoading(true)
    }
    try {
      const [docs, consent] = await Promise.all([
        force ? listDocuments(slug) : loadResource(docsCacheKey, () => listDocuments(slug)),
        force ? getPolicyConsentStatus(slug) : loadResource(consentCacheKey, () => getPolicyConsentStatus(slug)),
      ])
      writeResource(docsCacheKey, docs)
      writeResource(consentCacheKey, consent)
      setDocuments(docs)
      setConsentStatus(consent)
      setError(null)
    } catch (err: unknown) {
      if (!readResource(docsCacheKey)) {
        setError(err instanceof ApiError ? err.message : 'Không tải được danh sách tài liệu.')
      }
    } finally {
      setLoading(false)
    }
  }, [slug, docsCacheKey, consentCacheKey])

  useEffect(() => {
    let active = true
    Promise.all([
      loadResource(docsCacheKey, () => listDocuments(slug)),
      loadResource(consentCacheKey, () => getPolicyConsentStatus(slug)),
    ])
      .then(([docs, consent]) => {
        if (!active) return
        writeResource(docsCacheKey, docs)
        writeResource(consentCacheKey, consent)
        setDocuments(docs)
        setConsentStatus(consent)
        setError(null)
      })
      .catch((err: unknown) => {
        if (!active) return
        if (!readResource(docsCacheKey)) {
          setError(err instanceof ApiError ? err.message : 'Không tải được danh sách tài liệu.')
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [slug, docsCacheKey, consentCacheKey])

  function handleOpenUpload() {
    if (consentStatus && !consentStatus.hasConsented) {
      setShowConsentModal(true)
    } else {
      setShowUploadModal(true)
    }
  }

  async function handleAcceptConsent() {
    if (!consentStatus) return
    const updated = await acceptPolicyConsent(slug, {
      policyVersion: consentStatus.currentPolicyVersion,
      termsAccepted: true,
      privacyAccepted: true,
      aiNoticeAccepted: true,
    })
    setConsentStatus(updated)
    setShowConsentModal(false)
    setShowUploadModal(true)
  }

  async function handleDownload(docId: string, versionId: string, fileName: string) {
    try {
      const link = await getDocumentDownloadLink(slug, docId, versionId)
      const a = document.createElement('a')
      a.href = link.downloadUrl
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } catch (err: unknown) {
      alert(err instanceof ApiError ? err.message : 'Không thể tạo link tải xuống.')
    }
  }

  function handleDelete(doc: DocumentDetail) {
    setDocToDelete(doc)
    setDeleteError(null)
  }

  async function handleConfirmDelete() {
    if (!docToDelete) return
    setIsDeleting(true)
    setDeleteError(null)
    try {
      await deleteDocument(slug, docToDelete.id)
      setDocToDelete(null)
      await loadData(true)
    } catch (err: unknown) {
      setDeleteError(err instanceof ApiError ? err.message : 'Không thể xóa tài liệu.')
    } finally {
      setIsDeleting(false)
    }
  }

  // Filtered documents
  const filteredDocuments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return documents.filter((doc) => {
      if (typeFilter !== 'ALL' && doc.documentType !== typeFilter) return false
      if (classFilter !== 'ALL' && doc.classification !== classFilter) return false
      if (q) {
        const titleMatch = doc.title.toLowerCase().includes(q)
        const fileMatch = doc.latestVersion?.originalFilename?.toLowerCase().includes(q)
        const shaMatch = doc.latestVersion?.sha256?.toLowerCase().includes(q)
        if (!titleMatch && !fileMatch && !shaMatch) return false
      }
      return true
    })
  }, [documents, searchQuery, typeFilter, classFilter])

  const hasFilters = searchQuery.trim() !== '' || typeFilter !== 'ALL' || classFilter !== 'ALL'

  return (
    <section className="surface tender-list-panel" aria-busy={loading}>
      {/* Header bar */}
      <div className="tender-list-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
            <p className="eyebrow" style={{ margin: 0 }}>KHO LƯU TRỮ AN TOÀN · BƯỚC 05</p>
            {consentStatus?.hasConsented && (
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '999px',
                  background: 'rgba(42, 157, 143, 0.12)',
                  color: 'var(--accent, #2a9d8f)',
                  border: '1px solid rgba(42, 157, 143, 0.25)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
                title="Tổ chức đã xác nhận và tuân thủ Điều khoản pháp lý và Chính sách dữ liệu AI y tế"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Pháp lý & AI {consentStatus.currentPolicyVersion}
              </span>
            )}
          </div>
          <h2 style={{ marginTop: '0.35rem' }}>Tài liệu & Bằng chứng nguồn ({documents.length})</h2>
          <p className="tender-list-lead">
            Lưu trữ tệp gốc E-HSMT, Brochure kỹ thuật và Giấy phép CFS có xác minh SHA-256, cách ly mã độc và cấp link 1 lần.
          </p>
        </div>

        <div className="tender-list-actions">
          {isOwner && (
            <Link
              href={`/${slug}/quan-tri-to-chuc`}
              className="button button-secondary"
              style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              🛡️ Sổ cái sự cố bảo mật
            </Link>
          )}

          {/* Reset button: spins only inner SVG, container never rotates */}
          <button
            type="button"
            className={loading ? 'tender-icon-button is-spinning' : 'tender-icon-button'}
            onClick={() => void loadData(true)}
            disabled={loading}
            aria-label="Làm mới danh sách"
            title="Làm mới danh sách tài liệu"
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

          {canUpload && (
            <button
              type="button"
              className="button button-primary"
              onClick={handleOpenUpload}
            >
              + Tải tài liệu lên
            </button>
          )}
        </div>
      </div>

      {role === 'VIEWER' && (
        <div className="viewer-role-banner" role="status">
          <div className="viewer-role-banner-icon">🛡️</div>
          <div className="viewer-role-banner-content">
            <strong>Bạn đang xem với vai trò Chỉ xem (VIEWER)</strong>
            <p>
              Theo chính sách phân quyền RBAC & Zero-Trust, tài khoản vai trò VIEWER không có quyền tải lên tài liệu mới. Để đảm bảo an toàn dữ liệu nội bộ, các tài liệu phân loại <strong>Tuyệt mật (RESTRICTED)</strong> và các tệp trong diện <strong>Cách ly (Quarantined)</strong> được ẩn tự động. Nếu cần cấp lại quyền hoặc phục hồi vai trò sau khi kiểm tra sự cố bảo mật, vui lòng liên hệ <strong>ADMIN</strong> hoặc <strong>OWNER</strong> của tổ chức.
            </p>
          </div>
        </div>
      )}

      {error && (
        <p className="notice notice-error" role="alert">
          {error}
        </p>
      )}

      {/* Spacious 2-row Toolbar */}
      <div
        className="tender-toolbar"
        role="search"
        aria-label="Tìm kiếm và lọc tài liệu"
        style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%' }}>
          <label className="tender-search-box" style={{ flex: 1, margin: 0 }}>
            <span className="sr-only">Tìm theo tên tài liệu hoặc mã hash SHA-256</span>
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo tên tài liệu, tên file gốc hoặc mã hash SHA-256…"
              aria-label="Tìm kiếm tài liệu"
            />
          </label>
          {hasFilters && (
            <button
              type="button"
              className="tender-text-button"
              onClick={() => {
                setSearchQuery('')
                setTypeFilter('ALL')
                setClassFilter('ALL')
              }}
            >
              Xóa bộ lọc
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div className="tender-stage-tabs" role="group" aria-label="Lọc theo loại tài liệu">
            {(
              [
                ['ALL', 'Tất cả'],
                ['TENDER_DOC', 'E-HSMT'],
                ['CATALOG_EVIDENCE', 'Brochure'],
                ['CERTIFICATE', 'CFS / ISO'],
                ['OTHER', 'Khác'],
              ] as const
            ).map(([typeKey, label]) => (
              <button
                key={typeKey}
                type="button"
                className={typeFilter === typeKey ? 'tender-filter-chip is-active' : 'tender-filter-chip'}
                aria-pressed={typeFilter === typeKey}
                onClick={() => setTypeFilter(typeKey)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="tender-stage-tabs" role="group" aria-label="Lọc theo mức bảo mật">
            {(
              [
                ['ALL', 'Mọi bảo mật'],
                ['INTERNAL', 'INTERNAL'],
                ['CONFIDENTIAL', 'CONFIDENTIAL'],
                ['RESTRICTED', 'RESTRICTED'],
              ] as const
            ).map(([cKey, label]) => (
              <button
                key={cKey}
                type="button"
                className={classFilter === cKey ? 'tender-filter-chip is-active' : 'tender-filter-chip'}
                aria-pressed={classFilter === cKey}
                onClick={() => setClassFilter(cKey)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {loading && documents.length === 0 ? (
        <div className="tender-skeleton-list" aria-label="Đang tải danh sách tài liệu" aria-busy="true">
          <i />
          <i />
          <i />
          <i />
        </div>
      ) : documents.length === 0 ? (
        <div className="tender-empty-state" style={{ padding: '3.5rem 1rem', textAlign: 'center' }}>
          <div
            style={{
              width: '54px',
              height: '54px',
              borderRadius: '50%',
              background: 'rgba(42, 157, 143, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem',
              fontSize: '24px',
              color: 'var(--accent, #2a9d8f)',
            }}
          >
            ▤
          </div>
          <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Chưa có tài liệu nào trong kho lưu trữ an toàn</h3>
          <p className="muted" style={{ maxWidth: '480px', margin: '0 auto 1.5rem', lineHeight: 1.5 }}>
            Tải lên tệp E-HSMT gói thầu, Catalogue brochure thiết bị hoặc Giấy phép lưu hành CFS để hệ thống kiểm định SHA-256 và phục vụ đối chiếu thông số.
          </p>
          {canUpload && (
            <button
              type="button"
              className="button button-primary"
              onClick={handleOpenUpload}
            >
              + Tải tài liệu đầu tiên
            </button>
          )}
        </div>
      ) : filteredDocuments.length === 0 ? (
        <div className="tender-empty-filter" style={{ padding: '2.5rem 1rem', textAlign: 'center' }}>
          <p className="muted" style={{ marginBottom: '1rem' }}>Không tìm thấy tài liệu nào khớp với bộ lọc hiện tại.</p>
          {hasFilters && (
            <button
              type="button"
              className="tender-text-button"
              onClick={() => {
                setSearchQuery('')
                setTypeFilter('ALL')
                setClassFilter('ALL')
              }}
            >
              Xóa bộ lọc
            </button>
          )}
        </div>
      ) : (
        <ul className="organization-list tender-cards-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {filteredDocuments.map((doc) => {
            const latest = doc.latestVersion
            const isClean = latest?.scanStatus === 'CLEAN'
            const isQuarantined = latest?.scanStatus === 'QUARANTINED'

            const mime = latest?.mimeType?.toLowerCase() ?? ''
            const fileTypeBadge = mime.includes('pdf')
              ? 'PDF'
              : mime.includes('sheet') || mime.includes('excel') || mime.includes('xlsx')
                ? 'XLSX'
                : mime.includes('word') || mime.includes('docx')
                  ? 'DOCX'
                  : 'TỆP'

            return (
              <li key={doc.id} style={{ listStyle: 'none' }}>
                <div className={`doc-vault-card${isQuarantined ? ' is-quarantined' : ''}`}>
                  {/* Left: File icon with status indicator pip */}
                  <div className={`doc-vault-icon-box${isClean ? ' is-clean' : isQuarantined ? ' is-quarantined' : ''}`}>
                    <span>{fileTypeBadge}</span>
                    <span
                      className={`doc-vault-pip ${isClean ? 'is-clean' : isQuarantined ? 'is-quarantined' : 'is-pending'}`}
                      title={isClean ? 'Tệp sạch đã xác minh' : isQuarantined ? 'Đã cách ly mã độc' : 'Chưa hoàn tất'}
                    />
                  </div>

                  {/* Main: Title & Structured Details */}
                  <div className="doc-vault-main">
                    {/* Top Row: Title + Badges */}
                    <div className="doc-vault-top-row">
                      <div className="doc-vault-heading-group">
                        <strong className="doc-vault-title">
                          {doc.title}
                        </strong>

                        {/* Doc Type Badge */}
                        <span className="doc-type-badge">
                          {docTypeShortBadges[doc.documentType] ?? doc.documentType}
                        </span>

                        {/* Classification Badge */}
                        <span
                          className={`doc-class-badge ${
                            doc.classification === 'RESTRICTED'
                              ? 'restricted'
                              : doc.classification === 'CONFIDENTIAL'
                                ? 'confidential'
                                : 'internal'
                          }`}
                        >
                          {doc.classification}
                        </span>
                      </div>

                      {/* Security Status Pill */}
                      {isClean ? (
                        <span className="doc-status-pill is-clean">
                          ✓ SHA-256 Hợp lệ · Sạch
                        </span>
                      ) : isQuarantined ? (
                        <span className="doc-status-pill is-quarantined">
                          ⚠ Đã cách ly mã độc
                        </span>
                      ) : (
                        <span className="doc-status-pill is-pending">
                          ● Chưa hoàn tất tải lên
                        </span>
                      )}
                    </div>

                    {/* Middle Row: Linked Context (Tender or Product) */}
                    {(doc.tender || doc.product) && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {doc.tender && (
                          <span className="doc-linked-tag tender">
                            📁 Gói thầu: {doc.tender.reference ? `[${doc.tender.reference}] ` : ''}
                            {doc.tender.title}
                          </span>
                        )}
                        {doc.product && (
                          <span className="doc-linked-tag catalog">
                            🏷️ Catalog: [{doc.product.sku}] {doc.product.name}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Bottom Row: File Technical Metadata */}
                    {latest && (
                      <div className="doc-meta-row">
                        <span className="doc-filename-badge">
                          {latest.originalFilename}
                        </span>
                        <span>{formatBytes(latest.sizeBytes)}</span>
                        <span className="doc-hash-badge" title={`SHA-256: ${latest.sha256}`}>
                          SHA: {latest.sha256.slice(0, 12)}…{latest.sha256.slice(-6)}
                        </span>
                        <span>Phiên bản: {latest.versionLabel}</span>
                        <span>Tải lên: {new Date(doc.createdAt).toLocaleDateString('vi-VN')}</span>
                      </div>
                    )}
                  </div>

                  {/* Right Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexShrink: 0 }}>
                    {isClean && latest ? (
                      <button
                        type="button"
                        className="button button-secondary"
                        style={{
                          fontSize: '12px',
                          padding: '6px 14px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontWeight: 600,
                        }}
                        onClick={() => handleDownload(doc.id, latest.id, latest.originalFilename)}
                      >
                        <svg
                          viewBox="0 0 24 24"
                          width="14"
                          height="14"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        Tải xuống
                      </button>
                    ) : isQuarantined ? (
                      <span className="doc-quarantined-alert-pill">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                        Đã khóa tải
                      </span>
                    ) : (
                      <span className="muted" style={{ fontSize: '12px' }}>
                        Chưa hoàn tất
                      </span>
                    )}

                    {canUpload && (
                      <button
                        type="button"
                        className="tender-icon-button"
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '8px',
                          opacity: 0.8,
                        }}
                        onClick={() => handleDelete(doc)}
                        title="Xóa tài liệu khỏi kho"
                        aria-label="Xóa tài liệu"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          width="14"
                          height="14"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M3 6h18" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                          <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {/* Custom Delete Confirmation Modal */}
      {docToDelete && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(6px)',
            padding: '1rem',
          }}
        >
          <div
            className="surface"
            style={{
              maxWidth: '480px',
              width: '100%',
              borderRadius: '16px',
              padding: '1.75rem',
              boxShadow: '0 24px 48px rgba(0, 0, 0, 0.5)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '10px',
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ef4444',
                  fontSize: '20px',
                  flexShrink: 0,
                }}
              >
                ⚠
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--heading)' }}>Xác nhận xóa tài liệu</h3>
                <p style={{ margin: '0.15rem 0 0', fontSize: '0.785rem', color: 'var(--muted)' }}>
                  Hành động bảo mật không thể hoàn tác
                </p>
              </div>
            </div>

            <p style={{ fontSize: '0.9rem', lineHeight: 1.5, color: 'var(--ink)', margin: '0 0 1rem' }}>
              Bạn có chắc chắn muốn xóa vĩnh viễn tài liệu <strong>&ldquo;{docToDelete.title}&rdquo;</strong> khỏi kho lưu trữ an toàn của tổ chức?
            </p>

            <div
              style={{
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                fontSize: '0.8rem',
                color: '#f87171',
                lineHeight: 1.45,
                marginBottom: '1.25rem',
              }}
            >
              Toàn bộ phiên bản tệp, dữ liệu kiểm định SHA-256 và bằng chứng đối chiếu liên quan sẽ bị xóa khỏi hệ thống.
            </div>

            {deleteError && (
              <p className="notice notice-error" style={{ marginBottom: '1rem', fontSize: '0.825rem' }}>
                {deleteError}
              </p>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => {
                  setDocToDelete(null)
                  setDeleteError(null)
                }}
                disabled={isDeleting}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                className="button"
                style={{
                  background: '#ef4444',
                  color: '#ffffff',
                  border: 'none',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                  opacity: isDeleting ? 0.7 : 1,
                }}
                onClick={() => void handleConfirmDelete()}
                disabled={isDeleting}
              >
                {isDeleting ? 'Đang xóa…' : 'Xóa tài liệu'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {showConsentModal && consentStatus && (
        <PolicyConsentModal
          status={consentStatus}
          onAccept={handleAcceptConsent}
          onClose={() => setShowConsentModal(false)}
        />
      )}

      {showUploadModal && (
        <UploadWizardModal
          slug={slug}
          onSuccess={() => {
            setShowUploadModal(false)
            void loadData(true)
          }}
          onClose={() => setShowUploadModal(false)}
        />
      )}
    </section>
  )
}
