"use client"

// ═══════════════════════════════════════════════════════════════════════════
// 01 · FIND YOUR LOT (#lookup), com a passagem "Into the plaza" (brief §4.3, §8).
//
// O fundo é a carta colorida da cidade, sem moldura, rótulo nem legenda
// (public/landing/v3/map, gerada de public/city/carta-v10.svg por
// scripts/landing/sync-v3.mjs), PRESA à tela enquanto a seção passa. Ao sair do
// herói a câmera sobe da Satoshi Plaza até a cidade inteira (zoom 2D, só
// transform, presa à rolagem). Quando a sequência T8 do filme existir, ela
// corre por cima e o último quadro se funde na carta.
//
// A busca acontece DENTRO da cena: um anel de varredura sai da Plaza, a câmera
// aproxima o lote e cai um pino lava com três pulsos, que fica respirando.
// O motor é o de sempre (/api/dogcity/lookup, quatro ramos); a moldura é nova,
// e o resultado ganhou tier e rua (lidos do dado da escritura, no servidor).
//
// Mapa: 2400 px com a Plaza em (1200,1200) e 0,12 px por metro (x leste, z sul).
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react"
import { SplitLine } from "../motion"
import { DataRow, Frame, Plate, SheetNo, TextLink, areaDeed, dogExact, useReduced } from "../landing/ui"
import { EXAMPLE_DEED, MAP, T8, deedForTier, metersToMap, type Deed } from "../landing/media"
import { CITY_URL, MINT_URL, type CountdownState } from "../landing/mint-state"
import { SNAPSHOT_PROOF, PISO_LOTE_M2, alvoDaCurva } from "../dogcity-data"

// ── o contrato das rotas ─────────────────────────────────────────────────────
interface TierOut { code: string; rung: number | null; name: string }
interface LotFields {
  lot_id: string; sector: number; district: string | null; typology: string | null; map: string
  x_m?: number; z_m?: number
  tier?: TierOut | null; deed_district?: string | null; district_name?: string | null; deed_area_m2?: number | null
  front_road?: string | null; access?: { road: string; side: string } | null; faces?: string | null
}
type Result =
  | { status: "in_snapshot"; address: string; dog: number; area_m2: number; genesis: boolean; runestones: number; utxo_count: number; block: number; position?: "ok" | "unavailable"; lot?: LotFields }
  | { status: "memorial"; address: string; dog: number; corte_dog: number; lapides: number; genesis: boolean; runestones: number; utxo_count: number; block: number; position?: "ok" | "unavailable"; headstone?: { id: string; place: string; map: string; x_m?: number; z_m?: number } }
  | { status: "not_in_snapshot"; address: string }
  | { status: "exchange"; address: string; identity_name: string; identity_kind: string | null }
  | { status: "example"; lot: LotFields & { area_m2: number | null } }

const BLOCK = SNAPSHOT_PROOF.block.toLocaleString("en-US")

function whenUtc(iso: string): string {
  const d = new Date(iso)
  const date = d.toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
  const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "UTC" })
  return `${date}, ${time} UTC`
}

// ═══ A CÂMERA DO MAPA ══════════════════════════════════════════════════════
// Um ponto do mapa (fx, fy em px da carta) vai para a âncora (ax, ay em fração
// da tela) com escala s. Tudo escrito direto no DOM: nenhum estado por quadro.
interface Cam { fx: number; fy: number; s: number; ax: number; ay: number }
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const lerpCam = (a: Cam, b: Cam, t: number): Cam => ({
  fx: lerp(a.fx, b.fx, t), fy: lerp(a.fy, b.fy, t), s: a.s * Math.pow(b.s / a.s, t), ax: lerp(a.ax, b.ax, t), ay: lerp(a.ay, b.ay, t),
})
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const easeOut = (t: number) => 1 - Math.pow(1 - t, 4)

function isDesk() {
  return window.matchMedia("(min-width: 640px) and (min-height: 521px)").matches
}
/** a cidade inteira (raio ~1.000 px da carta). `settle` 0 = centrada (fim da
 *  passagem); 1 = abrindo espaço para o texto da busca (ao lado no desktop, no
 *  alto no celular), conforme o texto entra na tela */
