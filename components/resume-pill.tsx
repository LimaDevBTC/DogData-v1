'use client'

// A volta em um toque: se a pessoa estava numa rota imersiva ha pouco e caiu
// na landing (aba descartada pelo iOS, navegador in-app reabrindo a URL
// original, ou a raiz mandando pra ca), a pilula oferece o caminho de volta.
// Nunca navega sozinha: quem quis mesmo ver a landing so ignora e ela some
// no primeiro descarte.

import { useEffect, useState, type ElementType } from 'react'
import Link from 'next/link'
import { lerUltimaRota, esquecerUltimaRota } from './route-memory'

// /city/war e /city/plaza eram da cidade antiga, que saiu do ar em 24/09: uma
// rota antiga ainda guardada no aparelho redireciona para a /city (o jogo)
const NOMES: [RegExp, string][] = [
  [/^\/galaxy/, '$DOG Galaxy'],
  [/^\/holders\/tree/, '$DOG Galaxy'],
  [/^\/city/, 'DogCity'],
]

function nomeDe(path: string): string {
  for (const [re, nome] of NOMES) if (re.test(path)) return nome
  return 'where you were'
}

export function ResumePill() {
  const [alvo, setAlvo] = useState<string | null>(null)

  useEffect(() => {
    const u = lerUltimaRota()
    if (u && u.path && !window.location.pathname.startsWith(u.path.split('?')[0])) {
      setAlvo(u.path)
    }
  }, [])

  if (!alvo) return null
  // a /city e rewrite externo (next.config.js): <a> cru, o <Link> navegaria no
  // cliente e nao passaria pelo rewrite
  const Volta: ElementType = alvo.startsWith('/city') ? 'a' : Link

  return (
    <div className="fixed inset-x-4 bottom-20 z-[95] flex justify-center md:inset-x-auto md:bottom-6 md:left-6 md:justify-start">
      <div className="flex items-center gap-2 border border-white/10 bg-[#0B0A11]/95 px-3 py-2 font-mono shadow-[0_4px_24px_rgba(0,0,0,0.6)] backdrop-blur-sm">
        <Volta
          href={alvo}
          className="whitespace-nowrap text-[11px] uppercase tracking-[0.15em] text-[#f7931a] transition-colors hover:text-white"
        >
          Resume {nomeDe(alvo)} →
        </Volta>
        <button
          onClick={() => {
            esquecerUltimaRota()
            setAlvo(null)
          }}
          aria-label="Dismiss"
          className="shrink-0 px-1 text-[13px] leading-none text-white/35 transition-colors hover:text-white/70"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
