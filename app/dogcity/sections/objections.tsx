"use client"

// ═══════════════════════════════════════════════════════════════════════════
// DOBRA 5, AS OBJEÇÕES, NA ORDEM EM QUE A DÚVIDA CHEGA
// (marketing/LANDING-V3-DESENHO.md).
//
// Reescrita de 13/09 para o desenho v3. Cada cartão é deliberadamente CURTO:
// a afirmação, o número que a prova, e um link para a seção correspondente em
// /dogcity/docs. NUNCA copiar as 604 linhas de marketing/DOGCITY-DOCS-V1.md
// para dentro deste arquivo — a landing ganha o argumento, a doc guarda o
// texto inteiro.
//
// QUATRO OBJEÇÕES, na ordem do desenho:
//   1. "não peguei o airdrop, tenho vez?"  a história do @R_irion66036 mudou
//      de casa: em v2 ela morava aqui por inteiro; no desenho v3 ela é a
//      DOBRA 6 ("o que a gente errou"). Este cartão agora é só a resposta
//      curta, com um link para baixo, para a página não repetir a mesma
//      história duas vezes na mesma rolagem.
//   2. "isso não é coisa de baleia?"        33,02% do supply, 1,14% da terra.
//   3. "é esquema de token?"                sem token novo, sem staking, sem
//                                            APY, sem emissão.
//   4. "e se eu esperar?"                   NOVA nesta rodada. A janela fecha
//                                            nos 10M; terra ainda dá para
//                                            conseguir no Anel 2, o número
//                                            de Founder não.
//
// UMA QUINTA, fora da lista original do desenho, entrou em 13/09 a pedido
// direto do fundador (masterplan.md §14.1): "tenho várias carteiras, contam
// separado?" Fica no mesmo grão visual das quatro acima (mesma pergunta →
// resposta curta → link), então soma-la aqui não muda a ESTRUTURA da dobra,
// só o número de cartões dentro dela.
//
// O QUE SAIU DAQUI, comentado no fim do arquivo: a v2 tinha um `AirdropFaq`
// de cinco perguntas de acompanhamento. No desenho v3 cada uma delas já tem
// casa própria (dobra 1 responde "tenho vez"/corretora ao vivo, dobra 2
// responde "mudei depois do bloco", dobra 6 responde "vendi o airdrop, perco
// o Genesis Badge"), então o bloco antigo ficaria redundante. O código
// continua no arquivo, comentado e não apagado.
// ═══════════════════════════════════════════════════════════════════════════

import { Reveal, HAIR, HAIR_SOFT } from "../motion"

function DocLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="mt-4 inline-flex items-center gap-2 font-mono text-[11px] tracking-[0.14em] text-lava hover:text-lava-light transition-colors"
    >
      {children} →
    </a>
  )
}

