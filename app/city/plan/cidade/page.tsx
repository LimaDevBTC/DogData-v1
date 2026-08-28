import type { Metadata } from 'next'
import CidadeClient from './cidade-client'

// Prancha 4: A CIDADE. Implementa o capítulo 6 do plano-diretor.md com a ordem
// de chegada de verdade, mais as camadas de enclave de família e do condomínio
// do Dog Social Club. Ver fundacao.md.
export const metadata: Metadata = {
  title: 'DogCity · fundação · prancha 4 · a cidade',
  description:
    '52.994 carteiras endereçadas em 12 setores pela ordem de chegada real, com enclaves de família e o condomínio do Dog Social Club.',
  robots: { index: false, follow: false },
}

export default function CidadePage() {
  return <CidadeClient />
}
