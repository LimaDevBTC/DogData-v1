"use client"

// ═══════════════════════════════════════════════════════════════════════════
// Primitivos da landing v3: a gramática dos dois materiais (visor e prancha),
// os botões de canto reto, o wordmark (sempre o SVG) e o odômetro.
// O vocabulário de movimento continua sendo ../motion.tsx (EASE, Reveal,
// SplitLine, DrawRule, Scramble): aqui só o que é desta página.
// ═══════════════════════════════════════════════════════════════════════════

import {
  createContext, useCallback, useContext, useEffect, useRef, useState,
  type AnchorHTMLAttributes, type ReactNode,
} from "react"
import { useMotionReduced } from "../motion-pref"

// ── o estado de movimento da página, num lugar só ───────────────────────────
// `reduced` junta o interruptor "Motion" e o prefers-reduced-motion (motion.tsx).
export const MotionCtx = createContext<{ reduced: boolean }>({ reduced: false })
export const useReduced = () => useContext(MotionCtx).reduced
export function MotionScope({ children }: { children: (reduced: boolean) => ReactNode }) {
  const reduced = useMotionReduced()
  return <MotionCtx.Provider value={{ reduced }}>{children(reduced)}</MotionCtx.Provider>
}

// ── layout ──────────────────────────────────────────────────────────────────
/** a largura útil da página: até 1.360 px, margem lateral pela variável --dc-gutter */
export function Frame({ children, className = "", id }: { children: ReactNode; className?: string; id?: string }) {
  return (
    <div id={id} className={`mx-auto w-full max-w-[calc(1360px+2*var(--dc-gutter))] px-[var(--dc-gutter)] ${className}`}>
      {children}
    </div>
  )
}

/** o cabeçalho da seção numa linha só: o número da folha (lava; lava-hot sobre imagem)
 *  e o rótulo, como a folha de um conjunto ("02 · ORDINALS ON BITCOIN L1"). O H2 vem logo
 *  abaixo; o nome da seção não se repete em cima dele. */
export function SectionHead({ n, label, onImage = false, className = "" }: { n: string; label: string; onImage?: boolean; className?: string }) {
  return (
    <p className={`dc-label flex flex-wrap items-baseline gap-x-3 gap-y-1 ${onImage ? "text-dc-snow/[0.9] dc-halo" : "text-dc-mist"} ${className}`}>
      <span className={onImage ? "text-dc-hot" : "text-dc-lava"}>{n}</span>
      <span aria-hidden className={`self-center h-px w-6 ${onImage ? "bg-dc-snow/[0.4]" : "bg-dc-snow/[0.24]"}`} />
      <span>{label}</span>
    </p>
  )
}

export function Ticks() {
  return (
    <span aria-hidden className="dc-ticks">
      <i /><i /><i /><i />
    </span>
  )
}

/** a PRANCHA: placa opaca, fio de cabelo, cantos retos, marcas de registro */
export function Plate({
  children, className = "", ticks = true, as: As = "div", ...rest
}: { children: ReactNode; className?: string; ticks?: boolean; as?: "div" | "article" | "section" | "li" } & Record<string, unknown>) {
  return (
    <As className={`dc-plate ${className}`} {...rest}>
      {ticks && <Ticks />}
      {children}
    </As>
  )
}

/** uma linha de dado da prancha: rótulo mono à esquerda, valor à direita. O valor sai em
 *  caixa alta (P12), menos a unidade de área: "m²" como a escritura imprime (N2) */
function unidade(c: ReactNode): ReactNode {
  if (typeof c !== "string" || !c.endsWith(" m²")) return c
  return <>{c.slice(0, -3)} <span className="normal-case">m²</span></>
}
export function DataRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5 border-b border-dc-snow/[0.08] last:border-0">
      <dt className="dc-label text-dc-dusty shrink-0">{label}</dt>
      <dd className="font-mono text-[13px] md:text-[14px] uppercase text-dc-snow text-right tabular-nums min-w-0 break-words">{unidade(children)}</dd>
    </div>
  )
}

// ── botões e links ──────────────────────────────────────────────────────────
type BtnProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: "fill" | "line"
  size?: "md" | "sm"
  external?: boolean
}
export function Btn({ variant = "fill", size = "md", external, className = "", children, ...rest }: BtnProps) {
  return (
    <a
      className={`dc-btn ${variant === "fill" ? "dc-btn-fill" : "dc-btn-line"} ${size === "sm" ? "dc-btn-sm" : ""} ${className}`}
      {...(external ? { target: "_blank", rel: "noopener" } : {})}
      {...rest}
    >
      {children}
    </a>
  )
}

