import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'DOG DATA - Real-time DOG Rune Explorer',
  description: 'Professional explorer for DOG•GO•TO•THE•MOON rune with real-time data, holder lists, statistics and exclusive forensic analysis.',
  keywords: 'DOG, Bitcoin, Rune, Ordinals, Holders, Blockchain, Explorer, Real-time, Forensic Analysis',
  authors: [{ name: 'DOG DATA Team' }],
  viewport: 'width=device-width, initial-scale=1',
  themeColor: '#f97316',
  icons: {
    icon: '/dog-logo.png',
    shortcut: '/dog-logo.png',
    apple: '/dog-logo.png',
  },
  openGraph: {
    title: 'DOG DATA - DOG Rune Explorer',
    description: 'Professional explorer for DOG rune with real-time data and forensic analysis',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DOG DATA - DOG Rune Explorer',
    description: 'Professional explorer for DOG rune with real-time data and forensic analysis',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <div className="min-h-screen bg-gradient-to-br from-dog-gray-900 via-black to-dog-gray-900">
          {children}
        </div>
      </body>
    </html>
  )
}
