"use client"

// 01 · THE PLACE (#place): o lote inteiro da DOG MOTORS na Orla Nobre, da AN7 até a areia (assets_carros/projeto/
// PROJETO_DOG_MOTORS.md, a prancha é a fonte das medidas). A Gallery em destaque, e três pranchas iguais: a DOG TOWER
// (onde o carro comprado desce), o DOG RING (test drive) e a corrida da perimetral AN7 (ranking por modelo).

import { Reveal, SplitLine } from "../landing/reveal"
import { DataRow, Frame, Plate, SectionHead } from "../landing/ui"
import { PLACE } from "./media"

type Pic = { avif: string; webp: string; fallback: string }

function Picture({ pic, alt, sizes, w, h, className = "" }: { pic: Pic; alt: string; sizes: string; w: number; h: number; className?: string }) {
  return (
    <picture>
      <source type="image/avif" srcSet={pic.avif} sizes={sizes} />
      <source type="image/webp" srcSet={pic.webp} sizes={sizes} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={pic.fallback} alt={alt} width={w} height={h} loading="lazy" decoding="async" className={`block h-full w-full object-cover ${className}`} />
    </picture>
  )
}

const PLATES: { key: string; pic: Pic; alt: string; label: string; title: string; text: string }[] = [
  {
    key: "tower",
    pic: PLACE.tower,
    alt: "The DOG TOWER from below: ten lit glass floors, a car on the delivery turntable at its foot",
    label: "52 m · 10 floors",
    title: "DOG Tower",
    text: "Ten glass floors with forty cars on display around the lift. The car you buy comes down the tower and rolls out on the delivery turntable.",
  },
  {
    key: "ring",
    pic: PLACE.ring,
    alt: "The DOG RING seen from the glass paddock walk, a car on the track and the city across the bay",
    label: "235 m lap · Test drive",
    title: "DOG Ring",
    text: "A 9 m track behind the tower, two 76 m straights and two curves, crossed overhead by the paddock walk. Take any model for a test drive.",
  },
  {
    key: "race",
    pic: PLACE.race,
    alt: "The Spit from the bay at dusk: the DOG TOWER lit above the Orla Nobre, the pier and the beach club",
    label: "AN7 perimeter · Ranked by model",
    title: "The AN7 race",
    text: "The race on the AN7 perimeter starts and finishes at DOG MOTORS. Every model keeps its own leaderboard. Rules and prizes are published in the docs before the first championship.",
  },
]

export default function Place() {
  return (
    <section id="place" aria-labelledby="mt-place-h2" className="relative bg-dc-void pt-24 dk:pt-40 scroll-mt-14">
      <Frame>
        <SectionHead n="01" label="The place" />
        <h2 id="mt-place-h2" className="dc-h2 mt-4 text-dc-snow"><SplitLine text="From the AN7 to the bay." /></h2>
        <p className="dc-lede mt-6">
          DOG MOTORS takes a whole lot of the Orla Nobre on The Spit: a glass gallery on the avenue, a 52 m tower, a test track and a club on the water.
        </p>

        {/* a Gallery: a imagem larga e a prancha do lote ao lado (no celular, uma embaixo da outra) */}
        <div className="mt-14 dk:mt-20 grid gap-4 dkl:grid-cols-12 dkl:gap-5">
          <Reveal y={16} className="dkl:col-span-7">
            <figure className="relative h-full overflow-hidden border border-dc-snow/[0.12] bg-dc-deep">
              <div className="aspect-[16/9] dkl:aspect-auto dkl:h-full">
                <Picture pic={PLACE.gallery} sizes="(min-width: 1024px) 58vw, 100vw" w={1600} h={900}
                  alt="Inside the Gallery: an orange supercar on a lit turntable, more cars behind it and the mezzanine stair at the back" />
              </div>
            </figure>
          </Reveal>
          <Reveal y={16} delay={0.08} className="dkl:col-span-5">
            <Plate className="flex h-full flex-col px-5 py-6 dk:px-7 dk:py-8">
              <p className="dc-label text-dc-lava">58 m of glass</p>
              <h3 className="dc-h3 mt-3 text-dc-snow">The Gallery</h3>
              <p className="mt-4 font-body text-[16px] leading-[25px] text-dc-snow/[0.86] [text-wrap:pretty]">
                The showroom on the AN7: eight turntables under one roof, the Car of the Week turning in the forecourt and a lounge on the mezzanine.
                Every car of the showroom below stands here.
              </p>
              <dl className="mt-6 dkl:mt-auto dkl:pt-6">
                <DataRow label="Lot">S07-Q00-B0001-L176</DataRow>
                <DataRow label="District">Orla Nobre, The Spit</DataRow>
                <DataRow label="Area">13,476.1 m²</DataRow>
                <DataRow label="Frontage">45.5 m on the AN7</DataRow>
                <DataRow label="Depth">303 m to the sand</DataRow>
              </dl>
            </Plate>
          </Reveal>
        </div>

        {/* três pranchas iguais: a torre, a pista e a corrida */}
        <ul className="mt-4 dkl:mt-5 grid gap-4 dk:grid-cols-3 dkl:gap-5">
          {PLATES.map((p, i) => (
            <Reveal key={p.key} as="li" y={16} delay={0.06 * i}>
              <Plate className="flex h-full flex-col">
                <div className="aspect-[4/3] overflow-hidden border-b border-dc-snow/[0.12] bg-dc-deep">
                  <Picture pic={p.pic} alt={p.alt} sizes="(min-width: 640px) 33vw, 100vw" w={1200} h={900} />
                </div>
                <div className="flex flex-1 flex-col px-5 pb-6 pt-5">
                  <p className="dc-label text-dc-lava">{p.label}</p>
                  <h3 className="dc-h3 mt-3 text-dc-snow">{p.title}</h3>
                  <p className="mt-3 font-body text-[15px] leading-[23px] text-dc-snow/[0.84] [text-wrap:pretty]">{p.text}</p>
                </div>
              </Plate>
            </Reveal>
          ))}
        </ul>
      </Frame>
    </section>
  )
}
