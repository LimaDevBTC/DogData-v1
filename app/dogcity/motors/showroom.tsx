"use client"

// 02 · THE SHOWROOM (#cars): os 18 carros da DOG MOTORS por classe (super, sport, luxury, classic, muscle, off-road,
// compact), um cartão por carro: a foto de estúdio, o nome DOG CITY, os números do jogo, o preço em $DOG e a prévia
// em BTC do GET /api/dogcity/car-quote, e "Owned" quando a carteira conectada já tem o modelo (GET /api/dogcity/cars).
//
// LOJA FECHADA (503 sales_closed): "Coming soon", sem preço e sem botão de compra. Resposta torta ou falha: sem preço
// e sem botão (./quote.ts). O botão abre o modo "car" da janela de pagamento (components/donate/car-checkout.tsx).
//
// O cartão tem quatro faixas FIXAS, na mesma ordem em toda tela (a foto, o nome, os dados, o preço com a ação), e a
// faixa do preço tem a mesma altura em todos os estados: a grade fica em registro com a loja aberta ou fechada.

import { useCallback, useEffect, useMemo, useState } from "react"
import { useDonate } from "@/components/donate/donate-modal"
import { GARAGE_EVENT } from "@/components/donate/car-checkout"
import { useWallet } from "@/contexts/WalletContext"
import type { CarClass } from "@/lib/game/cars/catalog"
import { Reveal, SplitLine } from "../landing/reveal"
import { Frame, SectionHead, Ticks } from "../landing/ui"
import { CLASS_COUNT, CLASS_LABEL, CLASS_ORDER, SHOWROOM, fmtInt, photoFallback, photoSrcSet, type ShowroomCar } from "./cars"
import { fmtDog, offerFor, parseGarage, parseShowroom, satsToBtc, type CardOffer, type ShowroomState } from "./quote"

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`

// ── a vitrine: o que veio no HTML, relido no cliente e a cada minuto com a aba visível ──
function useShowroom(initial: ShowroomState): ShowroomState {
  const [state, setState] = useState<ShowroomState>(initial)
  useEffect(() => {
    let alive = true
    const load = () => {
      if (document.visibilityState === "hidden") return
      fetch("/api/dogcity/car-quote", { cache: "no-store" })
        .then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }))
        .then(({ status, body }) => { if (alive) setState(parseShowroom(status, body)) })
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

// ── um dado do jogo ──
function Stat({ label, value, unit, first }: { label: string; value: string; unit?: string; first?: boolean }) {
  return (
    <div className={`flex flex-col-reverse py-3 ${first ? "" : "border-l border-dc-snow/[0.12] pl-3"}`}>
      <dt className="mt-1.5 dc-label !text-[9px] !tracking-[0.16em] text-dc-dusty">{label}</dt>
      <dd className="mt-stat text-dc-snow">
        {value}
        {unit && <span className="ml-1 font-mono text-[10px] font-medium tracking-[0.06em] text-dc-mist">{unit}</span>}
      </dd>
    </div>
  )
}

// ── a faixa do preço e da ação: a mesma altura em todos os estados ──
function PriceBand({ car, offer, owned, address, onBuy }: {
  car: ShowroomCar
  offer: CardOffer
  owned: boolean
  address: string | null
  onBuy: () => void
}) {
  let label = "Price"
  let big: React.ReactNode
  let small: React.ReactNode = " "
  let action: React.ReactNode
  const bar = (text: React.ReactNode, tone: "quiet" | "lava" = "quiet") => (
    <div className={`flex h-[52px] items-center gap-3 border px-4 font-mono text-[11px] tracking-[0.08em] ${tone === "lava" ? "border-dc-lava/[0.55] text-dc-snow" : "border-dc-snow/[0.14] text-dc-mist"}`}>
      {text}
    </div>
  )

  if (owned) {
    label = "In your garage"
    big = <span className="text-dc-hot">Owned</span>
    small = "One of each model per wallet."
    action = bar(<><span aria-hidden className="h-[6px] w-[6px] shrink-0 bg-dc-lava" />{address ? `Registered to ${short(address)}` : "Registered to your wallet"}</>, "lava")
  } else if (offer.kind === "for_sale") {
    big = <>{fmtDog(offer.priceDog)} <span className="font-mono text-[12px] font-medium tracking-[0.06em] text-dc-mist">$DOG</span></>
    small = offer.sats ? `About ${satsToBtc(offer.sats)} BTC now` : "BTC price unavailable right now"
    action = (
      <button type="button" onClick={onBuy} className="dc-btn dc-btn-fill w-full" aria-label={`Buy the ${car.name} in $DOG or BTC`}>
        Buy <span aria-hidden className="text-dc-void/[0.6]">·</span> <span className="font-medium">$DOG or BTC</span>
      </button>
    )
  } else if (offer.kind === "closed") {
    big = <span className="text-dc-snow/[0.78]">Coming soon</span>
    small = "Prices appear the day the showroom opens."
    action = bar(<><span aria-hidden className="relative inline-block h-[6px] w-[6px] shrink-0 bg-dc-lava"><span className="dc-breathe absolute inset-0 bg-dc-lava" /></span>Showroom opening soon</>)
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
      <p className="mt-1 min-h-[18px] font-mono text-[11px] leading-[18px] text-dc-mist tabular-nums">{small}</p>
      <div className="mt-4">{action}</div>
    </div>
  )
}

function CarCard({ car, offer, owned, address }: { car: ShowroomCar; offer: CardOffer; owned: boolean; address: string | null }) {
  const { open } = useDonate()
  const s = car.spec
  const buy = useCallback(() => {
    if (offer.kind !== "for_sale") return
    open({
      car: {
        id: car.id, name: car.name, classLabel: car.classLabel, priceDog: offer.priceDog, sats: offer.sats,
        photo: { avif: photoSrcSet(car.id, "avif"), webp: photoSrcSet(car.id, "webp"), fallback: photoFallback(car.id) },
      },
    })
  }, [open, car, offer])

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
        <PriceBand car={car} offer={offer} owned={owned} address={address} onBuy={buy} />
      </div>
    </article>
  )
}

export default function Showroom({ initial }: { initial: ShowroomState }) {
  const state = useShowroom(initial)
  const { account } = useWallet()
  const address = account?.ordinalsAddress ?? null
  const garage = useGarage(address)
  const [filter, setFilter] = useState<CarClass | "all">("all")

  const cars = useMemo(() => (filter === "all" ? SHOWROOM : SHOWROOM.filter((c) => c.cls === filter)), [filter])
  const ownedCount = garage ? SHOWROOM.filter((c) => garage.has(c.id)).length : null

  const status =
    state.kind === "open" ? { dot: "lava", title: "Showroom open", text: `Priced in $DOG. BTC at the live median of the exchanges, locked for ${state.lockMinutes} minutes.` }
      : state.kind === "closed" ? { dot: "breathe", title: "Coming soon", text: "Prices in $DOG and BTC appear here the day the showroom opens." }
        : state.kind === "unavailable" ? { dot: "dim", title: "Prices unavailable", text: "The showroom could not be read right now. This page tries again every minute." }
          : { dot: "dim", title: "Reading the showroom", text: "Prices come from DOG MOTORS, live." }

  return (
    <section id="cars" aria-labelledby="mt-cars-h2" className="relative bg-dc-void pt-24 dk:pt-40 scroll-mt-14">
      <Frame>
        <SectionHead n="02" label="The showroom" />
        <h2 id="mt-cars-h2" className="dc-h2 mt-4 text-dc-snow"><SplitLine text="Eighteen cars. Seven classes." /></h2>
        <p className="dc-lede mt-6">
          Every car is priced in $DOG. Pay in $DOG, or the same value in BTC. One of each model per wallet, registered to the wallet that pays.
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

        <ul className="mt-grid mt-6" aria-label={filter === "all" ? "All 18 cars" : `${CLASS_LABEL[filter]} cars`}>
          {cars.map((car) => (
            <li key={car.id} className="flex">
              <CarCard car={car} offer={offerFor(state, car.id)} owned={!!garage?.has(car.id)} address={address} />
            </li>
          ))}
        </ul>

        <p className="mt-8 max-w-[70ch] font-mono text-[11px] leading-[18px] text-dc-dusty">
          Speeds and times are in-game figures, measured on the game&apos;s own physics. The BTC line is today&apos;s estimate; the amount you pay is the one your order locks.
        </p>
      </Frame>
    </section>
  )
}
