'use client'

// Dossie da carteira selecionada: painel lateral no desktop, bottom-sheet no
// mobile. Todo o conteudo vem de GET /api/holders/tree/node; aqui e so
// exibicao e navegacao (focar saltos do caminho, re-root, perfil completo).

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { fmtDog, truncAddr } from './flow/flow-layout'
import type { NodeDossier, NodeFlowPeer, NodeLabel } from './flow/flow-types'

interface NodePanelProps {
  open: boolean
  mobile: boolean
  /** Endereco em foco (existe antes do dossie chegar). */
  w: string | null
  dossier: NodeDossier | null
  loading: boolean
  error: string | null
  onClose: () => void
  onReRoot: (w: string) => void
  /** Focar outra carteira (salto do caminho ou contraparte). */
  onFocus: (w: string) => void
  /**
   * Abrir o ego-grafo centrado nesta carteira (modo GRAPH). Presente so no
   * Flow; no proprio ego o botao some em vez de virar no-op.
   */
  onOpenGraph?: (w: string) => void
}

// Cor do chip por categoria: exchange no azul frio, o resto no laranja de
// marca (permitido, texto 2D).
function labelColor(label: NodeLabel): string {
  return label.cat === 'exchange' ? 'border-[#4A90D9] text-[#4A90D9]' : 'border-[#f7931a] text-[#f7931a]'
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[9px] uppercase tracking-[0.2em] text-white/40">{children}</div>
}

