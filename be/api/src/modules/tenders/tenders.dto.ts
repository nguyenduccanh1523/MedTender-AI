import { BadRequestException } from '@nestjs/common'
import { ApiProperty } from '@nestjs/swagger'
import { MembershipRole, ProcurementStage } from '../../database/generated/client'

export const TENDER_MAX_LOTS = 20
export const TENDER_MAX_ITEMS = 100
export const TENDER_PAGE_LIMIT = 50
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export class CreateTenderDto {
  @ApiProperty() title!: string
  @ApiProperty({ enum: ProcurementStage }) procurementStage!: ProcurementStage
  @ApiProperty({ required: false }) reference?: string
}

export class UpdateTenderDto {
  @ApiProperty({ required: false }) title?: string
  @ApiProperty({ enum: ProcurementStage, required: false }) procurementStage?: ProcurementStage
  @ApiProperty({ required: false, nullable: true }) reference?: string | null
}

export class CreateLotDto {
  @ApiProperty() code!: string
  @ApiProperty() name!: string
}

export class UpdateLotDto {
  @ApiProperty({ required: false }) code?: string
  @ApiProperty({ required: false }) name?: string
}

export class CreateItemDto {
  @ApiProperty() itemNo!: string
  @ApiProperty() name!: string
  @ApiProperty() quantity!: number
  @ApiProperty() unit!: string
  @ApiProperty({ required: false }) description?: string
}

export class UpdateItemDto {
  @ApiProperty({ required: false }) itemNo?: string
  @ApiProperty({ required: false }) name?: string
  @ApiProperty({ required: false }) quantity?: number
  @ApiProperty({ required: false }) unit?: string
  @ApiProperty({ required: false, nullable: true }) description?: string | null
}

export class TenderCountDto {
  @ApiProperty() lots!: number
  @ApiProperty({ required: false }) items?: number
}

export class TenderDto {
  @ApiProperty() id!: string
  @ApiProperty() organizationId!: string
  @ApiProperty() title!: string
  @ApiProperty({ nullable: true }) reference!: string | null
  @ApiProperty({ enum: ProcurementStage }) procurementStage!: ProcurementStage
  @ApiProperty() createdByUserId!: string
  @ApiProperty() createdAt!: Date
  @ApiProperty() updatedAt!: Date
  @ApiProperty({ type: TenderCountDto, required: false }) _count?: TenderCountDto
}

export class TenderPageDto {
  @ApiProperty({ type: [TenderDto] }) items!: TenderDto[]
  @ApiProperty({ nullable: true }) nextCursor!: string | null
  @ApiProperty() total!: number
}

export class TenderAuditLogDto {
  @ApiProperty() id!: string
  @ApiProperty({ nullable: true }) tenderId!: string | null
  @ApiProperty({ nullable: true }) lotId!: string | null
  @ApiProperty({ nullable: true }) itemId!: string | null
  @ApiProperty() actorUserId!: string
  @ApiProperty() actorName!: string
  @ApiProperty({ enum: MembershipRole }) actorRole!: MembershipRole
  @ApiProperty() action!: string
  @ApiProperty() summary!: string
  @ApiProperty() details!: Record<string, unknown>
  @ApiProperty() createdAt!: Date
}

export class TenderAuditPageDto {
  @ApiProperty({ type: [TenderAuditLogDto] }) items!: TenderAuditLogDto[]
  @ApiProperty({ nullable: true }) nextCursor!: string | null
  @ApiProperty() total!: number
  @ApiProperty() limit!: number
}

const text = (value: unknown, label: string, max = 200) => {
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

const parseQuantity = (raw: unknown) => {
  if (raw === '' || raw === null || raw === undefined || typeof raw === 'boolean') {
    throw new BadRequestException('Số lượng phải lớn hơn 0.')
  }
  const str = String(raw).trim()
  if (!/^\d+(\.\d{1,3})?$/.test(str)) {
    const num = Number(raw)
    if (!Number.isFinite(num) || num <= 0) throw new BadRequestException('Số lượng phải lớn hơn 0.')
    throw new BadRequestException('Số lượng chỉ hỗ trợ tối đa 3 chữ số thập phân.')
  }
  const quantity = Number(str)
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 99_999_999_999.999) {
    throw new BadRequestException('Số lượng phải lớn hơn 0.')
  }
  return quantity
}

export function tenderInput(body?: Partial<CreateTenderDto>) {
  if (!Object.values(ProcurementStage).includes(body?.procurementStage as ProcurementStage)) {
    throw new BadRequestException('Loại hồ sơ không hợp lệ.')
  }
  return {
    title: text(body?.title, 'Tên hồ sơ'),
    procurementStage: body!.procurementStage!,
    reference: optionalText(body?.reference, 'Mã tham chiếu'),
  }
}

export function tenderPatchInput(body?: Partial<UpdateTenderDto>) {
  const patch: { title?: string; procurementStage?: ProcurementStage; reference?: string | null } = {}
  if (body?.title !== undefined) patch.title = text(body.title, 'Tên hồ sơ')
  if (body?.procurementStage !== undefined) {
    if (!Object.values(ProcurementStage).includes(body.procurementStage)) {
      throw new BadRequestException('Loại hồ sơ không hợp lệ.')
    }
    patch.procurementStage = body.procurementStage
  }
  if (body?.reference !== undefined) patch.reference = optionalText(body.reference, 'Mã tham chiếu')
  if (Object.keys(patch).length === 0) throw new BadRequestException('Không có thông tin cập nhật.')
  return patch
}

