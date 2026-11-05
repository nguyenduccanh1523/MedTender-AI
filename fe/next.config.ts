import type { NextConfig } from 'next'

const apiOrigin = (process.env.MEDTENDER_API_ORIGIN ?? 'http://127.0.0.1:3001').replace(/\/$/, '')

const config: NextConfig = {
  agentRules: false,
  async rewrites() {
    return [{ source: '/api/v1/:path*', destination: `${apiOrigin}/api/v1/:path*` }]
  },
}

export default config
