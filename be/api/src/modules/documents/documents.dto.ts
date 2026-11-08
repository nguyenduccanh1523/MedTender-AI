import { BadRequestException } from '@nestjs/common'
import { ApiProperty } from '@nestjs/swagger'
import {
  DataClassification,
  DocumentType,
  DocumentVersionStatus,
  FileScanStatus,
} from '../../database/generated/client'

export const MAX_FILE_SIZE_PDF = 100 * 1024 * 1024 // 100 MB
export const MAX_FILE_SIZE_DOCX = 50 * 1024 * 1024 // 50 MB
export const MAX_FILE_SIZE_XLSX = 50 * 1024 * 1024 // 50 MB

export const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
])

export class RequestUploadIntentDto {
  @ApiProperty() title!: string
  @ApiProperty() originalFilename!: string
  @ApiProperty() mimeType!: string
  @ApiProperty() sizeBytes!: number
  @ApiProperty() sha256!: string
  @ApiProperty({ enum: DocumentType, required: false }) documentType?: DocumentType
  @ApiProperty({ enum: DataClassification, required: false }) classification?: DataClassification
  @ApiProperty({ type: String, required: false, nullable: true }) tenderId?: string | null
  @ApiProperty({ type: String, required: false, nullable: true }) productId?: string | null
  @ApiProperty({ type: String, required: false, nullable: true }) documentId?: string | null
  @ApiProperty({ type: String, required: false, nullable: true }) notes?: string | null
}

export class UploadIntentResponseDto {
  @ApiProperty() intentId!: string
  @ApiProperty() uploadToken!: string
  @ApiProperty() uploadUrl!: string
  @ApiProperty() expiresAt!: Date
  @ApiProperty() documentId!: string
  @ApiProperty() versionNumber!: number
  @ApiProperty() versionLabel!: string
  @ApiProperty() maxSizeBytes!: number
}

export class CompleteUploadDto {
  @ApiProperty({ required: false }) idempotencyKey?: string
}

export class DocumentVersionSummaryDto {
  @ApiProperty() id!: string
  @ApiProperty() versionNumber!: number
  @ApiProperty() versionLabel!: string
  @ApiProperty({ enum: DocumentVersionStatus }) status!: DocumentVersionStatus
  @ApiProperty() originalFilename!: string
  @ApiProperty() sizeBytes!: number
  @ApiProperty() mimeType!: string
  @ApiProperty() sha256!: string
  @ApiProperty({ enum: FileScanStatus }) scanStatus!: FileScanStatus
  @ApiProperty({ type: String, nullable: true }) quarantineReason!: string | null
  @ApiProperty() rightsConfirmed!: boolean
  @ApiProperty({ type: Date, nullable: true }) rightsConfirmedAt!: Date | null
  @ApiProperty({ type: String, nullable: true }) acceptedPolicyVersion!: string | null
  @ApiProperty({ type: String, nullable: true }) notes!: string | null
  @ApiProperty() createdAt!: Date
  @ApiProperty() updatedAt!: Date
}

export class LinkedTenderSummaryDto {
  @ApiProperty() id!: string
  @ApiProperty() title!: string
  @ApiProperty({ type: String, nullable: true }) reference!: string | null
}

export class LinkedProductSummaryDto {
  @ApiProperty() id!: string
  @ApiProperty() name!: string
  @ApiProperty() sku!: string
}

export class DocumentDetailDto {
  @ApiProperty() id!: string
  @ApiProperty() organizationId!: string
  @ApiProperty() title!: string
  @ApiProperty({ enum: DocumentType }) documentType!: DocumentType
  @ApiProperty({ enum: DataClassification }) classification!: DataClassification
  @ApiProperty({ type: String, nullable: true }) description!: string | null
  @ApiProperty({ type: String, nullable: true }) tenderId!: string | null
  @ApiProperty({ type: String, nullable: true }) productId!: string | null
  @ApiProperty({ type: LinkedTenderSummaryDto, nullable: true }) tender!: LinkedTenderSummaryDto | null
  @ApiProperty({ type: LinkedProductSummaryDto, nullable: true }) product!: LinkedProductSummaryDto | null
  @ApiProperty() createdAt!: Date
  @ApiProperty() updatedAt!: Date
  @ApiProperty() versionCount!: number
  @ApiProperty({ type: DocumentVersionSummaryDto, nullable: true })
  latestVersion!: DocumentVersionSummaryDto | null
  @ApiProperty({ type: [DocumentVersionSummaryDto] })
  versions!: DocumentVersionSummaryDto[]
}

