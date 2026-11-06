import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
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
  ApiOkResponse,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger'
import { WebMutationGuard } from '../../common/http/web-mutation.guard'
import { accessCookie } from '../identity/presentation/http/session-cookies'
import { SessionGuard, type IdentityRequest } from '../identity/presentation/http/guards/session.guard'
import {
  CreateProductDto,
  CreateProductSpecDto,
  CreateProductVersionDto,
  ProductDetailDto,
  ProductSummaryDto,
  ProductVersionDetailDto,
  UpdateProductDto,
  UpdateProductSpecDto,
  UpdateProductVersionDto,
} from './catalog.dto'
import { CatalogService } from './catalog.service'

@ApiTags('catalog')
@ApiCookieAuth(accessCookie)
@UseGuards(SessionGuard)
@Controller('api/v1/organizations/:slug/catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('products')
  @Header('Cache-Control', 'no-store')
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'status', required: false, enum: ['ACTIVE', 'ARCHIVED'] })
  @ApiQuery({ name: 'cursor', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'pageMode', required: false })
  @ApiOkResponse({ type: [ProductSummaryDto] })
  list(
    @Req() req: IdentityRequest,
    @Param('slug') slug: string,
    @Query() query: Record<string, unknown>,
  ) {
    return this.catalog.list(req.identity.id, slug, query)
  }

  @Post('products')
  @UseGuards(WebMutationGuard)
  @ApiOkResponse({ type: ProductDetailDto })
  create(
    @Req() req: IdentityRequest,
    @Param('slug') slug: string,
    @Body() body: CreateProductDto,
  ) {
    return this.catalog.create(req.identity.id, slug, body)
  }

  @Get('products/:productId')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: ProductDetailDto })
  detail(
    @Req() req: IdentityRequest,
    @Param('slug') slug: string,
    @Param('productId', new ParseUUIDPipe()) productId: string,
  ) {
    return this.catalog.detail(req.identity.id, slug, productId)
  }

  @Patch('products/:productId')
  @UseGuards(WebMutationGuard)
  @ApiOkResponse({ type: ProductDetailDto })
  update(
    @Req() req: IdentityRequest,
    @Param('slug') slug: string,
    @Param('productId', new ParseUUIDPipe()) productId: string,
    @Body() body: UpdateProductDto,
  ) {
    return this.catalog.update(req.identity.id, slug, productId, body)
  }

  @Get('versions/:versionId')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: ProductVersionDetailDto })
  getVersionById(
    @Req() req: IdentityRequest,
    @Param('slug') slug: string,
    @Param('versionId', new ParseUUIDPipe()) versionId: string,
  ) {
    return this.catalog.getVersionById(req.identity.id, slug, versionId)
  }

  @Post('products/:productId/versions')
  @UseGuards(WebMutationGuard)
  @ApiOkResponse({ type: ProductVersionDetailDto })
  createVersion(
    @Req() req: IdentityRequest,
    @Param('slug') slug: string,
    @Param('productId', new ParseUUIDPipe()) productId: string,
    @Body() body: CreateProductVersionDto,
  ) {
    return this.catalog.createVersion(req.identity.id, slug, productId, body)
  }

  @Get('products/:productId/versions/:versionId')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: ProductVersionDetailDto })
  getProductVersion(
    @Req() req: IdentityRequest,
    @Param('slug') slug: string,
    @Param('productId', new ParseUUIDPipe()) _productId: string,
    @Param('versionId', new ParseUUIDPipe()) versionId: string,
  ) {
    return this.catalog.getVersionById(req.identity.id, slug, versionId)
  }

  @Patch('products/:productId/versions/:versionId')
  @UseGuards(WebMutationGuard)
  @ApiOkResponse({ type: ProductVersionDetailDto })
  updateVersion(
    @Req() req: IdentityRequest,
    @Param('slug') slug: string,
    @Param('productId', new ParseUUIDPipe()) productId: string,
    @Param('versionId', new ParseUUIDPipe()) versionId: string,
    @Body() body: UpdateProductVersionDto,
  ) {
    return this.catalog.updateVersion(req.identity.id, slug, productId, versionId, body)
  }

  @Post('products/:productId/versions/:versionId/publish')
  @UseGuards(WebMutationGuard)
  @ApiOkResponse({ type: ProductVersionDetailDto })
  publishVersion(
    @Req() req: IdentityRequest,
    @Param('slug') slug: string,
    @Param('productId', new ParseUUIDPipe()) productId: string,
    @Param('versionId', new ParseUUIDPipe()) versionId: string,
  ) {
    return this.catalog.publishVersion(req.identity.id, slug, productId, versionId)
  }

  @Post('products/:productId/versions/:versionId/specifications')
  @UseGuards(WebMutationGuard)
  @ApiOkResponse({ type: ProductVersionDetailDto })
  addSpecification(
    @Req() req: IdentityRequest,
    @Param('slug') slug: string,
    @Param('productId', new ParseUUIDPipe()) productId: string,
    @Param('versionId', new ParseUUIDPipe()) versionId: string,
    @Body() body: CreateProductSpecDto,
  ) {
    return this.catalog.addSpecification(req.identity.id, slug, productId, versionId, body)
  }

  @Patch('products/:productId/versions/:versionId/specifications/:specId')
  @UseGuards(WebMutationGuard)
  @ApiOkResponse({ type: ProductVersionDetailDto })
  updateSpecification(
    @Req() req: IdentityRequest,
    @Param('slug') slug: string,
    @Param('productId', new ParseUUIDPipe()) productId: string,
    @Param('versionId', new ParseUUIDPipe()) versionId: string,
    @Param('specId', new ParseUUIDPipe()) specId: string,
    @Body() body: UpdateProductSpecDto,
  ) {
    return this.catalog.updateSpecification(
      req.identity.id,
      slug,
      productId,
      versionId,
      specId,
      body,
    )
  }

  @Delete('products/:productId/versions/:versionId/specifications/:specId')
  @UseGuards(WebMutationGuard)
  @ApiOkResponse({ type: ProductVersionDetailDto })
  removeSpecification(
    @Req() req: IdentityRequest,
    @Param('slug') slug: string,
    @Param('productId', new ParseUUIDPipe()) productId: string,
    @Param('versionId', new ParseUUIDPipe()) versionId: string,
    @Param('specId', new ParseUUIDPipe()) specId: string,
  ) {
    return this.catalog.removeSpecification(req.identity.id, slug, productId, versionId, specId)
  }
}
