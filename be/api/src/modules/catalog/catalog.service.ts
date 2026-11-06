import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { Prisma, type MembershipRole } from '../../database/generated/client'
import { OrganizationsService } from '../organizations/application/organizations.service'
import {
  CATALOG_MAX_SPECS_PER_VERSION,
  computeVersionFingerprint,
  encodeCatalogCursor,
  enrichSpecificationsWithConflicts,
  parseCatalogListQuery,
  productInput,
  productPatchInput,
  productVersionInput,
  productVersionPatchInput,
  specInput,
  specPatchInput,
  type CreateProductDto,
  type CreateProductSpecDto,
  type CreateProductVersionDto,
  type ProductDetailDto,
  type ProductSummaryDto,
  type ProductVersionDetailDto,
  type ProductVersionSummaryDto,
  type UpdateProductDto,
  type UpdateProductSpecDto,
  type UpdateProductVersionDto,
} from './catalog.dto'

const catalogWriters = new Set<MembershipRole>(['OWNER', 'ADMIN', 'CATALOG_MANAGER'])

function assertCatalogWriter(role: MembershipRole, action: string) {
  if (!catalogWriters.has(role)) {
    throw new ForbiddenException(`Bạn không có quyền ${action}.`)
  }
}

function assertDraftVersion(status: string) {
  if (status !== 'DRAFT') {
    throw new ConflictException(
      'Phiên bản đã xuất bản được khóa bất biến. Vui lòng tạo phiên bản mới.',
    )
  }
}

function handleCatalogUnique(error: unknown, conflictMessage: string): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    throw new ConflictException(conflictMessage)
  }
  throw error
}

type VersionWithSpecs = {
  id: string
  productId: string
  versionNumber: number
  versionLabel: string
  modelCode: string
  status: 'DRAFT' | 'PUBLISHED' | 'SUPERSEDED'
  fingerprint: string
  notes: string | null
  publishedAt: Date | null
  createdAt: Date
  updatedAt: Date
  specifications: Array<{
    id: string
    productVersionId: string
    specKey: string
    specValue: string
    unit: string | null
    sourceLabel: string
    sourceQuote: string | null
    documentVersionId: string | null
    createdAt: Date
  }>
}

function formatVersionDetail(version: VersionWithSpecs): ProductVersionDetailDto {
  const { items, conflictCount } = enrichSpecificationsWithConflicts(version.specifications)
  return {
    id: version.id,
    productId: version.productId,
    versionNumber: version.versionNumber,
    versionLabel: version.versionLabel,
    modelCode: version.modelCode,
    status: version.status,
    fingerprint: version.fingerprint,
    notes: version.notes,
    publishedAt: version.publishedAt,
    createdAt: version.createdAt,
    updatedAt: version.updatedAt,
    specificationCount: items.length,
    conflictCount,
    specifications: items,
  }
}

function toVersionSummary(detail: ProductVersionDetailDto): ProductVersionSummaryDto {
  return {
    id: detail.id,
    productId: detail.productId,
    versionNumber: detail.versionNumber,
    versionLabel: detail.versionLabel,
    modelCode: detail.modelCode,
    status: detail.status,
    fingerprint: detail.fingerprint,
    notes: detail.notes,
    publishedAt: detail.publishedAt,
    createdAt: detail.createdAt,
    updatedAt: detail.updatedAt,
    specificationCount: detail.specificationCount,
    conflictCount: detail.conflictCount,
  }
}

@Injectable()
export class CatalogService {
  constructor(private readonly organizations: OrganizationsService) {}

  private async recordAudit(
    tx: Prisma.TransactionClient,
    params: {
      organizationId: string
      actorUserId: string
      actorRole: MembershipRole
      action: string
      summary: string
      details?: Record<string, unknown>
    },
  ) {
    await tx.tenderAuditLog.create({
      data: {
        organizationId: params.organizationId,
        actorUserId: params.actorUserId,
        actorRole: params.actorRole,
        action: params.action,
        summary: params.summary,
        details: (params.details ?? {}) as Prisma.InputJsonValue,
      },
    })
  }

