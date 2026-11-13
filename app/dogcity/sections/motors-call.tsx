"use client"

// ═══════════════════════════════════════════════════════════════════════════
// A CHAMADA DA DOG MOTORS na landing (#motors), entre 04 The city e 05 The calendar: um bloco curto, sem número de
// folha (não é uma batida da landing, é uma porta), que leva à vitrine /dogcity/motors. Uma prancha só: a entrada
// pela AN7 à noite de um lado, o nome, uma frase e o botão do outro. Sem preço aqui: o preço mora na vitrine e vem
// da loja (GET /api/dogcity/car-quote).
// ═══════════════════════════════════════════════════════════════════════════

import { Reveal } from "../landing/reveal"
import { Btn, Frame, Plate } from "../landing/ui"

const SRC = (ext: "avif" | "webp") => [768, 1280].map((w) => `/dogcity-motors/hero-${w}.${ext} ${w}w`).join(", ")

export default function MotorsCall() {
  return (
    <section id="motors" aria-labelledby="dc-motors-h2" className="relative bg-dc-void pt-24 dk:pt-40 scroll-mt-14">
      <Frame>
        <Reveal y={16}>
          <Plate className="grid overflow-hidden dkl:grid-cols-2">
            <a href="/dogcity/motors" tabIndex={-1} aria-hidden className="relative block aspect-[16/9] overflow-hidden border-b border-dc-snow/[0.12] dkl:aspect-auto dkl:border-b-0 dkl:border-r">
              <picture>
                <source type="image/avif" srcSet={SRC("avif")} sizes="(min-width: 1024px) 50vw, 100vw" />
                <source type="image/webp" srcSet={SRC("webp")} sizes="(min-width: 1024px) 50vw, 100vw" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/dogcity-motors/hero-768.webp"
                  alt=""
                  width={1600}
                  height={900}
                  loading="lazy"
                  decoding="async"
                  className="absolute inset-0 h-full w-full object-cover object-[50%_40%] transition-transform duration-[900ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-[1.03]"
                />
              </picture>
            </a>
            <div className="flex flex-col justify-center px-5 py-8 dk:px-10 dk:py-12">
              <p className="dc-label flex items-baseline gap-3 text-dc-mist">
                <span className="text-dc-lava">New in the city</span>
                <span aria-hidden className="h-px w-6 self-center bg-dc-snow/[0.24]" />
                <span>Orla Nobre</span>
              </p>
              <h2 id="dc-motors-h2" className="mt-4 font-cond text-[56px] dk:text-[80px] font-bold uppercase leading-[0.86] text-dc-snow">DOG Motors</h2>
              <p className="mt-5 max-w-[38ch] font-body text-[17px] leading-[27px] text-dc-snow/[0.86] [text-wrap:pretty]">
                The dealership of DOG CITY. Eighteen cars in seven classes, priced in $DOG and paid in $DOG or BTC, with a 52 m tower and a test track on The Spit.
              </p>
              <div className="mt-8">
                <Btn href="/dogcity/motors">Visit DOG MOTORS</Btn>
              </div>
            </div>
          </Plate>
        </Reveal>
      </Frame>
    </section>
  )
}
