"use client"

// O NOVO ALTO DA LANDING (praca-ajustes.md itens 7 e 12).
//
// O que saiu: um herói de 500vh que rolava 180 quadros assados no Blender e
// construía a cidade quadro a quadro. Era bonito e ficou velho: aqueles quadros
// mostram modelos anteriores à reforma da praça, e a cidade de verdade abriu em
// /city. O fundador foi direto: "tirar o vídeo com scroll da home".
//
// O que entrou: uma chapa da CIDADE DE VERDADE, capturada de /city com o HUD
// desligado (?plate=1). O que se vê aqui é literalmente o que abre ao clicar.
// Mais o título e as duas portas: entrar na praça ou financiar a cidade. A faixa
// viva da mempool fica logo acima (item 6).
//
// Sem Reveal/IntersectionObserver: isto nasce acima da dobra, e os reveals deste
// projeto têm zona morta no topo (motion.tsx) — o herói ficaria invisível.
import Image from "next/image"
import Link from "next/link"
import { ArrowRight, ArrowDown } from "lucide-react"

const STILLS = [
  { src: "/landing/plaza/plaza-war.webp", href: "/city/war", label: "THE PRICE WAR", alt: "The war crater at night: Shiba soldiers and bears clash on the live Kraken order book, a fire column rising at the front line" },
  { src: "/landing/plaza/plaza-paw.webp", href: "/city", label: "THE DIAMOND PAW", alt: "$DOG written in a mirror pool thirty metres across, at the centre of a paw of dark water" },
  { src: "/landing/plaza/plaza-temple.webp", href: "/city", label: "THE HIDDEN TEMPLE", alt: "The mouth of the Leonidas cave glowing among the monarch runestones" },
  { src: "/landing/plaza/plaza-dsc.webp", href: "/city", label: "DOG SOCIAL CLUB", alt: "The Dog Social Club wall beside Kray Tower, the whole collection hung on curved stone" },
] as const

export default function HeroLive() {
  return (
    <section className="relative isolate overflow-hidden border-b border-white/10">
      {/* a chapa cobre a SEÇÃO inteira, não a caixa do texto: com a imagem
          pendurada na caixa flex (items-end), o conteúdo mais alto que ela
          transbordava por cima e o alto do herói ficava preto */}
      <Image
          src="/landing/plaza/plaza-home.webp"
          alt="Satoshi Plaza on the Moon: the Needle at the centre, Kray Tower and BitFlow HQ on the ring, DOG ships in orbit above"
          fill
          priority
          sizes="100vw"
        /* a chapa tem céu vazio no alto: o corte favorece o chão */
        className="object-cover object-[center_68%]"
      />
      {/* a chapa é escura, mas o texto manda: dois véus, um do pé e um da esquerda */}
      <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-void via-void/70 to-void/10" />
      <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-void/85 via-void/20 to-transparent" />

      {/* ⚠️ SEM ALTURA CEGA EM NENHUM TAMANHO: min-h de 86vh + items-end
          empurravam os CTAs pra fora da dobra também no DESKTOP (fundador
          notou), porque o herói não desconta o header, o banner e a faixa da
          órbita que moram acima dele (~21rem). O min-h do desktop passa a ser
          o viewport MENOS esse teto, e os paddings encolhem: o pé do herói
          cai na dobra, com os CTAs dentro dela. */}
      <div className="relative md:min-h-[calc(100svh-21rem)] flex items-end">
        <div className="w-full max-w-6xl mx-auto px-6 md:px-10 pt-8 pb-10 md:pt-10 md:pb-12">
          <p className="font-mono text-[11px] tracking-[0.3em] text-lava">DOGCITY · ON THE MOON</p>
          <h1 className="font-display font-bold text-snow mt-3 md:mt-4 leading-[1.02] text-4xl md:text-6xl max-w-4xl">
            The city is open.
            <span className="block text-mist">The mempool flies over it.</span>
          </h1>
          {/* na primeira dobra do celular o parágrafo é curto; a versão longa
              com a geografia completa é de sm pra cima */}
          <p className="sm:hidden text-sm text-mist mt-4 max-w-xl leading-relaxed">
            Satoshi Plaza stands on real lunar terrain. Every DOG transaction becomes a ship
            overhead, and in the war crater the live order book is fought as a battle: dogs
            against bears, mortars and all.
          </p>
          <p className="hidden sm:block text-sm md:text-base text-mist mt-5 max-w-xl md:max-w-2xl leading-relaxed">
            Satoshi Plaza stands on real Mare Tranquillitatis terrain: the Needle at the centre,
            Kray Tower and BitFlow HQ on the ring, and Runestone Park to the north-east. Every DOG
            transaction our node sees becomes a ship overhead: the fee sets the altitude, the
            block is the landing. And in the war crater to the south-west, the live Kraken order
            book is fought as a battle: Shiba soldiers against bears, artillery on every trade,
            the front line crawling across the day&apos;s price range.
          </p>

          <div className="flex flex-wrap items-center gap-3 mt-6 md:mt-8">
            <Link
              href="/city"
              className="inline-flex items-center gap-2 font-mono text-[12px] font-bold tracking-[0.14em]
                         bg-lava hover:bg-lava-light text-void px-6 py-3.5 transition-colors"
            >
              ENTER THE DOGCITY
              <ArrowRight className="w-4 h-4" />
            </Link>
            <a
              href="#build"
              className="inline-flex items-center gap-2 font-mono text-[12px] tracking-[0.14em]
                         border border-white/25 hover:border-lava text-snow px-6 py-3.5 transition-colors"
            >
              BUILD DOGCITY
              <ArrowDown className="w-4 h-4" />
            </a>
          </div>

          {/* três chapas menores: a cidade tem mais do que a praça */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 md:gap-3 mt-8 max-w-3xl">
            {STILLS.map((s) => (
              <Link key={s.src} href={s.href} className="group relative aspect-[16/10] overflow-hidden border border-white/10">
                <Image src={s.src} alt={s.alt} fill sizes="(min-width: 768px) 190px, 50vw" className="object-cover transition-transform duration-700 group-hover:scale-105" />
                <span className="absolute inset-x-0 bottom-0 bg-void/80 px-2 py-1 font-mono text-[8px] md:text-[9px] tracking-[0.2em] text-mist">
                  {s.label}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