function overviewCam(vw: number, vh: number, settle = 1): Cam {
  const [cx, cy] = MAP.center
  if (isDesk()) {
    const s = Math.min(vh * 0.94, vw * 0.62) / 2000
    return { fx: cx, fy: cy, s, ax: lerp(0.5, vw >= 1024 ? 0.66 : 0.62, settle), ay: 0.5 }
  }
  return { fx: cx, fy: cy, s: (vw * 0.98) / 2000, ax: 0.5, ay: lerp(0.47, 0.25, settle) }
}
function plazaCam(vw: number, vh: number): Cam {
  const o = overviewCam(vw, vh)
  return { fx: MAP.center[0], fy: MAP.center[1], s: o.s * 3.6, ax: 0.5, ay: 0.5 }
}
function lotCam(vw: number, vh: number, mx: number, my: number): Cam {
  const o = overviewCam(vw, vh)
  if (isDesk()) return { fx: mx, fy: my, s: o.s * 2.6, ax: vw >= 1024 ? 0.7 : 0.66, ay: 0.46 }
  // celular: o pino no meio da "janela" de mapa que abre entre o campo e a prancha
  // (34 svh logo abaixo da navegação de 56 px)
  return { fx: mx, fy: my, s: o.s * 2.8, ax: 0.5, ay: (56 + vh * 0.17) / vh }
}

