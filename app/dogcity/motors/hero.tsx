"use client"

// O HERÓI da DOG MOTORS: a entrada pela AN7 à noite (render r2_02), os dois pilones, a Gallery e a DOG TOWER.
// Visor sobre a avenida escura do próprio render; no retrato, o recorte 4:5 no alto e o texto no void.

import { CITY_URL } from "../landing/mint-state"
import { Btn, Frame } from "../landing/ui"
import { HERO } from "./media"

const STATS: { v: string; u?: string; k: string }[] = [
  { v: "18", k: "Cars" },
  { v: "7", k: "Classes" },
  { v: "52", u: "m", k: "DOG TOWER" },
  { v: "350", u: "km/h", k: "Top speed" },
]

export default function Hero() {
  return (
    <section aria-labelledby="mt-h1" className="mt-hero">
      <div className="mt-hero-media">
        <picture>
          <source media="(max-aspect-ratio: 4/5)" type="image/avif" srcSet={HERO.mobile.avif} sizes="100vw" />
          <source media="(max-aspect-ratio: 4/5)" type="image/webp" srcSet={HERO.mobile.webp} sizes="100vw" />
          <source type="image/avif" srcSet={HERO.desktop.avif} sizes="100vw" />
          <source type="image/webp" srcSet={HERO.desktop.webp} sizes="100vw" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={HERO.desktop.fallback}
            alt="DOG MOTORS at night from the AN7: two lit pylons, the DOG MOTORS sign, the glass gallery and the DOG TOWER"
            width={1600}
            height={900}
            fetchPriority="high"
            decoding="async"
          />
        </picture>
        <span aria-hidden className="mt-hero-scrim" />
      </div>

      <div className="mt-hero-body">
        <Frame>
          <div className="flex flex-col gap-10 dkl:flex-row dkl:items-end dkl:justify-between">
            <div className="max-w-[840px]">
              <p className="mt-in dc-label flex flex-wrap items-baseline gap-x-3 gap-y-1 text-dc-snow/[0.9] dc-halo" style={{ animationDelay: "80ms" }}>
                <span className="text-dc-hot">Lot S07-Q00-B0001-L176</span>
                <span aria-hidden className="h-px w-6 self-center bg-dc-snow/[0.4]" />
                <span>Orla Nobre · The Spit</span>
              </p>
              <h1 id="mt-h1" className="mt-in mt-h1 mt-4 text-dc-snow dc-halo" style={{ animationDelay: "160ms" }}>
                DOG Motors
              </h1>
              <p className="mt-in dc-lede mt-5 !max-w-[34ch] dc-halo" style={{ animationDelay: "260ms" }}>
                The dealership of DOG CITY. Eighteen cars on the Orla Nobre, priced in $DOG, paid in $DOG or BTC, and registered to the wallet that buys them.
              </p>
              <div className="mt-in mt-8 grid grid-cols-2 gap-3 dk:flex dk:flex-wrap" style={{ animationDelay: "360ms" }}>
                <Btn href="#cars" className="max-sm:!px-3">See the 18 cars</Btn>
                <Btn href={CITY_URL} variant="line" className="dc-halo max-sm:!px-3">Play DogCity</Btn>
              </div>
            </div>

            {/* a leitura da loja: quatro números, em registro */}
            <dl className="mt-in grid grid-cols-4 border-t border-dc-snow/[0.24] dkl:w-[440px] dkl:shrink-0" style={{ animationDelay: "460ms" }}>
              {STATS.map((s, i) => (
                <div key={s.k} className={`flex flex-col-reverse pt-3 ${i > 0 ? "border-l border-dc-snow/[0.16] pl-3" : ""}`}>
                  <dt className="mt-1.5 dc-label !text-[9px] dk:!text-[10px] !tracking-[0.16em] text-dc-mist dc-halo">{s.k}</dt>
                  <dd className="font-cond text-[28px] dk:text-[36px] font-semibold leading-none text-dc-snow tabular-nums dc-halo">
                    {s.v}
                    {s.u && <span className="ml-1 font-mono text-[10px] dk:text-[11px] font-medium tracking-[0.08em] text-dc-mist">{s.u.toUpperCase()}</span>}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </Frame>
      </div>
    </section>
  )
}
