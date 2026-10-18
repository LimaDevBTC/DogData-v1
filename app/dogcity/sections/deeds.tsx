"use client"

// ═══════════════════════════════════════════════════════════════════════════
// 02 · THE DEEDS (#deeds), brief landing v3 §4.4.
//
// As escrituras top de linha ANTES da busca, para dar vontade de buscar. Todas
// renderizadas pelo gerador real (dogcity-mundo plano/carta/escritura_render.mjs),
// nunca mockup: public/landing/v3/deeds/, com deeds.json. O nome do tier vem da
// fonte única (lib/airdrop-tiers.ts) pelo degrau.
//
//   Parte 1, a escada: galeria horizontal com encaixe. A primeira tela mostra os
//   três primeiros degraus e o lote de empresa da Plaza, maiores. No desktop a
//   lupa de agrimensor (2400 px por baixo, carregada no primeiro hover); toque
//   ou Enter abrem a escritura em tela cheia, com pinça.
//   Parte 2, "Read a deed": a escritura de exemplo presa enquanto as sete partes
//   acendem (desktop, 260 vh); no celular, sete recortes empilhados.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from "react"
import { Reveal, SplitLine } from "../motion"
import { Btn, Frame, Plate, SheetNo, areaDeed, useReduced } from "../landing/ui"
import { DEED_PARTS, DEED_RATIO, EXAMPLE_DEED, FEATURED, LADDER_REST, type Deed, type DeedGroup } from "../landing/media"

const GROUP_LABEL: Record<DeedGroup, string> = {
  "tiers-1-3": "TIERS 1 TO 3 · WATERFRONT",
  "tiers-4-6": "TIERS 4 TO 6",
  "tiers-7-13": "TIERS 7 TO 13",
  company: "COMPANY",
  reserve: "PROJECT RESERVE",
  example: "",
}

const ORDER: Deed[] = [...FEATURED, ...LADDER_REST]

function cardLine2(d: Deed) {
  return `${d.lotId} · ${areaDeed(d.area)} · ${d.place}`
}

// ═══ a lupa de agrimensor (só ponteiro fino) ═══════════════════════════════
const LENS = 232
const ZOOM = 2.6
function useLoupe(src2400: string) {
  const wrap = useRef<HTMLDivElement>(null)
  const lens = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)
  const [on, setOn] = useState(false)
  const loading = useRef(false)

  const onEnter = useCallback((e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return
    setOn(true)
    if (loading.current) return
    loading.current = true
    const im = new Image()
    im.decoding = "async"
    im.onload = () => setReady(true)
    im.src = src2400
  }, [src2400])

  const onMove = useCallback((e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return
    const w = wrap.current, l = lens.current
    if (!w || !l) return
    const r = w.getBoundingClientRect()
    const x = e.clientX - r.left, y = e.clientY - r.top
    l.style.transform = `translate3d(${x - LENS / 2}px, ${y - LENS / 2}px, 0)`
    l.style.backgroundSize = `${r.width * ZOOM}px ${r.height * ZOOM}px`
    l.style.backgroundPosition = `${-(x * ZOOM - LENS / 2)}px ${-(y * ZOOM - LENS / 2)}px`
  }, [])

  return { wrap, lens, ready, on, onEnter, onMove, onLeave: () => setOn(false) }
}

