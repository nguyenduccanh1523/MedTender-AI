import { Controller, ForbiddenException, Get, Header, Param, Post, Req, UseGuards } from '@nestjs/common'
import { ApiCookieAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger'

import { accessCookie } from '../../../identity/presentation/http/session-cookies'
import { SessionGuard, type IdentityRequest } from '../../../identity/presentation/http/guards/session.guard'
import { WebMutationGuard } from '../../../../common/http/web-mutation.guard'
import { OrganizationDto, OrganizationMemberDto } from './organizations.dto'
import { OrganizationsService } from '../../application/organizations.service'

@ApiTags('organizations')
@ApiCookieAuth(accessCookie)
@UseGuards(SessionGuard)
@Controller('api/v1/organizations')
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: OrganizationDto, isArray: true })
  list(@Req() req: IdentityRequest) {
    return this.organizations.list(req.identity.id)
  }

  @Post()
  @UseGuards(WebMutationGuard)
  @Header('Cache-Control', 'no-store')
  @ApiCreatedResponse({ type: OrganizationDto })
  create() {
    throw new ForbiddenException('Tổ chức chỉ được tạo sau khi System Admin phê duyệt hồ sơ.')
  }

  @Get(':slug')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: OrganizationDto })
  get(@Req() req: IdentityRequest, @Param('slug') slug: string) {
    return this.organizations.get(req.identity.id, slug)
  }

  @Get(':slug/members')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: OrganizationMemberDto, isArray: true })
  members(@Req() req: IdentityRequest, @Param('slug') slug: string) {
    return this.organizations.members(req.identity.id, slug)
  }
}
