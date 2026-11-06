'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { Logo } from '../../../components/brand/logo'
import { ThemeToggle } from '../../../components/theme/theme-toggle'

const links = [{ href: '/nen-tang', label: 'Nền tảng' }, { href: '/quy-trinh', label: 'Quy trình' }, { href: '/quan-tri', label: 'Quản trị' }]

export function MarketingHeader() {
  const pathname = usePathname()

  return <header className="enterprise-header"><div className="enterprise-header-row"><Logo /><nav aria-label="Điều hướng sản phẩm">{links.map((link) => <Link key={link.href} href={link.href} className={pathname === link.href ? 'is-active' : undefined} aria-current={pathname === link.href ? 'page' : undefined}>{link.label}</Link>)}</nav><div className="enterprise-header-actions"><ThemeToggle /><Link href="/login">Đăng nhập</Link><Link className="button enterprise-cta" href="/apply">Đăng ký tổ chức</Link></div></div></header>
}
