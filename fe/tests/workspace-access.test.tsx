import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

import { WorkspaceAccess } from '../src/features/organizations/components/workspace-access'

const { getOrganization, listOrganizationMembers } = vi.hoisted(() => ({
  getOrganization: vi.fn(),
  listOrganizationMembers: vi.fn(),
}))

vi.mock('../src/features/organizations/api', () => ({ getOrganization, listOrganizationMembers }))
vi.mock('../src/features/organizations/components/organization-invitations', () => ({ OrganizationInvitations: () => null }))
vi.mock('../src/features/organizations/components/workspace-header', () => ({ WorkspaceHeader: () => null }))

afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})

it('shows the members returned by the API for the owner of the selected organization', async () => {
  getOrganization.mockResolvedValue({ id: 'org-a', slug: 'org-a', name: 'Tổ chức A', role: 'OWNER' })
  listOrganizationMembers.mockResolvedValue([{ userId: 'user-a', name: 'Owner A', role: 'OWNER', status: 'ACTIVE' }])
  render(<WorkspaceAccess slug="org-a"><p>Nội dung workspace</p></WorkspaceAccess>)

  expect(await screen.findByRole('heading', { name: 'Thành viên tổ chức' })).toBeTruthy()
  expect(await screen.findByText('Owner A')).toBeTruthy()
  expect(listOrganizationMembers).toHaveBeenCalledWith('org-a')
})

it('opens the workspace for a reviewer without requesting the private member list', async () => {
  getOrganization.mockResolvedValue({ id: 'org-a', slug: 'org-a', name: 'Tổ chức A', role: 'REVIEWER' })
  render(<WorkspaceAccess slug="org-a"><p>Nội dung workspace</p></WorkspaceAccess>)

  expect(await screen.findByText('Nội dung workspace')).toBeTruthy()
  expect(screen.queryByRole('heading', { name: 'Thành viên tổ chức' })).toBeNull()
  expect(listOrganizationMembers).not.toHaveBeenCalled()
})
