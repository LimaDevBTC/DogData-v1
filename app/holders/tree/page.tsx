import type { Metadata } from 'next'
import TreeClientWrapper from './tree-client-wrapper'

const TITLE = '$DOG Galaxy'
const DESCRIPTION =
  'The living galaxy of DOG: every wallet since the airdrop, branching from the treasury star by star, with Flow and Graph lenses for deep on-chain analysis.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: TITLE,
    description: DESCRIPTION,
  },
}

export default function HoldersTreePage() {
  return <TreeClientWrapper />
}
