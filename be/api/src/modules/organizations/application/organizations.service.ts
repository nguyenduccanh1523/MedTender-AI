import { randomBytes, randomUUID } from 'node:crypto'
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'

import { DatabaseService } from '../../../database/database.service'
import {
  MembershipRole,
  MembershipStatus,
  Prisma,
} from '../../../database/generated/client'
import { setTenantUserContext, TenantAccessDeniedError, withTenantWorkspaceTransaction } from '../../../database/tenant-transaction'
import { enrichSpecificationsWithConflicts } from '../../catalog/catalog.dto'
import {
  organizationName,
  type OrganizationGovernanceDto,
  type OrganizationGovernanceSettingsDto,
  type UpdateOrganizationGovernanceDto,
  type UpdateOrganizationMemberDto,
  type WorkspaceActivityDto,
  type WorkspaceTimelineItemDto,
  type WorkspaceWorkQueueItemDto,
} from '../presentation/http/organizations.dto'

const orgFields = { id: true, slug: true, name: true } as const

function parseGovernanceSettings(raw: unknown): OrganizationGovernanceSettingsDto {
  const obj = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
  const classification =
    obj.defaultDataClassification === 'INTERNAL' ||
    obj.defaultDataClassification === 'CONFIDENTIAL' ||
    obj.defaultDataClassification === 'RESTRICTED'
      ? obj.defaultDataClassification
      : 'CONFIDENTIAL'
  return {
    requireIndependentReviewer:
      typeof obj.requireIndependentReviewer === 'boolean' ? obj.requireIndependentReviewer : true,
    externalAiPolicy: 'OFF',
    defaultDataClassification: classification,
    maxLotsPerTender: 20,
    maxItemsPerTender: 100,
    maxSpecsPerVersion: 200,
  }
}

@Injectable()
export class OrganizationsService {
  constructor(private readonly database: DatabaseService) {}

  async list(userId: string) {
    return this.database.db.$transaction(async (tx) => {
      await setTenantUserContext(tx, userId)
      const memberships = await tx.organizationMembership.findMany({
        where: { userId, status: 'ACTIVE', organization: { status: 'ACTIVE' } },
        select: { role: true, organization: { select: orgFields } },
        orderBy: [{ joinedAt: 'asc' }, { id: 'asc' }],
      })
      return memberships.map(({ organization, role }) => ({ ...organization, role }))
    })
  }

