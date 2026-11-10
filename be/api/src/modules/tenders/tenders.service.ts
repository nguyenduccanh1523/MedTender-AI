import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { Prisma, type MembershipRole } from '../../database/generated/client'
import { DatabaseService } from '../../database/database.service'
import { CacheService } from '../cache/cache.service'
import { OrganizationsService } from '../organizations/application/organizations.service'
import {
  encodeTenderCursor,
  itemInput,
  itemPatchInput,
  lotInput,
  lotPatchInput,
  parseTenderAuditQuery,
  parseTenderListQuery,
  TENDER_MAX_ITEMS,
  TENDER_MAX_LOTS,
  tenderInput,
  tenderPatchInput,
  type CreateItemDto,
  type CreateLotDto,
  type CreateTenderDto,
  type UpdateItemDto,
  type UpdateLotDto,
  type UpdateTenderDto,
} from './tenders.dto'

const writers = new Set<MembershipRole>(['OWNER', 'ADMIN', 'BID_MANAGER'])
const auditViewers = new Set<MembershipRole>(['OWNER', 'ADMIN'])

function assertWriter(role: MembershipRole, action: string) {
  if (!writers.has(role)) throw new ForbiddenException(`Bạn không có quyền ${action}.`)
}

function assertAuditViewer(role: MembershipRole) {
  if (!auditViewers.has(role)) {
    throw new ForbiddenException('Chỉ OWNER và ADMIN mới có quyền xem nhật ký thay đổi.')
  }
}

function isUniqueError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
}

type AuditDraft = {
  organizationId: string
  tenderId?: string | null
  lotId?: string | null
  itemId?: string | null
  actorUserId: string
  actorRole: MembershipRole
  action: string
  summary: string
  details?: Prisma.InputJsonObject
}

@Injectable()
export class TendersService {
  constructor(
    private readonly database: DatabaseService,
    private readonly organizations: OrganizationsService,
    private readonly cache?: CacheService,
  ) {}

  private async recordAudit(tx: Prisma.TransactionClient, entry: AuditDraft) {
    await tx.tenderAuditLog.create({
      data: {
        organizationId: entry.organizationId,
        tenderId: entry.tenderId ?? null,
        lotId: entry.lotId ?? null,
        itemId: entry.itemId ?? null,
        actorUserId: entry.actorUserId,
        actorRole: entry.actorRole,
        action: entry.action,
        summary: entry.summary,
        details: entry.details ?? {},
      },
    })
    if (this.cache) {
      await this.cache.invalidatePrefix('tenders:')
    }
    if (typeof this.organizations.invalidateWorkspaceCache === 'function') {
      await this.organizations.invalidateWorkspaceCache(entry.organizationId)
    }
  }

