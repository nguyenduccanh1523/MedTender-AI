import { Body, Controller, Post, UseGuards } from '@nestjs/common'
import { ApiCreatedResponse, ApiTags } from '@nestjs/swagger'

import { WebMutationGuard } from '../../../../common/http/web-mutation.guard'
import { ApplicationsService } from '../../application/applications.service'
import { applicationInput, CreateOrganizationApplicationDto, OrganizationApplicationReceiptDto } from './applications.dto'

@ApiTags('organization applications')
@Controller('api/v1/organization-applications')
export class ApplicationsController {
  constructor(private readonly applications: ApplicationsService) {}

  @Post()
  @UseGuards(WebMutationGuard)
  @ApiCreatedResponse({ type: OrganizationApplicationReceiptDto })
  create(@Body() body: CreateOrganizationApplicationDto) {
    return this.applications.create(applicationInput(body))
  }
}
