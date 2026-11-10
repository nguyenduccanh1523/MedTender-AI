'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

import { Logo } from '../../../components/brand/logo'
import { ThemeToggle } from '../../../components/theme/theme-toggle'
import { readCachedUser } from '../../auth/session-cache'
import type { PublicUser } from '../../auth/api'

const links = [
  { href: '/nen-tang', label: 'Nền tảng' },
  { href: '/quy-trinh', label: 'Quy trình' },
  { href: '/quan-tri', label: 'Quản trị' },
  { href: '/tai-lieu', label: 'Tài liệu' },
]

let inMemoryCachedUser: PublicUser | undefined | null = null

function getInitialUser(): PublicUser | undefined {
  if (typeof window === 'undefined') return undefined
  if (inMemoryCachedUser !== null) return inMemoryCachedUser || undefined
  const cached = readCachedUser()
  inMemoryCachedUser = cached || undefined
  return cached || undefined
}

export function MarketingHeader() {
  const pathname = usePathname()
  const [sessionUser, setSessionUser] = useState<PublicUser | undefined>(getInitialUser)

  useEffect(() => {
    const cached = readCachedUser()
    if (cached) {
      inMemoryCachedUser = cached
      queueMicrotask(() => {
        setSessionUser(cached)
      })
    }
  }, [])

  return (
    <header className="enterprise-header">
      <div className="enterprise-header-row">
        <Logo />
        <nav aria-label="Điều hướng sản phẩm">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={pathname === link.href ? 'is-active' : undefined}
              aria-current={pathname === link.href ? 'page' : undefined}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="enterprise-header-actions">
          <ThemeToggle />
          {sessionUser ? (
            <Link className="marketing-session-pill" href="/organizations">
              <i aria-hidden="true" />
              Vào Workspace ({sessionUser.name.replace(/\s+(Owner|Admin|Reviewer|Bid Manager|Catalog Manager|Analyst|Viewer)$/i, '')}) →
            </Link>
          ) : (
            <Link href="/login">Đăng nhập</Link>
          )}
          <Link className="button enterprise-cta" href="/apply">
            Đăng ký tổ chức
          </Link>
        </div>
      </div>
    </header>
  )
}
