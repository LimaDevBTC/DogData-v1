"use client"

// ═══════════════════════════════════════════════════════════════════════════
// $DOG GALAXY · a segunda folha de "isto ja esta no ar".
//
// POR QUE FICA AQUI, logo depois de PlazaLive e ANTES de ConstructionFund.
// A landing so tem dois produtos abertos hoje: a praca (/city) e a galaxia
// (/galaxy). PlazaLive abre dizendo "voce pode entrar hoje"; esta folha fecha
// o par antes de a pagina pedir dinheiro. Se viesse depois do fundo, o produto
// mais novo da casa viraria rodape de uma pagina de doacao. E tem argumento
// tambem: o folio inteiro promete que o historico da carteira decide o lote,
// e a genealogia e a prova desse dado, entao ela precisa aparecer antes de
// HowItWorks e Tiers.
//
// AS CHAPAS SAO A CENA DE VERDADE. Nao sao render nem arte: sao leituras do
// canvas WebGL de /galaxy (toDataURL dentro de um rAF, 1600x900, reduzidas
// para 1280x720). Por isso nao tem HUD nenhum nelas, o readback pega so o
// canvas. O par conta a interacao principal do produto: o ceu parado e o mesmo
// ceu um clique depois, com as 80.850 arestas do airdrop acesas.
//
// OS NUMEROS vem de GALAXY em ../dogcity-data (snapshot datado do no raiz).
// Nada de fetch aqui: a rota da arvore pesa 628 KB, e a landing nao ganha rota
// nova de dado pesado depois do incidente de IO de 26/08.
//
// Tailwind: a escala de opacidade deste projeto e a padrao (multiplos de 5).
// border-white/8 e border-white/12 NAO COMPILAM e caem no #D1D5DB do
// preflight, pintando fio cinza claro em pagina preta. Por isso HAIR,
// HAIR_SOFT e GRIDLINE vem de ../motion.
// ═══════════════════════════════════════════════════════════════════════════

import Image from "next/image"
import { motion, useReducedMotion } from "framer-motion"
import { ArrowRight } from "lucide-react"
import {
  EASE, EASE_CSS, HAIR, HAIR_SOFT, GRIDLINE,
  Counter, DrawRule, Reveal, Scramble, SplitLine, Stagger, StaggerItem,
  useMagnetic, useOnce,
} from "../motion"
import { GALAXY } from "../dogcity-data"

// ── a marca de registro do time SKYLINE ────────────────────────────────────
// Quatro cantos batidos DENTRO do fio da chapa antes de o conteudo entrar.
// Duplicado por arquivo de proposito: motion.tsx esta congelado.
function Corners({ accent, delay = 0 }: { accent?: string; delay?: number }) {
  const reduce = useReducedMotion()
  const { ref, inView } = useOnce("-5% 0px")
  const show = reduce || inView
  const C = [
    { box: "top-0 left-0", h: "top-0 left-0", v: "top-0 left-0", ox: "left", oy: "top" },
    { box: "top-0 right-0", h: "top-0 right-0", v: "top-0 right-0", ox: "right", oy: "top" },
    { box: "bottom-0 right-0", h: "bottom-0 right-0", v: "bottom-0 right-0", ox: "right", oy: "bottom" },
    { box: "bottom-0 left-0", h: "bottom-0 left-0", v: "bottom-0 left-0", ox: "left", oy: "bottom" },
  ]
  const paint = (i: number) => (i === 0 && accent ? accent : "rgba(240,240,242,0.22)")
  return (
    <span ref={ref as never} aria-hidden className="absolute inset-0 pointer-events-none z-20">
      {C.map((c, i) => (
        <span key={c.box} className={`absolute ${c.box}`} style={{ width: 10, height: 10 }}>
          <motion.span
            className={`absolute ${c.h} h-px w-full`}
            style={{ background: paint(i), transformOrigin: c.ox }}
            initial={reduce ? false : { scaleX: 0 }}
            animate={show ? { scaleX: 1 } : undefined}
            transition={{ duration: 0.35, delay: delay + i * 0.04, ease: EASE }}
          />
          <motion.span
            className={`absolute ${c.v} w-px h-full`}
            style={{ background: paint(i), transformOrigin: c.oy }}
            initial={reduce ? false : { scaleY: 0 }}
            animate={show ? { scaleY: 1 } : undefined}
            transition={{ duration: 0.35, delay: delay + i * 0.04, ease: EASE }}
          />
        </span>
      ))}
    </span>
  )
}

