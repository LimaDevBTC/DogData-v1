"use client"

// ═══════════════════════════════════════════════════════════════════════════
// A HERO DAS TRÊS PORTAS.
//
// O que saiu e por quê: até 27/08 esta seção era um título sobre a cidade, dois
// botões e uma grade de QUATRO chapas iguais em 16/10. Três das quatro apontavam
// para o MESMO /city com um rótulo mono de 8px, e nenhuma tinha verbo, número ou
// hierarquia. O fundador leu o resultado como "um amontoado de coisa", e ele
// estava certo: aquilo eram LUGARES dentro de um produto vendidos como se
// fossem produtos.
//
// Os dados de acesso dizem que a casa tem TRÊS produtos: a cidade (/city), a
// batalha de preço (/city?view=war) e a galáxia (/galaxy). Os três agora abrem
// a página, lado a lado, cada um com um VERBO diferente (ENTER / WATCH / FIND),
// uma promessa de uma linha, um número VIVO e o custo de entrada dito em voz
// alta. As três não flutuam como cards: são um instrumento só, dividido por fio
// de cabelo de 1px, que é a mesma gramática de grade do quadro de missão de
// plaza-live.tsx e do quadro de leitura de galaxy.tsx.
//
// THE DIAMOND PAW, THE HIDDEN TEMPLE e DOG SOCIAL CLUB saíram daqui. Não somem
// do site: são lugares, e vivem na prateleira de chapas de plaza-live.tsx.
//
// ───────────────────────────────────────────────────────────────────────────
// ⚠️ REGRAS DURAS, todas já custaram caro neste projeto:
//
// 1. NENHUMA primitiva de ../motion entra aqui. Reveal, Stagger, StaggerItem,
//    SplitLine, Scramble, DrawRule e Counter gateiam todas em `useOnce`, que é
//    um IntersectionObserver com margem NEGATIVA de 12% no topo. Esta seção
//    nasce acima da dobra, ou seja dentro da zona morta, e ficaria invisível. O
//    Counter é o pior: sem `inView` ele renderiza format(0), e a página abriria
//    mostrando "0 WALLETS MAPPED". Número na hero é texto formatado por
//    toLocaleString, ponto. De ../motion entram só as CONSTANTES (EASE,
//    EASE_CSS, HAIR, GRIDLINE), que não têm gate nenhum.
//
// 2. AS TRÊS STRINGS DE DESTINO SÃO LOAD-BEARING. Estão comentadas uma a uma no
//    array PORTAS. Resumo:
//    · /city?view=home  — NUNCA /city cru. plaza-scene.tsx:452 tem
//      `entradaGuerra = !viewParam && !emLite`: sem parâmetro a câmera cai em
//      'warentry', ou seja EM CIMA DA BATALHA. Sem o ?view=home as portas 01 e
//      02 abririam no mesmo primeiro quadro e a promessa da hero morre.
//    · /city?view=war   — a batalha DENTRO do mundo.
//    · /galaxy
//
// 3. /city/war É PROIBIDO. O palco solo existe só para o navegador de carteira,
//    onde a cidade inteira não roda. Mandar quem está no desktop para lá tira a
//    pessoa do mundo: ela vê a guerra sem cidade em volta e sem para onde ir.
//
// 4. border-white/8 e border-white/12 NÃO COMPILAM nesta escala de opacidade
//    (a do projeto é a padrão, múltiplos de 5) e caem no #D1D5DB do preflight,
//    pintando fio cinza CLARO em página preta. Usar HAIR/GRIDLINE de ../motion
//    ou a forma de valor arbitrário border-white/[0.12].
//
// 5. ⚠️ O ZOOM DE ENQUADRAMENTO É transform-origin, NÃO object-position. No CSS
//    o object-fit roda no LAYOUT e o transform roda DEPOIS, em torno do centro
//    da caixa: um `scale()` re-centraliza o quadro e ROUBA quase toda a
//    alavanca do object-position. Fazer a conta na ordem errada foi o que quase
//    deixou o rótulo "24H HIGH 0.001960" (que era assado na chapa velha da
//    guerra) sobreviver ao corte. `transform: scale(z)` com transform-origin no
//    ponto de foco quer dizer literalmente "amplia z vezes em volta deste ponto
//    do quadro", e isso é previsível em qualquer proporção de janela.
//
// 6. A chapa da guerra é plaza-war-front.webp, um recorte 16:9 (667x375) da
//    plaza-war.webp que exclui na FONTE o rótulo "24H HIGH 0.001960". Aquele
//    texto não era HUD e ?plate=1 não o removia: é um THREE.Sprite da régua do
//    campo (app/city/war/battlefield.ts:2261). Um preço velho gravado na imagem
//    logo acima de um medidor VIVO do mesmo número era o único jeito de esta
//    hero mentir.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useState, type CSSProperties } from "react"
import Image from "next/image"
import Link from "next/link"
import { motion, useReducedMotion } from "framer-motion"
import { EASE, EASE_CSS, HAIR, GRIDLINE } from "../motion"
import { useMempoolFeed } from "../use-mempool"
import { useTreeSummary } from "../use-tree-summary"
import { GALAXY, formatDog } from "../dogcity-data"

