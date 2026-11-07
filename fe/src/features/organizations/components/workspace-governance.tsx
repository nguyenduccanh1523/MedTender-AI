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

type GovernanceTab = 'policy' | 'members' | 'audits'
type AuditScopeFilter = 'ALL' | 'ORG' | 'CATALOG' | 'TENDER'

const auditScopeLabels: Record<AuditScopeFilter, string> = {
  ALL: 'Tất cả bản ghi',
  ORG: 'Tổ chức & Phân quyền',
  CATALOG: 'Catalog & Phiên bản',
  TENDER: 'Hồ sơ thầu / Lot / Item',
}

function matchAuditScope(action: string, scope: AuditScopeFilter) {
  if (scope === 'ALL') return true
  if (scope === 'ORG') return action.startsWith('ORG_')
  if (scope === 'CATALOG') return action.startsWith('CATALOG_')
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
      const gov = await getOrganizationGovernance(slug)
      applyGovState(gov)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không tải được cấu hình quản trị tổ chức.')
    } finally {
      setLoading(false)
    }
  }, [slug, isOwner, applyGovState])

  useEffect(() => {
    if (!isOwner) return
    let active = true
    getOrganizationGovernance(slug)
      .then((gov) => {
        if (active) {
          applyGovState(gov)
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
    </div>
  )
}
