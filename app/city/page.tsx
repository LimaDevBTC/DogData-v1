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
export const metadata: Metadata = {
  title: 'Satoshi Plaza — DogCity on the Moon',
  description:
    'The central plaza of DogCity on real lunar terrain, with the DOG mempool alive above it: every pending transaction is a ship in orbit, every block is a landing.',
}

export default function CityPage() {
  return <PlazaClient />
}
