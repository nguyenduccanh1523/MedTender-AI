import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'

import { WorkspaceRoleProvider } from '../src/features/organizations/workspace-permissions'
import { TenderDetailView } from '../src/features/tenders/components/tender-detail'
import { clearResources } from '../src/lib/api/resource-cache'

const {
  getTender,
  createTenderLot,
  createTenderItem,
  updateTender,
  updateTenderLot,
  updateTenderItem,
  deleteTenderItem,
  listTenderAudits,
} = vi.hoisted(() => ({
  getTender: vi.fn(),
  createTenderLot: vi.fn(),
  createTenderItem: vi.fn(),
  updateTender: vi.fn(),
  updateTenderLot: vi.fn(),
  updateTenderItem: vi.fn(),
  deleteTenderItem: vi.fn(),
  listTenderAudits: vi.fn(),
}))

vi.mock('../src/features/tenders/api', () => ({
  getTender,
  createTenderLot,
  createTenderItem,
  updateTender,
  updateTenderLot,
  updateTenderItem,
  deleteTenderItem,
  listTenderAudits,
}))

beforeEach(() => {
  clearResources()
  vi.clearAllMocks()
  getTender.mockResolvedValue({
    id: 'tender-1',
    title: 'Mua sắm thiết bị 2026',
    reference: 'RFQ-01',
    procurementStage: 'RFQ',
    createdAt: '2026-11-06T00:00:00.000Z',
    lots: [],
  })
})

afterEach(cleanup)

it('lets an authorized role add a lot and then enter an item by hand', async () => {
  createTenderLot.mockResolvedValue({ id: 'lot-1', code: 'LOT-01', name: 'Thiết bị theo dõi' })
  createTenderItem.mockResolvedValue({ id: 'item-1', itemNo: '01', name: 'Máy theo dõi bệnh nhân', quantity: '5', unit: 'cái', description: null })
  render(<WorkspaceRoleProvider role="BID_MANAGER"><TenderDetailView slug="demo" id="tender-1" /></WorkspaceRoleProvider>)

  await screen.findByRole('heading', { name: 'Mua sắm thiết bị 2026' })
  fireEvent.click(screen.getByRole('button', { name: '+ Thêm lot' }))
  const lotForm = screen.getByRole('form', { name: 'Tạo lot' })
  fireEvent.change(within(lotForm).getByLabelText('Mã lot'), { target: { value: 'LOT-01' } })
  fireEvent.change(within(lotForm).getByLabelText('Tên lot'), { target: { value: 'Thiết bị theo dõi' } })
  fireEvent.submit(lotForm)

  expect(await screen.findByRole('heading', { name: 'Thiết bị theo dõi' })).toBeTruthy()
  expect(createTenderLot).toHaveBeenCalledWith('demo', 'tender-1', { code: 'LOT-01', name: 'Thiết bị theo dõi' })

  fireEvent.click(screen.getByRole('button', { name: '+ Thêm dòng hàng hóa' }))
  const itemForm = screen.getByRole('form', { name: 'Thêm dòng hàng hóa vào LOT-01' })
  fireEvent.change(within(itemForm).getByLabelText('STT'), { target: { value: '01' } })
  fireEvent.change(within(itemForm).getByLabelText('Tên hàng hóa'), { target: { value: 'Máy theo dõi bệnh nhân' } })
  fireEvent.change(within(itemForm).getByLabelText('Số lượng'), { target: { value: '5' } })
  fireEvent.change(within(itemForm).getByLabelText('Đơn vị'), { target: { value: 'cái' } })
  fireEvent.submit(itemForm)

  await waitFor(() => expect(screen.getByText('Máy theo dõi bệnh nhân')).toBeTruthy())
  expect(createTenderItem).toHaveBeenCalledWith('demo', 'tender-1', 'lot-1', { itemNo: '01', name: 'Máy theo dõi bệnh nhân', quantity: 5, unit: 'cái', description: '' })
  expect(screen.getByText('5 cái')).toBeTruthy()
})

