'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { ApiError } from '../../../lib/api/client'
import { LoadingSkeleton } from '../../../components/ui/loading-skeleton'
import { getCurrentUser, type PublicUser } from '../../auth/api'
import { readCachedUser } from '../../auth/session-cache'
import { listOrganizations, type Organization } from '../api'
import { primeOrganizations } from '../organization-cache'
import { loadResource, readResource } from '../../../lib/api/resource-cache'
import { roleLabels } from '../roles'
import { WorkspaceHeader } from './workspace-header'
import { WorkspaceProfile, cleanPersonalName, hasRoleSuffixInName } from './workspace-profile'

const roleScopeDescriptions: Record<Organization['role'], string> = {
  OWNER: 'Toàn quyền điều hành pháp nhân, cấu hình chính sách dữ liệu/AI, bổ nhiệm ADMIN và kiểm toán cấp tổ chức.',
  ADMIN: 'Quản trị đội ngũ nghiệp vụ, điều phối hồ sơ thầu, chuẩn hóa catalog và giám sát nhật ký hồ sơ.',
  BID_MANAGER: 'Khởi tạo, cập nhật cấu trúc Lot/Item của hồ sơ thầu và điều phối tiến độ chuẩn bị báo giá.',
  CATALOG_MANAGER: 'Quản lý danh mục thiết bị y tế, thông số kỹ thuật, cảnh báo xung đột nguồn và xuất bản phiên bản.',
  ANALYST: 'Thực hiện phân tích kỹ thuật, ánh xạ sản phẩm ứng viên và chuẩn bị bảng thuyết minh đáp ứng.',
  REVIEWER: 'Thẩm định độc lập bằng chứng kỹ thuật, kiểm tra chéo xung đột nguồn và phê duyệt hồ sơ.',
  VIEWER: 'Tra cứu hồ sơ thầu và danh mục thiết bị đã xuất bản ở chế độ chỉ đọc (Read-only).',
}

