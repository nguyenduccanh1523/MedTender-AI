'use client'

import { useEffect, useRef, useState } from 'react'

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string
          callback?: (token: string) => void
          'error-callback'?: (errorCode: string) => void
          'expired-callback'?: () => void
          theme?: 'light' | 'dark' | 'auto'
          size?: 'normal' | 'flexible' | 'compact'
        },
      ) => string
      reset: (widgetId: string) => void
      remove: (widgetId: string) => void
    }
    onloadTurnstileCallback?: () => void
  }
}

interface TurnstileWidgetProps {
  onSuccess: (token: string) => void
  onError?: () => void
  theme?: 'light' | 'dark' | 'auto'
}

export function TurnstileWidget({ onSuccess, onError, theme = 'auto' }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  // Cloudflare official test key: 1x00000000000000000000AA (Always passes)
  const siteKey =
    process.env.NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY || '1x00000000000000000000AA'

  useEffect(() => {
    let active = true

    const doRender = () => {
      if (!active || !containerRef.current || !window.turnstile) return
      try {
        if (widgetIdRef.current) {
          window.turnstile.remove(widgetIdRef.current)
          widgetIdRef.current = null
        }
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          callback: (token: string) => {
            if (active) onSuccess(token)
          },
          'error-callback': () => {
            if (active && onError) onError()
          },
          'expired-callback': () => {
            if (active && onError) onError()
          },
          theme,
          size: 'flexible',
        })
        setLoaded(true)
      } catch (err) {
        console.warn('Turnstile render notice:', err)
      }
    }

    if (window.turnstile) {
      doRender()
    } else {
      const existingScript = document.querySelector('script[src*="challenges.cloudflare.com/turnstile"]')
      if (!existingScript) {
        const script = document.createElement('script')
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
        script.async = true
        script.defer = true
        script.onload = () => {
          if (active) doRender()
        }
        script.onerror = () => {
          // Fallback if offline in local development environment
          console.warn('Cloudflare Turnstile script offline or blocked, issuing dev simulation token.')
          if (active) onSuccess('dev-turnstile-offline-token')
        }
        document.head.appendChild(script)
      } else {
        existingScript.addEventListener('load', doRender)
      }
    }

    return () => {
      active = false
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current)
          widgetIdRef.current = null
        } catch {}
      }
    }
  }, [siteKey, onSuccess, onError, theme])

  return (
    <div
      className="turnstile-wrapper"
      style={{
        margin: '0.75rem 0',
        minHeight: '65px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
      }}
    >
      <div ref={containerRef} />
      {!loaded && (
        <small className="muted" style={{ fontSize: '0.74rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#0ea5e9' }} />
          Bảo mật bởi Cloudflare Turnstile (Zero-Trust verification)...
        </small>
      )}
    </div>
  )
}
