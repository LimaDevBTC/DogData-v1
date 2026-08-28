"use client"

// ═══════════════════════════════════════════════════════════════════════════
// SATOSHI PLAZA · OPEN NOW — the folio's news sheet.
//
// WHY IT SITS HERE, right under the hero.
// The hero spends 500vh building the city out of nothing. Since 2026-08-18 the
// centre of that city is not a promise: Satoshi Plaza is open at /city, on the
// real Mare Tranquillitatis terrain, and the DOG mempool is alive above it
// (praca-central.md). The page has to say so before it asks for anything, so
// this sheet comes first: the plates of the live plaza, the mission board
// reading the same feed the plaza reads, and the door.
//
// WHAT IS LIVE.
// The board polls /api/mempool/dog every 20 s: how many DOG transactions are
// in orbit (pending), how much DOG they carry, the last landing (block, ships,
// amount, minutes ago) and the whole mempool. Every number is what our node
// sees now; nothing is invented and nothing is cached beyond a few seconds.
// If the feed goes quiet for two minutes the label says SYNCING, not LIVE.
//
// THE PLATES are stills of the live scene itself (public/landing/plaza/*),
// captured from /city with the HUD off (?plate=1), not renders: what you see
// on the sheet is what opens when you press the button.
//
// Tailwind note: this project's opacity scale is the stock one (multiples of 5);
// odd opacities do NOT compile and fall through to preflight's #D1D5DB. Hence
// HAIR / HAIR_SOFT / GRIDLINE from ../motion.
// ═══════════════════════════════════════════════════════════════════════════

import Image from "next/image"
import { ArrowRight } from "lucide-react"
import {
  EASE_CSS, HAIR, HAIR_SOFT, GRIDLINE,
  Counter, Reveal, Stagger, StaggerItem, DrawRule,
  useMagnetic,
} from "../motion"
// ⚠️ A CÓPIA LOCAL DO useMempoolFeed MORREU AQUI (27/08). Ela vivia colada
// logo abaixo destes imports e NÃO importava do módulo, então a landing rodava
// DUAS enquetes de 20 s no mesmo endpoint sem ninguém ter notado. Com a hero
// nova seriam três. ../use-mempool agora é um singleton de módulo: um timer só
// para a página inteira, e quem monta depois recebe o snapshot corrente na hora.
import { useMempoolFeed, minutesAgo, MEMPOOL_STALE_S } from "../use-mempool"
import { formatDog } from "../dogcity-data"

// ── the plates: stills of the live scene ───────────────────────────────────
// ⚠️ A CHAPA GRANDE (plaza-home a 16:9) SAIU DAQUI em 27/08. Ela é agora a
// janela da porta 01 da hero, e repetir a mesma imagem duas vezes na mesma
// página é o amontoado que a reforma existe para matar. A prateleira de cinco
// assume o lugar dela.
//
// Duas entradas são novas: THE DIAMOND PAW e THE HIDDEN TEMPLE. Elas vinham da
// grade de quatro chapas da hero, onde apontavam para /city com um rótulo mono
// de 8px e nenhum verbo. São LUGARES dentro de um produto, não produtos, e o
// lugar delas é esta prateleira. Nada sumiu do site.
const PLATES = [
  {
    src: "/landing/plaza/plaza-dsc.webp",
    alt: "The Dog Social Club gallery beside Kray Tower: the whole collection hung on a curved black wall under the club shield",
    label: "DOG SOCIAL CLUB · ALL OF IT",
  },
  {
    src: "/landing/plaza/plaza-leonidas.webp",
    alt: "The Leonidas statue: a yellow skull under a black hood, cape falling to the plinth, the bitcoin mark on his chest",
    label: "LEONIDAS · FOUNDER OF DOG",
  },
  {
    src: "/landing/plaza/plaza-chalet.webp",
    alt: "The OrdCards Chalet: two colossal official OrdCards leaning together in an A over a glass podium, with the Needle and Kray Tower behind",
    label: "THE ORDCARDS CHALET",
  },
  {
    src: "/landing/plaza/plaza-paw.webp",
    alt: "$DOG written in a mirror pool thirty metres across, at the centre of a paw of dark water",
    label: "THE DIAMOND PAW",
  },
  {
    src: "/landing/plaza/plaza-temple.webp",
    alt: "The mouth of the Leonidas cave glowing among the monarch runestones",
    label: "THE HIDDEN TEMPLE",
  },
] as const

