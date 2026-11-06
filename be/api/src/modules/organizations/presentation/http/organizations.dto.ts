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

export class UpdateOrganizationGovernanceDto {
  @ApiProperty({ required: false }) name?: string
  @ApiProperty({ required: false }) requireIndependentReviewer?: boolean
  @ApiProperty({ required: false, enum: ['INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'] })
  defaultDataClassification?: 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED'
}

export class UpdateOrganizationMemberDto {
  @ApiProperty({ enum: MembershipRole, required: false }) role?: MembershipRole
  @ApiProperty({ enum: MembershipStatus, required: false }) status?: MembershipStatus
}

export class WorkspaceActivityMetricsDto {
  @ApiProperty() tendersCount!: number
  @ApiProperty() lotsCount!: number
  @ApiProperty() itemsCount!: number
  @ApiProperty() productsCount!: number
  @ApiProperty() publishedVersionsCount!: number
  @ApiProperty() draftVersionsCount!: number
  @ApiProperty() conflictingSpecsCount!: number
  @ApiProperty({ type: Number, nullable: true }) membersCount!: number | null
  @ApiProperty({ type: Number, nullable: true }) pendingInvitationsCount!: number | null
}

export class WorkspaceWorkQueueItemDto {
  @ApiProperty() id!: string
  @ApiProperty() category!: string
  @ApiProperty({ enum: ['HIGH', 'MEDIUM', 'INFO'] }) priority!: 'HIGH' | 'MEDIUM' | 'INFO'
  @ApiProperty() title!: string
  @ApiProperty() description!: string
  @ApiProperty() href!: string
  @ApiProperty() ctaLabel!: string
  @ApiProperty() meta!: string
}

export class WorkspaceTimelineItemDto {
  @ApiProperty() id!: string
  @ApiProperty() action!: string
  @ApiProperty() summary!: string
  @ApiProperty() actorName!: string
  @ApiProperty({ enum: MembershipRole }) actorRole!: MembershipRole
  @ApiProperty() createdAt!: Date
  @ApiProperty({ type: String, nullable: true }) href!: string | null
}

export class WorkspaceActivityDto {
  @ApiProperty({ enum: MembershipRole }) role!: MembershipRole
  @ApiProperty({ type: WorkspaceActivityMetricsDto }) metrics!: WorkspaceActivityMetricsDto
  @ApiProperty({ type: [WorkspaceWorkQueueItemDto] }) workQueue!: WorkspaceWorkQueueItemDto[]
  @ApiProperty({ type: [WorkspaceTimelineItemDto] }) timeline!: WorkspaceTimelineItemDto[]
}

export class OrganizationGovernanceSettingsDto {
  @ApiProperty() requireIndependentReviewer!: boolean
  @ApiProperty() externalAiPolicy!: 'OFF'
  @ApiProperty({ enum: ['INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'] })
  defaultDataClassification!: 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED'
  @ApiProperty() maxLotsPerTender!: number
  @ApiProperty() maxItemsPerTender!: number
  @ApiProperty() maxSpecsPerVersion!: number
}

export class OrganizationGovernanceDto {
  @ApiProperty() id!: string
  @ApiProperty() slug!: string
  @ApiProperty() name!: string
  @ApiProperty() status!: string
  @ApiProperty() createdAt!: Date
  @ApiProperty({ type: OrganizationGovernanceSettingsDto })
  settings!: OrganizationGovernanceSettingsDto
  @ApiProperty({ type: [OrganizationMemberDto] }) members!: OrganizationMemberDto[]
  @ApiProperty({ type: [WorkspaceTimelineItemDto] }) recentAudits!: WorkspaceTimelineItemDto[]
}

export function organizationName(input?: Partial<CreateOrganizationDto>) {
  const name = typeof input?.name === 'string' ? input.name.trim() : ''
  if (name.length < 2 || name.length > 100) {
    throw new BadRequestException('Tên tổ chức cần từ 2 đến 100 ký tự.')
  }
  return name
}