function MapStage({
  passage, pin, searching, reduced,
}: {
  passage: React.RefObject<HTMLDivElement>
  pin: [number, number] | null
  searching: boolean
  reduced: boolean
}) {
  const stage = useRef<HTMLDivElement>(null)
  const board = useRef<HTMLDivElement>(null)
  const counters = useRef<HTMLDivElement[]>([])
  const t8 = useRef<HTMLCanvasElement>(null)
  const cam = useRef<Cam | null>(null)
  const pinRef = useRef(pin)
  const tween = useRef<{ from: Cam; to: Cam; t0: number; dur: number } | null>(null)
  const [mapIn, setMapIn] = useState(false)
  const [near, setNear] = useState(false)

  const apply = useCallback((c: Cam) => {
    cam.current = c
    const st = stage.current, b = board.current
    if (!st || !b) return
    const vw = st.clientWidth, vh = st.clientHeight
    b.style.transform = `translate3d(${c.ax * vw - c.fx * c.s}px, ${c.ay * vh - c.fy * c.s}px, 0) scale(${c.s})`
    for (const el of counters.current) {
      if (!el) continue
      el.style.transform = `translate(${el.dataset.x}px, ${el.dataset.y}px) scale(${1 / c.s})`
    }
  }, [])

  // carrega a carta quando a seção chega perto (nunca na carga inicial)
  useEffect(() => {
    const el = stage.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setNear(true); io.disconnect() } }, { rootMargin: "120% 0px" })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  // o laço: progresso da passagem (rolagem) OU o tween até o lote
  useEffect(() => {
    let raf = 0
    let lastKey = ""
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop)
      const st = stage.current, ps = passage.current
      if (!st || !ps) return
      const vw = st.clientWidth, vh = st.clientHeight
      const tw = tween.current
      if (tw) {
        const k = Math.min(1, (t - tw.t0) / tw.dur)
        apply(lerpCam(tw.from, tw.to, easeOut(k)))
        if (k >= 1) tween.current = null
        return
      }
      if (pinRef.current) {
        const [mx, my] = pinRef.current
        const key = `pin${vw}x${vh}`
        if (key !== lastKey) { lastKey = key; apply(lotCam(vw, vh, mx, my)) }
        return
      }
      const r = ps.getBoundingClientRect()
      // p: a subida (da Plaza até a cidade inteira) ao longo da passagem;
      // q: a cidade abre espaço quando o texto da busca entra na tela
      const p = reduced ? 1 : Math.max(0, Math.min(1, (vh - r.top) / (vh + r.height * 0.8)))
      const q = reduced ? 1 : Math.max(0, Math.min(1, 1 - r.bottom / vh))
      const key = `${p.toFixed(4)}|${q.toFixed(4)}|${vw}x${vh}`
      if (key === lastKey) return
      lastKey = key
      apply(lerpCam(plazaCam(vw, vh), overviewCam(vw, vh, easeInOut(q)), easeInOut(p)))
      drawT8(p)
    }
    // a câmera só roda enquanto a seção está na tela
    const st = stage.current
    let on = false
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !on) { on = true; raf = requestAnimationFrame(loop) }
      else if (!e.isIntersecting && on) { on = false; cancelAnimationFrame(raf) }
    }, { rootMargin: "20% 0px" })
    if (st) io.observe(st)
    return () => { io.disconnect(); cancelAnimationFrame(raf) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apply, passage, reduced])

  // o pino chegou: a câmera vai até o lote
  useEffect(() => {
    pinRef.current = pin
    const st = stage.current
    if (!pin || !st) return
    const to = lotCam(st.clientWidth, st.clientHeight, pin[0], pin[1])
    if (reduced || !cam.current) { apply(to); return }
    tween.current = { from: cam.current, to, t0: performance.now(), dur: 1300 }
  }, [pin, reduced, apply])

  // ── a sequência T8 (quando existir): presa à mesma rolagem ──
  const frames = useRef<HTMLImageElement[]>([])
  const variant = useRef<"desktop" | "mobile">("desktop")
  useEffect(() => {
    if (!near || reduced) return
    variant.current = window.matchMedia("(max-aspect-ratio: 1/1)").matches ? "mobile" : "desktop"
    const meta = T8[variant.current]
    if (!meta) return
    frames.current = Array.from({ length: meta.count }, (_, i) => {
      const im = new Image()
      im.decoding = "async"
      im.src = T8.url(variant.current, i + 1, meta.pad)
      return im
    })
  }, [near, reduced])
  const drawT8 = (p: number) => {
    const c = t8.current
    const list = frames.current
    if (!c || !list.length) return
    const k = Math.min(1, p / 0.82)
    const i = Math.min(list.length - 1, Math.floor(k * (list.length - 1)))
    const im = list[i]
    c.style.opacity = String(p < 0.82 ? 1 : Math.max(0, 1 - (p - 0.82) / 0.14))
    if (!im.complete || !im.naturalWidth) return
    const w = c.clientWidth, h = c.clientHeight
    const dpr = Math.min(1.5, window.devicePixelRatio || 1)
    if (c.width !== Math.round(w * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr) }
    const ctx = c.getContext("2d")
    if (!ctx) return
    const k2 = Math.max(c.width / im.naturalWidth, c.height / im.naturalHeight)
    const dw = im.naturalWidth * k2, dh = im.naturalHeight * k2
    ctx.drawImage(im, (c.width - dw) / 2, (c.height - dh) / 2, dw, dh)
  }

  const setCounter = (i: number) => (el: HTMLDivElement | null) => { if (el) counters.current[i] = el }
  const [px, py] = MAP.center
  return (
    <div ref={stage} className="sticky top-0 h-[100svh] w-full overflow-hidden bg-dc-deep" aria-hidden>
      <div ref={board} className="absolute left-0 top-0 origin-top-left will-change-transform" style={{ width: MAP.size, height: MAP.size }}>
        {near && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={MAP.src2400}
            alt=""
            width={MAP.size}
            height={MAP.size}
            decoding="async"
            onLoad={() => setMapIn(true)}
            className={`absolute inset-0 h-full w-full select-none transition-opacity duration-[400ms] ${mapIn ? "opacity-100" : "opacity-0"}`}
            style={{
              filter: "brightness(0.6) saturate(0.9)",
              WebkitMaskImage: "radial-gradient(circle at 50% 50%, #000 52%, transparent 70%)",
              maskImage: "radial-gradient(circle at 50% 50%, #000 52%, transparent 70%)",
            }}
            draggable={false}
          />
        )}
        {/* a varredura: um anel sai da Plaza e corre o mapa enquanto a busca acontece */}
        {searching && !reduced && (
          <span className="dc-sweep absolute rounded-full border-2 border-dc-hot/[0.85]" style={{ left: px, top: py, width: 2300, height: 2300 }} />
        )}
        {/* a Satoshi Plaza em lava */}
        <div ref={setCounter(0)} data-x={px} data-y={py} className="absolute left-0 top-0 origin-top-left">
          <span className="absolute -left-[5px] -top-[5px] h-[10px] w-[10px] rounded-full bg-dc-lava" />
          {!reduced && <span className="dc-breathe absolute -left-[5px] -top-[5px] h-[10px] w-[10px] rounded-full border border-dc-lava" />}
        </div>
        {/* o pino */}
        {pin && (
          <div ref={setCounter(1)} key={`${pin[0]}:${pin[1]}`} data-x={pin[0]} data-y={pin[1]} className="absolute left-0 top-0 origin-top-left">
            {!reduced && (
              <>
                <span className="dc-ping-3 absolute -left-[9px] -top-[9px] h-[18px] w-[18px] rounded-full border-2 border-dc-hot" />
                <span className="dc-breathe absolute -left-[9px] -top-[9px] h-[18px] w-[18px] rounded-full border border-dc-hot" style={{ animationDelay: "3.3s" }} />
              </>
            )}
            <span className="absolute -left-[4px] -top-[4px] h-[8px] w-[8px] rounded-full bg-dc-hot shadow-[0_0_0_2px_rgba(13,12,9,0.8)]" />
            <svg className={`absolute left-0 top-0 ${reduced ? "" : "dc-drop"}`} style={reduced ? { transform: "translate(-50%,-100%)" } : undefined} width="22" height="34" viewBox="0 0 22 34">
              <path d="M11 33 L11 20" stroke="#F5E9D6" strokeWidth="1.5" />
              <path d="M11 1 C5.5 1 1.5 5 1.5 10.2 C1.5 15.6 6 19.4 11 20.6 C16 19.4 20.5 15.6 20.5 10.2 C20.5 5 16.5 1 11 1Z" fill="#E8660D" stroke="#0D0C09" strokeWidth="1.5" />
              <circle cx="11" cy="10.2" r="3.2" fill="#0D0C09" />
            </svg>
          </div>
        )}
      </div>
      {/* a sequência T8 do filme por cima, quando existir */}
      {(T8.desktop || T8.mobile) && <canvas ref={t8} className="absolute inset-0 h-full w-full pointer-events-none" />}
      {/* vinheta do visor: escurece o lado do texto, não é placa */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-dc-deep/[0.35] to-dc-deep/[0.9] dk:bg-gradient-to-r dk:from-dc-deep/[0.88] dk:via-dc-deep/[0.45] dk:to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-dc-deep/[0.6] to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-dc-void to-transparent" />
    </div>
  )
}

