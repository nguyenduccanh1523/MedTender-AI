'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

import { getCurrentUser, logout } from '../../auth/api'
import { readCachedUser, clearCachedUser } from '../../auth/session-cache'
import { clearOrganizationCache } from '../../organizations/organization-cache'
import { ApiError } from '../../../lib/api/client'
import { LoadingSkeleton } from '../../../components/ui/loading-skeleton'
import { ThemeToggle } from '../../../components/theme/theme-toggle'
import { clearResources } from '../../../lib/api/resource-cache'
import {
  approveOrganizationApplication,
  listOrganizationApplications,
  rejectOrganizationApplication,
  type OrganizationApplication,
} from '../api'

const statusLabels = { PENDING: 'Chờ duyệt', APPROVED: 'Đã duyệt', REJECTED: 'Đã từ chối' }
const countRecent = (applications: OrganizationApplication[]) => applications.filter(({ createdAt }) => {
  const age = Date.now() - new Date(createdAt).getTime()
  return age >= 0 && age <= 7 * 24 * 60 * 60 * 1000
}).length

export function SystemAdminDashboard() {
  const router = useRouter()
  const [items, setItems] = useState<OrganizationApplication[]>()
  const [selected, setSelected] = useState<string>()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [activationLink, setActivationLink] = useState('')
  const [recentCount, setRecentCount] = useState(0)

  async function refresh() {
    const [user, applications] = await Promise.all([getCurrentUser(), listOrganizationApplications()])
    if (user.systemRole !== 'SYSTEM_ADMIN') throw new ApiError(403, 'Bạn không có quyền System Admin.')
    setItems(applications)
    setRecentCount(countRecent(applications))
    setSelected((current) => current && applications.some(({ id }) => id === current) ? current : applications[0]?.id)
  }

  useEffect(() => {
    let active = true
    const cachedUser = readCachedUser()
    Promise.all([cachedUser ? Promise.resolve(cachedUser) : getCurrentUser(), listOrganizationApplications()])
      .then(([user, applications]) => {
        if (!active) return
        if (user.systemRole !== 'SYSTEM_ADMIN') throw new ApiError(403, 'Bạn không có quyền System Admin.')
        setItems(applications)
        setRecentCount(countRecent(applications))
        setSelected(applications[0]?.id)
      })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'Không tải được hồ sơ.') })
    return () => { active = false }
  }, [])
  const current = useMemo(() => items?.find(({ id }) => id === selected), [items, selected])
  const metrics = useMemo(() => {
    const applications = items ?? []
    return {
      total: applications.length,
      pending: applications.filter(({ status }) => status === 'PENDING').length,
      approved: applications.filter(({ status }) => status === 'APPROVED').length,
      rejected: applications.filter(({ status }) => status === 'REJECTED').length,
    }
  }, [items])
  const orderedItems = useMemo(() => [...(items ?? [])].sort((a, b) => {
    if (a.status === 'PENDING' && b.status !== 'PENDING') return -1
    if (b.status === 'PENDING' && a.status !== 'PENDING') return 1
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  }), [items])

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
  if (!items) return <LoadingSkeleton />

  return <>
    <header className="admin-header"><div><p className="eyebrow">MedTender AI Control Center</p><strong>System Admin</strong></div><div className="admin-session"><span><i aria-hidden="true" /> Phiên quản trị an toàn</span><ThemeToggle /><button className="button button-secondary" onClick={() => logout().then(() => { clearCachedUser(); clearOrganizationCache(); clearResources(); router.replace('/login') })}>Đăng xuất</button></div></header>
    <main className="admin-page">
      <section className="admin-dashboard-hero" aria-label="Tổng quan hệ thống">
        <div><p className="eyebrow">Tổng quan hệ thống</p><h1>Điều hành đăng ký tổ chức</h1><p>Theo dõi hồ sơ đầu vào, xác minh thông tin và cấp quyền sở hữu workspace sau khi phê duyệt.</p></div>
        <div className="admin-hero-signal"><span>Hồ sơ cần xử lý</span><strong>{metrics.pending}</strong><small>{recentCount} hồ sơ mới trong 7 ngày</small></div>
      </section>
      <section className="admin-metrics" aria-label="Thống kê hồ sơ đăng ký">
        <article className="admin-metric"><span>Tổng hồ sơ</span><strong>{metrics.total}</strong><small>Tất cả đơn đã tiếp nhận</small></article>
        <article className="admin-metric is-pending"><span>Chờ duyệt</span><strong>{metrics.pending}</strong><small>Cần kiểm tra và quyết định</small></article>
        <article className="admin-metric is-approved"><span>Đã duyệt</span><strong>{metrics.approved}</strong><small>Đã cấp OWNER đầu tiên</small></article>
        <article className="admin-metric is-rejected"><span>Đã từ chối</span><strong>{metrics.rejected}</strong><small>Có ghi nhận lý do</small></article>
      </section>
      <section className="admin-distribution" aria-label="Phân bố trạng thái hồ sơ">
        <div><strong>Phân bố trạng thái</strong><span>Dựa trên {metrics.total} hồ sơ đăng ký</span></div>
        <div className="admin-distribution-track" role="img" aria-label={`${metrics.pending} chờ duyệt, ${metrics.approved} đã duyệt, ${metrics.rejected} đã từ chối`}>
          {metrics.total > 0 && <><span className="is-pending" style={{ width: `${metrics.pending / metrics.total * 100}%` }} /><span className="is-approved" style={{ width: `${metrics.approved / metrics.total * 100}%` }} /><span className="is-rejected" style={{ width: `${metrics.rejected / metrics.total * 100}%` }} /></>}
        </div>
        <div className="admin-distribution-legend"><span><i className="is-pending" /> Chờ duyệt</span><span><i className="is-approved" /> Đã duyệt</span><span><i className="is-rejected" /> Từ chối</span></div>
      </section>
      {error && <p className="notice notice-error" role="alert">{error}</p>}
      {activationLink && <div className="activation-share"><strong>Link kích hoạt local</strong><input aria-label="Liên kết kích hoạt" readOnly value={activationLink} /><button className="button button-secondary" onClick={() => navigator.clipboard.writeText(activationLink)}>Sao chép</button></div>}
      <div className="admin-workbench">
        <section className="application-queue" aria-label="Danh sách hồ sơ">
          <div className="queue-heading"><div><span className="queue-kicker">Hồ sơ đăng ký</span><strong>Hàng chờ phê duyệt</strong></div><span>{metrics.total} hồ sơ</span></div>
          {orderedItems.length === 0 ? <p className="muted empty-state">Chưa có hồ sơ đăng ký.</p> : orderedItems.map((item) => <button key={item.id} className={item.id === selected ? 'queue-item is-selected' : 'queue-item'} onClick={() => { setSelected(item.id); setActivationLink('') }}><span className={`status-pill is-${item.status.toLowerCase()}`}>{statusLabels[item.status]}</span><strong>{item.organizationName}</strong><small>{item.reference} · {new Date(item.createdAt).toLocaleDateString('vi-VN')}</small></button>)}
        </section>
        <section className="application-detail">
          {!current ? <p className="muted">Chọn một hồ sơ để xem chi tiết.</p> : <><div className="detail-heading"><div><span className={`status-pill is-${current.status.toLowerCase()}`}>{statusLabels[current.status]}</span><h2>{current.organizationName}</h2><p>{current.reference}</p></div>{current.status === 'PENDING' && <div className="detail-actions"><button className="button danger-button" disabled={busy} onClick={reject}>Từ chối</button><button className="button button-primary" disabled={busy} onClick={approve}>{busy ? 'Đang xử lý…' : 'Phê duyệt và cấp OWNER'}</button></div>}</div><div className="detail-section"><h3>Thông tin pháp lý & liên hệ</h3><p>Đối chiếu thông tin trước khi phê duyệt và gửi quyền sở hữu workspace.</p></div><dl className="detail-grid"><div><dt>Mã số thuế</dt><dd>{current.taxCode}</dd></div><div><dt>Website</dt><dd>{current.website || 'Chưa cung cấp'}</dd></div><div className="span-2"><dt>Địa chỉ</dt><dd>{current.address}</dd></div><div><dt>Người phụ trách</dt><dd>{current.contactName}</dd></div><div><dt>Số điện thoại</dt><dd>{current.contactPhone}</dd></div><div className="span-2"><dt>Email nhận kích hoạt</dt><dd>{current.contactEmail}</dd></div></dl>{current.rejectionReason && <p className="notice notice-error">Lý do từ chối: {current.rejectionReason}</p>}</>}
        </section>
      </div>
    </main>
  </>
}
