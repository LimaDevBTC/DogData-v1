// /dogcity/atlas: o livro de mapas da cidade (46 pranchas, 27 folhas de cadastro).
// Arquivos em public/city/atlas/ (WebP 1200 e 2400, PDF, atlas.json). Os SVG NAO
// sobem (39 MB). O atlas.json (2 MB, lot_sheet) so e buscado quando a pessoa usa a busca.
"use client"

import { useRef, useState } from "react"
import { Layout } from "@/components/layout"
import { ATLAS_PLATES, ATLAS_SHEETS } from "./atlas-data"

const HAIR = "border-white/10"
const BASE = "/city/atlas/"
const PDF = BASE + "dogcity-atlas.pdf"

type Found = { lot: string; sheet: string; file: string } | { lot: string; missing: true }

function FindSheet() {
  const [q, setQ] = useState("")
  const [busy, setBusy] = useState(false)
  const [res, setRes] = useState<Found | null>(null)
  const [err, setErr] = useState("")
  const cache = useRef<Record<string, number> | null>(null)

  async function go(e: React.FormEvent) {
    e.preventDefault()
    const lot = q.trim().toUpperCase()
    if (!lot) return
    setBusy(true); setErr(""); setRes(null)
    try {
      if (!cache.current) {
        const r = await fetch(BASE + "atlas.json")
        if (!r.ok) throw new Error("fetch")
        cache.current = (await r.json()).lot_sheet
      }
      const i = cache.current![lot]
      if (i === undefined) setRes({ lot, missing: true })
      else {
        const sheet = ATLAS_SHEETS[i]
        const file = ATLAS_PLATES.find((p) => p.num === sheet)?.file ?? ""
        setRes({ lot, sheet, file })
      }
    } catch {
      setErr("Could not load the index. Try again in a moment.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`border ${HAIR} bg-white/[0.02] p-5 md:p-6 max-w-2xl`}>
      <div className="font-mono text-[10px] md:text-[11px] tracking-[0.3em] text-lava">FIND YOUR SHEET</div>
      <p className="text-[13px] md:text-[14px] text-mist mt-2 leading-relaxed">
        Enter a lot id, for example S01-Q00-B0001-L001, to see which registry sheet places it.
      </p>
      <form onSubmit={go} className="mt-4 flex flex-col sm:flex-row gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="S01-Q00-B0001-L001"
          aria-label="Lot id"
          autoCapitalize="characters"
          spellCheck={false}
          className="flex-1 min-w-0 bg-void border border-white/15 px-3 py-2.5 font-mono text-[13px] text-snow placeholder:text-dusty focus:outline-none focus:border-lava"
        />
        <button
          type="submit"
          disabled={busy}
          className="font-mono text-[11px] tracking-[0.14em] px-5 py-2.5 border border-lava text-lava hover:bg-lava hover:text-void transition-colors disabled:opacity-50"
        >
          {busy ? "LOADING..." : "FIND SHEET"}
        </button>
      </form>
      <div aria-live="polite" className="mt-4 font-mono text-[12px] leading-relaxed">
        {err && <div className="text-mist">{err}</div>}
        {res && "missing" in res && <div className="text-mist">No lot with id {res.lot} in this edition.</div>}
        {res && "sheet" in res && (
          <div className="text-snow">
            {res.lot} is on registry sheet <span className="text-lava">{res.sheet}</span>.{" "}
            <a href={`${BASE}${res.file}_2400.webp`} target="_blank" rel="noopener noreferrer" className="text-lava hover:text-lava-light underline underline-offset-4">
              Open the sheet
            </a>
          </div>
        )}
      </div>
    </div>
  )
}

export default function DogCityAtlasPage() {
  const [cover, ...rest] = ATLAS_PLATES
  return (
    <Layout currentPage="donate" setCurrentPage={() => {}}>
      <div className="bg-void text-snow">
        <div className="max-w-6xl mx-auto px-6 md:px-10 pt-10 pb-8 md:pt-16">
          <div className="font-mono text-[10px] md:text-[11px] tracking-[0.3em] text-lava">BLOCK 966,670 · CITY V3</div>
          <h1 className="font-display font-bold text-snow text-[30px] leading-[1.05] md:text-[48px] mt-3">DogCity Atlas</h1>
          <p className="text-[13px] md:text-[15px] text-mist leading-relaxed mt-3 max-w-2xl">
            The atlas is the city as a book: 46 plates in a fixed order, from the city plan, relief, tiers, streets and
            water to the landmarks, then 27 registry sheets that place all 70,714 lots by sector, ring and block.
            Every plate is drawn from the same registry the lookup reads. Open any plate at full size, or take the whole
            book as one PDF.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href={PDF} className="font-mono text-[11px] tracking-[0.14em] px-5 py-2.5 border border-lava text-lava hover:bg-lava hover:text-void transition-colors">
              DOWNLOAD THE PDF · 28 MB
            </a>
            <a href="/dogcity/docs" className={`font-mono text-[11px] tracking-[0.14em] px-5 py-2.5 border ${HAIR} text-mist hover:text-snow`}>
              READ THE DOCS
            </a>
          </div>
          <a href={`${BASE}${cover.file}_2400.webp`} target="_blank" rel="noopener noreferrer" className={`mt-8 block max-w-sm border ${HAIR}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${BASE}${cover.file}_1200.webp`} alt="Cover of the DogCity Atlas" className="w-full h-auto" />
          </a>
        </div>

        <div className="max-w-6xl mx-auto px-6 md:px-10 pb-10">
          <FindSheet />
        </div>

        <div className="max-w-6xl mx-auto px-6 md:px-10 pb-20">
          <h2 className="font-display font-bold text-2xl md:text-[32px] text-snow">The plates</h2>
          <ul className="mt-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 list-none p-0">
            {rest.map((p) => (
              <li key={p.file} className="m-0">
                <a href={`${BASE}${p.file}_2400.webp`} target="_blank" rel="noopener noreferrer" className={`group block border ${HAIR} bg-white/[0.02] hover:border-lava/60`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`${BASE}${p.file}_1200.webp`} alt={`Plate ${p.num}: ${p.title}`} loading="lazy" decoding="async" className="w-full h-auto" />
                  <div className={`border-t ${HAIR} px-3 py-2`}>
                    <div className="font-mono text-[10px] tracking-[0.2em] text-lava">PLATE {p.num}</div>
                    <div className="text-[12px] text-snow mt-0.5">{p.title}</div>
                  </div>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Layout>
  )
}
