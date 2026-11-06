import { createHash } from 'node:crypto'
import { BadRequestException } from '@nestjs/common'
import { ApiProperty } from '@nestjs/swagger'
import { ProductStatus, ProductVersionStatus } from '../../database/generated/client'
import { decodeTenderCursor, encodeTenderCursor, TENDER_PAGE_LIMIT } from '../tenders/tenders.dto'

export const CATALOG_MAX_SPECS_PER_VERSION = 200

export class CreateProductSpecDto {
  @ApiProperty() specKey!: string
  @ApiProperty() specValue!: string
  @ApiProperty({ type: String, required: false, nullable: true }) unit?: string | null
  @ApiProperty() sourceLabel!: string
  @ApiProperty({ type: String, required: false, nullable: true }) sourceQuote?: string | null
  @ApiProperty({ type: String, required: false, nullable: true }) documentVersionId?: string | null
}

export class UpdateProductSpecDto {
  @ApiProperty({ required: false }) specKey?: string
  @ApiProperty({ required: false }) specValue?: string
  @ApiProperty({ type: String, required: false, nullable: true }) unit?: string | null
  @ApiProperty({ required: false }) sourceLabel?: string
  @ApiProperty({ type: String, required: false, nullable: true }) sourceQuote?: string | null
}

export class CreateProductDto {
  @ApiProperty() sku!: string
  @ApiProperty() name!: string
  @ApiProperty() brand!: string
  @ApiProperty({ required: false }) manufacturer?: string
  @ApiProperty({ required: false }) category?: string
  @ApiProperty({ required: false }) modelCode?: string
  @ApiProperty({ required: false }) notes?: string
  @ApiProperty({ type: [CreateProductSpecDto], required: false })
  specifications?: CreateProductSpecDto[]
}

export class UpdateProductDto {
  @ApiProperty({ required: false }) sku?: string
  @ApiProperty({ required: false }) name?: string
  @ApiProperty({ required: false }) brand?: string
  @ApiProperty({ type: String, required: false, nullable: true }) manufacturer?: string | null
  @ApiProperty({ type: String, required: false, nullable: true }) category?: string | null
  @ApiProperty({ enum: ProductStatus, required: false }) status?: ProductStatus
}

export class CreateProductVersionDto {
  @ApiProperty() modelCode!: string
  @ApiProperty({ required: false }) versionLabel?: string
  @ApiProperty({ required: false }) notes?: string
  @ApiProperty({ required: false }) cloneFromVersionId?: string
  @ApiProperty({ type: [CreateProductSpecDto], required: false })
  specifications?: CreateProductSpecDto[]
}

export class UpdateProductVersionDto {
  @ApiProperty({ required: false }) modelCode?: string
  @ApiProperty({ type: String, required: false, nullable: true }) notes?: string | null
}

export class ProductSpecificationDto {
  @ApiProperty() id!: string
  @ApiProperty() productVersionId!: string
  @ApiProperty() specKey!: string
  @ApiProperty() specValue!: string
  @ApiProperty({ type: String, nullable: true }) unit!: string | null
  @ApiProperty() sourceLabel!: string
  @ApiProperty({ type: String, nullable: true }) sourceQuote!: string | null
  @ApiProperty({ type: String, nullable: true }) documentVersionId!: string | null
  @ApiProperty() hasConflict!: boolean
  @ApiProperty() createdAt!: Date
}

export class ProductVersionSummaryDto {
  @ApiProperty() id!: string
  @ApiProperty() productId!: string
  @ApiProperty() versionNumber!: number
  @ApiProperty() versionLabel!: string
  @ApiProperty() modelCode!: string
  @ApiProperty({ enum: ProductVersionStatus }) status!: ProductVersionStatus
  @ApiProperty() fingerprint!: string
  @ApiProperty({ type: String, nullable: true }) notes!: string | null
  @ApiProperty({ type: Date, nullable: true }) publishedAt!: Date | null
  @ApiProperty() createdAt!: Date
  @ApiProperty() updatedAt!: Date
  @ApiProperty() specificationCount!: number
  @ApiProperty() conflictCount!: number
}

