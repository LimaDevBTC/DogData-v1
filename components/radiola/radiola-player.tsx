'use client'

// Mini-player do Radiola no canto do DogCity.
//
// É simplesmente música: toca as faixas em trend do Radiola em ordem aleatória.
// Pill escuro compacto com o logo do Radiola (minimalista), título/artista,
// prev/play/next, like e um chevron pra recolher numa bolha só com o logo.

import { useCallback, useEffect, useState } from 'react'
import { SkipBack, SkipForward, Play, Pause, Heart, ChevronDown, Loader2, Music2 } from 'lucide-react'
import { useRadiolaAudio } from './use-radiola-audio'
import { RADIOLA_URL, RADIOLA_LOGO } from '@/lib/radiola/catalog'

const COLLAPSED_KEY = 'radiola-player:collapsed'
const LIKED_KEY = 'radiola-player:liked'

function RadiolaMark({ className = '' }: { className?: string }) {
  if (RADIOLA_LOGO) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={RADIOLA_LOGO}
        alt="Radiola"
        draggable={false}
        className={`object-contain ${className}`}
      />
    )
  }
  return <Music2 className={`text-lava ${className}`} />
}

export function RadiolaPlayer() {
  const { track, playing, buffering, progress, toggle, next, prev } = useRadiolaAudio()

  const [mounted, setMounted] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [liked, setLiked] = useState(false)

  useEffect(() => {
    setMounted(true)
    try {
      setCollapsed(localStorage.getItem(COLLAPSED_KEY) === '1')
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    try {
      setLiked(localStorage.getItem(LIKED_KEY + ':' + (track?.id || '')) === '1')
    } catch {
      /* ignore */
    }
  }, [track?.id])

  const setCollapsedPersist = useCallback((v: boolean) => {
    setCollapsed(v)
    try {
      localStorage.setItem(COLLAPSED_KEY, v ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [])

  const toggleLike = useCallback(() => {
    setLiked((v) => {
      const nv = !v
      try {
        localStorage.setItem(LIKED_KEY + ':' + (track?.id || ''), nv ? '1' : '0')
      } catch {
        /* ignore */
      }
      return nv
    })
  }, [track?.id])

  if (!mounted) return null

  // Só vive dentro do DOG CITY (montado em app/city/layout.tsx). Canto
  // inferior-esquerdo — livre na cena da cidade.
  const wrap = 'fixed z-[85] left-4 bottom-4 md:left-6 md:bottom-6 mb-[env(safe-area-inset-bottom)]'
  const waiting = !track?.src

  if (collapsed) {
    return (
      <div className={wrap}>
        <button
          type="button"
          onClick={() => setCollapsedPersist(false)}
          aria-label="Open Radiola player"
          className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-[#0B0A11]/95 shadow-[0_4px_24px_rgba(0,0,0,0.6)] backdrop-blur-sm transition-transform hover:scale-105"
        >
          <RadiolaMark className="h-6 w-6" />
        </button>
      </div>
    )
  }

  return (
    <div className={wrap}>
      <div className="relative flex max-w-[calc(100vw-2rem)] items-center gap-2 rounded-full border border-white/10 bg-[#0B0A11]/95 py-1.5 pl-2.5 pr-2.5 font-mono shadow-[0_4px_24px_rgba(0,0,0,0.6)] backdrop-blur-sm">
        {/* logo Radiola → radiola.music */}
        <a href={RADIOLA_URL} target="_blank" rel="noreferrer" className="shrink-0" title="Radiola Music">
          <RadiolaMark className="h-7 w-7" />
        </a>

        {/* título + artista */}
        <div className="min-w-0 flex-1 px-0.5">
          <div className="truncate text-[12px] font-semibold leading-tight text-snow">
            {track?.title ?? 'Radiola'}
          </div>
          <div className="truncate text-[10px] uppercase leading-tight tracking-[0.14em] text-[#6B6B78]">
            {track?.artist ?? '—'}
          </div>
        </div>

        {/* transporte */}
        <button
          type="button"
          onClick={prev}
          aria-label="Previous track"
          className="shrink-0 p-1 text-white/55 transition-colors hover:text-white"
        >
          <SkipBack className="h-4 w-4" fill="currentColor" />
        </button>

        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? 'Pause' : 'Play'}
          title={waiting ? 'Audio connects once Radiola shares the track URLs' : undefined}
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F5B02B] text-black transition-transform ${
            waiting ? 'opacity-40' : 'shadow-[0_0_14px_rgba(245,176,43,0.45)] hover:scale-105'
          }`}
        >
          {buffering ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : playing ? (
            <Pause className="h-4 w-4" fill="currentColor" />
          ) : (
            <Play className="h-4 w-4 translate-x-[1px]" fill="currentColor" />
          )}
        </button>

        <button
          type="button"
          onClick={next}
          aria-label="Next track"
          className="shrink-0 p-1 text-white/55 transition-colors hover:text-white"
        >
          <SkipForward className="h-4 w-4" fill="currentColor" />
        </button>

        {/* like */}
        <button
          type="button"
          onClick={toggleLike}
          aria-label={liked ? 'Unlike' : 'Like'}
          aria-pressed={liked}
          className={`shrink-0 p-1 transition-colors ${liked ? 'text-[#E6007A]' : 'text-white/45 hover:text-white'}`}
        >
          <Heart className="h-4 w-4" fill={liked ? 'currentColor' : 'none'} />
        </button>

        {/* recolher */}
        <button
          type="button"
          onClick={() => setCollapsedPersist(true)}
          aria-label="Collapse player"
          className="shrink-0 p-1 text-white/35 transition-colors hover:text-white/70"
        >
          <ChevronDown className="h-4 w-4" />
        </button>

        {/* progresso */}
        <span className="pointer-events-none absolute inset-x-4 bottom-0 h-px overflow-hidden bg-white/10">
          <span
            className="block h-full bg-[#F5B02B]/70 transition-[width] duration-500"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </span>
      </div>
    </div>
  )
}
