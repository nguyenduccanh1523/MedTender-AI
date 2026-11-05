'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useSyncExternalStore } from 'react'

import { getCurrentUser, logout, type PublicUser } from '../../auth/api'
import { AuthForm } from '../../auth/components/auth-form'
import { ApiError } from '../../../lib/api/client'
import { acceptInvitation } from '../invitations-api'

function subscribe(listener: () => void) {
  window.addEventListener('hashchange', listener)
  return () => window.removeEventListener('hashchange', listener)
}

function currentToken() { return window.location.hash.slice(1) }
function serverToken() { return undefined }

export function InvitationJoin() {
  const token = useSyncExternalStore(subscribe, currentToken, serverToken)
  const valid = typeof token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(token)
  const [user, setUser] = useState<PublicUser | null>()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const router = useRouter()

  useEffect(() => {
    if (!valid) return
    let active = true
    getCurrentUser()
      .then((identity) => { if (active) setUser(identity) })
      .catch((cause: unknown) => {
        if (!active) return
        if (!(cause instanceof ApiError) || cause.status !== 401) {
          setError(cause instanceof Error ? cause.message : 'Không kiểm tra được phiên đăng nhập.')
        }
        setUser(null)
      })
    return () => { active = false }
  }, [valid])

  async function join() {
    if (!token || busy) return
    setBusy(true)
    setError('')
    try {
      const organization = await acceptInvitation(token)
      router.replace(`/${organization.slug}`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không nhận được lời mời.')
      setBusy(false)
    }
  }

  async function switchAccount() {
    setBusy(true)
    setError('')
    try {
      await logout()
      setUser(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể đổi tài khoản.')
    } finally {
      setBusy(false)
    }
  }

  if (token === undefined || (valid && user === undefined)) {
    return <p className="muted" role="status">Đang mở lời mời…</p>
  }

  if (!valid) return (
    <section className="auth-form-panel">
      <h1>Liên kết lời mời không hợp lệ</h1>
      <p className="muted">Mở lại đường dẫn mà quản trị viên đã gửi cho bạn.</p>
      <Link className="button button-secondary members-state" href="/organizations">Về danh sách tổ chức</Link>
    </section>
  )

  if (!user) return (
    <div className="auth-form-panel">
      <p className="notice">Bạn có một lời mời. Đăng nhập hoặc đăng ký bằng email được mời.</p>
      {error && <p className="notice notice-error" role="alert">{error}</p>}
      <AuthForm
        key={mode}
        mode={mode}
        onAuthenticated={(identity) => { setUser(identity); setError('') }}
        onSwitchMode={() => setMode(mode === 'login' ? 'register' : 'login')}
      />
    </div>
  )

  return (
    <section className="auth-form-panel">
      <p className="eyebrow">Lời mời tổ chức</p>
      <h1>Tham gia tổ chức</h1>
      <p className="muted">Bạn đang dùng <strong>{user.email}</strong>. Hãy xác nhận email này trùng với email được mời.</p>
      {error && <p className="notice notice-error members-state" role="alert">{error}</p>}
      <div className="landing-actions">
        <button type="button" className="button button-primary" onClick={join} disabled={busy}>Nhận lời mời</button>
        <button type="button" className="button button-secondary" onClick={switchAccount} disabled={busy}>Đổi tài khoản</button>
      </div>
    </section>
  )
}
