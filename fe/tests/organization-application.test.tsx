import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

import { OrganizationApplicationForm } from '../src/features/provisioning/components/organization-application-form'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

it('submits an organization application and shows its tracking reference', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
    reference: 'MTA-1A2B3C4D', status: 'PENDING',
  }), { status: 201 })))
  render(<OrganizationApplicationForm />)

  fireEvent.change(screen.getByLabelText('Tên tổ chức'), { target: { value: 'Bệnh viện Minh Tâm' } })
  fireEvent.change(screen.getByLabelText('Mã số thuế'), { target: { value: '0312345678' } })
  fireEvent.change(screen.getByLabelText('Địa chỉ'), { target: { value: '12 Nguyễn Huệ, TP.HCM' } })
  fireEvent.change(screen.getByLabelText('Người phụ trách'), { target: { value: 'Nguyễn Minh Anh' } })
  fireEvent.change(screen.getByLabelText('Email công việc'), { target: { value: 'minhanh@example.test' } })
  fireEvent.change(screen.getByLabelText('Số điện thoại'), { target: { value: '0901234567' } })
  fireEvent.click(screen.getByRole('checkbox'))
  fireEvent.click(screen.getByRole('button', { name: 'Gửi hồ sơ xét duyệt' }))

  expect(await screen.findByRole('heading', { name: 'Hồ sơ đã được tiếp nhận' })).toBeTruthy()
  expect(screen.getByText('MTA-1A2B3C4D')).toBeTruthy()
})
