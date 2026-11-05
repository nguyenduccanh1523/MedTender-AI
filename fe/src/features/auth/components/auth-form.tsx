'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useSyncExternalStore, type FormEvent } from 'react'

import { submitAuth, type PublicUser } from '../api'

const subscribeToHydration = () => () => {}
const clientReady = () => true
const serverReady = () => false

interface AuthFormProps {
  mode: 'login' | 'register'
  onAuthenticated?: (user: PublicUser) => void
  onSwitchMode?: () => void
}

export function AuthForm({ mode, onAuthenticated, onSwitchMode }: AuthFormProps) {
  const router = useRouter()
  const registering = mode === 'register'
  const ready = useSyncExternalStore(subscribeToHydration, clientReady, serverReady)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!ready || pending) return
    const fields = new FormData(event.currentTarget)
    const credentials = { email: String(fields.get('email') ?? ''), password: String(fields.get('password') ?? '') }
    setPending(true)
    setError('')
    try {
      const user = await submitAuth(mode, registering ? { ...credentials, name: String(fields.get('name') ?? '') } : credentials)
      if (onAuthenticated) onAuthenticated(user)
      else router.replace(user.systemRole === 'SYSTEM_ADMIN' ? '/system-admin/organization-requests' : '/organizations')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Vui lòng thử lại.')
      setPending(false)
    }
  }

  return (
    <section className="auth-form-panel" aria-labelledby="auth-title">
      <p className="eyebrow">{registering ? 'Tài khoản mới' : 'Tài khoản của bạn'}</p>
      <h1 id="auth-title">{registering ? 'Tạo tài khoản' : 'Đăng nhập'}</h1>
      <p className="muted">
        {registering ? 'Tạo tài khoản để thiết lập không gian làm việc.' : 'Đăng nhập để chọn tổ chức và tiếp tục công việc.'}
      </p>
      <form className="stack-form" method="post" onSubmit={submit} aria-busy={!ready || pending}>
        {registering && (
          <label>Họ và tên<input name="name" autoComplete="name" required minLength={2} maxLength={100} /></label>
        )}
        <label>Email<input type="email" name="email" autoComplete="email" required maxLength={254} placeholder="ban@tochuc.vn" /></label>
        <label>
          Mật khẩu
          <input
            type="password" name="password" required maxLength={128} minLength={registering ? 12 : undefined}
            autoComplete={registering ? 'new-password' : 'current-password'}
            aria-describedby={registering ? 'password-hint' : undefined}
          />
        </label>
        {registering && <p className="input-hint" id="password-hint">Dùng ít nhất 12 ký tự.</p>}
        {error && <p className="notice notice-error" role="alert">{error}</p>}
        <button className="button button-primary" type="submit" disabled={!ready || pending}>
          {pending ? 'Đang xử lý…' : registering ? 'Tạo tài khoản' : 'Đăng nhập'}
        </button>
      </form>
      <p className="auth-switch">
        {registering ? 'Đã có tài khoản?' : 'Chưa có tài khoản?'}{' '}
        {onSwitchMode ? (
          <button className="auth-mode-button" type="button" onClick={onSwitchMode}>
            {registering ? 'Đăng nhập' : 'Đăng ký'}
          </button>
        ) : (
          <Link href={registering ? '/login' : '/register'}>{registering ? 'Đăng nhập' : 'Đăng ký'}</Link>
        )}
      </p>
    </section>
  )
}
