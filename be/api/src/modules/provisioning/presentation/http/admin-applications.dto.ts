import { BadRequestException } from '@nestjs/common'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class OrganizationApplicationDto {
  @ApiProperty({ format: 'uuid' }) id!: string
  @ApiProperty() reference!: string
  @ApiProperty() organizationName!: string
  @ApiProperty() taxCode!: string
  @ApiPropertyOptional() website!: string | null
  @ApiProperty() address!: string
  @ApiProperty() contactName!: string
  @ApiProperty() contactEmail!: string
  @ApiProperty() contactPhone!: string
  @ApiProperty({ enum: ['PENDING', 'APPROVED', 'REJECTED'] }) status!: string
  @ApiProperty() createdAt!: Date
}

export class ApprovalResultDto {
  @ApiProperty({ enum: ['APPROVED'] }) status!: 'APPROVED'
  @ApiProperty({ enum: ['LOGGED', 'SENT'] }) emailDelivery!: 'LOGGED' | 'SENT'
  @ApiPropertyOptional() activationLink?: string
  @ApiProperty() organization!: { id: string; slug: string; name: string }
}

export class RejectApplicationDto {
  @ApiProperty({ minLength: 3, maxLength: 500 }) reason!: string
}

export function rejectionReason(body?: Partial<RejectApplicationDto>) {
  const reason = typeof body?.reason === 'string' ? body.reason.trim() : ''
  if (reason.length < 3 || reason.length > 500) throw new BadRequestException('Lý do từ chối cần 3–500 ký tự.')
  return reason
}
