'use client'

// Galáxia pura: renderiza o TreeScene. Flow e Graph aposentados 31/08.

import dynamic from 'next/dynamic'

const TreeScene = dynamic(() => import('./tree-scene'), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen w-full items-center justify-center bg-[#040305]">
      <p className="font-mono text-xs uppercase tracking-[0.25em] text-white/60">Charting the galaxy...</p>
    </div>
  ),
})

export default function TreeClientWrapper() {
  return <TreeScene />
}
