import type { Metadata } from 'next'

// The landing itself is a client component, so it cannot export metadata.
// This layout carries it.
//
// Without this the official entry page inherited the explorer's title —
// "DOG DATA — Real-time DOG•GO•TO•THE•MOON Rune Data API & Explorer" — which is
// what every share card and browser tab showed. The copy below is taken
// verbatim from the page's own hero and from LOT_SEGMENTATION in
// dogcity-data.ts, so nothing here claims anything the page does not.
// ⚠️ OS NÚMEROS AQUI SÃO MEDIDOS, NÃO ARREDONDADOS DE MEMÓRIA. A versão anterior
// dizia "97.673 lotes" e a cidade publicada tem 85.843 — o número vinha de uma
// contagem antiga que somava BTC, SOL e STX, e a cidade de hoje é só BTC. Sempre
// conferir contra `public/city/cidade.json` antes de mexer nesta cópia:
//   carteiras 85.843 · área de lote 30,36 km² · lote mediano 238 m²
//
// ⚠️ E A IMAGEM É OBRIGATÓRIA. Não havia `images` aqui, então todo link
// compartilhado do /dogcity aparecia como card sem imagem — o pior formato
// possível para um anúncio.
// ⚠️ O `?v=` existe porque X e Facebook guardam a chapa pela URL e não
// voltam a buscar quando o arquivo muda no mesmo caminho. Ao trocar o JPG,
// incremente o número, senão o post sai com a imagem antiga.
const OG = 'https://www.dogdata.xyz/og-dogcity.jpg?v=3'

export const metadata: Metadata = {
  title: 'DogCity: a virtual city for DOG holders, on real lunar terrain | dogdata.xyz',
  description:
    'DogCity is a virtual city for DOG holders, built over real mapped lunar terrain. Every self-custody DOG wallet already has a plot: 85,843 of them, placed by DOG history and connected to Bitcoin.',
  openGraph: {
    title: 'DogCity: every DOG wallet already has a plot on the Moon',
    description:
      'Built over mapped lunar elevation at Mare Tranquillitatis. 85,843 wallets, 30.36 km² of plots under a single dome. Balance snapshot Sunday, September 6, 12 PM ET.',
    type: 'website',
    url: 'https://www.dogdata.xyz/dogcity',
    siteName: 'DOG DATA',
    images: [{ url: OG, width: 1200, height: 630,
               alt: 'Inside the DogCity dome at Mare Tranquillitatis: the honeycomb shell overhead, the bay, the road web and Satoshi Plaza' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DogCity: every DOG wallet already has a plot on the Moon',
    description:
      '85,843 wallets mapped over real lunar terrain. Balance snapshot Sunday, September 6, 12 PM ET.',
    images: [OG],
  },
}

export default function DogCityLayout({ children }: { children: React.ReactNode }) {
  return children
}
