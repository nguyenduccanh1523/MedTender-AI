'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'

import { ApiError } from '../../../lib/api/client'
import { LoadingSkeleton } from '../../../components/ui/loading-skeleton'
import { getOrganization, type Organization } from '../api'
import { readCachedOrganization } from '../organization-cache'
import { OrganizationInvitations } from './organization-invitations'
import { OrganizationMembers } from './organization-members'
import { WorkspaceHeader } from './workspace-header'
import { WorkspaceOverview } from './workspace-overview'
import { RoleLanding } from './role-landing'
import { WorkspaceScrollTop } from './workspace-scroll-top'

type WorkspaceSection = 'overview' | 'activity' | 'team'

export function WorkspaceAccess({ slug, children, section }: { slug: string; children: ReactNode; section?: WorkspaceSection }) {
  const pathname = usePathname()
  const [organization, setOrganization] = useState<Organization | undefined>(() => readCachedOrganization(slug))
  const [failure, setFailure] = useState<ApiError>()

  useEffect(() => {
    let active = true
    getOrganization(slug)
      .then((org) => { if (active) setOrganization(org) })
      .catch((error: ApiError) => { if (active && !readCachedOrganization(slug)) setFailure(error) })
    return () => { active = false }
  }, [slug])

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
  const activeSection = section ?? (pathname.endsWith('/thanh-vien') ? 'team' : pathname.endsWith('/hoat-dong') ? 'activity' : 'overview')
  const navigation = [
    { href: `/${organization.slug}`, label: 'Tổng quan', icon: '◈', section: 'overview' },
    { href: `/${organization.slug}/hoat-dong`, label: 'Hoạt động', icon: '→', section: 'activity' },
    { href: `/${organization.slug}/tenders`, label: 'Hồ sơ thầu', icon: '□', section: 'activity' },
    ...(canManageTeam ? [{ href: `/${organization.slug}/thanh-vien`, label: 'Quản trị đội ngũ', icon: '◎', section: 'team' }] : []),
  ] as const

  return (
    <>
      <WorkspaceScrollTop />
      <WorkspaceHeader label={organization.name} role={organization.role} />
      <div className="workspace-app-shell">
        <aside className="workspace-sidebar"><p className="workspace-sidebar-label">Không gian làm việc</p><nav aria-label="Điều hướng workspace">{navigation.map((item) => <Link className={item.section === activeSection ? 'is-current' : ''} href={item.href} key={item.href}><span aria-hidden="true">{item.icon}</span>{item.label}</Link>)}</nav><div className="workspace-sidebar-note"><span>MEDTENDER AI</span><p>Dữ liệu và quyết định được tổ chức theo quyền truy cập.</p></div></aside>
        <main className="workspace-content workspace-stage">
          <div className="workspace-title"><div><p className="eyebrow">Workspace</p><h1>{organization.name}</h1></div><span className="workspace-live"><i />Đang hoạt động</span></div>
          {activeSection === 'overview' && <><WorkspaceOverview organization={organization} /><RoleLanding organization={organization} /></>}
          <section className="workspace-route-content">{children}</section>
          {activeSection === 'team' && (canManageTeam ? <div><OrganizationMembers slug={organization.slug} /><OrganizationInvitations slug={organization.slug} role={organization.role as 'OWNER' | 'ADMIN'} /></div> : <section className="surface empty-state"><h2>Bạn không có quyền quản trị đội ngũ</h2><p className="muted">Liên hệ OWNER hoặc ADMIN của tổ chức để được hỗ trợ.</p></section>)}
        </main>
      </div>
    </>
  )
}
