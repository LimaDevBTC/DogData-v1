import Image from 'next/image'
import { BadgeCheck, Landmark, Search } from 'lucide-react'
import { EVIDENCE, KINDS, type ClaimLevel, type Evidence, type WalletKind } from '@/lib/dog/taxonomy'

/**
 * O nome de quem é dono do endereço, com o logo, onde quer que o endereço apareça.
 *
 * ⚠️ TRÊS NÍVEIS DE AFIRMAÇÃO E TRÊS DESENHOS, porque as três coisas que a gente
 * pode dizer sobre uma carteira não têm o mesmo peso:
 *
 *   verified    "a Bitget disse que este endereço é dela", com taxa paga e
 *               arquivo enviado. Borda lava, nome cheio, selo.
 *   named       "a gente concluiu que este é da Kraken olhando o fluxo". Borda
 *               neutra, nome cheio, sem selo.
 *   classified  "a gente sabe que isto é um mercado e não sabe de quem é".
 *               Borda tracejada, e o que aparece é a CLASSE, não um nome.
 *
 * As três são úteis. Passar a terceira como se fosse a primeira é onde um
 * explorer perde a autoridade que levou anos para juntar. O `title` conta a prova
 * e a definição da classe para quem parar em cima.
 */

export interface Identity {
  address: string
  name: string
  claim?: ClaimLevel
  logo: string | null
  kind: string | null
  role: string | null
  source: 'verified' | 'onchain'
  evidence: string | null
  evidence_note: string | null
  website?: string | null
  twitter?: string | null
}

const ESTILO: Record<ClaimLevel, string> = {
  verified: 'border-lava/25 bg-lava/[0.07] text-snow/85',
  named: 'border-white/[0.08] bg-white/[0.03] text-dusty/70',
  // ⚠️ tracejada de propósito: a borda quebrada é a leitura instantânea de
  // "sabemos o que faz, não de quem é". Sem ela, classe e nome próprio ficam
  // com a mesma cara e a distinção morre na tela.
  classified: 'border-dashed border-white/[0.10] bg-transparent text-dusty/60',
}

function porQue(i: Identity, nivel: ClaimLevel): string {
  if (nivel === 'verified') return 'Verified by the owner'
  const prova = EVIDENCE[(i.evidence || '') as Evidence]
  const base = `Labelled by DogData · ${prova ? prova.label : 'on-chain analysis'}`
  const classe = KINDS[(i.kind || '') as WalletKind]
  const linhas = [base]
  if (nivel === 'classified' && classe) {
    linhas.push(classe.definition, `Signature: ${classe.signature}`)
  }
  if (i.evidence_note) linhas.push(i.evidence_note)
  return linhas.join('\n')
}

export function EntityTag({ identity, className = '' }: { identity: Identity; className?: string }) {
  const nivel: ClaimLevel = identity.claim ?? (identity.source === 'verified' ? 'verified' : 'named')
  const titulo = porQue(identity, nivel)

  return (
    <span
      title={titulo}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[10px] ${ESTILO[nivel]} ${className}`}
    >
      {identity.logo ? (
        <Image src={identity.logo} alt="" width={12} height={12} className="h-3 w-3 rounded-sm object-contain" unoptimized />
      ) : nivel === 'verified' ? (
        <BadgeCheck className="h-2.5 w-2.5 flex-shrink-0 text-lava" aria-hidden />
      ) : nivel === 'classified' ? (
        <Landmark className="h-2.5 w-2.5 flex-shrink-0 text-dusty/50" aria-hidden />
      ) : (
        <Search className="h-2.5 w-2.5 flex-shrink-0 text-dusty/50" aria-hidden />
      )}
      <span className="max-w-[12rem] truncate whitespace-nowrap">{identity.name}</span>
      {identity.role && <span className="text-dusty/40">· {identity.role}</span>}
    </span>
  )
}
