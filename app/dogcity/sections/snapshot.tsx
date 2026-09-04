"use client"

// ═══════════════════════════════════════════════════════════════════════════
// O SNAPSHOT. A hero da janela do bloco 966.670.
//
// Esta seção nasceu em 04/09, no dia em que o snapshot deixou de ser uma data
// e virou uma ALTURA. O anúncio público saiu apontando para
// `dogdata.xyz/dogcity#snapshot`, e essa âncora não existia em lugar nenhum:
// todo mundo que clicava caía no topo de uma página que não dizia uma palavra
// sobre snapshot. Este arquivo é a âncora e é a resposta.
//
// ⚠️ REGRAS DURAS. Todas já custaram caro neste projeto ou nesta página.
//
// 1. NENHUMA PRIMITIVA DE ../motion ENTRA AQUI. Reveal, Stagger, StaggerItem,
//    SplitLine, Scramble, DrawRule e Counter gateiam em `useOnce`, que é um
//    IntersectionObserver com margem NEGATIVA de 12% no topo. Esta seção nasce
//    acima da dobra, dentro da zona morta, e ficaria invisível. O Counter é o
//    pior caso: sem `inView` ele renderiza format(0), e a página abriria
//    escrita "0 BLOCKS TO GO", que é literalmente a pior mentira possível
//    aqui, porque anuncia que o snapshot já aconteceu. De ../motion entram só
//    as CONSTANTES, que não têm gate nenhum.
//
// 2. O NÚMERO GRANDE É BLOCO, NUNCA HORA. Achado de bloco é um processo de
//    Poisson: com 1.148 blocos de distância o desvio padrão do tempo até o
//    alvo é 10 min × √1148 ≈ 5,6 HORAS. Uma contagem regressiva em segundos
//    seria lida como compromisso e estaria errada por quase um dia inteiro em
//    qualquer direção. A altura é o compromisso, a hora é palpite, e a
//    hierarquia tipográfica aqui existe para dizer isso sem precisar de nota
//    de rodapé.
//
// 3. A ESTIMATIVA NÃO TIQUETAQUEIA. Ela é texto estático recalculado quando a
//    ponta da chain anda. Um relógio decrescente é indistinguível de uma
//    promessa, por mais que o rótulo diga "estimate".
//
// 4. A PRECISÃO DIMINUI COM A DISTÂNCIA (ver `estimativa`). Longe do alvo a
//    página fala em dia; perto, em hora. Um instrumento honesto perde casas
//    decimais quando não as tem.
//
// 5. NUNCA ZERO, NUNCA "—" SOZINHO. Sem `tip_height` a seção cai em texto, não
//    em número. Mesma regra de hero-live.tsx:200 e use-tree-summary.ts:16.
//
// 6. O FEED É O SINGLETON DE ../use-mempool. Não abrir fetch próprio: até
//    27/08 a landing rodava duas enquetes de 20 s no mesmo endpoint porque uma
//    seção tinha cópia colada do hook, e depois do incidente de IO de 26/08
//    isso não passa. `tip_height` já vem de graça no feed que a página inteira
//    consome, então o countdown custa zero rede.
//
// 7. O QUE SE MEXE É O BLOCO EM CURSO, NÃO A ESTIMATIVA. O número de blocos
//    restantes muda a cada ~10 minutos, então sozinho ele é uma imagem, e o
//    fundador leu a primeira versão como "muito parada". A resposta NÃO é
//    animar o número nem pôr um relógio regressivo em segundos, que é
//    justamente o que a regra 2 proíbe. É mostrar o que de fato está
//    acontecendo no intervalo: a rede está minerando o próximo bloco AGORA, e
//    o tempo desde a última ponta corre de verdade. Esse é o pulso, ele é
//    medido contra `tip_time` do nosso nó, e ele é honesto porque cresce em
//    vez de prometer.
//
//    ⚠️ DOIS RELÓGIOS, DOIS RITMOS, DE PROPÓSITO. `relogio` bate a cada
//    segundo e alimenta SÓ o bloco em curso. `agora` só se move quando a ponta
//    da chain anda, e alimenta SÓ a estimativa. Ligar a estimativa no relógio
//    de um segundo a faria escorregar continuamente na tela, que é a definição
//    de countdown disfarçado.
//
// 8. HORA LOCAL SÓ DEPOIS DE MONTAR. Formatar no fuso do visitante durante o
//    render do servidor dá hydration mismatch garantido. O primeiro quadro sai
//    em UTC e a linha troca para o fuso da pessoa no efeito.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useState } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { EASE_CSS, HAIR, HAIR_SOFT } from "../motion"
import { useMempoolFeed } from "../use-mempool"
import { SNAPSHOT } from "../dogcity-data"
import { track } from "@/lib/analytics/client"