// ── o ticker da batalha ────────────────────────────────────────────────────
// ⚠️ /api/war/ticker devolve HTTP 200 COM CORPO { error } quando a Kraken falha
// (route.ts:29). r.ok não basta: sem a checagem de Number.isFinite em CADA
// campo, a barra de faixa vai para NaN e o painel quebra em silêncio.
interface Ticker {
  last: number
  low24: number
  high24: number
  open: number
}

const numOk = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v)

function useWarTicker(): Ticker | null {
  const [t, setT] = useState<Ticker | null>(null)
  useEffect(() => {
    let vivo = true
    let timer: ReturnType<typeof setTimeout> | null = null
    const puxa = async () => {
      try {
        const r = await fetch("/api/war/ticker", { signal: AbortSignal.timeout(8000) })
        if (r.ok) {
          const j = await r.json()
          if (vivo && numOk(j?.last) && numOk(j?.low24) && numOk(j?.high24) && j.last > 0) {
            setT({ last: j.last, low24: j.low24, high24: j.high24, open: numOk(j.open) ? j.open : j.last })
          }
        }
      } catch {
        // sem dado o medidor cai num texto honesto; a última leitura fica
      }
      // a rota já cacheia 60 s na borda: bater mais rápido só gasta
      if (vivo) timer = setTimeout(() => void puxa(), 60_000)
    }
    void puxa()
    return () => {
      vivo = false
      if (timer) clearTimeout(timer)
    }
  }, [])
  return t
}

