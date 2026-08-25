'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'

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

// ⚠️ NAVEGADOR EMBUTIDO DE CARTEIRA (fundador, 25/08): a cidade derrubou o
// navegador da carteira TRÊS vezes no celular. WebView de carteira tem teto de
// memória muito abaixo do navegador do sistema, e a cena completa estoura.
// Detecção: celular + provider injetado (no celular só carteira injeta) ou
// marca da carteira no user agent. A espera de 350ms cobre injeção tardia.
function pareceWebViewDeCarteira(): boolean {
  const ua = navigator.userAgent
  const celular = /Android|iPhone|iPad|iPod/i.test(ua)
  if (!celular) return false
  const w = window as unknown as Record<string, unknown>
  const injetado = !!(w.krayWallet || w.unisat_wallet || w.unisat || w.okxwallet || w.XverseProviders || w.btc_providers)
  const marca = /Xverse|OKApp|OKEx|UniSat|Kray|BitKeep|TokenPocket|SafePal|imToken/i.test(ua)
  return injetado || marca
}

export default function PlazaClient() {
  const [porta, setPorta] = useState<'checando' | 'aviso' | 'cena'>('checando')
  const [lite, setLite] = useState(false)
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => {
      setPorta(pareceWebViewDeCarteira() ? 'aviso' : 'cena')
    }, 350)
    return () => clearTimeout(t)
  }, [])

  if (porta === 'checando') {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-black">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-white/50">Satoshi Plaza</p>
      </div>
    )
  }

  if (porta === 'aviso') {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-black px-6">
        <div className="w-full max-w-sm border border-white/10 bg-black p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#F7931A]">Wallet browser detected</p>
          <p className="mt-3 font-mono text-[12px] leading-relaxed text-white/70">
            The full 3D city is too heavy for in-wallet browsers and can crash them.
            For the full experience, open this link in Safari or Chrome.
          </p>
          {/* ⚠️ A DIVISÃO (fundador, 25/08): dentro da carteira não cabe tudo,
              então a escolha é OU a cidade lite OU a batalha. O palco /war é
              muito mais leve que a cidade (sem torres, sem parque, sem GLB) e
              roda no tier baixo do próprio WebView. */}
          <div className="mt-5 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => { setLite(true); setPorta('cena') }}
              className="border border-[#F7931A]/60 px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.2em] text-[#F7931A]"
            >
              Enter the city, lite mode
            </button>
            <a
              href="/city/war"
              className="border border-[#F7931A]/60 px-4 py-2.5 text-center font-mono text-[11px] uppercase tracking-[0.2em] text-[#F7931A]"
            >
              Watch the price war
            </a>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText('https://www.dogdata.xyz/city').then(() => setCopiado(true)).catch(() => {})
              }}
              className="border border-white/15 px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.2em] text-white/60"
            >
              {copiado ? 'Link copied' : 'Copy link for your browser'}
            </button>
          </div>
          <p className="mt-4 font-mono text-[10px] leading-relaxed text-white/35">
            Lite mode lowers the resolution and skips the battle crater. The price war page
            carries only the battlefield, so it fits where the full city does not.
          </p>
        </div>
      </div>
    )
  }

  return <PlazaScene lite={lite} />
}
