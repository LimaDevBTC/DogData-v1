"use client"

import Image from 'next/image'
import Link from 'next/link'
import { Landmark } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Treasury } from '@/lib/dog/treasuries'

/**
 * OS TESOUROS DE DOG, um card só.
 *
 * ⚠️ ERA UM CARD DA C2 E VIROU UMA PRATELEIRA. Enquanto só a C2 aparecia, o
 * card podia ser azul da marca dela e falar em primeira pessoa. Agora que
 * divide espaço com o tesouro do próprio projeto, a superfície volta a ser a
 * placa neutra do resto da home (ver components/ui/card.tsx) e a cor entra pelo
 * logo de cada um. Card de seção não tem dono.
 *
 * ⚠️ E AS DUAS LINHAS NÃO VALEM A MESMA COISA. A C2 é empresa de capital aberto
 * com custódia na Kraken: não existe endereço público dela para conferir, e o
 * que a gente publica é a DECLARAÇÃO raspada do painel próprio. A Dog of
 * Bitcoin é um endereço na cadeia que o próprio projeto verificou, e o saldo é
 * MEDIDO pelo nosso índice. Empilhar os dois sem dizer qual é qual seria
 * emprestar o peso de uma medição a um anúncio. Daí a etiqueta em cada linha.
 */

interface Props {
  treasuries: Treasury[]
  /** cotação do DOG que a home já tem na mão, para os dois valerem pelo mesmo preço */
  dogPrice: number
  className?: string
}

const compactDog = (n: number) =>
  new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(n)

const exactDog = (n: number) =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n)

const usd = (n: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 2,
  }).format(n)

// ⚠️ EM UTC, e não no fuso de quem abre a página. A data que aparece aqui é a
// data da LEITURA, e ela vem carimbada em UTC; formatar no fuso local faz uma
// leitura da meia-noite virar o dia anterior para meio mundo (no Brasil,
// 27/08T00:00Z já imprimia "26 Aug"). Rótulo de procedência com a data errada
// é pior do que rótulo nenhum.
const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' })

const PROVENANCE_LABEL: Record<Treasury['provenance'], string> = {
  declared: 'declared',
  onchain: 'on-chain',
}

const PROVENANCE_TITLE: Record<Treasury['provenance'], string> = {
  declared:
    'Self-reported by the company on its own treasury dashboard. Custody is with Kraken, so there is no public address to verify against.',
  onchain: 'Measured by us on Bitcoin, from the verified address of the project.',
}

function Row({ t, dogPrice }: { t: Treasury; dogPrice: number }) {
  const progress = t.goalDog ? Math.min(t.dog / t.goalDog, 1) : null

  const body = (
    <div className="space-y-1">
      {/* nome + procedência */}
      <div className="flex items-center gap-1.5 min-w-0">
        <div className="relative w-4 h-4 md:w-[18px] md:h-[18px] flex-shrink-0">
          <Image src={t.logo} alt={`${t.name} logo`} fill className="object-contain" sizes="18px" />
        </div>
        <span className="text-[9px] md:text-[11px] font-mono uppercase tracking-wider text-mist truncate">
          {t.name}
        </span>
        <span
          title={PROVENANCE_TITLE[t.provenance]}
          className="text-[8px] md:text-[9px] font-mono uppercase tracking-wider text-dusty flex-shrink-0"
        >
          {PROVENANCE_LABEL[t.provenance]}
          {t.stale ? ` ${shortDate(t.readAt)}` : ''}
        </span>
      </div>

      {/* quantia + valor */}
      <div className="flex items-baseline justify-between gap-1.5">
        <span className="font-mono font-bold text-snow tabular-nums tracking-tight">
          <span className="md:hidden text-xs">{compactDog(t.dog)}</span>
          <span className="hidden md:inline text-[15px]">{exactDog(t.dog)}</span>
          <span className="text-[9px] md:text-[10px] text-dusty ml-1">DOG</span>
        </span>
        {dogPrice > 0 && (
          <span className="text-[9px] md:text-[11px] font-mono text-mist tabular-nums flex-shrink-0">
            {usd(t.dog * dogPrice)}
          </span>
        )}
      </div>

      {/* só quem declarou uma meta ganha barra */}
      {progress !== null && (
        <div className="space-y-1 pt-0.5">
          <div className="h-[3px] w-full bg-white/[0.06] overflow-hidden">
            <div
              className="h-full bg-lava/70 transition-all duration-1000 ease-out"
              style={{ width: `${(progress * 100).toFixed(1)}%` }}
            />
          </div>
          <div className="text-[8px] md:text-[9px] font-mono uppercase tracking-wider text-dusty tabular-nums">
            {(progress * 100).toFixed(1)}% of {compactDog(t.goalDog!)} goal
          </div>
        </div>
      )}
    </div>
  )

  const cls = 'block group hover:opacity-90 transition-opacity duration-200'

  // ⚠️ LINK DE CARTEIRA FICA EM CASA: quando existe endereço, o clique abre o
  // NOSSO explorer. Só a C2, que não tem endereço público, manda para fora.
  return t.external ? (
    <a href={t.href} target="_blank" rel="noopener noreferrer" className={cls}>
      {body}
    </a>
  ) : (
    <Link href={t.href} className={cls}>
      {body}
    </Link>
  )
}

export function TreasuriesCard({ treasuries, dogPrice, className }: Props) {
  if (treasuries.length === 0) return null

  return (
    <Card variant="glass" className={className}>
      <CardHeader className="pb-2">
        <CardTitle
          variant="mono"
          className="text-[11px] md:text-sm text-dusty flex items-center gap-1.5"
        >
          <Landmark className="w-3.5 h-3.5 text-lava/60" />
          Treasuries
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2.5 md:space-y-3">
          {treasuries.map((t, i) => (
            <div
              key={t.id}
              className={i > 0 ? 'pt-2.5 md:pt-3 border-t border-white/[0.06]' : undefined}
            >
              <Row t={t} dogPrice={dogPrice} />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
