"use client"

// ═══════════════════════════════════════════════════════════════════════════
// A FASE PARTNERS NA LANDING (13/11/2026, fundador): a faixa de nomes do herói e a seção #partners.
//
// Liga só quando o estado diz (`cd.partners`: "tease" nos últimos 144 blocos da whitelist, "open" na fase) e some
// sozinha no Public; ninguém publica nada na virada.
//
// ⚠️ NOMES, NUNCA LOGOS. Nenhuma coleção respondeu ao contato: sem autorização, a página diz o fato verificável na
// cadeia ("open to holders of"), na nossa tipografia, sem logo nem arte de terceiros, e com a linha de não afiliação.
// Runestone e os sets do $DOG são da casa e levam o laranja.
//
// O verificador: sha256 do endereço colado, 2 primeiros hex = o pedaço /dc-partners/s/<xx>.json (~30 KB), gerado do
// MESMO corte que o mint carrega (scripts/dogcity/partners-index.mjs, sha256 conferido). Nunca baixa a lista inteira.
// ═══════════════════════════════════════════════════════════════════════════

import { useMemo, useState, type FormEvent } from "react"
import data from "@/public/dc-partners/collections.json"
import { Btn, Frame, SectionHead } from "../landing/ui"
import { MINT_URL, PARTNER_CUT_BLOCK, fmtInt, type CountdownState } from "../landing/mint-state"

type Collection = { slug: string; name: string; wallets: number }
const COLLECTIONS: Collection[] = data.collections
/** as coleções da casa: Runestone e os quatro sets oficiais do $DOG */
const HOUSE = new Set(["runestone", "dog-szn1-genesis", "dog-szn2-block9", "dog-szn2-trump", "dog-szn2-legendaries"])

// ═══ a faixa de nomes do herói ═════════════════════════════════════════════
export function PartnersTicker() {
  const names = COLLECTIONS.map((c) => c.name)
  const row = (hidden: boolean) => (
    <span aria-hidden={hidden || undefined} className="dc-partners-row flex shrink-0 items-center gap-6 pr-6">
      {names.map((n, i) => (
        <span key={n + i} className="flex items-center gap-6 whitespace-nowrap">
          <span className={HOUSE.has(COLLECTIONS[i].slug) ? "text-dc-hot" : "text-dc-snow/[0.86]"}>{n}</span>
          <span aria-hidden className="h-[5px] w-[5px] bg-dc-lava" />
        </span>
      ))}
    </span>
  )
  return (
    <div className="mt-5 dk:mt-6">
      <p className="dc-label text-dc-snow/[0.78]">Open to holders of</p>
      <div className="dc-partners-ticker mt-2 overflow-hidden font-cond text-[17px] dk:text-[20px] font-semibold uppercase leading-none">
        <div className="dc-partners-track flex w-max">
          {row(false)}
          {row(true)}
        </div>
      </div>
    </div>
  )
}

// ═══ o verificador ═════════════════════════════════════════════════════════
type Check =
  | { s: "idle" }
  | { s: "busy" }
  | { s: "yes"; address: string; via: string[] }
  | { s: "no"; address: string }
  | { s: "bad" }
  | { s: "error" }

const looksLikeAddress = (a: string) => /^(bc1[02-9ac-hj-np-z]{11,87}|[13][1-9A-HJ-NP-Za-km-z]{25,34})$/.test(a)

async function shardOf(address: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(address))
  return new Uint8Array(buf)[0].toString(16).padStart(2, "0")
}

