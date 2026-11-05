'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

import { getCurrentUser, logout } from '../../auth/api'
import { ApiError } from '../../../lib/api/client'
import {
  approveOrganizationApplication,
  listOrganizationApplications,
  rejectOrganizationApplication,
  type OrganizationApplication,
} from '../api'

const statusLabels = { PENDING: 'Chờ duyệt', APPROVED: 'Đã duyệt', REJECTED: 'Đã từ chối' }

export function SystemAdminDashboard() {
  const router = useRouter()
  const [items, setItems] = useState<OrganizationApplication[]>()
  const [selected, setSelected] = useState<string>()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [activationLink, setActivationLink] = useState('')

  async function refresh() {
    const [user, applications] = await Promise.all([getCurrentUser(), listOrganizationApplications()])
    if (user.systemRole !== 'SYSTEM_ADMIN') throw new ApiError(403, 'Bạn không có quyền System Admin.')
    setItems(applications)
    setSelected((current) => current && applications.some(({ id }) => id === current) ? current : applications[0]?.id)
  }

  useEffect(() => {
    let active = true
    Promise.all([getCurrentUser(), listOrganizationApplications()])
      .then(([user, applications]) => {
        if (!active) return
        if (user.systemRole !== 'SYSTEM_ADMIN') throw new ApiError(403, 'Bạn không có quyền System Admin.')
        setItems(applications)
        setSelected(applications[0]?.id)
      })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'Không tải được hồ sơ.') })
    return () => { active = false }
  }, [])
  const current = useMemo(() => items?.find(({ id }) => id === selected), [items, selected])
  const pendingCount = items?.filter(({ status }) => status === 'PENDING').length ?? 0

  async function approve() {
    if (!current || busy) return
    setBusy(true); setError(''); setActivationLink('')
    try { const result = await approveOrganizationApplication(current.id); setActivationLink(result.activationLink ?? ''); await refresh() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không duyệt được hồ sơ.') }
    finally { setBusy(false) }
  }

  async function reject() {
    if (!current || busy) return
    const reason = window.prompt('Nhập lý do từ chối hồ sơ:')?.trim()
    if (!reason) return
    setBusy(true); setError(''); setActivationLink('')
    try { await rejectOrganizationApplication(current.id, reason); await refresh() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không từ chối được hồ sơ.') }
    finally { setBusy(false) }
  }

  if (error && !items) return <main className="center-panel"><h1>Không mở được trang quản trị</h1><p className="notice notice-error" role="alert">{error}</p><Link className="button button-secondary" href="/login">Đăng nhập lại</Link></main>
  if (!items) return <main className="center-panel"><p role="status">Đang tải hàng chờ phê duyệt…</p></main>

  return <>
    <header className="admin-header"><div><p className="eyebrow">MedTender AI Control Center</p><strong>System Admin</strong></div><button className="button button-secondary" onClick={() => logout().then(() => router.replace('/login'))}>Đăng xuất</button></header>
    <main className="admin-page">
      <div className="admin-title"><div><p className="eyebrow">Quản trị hệ thống</p><h1>Phê duyệt tổ chức</h1><p className="muted">Kiểm tra hồ sơ trước khi cấp workspace và tài khoản OWNER.</p></div><div className="admin-stat"><span>Đang chờ</span><strong>{pendingCount}</strong></div></div>
      {error && <p className="notice notice-error" role="alert">{error}</p>}
      {activationLink && <div className="activation-share"><strong>Link kích hoạt local</strong><input aria-label="Liên kết kích hoạt" readOnly value={activationLink} /><button className="button button-secondary" onClick={() => navigator.clipboard.writeText(activationLink)}>Sao chép</button></div>}
      <div className="admin-workbench">
        <section className="application-queue" aria-label="Danh sách hồ sơ">
          <div className="queue-heading"><strong>Hồ sơ gần đây</strong><span>{items.length} hồ sơ</span></div>
          {items.length === 0 ? <p className="muted empty-state">Chưa có hồ sơ đăng ký.</p> : items.map((item) => <button key={item.id} className={item.id === selected ? 'queue-item is-selected' : 'queue-item'} onClick={() => { setSelected(item.id); setActivationLink('') }}><span className={`status-pill is-${item.status.toLowerCase()}`}>{statusLabels[item.status]}</span><strong>{item.organizationName}</strong><small>{item.reference} · {new Date(item.createdAt).toLocaleDateString('vi-VN')}</small></button>)}
        </section>
        <section className="application-detail">
          {!current ? <p className="muted">Chọn một hồ sơ để xem chi tiết.</p> : <><div className="detail-heading"><div><span className={`status-pill is-${current.status.toLowerCase()}`}>{statusLabels[current.status]}</span><h2>{current.organizationName}</h2><p>{current.reference}</p></div>{current.status === 'PENDING' && <div className="detail-actions"><button className="button danger-button" disabled={busy} onClick={reject}>Từ chối</button><button className="button button-primary" disabled={busy} onClick={approve}>{busy ? 'Đang xử lý…' : 'Phê duyệt và cấp OWNER'}</button></div>}</div><dl className="detail-grid"><div><dt>Mã số thuế</dt><dd>{current.taxCode}</dd></div><div><dt>Website</dt><dd>{current.website || 'Chưa cung cấp'}</dd></div><div className="span-2"><dt>Địa chỉ</dt><dd>{current.address}</dd></div><div><dt>Người phụ trách</dt><dd>{current.contactName}</dd></div><div><dt>Số điện thoại</dt><dd>{current.contactPhone}</dd></div><div className="span-2"><dt>Email nhận kích hoạt</dt><dd>{current.contactEmail}</dd></div></dl>{current.rejectionReason && <p className="notice notice-error">Lý do từ chối: {current.rejectionReason}</p>}</>}
        </section>
      </div>
    </main>
  </>
}
