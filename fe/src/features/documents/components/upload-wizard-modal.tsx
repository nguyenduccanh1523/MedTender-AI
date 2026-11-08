'use client'

import { useEffect, useRef, useState } from 'react'
import type { components } from '@medtender/contracts/api'
import { completeDocumentUpload, createUploadIntent, type DocumentDetail } from '../api'
import { listTenders, type Tender } from '../../tenders/api'
import { listCatalogProductsPage, type ProductSummary } from '../../catalog/api'

type DocumentType = components['schemas']['RequestUploadIntentDto']['documentType']
type DataClassification = components['schemas']['RequestUploadIntentDto']['classification']

// Compute SHA-256 on the client
async function computeSha256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function UploadWizardModal({
  slug,
  defaultTenderId,
  defaultProductId,
  onSuccess,
  onClose,
}: {
  slug: string
  defaultTenderId?: string
  defaultProductId?: string
  onSuccess: (doc: DocumentDetail) => void
  onClose: () => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const [title, setTitle] = useState('')
  const [docType, setDocType] = useState<DocumentType>('TENDER_DOC')
  const [classification, setClassification] = useState<DataClassification>('INTERNAL')
  const [selectedTenderId, setSelectedTenderId] = useState<string>(defaultTenderId ?? '')
  const [selectedProductId, setSelectedProductId] = useState<string>(defaultProductId ?? '')
  const [notes, setNotes] = useState('')

  // Linked options fetched from workspace
  const [tenders, setTenders] = useState<Tender[]>([])
  const [products, setProducts] = useState<ProductSummary[]>([])

  const [step, setStep] = useState<
    'IDLE' | 'HASHING' | 'INTENT' | 'STREAMING' | 'SCANNING' | 'DONE' | 'ERROR'
  >('IDLE')
  const [statusMessage, setStatusMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    Promise.all([
      listTenders(slug).catch(() => []),
      listCatalogProductsPage(slug, { limit: 50 }).catch(() => ({ items: [] })),
    ]).then(([tenderList, productPage]) => {
      if (active) {
        setTenders(Array.isArray(tenderList) ? tenderList : ((tenderList as any).items ?? []))
        setProducts(productPage.items ?? [])
      }
    })
    return () => {
      active = false
    }
  }, [slug])

  function handleFileSelect(selected: File | null) {
    if (!selected) return
    setFile(selected)
    if (!title) {
      setTitle(selected.name.replace(/\.[^/.]+$/, ''))
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(true)
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0])
    }
  }

  async function handleStartUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!file) return

    setErrorMessage(null)
    try {
      // Step 1: Compute SHA-256 on client
      setStep('HASHING')
      setStatusMessage('Đang tính toán mã băm SHA-256 trên trình duyệt…')
      const sha256 = await computeSha256(file)

      // Step 2: Request Upload Intent from Backend (TTL 10 mins)
      setStep('INTENT')
      setStatusMessage('Đang xin cấp quyền tải tệp (link 1 lần khóa theo SHA-256)…')
      const intent = await createUploadIntent(slug, {
        title: title.trim(),
        originalFilename: file.name,
        mimeType: file.type || 'application/pdf',
        sizeBytes: file.size,
        sha256,
        documentType: docType,
        classification,
        tenderId: selectedTenderId || null,
        productId: selectedProductId || null,
        notes: notes.trim() || null,
      })

      // Step 3: Stream raw binary to vault
      setStep('STREAMING')
      setStatusMessage('Đang tải dữ liệu tệp lên kho lưu trữ riêng tư…')
      const uploadRes = await fetch(intent.uploadUrl, {
        method: 'PUT',
        credentials: 'same-origin',
        headers: {
          'x-upload-token': intent.uploadToken,
          'x-medtender-request': 'web',
          'Content-Type': file.type || 'application/octet-stream',
        },
        body: file,
      })

      if (!uploadRes.ok) {
        const errJson = await uploadRes.json().catch(() => null)
        throw new Error(errJson?.message ?? 'Không thể tải byte tệp lên kho.')
      }

      // Step 4: Verify Magic Bytes and Scan Status
      setStep('SCANNING')
      setStatusMessage('Đang xác minh cấu trúc tệp (Magic Bytes) và quét an toàn…')
      const completed = await completeDocumentUpload(slug, intent.documentId, intent.versionNumber)

      setStep('DONE')
      setStatusMessage('Hoàn tất kiểm tra bảo mật!')
      onSuccess(completed)
    } catch (err: unknown) {
      setStep('ERROR')
      setErrorMessage(err instanceof Error ? err.message : 'Quá trình tải tệp thất bại.')
    }
  }

  return (
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
        background: 'rgba(0, 0, 0, 0.72)',
        backdropFilter: 'blur(5px)',
        padding: '1rem',
      }}
    >
      <div
        className="surface"
        style={{
          maxWidth: '560px',
          width: '100%',
          maxHeight: '92vh',
          overflowY: 'auto',
          borderRadius: '18px',
          padding: '1.75rem',
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.5)',
          border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.12))',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <div>
            <span className="eyebrow" style={{ color: 'var(--accent, #2a9d8f)', letterSpacing: '0.08em' }}>
              BẢO MẬT TÀI LIỆU Y TẾ · BƯỚC 05
            </span>
            <h2 style={{ fontSize: '1.25rem', margin: '0.35rem 0 0', fontWeight: 700 }}>
              Tải tài liệu & Bằng chứng nguồn
            </h2>
          </div>
          <button
            type="button"
            className="tender-icon-button"
            onClick={onClose}
            aria-label="Đóng"
          >
            ✕
          </button>
        </div>

        {/* Step: IDLE (Form) */}
        {step === 'IDLE' && (
          <form onSubmit={handleStartUpload} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Custom Modern Dropzone */}
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '0.4rem', color: 'var(--text-secondary, #94a3b8)' }}>
                Tệp tài liệu cần tải lên (PDF ≤ 100MB, DOCX/XLSX ≤ 50MB)
              </label>

              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.xlsx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={(e) => handleFileSelect(e.target.files?.[0] ?? null)}
                style={{ display: 'none' }}
              />

              {!file ? (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: isDragging
                      ? '2px dashed var(--accent, #2a9d8f)'
                      : '2px dashed var(--border-subtle, rgba(255, 255, 255, 0.18))',
                    borderRadius: '12px',
                    padding: '2rem 1.25rem',
                    textAlign: 'center',
                    background: isDragging
                      ? 'rgba(42, 157, 143, 0.08)'
                      : 'var(--surface-sunken, rgba(0, 0, 0, 0.25))',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div
                    style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '50%',
                      background: 'rgba(42, 157, 143, 0.12)',
                      color: 'var(--accent, #2a9d8f)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 0.75rem',
                      fontSize: '20px',
                    }}
                  >
                    ⤓
                  </div>
                  <p style={{ margin: '0 0 0.35rem', fontSize: '0.9rem', fontWeight: 600 }}>
                    Kéo thả tệp vào đây hoặc{' '}
                    <span style={{ color: 'var(--accent, #2a9d8f)', textDecoration: 'underline' }}>
                      chọn từ máy tính
                    </span>
                  </p>
                  <p className="muted" style={{ margin: 0, fontSize: '0.775rem' }}>
                    Chữ ký binary (Magic Bytes) sẽ được kiểm tra tự động ngay sau khi tải
                  </p>
                </div>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.85rem 1rem',
                    borderRadius: '12px',
                    background: 'var(--surface-sunken, rgba(0, 0, 0, 0.3))',
                    border: '1px solid var(--accent, #2a9d8f)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '8px',
                        background: 'rgba(42, 157, 143, 0.15)',
                        color: 'var(--accent, #2a9d8f)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '12px',
                        flexShrink: 0,
                      }}
                    >
                      PDF
                    </div>
                    <div style={{ overflow: 'hidden' }}>
                      <div
                        style={{
                          fontSize: '0.875rem',
                          fontWeight: 600,
                          textOverflow: 'ellipsis',
                          overflow: 'hidden',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {file.name}
                      </div>
                      <div className="muted" style={{ fontSize: '0.75rem' }}>
                        {formatFileSize(file.size)} · Sẵn sàng tính SHA-256
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="tender-text-button"
                    style={{ fontSize: '0.775rem', flexShrink: 0, color: 'var(--accent, #2a9d8f)' }}
                    onClick={() => {
                      setFile(null)
                      if (fileInputRef.current) fileInputRef.current.value = ''
                    }}
                  >
                    Đổi tệp khác
                  </button>
                </div>
              )}
            </div>

            {/* Document Title */}
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '0.4rem', color: 'var(--text-secondary, #94a3b8)' }}>
                Tiêu đề tài liệu <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="VD: E-HSMT Gói thiết bị siêu âm màu IB2600158942-00"
                required
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border-subtle, rgba(255,255,255,0.15))',
                  background: 'var(--surface-sunken, rgba(0,0,0,0.3))',
                  color: 'var(--text-primary, #fff)',
                  fontSize: '0.875rem',
                }}
              />
            </div>

            {/* Doc Type & Classification Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '0.4rem', color: 'var(--text-secondary, #94a3b8)' }}>
                  Loại tài liệu
                </label>
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value as DocumentType)}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-subtle, rgba(255,255,255,0.15))',
                    background: 'var(--surface-sunken, rgba(0,0,0,0.3))',
                    color: 'var(--text-primary, #fff)',
                    fontSize: '0.85rem',
                  }}
                >
                  <option value="TENDER_DOC">Hồ sơ mời thầu (E-HSMT)</option>
                  <option value="CATALOG_EVIDENCE">Catalogue / Brochure</option>
                  <option value="CERTIFICATE">Chứng chỉ CFS / ISO 13485</option>
                  <option value="OTHER">Tài liệu khác</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '0.4rem', color: 'var(--text-secondary, #94a3b8)' }}>
                  Mức độ bảo mật
                </label>
                <select
                  value={classification}
                  onChange={(e) => setClassification(e.target.value as DataClassification)}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-subtle, rgba(255,255,255,0.15))',
                    background: 'var(--surface-sunken, rgba(0,0,0,0.3))',
                    color: 'var(--text-primary, #fff)',
                    fontSize: '0.85rem',
                  }}
                >
                  <option value="INTERNAL">INTERNAL (Nội bộ)</option>
                  <option value="CONFIDENTIAL">CONFIDENTIAL (Bảo mật)</option>
                  <option value="RESTRICTED">RESTRICTED (Tuyệt mật)</option>
                </select>
              </div>
            </div>

            {/* Context Link: Tender or Catalog Product from Workspace */}
            {docType === 'TENDER_DOC' ? (
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '0.4rem', color: 'var(--text-secondary, #94a3b8)' }}>
                  Gắn với Hồ sơ thầu trong tổ chức (Tùy chọn)
                </label>
                <select
                  value={selectedTenderId}
                  onChange={(e) => setSelectedTenderId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-subtle, rgba(255,255,255,0.15))',
                    background: 'var(--surface-sunken, rgba(0,0,0,0.3))',
                    color: 'var(--text-primary, #fff)',
                    fontSize: '0.85rem',
                  }}
                >
                  <option value="">-- Không gắn trực tiếp --</option>
                  {tenders.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.reference ? `[${t.reference}] ` : ''}{t.title}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '0.4rem', color: 'var(--text-secondary, #94a3b8)' }}>
                  Gắn với Thiết bị Catalog trong tổ chức (Tùy chọn)
                </label>
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-subtle, rgba(255,255,255,0.15))',
                    background: 'var(--surface-sunken, rgba(0,0,0,0.3))',
                    color: 'var(--text-primary, #fff)',
                    fontSize: '0.85rem',
                  }}
                >
                  <option value="">-- Không gắn trực tiếp --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      [{p.sku}] {p.name} ({p.brand})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Notes */}
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '0.4rem', color: 'var(--text-secondary, #94a3b8)' }}>
                Ghi chú phiên bản (Tùy chọn)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="VD: Bản cập nhật sửa đổi phụ lục tiêu chuẩn kỹ thuật lần 2..."
                rows={2}
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border-subtle, rgba(255,255,255,0.15))',
                  background: 'var(--surface-sunken, rgba(0,0,0,0.3))',
                  color: 'var(--text-primary, #fff)',
                  fontSize: '0.85rem',
                  resize: 'vertical',
                }}
              />
            </div>

            {/* Footer buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button
                type="button"
                className="button button-secondary"
                onClick={onClose}
              >
                Hủy
              </button>
              <button
                type="submit"
                className="button button-primary"
                disabled={!file || !title.trim()}
              >
                Bắt đầu tải lên & Quét bảo mật
              </button>
            </div>
          </form>
        )}

        {/* Step: In-progress Security Checks */}
        {step !== 'IDLE' && step !== 'ERROR' && (
          <div style={{ padding: '2.5rem 1rem 1.5rem', textAlign: 'center' }}>
            {/* Spinning Radar Loader */}
            <div style={{ position: 'relative', width: '64px', height: '64px', margin: '0 auto 1.5rem' }}>
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '50%',
                  border: '3px solid rgba(42, 157, 143, 0.15)',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '50%',
                  border: '3px solid transparent',
                  borderTopColor: 'var(--accent, #2a9d8f)',
                  borderRightColor: 'var(--accent, #2a9d8f)',
                  animation: 'tender-spin 0.8s linear infinite',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  inset: '8px',
                  borderRadius: '50%',
                  background: 'rgba(42, 157, 143, 0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
                  fontWeight: 800,
                  color: 'var(--accent, #2a9d8f)',
                }}
              >
                {step === 'HASHING'
                  ? '25%'
                  : step === 'INTENT'
                    ? '50%'
                    : step === 'STREAMING'
                      ? '75%'
                      : step === 'SCANNING'
                        ? '92%'
                        : '100%'}
              </div>
            </div>

            <h3 style={{ fontSize: '1.1rem', margin: '0 0 0.5rem', fontWeight: 700 }}>
              {statusMessage}
            </h3>
            <p className="muted" style={{ fontSize: '0.8rem', margin: '0 0 1.5rem' }}>
              Đang thực hiện quy trình kiểm định an toàn và cô lập tài liệu y tế
            </p>

            {/* Visual Progress Bar */}
            <div
              style={{
                width: '100%',
                maxWidth: '420px',
                height: '6px',
                borderRadius: '999px',
                background: 'rgba(255, 255, 255, 0.08)',
                margin: '0 auto 1.75rem',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  borderRadius: '999px',
                  background: 'linear-gradient(90deg, #2a9d8f, #22c55e)',
                  width:
                    step === 'HASHING'
                      ? '25%'
                      : step === 'INTENT'
                        ? '50%'
                        : step === 'STREAMING'
                          ? '75%'
                          : step === 'SCANNING'
                            ? '92%'
                            : '100%',
                  transition: 'width 0.4s ease',
                }}
              />
            </div>

            {/* 4 Security Checkpoints */}
            <div
              style={{
                display: 'grid',
                gap: '0.65rem',
                maxWidth: '420px',
                margin: '0 auto',
                textAlign: 'left',
                fontSize: '0.825rem',
              }}
            >
              {[
                {
                  id: 'HASHING',
                  title: '1. Tính mã băm SHA-256 bất biến',
                  subtitle: 'Tính toán trực tiếp trên trình duyệt, không làm lộ dữ liệu',
                  isDone: step !== 'HASHING',
                  isActive: step === 'HASHING',
                },
                {
                  id: 'INTENT',
                  title: '2. Cấp quyền Upload Intent (TTL 10m)',
                  subtitle: 'Link ký số khóa theo mã SHA-256 dùng 1 lần',
                  isDone: step === 'STREAMING' || step === 'SCANNING' || step === 'DONE',
                  isActive: step === 'INTENT',
                },
                {
                  id: 'STREAMING',
                  title: '3. Truyền byte nhị phân vào kho Vault',
                  subtitle: 'Lưu trữ mã hóa riêng tư, cách ly mạng bên ngoài',
                  isDone: step === 'SCANNING' || step === 'DONE',
                  isActive: step === 'STREAMING',
                },
                {
                  id: 'SCANNING',
                  title: '4. Kiểm tra Magic Bytes & Quét mã độc',
                  subtitle: 'Xác minh chữ ký %PDF-, PKZip, phát hiện tệp ngụy trang',
                  isDone: step === 'DONE',
                  isActive: step === 'SCANNING',
                },
              ].map((s) => (
                <div
                  key={s.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '8px',
                    background: s.isActive
                      ? 'rgba(42, 157, 143, 0.12)'
                      : s.isDone
                        ? 'rgba(34, 197, 94, 0.06)'
                        : 'transparent',
                    border: s.isActive
                      ? '1px solid rgba(42, 157, 143, 0.3)'
                      : '1px solid transparent',
                  }}
                >
                  <div
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '11px',
                      fontWeight: 700,
                      background: s.isDone
                        ? '#22c55e'
                        : s.isActive
                          ? 'var(--accent, #2a9d8f)'
                          : 'rgba(255, 255, 255, 0.1)',
                      color: s.isDone || s.isActive ? '#fff' : 'var(--muted, #64748b)',
                    }}
                  >
                    {s.isDone ? '✓' : s.isActive ? '●' : '○'}
                  </div>
                  <div>
                    <strong
                      style={{
                        display: 'block',
                        color: s.isDone
                          ? '#22c55e'
                          : s.isActive
                            ? 'var(--accent, #2a9d8f)'
                            : 'var(--muted, #94a3b8)',
                      }}
                    >
                      {s.title}
                    </strong>
                    <span style={{ fontSize: '0.725rem', color: 'var(--muted, #64748b)' }}>
                      {s.subtitle}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step: Error */}
        {step === 'ERROR' && (
          <div style={{ padding: '1.5rem 0' }}>
            <div
              style={{
                padding: '1.25rem',
                borderRadius: '12px',
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                color: '#ef4444',
                fontSize: '0.875rem',
                marginBottom: '1.5rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '18px' }}>⚠</span>
                <strong style={{ fontSize: '1rem' }}>Tải tệp không thành công</strong>
              </div>
              <p style={{ margin: 0, lineHeight: 1.5, color: '#fca5a5' }}>{errorMessage}</p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => setStep('IDLE')}
              >
                ← Thử lại
              </button>
              <button
                type="button"
                className="button button-primary"
                onClick={onClose}
              >
                Đóng
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
