import { render } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

import { WorkspaceScrollTop } from '../src/features/organizations/components/workspace-scroll-top'

const { usePathname } = vi.hoisted(() => ({ usePathname: vi.fn() }))
vi.mock('next/navigation', () => ({ usePathname }))

afterEach(() => vi.restoreAllMocks())

it('returns the workspace viewport to the top when the tab route changes', () => {
  const scrollTo = vi.fn()
  Object.defineProperty(window, 'scrollTo', { configurable: true, value: scrollTo })
  usePathname.mockReturnValue('/benh-vien')

  const { rerender } = render(<WorkspaceScrollTop />)
  usePathname.mockReturnValue('/benh-vien/hoat-dong')
  rerender(<WorkspaceScrollTop />)

  expect(scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'instant' })
})
