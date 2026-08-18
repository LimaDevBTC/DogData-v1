'use client'

import dynamic from 'next/dynamic'

// Raw Three.js lives on the client only; the page shell above it is a server
// component so the route still has metadata and a first paint.
const PlazaScene = dynamic(() => import('./plaza-scene'), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen w-full items-center justify-center bg-black">
      <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-white/50">Satoshi Plaza</p>
    </div>
  ),
})

export default function PlazaClient() {
  return <PlazaScene />
}
