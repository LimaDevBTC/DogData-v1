'use client'

// Casca da pagina: o Flow (sankey re-rooteavel) e o modo DEFAULT e carrega
// direto; a galaxia 3D virou modo secundario e so baixa o chunk (Three
// inteiro) quando o usuario ativa o toggle, via next/dynamic sem SSR.
// tree-scene.tsx e galaxy.ts ficam intocados.

import { useState } from 'react'
import dynamic from 'next/dynamic'
import FlowPageClient from './flow-page-client'

const TreeScene = dynamic(() => import('./tree-scene'), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen w-full items-center justify-center bg-[#040305]">
      <p className="font-mono text-xs uppercase tracking-[0.25em] text-white/60">Charting the galaxy...</p>
    </div>
  ),
})

type Mode = 'flow' | 'galaxy'

export default function TreeClientWrapper() {
  const [mode, setMode] = useState<Mode>('flow')

  if (mode === 'galaxy') {
    return (
      <div className="relative">
        <TreeScene />
        {/* banner discreto do modo visual, com o caminho de volta pro Flow */}
        <div className="fixed bottom-5 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 border border-white/10 bg-[#0B0A11]/90 px-3 py-1.5 font-mono">
          <span className="whitespace-nowrap text-[10px] uppercase tracking-[0.2em] text-white/50">
            Visual mode. For analysis, use Flow.
          </span>
          <button
            onClick={() => setMode('flow')}
            className="whitespace-nowrap text-[10px] uppercase tracking-[0.2em] text-[#f7931a] transition-colors hover:text-white"
          >
            ← Flow
          </button>
        </div>
      </div>
    )
  }

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
          <h1 className="mt-0.5 text-base uppercase tracking-[0.3em] text-white/90 sm:text-lg">Holders Tree</h1>
        </div>
        <div className="flex items-center border border-white/10">
          <span className="border-r border-white/10 bg-white/5 px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] text-[#f7931a]">
            Flow
          </span>
          <button
            onClick={() => setMode('galaxy')}
            className="px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] text-white/40 transition-colors hover:text-white"
          >
            Galaxy
          </button>
        </div>
      </header>
      <FlowPageClient />
    </div>
  )
}
