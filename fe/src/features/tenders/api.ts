import { api } from '../../lib/api/client'

export type Tender = { id: string; title: string; reference: string | null; procurementStage: 'RFQ' | 'FORMAL_TENDER' | 'INTERNAL'; createdAt: string; _count?: { lots: number } }
export type TenderDetail = Tender & { lots: Array<{ id: string; code: string; name: string; items: Array<{ id: string; itemNo: string; name: string; quantity: string; unit: string; description: string | null }> }> }
export const listTenders = (slug: string) => api<Tender[]>(`/organizations/${encodeURIComponent(slug)}/tenders`)
export const createTender = (slug: string, body: Pick<Tender, 'title' | 'procurementStage'> & { reference?: string }) => api<Tender>(`/organizations/${encodeURIComponent(slug)}/tenders`, { method: 'POST', body: JSON.stringify(body) })
export const getTender = (slug: string, id: string) => api<TenderDetail>(`/organizations/${encodeURIComponent(slug)}/tenders/${id}`)