function WalletCheck({ publicStart, open }: { publicStart: number | null; open: boolean }) {
  const [value, setValue] = useState("")
  const [check, setCheck] = useState<Check>({ s: "idle" })

  const run = async (e: FormEvent) => {
    e.preventDefault()
    const raw = value.trim()
    const address = raw.toLowerCase().startsWith("bc1") ? raw.toLowerCase() : raw
    if (!looksLikeAddress(address)) { setCheck({ s: "bad" }); return }
    setCheck({ s: "busy" })
    try {
      const r = await fetch(`/dc-partners/s/${await shardOf(address)}.json`, { signal: AbortSignal.timeout(8000) })
      if (!r.ok) throw new Error(String(r.status))
      const shard = (await r.json()) as Record<string, number[]>
      const hit = shard[address]
      setCheck(hit ? { s: "yes", address, via: hit.map((i) => COLLECTIONS[i]?.name).filter(Boolean) } : { s: "no", address })
    } catch {
      setCheck({ s: "error" })
    }
  }

  return (
    <div className="max-w-[720px]">
      <form onSubmit={run} className="flex flex-col gap-3 dk:flex-row">
        <label htmlFor="dc-partners-addr" className="sr-only">Your Bitcoin wallet address</label>
        <input
          id="dc-partners-addr"
          value={value}
          onChange={(e) => { setValue(e.target.value); if (check.s !== "idle" && check.s !== "busy") setCheck({ s: "idle" }) }}
          placeholder="Paste the wallet that holds your inscription (bc1p…)"
          autoComplete="off"
          spellCheck={false}
          className="min-w-0 flex-1 border border-dc-snow/[0.24] bg-dc-deep px-4 py-3 font-mono text-[13px] text-dc-snow placeholder:text-dc-mist focus:border-dc-lava focus:outline-none"
        />
        <button type="submit" disabled={check.s === "busy"} className="dc-btn dc-btn-fill">
          {check.s === "busy" ? "Checking…" : "Check"}
        </button>
      </form>

      <div aria-live="polite" className="mt-4 min-h-[48px]">
        {check.s === "yes" && (
          <div>
            <p className="font-body text-[17px] leading-[26px] text-dc-snow">
              <span className="text-dc-hot">Eligible.</span> This wallet held {check.via.join(", ")} at block {fmtInt(PARTNER_CUT_BLOCK)}.
              It mints one lot at the partner price{open ? "." : ", when the Partners phase opens."}
            </p>
            {open && (
              <Btn href={`${MINT_URL}/?address=${encodeURIComponent(check.address)}`} external className="mt-4">
                Mint your lot
              </Btn>
            )}
          </div>
        )}
        {check.s === "no" && (
          <p className="font-body text-[17px] leading-[26px] text-dc-snow/[0.86]">
            This wallet held none of the partner collections at block {fmtInt(PARTNER_CUT_BLOCK)}. If your inscription sits in
            another wallet, check that one.{publicStart != null ? ` Anyone can mint from block ${fmtInt(publicStart)}, when the public mint opens.` : ""}
          </p>
        )}
        {check.s === "bad" && <p className="font-body text-[15px] text-dc-snow/[0.86]">That doesn&apos;t look like a Bitcoin address.</p>}
        {check.s === "error" && <p className="font-body text-[15px] text-dc-snow/[0.86]">Couldn&apos;t check right now. Try again in a moment.</p>}
      </div>
    </div>
  )
}

// ═══ a seção ═══════════════════════════════════════════════════════════════
export default function PartnersPhase({ cd }: { cd: CountdownState }) {
  const [q, setQ] = useState("")
  const list = useMemo(() => {
    const k = q.trim().toLowerCase()
    return k ? COLLECTIONS.filter((c) => c.name.toLowerCase().includes(k)) : COLLECTIONS
  }, [q])
  if (!cd.partners) return null
  const cal = cd.calendar
  const open = cd.partners === "open"

  return (
    <section id="partners" aria-labelledby="dc-partners-h2" className="relative bg-dc-void pt-24 dk:pt-32 scroll-mt-14">
      <Frame>
        <SectionHead n="PARTNERS" label={open ? "OPEN NOW · ABOUT 48 HOURS" : `OPENS AT BLOCK ${cal ? fmtInt(cal.partnerStart) : ""}`} />
        <h2 id="dc-partners-h2" className="dc-h2 mt-4 text-dc-snow">36 Ordinals collections. One lot per wallet.</h2>
        <p className="dc-lede mt-6">
          Every wallet that held an inscription from one of these collections at block {fmtInt(PARTNER_CUT_BLOCK)} mints one
          unclaimed lot at the partner price{cal ? `, from block ${fmtInt(cal.partnerStart)} to block ${fmtInt(cal.publicStart)}` : ""}.
          Buying into a collection now doesn&apos;t add a wallet to the list.
        </p>

        <div className="mt-10">
          <WalletCheck publicStart={cal?.publicStart ?? null} open={open} />
        </div>

        <div className="mt-16 flex flex-col gap-4 dk:flex-row dk:items-end dk:justify-between">
          <p className="dc-label text-dc-mist">The {COLLECTIONS.length} collections, in order</p>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Find your collection"
            aria-label="Find your collection"
            className="w-full dk:w-[280px] border border-dc-snow/[0.24] bg-dc-deep px-4 py-2.5 font-mono text-[12px] text-dc-snow placeholder:text-dc-mist focus:border-dc-lava focus:outline-none"
          />
        </div>
        <ol className="mt-6 grid grid-cols-1 gap-px bg-dc-snow/[0.1] sm:grid-cols-2 dk:grid-cols-3">
          {list.map((c) => (
            <li key={c.slug} className="flex items-baseline justify-between gap-4 bg-dc-void px-4 py-3">
              <span className={`font-cond text-[19px] font-semibold uppercase leading-tight ${HOUSE.has(c.slug) ? "text-dc-hot" : "text-dc-snow"}`}>{c.name}</span>
              <span className="shrink-0 font-mono text-[11px] tracking-[0.12em] text-dc-mist">{fmtInt(c.wallets)} wallets</span>
            </li>
          ))}
          {list.length === 0 && <li className="bg-dc-void px-4 py-3 font-body text-[15px] text-dc-mist">Not on the list.</li>}
        </ol>
        <p className="mt-6 max-w-[80ch] font-body text-[13px] leading-[20px] text-dc-mist">
          Eligibility is read from on-chain holdings at blocks {fmtInt(data.cutHeight)} to {fmtInt(data.cutHeightEnd)}, the same
          list the mint checks (sha256 {data.sha256.slice(0, 12)}…). Listed collections are not affiliated with DogCity.
          Wallet counts are distinct owner addresses; one wallet can hold several collections.
        </p>
      </Frame>
    </section>
  )
}