// ═══ AS PRANCHAS DE RESULTADO ══════════════════════════════════════════════
function TierSeal({ tier }: { tier: TierOut | null | undefined }) {
  if (!tier) return null
  const text = tier.rung ? `TIER ${tier.rung} OF 13 · ${tier.name.toUpperCase()}` : tier.name.toUpperCase()
  return (
    <p className="mt-4 inline-flex items-center gap-2 border border-dc-lava/[0.7] px-3 py-1.5 font-mono text-[11px] dk:text-[12px] tracking-[0.16em] text-dc-snow">
      <span aria-hidden className="h-[6px] w-[6px] bg-dc-lava" />
      {text}
    </p>
  )
}

function streetRows(l: LotFields) {
  return (
    <>
      {l.front_road && <DataRow label="FRONT ROAD">{l.front_road}</DataRow>}
      {!l.front_road && l.access && <DataRow label="ACCESS FROM">{`${l.access.road}, SIDE ${l.access.side}`}</DataRow>}
      {!l.front_road && l.faces && <DataRow label="FRONT FACES">{l.faces}</DataRow>}
    </>
  )
}

function districtText(l: LotFields): string {
  if (l.deed_district) return l.deed_district
  return l.district ? `S${String(l.sector).padStart(2, "0")} · ${l.district.toUpperCase()}` : `S${String(l.sector).padStart(2, "0")}`
}

