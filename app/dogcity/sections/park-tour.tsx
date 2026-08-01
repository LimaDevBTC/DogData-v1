"use client"

// ═══════════════════════════════════════════════════════════════════════════
// PARK TOUR — "The Long Walk In". A 150-frame scroll-scrubbed camera journey
// through Runestone National Park: road/rille → the Gate detonation → the Vale
// → Valley of Hands → The Last Step look-up → the Longshadow skyline. One
// unbroken dolly rendered from runestone-park-v2.blend (render_tour_v2.py).
// Scrubbing is delegated to FrameScrub (a deliberate port of the hero's
// mechanics); this file owns the waypoints, chrome and reduced-motion path.
// ═══════════════════════════════════════════════════════════════════════════

import { useState } from "react"
import Image from "next/image"
import FrameScrub from "../frame-scrub"

const FRAME_COUNT = 214
const PARKSEQ_VERSION = "2"
const frameUrl = (i: number) => `/landing/parkseq/f_${String(i + 1).padStart(4, "0")}.webp?v=${PARKSEQ_VERSION}`

// waypoint breaks mapped to the render's beat frames (frame index / 213)
const BREAKS = [0, 0.094, 0.239, 0.272, 0.376, 0.437, 0.587, 0.709, 0.878]
const WAYPOINTS = [
  { id: "road", title: "THE APPROACH", caption: "The road arrives buried in a rille — the park shows you nothing until it means to." },
  { id: "gate", title: "THE GATE", caption: "The road crests the notch and the range detonates into view." },
  { id: "plaza", title: "LONGSHADOW PLAZA", caption: "Wheels end here. Everything beyond is on foot." },
  { id: "vale", title: "VALE OF THE MARK", caption: "A valley that ends at a stone — glyph-lit crystals stacked in depth." },
  { id: "hands", title: "VALLEY OF HANDS", caption: "120 stones at your own scale, every one carrying the mark." },
  { id: "laststep", title: "THE LAST STEP", caption: "The walkway's terminus. The Monarch fills forty-nine degrees of sky." },
  { id: "ground", title: "EVERY STONE IS PUBLIC GROUND", caption: "Walk off the deck. Footprints last a million years here — add yours." },
  { id: "unmarked", title: "THE UNMARKED WAY", caption: "An unlit spur leaves the ring on no map, and passes between two leaning giants." },
  { id: "temple", title: "THE LEONIDAS TEMPLE", caption: "Down the notch stair: a raked sea of regolith, a pool of black glass, and eight embers in a bowl of shadow." },
] as const

const STILLS = [
  { src: "/landing/park-hero.webp", title: "THE RANGE", caption: "The whole chain from the south-east, the ring trail curving below.", alt: "The full chain of black-crystal outcrops across the lunar plain" },
  { src: "/landing/park-wide.webp", title: "VALE OF THE MARK", caption: "Three glyph-lit crystals stacked in depth over the valley trail.", alt: "The terminated valley with three rune-marked crystal outcrops" },
  { src: "/landing/park-finger.webp", title: "THE LAST STEP", caption: "The hundred-metre glyph from the walkway's end.", alt: "The white rune mark on the black crystal face of the Great Runestone" },
  { src: "/landing/park-temple.webp", title: "THE LEONIDAS TEMPLE", caption: "At the end of the unmarked way: a raked garden in a bowl of shadow.", alt: "A sunken garden of raked regolith with crystal islands, a black-glass pool and stone lanterns, seen from the temple podium" },
] as const

function waypointAt(progress: number): number {
  let w = 0
  for (let i = 0; i < BREAKS.length; i++) if (progress >= BREAKS[i]) w = i
  return Math.min(w, WAYPOINTS.length - 1)
}

export default function ParkTour() {
  const [still, setStill] = useState(0)

  const reducedMotion = (
    <section aria-label="Runestone National Park tour" className="relative bg-void">
      <div className="relative w-full aspect-[16/10] max-h-[80vh]">
        <Image src={STILLS[still].src} alt={STILLS[still].alt} fill sizes="100vw" className="object-cover" />
      </div>
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="font-mono text-[11px] tracking-[0.25em] text-lava mb-2">
          RUNESTONE NATIONAL PARK · THE WALK
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
        ariaLabel="Runestone National Park virtual tour"
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
                      RUNESTONE NATIONAL PARK · THE WALK
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
