import type { Metadata } from 'next'
import TreeClientWrapper from './tree-client-wrapper'

const TITLE = 'Holders Tree'
const DESCRIPTION =
  'Every wallet that ever touched DOG as a galaxy: generations orbit the airdrop treasury, lit stars still hold today.'

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