function PlateHead({ label, tag }: { label: string; tag?: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <p className="dc-label text-dc-lava">{label}</p>
      {tag && <p className="dc-label text-dc-dusty border border-dc-snow/[0.2] px-2 py-0.5">{tag}</p>}
    </div>
  )
}

function DeedThumb({ deed, example }: { deed: Deed | null; example?: boolean }) {
  if (!deed) return null
  return (
    <figure className="mt-6">
      <a href="#deeds" onClick={() => window.dispatchEvent(new CustomEvent("dc:show-deed", { detail: deed.lotId }))} className="group relative block border border-dc-snow/[0.12] bg-dc-deep">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={deed.src1200} alt={`A deed drawn by the city template: ${deed.tierLine}, lot ${deed.lotId}`} width={1200} height={849} loading="lazy" decoding="async" className="block h-auto w-full" />
        <span className="absolute left-3 top-3 border border-dc-lava bg-dc-deep/[0.85] px-2 py-1 font-mono text-[10px] tracking-[0.18em] text-dc-lava">
          SPECIMEN · NOT INSCRIBED YET
        </span>
      </a>
      <figcaption className="mt-3 flex flex-wrap items-baseline justify-between gap-3">
        <span className="font-body text-[15px] text-dc-snow">{example ? "Every deed is drawn like this." : "Your deed will be drawn like this."}</span>
        <TextLink href="#deeds" onClick={() => window.dispatchEvent(new CustomEvent("dc:show-deed", { detail: deed.lotId }))} className="font-mono text-[11px] tracking-[0.16em] uppercase text-dc-lava">
          See a deed like yours
        </TextLink>
      </figcaption>
    </figure>
  )
}