export function lotInput(body?: Partial<CreateLotDto>) {
  return { code: text(body?.code, 'Mã lot', 50), name: text(body?.name, 'Tên lot') }
}

export function lotPatchInput(body?: Partial<UpdateLotDto>) {
  const patch: { code?: string; name?: string } = {}
  if (body?.code !== undefined) patch.code = text(body.code, 'Mã lot', 50)
  if (body?.name !== undefined) patch.name = text(body.name, 'Tên lot')
  if (Object.keys(patch).length === 0) throw new BadRequestException('Không có thông tin cập nhật.')
  return patch
}

export function itemInput(body?: Partial<CreateItemDto>) {
  return {
    itemNo: text(body?.itemNo, 'STT', 50),
    name: text(body?.name, 'Tên hàng hóa'),
    quantity: parseQuantity(body?.quantity),
    unit: text(body?.unit, 'Đơn vị', 50),
    description: optionalText(body?.description, 'Mô tả', 2000),
  }
}

export function itemPatchInput(body?: Partial<UpdateItemDto>) {
  const patch: { itemNo?: string; name?: string; quantity?: number; unit?: string; description?: string | null } = {}
  if (body?.itemNo !== undefined) patch.itemNo = text(body.itemNo, 'STT', 50)
  if (body?.name !== undefined) patch.name = text(body.name, 'Tên hàng hóa')
  if (body?.quantity !== undefined) patch.quantity = parseQuantity(body.quantity)
  if (body?.unit !== undefined) patch.unit = text(body.unit, 'Đơn vị', 50)
  if (body?.description !== undefined) patch.description = optionalText(body.description, 'Mô tả', 2000)
  if (Object.keys(patch).length === 0) throw new BadRequestException('Không có thông tin cập nhật.')
  return patch
}

export type TenderListQuery = {
  q?: string
  stage?: ProcurementStage
  limit: number
  cursor?: { createdAt: Date; id: string }
  paginated: boolean
}

export function encodeTenderCursor(item: { createdAt: Date; id: string }) {
  return Buffer.from(`${item.createdAt.toISOString()}|${item.id}`, 'utf8').toString('base64url')
}

export function decodeTenderCursor(raw: string): { createdAt: Date; id: string } {
  let decoded = ''
  try {
    decoded = Buffer.from(raw.trim(), 'base64url').toString('utf8')
  } catch {
    throw new BadRequestException('Con trỏ phân trang không hợp lệ.')
  }
  const sep = decoded.indexOf('|')
  if (sep <= 0) throw new BadRequestException('Con trỏ phân trang không hợp lệ.')
  const iso = decoded.slice(0, sep)
  const id = decoded.slice(sep + 1)
  const createdAt = new Date(iso)
  if (Number.isNaN(createdAt.getTime()) || !UUID_PATTERN.test(id)) {
    throw new BadRequestException('Con trỏ phân trang không hợp lệ.')
  }
  return { createdAt, id }
}

export function parseTenderListQuery(query?: Record<string, unknown>): TenderListQuery {
  const q = typeof query?.q === 'string' ? query.q.trim().slice(0, 200) : undefined
  let stage: ProcurementStage | undefined
  if (typeof query?.stage === 'string' && query.stage.trim() !== '' && query.stage !== 'ALL') {
    if (!Object.values(ProcurementStage).includes(query.stage as ProcurementStage)) {
      throw new BadRequestException('Loại hồ sơ lọc không hợp lệ.')
    }
    stage = query.stage as ProcurementStage
  }
  let limit = TENDER_PAGE_LIMIT
  if (query?.limit !== undefined && query.limit !== '') {
    const parsed = Number(query.limit)
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > TENDER_PAGE_LIMIT) {
      throw new BadRequestException(`Giới hạn trang phải từ 1 đến ${TENDER_PAGE_LIMIT}.`)
    }
    limit = parsed
  }
  const cursor = typeof query?.cursor === 'string' && query.cursor.trim() !== ''
    ? decodeTenderCursor(query.cursor)
    : undefined
  const paginated = Boolean(
    cursor || query?.limit !== undefined || query?.pageMode === 'cursor' || q || stage,
  )
  return { q: q || undefined, stage, limit, cursor, paginated }
}

export type TenderAuditListQuery = {
  action?: string
  limit: number
  cursor?: { createdAt: Date; id: string }
  paginated: boolean
}

export function parseTenderAuditQuery(
  rawQuery?: Record<string, unknown> | string,
): TenderAuditListQuery {
  if (typeof rawQuery === 'string' || rawQuery === undefined) {
    const fallback = rawQuery ? Math.min(Math.max(Number(rawQuery) || 50, 1), 100) : 50
    return { limit: fallback, paginated: false }
  }
  let limit = rawQuery.pageMode === 'cursor' ? 10 : 50
  if (rawQuery.limit !== undefined && rawQuery.limit !== '') {
    const parsed = Number(rawQuery.limit)
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
      throw new BadRequestException('Giới hạn nhật ký mỗi trang phải từ 1 đến 100.')
    }
    limit = parsed
  }
  const cursor =
    typeof rawQuery.cursor === 'string' && rawQuery.cursor.trim() !== ''
      ? decodeTenderCursor(rawQuery.cursor)
      : undefined
  const rawAction = typeof rawQuery.action === 'string' ? rawQuery.action.trim().toUpperCase() : ''
  const action = rawAction && rawAction !== 'ALL' ? rawAction.slice(0, 60) : undefined
  const paginated = Boolean(cursor || rawQuery.pageMode === 'cursor' || action)
  return { action, limit, cursor, paginated }
}