function DeedCard({ d, big, label, onOpen, flash }: { d: Deed; big: boolean; label: string | null; onOpen: (d: Deed) => void; flash: boolean }) {
  const loupe = useLoupe(d.src2400)
  return (
    <li
      data-lot={d.lotId}
      className={`${big ? "w-[80vw] dk:w-[min(620px,44vw)]" : "w-[66vw] dk:w-[min(440px,31vw)]"} mr-3 dk:mr-6`}
    >
      <p className="dc-label h-6 text-dc-lava">{label ?? ""}</p>
      <div
        ref={loupe.wrap}
        role="button"
        tabIndex={0}
        aria-label={`Open the deed of lot ${d.lotId}, ${d.tierLine}, full screen`}
        onClick={() => onOpen(d)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(d) } }}
        onPointerEnter={loupe.onEnter}
        onPointerMove={loupe.onMove}
        onPointerLeave={loupe.onLeave}
        className={`relative overflow-hidden border bg-dc-deep transition-colors duration-300 [@media(pointer:fine)]:cursor-none
          ${flash ? "border-dc-lava" : "border-dc-snow/[0.12] hover:border-dc-snow/[0.24]"}`}
        style={{ aspectRatio: `${DEED_RATIO}` }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={d.src1200}
          alt={`Lot deed ${d.lotId}: ${d.tierLine}, ${areaDeed(d.area)}, ${d.district}`}
          width={1200}
          height={849}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full select-none"
          draggable={false}
        />
        {/* a lente: cruz de mira, 2400 px por baixo */}
        <div
          ref={loupe.lens}
          aria-hidden
          className={`pointer-events-none absolute left-0 top-0 rounded-full border border-dc-snow/[0.7] shadow-[0_8px_40px_rgba(13,12,9,0.75)] transition-opacity duration-200
            ${loupe.on && loupe.ready ? "opacity-100" : "opacity-0"}`}
          // a 2400 só entra depois do primeiro hover (carregada por useLoupe): um
          // background-image declarado de saída baixava as 15 escrituras grandes na carga
          style={{ width: LENS, height: LENS, backgroundImage: loupe.ready ? `url(${d.src2400})` : "none", backgroundRepeat: "no-repeat" }}
        >
          <span className="absolute left-1/2 top-3 bottom-3 w-px -translate-x-1/2 bg-dc-lava/[0.8]" />
          <span className="absolute top-1/2 left-3 right-3 h-px -translate-y-1/2 bg-dc-lava/[0.8]" />
          <span className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-dc-lava" />
        </div>
      </div>
      <p className="mt-3 font-mono text-[11px] dk:text-[12px] tracking-[0.12em] text-dc-snow">{d.tierLine}</p>
      <p className="mt-1 font-mono text-[11px] dk:text-[12px] tracking-[0.06em] text-dc-mist tabular-nums">{cardLine2(d)}</p>
    </li>
  )
}

// ═══ a escritura em tela cheia, com pinça ══════════════════════════════════
function Viewer({ deed, onClose, onStep }: { deed: Deed; onClose: () => void; onStep: (dir: 1 | -1) => void }) {
  const stage = useRef<HTMLDivElement>(null)
  const img = useRef<HTMLImageElement>(null)
  const view = useRef({ s: 1, x: 0, y: 0 })
  const pts = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef<{ d: number; s: number } | null>(null)
  const lastTap = useRef(0)
  const closeBtn = useRef<HTMLButtonElement>(null)

  const apply = () => {
    const v = view.current
    if (img.current) img.current.style.transform = `translate3d(${v.x}px, ${v.y}px, 0) scale(${v.s})`
  }
  useEffect(() => { view.current = { s: 1, x: 0, y: 0 }; apply() }, [deed])

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    const html = document.documentElement
    const ov = html.style.overflow
    html.style.overflow = "hidden"
    closeBtn.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
      if (e.key === "ArrowRight") onStep(1)
      if (e.key === "ArrowLeft") onStep(-1)
    }
    window.addEventListener("keydown", onKey)
    return () => { html.style.overflow = ov; window.removeEventListener("keydown", onKey); prev?.focus?.() }
  }, [onClose, onStep])

  const clamp = () => {
    const v = view.current
    v.s = Math.max(1, Math.min(4, v.s))
    const st = stage.current
    if (!st) return
    const mx = (st.clientWidth * (v.s - 1)) / 2, my = (st.clientHeight * (v.s - 1)) / 2
    v.x = Math.max(-mx, Math.min(mx, v.x)); v.y = Math.max(-my, Math.min(my, v.y))
    if (v.s === 1) { v.x = 0; v.y = 0 }
  }

  const onDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId)
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pts.current.size === 2) {
      const [a, b] = Array.from(pts.current.values())
      pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), s: view.current.s }
    } else {
      const now = Date.now()
      if (now - lastTap.current < 280) {
        view.current.s = view.current.s > 1.2 ? 1 : 2.5
        clamp(); apply()
      }
      lastTap.current = now
    }
  }
  const onMove = (e: React.PointerEvent) => {
    const p = pts.current.get(e.pointerId)
    if (!p) return
    const dx = e.clientX - p.x, dy = e.clientY - p.y
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pts.current.size === 2 && pinch.current) {
      const [a, b] = Array.from(pts.current.values())
      view.current.s = pinch.current.s * (Math.hypot(a.x - b.x, a.y - b.y) / pinch.current.d)
    } else if (view.current.s > 1) {
      view.current.x += dx; view.current.y += dy
    }
    clamp(); apply()
  }
  const onUp = (e: React.PointerEvent) => {
    pts.current.delete(e.pointerId)
    if (pts.current.size < 2) pinch.current = null
  }
  const onWheel = (e: React.WheelEvent) => {
    view.current.s *= e.deltaY < 0 ? 1.12 : 1 / 1.12
    clamp(); apply()
  }

  return (
    <div role="dialog" aria-modal="true" aria-label={`Deed of lot ${deed.lotId}`} className="fixed inset-0 z-[80] flex flex-col bg-dc-deep/[0.97]">
      <div className="flex h-14 shrink-0 items-center justify-between gap-4 px-[var(--dc-gutter)] border-b border-dc-snow/[0.12]">
        <div className="min-w-0">
          <p className="font-mono text-[11px] tracking-[0.12em] text-dc-snow truncate">{deed.tierLine}</p>
          <p className="font-mono text-[11px] tracking-[0.06em] text-dc-mist truncate">{cardLine2(deed)}</p>
        </div>
        <button ref={closeBtn} type="button" onClick={onClose} className="dc-label !text-[11px] text-dc-snow h-10 px-2 shrink-0">Close</button>
      </div>
      <div
        ref={stage}
        className="relative flex-1 overflow-hidden touch-none select-none"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onWheel={onWheel}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img ref={img} src={deed.src2400} alt={`Lot deed ${deed.lotId}`} className="absolute inset-0 m-auto h-full w-full object-contain origin-center" draggable={false} />
      </div>
      <div className="flex h-14 shrink-0 items-center justify-between px-[var(--dc-gutter)] border-t border-dc-snow/[0.12] pb-[env(safe-area-inset-bottom)]">
        <button type="button" onClick={() => onStep(-1)} className="dc-label !text-[11px] text-dc-snow h-10 px-2">Previous</button>
        <p className="dc-label text-dc-dusty hidden dk:block">Pinch or scroll to zoom · double tap to reset</p>
        <button type="button" onClick={() => onStep(1)} className="dc-label !text-[11px] text-dc-snow h-10 px-2">Next</button>
      </div>
    </div>
  )
}

