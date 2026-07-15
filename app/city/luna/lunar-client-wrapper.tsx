'use client'

import dynamic from 'next/dynamic'

const LunarScene = dynamic(() => import('./lunar-scene'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-screen bg-black flex items-center justify-center">
      <p className="font-mono text-xs text-white/60 tracking-[0.25em] uppercase">Loading DogCity Luna...</p>
    </div>
  ),
})

export default function LunarClientWrapper() {
  return <LunarScene />
}
