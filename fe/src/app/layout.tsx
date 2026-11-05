import type { Metadata } from 'next'
import type { ReactNode } from 'react'

import { QueryProvider } from '../providers/query-provider'
import './globals.css'

export const metadata: Metadata = {
  title: 'MedTender AI',
  description: 'Hỗ trợ đối chiếu yêu cầu kỹ thuật và bằng chứng trong hồ sơ thầu thiết bị y tế.',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  )
}
