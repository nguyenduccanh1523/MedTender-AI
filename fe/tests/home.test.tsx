import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'

import HomePage from '../src/app/page'

it('renders the MedTender AI landing page', () => {
  render(<HomePage />)

  expect(screen.getByRole('heading', { level: 1, name: 'MedTender AI' })).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Đăng ký tổ chức' }).getAttribute('href')).toBe('/apply')
})
