'use client'

import { useEffect } from 'react'

// ═══════════════════════════════════════════════════════════════════════════
// PAINEL DE LEGENDA DA BATALHA DE PREÇO
//
// O pedido do fundador: "um botão com legenda e info dos dados da batalha pra
// quem tiver curiosidade". O problema real é que o espectador vê tanque, morteiro
// e bombardeiro e não tem como saber que aquilo é o livro de ofertas da Kraken
// e não um vídeo em loop. Este painel é a PROVA: publica o mapeamento evento de
// mercado -> arma, os números vivos do feed, e a contagem de quantas vezes cada
// motivo armou uma arma desde que a batalha nasceu.
//
// O componente é BURRO de propósito: não busca nada, não guarda estado de dado,
// só desenha o que recebe. Quem alimenta é a cena (hud() do battlefield.ts).
// ═══════════════════════════════════════════════════════════════════════════

interface WarLegendProps {
  aberto: boolean
  onFechar: () => void
  dados: {
    dogPorSoldado: number
    niveisBook: number
    niveisEncenados: number
    bidsDog: number
    asksDog: number
    spread: number
    vwap24: number
    volume24: number
    trades24: number
    low24: number
    high24: number
    preco: number
    status: 'connecting' | 'live' | 'down'
    churnRelativo: number
    assaltos: number
    eventos: Record<string, number>
  } | null
}

// ── régua de estilo ────────────────────────────────────────────────────────
const LARANJA = '#f7931a'

// ⚠️ CELULAR DEITADO (armadilha já paga neste projeto): telefone na horizontal
// tem LARGURA de desktop e ALTURA de telefone, então `sm:` sozinho acha que é
// desktop e o painel fixo engole a tela inteira. Desktop de verdade é largura E
// altura, e a régua composta abaixo é a única que pode decidir isso.
// As classes ficam em literais completos porque o scanner do Tailwind lê o
// texto cru do arquivo: nome de classe montado por concatenação não compila.
const CAIXA = `
  pointer-events-auto fixed inset-0 z-50 flex flex-col bg-black/95
  [@media(min-width:640px)_and_(min-height:521px)]:inset-auto
  [@media(min-width:640px)_and_(min-height:521px)]:right-6
  [@media(min-width:640px)_and_(min-height:521px)]:top-1/2
  [@media(min-width:640px)_and_(min-height:521px)]:-translate-y-1/2
  [@media(min-width:640px)_and_(min-height:521px)]:w-[22rem]
  [@media(min-width:640px)_and_(min-height:521px)]:max-h-[80vh]
  [@media(min-width:640px)_and_(min-height:521px)]:border
  [@media(min-width:640px)_and_(min-height:521px)]:border-white/10
`

// o X do cabeçalho serve o mouse; no telefone o botão que vale é a barra do
// rodapé, na zona do polegar, e só ela some no desktop
const RODAPE = `
  shrink-0 border-t border-white/10
  [@media(min-width:640px)_and_(min-height:521px)]:hidden
`

const ROTULO = 'font-mono text-[10px] uppercase tracking-[0.2em] text-white/45'