const PRIMARY_LABEL = "Enter Satoshi Plaza"

export default function Section() {
  const { feed, now } = useMempoolFeed()
  const s = feed?.snapshot ?? null
  const stale = !s || (feed?.stale_seconds ?? Infinity) > MEMPOOL_STALE_S
  const primary = useMagnetic<HTMLAnchorElement>()

  return (
    <section id="plaza" className={`border-t ${HAIR_SOFT}`}>
      <div className="max-w-6xl mx-auto px-6 md:px-10 py-16 md:py-24">

        {/* ⚠️ ESTA FOLHA FOI REBAIXADA em 27/08, e a demoção é de PROPÓSITO.
            Com a porta 01 da hero abrindo a página, a sobrancelha "SATOSHI
            PLAZA · OPEN NOW", o <h2> e os dois parágrafos daqui repetiam, 400px
            depois, o mesmo assunto com quase as mesmas palavras (Needle, Kray,
            BitFlow, o parque, a taxa virando altitude, o bloco virando pouso).
            A seção não morre: ela muda de função, de segundo pitch da cidade
            para PRATELEIRA DE LUGARES mais quadro de missão, que é o que ela
            tem de único. Daí a sobrancelha nova. */}
        <div className="max-w-2xl">
          <div className="flex items-center gap-3">
            <span className="font-mono text-[11px] tracking-[0.3em] text-lava">INSIDE THE CITY</span>
            <span className="inline-flex items-center gap-1.5 font-mono text-[9px] tracking-[0.25em] text-dusty">
              <span
                aria-hidden
                className={`inline-block w-1.5 h-1.5 rounded-full ${stale ? "bg-dusty" : "bg-emerald-400 animate-pulse"}`}
              />
              {stale ? "SYNCING" : "LIVE"}
            </span>
          </div>
          <DrawRule className="mt-3 w-14" delay={0.06} duration={0.9} />
        </div>

        <div className="mt-8 md:mt-10 grid lg:grid-cols-[minmax(0,1fr)_320px] gap-6 lg:gap-8 items-start">

          {/* ── a prateleira de lugares ────────────────────────────────────── */}
          <div>
            <Stagger step={0.08} delay={0.2} className="grid grid-cols-3 lg:grid-cols-5 gap-3">
              {PLATES.map((p) => (
                <StaggerItem key={p.src}>
                  <div className={`relative aspect-[16/10] border ${HAIR} overflow-hidden bg-void`}>
                    <Image src={p.src} alt={p.alt} fill sizes="(min-width: 1024px) 160px, 33vw" className="object-cover" />
                    <span className="absolute left-2 bottom-2 hidden sm:block font-mono text-[9px] tracking-[0.18em] text-snow/80 [text-shadow:0_1px_4px_rgba(0,0,0,0.9)]">
                      {p.label}
                    </span>
                  </div>
                </StaggerItem>
              ))}
            </Stagger>
          </div>

          {/* ── the mission board, and the door ─────────────────────────────── */}
          <div>
            <div className={`border ${HAIR} font-mono`}>
              <div className={`flex items-center justify-between px-4 py-2 border-b ${HAIR} text-[9px] tracking-[0.25em] text-dusty`}>
                {/* ⚠️ MESMA REGRA DA PRAÇA (fundador, 28/08): a ficção é da
                    cena, o dado é dito no nome do mercado. "MISSION BOARD" e
                    "IN ORBIT" não diziam a ninguém que isto é a mempool. */}
                <span>DOG MEMPOOL · LIVE</span>
                <span>{s?.tip_height ? `BLOCK ${s.tip_height.toLocaleString()}` : "—"}</span>
              </div>
              <Stagger as="dl" step={0.09} delay={0.3} className={`grid grid-cols-2 lg:grid-cols-1 gap-px ${GRIDLINE}`}>
                <StaggerItem className="bg-void p-4">
                  <dt className="text-[9px] tracking-[0.25em] text-dusty">UNCONFIRMED DOG</dt>
                  <dd className="text-[12px] text-snow mt-1 leading-snug">
                    {s && s.dog_pending === 0 ? (
                      <>
                        none right now
                        <span className="block text-dusty">no DOG transaction waiting in the mempool</span>
                      </>
                    ) : (
                      <>
                        <Counter value={s ? s.dog_pending : null} className="text-lava" /> {s?.dog_pending === 1 ? "tx" : "txs"} ·{" "}
                        <Counter value={s ? s.dog_pending_amount : null} format={formatDog} className="text-lava" /> DOG
                      </>
                    )}
                  </dd>
                </StaggerItem>
                <StaggerItem className="bg-void p-4">
                  <dt className="text-[9px] tracking-[0.25em] text-dusty">LAST DOG CONFIRMED</dt>
                  <dd className="text-[12px] text-snow mt-1 leading-snug">
                    {s?.last_dog_block ? (
                      <>
                        block {s.last_dog_block.toLocaleString()} · {s.last_dog_block_count ?? 0} {(s.last_dog_block_count ?? 0) === 1 ? "tx" : "txs"}
                        <span className="block text-dusty">
                          {formatDog(s.last_dog_block_amount ?? 0)} DOG · {minutesAgo(s.last_dog_block_time, now)}
                        </span>
                      </>
                    ) : "—"}
                  </dd>
                </StaggerItem>
                <StaggerItem className="bg-void p-4">
                  <dt className="text-[9px] tracking-[0.25em] text-dusty">FEE RATE · SAT/VB</dt>
                  <dd className="text-[12px] text-snow mt-1 leading-snug">
                    {s?.fee_fast != null ? `${s.fee_fast} high · ${s.fee_slow ?? "—"} low` : "—"}
                  </dd>
                </StaggerItem>
                <StaggerItem className="bg-void p-4">
                  <dt className="text-[9px] tracking-[0.25em] text-dusty">BITCOIN MEMPOOL</dt>
                  <dd className="text-[12px] text-snow mt-1 leading-snug">
                    <Counter value={s ? s.tx_count : null} /> txs pending
                  </dd>
                </StaggerItem>
              </Stagger>
            </div>

            <Reveal delay={0.7} y={12} className="mt-5">
              <a
                href="/city"
                ref={primary.ref}
                onPointerMove={primary.onPointerMove}
                onPointerLeave={primary.onPointerLeave}
                className="inline-flex w-full sm:w-auto items-center justify-center gap-2 px-6 py-3.5 font-mono text-sm font-bold text-void bg-lava hover:bg-lava-light"
                style={{ ...primary.style, transition: `transform 0.45s ${EASE_CSS}, background-color 0.25s ease` }}
              >
                {PRIMARY_LABEL}
                <ArrowRight aria-hidden className="w-4 h-4" />
              </a>
            </Reveal>

            <Reveal delay={0.82} y={10} className="mt-4">
              <a href="/city?view=park" className="font-mono text-[10px] tracking-[0.22em] text-lava hover:text-lava-light transition-colors">
                FLY TO THE PARK ↗
              </a>
            </Reveal>

            <Reveal delay={0.95} y={10} className="mt-5">
              <p className="font-mono text-[10px] text-dusty leading-relaxed">
                Preview: the plaza, its ring and garden, the spaceport and the park are open.
                Districts open by phase as the city is built. Runs in the browser, phone included.
              </p>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  )
}
