import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'

import { WorkspaceOverview } from '../src/features/organizations/components/workspace-overview'

afterEach(cleanup)

it('gives an OWNER governance-focused workspace overview', () => {
  render(<WorkspaceOverview organization={{ id: 'org-1', name: 'Bệnh viện An Tâm', slug: 'an-tam', role: 'OWNER' }} />)

  expect(screen.getByRole('heading', { name: 'Toàn quyền điều phối workspace' })).toBeTruthy()
  expect(screen.getByText('Chủ sở hữu')).toBeTruthy()
})

it('gives a VIEWER read-only context without governance action', () => {
  render(<WorkspaceOverview organization={{ id: 'org-1', name: 'Bệnh viện An Tâm', slug: 'an-tam', role: 'VIEWER' }} />)

  expect(screen.getByRole('heading', { name: 'Theo dõi quyết định có căn cứ' })).toBeTruthy()
  expect(screen.queryByText('Quản lý thành viên')).toBeNull()
})
