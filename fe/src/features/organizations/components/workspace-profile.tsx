'use client'

import Link from 'next/link'
import { useEffect, useState, type FormEvent } from 'react'

import { applyTheme, type ThemeMode } from '../../../components/theme/theme-toggle'
import { loadResource, readResource } from '../../../lib/api/resource-cache'
import {
  changePassword,
  getCurrentUser,
  updateProfile,
  type PublicUser,
} from '../../auth/api'
import { readCachedUser, saveCachedUser } from '../../auth/session-cache'
import { listOrganizations, type Organization } from '../api'
import { readCachedOrganization } from '../organization-cache'
import { roleLabels } from '../roles'
import { useWorkspaceRole } from '../workspace-permissions'

const ROLE_SUFFIX_PATTERN =
  /\s+(Owner|Admin|Bid Manager|Catalog Manager|Analyst|Reviewer|Viewer|BID_MANAGER|CATALOG_MANAGER|OWNER|ADMIN|ANALYST|REVIEWER|VIEWER)$/i

export function cleanPersonalName(rawName: string | undefined | null): string {
  if (!rawName) return 'Người dùng MedTender'
  const trimmed = rawName.trim()
  const cleaned = trimmed.replace(ROLE_SUFFIX_PATTERN, '').trim()
  return cleaned.length >= 2 ? cleaned : trimmed
}

export function hasRoleSuffixInName(rawName: string | undefined | null): boolean {
  if (!rawName) return false
  return ROLE_SUFFIX_PATTERN.test(rawName.trim())
}

const rolePermissionsSummary: Record<Organization['role'], ReadonlyArray<{ label: string; allowed: boolean }>> = {
  OWNER: [
    { label: 'Tạo, chỉnh sửa và xóa hồ sơ thầu / lot / hàng hóa', allowed: true },
    { label: 'Xem nhật ký thay đổi (Audit log) của hồ sơ thầu và cấp tổ chức', allowed: true },
    { label: 'Quản trị thành viên, bổ nhiệm ADMIN và phân quyền tổ chức', allowed: true },
    { label: 'Cấu hình chính sách dữ liệu, hạn mức và AI của tổ chức', allowed: true },
  ],
  ADMIN: [
    { label: 'Tạo, chỉnh sửa và xóa hồ sơ thầu / lot / hàng hóa', allowed: true },
    { label: 'Xem nhật ký thay đổi (Audit log) của hồ sơ thầu', allowed: true },
    { label: 'Mời và quản lý thành viên nghiệp vụ trong tổ chức', allowed: true },
    { label: 'Quản lý danh mục sản phẩm và phiên bản thông số kỹ thuật', allowed: true },
  ],
  BID_MANAGER: [
    { label: 'Tạo, chỉnh sửa và xóa hồ sơ thầu / lot / hàng hóa', allowed: true },
    { label: 'Điều phối chạy đối chiếu và xuất báo cáo', allowed: true },
    { label: 'Xem nhật ký kiểm toán nội bộ (chỉ OWNER / ADMIN)', allowed: false },
    { label: 'Quản trị thành viên và lời mời tổ chức', allowed: false },
  ],
  ANALYST: [
    { label: 'Xem danh sách và chi tiết hồ sơ thầu trong tổ chức', allowed: true },
    { label: 'Chuẩn hóa yêu cầu, chọn sản phẩm ứng viên và chạy phân tích', allowed: true },
    { label: 'Tạo hoặc xóa hồ sơ thầu gốc', allowed: false },
    { label: 'Xem nhật ký kiểm toán nội bộ (chỉ OWNER / ADMIN)', allowed: false },
  ],
  CATALOG_MANAGER: [
    { label: 'Quản lý danh mục sản phẩm, phiên bản và thông số kỹ thuật', allowed: true },
    { label: 'Xem hồ sơ thầu để đối chiếu nhu cầu', allowed: true },
    { label: 'Chỉnh sửa hồ sơ thầu hoặc phê duyệt kết quả', allowed: false },
    { label: 'Xem nhật ký kiểm toán nội bộ (chỉ OWNER / ADMIN)', allowed: false },
  ],
  REVIEWER: [
    { label: 'Kiểm tra bằng chứng độc lập, phê duyệt hoặc yêu cầu chỉnh sửa', allowed: true },
    { label: 'Xem chi tiết hồ sơ thầu và tài liệu nguồn', allowed: true },
    { label: 'Tạo hoặc sửa dữ liệu đầu vào của hồ sơ thầu', allowed: false },
    { label: 'Xem nhật ký kiểm toán nội bộ (chỉ OWNER / ADMIN)', allowed: false },
  ],
  VIEWER: [
    { label: 'Xem danh sách và chi tiết hồ sơ thầu được chia sẻ', allowed: true },
    { label: 'Tạo, chỉnh sửa hoặc xóa dữ liệu trong tổ chức', allowed: false },
    { label: 'Xem nhật ký kiểm toán nội bộ (chỉ OWNER / ADMIN)', allowed: false },
    { label: 'Quản trị thành viên trong tổ chức', allowed: false },
  ],
}

