import type { Metadata } from 'next'
import FormaClient from './forma-client'

// Prancha 2 da fundação: a FORMA. A prancha 1 respondeu quanta terra existe;
// esta responde que desenho ela faz quando 52.999 carteiras são plantadas por
// idade de UTXO no ângulo áureo. Ver fundacao.md.
export const metadata: Metadata = {
  title: 'DogCity · fundação · prancha 2 · a forma',
  description:
    'A cidade vista de cima: 52.999 carteiras plantadas por idade de UTXO no ângulo áureo de 137,50776°, sobre o relevo real da Lua.',
  robots: { index: false, follow: false },
}

export default function FormaPage() {
  return <FormaClient />
}