  async create(userId: string, name: string) {
    const id = randomUUID()
    const base = name.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/đ/g, 'd')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48)
    const slug = `${base || 'to-chuc'}-${randomBytes(5).toString('hex')}`

    try {
      return await this.database.db.$transaction(async (tx) => {
        await setTenantUserContext(tx, userId)
        await tx.$queryRaw`SELECT set_config('app.provisioning_org_id', ${id}, true)`
        const org = await tx.organization.create({
          data: { id, name, slug, createdByUserId: userId },
          select: orgFields,
        })
        await tx.organizationMembership.create({ data: { userId, organizationId: id, role: 'OWNER' } })
        return { ...org, role: 'OWNER' as const }
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Chưa tạo được định danh tổ chức. Vui lòng thử lại.')
      }
      throw error
    }
  }

  async get(userId: string, slug: string) {
    return this.withWorkspace(userId, slug, async (tx, id, role) => ({
      ...(await tx.organization.findUniqueOrThrow({ where: { id }, select: orgFields })),
      role,
    }))
  }

  async members(userId: string, slug: string) {
    return this.withWorkspace(userId, slug, async (tx, id, role) => {
      if (role !== 'OWNER' && role !== 'ADMIN') {
        throw new ForbiddenException('Bạn không có quyền xem danh sách thành viên.')
      }
      const memberships = await tx.organizationMembership.findMany({
        where: { organizationId: id },
        select: { userId: true, role: true, status: true, user: { select: { displayName: true } } },
        orderBy: [{ joinedAt: 'asc' }, { id: 'asc' }],
      })
      return memberships.map(({ user, ...membership }) => ({ ...membership, name: user.displayName }))
    })
  }

  async activity(userId: string, slug: string): Promise<WorkspaceActivityDto> {
    return this.withWorkspace(userId, slug, async (tx, organizationId, role) => {
      const canSeeTeam = role === 'OWNER' || role === 'ADMIN'
      const [
        tenders,
        lotsCount,
        itemsCount,
        products,
        membersCount,
        pendingInvitationsCount,
        auditRows,
      ] = await Promise.all([
        tx.tender.findMany({
          where: { organizationId },
          orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
          take: 15,
          include: {
            _count: { select: { lots: true } },
            lots: { select: { _count: { select: { items: true } } } },
          },
        }),
        tx.tenderLot.count({ where: { organizationId } }),
        tx.tenderItem.count({ where: { organizationId } }),
        tx.product.findMany({
          where: { organizationId },
          orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
          take: 25,
          include: {
            versions: {
              orderBy: { versionNumber: 'desc' },
              include: { specifications: true },
            },
          },
        }),
        canSeeTeam ? tx.organizationMembership.count({ where: { organizationId, status: 'ACTIVE' } }) : Promise.resolve(null),
        canSeeTeam
          ? tx.organizationInvitation.count({
            where: {
              organizationId,
              acceptedAt: null,
              revokedAt: null,
              expiresAt: { gt: new Date() },
            },
          })
          : Promise.resolve(null),
        tx.tenderAuditLog.findMany({
          where: { organizationId },
          include: { actor: { select: { displayName: true } } },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: 20,
        }),
      ])

      const tendersCount = await tx.tender.count({ where: { organizationId } })
      const productsCount = await tx.product.count({ where: { organizationId, status: 'ACTIVE' } })

      let publishedVersionsCount = 0
      let draftVersionsCount = 0
      let conflictingSpecsCount = 0

      for (const product of products) {
        for (const version of product.versions) {
          if (version.status === 'PUBLISHED') publishedVersionsCount += 1
          if (version.status === 'DRAFT') draftVersionsCount += 1
          const { conflictCount } = enrichSpecificationsWithConflicts(version.specifications)
          conflictingSpecsCount += conflictCount
        }
      }

      const workQueue: WorkspaceWorkQueueItemDto[] = []

      if (role === 'OWNER') {
        workQueue.push({
          id: 'owner-governance',
          category: 'QUẢN TRỊ TỔ CHỨC (OWNER)',
          priority: 'HIGH',
          title: 'Kiểm soát chính sách tổ chức, phân quyền ADMIN và sổ cái kiểm toán',
          description:
            'Chỉ OWNER mới có quyền điều chỉnh cấu hình pháp nhân, nâng/hạ quyền ADMIN và giám sát toàn bộ nhật ký kiểm toán.',
          href: `/${slug}/quan-tri-to-chuc`,
          ctaLabel: 'Mở Quản trị tổ chức',
          meta: `${membersCount ?? 1} thành viên · External AI: OFF`,
        })
      }

      if ((role === 'OWNER' || role === 'ADMIN') && (pendingInvitationsCount ?? 0) > 0) {
        workQueue.push({
          id: 'team-pending-invites',
          category: 'ĐỘI NGŨ & PHÂN QUYỀN',
          priority: 'MEDIUM',
          title: `${pendingInvitationsCount} lời mời thành viên đang chờ xác nhận`,
          description: 'Theo dõi các lời mời chưa nhận hoặc thu hồi lời mời đã hết nhu cầu sử dụng.',
          href: `/${slug}/thanh-vien`,
          ctaLabel: 'Quản lý lời mời',
          meta: `${pendingInvitationsCount} lời mời chờ`,
        })
      }

      if (role === 'BID_MANAGER' || role === 'OWNER' || role === 'ADMIN') {
        const incompleteTenders = tenders.filter((tender) => {
          const itemTotal = tender.lots.reduce((sum, lot) => sum + lot._count.items, 0)
          return tender._count.lots === 0 || itemTotal === 0
        })
        if (incompleteTenders.length > 0) {
          const first = incompleteTenders[0]!
          workQueue.push({
            id: `tender-incomplete-${first.id}`,
            category: 'ĐIỀU PHỐI HỒ SƠ THẦU',
            priority: 'HIGH',
            title: `Hoàn thiện cấu trúc lot & hàng hóa cho "${first.title}"`,
            description:
              incompleteTenders.length > 1
                ? `Có ${incompleteTenders.length} hồ sơ thầu chưa đủ lot hoặc dòng hàng hóa để sẵn sàng phân tích.`
                : 'Hồ sơ này chưa có đủ lot hoặc dòng hàng hóa. Hãy bổ sung để chuẩn bị đối chiếu.',
            href: `/${slug}/tenders/${first.id}`,
            ctaLabel: 'Cập nhật hồ sơ',
            meta: `${first.procurementStage} · ${first._count.lots} lot`,
          })
        } else if (tenders.length === 0) {
          workQueue.push({
            id: 'tender-create-first',
            category: 'ĐIỀU PHỐI HỒ SƠ THẦU',
            priority: 'HIGH',
            title: 'Khởi tạo hồ sơ mua sắm (RFQ / E-HSMT / Nội bộ) đầu tiên',
            description: 'Tạo cấu trúc lot và danh mục thiết bị cần mua sắm cho tổ chức.',
            href: `/${slug}/tenders/new`,
            ctaLabel: 'Tạo hồ sơ thầu',
            meta: 'Bước 03 · Hồ sơ thầu',
          })
        }
      }

      if (role === 'CATALOG_MANAGER' || role === 'OWNER' || role === 'ADMIN') {
        if (conflictingSpecsCount > 0) {
          workQueue.push({
            id: 'catalog-conflicts',
            category: 'CHẤT LƯỢNG CATALOG',
            priority: 'HIGH',
            title: `Rà soát ${conflictingSpecsCount} thông số kỹ thuật có mâu thuẫn giữa các nguồn`,
            description:
              'Hệ thống phát hiện cùng một thông số có nhiều giá trị khác nhau từ các nguồn tài liệu khác nhau.',
            href: `/${slug}/catalog`,
            ctaLabel: 'Rà soát thông số',
            meta: `${conflictingSpecsCount} thông số đa nguồn`,
          })
        }
        if (draftVersionsCount > 0) {
          workQueue.push({
            id: 'catalog-draft-versions',
            category: 'PHIÊN BẢN SẢN PHẨM',
            priority: 'MEDIUM',
            title: `${draftVersionsCount} phiên bản sản phẩm đang ở trạng thái Nháp (DRAFT)`,
            description:
              'Kiểm tra model, fingerprint và xuất bản phiên bản sản phẩm để khóa bất biến phục vụ đối chiếu.',
            href: `/${slug}/catalog`,
            ctaLabel: 'Mở Catalog thiết bị',
            meta: `${publishedVersionsCount} đã xuất bản · ${draftVersionsCount} nháp`,
          })
        } else if (productsCount === 0) {
          workQueue.push({
            id: 'catalog-create-first',
            category: 'DANH MỤC THIẾT BỊ',
            priority: 'HIGH',
            title: 'Tạo sản phẩm và phiên bản kỹ thuật v1 đầu tiên trong Catalog',
            description: 'Nhập SKU, hãng sản xuất, model và bảng thông số kỹ thuật kèm nguồn.',
            href: `/${slug}/catalog`,
            ctaLabel: 'Thêm sản phẩm',
            meta: 'Bước 04 · Catalog',
          })
        }
      }

      if (role === 'ANALYST') {
        const readyTenders = tenders.filter(
          (t) => t.lots.reduce((sum, lot) => sum + lot._count.items, 0) > 0,
        )
        workQueue.push({
          id: 'analyst-ready-tenders',
          category: 'PHÂN TÍCH & ĐỐI CHIẾU',
          priority: readyTenders.length > 0 ? 'HIGH' : 'INFO',
          title:
            readyTenders.length > 0
              ? `${readyTenders.length} hồ sơ thầu đã có danh mục hàng hóa để chuẩn bị đối chiếu`
              : 'Theo dõi danh sách hồ sơ thầu nguồn',
          description: `Hiện có ${itemsCount} dòng hàng hóa trên ${lotsCount} lot và ${publishedVersionsCount} phiên bản thiết bị đã xuất bản trong catalog.`,
          href: readyTenders[0] ? `/${slug}/tenders/${readyTenders[0].id}` : `/${slug}/tenders`,
          ctaLabel: 'Mở hồ sơ nguồn',
          meta: `${itemsCount} dòng hàng hóa · ${publishedVersionsCount} version catalog`,
        })
        workQueue.push({
          id: 'analyst-catalog-lookup',
          category: 'TRA CỨU ỨNG VIÊN CATALOG',
          priority: 'MEDIUM',
          title: 'Kiểm tra phiên bản sản phẩm đã xuất bản và thông số đa nguồn',
          description:
            'Tra cứu các phiên bản thiết bị đã khóa fingerprint và đối chiếu các thông số kỹ thuật trước khi chạy phân tích.',
          href: `/${slug}/catalog`,
          ctaLabel: 'Tra cứu Catalog',
          meta: `${productsCount} sản phẩm · ${conflictingSpecsCount} xung đột nguồn`,
        })
      }

      if (role === 'REVIEWER') {
        workQueue.push({
          id: 'reviewer-evidence-prep',
          category: 'RÀ SOÁT ĐỘC LẬP (INDEPENDENT REVIEW)',
          priority: conflictingSpecsCount > 0 ? 'HIGH' : 'MEDIUM',
          title:
            conflictingSpecsCount > 0
              ? `Lưu ý ${conflictingSpecsCount} thông số kỹ thuật có nhiều nguồn khác nhau trong Catalog`
              : 'Nắm bối cảnh hồ sơ thầu và các phiên bản sản phẩm đã xuất bản',
          description:
            'Quy tắc P0 yêu cầu Reviewer độc lập kiểm tra nguồn thông số và không tự duyệt hồ sơ do chính mình tạo/sửa.',
          href: `/${slug}/catalog`,
          ctaLabel: 'Kiểm tra nguồn Catalog',
          meta: `${publishedVersionsCount} version đã khóa · ${tendersCount} hồ sơ thầu`,
        })
        if (tenders[0]) {
          workQueue.push({
            id: `reviewer-tender-${tenders[0].id}`,
            category: 'BỐI CẢNH HỒ SƠ MỚI NHẤT',
            priority: 'INFO',
            title: `Xem cấu trúc "${tenders[0].title}"`,
            description: 'Đọc danh mục lot và dòng hàng hóa gốc trước khi mở hàng chờ phê duyệt analysis.',
            href: `/${slug}/tenders/${tenders[0].id}`,
            ctaLabel: 'Xem hồ sơ thầu',
            meta: `${tenders[0].procurementStage} · ${tenders[0]._count.lots} lot`,
          })
        }
      }

      if (role === 'VIEWER') {
        workQueue.push({
          id: 'viewer-tenders',
          category: 'THEO DÕI TIẾN ĐỘ (CHẾ ĐỘ CHỈ ĐỌC)',
          priority: 'INFO',
          title: `Theo dõi ${tendersCount} hồ sơ thầu và ${productsCount} thiết bị trong tổ chức`,
          description:
            'Tài khoản Viewer được xem tiến độ hồ sơ mua sắm và các phiên bản thiết bị đã công bố theo phân quyền.',
          href: `/${slug}/tenders`,
          ctaLabel: 'Xem danh sách hồ sơ',
          meta: `${tendersCount} hồ sơ · ${lotsCount} lot · ${itemsCount} mục`,
        })
      }

      const timeline: WorkspaceTimelineItemDto[] = auditRows
        .filter((row) => {
          if (canSeeTeam) return true
          return !row.action.startsWith('ORG_')
        })
        .slice(0, 12)
        .map((row) => ({
          id: row.id,
          action: row.action,
          summary: row.summary,
          actorName: row.actor.displayName,
          actorRole: row.actorRole,
          createdAt: row.createdAt,
          href: row.tenderId
            ? `/${slug}/tenders/${row.tenderId}`
            : row.action.startsWith('CATALOG_')
              ? `/${slug}/catalog`
              : null,
        }))

      return {
        role,
        metrics: {
          tendersCount,
          lotsCount,
          itemsCount,
          productsCount,
          publishedVersionsCount,
          draftVersionsCount,
          conflictingSpecsCount,
          membersCount,
          pendingInvitationsCount,
        },
        workQueue,
        timeline,
      }
    })
  }

  async governance(userId: string, slug: string): Promise<OrganizationGovernanceDto> {
    return this.withWorkspace(userId, slug, async (tx, organizationId, role) => {
      if (role !== 'OWNER') {
        throw new ForbiddenException(
          'Chỉ Chủ sở hữu tổ chức (OWNER) mới có quyền truy cập Quản trị tổ chức.',
        )
      }
      const [org, memberships, auditRows] = await Promise.all([
        tx.organization.findUniqueOrThrow({
          where: { id: organizationId },
          select: {
            id: true,
            slug: true,
            name: true,
            status: true,
            settings: true,
            createdAt: true,
          },
        }),
        tx.organizationMembership.findMany({
          where: { organizationId },
          select: {
            userId: true,
            role: true,
            status: true,
            user: { select: { displayName: true } },
          },
          orderBy: [{ joinedAt: 'asc' }, { id: 'asc' }],
        }),
        tx.tenderAuditLog.findMany({
          where: { organizationId },
          include: { actor: { select: { displayName: true } } },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: 25,
        }),
      ])

      return {
        id: org.id,
        slug: org.slug,
        name: org.name,
        status: org.status,
        createdAt: org.createdAt,
        settings: parseGovernanceSettings(org.settings),
        members: memberships.map(({ user, ...m }) => ({ ...m, name: user.displayName })),
        recentAudits: auditRows.map((row) => ({
          id: row.id,
          action: row.action,
          summary: row.summary,
          actorName: row.actor.displayName,
          actorRole: row.actorRole,
          createdAt: row.createdAt,
          href: row.tenderId
            ? `/${slug}/tenders/${row.tenderId}`
            : row.action.startsWith('CATALOG_')
              ? `/${slug}/catalog`
              : null,
        })),
      }
    })
  }

  async updateGovernance(
    userId: string,
    slug: string,
    body: UpdateOrganizationGovernanceDto,
  ): Promise<OrganizationGovernanceDto> {
    await this.withWorkspace(userId, slug, async (tx, organizationId, role) => {
      if (role !== 'OWNER') {
        throw new ForbiddenException(
          'Chỉ Chủ sở hữu tổ chức (OWNER) mới có quyền cập nhật cấu hình tổ chức.',
        )
      }
      const org = await tx.organization.findUniqueOrThrow({
        where: { id: organizationId },
        select: { name: true, settings: true },
      })

      const nextName = body.name !== undefined ? organizationName({ name: body.name }) : org.name
      const currentSettings = parseGovernanceSettings(org.settings)
      const nextClassification =
        body.defaultDataClassification !== undefined
          ? body.defaultDataClassification
          : currentSettings.defaultDataClassification
      if (!['INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'].includes(nextClassification)) {
        throw new BadRequestException('Phân loại bảo mật dữ liệu mặc định không hợp lệ.')
      }
      const nextSettings: OrganizationGovernanceSettingsDto = {
        ...currentSettings,
        requireIndependentReviewer:
          typeof body.requireIndependentReviewer === 'boolean'
            ? body.requireIndependentReviewer
            : currentSettings.requireIndependentReviewer,
        defaultDataClassification: nextClassification,
      }

      await tx.organization.update({
        where: { id: organizationId },
        data: {
          name: nextName,
          settings: nextSettings as unknown as Prisma.InputJsonValue,
        },
      })

      await tx.tenderAuditLog.create({
        data: {
          organizationId,
          actorUserId: userId,
          actorRole: role,
          action: 'ORG_GOVERNANCE_UPDATED',
          summary: `Cập nhật cấu hình quản trị tổ chức (${nextName} · Phân loại: ${nextSettings.defaultDataClassification})`,
          details: {
            name: nextName,
            settings: nextSettings,
          } as unknown as Prisma.InputJsonValue,
        },
      })
    })
    return this.governance(userId, slug)
  }

  async updateMemberByOwner(
    userId: string,
    slug: string,
    targetUserId: string,
    body: UpdateOrganizationMemberDto,
  ) {
    return this.withWorkspace(userId, slug, async (tx, organizationId, role) => {
      if (role !== 'OWNER') {
        throw new ForbiddenException(
          'Chỉ Chủ sở hữu tổ chức (OWNER) mới có quyền thay đổi vai trò hoặc trạng thái thành viên.',
        )
      }
      if (targetUserId === userId) {
        throw new BadRequestException('OWNER không thể tự hạ quyền hoặc vô hiệu hóa chính mình.')
      }
      const target = await tx.organizationMembership.findUnique({
        where: { organizationId_userId: { organizationId, userId: targetUserId } },
        include: { user: { select: { displayName: true } } },
      })
      if (!target) throw new NotFoundException('Không tìm thấy thành viên trong tổ chức.')
      if (target.role === 'OWNER') {
        throw new BadRequestException('Không thể thay đổi quyền của một OWNER khác.')
      }

      const patch: { role?: MembershipRole; status?: MembershipStatus } = {}
      if (body.role !== undefined) {
        if (!Object.values(MembershipRole).includes(body.role) || body.role === 'OWNER') {
          throw new BadRequestException('Vai trò cập nhật không hợp lệ.')
        }
        patch.role = body.role
      }
      if (body.status !== undefined) {
        if (!Object.values(MembershipStatus).includes(body.status)) {
          throw new BadRequestException('Trạng thái thành viên không hợp lệ.')
        }
        patch.status = body.status
      }
      if (Object.keys(patch).length === 0) {
        throw new BadRequestException('Không có thông tin cập nhật thành viên.')
      }

      const updated = await tx.organizationMembership.update({
        where: { id: target.id },
        data: patch,
        select: {
          userId: true,
          role: true,
          status: true,
          user: { select: { displayName: true } },
        },
      })

      await tx.tenderAuditLog.create({
        data: {
          organizationId,
          actorUserId: userId,
          actorRole: role,
          action: 'ORG_MEMBER_UPDATED',
          summary: `OWNER cập nhật quyền thành viên ${target.user.displayName} (${updated.role} · ${updated.status})`,
          details: {
            targetUserId,
            previousRole: target.role,
            nextRole: updated.role,
            previousStatus: target.status,
            nextStatus: updated.status,
          } as unknown as Prisma.InputJsonValue,
        },
      })

      return {
        userId: updated.userId,
        name: updated.user.displayName,
        role: updated.role,
        status: updated.status,
      }
    })
  }

  async withWorkspace<T>(
    userId: string,
    slug: string,
    operation: (tx: Prisma.TransactionClient, id: string, role: MembershipRole) => Promise<T>,
  ): Promise<T> {
    const db = this.database.db
    try {
      return await withTenantWorkspaceTransaction(db, { userId, slug },
        (tx, organizationId, role) => operation(tx, organizationId, role))
    } catch (error) {
      if (error instanceof TenantAccessDeniedError) {
        throw new ForbiddenException('Bạn không có quyền truy cập tổ chức này.')
      }
      throw error
    }
  }
}
