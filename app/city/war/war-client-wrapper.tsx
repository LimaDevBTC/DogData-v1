'use client'

import dynamic from 'next/dynamic'

const WarScene = dynamic(() => import('./war-scene'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-screen bg-black flex items-center justify-center">
      <p className="font-mono text-xs text-white/60 tracking-[0.25em] uppercase">Reaching the front...</p>
    </div>
  ),
})

export default function WarClientWrapper() {
  return <WarScene />
}
