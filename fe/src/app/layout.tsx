import type { Metadata } from 'next'
import type { ReactNode } from 'react'

import { QueryProvider } from '../providers/query-provider'
import './globals.css'
import './theme.css'
import './tenders.css'

export const metadata: Metadata = {
  title: 'MedTender AI',
  description: 'Hỗ trợ đối chiếu yêu cầu kỹ thuật và bằng chứng trong hồ sơ thầu thiết bị y tế.',
  icons: { icon: '/icon.svg' },
}

const themeBootScript = `(function(){try{var s=localStorage.getItem('medtender:theme');var m=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches;var t=s==='dark'||s==='light'?s:(m?'dark':'light');document.documentElement.dataset.theme=t;document.documentElement.style.colorScheme=t;}catch(e){}})();`

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  )
}
