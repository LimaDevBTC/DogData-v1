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
  'DogCity on real lunar terrain: the bay, the road web, and Satoshi Plaza under the dome, with the DOG mempool alive above it. Every DOG holder gets a plot at the snapshot.'

// ⚠️ A METADATA NÃO ENXERGA A QUERY. `/city?view=home` e `/city` servem estas
// mesmas etiquetas, porque `metadata` estático resolve por ROTA e o buscador
// nunca vê `?view=`. Então não existe "adicionar OG ao ?view=home" separado: o
// que existe é manter ESTE bloco em dia, que é o que sai em toda variante.
//
// ⚠️ A IMAGEM LEVA `?v=`, e isso não é enfeite. X e Facebook guardam a chapa
// pela URL e não voltam a buscar quando o arquivo muda no mesmo caminho: sem o
// selo, o post de hoje sairia com a chapa de 18/08, que é anterior à baía, às
// vias, ao canal e à abóbada. Ao trocar o JPG, incremente o número.
const OG = '/city/og-plaza.jpg?v=3'
const OG_ALT =
  'Inside the DogCity dome on the Moon: the honeycomb shell overhead with stars through it, the bay, the radial road web, and Satoshi Plaza with the Needle, Kray Tower, BitFlow HQ and the OrdCards Chalet'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: 'website',
    url: '/city',
    siteName: 'DOG DATA',
    images: [{ url: OG, width: 1200, height: 630, alt: OG_ALT }],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: [OG],
  },
  alternates: { canonical: '/city' },
}

export default function CityPage() {
  return <PlazaClient />
}
