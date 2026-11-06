'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { loadResource, readResource, writeResource } from '../../../lib/api/resource-cache'
import { canCreateTender, useWorkspaceRole } from '../../organizations/workspace-permissions'
import { listTenders, type Tender } from '../api'

export function TenderList({ slug }: { slug: string }) {
  const role = useWorkspaceRole()
  const key = `tenders:${slug}`
  const [items, setItems] = useState<Tender[] | undefined>(() => readResource(key))
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    let active = true
    loadResource(key, () => listTenders(slug))
      .then((result) => { if (active) setItems(result) })
      .catch((cause: Error) => { if (active) setError(cause.message) })
    return () => { active = false }
  }, [key, slug])

  async function refresh() {
    if (refreshing) return
    setRefreshing(true)
    setError('')
    try {
      const next = await listTenders(slug)
      writeResource(key, next)
      setItems(next)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không làm mới được danh sách hồ sơ.')
    } finally {
      setRefreshing(false)
    }
  }

  if (error && !items) return <p className="notice notice-error" role="alert">{error}</p>
  if (!items) return <div className="loading-skeleton" aria-label="Đang tải hồ sơ thầu" />

  return <section className="surface">
    <div className="section-heading">
      <div><p className="eyebrow">Hồ sơ thầu</p><h2>Hồ sơ mua sắm</h2></div>
      <div className="tender-list-actions"><button className="button button-secondary" type="button" disabled={refreshing} onClick={refresh}>{refreshing ? 'Đang làm mới…' : 'Làm mới'}</button>{canCreateTender(role) && <Link className="button button-primary" href={`/${slug}/tenders/new`}>Tạo hồ sơ</Link>}</div>
    </div>
    {error && <p className="notice notice-error" role="alert">{error}</p>}
    {items.length === 0
      ? <p className="muted empty-state">{canCreateTender(role) ? 'Chưa có hồ sơ. Tạo RFQ, E-HSMT hoặc hồ sơ nội bộ đầu tiên.' : 'Chưa có hồ sơ thầu để xem trong tổ chức này.'}</p>
      : <ul className="organization-list">{items.map((item) => <li key={item.id}><Link href={`/${slug}/tenders/${item.id}`}><strong>{item.title}</strong><span>{item.procurementStage} · {item._count?.lots ?? 0} lot →</span></Link></li>)}</ul>}
  </section>
}
