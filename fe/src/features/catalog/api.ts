import type { components } from '@medtender/contracts/api'

import { api } from '../../lib/api/client'

export type ProductSummary = components['schemas']['ProductSummaryDto']
export type ProductDetail = components['schemas']['ProductDetailDto']
export type ProductVersionSummary = components['schemas']['ProductVersionSummaryDto']
export type ProductVersionDetail = components['schemas']['ProductVersionDetailDto']
export type ProductSpecification = components['schemas']['ProductSpecificationDto']

export type CreateProductInput = components['schemas']['CreateProductDto']
export type UpdateProductInput = components['schemas']['UpdateProductDto']
export type CreateProductVersionInput = components['schemas']['CreateProductVersionDto']
export type UpdateProductVersionInput = components['schemas']['UpdateProductVersionDto']
export type CreateProductSpecInput = components['schemas']['CreateProductSpecDto']
export type UpdateProductSpecInput = components['schemas']['UpdateProductSpecDto']

export type ProductPage = {
  items: ProductSummary[]
  nextCursor: string | null
  total: number
}

function catalogPath(slug: string, suffix = '') {
  return `/organizations/${encodeURIComponent(slug)}/catalog${suffix}`
}

export async function listCatalogProductsPage(
  slug: string,
  options?: {
    q?: string
    status?: 'ACTIVE' | 'ARCHIVED' | 'ALL'
    cursor?: string
    limit?: number
  },
): Promise<ProductPage> {
  const params = new URLSearchParams({ pageMode: 'cursor' })
  if (options?.q?.trim()) params.set('q', options.q.trim())
  if (options?.status && options.status !== 'ALL') params.set('status', options.status)
  if (options?.cursor) params.set('cursor', options.cursor)
  if (options?.limit) params.set('limit', String(options.limit))
  const response = await api<ProductSummary[] | ProductPage>(
    `${catalogPath(slug, '/products')}?${params.toString()}`,
  )
  if (Array.isArray(response)) {
    return { items: response, nextCursor: null, total: response.length }
  }
  return response
}

export function createCatalogProduct(slug: string, input: CreateProductInput) {
  return api<ProductDetail>(catalogPath(slug, '/products'), {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function getCatalogProduct(slug: string, productId: string) {
  return api<ProductDetail>(catalogPath(slug, `/products/${encodeURIComponent(productId)}`))
}

export function updateCatalogProduct(
  slug: string,
  productId: string,
  input: UpdateProductInput,
) {
  return api<ProductDetail>(catalogPath(slug, `/products/${encodeURIComponent(productId)}`), {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export function createCatalogProductVersion(
  slug: string,
  productId: string,
  input: CreateProductVersionInput,
) {
  return api<ProductVersionDetail>(
    catalogPath(slug, `/products/${encodeURIComponent(productId)}/versions`),
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  )
}

export function getCatalogProductVersion(
  slug: string,
  productId: string,
  versionId: string,
) {
  return api<ProductVersionDetail>(
    catalogPath(
      slug,
      `/products/${encodeURIComponent(productId)}/versions/${encodeURIComponent(versionId)}`,
    ),
  )
}

export function updateCatalogProductVersion(
  slug: string,
  productId: string,
  versionId: string,
  input: UpdateProductVersionInput,
) {
  return api<ProductVersionDetail>(
    catalogPath(
      slug,
      `/products/${encodeURIComponent(productId)}/versions/${encodeURIComponent(versionId)}`,
    ),
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    },
  )
}

export function publishCatalogProductVersion(
  slug: string,
  productId: string,
  versionId: string,
) {
  return api<ProductVersionDetail>(
    catalogPath(
      slug,
      `/products/${encodeURIComponent(productId)}/versions/${encodeURIComponent(versionId)}/publish`,
    ),
    {
      method: 'POST',
    },
  )
}

export function addCatalogSpecification(
  slug: string,
  productId: string,
  versionId: string,
  input: CreateProductSpecInput,
) {
  return api<ProductVersionDetail>(
    catalogPath(
      slug,
      `/products/${encodeURIComponent(productId)}/versions/${encodeURIComponent(versionId)}/specifications`,
    ),
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  )
}

export function updateCatalogSpecification(
  slug: string,
  productId: string,
  versionId: string,
  specId: string,
  input: UpdateProductSpecInput,
) {
  return api<ProductVersionDetail>(
    catalogPath(
      slug,
      `/products/${encodeURIComponent(productId)}/versions/${encodeURIComponent(versionId)}/specifications/${encodeURIComponent(specId)}`,
    ),
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    },
  )
}

export function removeCatalogSpecification(
  slug: string,
  productId: string,
  versionId: string,
  specId: string,
) {
  return api<ProductVersionDetail>(
    catalogPath(
      slug,
      `/products/${encodeURIComponent(productId)}/versions/${encodeURIComponent(versionId)}/specifications/${encodeURIComponent(specId)}`,
    ),
    {
      method: 'DELETE',
    },
  )
}