function PeerList({
  title,
  peers,
  onFocus,
}: {
  title: string
  peers: NodeFlowPeer[]
  onFocus: (w: string) => void
}) {
  return (
    <div>
      <SectionLabel>{title}</SectionLabel>
      {peers.length === 0 ? (
        <div className="mt-1 text-[10px] text-white/35">No flows recorded</div>
      ) : (
        <div className="mt-1 space-y-0.5">
          {peers.map((p) => (
            <button
              key={p.w}
              onClick={() => onFocus(p.w)}
              className="flex w-full items-center justify-between gap-2 py-0.5 text-left text-[10px] transition-colors hover:text-[#f7931a]"
            >
              <span className={p.label ? (p.label.cat === 'exchange' ? 'text-[#4A90D9]' : 'text-[#f7931a]') : 'text-white/70'}>
                {p.label ? p.label.name.toUpperCase() : truncAddr(p.w)}
              </span>
              <span className="shrink-0 text-white/40">{fmtDog(p.dog)} DOG</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function NodePanel({
  open,
  mobile,
  w,
  dossier,
  loading,
  error,
  onClose,
  onReRoot,
  onFocus,
  onOpenGraph,
}: NodePanelProps) {
  const [addrCopied, setAddrCopied] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)

  // Troca de carteira zera os estados de "copiado".
  useEffect(() => {
    setAddrCopied(false)
    setLinkCopied(false)
  }, [w])

  if (!open || !w) return null

  const copyAddr = () => {
    navigator.clipboard.writeText(w).then(() => {
      setAddrCopied(true)
      setTimeout(() => setAddrCopied(false), 1500)
    })
  }

  // O ?focus= ja esta espelhado na URL quando o painel esta aberto, entao o
  // link compartilhavel e a propria URL corrente.
  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 1500)
    })
  }

  const container = mobile
    ? 'absolute inset-x-0 bottom-0 z-20 max-h-[62%] overflow-y-auto border-t border-white/10 bg-[#0B0A11]/95'
    : 'absolute bottom-0 right-0 top-0 z-20 w-[340px] overflow-y-auto border-l border-white/10 bg-[#0B0A11]/95'

  const btn =
    'border border-white/15 px-2 py-1.5 text-center text-[10px] uppercase tracking-[0.15em] text-white/70 transition-colors hover:border-[#f7931a]/60 hover:text-[#f7931a]'

  return (
    <aside className={container}>
      <div className="space-y-3 p-4">
        {/* cabecalho: rotulo (se houver) + endereco copiavel + fechar */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            {dossier && dossier.label && (
              <span className={`inline-block border px-1.5 py-0.5 text-[10px] uppercase tracking-[0.15em] ${labelColor(dossier.label)}`}>
                {dossier.label.name}
              </span>
            )}
            <div className="mt-1 flex items-center gap-2">
              <span className="truncate text-[11px] text-white/80">{truncAddr(w)}</span>
              <button
                onClick={copyAddr}
                className="shrink-0 text-[9px] uppercase tracking-[0.15em] text-white/40 transition-colors hover:text-[#f7931a]"
              >
                {addrCopied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close panel"
            className="shrink-0 px-1 text-sm text-white/40 transition-colors hover:text-white"
          >
            ×
          </button>
        </div>

        {loading && <p className="text-[10px] uppercase tracking-[0.2em] text-white/40">Loading dossier...</p>}
        {!loading && error && <p className="text-[10px] leading-relaxed text-white/45">{error}</p>}

        {!loading && dossier && (
          <>
            {/* saldo e fatia do supply */}
            <div>
              <SectionLabel>Balance</SectionLabel>
              <div className="mt-0.5 text-sm text-[#f7931a]">{fmtDog(dossier.balance_dog)} DOG</div>
              <div className="text-[9px] text-white/35">{dossier.pct_supply.toFixed(4)}% of supply</div>
            </div>

            {/* estado + geracao */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <SectionLabel>Status</SectionLabel>
                <div className={`mt-0.5 text-[11px] ${dossier.is_holder ? 'text-[#f7931a]' : 'text-[#3A3F4A]'}`}>
                  {dossier.is_holder ? 'Holder' : 'Fully spent'}
                </div>
              </div>
              <div>
                <SectionLabel>Generation</SectionLabel>
                <div className="mt-0.5 text-[11px] text-white/70">G{dossier.depth}</div>
              </div>
            </div>

            {/* pai na genealogia */}
            {dossier.parent && (
              <div>
                <SectionLabel>Parent</SectionLabel>
                <button
                  onClick={() => onFocus(dossier.parent!.w)}
                  className={`mt-0.5 text-[10px] transition-colors hover:text-[#f7931a] ${
                    dossier.parent.label
                      ? dossier.parent.label.cat === 'exchange'
                        ? 'text-[#4A90D9]'
                        : 'text-[#f7931a]'
                      : 'text-white/70'
                  }`}
                >
                  {dossier.parent.label ? dossier.parent.label.name.toUpperCase() : truncAddr(dossier.parent.w)}
                </button>
              </div>
            )}

            {/* caminho compacto ate a raiz, cada salto clicavel pra focar */}
            {(dossier.path.length > 0 || dossier.path_truncated) && (
              <div>
                <SectionLabel>Path to root</SectionLabel>
                <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[10px]">
                  {dossier.path_truncated && <span className="text-white/30">…</span>}
                  {dossier.path.map((hop, i) => (
                    <span key={hop.w} className="flex items-center gap-1.5">
                      {(i > 0 || dossier.path_truncated) && <span className="text-white/25">/</span>}
                      <button
                        onClick={() => onFocus(hop.w)}
                        className="text-white/55 transition-colors hover:text-[#f7931a]"
                      >
                        {hop.label ? hop.label.name.toUpperCase() : truncAddr(hop.w)}
                      </button>
                    </span>
                  ))}
                  <span className="flex items-center gap-1.5">
                    {(dossier.path.length > 0 || dossier.path_truncated) && (
                      <span className="text-white/25">/</span>
                    )}
                    <span className="text-white/80">{truncAddr(dossier.w)}</span>
                  </span>
                </div>
              </div>
            )}

            {/* primeiro bloco em que a carteira tocou DOG */}
            <div>
              <SectionLabel>First block</SectionLabel>
              <div className="mt-0.5 text-[11px] text-white/70">{dossier.first_block > 0 ? dossier.first_block : 'unknown'}</div>
            </div>

            {/* totais de fluxo (dog_flows, nunca o fio genealogico) */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <SectionLabel>Flow in</SectionLabel>
                <div className="mt-0.5 text-[11px] text-white/70">{fmtDog(dossier.flows.in_dog)} DOG</div>
              </div>
              <div>
                <SectionLabel>Flow out</SectionLabel>
                <div className="mt-0.5 text-[11px] text-white/70">{fmtDog(dossier.flows.out_dog)} DOG</div>
              </div>
            </div>

            <PeerList title="Top 5 in" peers={dossier.flows.top_in} onFocus={onFocus} />
            <PeerList title="Top 5 out" peers={dossier.flows.top_out} onFocus={onFocus} />
          </>
        )}

        {/* acoes: sempre visiveis, o endereco existe mesmo sem dossie */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <Link href={`/address/bitcoin/${w}`} className={btn}>
            Full profile
          </Link>
          <button onClick={() => onReRoot(w)} className={btn}>
            Re-root here
          </button>
          <button onClick={copyLink} className={btn}>
            {linkCopied ? 'Link copied' : 'Copy link'}
          </button>
          {onOpenGraph && (
            <button onClick={() => onOpenGraph(w)} className={btn}>
              Open graph
            </button>
          )}
        </div>
      </div>
    </aside>
  )
}