function ResultPlate({ r, cd }: { r: Result; cd: CountdownState }) {
  const mintOpen = cd.kind === "C" || cd.kind === "D" || cd.kind === "E" || cd.kind === "F"

  if (r.status === "exchange") {
    return (
      <Plate className="px-5 py-6 dk:px-8 dk:py-8">
        <PlateHead label={`KNOWN ADDRESS · ${r.identity_name.toUpperCase()}`} />
        <h3 className="dc-h3 mt-3 text-dc-snow">This is not your address on chain.</h3>
        <p className="dc-body mt-3 text-dc-mist">
          Coins held at {r.identity_name} are held under its keys, not yours. Any lot this address would receive is
          assigned to {r.identity_name} itself, inside the Financial District, not the residential city. Withdraw to a
          wallet you control, then look it up again.
        </p>
      </Plate>
    )
  }

  if (r.status === "not_in_snapshot") {
    return (
      <Plate className="px-5 py-6 dk:px-8 dk:py-8">
        <PlateHead label="NOT IN THE SNAPSHOT" />
        <h3 className="dc-h3 mt-3 text-dc-snow">This wallet held no $DOG at block {BLOCK}, so the city drew no lot for it.</h3>
        <p className="dc-body mt-3 text-dc-mist">
          Lots their owners leave unclaimed go on sale after the Whitelist: US$1.50 for holders of partner collections,
          then US$2 for anyone.
        </p>
        {cd.kind === "A" && (
          <p className="dc-body mt-3 text-dc-mist">
            A Founder whose wallet has no lot, and who contributed more than 592.22 $DOG, picks an unclaimed lot free in
            the Partners window.
          </p>
        )}
        <div className="mt-6"><a href="#calendar" className="dc-btn dc-btn-line">See the calendar</a></div>
      </Plate>
    )
  }

  if (r.status === "memorial") {
    return (
      <Plate className="px-5 py-6 dk:px-8 dk:py-8">
        <PlateHead label={`DECIDED AT BLOCK ${BLOCK}`} />
        <h3 className="dc-h3 mt-3 text-dc-snow">This wallet keeps a headstone, not a lot.</h3>
        <dl className="mt-5">
          <DataRow label="YOUR PLACE">{r.headstone ? `Headstone ${r.headstone.id} at ${r.headstone.place}` : "a headstone in the city cemetery"}</DataRow>
          <DataRow label={`$DOG AT BLOCK ${BLOCK}`}>{dogExact(r.dog)}</DataRow>
          <DataRow label="SMALLEST LOT THE CITY BUILDS">{`${PISO_LOTE_M2} m²`}</DataRow>
          <DataRow label="BALANCE A LOT THAT SIZE TAKES">{`${r.corte_dog.toLocaleString("en-US", { minimumFractionDigits: 2 })} $DOG`}</DataRow>
          <DataRow label="HEADSTONES AT THE FOUNDING">{r.lapides.toLocaleString("en-US")}</DataRow>
          <DataRow label="DECIDED AT">{`block ${BLOCK}, ${whenUtc(SNAPSHOT_PROOF.timeUtc)}`}</DataRow>
        </dl>
        <p className="dc-body mt-5 text-dc-mist">A headstone mints its lot in Ring 2 at a future block, never in Ring 1.</p>
        {r.headstone && (
          <div className="mt-6">
            <a href={`${CITY_URL}/?addr=${encodeURIComponent(r.address)}`} className="dc-btn dc-btn-fill">See it in the city</a>
          </div>
        )}
      </Plate>
    )
  }

  if (r.status === "example") {
    const l = r.lot
    return (
      <>
        <Plate className="px-5 py-6 dk:px-8 dk:py-8">
          <PlateHead label={`DECIDED AT BLOCK ${BLOCK}`} tag="EXAMPLE" />
          <div className="mt-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <p className="font-mono text-[20px] dk:text-[26px] tracking-[0.04em] text-dc-snow">{l.lot_id}</p>
            {l.area_m2 != null && <p className="font-mono text-[16px] dk:text-[20px] text-dc-snow tabular-nums">{areaDeed(l.area_m2)}</p>}
          </div>
          <TierSeal tier={l.tier} />
          <dl className="mt-5">
            {streetRows(l)}
            <DataRow label="DISTRICT">{districtText(l)}</DataRow>
            {l.typology && <DataRow label="TYPOLOGY">{l.typology}</DataRow>}
          </dl>
          <div className="mt-6 flex flex-col dk:flex-row gap-3">
            <a href={`${CITY_URL}/?lot=${encodeURIComponent(l.lot_id)}`} className="dc-btn dc-btn-fill">See it in the city</a>
            <a href="/dogcity/docs#the-mint" className="dc-btn dc-btn-line">How the mint works</a>
          </div>
        </Plate>
        <DeedThumb deed={EXAMPLE_DEED} example />
      </>
    )
  }

  // in_snapshot
  const l = r.lot
  const alvo = alvoDaCurva(r.dog, r.area_m2)
  // a área da escritura (uma casa) quando o dado do lote respondeu; senão a do
  // registro selado, que é inteira e não ganha ".0" inventado
  const area = l?.deed_area_m2 != null ? areaDeed(l.deed_area_m2) : `${r.area_m2.toLocaleString("en-US")} m²`
  return (
    <>
      <Plate className="px-5 py-6 dk:px-8 dk:py-8">
        <PlateHead label={`DECIDED AT BLOCK ${BLOCK}`} />
        <div className="mt-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <p className="font-mono text-[20px] dk:text-[26px] tracking-[0.04em] text-dc-snow">{l ? l.lot_id : "Lot not available right now"}</p>
          <p className="font-mono text-[16px] dk:text-[20px] text-dc-snow tabular-nums">{area}</p>
        </div>
        <TierSeal tier={l?.tier} />
        <dl className="mt-5">
          <DataRow label="YOUR LOT">{area}</DataRow>
          <DataRow label="CURVE TARGET">{`${Math.round(alvo).toLocaleString("en-US")} m²`}</DataRow>
          {l && streetRows(l)}
          {l && <DataRow label="DISTRICT">{districtText(l)}</DataRow>}
          {l?.typology && <DataRow label="TYPOLOGY">{l.typology}</DataRow>}
          <DataRow label={`$DOG AT BLOCK ${BLOCK}`}>{dogExact(r.dog)}</DataRow>
          <DataRow label="ORIGINAL AIRDROP RECEIVER">{r.genesis ? "yes" : "no"}</DataRow>
          <DataRow label="RUNESTONES">{r.runestones.toLocaleString("en-US")}</DataRow>
        </dl>
        <p className="dc-body mt-5 !text-[15px] !leading-[24px] text-dc-mist">
          Reserved for this wallet through the Founder and Whitelist phases, about 24 days from the day the mint opens.
          Founders mint it free; in the Whitelist it costs US$1.
        </p>
        <div className="mt-6 flex flex-col dk:flex-row gap-3">
          {mintOpen
            ? <a href={MINT_URL} className="dc-btn dc-btn-fill">Mint this lot</a>
            : <a href={`${CITY_URL}/?addr=${encodeURIComponent(r.address)}`} className="dc-btn dc-btn-fill">See it in the city</a>}
          <a href="/dogcity/docs#the-mint" className="dc-btn dc-btn-line">How the mint works</a>
        </div>
        <p className="mt-5 border-t border-dc-snow/[0.08] pt-4">
          <TextLink href="/dogcity/docs#how-land-follows-the-coins" className="font-mono text-[11px] tracking-[0.16em] uppercase text-dc-mist hover:text-dc-snow">
            Why this size
          </TextLink>
        </p>
      </Plate>
      <DeedThumb deed={deedForTier(l?.tier?.code, l?.tier?.rung)} />
    </>
  )
}