// ── as três portas ─────────────────────────────────────────────────────────
// zl/fl = zoom e foco no desktop; zs/fs = no celular. Os dois pares viram
// variáveis CSS e trocam na media query de lg (ver o <style> da seção). Por que
// não dois <Image>: um segundo elemento escondido com display:none continua
// baixando a chapa, e isso seriam três downloads a mais na primeira dobra.
const PORTAS = [
  {
    idx: "01",
    nome: "DOGCITY",
    verbo: "ENTER",
    // ⚠️ NUNCA /city cru: sem ?view= a câmera entra em cima da batalha
    // (plaza-scene.tsx:452) e esta porta abriria no mesmo quadro da porta 02.
    href: "/city?view=home",
    src: "/landing/plaza/plaza-home.webp",
    alt: "Satoshi Plaza on the Moon: the Needle at the centre of the deck, Kray Tower and BitFlow HQ on the ring, DOG ships in orbit above",
    // a chapa tem céu preto vazio no alto; o foco desce para o disco da praça
    zl: 1.16, fl: "50% 64%",
    zs: 1.75, fs: "52% 60%",
    promessa: "Satoshi Plaza on real Mare Tranquillitatis terrain, with the DOG mempool flying over it.",
    custoLg: "OPENS THE 3D CITY · RUNS ON A PHONE",
    custoSm: "THE 3D CITY, ON A PHONE",
    cta: "Enter the city",
    primaria: true,
  },
  {
    idx: "02",
    nome: "THE PRICE WAR",
    verbo: "WATCH",
    // ⚠️ A BATALHA DA VITRINE É A DA CIDADE. /city/war é o palco solo, feito
    // para o navegador de carteira, onde a cidade inteira não roda.
    href: "/city?view=war",
    src: "/landing/plaza/plaza-war-front.webp",
    alt: "The war crater at night: Shiba soldiers on the left and bears on the right, a fire column rising at the front line over the price rails",
    // recorte já apertado na fonte: no desktop não precisa de mais zoom
    zl: 1.0, fl: "50% 50%",
    zs: 1.45, fs: "46% 52%",
    promessa: "The live Kraken order book fought as a battle in the crater: dogs against bears.",
    custoLg: "OPENS INSIDE THE CITY, AT THE CRATER",
    custoSm: "INSIDE THE CITY, THE CRATER",
    cta: "Watch the battle",
    primaria: false,
  },
  {
    idx: "03",
    nome: "$DOG GALAXY",
    verbo: "FIND",
    href: "/galaxy",
    // ⚠️ NÃO trocar por galaxy-fan.webp: aquela é o pagamento do díptico da
    // seção Galaxy mais abaixo ("o mesmo céu, um clique depois"), e queimar o
    // depois aqui mata a seção. NÃO usar /holders/galaxy-banner.webp: é 3.2:1,
    // não cabe numa janela 16:9.
    src: "/landing/galaxy/galaxy-shells.webp",
    alt: "The $DOG Galaxy at rest: a bright core of airdrop wallets surrounded by concentric shells of orange points, one point per wallet",
    // a chapa é ~85% preta com o núcleo pequeno e centrado: a 1.0 a esfera
    // teria 53px numa caixa de 356 e a célula leria como VAZIA ao lado da
    // guerra saturada
    zl: 1.8, fl: "48% 50%",
    zs: 2.4, fs: "48% 50%",
    // escrita de propósito DIFERENTE do <h2> de galaxy.tsx ("Every wallet DOG
    // ever touched, in one sky."): repetir palavra por palavra uma tela abaixo
    // é o amontoado mudando de andar
    promessa: "Every address the rune ever passed through, drawn as one sky. Point size is the balance.",
    custoLg: "ONE CLICKABLE POINT PER WALLET · FIND YOURS",
    custoSm: "ONE POINT PER WALLET",
    cta: "Find your wallet",
    primaria: false,
  },
] as const

const en = (n: number) => n.toLocaleString("en-US")

