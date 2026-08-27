"use client"

// ═══════════════════════════════════════════════════════════════════════════
// PARK TOUR — "The Long Walk In". A 214-frame scroll-scrubbed camera journey
// through Runestone Ordinal Park: road/rille → the Gate detonation → the Vale
// → Valley of Hands → The Last Step look-up → the east ring → the flank climb →
// the mouth in the rock → the corridor → the Leonidas Temple inside the cave.
// One unbroken dolly rendered from runestone-park-v2.blend (render_tour_v2.py).
// Scrubbing is delegated to FrameScrub (a deliberate port of the hero's
// mechanics); this file owns the waypoints, chrome and reduced-motion path.
//
// FRAME_COUNT and public/landing/parkseq/ MUST ship together. Raising the count
// before the frames land leaves the scrub holding the last file it can fetch —
// the tail waypoints freeze on one image and read as a broken tour.
// ═══════════════════════════════════════════════════════════════════════════

import { useState } from "react"
import Image from "next/image"
import FrameScrub from "../frame-scrub"

// ── as DUAS constantes que pertencem ao render, nao a esta pagina ───────────
// FRAME_COUNT e BEAT_FRAMES saem de render_tour_v2.py (blender/) e so mudam
// quando o tour e re-renderizado. Quem mexer aqui sem re-renderizar quebra o
// casamento legenda/quadro em silencio: nada estoura, a legenda so passa a
// descrever outra coisa. Se o render mudar, o numero de quadros vem de
// `KEYS[-1][0] + 1` e as batidas vem dos comentarios de bloco (B7..B12) da
// propria tabela KEYS.
const FRAME_COUNT = 214
// v3: os quadros 136 a 214 foram refeitos em 27/08 (o tour deixou o templo
// exposto e passou a terminar dentro da caverna). Sem subir a versao, a CDN e
// o navegador continuam servindo a sequencia velha e o scrub mistura as duas.
const PARKSEQ_VERSION = "3"
const frameUrl = (i: number) => `/landing/parkseq/f_${String(i + 1).padStart(4, "0")}.webp?v=${PARKSEQ_VERSION}`

// Quadro em que cada legenda entra, LIDO na tabela KEYS do render:
//   0 estrada · 20 o Portao · 51 a praca · 58 o Vale · 80 as Maos ·
//   93 o Ultimo Degrau · 125 sair do deck · 137 o anel a leste (az 172) ·
//   161 o banco do flanco leste · 188 a boca abre · 200 a soleira ·
//   209 o salao abre (211 braseiros, 213 o templo).
// Em fracao porque FrameScrub converte progresso em quadro com
// round(progress * (FRAME_COUNT - 1)); dividir aqui pelo mesmo numero mantem
// as batidas certas mesmo se o total de quadros for corrigido depois.
const BEAT_FRAMES = [0, 20, 51, 58, 80, 93, 125, 137, 161, 188, 200, 209]
const BREAKS = BEAT_FRAMES.map((f) => f / (FRAME_COUNT - 1))

// A cauda (do 137 em diante) foi reescrita junto com o render: o templo NAO
// esta mais exposto atras da cordilheira em (1200, 400). Ele esta dentro da
// caverna em (335, 59), a 340 m do Monarca no azimute 80, e o tour termina la.
// Nenhuma legenda pode voltar a prometer o precinto, as Sisters ou a escadaria.
const WAYPOINTS = [
  { id: "road", title: "THE APPROACH", caption: "The road arrives buried in a rille; the park shows you nothing until it means to." },
  { id: "gate", title: "THE GATE", caption: "The road crests the notch and the range detonates into view." },
  { id: "plaza", title: "LONGSHADOW PLAZA", caption: "Wheels end here. Everything beyond is on foot." },
  { id: "vale", title: "VALE OF THE MARK", caption: "A valley that ends at a stone: glyph-lit crystals stacked in depth." },
  { id: "hands", title: "VALLEY OF HANDS", caption: "120 stones at your own scale, every one carrying the mark." },
  { id: "laststep", title: "THE LAST STEP", caption: "The walkway's terminus. The Monarch fills forty-nine degrees of sky." },
  { id: "ground", title: "EVERY STONE IS PUBLIC GROUND", caption: "Walk off the deck. Footprints last a million years here; add yours." },
  { id: "ring", title: "THE EAST RING", caption: "The ring carries on east and climbs a spur at twenty-eight degrees. The Monarch goes dark behind you; everything ahead is lit." },
  { id: "flank", title: "THE EAST FLANK", caption: "The walk leaves the ring for a bench of level ground, 487 metres of it. A crystal bloom stands across the end and hides what comes next." },
  { id: "mouth", title: "THE MOUTH", caption: "Round the bloom and up the ramp: seven metres of mouth under a slab of rock, cairns burning on the lip. Nothing on the ring points here." },
  { id: "corridor", title: "THE CORRIDOR", caption: "Past the threshold the throat turns twice in fifty metres, and the plain goes out behind you." },
  { id: "temple", title: "THE LEONIDAS TEMPLE", caption: "A hall ninety metres across opens in the dark: braziers, a garden of fungus, and the temple standing in the middle of it." },
] as const

