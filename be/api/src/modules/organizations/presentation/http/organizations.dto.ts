import { BadRequestException } from '@nestjs/common'
import { ApiProperty } from '@nestjs/swagger'

import { MembershipRole, MembershipStatus } from '../../../../database/generated/client'

export class CreateOrganizationDto {
  @ApiProperty({ minLength: 2, maxLength: 100 }) name!: string
}

export class OrganizationDto {
  @ApiProperty({ format: 'uuid' }) id!: string
  @ApiProperty() name!: string
  @ApiProperty() slug!: string
  @ApiProperty({ enum: MembershipRole }) role!: MembershipRole
}

export class OrganizationMemberDto {
  @ApiProperty({ format: 'uuid' }) userId!: string
  @ApiProperty() name!: string
  @ApiProperty({ enum: MembershipRole }) role!: MembershipRole
  @ApiProperty({ enum: MembershipStatus }) status!: MembershipStatus
}

export function organizationName(input?: Partial<CreateOrganizationDto>) {
  const name = typeof input?.name === 'string' ? input.name.trim() : ''
  if (name.length < 2 || name.length > 100) {
    throw new BadRequestException('Tên tổ chức cần từ 2 đến 100 ký tự.')
  }
  return name
}