export default function HeroLive() {
  const reduce = useReducedMotion()
  const { feed } = useMempoolFeed()
  const s = feed?.snapshot ?? null
  const t = useWarTicker()
  const arvore = useTreeSummary()

  // ⚠️ SEM DADO, NUNCA ZERO E NUNCA "—" SOZINHO. A porta 03 abre no primeiro
  // quadro de ../dogcity-data (a árvore só cresce, então o número envelhece
  // para baixo e nunca vira mentira) e as outras duas caem num texto honesto.
  const wallets = arvore ? arvore.wallets : GALAXY.wallets
  const holders = arvore ? arvore.holders : GALAXY.holding

  // a faixa do dia: onde a linha de frente está entre o low e o high de 24h
  const faixaOk = t !== null && t.high24 > t.low24
  const pct = faixaOk ? Math.min(100, Math.max(0, ((t.last - t.low24) / (t.high24 - t.low24)) * 100)) : 0
  const subindo = t !== null && t.last >= t.open

  // Cada porta carrega um TIPO DE PROVA diferente, e isso é deliberado: a
  // cidade conta coisas em movimento (um evento), a guerra dá uma posição dentro
  // de uma faixa (uma medição) e a galáxia dá magnitude (um censo). Três
  // espécies de número, três espécies de objeto.
  const medidores = {
    "01": {
      rotulo: "UNCONFIRMED DOG NOW",
      lg: !s ? (
        <span className="text-mist">Reading the node.</span>
      ) : s.dog_pending === 0 ? (
        <span className="text-mist">No DOG transaction waiting in the mempool.</span>
      ) : (
        <>
          <span className="text-lava">{s.dog_pending}</span> {s.dog_pending === 1 ? "tx" : "txs"} ·{" "}
          <span className="text-lava">{formatDog(s.dog_pending_amount)}</span> DOG
        </>
      ),
      sm: !s ? (
        "Reading the node."
      ) : s.dog_pending === 0 ? (
        "No DOG waiting in the mempool"
      ) : (
        <>
          <span className="text-lava">{s.dog_pending}</span> {s.dog_pending === 1 ? "tx" : "txs"} ·{" "}
          <span className="text-lava">{formatDog(s.dog_pending_amount)}</span> DOG
        </>
      ),
      aria: s && s.dog_pending > 0 ? `${s.dog_pending} unconfirmed DOG transactions right now` : "the DOG mempool, live",
    },
    "02": {
      rotulo: "THE FRONT LINE",
      lg: !t ? (
        <span className="text-mist">Kraken is quiet. The crater is still there.</span>
      ) : (
        <>
          <span className="text-lava">${t.last.toFixed(6)}</span>
          {faixaOk ? <> · {Math.round(pct)}% of today&apos;s range</> : null}{" "}
          {/* ⚠️ NADA DE VERDE E VERMELHO: verde nesta casa é status, e o azul da
              paleta virando o urso casa com a metáfora do campo de batalha. */}
          <span aria-hidden className={subindo ? "text-lava" : ""} style={subindo ? undefined : { color: "#4A90D9" }}>
            {subindo ? "▲" : "▼"}
          </span>
        </>
      ),
      sm: !t ? (
        "Kraken is quiet"
      ) : (
        <>
          <span className="text-lava">${t.last.toFixed(6)}</span>
          {faixaOk ? <> · {Math.round(pct)}% of range</> : null}
        </>
      ),
      aria: t ? `the live order book, DOG at ${t.last.toFixed(6)} dollars` : "the live order book",
    },
    "03": {
      rotulo: "WALLETS MAPPED",
      lg: (
        <>
          <span className="text-lava">{en(wallets)}</span> · {en(holders)} still holding
        </>
      ),
      sm: (
        <>
          <span className="text-lava">{en(wallets)}</span> · {en(holders)} holding
        </>
      ),
      aria: `${en(wallets)} wallets mapped`,
    },
  }

  const entra = (delay: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 14, filter: "blur(5px)" },
          animate: { opacity: 1, y: 0, filter: "blur(0px)" },
          transition: { duration: 0.7, delay, ease: EASE },
        }

  return (
    <section className="relative bg-void border-b border-white/10">
      {/* ⚠️ ESTE BLOCO NÃO É DECORAÇÃO, é o que o Tailwind não sabe fazer aqui.
          (a) o zoom da chapa troca no lg, e o valor é POR PORTA: classe
          arbitrária montada em template string não é vista pelo JIT, então os
          quatro valores viajam como variáveis CSS inline e a media query só
          escolhe qual par usar;
          (b) o MODO COMPACTO é por ALTURA de viewport, e a escala de `h-` do
          Tailwind não tem variante de max-height. Num 1366x768 sobram 546px
          depois do cromo fixo (header 64 + banner 122 + faixa da mempool 36 =
          222): sem encolher, os CTAs das portas caem FORA da dobra. */}
      <style>{`
        .porta-chapa { transform: scale(var(--zs)); transform-origin: var(--fs); }
        @media (min-width: 1024px) {
          .porta-chapa { transform: scale(var(--zl)); transform-origin: var(--fl); }
        }
        @media (min-width: 1024px) and (max-height: 820px) {
          .hero-caixa { padding-top: 1rem; }
          .hero-titulo { font-size: 36px; }
          .porta-janela { aspect-ratio: 2 / 1; }
          .porta-promessa, .porta-custo { display: none; }
        }
        /* O MESMO modo compacto, do lado do celular. Num aparelho classe
           iPhone SE sobram 553px de janela, e mesmo depois do aperto de 27/08 a
           terceira tira comecava em 557 — quatro pixels abaixo da dobra, ou
           seja invisivel por um triz. Isto aperta SO espacamento e corpo de
           titulo, nunca conteudo: a sub-linha continua ali, porque "no wallet,
           no signup" e a frase de conversao mais barata da pagina e some-la pra
           ganhar pixel seria trocar a mensagem pelo enquadramento. Com o aperto
           a tira passa a comecar em ~529 e aparece; nao cabe inteira, e nao tem
           como caber sem encolher o banner pago, que nao e decisao de layout. */
        @media (max-width: 1023px) and (max-height: 620px) {
          .hero-caixa { padding-top: 0.5rem; }
          .hero-titulo { font-size: 25px; margin-top: 0.5rem; }
          .hero-sub { margin-top: 0.5rem; }
          .hero-portas { margin-top: 0.625rem; }
        }
        @media (prefers-reduced-motion: reduce) {
          .porta-fio { transform: scaleX(1); opacity: 0.3; }
          .porta-chapa, .porta-zoom { transition: none; }
        }
      `}</style>

      {/* o mesmo max-w-6xl mx-auto px-6 md:px-10 de TODAS as seções abaixo. A
          hero era a única full bleed com tudo abaixo dela contido: a página
          começava torta, e só esse alinhamento já resolve metade da sensação de
          amontoado. */}
      <div className="hero-caixa max-w-6xl mx-auto px-6 md:px-10 pt-3.5 md:pt-8 pb-8 md:pb-10">

        {/* ── BANDA A: o masthead ──────────────────────────────────────────── */}
        <motion.div
          {...(reduce
            ? {}
            : {
                initial: { opacity: 0, y: 10 },
                animate: { opacity: 1, y: 0 },
                transition: { duration: 0.6, delay: 0.05, ease: EASE },
              })}
        >
          <p className="font-mono text-[10px] lg:text-[11px] tracking-[0.28em] lg:tracking-[0.3em] text-lava">
            DOG DATA · ALL THREE ARE OPEN
          </p>
          {/* fio estático: DrawRule gateia em viewport e aqui é zona morta */}
          <span aria-hidden className="block h-px w-14 bg-lava mt-2.5 lg:mt-3" />
          <h1 className="hero-titulo font-display font-bold text-snow mt-3 lg:mt-4 leading-[1.03] text-[29px] lg:text-[44px]">
            A city, a war and a galaxy.
          </h1>
          {/* A promessa é a mesma nos dois tamanhos, escrita em dois comprimentos.
              ⚠️ NÃO unificar de volta numa string só: a longa quebra em TRÊS
              linhas num iPhone (medido a 13px em 345px de caixa), e essas ~21px
              são a diferença entre a terceira porta caber na dobra ou não. A
              versão curta guarda as duas metades que fazem trabalho — "três
              coisas vivas" e "não custa nada entrar"; o que sai é só o reforço.
              As três portas logo abaixo explicam o que cada coisa é, então a
              hero não repete nenhuma delas. */}
          <p className="hero-sub text-[13px] md:text-[15px] text-mist mt-2.5 md:mt-4 max-w-2xl leading-relaxed">
            <span className="lg:hidden">Three live views of $DOG. No wallet, no signup.</span>
            <span className="hidden lg:inline">
              Three live views of $DOG, all open right now. No wallet, no signup, nothing to install.
            </span>
          </p>
        </motion.div>

        {/* ── BANDA B: as três portas ──────────────────────────────────────── */}
        {/* Abaixo de lg são TIRAS horizontais, não cards empilhados: três cards
            de 340px dariam 1020px e a terceira porta ficaria a mil pixels da
            dobra, que é o oposto exato do pedido. Em md (768) uma coluna de
            228px seria estreita demais para o bloco de texto; a grade só entra
            em lg (1024), onde cada coluna dá 356px. */}
        <div className={`hero-portas mt-4 lg:mt-6 grid lg:grid-cols-3 gap-px ${GRIDLINE} border ${HAIR}`}>
          {PORTAS.map((p, i) => {
            const m = medidores[p.idx]
            return (
              <motion.div key={p.idx} className="relative bg-void" {...entra(0.18 + i * 0.08)}>
                {/* a marca da porta primária: barra ABSOLUTA, não border, para
                    não empurrar o conteúdo. É a assimetria que impede a grade
                    de ler como grade de iguais. */}
                {p.primaria && (
                  <span
                    aria-hidden
                    className="absolute z-10 inset-y-0 left-0 w-[2px] bg-lava
                               lg:bottom-auto lg:top-0 lg:right-0 lg:h-[2px] lg:w-auto"
                  />
                )}
                <Link
                  href={p.href}
                  aria-label={`${p.cta}: ${p.nome}, ${m.aria}`}
                  className="group flex h-full flex-row items-center gap-3 p-2.5
                             lg:flex-col lg:items-stretch lg:gap-0 lg:p-0
                             focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-lava"
                >
                  {/* (a) A JANELA DA CHAPA. Sem texto nenhum dentro: sem chip,
                      sem legenda, sem backdrop-blur. A identidade da porta mora
                      no bloco chapado embaixo, e assim a regra de "nada de vidro
                      sobre fundo ocupado" sai de graça, sem véu nenhum. */}
                  <span
                    className={`porta-janela relative shrink-0 overflow-hidden bg-void border ${HAIR}
                                w-[96px] h-[64px] sm:w-[150px] sm:h-[98px]
                                lg:w-full lg:h-auto lg:aspect-[16/9] lg:border-0 lg:border-b`}
                  >
                    {/* dois transforms aninhados de propósito: o de
                        ENQUADRAMENTO vive no <Image> e o de HOVER vive no pai.
                        No mesmo elemento um sobrescreveria o outro; aninhados,
                        eles se multiplicam. */}
                    <span
                      className="porta-zoom absolute inset-0 transition-transform duration-[1400ms] lg:group-hover:scale-[1.04]"
                      style={{ transitionTimingFunction: EASE_CSS }}
                    >
                      <Image
                        src={p.src}
                        alt={p.alt}
                        fill
                        priority={i === 0}
                        sizes="(min-width: 1024px) 360px, (min-width: 640px) 150px, 96px"
                        className="porta-chapa object-cover"
                        style={{ "--zl": p.zl, "--fl": p.fl, "--zs": p.zs, "--fs": p.fs } as CSSProperties}
                      />
                    </span>
                    {/* o único enfeite in-frame: a porta abrindo. No celular ele
                        responde a active:, não a hover. */}
                    <span
                      aria-hidden
                      className="porta-fio absolute inset-x-0 bottom-0 h-px bg-lava origin-left scale-x-0
                                 transition-transform duration-500 group-active:scale-x-100 lg:group-hover:scale-x-100"
                      style={{ transitionTimingFunction: EASE_CSS }}
                    />
                  </span>

                  {/* a coluna de texto. LARGURA REMEDIDA no iPhone de 390 depois
                      do aperto de 27/08: 390 menos px-6 (48) menos a borda (2)
                      menos p-2.5 dos dois lados (20) menos a imagem (96) e o gap
                      (12) = 212px, doze a MAIS que antes — a tira encolheu na
                      altura e sobrou na largura. A 11px em mono dá ~6,6px por
                      caractere, ou seja 32 caracteres; as variantes sm do medidor
                      e do custo têm no máximo 27, então continuam numa linha. */}
                  <span className="min-w-0 flex-1 flex flex-col lg:w-full">

                    {/* (b) A LINHA DO NOME. Os três verbos são o coração da
                        coisa: ENTER / WATCH / FIND é a forma mais rápida de
                        dizer "aqui tem três coisas DIFERENTES para fazer". As
                        quatro miniaturas de ontem não tinham verbo nenhum. */}
                    <span className="flex items-baseline gap-2 lg:gap-3 lg:px-5 lg:pt-4">
                      <span aria-hidden className="hidden lg:inline font-mono text-[10px] tracking-[0.25em] text-dusty">
                        {p.idx}
                      </span>
                      <h2 className="font-display font-bold text-snow leading-none text-[15px] lg:text-[21px]">
                        {p.nome}
                      </h2>
                      <span className="ml-auto font-mono text-[9px] tracking-[0.2em] lg:tracking-[0.25em] text-lava">
                        {p.verbo}
                      </span>
                    </span>

                    {/* (c) A PROMESSA, só de lg para cima. O min-h alinha os
                        medidores das três portas na mesma altura mesmo com
                        frases de tamanhos diferentes; sem ele os três painéis
                        desalinham e voltam a parecer cards soltos. */}
                    {/* ⚠️ o line-clamp e o `hidden lg:block` NÃO podem viver na
                        mesma tag: line-clamp-2 precisa de display:-webkit-box e
                        lg:block sobrescreveria o display. Daí o invólucro. */}
                    <span className="porta-promessa hidden lg:block px-5 mt-2.5">
                      <span className="text-[13px] text-mist leading-relaxed min-h-[2.9em] line-clamp-2">
                        {p.promessa}
                      </span>
                    </span>

                    {/* (d) O MEDIDOR VIVO */}
                    <span className="font-mono lg:mx-5 lg:mt-3 lg:pt-2.5 lg:border-t lg:border-white/10">
                      <span aria-hidden className="hidden lg:block text-[9px] tracking-[0.25em] text-dusty">
                        {m.rotulo}
                      </span>
                      <span className="block lg:hidden text-[11px] text-mist mt-1.5 truncate">{m.sm}</span>
                      <span className="hidden lg:block text-[12px] text-snow mt-1.5 leading-snug">{m.lg}</span>
                      {/* a barra de faixa: o único gráfico da hero, e o melhor
                          pedaço da porta 02, porque ela DESENHA a linha de
                          frente (a metáfora do produto) num elemento 2D de 3px.
                          Sem faixa válida ela some e sobra só o preço. */}
                      {p.idx === "02" && t && faixaOk && (
                        <span aria-hidden className="hidden lg:block">
                          <span className="block mt-2 h-[3px] bg-[#3A3F4A] relative">
                            <span className="absolute top-0 h-full w-[2px] bg-lava" style={{ left: `${pct}%` }} />
                          </span>
                          <span className="mt-1 flex justify-between text-[9px] text-dusty tabular-nums">
                            <span>{t.low24.toFixed(6)}</span>
                            <span>{t.high24.toFixed(6)}</span>
                          </span>
                        </span>
                      )}
                    </span>

                    {/* (e) O CUSTO DE ENTRADA: diz literalmente o que acontece
                        no clique. Ninguém clica num link 3D sem saber o que vai
                        abrir. */}
                    <span className="porta-custo block truncate font-mono text-dusty leading-relaxed
                                     text-[9px] tracking-[0.15em] mt-1
                                     lg:mx-5 lg:mt-3 lg:text-[10px]">
                      <span className="lg:hidden">{p.custoSm}</span>
                      <span className="hidden lg:inline">{p.custoLg}</span>
                    </span>

                    {/* (f) O CTA. Uma primária e duas secundárias: as três são
                        óbvias, mas existe um caminho recomendado. Três botões
                        laranja brigariam e o olho voltaria a não ter onde
                        pousar. No celular a TIRA INTEIRA é o alvo (94px de
                        altura), então o botão não existe.
                        ⚠️ <span>, nunca <a>: isto vive DENTRO de um Link. */}
                    <span className="hidden lg:block mt-auto p-4">
                      <span
                        className={`flex h-10 items-center justify-center gap-2
                                    font-mono text-[12px] font-bold tracking-[0.14em] transition-colors ${
                                      p.primaria
                                        ? "bg-lava text-void group-hover:bg-lava-light"
                                        : "border border-white/25 text-snow group-hover:border-lava group-hover:text-lava"
                                    }`}
                      >
                        {p.cta}
                      </span>
                    </span>
                  </span>
                </Link>
              </motion.div>
            )
          })}
        </div>

        {/* ── BANDA C: a saída discreta ────────────────────────────────────── */}
        {/* O botão grande BUILD DOGCITY sai da hero. O fólio de construção
            inteiro continua abaixo e a pílula flutuante que page.tsx portala
            continua apontando para #build a partir do primeiro scroll: o funil
            de financiamento só perde peso de hero, que é exatamente o que ele
            tinha que perder para caber três produtos. */}
        <div className="hidden md:flex items-center gap-3 mt-5 font-mono text-[11px] tracking-[0.14em] text-dusty">
          <span>Want to help build it?</span>
          <a href="#build" className="text-lava hover:text-lava-light transition-colors">
            BUILD DOGCITY ↓
          </a>
        </div>
      </div>
    </section>
  )
}
