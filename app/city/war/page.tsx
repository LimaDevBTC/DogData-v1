import type { Metadata } from 'next'
import WarClientWrapper from './war-client-wrapper'

export const metadata: Metadata = {
  title: 'The Price War',
  description:
    'The live DOG/USD order book as a battlefield on the Moon: Shiba soldiers in Bitcoin orange versus the bears, every trade a strike, straight from Kraken.',
}

export default function CityWarPage() {
  return <WarClientWrapper />
}