export function TextLink({ external, className = "", children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { external?: boolean }) {
  return (
    <a className={`dc-link ${className}`} {...(external ? { target: "_blank", rel: "noopener" } : {})} {...rest}>
      {children}
    </a>
  )
}

// ── a marca: SEMPRE o SVG (LEIAME da marca). Abaixo de 32 px, o favicon D· ──
export const WORDMARK_SRC = "/landing/v3/brand/dogcity-negativa.svg"
export const FAVICON_SRC = "/landing/v3/brand/dogcity-favicon.svg"
/** proporção do wordmark (viewBox 10083 x 1520) e o centro do ponto laranja nele */
export const WORDMARK_RATIO = 10083 / 1520
export const WORDMARK_DOT = { x: 0.4862, y: 0.6257, r: 0.0209 }

export function Wordmark({ height, className = "", alt = "DogCity" }: { height: number; className?: string; alt?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={WORDMARK_SRC} alt={alt} width={Math.round(height * WORDMARK_RATIO)} height={height} className={`block ${className}`} draggable={false} />
}

export function FaviconMark({ size = 32, className = "", alt = "DogCity" }: { size?: number; className?: string; alt?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={FAVICON_SRC} alt={alt} width={size} height={size} className={`block ${className}`} draggable={false} />
}

// ── visibilidade, uma vez ───────────────────────────────────────────────────
export function useNear<T extends Element>(rootMargin = "600px 0px", once = true) {
  const ref = useRef<T>(null)
  const [near, setNear] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver((es) => {
      const e = es[es.length - 1]
      if (e.isIntersecting) { setNear(true); if (once) io.disconnect() }
      else if (!once) setNear(false)
    }, { rootMargin })
    io.observe(el)
    return () => io.disconnect()
  }, [rootMargin, once])
  return { ref, near }
}

// ── o ODÔMETRO ──────────────────────────────────────────────────────────────
// O número rola do valor anterior até o novo, escrito direto no nó (nenhum
// estado React por quadro). A largura é reservada por um fantasma invisível com
// o texto final (a técnica do `Steady` de construction-fund.tsx): o número que
// rola nunca empurra o layout. Texto não numérico ("US$2") entra direto.
const parseNum = (s: string | null) => (s && /^[\d,]+$/.test(s) ? Number(s.replace(/,/g, "")) : null)

export function Odometer({
  text, from, duration = 1400, delay = 0, className = "", onSettled,
}: {
  text: string | null
  /** valor de partida na PRIMEIRA animação (o cartão de título rola de 10,000,000) */
  from?: number
  duration?: number
  delay?: number
  className?: string
  onSettled?: () => void
}) {
  const reduced = useReduced()
  const out = useRef<HTMLSpanElement>(null)
  const last = useRef<number | null>(null)
  const settled = useRef(onSettled)
  settled.current = onSettled

  useEffect(() => {
    const el = out.current
    if (!el) return
    const target = parseNum(text)
    if (text == null) { el.textContent = ""; return }
    if (target == null || reduced) {
      el.textContent = text
      last.current = target
      settled.current?.()
      return
    }
    const start = last.current ?? from ?? target
    last.current = target
    if (start === target) { el.textContent = text; settled.current?.(); return }
    let raf = 0
    let t0 = 0
    const fmt = (v: number) => Math.round(v).toLocaleString("en-US")
    const tick = (t: number) => {
      if (!t0) t0 = t + delay
      const k = Math.max(0, Math.min(1, (t - t0) / duration))
      const e = 1 - Math.pow(1 - k, 4)
      el.textContent = fmt(start + (target - start) * e)
      if (k < 1) raf = requestAnimationFrame(tick)
      else { el.textContent = text; settled.current?.() }
    }
    el.textContent = fmt(start)
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [text, from, duration, delay, reduced])

  // o fantasma reserva a largura do MAIOR dos dois (o de partida pode ser mais
  // largo: 10,000,000 contra 112,655), para nada pular enquanto rola
  const ghost = from != null && parseNum(text) != null && from.toLocaleString("en-US").length > (text ?? "").length
    ? from.toLocaleString("en-US")
    : text ?? ""
  return (
    <span className={`relative inline-block whitespace-nowrap ${className}`}>
      <span aria-hidden className="invisible tabular-nums">{ghost}</span>
      <span aria-hidden ref={out} className="absolute left-0 top-0 tabular-nums">{text}</span>
    </span>
  )
}

// ── copiar um valor: "COPIED" por 1,6 s ─────────────────────────────────────
export function useCopy() {
  const [copied, setCopied] = useState<string | null>(null)
  const t = useRef<ReturnType<typeof setTimeout>>()
  const copy = useCallback(async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      const ta = document.createElement("textarea")
      ta.value = value
      document.body.appendChild(ta)
      ta.select()
      try { document.execCommand("copy") } catch { /* sem área de transferência */ }
      ta.remove()
    }
    setCopied(key)
    clearTimeout(t.current)
    t.current = setTimeout(() => setCopied(null), 1600)
  }, [])
  return { copied, copy }
}

// ── formatação ──────────────────────────────────────────────────────────────
/** área como a escritura imprime: milhar e uma casa ("21,770.0 m²") */
export const areaDeed = (n: number) =>
  `${n.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m²`
export const dogExact = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
