"use client"

// 03 · HOW BUYING WORKS (#buy): os quatro passos da compra e as regras que valem para todo carro. Desde 15/11/2026 os
// carros custam DC POINTS (decisão do fundador, assets_carros/projeto/CARROS_DC_POINTS.md): pontos do jogo, ganhos jogando,
// com teto diário de 480 no servidor; não se compram, não se transferem, nunca viram $DOG. Dono = carteira verificada,
// um de cada modelo, sem Ordinal. O teto vem de lib/game/points/ajustes_economia.ts (a cópia do jogo) e o contrato público em
// /dogcity/docs#dog-motors.

import { Reveal, SplitLine } from "../landing/reveal"
import { Frame, Plate, SectionHead } from "../landing/ui"
import { ECONOMIA } from "@/lib/game/points/ajustes_economia"

const DAILY_CAP = ECONOMIA.tetoDiarioRecebido

const STEPS: { title: string; text: string }[] = [
  {
    title: "Sign in",
    text: "Connect a Bitcoin wallet in DOG CITY, sign one message and register a handle. No transaction, no fee.",
  },
  {
    title: "Earn DC Points",
    text: `Hunt, sell what you bring back to the market, check in every day and finish the first steps. Up to ${DAILY_CAP} DC Points a day.`,
  },
  {
    title: "Buy the car",
    text: "At the DOG MOTORS counter in the game, or here with the same wallet. The price is in DC Points and is shown before you confirm.",
  },
  {
    title: "In your garage",
    text: "The car is registered to your wallet right away and waits for you in DOG CITY.",
  },
]

const RULES: string[] = [
  "One of each model per wallet. A car won in the AN7 race counts.",
  "DC Points are game points. They cannot be bought, cannot be sent to another wallet and never turn into $DOG.",
  `Only a verified wallet with a handle earns DC Points, up to ${DAILY_CAP} a day.`,
  "No Ordinal: the car is a record tied to your wallet, and the game reads it.",
]

export default function HowToBuy() {
  return (
    <section id="buy" aria-labelledby="mt-buy-h2" className="relative bg-dc-void pt-24 dk:pt-40 pb-24 dk:pb-40 scroll-mt-14">
      <Frame>
        <SectionHead n="03" label="How buying works" />
        <h2 id="mt-buy-h2" className="dc-h2 mt-4 text-dc-snow"><SplitLine text="Play, earn, drive." /></h2>

        <ol className="mt-14 dk:mt-20 grid gap-4 dk:grid-cols-2 dkl:grid-cols-4 dkl:gap-5">
          {STEPS.map((s, i) => (
            <Reveal key={s.title} as="li" y={16} delay={0.06 * i}>
              <Plate className="flex h-full flex-col px-5 py-6">
                <p className="font-mono text-[11px] tracking-[0.18em] text-dc-lava">{String(i + 1).padStart(2, "0")}</p>
                <h3 className="mt-4 font-cond text-[30px] font-semibold uppercase leading-none text-dc-snow">{s.title}</h3>
                <p className="mt-3 font-body text-[15px] leading-[23px] text-dc-snow/[0.84] [text-wrap:pretty]">{s.text}</p>
              </Plate>
            </Reveal>
          ))}
        </ol>

        <ul className="mt-10 grid gap-x-10 gap-y-3 border-t border-dc-snow/[0.12] pt-8 dk:grid-cols-2">
          {RULES.map((r) => (
            <li key={r} className="flex gap-3 font-body text-[15px] leading-[23px] text-dc-snow/[0.8] [text-wrap:pretty]">
              <span aria-hidden className="mt-[9px] h-[5px] w-[5px] shrink-0 bg-dc-lava" />
              {r}
            </li>
          ))}
        </ul>

        <p className="mt-8 font-mono text-[11px] leading-[18px] text-dc-dusty">
          The full rules are in the <a href="/dogcity/docs#dog-motors" className="text-dc-mist underline decoration-dc-snow/[0.3] underline-offset-4 transition-colors hover:text-dc-hot">DogCity docs</a>.
        </p>
      </Frame>
    </section>
  )
}
