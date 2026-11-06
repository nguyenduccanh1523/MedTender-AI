import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

import GovernancePage from '../src/app/quan-tri/page'
import PlatformPage from '../src/app/nen-tang/page'
import WorkflowPage from '../src/app/quy-trinh/page'

vi.mock('next/navigation', () => ({ usePathname: () => '/quan-tri' }))
afterEach(cleanup)

it('gives the platform page its own evidence-first product overview', () => {
  render(<PlatformPage />)

  expect(screen.getByRole('heading', { name: /Không phải một chatbot/ })).toBeTruthy()
  expect(screen.getByText('Tender → lot → item → requirement')).toBeTruthy()
})

it('gives the workflow page its own operational timeline', () => {
  render(<WorkflowPage />)

  expect(screen.getByRole('heading', { name: /Mỗi quyết định đều có đường đi rõ ràng/ })).toBeTruthy()
  expect(screen.getByText('Tiếp nhận hồ sơ')).toBeTruthy()
})

it('gives the governance page a dedicated approval model', () => {
  const view = render(<GovernancePage />)

  expect(screen.getByRole('heading', { name: /Mỗi quyền hạn có một người chịu trách nhiệm/ })).toBeTruthy()
  expect(screen.getByRole('heading', { name: /Không gian làm việc chỉ mở sau khi hồ sơ được duyệt/ })).toBeTruthy()
  expect(within(view.container).getByRole('link', { name: 'Quản trị' }).getAttribute('aria-current')).toBe('page')
})
