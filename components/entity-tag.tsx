import Image from 'next/image'
import { BadgeCheck, Search } from 'lucide-react'

/**
 * O nome de quem é dono do endereço, com o logo, onde quer que o endereço apareça.
 *
 * ⚠️ AS DUAS PROCEDÊNCIAS NÃO PODEM PARECER A MESMA COISA. "A Bitget disse que
 * este endereço é dela", com taxa paga e arquivo enviado, é uma afirmação de peso
 * diferente de "a gente concluiu que este é da Kraken olhando o fluxo". As duas
 * são úteis; passar a segunda como se fosse a primeira é onde um explorer perde a
 * autoridade que levou anos para juntar. O selo diz qual é qual, e o title conta
 * a prova para quem passar o mouse.
 */

export interface Identity {
  address: string
  name: string
  logo: string | null
  kind: string | null
  role: string | null
  source: 'verified' | 'onchain'
  evidence: string | null
  evidence_note: string | null
  website?: string | null
  twitter?: string | null
}

/** O grau da prova, dito em inglês simples para quem passa o mouse. */
const PROVA: Record<string, string> = {
  own_flow: 'our own transactions with this wallet',
  first_party: 'address published by the entity itself',
  co_flow: 'exclusive one-way flow with a proven address',
  topology: 'input co-spend clustering',
  third_party: 'reported by an outside source',
}

export function EntityTag({ identity, className = '' }: { identity: Identity; className?: string }) {
  const verificado = identity.source === 'verified'
  const porque = verificado
    ? 'Verified by the owner'
    : `Labelled by DogData · ${PROVA[identity.evidence || ''] || 'on-chain analysis'}`
  const titulo = identity.evidence_note ? `${porque}\n${identity.evidence_note}` : porque

  return (
    <span
      title={titulo}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[10px] ${
        verificado
          ? 'border-lava/25 bg-lava/[0.07] text-snow/85'
          : 'border-white/[0.08] bg-white/[0.03] text-dusty/70'
      } ${className}`}
    >
      {identity.logo ? (
        <Image src={identity.logo} alt="" width={12} height={12} className="h-3 w-3 rounded-sm object-contain" unoptimized />
      ) : verificado ? (
        <BadgeCheck className="h-2.5 w-2.5 flex-shrink-0 text-lava" aria-hidden />
      ) : (
        <Search className="h-2.5 w-2.5 flex-shrink-0 text-dusty/50" aria-hidden />
      )}
      <span className="max-w-[12rem] truncate">{identity.name}</span>
      {identity.role && <span className="text-dusty/40">· {identity.role}</span>}
      {/* ⚠️ o selo só aparece na verificada. Ausência de selo é a marca da nossa
          própria dedução, e é assim que a diferença fica visível sem ocupar
          espaço em cada linha de uma tabela cheia. */}
      {verificado && !identity.logo && <span className="sr-only">verified</span>}
    </span>
  )
}
