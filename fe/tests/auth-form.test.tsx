import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

import { AuthForm } from '../src/features/auth/components/auth-form'

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }))

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  replace.mockClear()
})

it('shows a login error and allows the user to submit again', async () => {
  const fetcher = vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ message: 'Email hoặc mật khẩu không đúng.' }), { status: 401 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'u1', name: 'Analyst', email: 'user@example.test' })))
  vi.stubGlobal('fetch', fetcher)
  render(<AuthForm mode="login" />)
  expect(screen.getByRole('button', { name: 'Đăng nhập' }).closest('form')?.method).toBe('post')

  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'user@example.test' } })
  fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'ExamplePass2026!' } })
  fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }))
  expect((await screen.findByRole('alert')).textContent).toContain('Email hoặc mật khẩu không đúng.')
  expect(replace).not.toHaveBeenCalled()

  fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }))
  await waitFor(() => expect(replace).toHaveBeenCalledWith('/organizations'))
  expect(fetcher).toHaveBeenCalledTimes(2)
})
