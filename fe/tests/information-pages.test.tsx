import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'

import GovernancePage from '../src/app/quan-tri/page'
import PlatformPage from '../src/app/nen-tang/page'
import WorkflowPage from '../src/app/quy-trinh/page'

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
  render(<GovernancePage />)

  expect(screen.getByRole('heading', { name: /Quản trị là thiết kế niềm tin/ })).toBeTruthy()
  expect(screen.getByText('System Admin')).toBeTruthy()
})