// ── formatação ─────────────────────────────────────────────────────────────
const fmtDog = (n: number) => {
  if (!Number.isFinite(n) || n <= 0) return '0'
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`
  return n.toFixed(0)
}
const fmtPreco = (p: number) => (Number.isFinite(p) && p > 0 ? p.toFixed(6) : '-')
const fmtInt = (n: number) => (Number.isFinite(n) ? Math.round(n).toLocaleString('en-US') : '0')

const ESTADO: Record<'connecting' | 'live' | 'down', { cor: string; texto: string }> = {
  live: { cor: '#2ECC71', texto: 'Live from Kraken' },
  connecting: { cor: '#F5A623', texto: 'Connecting' },
  down: { cor: '#E74C3C', texto: 'Feed down' },
}

// ── o mapeamento: é ele que o painel existe para publicar ──────────────────
// Cada linha é "o que você vê na tela" contra "o que aconteceu no mercado".
// A ordem é a da leitura: primeiro o terreno, depois o tiro, depois a manobra.
const MAPA: Array<{ arma: string; cor?: string; leitura: string }> = [
  {
    arma: 'Soldier standing',
    leitura: 'One slice of the live order book. Every soldier on the field is depth someone actually posted.',
  },
  {
    arma: 'The front line',
    leitura: 'The current price, placed inside the 24h range. The marks on the ground are round price steps, and the two obelisks are the 24h high and the 24h low.',
  },
  {
    arma: 'Every shot',
    leitura: 'One real trade that just printed on the tape.',
  },
  {
    arma: 'Aimed burst',
    leitura: 'An ordinary trade, close to the recent average size.',
  },
  {
    arma: 'Mortar, the high arc shell',
    leitura: 'A trade 4x the recent average size or larger.',
  },
  {
    arma: 'MLRS salvo',
    leitura: 'A trade 8x the recent average size.',
  },
  {
    arma: 'Whale salvo',
    leitura: 'A trade 16x the recent average size. The biggest thing you can see here.',
  },
  {
    arma: 'Squad charge, 16 soldiers running',
    leitura: '2 trades in a row on the same side. One trade against them resets the count.',
  },
  {
    arma: 'Coordinated offensive',
    leitura: '4 trades in a row on the same side. The whole army moves.',
  },
  {
    arma: 'Cannon pair',
    leitura: 'A wall appeared in the book, a resting order far bigger than the levels around it.',
  },
  {
    arma: 'Vanguard duel',
    leitura: 'The spread widened and both sides pulled back from the touch.',
  },
  {
    arma: 'Bomber',
    leitura: 'The price broke the high or the low of this session.',
  },
  {
    arma: 'Assault',
    leitura: 'The front advanced 5% of the 24h range, or crossed one of the marks on the ruler.',
  },
  {
    arma: 'Background fusillade',
    leitura: 'Book churn: orders coming in and pulling out without ever becoming a trade.',
  },
]

// as 7 chaves que o motor conta, na ordem em que fazem sentido para quem lê
const MOTIVOS: Array<{ chave: string; nome: string; arma: string }> = [
  { chave: 'trade-medio', nome: 'Ordinary trade', arma: 'aimed burst' },
  { chave: 'trade-grande', nome: 'Large trade', arma: 'mortar, MLRS, whale salvo' },
  { chave: 'sequencia', nome: '2 in a row, one side', arma: 'squad charge' },
  { chave: 'maré', nome: '4 in a row, one side', arma: 'coordinated offensive' },
  { chave: 'parede', nome: 'Book wall', arma: 'cannon pair' },
  { chave: 'rompimento', nome: 'Session break', arma: 'bomber' },
  { chave: 'spread', nome: 'Spread widened', arma: 'vanguard duel' },
]

// ── peças ──────────────────────────────────────────────────────────────────
function Linha({ k, v, cor }: { k: string; v: string; cor?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className={ROTULO}>{k}</span>
      <span className="font-mono text-[11px] tabular-nums text-white/85" style={cor ? { color: cor } : undefined}>
        {v}
      </span>
    </div>
  )
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-white/10 px-4 py-4">
      <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/35">{titulo}</h3>
      <div className="mt-3">{children}</div>
    </section>
  )
}

export default function WarLegend({ aberto, onFechar, dados }: WarLegendProps) {
  // Esc fecha. O painel cobre a tela no telefone, então precisa de saída fácil
  // também no teclado quando alguém está no desktop com a mão longe do mouse.
  useEffect(() => {
    if (!aberto) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFechar()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [aberto, onFechar])

  if (!aberto) return null

  const estado = dados ? ESTADO[dados.status] ?? ESTADO.connecting : ESTADO.connecting
  const totalEventos = dados ? MOTIVOS.reduce((s, m) => s + (dados.eventos?.[m.chave] ?? 0), 0) : 0

  return (
    <aside
      role="dialog"
      aria-label="How to read the price war"
      className={CAIXA}
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* ── cabeçalho: estado do feed + saída ─────────────────────────────── */}
      <header className="shrink-0 border-b border-white/10 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: LARANJA }}>
              Reading the battle
            </p>
            <p className="mt-1.5 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-white/50">
              <span
                aria-hidden
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ background: estado.cor }}
              />
              {estado.texto}
            </p>
          </div>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Close the legend"
            className="-mr-1 -mt-1 shrink-0 px-2 py-1 font-mono text-[13px] leading-none text-white/45 hover:text-white"
          >
            ✕
          </button>
        </div>
        <p className="mt-3 font-mono text-[11px] leading-relaxed text-white/60">
          Nothing on this field is scripted. Every soldier is depth in the DOG order book, and every
          shot is a trade that printed on the tape.
        </p>
      </header>

      {/* ── corpo rolável ─────────────────────────────────────────────────── */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {/* quem é quem, dito antes de qualquer arma */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
          <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: LARANJA }}>
            <span aria-hidden className="inline-block h-1.5 w-1.5" style={{ background: LARANJA }} />
            Dogs buy
          </span>
          <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-red-400">
            <span aria-hidden className="inline-block h-1.5 w-1.5 bg-red-400" />
            Bears sell
          </span>
        </div>

        <Secao titulo="How to read the battle">
          <dl className="grid gap-3">
            {MAPA.map((m) => (
              <div key={m.arma}>
                <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/70">{m.arma}</dt>
                <dd className="mt-1 font-mono text-[11px] leading-relaxed text-white/50">{m.leitura}</dd>
              </div>
            ))}
          </dl>
          {dados && dados.dogPorSoldado > 0 && (
            <p className="mt-4 border border-white/10 px-3 py-2 font-mono text-[11px] leading-relaxed text-white/60">
              Right now one soldier stands for{' '}
              <span className="tabular-nums text-white/85">{fmtDog(dados.dogPorSoldado)}</span> DOG. The
              ratio moves so the biggest wall in the book still fits on the field.
            </p>
          )}
        </Secao>

        <Secao titulo="Live numbers">
          {dados ? (
            <div className="divide-y divide-white/[0.06]">
              <Linha k="Price" v={`$${fmtPreco(dados.preco)}`} />
              <Linha k="24h low" v={`$${fmtPreco(dados.low24)}`} />
              <Linha k="24h high" v={`$${fmtPreco(dados.high24)}`} />
              <Linha k="24h vwap" v={`$${fmtPreco(dados.vwap24)}`} />
              <Linha k="24h volume" v={`${fmtDog(dados.volume24)} DOG`} />
              <Linha k="24h trades" v={fmtInt(dados.trades24)} />
              <Linha k="Spread" v={dados.spread > 0 ? `$${dados.spread.toFixed(6)}` : '-'} />
              <Linha k="Bid depth" v={`${fmtDog(dados.bidsDog)} DOG`} cor={LARANJA} />
              <Linha k="Ask depth" v={`${fmtDog(dados.asksDog)} DOG`} cor="#F87171" />
              <Linha k="DOG per soldier" v={fmtDog(dados.dogPorSoldado)} />
              <Linha k="Book levels staged" v={`${fmtInt(dados.niveisEncenados)} of ${fmtInt(dados.niveisBook)}`} />
              <Linha
                k="Book churn"
                v={dados.churnRelativo > 0 ? `${dados.churnRelativo.toFixed(2)}x normal` : '-'}
              />
              <Linha k="Assaults" v={fmtInt(dados.assaltos)} />
            </div>
          ) : (
            <p className="font-mono text-[11px] leading-relaxed text-white/40">Waiting for the feed.</p>
          )}
          <p className="mt-3 font-mono text-[10px] leading-relaxed text-white/35">
            Depth is the full book the exchange sends. Only part of it is staged as soldiers, because a
            hundred levels of a whale wall would bury the field.
          </p>
        </Secao>

        <Secao titulo="Events since you arrived">
          {dados ? (
            <>
              <div className="divide-y divide-white/[0.06]">
                {MOTIVOS.map((m) => {
                  const n = dados.eventos?.[m.chave] ?? 0
                  return (
                    <div key={m.chave} className="flex items-baseline justify-between gap-3 py-1.5">
                      <span className="min-w-0">
                        <span className={ROTULO}>{m.nome}</span>
                        <span className="mt-0.5 block font-mono text-[10px] leading-relaxed text-white/30">
                          {m.arma}
                        </span>
                      </span>
                      <span
                        className="shrink-0 font-mono text-[12px] tabular-nums"
                        style={{ color: n > 0 ? '#EDEDED' : 'rgba(255,255,255,0.25)' }}
                      >
                        {fmtInt(n)}
                      </span>
                    </div>
                  )
                })}
              </div>
              <div className="mt-3 flex items-baseline justify-between gap-3 border-t border-white/10 pt-3">
                <span className={ROTULO}>Total</span>
                <span className="font-mono text-[12px] tabular-nums" style={{ color: LARANJA }}>
                  {fmtInt(totalEventos)}
                </span>
              </div>
              <p className="mt-3 font-mono text-[10px] leading-relaxed text-white/35">
                Counted since the battle loaded in this tab. A quiet market fires few weapons, and that
                is the honest picture.
              </p>
            </>
          ) : (
            <p className="font-mono text-[11px] leading-relaxed text-white/40">Waiting for the feed.</p>
          )}
        </Secao>

        <div className="border-t border-white/10 px-4 py-4">
          <p className="font-mono text-[10px] leading-relaxed text-white/30">
            Source: the public Kraken DOG market, order book and trade tape, read live in your browser.
            The 24h figures come from the exchange ticker.
          </p>
        </div>
      </div>

      {/* ── saída do polegar: só no telefone ──────────────────────────────── */}
      <div className={RODAPE}>
        <button
          type="button"
          onClick={onFechar}
          className="w-full px-4 py-4 font-mono text-[11px] uppercase tracking-[0.2em] text-white/60"
        >
          Close
        </button>
      </div>
    </aside>
  )
}