const en = (n: number) => n.toLocaleString("en-US")

// ── a escada de precisão ───────────────────────────────────────────────────
// Quanto mais longe o alvo, menos casas a estimativa tem direito de mostrar.
// A premissa (10 min por bloco) vai impressa ao lado do resultado de propósito:
// quando a chain andar diferente, a premissa continua verdadeira e só o
// resultado se move, que é o comportamento esperado de uma medição e não o de
// um erro.
function estimativa(blocos: number, agora: Date, fuso: string | null) {
  const eta = new Date(agora.getTime() + blocos * SNAPSHOT.minutesPerBlock * 60_000)
  const tz = fuso ?? "UTC"
  const dia = eta.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short", timeZone: tz })

  if (blocos <= 6) return { texto: "landing within the hour", exato: true }

  const hora = eta.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz })
  if (blocos <= 144) return { texto: `around ${hora} on ${dia}`, exato: false }

  // longe do alvo o minuto é inventado: fica a parte do dia
  const h = Number(eta.toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: tz }))
  const parte = h < 5 ? "late night" : h < 12 ? "morning" : h < 17 ? "afternoon" : h < 22 ? "evening" : "late night"
  return { texto: `around ${dia}, ${parte}`, exato: false }
}

// ── o seletor de custódia ──────────────────────────────────────────────────
// Isto ocupa o lugar que um mapa mundi ocuparia, e faz a pergunta que o mapa
// não fazia. O navegador já sabe o fuso do visitante sem nenhum clique, então
// marcar um pin no planeta Terra para descobrir a própria hora é cobrar um
// clique por nada; e a cidade é na Lua, com posição vinda de história on-chain,
// então um mapa da Terra na primeira dobra ensina o modelo mental errado.
//
// A pergunta que ESTE momento pede é outra. O snapshot lê autocustódia, e a
// única ação com prazo duro que existe nesta janela é sacar da corretora.
//
// ⚠️ NENHUM PAINEL AFIRMA O QUE ACONTECE COM AS MOEDAS QUE FICAREM NA
// CORRETORA. O tratamento de endereços rotulados no gerador não está
// verificado, e uma frase errada sobre isso é o tipo de coisa que este público
// desmonta em público. O que a página afirma é só o que é indiscutível: o
// endereço da corretora não é o seu endereço.
const CUSTODIA = [
  {
    id: "own",
    label: "In my own wallet",
    titulo: "Then there is nothing to do.",
    texto:
      "The snapshot reads the chain on its own. You do not sign anything, you do not pay anything, you do not register anything. Just do not move the coins into someone else's custody before the block.",
    cta: { href: "#how", label: "See how placement is decided" },
  },
  {
    id: "exchange",
    label: "On an exchange",
    titulo: "An exchange address is not your address.",
    texto:
      "Coins sitting on a platform are held under the platform's keys, not yours, and the chain records them that way. Withdrawing to a wallet you control is one transaction, and it has to confirm before the block lands.",
    cta: { href: "#how", label: "See how placement is decided" },
  },
  {
    id: "unsure",
    label: "I am not sure",
    titulo: "If you cannot move it without asking, it is not self custody.",
    texto:
      "Holding DOG through an app, a broker or a custodial account means someone else holds the keys. Self custody means the wallet answers to you and to nobody else.",
    cta: { href: "#how", label: "See how placement is decided" },
  },
] as const

