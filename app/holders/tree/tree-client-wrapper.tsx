'use client'

// A cena e 100% client-side (WebGL + window): dynamic import sem SSR,
// no mesmo padrao de app/city/war/war-client-wrapper.tsx.
import dynamic from 'next/dynamic'

const TreeScene = dynamic(() => import('./tree-scene'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-screen bg-[#040305] flex items-center justify-center">
      <p className="font-mono text-xs text-white/60 tracking-[0.25em] uppercase">Charting the galaxy...</p>
    </div>
  ),
})

export default function TreeClientWrapper() {
  return <TreeScene />
}
