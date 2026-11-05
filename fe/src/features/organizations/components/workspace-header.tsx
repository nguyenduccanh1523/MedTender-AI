'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { Logo } from '../../../components/brand/logo'
import { logout } from '../../auth/api'

export function WorkspaceHeader({ label }: { label?: string }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  async function signOut() {
    setPending(true)
    setError('')
    try {
      await logout()
      router.replace('/login')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể đăng xuất.')
      setPending(false)
    }
  }

  return (
    <header className="app-header">
      <div className="app-header-row">
        <Logo />
        <nav aria-label="Không gian làm việc">
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
