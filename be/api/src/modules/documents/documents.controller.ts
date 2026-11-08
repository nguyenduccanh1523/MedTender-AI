import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Headers,
  HttpCode,
  HttpStatus,
  Ip,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common'
import { ApiCookieAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { WebMutationGuard } from '../../common/http/web-mutation.guard'
import { SessionGuard, type IdentityRequest } from '../identity/presentation/http/guards/session.guard'
import { accessCookie } from '../identity/presentation/http/session-cookies'
import {
  AcceptPolicyConsentDto,
  CompleteUploadDto,
  DocumentDetailDto,
  DownloadLinkResponseDto,
  PolicyConsentStatusDto,
  RequestUploadIntentDto,
  SecurityIncidentSummaryDto,
  UploadIntentResponseDto,
} from './documents.dto'
import { DocumentsService } from './documents.service'

@ApiTags('documents')
@Controller('api/v1/organizations/:slug/documents')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get('policy-consent')
  @ApiCookieAuth(accessCookie)
  @UseGuards(SessionGuard)
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: PolicyConsentStatusDto })
  getPolicyConsent(
    @Req() req: IdentityRequest,
    @Param('slug') slug: string,
  ): Promise<PolicyConsentStatusDto> {
    return this.documents.getPolicyConsentStatus(req.identity.id, slug)
  }

  @Post('policy-consent')
  @ApiCookieAuth(accessCookie)
  @UseGuards(SessionGuard, WebMutationGuard)
  @ApiOkResponse({ type: PolicyConsentStatusDto })
  acceptPolicyConsent(
    @Req() req: IdentityRequest,
    @Param('slug') slug: string,
    @Body() body: AcceptPolicyConsentDto,
  ): Promise<PolicyConsentStatusDto> {
    return this.documents.acceptPolicyConsent(req.identity.id, slug, body)
  }

  @Post('upload-intents')
  @ApiCookieAuth(accessCookie)
  @UseGuards(SessionGuard, WebMutationGuard)
  @ApiOkResponse({ type: UploadIntentResponseDto })
  createUploadIntent(
    @Req() req: IdentityRequest,
    @Param('slug') slug: string,
    @Body() body: RequestUploadIntentDto,
  ): Promise<UploadIntentResponseDto> {
    return this.documents.createUploadIntent(req.identity.id, slug, body)
  }

  // Stream raw bytes upload via PUT using upload token (supports query ?token= or x-upload-token header)
  @Put('upload-stream/:intentId')
  @ApiCookieAuth(accessCookie)
  @UseGuards(SessionGuard)
  @HttpCode(HttpStatus.OK)
  async uploadStream(
    @Req() req: IdentityRequest,
    @Param('slug') slug: string,
    @Param('intentId', new ParseUUIDPipe()) intentId: string,
    @Query('token') queryToken: string | undefined,
    @Headers('x-upload-token') headerToken: string | undefined,
  ) {
    const rawReq = req as any
    const token =
      (queryToken ? String(queryToken).trim() : undefined) ||
      (headerToken ? String(headerToken).trim() : undefined) ||
      (rawReq.headers?.['x-upload-token'] ? String(rawReq.headers['x-upload-token']).trim() : undefined) ||
      ''

    let buffer: Buffer
    if (Buffer.isBuffer(rawReq.body)) {
      buffer = rawReq.body
    } else if (Buffer.isBuffer(rawReq.rawBody)) {
      buffer = rawReq.rawBody
    } else {
      const chunks: Buffer[] = []
      for await (const chunk of rawReq) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
      }
      buffer = Buffer.concat(chunks)
    }

    return this.documents.uploadStream(req.identity.id, slug, intentId, token, buffer)
  }

  @Post(':documentId/versions/:versionNumber/complete')
  @ApiCookieAuth(accessCookie)
  @UseGuards(SessionGuard, WebMutationGuard)
  @ApiOkResponse({ type: DocumentDetailDto })
  completeUpload(
    @Req() req: IdentityRequest,
    @Param('slug') slug: string,
    @Param('documentId', new ParseUUIDPipe()) documentId: string,
    @Param('versionNumber') versionNumber: string,
    @Body() body: CompleteUploadDto,
    @Ip() ip: string,
  ): Promise<DocumentDetailDto> {
    return this.documents.completeUpload(
      req.identity.id,
      slug,
      documentId,
      Number(versionNumber),
      body,
      ip,
    )
  }

  @Get()
  @ApiCookieAuth(accessCookie)
  @UseGuards(SessionGuard)
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: [DocumentDetailDto] })
  list(
    @Req() req: IdentityRequest,
    @Param('slug') slug: string,
    @Query('tenderId') tenderId?: string,
    @Query('productId') productId?: string,
  ): Promise<DocumentDetailDto[]> {
    return this.documents.listDocuments(req.identity.id, slug, { tenderId, productId })
  }

  @Get(':documentId')
  @ApiCookieAuth(accessCookie)
  @UseGuards(SessionGuard)
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: DocumentDetailDto })
  detail(
    @Req() req: IdentityRequest,
    @Param('slug') slug: string,
    @Param('documentId', new ParseUUIDPipe()) documentId: string,
  ): Promise<DocumentDetailDto> {
    return this.documents.getDocumentDetail(req.identity.id, slug, documentId)
  }

  @Delete(':documentId')
  @ApiCookieAuth(accessCookie)
  @UseGuards(SessionGuard, WebMutationGuard)
  deleteDocument(
    @Req() req: IdentityRequest,
    @Param('slug') slug: string,
    @Param('documentId', new ParseUUIDPipe()) documentId: string,
  ): Promise<{ success: boolean }> {
    return this.documents.deleteDocument(req.identity.id, slug, documentId)
  }

  @Post(':documentId/versions/:versionId/download-link')
  @ApiCookieAuth(accessCookie)
  @UseGuards(SessionGuard, WebMutationGuard)
  @ApiOkResponse({ type: DownloadLinkResponseDto })
  getDownloadLink(
    @Req() req: IdentityRequest,
    @Param('slug') slug: string,
    @Param('documentId', new ParseUUIDPipe()) documentId: string,
    @Param('versionId', new ParseUUIDPipe()) versionId: string,
  ): Promise<DownloadLinkResponseDto> {
    return this.documents.getDownloadLink(req.identity.id, slug, documentId, versionId)
  }

  // Stream raw bytes download
  @Get('download-stream/:fileAssetId')
  async downloadStream(
    @Param('slug') slug: string,
    @Param('fileAssetId', new ParseUUIDPipe()) fileAssetId: string,
    @Query('token') token: string,
    @Res() res: ServerResponse,
  ) {
    const { buffer, fileName, mimeType } = await this.documents.getDownloadStream(
      slug,
      fileAssetId,
      token ?? '',
    )
    res.setHeader('Content-Type', mimeType)
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`)
    res.setHeader('Content-Length', String(buffer.length))
    res.statusCode = 200
    res.end(buffer)
  }

  @Get('governance/security-incidents')
  @ApiCookieAuth(accessCookie)
  @UseGuards(SessionGuard)
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: [SecurityIncidentSummaryDto] })
  listIncidents(
    @Req() req: IdentityRequest,
    @Param('slug') slug: string,
  ): Promise<SecurityIncidentSummaryDto[]> {
    return this.documents.listSecurityIncidents(req.identity.id, slug)
  }

  @Post('governance/security-incidents/:incidentId/purge')
  @ApiCookieAuth(accessCookie)
  @UseGuards(SessionGuard, WebMutationGuard)
  purgeIncident(
    @Req() req: IdentityRequest,
    @Param('slug') slug: string,
    @Param('incidentId', new ParseUUIDPipe()) incidentId: string,
    @Body('reason') reason: string,
  ) {
    return this.documents.purgeSecurityIncident(req.identity.id, slug, incidentId, reason)
  }
}
