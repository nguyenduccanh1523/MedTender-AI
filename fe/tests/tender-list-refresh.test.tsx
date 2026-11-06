import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

import { WorkspaceRoleProvider } from '../src/features/organizations/workspace-permissions'
import { TenderList } from '../src/features/tenders/components/tender-list'
import { clearResources, writeResource } from '../src/lib/api/resource-cache'

const { listTenders } = vi.hoisted(() => ({ listTenders: vi.fn() }))
vi.mock('../src/features/tenders/api', () => ({ listTenders }))

afterEach(() => { cleanup(); clearResources(); vi.clearAllMocks() })

it('refreshes an empty cached list to show a newly seeded tender', async () => {
  writeResource('tenders:demo-refresh', [])
  listTenders.mockResolvedValue([{ id: 'tender-1', title: 'Demo RFQ', reference: 'DEMO-01', procurementStage: 'RFQ', createdAt: '2026-11-06T00:00:00.000Z', _count: { lots: 1, items: 4 } }])
  render(<WorkspaceRoleProvider role="OWNER"><TenderList slug="demo-refresh" /></WorkspaceRoleProvider>)

  expect(screen.getByText(/Chưa có hồ sơ/)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Làm mới' }))
  expect(await screen.findByText('Demo RFQ')).toBeTruthy()
  expect(listTenders).toHaveBeenCalledWith('demo-refresh')
})

it('filters tenders by search query and procurement stage and loads cursor pages', async () => {
  listTenders
    .mockResolvedValueOnce({
      items: [
        { id: 'tender-1', title: 'Mua sắm máy thở ICU', reference: 'RFQ-ICU-01', procurementStage: 'RFQ', createdAt: '2026-11-06T00:00:00.000Z', _count: { lots: 2, items: 5 } },
        { id: 'tender-2', title: 'Hồ sơ vật tư xét nghiệm', reference: 'E-HSMT-02', procurementStage: 'FORMAL_TENDER', createdAt: '2026-11-05T00:00:00.000Z', _count: { lots: 1, items: 3 } },
      ],
      nextCursor: 'cursor-page-2',
      total: 3,
    })
    .mockResolvedValueOnce({
      items: [
        { id: 'tender-3', title: 'Đánh giá nội bộ máy siêu âm', reference: null, procurementStage: 'INTERNAL', createdAt: '2026-11-04T00:00:00.000Z', _count: { lots: 1, items: 2 } },
      ],
      nextCursor: null,
      total: 3,
    })

  render(<WorkspaceRoleProvider role="BID_MANAGER"><TenderList slug="demo-filter" /></WorkspaceRoleProvider>)

  expect(await screen.findByText('Mua sắm máy thở ICU')).toBeTruthy()
  expect(screen.getByText('Hồ sơ vật tư xét nghiệm')).toBeTruthy()

  fireEvent.click(screen.getByRole('button', { name: 'E-HSMT' }))
  expect(screen.queryByText('Mua sắm máy thở ICU')).toBeNull()
  expect(screen.getByText('Hồ sơ vật tư xét nghiệm')).toBeTruthy()

  fireEvent.click(screen.getByRole('button', { name: 'Tất cả' }))
  fireEvent.change(screen.getByRole('searchbox', { name: 'Tìm kiếm hồ sơ' }), { target: { value: 'ICU-01' } })
  expect(screen.getByText('Mua sắm máy thở ICU')).toBeTruthy()
  expect(screen.queryByText('Hồ sơ vật tư xét nghiệm')).toBeNull()

  fireEvent.change(screen.getByRole('searchbox', { name: 'Tìm kiếm hồ sơ' }), { target: { value: '' } })
  fireEvent.click(screen.getByRole('button', { name: 'Tải thêm hồ sơ' }))
  expect(await screen.findByText('Đánh giá nội bộ máy siêu âm')).toBeTruthy()
  expect(listTenders).toHaveBeenLastCalledWith('demo-filter', {
    q: undefined,
    stage: 'ALL',
    cursor: 'cursor-page-2',
  })
})