  async list(userId: string, slug: string, rawQuery?: Record<string, unknown>) {
    const query = parseTenderListQuery(rawQuery)
    const cacheKey = `tenders:${slug}:${JSON.stringify(rawQuery || {})}`
    if (this.cache) {
      const cached = await this.cache.get<Record<string, unknown> | Array<Record<string, unknown>>>(cacheKey)
      if (cached) return cached as never
    }

    const result = await this.organizations.withWorkspace(userId, slug, async (tx, organizationId) => {
      const filters: Prisma.TenderWhereInput[] = [{ organizationId }]
      if (query.stage) filters.push({ procurementStage: query.stage })
      if (query.q) {
        filters.push({
          OR: [
            { title: { contains: query.q, mode: 'insensitive' } },
            { reference: { contains: query.q, mode: 'insensitive' } },
          ],
        })
      }
      const baseWhere: Prisma.TenderWhereInput = filters.length === 1 ? filters[0] : { AND: filters }

      const pageWhere: Prisma.TenderWhereInput = query.cursor
        ? {
          AND: [
            baseWhere,
            {
              OR: [
                { createdAt: { lt: query.cursor.createdAt } },
                { createdAt: query.cursor.createdAt, id: { lt: query.cursor.id } },
              ],
            },
          ],
        }
        : baseWhere

      const rows = await tx.tender.findMany({
        where: pageWhere,
        include: {
          _count: { select: { lots: true } },
          lots: { select: { _count: { select: { items: true } } } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: query.paginated ? query.limit + 1 : undefined,
      })

      const mapRow = (row: (typeof rows)[number]) => ({
        id: row.id,
        organizationId: row.organizationId,
        title: row.title,
        reference: row.reference,
        procurementStage: row.procurementStage,
        createdByUserId: row.createdByUserId,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        _count: {
          lots: row._count.lots,
          items: row.lots.reduce((sum, lot) => sum + lot._count.items, 0),
        },
      })

      if (!query.paginated) {
        return rows.map(mapRow)
      }

      const hasMore = rows.length > query.limit
      const slice = hasMore ? rows.slice(0, query.limit) : rows
      const items = slice.map(mapRow)
      const last = slice[slice.length - 1]
      const total = await tx.tender.count({ where: baseWhere })

      return {
        items,
        nextCursor: hasMore && last ? encodeTenderCursor(last) : null,
        total,
      }
    })

    if (this.cache) {
      await this.cache.set(cacheKey, result, 30)
    }
    return result
  }

  async create(userId: string, slug: string, body: CreateTenderDto) {
    const input = tenderInput(body)
    return this.organizations.withWorkspace(userId, slug, async (tx, organizationId, role) => {
      assertWriter(role, 'tạo hồ sơ')
      const created = await tx.tender.create({
        data: { ...input, organizationId, createdByUserId: userId },
      })
      await this.recordAudit(tx, {
        organizationId,
        tenderId: created.id,
        actorUserId: userId,
        actorRole: role,
        action: 'TENDER_CREATED',
        summary: `Tạo hồ sơ "${created.title}" (${created.procurementStage})`,
        details: {
          title: created.title,
          reference: created.reference,
          procurementStage: created.procurementStage,
        },
      })
      return created
    })
  }

  async detail(userId: string, slug: string, id: string) {
    return this.organizations.withWorkspace(userId, slug, async (tx, organizationId) => {
      const tender = await tx.tender.findFirst({
        where: { id, organizationId },
        include: {
          lots: {
            include: { items: { orderBy: [{ itemNo: 'asc' }, { id: 'asc' }] } },
            orderBy: [{ code: 'asc' }, { id: 'asc' }],
          },
        },
      })
      if (!tender) throw new NotFoundException('Không tìm thấy hồ sơ.')
      return tender
    })
  }

  async update(userId: string, slug: string, id: string, body: UpdateTenderDto) {
    const patch = tenderPatchInput(body)
    return this.organizations.withWorkspace(userId, slug, async (tx, organizationId, role) => {
      assertWriter(role, 'cập nhật hồ sơ')
      const current = await tx.tender.findFirst({ where: { id, organizationId } })
      if (!current) throw new NotFoundException('Không tìm thấy hồ sơ.')

      const updated = await tx.tender.update({
        where: { id },
        data: patch,
      })
      await this.recordAudit(tx, {
        organizationId,
        tenderId: updated.id,
        actorUserId: userId,
        actorRole: role,
        action: 'TENDER_UPDATED',
        summary: `Cập nhật hồ sơ "${updated.title}"`,
        details: {
          before: {
            title: current.title,
            reference: current.reference,
            procurementStage: current.procurementStage,
          },
          after: {
            title: updated.title,
            reference: updated.reference,
            procurementStage: updated.procurementStage,
          },
        },
      })
      return updated
    })
  }

  async remove(userId: string, slug: string, id: string) {
    return this.organizations.withWorkspace(userId, slug, async (tx, organizationId, role) => {
      assertWriter(role, 'xóa hồ sơ')
      const current = await tx.tender.findFirst({
        where: { id, organizationId },
        include: { _count: { select: { lots: true } } },
      })
      if (!current) throw new NotFoundException('Không tìm thấy hồ sơ.')

      await tx.tender.delete({ where: { id } })
      await this.recordAudit(tx, {
        organizationId,
        tenderId: current.id,
        actorUserId: userId,
        actorRole: role,
        action: 'TENDER_DELETED',
        summary: `Xóa hồ sơ "${current.title}"`,
        details: {
          title: current.title,
          reference: current.reference,
          procurementStage: current.procurementStage,
          lotsRemoved: current._count.lots,
        },
      })
    })
  }

  async addLot(userId: string, slug: string, tenderId: string, body: CreateLotDto) {
    const input = lotInput(body)
    return this.organizations.withWorkspace(userId, slug, async (tx, organizationId, role) => {
      assertWriter(role, 'tạo lot')
      const tender = await tx.tender.findFirst({
        where: { id: tenderId, organizationId },
        include: { _count: { select: { lots: true } } },
      })
      if (!tender) throw new NotFoundException('Không tìm thấy hồ sơ.')
      if (tender._count.lots >= TENDER_MAX_LOTS) {
        throw new BadRequestException(`Mỗi hồ sơ chỉ được tối đa ${TENDER_MAX_LOTS} lot ở giai đoạn P0.`)
      }
      try {
        const created = await tx.tenderLot.create({
          data: { ...input, tenderId, organizationId },
        })
        await tx.tender.update({ where: { id: tenderId }, data: { updatedAt: new Date() } })
        await this.recordAudit(tx, {
          organizationId,
          tenderId,
          lotId: created.id,
          actorUserId: userId,
          actorRole: role,
          action: 'LOT_CREATED',
          summary: `Thêm lot ${created.code} — ${created.name}`,
          details: { code: created.code, name: created.name },
        })
        return created
      } catch (error) {
        if (isUniqueError(error)) throw new ConflictException('Mã lot đã tồn tại trong hồ sơ.')
        throw error
      }
    })
  }

  async updateLot(userId: string, slug: string, tenderId: string, lotId: string, body: UpdateLotDto) {
    const patch = lotPatchInput(body)
    return this.organizations.withWorkspace(userId, slug, async (tx, organizationId, role) => {
      assertWriter(role, 'cập nhật lot')
      const current = await tx.tenderLot.findFirst({
        where: { id: lotId, tenderId, organizationId },
      })
      if (!current) throw new NotFoundException('Không tìm thấy lot.')
      try {
        const updated = await tx.tenderLot.update({
          where: { id: lotId },
          data: patch,
        })
        await tx.tender.update({ where: { id: tenderId }, data: { updatedAt: new Date() } })
        await this.recordAudit(tx, {
          organizationId,
          tenderId,
          lotId: updated.id,
          actorUserId: userId,
          actorRole: role,
          action: 'LOT_UPDATED',
          summary: `Cập nhật lot ${updated.code} — ${updated.name}`,
          details: {
            before: { code: current.code, name: current.name },
            after: { code: updated.code, name: updated.name },
          },
        })
        return updated
      } catch (error) {
        if (isUniqueError(error)) throw new ConflictException('Mã lot đã tồn tại trong hồ sơ.')
        throw error
      }
    })
  }

  async removeLot(userId: string, slug: string, tenderId: string, lotId: string) {
    return this.organizations.withWorkspace(userId, slug, async (tx, organizationId, role) => {
      assertWriter(role, 'xóa lot')
      const current = await tx.tenderLot.findFirst({
        where: { id: lotId, tenderId, organizationId },
        include: { _count: { select: { items: true } } },
      })
      if (!current) throw new NotFoundException('Không tìm thấy lot.')
      await tx.tenderLot.delete({ where: { id: lotId } })
      await tx.tender.update({ where: { id: tenderId }, data: { updatedAt: new Date() } })
      await this.recordAudit(tx, {
        organizationId,
        tenderId,
        lotId: current.id,
        actorUserId: userId,
        actorRole: role,
        action: 'LOT_DELETED',
        summary: `Xóa lot ${current.code} — ${current.name}`,
        details: { code: current.code, name: current.name, itemsRemoved: current._count.items },
      })
    })
  }

  async addItem(userId: string, slug: string, tenderId: string, lotId: string, body: CreateItemDto) {
    const input = itemInput(body)
    return this.organizations.withWorkspace(userId, slug, async (tx, organizationId, role) => {
      assertWriter(role, 'tạo dòng hàng hóa')
      const lot = await tx.tenderLot.findFirst({
        where: { id: lotId, tenderId, organizationId },
      })
      if (!lot) throw new NotFoundException('Không tìm thấy lot.')
      const totalItems = await tx.tenderItem.count({
        where: { organizationId, lot: { tenderId } },
      })
      if (totalItems >= TENDER_MAX_ITEMS) {
        throw new BadRequestException(`Mỗi hồ sơ chỉ được tối đa ${TENDER_MAX_ITEMS} dòng hàng hóa ở giai đoạn P0.`)
      }
      try {
        const created = await tx.tenderItem.create({
          data: { ...input, lotId, organizationId },
        })
        await tx.tender.update({ where: { id: tenderId }, data: { updatedAt: new Date() } })
        await this.recordAudit(tx, {
          organizationId,
          tenderId,
          lotId,
          itemId: created.id,
          actorUserId: userId,
          actorRole: role,
          action: 'ITEM_CREATED',
          summary: `Thêm dòng hàng hóa #${created.itemNo} (${created.name}) vào ${lot.code}`,
          details: {
            lotCode: lot.code,
            itemNo: created.itemNo,
            name: created.name,
            quantity: created.quantity.toString(),
            unit: created.unit,
          },
        })
        return created
      } catch (error) {
        if (isUniqueError(error)) throw new ConflictException('STT đã tồn tại trong lot.')
        throw error
      }
    })
  }

  async updateItem(
    userId: string,
    slug: string,
    tenderId: string,
    lotId: string,
    itemId: string,
    body: UpdateItemDto,
  ) {
    const patch = itemPatchInput(body)
    return this.organizations.withWorkspace(userId, slug, async (tx, organizationId, role) => {
      assertWriter(role, 'cập nhật dòng hàng hóa')
      const lot = await tx.tenderLot.findFirst({ where: { id: lotId, tenderId, organizationId } })
      if (!lot) throw new NotFoundException('Không tìm thấy lot.')
      const current = await tx.tenderItem.findFirst({ where: { id: itemId, lotId, organizationId } })
      if (!current) throw new NotFoundException('Không tìm thấy dòng hàng hóa.')
      try {
        const updated = await tx.tenderItem.update({
          where: { id: itemId },
          data: patch,
        })
        await tx.tender.update({ where: { id: tenderId }, data: { updatedAt: new Date() } })
        await this.recordAudit(tx, {
          organizationId,
          tenderId,
          lotId,
          itemId: updated.id,
          actorUserId: userId,
          actorRole: role,
          action: 'ITEM_UPDATED',
          summary: `Cập nhật dòng hàng hóa #${updated.itemNo} (${updated.name}) trong ${lot.code}`,
          details: {
            lotCode: lot.code,
            before: {
              itemNo: current.itemNo,
              name: current.name,
              quantity: current.quantity.toString(),
              unit: current.unit,
              description: current.description,
            },
            after: {
              itemNo: updated.itemNo,
              name: updated.name,
              quantity: updated.quantity.toString(),
              unit: updated.unit,
              description: updated.description,
            },
          },
        })
        return updated
      } catch (error) {
        if (isUniqueError(error)) throw new ConflictException('STT đã tồn tại trong lot.')
        throw error
      }
    })
  }

  async removeItem(userId: string, slug: string, tenderId: string, lotId: string, itemId: string) {
    return this.organizations.withWorkspace(userId, slug, async (tx, organizationId, role) => {
      assertWriter(role, 'xóa dòng hàng hóa')
      const lot = await tx.tenderLot.findFirst({ where: { id: lotId, tenderId, organizationId } })
      if (!lot) throw new NotFoundException('Không tìm thấy lot.')
      const current = await tx.tenderItem.findFirst({ where: { id: itemId, lotId, organizationId } })
      if (!current) throw new NotFoundException('Không tìm thấy dòng hàng hóa.')
      await tx.tenderItem.delete({ where: { id: itemId } })
      await tx.tender.update({ where: { id: tenderId }, data: { updatedAt: new Date() } })
      await this.recordAudit(tx, {
        organizationId,
        tenderId,
        lotId,
        itemId: current.id,
        actorUserId: userId,
        actorRole: role,
        action: 'ITEM_DELETED',
        summary: `Xóa dòng hàng hóa #${current.itemNo} (${current.name}) khỏi ${lot.code}`,
        details: {
          lotCode: lot.code,
          itemNo: current.itemNo,
          name: current.name,
          quantity: current.quantity.toString(),
          unit: current.unit,
        },
      })
    })
  }

  async listAudits(
    userId: string,
    slug: string,
    tenderId: string,
    rawQuery?: Record<string, unknown> | string,
  ) {
    const parsed = parseTenderAuditQuery(rawQuery)
    return this.organizations.withWorkspace(userId, slug, async (tx, organizationId, role) => {
      assertAuditViewer(role)
      const tender = await tx.tender.findFirst({ where: { id: tenderId, organizationId }, select: { id: true } })
      if (!tender) throw new NotFoundException('Không tìm thấy hồ sơ.')

      const actionFilter: Prisma.StringFilter | string | undefined =
        parsed.action === 'TENDER' || parsed.action === 'LOT' || parsed.action === 'ITEM'
          ? { startsWith: `${parsed.action}_` }
          : parsed.action

      const baseWhere: Prisma.TenderAuditLogWhereInput = {
        organizationId,
        tenderId,
        ...(actionFilter ? { action: actionFilter } : {}),
      }

      if (!parsed.paginated) {
        const logs = await tx.tenderAuditLog.findMany({
          where: baseWhere,
          include: { actor: { select: { displayName: true } } },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: parsed.limit,
        })
        return logs.map(({ actor, ...entry }) => ({
          ...entry,
          actorName: actor.displayName,
        }))
      }

      const where: Prisma.TenderAuditLogWhereInput = parsed.cursor
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

      const rows = await tx.tenderAuditLog.findMany({
        where,
        include: { actor: { select: { displayName: true } } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: parsed.limit + 1,
      })
      const total = await tx.tenderAuditLog.count({ where: baseWhere })

      const hasMore = rows.length > parsed.limit
      const sliced = hasMore ? rows.slice(0, parsed.limit) : rows
      const items = sliced.map(({ actor, ...entry }) => ({
        ...entry,
        actorName: actor.displayName,
      }))
      const last = sliced[sliced.length - 1]
      const nextCursor = hasMore && last ? encodeTenderCursor({ createdAt: last.createdAt, id: last.id }) : null
      return {
        items,
        nextCursor,
        total,
        limit: parsed.limit,
      }
    })
  }
}
