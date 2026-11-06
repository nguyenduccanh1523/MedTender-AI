'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { Logo } from '../../../components/brand/logo'
import { logout } from '../../auth/api'
import { clearCachedUser } from '../../auth/session-cache'
import { clearOrganizationCache } from '../organization-cache'
import { clearResources } from '../../../lib/api/resource-cache'

export function WorkspaceHeader({ label, role }: { label?: string; role?: string }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  async function signOut() {
    setPending(true)
    setError('')
    try {
      await logout()
      clearCachedUser()
      clearOrganizationCache()
      clearResources()
      router.replace('/login')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể đăng xuất.')
      setPending(false)
    }
  }

  return (
    <header className="workspace-header">
      <div className="workspace-header-row">
        <Logo />
        <nav aria-label="Không gian làm việc" className="workspace-header-nav">
          {label && <span className="workspace-org-chip"><b>{label}</b>{role && <small>{role}</small>}</span>}
          {label && <Link href="/organizations">Đổi tổ chức</Link>}
          <button type="button" className="button button-secondary" onClick={signOut} disabled={pending}>
            {pending ? 'Đang đăng xuất…' : 'Đăng xuất'}
          </button>
        </nav>
      </div>
      {error && <p className="notice notice-error" role="alert">{error}</p>}
    </header>
  )
}
