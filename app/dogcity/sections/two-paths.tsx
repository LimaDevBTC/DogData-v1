"use client"

// ═══════════════════════════════════════════════════════════════════════════
// OS DOIS CAMINHOS (#rings) — criado em 13/09, masterplan.md §14.
//
// A landing tinha UM discurso e a cidade tem DOIS públicos. A hero vende a
// mesma licença para os dois, mas o que cada carteira RECEBE depende de
// quando ela apareceu:
//
//   · QUEM JÁ ESTAVA NO BLOCO 966.670 (85.818 carteiras do snapshot) já tem
//     um lote. A licença deixa a pessoa construir nele.
//   · QUEM CHEGA DEPOIS não fica de fora — a decisão fechada em §14 descarta
//     as duas alternativas óbvias (dividir o terreno de quem já estava, ou não
//     dar nada a quem chega). A cidade CRESCE EM ANÉIS: o Anel 1 é o bloco
//     966.670, o Anel 2 abre com um snapshot novo, num bloco futuro ainda sem
//     data. O lote de quem chega agora nasce ali.
//
// A FRASE QUE ORGANIZA A SEÇÃO, verbatim de §14: o snapshot não criou
// escassez de TERRA (o sítio tem 248,3 km² e o tecido de hoje usa só 66,8 km²,
// 27% — cabe quase quatro vezes a cidade atual), criou escassez de
// PROXIMIDADE. Estar perto do centro foi decidido no bloco 966.670 e acabou;
// todo o resto do terreno continua disponível para quem chega, só que mais
// longe. A distância até o centro é o registro de quando a pessoa apareceu.
//
// ⚠️ NENHUMA DATA NEM BLOCO PARA O ANEL 2. §14 é explícito: "o anel precisa
// estar anunciado ANTES da busca ir ao ar, nem que seja só como direção sem
// bloco marcado". Esta seção fala em "a future, announced block", nunca em
// data ou altura.
//
// ⚠️ O AVISO DA CORRETORA é o mesmo texto que já vive no seletor de custódia
// de ./snapshot.tsx (repetido de propósito: aqui ele é dirigido a quem CHEGA
// AGORA, que é o público que mais precisa ouvir "comprar não basta").
//
// Sem busca de endereço aqui — a ramificação por endereço que §14 descreve
// ("digita o endereço e a página decide qual conversa ter") é um produto
// maior, com API própria, e não foi pedida nesta rodada. Esta seção é a
// explicação estática dos dois caminhos; a busca fica para depois.
//
// Estilo consistente com ./objections.tsx: eyebrow mono lava, headline
// display, HAIR_SOFT como costura de topo. Layout de duas colunas que
// EMPILHA no celular (grid-cols-1 md:grid-cols-2), cada caminho com seu
// próprio título e corpo curto.
// ═══════════════════════════════════════════════════════════════════════════

import { Reveal, HAIR, HAIR_SOFT } from "../motion"

export default function TwoPaths() {
  return (
    <section id="rings" className={`relative border-t ${HAIR_SOFT} scroll-mt-16`}>
      <div className="max-w-6xl mx-auto px-6 md:px-10 py-14 md:py-20">
        <Reveal>
          <div className="max-w-2xl">
            <p className="font-mono text-[10px] md:text-[11px] tracking-[0.28em] text-lava">
              THE CITY GROWS IN RINGS
            </p>
            <h2 className="font-display font-bold text-snow mt-2.5 leading-[1.15] text-[24px] md:text-[34px]">
              The snapshot did not create scarce land. It created scarce proximity.
            </h2>
            <p className="text-[13px] md:text-[15px] text-mist mt-3 leading-relaxed">
              The site holds 248.3 km2 and today&apos;s fabric uses only 66.8 km2 of it, about
              27%: room enough for nearly four cities this size. What can never be made again is
              being close to the centre, because that was decided at block 966,670. Everyone else
              is still welcome, still receives real land, and the distance to the centre is simply
              the record of when they arrived.
            </p>
          </div>
        </Reveal>

        <Reveal delay={0.08}>
          <div className={`mt-8 md:mt-10 grid md:grid-cols-2 gap-px ${HAIR} border bg-white/10`}>
            {/* caminho A: já estava lá */}
            <div className="bg-void p-6 md:p-8">
              <p className="font-mono text-[9px] md:text-[10px] tracking-[0.25em] text-lava">
                RING 1 · ALREADY IN BLOCK 966,670
              </p>
              <h3 className="font-display font-bold text-snow mt-2.5 text-lg md:text-xl leading-snug">
                You already have a lot.
              </h3>
              <p className="text-[13px] text-mist mt-2.5 leading-relaxed">
                Your wallet was part of the 85,818 in the snapshot, so the chain already assigned
                you land at Mare Tranquillitatis. The Founders Pack does not change where you are.
                It lets you build on the lot you already own.
              </p>
            </div>

            {/* caminho B: chegou depois */}
            <div className="bg-void p-6 md:p-8">
              <p className="font-mono text-[9px] md:text-[10px] tracking-[0.25em] text-lava">
                RING 2 · ARRIVED AFTER
              </p>
              <h3 className="font-display font-bold text-snow mt-2.5 text-lg md:text-xl leading-snug">
                Your lot is coming. Your place in line is not.
              </h3>
              <p className="text-[13px] text-mist mt-2.5 leading-relaxed">
                Your land comes with Ring 2, a future, announced block, the same way Ring 1 came
                from block 966,670. What closes right now is the order: a Founder number is
                assigned by arrival, it does not depend on already owning a lot, and the window
                closes when the fund reaches 10,000,000 $DOG.
              </p>
            </div>
          </div>
        </Reveal>

        {/* o aviso duro: comprar não basta */}
        <Reveal delay={0.14}>
          <div className={`mt-6 md:mt-8 border ${HAIR} bg-white/[0.02] px-5 py-5 md:px-6 max-w-3xl`}>
            <p className="font-mono text-[9px] md:text-[10px] tracking-[0.2em] text-lava">
              IF YOU ARE ARRIVING NOW
            </p>
            <p className="text-[13px] md:text-sm text-mist mt-2 leading-relaxed">
              Buying $DOG is not enough on its own: you have to withdraw it to a wallet you
              control. $DOG left sitting on an exchange is not yours on the chain, the lot is
              assigned to the exchange&apos;s own address, and that address is treated as part of
              the Financial District, not the residential city. Self custody is what makes a
              wallet yours.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
