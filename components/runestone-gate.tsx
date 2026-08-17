"use client"

// A entrada da seção /runestone: a própria pedra, sem moldura.
//
// São 32 quadros renderizados do runestone3d.gltf oficial, o mesmo modelo que o
// visualizador da DogCity carrega, com a mesma plataforma de luz. Ou seja, é 3D
// de verdade, só que assado em uma folha de 115KB: sem WebGL, sem custo de GPU e
// funcionando igual no celular.
//
// Parada, ela gira devagar, e esse giro é a única pista de que dá para tocar,
// já que o rótulo só aparece no hover e celular não tem hover. Com o ponteiro
// em cima, o giro para e a posição horizontal passa a comandar o quadro: a
// pessoa gira a pedra na mão.

import Link from "next/link"
import { useCallback, useEffect, useRef, useState } from "react"

const FRAMES = 32
const COLS = 8
const ROWS = 4
const SHEET = "/runestone-turntable.webp"
const SPIN_MS = 110          // ~3,5s por volta

export function RunestoneGate({ className = "" }: { className?: string }) {
  const [frame, setFrame] = useState(0)
  const [held, setHeld] = useState(false)
  const stoneRef = useRef<HTMLSpanElement>(null)
  const reduced = useRef(false)

  useEffect(() => {
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (reduced.current) setFrame(0)
  }, [])

  // giro ocioso, suspenso enquanto o ponteiro comanda e quando a aba está oculta
  useEffect(() => {
    if (held || reduced.current) return
    let id: number | undefined
    const tick = () => {
      if (!document.hidden) setFrame(f => (f + 1) % FRAMES)
      id = window.setTimeout(tick, SPIN_MS)
    }
    id = window.setTimeout(tick, SPIN_MS)
    return () => window.clearTimeout(id)
  }, [held])

  const scrub = useCallback((clientX: number) => {
    const el = stoneRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    if (!r.width) return
    const t = Math.min(1, Math.max(0, (clientX - r.left) / r.width))
    setFrame(Math.round(t * (FRAMES - 1)))
  }, [])

  const col = frame % COLS
  const row = Math.floor(frame / COLS)

  return (
    <Link
      href="/runestone"
      aria-label="Open the Runestone dossier"
      className={`group relative shrink-0 inline-flex flex-col items-center outline-none ${className}`}
      // o proprio movimento assume o controle: nao dependo de pointerenter, que o
      // React sintetiza a partir de over/out e que nem sempre chega quando o
      // ponteiro ja estava sobre o elemento na hora que a pagina montou
      onPointerMove={e => {
        if (e.pointerType === "touch") return
        setHeld(true)
        scrub(e.clientX)
      }}
      onPointerLeave={() => setHeld(false)}
      onPointerCancel={() => setHeld(false)}
      onBlur={() => setHeld(false)}
    >
      <span
        ref={stoneRef}
        role="img"
        aria-hidden
        className="block h-24 md:h-32 w-[50px] md:w-[67px] transition-transform duration-300
          group-hover:scale-[1.06] group-focus-visible:scale-[1.06]
          drop-shadow-[0_0_18px_rgba(245,110,15,0)] group-hover:drop-shadow-[0_0_18px_rgba(245,110,15,0.35)]"
        style={{
          backgroundImage: `url(${SHEET})`,
          backgroundSize: `${COLS * 100}% ${ROWS * 100}%`,
          backgroundPosition: `${(col / (COLS - 1)) * 100}% ${(row / (ROWS - 1)) * 100}%`,
          backgroundRepeat: "no-repeat",
        }}
      />

      {/* base: a pedra precisa parecer pousada em algo, senão flutua */}
      <span
        aria-hidden
        className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-px w-10 md:w-14
          bg-gradient-to-r from-transparent via-lava/40 to-transparent
          transition-opacity duration-300 opacity-40 group-hover:opacity-90"
      />

      {/* O rótulo só no hover e no foco, para não estragar o segredo.
          Ele mora à direita da pedra e alinhado com a base dela, que é a faixa
          vazia entre o título e o subtítulo: embaixo da pedra ele batia em cima
          do subtítulo. Some abaixo de md porque ali não existe hover e a linha
          é estreita demais para ele caber. */}
      <span
        className="pointer-events-none hidden md:block absolute left-full bottom-2 ml-4
          whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.22em] text-lava
          opacity-0 -translate-x-1 transition-all duration-200
          group-hover:opacity-100 group-hover:translate-x-0
          group-focus-visible:opacity-100 group-focus-visible:translate-x-0"
      >
        ᚠ open the dossier
      </span>

      <span className="sr-only">The Runestone: open the dossier</span>
    </Link>
  )
}