function Objection({
  id,
  eyebrow,
  title,
  children,
  docHref,
  docLabel,
}: {
  id: string
  eyebrow: string
  title: React.ReactNode
  children: React.ReactNode
  docHref: string
  docLabel: string
}) {
  return (
    <section id={id} className={`relative border-t ${HAIR_SOFT} scroll-mt-16`}>
      <div className="max-w-6xl mx-auto px-6 md:px-10 py-14 md:py-16">
        <Reveal>
          <div className="max-w-2xl">
            <p className="font-mono text-[10px] md:text-[11px] tracking-[0.28em] text-lava">{eyebrow}</p>
            <h2 className="font-display font-bold text-snow mt-2.5 leading-[1.15] text-[22px] md:text-[30px]">
              {title}
            </h2>
            <div className="text-[13px] md:text-[15px] text-mist mt-3 leading-relaxed">{children}</div>
            <DocLink href={docHref}>{docLabel}</DocLink>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

// ── objeção 1 ────────────────────────────────────────────────────────────────
// Curta de propósito: a história inteira agora mora na dobra 6 (./mistakes.tsx).
export function ObjectionAirdrop() {
  return (
    <Objection
      id="faq-airdrop"
      eyebrow="DIDN'T GET THE AIRDROP? DO I STILL HAVE A CHANCE?"
      title="Yes. Every one of the 85,818 wallets in the snapshot is ranked by measured on-chain accumulation, whether it ever received the original airdrop or not."
      docHref="/dogcity/docs#person-from-a-service"
      docLabel="Read how the ruler was rebuilt"
    >
      <p>
        The project&apos;s first ruler only classified wallets that had received the original
        $DOG airdrop, until a member of the community proved it wrong in public.{" "}
        <a href="#mistakes" className="text-lava hover:text-lava-light underline underline-offset-2">
          The full story is below.
        </a>
      </p>
    </Objection>
  )
}

// ── objeção 2 ────────────────────────────────────────────────────────────────
export function ObjectionWhales() {
  return (
    <Objection
      id="faq-whales"
      eyebrow="ISN'T THIS JUST FOR WHALES?"
      title={
        <>
          The top 20 wallets hold <span className="text-lava">33.02%</span> of supply and
          receive <span className="text-lava">1.14%</span> of the land.
        </>
      }
      docHref="/dogcity/docs#financial-district"
      docLabel="See how land is sized"
    >
      <p>
        Land area grows with the square root of a wallet&apos;s balance: doubling the balance
        does not double the land, it multiplies it by 1.41. The largest wallet on the chain
        holds 56 times more $DOG than the twentieth largest, and receives 2.7 times the land,
        not 56 times.
      </p>
    </Objection>
  )
}

// ── objeção 3 ────────────────────────────────────────────────────────────────
export function ObjectionToken() {
  return (
    <Objection
      id="faq-token"
      eyebrow="IS THIS A TOKEN SCHEME?"
      title="No new token. No staking. No APY. No emission."
      docHref="/dogcity/docs#not-yet"
      docLabel="See what this is not, yet"
    >
      <p>
        A Founders Pack is a one-time construction license tied to the $DOG you already hold.
        There is nothing to stake, nothing that pays interest, and nothing sold as an
        investment. A city that cannot print land cannot print promises.
      </p>
    </Objection>
  )
}

// ── objeção 4, nova nesta rodada ─────────────────────────────────────────────
export function ObjectionWait() {
  return (
    <Objection
      id="faq-wait"
      eyebrow="WHAT IF I JUST WAIT?"
      title="You can build later. You cannot become a Founder later."
      docHref="/dogcity/founders"
      docLabel="Read the full Founders Pack"
    >
      <p>
        The construction fund window closes at 10,000,000 $DOG. Land you can still get, in
        Ring 2, whenever it opens. The Founder number is different: it is assigned by order of
        arrival, and once the window shuts, no later contribution reopens it.
      </p>
    </Objection>
  )
}

// ── objeção 5, adicionada em 13/09 a pedido do fundador (masterplan.md §14.1) ─
export function ObjectionMultipleWallets() {
  return (
    <Objection
      id="faq-multiple-wallets"
      eyebrow="I HOLD $DOG ACROSS SEVERAL WALLETS. DO THEY COUNT TOGETHER OR SEPARATELY?"
      title="Separately. Each wallet is its own lot; there is no aggregation by person."
      docHref="/dogcity/docs#how-land-follows-the-coins"
      docLabel="See how land is sized"
    >
      <p>
        For Ring 1 that is the only possible answer anyway: the snapshot already froze at block
        966,670, and there is no proof of ownership across multiple wallets that could change it.
      </p>
      <p className="mt-2.5">
        Because area grows with the square root of a balance, splitting a balance across several
        wallets does raise the total land:
      </p>
      <div className={`mt-3 border ${HAIR} bg-white/[0.02] font-mono text-[12px] md:text-[13px]`}>
        <div className="flex items-baseline justify-between gap-4 px-4 py-2.5 border-b border-white/[0.06]">
          <span className="text-mist">1,000,000 $DOG in one wallet</span>
          <span className="text-snow tabular-nums">986 m2</span>
        </div>
        <div className="flex items-baseline justify-between gap-4 px-4 py-2.5 border-b border-white/[0.06]">
          <span className="text-mist">split across 10 wallets</span>
          <span className="text-snow tabular-nums">3,119 m2 <span className="text-lava">3.16x</span></span>
        </div>
        <div className="flex items-baseline justify-between gap-4 px-4 py-2.5">
          <span className="text-mist">split across 100 wallets</span>
          <span className="text-snow tabular-nums">9,864 m2 <span className="text-lava">10.00x</span></span>
        </div>
      </div>
      <p className="mt-3">
        For Ring 1 this changes nothing: it is already frozen. For Ring 2 it is an explicit
        incentive, and anyone who plans ahead can split before that block. It defends itself
        anyway, because <span className="text-snow font-semibold">land is free and building is not</span>.
        Splitting into 100 wallets means 100 empty lots, and each one needs its own 10,000 $DOG
        licence to become a building. Occupying cost grows linearly while land grows by square
        root, so splitting stops paying for itself fast.
      </p>
    </Objection>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SAIU DA LANDING EM 13/09 (comentado, não apagado). O `AirdropFaq` de v2
// respondia cinco perguntas de acompanhamento sobre o airdrop; no desenho v3
// cada uma já tem casa própria em outra dobra (ver o comentário de topo deste
// arquivo). Redundante hoje, mas o código fica, para se um dia a landing
// precisar de novo de um bloco de perguntas soltas.
//
// const FAQ = [
//   {
//     q: "I didn't receive the airdrop. Do I still have a place in the city?",
//     a: "Yes. Every wallet in the snapshot is ranked by measured on-chain accumulation, whether it ever received the original airdrop or not, and every wallet that arrives after the snapshot gets land in the next ring.",
//   },
//   {
//     q: "I received the airdrop and sold. Did I lose the Genesis Badge?",
//     a: "No. The Genesis Badge marks that a wallet received the original airdrop, permanently, on the record as part of the first community. It is identity and legacy, never land and never a return, so nothing you do with the coins afterward removes it.",
//   },
//   {
//     q: "I moved my $DOG after block 966,670. Does that change anything?",
//     a: "No. The snapshot reads the chain once, at that block, and the register is final. Moving, spending or consolidating coins afterward does not change what block 966,670 already recorded, in either direction.",
//   },
//   {
//     q: "I hold $DOG on an exchange. Does that count?",
//     a: "Not as your own holding. Coins sitting on an exchange are held under the exchange's own keys, not yours, so the chain assigns that lot to the exchange's address, and that address is treated as part of the Financial District, not the residential city. Withdrawing to your own wallet is what makes it count as yours.",
//   },
//   {
//     q: "Is the Genesis Badge worth money?",
//     a: "No. It is identity and legacy, never land and never a return: a mark, not a lot. It does not decide where a wallet lives and it pays out nothing.",
//   },
// ] as const
//
// export function AirdropFaq() {
//   return (
//     <section id="faq-more" className={`relative border-t ${HAIR_SOFT} scroll-mt-16`}>
//       <div className="max-w-6xl mx-auto px-6 md:px-10 py-14 md:py-16">
//         <Reveal>
//           <p className="font-mono text-[10px] md:text-[11px] tracking-[0.28em] text-lava">
//             MORE ABOUT THE AIRDROP
//           </p>
//           <h2 className="font-display font-bold text-snow mt-2.5 leading-[1.15] text-[22px] md:text-[28px] max-w-2xl">
//             Questions that come up right after this one.
//           </h2>
//         </Reveal>
//         <div className="mt-8 md:mt-10 divide-y divide-white/[0.06] border-t border-b border-white/[0.06]">
//           {FAQ.map((f, i) => (
//             <Reveal key={f.q} delay={0.05 + i * 0.04}>
//               <div className="py-5 md:py-6">
//                 <h3 className="font-display font-bold text-snow text-[15px] md:text-base leading-snug">{f.q}</h3>
//                 <p className="text-[13px] md:text-sm text-mist mt-2 leading-relaxed max-w-2xl">{f.a}</p>
//               </div>
//             </Reveal>
//           ))}
//         </div>
//       </div>
//     </section>
//   )
// }