export function OrganizationPicker() {
  const [data, setData] = useState<{ user: PublicUser; organizations: Organization[] } | undefined>(() => {
    const user = readCachedUser()
    const organizations = readResource<Organization[]>('organizations')
    return user && organizations ? { user, organizations } : undefined
  })
  const [failure, setFailure] = useState<ApiError>()
  const [activeTab, setActiveTab] = useState<'workspaces' | 'profile'>('workspaces')

  useEffect(() => {
    let active = true
    const cachedUser = readCachedUser()
    const user = cachedUser ? Promise.resolve(cachedUser) : getCurrentUser()
    Promise.all([user, loadResource('organizations', listOrganizations)])
      .then(([resolvedUser, organizations]) => {
        primeOrganizations(organizations)
        if (active) setData({ user: resolvedUser, organizations })
      })
      .catch((error: ApiError) => {
        if (active) setFailure(error)
      })
    return () => {
      active = false
    }
  }, [])

  if (failure) {
    return (
      <main className="center-panel">
        <h1>{failure.status === 401 ? 'Phiên đăng nhập đã hết hạn' : 'Chưa tải được tổ chức'}</h1>
        <p className="muted" role="alert">{failure.message}</p>
        <Link className="button button-primary" href="/login">Về trang đăng nhập</Link>
      </main>
    )
  }

  if (!data) return <LoadingSkeleton />

  const personalName = cleanPersonalName(data.user.name)
  const hadRoleSuffix = hasRoleSuffixInName(data.user.name)

  return (
    <>
      <WorkspaceHeader />
      <main className="workspace-content org-hub-page">
        <section className="org-hub-banner">
          <div className="org-hub-banner-main">
            <div className="org-hub-badges">
              <span className="activity-role-badge">CỔNG TÀI KHOẢN ĐA TỔ CHỨC</span>
              <span className="activity-role-focus">{data.user.email}</span>
              {data.user.systemRole === 'SYSTEM_ADMIN' && (
                <span className="profile-sysadmin-pill">SYSTEM ADMIN</span>
              )}
            </div>
            <h1>Chọn tổ chức</h1>
            <p className="org-hub-greeting">
              Xin chào <strong>{personalName}</strong>. Chọn không gian làm việc của tổ chức mà bạn muốn truy cập hoặc quản lý hồ sơ cá nhân độc lập.
            </p>
            {hadRoleSuffix && (
              <p className="org-hub-role-note">
                Lưu ý kiến trúc: Tài khoản demo của bạn đang đặt tên hiển thị là <code>{data.user.name}</code>, nhưng <strong>vai trò (OWNER, ADMIN, REVIEWER…) chỉ gắn với từng tổ chức cụ thể</strong> chứ không cố định vào tài khoản cá nhân. Cùng một tài khoản này, bạn có thể là <strong>REVIEWER</strong> ở Bệnh viện A và là <strong>ADMIN / OWNER</strong> ở Công ty B. Bạn có thể chuẩn hóa lại tên cá nhân ở tab <em>Hồ sơ cá nhân & Bảo mật</em>.
              </p>
            )}
          </div>
          <div className="org-hub-summary-box">
            <span>Tổ chức đang tham gia</span>
            <strong>{data.organizations.length}</strong>
            <small>Phân quyền RBAC độc lập theo từng Workspace</small>
          </div>
        </section>

        <div className="tender-subtabs-bar" role="tablist" aria-label="Điều hướng cổng tài khoản">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'workspaces'}
            className={activeTab === 'workspaces' ? 'tender-subtab is-active' : 'tender-subtab'}
            onClick={() => setActiveTab('workspaces')}
          >
            Không gian làm việc của bạn
            <span className="tender-subtab-count">{data.organizations.length}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'profile'}
            className={activeTab === 'profile' ? 'tender-subtab is-active' : 'tender-subtab'}
            onClick={() => setActiveTab('profile')}
          >
            Hồ sơ cá nhân & Bảo mật tài khoản
          </button>
        </div>

        {activeTab === 'workspaces' ? (
          <div className="org-hub-grid">
            <section className="surface tender-list-panel">
              <div className="tender-section-head">
                <div>
                  <p className="eyebrow">Danh sách Workspace được cấp quyền</p>
                  <h2>Tổ chức của bạn ({data.organizations.length})</h2>
                  <p className="muted">
                    Mỗi tổ chức có không gian dữ liệu cô lập (Multi-tenant Isolation) và cấp cho tài khoản của bạn một vai trò riêng biệt.
                  </p>
                </div>
              </div>

              {data.organizations.length === 0 ? (
                <div className="tender-empty-box catalog-empty-box">
                  <h3>Bạn chưa thuộc tổ chức nào</h3>
                  <p className="muted">
                    Hãy mở đường dẫn lời mời từ Quản trị viên tổ chức hoặc gửi hồ sơ đăng ký pháp nhân mới để System Admin phê duyệt.
                  </p>
                </div>
              ) : (
                <ul className="org-hub-card-list">
                  {data.organizations.map((org) => (
                    <li key={org.id} className="org-hub-card">
                      <div className="org-hub-card-body">
                        <div className="org-hub-card-top">
                          <span className="governance-org-status-badge is-active">
                            <i aria-hidden="true" /> ACTIVE WORKSPACE
                          </span>
                          <code className="governance-slug-code">/{org.slug}</code>
                          <span className="org-hub-role-pill">
                            Vai trò tại đây: <strong>{roleLabels[org.role]} ({org.role})</strong>
                          </span>
                        </div>
                        <h3>{org.name}</h3>
                        <p className="muted">{roleScopeDescriptions[org.role]}</p>
                      </div>
                      <div className="org-hub-card-actions">
                        <Link
                          className="button button-primary"
                          href={`/${org.slug}`}
                          scroll={false}
                          onClick={() => window.scrollTo({ top: 0, left: 0, behavior: 'instant' })}
                        >
                          Vào Workspace →
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <aside className="org-hub-side">
              <section className="surface tender-list-panel">
                <p className="eyebrow">Mở rộng quy mô</p>
                <h2>Tổ chức mới</h2>
                <p className="muted" style={{ marginTop: '0.35rem', marginBottom: '1rem' }}>
                  Nếu bạn đại diện cho một Bệnh viện hoặc Công ty thiết bị y tế mới, hãy gửi hồ sơ đăng ký. Khi được System Admin phê duyệt, tài khoản <strong>{data.user.email}</strong> sẽ trở thành <strong>Chủ sở hữu (OWNER)</strong> của tổ chức mới đó.
                </p>
                <Link className="button button-primary" href="/apply">
                  Gửi hồ sơ đăng ký
                </Link>
              </section>

              <section className="surface tender-list-panel">
                <p className="eyebrow">Cơ chế phân quyền đa tổ chức</p>
                <h3>Tại sao 1 tài khoản có nhiều Role?</h3>
                <ul className="org-hub-explainer-list">
                  <li>
                    <strong>Tài khoản cá nhân là duy nhất:</strong> Bạn chỉ cần 1 email đăng nhập và 1 mật khẩu để làm việc trên toàn hệ thống.
                  </li>
                  <li>
                    <strong>Vai trò gắn theo từng Tổ chức:</strong> Trong bảng phân quyền <code>OrganizationMember</code>, quyền hạn được xác định bởi cặp <code>(userId, organizationId)</code>.
                  </li>
                  <li>
                    <strong>Hồ sơ cá nhân đặt tại Cổng tài khoản:</strong> Bạn có thể cập nhật họ tên, mật khẩu ngay tại tab <em>Hồ sơ cá nhân & Bảo mật tài khoản</em> phía trên mà không phụ thuộc vào bất kỳ tổ chức nào.
                  </li>
                </ul>
              </section>
            </aside>
          </div>
        ) : (
          <WorkspaceProfile />
        )}
      </main>
    </>
  )
}