// ═══ A SEÇÃO ═══════════════════════════════════════════════════════════════
export default function FindYourLot({ cd }: { cd: CountdownState }) {
  const reduced = useReduced()
  const passage = useRef<HTMLDivElement>(null)
  const plate = useRef<HTMLDivElement>(null)
  const [value, setValue] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pin, setPin] = useState<[number, number] | null>(null)

  const land = useCallback((r: Result) => {
    setResult(r)
    let xz: [number, number] | null = null
    if (r.status === "in_snapshot" && r.lot?.x_m != null && r.lot?.z_m != null) xz = [r.lot.x_m, r.lot.z_m]
    if (r.status === "example" && r.lot.x_m != null && r.lot.z_m != null) xz = [r.lot.x_m, r.lot.z_m]
    if (r.status === "memorial" && r.headstone?.x_m != null && r.headstone?.z_m != null) xz = [r.headstone.x_m, r.headstone.z_m]
    setPin(xz ? metersToMap(xz[0], xz[1]) : null)
    // o resultado empurra o mapa para cima: o pino fica visível acima da prancha
    // celular: a janela de mapa fica logo abaixo da navegação, com o pino no meio
    // dela; desktop: a prancha sobe para perto do topo, o pino fica à direita
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const el = plate.current
      if (!el) return
      const top = el.getBoundingClientRect().top + window.scrollY
      const desk = window.matchMedia("(min-width: 640px) and (min-height: 521px)").matches
      const want = desk ? top - window.innerHeight * 0.18 : top - 56
      window.scrollTo({ top: Math.max(0, want), behavior: reduced ? "auto" : "smooth" })
    }))
  }, [reduced])

  const search = async (e: FormEvent) => {
    e.preventDefault()
    const address = value.trim()
    if (!address) return
    setLoading(true); setError(null); setResult(null); setPin(null)
    try {
      const r = await fetch(`/api/dogcity/lookup?address=${encodeURIComponent(address)}&full=1`, { signal: AbortSignal.timeout(8000) })
      const j = await r.json()
      if (!r.ok) {
        setError(j?.error === "invalid Bitcoin address" ? "That does not look like a Bitcoin address." : "The chain is busy, try again in a moment.")
        return
      }
      land(j as Result)
    } catch {
      setError("The chain is busy, try again in a moment.")
    } finally {
      setLoading(false)
    }
  }

  const openExample = async () => {
    if (!EXAMPLE_DEED) return
    setLoading(true); setError(null); setResult(null); setPin(null)
    try {
      const r = await fetch(`/api/dogcity/lot?id=${encodeURIComponent(EXAMPLE_DEED.lotId)}`, { signal: AbortSignal.timeout(8000) })
      const j = await r.json()
      if (!r.ok) { setError("The chain is busy, try again in a moment."); return }
      land({ status: "example", lot: j })
    } catch {
      setError("The chain is busy, try again in a moment.")
    } finally {
      setLoading(false)
    }
  }

  // /dogcity#lookup: o script pré-hidratação abre no topo (o salto nativo cai
  // no layout parcial); depois que a página assenta, a rolagem vem até aqui
  useEffect(() => {
    if (window.location.hash !== "#lookup") return
    const go = () => document.getElementById("lookup")?.scrollIntoView({ behavior: "auto", block: "start" })
    if (document.readyState === "complete") setTimeout(go, 60)
    else window.addEventListener("load", () => setTimeout(go, 60), { once: true })
  }, [])

  return (
    <section aria-labelledby="dc-lookup-h2" className="relative">
      <MapStage passage={passage} pin={pin} searching={loading} reduced={reduced} />
      <div className="relative -mt-[100svh]">
        {/* a passagem "Into the plaza": 140 svh de rolagem presa (fusão simples sem movimento) */}
        <div ref={passage} aria-hidden className={reduced ? "h-[60svh]" : "h-[140svh]"} />
        <div id="lookup" className="relative z-[2] scroll-mt-14 dk:scroll-mt-[72px]">
          <Frame className="pt-[46svh] dk:pt-[16vh] pb-24 dk:pb-40">
            <div className="max-w-[600px]">
              <SheetNo n="01" title="FIND YOUR LOT" className="dc-halo" />
              <p className="dc-label mt-8 text-dc-lava dc-halo">BLOCK {BLOCK} DREW EVERY LOT</p>
              <h2 id="dc-lookup-h2" className="dc-h2 mt-3 text-dc-snow dc-halo">
                <SplitLine text="Find your lot." />
              </h2>
              <p className="dc-body mt-5 text-dc-snow/[0.88] dc-halo">
                Paste a Bitcoin address. See the lot, the street and the tier that block {BLOCK} gave it. No wallet
                connection, no signature, no cost.
              </p>

              {/* o campo é UMA peça de 48 px com o botão dentro */}
              <form onSubmit={search} className="mt-7" role="search" aria-label="Find your lot">
                <div className="flex h-12 dk:h-[56px] items-stretch border border-dc-snow/[0.24] bg-dc-plate focus-within:border-dc-lava transition-colors">
                  <input
                    type="text"
                    inputMode="text"
                    autoCapitalize="off"
                    autoCorrect="off"
                    autoComplete="off"
                    spellCheck={false}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder="Paste a Bitcoin address"
                    aria-label="Bitcoin address"
                    className="min-w-0 flex-1 bg-transparent pl-4 pr-2 font-mono text-[13px] dk:text-[14px] text-dc-snow placeholder:text-dc-dusty focus-visible:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={loading || !value.trim()}
                    className="dc-btn dc-btn-fill m-[3px] !h-auto !px-4 dk:!px-6 !text-[11px] dk:!text-[12px] disabled:opacity-45"
                  >
                    {loading ? "Reading the registry…" : "Find my lot"}
                  </button>
                </div>
              </form>
              {EXAMPLE_DEED && (
                <p className="mt-4 font-mono text-[11px] dk:text-[12px] tracking-[0.06em] text-dc-mist dc-halo">
                  Or open an example:{" "}
                  <button type="button" onClick={openExample} className="dc-link text-dc-snow">
                    a tier 1 deed on the waterfront
                  </button>
                </p>
              )}
              <div aria-live="polite">
                {error && <p className="mt-5 font-mono text-[13px] text-dc-hot dc-halo">{error}</p>}
              </div>

              <div ref={plate} className="mt-8 scroll-mt-24">
                {/* a janela: no celular o resultado empurra o mapa para cima e o pino
                    fica visível acima da prancha */}
                {result && <div aria-hidden className="h-[34svh] dk:hidden" />}
                {result && <ResultPlate r={result} cd={cd} />}
              </div>
            </div>
          </Frame>
        </div>
      </div>
    </section>
  )
}
