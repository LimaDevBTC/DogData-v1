import type { Metadata } from 'next'
import WarClientWrapper from './war-client-wrapper'
import { OG_URL, OG_ALT, OG_IMAGE } from '@/lib/og'

const TITLE = 'The Price War'
const DESCRIPTION =
  'The live DOG/USD order book as a battlefield on the Moon: Shiba soldiers in Bitcoin orange versus the bears, every trade a strike, straight from Kraken.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: 'website',
    images: [OG_IMAGE],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: [OG_URL],
  },
}

export default function CityWarPage() {
  return <WarClientWrapper />
}
