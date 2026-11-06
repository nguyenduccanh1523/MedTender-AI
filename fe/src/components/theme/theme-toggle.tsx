'use client'

import { useEffect, useSyncExternalStore } from 'react'

export type ThemeMode = 'light' | 'dark'

const STORAGE_KEY = 'medtender:theme'
const THEME_EVENT = 'medtender-theme-change'

function getSnapshot(): ThemeMode {
  if (typeof document === 'undefined') return 'light'
  const attr = document.documentElement.dataset.theme
  if (attr === 'dark' || attr === 'light') return attr
  if (typeof window !== 'undefined') {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY)
      if (saved === 'dark' || saved === 'light') return saved
    } catch {
      /* ignore storage errors */
    }
    if (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark'
    }
  }
  return 'light'
}

function getServerSnapshot(): ThemeMode {
  return getSnapshot()
}

function subscribe(callback: () => void) {
  if (typeof window === 'undefined') return () => undefined
  window.addEventListener(THEME_EVENT, callback)
  window.addEventListener('storage', callback)
  return () => {
    window.removeEventListener(THEME_EVENT, callback)
    window.removeEventListener('storage', callback)
  }
}

export function applyTheme(next: ThemeMode) {
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = next
    document.documentElement.style.colorScheme = next
  }
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* ignore storage errors */
    }
    window.dispatchEvent(new CustomEvent<ThemeMode>(THEME_EVENT, { detail: next }))
  }
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
  }, [theme])

  function toggle() {
    const next: ThemeMode = theme === 'dark' ? 'light' : 'dark'
    applyTheme(next)
  }

  const label = theme === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-label={label}
      title={label}
      data-theme-current={theme}
      suppressHydrationWarning
    >
      <svg
        className="theme-icon theme-icon-sun"
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="4.2" />
        <path d="M12 2.5v2.2M12 19.3v2.2M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6" />
      </svg>
      <svg
        className="theme-icon theme-icon-moon"
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M20.4 14.5A8.2 8.2 0 0 1 9.5 3.6a8.2 8.2 0 1 0 10.9 10.9Z" />
      </svg>
    </button>
  )
}
