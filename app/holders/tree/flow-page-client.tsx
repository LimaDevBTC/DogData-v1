'use client'

// Casca do modo Flow: estado espelhado na URL (?root ?expand ?min ?active
// ?focus), fetch de /api/holders/tree/flow e do dossie de /node, re-root com
// breadcrumb clicavel e recuo pra FLOW_FIXTURE com selo visivel quando a API
// ou o banco caem. A tela nunca fica branca.

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import FlowScene from './flow/flow-scene'
import { FLOW_FIXTURE } from './flow/flow-fixture'
import { truncAddr } from './flow/flow-layout'
import type { ActiveWindow, FlowResponse, NodeDossier } from './flow/flow-types'
import StatsStrip from './stats-strip'
import FlowControls from './flow-controls'
import NodePanel from './node-panel'

// Mesmo endereco de ROOT_WALLET em app/api/holders/tree/_shared.ts, copiado
// como literal pra nao arrastar codigo de servidor pro client.
const DEFAULT_ROOT = 'bc1pry0ne0yf5pkgqsszmytmqkpzs4aflhr8tfptz9sydqrhxexgujcqqler2t'
const DEFAULT_MIN = 1_000_000

// Mesmo padrao de endereco de _shared.ts: a URL e publica, um ?root= ou
// ?focus= fora do formato nem vira estado.
const ADDR_RE = /^(bc1|1|3)[a-zA-HJ-NP-Z0-9]{25,61}$/
const isAddr = (s: string | null): s is string => !!s && ADDR_RE.test(s)

interface Crumb {
  w: string
  name: string
}

const TREASURY_CRUMB: Crumb = { w: DEFAULT_ROOT, name: 'TREASURY' }