// Chapas do caminho de movimento reduzido. Sao as UNICAS quatro que ainda
// existem no mundo novo; a antiga park-temple.webp (o templo ao ar livre) esta
// fora de proposito e nao pode voltar. Falta uma chapa de DENTRO do salao, e
// ate ela existir a lista fica em quatro: melhor uma chapa a menos do que uma
// que promete um lugar que nao existe. Os quadros de parkseq/ nao servem: o
// disco ainda guarda o encode antigo ate o render novo ser publicado.
const STILLS = [
  { src: "/landing/park-hero.webp", title: "THE RANGE", caption: "The whole chain from the south-east, the ring trail curving below.", alt: "The full chain of black-crystal outcrops across the lunar plain" },
  { src: "/landing/park-wide.webp", title: "VALE OF THE MARK", caption: "Three glyph-lit crystals stacked in depth over the valley trail.", alt: "The terminated valley with three rune-marked crystal outcrops" },
  { src: "/landing/park-finger.webp", title: "THE LAST STEP", caption: "The hundred-metre glyph from the walkway's end.", alt: "The white rune mark on the black crystal face of the Great Runestone" },
  { src: "/landing/plaza/plaza-temple.webp", title: "THE LEONIDAS TEMPLE", caption: "Screened by a crystal bloom on the east flank, 340 metres from the Great Runestone. The temple burns inside.", alt: "The arched mouth of the Leonidas cave, boulders screening it, the black temple burning orange inside" },
] as const

function waypointAt(progress: number): number {
  let w = 0
  for (let i = 0; i < BREAKS.length; i++) if (progress >= BREAKS[i]) w = i
  return Math.min(w, WAYPOINTS.length - 1)
}

export default function ParkTour() {
  const [still, setStill] = useState(0)

  const reducedMotion = (
    <section aria-label="Runestone Ordinal Park tour" className="relative bg-void">
      <div className="relative w-full aspect-[16/10] max-h-[80vh]">
        <Image src={STILLS[still].src} alt={STILLS[still].alt} fill sizes="100vw" className="object-cover" />
      </div>
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="font-mono text-[11px] tracking-[0.25em] text-lava mb-2">
          RUNESTONE ORDINAL PARK · THE WALK
        </div>
        <h2 className="font-display font-bold text-2xl text-snow">{STILLS[still].title}</h2>
        <p className="text-sm text-mist mt-2 leading-relaxed">{STILLS[still].caption}</p>
        <div className="flex flex-wrap gap-2 mt-5" role="group" aria-label="Select a view of the park">
          {STILLS.map((s, i) => (
            <button
              key={s.title}
              onClick={() => setStill(i)}
              aria-pressed={i === still}
              className={`px-3 py-1.5 font-mono text-[11px] border transition-colors ${
                i === still
                  ? "border-lava text-lava bg-lava/10"
                  : "border-white/10 text-dusty hover:text-snow hover:border-white/25"
              }`}
            >
              {String(i + 1).padStart(2, "0")} · {s.title}
            </button>
          ))}
        </div>
      </div>
    </section>
  )

  return (
    <>
      <FrameScrub
        frameUrl={frameUrl}
        frameCount={FRAME_COUNT}
        spacerVh={650}
        topBias={0.8}
        focusU={0.5}
        lazy
        concurrency={4}
        poster={{ src: "/landing/park-hero.webp", alt: "" }}
        ariaLabel="Runestone Ordinal Park virtual tour"
        srSummaries={WAYPOINTS.map((w) => `${w.title}: ${w.caption}`)}
        reducedMotion={reducedMotion}
        overlay={({ progress }) => {
          const wp = waypointAt(progress)
          return (
            <>
              {/* top chrome: badge + waypoint indicator, hero grammar */}
              <div className="absolute top-20 inset-x-0">
                <div className="max-w-[1800px] mx-auto px-4 md:px-10">
                  <div className="inline-block">
                    <div className="font-mono text-[10px] tracking-[0.3em] text-snow/70 border border-white/[0.15] bg-void/50 backdrop-blur-sm px-3 py-1.5">
                      RUNESTONE ORDINAL PARK · THE WALK
                    </div>
                    <div className="mt-2 flex items-center gap-3">
                      <div className="h-px w-24 md:w-32 bg-white/[0.15] overflow-hidden">
                        <div className="h-full bg-lava origin-left" style={{ transform: `scaleX(${progress.toFixed(3)})` }} />
                      </div>
                      <div className="font-mono text-[10px] text-snow/80 tabular-nums">
                        {String(wp + 1).padStart(2, "0")} / {String(WAYPOINTS.length).padStart(2, "0")} · {WAYPOINTS[wp].title}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* caption card — bottom-16 clears the 56px mobile CTA bar */}
              <div
                key={wp}
                className="absolute bottom-16 md:bottom-8 left-4 md:left-10 animate-[tourIn_0.5s_ease-out] max-w-[80vw] md:max-w-sm"
              >
                <div className="border border-white/[0.12] bg-void/75 backdrop-blur-sm px-3 py-2">
                  <div className="font-mono text-[10px] tracking-[0.18em] text-snow">{WAYPOINTS[wp].title}</div>
                  <p className="mt-1 text-[11px] text-mist leading-snug">{WAYPOINTS[wp].caption}</p>
                </div>
              </div>
            </>
          )
        }}
      />
      <style jsx global>{`
        @keyframes tourIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  )
}
