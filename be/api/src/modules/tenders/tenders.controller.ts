import { Body, Controller, Get, Header, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common'
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger'
import { WebMutationGuard } from '../../common/http/web-mutation.guard'
import { accessCookie } from '../identity/presentation/http/session-cookies'
import { SessionGuard, type IdentityRequest } from '../identity/presentation/http/guards/session.guard'
import { CreateItemDto, CreateLotDto, CreateTenderDto } from './tenders.dto'
import { TendersService } from './tenders.service'
@ApiTags('tenders') @ApiCookieAuth(accessCookie) @UseGuards(SessionGuard) @Controller('api/v1/organizations/:slug/tenders')
export class TendersController { constructor(private readonly tenders: TendersService) {}
  @Get() @Header('Cache-Control', 'no-store') list(@Req() req: IdentityRequest, @Param('slug') slug: string) { return this.tenders.list(req.identity.id, slug) }
  @Post() @UseGuards(WebMutationGuard) create(@Req() req: IdentityRequest, @Param('slug') slug: string, @Body() body: CreateTenderDto) { return this.tenders.create(req.identity.id, slug, body) }
  @Get(':id') detail(@Req() req: IdentityRequest, @Param('slug') slug: string, @Param('id', new ParseUUIDPipe()) id: string) { return this.tenders.detail(req.identity.id, slug, id) }
  @Post(':id/lots') @UseGuards(WebMutationGuard) lot(@Req() req: IdentityRequest, @Param('slug') slug: string, @Param('id', new ParseUUIDPipe()) id: string, @Body() body: CreateLotDto) { return this.tenders.addLot(req.identity.id, slug, id, body) }
  @Post(':id/lots/:lotId/items') @UseGuards(WebMutationGuard) item(@Req() req: IdentityRequest, @Param('slug') slug: string, @Param('id', new ParseUUIDPipe()) id: string, @Param('lotId', new ParseUUIDPipe()) lotId: string, @Body() body: CreateItemDto) { return this.tenders.addItem(req.identity.id, slug, id, lotId, body) }
}
