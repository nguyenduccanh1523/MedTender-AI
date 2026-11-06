import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'

import { WorkspaceRoleProvider } from '../src/features/organizations/workspace-permissions'
import { TenderDetailView } from '../src/features/tenders/components/tender-detail'
import { clearResources } from '../src/lib/api/resource-cache'

const { getTender, createTenderLot, createTenderItem } = vi.hoisted(() => ({
  getTender: vi.fn(),
  createTenderLot: vi.fn(),
  createTenderItem: vi.fn(),
}))

vi.mock('../src/features/tenders/api', () => ({ getTender, createTenderLot, createTenderItem }))

beforeEach(() => {
  clearResources()
  vi.clearAllMocks()
  getTender.mockResolvedValue({ id: 'tender-1', title: 'Mua sắm thiết bị 2026', reference: 'RFQ-01', procurementStage: 'RFQ', createdAt: '2026-11-06T00:00:00.000Z', lots: [] })
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
