import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'

import HomePage from '../src/app/page'

it('renders the MedTender AI landing page', () => {
  render(<HomePage />)

  expect(screen.getByRole('heading', { level: 1, name: /Quyết định rõ ràng/ })).toBeTruthy()
  expect(screen.getByRole('navigation', { name: 'Điều hướng sản phẩm' })).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Nền tảng' }).getAttribute('href')).toBe('/nen-tang')
  expect(screen.getByRole('link', { name: 'Quy trình' }).getAttribute('href')).toBe('/quy-trinh')
  expect(screen.getByText('Mua sắm y tế có kiểm soát')).toBeTruthy()
  expect(screen.getByRole('heading', { name: /Một workspace chung/ })).toBeTruthy()
  expect(screen.getAllByRole('link', { name: 'Đăng ký tổ chức' }).every((link) => link.getAttribute('href') === '/apply')).toBe(true)
})
