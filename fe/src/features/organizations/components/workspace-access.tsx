'use client'

import Link from 'next/link'
import { useEffect, useState, type ReactNode } from 'react'

import { ApiError } from '../../../lib/api/client'
import { getOrganization, type Organization } from '../api'
import { OrganizationInvitations } from './organization-invitations'
import { OrganizationMembers } from './organization-members'
import { WorkspaceHeader } from './workspace-header'

export function WorkspaceAccess({ slug, children }: { slug: string; children: ReactNode }) {
  const [organization, setOrganization] = useState<Organization>()
  const [failure, setFailure] = useState<ApiError>()

  useEffect(() => {
    let active = true
    getOrganization(slug)
      .then((org) => { if (active) setOrganization(org) })
      .catch((error: ApiError) => { if (active) setFailure(error) })
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

  if (!organization) return <main className="center-panel"><p role="status">Đang xác minh quyền truy cập…</p></main>

  return (
    <>
      <WorkspaceHeader label={organization.name} />
      <main className="workspace-content">
        <p className="eyebrow">Workspace · {organization.role}</p>
        <h1>{organization.name}</h1>
        {children}
        {(organization.role === 'OWNER' || organization.role === 'ADMIN') && (
          <>
            <OrganizationMembers slug={organization.slug} />
            <OrganizationInvitations slug={organization.slug} role={organization.role} />
          </>
        )}
      </main>
    </>
  )
}
