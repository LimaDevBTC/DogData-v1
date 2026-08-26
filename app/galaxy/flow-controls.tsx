'use client'

// Barra de controles do Flow: busca por endereco (a rota /search ja existe),
// chips de exibicao (esmaecem no cliente, nunca removem), janelas de
// atividade (?active= da API) e o corte de fluxo minimo (?min=). No mobile
// tudo empilha. O modo GRAPH reusa so a busca via hideFilters: os filtros
// do Flow nao agem sobre o ego e ficariam mentindo se aparecessem.

import { useEffect, useRef, useState } from 'react'
import { fmtDog, truncAddr } from './flow/flow-layout'
import type { ActiveWindow } from './flow/flow-types'

interface SearchMatch {
  w: string
  b: number
  h: boolean
  label?: { name: string; source: string }
}

interface FlowControlsProps {
  /** Modo ego: esconde os filtros do Flow, sobra so a busca. */
  hideFilters?: boolean
  onlyHolders?: boolean
  hideExchanges?: boolean
  active?: ActiveWindow
  min?: number
  onOnlyHolders?: () => void
  onHideExchanges?: () => void
  onActive?: (a: ActiveWindow) => void
  onMin?: (n: number) => void
  /** Resultado escolhido na busca: foca (e re-roota se preciso) la em cima. */
  onPick: (w: string) => void
}

const ACTIVE_OPTIONS: { value: ActiveWindow; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: '90d', label: '90d' },
  { value: '30d', label: '30d' },
]

// Cortes fixos do select "Ignore flows below", em DOG.
const MIN_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: '0' },
  { value: 1_000_000, label: '1M' },
  { value: 10_000_000, label: '10M' },
  { value: 100_000_000, label: '100M' },
]

function chipClass(on: boolean): string {
  return on
    ? 'border border-[#E8660D] bg-[#E8660D]/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.15em] text-[#f7931a] transition-colors'
    : 'border border-white/15 px-2.5 py-1 text-[10px] uppercase tracking-[0.15em] text-white/45 transition-colors hover:text-white/80'
}

