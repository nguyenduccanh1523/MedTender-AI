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

const rolePermissionsSummary: Record<Organization['role'], ReadonlyArray<{ label: string; allowed: boolean }>> = {
  OWNER: [
    { label: 'Tạo, chỉnh sửa và xóa hồ sơ thầu / lot / hàng hóa', allowed: true },
    { label: 'Xem nhật ký thay đổi (Audit log) của hồ sơ thầu', allowed: true },
    { label: 'Quản trị thành viên, lời mời và phân quyền tổ chức', allowed: true },
    { label: 'Cấu hình chính sách dữ liệu và AI của tổ chức', allowed: true },
  ],
  ADMIN: [
    { label: 'Tạo, chỉnh sửa và xóa hồ sơ thầu / lot / hàng hóa', allowed: true },
    { label: 'Xem nhật ký thay đổi (Audit log) của hồ sơ thầu', allowed: true },
    { label: 'Mời và quản lý thành viên nghiệp vụ trong tổ chức', allowed: true },
    { label: 'Cấu hình chính sách dữ liệu và AI của tổ chức', allowed: true },
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
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'MT'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

export function WorkspaceProfile({ slug }: { slug: string }) {
  const workspaceRole = useWorkspaceRole()
  const currentOrg = readCachedOrganization(slug)
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
      setProfileMessage('Đã cập nhật họ tên hiển thị.')
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

  const effectiveRole = workspaceRole ?? currentOrg?.role ?? 'VIEWER'
  const permissions = rolePermissionsSummary[effectiveRole]

  return (
    <div className="profile-page">
      <section className="profile-hero-card" aria-label="Thông tin định danh tài khoản">
        <div className="profile-identity">
          <div className="profile-avatar" aria-hidden="true">
            {getInitials(user?.name || 'MedTender')}
          </div>
          <div className="profile-identity-copy">
            <div className="profile-badges">
              <span className="profile-role-pill">{roleLabels[effectiveRole]}</span>
              <span className="profile-status-pill">
                <i aria-hidden="true" /> Đang xác thực
              </span>
              {user?.systemRole === 'SYSTEM_ADMIN' && (
                <span className="profile-sysadmin-pill">SYSTEM ADMIN</span>
              )}
            </div>
            <h2>{user?.name || 'Tài khoản MedTender'}</h2>
            <p>{user?.email || 'Đang đồng bộ email…'}</p>
          </div>
        </div>
        <div className="profile-org-context">
          <span>Tổ chức hiện tại</span>
          <strong>{currentOrg?.name || slug}</strong>
          <small>Mã định danh: /{slug}</small>
        </div>
      </section>

      <div className="profile-grid">
        <section className="surface profile-card" aria-label="Cập nhật thông tin cá nhân">
          <div className="profile-card-head">
            <div>
              <p className="eyebrow">Định danh</p>
              <h3>Thông tin cá nhân</h3>
            </div>
          </div>
          <form className="stack-form profile-form" onSubmit={submitProfile}>
            <label>
              Họ và tên hiển thị
              <input
                name="name"
                value={nameInput}
                onChange={(event) => setNameInput(event.target.value)}
                required
                minLength={2}
                maxLength={100}
                placeholder="Nhập họ và tên"
              />
            </label>
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
              <p className="eyebrow">Phân quyền RBAC</p>
              <h3>Quyền hạn của {roleLabels[effectiveRole]}</h3>
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
              <p className="eyebrow">Đa tổ chức (Multi-tenant)</p>
              <h3>Tổ chức bạn tham gia</h3>
            </div>
            <Link className="tender-text-button" href="/organizations">
              Đổi tổ chức →
            </Link>
          </div>
          {!organizations || organizations.length === 0 ? (
            <p className="muted">Đang tải danh sách tổ chức…</p>
          ) : (
            <ul className="profile-org-list">
              {organizations.map((org) => (
                <li key={org.id} className={org.slug === slug ? 'is-current' : undefined}>
                  <div>
                    <strong>{org.name}</strong>
                    <small>/{org.slug}</small>
                  </div>
                  <div className="profile-org-right">
                    <span className="profile-org-role">{roleLabels[org.role]}</span>
                    {org.slug === slug ? (
                      <span className="profile-org-active">Đang mở</span>
                    ) : (
                      <Link href={`/${org.slug}`} className="tender-text-button">
                        Chuyển
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
