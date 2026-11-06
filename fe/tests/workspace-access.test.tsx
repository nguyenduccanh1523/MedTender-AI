import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

import { WorkspaceAccess } from '../src/features/organizations/components/workspace-access'
import { clearOrganizationCache } from '../src/features/organizations/organization-cache'

const { getOrganization, listOrganizationMembers } = vi.hoisted(() => ({
  getOrganization: vi.fn(),
  listOrganizationMembers: vi.fn(),
}))

vi.mock('../src/features/organizations/api', () => ({ getOrganization, listOrganizationMembers }))
vi.mock('../src/features/organizations/components/organization-invitations', () => ({ OrganizationInvitations: () => null }))
vi.mock('../src/features/organizations/components/workspace-header', () => ({ WorkspaceHeader: () => null }))
vi.mock('next/navigation', () => ({ usePathname: () => '/org-a' }))

afterEach(() => {
  cleanup()
  clearOrganizationCache()
  vi.resetAllMocks()
})

it('shows the members returned by the API for an owner on the team route', async () => {
  getOrganization.mockResolvedValue({ id: 'org-a', slug: 'org-a', name: 'Tổ chức A', role: 'OWNER' })
  listOrganizationMembers.mockResolvedValue([{ userId: 'user-a', name: 'Owner A', role: 'OWNER', status: 'ACTIVE' }])
  render(<WorkspaceAccess slug="org-a" section="team"><p>Nội dung workspace</p></WorkspaceAccess>)

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
  expect(screen.queryByRole('link', { name: 'Quản trị đội ngũ' })).toBeNull()
})

it('does not render team page content when a viewer opens its URL directly', async () => {
  getOrganization.mockResolvedValue({ id: 'org-a', slug: 'org-a', name: 'Tổ chức A', role: 'VIEWER' })
  render(<WorkspaceAccess slug="org-a" section="team"><p>Nội dung riêng của trang thành viên</p></WorkspaceAccess>)

  expect(await screen.findByText('Bạn không có quyền quản trị đội ngũ')).toBeTruthy()
  expect(screen.queryByText('Nội dung riêng của trang thành viên')).toBeNull()
  expect(listOrganizationMembers).not.toHaveBeenCalled()
})

it('uses separate workspace routes instead of page anchors', async () => {
  getOrganization.mockResolvedValue({ id: 'org-a', slug: 'org-a', name: 'Tổ chức A', role: 'OWNER' })
  render(<WorkspaceAccess slug="org-a"><p>Nội dung workspace</p></WorkspaceAccess>)

  expect((await screen.findByRole('link', { name: 'Tổng quan' })).getAttribute('href')).toBe('/org-a')
  expect(screen.getByRole('link', { name: 'Hoạt động' }).getAttribute('href')).toBe('/org-a/hoat-dong')
  expect(screen.getByRole('link', { name: 'Catalog thiết bị' }).getAttribute('href')).toBe('/org-a/catalog')
  expect(screen.getByRole('link', { name: 'Quản trị đội ngũ' }).getAttribute('href')).toBe('/org-a/thanh-vien')
  expect(screen.getByRole('link', { name: 'Quản trị tổ chức' }).getAttribute('href')).toBe('/org-a/quan-tri-to-chuc')
  expect(screen.getByRole('link', { name: 'Hồ sơ cá nhân' }).getAttribute('href')).toBe('/org-a/ho-so-ca-nhan')
})

it('shows Quản trị tổ chức exclusively for OWNER and hides it from ADMIN', async () => {
  getOrganization.mockResolvedValue({ id: 'org-a', slug: 'org-a', name: 'Tổ chức A', role: 'ADMIN' })
  render(<WorkspaceAccess slug="org-a"><p>Nội dung workspace</p></WorkspaceAccess>)

  expect(await screen.findByRole('link', { name: 'Quản trị đội ngũ' })).toBeTruthy()
  expect(screen.queryByRole('link', { name: 'Quản trị tổ chức' })).toBeNull()
})

it('collapses and reopens the sidebar while keeping navigation accessible', async () => {
  getOrganization.mockResolvedValue({ id: 'org-a', slug: 'org-a', name: 'Tổ chức A', role: 'OWNER' })
  render(<WorkspaceAccess slug="org-a"><p>Nội dung workspace</p></WorkspaceAccess>)

  fireEvent.click(await screen.findByRole('button', { name: 'Thu gọn menu bên trái' }))
  expect(document.querySelector('.workspace-app-shell')?.classList.contains('is-sidebar-collapsed')).toBe(true)
  expect(screen.getByRole('link', { name: 'Hồ sơ thầu' })).toBeTruthy()

  fireEvent.click(screen.getByRole('button', { name: 'Mở menu bên trái' }))
  expect(document.querySelector('.workspace-app-shell')?.classList.contains('is-sidebar-collapsed')).toBe(false)
})