function getInitials(name: string) {
  const parts = cleanPersonalName(name).trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'MT'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

export function WorkspaceProfile({ slug }: { slug?: string }) {
  const workspaceRole = useWorkspaceRole()
  const currentOrg = slug ? readCachedOrganization(slug) : undefined
  const [user, setUser] = useState<PublicUser | undefined>(() => readCachedUser())
  const [organizations, setOrganizations] = useState<Organization[] | undefined>(() =>
    readResource<Organization[]>('organizations'),
  )
  const [nameInput, setNameInput] = useState(() => readCachedUser()?.name ?? '')
  const [profileBusy, setProfileBusy] = useState(false)
  const [profileMessage, setProfileMessage] = useState('')
  const [profileError, setProfileError] = useState('')

  const [passwordBusy, setPasswordBusy] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState('')
  const [passwordError, setPasswordError] = useState('')

  useEffect(() => {
    let active = true
    getCurrentUser()
      .then((resolved) => {
        saveCachedUser(resolved)
        if (active) {
          setUser(resolved)
          setNameInput(resolved.name)
        }
      })
      .catch(() => undefined)
    loadResource('organizations', listOrganizations)
      .then((orgs) => {
        if (active) setOrganizations(orgs)
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [])

  async function submitProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (profileBusy) return
    const trimmed = nameInput.trim()
    setProfileBusy(true)
    setProfileError('')
    setProfileMessage('')
    try {
      const updated = await updateProfile({ name: trimmed })
      saveCachedUser(updated)
      setUser(updated)
      setNameInput(updated.name)
      setProfileMessage('Đã cập nhật họ tên cá nhân hiển thị trên toàn hệ thống.')
    } catch (cause) {
      setProfileError(cause instanceof Error ? cause.message : 'Không cập nhật được hồ sơ.')
    } finally {
      setProfileBusy(false)
    }
  }

  async function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (passwordBusy) return
    const form = event.currentTarget
    const data = new FormData(form)
    const currentPassword = String(data.get('currentPassword') ?? '')
    const newPassword = String(data.get('newPassword') ?? '')
    const confirmPassword = String(data.get('confirmPassword') ?? '')

    setPasswordError('')
    setPasswordMessage('')
    if (newPassword !== confirmPassword) {
      setPasswordError('Mật khẩu xác nhận không khớp.')
      return
    }
    setPasswordBusy(true)
    try {
      await changePassword({ currentPassword, newPassword })
      form.reset()
      setPasswordMessage('Đã đổi mật khẩu thành công.')
    } catch (cause) {
      setPasswordError(cause instanceof Error ? cause.message : 'Không đổi được mật khẩu.')
    } finally {
      setPasswordBusy(false)
    }
  }

  function selectTheme(mode: ThemeMode) {
    applyTheme(mode)
  }

  const effectiveRole = workspaceRole ?? currentOrg?.role ?? organizations?.[0]?.role ?? 'VIEWER'
  const permissions = rolePermissionsSummary[effectiveRole]
  const suggestedCleanName = cleanPersonalName(nameInput)
  const showCleanSuggestion = hasRoleSuffixInName(nameInput) && suggestedCleanName !== nameInput.trim()

  return (
    <div className="profile-page">
      <section className="profile-hero-card" aria-label="Thông tin định danh tài khoản">
        <div className="profile-identity">
          <div className="profile-avatar" aria-hidden="true">
            {getInitials(user?.name || 'MedTender')}
          </div>
          <div className="profile-identity-copy">
            <div className="profile-badges">
              {slug ? (
                <span className="profile-role-pill">{roleLabels[effectiveRole]}</span>
              ) : (
                <span className="profile-role-pill">Tài khoản Đa tổ chức</span>
              )}
              <span className="profile-status-pill">
                <i aria-hidden="true" /> Đang xác thực
              </span>
              {user?.systemRole === 'SYSTEM_ADMIN' && (
                <span className="profile-sysadmin-pill">SYSTEM ADMIN</span>
              )}
            </div>
            <h2>{cleanPersonalName(user?.name) || 'Tài khoản MedTender'}</h2>
            <p>{user?.email || 'Đang đồng bộ email…'}</p>
          </div>
        </div>
        <div className="profile-org-context">
          {slug ? (
            <>
              <span>Tổ chức đang mở</span>
              <strong>{currentOrg?.name || slug}</strong>
              <small>Mã định danh: /{slug} · Vai trò: {roleLabels[effectiveRole]}</small>
            </>
          ) : (
            <>
              <span>Phạm vi quản lý</span>
              <strong>Cổng tài khoản cá nhân độc lập</strong>
              <small>Tham gia {organizations?.length ?? 0} tổ chức · Phân quyền độc lập theo từng nơi</small>
            </>
          )}
        </div>
      </section>

      <div className="profile-grid">
        <section className="surface profile-card" aria-label="Cập nhật thông tin cá nhân">
          <div className="profile-card-head">
            <div>
              <p className="eyebrow">Định danh độc lập</p>
              <h3>Thông tin cá nhân</h3>
            </div>
          </div>
          <form className="stack-form profile-form" onSubmit={submitProfile}>
            <label>
              Họ và tên cá nhân <span>(không gắn kèm chức danh tổ chức)</span>
              <input
                name="name"
                value={nameInput}
                onChange={(event) => setNameInput(event.target.value)}
                required
                minLength={2}
                maxLength={100}
                placeholder="Nhập họ và tên thật của bạn"
              />
            </label>
            {showCleanSuggestion && (
              <div className="profile-clean-name-hint">
                <span>
                  Tên tài khoản demo đang chứa hậu tố vai trò (<code>{nameInput}</code>). Vì một tài khoản có thể giữ nhiều vai trò khác nhau ở các tổ chức khác nhau, bạn nên đổi về tên cá nhân chuẩn:
                </span>
                <button
                  type="button"
                  className="tender-chip-button"
                  onClick={() => setNameInput(suggestedCleanName)}
                >
                  Dùng tên &ldquo;{suggestedCleanName}&rdquo;
                </button>
              </div>
            )}
            <label>
              Địa chỉ Email <span>(định danh đăng nhập cố định)</span>
              <input value={user?.email ?? ''} disabled readOnly />
            </label>
            <div className="profile-meta-row">
              <div>
                <span>ID người dùng</span>
                <code>{user?.id ?? '—'}</code>
              </div>
              <div>
                <span>Phương thức xác thực</span>
                <strong>JWT HttpOnly + Refresh xoay vòng</strong>
              </div>
            </div>
            {profileError && <p className="notice notice-error" role="alert">{profileError}</p>}
            {profileMessage && <p className="notice profile-notice-ok" role="status">{profileMessage}</p>}
            <button className="button button-primary" type="submit" disabled={profileBusy}>
              {profileBusy ? 'Đang lưu…' : 'Lưu thông tin'}
            </button>
          </form>
        </section>

        <section className="surface profile-card" aria-label="Đổi mật khẩu bảo mật">
          <div className="profile-card-head">
            <div>
              <p className="eyebrow">Bảo mật</p>
              <h3>Đổi mật khẩu</h3>
            </div>
          </div>
          <form className="stack-form profile-form" onSubmit={submitPassword}>
            <label>
              Mật khẩu hiện tại
              <input
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                required
                placeholder="••••••••••••"
              />
            </label>
            <label>
              Mật khẩu mới <span>(tối thiểu 12 ký tự)</span>
              <input
                name="newPassword"
                type="password"
                autoComplete="new-password"
                required
                minLength={12}
                maxLength={128}
                placeholder="Ít nhất 12 ký tự"
              />
            </label>
            <label>
              Xác nhận mật khẩu mới
              <input
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                minLength={12}
                maxLength={128}
                placeholder="Nhập lại mật khẩu mới"
              />
            </label>
            {passwordError && <p className="notice notice-error" role="alert">{passwordError}</p>}
            {passwordMessage && <p className="notice profile-notice-ok" role="status">{passwordMessage}</p>}
            <button className="button button-secondary" type="submit" disabled={passwordBusy}>
              {passwordBusy ? 'Đang cập nhật…' : 'Cập nhật mật khẩu'}
            </button>
          </form>
        </section>

        <section className="surface profile-card" aria-label="Phạm vi quyền hạn trong tổ chức">
          <div className="profile-card-head">
            <div>
              <p className="eyebrow">Phân quyền RBAC theo tổ chức</p>
              <h3>
                {slug
                  ? `Quyền hạn của ${roleLabels[effectiveRole]} tại ${currentOrg?.name || slug}`
                  : `Quyền hạn tham chiếu (${roleLabels[effectiveRole]})`}
              </h3>
            </div>
          </div>
          <ul className="profile-permission-list">
            {permissions.map((item) => (
              <li key={item.label} className={item.allowed ? 'is-allowed' : 'is-restricted'}>
                <span aria-hidden="true">{item.allowed ? '✓' : '—'}</span>
                <p>{item.label}</p>
              </li>
            ))}
          </ul>
          <div className="profile-theme-box">
            <div>
              <strong>Giao diện hiển thị</strong>
              <p className="muted">Đồng bộ tức thì trên mọi trang làm việc.</p>
            </div>
            <div className="profile-theme-actions">
              <button type="button" className="tender-chip-button" onClick={() => selectTheme('light')}>
                ☀ Sáng
              </button>
              <button type="button" className="tender-chip-button" onClick={() => selectTheme('dark')}>
                ☾ Tối
              </button>
            </div>
          </div>
        </section>

        <section className="surface profile-card" aria-label="Danh sách tổ chức thành viên">
          <div className="profile-card-head">
            <div>
              <p className="eyebrow">Đa tổ chức (Multi-tenant RBAC)</p>
              <h3>Ma trận vai trò theo từng tổ chức</h3>
            </div>
            {slug && (
              <Link className="tender-text-button" href="/organizations">
                Cổng tổ chức →
              </Link>
            )}
          </div>
          <p className="muted" style={{ fontSize: '0.82rem', marginBottom: '0.65rem' }}>
            Cùng một tài khoản cá nhân nhưng mỗi tổ chức cấp cho bạn một vai trò (Role) hoàn toàn độc lập:
          </p>
          {!organizations || organizations.length === 0 ? (
            <p className="muted">Đang tải danh sách tổ chức…</p>
          ) : (
            <ul className="profile-org-list">
              {organizations.map((org) => (
                <li key={org.id} className={slug && org.slug === slug ? 'is-current' : undefined}>
                  <div>
                    <strong>{org.name}</strong>
                    <small>/{org.slug}</small>
                  </div>
                  <div className="profile-org-right">
                    <span className="profile-org-role">{roleLabels[org.role]} ({org.role})</span>
                    {slug && org.slug === slug ? (
                      <span className="profile-org-active">Đang mở</span>
                    ) : (
                      <Link href={`/${org.slug}`} className="tender-text-button">
                        Mở Workspace →
                      </Link>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
