'use client'

// Casca do modo GRAPH (ego-grafo): estado espelhado na URL (?view=ego&w=
// &limit=), fetch de /api/holders/tree/ego com teto de 12s caindo na
// EGO_FIXTURE com selo visivel (a tela nunca fica branca), re-centro com
// pushState (o voltar do navegador desfaz cada re-centro) e o mesmo
// NodePanel do Flow no clique do centro. Os filtros do Flow (active lanes,
// only holders, hide exchanges, ignore-below) NAO agem sobre o ego e ficam
// ocultos: aqui os controles sao a busca e o ?limit (o resto clicado sobe
// o limit em vez de fingir filtro).

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import EgoScene from './ego/ego-scene'
import { EGO_FIXTURE } from './ego/ego-fixture'
import { truncAddr } from './ego/ego-layout'
import type { EgoResponse } from './ego/ego-types'
import type { NodeDossier } from './flow/flow-types'
import FlowControls from './flow-controls'
import NodePanel from './node-panel'

// Mesmo endereco de ROOT_WALLET em app/api/holders/tree/_shared.ts, copiado
// como literal pra nao arrastar codigo de servidor pro client.
const DEFAULT_ROOT = 'bc1pry0ne0yf5pkgqsszmytmqkpzs4aflhr8tfptz9sydqrhxexgujcqqler2t'

// Mesmo padrao de endereco de _shared.ts: um ?w= fora do formato nem vira
// estado, o centro cai na tesouraria.
const ADDR_RE = /^(bc1|1|3)[a-zA-HJ-NP-Z0-9]{25,61}$/
const isAddr = (s: string | null): s is string => !!s && ADDR_RE.test(s)

// Mesma pinca de limit da API (?limit clamp 8..48); o fetch usa 12 no
// mobile e 24 no desktop enquanto o usuario nao expandir o resto.
const LIMIT_MIN = 8
const LIMIT_MAX = 48

function parseLimit(raw: string | null): number | null {
  if (raw === null) return null
  const n = Number(raw)
  if (!Number.isInteger(n) || n < LIMIT_MIN || n > LIMIT_MAX) return null
  return n
}

interface Crumb {
  w: string
  name: string
}

const TREASURY_CRUMB: Crumb = { w: DEFAULT_ROOT, name: 'TREASURY' }

interface EgoPageClientProps {
  /** Centro inicial vindo do "Open graph" do Flow; null abre a tesouraria. */
  initialW?: string | null
}

