import type { Metadata } from 'next'
import TreeClientWrapper from './tree-client-wrapper'

const TITLE = 'Holders Tree'
const DESCRIPTION =
  'Where the DOG airdrop went: a re-rootable flow map of every generation, from the treasury to exchanges and the wallets still holding today.'

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
