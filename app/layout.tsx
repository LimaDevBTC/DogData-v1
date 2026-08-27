import type { Metadata, Viewport } from 'next'
import { JetBrains_Mono, Syne, DM_Sans, Instrument_Serif, Barlow } from 'next/font/google'
import './globals.css'
import { VerifiedAddressesProvider } from '@/contexts/VerifiedAddressesContext'
import { WalletProvider } from '@/contexts/WalletContext'
import { DonateProvider } from '@/components/donate/donate-modal'
import { AnalyticsTracker } from '@/components/analytics-tracker'
import { RouteMemory } from '@/components/route-memory'

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

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
})

const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: ['400'],
  style: ['normal', 'italic'],
  variable: '--font-heading',
  display: 'swap',
})

const barlow = Barlow({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-body',
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
  themeColor: '#F7931A',
}

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'DOG DATA \u2014 Real-time DOG\u2022GO\u2022TO\u2022THE\u2022MOON Rune Data API & Explorer',
  description:
    "The world's most comprehensive data platform for DOG rune on Bitcoin L1. " +
    '89,000+ holders, 250,000+ UTXOs, forensic behavioral analysis, multi-exchange pricing. ' +
    '35 REST API endpoints, MCP Server for AI agents, SSE real-time events. ' +
    'Powered by our own Bitcoin Core + Ord full node.',
  keywords: [
    'DOG', 'DOG GO TO THE MOON', 'Bitcoin', 'Rune', 'API', 'MCP Server',
    'AI agents', 'on-chain analytics', 'holders', 'UTXO', 'forensic analysis',
    'Diamond Score', 'real-time', 'blockchain data', 'trading bot', 'DeFi',
  ],
  authors: [{ name: 'DOG DATA Team' }],
  robots: { index: true, follow: true },
  alternates: { canonical: siteUrl },
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
    title: 'DOG DATA API \u2014 89K+ Holders | 35 Endpoints | AI Agent Ready',
    description:
      'Real-time DOG\u2022GO\u2022TO\u2022THE\u2022MOON rune data for AI agents and trading bots. ' +
      'REST API, MCP Server, SSE events. Forensic analysis, multi-exchange pricing, on-chain metrics.',
    type: 'website',
    locale: 'en_US',
    siteName: 'DOG DATA',
    images: [
      {
        url: '/DOGDATAOG.png',
        width: 1200,
        height: 630,
        alt: 'DOG DATA \u2014 The world\'s most comprehensive DOG rune data platform',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DOG DATA API \u2014 Real-time DOG Rune Data for AI Agents',
    description:
      '89K+ holders, 35 API endpoints, MCP Server, SSE events. ' +
      'Forensic analysis & Diamond Score. Bitcoin Core + Ord powered.',
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
      <body className={`${jetbrainsMono.variable} ${syne.variable} ${dmSans.variable} ${instrumentSerif.variable} ${barlow.variable} font-mono`}>
        <VerifiedAddressesProvider>
          <WalletProvider>
            {/* A janela de doação mora na raiz porque o CTA está no rodapé, na
                landing, no perfil e na praça: um provedor só, uma janela só. */}
            <DonateProvider>
              <div className="min-h-screen bg-void">
                {children}
              </div>
            </DonateProvider>
          </WalletProvider>
        </VerifiedAddressesProvider>
        <AnalyticsTracker />
        <RouteMemory />
      </body>
    </html>
  )
}
