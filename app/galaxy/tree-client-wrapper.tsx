'use client'

// Casca da pagina, agora com tres modos: FLOW (sankey re-rooteavel, default,
// carrega direto), GRAPH (ego-grafo, ?view=ego&w= na URL) e GALAXY (visual
// 3D, so client-state como sempre foi; o chunk do Three inteiro so baixa
// quando o usuario ativa o toggle, via next/dynamic sem SSR).
// tree-scene.tsx e galaxy.ts ficam intocados.

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import FlowPageClient from './flow-page-client'
import EgoPageClient from './ego-page-client'

const TreeScene = dynamic(() => import('./tree-scene'), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen w-full items-center justify-center bg-[#040305]">
      <p className="font-mono text-xs uppercase tracking-[0.25em] text-white/60">Charting the galaxy...</p>
    </div>
  ),
})

type Mode = 'flow' | 'ego' | 'galaxy'

export default function TreeClientWrapper() {
  // A GALAXIA e o modo padrao (decisao do fundador, 26/08): e a vitrine e a
  // melhor primeira impressao. Flow e Graph continuam a um clique, e deep
  // links de analise (?view=ego, ?root=, ?focus=...) ainda abrem direto no
  // modo certo via o boot abaixo.
  const [mode, setMode] = useState<Mode>('galaxy')
  // Centro pedido pelo "Open graph" do Flow; null = ego da tesouraria.
  const [egoTarget, setEgoTarget] = useState<string | null>(null)

  // boot: ?view=ego abre no GRAPH; parametros do sankey abrem no FLOW (um
  // link de analise compartilhado nao pode cair na vitrine)
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search)
    if (sp.get('view') === 'ego') {
      setMode('ego')
      return
    }
    if (['root', 'expand', 'min', 'active', 'focus'].some((k) => sp.has(k))) {
      setMode('flow')
    }
  }, [])

  // voltar/avancar do navegador alterna flow<->ego pela URL; a galaxy nao e
  // dirigida por URL e nao sai do lugar num popstate
  useEffect(() => {
    const onPop = () => {
      const sp = new URLSearchParams(window.location.search)
      setMode((m) => (m === 'galaxy' ? m : sp.get('view') === 'ego' ? 'ego' : 'flow'))
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  function openGraphAt(w: string) {
    setEgoTarget(w)
    setMode('ego')
  }

  if (mode === 'galaxy') {
    return (
      <div className="relative">
        <TreeScene />
        {/* a galaxia agora e a porta de entrada: o banner oferece as DUAS
            lentes de analise, nao so o caminho de volta */}
        {/* No celular a barra encolhe e perde o rótulo: dois botões bastam, e
            cada linha de copy aqui é uma faixa de céu a menos (fundador,
            28/08). No desktop o rótulo continua, porque lá sobra espaço. */}
        <div className="fixed bottom-3 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 border border-white/10 bg-[#0B0A11]/90 px-2.5 py-1 font-mono sm:bottom-5 sm:gap-3 sm:px-3 sm:py-1.5">
          <span className="hidden whitespace-nowrap text-[10px] uppercase tracking-[0.2em] text-white/50 sm:inline">
            For analysis:
          </span>
          <button
            onClick={() => setMode('flow')}
            className="whitespace-nowrap text-[10px] uppercase tracking-[0.2em] text-[#f7931a] transition-colors hover:text-white"
          >
            Flow
          </button>
          <span className="text-white/25">/</span>
          <button
            onClick={() => {
              setEgoTarget(null)
              setMode('ego')
            }}
            className="whitespace-nowrap text-[10px] uppercase tracking-[0.2em] text-[#f7931a] transition-colors hover:text-white"
          >
            Graph
          </button>
        </div>
      </div>
    )
  }

  const segOn = 'bg-white/5 px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] text-[#f7931a]'
  const segOff =
    'px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] text-white/40 transition-colors hover:text-white'

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#040305] font-mono text-white">
      <header className="flex items-start justify-between gap-4 border-b border-white/10 px-4 py-3 sm:px-6">
        <div>
          <a
            href="/holders"
            className="text-[10px] uppercase tracking-[0.25em] text-white/40 transition-colors hover:text-[#f7931a]"
          >
            ← Holders
          </a>
          <h1 className="mt-0.5 text-base uppercase tracking-[0.3em] text-white/90 sm:text-lg">$DOG Galaxy</h1>
        </div>
        <div className="flex items-center border border-white/10">
          <button onClick={() => setMode('galaxy')} className={`border-r border-white/10 ${segOff}`}>
            Galaxy
          </button>
          <button
            onClick={() => setMode('flow')}
            disabled={mode === 'flow'}
            className={`border-r border-white/10 ${mode === 'flow' ? segOn : segOff}`}
          >
            Flow
          </button>
          <button
            onClick={() => {
              // toggle direto (sem carteira escolhida): ego da tesouraria
              setEgoTarget(null)
              setMode('ego')
            }}
            disabled={mode === 'ego'}
            className={mode === 'ego' ? segOn : segOff}
          >
            Graph
          </button>
        </div>
      </header>
      {mode === 'ego' ? (
        <EgoPageClient initialW={egoTarget} />
      ) : (
        <FlowPageClient onOpenGraph={openGraphAt} />
      )}
    </div>
  )
}
