import type { Metadata } from 'next'
import { CityPageClient } from './city-page-client'

export const metadata: Metadata = {
  title: 'DogCity — The First On-Chain City of Bitcoin Runes | dogdata.xyz',
  description:
    '86,317 $DOG holders. 5 districts. One living on-chain city. Claim your building, register your business, join the global rewards network. Coming soon on dogdata.xyz.',
  openGraph: {
    title: 'DogCity — Coming Soon | dogdata.xyz',
    description:
      'The first on-chain city of Bitcoin Runes. Every $DOG holder is a building. Claim yours.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DogCity — The First On-Chain City of Bitcoin Runes',
    description:
      '86,317 holders. 5 districts. Coming soon on dogdata.xyz. Follow @dogdatabtc for launch updates.',
  },
}

export default function CityPage() {
  return <CityPageClient />
}