// ── as chapas: o mesmo ceu, antes e depois do clique ───────────────────────
const PLATES = [
  {
    src: "/landing/galaxy/galaxy-shells.webp",
    label: "THE SKY AT REST",
    caption: "Generation shells around the airdrop treasury. Lit stars still hold DOG today.",
    alt: "The $DOG Galaxy at rest: a bright core of airdrop wallets surrounded by concentric shells of orange points, one point per wallet",
  },
  {
    src: "/landing/galaxy/galaxy-fan.webp",
    label: "ONE CLICK ON THE TREASURY",
    caption: "80,850 airdrop edges light at once, drawn wallet by wallet.",
    alt: "The same galaxy with the treasury selected: 80,850 edges fan out from the centre and light the core white hot",
  },
] as const

// ── o quadro de leitura ────────────────────────────────────────────────────
const STATS = [
  { k: "WALLETS MAPPED", v: GALAXY.wallets, sub: "every address DOG passed through" },
  { k: "STILL HOLDING", v: GALAXY.holding, sub: "with a balance today" },
  { k: "DEEPEST CHAIN", v: 1663, sub: "hand to hand, wallet to wallet" },
  { k: "DIRECT CHILDREN", v: GALAXY.directChildren, sub: "first hop out of the airdrop" },
] as const

// A galaxia e o modo padrao de /galaxy. As lentes de analise abrem por deep
// link: qualquer parametro de sankey manda o wrapper para o Flow, e ?view=ego
// abre o ego-grafo. Montado a partir de GALAXY.treasury para o endereco existir
// num lugar so.
const FLOW_HREF = `/galaxy?root=${GALAXY.treasury}`
const GRAPH_HREF = "/galaxy?view=ego"

