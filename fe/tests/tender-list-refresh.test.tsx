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
  listTenders.mockResolvedValue([{ id: 'tender-1', title: 'Demo RFQ', reference: 'DEMO-01', procurementStage: 'RFQ', _count: { lots: 1 } }])
  render(<WorkspaceRoleProvider role="OWNER"><TenderList slug="demo-refresh" /></WorkspaceRoleProvider>)

  expect(screen.getByText(/Chưa có hồ sơ/)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Làm mới' }))
  expect(await screen.findByText('Demo RFQ')).toBeTruthy()
  expect(listTenders).toHaveBeenCalledWith('demo-refresh')
})
