'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'

import { ApiError } from '../../../lib/api/client'
import { LoadingSkeleton } from '../../../components/ui/loading-skeleton'
import { getOrganization, type Organization } from '../api'
import { cacheOrganization, readCachedOrganization } from '../organization-cache'
import { OrganizationInvitations } from './organization-invitations'
import { OrganizationMembers } from './organization-members'
import { WorkspaceHeader } from './workspace-header'
import { WorkspaceOverview } from './workspace-overview'
import { RoleLanding } from './role-landing'
import { loadResource } from '../../../lib/api/resource-cache'
import { listTenders } from '../../tenders/api'
import { WorkspaceRoleProvider } from '../workspace-permissions'

type WorkspaceSection = 'overview' | 'activity' | 'tenders' | 'team'

export function WorkspaceAccess({ slug, children, section }: { slug: string; children: ReactNode; section?: WorkspaceSection }) {
  const pathname = usePathname()
  const [organization, setOrganization] = useState<Organization | undefined>(() => readCachedOrganization(slug))
  const [failure, setFailure] = useState<ApiError>()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  function toggleSidebar() {
    setSidebarCollapsed((current) => !current)
  }

  useEffect(() => {
    if (readCachedOrganization(slug)) return
    let active = true
    getOrganization(slug)
      .then((org) => { cacheOrganization(org); if (active) setOrganization(org) })
      .catch((error: ApiError) => { if (active && !readCachedOrganization(slug)) setFailure(error) })
    return () => { active = false }
  }, [slug])

  useEffect(() => {
    if (!organization || organization.slug !== slug) return
    // Warm the tender list after workspace access is known; the list view
    // shares this in-flight request and shows cached data immediately.
    const timer = window.setTimeout(() => {
      void loadResource(`tenders:${slug}`, () => listTenders(slug)).catch(() => undefined)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [organization, slug])

  if (failure) return (
    <main className="center-panel">
      <h1>{failure.status === 401 ? 'Phiên đăng nhập đã hết hạn' : 'Chưa mở được workspace'}</h1>
      <p className="muted" role="alert">{failure.message}</p>
      <Link className="button button-primary" href={failure.status === 401 ? '/login' : '/organizations'}>
        {failure.status === 401 ? 'Đăng nhập lại' : 'Chọn tổ chức khác'}
      </Link>
    </main>
  )

  if (!organization) return <LoadingSkeleton variant="workspace" />

  const canManageTeam = organization.role === 'OWNER' || organization.role === 'ADMIN'
  const activeSection = section ?? (pathname.includes('/tenders') ? 'tenders' : pathname.endsWith('/thanh-vien') ? 'team' : pathname.endsWith('/hoat-dong') ? 'activity' : 'overview')
  const navigation = [
    { href: `/${organization.slug}`, label: 'Tổng quan', icon: '◈', section: 'overview' },
    { href: `/${organization.slug}/hoat-dong`, label: 'Hoạt động', icon: '→', section: 'activity' },
    { href: `/${organization.slug}/tenders`, label: 'Hồ sơ thầu', icon: '□', section: 'tenders' },
    ...(canManageTeam ? [{ href: `/${organization.slug}/thanh-vien`, label: 'Quản trị đội ngũ', icon: '◎', section: 'team' }] : []),
  ] as const

  return (
    <WorkspaceRoleProvider role={organization.role}>
      <WorkspaceHeader label={organization.name} role={organization.role} />
      <div className={sidebarCollapsed ? 'workspace-app-shell is-sidebar-collapsed' : 'workspace-app-shell'}>
        <aside className="workspace-sidebar">
          <div className="workspace-sidebar-header"><p className="workspace-sidebar-label">Không gian làm việc</p><button type="button" className="workspace-sidebar-toggle" aria-label={sidebarCollapsed ? 'Mở menu bên trái' : 'Thu gọn menu bên trái'} aria-controls="workspace-navigation" aria-expanded={!sidebarCollapsed} onClick={toggleSidebar} title={sidebarCollapsed ? 'Mở menu' : 'Thu gọn menu'}><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/><path d={sidebarCollapsed ? 'm14 9 3 3-3 3' : 'm16 9-3 3 3 3'}/></svg></button></div>
          <nav id="workspace-navigation" aria-label="Điều hướng workspace">{navigation.map((item) => <Link aria-label={item.label} className={item.section === activeSection ? 'is-current' : ''} href={item.href} key={item.href} title={sidebarCollapsed ? item.label : undefined} scroll={false} onClick={() => window.scrollTo({ top: 0, left: 0, behavior: 'instant' })}><span aria-hidden="true">{item.icon}</span><span className="workspace-nav-label">{item.label}</span></Link>)}</nav>
          <div className="workspace-sidebar-note"><span>MEDTENDER AI</span><p>Dữ liệu và quyết định được tổ chức theo quyền truy cập.</p></div>
        </aside>
        <main className="workspace-content workspace-stage">
          <div className="workspace-title"><div><p className="eyebrow">Workspace</p><h1>{organization.name}</h1></div><span className="workspace-live"><i />Đang hoạt động</span></div>
          {activeSection === 'overview' && <><WorkspaceOverview organization={organization} /><RoleLanding organization={organization} /></>}
          {(activeSection !== 'team' || canManageTeam) && <section className="workspace-route-content">{children}</section>}
          {activeSection === 'team' && (canManageTeam ? <div><OrganizationMembers slug={organization.slug} /><OrganizationInvitations slug={organization.slug} role={organization.role as 'OWNER' | 'ADMIN'} /></div> : <section className="surface empty-state"><h2>Bạn không có quyền quản trị đội ngũ</h2><p className="muted">Liên hệ OWNER hoặc ADMIN của tổ chức để được hỗ trợ.</p></section>)}
        </main>
      </div>
    </WorkspaceRoleProvider>
  )
}