export default function EgoPageClient({ initialW }: EgoPageClientProps) {
  const router = useRouter()

  const startW = isAddr(initialW ?? null) && initialW ? initialW : DEFAULT_ROOT

  // Estado do modo, todo espelhavel na URL (?view=ego&w=&limit=).
  const [ready, setReady] = useState(false)
  const [w, setW] = useState(startW)
  const [limitParam, setLimitParam] = useState<number | null>(null)
  const [mobile, setMobile] = useState(false)
  const [trail, setTrail] = useState<Crumb[]>([TREASURY_CRUMB])
  const [focus, setFocus] = useState<string | null>(null)

  // Dados: payload do ego (ou fixture com selo) e dossie do no focado.
  const [data, setData] = useState<EgoResponse | null>(null)
  const [fixture, setFixture] = useState(false)
  const [loading, setLoading] = useState(true)
  const [dossier, setDossier] = useState<NodeDossier | null>(null)
  const [dossierLoading, setDossierLoading] = useState(false)
  const [dossierError, setDossierError] = useState<string | null>(null)

  // true = o proximo espelho de URL empilha historico (re-centro e entrada
  // no modo); false = replaceState (ajuste de limit, chegada por deep link).
  const pushRef = useRef(false)

  // ── boot: le a URL uma vez e observa o breakpoint mobile ─────────────────
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search)
    let start = startW
    if (sp.get('view') === 'ego') {
      // deep link ou popstate que remontou o modo: a URL manda
      const uw = sp.get('w')
      if (isAddr(uw)) start = uw
      setLimitParam(parseLimit(sp.get('limit')))
      pushRef.current = false
    } else {
      // veio do toggle GRAPH ou do "Open graph": o primeiro espelho empilha
      // a entrada de historico pro voltar devolver ao Flow
      pushRef.current = true
    }
    setW(start)
    if (start !== DEFAULT_ROOT) setTrail([TREASURY_CRUMB, { w: start, name: truncAddr(start) }])

    const mq = window.matchMedia('(max-width: 767px)')
    setMobile(mq.matches)
    const onChange = () => setMobile(mq.matches)
    mq.addEventListener('change', onChange)
    setReady(true)
    return () => mq.removeEventListener('change', onChange)
    // boot roda uma unica vez por montagem, de proposito
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── voltar/avancar do navegador: re-centra pela URL, sem empilhar ────────
  useEffect(() => {
    const onPop = () => {
      const sp = new URLSearchParams(window.location.search)
      // saiu do modo ego: o wrapper troca a view, aqui nao ha o que fazer
      if (sp.get('view') !== 'ego') return
      const uw = sp.get('w')
      const next = isAddr(uw) ? uw : DEFAULT_ROOT
      pushRef.current = false
      setLimitParam(parseLimit(sp.get('limit')))
      setFocus(null)
      setW(next)
      setTrail((prev) => {
        const idx = prev.findIndex((c) => c.w === next)
        if (idx >= 0) return prev.slice(0, idx + 1)
        return [...prev, { w: next, name: truncAddr(next) }]
      })
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  // ── espelho na URL: pushState nos re-centros, replaceState no resto ──────
  useEffect(() => {
    if (!ready) return
    const sp = new URLSearchParams()
    sp.set('view', 'ego')
    sp.set('w', w)
    if (limitParam !== null) sp.set('limit', String(limitParam))
    const url = `${window.location.pathname}?${sp.toString()}`
    if (pushRef.current) {
      pushRef.current = false
      window.history.pushState(null, '', url)
    } else {
      window.history.replaceState(null, '', url)
    }
  }, [ready, w, limitParam])

  // Limit efetivo do fetch: o da URL quando o usuario expandiu, senao 12 no
  // mobile e 24 no desktop (default do contrato).
  const effLimit = limitParam ?? (mobile ? 12 : 24)

  // ── fetch do ego ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!ready) return
    let alive = true
    setLoading(true)
    const sp = new URLSearchParams()
    sp.set('w', w)
    sp.set('limit', String(effLimit))
    // ⚠️ AbortSignal.timeout(12000): sem teto do lado do cliente o fetch
    // pendura junto com o banco e o fallback nunca dispara (incidente de IO
    // de 26/08 no Flow). Timeout ou erro caem na amostra com selo, nunca
    // tela branca; a flag alive descarta resposta atrasada de centro velho.
    fetch(`/api/holders/tree/ego?${sp.toString()}`, { signal: AbortSignal.timeout(12000) })
      .then(async (res) => {
        if (!res.ok) throw new Error(`status ${res.status}`)
        return (await res.json()) as EgoResponse
      })
      .then((payload) => {
        if (!alive) return
        setData(payload)
        setFixture(false)
        setLoading(false)
      })
      .catch(() => {
        if (!alive) return
        setData(EGO_FIXTURE)
        setFixture(true)
        setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [ready, w, effLimit])

  // ── fetch do dossie quando um no e focado (erro nao derruba nada) ────────
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

  // ── nomes e re-centro ────────────────────────────────────────────────────
  function nameOf(a: string): string {
    if (a === DEFAULT_ROOT) return 'TREASURY'
    if (data && !fixture) {
      if (data.center.w === a) {
        return data.center.label ? data.center.label.name.toUpperCase() : truncAddr(a)
      }
      for (const e of data.inflows) {
        if (e.w === a) return e.label ? e.label.name.toUpperCase() : truncAddr(a)
      }
      for (const e of data.outflows) {
        if (e.w === a) return e.label ? e.label.name.toUpperCase() : truncAddr(a)
      }
    }
    return truncAddr(a)
  }

  function recenterTo(a: string) {
    if (a === w) {
      setFocus(null)
      return
    }
    setTrail((prev) => {
      const idx = prev.findIndex((c) => c.w === a)
      if (idx >= 0) return prev.slice(0, idx + 1)
      return [...prev, { w: a, name: nameOf(a) }]
    })
    // re-centro e um passo de navegacao: entra no historico do navegador
    pushRef.current = true
    setFocus(null)
    setW(a)
  }

  // ── handlers da cena ─────────────────────────────────────────────────────
  function handleRestClick() {
    // o resto agregado nao vira lista aqui: sobe o ?limit ate o teto do
    // contrato (12 -> 24 -> 48 no mobile, 24 -> 48 no desktop)
    if (effLimit >= LIMIT_MAX) return
    setLimitParam(Math.min(LIMIT_MAX, effLimit * 2))
  }

  function handleAddressClick(a: string) {
    // regra da casa: endereco leva pra pagina interna, nunca pra fora
    router.push(`/address/bitcoin/${a}`)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* so a busca: os filtros do Flow nao agem sobre o ego */}
      <FlowControls hideFilters onPick={recenterTo} />

      {trail.length > 1 && (
        <div className="flex items-center gap-1.5 overflow-x-auto border-b border-white/10 px-4 py-1.5 sm:px-6">
          <span className="shrink-0 text-[9px] uppercase tracking-[0.2em] text-white/40">Center</span>
          {trail.map((c, i) => (
            <span key={c.w} className="flex shrink-0 items-center gap-1.5">
              {i > 0 && <span className="text-white/25">/</span>}
              <button
                onClick={() => recenterTo(c.w)}
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
          <EgoScene
            data={data}
            mobile={mobile}
            onCounterpartyClick={recenterTo}
            onRestClick={handleRestClick}
            onAddressClick={handleAddressClick}
            onCenterClick={(a) => setFocus(a)}
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-[#040305]">
            <p className="text-xs uppercase tracking-[0.25em] text-white/60">Charting the graph...</p>
          </div>
        )}

        {/* selo da amostra: dado vivo indisponivel, nunca fingir que e real */}
        {fixture && (
          <div className="pointer-events-none absolute left-3 top-3 z-10 border border-[#4A90D9] bg-[#0B0A11]/90 px-2 py-1 text-[9px] uppercase tracking-[0.2em] text-[#4A90D9]">
            Sample data, live data unavailable
          </div>
        )}

        {loading && data && (
          <div className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2 border border-white/10 bg-[#0B0A11]/90 px-2 py-1 text-[9px] uppercase tracking-[0.2em] text-white/50">
            Updating graph...
          </div>
        )}

        {/* mesmo dossie do Flow; aqui "Re-root here" re-centra o ego e o
            "Open graph" some (ja estamos nele) */}
        <NodePanel
          open={!!focus}
          mobile={mobile}
          w={focus}
          dossier={dossier}
          loading={dossierLoading}
          error={dossierError}
          onClose={() => setFocus(null)}
          onReRoot={recenterTo}
          onFocus={(a) => setFocus(a)}
        />
      </div>
    </div>
  )
}
