import { Body, Controller, Get, Header, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common'
import { ApiCookieAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger'

import { WebMutationGuard } from '../../../../common/http/web-mutation.guard'
import { accessCookie } from '../../../identity/presentation/http/session-cookies'
import { SessionGuard, type IdentityRequest } from '../../../identity/presentation/http/guards/session.guard'
import { AdminApplicationsService } from '../../application/admin-applications.service'
import { ApprovalResultDto, OrganizationApplicationDto, RejectApplicationDto, rejectionReason } from './admin-applications.dto'
import { SystemAdminGuard } from './guards/system-admin.guard'

@ApiTags('system admin')
@ApiCookieAuth(accessCookie)
@UseGuards(SessionGuard, SystemAdminGuard)
@Controller('api/v1/system-admin/organization-applications')
export class AdminApplicationsController {
  constructor(private readonly applications: AdminApplicationsService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: OrganizationApplicationDto, isArray: true })
  list(@Req() req: IdentityRequest) {
    return this.applications.list(req.identity.id)
  }

  @Post(':id/approve')
  @HttpCode(200)
  @UseGuards(WebMutationGuard)
  @ApiOkResponse({ type: ApprovalResultDto })
  approve(@Req() req: IdentityRequest, @Param('id') id: string) {
    return this.applications.approve(req.identity.id, id)
  }

  @Post(':id/reject')
  @HttpCode(204)
  @UseGuards(WebMutationGuard)
  reject(@Req() req: IdentityRequest, @Param('id') id: string, @Body() body: RejectApplicationDto) {
    return this.applications.reject(req.identity.id, id, rejectionReason(body))
  }

}
