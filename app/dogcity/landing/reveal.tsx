"use client"

// ═══════════════════════════════════════════════════════════════════════════
// As entradas da landing v3, SEM framer-motion (brief §8 e §10).
//
// O mesmo vocabulário de ../motion.tsx (a curva EASE [0.16, 1, 0.3, 1], 700 ms,
// o conteúdo sobe 16 px e aparece; o H2 se revela por máscara, palavra a
// palavra), mas feito com IntersectionObserver e transição CSS: só transform e
// opacity, nenhum laço por quadro, e a rota deixa de carregar o framer-motion
// (45 kB gzip, o que passava do teto de 180 kB do briefing).
//
// Disparam UMA vez, ao entrar, e nunca repetem. Com movimento reduzido (ou o
// interruptor Motion desligado) nascem no estado final. Só para o que mora
// ABAIXO da dobra: o herói anima por montagem (ver sections/hero.tsx).
// ═══════════════════════════════════════════════════════════════════════════

import { createElement, useEffect, useRef, useState, type ReactNode } from "react"
import { useReduced } from "./ui"

const EASE = "cubic-bezier(0.16, 1, 0.3, 1)"

function useEnter<T extends Element>(reduced: boolean, margin = "0px 0px -12% 0px") {
  const ref = useRef<T>(null)
  const [shown, setShown] = useState(false)
  useEffect(() => {
    if (reduced) { setShown(true); return }
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver((es) => {
      if (es.some((e) => e.isIntersecting)) { setShown(true); io.disconnect() }
    }, { rootMargin: margin })
    io.observe(el)
    return () => io.disconnect()
  }, [reduced, margin])
  return { ref, shown }
}

export function Reveal({
  children, delay = 0, y = 16, className, as = "div",
}: {
  children: ReactNode
  delay?: number
  y?: number
  /** aceito por compatibilidade com ../motion.tsx; aqui nunca há desfoque */
  blur?: boolean
  className?: string
  as?: "div" | "li" | "span"
}) {
  const reduced = useReduced()
  const { ref, shown } = useEnter<HTMLDivElement>(reduced)
  const on = reduced || shown
  return createElement(as, {
    ref,
    className,
    style: reduced ? undefined : {
      opacity: on ? 1 : 0,
      transform: on ? "none" : `translate3d(0, ${y}px, 0)`,
      transition: `opacity 700ms ${EASE} ${delay}s, transform 700ms ${EASE} ${delay}s`,
    },
  }, children)
}

export function SplitLine({ text, className, delay = 0, step = 0.055 }: { text: string; className?: string; delay?: number; step?: number }) {
  const reduced = useReduced()
  const { ref, shown } = useEnter<HTMLSpanElement>(reduced, "0px 0px -10% 0px")
  if (reduced) return <span className={className}>{text}</span>
  const words = text.split(" ")
  return (
    <span ref={ref} className={className} aria-label={text}>
      {words.map((w, i) => (
        <span key={`${w}-${i}`} aria-hidden className="inline-block overflow-hidden align-bottom pb-[0.06em] -mb-[0.06em]">
          <span
            className="inline-block"
            style={{
              transform: shown ? "none" : "translate3d(0, 108%, 0)",
              transition: `transform 850ms ${EASE} ${delay + i * step}s`,
            }}
          >
            {w}
            {i < words.length - 1 ? " " : ""}
          </span>
        </span>
      ))}
    </span>
  )
}
