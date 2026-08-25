import type { Metadata } from 'next'
import WarClientWrapper from './war-client-wrapper'

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
    images: [{ url: '/war-og.png', width: 1200, height: 630, alt: 'Shiba army in Bitcoin orange faces the bears across the DOG/USD front line on the Moon' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: ['/war-og.png'],
  },
}

export default function CityWarPage() {
  return <WarClientWrapper />
}