export default function Section() {
  const primary = useMagnetic<HTMLAnchorElement>()

  return (
    <section id="galaxy" className={`border-t ${HAIR_SOFT}`}>
      <div className="max-w-6xl mx-auto px-6 md:px-10 py-16 md:py-24">

        {/* ── cabecalho: a gramatica de todas as folhas do folio ──────────── */}
        <div className="max-w-2xl">
          {/* a folha de cima ja usa "OPEN NOW"; repetir uma secao depois seria
              preguica, e "NEW" e o fato que interessa aqui */}
          <Scramble text="$DOG GALAXY · NEW" className="font-mono text-[11px] tracking-[0.3em] text-lava" />
          <DrawRule className="mt-3 w-14" delay={0.06} duration={0.9} />
          <h2 className="font-display font-bold text-3xl md:text-4xl text-snow mt-4 leading-tight">
            <SplitLine text="Every wallet DOG ever touched, in one sky." delay={0.12} step={0.055} className="pb-[0.12em]" />
          </h2>
          <Reveal delay={0.34} y={14}>
            <p className="text-sm text-mist mt-3 leading-relaxed">
              DogCity decides where a wallet stands. The galaxy shows where it came from. Every
              address DOG has passed through since the airdrop is a star: its size is the real
              balance, so the whales stand out at a glance, and its shell is its generation, counted
              out from the treasury at the centre.
            </p>
          </Reveal>
          <Reveal delay={0.44} y={14}>
            <p className="text-sm text-mist mt-3 leading-relaxed">
              Click the treasury and 80,850 edges light at once: the first hop of the airdrop, drawn
              wallet by wallet. Click any other star for its dossier, with balance, generation, the
              line back to the treasury and its largest counterparties. The Flow and Graph lenses
              sit one button away for sankey and ego graph work.
            </p>
          </Reveal>
        </div>

        {/* ── o diptico: o mesmo ceu, um clique de diferenca ──────────────── */}
        {/* Celular empilha as duas chapas na ordem da historia (parado, depois
            aceso). Cada uma e um link inteiro para /galaxy: alvo de toque
            grande, sem botao pequeno escondido em cima da imagem. */}
        <Stagger step={0.12} delay={0.18} className="mt-10 md:mt-12 grid sm:grid-cols-2 gap-4 md:gap-5">
          {PLATES.map((p, i) => (
            <StaggerItem key={p.src}>
              <a href="/galaxy" className="group block">
                <div className={`relative aspect-[16/9] border ${HAIR} overflow-hidden bg-void`}>
                  <Image
                    src={p.src}
                    alt={p.alt}
                    fill
                    sizes="(min-width: 640px) 46vw, 100vw"
                    className="object-cover transition-transform duration-[1400ms] group-hover:scale-[1.02]"
                    style={{ transitionTimingFunction: EASE_CSS }}
                  />
                  <Corners accent={i === 1 ? "rgba(245,110,15,0.85)" : undefined} delay={0.1} />
                  <span className="absolute left-3 bottom-3 border border-white/[0.12] bg-void/75 backdrop-blur-sm px-2.5 py-1.5 font-mono text-[10px] tracking-[0.18em] text-snow">
                    {p.label}
                  </span>
                </div>
                <p className="mt-2.5 font-mono text-[11px] text-dusty leading-relaxed">{p.caption}</p>
              </a>
            </StaggerItem>
          ))}
        </Stagger>

        {/* ── o quadro de leitura ─────────────────────────────────────────── */}
        {/* 2 colunas no celular e 4 a partir de md. Numero grande primeiro,
            rotulo mono embaixo: no iPhone o que precisa ser legivel de longe e
            a cifra, nao a legenda. */}
        <div className={`mt-8 md:mt-10 border ${HAIR}`}>
          <div className={`flex items-center justify-between px-4 py-2 border-b ${HAIR} font-mono text-[9px] tracking-[0.25em] text-dusty`}>
            {/* os dois rotulos sao curtos de proposito: a 9px com 0.25em de
                tracking, um par mais longo estoura os 342px uteis do iPhone */}
            <span>GENEALOGY</span>
            <span>ROOT: TREASURY</span>
          </div>
          <Stagger as="dl" step={0.09} delay={0.2} className={`grid grid-cols-2 md:grid-cols-4 gap-px ${GRIDLINE}`}>
            {STATS.map((s) => (
              <StaggerItem key={s.k} className="bg-void px-4 py-5 flex flex-col">
                {/* No DOM o rotulo vem ANTES da cifra: dentro de um <dl> o HTML
                    pede dt antes de dd, e o leitor de tela le "wallets mapped,
                    263,919", que e a ordem certa. A ordem VISUAL inverte com
                    order-*, porque no celular quem precisa saltar e o numero. */}
                <dt className="order-2 mt-2.5">
                  {/* rotulo em mist e legenda em dusty: no iPhone o dusty a
                      10px ja e o piso do legivel, entao a hierarquia sobe o
                      rotulo em vez de descer a legenda */}
                  <span className="block font-mono text-[10px] tracking-[0.22em] text-mist">{s.k}</span>
                  <span className="block font-mono text-[10px] text-dusty mt-1 leading-snug">{s.sub}</span>
                </dt>
                <dd className="order-1 font-display font-bold text-2xl md:text-[28px] text-snow leading-none">
                  <Counter value={s.v} />
                </dd>
              </StaggerItem>
            ))}
          </Stagger>
        </div>

        {/* ── a porta ─────────────────────────────────────────────────────── */}
        <Reveal delay={0.2} y={12} className="mt-7">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
            <a
              href="/galaxy"
              ref={primary.ref}
              onPointerMove={primary.onPointerMove}
              onPointerLeave={primary.onPointerLeave}
              className="inline-flex w-full sm:w-auto items-center justify-center gap-2 px-6 py-3.5 font-mono text-sm font-bold text-void bg-lava hover:bg-lava-light"
              style={{ ...primary.style, transition: `transform 0.45s ${EASE_CSS}, background-color 0.25s ease` }}
            >
              Open the $DOG Galaxy
              <ArrowRight aria-hidden className="w-4 h-4" />
            </a>
            <div className="flex items-center gap-4 font-mono text-[10px] tracking-[0.22em]">
              <span className="text-dusty">FOR ANALYSIS</span>
              <a href={FLOW_HREF} className="text-lava hover:text-lava-light transition-colors">FLOW ↗</a>
              <span aria-hidden className="text-dusty">/</span>
              <a href={GRAPH_HREF} className="text-lava hover:text-lava-light transition-colors">GRAPH ↗</a>
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.32} y={10} className="mt-5">
          <p className="font-mono text-[10px] text-dusty leading-relaxed">
            Bitcoin L1 genealogy, snapshot {GALAXY.snapshot}. The tree grows with every block and the
            galaxy always reads the live one. Runs in the browser, phone included.
          </p>
        </Reveal>
      </div>
    </section>
  )
}
