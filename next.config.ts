import type { NextConfig } from 'next'

const config: NextConfig = {
  outputFileTracingRoot: '/Users/yang/Desktop/open_source/vegdog_badminton_webapp',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: '*.googleusercontent.com' },
    ],
  },
}

export default config
