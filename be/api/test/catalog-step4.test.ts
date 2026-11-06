import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common'
import { Prisma } from '../src/database/generated/client'
import {
  computeVersionFingerprint,
  enrichSpecificationsWithConflicts,
  parseCatalogListQuery,
  productInput,
  productVersionInput,
  specInput,
} from '../src/modules/catalog/catalog.dto'
import { CatalogService } from '../src/modules/catalog/catalog.service'
import { OrganizationsService } from '../src/modules/organizations/application/organizations.service'

describe('Step 04 — Catalog, product versions, specification provenance & OWNER governance', () => {
  it('validates product & specification inputs and detects conflicting specifications across multiple sources without losing provenance', () => {
    expect(
      productInput({
        sku: '  MONITOR-ICU-01 ',
        name: 'Monitor theo dõi 5 thông số',
        brand: 'Mindray',
        manufacturer: 'Mindray Bio-Medical',
        category: 'ICU',
      }),
    ).toEqual({
      sku: 'MONITOR-ICU-01',
      name: 'Monitor theo dõi 5 thông số',
      brand: 'Mindray',
      manufacturer: 'Mindray Bio-Medical',
      category: 'ICU',
      modelCode: 'MONITOR-ICU-01',
      notes: null,
      specifications: [],
    })

    expect(() => productInput({ sku: '', name: 'Thiết bị', brand: 'Mindray' })).toThrow(BadRequestException)
    expect(() => specInput({ specKey: '', specValue: '12', sourceLabel: 'Brochure' })).toThrow(
      BadRequestException,
    )

    const { items: enriched, conflictCount } = enrichSpecificationsWithConflicts([
      {
        id: 's-1',
        productVersionId: 'v-1',
        specKey: 'Thời lượng pin dự phòng',
        specValue: '120',
        unit: 'phút',
        sourceLabel: 'Brochure nhà sản xuất v1.2',
        sourceQuote: 'Pin dự phòng Li-ion tối thiểu 120 phút',
        documentVersionId: null,
        createdAt: new Date('2026-11-06T08:00:00Z'),
      },
      {
        id: 's-2',
        productVersionId: 'v-1',
        specKey: 'Thời lượng pin dự phòng',
        specValue: '180',
        unit: 'phút',
        sourceLabel: 'Tờ khai CFS đính kèm',
        sourceQuote: 'Battery runtime up to 180 mins',
        documentVersionId: null,
        createdAt: new Date('2026-11-06T08:05:00Z'),
      },
      {
        id: 's-3',
        productVersionId: 'v-1',
        specKey: 'Kích thước màn hình',
        specValue: '12.1',
        unit: 'inch',
        sourceLabel: 'Brochure nhà sản xuất v1.2',
        sourceQuote: null,
        documentVersionId: null,
        createdAt: new Date('2026-11-06T08:10:00Z'),
      },
    ])

    expect(conflictCount).toBe(1)
    expect(enriched[0]?.hasConflict).toBe(true)
    expect(enriched[1]?.hasConflict).toBe(true)
    expect(enriched[0]?.sourceLabel).toBe('Brochure nhà sản xuất v1.2')
    expect(enriched[1]?.sourceLabel).toBe('Tờ khai CFS đính kèm')
    expect(enriched[2]?.hasConflict).toBe(false)

    const fp1 = computeVersionFingerprint('MT-500', enriched)
    const fp2 = computeVersionFingerprint('MT-500 Pro', enriched)
    expect(fp1).not.toBe(fp2)
    expect(fp1.startsWith('sha256:')).toBe(true)

    const query = parseCatalogListQuery({ q: '  monitor ', status: 'ACTIVE', limit: '15' })
    expect(query).toMatchObject({ q: 'monitor', status: 'ACTIVE', limit: 15, paginated: true })
  })

  it('blocks duplicate active SKU in the same organization and enforces role permissions for version creation & publishing', async () => {
    type StoredSpec = {
      id: string
      productVersionId: string
      specKey: string
      specValue: string
      unit: string | null
      sourceLabel: string
      sourceQuote: string | null
      documentVersionId: string | null
      createdAt: Date
    }
    type StoredVersion = {
      id: string
      productId: string
      organizationId: string
      versionNumber: number
      versionLabel: string
      modelCode: string
      status: string
      fingerprint: string
      notes: string | null
      createdByUserId: string
      publishedByUserId: string | null
      publishedAt: Date | null
      createdAt: Date
      updatedAt: Date
      specifications: StoredSpec[]
    }
    const versionsStore = new Map<string, StoredVersion>()
    versionsStore.set('11111111-1111-4111-8111-111111111111', {
      id: '11111111-1111-4111-8111-111111111111',
      productId: 'p-1',
      organizationId: 'org-a',
      versionNumber: 1,
      versionLabel: 'v1',
      modelCode: 'Model-V1',
      status: 'PUBLISHED',
      fingerprint: 'sha256:fp-v1',
      notes: 'Phiên bản v1 đã phát hành',
      createdByUserId: 'u-cat',
      publishedByUserId: 'u-cat',
      publishedAt: new Date('2026-11-06T09:00:00Z'),
      createdAt: new Date('2026-11-06T08:30:00Z'),
      updatedAt: new Date('2026-11-06T09:00:00Z'),
      specifications: [
        {
          id: 'spec-v1-1',
          productVersionId: '11111111-1111-4111-8111-111111111111',
          specKey: 'SpO2',
          specValue: '±2%',
          unit: '%',
          sourceLabel: 'IFU v1',
          sourceQuote: 'Trang 10',
          documentVersionId: null,
          createdAt: new Date('2026-11-06T08:30:00Z'),
        },
      ],
    })

    const tx = {
      product: {
        findFirst: jest.fn().mockImplementation(({ where }) => {
          if (where?.sku) {
            return Promise.resolve(null)
          }
          return Promise.resolve({
            id: 'p-1',
            organizationId: 'org-a',
            sku: 'MON-500',
            name: 'Monitor ICU 5 thông số',
            brand: 'Mindray',
            manufacturer: 'Mindray Bio-Medical',
            category: 'Hồi sức',
            status: 'ACTIVE',
            createdByUserId: 'u-cat',
            createdAt: new Date('2026-11-06T08:00:00Z'),
            updatedAt: new Date('2026-11-06T09:00:00Z'),
            versions: Array.from(versionsStore.values()).sort((a, b) => b.versionNumber - a.versionNumber),
          })
        }),
        create: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      productVersion: {
        findFirst: jest.fn().mockImplementation(({ where }) => {
          if (where?.id) {
            return Promise.resolve(versionsStore.get(where.id) ?? null)
          }
          const list = Array.from(versionsStore.values()).sort((a, b) => b.versionNumber - a.versionNumber)
          return Promise.resolve(list[0] ?? null)
        }),
        create: jest.fn().mockImplementation(({ data }) => {
          const created = {
            id: '22222222-2222-4222-8222-222222222222',
            productId: data.productId,
            organizationId: data.organizationId,
            versionNumber: data.versionNumber,
            versionLabel: data.versionLabel,
            modelCode: data.modelCode,
            status: data.status,
            fingerprint: data.fingerprint,
            notes: data.notes,
            createdByUserId: data.createdByUserId,
            publishedByUserId: null,
            publishedAt: null,
            createdAt: new Date('2026-11-06T10:00:00Z'),
            updatedAt: new Date('2026-11-06T10:00:00Z'),
            specifications: (data.specifications?.create ?? []).map(
              (spec: Omit<StoredSpec, 'id' | 'productVersionId' | 'createdAt'>, idx: number) => ({
                id: `spec-v2-${idx + 1}`,
                productVersionId: '22222222-2222-4222-8222-222222222222',
                ...spec,
                createdAt: new Date('2026-11-06T10:00:00Z'),
              }),
            ),
          }
          versionsStore.set('22222222-2222-4222-8222-222222222222', created)
          return Promise.resolve(created)
        }),
        updateMany: jest.fn().mockImplementation(({ where, data }) => {
          for (const [key, val] of versionsStore.entries()) {
            if (val.status === where.status && key !== where.id?.not) {
              versionsStore.set(key, { ...val, ...data })
            }
          }
          return Promise.resolve({ count: 1 })
        }),
        update: jest.fn().mockImplementation(({ where, data }) => {
          const existing = versionsStore.get(where.id)
          const updated = { ...existing, ...data }
          versionsStore.set(where.id, updated)
          return Promise.resolve(updated)
        }),
      },
      productSpecification: {
        count: jest.fn().mockResolvedValue(1),
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn(),
        delete: jest.fn(),
      },
      tenderAuditLog: {
        create: jest.fn().mockResolvedValue({}),
      },
    }

    let currentRole = 'VIEWER'
    const organizations = {
      withWorkspace: jest.fn().mockImplementation((_userId, _slug, fn) => fn(tx, 'org-a', currentRole)),
    }
    const service = new CatalogService(organizations as never)

    // 1. Unauthorized roles cannot create products or versions
    await expect(
      service.create('u-viewer', 'org-a', { sku: 'MON-500', name: 'Monitor', brand: 'Mindray' }),
    ).rejects.toThrow(ForbiddenException)

    currentRole = 'BID_MANAGER'
    await expect(
      service.createVersion('u-bm', 'org-a', 'p-1', { modelCode: 'Model-V2' }),
    ).rejects.toThrow(ForbiddenException)

    // 2. CATALOG_MANAGER is authorized; duplicate active SKU throws ConflictException
    currentRole = 'CATALOG_MANAGER'
    const uniqueError = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '7.10.1',
    })
    tx.product.create.mockRejectedValueOnce(uniqueError)
    await expect(
      service.create('u-cat', 'org-a', { sku: 'MON-500', name: 'Monitor trùng SKU', brand: 'Mindray' }),
    ).rejects.toThrow(ConflictException)

    // 3. Creating v2 cloned from v1 preserves v1 intact; historical lookup by versionId returns exact values of v1 vs v2
    const v1Id = '11111111-1111-4111-8111-111111111111'
    const v2Id = '22222222-2222-4222-8222-222222222222'
    const v2Input = productVersionInput({
      modelCode: 'Model-V2-ICU',
      notes: 'Nâng cấp dải đo SpO2',
      cloneFromVersionId: v1Id,
    })
    expect(v2Input.modelCode).toBe('Model-V2-ICU')
    const createdV2 = await service.createVersion('u-cat', 'org-a', 'p-1', {
      modelCode: 'Model-V2-ICU',
      notes: 'Nâng cấp dải đo SpO2',
      cloneFromVersionId: v1Id,
    })
    expect(createdV2.versionNumber).toBe(2)
    expect(createdV2.versionLabel).toBe('v2')
    expect(createdV2.status).toBe('DRAFT')
    expect(createdV2.modelCode).toBe('Model-V2-ICU')
    expect(createdV2.specifications).toHaveLength(1)

    // Publish v2 -> v1 becomes SUPERSEDED, v2 becomes PUBLISHED, but v1's model & specs remain intact!
    const publishedV2 = await service.publishVersion('u-cat', 'org-a', 'p-1', v2Id)
    expect(publishedV2.status).toBe('PUBLISHED')

    const readV1 = await service.getVersionById('u-cat', 'org-a', v1Id)
    const readV2 = await service.getVersionById('u-cat', 'org-a', v2Id)
    expect(readV1.versionNumber).toBe(1)
    expect(readV1.modelCode).toBe('Model-V1')
    expect(readV1.status).toBe('SUPERSEDED')
    expect(readV1.specifications[0]?.specValue).toBe('±2%')

    expect(readV2.versionNumber).toBe(2)
    expect(readV2.modelCode).toBe('Model-V2-ICU')
    expect(readV2.status).toBe('PUBLISHED')

    // Published / Superseded versions are immutable
    await expect(
      service.updateVersion('u-cat', 'org-a', 'p-1', v1Id, { modelCode: 'Sửa trái phép v1' }),
    ).rejects.toThrow(ConflictException)
    await expect(
      service.updateVersion('u-cat', 'org-a', 'p-1', v2Id, { modelCode: 'Sửa trái phép v2' }),
    ).rejects.toThrow(ConflictException)
  })

  it('restricts organization governance strictly to OWNER (blocks ADMIN and other roles)', async () => {
    let currentRole = 'ADMIN'
    const tx = {
      organization: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'org-a',
          slug: 'benh-vien-a',
          name: 'Bệnh viện A',
          status: 'ACTIVE',
          settings: { requireIndependentReviewer: true, defaultDataClassification: 'CONFIDENTIAL' },
          createdAt: new Date('2026-11-06T08:00:00Z'),
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      organizationMembership: {
        findMany: jest.fn().mockResolvedValue([
          {
            userId: 'u-owner',
            role: 'OWNER',
            status: 'ACTIVE',
            user: { name: 'Chủ sở hữu', email: 'owner@bv.vn' },
          },
          {
            userId: 'u-admin',
            role: 'ADMIN',
            status: 'ACTIVE',
            user: { name: 'Quản trị viên', email: 'admin@bv.vn' },
          },
        ]),
      },
      tenderAuditLog: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    }

    const service = new OrganizationsService({} as never)
    jest
      .spyOn(service, 'withWorkspace')
      .mockImplementation((_u, _s, fn) => fn(tx as never, 'org-a', currentRole as never))

    await expect(service.governance('u-admin', 'benh-vien-a')).rejects.toThrow(ForbiddenException)
    await expect(
      service.updateGovernance('u-admin', 'benh-vien-a', { name: 'Đổi tên trái phép' }),
    ).rejects.toThrow(ForbiddenException)

    currentRole = 'OWNER'
    const gov = await service.governance('u-owner', 'benh-vien-a')
    expect(gov.name).toBe('Bệnh viện A')
    expect(gov.settings.requireIndependentReviewer).toBe(true)
    expect(gov.settings.defaultDataClassification).toBe('CONFIDENTIAL')
  })
})
