"use client"

// ═══════════════════════════════════════════════════════════════════════════
// DOBRA 6, O QUE A GENTE ERROU (marketing/LANDING-V3-DESENHO.md).
//
// 🔑 "Todo projeto publica o que deu certo. Publicar o que deu errado é o que
// compra confiança." Esta é a dobra que nenhum concorrente vai copiar, porque
// copiar um erro admitido exigiria ADMITIR o próprio erro primeiro.
//
// Duas histórias, contadas sem suavizar. A primeira é a mesma que a v2 já
// tinha em ./objections.tsx (ObjectionAirdrop); ela se MUDOU para cá porque o
// desenho pede a história inteira numa dobra própria, não espremida dentro de
// um cartão de objeção — o cartão em objections.tsx agora só aponta pra baixo,
// com "#mistakes".
//
// A segunda nunca esteve na landing: as seis métricas que o time testou e
// descartou para separar pessoa de serviço, e por que a sexta (o ritmo)
// funcionou onde as outras cinco falharam. Fonte: marketing/DOGCITY-DOCS-V1.md
// seção 4, "How we tell a person from a service" (604 linhas; aqui só o
// resumo, o link manda pra lá).
// ═══════════════════════════════════════════════════════════════════════════

import { Reveal, HAIR, HAIR_SOFT } from "../motion"

const METRICAS_REJEITADAS = [
  "Counting deposits or UTXOs",
  "Buying whole airdrop allocations",
  "A repeated, identical deposit value",
  "Signatures per day of the wallet's active window",
  "Turnover (signatures divided by remaining UTXOs)",
  "Distinct payers, counted from a wallet's complete history",
]

export default function Mistakes() {
  return (
    <section id="mistakes" className={`relative border-t ${HAIR_SOFT} scroll-mt-16`}>
      <div className="max-w-6xl mx-auto px-6 md:px-10 py-16 md:py-24">
        <Reveal>
          <div className="max-w-2xl">
            <p className="font-mono text-[10px] md:text-[11px] tracking-[0.28em] text-lava">
              WHAT WE GOT WRONG
            </p>
            <h2 className="font-display font-bold text-snow mt-2.5 text-2xl md:text-4xl leading-tight">
              Publishing what worked is easy. This is what did not.
            </h2>
          </div>
        </Reveal>

        <div className={`mt-10 md:mt-12 grid md:grid-cols-2 gap-px ${HAIR} border bg-white/10`}>
          {/* história 1: a régua injusta */}
          <Reveal>
            <div className="bg-void p-6 md:p-8 h-full">
              <p className="font-mono text-[9px] md:text-[10px] tracking-[0.25em] text-lava">
                THE RULER WAS UNFAIR, AND A USER PROVED IT
              </p>
              <h3 className="font-display font-bold text-snow mt-2.5 text-lg md:text-xl leading-snug">
                We only ranked half the city, and we did not notice.
              </h3>
              <p className="text-[13px] text-mist mt-3 leading-relaxed">
                The first version of this system only classified wallets that had received the
                original $DOG airdrop. A wallet that never received it and accumulated by buying
                on the open market carried no tier at all, however much it held.
              </p>
              <p className="text-[13px] text-mist mt-2.5 leading-relaxed">
                The user{" "}
                <a
                  href="https://x.com/r_irion66036/status/2098835847101477099"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-lava hover:text-lava-light underline underline-offset-2"
                >
                  @R_irion66036
                </a>{" "}
                pointed this out publicly, on X. The criticism was correct, and the ruler was
                rebuilt from scratch: today all 85,818 wallets in the snapshot are ordered by
                measured on-chain accumulation, whether they ever received the airdrop or not.
              </p>
              <p className="text-[13px] text-mist mt-2.5 leading-relaxed">
                The airdrop itself became the{" "}
                <span className="text-snow font-semibold">Genesis Badge</span>: identity and
                legacy, never land and never a return, a mark and not a lot.
              </p>
            </div>
          </Reveal>

          {/* história 2: as seis métricas que falharam */}
          <Reveal delay={0.08}>
            <div className="bg-void p-6 md:p-8 h-full">
              <p className="font-mono text-[9px] md:text-[10px] tracking-[0.25em] text-lava">
                SIX WAYS TO TELL A PERSON FROM A SERVICE, AND ALL SIX FAILED
              </p>
              <h3 className="font-display font-bold text-snow mt-2.5 text-lg md:text-xl leading-snug">
                We are publishing the failures, not just the fix.
              </h3>
              <p className="text-[13px] text-mist mt-3 leading-relaxed">
                The reason is structural: custody consolidates. An exchange&apos;s wallet does not
                receive from the public, it receives from its own internal transfers already
                gathered together, which gives it few counterparties, old coin age and little
                turnover per address. That is exactly the signature a ruler built to reward
                patience ends up rewarding.
              </p>
              <ul className="mt-3 space-y-1.5">
                {METRICAS_REJEITADAS.map((m) => (
                  <li key={m} className="text-[12.5px] text-mist leading-snug flex gap-2">
                    <span aria-hidden className="text-lava">✕</span>
                    {m}
                  </li>
                ))}
              </ul>
              <p className="text-[13px] text-mist mt-3 leading-relaxed">
                What worked was <span className="text-snow font-semibold">rhythm</span>: a
                service runs for 24 hours, a person sleeps.
              </p>
              <a
                href="/dogcity/docs#person-from-a-service"
                className="mt-4 inline-flex items-center gap-2 font-mono text-[11px] tracking-[0.14em] text-lava hover:text-lava-light transition-colors"
              >
                Read all six failures in full →
              </a>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
