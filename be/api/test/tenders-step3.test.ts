import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common'
import { Prisma } from '../src/database/generated/client'
import {
  decodeTenderCursor,
  encodeTenderCursor,
  itemInput,
  lotInput,
  parseTenderAuditQuery,
  parseTenderListQuery,
  tenderInput,
  tenderPatchInput,
} from '../src/modules/tenders/tenders.dto'
import { TendersService } from '../src/modules/tenders/tenders.service'

describe('Step 03 — Tender, lot, item DTO validation and service rules', () => {
  it('validates procurement stage, lot code, item quantity and decimal scale', () => {
    expect(tenderInput({ title: '  Mua sắm ICU  ', procurementStage: 'RFQ', reference: '  RFQ-01 ' })).toEqual({
      title: 'Mua sắm ICU',
      procurementStage: 'RFQ',
      reference: 'RFQ-01',
    })
    expect(() => tenderInput({ title: '', procurementStage: 'RFQ' })).toThrow(BadRequestException)
    expect(() => tenderPatchInput({})).toThrow(BadRequestException)
    expect(lotInput({ code: ' LOT-01 ', name: ' Thiết bị ' })).toEqual({ code: 'LOT-01', name: 'Thiết bị' })

    expect(itemInput({ itemNo: '01', name: 'Máy thở', quantity: 12.5, unit: 'bộ' })).toEqual({
      itemNo: '01',
      name: 'Máy thở',
      quantity: 12.5,
      unit: 'bộ',
      description: null,
    })
    expect(() => itemInput({ itemNo: '01', name: 'Máy thở', quantity: 0, unit: 'bộ' })).toThrow('Số lượng phải lớn hơn 0.')
    expect(() => itemInput({ itemNo: '01', name: 'Máy thở', quantity: -3, unit: 'bộ' })).toThrow('Số lượng phải lớn hơn 0.')
    expect(() => itemInput({ itemNo: '01', name: 'Máy thở', quantity: 1.1234, unit: 'bộ' })).toThrow(
      'Số lượng chỉ hỗ trợ tối đa 3 chữ số thập phân.',
    )
    expect(() => itemInput({ itemNo: '01', name: 'Máy thở', quantity: 1, unit: '   ' })).toThrow('Đơn vị không hợp lệ.')
  })

  it('encodes and decodes composite keyset cursor (createdAt + id) for stable pagination', () => {
    const timestamp = new Date('2026-11-06T10:00:00.000Z')
    const id = '11111111-2222-3333-4444-555555555555'
    const encoded = encodeTenderCursor({ createdAt: timestamp, id })
    const decoded = decodeTenderCursor(encoded)
    expect(decoded.createdAt.toISOString()).toBe(timestamp.toISOString())
    expect(decoded.id).toBe(id)

    expect(() => decodeTenderCursor('invalid-cursor')).toThrow(BadRequestException)
    const parsed = parseTenderListQuery({ limit: '2', cursor: encoded, stage: 'RFQ', q: '  ICU ' })
    expect(parsed.paginated).toBe(true)
    expect(parsed.limit).toBe(2)
    expect(parsed.stage).toBe('RFQ')
    expect(parsed.q).toBe('ICU')

    const parsedAudit = parseTenderAuditQuery({ limit: '10', cursor: encoded, action: 'item', pageMode: 'cursor' })
    expect(parsedAudit.paginated).toBe(true)
    expect(parsedAudit.limit).toBe(10)
    expect(parsedAudit.action).toBe('ITEM')
    expect(() => parseTenderAuditQuery({ limit: '0' })).toThrow(BadRequestException)
  })

  it('enforces writer roles, blocks duplicate STT in the same lot, and records audit entries', async () => {
    const audits: Array<Record<string, unknown>> = []
    const tx = {
      tender: {
        create: jest.fn().mockResolvedValue({
          id: 't-1',
          organizationId: 'org-a',
          title: 'Hồ sơ A',
          reference: 'RFQ-1',
          procurementStage: 'RFQ',
          createdByUserId: 'u-1',
        }),
        findFirst: jest.fn().mockResolvedValue({ id: 't-1', organizationId: 'org-a', _count: { lots: 1 } }),
        update: jest.fn().mockResolvedValue({}),
      },
      tenderLot: {
        findFirst: jest.fn().mockResolvedValue({ id: 'lot-1', tenderId: 't-1', organizationId: 'org-a', code: 'LOT-01' }),
      },
      tenderItem: {
        count: jest.fn().mockResolvedValue(1),
        create: jest.fn(),
      },
      tenderAuditLog: {
        create: jest.fn().mockImplementation(({ data }) => {
          audits.push(data)
          return Promise.resolve(data)
        }),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    }

    let currentRole = 'VIEWER'
    const organizations = {
      withWorkspace: jest.fn().mockImplementation((_userId, _slug, fn) => fn(tx, 'org-a', currentRole)),
    }
    const service = new TendersService({} as never, organizations as never)

    await expect(
      service.create('u-1', 'org-a', { title: 'Hồ sơ A', procurementStage: 'RFQ' }),
    ).rejects.toThrow(ForbiddenException)

    currentRole = 'BID_MANAGER'
    await expect(service.listAudits('u-1', 'org-a', 't-1')).rejects.toThrow(ForbiddenException)
    await service.create('u-1', 'org-a', { title: 'Hồ sơ A', procurementStage: 'RFQ', reference: 'RFQ-1' })
    expect(audits).toHaveLength(1)
    expect(audits[0]).toMatchObject({ action: 'TENDER_CREATED', actorRole: 'BID_MANAGER', tenderId: 't-1' })

    currentRole = 'OWNER'
    await expect(service.listAudits('u-1', 'org-a', 't-1')).resolves.toEqual([])
    await expect(
      service.listAudits('u-1', 'org-a', 't-1', { limit: '10', pageMode: 'cursor' }),
    ).resolves.toEqual({ items: [], nextCursor: null, total: 0, limit: 10 })

    const uniqueError = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '7.10.1',
    })
    tx.tenderItem.create.mockRejectedValueOnce(uniqueError)
    await expect(
      service.addItem('u-1', 'org-a', 't-1', 'lot-1', { itemNo: '01', name: 'Trùng STT', quantity: 1, unit: 'cái' }),
    ).rejects.toThrow(ConflictException)
  })
})
