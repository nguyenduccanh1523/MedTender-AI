import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'

import { ThemeToggle } from '../src/components/theme/theme-toggle'

afterEach(() => {
  cleanup()
  delete document.documentElement.dataset.theme
})

it('toggles between light and dark theme on the document root', () => {
  document.documentElement.dataset.theme = 'light'
  render(<ThemeToggle />)

  const button = screen.getByRole('button', { name: 'Chuyển sang giao diện tối' })
  fireEvent.click(button)

  expect(document.documentElement.dataset.theme).toBe('dark')
  expect(screen.getByRole('button', { name: 'Chuyển sang giao diện sáng' })).toBeTruthy()

  fireEvent.click(screen.getByRole('button', { name: 'Chuyển sang giao diện sáng' }))
  expect(document.documentElement.dataset.theme).toBe('light')
})
