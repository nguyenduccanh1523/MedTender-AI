'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState, type FormEvent } from 'react'

import { ApiError } from '../../../lib/api/client'
import {
  getOrganizationGovernance,
  updateOrganizationGovernance,
  updateOrganizationMember,
  type Organization,
  type OrganizationGovernance,
} from '../api'
import {
  listSecurityIncidents,
  purgeSecurityIncident,
  suspendIncidentUploader,
  type SecurityIncidentSummary,
} from '../../documents/api'
import { cacheOrganization, readCachedOrganization } from '../organization-cache'
import { roleLabels } from '../roles'
import { canManageOrganizationGovernance, useWorkspaceRole } from '../workspace-permissions'

const assignableRolesByOwner: Array<Exclude<Organization['role'], 'OWNER'>> = [
  'ADMIN',
  'BID_MANAGER',
  'CATALOG_MANAGER',
  'ANALYST',
  'REVIEWER',
  'VIEWER',
]

const classificationLabels: Record<'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED', string> = {
  INTERNAL: 'Nội bộ (INTERNAL) — Tài liệu vận hành tiêu chuẩn trong tổ chức',
  CONFIDENTIAL: 'Bảo mật cao (CONFIDENTIAL) — Hồ sơ E-HSMT, thông số & báo giá nhạy cảm',
  RESTRICTED: 'Tuyệt mật / Hạn chế tối đa (RESTRICTED) — Chỉ nhân sự được chỉ định mới được xem',
}

type GovernanceTab = 'policy' | 'members' | 'incidents' | 'audits'
type AuditScopeFilter = 'ALL' | 'ORG' | 'CATALOG' | 'TENDER' | 'DOC'

const auditScopeLabels: Record<AuditScopeFilter, string> = {
  ALL: 'Tất cả bản ghi',
  ORG: 'Tổ chức & Phân quyền',
  CATALOG: 'Catalog & Phiên bản',
  TENDER: 'Hồ sơ thầu / Lot / Item',
  DOC: 'Tài liệu & Bảo mật',
}

function matchAuditScope(action: string, scope: AuditScopeFilter) {
  if (scope === 'ALL') return true
  if (scope === 'ORG') return action.startsWith('ORG_')
  if (scope === 'CATALOG') return action.startsWith('CATALOG_')
  if (scope === 'DOC') return action.startsWith('DOCUMENT_') || action.startsWith('POLICY_')
  return action.startsWith('TENDER_') || action.startsWith('LOT_') || action.startsWith('ITEM_')
}

