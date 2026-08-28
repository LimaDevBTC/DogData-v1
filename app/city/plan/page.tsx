import type { Metadata } from 'next'
import PlanClient from './plan-client'

// A prancha de fundação da DogCity. Página de trabalho, não de vitrine: ela
// existe para o fundador decidir declive e tamanho de lote OLHANDO, em vez de
// discutir número em texto. Ver fundacao.md, fase 1.
const TITLE = 'DogCity · fundação · prancha 1'
const DESCRIPTION =
  'Quanta terra existe no sítio lunar de Mare Tranquillitatis, medida célula a célula no relevo real da NASA, e quantos lotes cabem em cada cenário de declive.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  robots: { index: false, follow: false },
}

export default function PlanPage() {
  return <PlanClient />
}