export default function Snapshot() {
  const reduce = useReducedMotion()
  const { feed } = useMempoolFeed()
  const tip = feed?.snapshot?.tip_height ?? null
  const idade = feed?.stale_seconds ?? null

  // ── fuso e relógio, só depois de montar (regra dura 7) ───────────────────
  const [fuso, setFuso] = useState<string | null>(null)
  const [agora, setAgora] = useState<Date | null>(null)
  useEffect(() => {
    try {
      setFuso(Intl.DateTimeFormat().resolvedOptions().timeZone || null)
    } catch {
      setFuso(null)
    }
    setAgora(new Date())
  }, [])

  // a estimativa se refaz quando a ponta da chain anda, não a cada segundo
  useEffect(() => {
    if (tip != null) setAgora(new Date())
  }, [tip])

  // ── o relógio do bloco em curso ─────────────────────────────────────────
  // Um setState por segundo, e nada mais: sem rAF, sem canvas, sem layout
  // thrash. A barra abaixo é uma transform de largura, então o custo por tick
  // é uma pintura de composição. Fora da aba o navegador já estrangula o
  // intervalo sozinho.
  const [relogio, setRelogio] = useState<number>(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setRelogio(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const blocos = tip == null ? null : SNAPSHOT.block - tip
  const passou = blocos != null && blocos <= 0

  const [escolha, setEscolha] = useState<string | null>(null)
  const painel = CUSTODIA.find((c) => c.id === escolha) ?? null

  useEffect(() => {
    track("snapshot_hero_view")
  }, [])

  const est = useMemo(
    () => (blocos != null && blocos > 0 && agora ? estimativa(blocos, agora, fuso) : null),
    [blocos, agora, fuso],
  )

  const cidade = fuso ? fuso.split("/").pop()?.replace(/_/g, " ") : null

  // ── o bloco em curso ────────────────────────────────────────────────────
  // `tip_time` é o carimbo da última ponta. O que está sendo minerado agora é
  // tip + 1, e o tempo decorrido é a única coisa nesta seção que anda sozinha.
  // A fração satura em 1: passar de dez minutos não é erro, é o comportamento
  // normal de um processo de Poisson, e o rótulo passa a dizer isso em vez de
  // esconder.
  const tMs = feed?.snapshot?.tip_time ? Date.parse(feed.snapshot.tip_time) : NaN
  const decorridoS = Number.isFinite(tMs) ? Math.max(0, Math.floor((relogio - tMs) / 1000)) : null
  const alvoS = SNAPSHOT.minutesPerBlock * 60
  const fracao = decorridoS == null ? 0 : Math.min(decorridoS / alvoS, 1)
  const atrasado = decorridoS != null && decorridoS > alvoS
  const mmss =
    decorridoS == null ? null : `${Math.floor(decorridoS / 60)}m ${String(decorridoS % 60).padStart(2, "0")}s`

  // ── o trilho da janela ──────────────────────────────────────────────────
  // Quantos blocos já foram minerados desde o anúncio, sobre o total da
  // janela. É o único jeito de a semana ter forma: sem ele a página mostra um
  // número que só encolhe, sem começo nem fim visíveis.
  const janela = SNAPSHOT.block - SNAPSHOT.announcedTip
  const andados = tip == null ? 0 : Math.max(0, Math.min(tip - SNAPSHOT.announcedTip, janela))
  const progresso = janela > 0 ? andados / janela : 0

  return (
    <section
      id="snapshot"
      // ⚠️ scroll-mt obrigatório: a MempoolBand é sticky top-0 com 36px de
      // altura e o header do site fica acima dela. Sem margem de rolagem o
      // topo desta seção nasce ESCONDIDO atrás dos dois quando alguém chega
      // pelo link do anúncio, que é exatamente o caminho para o qual ela foi
      // feita. 64px é o valor que as outras cinco âncoras da página já usam.
      className={`relative scroll-mt-16 border-b ${HAIR_SOFT}`}
    >
      <div className="max-w-6xl mx-auto px-6 md:px-10 pt-6 pb-10 md:pt-16 md:pb-20">
        <div className="font-mono text-[9px] md:text-[10px] tracking-[0.3em] text-lava">
          THE SNAPSHOT · BITCOIN BLOCK {en(SNAPSHOT.block)}
        </div>

        <h1 className="mt-3 font-display font-bold text-snow text-[28px] leading-[1.05] md:text-[52px] md:leading-[1.02] max-w-3xl">
          Block {en(SNAPSHOT.block)} decides your address in DogCity.
        </h1>

        <p className="mt-3 text-[13px] md:text-base text-mist leading-relaxed max-w-2xl">
          Whatever $DOG your wallet holds in self custody at that block is what the city reads.
          No claim, no signature, nothing to register.
        </p>

        {/* ═══ O INSTRUMENTO ═══════════════════════════════════════════════
            Cinco níveis de peso óptico, do compromisso ao palpite. A ordem é
            deliberada e não deve ser embaralhada: quem bate o olho por meio
            segundo tem que sair com o número de BLOCOS na cabeça, não com uma
            data. */}
        <div className={`mt-5 md:mt-10 border ${HAIR} bg-white/[0.02]`}>
          {/* o trilho da janela inteira, colado na borda de cima do quadro.
              Não tem rótulo próprio de propósito: ele é a moldura do
              instrumento, não mais um número para ler. */}
          {!passou && (
            <div className="h-[3px] w-full bg-white/[0.06]" aria-hidden>
              <motion.div
                className="h-full bg-lava/70"
                initial={false}
                animate={{ width: `${Math.max(progresso * 100, 0.4)}%` }}
                transition={{ duration: reduce ? 0 : 1.1, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
          )}
          <div className="px-5 py-5 md:px-8 md:py-8">
            {passou ? (
              // ── estado pós bloco ─────────────────────────────────────────
              // Ele existe desde o primeiro deploy de propósito. Um countdown
              // que chega a zero e continua mostrando "0 blocks" é a falha
              // clássica, e neste caso ela diria uma mentira sobre o evento
              // mais importante do projeto. O hash vem do mesmo feed e é o que
              // transforma "a Bitcoin block is Bitcoin's word" de retórica em
              // dado conferível contra o nó de quem estiver lendo.
              <>
                <div className="font-display font-bold text-snow text-[34px] md:text-[56px] leading-none tracking-tight">
                  SNAPSHOT TAKEN
                </div>
                <div className="mt-3 font-mono text-[10px] tracking-[0.22em] text-lava">
                  AT BLOCK {en(SNAPSHOT.block)}
                </div>
                <p className="mt-4 font-mono text-[10px] md:text-[11px] text-dusty leading-relaxed break-all">
                  {feed?.snapshot?.tip_hash ? `CHAIN TIP ${feed.snapshot.tip_hash}` : "READING THE CHAIN"}
                </p>
                <p className="mt-3 text-sm text-mist leading-relaxed max-w-xl">
                  The register is computed from the chain at that height and published after{" "}
                  {SNAPSHOT.confirmations} confirmations on top of it, with the map and the merkle
                  root, so anyone can reproduce it.
                </p>
              </>
            ) : (
              <>
                {/* nível 1: o compromisso */}
                <div className="flex items-baseline gap-4 md:gap-6 flex-wrap">
                  {blocos == null ? (
                    // regra dura 5: sem dado, texto. Nunca um zero.
                    <div className="font-display font-bold text-mist text-[26px] md:text-[40px] leading-none">
                      Reading the chain
                    </div>
                  ) : (
                    // ⚠️ `key={blocos}` remonta o nó a cada bloco novo, e é o
                    // que dá a BATIDA: quando a chain anda, o número entra
                    // deslocado e assenta. É o único momento em que o valor
                    // grande se mexe, e ele se mexe porque um bloco foi
                    // minerado de verdade. Sem a key, o React só troca o texto
                    // e a chegada do bloco passa despercebida.
                    <motion.div
                      key={blocos}
                      initial={reduce ? false : { opacity: 0, y: 10, filter: "blur(6px)" }}
                      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                      className="font-display font-bold text-snow text-[54px] md:text-[86px] leading-none tracking-tight tabular-nums"
                    >
                      {en(blocos)}
                    </motion.div>
                  )}
                  {/* nível 2: a unidade */}
                  <div className="font-mono text-[10px] md:text-[11px] tracking-[0.25em] text-lava pb-1 md:pb-3">
                    BLOCKS UNTIL
                    <br />
                    THE SNAPSHOT
                  </div>
                </div>

                {/* ═══ O PULSO ═══════════════════════════════════════════
                    A única coisa desta seção que se mexe sozinha, e ela se
                    mexe porque a rede está trabalhando, não porque a página
                    quer parecer viva. Ver regra dura 7. */}
                {decorridoS != null && (
                  <div className="mt-6">
                    <div className="flex items-baseline justify-between gap-3 font-mono text-[9px] md:text-[10px] tracking-[0.16em]">
                      <span className={atrasado ? "text-lava" : "text-mist"}>
                        {atrasado ? "OVERDUE · " : "MINING NOW · "}
                        <span className="tabular-nums">BLOCK {tip == null ? "" : en(tip + 1)}</span>
                      </span>
                      <span className="tabular-nums text-snow">{mmss}</span>
                    </div>
                    {/* barra do bloco em curso: enche em tempo real e reseta
                        quando a ponta anda. `key={tip}` é o que faz o reset ser
                        um corte seco em vez de a barra "voltar" animando para
                        trás, que leria como a chain andando ao contrário. */}
                    <div className="mt-2 h-[2px] w-full bg-white/[0.06]" aria-hidden>
                      <motion.div
                        key={tip ?? "sem-tip"}
                        // ⚠️ CHEIA E PARADA SERIA O PIOR ESTADO POSSÍVEL. Um
                        // bloco pode passar bem dos dez minutos, e nessa hora a
                        // barra satura: sem isto ela vira uma faixa laranja
                        // imóvel exatamente quando a espera é a informação. A
                        // respiração diz "ainda estamos esperando" sem
                        // inventar progresso que não existe, e some sozinha
                        // quando o bloco cai.
                        className={`h-full ${atrasado ? "bg-lava snapshot-espera" : "bg-lava/60"}`}
                        initial={false}
                        animate={{ width: `${Math.max(fracao * 100, 1)}%` }}
                        transition={{ duration: reduce ? 0 : 0.9, ease: "linear" }}
                      />
                    </div>
                    <div className="mt-2 font-mono text-[9px] text-dusty">
                      {atrasado
                        ? `this block is past the ${SNAPSHOT.minutesPerBlock} minute average, which is normal`
                        : `blocks arrive on a ${SNAPSHOT.minutesPerBlock} minute average, never on schedule`}
                    </div>
                  </div>
                )}

                {/* nível 3: a verificação. É o que prova que o número acima não
                    é enfeite: alvo, ponta e a idade da leitura, do nosso nó. */}
                <div className="mt-5 font-mono text-[9px] md:text-[10px] tracking-[0.14em] text-mist flex flex-wrap gap-x-4 gap-y-1">
                  <span className="tabular-nums">TARGET {en(SNAPSHOT.block)}</span>
                  <span className="tabular-nums">
                    CHAIN TIP {tip == null ? "READING" : en(tip)}
                  </span>
                  <span className="tabular-nums">
                    {idade == null ? "FROM OUR OWN NODE" : `FROM OUR OWN NODE ${Math.round(idade)}s AGO`}
                  </span>
                </div>

                {/* nível 4: a estimativa. Estática, rotulada, com a premissa
                    ao lado. Nunca é o elemento animado. */}
                <div className={`mt-5 pt-5 border-t ${HAIR_SOFT} font-mono text-[9px] md:text-[10px] text-dusty leading-relaxed`}>
                  <span className="text-mist">ESTIMATE ONLY</span>
                  {est ? (
                    <>
                      {" · "}
                      {est.texto}
                      {cidade ? ` in ${cidade}` : " UTC"}
                    </>
                  ) : (
                    " · calculating from the chain tip"
                  )}
                  <br />
                  assumes {SNAPSHOT.minutesPerBlock} minutes per block, recalculated on every block
                </div>
              </>
            )}
          </div>

          {/* nível 5: a doutrina. Uma linha, no rodapé do instrumento, porque
              é ela que autoriza o ETA a se mexer sem que isso vire acusação. */}
          <div className={`border-t ${HAIR_SOFT} px-5 py-3 md:px-8`}>
            <p className="font-mono text-[9px] md:text-[10px] text-dusty">
              The time is a guess and it moves. The block is the commitment and it does not.
            </p>
          </div>
        </div>

        {/* ═══ O SELETOR DE CUSTÓDIA ═══════════════════════════════════════ */}
        <div className="mt-6 md:mt-10">
          <div className="font-mono text-[9px] md:text-[10px] tracking-[0.25em] text-mist">
            WHERE IS YOUR $DOG RIGHT NOW?
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {CUSTODIA.map((c) => {
              const ativo = escolha === c.id
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setEscolha(ativo ? null : c.id)
                    if (!ativo) track("snapshot_custody_choice", { escolha: c.id })
                  }}
                  aria-pressed={ativo}
                  className={`font-mono text-[11px] md:text-xs px-4 py-2.5 border transition-colors duration-200 ${
                    ativo
                      ? "border-lava text-void bg-lava"
                      : `${HAIR} text-snow hover:border-white/[0.35]`
                  }`}
                  style={{ transitionTimingFunction: EASE_CSS }}
                >
                  {c.label}
                </button>
              )
            })}
          </div>

          {painel && (
            <motion.div
              key={painel.id}
              initial={reduce ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className={`mt-3 border ${HAIR} bg-white/[0.02] px-5 py-5 md:px-6 max-w-2xl`}
            >
              <div className="font-display font-bold text-snow text-base md:text-lg leading-snug">
                {painel.titulo}
              </div>
              <p className="mt-2 text-sm text-mist leading-relaxed">{painel.texto}</p>
              <a
                href={painel.cta.href}
                className="mt-4 inline-flex items-center gap-2 font-mono text-[11px] tracking-[0.14em] text-lava hover:text-lava-light"
              >
                {painel.cta.label} ↓
              </a>
            </motion.div>
          )}
        </div>
      </div>

      {/* ⚠️ <style jsx> não existe neste projeto e um keyframe em Tailwind
          exigiria tocar no config, que é compartilhado com o site inteiro. Um
          bloco local resolve, e `prefers-reduced-motion` desliga a respiração
          para quem pediu para o sistema não animar nada. */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes snapshot-espera { 0%, 100% { opacity: 1 } 50% { opacity: 0.42 } }
        .snapshot-espera { animation: snapshot-espera 2.4s ease-in-out infinite }
        @media (prefers-reduced-motion: reduce) { .snapshot-espera { animation: none } }
      `,
        }}
      />
    </section>
  )
}