export default function FlowPageClient() {
  const router = useRouter()

  // Estado do painel, todo espelhavel na URL.
  const [ready, setReady] = useState(false)
  const [root, setRoot] = useState(DEFAULT_ROOT)
  const [expand, setExpand] = useState<string[]>([])
  const [min, setMin] = useState(DEFAULT_MIN)
  const [active, setActive] = useState<ActiveWindow>('all')
  const [focus, setFocus] = useState<string | null>(null)
  const [trail, setTrail] = useState<Crumb[]>([TREASURY_CRUMB])
  const [mobile, setMobile] = useState(false)

  // Dados: payload do flow (ou fixture com selo) e dossie do no selecionado.
  const [data, setData] = useState<FlowResponse | null>(null)
  const [fixture, setFixture] = useState(false)
  const [loadingFlow, setLoadingFlow] = useState(true)
  const [dossier, setDossier] = useState<NodeDossier | null>(null)
  const [dossierLoading, setDossierLoading] = useState(false)
  const [dossierError, setDossierError] = useState<string | null>(null)

  // Filtros de exibicao: aplicados no cliente sobre a resposta, esmaecendo
  // sem remover, pra nao mentir a estrutura do sankey.
  const [onlyHolders, setOnlyHolders] = useState(false)
  const [hideExchanges, setHideExchanges] = useState(false)

  // ── boot: le a URL uma vez e observa o breakpoint mobile ─────────────────
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search)
    const r = sp.get('root')
    if (isAddr(r) && r !== DEFAULT_ROOT) {
      setRoot(r)
      setTrail([TREASURY_CRUMB, { w: r, name: truncAddr(r) }])
    }
    const e = sp.get('expand')
    if (e) setExpand(e.split(',').map((s) => s.trim()).filter(Boolean))
    const mRaw = sp.get('min')
    if (mRaw !== null) {
      const m = Number(mRaw)
      if (Number.isFinite(m) && m >= 0) setMin(m)
    }
    const a = sp.get('active')
    if (a === '90d' || a === '30d') setActive(a)
    const f = sp.get('focus')
    if (isAddr(f)) setFocus(f)

    const mq = window.matchMedia('(max-width: 767px)')
    setMobile(mq.matches)
    const onChange = () => setMobile(mq.matches)
    mq.addEventListener('change', onChange)
    setReady(true)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  // ── espelho na URL: replaceState pra nao poluir o historico ──────────────
  useEffect(() => {
    if (!ready) return
    const sp = new URLSearchParams()
    if (root !== DEFAULT_ROOT) sp.set('root', root)
    if (expand.length > 0) sp.set('expand', expand.join(','))
    if (min !== DEFAULT_MIN) sp.set('min', String(min))
    if (active !== 'all') sp.set('active', active)
    if (focus) sp.set('focus', focus)
    const qs = sp.toString()
    window.history.replaceState(null, '', qs ? `${window.location.pathname}?${qs}` : window.location.pathname)
  }, [ready, root, expand, min, active, focus])

  // ── fetch do flow ────────────────────────────────────────────────────────
  const expandKey = expand.join(',')
  useEffect(() => {
    if (!ready) return
    const ctrl = new AbortController()
    let alive = true
    // ⚠️ SEM TIMEOUT DO LADO DO CLIENTE o fetch pendura junto com o banco e o
    // fallback nunca dispara ("Charting flows..." eterno, visto no incidente
    // de IO de 26/08). 12s e o teto; o abort por timeout PRECISA cair na
    // amostra, entao a flag separa timeout de desmontagem.
    let estourou = false
    const timer = setTimeout(() => {
      estourou = true
      ctrl.abort()
    }, 12000)
    setLoadingFlow(true)
    const sp = new URLSearchParams()
    sp.set('root', root)
    if (expandKey) sp.set('expand', expandKey)
    sp.set('min', String(min))
    sp.set('active', active)
    if (mobile) sp.set('mobile', '1')
    fetch(`/api/holders/tree/flow?${sp.toString()}`, { signal: ctrl.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`status ${res.status}`)
        return (await res.json()) as FlowResponse
      })
      .then((payload) => {
        if (!alive) return
        clearTimeout(timer)
        setData(payload)
        setFixture(false)
        setLoadingFlow(false)
      })
      .catch(() => {
        clearTimeout(timer)
        if (!alive || (ctrl.signal.aborted && !estourou)) return
        // API fora, banco em recuperacao ou timeout: cai na amostra com selo,
        // nunca tela branca.
        setData(FLOW_FIXTURE)
        setFixture(true)
        setLoadingFlow(false)
      })
    return () => {
      alive = false
      clearTimeout(timer)
      ctrl.abort()
    }
  }, [ready, root, expandKey, min, active, mobile])

  // ── fetch do dossie quando um no e selecionado ───────────────────────────
  useEffect(() => {
    if (!ready) return
    if (!focus) {
      setDossier(null)
      setDossierError(null)
      return
    }
    const ctrl = new AbortController()
    let alive = true
    setDossier(null)
    setDossierError(null)
    setDossierLoading(true)
    fetch(`/api/holders/tree/node?w=${encodeURIComponent(focus)}`, { signal: ctrl.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`status ${res.status}`)
        return (await res.json()) as NodeDossier
      })
      .then((payload) => {
        if (!alive) return
        setDossier(payload)
        setDossierLoading(false)
      })
      .catch(() => {
        if (!alive || ctrl.signal.aborted) return
        setDossierError('Dossier unavailable right now. The address itself is still valid.')
        setDossierLoading(false)
      })
    return () => {
      alive = false
      ctrl.abort()
    }
  }, [ready, focus])

  // ── nomes e re-root ──────────────────────────────────────────────────────
  function nameOf(w: string): string {
    if (w === DEFAULT_ROOT) return 'TREASURY'
    if (data) {
      if (data.root.w === w) return data.root.label ? data.root.label.name.toUpperCase() : truncAddr(w)
      for (const col of data.cols) {
        for (const n of col.nodes) {
          if (n.w === w) return n.label ? n.label.name.toUpperCase() : truncAddr(w)
        }
      }
    }
    if (dossier && dossier.w === w && dossier.label) return dossier.label.name.toUpperCase()
    return truncAddr(w)
  }

  function reRootTo(w: string) {
    setTrail((prev) => {
      const idx = prev.findIndex((c) => c.w === w)
      if (idx >= 0) return prev.slice(0, idx + 1)
      return [...prev, { w, name: nameOf(w) }]
    })
    setRoot(w)
    setExpand([])
    setFocus(null)
    setDossier(null)
  }

  // ── handlers da cena ─────────────────────────────────────────────────────
  function handleNodeClick(w: string) {
    if (data && data.ghost && w === data.ghost.w) {
      // clique na ancora fantasma volta um passo de re-root
      reRootTo(w)
      return
    }
    setFocus(w)
  }

  function handleRestClick(id: string) {
    // clique no resto alterna a expansao in-place daquele bloco
    setExpand((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function handleAddressClick(w: string) {
    // regra da casa: endereco leva pra pagina interna, nunca pra fora
    router.push(`/address/bitcoin/${w}`)
  }

  function handleSearchPick(w: string) {
    const inFlow =
      !!data &&
      !fixture &&
      (data.root.w === w || data.cols.some((c) => c.nodes.some((n) => n.w === w)))
    // No fora do flow atual: re-root nele; o setFocus depois do reRootTo
    // garante que o dossie abre ja na nova raiz.
    if (!inFlow) reRootTo(w)
    setFocus(w)
  }

  // ── filtros de exibicao: mapa de ids esmaecidos (raiz nunca apaga) ───────
  const dimmed = useMemo<Record<string, 1> | null>(() => {
    if (!data || (!onlyHolders && !hideExchanges)) return null
    const map: Record<string, 1> = {}
    for (const col of data.cols) {
      for (const n of col.nodes) {
        if (n.gen === 0) continue
        if (onlyHolders && !n.h) map[n.w] = 1
        if (hideExchanges && n.label && n.label.cat === 'exchange') map[n.w] = 1
      }
      for (const r of col.rest) {
        if (onlyHolders && r.kind === 'spent') map[r.id] = 1
      }
    }
    return map
  }, [data, onlyHolders, hideExchanges])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <StatsStrip stats={data ? data.stats : null} />

      <FlowControls
        onlyHolders={onlyHolders}
        hideExchanges={hideExchanges}
        active={active}
        min={min}
        onOnlyHolders={() => setOnlyHolders((v) => !v)}
        onHideExchanges={() => setHideExchanges((v) => !v)}
        onActive={setActive}
        onMin={setMin}
        onPick={handleSearchPick}
      />

      {trail.length > 1 && (
        <div className="flex items-center gap-1.5 overflow-x-auto border-b border-white/10 px-4 py-1.5 sm:px-6">
          <span className="shrink-0 text-[9px] uppercase tracking-[0.2em] text-white/40">Root</span>
          {trail.map((c, i) => (
            <span key={c.w} className="flex shrink-0 items-center gap-1.5">
              {i > 0 && <span className="text-white/25">/</span>}
              <button
                onClick={() => reRootTo(c.w)}
                disabled={i === trail.length - 1}
                className={
                  i === trail.length - 1
                    ? 'text-[10px] uppercase tracking-[0.15em] text-[#f7931a]'
                    : 'text-[10px] uppercase tracking-[0.15em] text-white/50 transition-colors hover:text-[#f7931a]'
                }
              >
                {c.name}
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative min-h-0 flex-1">
        {data ? (
          <FlowScene
            data={data}
            focus={focus}
            orientation={mobile ? 'v' : 'h'}
            dimmed={dimmed}
            onNodeClick={handleNodeClick}
            onRestClick={handleRestClick}
            onAddressClick={handleAddressClick}
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-[#040305]">
            <p className="text-xs uppercase tracking-[0.25em] text-white/60">Charting flows...</p>
          </div>
        )}

        {/* selo da amostra: dado vivo indisponivel, nunca fingir que e real */}
        {fixture && (
          <div className="pointer-events-none absolute left-3 top-3 z-10 border border-[#4A90D9] bg-[#0B0A11]/90 px-2 py-1 text-[9px] uppercase tracking-[0.2em] text-[#4A90D9]">
            Sample data, live data unavailable
          </div>
        )}

        {/* selo de completude do backfill de dog_flows */}
        {!fixture && data && data.meta.flows === 'partial' && (
          <div className="pointer-events-none absolute left-3 top-3 z-10 border border-white/15 bg-[#0B0A11]/90 px-2 py-1 text-[9px] uppercase tracking-[0.2em] text-white/50">
            Partial flows
          </div>
        )}

        {loadingFlow && data && (
          <div className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2 border border-white/10 bg-[#0B0A11]/90 px-2 py-1 text-[9px] uppercase tracking-[0.2em] text-white/50">
            Updating flows...
          </div>
        )}

        <NodePanel
          open={!!focus}
          mobile={mobile}
          w={focus}
          dossier={dossier}
          loading={dossierLoading}
          error={dossierError}
          onClose={() => setFocus(null)}
          onReRoot={reRootTo}
          onFocus={(w) => setFocus(w)}
        />
      </div>
    </div>
  )
}
