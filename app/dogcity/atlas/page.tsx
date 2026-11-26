// /dogcity/atlas: o livro de mapas da cidade, por capitulos (pranchas e folhas de cadastro vem de atlas-data.ts).
// Arquivos em public/city/atlas/ (WebP 1200 e 2400, PDF, atlas.json). Os SVG NAO
// sobem (39 MB). O atlas.json (2 MB, lot_sheet) so e buscado quando a pessoa usa a busca.
// O capitulo ON-CHAIN e um ESPECIME de pre-lancamento: o mint nao aconteceu, nada la esta inscrito.
"use client"

import { useEffect, useRef, useState } from "react"
import { CityLayout } from "../city-layout"
import { ATLAS_PLATES, ATLAS_SHEETS, ATLAS_PDF_MB, ATLAS_LOTS } from "./atlas-data"
import { DISTRITOS, distritoDoSlug, folhasDoDistrito, setorDaFolha, type Distrito } from "./atlas-distritos"

const HAIR = "border-white/10"
const BASE = "/city/atlas/"
const PDF = BASE + "dogcity-atlas.pdf"
const NF = ATLAS_SHEETS.length
const NP = ATLAS_PLATES.length
const SECTOR_NAME: Record<string, string> = { "07": "The Spit", "08": "Satoshi Plaza", "09": "Bay Shore" }
const CHAPTER_NOTE: Record<string, string> = {
  "FRONT MATTER": "Title page, contents, introduction, how to read the atlas and the legend.",
  "THE CITY": "The whole city on one plate.",
  "THE GROUND": "Relief, water, and green and public land.",
  "THE FABRIC": "Tiers, streets and places.",
  "THE REGISTRY": "Every lot, placed by sector, ring and block.",
  "THE CEMETERY": "The headstones of the city.",
  "ON-CHAIN": "A pre-release specimen: the City Charter that will parent every lot, and one lot deed. The mint has not happened and nothing here is inscribed.",
  REFERENCE: "Indexes by sector, ring, block and place, and the colophon.",
}

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

function PlateCard({ p }: { p: (typeof ATLAS_PLATES)[number] }) {
  return (
    <li className="m-0">
      <a href={`${BASE}${p.file}_2400.webp`} target="_blank" rel="noopener noreferrer" className={`group block border ${HAIR} bg-white/[0.02] hover:border-lava/60`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`${BASE}${p.file}_1200.webp`} alt={`Plate ${p.num}: ${p.title}`} loading="lazy" decoding="async" className="w-full h-auto" />
        <div className={`border-t ${HAIR} px-3 py-2`}>
          <div className="font-mono text-[10px] tracking-[0.2em] text-lava">PLATE {p.num}</div>
          <div className="text-[12px] text-snow mt-0.5">{p.title}</div>
        </div>
      </a>
    </li>
  )
}

