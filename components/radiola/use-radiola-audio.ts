'use client'

// Engine do mini-player: um HTMLAudioElement nativo (sem lib). Toca as faixas do
// catálogo do Radiola em ordem ALEATÓRIA (shuffle uma vez, no mount) e segue a
// fila com next/prev. O shuffle roda no cliente (o player só aparece depois de
// montar), então não há mismatch de hidratação.

import { useCallback, useEffect, useRef, useState } from 'react'
import { TRACKS, type RadiolaTrack } from '@/lib/radiola/catalog'

/** ordem de reprodução embaralhada (Fisher–Yates). */
function shuffledOrder(n: number): number[] {
  const a = Array.from({ length: n }, (_, i) => i)
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = a[i]
    a[i] = a[j]
    a[j] = tmp
  }
  return a
}

export interface RadiolaAudioApi {
  track: RadiolaTrack | undefined
  pos: number
  count: number
  playing: boolean
  buffering: boolean
  progress: number
  toggle: () => void
  next: () => void
  prev: () => void
}

export function useRadiolaAudio(): RadiolaAudioApi {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [order] = useState(() => shuffledOrder(TRACKS.length))
  const [pos, setPos] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [buffering, setBuffering] = useState(false)
  const [progress, setProgress] = useState(0)
  const wantPlayRef = useRef(false)

  // Elemento criado uma vez, só no cliente.
  useEffect(() => {
    const a = new Audio()
    a.preload = 'metadata'
    audioRef.current = a

    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const onWaiting = () => setBuffering(true)
    const onPlaying = () => { setBuffering(false); setPlaying(true) }
    const onCanPlay = () => setBuffering(false)
    const onTime = () => setProgress(a.duration ? Math.min(1, a.currentTime / a.duration) : 0)
    const onEnded = () => { wantPlayRef.current = true; setPos((p) => (p + 1) % Math.max(1, order.length)) }
    const onError = () => { setBuffering(false); setPlaying(false) }

    a.addEventListener('play', onPlay)
    a.addEventListener('pause', onPause)
    a.addEventListener('waiting', onWaiting)
    a.addEventListener('playing', onPlaying)
    a.addEventListener('canplay', onCanPlay)
    a.addEventListener('timeupdate', onTime)
    a.addEventListener('ended', onEnded)
    a.addEventListener('error', onError)

    return () => {
      a.pause()
      // Sem isto um fetch de mídia em voo sobrevive ao unmount do player.
      a.removeAttribute('src')
      a.load()
      a.removeEventListener('play', onPlay)
      a.removeEventListener('pause', onPause)
      a.removeEventListener('waiting', onWaiting)
      a.removeEventListener('playing', onPlaying)
      a.removeEventListener('canplay', onCanPlay)
      a.removeEventListener('timeupdate', onTime)
      a.removeEventListener('ended', onEnded)
      a.removeEventListener('error', onError)
      audioRef.current = null
    }
  }, [order.length])

  // Carrega a faixa quando a posição muda; toca só se já estava tocando.
  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    const track = TRACKS[order[pos]]
    setProgress(0)
    if (track?.src) {
      a.src = track.src
      a.load()
      if (wantPlayRef.current) a.play().catch(() => setPlaying(false))
    } else {
      // src = '' resolveria pra URL da própria página e o browser tentaria
      // tocar o HTML como mídia (dispara 'error'). Faixa só de UI: sem fonte.
      a.removeAttribute('src')
      a.load()
    }
  }, [pos, order])

  const toggle = useCallback(() => {
    const a = audioRef.current
    if (!a) return
    if (a.paused) {
      const track = TRACKS[order[pos]]
      if (!track?.src) return
      wantPlayRef.current = true
      if (!a.src) a.src = track.src
      a.play().catch(() => setPlaying(false))
    } else {
      wantPlayRef.current = false
      a.pause()
    }
  }, [order, pos])

  const go = useCallback((delta: number) => {
    const a = audioRef.current
    wantPlayRef.current = a ? !a.paused : false
    setPos((p) => (p + delta + order.length) % order.length)
  }, [order.length])

  const next = useCallback(() => go(1), [go])
  const prev = useCallback(() => go(-1), [go])

  return {
    track: TRACKS[order[pos]],
    pos,
    count: order.length,
    playing,
    buffering,
    progress,
    toggle,
    next,
    prev,
  }
}