export default function FlowControls({
  hideFilters = false,
  onlyHolders = false,
  hideExchanges = false,
  active = 'all',
  min = 0,
  onOnlyHolders,
  onHideExchanges,
  onActive,
  onMin,
  onPick,
}: FlowControlsProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchMatch[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState(false)
  // celular: filtros nascem recolhidos atras do botao Filters; a barra aberta
  // comia tres linhas e o canvas ficava com menos da metade do viewport
  const [openMobile, setOpenMobile] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Busca com debounce de 300ms; abaixo de 3 caracteres a rota nem aceita.
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    const q = query.trim()
    if (q.length < 3) {
      setResults([])
      setSearching(false)
      setSearchError(false)
      return
    }
    const ctrl = new AbortController()
    setSearching(true)
    setSearchError(false)
    timerRef.current = setTimeout(() => {
      fetch(`/api/holders/tree/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        .then(async (res) => {
          if (!res.ok) throw new Error(`status ${res.status}`)
          return (await res.json()) as { matches: SearchMatch[] }
        })
        .then((payload) => {
          setResults(payload.matches ?? [])
          setSearching(false)
        })
        .catch(() => {
          if (ctrl.signal.aborted) return
          setResults([])
          setSearchError(true)
          setSearching(false)
        })
    }, 300)
    return () => {
      ctrl.abort()
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [query])

  function pick(w: string) {
    setQuery('')
    setResults([])
    onPick(w)
  }

  return (
    <div className="flex flex-col gap-2 border-b border-white/10 px-4 py-2 sm:px-6 md:flex-row md:items-center md:gap-4">
      {/* busca sempre visivel; no celular divide a linha com o botao Filters */}
      <div className="flex items-center gap-2 md:contents">
      <div className="relative min-w-0 flex-1 md:w-72 md:flex-none">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search address"
          spellCheck={false}
          className="w-full border border-white/10 bg-[#0B0A11]/80 px-3 py-1.5 text-[11px] text-white/80 outline-none transition-colors placeholder:text-white/30 focus:border-[#f7931a]/60"
        />
        {query.trim().length >= 3 && (
          <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden border border-white/10 bg-[#0B0A11]/95">
            {searching && <div className="px-3 py-2 text-[10px] text-white/40">Searching...</div>}
            {!searching && searchError && (
              <div className="px-3 py-2 text-[10px] text-white/40">Search unavailable right now</div>
            )}
            {!searching && !searchError && results.length === 0 && (
              <div className="px-3 py-2 text-[10px] text-white/40">No wallet found</div>
            )}
            {!searching &&
              results.map((r) => (
                <button
                  key={r.w}
                  onClick={() => pick(r.w)}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-[11px] text-white/70 transition-colors hover:bg-white/5 hover:text-[#f7931a]"
                >
                  <span>{r.label ? r.label.name.toUpperCase() : truncAddr(r.w)}</span>
                  <span className="text-white/40">{r.h ? `${fmtDog(r.b)} DOG` : 'spent'}</span>
                </button>
              ))}
          </div>
        )}
      </div>

      {/* alternador dos filtros, so no celular e so quando ha filtros */}
      {!hideFilters && (
        <button
          type="button"
          aria-expanded={openMobile}
          onClick={() => setOpenMobile((v) => !v)}
          className="shrink-0 border border-white/15 px-2.5 py-1.5 text-[10px] uppercase tracking-[0.15em] text-white/45 transition-colors hover:text-white/80 md:hidden"
        >
          Filters {openMobile ? '▴' : '▾'}
        </button>
      )}
      </div>

      {/* filtros do Flow: no modo ego nao agem e por isso nem aparecem; no
          celular so existem com o alternador aberto */}
      {!hideFilters && (
        <div
          className={`${openMobile ? 'flex' : 'hidden'} flex-col gap-2 md:flex md:flex-row md:items-center md:gap-4`}
        >
          {/* chips de exibicao: esmaecer, nao remover */}
          <div className="flex items-center gap-2">
            <button onClick={onOnlyHolders} className={chipClass(onlyHolders)}>
              Only holders
            </button>
            <button onClick={onHideExchanges} className={chipClass(hideExchanges)}>
              Hide exchanges
            </button>
          </div>

          {/* janela de atividade dos fluxos (?active=) */}
          <div className="flex items-center gap-2">
            <span className="text-[9px] uppercase tracking-[0.2em] text-white/40">Active lanes</span>
            <div className="flex border border-white/15">
              {ACTIVE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => onActive?.(opt.value)}
                  className={
                    active === opt.value
                      ? 'bg-white/5 px-2.5 py-1 text-[10px] uppercase tracking-[0.15em] text-[#f7931a]'
                      : 'px-2.5 py-1 text-[10px] uppercase tracking-[0.15em] text-white/45 transition-colors hover:text-white/80'
                  }
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* corte de fluxo minimo (?min=) */}
          <div className="flex items-center gap-2">
            <label htmlFor="flow-min" className="text-[9px] uppercase tracking-[0.2em] text-white/40">
              Ignore flows below
            </label>
            <select
              id="flow-min"
              value={String(min)}
              onChange={(e) => onMin?.(Number(e.target.value))}
              className="border border-white/15 bg-[#0B0A11] px-2 py-1 text-[10px] uppercase tracking-[0.15em] text-white/70 outline-none focus:border-[#f7931a]/60"
            >
              {MIN_OPTIONS.map((opt) => (
                <option key={opt.value} value={String(opt.value)}>
                  {opt.label} DOG
                </option>
              ))}
              {/* valor fora da lista (veio de uma URL editada a mao): vira opcao
                  visivel em vez de select em branco */}
              {!MIN_OPTIONS.some((opt) => opt.value === min) && (
                <option value={String(min)}>{fmtDog(min)} DOG</option>
              )}
            </select>
          </div>
        </div>
      )}
    </div>
  )
}
