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
//   ao vivo    a MESMA cascata do topo da home (app/page.tsx): Kraken primeiro,
//              Gate.io depois, MEXC por último. O número grande do gráfico tem
//              que ser o mesmo número grande do resto do site, senão a página
//              mostra dois preços do mesmo ativo com dois valores.
//   velas      /api/price/candles, que também pergunta à Kraken antes de todos.
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

// ⚠️ DUAS FONTES, UMA LINHA. As janelas curtas vêm de velas intradiárias
// (/api/price/candles, Gate.io de 5 em 5 ou de 15 em 15 minutos) porque o
// arquivo do disco é fechamento DIÁRIO: 24h nele seriam um ponto e 4h, nenhum.
// Da semana para cima, o arquivo é melhor: já está no navegador, cobre desde
// 25/04/2024 e não custa rede.
type Janela = '4H' | '24H' | '7D' | '30D' | '90D' | '1Y' | 'ALL'
const JANELAS: { k: Janela; dias: number | null; intra?: '4h' | '24h' }[] = [
  { k: '4H', dias: null, intra: '4h' },
  { k: '24H', dias: null, intra: '24h' },
  { k: '7D', dias: 7 },
  { k: '30D', dias: 30 },
  { k: '90D', dias: 90 },
  { k: '1Y', dias: 365 },
  { k: 'ALL', dias: null },
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

/** Rótulo das janelas curtas: hora local, que é a pergunta de quem olha 4h. */
const horaCurta = (iso: string) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
}

export default function DogPriceChart() {
  const [historico, setHistorico] = useState<[string, number][] | null>(null)
  const [vivo, setVivo] = useState<{ price: number; change24h: number; fonte: string } | null>(null)
  const [janela, setJanela] = useState<Janela>('24H')
  const [intra, setIntra] = useState<Record<string, { t: string; c: number }[]>>({})
  const [fonteVelas, setFonteVelas] = useState<string | null>(null)
  const [carregandoIntra, setCarregandoIntra] = useState(false)
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

    // ⚠️ MESMA ORDEM DA HOME: Kraken, Gate.io, MEXC. Não é gosto, é o preço
    // que o topo da página já publica; duas fontes diferentes na mesma tela
    // dariam dois preços para o mesmo ativo.
    const pega = (u: string) =>
      fetch(u, { signal: AbortSignal.timeout(6000) }).then((r) => (r.ok ? r.json() : null)).catch(() => null)
    Promise.allSettled([pega('/api/price/kraken'), pega('/api/price/gateio'), pega('/api/price/mexc')]).then(
      ([k, g, m]) => {
        if (!vivoAinda) return
        const kr = k.status === 'fulfilled' ? k.value : null
        const ticker = kr?.result?.DOGUSD
        if (ticker?.c?.[0]) {
          const price = parseFloat(ticker.c[0])
          const open = parseFloat(ticker.o)
          if (price > 0) {
            setVivo({
              price,
              change24h: open > 0 ? ((price - open) / open) * 100 : 0,
              fonte: 'Kraken',
            })
            return
          }
        }
        const ga = g.status === 'fulfilled' ? g.value : null
        if (ga?.price > 0) {
          setVivo({ price: ga.price, change24h: ga.change24h ?? 0, fonte: 'Gate.io' })
          return
        }
        const mx = m.status === 'fulfilled' ? m.value : null
        if (mx?.price > 0) setVivo({ price: mx.price, change24h: mx.change24h ?? 0, fonte: 'MEXC' })
      },
    )
    return () => {
      vivoAinda = false
    }
  }, [])

  // As velas são buscadas sob demanda e guardadas: trocar entre 4H e 24H duas
  // vezes não repete a chamada.
  useEffect(() => {
    const alvo = JANELAS.find((j) => j.k === janela)?.intra
    if (!alvo || intra[alvo]) return
    setCarregandoIntra(true)
    fetch(`/api/price/candles?range=${alvo}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j) => {
        if (Array.isArray(j?.points) && j.points.length > 1) {
          setIntra((m) => ({ ...m, [alvo]: j.points }))
          if (j.source) setFonteVelas(j.source)
        }
      })
      .catch(() => {})
      .finally(() => setCarregandoIntra(false))
  }, [janela, intra])

  const { pontos, delta, atual } = useMemo(() => {
    const alvoIntra = JANELAS.find((j) => j.k === janela)?.intra
    if (alvoIntra) {
      const velas = intra[alvoIntra]
      if (!velas?.length) {
        return { pontos: [] as ScrubPoint[], delta: null as number | null, atual: vivo?.price ?? null }
      }
      const pts: ScrubPoint[] = velas.map((v, i) => ({
        label: i === velas.length - 1 ? 'now' : horaCurta(v.t),
        value: v.c,
      }))
      // o último ponto é o preço vivo do topo do site, não o fechamento da
      // última vela, que fecha só no fim do intervalo
      if (vivo) pts[pts.length - 1] = { label: 'now', value: vivo.price }
      const ini = pts[0].value
      const fim = pts[pts.length - 1].value
      return {
        pontos: pts,
        delta: ini > 0 ? ((fim - ini) / ini) * 100 : null,
        atual: fim || null,
      }
    }

    if (!historico?.length) return { pontos: [] as ScrubPoint[], delta: null as number | null, atual: vivo?.price ?? null }
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
  }, [historico, vivo, janela, intra])

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
              {pct(vivo.change24h)} <span className="text-dusty">24h · {vivo.fonte}</span>
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
            caption={`${pontos.length} points · touch and drag to read`}
          />
        ) : (
          <div className="flex h-[150px] items-center justify-center bg-white/[0.02] font-mono text-[10px] text-dusty">
            {carregandoIntra ? 'loading candles…' : ''}
          </div>
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
        {JANELAS.find((j) => j.k === janela)?.intra
          ? `${fonteVelas ?? 'Kraken'} candles, ${janela === '4H' ? '5' : '15'} minutes apart.`
          : 'Daily close from Gate.io since 25/04/2024.'}{' '}
        Live price from {vivo?.fonte ?? 'Kraken'}, the same source as the top of the site.
      </p>
    </div>
  )
}
