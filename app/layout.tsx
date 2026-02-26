import type { Metadata, Viewport } from 'next'
import { JetBrains_Mono, Syne } from 'next/font/google'
import './globals.css'
import { Analytics } from "@vercel/analytics/next"
import { SpeedInsights } from "@vercel/speed-insights/next"
import { VerifiedAddressesProvider } from '@/contexts/VerifiedAddressesContext'

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
})

const syne = Syne({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-display',
  display: 'swap',
})

const siteUrl = (() => {
  const u = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
  if (!u) return 'https://dogdata.xyz'
  return u.startsWith('http') ? u.replace(/\/$/, '') : `https://${u}`
})()

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#F56E0F',
}

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'DOG DATA - Real-time DOG Rune Explorer',
  description: 'Professional explorer for DOG•GO•TO•THE•MOON rune with real-time data, holder lists, statistics and exclusive forensic analysis.',
  keywords: 'DOG, Bitcoin, Rune, Ordinals, Holders, Blockchain, Explorer, Real-time, Forensic Analysis',
  authors: [{ name: 'DOG DATA Team' }],
  icons: {
    icon: '/favicondog.png',
    shortcut: '/favicondog.png',
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
      { url: '/apple-touch-icon-152x152.png', sizes: '152x152', type: 'image/png' },
      { url: '/apple-touch-icon-167x167.png', sizes: '167x167', type: 'image/png' },
    ],
  },
  openGraph: {
    title: 'DOG DATA - DOG Rune Explorer',
    description: 'Professional explorer for DOG rune with real-time data and forensic analysis',
    type: 'website',
    locale: 'en_US',
    images: [
      {
        url: '/DOGDATAOG.png',
        width: 1200,
        height: 630,
        alt: 'DOG DATA - DOG Rune Explorer',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DOG DATA - DOG Rune Explorer',
    description: 'Professional explorer for DOG rune with real-time data and forensic analysis',
    images: ['/DOGDATAOG.png'],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${jetbrainsMono.variable} ${syne.variable} font-mono`}>
        <VerifiedAddressesProvider>
          <div className="min-h-screen bg-void">
            {children}
          </div>
        </VerifiedAddressesProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
