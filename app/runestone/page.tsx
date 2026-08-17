"use client"

// /runestone: the dossier behind the stone on the airdrop page.
//
// Everything here is derived from our own infrastructure: the collection is
// enumerated from the parent inscription's on chain children, and the current
// owner of every stone comes from our bitcoind UTXO set. No marketplace API is
// in the path.

import { useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowLeft, Database } from "lucide-react"
import { Layout } from "@/components/layout"
import {
  CAT, HeroFigure, Plate, PlateHead, PlotGrid, STATUS, SectionHead, StatTile,
} from "@/app/analytics/dashboard/ui"
import { Built, Cross, Custody, Dormancy, Fact, Leaderboard, Provenance, n0, pct } from "./sections"
import { City, Divergence, Sealed, TwoClocks } from "./crosses"
import type { Dossier, HolderRow } from "./types"

const LIMIT = 25

export default function RunestonePage() {
  const [d, setD] = useState<Dossier | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const [rows, setRows] = useState<HolderRow[]>([])
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(0)
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState("")
  const [cohort, setCohort] = useState("")
  const [loadingRows, setLoadingRows] = useState(true)

  useEffect(() => {
    fetch("/api/runestone/dossier")
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`dossier ${r.status}`)))
      .then(setD)
      .catch(e => setErr(String(e)))
  }, [])

  // uma resposta lenta de uma busca antiga nao pode sobrescrever a atual
  const reqId = useRef(0)
  const loadRows = useCallback(() => {
    const mine = ++reqId.current
    setLoadingRows(true)
    const p = new URLSearchParams({ page: String(page), limit: String(LIMIT) })
    if (query) p.set("address", query)
    if (cohort) p.set("cohort", cohort)
    fetch(`/api/runestone/holders?${p}`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`holders ${r.status}`)))
      .then(j => {
        if (mine !== reqId.current) return
        setRows(j.holders ?? []); setTotal(j.total ?? 0); setPages(j.pages ?? 0)
      })
      .catch(() => {
        if (mine !== reqId.current) return
        setRows([]); setTotal(0); setPages(0)
      })
      .finally(() => { if (mine === reqId.current) setLoadingRows(false) })
  }, [page, query, cohort])

  useEffect(() => { loadRows() }, [loadRows])

  const parsed = d ? new Date(d.generated_at) : null
  const generated = parsed && !Number.isNaN(parsed.getTime()) ? parsed : null

  return (
    <Layout currentPage="airdrop" setCurrentPage={() => {}}>
      <div className="px-3 md:px-6 py-4 md:py-8 space-y-12 md:space-y-20 max-w-[1400px] mx-auto">

        {/* ── masthead ── */}
        <header className="space-y-6">
          <Link
            href="/airdrop"
            className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em]
              text-dusty hover:text-lava transition-colors"
          >
            <ArrowLeft className="w-3 h-3" />
            back to airdrop analysis
          </Link>

          <div className="flex items-start gap-4 md:gap-6">
            <div className="relative shrink-0">
              <div className="absolute inset-0 bg-lava/20 blur-2xl" />
              <Image src="/Runestone.png" alt="The Runestone" width={72} height={72}
                className="relative w-14 h-14 md:w-[72px] md:h-[72px] object-contain" priority />
            </div>
            <div className="min-w-0">
              <div className="font-mono text-[10px] tracking-[0.3em] text-lava uppercase">
                ᚠ Ordinal collection · Bitcoin mainnet ᚠ
              </div>
              <h1 className="font-display font-bold text-3xl md:text-5xl text-snow mt-2 leading-none">
                The Runestone
              </h1>
              <p className="text-[13px] md:text-[15px] text-mist mt-3 max-w-2xl leading-relaxed">
                112,384 stones were handed to the people who were already here, then the parent was sent to
                the genesis address, where nobody can spend it to sign a new one in. This is what happened
                to them since.
              </p>
            </div>
          </div>

          {d && (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[10px] text-dusty">
              <span className="inline-flex items-center gap-1.5">
                <Database className="w-3 h-3 text-lava/60" />
                enumerated from the parent inscription, custody resolved on our own node
              </span>
              <span>block {n0(d.tip_height)}</span>
              {generated && <span>built {generated.toISOString().slice(0, 16).replace("T", " ")} UTC</span>}
            </div>
          )}
        </header>

        {err && (
          <div className="border p-5 bg-white/[0.02]" style={{ borderColor: `${STATUS.poor}66` }}>
            <PlateHead>Dossier unavailable</PlateHead>
            <p className="font-mono text-[12px] text-mist">{err}</p>
          </div>
        )}

        {!d && !err && (
          <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/25 py-20 text-center">
            reading the collection
          </div>
        )}

        {d && (
          <>
            {/* ── hero ── */}
            <section className="space-y-4">
              <HeroFigure
                label="Stones in existence"
                value={d.collection.supply}
                format={n0}
                sub={d.run
                  ? `${n0(d.run.stones)} inscribed in ${d.run.blocks} blocks over ${d.run.hours} hours, plus the model they all point at, inscribed ${d.run.model_lead_days} days earlier`
                  : `inscribed across ${d.collection.blocks_used} blocks in March 2024`}
                badge={
                  <span className="font-mono text-[9px] uppercase tracking-[0.16em] px-2 py-0.5 border border-lava/50 text-lava">
                    supply sealed
                  </span>
                }
              />
              <PlotGrid className="grid-cols-2 lg:grid-cols-4">
                <StatTile label="Addresses holding" value={d.custody.holders} format={n0}
                  sub={`median holder owns ${d.custody.median}`} />
                <StatTile label="Never moved once" value={d.dormancy.never_moved} format={n0} accent={CAT[1]}
                  sub={`${pct(d.dormancy.never_moved_pct)} sit where they were inscribed`} />
                <StatTile label="Still in veteran hands" value={d.airdrop_cross.stones_veteran} format={n0}
                  sub={`${pct((d.airdrop_cross.stones_veteran / d.custody.stones) * 100)} held by original airdrop wallets`} />
                <StatTile label="In burn addresses" value={d.provenance.burned_stones} format={n0} accent={CAT[2]}
                  sub="addresses nobody has ever produced a key for" />
              </PlotGrid>
            </section>

            <Custody d={d} />
            <Dormancy d={d} />
            <Cross d={d} />
            <Divergence d={d} />
            <Sealed d={d} />
            <TwoClocks d={d} />
            <City d={d} />
            <Provenance d={d} />
            <Built d={d} />

            <Leaderboard
              rows={rows}
              total={total}
              loading={loadingRows}
              page={page}
              pages={pages}
              onPage={setPage}
              query={query}
              onQuery={(q) => { setPage(1); setQuery(q) }}
              cohort={cohort}
              onCohort={(c) => { setPage(1); setCohort(c) }}
            />

            {/* ── method ── */}
            <section className="space-y-6">
              <SectionHead
                eyebrow="HOW THIS WAS BUILT"
                title="Method, and where it can be wrong"
                sub="Every number on this page is reproducible from public data. Here is exactly how, including the parts that carry a caveat."
              />
              <div className="grid lg:grid-cols-2 gap-4">
                <Plate>
                  <PlateHead>The chain of evidence</PlateHead>
                  <Fact k="Collection" v={`${n0(d.collection.supply)} children`} sub="read from the parent inscription's on chain child index" />
                  <Fact k="Current owner" v="our own bitcoind" sub="each stone's output resolved against the live UTXO set" />
                  <Fact k="Last movement" v="block height per stone" sub="derived from the confirmation depth of that output" />
                  {d.verification && (
                    <>
                      <Fact
                        k="Independent sample"
                        v={`${d.verification.independent_sample.matched} of ${d.verification.independent_sample.n} matched`}
                        sub={`random stones re-checked at build time against ${d.verification.independent_sample.source}`}
                      />
                      <Fact
                        k="Unspent check"
                        v={`${n0(d.verification.outputs_unspent)} of ${n0(d.verification.unique_outputs)}`}
                        sub={d.verification.outputs_spent
                          ? `outputs still unspent at build time. ${d.verification.outputs_spent} had already been spent again, which is the collection moving while we built`
                          : "every current output was still unspent at build time"}
                      />
                    </>
                  )}
                </Plate>
                <Plate>
                  <PlateHead swatch={CAT[2]}>Caveats worth reading</PlateHead>
                  <p className="text-[12px] text-mist leading-relaxed mb-4">
                    A holder here is an address, not a person. One person can hold many addresses, and a
                    custodial address can hold stones for thousands of people. The concentration figures are
                    upper bounds on real concentration, never lower bounds.
                  </p>
                  <p className="text-[12px] text-mist leading-relaxed mb-4">
                    The April 2024 column counts DOG airdrop payments received, which is our proxy for stones
                    held at that snapshot. It totals {n0(d.airdrop_cross.cohort_stones)} against the
                    collection's {n0(d.collection.supply)}, so it runs about
                    {" "}{Math.abs(d.airdrop_cross.cohort_stones - d.collection.supply)} payments long across
                    the whole cohort. We have not measured how that error distributes per wallet, so read the
                    April 2024 column as close but not exact.
                  </p>
                  <p className="text-[12px] text-mist leading-relaxed mb-4">
                    Dormancy measures the age of a stone's current output. A wallet that consolidated its
                    outputs without selling would read as a move here, so dormancy is a floor on true holding
                    time, not a ceiling.
                  </p>
                  <p className="text-[12px] text-mist leading-relaxed">
                    {n0(d.verification?.stones_without_height ?? 2)} stones sit in outputs we could not resolve
                    to a block height, so every dormancy figure here is computed over
                    {" "}{n0(d.collection.supply - (d.verification?.stones_without_height ?? 2))} stones rather than
                    {" "}{n0(d.collection.supply)}. Custody is unaffected: all {n0(d.collection.supply)} resolve
                    to a current owner.
                  </p>
                </Plate>
              </div>
              <p className="font-mono text-[10px] text-dusty/40 tracking-[0.2em] text-center pt-4">
                ᚠ only those who know, know ᚠ
              </p>
            </section>
          </>
        )}
      </div>
    </Layout>
  )
}