// ═══ "Read a deed" ═════════════════════════════════════════════════════════
function Hole({ r }: { r: [number, number, number, number] }) {
  const [x, y, w, h] = r
  return (
    <svg viewBox="0 0 1 1" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
      <path d={`M0 0H1V1H0Z M${x} ${y}V${y + h}H${x + w}V${y}Z`} fillRule="evenodd" fill="rgba(13,12,9,0.62)" />
    </svg>
  )
}

function ReadADeedPinned({ deed }: { deed: Deed }) {
  const box = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  useEffect(() => {
    let raf = 0
    const tick = () => {
      raf = 0
      const el = box.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const p = Math.max(0, Math.min(0.9999, -r.top / Math.max(1, r.height - window.innerHeight)))
      setActive(Math.min(DEED_PARTS.length - 1, Math.floor(p * DEED_PARTS.length)))
    }
    const on = () => { if (!raf) raf = requestAnimationFrame(tick) }
    window.addEventListener("scroll", on, { passive: true })
    window.addEventListener("resize", on)
    on()
    return () => { window.removeEventListener("scroll", on); window.removeEventListener("resize", on); cancelAnimationFrame(raf) }
  }, [])

  return (
    <div ref={box} className="relative h-[260vh]">
      <div className="sticky top-0 flex h-[100vh] items-center">
        <Frame className="grid grid-cols-12 gap-6 items-center">
          <div className="col-span-8">
            <div className="relative border border-dc-snow/[0.12] bg-dc-deep" style={{ aspectRatio: `${DEED_RATIO}` }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={deed.src2400} alt={`The example deed, lot ${deed.lotId}: ${deed.tierLine}`} width={2400} height={1697} loading="lazy" decoding="async" className="absolute inset-0 h-full w-full" />
              {DEED_PARTS.map((p, i) => (
                <div key={p.key} aria-hidden className={`absolute inset-0 transition-opacity duration-500 ${i === active ? "opacity-100" : "opacity-0"}`}>
                  <Hole r={p.r} />
                  <span
                    className="absolute border-2 border-dc-lava shadow-[0_0_0_4px_rgba(232,102,13,0.18)]"
                    style={{ left: `${p.r[0] * 100}%`, top: `${p.r[1] * 100}%`, width: `${p.r[2] * 100}%`, height: `${p.r[3] * 100}%` }}
                  />
                </div>
              ))}
            </div>
            <p className="mt-3 font-mono text-[11px] tracking-[0.1em] text-dc-mist">{deed.tierLine} · {cardLine2(deed)}</p>
          </div>
          <div className="col-span-4">
            <h3 className="dc-h3 text-dc-snow">Read a deed.</h3>
            <ol className="mt-6 border-t border-dc-snow/[0.12]">
              {DEED_PARTS.map((p, i) => (
                <li key={p.key} className={`border-b border-dc-snow/[0.12] py-3 transition-colors duration-300 ${i === active ? "text-dc-snow" : "text-dc-snow/[0.42]"}`}>
                  <p className="flex items-baseline gap-3">
                    <span className={`font-mono text-[11px] tracking-[0.18em] ${i === active ? "text-dc-lava" : ""}`}>{String(i + 1).padStart(2, "0")}</span>
                    <span className="dc-label !text-[12px] !tracking-[0.2em]">{p.title}</span>
                  </p>
                  <p className={`mt-1.5 pl-[30px] font-body text-[15px] leading-[23px] transition-[max-height,opacity] duration-500 overflow-hidden ${i === active ? "max-h-24 opacity-100" : "max-h-0 opacity-0"}`}>
                    {p.text}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </Frame>
      </div>
    </div>
  )
}

function ReadADeedStack({ deed }: { deed: Deed }) {
  return (
    <Frame>
      <h3 className="dc-h3 text-dc-snow">Read a deed.</h3>
      <ol className="mt-6 space-y-10">
        {DEED_PARTS.map((p, i) => {
          const [cx, cy, cw, ch] = p.c
          const [rx, ry, rw, rh] = p.r
          return (
            <li key={p.key}>
              <Reveal y={16} blur={false}>
                {/* a borda fica no invólucro: dentro da caixa com aspect-ratio ela distorcia
                    a proporção interna dos recortes finos e o realce caía uma linha acima */}
                <div className="border border-dc-snow/[0.12]">
                <div className="relative overflow-hidden bg-dc-deep" style={{ aspectRatio: `${(cw * 4200) / (ch * 2970)}` }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={deed.src2400}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="absolute max-w-none"
                    style={{ width: `${100 / cw}%`, left: `${(-cx / cw) * 100}%`, top: `${(-cy / ch) * 100}%` }}
                  />
                  <span
                    aria-hidden
                    className="absolute border-2 border-dc-lava"
                    style={{ left: `${((rx - cx) / cw) * 100}%`, top: `${((ry - cy) / ch) * 100}%`, width: `${(rw / cw) * 100}%`, height: `${(rh / ch) * 100}%` }}
                  />
                </div>
                </div>
                <p className="mt-3 flex items-baseline gap-3">
                  <span className="font-mono text-[11px] tracking-[0.18em] text-dc-lava">{String(i + 1).padStart(2, "0")}</span>
                  <span className="dc-label text-dc-snow">{p.title}</span>
                </p>
                <p className="mt-1 pl-[30px] font-body text-[15px] leading-[23px] text-dc-snow/[0.85]">{p.text}</p>
              </Reveal>
            </li>
          )
        })}
      </ol>
    </Frame>
  )
}

function useDeskPin() {
  const [desk, setDesk] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px) and (min-height: 600px)")
    const on = () => setDesk(mq.matches)
    on()
    mq.addEventListener("change", on)
    return () => mq.removeEventListener("change", on)
  }, [])
  return desk
}

// ═══ a seção ═══════════════════════════════════════════════════════════════
export default function Deeds() {
  const reduced = useReduced()
  const desk = useDeskPin()
  const rail = useRef<HTMLUListElement>(null)
  const [open, setOpen] = useState<Deed | null>(null)
  const [flash, setFlash] = useState<string | null>(null)

  const scrollTo = useCallback((lotId: string) => {
    const r = rail.current
    const el = r?.querySelector<HTMLElement>(`[data-lot="${lotId}"]`)
    if (!r || !el) return
    r.scrollTo({ left: el.offsetLeft - parseFloat(getComputedStyle(r).paddingLeft || "0"), behavior: reduced ? "auto" : "smooth" })
    setFlash(lotId)
    setTimeout(() => setFlash(null), 1800)
  }, [reduced])

  // "See a deed like yours" (na prancha da busca) posiciona a galeria no tier certo
  useEffect(() => {
    const on = (e: Event) => scrollTo((e as CustomEvent<string>).detail)
    window.addEventListener("dc:show-deed", on)
    return () => window.removeEventListener("dc:show-deed", on)
  }, [scrollTo])

  const step = (dir: 1 | -1) => {
    const r = rail.current
    if (!r) return
    const first = r.querySelector<HTMLElement>("li")
    r.scrollBy({ left: dir * (first ? first.offsetWidth + 24 : 400), behavior: reduced ? "auto" : "smooth" })
  }
  const stepOpen = useCallback((dir: 1 | -1) => {
    setOpen((cur) => {
      if (!cur) return cur
      const i = ORDER.findIndex((d) => d.lotId === cur.lotId)
      return ORDER[(i + dir + ORDER.length) % ORDER.length]
    })
  }, [])

  let lastGroup: DeedGroup | null = null
  return (
    <section id="deeds" aria-labelledby="dc-deeds-h2" className="relative bg-dc-void pt-24 dk:pt-40 scroll-mt-14">
      <Frame>
        <SheetNo n="02" title="THE DEEDS" />
        <div className="mt-8 grid gap-8 dkl:grid-cols-12 dkl:items-end">
          <div className="dkl:col-span-7">
            <p className="dc-label text-dc-lava">ORDINALS ON BITCOIN L1 · CHILDREN OF THE CITY CHARTER</p>
            <h2 id="dc-deeds-h2" className="dc-h2 mt-3 text-dc-snow"><SplitLine text="Every lot becomes a deed." /></h2>
          </div>
          <div className="dkl:col-span-5">
            <p className="dc-body text-dc-mist">
              Each deed is a dark survey plat inscribed as a child of the City Charter, the map that parents the whole
              city. It draws the lot with its corners, its street, its tier and its stamp. It carries no owner data.
            </p>
            <p className="mt-4 inline-flex items-center gap-2 font-mono text-[11px] tracking-[0.16em] uppercase text-dc-snow">
              <span aria-hidden className="h-[6px] w-[6px] bg-dc-lava" />
              Specimens. Nothing has been inscribed yet.
            </p>
          </div>
        </div>
      </Frame>

      {/* ── parte 1: a escada ── */}
      <div className="relative mt-12 dk:mt-16">
        <Frame className="mb-4 hidden dk:flex items-center justify-end gap-2">
          <button type="button" onClick={() => step(-1)} aria-label="Previous deeds" className="dc-btn dc-btn-line dc-btn-sm !px-4">←</button>
          <button type="button" onClick={() => step(1)} aria-label="Next deeds" className="dc-btn dc-btn-line dc-btn-sm !px-4">→</button>
        </Frame>
        <ul ref={rail} className="dc-rail pb-4" aria-label="The ladder of deeds, from the top">
          {ORDER.map((d) => {
            const label = d.group !== lastGroup ? GROUP_LABEL[d.group] : null
            lastGroup = d.group
            return <DeedCard key={d.lotId} d={d} big={FEATURED.includes(d)} label={label} onOpen={setOpen} flash={flash === d.lotId} />
          })}
          <li aria-hidden className="w-[calc(var(--dc-gutter)-12px)] dk:w-[calc(var(--dc-gutter)-24px)]" />
        </ul>
      </div>

      {/* ── parte 2: "Read a deed" ── */}
      {EXAMPLE_DEED && (
        <div className="mt-24 dk:mt-32">
          {desk && !reduced ? <ReadADeedPinned deed={EXAMPLE_DEED} /> : <ReadADeedStack deed={EXAMPLE_DEED} />}
        </div>
      )}

      {/* ── proveniência ── */}
      <Frame className="mt-16 dk:mt-24">
        <Plate className="px-5 py-6 dk:px-8 dk:py-7 grid gap-6 dk:grid-cols-[1fr_auto] dk:items-center">
          <dl className="font-mono text-[12px] dk:text-[13px] tracking-[0.12em] text-dc-snow space-y-2">
            <div className="flex gap-3"><dt className="text-dc-dusty w-[96px] shrink-0">PARENT</dt><dd>CITY CHARTER</dd></div>
            <div className="flex gap-3"><dt className="text-dc-dusty w-[96px] shrink-0">CHILDREN</dt><dd>ONE DEED PER LOT</dd></div>
            <div><dd className="text-dc-mist">ONLY THE FIRST VALID DEED FOR EACH LOT COUNTS</dd></div>
          </dl>
          <Btn href="#lookup">Find your deed</Btn>
        </Plate>
      </Frame>

      {open && <Viewer deed={open} onClose={() => setOpen(null)} onStep={stepOpen} />}
    </section>
  )
}
