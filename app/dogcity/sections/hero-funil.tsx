"use client"

// ═══════════════════════════════════════════════════════════════════════════
// A HERO DA OFERTA (#offer) — reestruturação de 13/09.
//
// Decisão do fundador: "a landing está cheia de coisas, galáxia, price war. O
// foco tem que ser venda de licenças (Founders Pack) e documentação para
// termos confiança." Até esta data a página abria com <Snapshot /> (uma faixa
// de dados sobre o bloco 966.670) e só DEPOIS mostrava qualquer oferta em
// <HeroLive /> (as três portas: cidade, guerra, galáxia — nenhuma delas é o
// Founders Pack). Um visitante novo via um instrumento de dados antes de saber
// o que o projeto vende.
//
// Esta seção é a oferta, sozinha, com UM único CTA. <Snapshot /> e <HeroLive />
// NÃO foram apagadas — elas continuam no arquivo e voltaram de posição: a
// primeira virou a resposta à objeção "isso é real?" (bloco 3, ./objections.tsx
// não a contém porque ela já existia pronta) e a segunda é o tour dos três
// produtos vivos, agora abaixo do funil de venda, onde não compete mais com
// ele. Ver page.tsx para a ordem nova inteira.
//
// ⚠️ REGRAS DESTA SEÇÃO:
// 1. UM CTA SÓ. Sem segundo botão, sem link secundário concorrendo por
//    atenção — esse é o pedido explícito do fundador e o oposto do que a hero
//    de três portas fazia de propósito (ali, três eram a ideia certa; aqui,
//    um produto pede um pedido só).
// 2. PENSADA PRIMEIRO PARA CELULAR, sem quebra de dobra em NENHUM aparelho: o
//    título, a promessa, a prova de confiança e o botão cabem numa tela de
//    ~700px de altura sem rolar. Por isso o corpo é curto e o espaçamento
//    vertical é apertado no celular (pt-6/pb-8) e generoso só a partir de md.
// 3. NENHUMA PRIMITIVA DE ../motion QUE DEPENDA DE VIEWPORT. Esta seção nasce
//    acima da dobra: Reveal/Stagger/Counter gateiam em useOnce, que tem margem
//    NEGATIVA de 12% no topo (motion.tsx), e ficariam invisíveis aqui. Só as
//    CONSTANTES de ../motion entram (EASE, EASE_CSS, HAIR).
// 4. "GOAL, NOT A SALE." A licença (Founders Pack) É um produto e pode ser
//    comprada — mas o fundo de construção não é uma captação. A copy nunca
//    usa "sale", "raise" ou "investment"; usa "goal", "construction fund" e
//    "license", que é a linguagem já publicada pelo projeto.
//
// ⚠️ CORREÇÃO DE 2026-09-13 (masterplan.md §14). A primeira versão desta
// sub-linha dizia "to build on land the chain already assigned you", que só é
// verdade para as 85.818 carteiras do snapshot do bloco 966.670. Para quem
// compra $DOG hoje isso é falso: a cidade CRESCE EM ANÉIS (§14), nunca divide
// terreno com quem chega depois, e o lote de quem chega agora nasce no Anel 2,
// num bloco futuro ainda não anunciado. A hero vende a LICENÇA, que é igual
// para os dois públicos; qual anel cada carteira ocupa é assunto da seção
// ./two-paths.tsx, logo abaixo do funil.
// ═══════════════════════════════════════════════════════════════════════════

import { motion, useReducedMotion } from "framer-motion"
import { EASE, HAIR } from "../motion"

export default function HeroFunil() {
  const reduce = useReducedMotion()

  const entra = (delay: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 12, filter: "blur(5px)" },
          animate: { opacity: 1, y: 0, filter: "blur(0px)" },
          transition: { duration: 0.65, delay, ease: EASE },
        }

  return (
    <section id="offer" className="relative bg-void border-b border-white/10">
      <div className="max-w-3xl mx-auto px-6 md:px-10 pt-8 pb-9 md:pt-16 md:pb-16 text-center">
        <motion.p
          {...entra(0.02)}
          className="font-mono text-[10px] md:text-[11px] tracking-[0.28em] text-lava"
        >
          THE FOUNDERS PROGRAM
        </motion.p>

        <motion.h1
          {...entra(0.1)}
          className="font-display font-bold text-snow mt-3 md:mt-4 leading-[1.08] text-[27px] md:text-[46px]"
        >
          Get your license to build in DogCity.
        </motion.h1>

        <motion.p
          {...entra(0.18)}
          className="text-[13px] md:text-base text-mist mt-3 md:mt-4 leading-relaxed max-w-xl mx-auto"
        >
          A Founders Pack is a one-time license, tied to your own wallet, to build in DogCity.
          The city grows in rings and never divides, so there is room for you whether you were
          there from the start or you are arriving today. A construction fund working toward a
          goal, not a sale.
        </motion.p>

        <motion.div {...entra(0.26)} className="mt-6 md:mt-8">
          <a
            href="#build"
            className="inline-flex items-center justify-center gap-2 h-12 px-7 font-mono font-bold text-[13px] tracking-[0.1em]
                       bg-lava text-void hover:bg-lava-light transition-colors duration-200"
          >
            Get your Founders Pack
          </a>
        </motion.div>

        <motion.p
          {...entra(0.34)}
          className={`mt-5 md:mt-6 pt-4 md:pt-5 border-t ${HAIR} font-mono text-[9px] md:text-[10px] tracking-[0.14em] text-dusty`}
        >
          YOUR RING FOLLOWS YOUR WALLET'S HISTORY · THE CITY GROWS, IT NEVER DIVIDES
        </motion.p>
      </div>
    </section>
  )
}
