'use client'

import { useRouter } from 'next/navigation'
import { useState, useSyncExternalStore, type FormEvent } from 'react'

import { activateAccount } from '../api'

const subscribe = (listener: () => void) => { window.addEventListener('hashchange', listener); return () => window.removeEventListener('hashchange', listener) }
const clientToken = () => window.location.hash.slice(1)
const serverToken = () => undefined

export function AccountActivation() {
  const token = useSyncExternalStore(subscribe, clientToken, serverToken)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const valid = typeof token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(token)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!valid || pending) return
    const password = String(new FormData(event.currentTarget).get('password') ?? '')
    setPending(true); setError('')
    try { await activateAccount(token, password); router.replace('/organizations') }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không kích hoạt được tài khoản.'); setPending(false) }
  }

  if (token === undefined) return <p role="status">Đang mở liên kết kích hoạt…</p>
  if (!valid) return <section className="auth-form-panel"><h1>Liên kết không hợp lệ</h1><p className="muted">Hãy mở lại liên kết trong email phê duyệt.</p></section>
  return <section className="auth-form-panel"><p className="eyebrow">Tài khoản OWNER</p><h1>Kích hoạt tài khoản</h1><p className="muted">Tạo mật khẩu để bắt đầu quản lý tổ chức của bạn.</p><form className="stack-form" onSubmit={submit}><label>Mật khẩu mới<input name="password" type="password" required minLength={12} maxLength={128} autoComplete="new-password" /></label><p className="input-hint">Dùng ít nhất 12 ký tự.</p>{error && <p className="notice notice-error" role="alert">{error}</p>}<button className="button button-primary" disabled={pending}>{pending ? 'Đang kích hoạt…' : 'Kích hoạt và đăng nhập'}</button></form></section>
}
