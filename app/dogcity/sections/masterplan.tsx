"use client"

// ═══════════════════════════════════════════════════════════════════════════
// THE MASTERPLAN — one city, three chains.
//
// The audit called this the weakest section on the page: a map story told with
// one static reused image and four numbers, sitting directly under another
// 16:9 plate with identical framing. It had no interaction at all.
//
// THE MECHANISM — you survey the plate with a torch.
// The aerial plate sits under a near-black veil at ~10% visibility. A soft
// radial hole in that veil follows the pointer, so the city is not shown to
// you — you have to go and find it. On a page whose hero is 500vh of "your
// scroll builds the city", the map section earning its reveal from the
// visitor's own hand is the honest continuation of that idea.
//
// THE READOUT IS HONEST BY CONSTRUCTION.
// It would be easy — and a lie — to print selenographic offsets or metre
// distances under the cursor: we do not know this render's true scale. So the
// grid the readout references is visibly OUR OWN: columns A–L, rows 01–08,
// drawn over the plate. `GRID F-04` is then true by construction, and the page
// keeps its surveyor's voice without inventing a measurement.
//
// PERF / SAFETY
//   · ONE rAF, and it is pointer-gated: it starts on pointerenter, runs the
//     presence tween down on pointerleave, then cancels. An IntersectionObserver
//     hard-stops it if the plate is scrolled away mid-hover.
//   · The mask is written straight to element.style — never through React state.
//   · Coarse pointers (no cursor) get no torch and no crosshair: the veil
//     irises open once, from the centre, on first entry.
//   · Reduced motion renders the plate at full visibility, grid static,
//     counters and share bars at their final values.
//   · The plate is a reserved aspect-[16/9] box that never changes size after
//     layout — the hero's body-portal geometry depends on that.
//
// Every string, number, id and the fine print are verbatim from the markup
// this replaces and from dogcity-data.ts.
// ═══════════════════════════════════════════════════════════════════════════

// ⚠️ A LISTA DE IMPORTS ENCOLHEU JUNTO COM A CHAPA. React hooks, next/image e
// framer-motion existiam SÓ para o facho de luz da `SurveyPlate`; deixá-los aqui
// depois dela quebraria o lint do build e, pior, sugeriria que ainda há
// interação nesta seção.
import { DrawRule, HAIR, HAIR_SOFT, Reveal, Scramble, SplitLine } from "../motion"

// ── the section-head grammar — identical in every sheet of the folio ────────
function SectionHead({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  return (
    <div className="max-w-2xl">
      <Scramble text={eyebrow} className="font-mono text-[11px] tracking-[0.3em] text-lava" />
      <DrawRule className="mt-3 w-14" delay={0.06} duration={0.9} />
      <h2 className="font-display font-bold text-3xl md:text-4xl text-snow mt-4 leading-tight">
        <SplitLine text={title} delay={0.12} step={0.055} className="pb-[0.12em]" />
      </h2>
      {sub && (
        <Reveal delay={0.34} y={14}>
          <p className="text-sm text-mist mt-3 leading-relaxed">{sub}</p>
        </Reveal>
      )}
    </div>
  )
}

// ── the registration corner — team SKYLINE's shared mark ───────────────────
// Four L-ticks struck INSIDE a plate's hairline before its contents ink in.
// Duplicated per file on purpose: motion.tsx is frozen this pass.
// ⚠️ LÁPIDE: A CHAPA DA CIDADE 3D SAIU DAQUI EM 11/09.
//
// Havia neste arquivo uma `SurveyPlate` de 215 linhas — grade de levantamento,
// cantoneiras, e um facho de luz que o ponteiro arrastava por cima de um véu
// preto — montada em volta de `/landing/hero.webp`. A maquinaria era boa; a
// imagem não era mais verdade. Aquele quadro é a cidade PROCEDURAL de antes do
// pivô lunar: aglomerado em estrela, sem abóbada, sem baía, sem alça, sem
// dodecágono e sem uma única via que exista hoje. O fundador chamou de "bem
// arcaica" e mandou sair, com razão: numa página que abre com a carta da cidade
// de verdade, a chapa antiga contradizia a hero três telas abaixo.
//
// Ela NÃO foi substituída por outra imagem aqui. O mapa vive na hero, no alto
// desta mesma página, e repeti-lo a meio caminho seria dizer duas vezes a mesma
// coisa — e a segunda vez, menor. Esta seção volta a ser o que o nome dela diz:
// a REGRA. O terreno que ela afirma seguir está desenhado na seção logo acima
// (`<LunarTerrain />`), que é o certificado de levantamento.
//
// O arquivo `public/landing/hero.webp` foi apagado junto: 391 KB de um render
// que nenhuma outra tela usava.



// ═══════════════════════════════════════════════════════════════════════════
export default function Masterplan() {
  return (
    <section className={`relative border-t ${HAIR_SOFT}`}>
      <DrawRule className="absolute -top-px left-0 w-24" duration={1.0} />

      {/* ⚠️ O PADDING ENCOLHEU COM A CHAPA. Com a `SurveyPlate` no meio, py-28
          emoldurava uma imagem grande; sem ela, o mesmo respiro deixava três
          frases boiando num vão de tela inteira, e a seção lia como buraco em
          vez de afirmação. Folha de declaração é curta de propósito. */}
      <div className="max-w-6xl mx-auto px-6 md:px-10 py-14 md:py-20">
        <SectionHead
          eyebrow="THE MASTERPLAN"
          title="The city follows the terrain."
          sub="Organic districts radiate from the Central Event Plaza. Placement is read from Bitcoin, at one block height, for every wallet at once."
        />

        {/* ⚠️ AQUI HAVIA UMA GRADE DE QUATRO CONTAGENS com barras de participação
            (total de lotes, e a fatia de BTC, SOL e STX). Ela saiu inteira em
            04/09, e não foi substituída por outra contagem de propósito:
            quantos lotes existem, que área cada um tem e que forma ele toma são
            RESULTADOS do snapshot no bloco 966.670. A única coisa que esta
            seção pode afirmar antes do bloco é a REGRA. O terreno está no
            certificado de levantamento logo acima, e o plano da cidade está na
            hero, no alto da página. Ver o comentário de LOT_SEGMENTATION em
            ../dogcity-data.ts para a regra completa. */}
        <Reveal delay={0.4} y={10}>
          <div className={`mt-8 border-t ${HAIR_SOFT} pt-5 flex flex-wrap items-baseline gap-x-6 gap-y-2`}>
            <p className="font-mono text-[10px] text-dusty max-w-xl leading-relaxed">
              The ground is surveyed and the plan is drawn. How many lots, how large
              and what shape are answered by block 966,670, not before it.
            </p>
            {/* navegação, não afirmação nova: a carta está no alto desta página */}
            <a
              href="#snapshot"
              className="font-mono text-[10px] tracking-[0.14em] text-lava hover:text-lava-light"
            >
              ↑ SEE THE CITY PLAN
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
