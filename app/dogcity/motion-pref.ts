"use client"

// ═══════════════════════════════════════════════════════════════════════════
// A preferência "Motion: on / off" (landing v3, brief §8), SEM framer-motion.
//
// O interruptor do menu e do rodapé da landing (roubado do VI) guarda a escolha
// em localStorage. Sem escolha, vale o `prefers-reduced-motion` do sistema.
// Mora fora de ./motion.tsx de propósito: a landing não carrega o framer-motion
// (45 kB gzip na rota), e ./motion.tsx reexporta daqui para os primitivos dele
// obedecerem à mesma escolha nas outras páginas.
// ═══════════════════════════════════════════════════════════════════════════

import { useSyncExternalStore } from "react"

const MOTION_KEY = "dogcity-motion"
type MotionPref = "on" | "off" | null
let motionPref: MotionPref | undefined
const subs = new Set<() => void>()

function readPref(): MotionPref {
  if (motionPref !== undefined) return motionPref
  try {
    const v = window.localStorage.getItem(MOTION_KEY)
    motionPref = v === "on" || v === "off" ? v : null
  } catch {
    motionPref = null
  }
  return motionPref
}

export function setMotionPref(v: "on" | "off") {
  motionPref = v
  try { window.localStorage.setItem(MOTION_KEY, v) } catch { /* modo privado: vale só nesta aba */ }
  subs.forEach((fn) => fn())
}

export function useMotionPref(): MotionPref {
  return useSyncExternalStore(
    (fn) => { subs.add(fn); return () => { subs.delete(fn) } },
    readPref,
    () => null,
  )
}

const QUERY = "(prefers-reduced-motion: reduce)"
function osReduced(): boolean {
  try { return window.matchMedia(QUERY).matches } catch { return false }
}
function useOsReduced(): boolean {
  return useSyncExternalStore(
    (fn) => {
      let mq: MediaQueryList | null = null
      try { mq = window.matchMedia(QUERY); mq.addEventListener("change", fn) } catch { /* sem matchMedia */ }
      return () => { mq?.removeEventListener("change", fn) }
    },
    osReduced,
    () => false,
  )
}

/** true quando a página deve ficar parada: escolha da pessoa, ou o sistema */
export function useMotionReduced(): boolean {
  const os = useOsReduced()
  const pref = useMotionPref()
  return pref ? pref === "off" : os
}
