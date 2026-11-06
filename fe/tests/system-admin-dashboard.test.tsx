import { render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn() }) }))
vi.mock('../src/features/auth/api', () => ({ getCurrentUser: vi.fn().mockResolvedValue({ id: 'admin', name: 'System Admin', email: 'admin@example.test', systemRole: 'SYSTEM_ADMIN' }), logout: vi.fn() }))
vi.mock('../src/features/provisioning/api', () => ({
  listOrganizationApplications: vi.fn().mockResolvedValue([{ id: 'app-1', reference: 'MTA-2026', organizationName: 'Bệnh viện An Tâm', taxCode: '0123', address: 'TP.HCM', contactName: 'Lan', contactEmail: 'lan@example.test', contactPhone: '0901', status: 'PENDING', createdAt: new Date().toISOString() }]),
  approveOrganizationApplication: vi.fn(), rejectOrganizationApplication: vi.fn(),
}))

import { SystemAdminDashboard } from '../src/features/provisioning/components/system-admin-dashboard'

it('shows an operations approval queue with the approval action', async () => {
  render(<SystemAdminDashboard />)

  expect(await screen.findByText('Hàng chờ phê duyệt')).toBeTruthy()
  expect(screen.getByText('Thông tin pháp lý & liên hệ')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Phê duyệt và cấp OWNER' })).toBeTruthy()
})
