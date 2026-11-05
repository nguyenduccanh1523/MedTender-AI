import { Body, Controller, Get, Header, HttpCode, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common'
import { ApiCookieAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger'

import { WebMutationGuard } from '../../../../common/http/web-mutation.guard'
import { SessionGuard, type IdentityRequest } from '../../../identity/presentation/http/guards/session.guard'
import { accessCookie } from '../../../identity/presentation/http/session-cookies'
import { InvitationsService } from '../../application/invitations.service'
import { AcceptInvitationDto, CreatedInvitationDto, CreateInvitationDto, InvitationDto, invitationInput, invitationToken } from './invitations.dto'
import { OrganizationDto } from './organizations.dto'

@ApiTags('invitations')
@ApiCookieAuth(accessCookie)
@UseGuards(SessionGuard)
@Controller('api/v1/organizations')
export class InvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  @Get(':slug/invitations')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: InvitationDto, isArray: true })
  list(@Req() req: IdentityRequest, @Param('slug') slug: string) {
    return this.invitations.list(req.identity.id, slug)
  }

  @Post(':slug/invitations')
  @UseGuards(WebMutationGuard)
  @Header('Cache-Control', 'no-store')
  @ApiCreatedResponse({ type: CreatedInvitationDto })
  create(@Req() req: IdentityRequest, @Param('slug') slug: string, @Body() body: CreateInvitationDto) {
    const { email, role } = invitationInput(body)
    return this.invitations.create(req.identity.id, slug, email, role)
  }

  @Post(':slug/invitations/:id/revoke')
  @HttpCode(204)
  @UseGuards(WebMutationGuard)
  @Header('Cache-Control', 'no-store')
  revoke(@Req() req: IdentityRequest, @Param('slug') slug: string, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.invitations.revoke(req.identity.id, slug, id)
  }

  @Post('invitations/accept')
  @HttpCode(200)
  @UseGuards(WebMutationGuard)
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: OrganizationDto })
  accept(@Req() req: IdentityRequest, @Body() body: AcceptInvitationDto) {
    return this.invitations.accept(req.identity.id, invitationToken(body))
  }
}
