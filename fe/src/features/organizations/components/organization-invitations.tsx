'use client'

import { useEffect, useState, type FormEvent } from 'react'

import {
  createInvitation, listInvitations, revokeInvitation, type Invitation, type InviteInput,
} from '../invitations-api'
import { roleLabels } from '../roles'

const roles: InviteInput['role'][] = ['ADMIN', 'BID_MANAGER', 'ANALYST', 'CATALOG_MANAGER', 'REVIEWER', 'VIEWER']

function invitationStatus(invitation: Invitation) {
  if (invitation.acceptedAt) return 'Đã nhận'
  if (invitation.revokedAt) return 'Đã thu hồi'
  if (Date.parse(invitation.expiresAt) <= Date.now()) return 'Đã hết hạn'
  return 'Đang chờ'
}

function message(cause: unknown) {
  return cause instanceof Error ? cause.message : 'Không xử lý được lời mời.'
}

export function OrganizationInvitations({ slug, role }: { slug: string; role: 'OWNER' | 'ADMIN' }) {
  const [invitations, setInvitations] = useState<Invitation[]>()
  const [error, setError] = useState('')
  const [link, setLink] = useState('')
  const [copyStatus, setCopyStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const allowed = role === 'OWNER' ? roles : roles.filter((item) => item !== 'ADMIN')

  useEffect(() => {
    let active = true
    listInvitations(slug)
      .then((items) => { if (active) setInvitations(items) })
      .catch((cause: unknown) => { if (active) setError(message(cause)) })
    return () => { active = false }
  }, [slug])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const form = event.currentTarget
    const fields = new FormData(form)
    const target = allowed.find((value) => value === fields.get('role'))
    if (!target) return
    setBusy(true)
    setError('')
    setCopyStatus('')
    setLink('')
    try {
      const { token, ...invitation } = await createInvitation(slug, { email: String(fields.get('email') ?? ''), role: target })
      setInvitations((items) => [invitation, ...(items ?? [])].slice(0, 50))
      setLink(`${window.location.origin}/invite#${token}`)
      form.reset()
    } catch (cause) {
      setError(message(cause))
    } finally {
      setBusy(false)
    }
  }

  async function revoke(id: string) {
    setBusy(true)
    setError('')
    try {
      await revokeInvitation(slug, id)
      setInvitations((items) => items?.map((item) => item.id === id
        ? { ...item, revokedAt: new Date().toISOString() }
        : item))
      setLink('')
      setCopyStatus('')
    } catch (cause) {
      setError(message(cause))
    } finally {
      setBusy(false)
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link)
      setCopyStatus('Đã sao chép liên kết.')
    } catch {
      setCopyStatus('Chọn liên kết trong ô bên dưới để sao chép.')
    }
  }

  return (
    <section className="surface members-panel" aria-labelledby="invitations-title">
      <h2 id="invitations-title">Mời thành viên</h2>
      <p className="muted">Chọn vai trò rồi chia sẻ liên kết riêng với người dùng đúng email. Liên kết có hiệu lực 7 ngày.</p>
      <form className="stack-form invitation-form" method="post" onSubmit={submit} aria-busy={busy}>
        <label>Email người nhận<input name="email" type="email" required maxLength={254} placeholder="thanhvien@tochuc.vn" /></label>
        <div className="invitation-role-field">
          <label htmlFor="invitation-role">Vai trò</label>
          <select id="invitation-role" name="role" defaultValue="VIEWER">
            {allowed.map((item) => <option key={item} value={item}>{roleLabels[item]}</option>)}
          </select>
        </div>
        <button className="button button-primary" type="submit" disabled={busy}>Tạo lời mời</button>
      </form>
      {error && <p className="notice notice-error members-state" role="alert">{error}</p>}
      {link && (
        <div className="stack-form">
          <label>Liên kết lời mời<input readOnly value={link} onFocus={(event) => event.target.select()} /></label>
          <button className="button button-secondary" type="button" onClick={copyLink}>Sao chép liên kết</button>
          {copyStatus && <p className="muted" role="status">{copyStatus}</p>}
        </div>
      )}
      {invitations === undefined ? (
        <div className="members-skeleton" aria-label="Đang tải lời mời" aria-busy="true"><i /><i /><i /></div>
      ) : invitations.length ? (
        <ul className="invitation-list" aria-label="Lời mời gần đây">
          {invitations.map((item) => {
            const status = invitationStatus(item)
            return (
              <li key={item.id}>
                <div>
                  <strong>{item.email}</strong>
                  <p className="muted">{roleLabels[item.role]} · {status}</p>
                </div>
                {status === 'Đang chờ' && (role === 'OWNER' || item.role !== 'ADMIN') && (
                  <button className="button button-secondary" type="button" disabled={busy} onClick={() => revoke(item.id)}>
                    Thu hồi
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      ) : <p className="muted members-state">Chưa có lời mời.</p>}
    </section>
  )
}