  private async refreshVersionFingerprint(
    tx: Prisma.TransactionClient,
    organizationId: string,
    versionId: string,
    modelCode: string,
  ) {
    const specs = await tx.productSpecification.findMany({
      where: { organizationId, productVersionId: versionId },
      orderBy: [{ specKey: 'asc' }, { createdAt: 'asc' }],
    })
    const fingerprint = computeVersionFingerprint(modelCode, specs)
    return tx.productVersion.update({
      where: { id: versionId },
      data: { fingerprint, updatedAt: new Date() },
      include: {
        specifications: {
          orderBy: [{ specKey: 'asc' }, { createdAt: 'asc' }],
        },
      },
    })
  }

  async list(userId: string, slug: string, rawQuery?: Record<string, unknown>) {
    const parsed = parseCatalogListQuery(rawQuery)
    return this.organizations.withWorkspace(userId, slug, async (tx, organizationId) => {
      const filterConditions: Prisma.ProductWhereInput[] = [{ organizationId }]
      if (parsed.status) filterConditions.push({ status: parsed.status })
      if (parsed.q) {
        filterConditions.push({
          OR: [
            { sku: { contains: parsed.q, mode: 'insensitive' } },
            { name: { contains: parsed.q, mode: 'insensitive' } },
            { brand: { contains: parsed.q, mode: 'insensitive' } },
            { category: { contains: parsed.q, mode: 'insensitive' } },
          ],
        })
      }
      const baseWhere: Prisma.ProductWhereInput =
        filterConditions.length === 1 ? filterConditions[0]! : { AND: filterConditions }

      const mapProduct = (product: {
        id: string
        organizationId: string
        sku: string
        name: string
        brand: string
        manufacturer: string | null
        category: string | null
        status: 'ACTIVE' | 'ARCHIVED'
        createdAt: Date
        updatedAt: Date
        versions: VersionWithSpecs[]
      }): ProductSummaryDto => {
        const formatted = product.versions.map(formatVersionDetail)
        const latest = formatted[0] ? toVersionSummary(formatted[0]) : null
        const publishedDetail = formatted.find((v) => v.status === 'PUBLISHED')
        const published = publishedDetail ? toVersionSummary(publishedDetail) : null
        return {
          id: product.id,
          organizationId: product.organizationId,
          sku: product.sku,
          name: product.name,
          brand: product.brand,
          manufacturer: product.manufacturer,
          category: product.category,
          status: product.status,
          createdAt: product.createdAt,
          updatedAt: product.updatedAt,
          versionCount: formatted.length,
          latestVersion: latest,
          publishedVersion: published,
        }
      }

      if (!parsed.paginated) {
        const rows = await tx.product.findMany({
          where: baseWhere,
          include: {
            versions: {
              orderBy: { versionNumber: 'desc' },
              include: {
                specifications: { orderBy: [{ specKey: 'asc' }, { createdAt: 'asc' }] },
              },
            },
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: parsed.limit,
        })
        return rows.map(mapProduct)
      }

      const where: Prisma.ProductWhereInput = parsed.cursor
        ? {
          AND: [
            baseWhere,
            {
              OR: [
                { createdAt: { lt: parsed.cursor.createdAt } },
                { createdAt: parsed.cursor.createdAt, id: { lt: parsed.cursor.id } },
              ],
            },
          ],
        }
        : baseWhere

      const [rows, total] = await Promise.all([
        tx.product.findMany({
          where,
          include: {
            versions: {
              orderBy: { versionNumber: 'desc' },
              include: {
                specifications: { orderBy: [{ specKey: 'asc' }, { createdAt: 'asc' }] },
              },
            },
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: parsed.limit + 1,
        }),
        tx.product.count({ where: baseWhere }),
      ])

      const hasMore = rows.length > parsed.limit
      const sliced = hasMore ? rows.slice(0, parsed.limit) : rows
      const items = sliced.map(mapProduct)
      const last = sliced[sliced.length - 1]
      const nextCursor =
        hasMore && last ? encodeCatalogCursor({ createdAt: last.createdAt, id: last.id }) : null
      return { items, nextCursor, total }
    })
  }

  async create(userId: string, slug: string, body: CreateProductDto): Promise<ProductDetailDto> {
    const input = productInput(body)
    return this.organizations.withWorkspace(userId, slug, async (tx, organizationId, role) => {
      assertCatalogWriter(role, 'tạo sản phẩm catalog')

      const duplicateActive = await tx.product.findFirst({
        where: {
          organizationId,
          status: 'ACTIVE',
          sku: { equals: input.sku, mode: 'insensitive' },
        },
        select: { id: true },
      })
      if (duplicateActive) {
        throw new ConflictException('Mã SKU đang hoạt động đã tồn tại trong tổ chức.')
      }

      const fingerprint = computeVersionFingerprint(input.modelCode, input.specifications)
      try {
        const created = await tx.product.create({
          data: {
            organizationId,
            sku: input.sku,
            name: input.name,
            brand: input.brand,
            manufacturer: input.manufacturer,
            category: input.category,
            status: 'ACTIVE',
            createdByUserId: userId,
            versions: {
              create: {
                versionNumber: 1,
                versionLabel: 'v1',
                modelCode: input.modelCode,
                status: 'DRAFT',
                fingerprint,
                notes: input.notes,
                createdByUserId: userId,
                specifications:
                  input.specifications.length > 0
                    ? {
                      create: input.specifications.map((spec) => ({
                        specKey: spec.specKey,
                        specValue: spec.specValue,
                        unit: spec.unit,
                        sourceLabel: spec.sourceLabel,
                        sourceQuote: spec.sourceQuote,
                        documentVersionId: spec.documentVersionId,
                      })),
                    }
                    : undefined,
              },
            },
          },
          include: {
            versions: {
              orderBy: { versionNumber: 'desc' },
              include: {
                specifications: { orderBy: [{ specKey: 'asc' }, { createdAt: 'asc' }] },
              },
            },
          },
        })

        await this.recordAudit(tx, {
          organizationId,
          actorUserId: userId,
          actorRole: role,
          action: 'CATALOG_PRODUCT_CREATED',
          summary: `Tạo sản phẩm catalog ${created.sku} — ${created.name} (v1 · ${input.modelCode})`,
          details: {
            productId: created.id,
            sku: created.sku,
            name: created.name,
            brand: created.brand,
            modelCode: input.modelCode,
          },
        })

        return this.formatProductDetail(created)
      } catch (error) {
        handleCatalogUnique(error, 'Mã SKU đang hoạt động đã tồn tại trong tổ chức.')
      }
    })
  }

  private formatProductDetail(product: {
    id: string
    organizationId: string
    sku: string
    name: string
    brand: string
    manufacturer: string | null
    category: string | null
    status: 'ACTIVE' | 'ARCHIVED'
    createdAt: Date
    updatedAt: Date
    versions: VersionWithSpecs[]
  }): ProductDetailDto {
    const versions = product.versions.map(formatVersionDetail)
    const latest = versions[0] ? toVersionSummary(versions[0]) : null
    const publishedDetail = versions.find((v) => v.status === 'PUBLISHED')
    const published = publishedDetail ? toVersionSummary(publishedDetail) : null
    return {
      id: product.id,
      organizationId: product.organizationId,
      sku: product.sku,
      name: product.name,
      brand: product.brand,
      manufacturer: product.manufacturer,
      category: product.category,
      status: product.status,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      versionCount: versions.length,
      latestVersion: latest,
      publishedVersion: published,
      versions,
    }
  }

  async detail(userId: string, slug: string, productId: string): Promise<ProductDetailDto> {
    return this.organizations.withWorkspace(userId, slug, async (tx, organizationId) => {
      const product = await tx.product.findFirst({
        where: { id: productId, organizationId },
        include: {
          versions: {
            orderBy: { versionNumber: 'desc' },
            include: {
              specifications: { orderBy: [{ specKey: 'asc' }, { createdAt: 'asc' }] },
            },
          },
        },
      })
      if (!product) throw new NotFoundException('Không tìm thấy sản phẩm trong catalog.')
      return this.formatProductDetail(product)
    })
  }

  async update(
    userId: string,
    slug: string,
    productId: string,
    body: UpdateProductDto,
  ): Promise<ProductDetailDto> {
    const patch = productPatchInput(body)
    return this.organizations.withWorkspace(userId, slug, async (tx, organizationId, role) => {
      assertCatalogWriter(role, 'cập nhật sản phẩm catalog')
      const current = await tx.product.findFirst({ where: { id: productId, organizationId } })
      if (!current) throw new NotFoundException('Không tìm thấy sản phẩm trong catalog.')

      const nextSku = patch.sku ?? current.sku
      const nextStatus = patch.status ?? current.status
      if (nextStatus === 'ACTIVE') {
        const duplicate = await tx.product.findFirst({
          where: {
            organizationId,
            status: 'ACTIVE',
            sku: { equals: nextSku, mode: 'insensitive' },
            id: { not: productId },
          },
          select: { id: true },
        })
        if (duplicate) {
          throw new ConflictException('Mã SKU đang hoạt động đã tồn tại trong tổ chức.')
        }
      }

      try {
        const updated = await tx.product.update({
          where: { id: productId },
          data: patch,
          include: {
            versions: {
              orderBy: { versionNumber: 'desc' },
              include: {
                specifications: { orderBy: [{ specKey: 'asc' }, { createdAt: 'asc' }] },
              },
            },
          },
        })
        await this.recordAudit(tx, {
          organizationId,
          actorUserId: userId,
          actorRole: role,
          action: 'CATALOG_PRODUCT_UPDATED',
          summary: `Cập nhật sản phẩm catalog ${updated.sku} — ${updated.name}`,
          details: { productId, patch },
        })
        return this.formatProductDetail(updated)
      } catch (error) {
        handleCatalogUnique(error, 'Mã SKU đang hoạt động đã tồn tại trong tổ chức.')
      }
    })
  }

  async createVersion(
    userId: string,
    slug: string,
    productId: string,
    body: CreateProductVersionDto,
  ): Promise<ProductVersionDetailDto> {
    const input = productVersionInput(body)
    return this.organizations.withWorkspace(userId, slug, async (tx, organizationId, role) => {
      assertCatalogWriter(role, 'tạo phiên bản sản phẩm')
      const product = await tx.product.findFirst({
        where: { id: productId, organizationId },
        include: {
          versions: {
            orderBy: { versionNumber: 'desc' },
            take: 1,
          },
        },
      })
      if (!product) throw new NotFoundException('Không tìm thấy sản phẩm trong catalog.')

      const nextVersionNumber = (product.versions[0]?.versionNumber ?? 0) + 1
      const versionLabel = input.versionLabel ?? `v${nextVersionNumber}`

      let clonedSpecs: Array<{
        specKey: string
        specValue: string
        unit: string | null
        sourceLabel: string
        sourceQuote: string | null
        documentVersionId: string | null
      }> = []

      if (input.cloneFromVersionId) {
        const sourceVersion = await tx.productVersion.findFirst({
          where: { id: input.cloneFromVersionId, productId, organizationId },
          include: {
            specifications: { orderBy: [{ specKey: 'asc' }, { createdAt: 'asc' }] },
          },
        })
        if (!sourceVersion) {
          throw new NotFoundException('Không tìm thấy phiên bản nguồn để sao chép.')
        }
        clonedSpecs = sourceVersion.specifications.map((spec) => ({
          specKey: spec.specKey,
          specValue: spec.specValue,
          unit: spec.unit,
          sourceLabel: spec.sourceLabel,
          sourceQuote: spec.sourceQuote,
          documentVersionId: spec.documentVersionId,
        }))
      }

      const mergedSpecs = [
        ...clonedSpecs,
        ...input.specifications.map((spec) => ({
          specKey: spec.specKey,
          specValue: spec.specValue,
          unit: spec.unit,
          sourceLabel: spec.sourceLabel,
          sourceQuote: spec.sourceQuote,
          documentVersionId: spec.documentVersionId,
        })),
      ]
      if (mergedSpecs.length > CATALOG_MAX_SPECS_PER_VERSION) {
        throw new BadRequestException(
          `Mỗi phiên bản sản phẩm hỗ trợ tối đa ${CATALOG_MAX_SPECS_PER_VERSION} thông số.`,
        )
      }

      const fingerprint = computeVersionFingerprint(input.modelCode, mergedSpecs)

      try {
        const created = await tx.productVersion.create({
          data: {
            organizationId,
            productId,
            versionNumber: nextVersionNumber,
            versionLabel,
            modelCode: input.modelCode,
            status: 'DRAFT',
            fingerprint,
            notes: input.notes,
            createdByUserId: userId,
            specifications:
              mergedSpecs.length > 0
                ? {
                  create: mergedSpecs.map((spec) => ({
                    specKey: spec.specKey,
                    specValue: spec.specValue,
                    unit: spec.unit,
                    sourceLabel: spec.sourceLabel,
                    sourceQuote: spec.sourceQuote,
                    documentVersionId: spec.documentVersionId,
                  })),
                }
                : undefined,
          },
          include: {
            specifications: { orderBy: [{ specKey: 'asc' }, { createdAt: 'asc' }] },
          },
        })

        await tx.product.update({
          where: { id: productId },
          data: { updatedAt: new Date() },
        })

        await this.recordAudit(tx, {
          organizationId,
          actorUserId: userId,
          actorRole: role,
          action: 'CATALOG_VERSION_CREATED',
          summary: `Tạo phiên bản ${created.versionLabel} (${created.modelCode}) cho sản phẩm ${product.sku}`,
          details: {
            productId,
            sku: product.sku,
            versionId: created.id,
            versionLabel: created.versionLabel,
            modelCode: created.modelCode,
            clonedFromVersionId: input.cloneFromVersionId ?? null,
          },
        })

        return formatVersionDetail(created)
      } catch (error) {
        handleCatalogUnique(error, 'Nhãn phiên bản đã tồn tại trên sản phẩm này.')
      }
    })
  }

  async getVersionById(
    userId: string,
    slug: string,
    versionId: string,
  ): Promise<ProductVersionDetailDto> {
    return this.organizations.withWorkspace(userId, slug, async (tx, organizationId) => {
      const version = await tx.productVersion.findFirst({
        where: { id: versionId, organizationId },
        include: {
          specifications: { orderBy: [{ specKey: 'asc' }, { createdAt: 'asc' }] },
        },
      })
      if (!version) throw new NotFoundException('Không tìm thấy phiên bản sản phẩm.')
      return formatVersionDetail(version)
    })
  }

  async updateVersion(
    userId: string,
    slug: string,
    productId: string,
    versionId: string,
    body: UpdateProductVersionDto,
  ): Promise<ProductVersionDetailDto> {
    const patch = productVersionPatchInput(body)
    return this.organizations.withWorkspace(userId, slug, async (tx, organizationId, role) => {
      assertCatalogWriter(role, 'cập nhật phiên bản sản phẩm')
      const current = await tx.productVersion.findFirst({
        where: { id: versionId, productId, organizationId },
        include: {
          specifications: { orderBy: [{ specKey: 'asc' }, { createdAt: 'asc' }] },
        },
      })
      if (!current) throw new NotFoundException('Không tìm thấy phiên bản sản phẩm.')
      assertDraftVersion(current.status)

      const nextModel = patch.modelCode ?? current.modelCode
      const fingerprint = computeVersionFingerprint(nextModel, current.specifications)

      const updated = await tx.productVersion.update({
        where: { id: versionId },
        data: {
          ...patch,
          fingerprint,
          updatedAt: new Date(),
        },
        include: {
          specifications: { orderBy: [{ specKey: 'asc' }, { createdAt: 'asc' }] },
        },
      })
      return formatVersionDetail(updated)
    })
  }

  async publishVersion(
    userId: string,
    slug: string,
    productId: string,
    versionId: string,
  ): Promise<ProductVersionDetailDto> {
    return this.organizations.withWorkspace(userId, slug, async (tx, organizationId, role) => {
      assertCatalogWriter(role, 'xuất bản phiên bản sản phẩm')
      const product = await tx.product.findFirst({
        where: { id: productId, organizationId },
        select: { id: true, sku: true, name: true },
      })
      if (!product) throw new NotFoundException('Không tìm thấy sản phẩm trong catalog.')

      const current = await tx.productVersion.findFirst({
        where: { id: versionId, productId, organizationId },
        include: {
          specifications: { orderBy: [{ specKey: 'asc' }, { createdAt: 'asc' }] },
        },
      })
      if (!current) throw new NotFoundException('Không tìm thấy phiên bản sản phẩm.')
      if (current.status === 'PUBLISHED') {
        return formatVersionDetail(current)
      }
      if (current.status === 'SUPERSEDED') {
        throw new ConflictException(
          'Phiên bản đã được thay thế không thể xuất bản lại. Vui lòng tạo phiên bản mới.',
        )
      }

      // Mark any previously published version of this product as SUPERSEDED (its snapshot remains readable by ID)
      await tx.productVersion.updateMany({
        where: {
          organizationId,
          productId,
          status: 'PUBLISHED',
          id: { not: versionId },
        },
        data: { status: 'SUPERSEDED', updatedAt: new Date() },
      })

      const fingerprint = computeVersionFingerprint(current.modelCode, current.specifications)
      const published = await tx.productVersion.update({
        where: { id: versionId },
        data: {
          status: 'PUBLISHED',
          fingerprint,
          publishedByUserId: userId,
          publishedAt: new Date(),
          updatedAt: new Date(),
        },
        include: {
          specifications: { orderBy: [{ specKey: 'asc' }, { createdAt: 'asc' }] },
        },
      })

      await tx.product.update({
        where: { id: productId },
        data: { updatedAt: new Date() },
      })

      await this.recordAudit(tx, {
        organizationId,
        actorUserId: userId,
        actorRole: role,
        action: 'CATALOG_VERSION_PUBLISHED',
        summary: `Xuất bản phiên bản ${published.versionLabel} (${published.modelCode}) của sản phẩm ${product.sku}`,
        details: {
          productId,
          sku: product.sku,
          versionId: published.id,
          versionLabel: published.versionLabel,
          modelCode: published.modelCode,
          fingerprint: published.fingerprint,
        },
      })

      return formatVersionDetail(published)
    })
  }

  async addSpecification(
    userId: string,
    slug: string,
    productId: string,
    versionId: string,
    body: CreateProductSpecDto,
  ): Promise<ProductVersionDetailDto> {
    const input = specInput(body)
    return this.organizations.withWorkspace(userId, slug, async (tx, organizationId, role) => {
      assertCatalogWriter(role, 'thêm thông số kỹ thuật')
      const version = await tx.productVersion.findFirst({
        where: { id: versionId, productId, organizationId },
        include: { _count: { select: { specifications: true } } },
      })
      if (!version) throw new NotFoundException('Không tìm thấy phiên bản sản phẩm.')
      assertDraftVersion(version.status)
      if (version._count.specifications >= CATALOG_MAX_SPECS_PER_VERSION) {
        throw new BadRequestException(
          `Mỗi phiên bản sản phẩm hỗ trợ tối đa ${CATALOG_MAX_SPECS_PER_VERSION} thông số.`,
        )
      }

      await tx.productSpecification.create({
        data: {
          organizationId,
          productVersionId: versionId,
          specKey: input.specKey,
          specValue: input.specValue,
          unit: input.unit,
          sourceLabel: input.sourceLabel,
          sourceQuote: input.sourceQuote,
          documentVersionId: input.documentVersionId,
        },
      })

      const updated = await this.refreshVersionFingerprint(
        tx,
        organizationId,
        versionId,
        version.modelCode,
      )
      return formatVersionDetail(updated)
    })
  }

  async updateSpecification(
    userId: string,
    slug: string,
    productId: string,
    versionId: string,
    specId: string,
    body: UpdateProductSpecDto,
  ): Promise<ProductVersionDetailDto> {
    const patch = specPatchInput(body)
    return this.organizations.withWorkspace(userId, slug, async (tx, organizationId, role) => {
      assertCatalogWriter(role, 'cập nhật thông số kỹ thuật')
      const version = await tx.productVersion.findFirst({
        where: { id: versionId, productId, organizationId },
      })
      if (!version) throw new NotFoundException('Không tìm thấy phiên bản sản phẩm.')
      assertDraftVersion(version.status)

      const spec = await tx.productSpecification.findFirst({
        where: { id: specId, productVersionId: versionId, organizationId },
      })
      if (!spec) throw new NotFoundException('Không tìm thấy thông số kỹ thuật.')

      await tx.productSpecification.update({
        where: { id: specId },
        data: patch,
      })

      const updated = await this.refreshVersionFingerprint(
        tx,
        organizationId,
        versionId,
        version.modelCode,
      )
      return formatVersionDetail(updated)
    })
  }

  async removeSpecification(
    userId: string,
    slug: string,
    productId: string,
    versionId: string,
    specId: string,
  ): Promise<ProductVersionDetailDto> {
    return this.organizations.withWorkspace(userId, slug, async (tx, organizationId, role) => {
      assertCatalogWriter(role, 'xóa thông số kỹ thuật')
      const version = await tx.productVersion.findFirst({
        where: { id: versionId, productId, organizationId },
      })
      if (!version) throw new NotFoundException('Không tìm thấy phiên bản sản phẩm.')
      assertDraftVersion(version.status)

      const spec = await tx.productSpecification.findFirst({
        where: { id: specId, productVersionId: versionId, organizationId },
      })
      if (!spec) throw new NotFoundException('Không tìm thấy thông số kỹ thuật.')

      await tx.productSpecification.delete({ where: { id: specId } })

      const updated = await this.refreshVersionFingerprint(
        tx,
        organizationId,
        versionId,
        version.modelCode,
      )
      return formatVersionDetail(updated)
    })
  }
}
