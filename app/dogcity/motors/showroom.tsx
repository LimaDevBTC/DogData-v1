"use client"

// 02 · THE SHOWROOM (#cars): os 16 carros da DOG MOTORS por classe (super, sport, luxury, classic, muscle, off-road;
// os Fuscas, a classe compact, saíram em 15/11), um cartão por carro: a foto de estúdio, o nome DOG CITY, os números do jogo, o preço em DC POINTS do
// GET /api/dogcity/car-buy, e "Owned" quando a carteira conectada já tem o modelo (GET /api/dogcity/cars).
//
// DESDE 15/11/2026 OS CARROS CUSTAM DC POINTS (decisão do fundador, assets_carros/projeto/CARROS_DC_POINTS.md): pontos do
// jogo, não dinheiro. A janela de pagar em $DOG/BTC saiu da vitrine (a venda em cripto segue atrás de CAR_SALES_OPEN,
// desligada). Cada cartão tem "Buy in DOG CITY" (o jogo, em aba nova) e, com a carteira VERIFICADA e saldo que chegue, a
// compra aqui mesmo pela sessão (POST /api/dogcity/car-buy), com um passo de confirmação. O servidor confere tudo (preço,
// saldo, um de cada modelo); o `ref` da compra nasce uma vez por confirmação, então um clique repetido não compra duas vezes.
//
// Resposta torta ou falha: sem preço e sem botão (./quote.ts). O cartão tem quatro faixas FIXAS, na mesma ordem em toda
// tela (a foto, o nome, os dados, o preço com a ação), e a faixa do preço tem a mesma altura em todos os estados.

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { GARAGE_EVENT } from "@/components/donate/car-checkout"
import { useWallet } from "@/contexts/WalletContext"
import type { CarClass } from "@/lib/game/cars/catalog"
import { ECONOMIA } from "@/lib/game/points/ajustes_economia"
import { Reveal, SplitLine } from "../landing/reveal"
import { Frame, SectionHead, Ticks } from "../landing/ui"
import { CITY_URL } from "../landing/mint-state"
import { CLASS_COUNT, CLASS_LABEL, CLASS_ORDER, SHOWROOM, fmtInt, photoFallback, photoSrcSet, type ShowroomCar } from "./cars"
import {
  dcOfferFor, fmtPoints, parseDcShowroom, parseGarage, parsePoints, type DcOffer, type DcShowroomState, type PointsView,
} from "./quote"

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`
const DAILY_CAP = ECONOMIA.tetoDiarioRecebido
/** o aviso de "mudou o saldo" entre cartões (a compra num cartão atualiza o saldo de todos) */
const POINTS_EVENT = "dogmotors:points-changed"

// ── a vitrine: o que veio no HTML, relido no cliente e a cada minuto com a aba visível ──
function useShowroom(initial: DcShowroomState): DcShowroomState {
  const [state, setState] = useState<DcShowroomState>(initial)
  useEffect(() => {
    let alive = true
    const load = () => {
      if (document.visibilityState === "hidden") return
      fetch("/api/dogcity/car-buy", { cache: "no-store" })
        .then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }))
        .then(({ status, body }) => { if (alive) setState(parseDcShowroom(status, body)) })
        .catch(() => { if (alive) setState((s) => (s.kind === "loading" ? { kind: "unavailable" } : s)) })
    }
    load()
    const id = setInterval(load, 60_000)
    document.addEventListener("visibilitychange", load)
    return () => { alive = false; clearInterval(id); document.removeEventListener("visibilitychange", load) }
  }, [])
  return state
}

// ── a garagem da carteira conectada: null = não sei (não afirma nada) ──
function useGarage(address: string | null): ReadonlySet<string> | null {
  const [owned, setOwned] = useState<ReadonlySet<string> | null>(null)
  const [nonce, setNonce] = useState(0)
  useEffect(() => {
    const bump = () => setNonce((n) => n + 1)
    window.addEventListener(GARAGE_EVENT, bump)
    return () => window.removeEventListener(GARAGE_EVENT, bump)
  }, [])
  useEffect(() => {
    setOwned(null)
    if (!address) return
    let alive = true
    fetch(`/api/dogcity/cars?address=${encodeURIComponent(address)}`, { cache: "no-store" })
      .then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }))
      .then(({ status, body }) => { if (alive) setOwned(parseGarage(status, body, address)) })
      .catch(() => { if (alive) setOwned(null) })
    return () => { alive = false }
  }, [address, nonce])
  return owned
}

// ── o saldo de DC Points da sessão (só com a carteira verificada): null = não sei ──
function usePoints(address: string | null, verified: boolean): PointsView | null {
  const [points, setPoints] = useState<PointsView | null>(null)
  const [nonce, setNonce] = useState(0)
  useEffect(() => {
    const bump = () => setNonce((n) => n + 1)
    window.addEventListener(POINTS_EVENT, bump)
    return () => window.removeEventListener(POINTS_EVENT, bump)
  }, [])
  useEffect(() => {
    setPoints(null)
    if (!address || !verified) return
    let alive = true
    fetch("/api/game/points", { cache: "no-store", credentials: "same-origin" })
      .then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }))
      .then(({ status, body }) => { if (alive) setPoints(parsePoints(status, body)) })
      .catch(() => { if (alive) setPoints(null) })
    return () => { alive = false }
  }, [address, verified, nonce])
  return points
}

const BUY_ERRORS: Record<string, string> = {
  insufficient_points: "Not enough DC Points for this car.",
  already_owned: "This model is already in your garage.",
  model_not_for_sale: "This model is off the floor right now.",
  rate_limited: "Too many tries. Wait a minute.",
  unauthenticated: "Sign in again with your wallet.",
}

// ── um dado do jogo ──
function Stat({ label, value, unit, first }: { label: string; value: string; unit?: string; first?: boolean }) {
  return (
    <div className={`flex flex-col-reverse py-3 ${first ? "" : "border-l border-dc-snow/[0.12] pl-3"}`}>
      <dt className="mt-1.5 dc-label !text-[9px] !tracking-[0.16em] text-dc-dusty">{label}</dt>
      <dd className="mt-stat uppercase text-dc-snow">
        {value}
        {unit && <span className="ml-1 font-mono text-[10px] font-medium tracking-[0.06em] text-dc-mist">{unit}</span>}
      </dd>
    </div>
  )
}

// ── a faixa do preço e da ação: a mesma altura em todos os estados ──
type BuyStage =
  | { kind: "idle" }
  | { kind: "confirm" }
  | { kind: "buying" }
  | { kind: "done" }
  | { kind: "error"; message: string }

function PriceBand({ car, offer, owned, address, verified, points, stage, onAsk, onConfirm, onCancel }: {
  car: ShowroomCar
  offer: DcOffer
  owned: boolean
  address: string | null
  verified: boolean
  points: PointsView | null
  stage: BuyStage
  onAsk: () => void
  onConfirm: () => void
  onCancel: () => void
}) {
  let label = "Price"
  let big: React.ReactNode
  let small: React.ReactNode = " "
  let action: React.ReactNode
  const bar = (text: React.ReactNode, tone: "quiet" | "lava" = "quiet") => (
    <div className={`flex h-[52px] items-center gap-3 border px-4 font-mono text-[11px] tracking-[0.08em] ${tone === "lava" ? "border-dc-lava/[0.55] text-dc-snow" : "border-dc-snow/[0.14] text-dc-mist"}`}>
      {text}
    </div>
  )
  const inGame = (
    <a href={CITY_URL} target="_blank" rel="noopener noreferrer" className="dc-btn dc-btn-fill w-full" aria-label={`Buy the ${car.name} in DOG CITY (opens the game in a new tab)`}>
      Buy in DOG CITY <span aria-hidden className="text-dc-void/[0.6]">↗</span>
    </a>
  )

  if (owned) {
    label = "In your garage"
    big = <span className="text-dc-hot">Owned</span>
    small = stage.kind === "done" ? "Bought. It waits for you in DOG CITY." : "One of each model per wallet."
    action = bar(<><span aria-hidden className="h-[6px] w-[6px] shrink-0 bg-dc-lava" />{address ? `Registered to ${short(address)}` : "Registered to your wallet"}</>, "lava")
  } else if (offer.kind === "for_sale") {
    const price = offer.priceDc
    big = <>{fmtPoints(price)} <span className="font-mono text-[12px] font-medium tracking-[0.06em] text-dc-mist">DC POINTS</span></>
    const canBuyHere = verified && !!points && points.balance >= price
    if (stage.kind === "error") small = stage.message
    else if (!address) small = "Earned by playing DOG CITY"
    else if (!verified) small = "Verify your wallet to buy here"
    else if (!points) small = "Reading your DC Points"
    else if (!points.canEarn && points.balance < price) small = "Register a handle in DOG CITY to earn DC Points"
    else if (points.balance < price) small = `You need ${fmtPoints(price - points.balance)} more DC Points`
    else small = `You have ${fmtPoints(points.balance)} DC Points`

    if (stage.kind === "confirm" || stage.kind === "buying") {
      label = "Confirm"
      small = points ? `Spend ${fmtPoints(price)} of your ${fmtPoints(points.balance)} DC Points` : small
      action = (
        <div className="grid h-[52px] grid-cols-[1fr_auto] gap-2">
          <button type="button" onClick={onConfirm} disabled={stage.kind === "buying"} className="dc-btn dc-btn-fill w-full disabled:opacity-60" aria-label={`Confirm: buy the ${car.name} for ${fmtPoints(price)} DC Points`}>
            {stage.kind === "buying" ? "Buying" : "Confirm"}
          </button>
          <button type="button" onClick={onCancel} disabled={stage.kind === "buying"} className="dc-btn dc-btn-line px-4 disabled:opacity-60">Cancel</button>
        </div>
      )
    } else if (canBuyHere) {
      action = (
        <button type="button" onClick={onAsk} className="dc-btn dc-btn-fill w-full" aria-label={`Buy the ${car.name} for ${fmtPoints(price)} DC Points`}>
          Buy for {fmtPoints(price)} <span className="font-medium">DC Points</span>
        </button>
      )
    } else {
      action = inGame
    }
  } else if (offer.kind === "not_for_sale") {
    big = <span className="text-dc-snow/[0.78]">Not for sale</span>
    small = "This model is off the floor for now."
    action = bar("Back on the floor soon")
  } else if (offer.kind === "unavailable") {
    big = <span className="text-dc-snow/[0.78]">Unavailable</span>
    small = "Prices could not be read. Trying again."
    action = bar("No price, no purchase right now")
  } else {
    big = <span aria-hidden className="mt-wait inline-block h-[28px] w-[150px] bg-dc-snow/[0.12] align-middle" />
    small = "Reading prices"
    action = bar(<span className="mt-wait">Reading the showroom</span>)
  }

  return (
    <div className="mt-auto pt-5">
      <p className="dc-label !text-[10px] text-dc-dusty">{label}</p>
      <p className="mt-1.5 h-[36px] whitespace-nowrap font-cond text-[34px] font-semibold uppercase leading-none tabular-nums text-dc-snow">{big}</p>
      <p className="mt-1 min-h-[18px] font-mono text-[11px] leading-[18px] text-dc-mist tabular-nums" aria-live="polite">{small}</p>
      <div className="mt-4">{action}</div>
    </div>
  )
}

function CarCard({ car, offer, owned, address, verified, points }: {
  car: ShowroomCar
  offer: DcOffer
  owned: boolean
  address: string | null
  verified: boolean
  points: PointsView | null
}) {
  const s = car.spec
  const [stage, setStage] = useState<BuyStage>({ kind: "idle" })
  // o ref da compra nasce UMA vez por confirmação: repetir (clique duplo, rede caiu) é idempotente no servidor
  const ref = useRef<string | null>(null)
  const ask = useCallback(() => {
    ref.current = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : null
    setStage(ref.current ? { kind: "confirm" } : { kind: "error", message: "This browser cannot buy here. Buy in DOG CITY." })
  }, [])
  const cancel = useCallback(() => { ref.current = null; setStage({ kind: "idle" }) }, [])
  const confirm = useCallback(async () => {
    if (offer.kind !== "for_sale" || !ref.current) return
    setStage({ kind: "buying" })
    try {
      const r = await fetch("/api/dogcity/car-buy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify({ model: car.id, ref: ref.current }),
      })
      const body = await r.json().catch(() => null) as { ok?: unknown; error?: unknown } | null
      if (r.ok && body?.ok === true) {
        ref.current = null
        setStage({ kind: "done" })
        window.dispatchEvent(new CustomEvent(GARAGE_EVENT, { detail: { model: car.id } }))
        window.dispatchEvent(new CustomEvent(POINTS_EVENT))
        return
      }
      const code = typeof body?.error === "string" ? body.error : ""
      // erro definitivo: o próximo clique é outra compra (ref novo); 503/rede: o mesmo ref fica para repetir
      if (r.status !== 503) ref.current = null
      setStage({ kind: "error", message: BUY_ERRORS[code] ?? "Could not buy right now. Try again." })
      if (code === "already_owned") window.dispatchEvent(new CustomEvent(GARAGE_EVENT, { detail: { model: car.id } }))
      if (code === "insufficient_points") window.dispatchEvent(new CustomEvent(POINTS_EVENT))
    } catch {
      setStage({ kind: "error", message: "Could not buy right now. Try again." })
    }
  }, [offer, car.id])

  return (
    <article className="mt-card dc-plate dc-plate-hover group flex h-full w-full flex-col" aria-labelledby={`mt-car-${car.id}`}>
      <Ticks />
      {/* 1 · a foto de estúdio, com a classe e a posição na vitrine */}
      <figure className="mt-photo relative aspect-[16/10] overflow-hidden border-b border-dc-snow/[0.12]">
        <picture>
          <source type="image/avif" srcSet={photoSrcSet(car.id, "avif")} sizes="(min-width: 1180px) 30vw, (min-width: 720px) 47vw, 100vw" />
          <source type="image/webp" srcSet={photoSrcSet(car.id, "webp")} sizes="(min-width: 1180px) 30vw, (min-width: 720px) 47vw, 100vw" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photoFallback(car.id)}
            alt={`The ${car.name}, front three-quarter view in the DOG MOTORS studio`}
            width={896}
            height={560}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
          />
        </picture>
        <figcaption className="absolute inset-x-0 top-0 flex items-baseline justify-between px-4 pt-3.5">
          <span className="dc-label text-dc-snow/[0.92]">{car.classLabel}</span>
          <span className="dc-label tabular-nums text-dc-mist">{String(car.n).padStart(2, "0")} / {SHOWROOM.length}</span>
        </figcaption>
        {owned && (
          <span className="absolute bottom-3 right-3 bg-dc-lava px-2 py-1 font-mono text-[10px] font-semibold tracking-[0.18em] text-dc-void">OWNED</span>
        )}
        <span aria-hidden className="mt-rule absolute inset-x-0 bottom-0 h-px bg-dc-lava" />
      </figure>

      <div className="flex flex-1 flex-col px-4 pb-4 pt-4 dk:px-5 dk:pb-5">
        {/* 2 · o nome DOG CITY e o motor */}
        <h3 id={`mt-car-${car.id}`} className="font-cond text-[30px] dk:text-[32px] font-semibold uppercase leading-[0.95] text-dc-snow">{car.name}</h3>
        <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.14em] text-dc-mist">
          {s.engine} <span aria-hidden className="text-dc-dusty">·</span> {s.drive} <span aria-hidden className="text-dc-dusty">·</span> {fmtInt(s.massKg)} kg
        </p>

        {/* 3 · os números do jogo */}
        <dl className="mt-4 grid grid-cols-3 border-y border-dc-snow/[0.12]">
          <Stat first label="Top speed" value={String(s.topKmh)} unit="KM/H" />
          <Stat label="0-100 km/h" value={s.zeroTo100.toFixed(1)} unit="S" />
          <Stat label="Class" value={car.classLabel} />
        </dl>

        {/* 4 · o preço e a ação */}
        <PriceBand car={car} offer={offer} owned={owned} address={address} verified={verified} points={points} stage={stage} onAsk={ask} onConfirm={confirm} onCancel={cancel} />
      </div>
    </article>
  )
}

export default function Showroom({ initial }: { initial: DcShowroomState }) {
  const state = useShowroom(initial)
  const { account, verified } = useWallet()
  const address = account?.ordinalsAddress ?? null
  const garage = useGarage(address)
  const points = usePoints(address, verified)
  const [filter, setFilter] = useState<CarClass | "all">("all")

  const cars = useMemo(() => (filter === "all" ? SHOWROOM : SHOWROOM.filter((c) => c.cls === filter)), [filter])
  const ownedCount = garage ? SHOWROOM.filter((c) => garage.has(c.id)).length : null

  const status =
    state.kind === "open" ? { dot: "lava", title: "Showroom open", text: `Priced in DC Points, the points you earn by playing DOG CITY. Up to ${DAILY_CAP} a day.` }
      : state.kind === "unavailable" ? { dot: "dim", title: "Prices unavailable", text: "The showroom could not be read right now. This page tries again every minute." }
        : { dot: "dim", title: "Reading the showroom", text: "Prices come from DOG MOTORS, live." }

  return (
    <section id="cars" aria-labelledby="mt-cars-h2" className="relative bg-dc-void pt-24 dk:pt-40 scroll-mt-14">
      <Frame>
        <SectionHead n="02" label="The showroom" />
        <h2 id="mt-cars-h2" className="dc-h2 mt-4 text-dc-snow"><SplitLine text="Sixteen cars. Six classes." /></h2>
        <p className="dc-lede mt-6">
          Every car is priced in DC Points, the points you earn by playing DOG CITY. Buy it in the game or here with the same wallet. One of each model per wallet.
        </p>

        {/* a leitura da loja: o estado, a regra do preço e a carteira */}
        <Reveal y={12}>
          <div className="dc-plate mt-12 grid dk:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_minmax(0,1fr)]" aria-live="polite">
            <Ticks />
            <div className="flex items-center gap-3 px-5 py-4">
              <span aria-hidden className="relative inline-block h-[7px] w-[7px] shrink-0 bg-dc-lava" style={status.dot === "dim" ? { opacity: 0.45 } : undefined}>
                {status.dot === "breathe" && <span className="dc-breathe absolute inset-0 bg-dc-lava" />}
              </span>
              <p className="font-mono text-[12px] font-semibold uppercase tracking-[0.16em] text-dc-snow">{status.title}</p>
            </div>
            <p className="border-t border-dc-snow/[0.1] px-5 py-4 font-body text-[15px] leading-[22px] text-dc-snow/[0.84] dk:border-l dk:border-t-0">{status.text}</p>
            <div className="flex items-center border-t border-dc-snow/[0.1] px-5 py-4 dk:border-l dk:border-t-0">
              <p className="font-mono text-[11px] leading-[18px] tracking-[0.06em] text-dc-mist">
                {!address
                  ? "Connect a wallet to see the cars you own."
                  : ownedCount === null
                    ? <>Wallet <span className="text-dc-snow">{short(address)}</span></>
                    : <>Wallet <span className="text-dc-snow">{short(address)}</span> · {ownedCount === 0 ? "no cars yet" : `${ownedCount} owned`}</>}
                {address && points && <> · <span className="text-dc-snow tabular-nums">{fmtPoints(points.balance)}</span> DC Points</>}
              </p>
            </div>
          </div>
        </Reveal>

        {/* as classes: um filtro, não uma página. No celular, um trilho com encaixe */}
        <div className="mt-8 -mx-[var(--dc-gutter)] dk:mx-0">
          <div role="group" aria-label="Filter by class" className="dc-rail gap-2 dk:flex-wrap dk:!px-0 dk:overflow-visible">
            {(["all", ...CLASS_ORDER] as const).map((c) => {
              const on = filter === c
              const n = c === "all" ? SHOWROOM.length : CLASS_COUNT[c]
              return (
                <button
                  key={c}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setFilter(c)}
                  className={`inline-flex h-10 items-center gap-2.5 border px-4 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors ${on ? "border-dc-lava bg-dc-lava/[0.1] text-dc-snow" : "border-dc-snow/[0.16] text-dc-mist hover:border-dc-snow/[0.4] hover:text-dc-snow"}`}
                >
                  {c === "all" ? "All" : CLASS_LABEL[c]}
                  <span className={`tabular-nums ${on ? "text-dc-hot" : "text-dc-dusty"}`}>{n}</span>
                </button>
              )
            })}
          </div>
        </div>

        <ul className="mt-grid mt-6" aria-label={filter === "all" ? `All ${SHOWROOM.length} cars` : `${CLASS_LABEL[filter]} cars`}>
          {cars.map((car) => (
            <li key={car.id} className="flex">
              <CarCard car={car} offer={dcOfferFor(state, car.id)} owned={!!garage?.has(car.id)} address={address} verified={verified} points={points} />
            </li>
          ))}
        </ul>

        <p className="mt-8 max-w-[70ch] font-mono text-[11px] leading-[18px] text-dc-dusty">
          Speeds and times are in-game figures, measured on the game&apos;s own physics. DC Points are game points: they cannot be bought, cannot be sent to another wallet and never turn into $DOG.
        </p>
      </Frame>
    </section>
  )
}
