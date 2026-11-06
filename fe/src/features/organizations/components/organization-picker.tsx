'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { ApiError } from '../../../lib/api/client'
import { LoadingSkeleton } from '../../../components/ui/loading-skeleton'
import { getCurrentUser, type PublicUser } from '../../auth/api'
import { readCachedUser } from '../../auth/session-cache'
import { listOrganizations, type Organization } from '../api'
import { primeOrganizations } from '../organization-cache'
import { WorkspaceHeader } from './workspace-header'

export function OrganizationPicker() {
  const [data, setData] = useState<{ user: PublicUser; organizations: Organization[] }>()
  const [failure, setFailure] = useState<ApiError>()

  useEffect(() => {
    let active = true
    const cachedUser = readCachedUser()
    const user = cachedUser ? Promise.resolve(cachedUser) : getCurrentUser()
    Promise.all([user, listOrganizations()])
      .then(([resolvedUser, organizations]) => {
        primeOrganizations(organizations)
        if (active) setData({ user: resolvedUser, organizations })
      })
      .catch((error: ApiError) => { if (active) setFailure(error) })
    return () => { active = false }
  }, [])

  if (failure) return (
    <main className="center-panel">
      <h1>{failure.status === 401 ? 'Phiên đăng nhập đã hết hạn' : 'Chưa tải được tổ chức'}</h1>
      <p className="muted" role="alert">{failure.message}</p>
      <Link className="button button-primary" href="/login">Về trang đăng nhập</Link>
    </main>
  )

  if (!data) return <LoadingSkeleton />

  return (
    <>
      <WorkspaceHeader />
      <main className="workspace-content">
        <p className="eyebrow">Không gian làm việc</p>
        <h1>Chọn tổ chức</h1>
        <p className="muted">Xin chào {data.user.name}. Chọn nơi bạn muốn làm việc.</p>
        <div className="workspace-grid">
          <section className="surface">
            <h2>Tổ chức của bạn</h2>
            {data.organizations.length === 0 ? (
              <p className="muted empty-state">Bạn chưa thuộc tổ chức nào. Hãy mở link mời hoặc chờ System Admin phê duyệt hồ sơ.</p>
            ) : (
              <ul className="organization-list">
                {data.organizations.map((org) => (
                  <li key={org.id}>
                    <Link href={`/${org.slug}`}><strong>{org.name}</strong><span>{org.role} →</span></Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="surface">
            <h2>Tổ chức mới</h2>
            <p className="muted">Workspace chỉ được tạo sau khi hồ sơ tổ chức được System Admin phê duyệt.</p>
            <Link className="button button-primary members-state" href="/apply">Gửi hồ sơ đăng ký</Link>
          </section>
        </div>
      </main>
    </>
  )
}
