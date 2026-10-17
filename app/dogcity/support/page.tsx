// /dogcity/support: o canal oficial de suporte da DogCity.
// O e-mail oficial é support@dogcity.space (decisão do fundador).
"use client"

import { useState } from "react"
import { Layout } from "@/components/layout"

const EMAIL = "support@dogcity.space"
const HAIR = "border-white/10"

const SHORTCUTS = [
  { href: "/dogcity#lookup", label: "FIND YOUR LOT", note: "Paste your address in the lookup on the DogCity page." },
  { href: "/dogcity/docs", label: "READ THE DOCS", note: "How the snapshot, the lots and the tiers work." },
  { href: "/dogcity/atlas", label: "OPEN THE ATLAS", note: "The city as a book, with a sheet for every lot." },
]

function CopyEmail() {
  const [done, setDone] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(EMAIL)
      setDone(true)
      setTimeout(() => setDone(false), 1800)
    } catch {
      /* sem permissão de área de transferência: o endereço segue visível para copiar à mão */
    }
  }
  return (
    <button
      type="button"
      onClick={copy}
      className={`font-mono text-[11px] tracking-[0.14em] px-4 py-2.5 border ${HAIR} text-mist hover:text-snow transition-colors`}
    >
      {done ? "COPIED" : "COPY"}
    </button>
  )
}

export default function DogCitySupportPage() {
  return (
    <Layout currentPage="donate" setCurrentPage={() => {}}>
      <div className="bg-void text-snow">
        <div className="max-w-6xl mx-auto px-6 md:px-10 pt-10 pb-8 md:pt-16">
          <div className="font-mono text-[10px] md:text-[11px] tracking-[0.3em] text-lava">DOGCITY · OFFICIAL CHANNEL</div>
          <h1 className="font-display font-bold text-snow text-[30px] leading-[1.05] md:text-[48px] mt-3">Support</h1>
          <p className="text-[13px] md:text-[15px] text-mist leading-relaxed mt-3 max-w-2xl">
            Questions about your lot, the snapshot or the city? Write to us. This is the only official support address.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <a
              href={`mailto:${EMAIL}`}
              className="font-mono text-[11px] tracking-[0.14em] px-5 py-2.5 border border-lava text-lava hover:bg-lava hover:text-void transition-colors"
            >
              EMAIL SUPPORT
            </a>
            <span className="font-mono text-[13px] md:text-[14px] text-snow select-all">{EMAIL}</span>
            <CopyEmail />
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-6 md:px-10 pb-8">
          <div className="font-mono text-[10px] md:text-[11px] tracking-[0.3em] text-lava">SELF SERVICE</div>
          <ul className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 list-none p-0">
            {SHORTCUTS.map((s) => (
              <li key={s.href}>
                <a href={s.href} className={`block h-full border ${HAIR} bg-white/[0.02] p-5 hover:border-lava transition-colors`}>
                  <div className="font-mono text-[11px] tracking-[0.14em] text-snow">{s.label}</div>
                  <p className="text-[13px] text-mist mt-2 leading-relaxed">{s.note}</p>
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div className="max-w-6xl mx-auto px-6 md:px-10 pb-8">
          <div className={`border ${HAIR} bg-white/[0.02] p-5 md:p-6 max-w-3xl`}>
            <div className="font-mono text-[10px] md:text-[11px] tracking-[0.3em] text-lava">STAY SAFE</div>
            <ul className="mt-3 space-y-2 text-[13px] md:text-[14px] text-mist leading-relaxed list-none p-0">
              <li>The team will never DM you first.</li>
              <li>We never ask for your seed phrase or private keys. Anyone who does is a scammer.</li>
              <li>There is no mint, airdrop or verification outside the official site.</li>
              <li>
                Official domains: <span className="font-mono text-snow">dogdata.xyz</span> and{" "}
                <span className="font-mono text-snow">dogcity.space</span>.
              </li>
            </ul>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-6 md:px-10 pb-20">
          <div className="font-mono text-[10px] md:text-[11px] tracking-[0.2em] text-dusty">SUPPORT AGENTS: COMING SOON</div>
        </div>
      </div>
    </Layout>
  )
}