export class PolicyConsentStatusDto {
  @ApiProperty() hasConsented!: boolean
  @ApiProperty() currentPolicyVersion!: string
  @ApiProperty({ type: Date, nullable: true }) acceptedAt!: Date | null
  @ApiProperty() termsTitle!: string
  @ApiProperty() termsSummary!: string
  @ApiProperty() privacyTitle!: string
  @ApiProperty() privacySummary!: string
  @ApiProperty() aiNoticeTitle!: string
  @ApiProperty() aiNoticeSummary!: string
}

export class AcceptPolicyConsentDto {
  @ApiProperty() policyVersion!: string
  @ApiProperty() termsAccepted!: boolean
  @ApiProperty() privacyAccepted!: boolean
  @ApiProperty() aiNoticeAccepted!: boolean
}

export class DownloadLinkResponseDto {
  @ApiProperty() downloadUrl!: string
  @ApiProperty() expiresAt!: Date
  @ApiProperty() expiresInSeconds!: number
  @ApiProperty() fileName!: string
}

export class SecurityIncidentSummaryDto {
  @ApiProperty() id!: string
  @ApiProperty() reference!: string
  @ApiProperty() fileName!: string
  @ApiProperty() sha256!: string
  @ApiProperty() reason!: string
  @ApiProperty() status!: string
  @ApiProperty({ type: String, nullable: true }) ipAddress!: string | null
  @ApiProperty() uploadedByUserName!: string
  @ApiProperty() uploadedAt!: Date
  @ApiProperty({ type: String, nullable: true }) resolvedByUserName!: string | null
  @ApiProperty({ type: Date, nullable: true }) resolvedAt!: Date | null
  @ApiProperty({ type: String, nullable: true }) purgedByUserName!: string | null
  @ApiProperty({ type: Date, nullable: true }) purgedAt!: Date | null
}

export function validateUploadIntentInput(body: RequestUploadIntentDto): RequestUploadIntentDto {
  if (!body.title || typeof body.title !== 'string' || !body.title.trim()) {
    throw new BadRequestException('Tiêu đề tài liệu không được để trống.')
  }
  if (!body.originalFilename || typeof body.originalFilename !== 'string' || !body.originalFilename.trim()) {
    throw new BadRequestException('Tên tệp gốc không được để trống.')
  }
  if (!body.mimeType || !ALLOWED_MIME_TYPES.has(body.mimeType)) {
    throw new BadRequestException(
      'Định dạng tệp không được hỗ trợ. Hệ thống chỉ chấp nhận PDF, DOCX và XLSX.',
    )
  }

  const size = Number(body.sizeBytes)
  if (!Number.isFinite(size) || size <= 0) {
    throw new BadRequestException('Dung lượng tệp không hợp lệ.')
  }

  if (body.mimeType === 'application/pdf' && size > MAX_FILE_SIZE_PDF) {
    throw new BadRequestException('Tệp PDF vượt quá hạn mức tối đa cho phép (100 MB).')
  }
  if (
    body.mimeType ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document' &&
    size > MAX_FILE_SIZE_DOCX
  ) {
    throw new BadRequestException('Tệp DOCX vượt quá hạn mức tối đa cho phép (50 MB).')
  }
  if (
    body.mimeType ===
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' &&
    size > MAX_FILE_SIZE_XLSX
  ) {
    throw new BadRequestException('Tệp XLSX vượt quá hạn mức tối đa cho phép (50 MB).')
  }

  if (!body.sha256 || typeof body.sha256 !== 'string' || body.sha256.trim().length !== 64) {
    throw new BadRequestException('Mã băm SHA-256 không hợp lệ (yêu cầu 64 ký tự hex).')
  }

  return {
    ...body,
    title: body.title.trim(),
    originalFilename: body.originalFilename.trim(),
    sha256: body.sha256.trim().toLowerCase(),
    documentType: body.documentType ?? DocumentType.TENDER_DOC,
    classification: body.classification ?? DataClassification.INTERNAL,
  }
}
