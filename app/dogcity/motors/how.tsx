"use client"

// 03 · HOW BUYING WORKS (#buy): os quatro passos da compra, na ordem em que a janela os pede, e as regras que valem
// para todo carro (lib/game/cars, PR #62): dono = carteira que assinou, um de cada modelo, valor exato, 6 confirmações,
// sem Ordinal, dinheiro do carro em endereços próprios (nunca o fundo de construção, nunca a licença).

import { Reveal, SplitLine } from "../landing/reveal"
import { Frame, Plate, SectionHead } from "../landing/ui"

const STEPS: { title: string; text: string }[] = [
  {
    title: "Sign in",
    text: "Connect a Bitcoin wallet and sign one message. No transaction, no fee. The car goes to the wallet that signs.",
  },
  {
    title: "Lock the price",
    text: "Pick $DOG or BTC. BTC is locked for 15 minutes at the median of live exchange prices. $DOG gets an exact amount, unique to your order.",
  },
  {
    title: "Pay the exact amount",
    text: "Your wallet sends it to DOG MOTORS from the address on the order, and shows you the destination before you confirm.",
  },
  {
    title: "In your garage",
    text: "After 6 confirmations, about an hour, the car is registered to your wallet and waits for you in DOG CITY.",
  },
]

const RULES: string[] = [
  "One of each model per wallet.",
  "No Ordinal: the car is a record tied to your wallet, and the game reads it.",
  "A payment that does not match its order goes to a manual check.",
  "Car payments go to DOG MOTORS addresses. They are not part of the construction fund and do not count toward a building licence.",
]

export default function HowToBuy() {
  return (
    <section id="buy" aria-labelledby="mt-buy-h2" className="relative bg-dc-void pt-24 dk:pt-40 pb-24 dk:pb-40 scroll-mt-14">
      <Frame>
        <SectionHead n="03" label="How buying works" />
        <h2 id="mt-buy-h2" className="dc-h2 mt-4 text-dc-snow"><SplitLine text="Four steps, one wallet." /></h2>

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
      </Frame>
    </section>
  )
}
