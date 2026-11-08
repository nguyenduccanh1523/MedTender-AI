'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ApiError } from '../../../lib/api/client'
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

  const [documents, setDocuments] = useState<DocumentDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [docToDelete, setDocToDelete] = useState<DocumentDetail | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<DocTypeFilter>('ALL')
  const [classFilter, setClassFilter] = useState<ClassificationFilter>('ALL')

  // Policy consent status & modals
  const [consentStatus, setConsentStatus] = useState<PolicyConsentStatus | null>(null)
  const [showConsentModal, setShowConsentModal] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)

  // Download countdown toast (120s signed link)
  const [downloadToast, setDownloadToast] = useState<{
    fileName: string
    url: string
    secondsLeft: number
  } | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [docs, consent] = await Promise.all([
        listDocuments(slug),
        getPolicyConsentStatus(slug),
      ])
      setDocuments(docs)
      setConsentStatus(consent)
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : 'Không tải được danh sách tài liệu.')
    } finally {
      setLoading(false)
    }
  }, [slug])

  useEffect(() => {
    let active = true
    Promise.all([listDocuments(slug), getPolicyConsentStatus(slug)])
      .then(([docs, consent]) => {
        if (active) {
          setDocuments(docs)
          setConsentStatus(consent)
          setLoading(false)
        }
      })
      .catch((err: unknown) => {
        if (active) {
          setError(err instanceof ApiError ? err.message : 'Không tải được danh sách tài liệu.')
          setLoading(false)
        }
      })
    return () => {
      active = false
    }
  }, [slug])

  // Countdown timer for 120s signed download link
  useEffect(() => {
    if (!downloadToast) return
    const interval = setInterval(() => {
      setDownloadToast((prev) => {
        if (!prev || prev.secondsLeft <= 1) return null
        return { ...prev, secondsLeft: prev.secondsLeft - 1 }
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [downloadToast])

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
      setDownloadToast({
        fileName,
        url: link.downloadUrl,
        secondsLeft: link.expiresInSeconds,
      })
      const a = document.createElement('a')
      a.href = link.downloadUrl
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } catch (err: unknown) {
      alert(err instanceof ApiError ? err.message : 'Không thể tạo link tải an toàn.')
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
      await loadData()
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
      {/* 120-second Signed Link Countdown Toast */}
      {downloadToast && (
        <aside
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 9999,
            padding: '16px 20px',
            borderRadius: '14px',
            boxShadow: '0 16px 36px rgba(0, 0, 0, 0.45)',
            background: 'var(--card, #131922)',
            border: '1px solid var(--accent, #2a9d8f)',
            maxWidth: '380px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span
              style={{
                fontSize: '12px',
                fontWeight: 700,
                color: 'var(--accent, #2a9d8f)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: 'var(--accent, #2a9d8f)',
                }}
              />
              ĐÃ CẤP LINK TẢI 1 LẦN
            </span>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: '999px',
                background: 'rgba(42, 157, 143, 0.2)',
                color: 'var(--accent, #2a9d8f)',
                border: '1px solid rgba(42, 157, 143, 0.3)',
              }}
            >
              Tự hủy sau: {downloadToast.secondsLeft}s
            </span>
          </div>
          <div
            style={{
              fontSize: '13px',
              fontWeight: 600,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              color: 'var(--foreground, #fff)',
            }}
          >
            {downloadToast.fileName}
          </div>
          <p style={{ fontSize: '11px', color: 'var(--muted, #94a3b8)', margin: 0, lineHeight: 1.4 }}>
            Link ký số an toàn (TTL 120s), chỉ tải được một lần và tự hủy sau khi tải để bảo vệ tài liệu thầu.
          </p>
        </aside>
      )}

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
            onClick={() => void loadData()}
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
        <ul className="organization-list tender-cards-list">
          {filteredDocuments.map((doc) => {
            const latest = doc.latestVersion
            const isClean = latest?.scanStatus === 'CLEAN'
            const isQuarantined = latest?.scanStatus === 'QUARANTINED'
            const isPending = latest?.scanStatus === 'PENDING' || latest?.scanStatus === 'SCANNING'

            return (
              <li key={doc.id}>
                <div
                  className="tender-list-card catalog-list-card"
                  style={{
                    padding: '1.1rem 1.35rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1.1rem',
                  }}
                >
                  {/* Left file icon */}
                  <div
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '10px',
                      background: isClean
                        ? 'rgba(42, 157, 143, 0.12)'
                        : isQuarantined
                          ? 'rgba(239, 68, 68, 0.12)'
                          : 'rgba(255, 255, 255, 0.05)',
                      border: `1px solid ${
                        isClean
                          ? 'rgba(42, 157, 143, 0.3)'
                          : isQuarantined
                            ? 'rgba(239, 68, 68, 0.3)'
                            : 'rgba(255, 255, 255, 0.1)'
                      }`,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      color: isClean ? 'var(--accent, #2a9d8f)' : isQuarantined ? '#ef4444' : 'var(--muted)',
                    }}
                  >
                    <span style={{ fontSize: '10px', fontWeight: 800 }}>
                      {latest?.mimeType?.includes('pdf')
                        ? 'PDF'
                        : latest?.mimeType?.includes('sheet')
                          ? 'XLS'
                          : 'DOC'}
                    </span>
                    <span style={{ fontSize: '11px', marginTop: '-2px' }}>▤</span>
                  </div>

                  {/* Main content */}
                  <div className="tender-list-card-main" style={{ flex: 1, minWidth: 0 }}>
                    <div
                      className="catalog-card-badges"
                      style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px', marginBottom: '0.4rem' }}
                    >
                      {/* Document Type Badge */}
                      <span className="tender-lot-code">
                        {docTypeShortBadges[doc.documentType] ?? doc.documentType}
                      </span>

                      {/* Classification Badge */}
                      <span
                        className={
                          doc.classification === 'RESTRICTED'
                            ? 'catalog-status-pill is-superseded'
                            : doc.classification === 'CONFIDENTIAL'
                              ? 'catalog-status-pill is-draft'
                              : 'catalog-status-pill is-published'
                        }
                      >
                        {doc.classification}
                      </span>

                      {/* Security Scan Status */}
                      {isClean ? (
                        <span
                          className="catalog-category-pill"
                          style={{
                            background: 'rgba(34, 197, 94, 0.12)',
                            color: '#22c55e',
                            border: '1px solid rgba(34, 197, 94, 0.25)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <span style={{ fontSize: '10px' }}>✓</span> SHA-256 Khớp · Sạch
                        </span>
                      ) : isQuarantined ? (
                        <span
                          className="catalog-conflict-badge"
                          style={{
                            background: 'rgba(239, 68, 68, 0.15)',
                            color: '#ef4444',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                          }}
                        >
                          ⚠ Đã cách ly an toàn
                        </span>
                      ) : (
                        <span
                          className="catalog-status-pill is-draft"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        >
                          ● Chưa hoàn tất tải lên
                        </span>
                      )}

                      {/* Linked Context: Shows tender title or product name, NOT raw UUID */}
                      {doc.tender && (
                        <span className="tender-stage-badge" title={doc.tender.title}>
                          Gói thầu: {doc.tender.reference ? `[${doc.tender.reference}] ` : ''}
                          {doc.tender.title.length > 28 ? `${doc.tender.title.slice(0, 28)}…` : doc.tender.title}
                        </span>
                      )}
                      {doc.product && (
                        <span className="tender-stage-badge" title={doc.product.name}>
                          Catalog: [{doc.product.sku}] {doc.product.name.length > 24 ? `${doc.product.name.slice(0, 24)}…` : doc.product.name}
                        </span>
                      )}
                    </div>

                    <strong style={{ fontSize: '1rem', lineHeight: 1.4, color: 'var(--text-primary, #fff)' }}>
                      {doc.title}
                    </strong>

                    <small
                      className="tender-list-card-meta"
                      style={{ marginTop: '0.25rem', color: 'var(--muted, #94a3b8)', fontSize: '0.785rem' }}
                    >
                      {latest ? (
                        <>
                          <span style={{ fontFamily: 'monospace', color: 'var(--foreground, #e2e8f0)' }}>
                            {latest.originalFilename}
                          </span>
                          {' · '}
                          <span>{formatBytes(latest.sizeBytes)}</span>
                          {' · '}
                          <span style={{ fontFamily: 'monospace' }} title={`SHA-256: ${latest.sha256}`}>
                            SHA: {latest.sha256.slice(0, 14)}…
                          </span>
                          {' · '}
                          <span>Phiên bản: {latest.versionLabel}</span>
                          {' · '}
                          <span>{new Date(doc.createdAt).toLocaleDateString('vi-VN')}</span>
                        </>
                      ) : (
                        `Tạo lúc: ${new Date(doc.createdAt).toLocaleDateString('vi-VN')}`
                      )}
                    </small>
                  </div>

                  {/* Actions column */}
                  <div
                    className="tender-list-card-counts"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexShrink: 0 }}
                  >
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
                        Tải an toàn (1 lần)
                      </button>
                    ) : isQuarantined ? (
                      <span
                        style={{
                          fontSize: '12px',
                          color: '#ef4444',
                          fontWeight: 600,
                          padding: '4px 8px',
                          borderRadius: '6px',
                          background: 'rgba(239, 68, 68, 0.1)',
                        }}
                      >
                        Khóa tải (Cách ly)
                      </span>
                    ) : (
                      <span className="muted" style={{ fontSize: '12px' }}>
                        Chưa hoàn tất
                      </span>
                    )}

                    {/* Delete action button */}
                    {canUpload && (
                      <button
                        type="button"
                        className="tender-icon-button"
                        style={{ width: '30px', height: '30px', opacity: 0.7 }}
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
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>Xác nhận xóa tài liệu</h3>
                <p style={{ margin: '0.15rem 0 0', fontSize: '0.785rem', color: 'var(--muted, #94a3b8)' }}>
                  Hành động bảo mật không thể hoàn tác
                </p>
              </div>
            </div>

            <p style={{ fontSize: '0.9rem', lineHeight: 1.5, color: 'var(--foreground, #e2e8f0)', margin: '0 0 1rem' }}>
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
            void loadData()
          }}
          onClose={() => setShowUploadModal(false)}
        />
      )}
    </section>
  )
}
