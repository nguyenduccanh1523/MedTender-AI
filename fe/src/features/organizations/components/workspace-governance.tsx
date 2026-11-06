'use client'

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
  INTERNAL: 'Nội bộ (INTERNAL) — Tiêu chuẩn vận hành trong tổ chức',
  CONFIDENTIAL: 'Bảo mật cao (CONFIDENTIAL) — Hồ sơ E-HSMT & giá dự thầu nhạy cảm',
  RESTRICTED: 'Hạn chế tối đa (RESTRICTED) — Yêu cầu kiểm soát nghiêm ngặt',
}

export function WorkspaceGovernanceView({ slug }: { slug: string }) {
  const role = useWorkspaceRole()
  const isOwner = canManageOrganizationGovernance(role)

  const [data, setData] = useState<OrganizationGovernance | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [orgName, setOrgName] = useState('')
  const [requireReviewer, setRequireReviewer] = useState(true)
  const [classification, setClassification] = useState<'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED'>(
    'CONFIDENTIAL',
  )
  const [savingPolicy, setSavingPolicy] = useState(false)
  const [policyNotice, setPolicyNotice] = useState<string | null>(null)
  const [memberSavingId, setMemberSavingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!isOwner) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const gov = await getOrganizationGovernance(slug)
      setData(gov)
      setOrgName(gov.name)
      setRequireReviewer(gov.settings.requireIndependentReviewer)
      setClassification(gov.settings.defaultDataClassification)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không tải được cấu hình quản trị tổ chức.')
    } finally {
      setLoading(false)
    }
  }, [slug, isOwner])

  useEffect(() => {
    if (!isOwner) return
    let active = true
    getOrganizationGovernance(slug)
      .then((gov) => {
        if (active) {
          setData(gov)
          setOrgName(gov.name)
          setRequireReviewer(gov.settings.requireIndependentReviewer)
          setClassification(gov.settings.defaultDataClassification)
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
  }, [slug, isOwner])

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
      <section className="tender-panel" aria-busy="true">
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
      <section className="tender-panel">
        <p className="form-error" role="alert">
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
      const updated = await updateOrganizationGovernance(slug, {
        name: orgName.trim(),
        requireIndependentReviewer: requireReviewer,
        defaultDataClassification: classification,
      })
      setData(updated)
      const cached = readCachedOrganization(slug)
      if (cached) {
        cacheOrganization({ ...cached, name: updated.name })
      }
      setPolicyNotice('Đã lưu cấu hình định danh & chính sách quản trị tổ chức.')
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
            Không gian này chỉ hiển thị với <strong>Chủ sở hữu (OWNER)</strong>. Tại đây bạn kiểm soát tên pháp
            nhân hiển thị, quy tắc bắt buộc thẩm định độc lập, phân loại bảo mật dữ liệu và bổ nhiệm hoặc thu hồi
            quyền của Quản trị viên (ADMIN).
          </p>
        </div>
        <div className="activity-role-banner-actions">
          <button
            className="button button-secondary button-icon"
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
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {policyNotice && (
        <p className="governance-success-banner" role="status">
          {policyNotice}
        </p>
      )}

      <div className="governance-grid">
        <section className="tender-panel">
          <div className="tender-panel-head">
            <div>
              <p className="eyebrow">Cấu hình Pháp nhân & Chính sách</p>
              <h2>Định danh tổ chức & Quy tắc kiểm soát</h2>
              <p className="muted">
                Mã định danh tenant: <code>{data.slug}</code> · Trạng thái: <strong>{data.status}</strong>
              </p>
            </div>
          </div>

          <form className="tender-form" onSubmit={handleSavePolicy}>
            <div className="tender-form-grid">
              <label className="field field-wide">
                <span>Tên hiển thị của tổ chức / bệnh viện / nhà thầu</span>
                <input
                  required
                  minLength={2}
                  maxLength={100}
                  value={orgName}
                  onChange={(event) => setOrgName(event.target.value)}
                />
              </label>

              <label className="field field-wide">
                <span>Mức phân loại bảo mật dữ liệu mặc định</span>
                <select
                  value={classification}
                  onChange={(event) =>
                    setClassification(
                      event.target.value as 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED',
                    )
                  }
                >
                  {Object.entries(classificationLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="governance-checkbox-field field-wide">
                <input
                  type="checkbox"
                  checked={requireReviewer}
                  onChange={(event) => setRequireReviewer(event.target.checked)}
                />
                <div>
                  <strong>Bắt buộc thẩm định độc lập bởi REVIEWER trước khi chốt hồ sơ</strong>
                  <p className="muted">
                    Đảm bảo nguyên tắc 4 mắt (Four-Eyes Principle): người lập phân tích không thể tự phê duyệt kết quả.
                  </p>
                </div>
              </label>
            </div>

            <div className="governance-guardrails">
              <div className="governance-guardrail-item">
                <span>Chính sách AI bên ngoài</span>
                <strong>{data.settings.externalAiPolicy} (Khóa cứng bảo mật)</strong>
              </div>
              <div className="governance-guardrail-item">
                <span>Giới hạn cấu trúc Hồ sơ thầu</span>
                <strong>
                  {data.settings.maxLotsPerTender} Lot / {data.settings.maxItemsPerTender} Item
                </strong>
              </div>
              <div className="governance-guardrail-item">
                <span>Giới hạn thông số mỗi Phiên bản Catalog</span>
                <strong>{data.settings.maxSpecsPerVersion} thông số kỹ thuật</strong>
              </div>
            </div>

            <div className="tender-form-actions">
              <button className="button button-primary" disabled={savingPolicy} type="submit">
                {savingPolicy ? 'Đang lưu chính sách...' : 'Lưu chính sách tổ chức'}
              </button>
            </div>
          </form>
        </section>

        <section className="tender-panel">
          <div className="tender-panel-head">
            <div>
              <p className="eyebrow">Quản trị Cấp cao · Bổ nhiệm & Hạ quyền ADMIN</p>
              <h2>Kiểm soát vai trò & Trạng thái thành viên ({data.members.length})</h2>
              <p className="muted">
                Chỉ <strong>OWNER</strong> mới có quyền thăng cấp thành viên lên <strong>ADMIN</strong>, chuyển đổi
                vai trò của <strong>ADMIN</strong> hoặc tạm khóa tài khoản trong tổ chức.
              </p>
            </div>
          </div>

          <div className="governance-member-list">
            {data.members.map((member) => {
              const isTargetOwner = member.role === 'OWNER'
              const isBusy = memberSavingId === member.userId
              return (
                <article key={member.userId} className="governance-member-row">
                  <div className="governance-member-info">
                    <strong>{member.name}</strong>
                    <div className="governance-member-badges">
                      <span className="tender-stage-pill">{roleLabels[member.role]}</span>
                      <span
                        className={
                          member.status === 'ACTIVE'
                            ? 'catalog-status-pill is-published'
                            : 'catalog-status-pill is-superseded'
                        }
                      >
                        {member.status === 'ACTIVE' ? 'Đang hoạt động' : 'Đã tạm khóa'}
                      </span>
                    </div>
                  </div>

                  {isTargetOwner ? (
                    <span className="muted">Chủ sở hữu tối cao (Cố định)</span>
                  ) : (
                    <div className="governance-member-controls">
                      <label className="tender-inline-control">
                        <span>Vai trò</span>
                        <select
                          aria-label={`Vai trò của ${member.name}`}
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
                      </label>

                      <button
                        className={
                          member.status === 'ACTIVE'
                            ? 'button button-danger'
                            : 'button button-secondary'
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
                </article>
              )
            })}
          </div>
        </section>
      </div>

      <section className="tender-panel">
        <div className="tender-panel-head">
          <div>
            <p className="eyebrow">Kiểm toán cấp Tổ chức</p>
            <h2>Nhật ký điều hành & Thay đổi trọng yếu</h2>
            <p className="muted">
              Tổng hợp các sự kiện thay đổi chính sách tổ chức, phân quyền thành viên, xuất bản phiên bản catalog và
              thao tác trên hồ sơ thầu.
            </p>
          </div>
        </div>

        {data.recentAudits.length === 0 ? (
          <p className="muted">Chưa có bản ghi kiểm toán nào trong tổ chức.</p>
        ) : (
          <ol className="tender-audit-list" aria-label="Nhật ký kiểm toán cấp tổ chức">
            {data.recentAudits.map((entry) => (
              <li key={entry.id}>
                <div>
                  <span className="tender-code">{entry.action}</span>
                  <strong>{entry.summary}</strong>
                  <span className="muted">
                    Thực hiện bởi {entry.actorName} ({roleLabels[entry.actorRole]})
                  </span>
                </div>
                <time dateTime={String(entry.createdAt)}>
                  {new Date(entry.createdAt).toLocaleString('vi-VN')}
                </time>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}
