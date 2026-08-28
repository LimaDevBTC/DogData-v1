"use client"

// ═══════════════════════════════════════════════════════════════════════════
// CONVERSÃO — da visita até os 10k DOG.
//
// A conversão do DogData não é um clique: é uma transação na Bitcoin, para
// bc1pxk7aw…, e 10.000 DOG acumulados destravam a licença Personal. Isso torna
// o funil diferente de qualquer funil de site comum, porque ele tem duas
// metades que só se encontram no meio:
//
//   visita → viu a oferta → copiou o endereço → conectou carteira  [navegador]
//                                                     ↕
//                                   analytics_identity (prova de posse)
//                                                     ↕
//                                       doação ≥ 10k DOG            [cadeia]
//
// O elo é a assinatura BIP-322/Schnorr: é o único momento em que se sabe, COM
// PROVA, que este navegador controla este endereço. Sem ela a atribuição seria
// autodeclarada e não valeria nada.
//
// Quem doa sem nunca conectar carteira aparece como "sem atribuição". Isso é
// informação, não falha — é a fatia do dinheiro que chegou por um caminho que
// não sabemos medir, e ela precisa aparecer com esse nome. Escondê-la faria os
// canais medidos parecerem melhores do que são.
// ═══════════════════════════════════════════════════════════════════════════

import { Coins, GitBranch, Link2Off, Timer } from "lucide-react"
import { Reveal } from "@/app/dogcity/motion"
import type { Funil as TFunil } from "./types"
import {
  CAT, Funil, HAIR, INK, Plate, PlateHead, PlotGrid, SectionHead, Tabela,
  fmtNum, fmtPct,
} from "./ui"

const fmtDog = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)}M` :
  n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` :
  fmtNum(Math.round(n))

