import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { DatabaseService } from '../../database/database.service'
import { OrganizationsService } from '../organizations/application/organizations.service'
import { itemInput, lotInput, tenderInput, type CreateItemDto, type CreateLotDto, type CreateTenderDto } from './tenders.dto'

const writers = new Set(['OWNER', 'ADMIN', 'BID_MANAGER'])
@Injectable()
export class TendersService {
  constructor(private readonly database: DatabaseService, private readonly organizations: OrganizationsService) {}
  async list(userId: string, slug: string) { return this.organizations.withWorkspace(userId, slug, async (tx, organizationId) => tx.tender.findMany({ where: { organizationId }, include: { _count: { select: { lots: true } } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] })) }
  async create(userId: string, slug: string, body: CreateTenderDto) { const input = tenderInput(body); return this.organizations.withWorkspace(userId, slug, async (tx, organizationId, role) => { if (!writers.has(role)) throw new ForbiddenException('Bạn không có quyền tạo hồ sơ.'); return tx.tender.create({ data: { ...input, organizationId, createdByUserId: userId } }) }) }
  async detail(userId: string, slug: string, id: string) { return this.organizations.withWorkspace(userId, slug, async (tx, organizationId) => { const tender = await tx.tender.findFirst({ where: { id, organizationId }, include: { lots: { include: { items: { orderBy: { itemNo: 'asc' } } }, orderBy: { code: 'asc' } } } }); if (!tender) throw new NotFoundException('Không tìm thấy hồ sơ.'); return tender }) }
  async addLot(userId: string, slug: string, tenderId: string, body: CreateLotDto) { const input = lotInput(body); return this.organizations.withWorkspace(userId, slug, async (tx, organizationId, role) => { if (!writers.has(role)) throw new ForbiddenException('Bạn không có quyền tạo lot.'); const tender = await tx.tender.findFirst({ where: { id: tenderId, organizationId } }); if (!tender) throw new NotFoundException('Không tìm thấy hồ sơ.'); try { return await tx.tenderLot.create({ data: { ...input, tenderId, organizationId } }) } catch { throw new ConflictException('Mã lot đã tồn tại trong hồ sơ.') } }) }
  async addItem(userId: string, slug: string, tenderId: string, lotId: string, body: CreateItemDto) { const input = itemInput(body); return this.organizations.withWorkspace(userId, slug, async (tx, organizationId, role) => { if (!writers.has(role)) throw new ForbiddenException('Bạn không có quyền tạo dòng hàng hóa.'); const lot = await tx.tenderLot.findFirst({ where: { id: lotId, tenderId, organizationId } }); if (!lot) throw new NotFoundException('Không tìm thấy lot.'); try { return await tx.tenderItem.create({ data: { ...input, lotId, organizationId } }) } catch { throw new ConflictException('STT đã tồn tại trong lot.') } }) }
}
