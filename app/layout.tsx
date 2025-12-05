import type { Metadata, Viewport } from 'next'
import { Inter, DM_Sans } from 'next/font/google'
import './globals.css'
import { Analytics } from "@vercel/analytics/next"
import { SpeedInsights } from "@vercel/speed-insights/next"
import { VerifiedAddressesProvider } from '@/contexts/VerifiedAddressesContext'

const inter = Inter({ subsets: ['latin'] })
const dmSans = DM_Sans({ subsets: ['latin'], weight: ['700'], variable: '--font-dm-sans' })

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#f97316',
}

export const metadata: Metadata = {
  // Primary Meta Tags
  title: 'DOG DATA | Real-time DOG Rune Explorer & Analytics',
  description: 'Professional explorer for DOG•GO•TO•THE•MOON rune with real-time data, holder analytics, transaction tracking, and exclusive forensic analysis. Track over 101,855 holders across Bitcoin, Solana, and Stacks.',
  keywords: 'DOG, Bitcoin, Rune, Ordinals, Holders, Blockchain, Explorer, Real-time, Forensic Analysis, DOG Rune, Bitcoin Runes, Rune Analytics',
  authors: [{ name: 'DOG DATA Team' }],
  metadataBase: new URL('https://www.dogdata.xyz'),
  alternates: {
    canonical: '/',
  },
  // Icons
  icons: {
    icon: '/favicondog.png',
    shortcut: '/favicondog.png',
    apple: '/favicondog.png',
  },
  // Open Graph / Facebook
  openGraph: {
    type: 'website',
    url: 'https://www.dogdata.xyz',
    title: 'DOG DATA | Real-time DOG Rune Explorer & Analytics',
    description: 'Professional explorer for DOG•GO•TO•THE•MOON rune with real-time data, holder analytics, transaction tracking, and exclusive forensic analysis. Track over 101,855 holders across Bitcoin, Solana, and Stacks.',
    siteName: 'DOG DATA',
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
  // Twitter
  twitter: {
    card: 'summary_large_image',
    site: '@dogdatabtc',
    creator: '@dogdatabtc',
    title: 'DOG DATA | Real-time DOG Rune Explorer & Analytics',
    description: 'Professional explorer for DOG•GO•TO•THE•MOON rune with real-time data, holder analytics, transaction tracking, and exclusive forensic analysis.',
    images: ['/DOGDATAOG.png'],
  },
  // Additional metadata
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    // Add verification codes if needed
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} ${dmSans.variable}`}>
        <VerifiedAddressesProvider>
          <div className="min-h-screen bg-gradient-to-br from-dog-gray-900 via-black to-dog-gray-900">
            {children}
          </div>
        </VerifiedAddressesProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
