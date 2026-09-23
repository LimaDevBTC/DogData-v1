'use client'

// ═══════════════════════════════════════════════════════════════════════════
// A LEGENDA FIXA + O CARTUCHO: setores, água, programa, e o bloco/merkle root
// que provam que este mapa é o mesmo registro selado (23/09), não um desenho
// à parte. O root vem de selo.json: ninguém digita ele.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from 'react'
import type { Selo } from './malha'
import { COR_SETOR, nomeDoSetor, AGUA, fmtInt } from './estilo'

const PROGRAMA_AMOSTRA: { rotulo: string; cor: string }[] = [
  { rotulo: 'Garden / park', cor: '#A69B63' },
  { rotulo: 'Civic', cor: '#D9C39A' },
  { rotulo: 'Sports', cor: '#C99A5B' },
  { rotulo: 'Industry', cor: '#8A8A93' },
  { rotulo: 'Finance', cor: '#F2C14E' },
  { rotulo: 'Landmark', cor: '#C99A5B' },
]

export function Legenda({ selo }: { selo: Selo | null }) {
  const [aberta, setAberta] = useState(true)
  const [copiado, setCopiado] = useState(false)

  // ⚠️ FECHADA POR PADRÃO NO CELULAR. Aberta, a legenda toma mais da metade
  // dos 844px de um iPhone comum: o mapa é o produto, a legenda é apoio.
  // useEffect (não o estado inicial) para não desencontrar do HTML de SSR.
  useEffect(() => {
    if (window.matchMedia('(max-width: 639px)').matches) setAberta(false)
  }, [])

  const copiarRoot = () => {
    if (!selo) return
    navigator.clipboard?.writeText(selo.merkleRoot).then(() => {
      setCopiado(true)
      setTimeout(() => setCopiado(false), 1500)
    }).catch(() => {})
  }

  return (
    // ⚠️ CANTO SUPERIOR ESQUERDO, NÃO INFERIOR: o RadiolaPlayer (fora deste
    // diretório, components/radiola/radiola-player.tsx) já mora fixo no
    // inferior-esquerdo em toda rota /city, e o inferior-direito é dos botões
    // de zoom. Cantos ocupados não se empilham (gosto do fundador).
    <div className="pointer-events-none fixed left-0 top-12 z-20 flex max-w-[calc(100vw-16px)] flex-col gap-2 p-2 sm:top-16 sm:p-4">
      <div className="pointer-events-auto w-56 rounded-lg border border-white/10 bg-[#0A0A0C] font-mono text-[11px] text-[#EDE6D6] sm:w-80">
        <button
          onClick={() => setAberta((v) => !v)}
          className="flex w-full items-center justify-between gap-4 px-3 py-2 text-[10px] uppercase tracking-[0.2em] text-white/60"
        >
          Legend
          <span>{aberta ? '−' : '+'}</span>
        </button>
        {aberta && (
          <div className="max-h-[45vh] overflow-y-auto px-3 pb-3">
            <p className="mb-1 mt-2 text-[9px] uppercase tracking-[0.15em] text-white/40">Sectors</p>
            <div className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
              {Object.keys(COR_SETOR).map((k) => {
                const s = Number(k)
                return (
                  <div key={s} className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: COR_SETOR[s] }} />
                    <span className="whitespace-nowrap text-white/80">S{String(s).padStart(2, '0')} · {nomeDoSetor(s)}</span>
                  </div>
                )
              })}
            </div>

            <p className="mb-1 mt-3 text-[9px] uppercase tracking-[0.15em] text-white/40">Terrain</p>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: AGUA }} />
              <span className="text-white/80">Water</span>
            </div>

            <p className="mb-1 mt-3 text-[9px] uppercase tracking-[0.15em] text-white/40">Program</p>
            <div className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
              {PROGRAMA_AMOSTRA.map((p) => (
                <div key={p.rotulo} className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: p.cor }} />
                  <span className="whitespace-nowrap text-white/80">{p.rotulo}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {selo && (
        <button
          onClick={copiarRoot}
          className="pointer-events-auto w-56 max-w-full rounded-lg border border-white/10 bg-[#0A0A0C] px-3 py-2 text-left font-mono text-[10px] text-white/70 hover:bg-white/10 sm:w-80"
          title="Copy merkle root"
        >
          <span className="block text-[9px] uppercase tracking-[0.15em] text-white/40">
            Block {fmtInt(selo.bloco)} · {fmtInt(selo.lotes)} plots · {fmtInt(selo.carteiras)} wallets
          </span>
          <span className="block break-all text-[10px] text-[#EDE6D6]">
            {copiado ? 'Copied' : selo.merkleRoot}
          </span>
        </button>
      )}
    </div>
  )
}