it('shows existing lot data without create actions for a viewer', async () => {
  getTender.mockResolvedValue({ id: 'tender-1', title: 'Hồ sơ đã chia sẻ', reference: null, procurementStage: 'INTERNAL', createdAt: '2026-11-06T00:00:00.000Z', lots: [{ id: 'lot-1', code: 'LOT-01', name: 'Thiết bị', items: [] }] })
  render(<WorkspaceRoleProvider role="VIEWER"><TenderDetailView slug="readonly" id="tender-1" /></WorkspaceRoleProvider>)

  expect(await screen.findByRole('heading', { name: 'Thiết bị' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: '+ Thêm lot' })).toBeNull()
  expect(screen.queryByRole('button', { name: '+ Thêm dòng hàng hóa' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Sửa hồ sơ' })).toBeNull()
})

it('keeps the lot form open and reports a duplicate code from the API', async () => {
  createTenderLot.mockRejectedValue(new Error('Mã lot đã tồn tại trong hồ sơ.'))
  render(<WorkspaceRoleProvider role="OWNER"><TenderDetailView slug="duplicate" id="tender-1" /></WorkspaceRoleProvider>)

  await screen.findByRole('heading', { name: 'Mua sắm thiết bị 2026' })
  fireEvent.click(screen.getByRole('button', { name: '+ Thêm lot' }))
  const form = screen.getByRole('form', { name: 'Tạo lot' })
  fireEvent.change(within(form).getByLabelText('Mã lot'), { target: { value: 'LOT-01' } })
  fireEvent.change(within(form).getByLabelText('Tên lot'), { target: { value: 'Trùng mã' } })
  fireEvent.submit(form)

  expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Mã lot đã tồn tại trong hồ sơ.')
  expect(screen.getByRole('form', { name: 'Tạo lot' })).toBeTruthy()
})

it('edits tender metadata, updates/deletes an item and opens the audit log', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  getTender.mockResolvedValue({
    id: 'tender-1',
    title: 'Mua sắm thiết bị 2026',
    reference: 'RFQ-01',
    procurementStage: 'RFQ',
    createdAt: '2026-11-06T00:00:00.000Z',
    lots: [
      {
        id: 'lot-1',
        code: 'LOT-01',
        name: 'Thiết bị theo dõi',
        items: [{ id: 'item-1', itemNo: '01', name: 'Monitor 5 thông số', quantity: '10.000', unit: 'cái', description: null }],
      },
    ],
  })
  updateTender.mockResolvedValue({
    id: 'tender-1',
    title: 'Mua sắm thiết bị ICU 2026',
    reference: 'RFQ-ICU-01',
    procurementStage: 'FORMAL_TENDER',
    createdAt: '2026-11-06T00:00:00.000Z',
  })
  updateTenderItem.mockResolvedValue({
    id: 'item-1',
    itemNo: '01',
    name: 'Monitor 7 thông số',
    quantity: '12.500',
    unit: 'bộ',
    description: 'Màn hình 15 inch',
  })
  deleteTenderItem.mockResolvedValue(undefined)
  listTenderAudits.mockResolvedValue([
    {
      id: 'audit-1',
      tenderId: 'tender-1',
      lotId: 'lot-1',
      itemId: 'item-1',
      actorUserId: 'u-1',
      actorName: 'Lê Bình Bid Manager',
      actorRole: 'BID_MANAGER',
      action: 'ITEM_UPDATED',
      summary: 'Cập nhật dòng hàng hóa #01 (Monitor 7 thông số) trong LOT-01',
      details: {},
      createdAt: '2026-11-06T12:00:00.000Z',
    },
  ])

  render(<WorkspaceRoleProvider role="OWNER"><TenderDetailView slug="demo" id="tender-1" /></WorkspaceRoleProvider>)

  await screen.findByRole('heading', { name: 'Mua sắm thiết bị 2026' })
  expect(screen.getByText('10 cái')).toBeTruthy()

  fireEvent.click(screen.getByRole('button', { name: 'Sửa hồ sơ' }))
  const editTenderForm = screen.getByRole('form', { name: 'Chỉnh sửa hồ sơ thầu' })
  fireEvent.change(within(editTenderForm).getByLabelText('Tên hồ sơ'), { target: { value: 'Mua sắm thiết bị ICU 2026' } })
  fireEvent.change(within(editTenderForm).getByLabelText('Mã tham chiếu'), { target: { value: 'RFQ-ICU-01' } })
  fireEvent.change(within(editTenderForm).getByLabelText('Loại hồ sơ'), { target: { value: 'FORMAL_TENDER' } })
  fireEvent.submit(editTenderForm)

  expect(await screen.findByRole('heading', { name: 'Mua sắm thiết bị ICU 2026' })).toBeTruthy()

  fireEvent.click(screen.getByRole('button', { name: 'Sửa Monitor 5 thông số' }))
  const editItemForm = screen.getByRole('form', { name: 'Sửa dòng hàng hóa 01' })
  fireEvent.change(within(editItemForm).getByLabelText('Tên hàng hóa'), { target: { value: 'Monitor 7 thông số' } })
  fireEvent.change(within(editItemForm).getByLabelText('Số lượng'), { target: { value: '12.5' } })
  fireEvent.change(within(editItemForm).getByLabelText('Đơn vị'), { target: { value: 'bộ' } })
  fireEvent.submit(editItemForm)

  expect(await screen.findByText('Monitor 7 thông số')).toBeTruthy()
  expect(screen.getByText('12.5 bộ')).toBeTruthy()

  fireEvent.click(screen.getByRole('tab', { name: /Nhật ký thay đổi/ }))
  expect(await screen.findByText(/Cập nhật dòng hàng hóa #01/)).toBeTruthy()

  fireEvent.click(screen.getByRole('tab', { name: /Lot & dòng hàng hóa/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Xóa Monitor 7 thông số' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Xác nhận xóa' }))
  await waitFor(() => expect(screen.queryByText('Monitor 7 thông số')).toBeNull())
})

it('hides the audit log tab from BID_MANAGER while keeping edit capabilities', async () => {
  render(<WorkspaceRoleProvider role="BID_MANAGER"><TenderDetailView slug="demo" id="tender-1" /></WorkspaceRoleProvider>)
  await screen.findByRole('heading', { name: 'Mua sắm thiết bị 2026' })
  expect(screen.getByRole('button', { name: 'Sửa hồ sơ' })).toBeTruthy()
  expect(screen.queryByRole('tab', { name: /Nhật ký thay đổi/ })).toBeNull()
})

it('paginates and filters audit log entries by limit and page controls', async () => {
  const manyAudits = Array.from({ length: 7 }, (_, index) => ({
    id: `audit-${index + 1}`,
    tenderId: 'tender-1',
    lotId: 'lot-1',
    itemId: `item-${index + 1}`,
    actorUserId: 'u-1',
    actorName: 'Nguyễn Minh Owner',
    actorRole: 'OWNER' as const,
    action: index < 5 ? 'ITEM_CREATED' : 'LOT_UPDATED',
    summary: `Bản ghi kiểm toán số #${index + 1}`,
    details: {},
    createdAt: `2026-11-06T12:0${index}:00.000Z`,
  }))
  listTenderAudits.mockResolvedValue({
    items: manyAudits,
    nextCursor: null,
    total: 7,
    limit: 10,
  })

  render(<WorkspaceRoleProvider role="OWNER"><TenderDetailView slug="demo" id="tender-1" /></WorkspaceRoleProvider>)
  await screen.findByRole('heading', { name: 'Mua sắm thiết bị 2026' })

  fireEvent.click(screen.getByRole('tab', { name: /Nhật ký thay đổi/ }))
  expect(await screen.findByText('Bản ghi kiểm toán số #1')).toBeTruthy()
  expect(screen.getByText('Bản ghi kiểm toán số #7')).toBeTruthy()

  const limitSelect = screen.getByLabelText('Số dòng nhật ký mỗi trang')
  fireEvent.change(limitSelect, { target: { value: '5' } })

  await waitFor(() => {
    expect(screen.getByText('Bản ghi kiểm toán số #1')).toBeTruthy()
    expect(screen.getByText('Bản ghi kiểm toán số #5')).toBeTruthy()
    expect(screen.queryByText('Bản ghi kiểm toán số #6')).toBeNull()
  })
  expect(screen.getByText('Trang 1 / 2')).toBeTruthy()

  fireEvent.click(screen.getByRole('button', { name: 'Trang sau →' }))
  expect(await screen.findByText('Bản ghi kiểm toán số #6')).toBeTruthy()
  expect(screen.getByText('Bản ghi kiểm toán số #7')).toBeTruthy()
  expect(screen.queryByText('Bản ghi kiểm toán số #1')).toBeNull()
  expect(screen.getByText('Trang 2 / 2')).toBeTruthy()
})
