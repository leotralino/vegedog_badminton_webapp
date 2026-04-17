import type { Metadata, Viewport } from 'next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

export const metadata: Metadata = {
  title: '菜狗 Badminton',
  description: 'Badminton session sign-up and queue management',
  manifest: '/manifest.json',
  icons: {
    apple: '/icon-180.png',
    icon: '/icon-192.png',
  },
  appleWebApp: {
    capable: true,
    title: '菜狗',
    statusBarStyle: 'default',
  },
  openGraph: {
    title: '菜狗 Badminton',
    description: 'Badminton session sign-up and queue management',
    images: [{ url: '/icon-512.png', width: 512, height: 512 }],
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#16a34a',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hans">
      <body className="min-h-screen">
        {children}
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  )
}
