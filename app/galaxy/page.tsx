import type { Metadata } from 'next'
import TreeClientWrapper from './tree-client-wrapper'

// A CASA do $DOG Galaxy desde 26/08. A URL antiga (/holders/tree) virou um
// 307 pra ca: nenhum link compartilhado quebra. As rotas de API continuam
// em /api/holders/tree/* de proposito: sao endereco interno, mexer nelas so
// invalidaria cache e caches de CDN sem ganho nenhum.
const TITLE = '$DOG Galaxy'
const TITULO_SOCIAL = '$DOG Galaxy: every wallet DOG ever touched, mapped'
const DESCRIPTION =
  'The living galaxy of DOG: all 263,000 wallets since the airdrop, each one a real star sized by its balance, branching from the treasury generation by generation. Click any star to open its dossier, or switch to the Flow and Graph lenses for on-chain analysis.'
const OG = 'https://www.dogdata.xyz/galaxy-og.jpg'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    'DOG',
    'DOG GO TO THE MOON',
    'Runes',
    'Bitcoin',
    'holders',
    'on-chain analysis',
    'wallet genealogy',
    'airdrop',
    'DogData',
  ],
  alternates: { canonical: 'https://www.dogdata.xyz/galaxy' },
  openGraph: {
    type: 'website',
    url: 'https://www.dogdata.xyz/galaxy',
    siteName: 'DOG DATA',
    title: TITULO_SOCIAL,
    description: DESCRIPTION,
    images: [
      {
        url: OG,
        width: 1200,
        height: 630,
        alt: 'The $DOG Galaxy: the airdrop treasury at the centre, every generation of wallets a spherical shell around it',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@dogdatabtc',
    creator: '@dogdatabtc',
    title: TITULO_SOCIAL,
    description: DESCRIPTION,
    images: [OG],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
}

// Dado estruturado: o Google entende que a pagina e um dataset navegavel,
// nao um artigo. Numeros aqui sao os do universo mapeado, nao promessa.
const JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'Dataset',
  name: '$DOG Galaxy: DOG wallet genealogy',
  description: DESCRIPTION,
  url: 'https://www.dogdata.xyz/galaxy',
  creator: { '@type': 'Organization', name: 'DOG DATA', url: 'https://www.dogdata.xyz' },
  license: 'https://www.dogdata.xyz',
  isAccessibleForFree: true,
  keywords: ['DOG', 'Bitcoin Runes', 'wallet genealogy', 'airdrop', 'on-chain'],
  temporalCoverage: '2024-04/..',
  spatialCoverage: 'Bitcoin mainnet',
}

export default function GalaxyPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />
      <TreeClientWrapper />
    </>
  )
}
