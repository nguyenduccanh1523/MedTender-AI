'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

export function WorkspaceScrollTop() {
  const pathname = usePathname()
  const previousPathname = useRef(pathname)

  useEffect(() => {
    if (previousPathname.current === pathname) return
    previousPathname.current = pathname
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [pathname])

  return null
}
