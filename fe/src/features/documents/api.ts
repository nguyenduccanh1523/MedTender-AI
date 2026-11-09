import type { components } from '@medtender/contracts/api'
import { api } from '../../lib/api/client'

export type DocumentDetail = components['schemas']['DocumentDetailDto']
export type DocumentVersionSummary = components['schemas']['DocumentVersionSummaryDto']
export type PolicyConsentStatus = components['schemas']['PolicyConsentStatusDto']
export type AcceptPolicyConsentInput = components['schemas']['AcceptPolicyConsentDto']
export type RequestUploadIntentInput = components['schemas']['RequestUploadIntentDto']
export type UploadIntentResponse = components['schemas']['UploadIntentResponseDto']
export type DownloadLinkResponse = components['schemas']['DownloadLinkResponseDto']
export type SecurityIncidentSummary = components['schemas']['SecurityIncidentSummaryDto']

function docPath(slug: string, suffix = '') {
  return `/organizations/${encodeURIComponent(slug)}/documents${suffix}`
}

export function getPolicyConsentStatus(slug: string) {
  return api<PolicyConsentStatus>(docPath(slug, '/policy-consent'))
}

export function acceptPolicyConsent(slug: string, input: AcceptPolicyConsentInput) {
  return api<PolicyConsentStatus>(docPath(slug, '/policy-consent'), {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function listDocuments(
  slug: string,
  options?: { tenderId?: string; productId?: string },
) {
  const params = new URLSearchParams()
  if (options?.tenderId) params.set('tenderId', options.tenderId)
  if (options?.productId) params.set('productId', options.productId)
  const qs = params.toString() ? `?${params.toString()}` : ''
  return api<DocumentDetail[]>(docPath(slug, qs))
}

export function getDocumentDetail(slug: string, documentId: string) {
  return api<DocumentDetail>(docPath(slug, `/${encodeURIComponent(documentId)}`))
}

export function deleteDocument(slug: string, documentId: string) {
  return api<{ success: boolean }>(docPath(slug, `/${encodeURIComponent(documentId)}`), {
    method: 'DELETE',
  })
}

export function createUploadIntent(slug: string, input: RequestUploadIntentInput) {
  return api<UploadIntentResponse>(docPath(slug, '/upload-intents'), {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function completeDocumentUpload(
  slug: string,
  documentId: string,
  versionNumber: number,
) {
  return api<DocumentDetail>(
    docPath(slug, `/${encodeURIComponent(documentId)}/versions/${versionNumber}/complete`),
    {
      method: 'POST',
      body: JSON.stringify({}),
    },
  )
}

export function getDocumentDownloadLink(
  slug: string,
  documentId: string,
  versionId: string,
) {
  return api<DownloadLinkResponse>(
    docPath(slug, `/${encodeURIComponent(documentId)}/versions/${encodeURIComponent(versionId)}/download-link`),
    {
      method: 'POST',
      body: JSON.stringify({}),
    },
  )
}

export function listSecurityIncidents(slug: string) {
  return api<SecurityIncidentSummary[]>(docPath(slug, '/governance/security-incidents'))
}

export function purgeSecurityIncident(slug: string, incidentId: string, reason: string) {
  return api<{ success: boolean }>(
    docPath(slug, `/governance/security-incidents/${encodeURIComponent(incidentId)}/purge`),
    {
      method: 'POST',
      body: JSON.stringify({ reason }),
    },
  )
}

export async function suspendIncidentUploader(
  slug: string,
  incidentId: string,
  reason?: string,
): Promise<{ success: boolean; message: string }> {
  return api(
    docPath(slug, `/governance/security-incidents/${encodeURIComponent(incidentId)}/suspend-uploader`),
    {
      method: 'POST',
      body: JSON.stringify({ reason }),
    },
  )
}
