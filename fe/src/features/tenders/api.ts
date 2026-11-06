import { api } from '../../lib/api/client'
import type { Organization } from '../organizations/api'

export type ProcurementStage = 'RFQ' | 'FORMAL_TENDER' | 'INTERNAL'

export type Tender = {
  id: string
  title: string
  reference: string | null
  procurementStage: ProcurementStage
  createdAt: string
  updatedAt?: string
  _count?: { lots: number; items?: number }
}

export type TenderPage = {
  items: Tender[]
  nextCursor: string | null
  total: number
}

export type TenderItem = {
  id: string
  itemNo: string
  name: string
  quantity: string
  unit: string
  description: string | null
}

export type TenderLot = {
  id: string
  code: string
  name: string
  items: TenderItem[]
}

export type TenderDetail = Tender & { lots: TenderLot[] }

export type TenderAuditLog = {
  id: string
  tenderId: string | null
  lotId: string | null
  itemId: string | null
  actorUserId: string
  actorName: string
  actorRole: Organization['role']
  action: string
  summary: string
  details: Record<string, unknown>
  createdAt: string
}

export type TenderAuditPage = {
  items: TenderAuditLog[]
  nextCursor: string | null
  total: number
  limit: number
}

export type ListTenderAuditsParams = {
  limit?: number
  cursor?: string
  action?: 'ALL' | 'TENDER' | 'LOT' | 'ITEM' | string
  pageMode?: 'cursor'
}

export type ListTendersParams = {
  q?: string
  stage?: ProcurementStage | 'ALL'
  cursor?: string
  limit?: number
  pageMode?: 'cursor'
}

export function listTenders(slug: string): Promise<Tender[]>
export function listTenders(slug: string, params: ListTendersParams): Promise<TenderPage>
export function listTenders(slug: string, params?: ListTendersParams) {
  const base = `/organizations/${encodeURIComponent(slug)}/tenders`
  if (!params) return api<Tender[]>(base)
  const search = new URLSearchParams()
  if (params.q?.trim()) search.set('q', params.q.trim())
  if (params.stage && params.stage !== 'ALL') search.set('stage', params.stage)
  if (params.cursor) search.set('cursor', params.cursor)
  if (params.limit) search.set('limit', String(params.limit))
  search.set('pageMode', 'cursor')
  const query = search.toString()
  return api<TenderPage>(query ? `${base}?${query}` : `${base}?pageMode=cursor`)
}

export const createTender = (
  slug: string,
  body: Pick<Tender, 'title' | 'procurementStage'> & { reference?: string },
) =>
  api<Tender>(`/organizations/${encodeURIComponent(slug)}/tenders`, {
    method: 'POST',
    body: JSON.stringify(body),
  })

export const getTender = (slug: string, id: string) =>
  api<TenderDetail>(`/organizations/${encodeURIComponent(slug)}/tenders/${encodeURIComponent(id)}`)

export const updateTender = (
  slug: string,
  id: string,
  body: Partial<Pick<Tender, 'title' | 'procurementStage'>> & { reference?: string | null },
) =>
  api<Tender>(`/organizations/${encodeURIComponent(slug)}/tenders/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })

export const deleteTender = (slug: string, id: string) =>
  api<void>(`/organizations/${encodeURIComponent(slug)}/tenders/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })

export const createTenderLot = (slug: string, tenderId: string, body: Pick<TenderLot, 'code' | 'name'>) =>
  api<Omit<TenderLot, 'items'>>(
    `/organizations/${encodeURIComponent(slug)}/tenders/${encodeURIComponent(tenderId)}/lots`,
    { method: 'POST', body: JSON.stringify(body) },
  )

export const updateTenderLot = (
  slug: string,
  tenderId: string,
  lotId: string,
  body: Partial<Pick<TenderLot, 'code' | 'name'>>,
) =>
  api<Omit<TenderLot, 'items'>>(
    `/organizations/${encodeURIComponent(slug)}/tenders/${encodeURIComponent(tenderId)}/lots/${encodeURIComponent(lotId)}`,
    { method: 'PATCH', body: JSON.stringify(body) },
  )

export const deleteTenderLot = (slug: string, tenderId: string, lotId: string) =>
  api<void>(
    `/organizations/${encodeURIComponent(slug)}/tenders/${encodeURIComponent(tenderId)}/lots/${encodeURIComponent(lotId)}`,
    { method: 'DELETE' },
  )

export const createTenderItem = (
  slug: string,
  tenderId: string,
  lotId: string,
  body: Pick<TenderItem, 'itemNo' | 'name' | 'unit'> & { quantity: number; description?: string },
) =>
  api<TenderItem>(
    `/organizations/${encodeURIComponent(slug)}/tenders/${encodeURIComponent(tenderId)}/lots/${encodeURIComponent(lotId)}/items`,
    { method: 'POST', body: JSON.stringify(body) },
  )

export const updateTenderItem = (
  slug: string,
  tenderId: string,
  lotId: string,
  itemId: string,
  body: Partial<Pick<TenderItem, 'itemNo' | 'name' | 'unit'>> & { quantity?: number; description?: string | null },
) =>
  api<TenderItem>(
    `/organizations/${encodeURIComponent(slug)}/tenders/${encodeURIComponent(tenderId)}/lots/${encodeURIComponent(lotId)}/items/${encodeURIComponent(itemId)}`,
    { method: 'PATCH', body: JSON.stringify(body) },
  )

export const deleteTenderItem = (slug: string, tenderId: string, lotId: string, itemId: string) =>
  api<void>(
    `/organizations/${encodeURIComponent(slug)}/tenders/${encodeURIComponent(tenderId)}/lots/${encodeURIComponent(lotId)}/items/${encodeURIComponent(itemId)}`,
    { method: 'DELETE' },
  )

export function listTenderAudits(slug: string, tenderId: string): Promise<TenderAuditLog[]>
export function listTenderAudits(
  slug: string,
  tenderId: string,
  params: ListTenderAuditsParams,
): Promise<TenderAuditPage | TenderAuditLog[]>
export function listTenderAudits(
  slug: string,
  tenderId: string,
  params?: ListTenderAuditsParams,
) {
  const base = `/organizations/${encodeURIComponent(slug)}/tenders/${encodeURIComponent(tenderId)}/audits`
  if (!params) return api<TenderAuditLog[]>(base)
  const search = new URLSearchParams()
  if (params.limit) search.set('limit', String(params.limit))
  if (params.cursor) search.set('cursor', params.cursor)
  if (params.action && params.action !== 'ALL') search.set('action', params.action)
  search.set('pageMode', 'cursor')
  const query = search.toString()
  return api<TenderAuditPage>(query ? `${base}?${query}` : `${base}?pageMode=cursor`)
}