export class ProductVersionDetailDto extends ProductVersionSummaryDto {
  @ApiProperty({ type: [ProductSpecificationDto] })
  specifications!: ProductSpecificationDto[]
}

export class ProductSummaryDto {
  @ApiProperty() id!: string
  @ApiProperty() organizationId!: string
  @ApiProperty() sku!: string
  @ApiProperty() name!: string
  @ApiProperty() brand!: string
  @ApiProperty({ type: String, nullable: true }) manufacturer!: string | null
  @ApiProperty({ type: String, nullable: true }) category!: string | null
  @ApiProperty({ enum: ProductStatus }) status!: ProductStatus
  @ApiProperty() createdAt!: Date
  @ApiProperty() updatedAt!: Date
  @ApiProperty() versionCount!: number
  @ApiProperty({ type: ProductVersionSummaryDto, nullable: true })
  latestVersion!: ProductVersionSummaryDto | null
  @ApiProperty({ type: ProductVersionSummaryDto, nullable: true })
  publishedVersion!: ProductVersionSummaryDto | null
}

export class ProductDetailDto extends ProductSummaryDto {
  @ApiProperty({ type: [ProductVersionDetailDto] })
  versions!: ProductVersionDetailDto[]
}

export class ProductPageDto {
  @ApiProperty({ type: [ProductSummaryDto] }) items!: ProductSummaryDto[]
  @ApiProperty({ type: String, nullable: true }) nextCursor!: string | null
  @ApiProperty() total!: number
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const requiredText = (value: unknown, label: string, max = 200) => {
  const result = typeof value === 'string' ? value.trim() : ''
  if (!result || result.length > max) throw new BadRequestException(`${label} không hợp lệ.`)
  return result
}

const optionalText = (value: unknown, label: string, max = 200) => {
  if (value === undefined || value === null) return null
  if (typeof value !== 'string') throw new BadRequestException(`${label} không hợp lệ.`)
  const trimmed = value.trim()
  if (trimmed.length > max) throw new BadRequestException(`${label} không hợp lệ.`)
  return trimmed || null
}

export function specInput(body?: Partial<CreateProductSpecDto>) {
  const docVersionId =
    body?.documentVersionId === undefined || body.documentVersionId === null || body.documentVersionId === ''
      ? null
      : String(body.documentVersionId).trim()
  if (docVersionId && !UUID_PATTERN.test(docVersionId)) {
    throw new BadRequestException('Mã phiên bản tài liệu không hợp lệ.')
  }
  return {
    specKey: requiredText(body?.specKey, 'Tên thông số', 120),
    specValue: requiredText(body?.specValue, 'Giá trị thông số', 1000),
    unit: optionalText(body?.unit, 'Đơn vị thông số', 50),
    sourceLabel: requiredText(body?.sourceLabel, 'Nguồn thông số', 200),
    sourceQuote: optionalText(body?.sourceQuote, 'Trích dẫn nguồn', 2000),
    documentVersionId: docVersionId,
  }
}

export function specPatchInput(body?: Partial<UpdateProductSpecDto>) {
  const patch: {
    specKey?: string
    specValue?: string
    unit?: string | null
    sourceLabel?: string
    sourceQuote?: string | null
  } = {}
  if (body?.specKey !== undefined) patch.specKey = requiredText(body.specKey, 'Tên thông số', 120)
  if (body?.specValue !== undefined) patch.specValue = requiredText(body.specValue, 'Giá trị thông số', 1000)
  if (body?.unit !== undefined) patch.unit = optionalText(body.unit, 'Đơn vị thông số', 50)
  if (body?.sourceLabel !== undefined) patch.sourceLabel = requiredText(body.sourceLabel, 'Nguồn thông số', 200)
  if (body?.sourceQuote !== undefined) patch.sourceQuote = optionalText(body.sourceQuote, 'Trích dẫn nguồn', 2000)
  if (Object.keys(patch).length === 0) throw new BadRequestException('Không có thông tin cập nhật thông số.')
  return patch
}

export function productInput(body?: Partial<CreateProductDto>) {
  const sku = requiredText(body?.sku, 'Mã SKU', 100)
  const name = requiredText(body?.name, 'Tên sản phẩm', 200)
  const brand = requiredText(body?.brand, 'Hãng / Thương hiệu', 120)
  const manufacturer = optionalText(body?.manufacturer, 'Nhà sản xuất', 200)
  const category = optionalText(body?.category, 'Nhóm thiết bị', 120)
  const modelCode =
    body?.modelCode !== undefined && String(body.modelCode).trim() !== ''
      ? requiredText(body.modelCode, 'Model thiết bị', 120)
      : sku
  const notes = optionalText(body?.notes, 'Ghi chú phiên bản', 2000)
  const rawSpecs = Array.isArray(body?.specifications) ? body.specifications : []
  if (rawSpecs.length > CATALOG_MAX_SPECS_PER_VERSION) {
    throw new BadRequestException(`Mỗi phiên bản sản phẩm hỗ trợ tối đa ${CATALOG_MAX_SPECS_PER_VERSION} thông số.`)
  }
  const specifications = rawSpecs.map((item) => specInput(item))
  return { sku, name, brand, manufacturer, category, modelCode, notes, specifications }
}

export function productPatchInput(body?: Partial<UpdateProductDto>) {
  const patch: {
    sku?: string
    name?: string
    brand?: string
    manufacturer?: string | null
    category?: string | null
    status?: ProductStatus
  } = {}
  if (body?.sku !== undefined) patch.sku = requiredText(body.sku, 'Mã SKU', 100)
  if (body?.name !== undefined) patch.name = requiredText(body.name, 'Tên sản phẩm', 200)
  if (body?.brand !== undefined) patch.brand = requiredText(body.brand, 'Hãng / Thương hiệu', 120)
  if (body?.manufacturer !== undefined) patch.manufacturer = optionalText(body.manufacturer, 'Nhà sản xuất', 200)
  if (body?.category !== undefined) patch.category = optionalText(body.category, 'Nhóm thiết bị', 120)
  if (body?.status !== undefined) {
    if (!Object.values(ProductStatus).includes(body.status)) {
      throw new BadRequestException('Trạng thái sản phẩm không hợp lệ.')
    }
    patch.status = body.status
  }
  if (Object.keys(patch).length === 0) throw new BadRequestException('Không có thông tin cập nhật sản phẩm.')
  return patch
}

export function productVersionInput(body?: Partial<CreateProductVersionDto>) {
  const modelCode = requiredText(body?.modelCode, 'Model thiết bị', 120)
  const versionLabel =
    body?.versionLabel !== undefined && String(body.versionLabel).trim() !== ''
      ? requiredText(body.versionLabel, 'Nhãn phiên bản', 40)
      : undefined
  const notes = optionalText(body?.notes, 'Ghi chú phiên bản', 2000)
  const cloneFromVersionId =
    body?.cloneFromVersionId && String(body.cloneFromVersionId).trim() !== ''
      ? String(body.cloneFromVersionId).trim()
      : undefined
  if (cloneFromVersionId && !UUID_PATTERN.test(cloneFromVersionId)) {
    throw new BadRequestException('Phiên bản nguồn để sao chép không hợp lệ.')
  }
  const rawSpecs = Array.isArray(body?.specifications) ? body.specifications : []
  if (rawSpecs.length > CATALOG_MAX_SPECS_PER_VERSION) {
    throw new BadRequestException(`Mỗi phiên bản sản phẩm hỗ trợ tối đa ${CATALOG_MAX_SPECS_PER_VERSION} thông số.`)
  }
  const specifications = rawSpecs.map((item) => specInput(item))
  return { modelCode, versionLabel, notes, cloneFromVersionId, specifications }
}

export function productVersionPatchInput(body?: Partial<UpdateProductVersionDto>) {
  const patch: { modelCode?: string; notes?: string | null } = {}
  if (body?.modelCode !== undefined) patch.modelCode = requiredText(body.modelCode, 'Model thiết bị', 120)
  if (body?.notes !== undefined) patch.notes = optionalText(body.notes, 'Ghi chú phiên bản', 2000)
  if (Object.keys(patch).length === 0) throw new BadRequestException('Không có thông tin cập nhật phiên bản.')
  return patch
}

export function computeVersionFingerprint(
  modelCode: string,
  specs: ReadonlyArray<{
    specKey: string
    specValue: string
    unit?: string | null
    sourceLabel: string
    sourceQuote?: string | null
  }>,
): string {
  const normalizedSpecs = [...specs]
    .map((spec) =>
      [
        spec.specKey.trim().toLowerCase(),
        spec.specValue.trim(),
        (spec.unit ?? '').trim().toLowerCase(),
        spec.sourceLabel.trim(),
        (spec.sourceQuote ?? '').trim(),
      ].join('|'),
    )
    .sort()
  const payload = JSON.stringify({
    model: modelCode.trim(),
    specs: normalizedSpecs,
  })
  return `sha256:${createHash('sha256').update(payload, 'utf8').digest('hex').slice(0, 24)}`
}

export function enrichSpecificationsWithConflicts<
  T extends {
    id: string
    productVersionId: string
    specKey: string
    specValue: string
    unit: string | null
    sourceLabel: string
    sourceQuote: string | null
    documentVersionId: string | null
    createdAt: Date
  },
>(specs: readonly T[]): { items: ProductSpecificationDto[]; conflictCount: number } {
  const distinctValuesByKey = new Map<string, Set<string>>()
  for (const spec of specs) {
    const key = spec.specKey.trim().toLowerCase()
    const normalizedVal = `${spec.specValue.trim().toLowerCase()}|${(spec.unit ?? '').trim().toLowerCase()}`
    const set = distinctValuesByKey.get(key) ?? new Set<string>()
    set.add(normalizedVal)
    distinctValuesByKey.set(key, set)
  }

  let conflictCount = 0
  for (const values of distinctValuesByKey.values()) {
    if (values.size > 1) conflictCount += 1
  }

  const items: ProductSpecificationDto[] = specs.map((spec) => {
    const key = spec.specKey.trim().toLowerCase()
    const hasConflict = (distinctValuesByKey.get(key)?.size ?? 0) > 1
    return {
      id: spec.id,
      productVersionId: spec.productVersionId,
      specKey: spec.specKey,
      specValue: spec.specValue,
      unit: spec.unit,
      sourceLabel: spec.sourceLabel,
      sourceQuote: spec.sourceQuote,
      documentVersionId: spec.documentVersionId,
      hasConflict,
      createdAt: spec.createdAt,
    }
  })

  return { items, conflictCount }
}

export type CatalogListQuery = {
  q?: string
  status?: ProductStatus
  limit: number
  cursor?: { createdAt: Date; id: string }
  paginated: boolean
}

export function parseCatalogListQuery(query?: Record<string, unknown>): CatalogListQuery {
  const q = typeof query?.q === 'string' ? query.q.trim().slice(0, 200) : undefined
  let status: ProductStatus | undefined
  if (typeof query?.status === 'string' && query.status.trim() !== '' && query.status !== 'ALL') {
    if (!Object.values(ProductStatus).includes(query.status as ProductStatus)) {
      throw new BadRequestException('Trạng thái lọc sản phẩm không hợp lệ.')
    }
    status = query.status as ProductStatus
  }
  let limit = TENDER_PAGE_LIMIT
  if (query?.limit !== undefined && query.limit !== '') {
    const parsed = Number(query.limit)
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > TENDER_PAGE_LIMIT) {
      throw new BadRequestException(`Giới hạn trang phải từ 1 đến ${TENDER_PAGE_LIMIT}.`)
    }
    limit = parsed
  }
  const cursor =
    typeof query?.cursor === 'string' && query.cursor.trim() !== ''
      ? decodeTenderCursor(query.cursor)
      : undefined
  const paginated = Boolean(
    cursor || query?.limit !== undefined || query?.pageMode === 'cursor' || q || status,
  )
  return { q: q || undefined, status, limit, cursor, paginated }
}

export { encodeTenderCursor as encodeCatalogCursor }
