import { BadRequestException } from '@nestjs/common'
import { ApiProperty } from '@nestjs/swagger'

import { invitableRoles, isInvitableRole, type InvitableRole } from '../../domain/invitation-roles'

export class CreateInvitationDto {
  @ApiProperty({ format: 'email' }) email!: string
  @ApiProperty({ enum: invitableRoles }) role!: InvitableRole
}

export class AcceptInvitationDto {
  @ApiProperty({ minLength: 43, maxLength: 43 }) token!: string
}

export class InvitationDto {
  @ApiProperty({ format: 'uuid' }) id!: string
  @ApiProperty({ format: 'email' }) email!: string
  @ApiProperty({ enum: invitableRoles }) role!: InvitableRole
  @ApiProperty({ type: String, format: 'date-time' }) expiresAt!: string
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) acceptedAt!: string | null
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) revokedAt!: string | null
}

export class CreatedInvitationDto extends InvitationDto {
  @ApiProperty() token!: string
}

export function invitationInput(body?: Partial<CreateInvitationDto>): CreateInvitationDto {
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !isInvitableRole(body?.role)) {
    throw new BadRequestException('Email hoặc vai trò được mời không hợp lệ.')
  }
  return { email, role: body.role }
}

export function invitationToken(body?: Partial<AcceptInvitationDto>) {
  if (typeof body?.token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(body.token)) {
    throw new BadRequestException('Liên kết lời mời không hợp lệ.')
  }
  return body.token
}
