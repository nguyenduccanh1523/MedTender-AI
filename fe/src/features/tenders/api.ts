import { api } from '../../lib/api/client'

export type Tender = { id: string; title: string; reference: string | null; procurementStage: 'RFQ' | 'FORMAL_TENDER' | 'INTERNAL'; createdAt: string; _count?: { lots: number } }
export type TenderItem = { id: string; itemNo: string; name: string; quantity: string; unit: string; description: string | null }
export type TenderLot = { id: string; code: string; name: string; items: TenderItem[] }
export type TenderDetail = Tender & { lots: TenderLot[] }
export const listTenders = (slug: string) => api<Tender[]>(`/organizations/${encodeURIComponent(slug)}/tenders`)
export const createTender = (slug: string, body: Pick<Tender, 'title' | 'procurementStage'> & { reference?: string }) => api<Tender>(`/organizations/${encodeURIComponent(slug)}/tenders`, { method: 'POST', body: JSON.stringify(body) })
export const getTender = (slug: string, id: string) => api<TenderDetail>(`/organizations/${encodeURIComponent(slug)}/tenders/${id}`)
export const createTenderLot = (slug: string, tenderId: string, body: Pick<TenderLot, 'code' | 'name'>) => api<Omit<TenderLot, 'items'>>(
  `/organizations/${encodeURIComponent(slug)}/tenders/${encodeURIComponent(tenderId)}/lots`,
  { method: 'POST', body: JSON.stringify(body) },
)
export const createTenderItem = (slug: string, tenderId: string, lotId: string, body: Pick<TenderItem, 'itemNo' | 'name' | 'unit'> & { quantity: number; description?: string }) => api<TenderItem>(
  `/organizations/${encodeURIComponent(slug)}/tenders/${encodeURIComponent(tenderId)}/lots/${encodeURIComponent(lotId)}/items`,
  { method: 'POST', body: JSON.stringify(body) },
)
