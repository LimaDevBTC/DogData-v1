import type { Metadata } from 'next'
import PlazaClient from './plaza/plaza-client'

// /city IS the plaza now (praca-central.md, D3): Satoshi Plaza on real Mare
// Tranquillitatis terrain, with the DOG mempool in orbit above it. The landing at
// /dogcity stays the front door of the site (the root sends every new session
// there) and sends people here; the shared header's DogCity item, which points at
// /city, lands on the plaza directly.
//
// The route used to 307-redirect to /dogcity while the city was not public. That
// redirect was deliberately temporary so this day would not have to fight a
// browser cache.
const TITLE = 'Satoshi Plaza · DogCity on the Moon'
const DESCRIPTION =
  'The central plaza of DogCity on real lunar terrain, with the DOG mempool alive above it: every pending transaction is a ship in orbit, every block is a landing.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: 'website',
    images: [{ url: '/city/og-plaza.jpg', width: 1200, height: 630, alt: 'Satoshi Plaza: the Needle, Kray Tower, BitFlow HQ and the OrdCards Chalet on the Moon, DOG ships in orbit' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: ['/city/og-plaza.jpg'],
  },
}

export default function CityPage() {
  return <PlazaClient />
}
