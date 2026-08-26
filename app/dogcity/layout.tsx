import type { Metadata } from 'next'

// The landing itself is a client component, so it cannot export metadata.
// This layout carries it.
//
// Without this the official entry page inherited the explorer's title —
// "DOG DATA — Real-time DOG•GO•TO•THE•MOON Rune Data API & Explorer" — which is
// what every share card and browser tab showed. The copy below is taken
// verbatim from the page's own hero and from LOT_SEGMENTATION in
// dogcity-data.ts, so nothing here claims anything the page does not.
export const metadata: Metadata = {
  title: 'DogCity: a virtual city for DOG holders, on real lunar terrain | dogdata.xyz',
  description:
    'DogCity is a virtual city for DOG holders, built over real mapped lunar terrain. Participating wallets can become properties, placed by DOG history and connected to Bitcoin.',
  openGraph: {
    title: 'DogCity: turn your DOG wallet into part of the Moon',
    description:
      'A virtual city for DOG holders built over mapped lunar elevation data at Mare Tranquillitatis. 97,673 lots demarcated across BTC, SOL and STX holders.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DogCity: turn your DOG wallet into part of the Moon',
    description:
      'A virtual city for DOG holders, built over real mapped lunar terrain. 97,673 lots demarcated. Construction is already underway.',
  },
}

export default function DogCityLayout({ children }: { children: React.ReactNode }) {
  return children
}
