import { BadRequestException } from '@nestjs/common'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class CreateOrganizationApplicationDto {
  @ApiProperty({ minLength: 2, maxLength: 160 }) organizationName!: string
  @ApiProperty({ minLength: 3, maxLength: 40 }) taxCode!: string
  @ApiPropertyOptional({ format: 'uri', maxLength: 240 }) website?: string
  @ApiProperty({ minLength: 5, maxLength: 300 }) address!: string
  @ApiProperty({ minLength: 2, maxLength: 100 }) contactName!: string
  @ApiProperty({ format: 'email', maxLength: 254 }) contactEmail!: string
  @ApiProperty({ minLength: 8, maxLength: 30 }) contactPhone!: string
  @ApiPropertyOptional({ description: 'Cloudflare Turnstile token for anti-bot validation' })
  turnstileToken?: string
}

export class OrganizationApplicationReceiptDto {
  @ApiProperty() reference!: string
  @ApiProperty({ enum: ['PENDING'] }) status!: 'PENDING'
}

function text(value: unknown, min: number, max: number) {
  const result = typeof value === 'string' ? value.trim() : ''
  return result.length >= min && result.length <= max ? result : undefined
}

export function applicationInput(body?: Partial<CreateOrganizationApplicationDto>) {
  const organizationName = text(body?.organizationName, 2, 160)
  const taxCode = text(body?.taxCode, 3, 40)
  const address = text(body?.address, 5, 300)
  const contactName = text(body?.contactName, 2, 100)
  const contactEmail = text(body?.contactEmail, 3, 254)?.toLowerCase()
  const contactPhone = text(body?.contactPhone, 8, 30)
  const website = text(body?.website, 0, 240) || undefined
  if (!organizationName || !taxCode || !address || !contactName || !contactEmail || !contactPhone ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail) || (website && !URL.canParse(website))) {
    throw new BadRequestException('Thông tin đăng ký tổ chức chưa hợp lệ.')
  }
  return { organizationName, taxCode, website, address, contactName, contactEmail, contactPhone }
}