export function WorkspaceGovernanceView({ slug }: { slug: string }) {
  const role = useWorkspaceRole()
  const isOwner = canManageOrganizationGovernance(role)

  const [data, setData] = useState<OrganizationGovernance | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [activeTab, setActiveTab] = useState<GovernanceTab>('policy')
  const [orgName, setOrgName] = useState('')
  const [requireReviewer, setRequireReviewer] = useState(true)
  const [classification, setClassification] = useState<'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED'>(
    'CONFIDENTIAL',
  )
  const [externalAiPolicy, setExternalAiPolicy] = useState<'OFF' | 'INTERNAL_ONLY'>('OFF')
  const [maxLotsPerTender, setMaxLotsPerTender] = useState(20)
  const [maxItemsPerTender, setMaxItemsPerTender] = useState(100)
  const [maxSpecsPerVersion, setMaxSpecsPerVersion] = useState(200)

  const [savingPolicy, setSavingPolicy] = useState(false)
  const [policyNotice, setPolicyNotice] = useState<string | null>(null)
  const [memberSavingId, setMemberSavingId] = useState<string | null>(null)

  const [auditScope, setAuditScope] = useState<AuditScopeFilter>('ALL')
  const [auditLimit, setAuditLimit] = useState(10)
  const [auditPage, setAuditPage] = useState(1)

  const [incidents, setIncidents] = useState<SecurityIncidentSummary[]>([])
  const [purgingId, setPurgingId] = useState<string | null>(null)
  const [purgeReason, setPurgeReason] = useState('')
  const [showPurgeModal, setShowPurgeModal] = useState<SecurityIncidentSummary | null>(null)

  const [showSuspendModal, setShowSuspendModal] = useState<SecurityIncidentSummary | null>(null)
  const [suspendReason, setSuspendReason] = useState('')
  const [isSuspending, setIsSuspending] = useState(false)
  const [suspendError, setSuspendError] = useState<string | null>(null)

  const applyGovState = useCallback((gov: OrganizationGovernance) => {
    setData(gov)
    setOrgName(gov.name)
    setRequireReviewer(gov.settings.requireIndependentReviewer)
    setClassification(gov.settings.defaultDataClassification)
    setExternalAiPolicy(gov.settings.externalAiPolicy)
    setMaxLotsPerTender(gov.settings.maxLotsPerTender)
    setMaxItemsPerTender(gov.settings.maxItemsPerTender)
    setMaxSpecsPerVersion(gov.settings.maxSpecsPerVersion)
  }, [])

  const load = useCallback(async () => {
    if (!isOwner) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [gov, incs] = await Promise.all([
        getOrganizationGovernance(slug),
        listSecurityIncidents(slug).catch(() => []),
      ])
      applyGovState(gov)
      setIncidents(incs)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không tải được cấu hình quản trị tổ chức.')
    } finally {
      setLoading(false)
    }
  }, [slug, isOwner, applyGovState])

  useEffect(() => {
    if (!isOwner) return
    let active = true
    Promise.all([
      getOrganizationGovernance(slug),
      listSecurityIncidents(slug).catch(() => []),
    ])
      .then(([gov, incs]) => {
        if (active) {
          applyGovState(gov)
          setIncidents(incs)
          setError(null)
        }
      })
      .catch((err: unknown) => {
        if (active) {
          setError(
            err instanceof ApiError ? err.message : 'Không tải được cấu hình quản trị tổ chức.',
          )
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [slug, isOwner, applyGovState])

  if (!isOwner) {
    return (
      <section className="surface empty-state">
        <p className="eyebrow">Đặc quyền Chủ sở hữu (OWNER)</p>
        <h2>Chức năng này chỉ dành riêng cho OWNER của tổ chức</h2>
        <p className="muted">
          ADMIN có quyền quản trị đội ngũ nghiệp vụ và lời mời, nhưng việc thay đổi định danh tổ chức,
          cấu hình chính sách tuân thủ và bổ nhiệm/hạ quyền ADMIN thuộc thẩm quyền độc quyền của OWNER.
        </p>
      </section>
    )
  }

  if (loading && !data) {
    return (
      <section className="surface tender-list-panel" aria-busy="true">
        <div className="tender-skeleton-list" aria-label="Đang tải cấu hình quản trị tổ chức">
          <i />
          <i />
          <i />
          <i />
        </div>
      </section>
    )
  }

  if (error || !data) {
    return (
      <section className="surface tender-list-panel">
        <p className="notice notice-error" role="alert">
          {error ?? 'Không thể hiển thị cấu hình quản trị tổ chức.'}
        </p>
        <button className="button button-secondary" type="button" onClick={() => void load()}>
          Thử lại
        </button>
      </section>
    )
  }

  async function handleSavePolicy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSavingPolicy(true)
    setError(null)
    setPolicyNotice(null)
    try {
      const effectiveAiPolicy = classification === 'INTERNAL' ? externalAiPolicy : 'OFF'
      const updated = await updateOrganizationGovernance(slug, {
        name: orgName.trim(),
        requireIndependentReviewer: requireReviewer,
        defaultDataClassification: classification,
        externalAiPolicy: effectiveAiPolicy,
        maxLotsPerTender: Number(maxLotsPerTender),
        maxItemsPerTender: Number(maxItemsPerTender),
        maxSpecsPerVersion: Number(maxSpecsPerVersion),
      })
      applyGovState(updated)
      const cached = readCachedOrganization(slug)
      if (cached) {
        cacheOrganization({ ...cached, name: updated.name })
      }
      setPolicyNotice('Đã lưu cấu hình định danh, chính sách bảo mật & hạn mức vận hành của tổ chức.')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không cập nhật được cấu hình tổ chức.')
    } finally {
      setSavingPolicy(false)
    }
  }

  async function handleMemberUpdate(
    memberUserId: string,
    patch: { role?: Organization['role']; status?: 'ACTIVE' | 'DISABLED' },
  ) {
    setMemberSavingId(memberUserId)
    setError(null)
    setPolicyNotice(null)
    try {
      await updateOrganizationMember(slug, memberUserId, patch)
      await load()
      setPolicyNotice('Đã cập nhật phân quyền / trạng thái thành viên.')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không cập nhật được quyền thành viên.')
    } finally {
      setMemberSavingId(null)
    }
  }

  const filteredAudits = data.recentAudits.filter((entry) =>
    matchAuditScope(entry.action, auditScope),
  )
  const totalAuditPages = Math.max(1, Math.ceil(filteredAudits.length / auditLimit))
  const safeAuditPage = Math.min(auditPage, totalAuditPages)
  const auditStartIndex = (safeAuditPage - 1) * auditLimit
  const visibleAudits = filteredAudits.slice(auditStartIndex, auditStartIndex + auditLimit)

  return (
    <div className="governance-dashboard">
      <section className="activity-role-banner">
        <div className="activity-role-banner-main">
          <div className="activity-role-chips">
            <span className="activity-role-badge">ĐẶC QUYỀN DUY NHẤT CỦA OWNER</span>
            <span className="activity-role-focus">Cấp cao hơn ADMIN · Kiểm soát toàn bộ Tenant</span>
          </div>
          <h2>Quản trị cấu trúc tổ chức, chính sách tuân thủ & phân quyền ADMIN</h2>
          <p>
            Không gian này chỉ hiển thị với <strong>Chủ sở hữu (OWNER)</strong>. Tại đây bạn thiết lập quy chuẩn
            pháp nhân/tuân thủ của tổ chức, điều chỉnh hạn mức vận hành, bổ nhiệm hoặc hạ quyền Quản trị viên (ADMIN)
            và tra cứu bảng kiểm toán toàn tổ chức.
          </p>
        </div>
        <div className="activity-role-banner-actions">
          <button
            className={loading ? 'tender-icon-button is-spinning' : 'tender-icon-button'}
            type="button"
            onClick={() => void load()}
            disabled={loading}
            aria-label="Làm mới quản trị tổ chức"
            title="Làm mới dữ liệu"
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
        </div>
      </section>

      {error && (
        <p className="notice notice-error" role="alert">
          {error}
        </p>
      )}
      {policyNotice && (
        <p className="governance-success-banner" role="status">
          {policyNotice}
        </p>
      )}

      <div className="tender-subtabs-bar">
        <div className="tender-subtabs" role="tablist" aria-label="Chế độ quản trị tổ chức">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'policy'}
            className={activeTab === 'policy' ? 'tender-subtab is-active' : 'tender-subtab'}
            onClick={() => setActiveTab('policy')}
          >
            Chính sách & Pháp nhân
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'members'}
            className={activeTab === 'members' ? 'tender-subtab is-active' : 'tender-subtab'}
            onClick={() => setActiveTab('members')}
          >
            Bổ nhiệm & Phân quyền ADMIN
            <span className="tender-subtab-badge">{data.members.length}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'incidents'}
            className={activeTab === 'incidents' ? 'tender-subtab is-active' : 'tender-subtab'}
            onClick={() => setActiveTab('incidents')}
          >
            Sự cố bảo mật & Cách ly
            <span className="tender-subtab-badge">{incidents.length}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'audits'}
            className={activeTab === 'audits' ? 'tender-subtab is-active' : 'tender-subtab'}
            onClick={() => setActiveTab('audits')}
          >
            Kiểm toán cấp Tổ chức
            <span className="tender-subtab-badge">{data.recentAudits.length}</span>
          </button>
        </div>
      </div>

      {activeTab === 'policy' && (
        <section className="surface tender-list-panel" aria-label="Cấu hình pháp nhân và chính sách">
          <div className="tender-entry-heading">
            <div>
              <strong>Cấu hình Pháp nhân & Chính sách Tuân thủ của Tổ chức</strong>
              <div className="governance-org-meta-row">
                <span className="muted">
                  Mã định danh hệ thống (slug): <code className="governance-slug-code">{data.slug}</code>
                </span>
                <span
                  className={
                    data.status === 'ACTIVE'
                      ? 'governance-org-status-badge is-active'
                      : 'governance-org-status-badge'
                  }
                >
                  <i aria-hidden="true" />
                  {data.status === 'ACTIVE' ? 'ĐANG HOẠT ĐỘNG (ACTIVE)' : data.status}
                </span>
              </div>
            </div>
          </div>

          <div className="governance-explainer-grid">
            <article className="governance-explainer-card">
              <span>1. Định danh pháp nhân là gì?</span>
              <p>
                Là tên chính thức của Bệnh viện hoặc Công ty cung ứng thiết bị y tế. Tên này xuất hiện trên thanh
                Header, email mời thành viên và tiêu đề pháp lý của các bản báo cáo đối chiếu hồ sơ thầu.
              </p>
            </article>
            <article className="governance-explainer-card">
              <span>2. Phân loại bảo mật dữ liệu dùng để làm gì?</span>
              <p>
                Quy định nhãn bảo mật mặc định khi nhân sự tải E-HSMT, báo giá hoặc CFS lên workspace. Ở mức{' '}
                <strong>CONFIDENTIAL</strong> hoặc <strong>RESTRICTED</strong>, hệ thống tự động khóa cứng không cho gửi
                dữ liệu ra mô hình AI bên ngoài.
              </p>
            </article>
            <article className="governance-explainer-card">
              <span>3. Bắt buộc REVIEWER độc lập (Nguyên tắc 4 mắt)</span>
              <p>
                Chống rủi ro tự biên tự diễn trong đấu thầu: người lập phân tích kỹ thuật (Analyst) không được tự bấm
                duyệt kết quả của chính mình mà phải có một <strong>Reviewer độc lập</strong> kiểm tra chéo.
              </p>
            </article>
          </div>

          <form className="tender-entry-form" onSubmit={handleSavePolicy} style={{ marginTop: '1rem' }}>
            <div className="tender-form-grid">
              <label className="span-2">
                Tên hiển thị của tổ chức / bệnh viện / nhà thầu
                <input
                  required
                  minLength={2}
                  maxLength={100}
                  value={orgName}
                  onChange={(event) => setOrgName(event.target.value)}
                />
              </label>

              <label className="span-2">
                Mức phân loại bảo mật dữ liệu mặc định cho hồ sơ & tài liệu mới
                <select
                  value={classification}
                  onChange={(event) => {
                    const nextClass = event.target.value as 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED'
                    setClassification(nextClass)
                    if (nextClass !== 'INTERNAL') {
                      setExternalAiPolicy('OFF')
                    }
                  }}
                >
                  {Object.entries(classificationLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="governance-switch-card span-2">
                <div className="governance-switch-copy">
                  <strong>Bắt buộc thẩm định độc lập bởi REVIEWER trước khi phê duyệt hồ sơ</strong>
                  <p className="muted">
                    Nguyên tắc 4 mắt (Four-Eyes Principle): chỉ REVIEWER độc lập (không phải người tạo/sửa bản phân
                    tích) mới được quyền bấm Approve xuất báo cáo chính thức.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={requireReviewer}
                  aria-label="Bắt buộc thẩm định độc lập bởi REVIEWER"
                  className={requireReviewer ? 'governance-toggle is-on' : 'governance-toggle is-off'}
                  onClick={() => setRequireReviewer((prev) => !prev)}
                >
                  <span className="governance-toggle-track">
                    <span className="governance-toggle-thumb" />
                  </span>
                  <span className="governance-toggle-text">{requireReviewer ? 'ON' : 'OFF'}</span>
                </button>
              </div>
            </div>

            <div className="governance-configurable-guardrails">
              <div className="governance-guardrail-head">
                <strong>Cấu hình Chính sách AI & Hạn mức Vận hành (OWNER có thể điều chỉnh)</strong>
                <span className="muted">
                  Kiểm soát phạm vi xử lý AI và giới hạn số lượng bản ghi tối đa trên mỗi Hồ sơ thầu / Phiên bản Catalog.
                </span>
              </div>

              <div className="governance-guardrail-inputs">
                <label className="governance-guardrail-box">
                  <span>CHÍNH SÁCH AI BÊN NGOÀI</span>
                  <select
                    aria-label="Chính sách AI bên ngoài"
                    value={classification === 'INTERNAL' ? externalAiPolicy : 'OFF'}
                    disabled={classification !== 'INTERNAL'}
                    onChange={(event) =>
                      setExternalAiPolicy(event.target.value as 'OFF' | 'INTERNAL_ONLY')
                    }
                  >
                    <option value="OFF">OFF — Khóa cứng 100% nội bộ</option>
                    <option value="INTERNAL_ONLY">
                      INTERNAL_ONLY — Chỉ mở với dữ liệu Nội bộ
                    </option>
                  </select>
                  <small className="muted">
                    {classification !== 'INTERNAL'
                      ? 'Đang tự động khóa ở mức OFF vì phân loại mặc định là CONFIDENTIAL/RESTRICTED.'
                      : 'Tài liệu CONFIDENTIAL và RESTRICTED vẫn luôn bị chặn gửi ra ngoài.'}
                  </small>
                </label>

                <div className="governance-guardrail-box">
                  <span>HẠN MỨC MỖI HỒ SƠ THẦU (LOT / ITEM)</span>
                  <div className="governance-dual-number">
                    <label>
                      <small>Số Lot tối đa (1–50)</small>
                      <input
                        type="number"
                        min={1}
                        max={50}
                        required
                        aria-label="Hạn mức Lot mỗi hồ sơ thầu"
                        value={maxLotsPerTender}
                        onChange={(event) => setMaxLotsPerTender(Number(event.target.value))}
                      />
                    </label>
                    <label>
                      <small>Số Item tối đa (1–500)</small>
                      <input
                        type="number"
                        min={1}
                        max={500}
                        required
                        aria-label="Hạn mức Item mỗi hồ sơ thầu"
                        value={maxItemsPerTender}
                        onChange={(event) => setMaxItemsPerTender(Number(event.target.value))}
                      />
                    </label>
                  </div>
                  <small className="muted">
                    Hiện tại: <strong>{maxLotsPerTender} Lot / {maxItemsPerTender} Item</strong> mỗi hồ sơ thầu.
                  </small>
                </div>

                <label className="governance-guardrail-box">
                  <span>HẠN MỨC MỖI PHIÊN BẢN CATALOG</span>
                  <input
                    type="number"
                    min={10}
                    max={500}
                    required
                    aria-label="Hạn mức thông số mỗi phiên bản Catalog"
                    value={maxSpecsPerVersion}
                    onChange={(event) => setMaxSpecsPerVersion(Number(event.target.value))}
                  />
                  <small className="muted">
                    Tối đa <strong>{maxSpecsPerVersion} thông số kỹ thuật</strong> trên một phiên bản sản phẩm (10–500).
                  </small>
                </label>
              </div>
            </div>

            <div className="tender-inline-actions" style={{ marginTop: '.95rem' }}>
              <button className="button button-primary" disabled={savingPolicy} type="submit">
                {savingPolicy ? 'Đang lưu chính sách…' : 'Lưu chính sách & Hạn mức tổ chức'}
              </button>
            </div>
          </form>
        </section>
      )}

      {activeTab === 'members' && (
        <section className="surface tender-list-panel" aria-label="Kiểm soát vai trò và trạng thái thành viên">
          <div className="tender-entry-heading">
            <div>
              <strong>Bổ nhiệm / Hạ quyền ADMIN & Quản lý trạng thái thành viên ({data.members.length})</strong>
              <p className="muted">
                Chỉ <strong>OWNER</strong> mới có quyền thăng cấp thành viên lên <strong>ADMIN</strong>, chuyển đổi
                vai trò của <strong>ADMIN</strong> sang role nghiệp vụ hoặc tạm khóa tài khoản trong tổ chức.
              </p>
            </div>
          </div>

          <div className="governance-table-wrap">
            <table className="governance-table" aria-label="Bảng phân quyền thành viên cấp cao">
              <thead>
                <tr>
                  <th>Thành viên</th>
                  <th>Vai trò hiện tại</th>
                  <th>Trạng thái</th>
                  <th>Thao tác của OWNER</th>
                </tr>
              </thead>
              <tbody>
                {data.members.map((member) => {
                  const isTargetOwner = member.role === 'OWNER'
                  const isBusy = memberSavingId === member.userId
                  return (
                    <tr key={member.userId}>
                      <td>
                        <strong>{member.name}</strong>
                      </td>
                      <td>
                        <span className="tender-stage-badge">{roleLabels[member.role]}</span>
                      </td>
                      <td>
                        <span
                          className={
                            member.status === 'ACTIVE'
                              ? 'catalog-status-pill is-published'
                              : 'catalog-status-pill is-superseded'
                          }
                        >
                          {member.status === 'ACTIVE' ? 'Đang hoạt động' : 'Đã tạm khóa'}
                        </span>
                      </td>
                      <td>
                        {isTargetOwner ? (
                          <span className="muted">Chủ sở hữu tối cao (Cố định)</span>
                        ) : (
                          <div className="governance-member-controls">
                            <select
                              aria-label={`Vai trò của ${member.name}`}
                              className="governance-role-select"
                              disabled={isBusy}
                              value={member.role}
                              onChange={(event) =>
                                void handleMemberUpdate(member.userId, {
                                  role: event.target.value as Organization['role'],
                                })
                              }
                            >
                              {assignableRolesByOwner.map((r) => (
                                <option key={r} value={r}>
                                  {roleLabels[r]} ({r})
                                </option>
                              ))}
                            </select>

                            <button
                              className={
                                member.status === 'ACTIVE'
                                  ? 'tender-chip-button is-danger-chip'
                                  : 'tender-chip-button'
                              }
                              disabled={isBusy}
                              type="button"
                              onClick={() =>
                                void handleMemberUpdate(member.userId, {
                                  status: member.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE',
                                })
                              }
                            >
                              {member.status === 'ACTIVE' ? 'Tạm khóa' : 'Kích hoạt lại'}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeTab === 'incidents' && (
        <section className="surface tender-list-panel" aria-label="Sổ cái sự cố bảo mật và cách ly">
          <div className="tender-entry-heading">
            <div>
              <strong>Sổ cái Sự cố Bảo mật & Tệp bị Cách ly (Security Quarantine Ledger)</strong>
              <p className="muted">
                Độc quyền dành riêng cho OWNER. Lưu giữ bằng chứng kiểm toán (Audit Trail) khi phát hiện tệp giả mạo,
                sai chữ ký Magic Bytes, hoặc mã độc. Tệp bị cách ly lập tức bị khóa mọi quyền đọc/tải/phân tích AI cho
                đến khi OWNER giải quyết hoặc tiêu hủy vĩnh viễn (Purge).
              </p>
            </div>
          </div>

          <div className="governance-explainer-grid" style={{ marginBottom: '1.25rem' }}>
            <article className="governance-explainer-card">
              <span>1. Cơ chế cách ly tự động (Zero-Trust)</span>
              <p>
                Bất kỳ tệp nào tải lên bị phát hiện không đúng chữ ký số binary (%PDF, PK.. zip, hay dính PE/MZ
                executable) sẽ lập tức chuyển vào kho cách ly biệt lập. Nhân sự thông thường không thể thấy hoặc tải tệp.
              </p>
            </article>
            <article className="governance-explainer-card">
              <span>2. Bằng chứng kiểm toán bất biến</span>
              <p>
                Mã băm SHA-256, thời điểm, người tải lên và lý do vi phạm được ghi vào Sổ cái bảo mật này để phục vụ
                thanh tra tuân thủ pháp lý y tế và điều tra nội bộ.
              </p>
            </article>
            <article className="governance-explainer-card">
              <span>3. Thẩm quyền Tiêu hủy (Purge)</span>
              <p>
                Chỉ OWNER có quyền xóa vật lý tệp khỏi kho lưu trữ kèm lý do giải trình bắt buộc. Bản ghi sự cố vẫn
                được lưu vết vĩnh viễn với trạng thái PURGED để đảm bảo tính toàn vẹn.
              </p>
            </article>
          </div>

          {incidents.length === 0 ? (
            <div className="tender-empty-state" style={{ padding: '2.5rem 1rem', textAlign: 'center' }}>
              <p className="eyebrow" style={{ color: '#22c55e', letterSpacing: '0.08em' }}>
                HỆ THỐNG AN TOÀN · ZERO TRUST
              </p>
              <h3 style={{ marginTop: '0.5rem' }}>Không có sự cố bảo mật nào</h3>
              <p className="muted" style={{ maxWidth: '540px', margin: '0.5rem auto 0' }}>
                Tất cả các tệp tài liệu E-HSMT, Brochure kỹ thuật và Chứng chỉ CFS được tải lên tổ chức đều vượt qua
                bước kiểm định Magic Bytes và chữ ký băm toàn vẹn SHA-256.
              </p>
            </div>
          ) : (
            <div className="governance-table-wrap">
              <table className="governance-table quarantine-table" aria-label="Danh sách sự cố bảo mật">
                <thead>
                  <tr>
                    <th style={{ width: '120px', whiteSpace: 'nowrap' }}>Mã sự cố</th>
                    <th style={{ width: '190px' }}>Tệp vi phạm</th>
                    <th style={{ width: '125px', whiteSpace: 'nowrap' }}>SHA-256</th>
                    <th style={{ minWidth: '170px' }}>Lý do cách ly</th>
                    <th style={{ width: '135px', whiteSpace: 'nowrap' }}>Người tải lên</th>
                    <th style={{ width: '115px', textAlign: 'center', whiteSpace: 'nowrap' }}>Trạng thái</th>
                    <th style={{ width: '175px', textAlign: 'right', whiteSpace: 'nowrap' }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {incidents.map((inc) => (
                    <tr key={inc.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <strong style={{ fontFamily: 'ui-monospace, monospace', color: 'var(--ink)' }}>{inc.reference}</strong>
                        <br />
                        <small className="muted" style={{ fontSize: '0.72rem' }}>
                          {new Date(inc.uploadedAt).toLocaleString('vi-VN')}
                        </small>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4rem' }}>
                          <span style={{ fontSize: '1rem', flexShrink: 0, marginTop: '1px' }} aria-hidden="true">⚠️</span>
                          <div style={{ minWidth: 0 }}>
                            <span
                              style={{
                                display: 'block',
                                fontWeight: 700,
                                color: '#f87171',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                maxWidth: '160px',
                              }}
                              title={inc.fileName}
                            >
                              {inc.fileName}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="quarantine-sha-code" title={inc.sha256}>
                          {inc.sha256.slice(0, 6)}...{inc.sha256.slice(-6)}
                        </span>
                      </td>
                      <td>
                        <div>
                          <span className="quarantine-reason-pill">
                            🛡️ Cách ly an toàn
                          </span>
                          <p style={{ margin: 0, fontSize: '0.8rem', lineHeight: 1.4 }} className="muted">
                            {inc.reason}
                          </p>
                        </div>
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.825rem' }}>{inc.uploadedByUserName}</span>
                        {inc.ipAddress && (
                          <>
                            <br />
                            <small className="muted" style={{ fontSize: '0.72rem', fontFamily: 'ui-monospace, monospace' }}>
                              IP: {inc.ipAddress}
                            </small>
                          </>
                        )}
                      </td>
                      <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <span
                          className={
                            inc.status === 'PURGED'
                              ? 'governance-org-status-badge is-purged'
                              : inc.status === 'RESOLVED'
                                ? 'governance-org-status-badge is-active'
                                : 'governance-org-status-badge is-danger'
                          }
                        >
                          <i aria-hidden="true" />
                          {inc.status === 'PURGED'
                            ? 'ĐÃ TIÊU HỦY'
                            : inc.status === 'RESOLVED'
                              ? 'ĐÃ GIẢI QUYẾT'
                              : 'CÁCH LY'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div className="quarantine-actions-wrap">
                          {inc.isUploaderSuspended ? (
                            <span className="quarantine-badge-suspended" title="Tài khoản đã bị đình chỉ hoạt động">
                              🔒 Đã khóa
                            </span>
                          ) : (
                            <button
                              type="button"
                              className="quarantine-btn quarantine-btn-suspend"
                              onClick={() => {
                                setShowSuspendModal(inc)
                                setSuspendReason('')
                                setSuspendError(null)
                              }}
                              title="Đình chỉ quyền truy cập của người tải tệp vi phạm"
                            >
                              🔒 Khóa TK
                            </button>
                          )}

                          {inc.status !== 'PURGED' ? (
                            <button
                              type="button"
                              className="quarantine-btn quarantine-btn-purge"
                              onClick={() => {
                                setShowPurgeModal(inc)
                                setPurgeReason('')
                              }}
                              title="Xóa vật lý nhị phân của tệp khỏi kho lưu trữ"
                            >
                              🗑️ Tiêu hủy
                            </button>
                          ) : (
                            <small className="muted" style={{ fontStyle: 'italic', fontSize: '0.72rem' }}>Đã tiêu hủy</small>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {activeTab === 'audits' && (
        <section className="surface tender-audit-panel" aria-label="Bảng kiểm toán cấp tổ chức">
          <div className="tender-entry-heading">
            <div>
              <strong>Bảng Kiểm toán cấp Tổ chức (Organization Audit Log)</strong>
              <p className="muted">
                Tổng hợp minh bạch mọi sự kiện thay đổi chính sách tổ chức, phân quyền thành viên, xuất bản phiên bản
                catalog và thao tác trên hồ sơ thầu.
              </p>
            </div>
          </div>

          <div className="tender-audit-toolbar" role="region" aria-label="Bộ lọc kiểm toán tổ chức">
            <div className="tender-stage-tabs" role="group" aria-label="Phạm vi kiểm toán">
              {(['ALL', 'ORG', 'CATALOG', 'TENDER'] as AuditScopeFilter[]).map((scope) => (
                <button
                  key={scope}
                  type="button"
                  className={
                    auditScope === scope ? 'tender-filter-chip is-active' : 'tender-filter-chip'
                  }
                  onClick={() => {
                    setAuditScope(scope)
                    setAuditPage(1)
                  }}
                >
                  {auditScopeLabels[scope]}
                </button>
              ))}
            </div>

            <label className="tender-audit-limit-control">
              <span>Hiển thị</span>
              <select
                aria-label="Số dòng kiểm toán mỗi trang"
                value={String(auditLimit)}
                onChange={(event) => {
                  setAuditLimit(Number(event.target.value))
                  setAuditPage(1)
                }}
              >
                <option value="5">5 dòng / trang</option>
                <option value="10">10 dòng / trang</option>
                <option value="20">20 dòng / trang</option>
              </select>
            </label>
          </div>

          {visibleAudits.length === 0 ? (
            <p className="muted" style={{ marginTop: '.75rem' }}>
              Chưa có bản ghi kiểm toán nào phù hợp với bộ lọc hiện tại.
            </p>
          ) : (
            <>
              <div className="governance-table-wrap">
                <table className="governance-table governance-audit-table" aria-label="Nhật ký kiểm toán cấp tổ chức">
                  <thead>
                    <tr>
                      <th>Thời gian</th>
                      <th>Mã sự kiện</th>
                      <th>Nội dung thay đổi chi tiết</th>
                      <th>Người thực hiện</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleAudits.map((entry) => (
                      <tr key={entry.id}>
                        <td className="governance-audit-time">
                          <time dateTime={String(entry.createdAt)}>
                            {new Date(entry.createdAt).toLocaleString('vi-VN')}
                          </time>
                        </td>
                        <td className="governance-audit-code">
                          <span className="tender-lot-code">{entry.action}</span>
                        </td>
                        <td className="governance-audit-summary">
                          <strong>{entry.summary}</strong>
                          {entry.href && (
                            <>
                              {' '}
                              <Link className="activity-timeline-link" href={entry.href}>
                                Mở chi tiết →
                              </Link>
                            </>
                          )}
                        </td>
                        <td className="governance-audit-actor">
                          <strong>{entry.actorName}</strong>
                          <small className="muted">{roleLabels[entry.actorRole]}</small>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="tender-audit-pagination" aria-label="Phân trang kiểm toán">
                <span className="muted">
                  Hiển thị{' '}
                  <strong>
                    {auditStartIndex + 1}–{auditStartIndex + visibleAudits.length}
                  </strong>{' '}
                  trên tổng <strong>{filteredAudits.length}</strong> bản ghi
                </span>
                <div className="tender-audit-page-controls">
                  <button
                    type="button"
                    className="tender-chip-button"
                    disabled={safeAuditPage <= 1}
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
                    disabled={safeAuditPage >= totalAuditPages}
                    onClick={() => setAuditPage((prev) => Math.min(totalAuditPages, prev + 1))}
                  >
                    Trang sau →
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      )}

      {showPurgeModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="purge-modal-title"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            padding: '1rem',
          }}
        >
          <div
            className="surface"
            style={{
              maxWidth: '520px',
              width: '100%',
              borderRadius: '16px',
              padding: '1.75rem',
              boxShadow: '0 24px 48px rgba(0, 0, 0, 0.5)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                marginBottom: '1rem',
              }}
            >
              <div>
                <span
                  style={{
                    display: 'inline-block',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    background: 'rgba(239, 68, 68, 0.2)',
                    color: '#ef4444',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    marginBottom: '0.25rem',
                  }}
                >
                  ĐẶC QUYỀN OWNER · TIÊU HỦY VĨNH VIỄN
                </span>
                <h3 id="purge-modal-title" style={{ margin: 0, fontSize: '1.2rem', color: '#ef4444' }}>
                  Tiêu hủy tệp cách ly bảo mật
                </h3>
              </div>
              <button
                type="button"
                className="tender-icon-button"
                onClick={() => setShowPurgeModal(null)}
                aria-label="Đóng"
              >
                ✕
              </button>
            </div>

            <p className="muted" style={{ fontSize: '0.875rem', lineHeight: 1.5, margin: '0 0 1rem' }}>
              Hành động này sẽ <strong>xóa sạch nhị phân (binary)</strong> của tệp{' '}
              <strong style={{ color: '#f87171' }}>{showPurgeModal.fileName}</strong> khỏi kho lưu trữ.
              Dữ liệu kiểm toán, mã băm SHA-256 và lý do tiêu hủy sẽ được lưu vết vĩnh viễn trên sổ cái.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (!purgeReason.trim() || purgingId) return
                setPurgingId(showPurgeModal.id)
                purgeSecurityIncident(slug, showPurgeModal.id, purgeReason.trim())
                  .then(() => {
                    setShowPurgeModal(null)
                    setPurgeReason('')
                    setPolicyNotice('Đã tiêu hủy tệp bị cách ly và cập nhật sổ cái kiểm toán an toàn.')
                    return load()
                  })
                  .catch((err: unknown) => {
                    setError(err instanceof ApiError ? err.message : 'Không thể tiêu hủy tệp cách ly.')
                  })
                  .finally(() => {
                    setPurgingId(null)
                  })
              }}
            >
              <label style={{ display: 'block', marginBottom: '1.25rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>
                  Lý do tiêu hủy bắt buộc (Tối thiểu 6 ký tự để ghi vết kiểm toán)
                </span>
                <textarea
                  required
                  minLength={6}
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-subtle, rgba(255,255,255,0.15))',
                    background: 'var(--surface-sunken, rgba(0,0,0,0.3))',
                    color: 'var(--text-primary, #fff)',
                    fontSize: '0.875rem',
                    resize: 'vertical',
                  }}
                  placeholder="Ví dụ: Tệp giả mạo chữ ký định dạng PE/Windows executable, đã xử lý kỷ luật nhân sự và tiêu hủy theo quy định..."
                  value={purgeReason}
                  onChange={(e) => setPurgeReason(e.target.value)}
                />
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => setShowPurgeModal(null)}
                  disabled={Boolean(purgingId)}
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="button button-primary"
                  style={{ backgroundColor: '#ef4444', borderColor: '#ef4444', color: '#fff' }}
                  disabled={!purgeReason.trim() || Boolean(purgingId)}
                >
                  {purgingId ? 'Đang tiêu hủy...' : 'Xác nhận tiêu hủy vĩnh viễn'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showSuspendModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="suspend-modal-title"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            padding: '1rem',
          }}
        >
          <div
            className="surface"
            style={{
              maxWidth: '520px',
              width: '100%',
              borderRadius: '16px',
              padding: '1.75rem',
              boxShadow: '0 24px 48px rgba(0, 0, 0, 0.5)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                marginBottom: '1rem',
              }}
            >
              <div>
                <span
                  style={{
                    display: 'inline-block',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    background: 'rgba(239, 68, 68, 0.2)',
                    color: '#ef4444',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    marginBottom: '0.25rem',
                  }}
                >
                  ĐẶC QUYỀN OWNER · PHONG TỎA BẢO MẬT
                </span>
                <h3 id="suspend-modal-title" style={{ margin: 0, fontSize: '1.2rem', color: '#ef4444' }}>
                  Khóa tài khoản người gửi tệp mã độc
                </h3>
              </div>
              <button
                type="button"
                className="tender-icon-button"
                onClick={() => setShowSuspendModal(null)}
                aria-label="Đóng"
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: '0.875rem', lineHeight: 1.5, color: 'var(--ink)', margin: '0 0 0.85rem' }}>
              Bạn sắp thực thi biện pháp kỷ luật bảo mật đối với người dùng{' '}
              <strong style={{ color: '#ef4444' }}>{showSuspendModal.uploadedByUserName}</strong> vì sự cố{' '}
              <strong>{showSuspendModal.reference}</strong> (Tệp: <em>{showSuspendModal.fileName}</em>).
            </p>

            <div
              style={{
                padding: '0.85rem 1rem',
                borderRadius: '8px',
                background: 'var(--danger-soft, rgba(239, 68, 68, 0.08))',
                border: '1px solid var(--danger-line, rgba(239, 68, 68, 0.25))',
                fontSize: '0.8rem',
                lineHeight: 1.5,
                color: 'var(--danger-ink, #b91c1c)',
                marginBottom: '1.25rem',
              }}
            >
              <strong>Hệ thống sẽ thực thi ngay lập tức:</strong>
              <ul style={{ margin: '0.35rem 0 0 1rem', padding: 0 }}>
                <li>Chuyển trạng thái thành viên sang <code>DISABLED</code>.</li>
                <li>Hủy bỏ toàn bộ phiên làm việc (Revoke JWT Session) để buộc đăng xuất ngay.</li>
                <li>Cắt toàn bộ quyền xem hoặc thao tác trên hồ sơ thầu, catalog và kho tài liệu.</li>
              </ul>
            </div>

            {suspendError && (
              <p className="notice notice-error" style={{ marginBottom: '1rem', fontSize: '0.825rem' }}>
                {suspendError}
              </p>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (isSuspending) return
                setIsSuspending(true)
                setSuspendError(null)
                suspendIncidentUploader(slug, showSuspendModal.id, suspendReason.trim() || undefined)
                  .then((res) => {
                    setShowSuspendModal(null)
                    setSuspendReason('')
                    setPolicyNotice(res.message)
                    return load()
                  })
                  .catch((err: unknown) => {
                    setSuspendError(err instanceof ApiError ? err.message : 'Không thể khóa tài khoản.')
                  })
                  .finally(() => {
                    setIsSuspending(false)
                  })
              }}
            >
              <label style={{ display: 'block', marginBottom: '1.25rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '0.4rem', color: 'var(--ink)' }}>
                  Lý do đình chỉ (Tùy chọn)
                </span>
                <textarea
                  rows={2}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.8rem',
                    borderRadius: '8px',
                    border: '1px solid var(--field-line)',
                    background: 'var(--field-bg)',
                    color: 'var(--ink)',
                    fontSize: '0.875rem',
                    resize: 'vertical',
                  }}
                  placeholder="VD: Cố ý tải file độc hại giả mạo PDF, tạm thời khóa để điều tra an ninh nội bộ..."
                  value={suspendReason}
                  onChange={(e) => setSuspendReason(e.target.value)}
                />
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => setShowSuspendModal(null)}
                  disabled={isSuspending}
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="button button-primary"
                  style={{ backgroundColor: '#ef4444', borderColor: '#ef4444', color: '#fff' }}
                  disabled={isSuspending}
                >
                  {isSuspending ? 'Đang khóa...' : 'Xác nhận khóa tài khoản'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
