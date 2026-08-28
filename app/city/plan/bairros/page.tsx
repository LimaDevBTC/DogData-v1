import type { Metadata } from 'next'
import BairrosClient from './bairros-client'

// Prancha 3: O CATÁLOGO. A prancha 1 mediu a terra, a 2 achou a forma, esta
// mostra os 140 bairros, cada um com a sua própria arquitetura, encaixados num
// Voronoi de ângulo áureo. Ver fundacao.md.
export const metadata: Metadata = {
  title: 'DogCity · fundação · prancha 3 · os bairros',
  description:
    '140 bairros de Voronoi sobre sementes de ângulo áureo, cada um com a sua arquitetura interna, e o corredor verde nascendo nas divisas.',
  robots: { index: false, follow: false },
}

export default function BairrosPage() {
  return <BairrosClient />
}
