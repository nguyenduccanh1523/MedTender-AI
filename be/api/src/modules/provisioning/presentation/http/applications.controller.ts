import { Body, Controller, Ip, Post, UseGuards } from '@nestjs/common'
import { ApiCreatedResponse, ApiTags } from '@nestjs/swagger'

import { WebMutationGuard } from '../../../../common/http/web-mutation.guard'
import { TurnstileService } from '../../../../integrations/turnstile/turnstile.service'
import { ApplicationsService } from '../../application/applications.service'
import { applicationInput, CreateOrganizationApplicationDto, OrganizationApplicationReceiptDto } from './applications.dto'

@ApiTags('organization applications')
@Controller('api/v1/organization-applications')
export class ApplicationsController {
  constructor(
    private readonly applications: ApplicationsService,
    private readonly turnstile: TurnstileService,
  ) {}

  @Post()
  @UseGuards(WebMutationGuard)
  @ApiCreatedResponse({ type: OrganizationApplicationReceiptDto })
  async create(
    @Body() body: CreateOrganizationApplicationDto,
    @Ip() clientIp: string,
  ) {
    await this.turnstile.verifyToken(body.turnstileToken, clientIp)
    return this.applications.create(applicationInput(body))
  }
}
