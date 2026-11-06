'use client'

import Link from 'next/link'

import { Logo } from '../../../components/brand/logo'

const links = [{ href: '/nen-tang', label: 'Nền tảng' }, { href: '/quy-trinh', label: 'Quy trình' }, { href: '/quan-tri', label: 'Quản trị' }]

export function MarketingHeader() {
  function resetScroll() {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }

  return <header className="enterprise-header"><div className="enterprise-header-row"><Logo /><nav aria-label="Điều hướng sản phẩm">{links.map((link) => <Link key={link.href} href={link.href} scroll onClick={resetScroll}>{link.label}</Link>)}</nav><div><Link href="/login" onClick={resetScroll}>Đăng nhập</Link><Link className="button enterprise-cta" href="/apply" onClick={resetScroll}>Đăng ký tổ chức</Link></div></div></header>
}
