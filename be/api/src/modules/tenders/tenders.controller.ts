import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common'
import {
  ApiCookieAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger'
import { WebMutationGuard } from '../../common/http/web-mutation.guard'
import { accessCookie } from '../identity/presentation/http/session-cookies'
import { SessionGuard, type IdentityRequest } from '../identity/presentation/http/guards/session.guard'
import {
  CreateItemDto,
  CreateLotDto,
  CreateTenderDto,
  TenderAuditLogDto,
  TenderDto,
  UpdateItemDto,
  UpdateLotDto,
  UpdateTenderDto,
} from './tenders.dto'
import { TendersService } from './tenders.service'

@ApiTags('tenders')
@ApiCookieAuth(accessCookie)
@UseGuards(SessionGuard)
@Controller('api/v1/organizations/:slug/tenders')
export class TendersController {
  constructor(private readonly tenders: TendersService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'stage', required: false, enum: ['RFQ', 'FORMAL_TENDER', 'INTERNAL'] })
  @ApiQuery({ name: 'cursor', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'pageMode', required: false })
  list(
    @Req() req: IdentityRequest,
    @Param('slug') slug: string,
    @Query() query: Record<string, unknown>,
  ) {
    return this.tenders.list(req.identity.id, slug, query)
  }

  @Post()
  @UseGuards(WebMutationGuard)
  @ApiOkResponse({ type: TenderDto })
  create(@Req() req: IdentityRequest, @Param('slug') slug: string, @Body() body: CreateTenderDto) {
    return this.tenders.create(req.identity.id, slug, body)
  }

  @Get(':id')
  @Header('Cache-Control', 'no-store')
  detail(
    @Req() req: IdentityRequest,
    @Param('slug') slug: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.tenders.detail(req.identity.id, slug, id)
  }

  @Patch(':id')
  @UseGuards(WebMutationGuard)
  @ApiOkResponse({ type: TenderDto })
  update(
    @Req() req: IdentityRequest,
    @Param('slug') slug: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: UpdateTenderDto,
  ) {
    return this.tenders.update(req.identity.id, slug, id, body)
  }

  @Delete(':id')
  @HttpCode(204)
  @UseGuards(WebMutationGuard)
  @ApiNoContentResponse()
  remove(
    @Req() req: IdentityRequest,
    @Param('slug') slug: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.tenders.remove(req.identity.id, slug, id)
  }

  @Post(':id/lots')
  @UseGuards(WebMutationGuard)
  lot(
    @Req() req: IdentityRequest,
    @Param('slug') slug: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: CreateLotDto,
  ) {
    return this.tenders.addLot(req.identity.id, slug, id, body)
  }

  @Patch(':id/lots/:lotId')
  @UseGuards(WebMutationGuard)
  updateLot(
    @Req() req: IdentityRequest,
    @Param('slug') slug: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('lotId', new ParseUUIDPipe()) lotId: string,
    @Body() body: UpdateLotDto,
  ) {
    return this.tenders.updateLot(req.identity.id, slug, id, lotId, body)
  }

  @Delete(':id/lots/:lotId')
  @HttpCode(204)
  @UseGuards(WebMutationGuard)
  @ApiNoContentResponse()
  removeLot(
    @Req() req: IdentityRequest,
    @Param('slug') slug: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('lotId', new ParseUUIDPipe()) lotId: string,
  ) {
    return this.tenders.removeLot(req.identity.id, slug, id, lotId)
  }

  @Post(':id/lots/:lotId/items')
  @UseGuards(WebMutationGuard)
  item(
    @Req() req: IdentityRequest,
    @Param('slug') slug: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('lotId', new ParseUUIDPipe()) lotId: string,
    @Body() body: CreateItemDto,
  ) {
    return this.tenders.addItem(req.identity.id, slug, id, lotId, body)
  }

  @Patch(':id/lots/:lotId/items/:itemId')
  @UseGuards(WebMutationGuard)
  updateItem(
    @Req() req: IdentityRequest,
    @Param('slug') slug: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('lotId', new ParseUUIDPipe()) lotId: string,
    @Param('itemId', new ParseUUIDPipe()) itemId: string,
    @Body() body: UpdateItemDto,
  ) {
    return this.tenders.updateItem(req.identity.id, slug, id, lotId, itemId, body)
  }

  @Delete(':id/lots/:lotId/items/:itemId')
  @HttpCode(204)
  @UseGuards(WebMutationGuard)
  @ApiNoContentResponse()
  removeItem(
    @Req() req: IdentityRequest,
    @Param('slug') slug: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('lotId', new ParseUUIDPipe()) lotId: string,
    @Param('itemId', new ParseUUIDPipe()) itemId: string,
  ) {
    return this.tenders.removeItem(req.identity.id, slug, id, lotId, itemId)
  }

  @Get(':id/audits')
  @Header('Cache-Control', 'no-store')
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'cursor', required: false })
  @ApiQuery({ name: 'action', required: false })
  @ApiQuery({ name: 'pageMode', required: false })
  @ApiOkResponse({ type: [TenderAuditLogDto] })
  audits(
    @Req() req: IdentityRequest,
    @Param('slug') slug: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: Record<string, unknown>,
  ) {
    return this.tenders.listAudits(req.identity.id, slug, id, query)
  }
}