// as folhas de cadastro: uma lista compacta por setor, em vez de uma grade de miniaturas
function SheetList({ district }: { district: Distrito | null }) {
  const sheets = ATLAS_PLATES.filter((p) => ATLAS_SHEETS.includes(p.num) && (!district || setorDaFolha(p.title) === district.sector))
  const bySector = new Map<string, typeof sheets>()
  for (const p of sheets) {
    const sec = /S(\d\d)/.exec(p.title)?.[1] ?? "00"
    bySector.set(sec, [...(bySector.get(sec) ?? []), p])
  }
  return (
    <div className={`mt-6 border ${HAIR} bg-white/[0.02] p-5 md:p-6`}>
      <div className="font-mono text-[10px] md:text-[11px] tracking-[0.3em] text-lava">{district ? `${sheets.length} OF ${NF} REGISTRY SHEETS` : `${NF} REGISTRY SHEETS`}</div>
      <ul className="mt-4 grid gap-y-3 list-none p-0">
        {[...bySector].map(([sec, list]) => (
          <li key={sec} className="m-0 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span className="font-mono text-[12px] text-snow w-44">S{sec}{SECTOR_NAME[sec] ? ` · ${SECTOR_NAME[sec]}` : ""}</span>
            <span className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-[12px]">
              {list.map((p) => (
                <a key={p.num} href={`${BASE}${p.file}_2400.webp`} target="_blank" rel="noopener noreferrer" className="text-lava hover:text-lava-light underline underline-offset-4">
                  {p.num}
                </a>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}


// o filtro por distrito: nove chips + All, estado em ?district=timberline (link direto). Fileira de arrastar no toque,
// quebra de linha no mouse (a roda do mouse não rola a fileira escondida); lê a URL no cliente, sem Suspense.
const CHIP_ROW =
  "mt-4 flex flex-nowrap gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden pb-0.5 " +
  "[@media(hover:hover)_and_(pointer:fine)]:flex-wrap [@media(hover:hover)_and_(pointer:fine)]:overflow-visible [@media(hover:hover)_and_(pointer:fine)]:pb-0"

function DistrictFilter({ district, onPick }: { district: Distrito | null; onPick: (d: Distrito | null) => void }) {
  const chip = (on: boolean) =>
    `shrink-0 whitespace-nowrap font-mono text-[11px] tracking-[0.08em] px-3.5 py-2 border transition-colors ${
      on ? "border-lava bg-lava text-void" : `${HAIR} text-mist hover:text-snow hover:border-white/30`
    }`
  const sheets = district ? folhasDoDistrito(ATLAS_PLATES, ATLAS_SHEETS, district) : []
  return (
    <div className={`border ${HAIR} bg-white/[0.02] p-5 md:p-6`}>
      <div className="font-mono text-[10px] md:text-[11px] tracking-[0.3em] text-lava">FILTER BY DISTRICT</div>
      <div className={CHIP_ROW} role="group" aria-label="District">
        <button type="button" onClick={() => onPick(null)} aria-pressed={!district} className={chip(!district)}>All</button>
        {DISTRITOS.map((d) => (
          <button key={d.slug} type="button" onClick={() => onPick(d)} aria-pressed={district?.slug === d.slug} className={chip(district?.slug === d.slug)}>
            {d.name}
          </button>
        ))}
      </div>
      <div aria-live="polite" className="mt-4 font-mono text-[12px] leading-relaxed text-mist">
        {district && (
          <>
            <div className="text-snow">
              {district.name} · registry sheets{" "}
              {sheets.map((n, i) => (
                <span key={n}>
                  {i > 0 && ", "}
                  <a href={`${BASE}${ATLAS_PLATES.find((p) => p.num === n)?.file}_2400.webp`} target="_blank" rel="noopener noreferrer" className="text-lava hover:text-lava-light underline underline-offset-4">{n}</a>
                </span>
              ))}
            </div>
            <p className="mt-2 max-w-2xl">
              {district.sector === 9
                ? "Some Bay Shore ids belong to lots that sit inland, in the other districts. Their sheets are these. Use Find your sheet to place any lot."
                : district.sector <= 6
                  ? `A few lots inland here carry a Bay Shore (S09) id. They are on the Bay Shore sheets. Use Find your sheet to place any lot.`
                  : "The plates of the whole city stay below."}
            </p>
          </>
        )}
      </div>
    </div>
  )
}

export default function DogCityAtlasPage() {
  const [district, setDistrict] = useState<Distrito | null>(null)
  useEffect(() => {
    setDistrict(distritoDoSlug(new URLSearchParams(window.location.search).get("district")))
  }, [])
  function pick(d: Distrito | null) {
    setDistrict(d)
    const u = new URL(window.location.href)
    if (d) u.searchParams.set("district", d.slug)
    else u.searchParams.delete("district")
    window.history.replaceState(null, "", u.pathname + u.search + u.hash)
  }
  const [cover, ...rest] = ATLAS_PLATES
  const chapters: string[] = []
  for (const p of rest) if (!chapters.includes(p.chapter)) chapters.push(p.chapter)
  return (
    <CityLayout>
      <div className="bg-void text-snow">
        <div className="max-w-6xl mx-auto px-6 md:px-10 pt-10 pb-8 md:pt-16">
          <div className="font-mono text-[10px] md:text-[11px] tracking-[0.3em] text-lava">BLOCK 966,670 · CITY V1</div>
          <h1 className="font-display font-bold text-snow text-[30px] leading-[1.05] md:text-[48px] mt-3">DogCity Atlas</h1>
          <p className="text-[13px] md:text-[15px] text-mist leading-relaxed mt-3 max-w-2xl">
            The city as a book: {NP} plates, from the plan of the whole city down to the sheet that places each of its{" "}
            {ATLAS_LOTS.toLocaleString("en-US")} lots. The ground and the fabric come first, then the registry, the
            cemetery and a pre-release specimen of the on-chain deed. Every plate is drawn from the same registry the
            lookup reads. Open any plate at full size, or take the whole book as one PDF.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href={PDF} className="font-mono text-[11px] tracking-[0.14em] px-5 py-2.5 border border-lava text-lava hover:bg-lava hover:text-void transition-colors">
              DOWNLOAD THE PDF · {ATLAS_PDF_MB} MB
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
          <div className="mt-6 max-w-2xl">
            <DistrictFilter district={district} onPick={pick} />
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-6 md:px-10 pb-20">
          <h2 className="font-display font-bold text-2xl md:text-[32px] text-snow">The plates</h2>
          {chapters.map((ch) => {
            const list = rest.filter((p) => p.chapter === ch)
            const cards = list.filter((p) => !ATLAS_SHEETS.includes(p.num))
            const hasSheets = list.some((p) => ATLAS_SHEETS.includes(p.num))
            return (
              <section key={ch} aria-label={ch} className={`mt-10 border-t ${HAIR} pt-6`}>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="font-mono text-[10px] md:text-[11px] tracking-[0.3em] text-lava">{ch}</div>
                  {ch === "ON-CHAIN" && (
                    <span className="font-mono text-[10px] tracking-[0.2em] text-lava border border-lava px-2 py-0.5">SPECIMEN · PRE-RELEASE</span>
                  )}
                </div>
                {CHAPTER_NOTE[ch] && <p className="text-[13px] md:text-[14px] text-mist mt-2 max-w-2xl leading-relaxed">{CHAPTER_NOTE[ch]}</p>}
                <ul className="mt-5 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 list-none p-0">
                  {cards.map((p) => <PlateCard key={p.file} p={p} />)}
                </ul>
                {hasSheets && <SheetList district={district} />}
              </section>
            )
          })}
        </div>
      </div>
    </CityLayout>
  )
}
