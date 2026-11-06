import { render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'

import { TenderForm } from '../src/features/tenders/components/tender-form'
import { TenderList } from '../src/features/tenders/components/tender-list'
import { WorkspaceRoleProvider, canCreateTender } from '../src/features/organizations/workspace-permissions'

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn() }) }))
vi.mock('../src/features/tenders/api', () => ({
  listTenders: vi.fn().mockResolvedValue([]),
  createTender: vi.fn(),
}))

it('matches the backend tender creation roles', () => {
  for (const role of ['OWNER', 'ADMIN', 'BID_MANAGER'] as const) expect(canCreateTender(role)).toBe(true)
  for (const role of ['ANALYST', 'CATALOG_MANAGER', 'REVIEWER', 'VIEWER'] as const) expect(canCreateTender(role)).toBe(false)
})

it('shows create action only to a tender writer', async () => {
  const { unmount } = render(<WorkspaceRoleProvider role="VIEWER"><TenderList slug="viewer-org" /></WorkspaceRoleProvider>)
  await screen.findByText('Chưa có hồ sơ thầu để xem trong tổ chức này.')
  expect(screen.queryByRole('link', { name: 'Tạo hồ sơ' })).toBeNull()
  unmount()

  render(<WorkspaceRoleProvider role="BID_MANAGER"><TenderList slug="manager-org" /></WorkspaceRoleProvider>)
  expect(await screen.findByRole('link', { name: 'Tạo hồ sơ' })).toBeTruthy()
})

it('blocks direct navigation to the create form for a read-only role', () => {
  render(<WorkspaceRoleProvider role="REVIEWER"><TenderForm slug="reviewer-org" /></WorkspaceRoleProvider>)
  expect(screen.getByText('Bạn không có quyền tạo hồ sơ thầu')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Tạo hồ sơ' })).toBeNull()
})
