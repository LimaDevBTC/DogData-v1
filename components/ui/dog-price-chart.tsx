"use client"

// ═══════════════════════════════════════════════════════════════════════════
// O gráfico de preço do DOG no celular, no lugar do widget de terceiro.
//
// POR QUE ELE EXISTE (fundador, 28/08): o widget que ocupava esta caixa era
// um iframe de fora, lento, com tipografia que não é a nossa e sem uma leitura
// que se faça com o dedo. Trocado por dado que já é nosso:
//
//   histórico  public/data/dog_price_history.json — fechamento diário da
//              Gate.io desde 25/04/2024, gerado por scripts/build_price_history.py.
//              É estático, então a primeira pintura não espera rede nenhuma.
//   ao vivo    /api/markets → marketData.price, a média dos 18 mercados que a
//              casa já acompanha, mais a variação de 24h.
//
// O último ponto da série é o preço VIVO, não o fechamento de ontem: um gráfico
// de preço que abre mostrando o valor de ontem como se fosse agora é um erro
// pior do que não ter gráfico.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useState } from 'react'
import { ScrubChart, type ScrubPoint } from '@/components/charts/scrub-chart'

const LINHA = '#E8660D'
const SOBE = '#10B981'
const DESCE = '#EF4444'

type Janela = '7D' | '30D' | '90D' | '1A' | 'TUDO'
const JANELAS: { k: Janela; dias: number | null }[] = [
  { k: '7D', dias: 7 },
  { k: '30D', dias: 30 },
  { k: '90D', dias: 90 },
  { k: '1A', dias: 365 },
  { k: 'TUDO', dias: null },
]

// A casa escreve preço de DOG com seis casas em todo lugar (praça, mercados,
// cartões): manter aqui é o que deixa o número comparável de tela para tela.
const preco = (v: number) => `$${v.toFixed(6)}`
const pct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`

const diaCurto = (iso: string) => {
  const d = new Date(`${iso}T12:00:00Z`)
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: '2-digit' })
}

export default function DogPriceChart() {
  const [historico, setHistorico] = useState<[string, number][] | null>(null)
  const [vivo, setVivo] = useState<{ price: number; change24h: number } | null>(null)
  const [janela, setJanela] = useState<Janela>('30D')
  const [erro, setErro] = useState(false)

  useEffect(() => {
    let vivoAinda = true
    fetch('/data/dog_price_history.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: Record<string, number>) => {
        if (!vivoAinda) return
        const pares = Object.entries(j)
          .filter(([, v]) => typeof v === 'number' && v > 0)
          .sort((a, b) => (a[0] < b[0] ? -1 : 1))
        setHistorico(pares as [string, number][])
      })
      .catch(() => vivoAinda && setErro(true))

    fetch('/api/markets')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j) => {
        if (!vivoAinda || !j?.marketData?.price) return
        setVivo({ price: j.marketData.price, change24h: j.marketData.priceChange24h ?? 0 })
      })
      .catch(() => {})
    return () => {
      vivoAinda = false
    }
  }, [])

  const { pontos, delta, atual } = useMemo(() => {
    if (!historico?.length) return { pontos: [] as ScrubPoint[], delta: null as number | null, atual: null as number | null }
    const dias = JANELAS.find((j) => j.k === janela)?.dias ?? null
    const fatia = dias ? historico.slice(-dias) : historico
    const serie: [string, number][] = [...fatia]
    // hoje vale o preço vivo: se o histórico já trouxe a linha de hoje, ela é
    // substituída; senão, o vivo entra como ponto novo no fim
    const hoje = new Date().toISOString().slice(0, 10)
    if (vivo) {
      if (serie.length && serie[serie.length - 1][0] === hoje) serie[serie.length - 1] = [hoje, vivo.price]
      else serie.push([hoje, vivo.price])
    }
    const pts: ScrubPoint[] = serie.map(([iso, v], i) => ({
      label: i === serie.length - 1 && vivo ? 'now' : diaCurto(iso),
      value: v,
    }))
    const primeiro = serie[0]?.[1] ?? 0
    const ultimo = serie[serie.length - 1]?.[1] ?? 0
    return {
      pontos: pts,
      delta: primeiro > 0 ? ((ultimo - primeiro) / primeiro) * 100 : null,
      atual: ultimo || null,
    }
  }, [historico, vivo, janela])

  if (erro) {
    return (
      <div className="p-5 font-mono text-[11px] text-dusty">
        Price history unavailable right now.
      </div>
    )
  }

  const subindo = (delta ?? 0) >= 0

  return (
    <div className="p-4 sm:p-5">
      {/* preço e variação */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-dusty">DOG · USD</p>
          <p className="mt-1 font-display text-2xl font-bold tabular-nums text-snow sm:text-3xl">
            {atual ? preco(atual) : '—'}
          </p>
        </div>
        <div className="shrink-0 text-right">
          {vivo && (
            <p
              className="font-mono text-[11px] tabular-nums"
              style={{ color: vivo.change24h >= 0 ? SOBE : DESCE }}
            >
              {pct(vivo.change24h)} <span className="text-dusty">24h</span>
            </p>
          )}
          {delta != null && (
            <p className="mt-0.5 font-mono text-[11px] tabular-nums" style={{ color: subindo ? SOBE : DESCE }}>
              {pct(delta)} <span className="text-dusty">{janela.toLowerCase()}</span>
            </p>
          )}
        </div>
      </div>

      {/* o gráfico: arrastar o dedo lê o ponto */}
      <div className="mt-4">
        {pontos.length > 1 ? (
          <ScrubChart
            points={pontos}
            color={LINHA}
            height={150}
            format={preco}
            markExtremes
            caption={`${pontos.length} pontos · toque e arraste para ler`}
          />
        ) : (
          <div className="h-[150px] animate-pulse bg-white/[0.03]" />
        )}
      </div>

      {/* janelas */}
      <div className="mt-1 flex items-center gap-px border border-white/10 bg-white/10">
        {JANELAS.map((j) => (
          <button
            key={j.k}
            onClick={() => setJanela(j.k)}
            aria-pressed={janela === j.k}
            className={`flex-1 bg-void py-2 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors ${
              janela === j.k ? 'text-lava' : 'text-dusty hover:text-snow'
            }`}
          >
            {j.k}
          </button>
        ))}
      </div>

      <p className="mt-3 font-mono text-[9px] leading-relaxed text-dusty">
        Daily close from Gate.io since 25/04/2024. The last point is the live average across the
        18 markets we track.
      </p>
    </div>
  )
}
