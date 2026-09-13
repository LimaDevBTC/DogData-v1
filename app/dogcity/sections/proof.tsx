"use client"

// ═══════════════════════════════════════════════════════════════════════════
// DOBRA 2, "DIZ QUEM?" (marketing/LANDING-V3-DESENHO.md).
//
// A primeira reação a "you already own this" (dobra 1) é desconfiança. Esta
// seção responde ANTES de alguém perguntar, com prova que qualquer pessoa
// pode conferir sozinha contra o próprio nó: o bloco, a hora, o hash, e os
// totais que fecham a conta.
//
// Todo número aqui vem de SNAPSHOT_PROOF em ../dogcity-data.ts, copiado um a
// um do cabeçalho de data/snapshots/dog_snapshot_966670.json (gitignored,
// gerado 2026-09-12). Número redondo de marketing é proibido pelo desenho:
// 85.818, nunca "mais de 85 mil".
// ═══════════════════════════════════════════════════════════════════════════

import { HAIR_SOFT } from "../motion"
import { SNAPSHOT_PROOF } from "../dogcity-data"

function fmt(n: number, d = 0) {
  return n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d })
}

function dataCompleta(iso: string): string {
  const d = new Date(iso)
  const data = d.toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
  const hora = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "UTC" })
  return `${data}, ${hora} UTC`
}

const LINHAS: Array<[string, string]> = [
  ["BLOCK", fmt(SNAPSHOT_PROOF.block)],
  ["TIME", dataCompleta(SNAPSHOT_PROOF.timeUtc)],
  ["HASH", SNAPSHOT_PROOF.hash],
  ["WALLETS", fmt(SNAPSHOT_PROOF.wallets)],
  ["UTXOS", fmt(SNAPSHOT_PROOF.utxos)],
  ["$DOG", fmt(SNAPSHOT_PROOF.dogTotal, 2)],
]

export default function Proof() {
  return (
    <section id="proof" className={`relative border-t ${HAIR_SOFT} scroll-mt-16`}>
      <div className="max-w-3xl mx-auto px-6 md:px-10 py-14 md:py-16">
        <p className="font-mono text-[10px] md:text-[11px] tracking-[0.28em] text-lava text-center">
          VERIFY IT YOURSELF
        </p>
        <h2 className="font-display font-bold text-snow mt-2.5 text-xl md:text-2xl text-center">
          Says who?
        </h2>

        <div className="mt-7 border border-white/10 bg-white/[0.02]">
          {LINHAS.map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-4 px-5 py-3 border-b border-white/[0.06] last:border-0">
              <span className="font-mono text-[10px] md:text-[11px] tracking-[0.16em] text-dusty">{k}</span>
              <span className="font-mono text-[13px] md:text-sm text-snow text-right tabular-nums break-all">{v}</span>
            </div>
          ))}
          <div className="flex items-baseline justify-between gap-4 px-5 py-3 border-b border-white/[0.06]">
            <span className="font-mono text-[10px] md:text-[11px] tracking-[0.16em] text-dusty">SUPPLY CONSERVATION</span>
            <span className="font-mono text-[13px] md:text-sm text-lava text-right">{SNAPSHOT_PROOF.supplyConservation}</span>
          </div>
          <div className="flex items-baseline justify-between gap-4 px-5 py-3">
            <span className="font-mono text-[10px] md:text-[11px] tracking-[0.16em] text-dusty">SET IDENTITY</span>
            <span className="font-mono text-[13px] md:text-sm text-lava text-right">{SNAPSHOT_PROOF.setIdentity}</span>
          </div>
        </div>

        <p className="text-[12px] md:text-[13px] text-mist mt-5 leading-relaxed text-center">
          {fmt(SNAPSHOT_PROOF.burned, 2)} $DOG were burned, which is why the total above does not
          close at 100 billion. Saying that before anyone asks is worth more than answering it
          after.
        </p>
      </div>
    </section>
  )
}