export default function Conversao({ data }: { data: TFunil }) {
  const { doacoes: d, atribuicao: at, tempo_ate_doar: t } = data

  const totalDog = at.dog_atribuido + at.dog_sem_atribuicao
  const pctAtribuido = totalDog > 0 ? (at.dog_atribuido / totalDog) * 100 : 0

  // As etapas do meio dependem de eventos que só começaram a ser coletados em
  // 27/08. Enquanto estiverem em zero, um funil desenhado normalmente diria
  // "100% de perda" onde na verdade não houve medição — e essa é a diferença
  // que este trabalho inteiro veio proteger.
  const meioVazio =
    data.etapas.slice(2, 4).every((e) => e.n === 0) && data.etapas[4]?.n > 0

  return (
    <div className="space-y-12 md:space-y-16">

      <section>
        <SectionHead
          eyebrow="CONVERSION"
          title="From visit to the 10k DOG donation."
          sub="The Personal licence is unlocked by 10,000 DOG accumulated in the construction wallet. Conversion happens on chain, not on the site."
        />

        <Reveal delay={0.4} y={16}>
          <PlotGrid className="mt-10 grid-cols-2 lg:grid-cols-4">
            <Cartao label="Donors" valor={fmtNum(d.doadores)} sub={`${fmtNum(d.doacoes)} donations`} acento={CAT[0]} />
            <Cartao label="Past 10k" valor={fmtNum(d.cruzaram_10k)} sub="Personal licence or above" acento={CAT[1]} />
            <Cartao label="Total received" valor={`${fmtDog(d.total_dog)} DOG`} sub={`median ticket ${fmtDog(d.ticket_mediano)}`} acento={CAT[2]} />
            <Cartao
              label="Time to donate"
              valor={t.horas_mediana != null ? `${t.horas_mediana}h` : "—"}
              sub={t.amostras > 0 ? `median of ${fmtNum(t.amostras)} tracked donations` : "no tracked donation yet"}
              acento={CAT[0]}
            />
          </PlotGrid>
        </Reveal>
      </section>

      <div className="grid lg:grid-cols-2 gap-6">
        <Reveal y={18}>
          <Plate className="h-full">
            <PlateHead icon={GitBranch}>The funnel</PlateHead>
            <div className="mt-4">
              <Funil etapas={data.etapas} />
            </div>
            {meioVazio && (
              <p className="font-mono text-[10px] text-dusty mt-5 leading-relaxed">
                The two middle steps are at zero because the events that measure them
                (<span className="text-mist">donate_address_copied</span> and{" "}
                <span className="text-mist">wallet_connected</span>) were instrumented on
                2026-08-27. The donations below them are real and come from the chain — the funnel
                is not saying nobody passed, it is saying nobody was measured passing. It fills in
                from here.
              </p>
            )}
          </Plate>
        </Reveal>

        <Reveal y={18} delay={0.08}>
          <Plate className="h-full">
            <PlateHead icon={Link2Off}>Attribution of the money</PlateHead>

            <div className="mt-2">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-mono text-[11px] text-mist">Attributed to a source</span>
                <span className="font-display font-bold text-lg text-snow tabular-nums">
                  {fmtPct(pctAtribuido)}
                </span>
              </div>
              <div className="h-2.5 w-full bg-white/[0.04] mt-2.5 flex gap-[2px]">
                <div style={{ width: `${pctAtribuido}%`, background: CAT[0] }} />
                <div style={{ width: `${100 - pctAtribuido}%`, background: "#ffffff14" }} />
              </div>
            </div>

            <ul className={`mt-6 space-y-3 border-t ${HAIR} pt-5`}>
              <Linha rotulo="DOG with known source" valor={`${fmtDog(at.dog_atribuido)} DOG`} />
              <Linha rotulo="DOG unattributed" valor={`${fmtDog(at.dog_sem_atribuicao)} DOG`} esmaecido />
              <Linha rotulo="Tracked donations" valor={fmtNum(at.atribuidas)} />
              <Linha rotulo="Untracked donations" valor={fmtNum(at.sem_atribuicao)} esmaecido />
            </ul>

            <p className="font-mono text-[10px] text-dusty mt-5 leading-relaxed">
              A donation only gets a source when that address connected its wallet on the site at
              some point — the signature is the proof. A donor who never connected shows up here as
              unattributed instead of vanishing from the count.
            </p>
          </Plate>
        </Reveal>
      </div>

      <Reveal y={18}>
        <Plate>
          <PlateHead icon={Coins}>Money by source channel</PlateHead>
          <p className="font-mono text-[10px] text-dusty mb-4 leading-relaxed max-w-[70ch]">
            Channel of the donor&apos;s FIRST touch, not the last. That is what answers &ldquo;what
            brought this person&rdquo;; the last touch is almost always &ldquo;Direct&rdquo;, because
            someone coming back to donate types the address.
          </p>
          <Tabela
            cabecalho={["Channel", "Donors", "DOG", "Share"]}
            alinhar={["l", "r", "r", "r"]}
            linhas={data.por_canal.map((c) => [
              <span key="c" className={c.canal === "(unattributed)" ? "text-dusty" : "text-snow"}>
                {c.canal === "(unattributed)" ? "unattributed" : c.canal}
              </span>,
              fmtNum(c.doadores),
              fmtDog(c.dog),
              fmtPct(totalDog > 0 ? (c.dog / totalDog) * 100 : 0),
            ])}
          />
        </Plate>
      </Reveal>

      {t.amostras > 0 && (
        <Reveal y={16}>
          <div className={`border ${HAIR} p-5`}>
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-dusty mb-2 flex items-center gap-2">
              <Timer className="w-3 h-3" />
              Reading
            </div>
            <p className="font-mono text-[11px] text-mist leading-relaxed max-w-[75ch]">
              The median between first visit and donation is{" "}
              <span className="text-snow">{t.horas_mediana}h</span>.{" "}
              {(t.horas_mediana ?? 0) < 2
                ? "Impulse decision: what matters is the first session convincing, and there is no useful window for re-engagement."
                : "Considered decision: donors come back later, so following up with people who already visited pays off."}
            </p>
          </div>
        </Reveal>
      )}
    </div>
  )
}

function Cartao({ label, valor, sub, acento }: {
  label: string; valor: string; sub: string; acento: string
}) {
  return (
    <div className="relative bg-void p-5 min-h-[124px] flex flex-col justify-between">
      <div className="flex items-start justify-between gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-dusty">{label}</span>
        <span className="w-1.5 h-1.5 shrink-0 mt-1" style={{ background: acento }} />
      </div>
      <div className="mt-4">
        <div className="font-display font-bold text-[28px] leading-none text-snow tabular-nums">{valor}</div>
        <div className="font-mono text-[10px] text-dusty mt-2 leading-relaxed">{sub}</div>
      </div>
    </div>
  )
}

function Linha({ rotulo, valor, esmaecido = false }: {
  rotulo: string; valor: string; esmaecido?: boolean
}) {
  return (
    <li className="flex items-baseline justify-between gap-3">
      <span className="font-mono text-[11px]" style={{ color: esmaecido ? INK.muted : INK.secondary }}>
        {rotulo}
      </span>
      <span
        className="font-mono text-[11px] tabular-nums"
        style={{ color: esmaecido ? INK.muted : INK.primary }}
      >
        {valor}
      </span>
    </li>
  )
}
