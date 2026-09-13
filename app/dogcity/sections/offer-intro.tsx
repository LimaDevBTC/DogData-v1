"use client"

// ═══════════════════════════════════════════════════════════════════════════
// DOBRA 4, A OFERTA — a frase de abertura (marketing/LANDING-V3-DESENHO.md).
//
// Só agora a licença faz sentido: quem chegou até aqui já viu a dobra 1 (o
// veredicto sobre a própria carteira), a dobra 2 (a prova) e a dobra 3 (o
// mapa real). "You own the land" deixou de ser uma alegação e virou um fato
// que a pessoa já verificou sobre si mesma duas dobras atrás.
//
// Este arquivo é só o cabeçalho de duas linhas; <ConstructionFund />,
// <Tiers /> e <FoundersRegister /> (já existentes desde a v2, ver page.tsx)
// continuam sendo o corpo da oferta e não foram tocados.
//
// ⚠️ "A goal, not a sale. A construction fund, not a raise." A licença É um
// produto e pode ser comprada; o fundo de construção NÃO é uma captação. As
// duas frases nunca se misturam.
// ═══════════════════════════════════════════════════════════════════════════

export default function OfferIntro() {
  return (
    <div className="max-w-3xl mx-auto px-6 md:px-10 pt-14 md:pt-16 text-center">
      <p className="font-mono text-[10px] md:text-[11px] tracking-[0.28em] text-lava">THE FOUNDERS PROGRAM</p>
      <h2 className="font-display font-bold text-snow mt-2.5 text-2xl md:text-4xl leading-tight">
        You own the land. The licence is what lets you build on it.
      </h2>
      <p className="text-[13px] md:text-base text-mist mt-3 leading-relaxed max-w-xl mx-auto">
        A construction fund working toward a goal, not a sale.
      </p>
    </div>
  )
}
