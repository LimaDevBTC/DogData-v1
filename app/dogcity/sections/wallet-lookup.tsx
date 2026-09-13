"use client"

// ═══════════════════════════════════════════════════════════════════════════
// DOBRA 1, O VEREDICTO PESSOAL (marketing/LANDING-V3-DESENHO.md).
//
// Reescrita completa de 13/09: a v2 abria com uma headline de produto
// ("Get your license to build in DogCity"). O fundador leu isso como
// genérico, e o diagnóstico do desenho é exato: aquela frase poderia estar em
// qualquer projeto de metaverso. A carteira do visitante é a única coisa que
// a casa tem que não é pitch, então a landing agora ABRE com um campo de
// endereço, sem headline de produto nenhuma. Tudo o que vem depois (dobras 2
// a 7) existe para sustentar o que este campo devolve.
//
// ⚠️ SEM CARTEIRA CONECTADA, DE PROPÓSITO. Pedir assinatura na primeira dobra
// mata conversão e é desnecessário: o dado (dog_snapshot_lookup) é público.
// Isto é uma consulta, não uma transação.
//
// TRÊS RESPOSTAS, servidas por /api/dogcity/lookup (ver o comentário daquela
// rota para a ordem de checagem e por que "exchange" não é sempre a palavra
// certa):
//   1. in_snapshot     — a escritura: área, saldo no bloco, Genesis Badge,
//                         Runestones, o bloco e o hash. CTA para a licença.
//   2. not_in_snapshot — os anéis de expansão: o que fecha agora é a ORDEM,
//                         não a terra. CTA para travar o Founder number.
//   3. exchange        — a resposta mais valiosa das três: pega a pessoa no
//                         momento exato do erro (moeda em corretora) e dá a
//                         ação certa (sacar).
//
// ⚠️ NUNCA POSIÇÃO. A tabela não tem bairro, distrito, vizinho nem tag
// institucional — só as seis colunas públicas. Este componente não pode
// inventar nenhuma delas.
//
// DOIS USOS DO MESMO MOTOR: `variant="hero"` é a dobra 1 inteira (mapa de
// fundo escurecido, campo grande). `variant="repeat"` é a dobra 7 (o mesmo
// campo, sem o mapa, para quem chegou até o fim sem digitar nada). A lógica
// de busca e o desenho do resultado-documento são os MESMOS: só a moldura
// muda, porque um resultado que muda de forma entre o topo e o fim da página
// pareceria dois produtos diferentes.
// ═══════════════════════════════════════════════════════════════════════════

import { useState, type FormEvent } from "react"
import { HAIR, HAIR_SOFT } from "../motion"
import { SNAPSHOT_PROOF } from "../dogcity-data"

// ── formatação exata, nunca arredondada para "K"/"M" ────────────────────────
// formatDog() de ../dogcity-data.ts abrevia ("889.8K"), o que é exatamente o
// que a regra nova do desenho proíbe para um documento de posse. Aqui todo
// número sai por extenso.
const dogExato = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const areaExata = (n: number) =>
  n.toLocaleString("en-US", { maximumFractionDigits: Number.isInteger(n) ? 0 : 2 })
const hashCurto = (h: string) => `${h.slice(0, 24)}…${h.slice(-8)}`

function dataDoBloco(iso: string): string {
  const d = new Date(iso)
  const data = d.toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
  const hora = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "UTC" })
  return `${data}, ${hora} UTC`
}

// ── o contrato da rota ───────────────────────────────────────────────────────
type Resultado =
  | { status: "in_snapshot"; address: string; dog: number; area_m2: number; genesis: boolean; runestones: number; utxo_count: number; block: number }
  | { status: "not_in_snapshot"; address: string }
  | { status: "exchange"; address: string; identity_name: string; identity_kind: string | null }

function linhaDoc(rotulo: string, valor: React.ReactNode) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2 border-b border-white/[0.06] last:border-0">
      <span className="font-mono text-[10px] md:text-[11px] tracking-[0.16em] text-dusty">{rotulo}</span>
      <span className="font-mono text-sm md:text-base text-snow text-right tabular-nums">{valor}</span>
    </div>
  )
}

// ── O ANEL, O ÚNICO DADO DE MAPA QUE PODE IR A PÚBLICO ─────────────────────
// masterplan.md §14: a cidade cresce em ANÉIS e cada anel abre com um snapshot
// novo, num bloco futuro anunciado. Anel fechado nunca se divide.
//
// 🔑 POR QUE ISTO É SEGURO: toda carteira do snapshot é do Anel 1. Dizer "Anel
// 1" não diz onde ninguém mora, diz que a pessoa é da fundação. A informação
// tem cardinalidade 1 para as 85.818 carteiras, então não há o que vazar. É
// exatamente o contrário do desenho do lote, que saiu em 13/09 (ver abaixo).
//
// ⚠️ NADA DE POSIÇÃO AQUI. Sem bairro, setor, coordenada, vizinho, e nunca o
// lote desenhado dentro do mapa. Só o anel.
//
// ⚠️ AQUI MORAVA O DESENHO DO LOTE (quadrado em escala, referência humana
// ladrilhada e pegadas de tipologia pelo utxo_count). O fundador cortou em
// 13/09/2026 e pediu "algo genérico e bonito no lugar", e o que ficou foram
// curvas de nível decorativas, que não diziam nada. Este selo faz o mesmo
// trabalho visual e ainda diz uma coisa verdadeira. O desenho do lote e as
// tabelas de referência saem por `git log` deste arquivo.
//
// A LINGUAGEM É A DO MAPA, não uma cópia dele: os anéis viários da cidade são
// dodecágonos (project_dogcity_anel_dodecagono), e da praça saem avenidas
// radiais. Abstrato de propósito, é um selo de documento.
const LADOS = 12
const CENTRO = 70

// vértices do dodecágono de raio r, primeiro vértice no topo
function vertices(r: number): Array<[number, number]> {
  return Array.from({ length: LADOS }, (_, k) => {
    const a = -Math.PI / 2 + (k / LADOS) * Math.PI * 2
    return [CENTRO + r * Math.cos(a), CENTRO + r * Math.sin(a)] as [number, number]
  })
}
const poligono = (r: number) =>
  `M${vertices(r).map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join("L")}Z`

// anel preenchido = polígono de fora + polígono de dentro com fillRule evenodd
const banda = (rFora: number, rDentro: number) => `${poligono(rFora)}${poligono(rDentro)}`

const MARCA = "#E8660D" // project_chart_palette: a marca é #E8660D, não o lava #F56E0F

// ⚠️ O SELO É LIDO A 132 px. Toda a calibração abaixo é contra esse tamanho, e
// não contra o SVG ampliado: a primeira versão tinha praça com disco E aro,
// dois polígonos de contorno e raios grossos, e no tamanho real tudo isso
// virava uma engrenagem borrada. Menos peças, mais contraste aceso/apagado.
function RingMark({ aceso }: { aceso: 1 | 2 }) {
  const um = aceso === 1
  const dentro = vertices(26)
  const fora = vertices(48)
  return (
    <div className="mt-6 flex flex-col items-center">
      <svg
        viewBox="0 0 140 140"
        aria-hidden="true"
        className="block w-[132px] h-[132px] md:w-[148px] md:h-[148px]"
      >
        {/* ANEL 2, tracejado: existe, ainda não abriu */}
        {!um && <path d={banda(64, 48)} fillRule="evenodd" fill={MARCA} fillOpacity={0.09} />}
        <path
          d={poligono(64)}
          fill="none"
          stroke={um ? "#FFFFFF" : MARCA}
          strokeOpacity={um ? 0.2 : 0.92}
          strokeWidth={um ? 0.8 : 1.4}
          strokeDasharray={um ? "4 6" : "6 5"}
        />

        {/* ANEL 1, a cidade de hoje: a banda entre os dois dodecágonos */}
        <path
          d={banda(48, 26)}
          fillRule="evenodd"
          fill={um ? MARCA : "#FFFFFF"}
          fillOpacity={um ? 0.14 : 0.035}
        />
        {/* as avenidas radiais, só dentro da banda */}
        {dentro.map(([x1, y1], i) => (
          <line
            key={i}
            x1={x1.toFixed(2)} y1={y1.toFixed(2)}
            x2={fora[i][0].toFixed(2)} y2={fora[i][1].toFixed(2)}
            stroke={um ? MARCA : "#FFFFFF"}
            strokeOpacity={um ? 0.24 : 0.06}
            strokeWidth={0.45}
          />
        ))}
        <path
          d={poligono(48)}
          fill="none"
          stroke={um ? MARCA : "#FFFFFF"}
          strokeOpacity={um ? 1 : 0.16}
          strokeWidth={um ? 1.5 : 0.8}
        />
        <path
          d={poligono(26)}
          fill="none"
          stroke={um ? MARCA : "#FFFFFF"}
          strokeOpacity={um ? 0.55 : 0.12}
          strokeWidth={0.8}
        />

        {/* a Satoshi Plaza: disco claro com o ponto da marca, como no mapa.
            Fica acesa nos dois casos, porque o centro não muda de dono. */}
        <circle cx={CENTRO} cy={CENTRO} r={9} fill="#FFFFFF" fillOpacity={0.2} />
        <circle cx={CENTRO} cy={CENTRO} r={2.4} fill={MARCA} fillOpacity={0.95} />
      </svg>
      <p className="font-mono text-[10px] tracking-[0.18em] text-lava mt-3">
        {um ? "RING 1 · THE FOUNDING" : "RING 2 · NOT YET OPENED"}
      </p>
    </div>
  )
}

// ⚠️ O CARTÃO É PAPEL OPACO (#08080A), não mais `bg-white/[0.03]`. Sobre o
// void as duas coisas pintam a mesma cor (0,03 x 240 = 7), então a dobra 7 não
// mudou um pixel; o que mudou é a dobra 1, onde agora passa o mapa por baixo.
// Translúcido ali deixava a malha viária atravessar a tabela de números.
function Documento({ r }: { r: Resultado }) {
  if (r.status === "exchange") {
    return (
      <div className={`border ${HAIR} bg-[#08080A] px-5 py-6 md:px-7 md:py-7`}>
        <p className="font-mono text-[10px] tracking-[0.2em] text-lava">KNOWN ADDRESS · {r.identity_name.toUpperCase()}</p>
        <h3 className="font-display font-bold text-snow text-lg md:text-xl mt-2.5 leading-snug">
          This is not your address on chain.
        </h3>
        <p className="text-[13px] md:text-sm text-mist mt-2.5 leading-relaxed">
          Coins held at {r.identity_name} are held under its keys, not yours. Any lot this
          address would receive is assigned to {r.identity_name} itself, inside the Financial
          District, not the residential city. Withdraw to a wallet you control, then look it up
          again.
        </p>
      </div>
    )
  }

  if (r.status === "not_in_snapshot") {
    return (
      <div className={`border ${HAIR} bg-[#08080A] px-5 py-6 md:px-7 md:py-7`}>
        {/* o rótulo do anel saiu daqui e foi para o selo: repetir "RING 2" duas
            vezes no mesmo cartão só gastava a palavra. */}
        <p className="font-mono text-[10px] tracking-[0.2em] text-lava">ARRIVED AFTER THE FOUNDING</p>
        <h3 className="font-display font-bold text-snow text-lg md:text-xl mt-2.5 leading-snug">
          This wallet arrived after the founding.
        </h3>
        <p className="text-[13px] md:text-sm text-mist mt-2.5 leading-relaxed">
          The city grows in rings. Ring 1 closed at block {SNAPSHOT_PROOF.block.toLocaleString("en-US")}. Your
          land comes with Ring 2, at a future block that will be announced.
        </p>

        <RingMark aceso={2} />

        <p className="text-[13px] md:text-sm text-mist mt-5 leading-relaxed">
          What closes right now is not land, it is order. The Founder number goes by order of
          arrival, does not depend on owning land yet, and the window shuts at 10,000,000 $DOG.
        </p>
        <a
          href="/dogcity/founders"
          className="mt-5 inline-flex items-center justify-center h-11 px-6 font-mono font-bold text-[12px] tracking-[0.1em]
                     bg-lava text-void hover:bg-lava-light transition-colors duration-200"
        >
          LOCK YOUR FOUNDER NUMBER
        </a>
      </div>
    )
  }

  // in_snapshot: a escritura
  return (
    <div className={`border ${HAIR} bg-[#08080A] px-5 py-6 md:px-7 md:py-7`}>
      {/* o rótulo do anel saiu daqui e foi para o selo, no fim do documento */}
      <p className="font-mono text-[10px] tracking-[0.2em] text-lava">DECIDED AT THE FOUNDING</p>
      <div className="mt-3">
        {linhaDoc("YOUR LOT", `${areaExata(r.area_m2)} m2`)}
        {linhaDoc(`$DOG AT BLOCK ${r.block.toLocaleString("en-US")}`, dogExato(r.dog))}
        {linhaDoc("GENESIS BADGE", r.genesis ? "yes, original airdrop wallet" : "no")}
        {linhaDoc("RUNESTONES", r.runestones.toLocaleString("en-US"))}
        {linhaDoc("DECIDED AT", `block ${r.block.toLocaleString("en-US")}, ${dataDoBloco(SNAPSHOT_PROOF.timeUtc)}`)}
        {linhaDoc("BLOCK HASH", <span className="break-all">{hashCurto(SNAPSHOT_PROOF.hash)}</span>)}
      </div>

      <RingMark aceso={1} />

      <p className="text-[13px] md:text-sm text-mist mt-5 leading-relaxed">
        You already own this. It was not for sale and it cannot be bought.
      </p>
      <a
        href="/dogcity/founders"
        className="mt-4 inline-flex items-center justify-center h-11 px-6 font-mono font-bold text-[12px] tracking-[0.1em]
                   bg-lava text-void hover:bg-lava-light transition-colors duration-200"
      >
        GET THE LICENCE TO BUILD ON IT
      </a>
    </div>
  )
}

// ── o campo, reaproveitado nas duas dobras ──────────────────────────────────
function Campo({
  valor, onChange, onSubmit, carregando, autoFocus,
}: {
  valor: string
  onChange: (v: string) => void
  onSubmit: (e: FormEvent) => void
  carregando: boolean
  autoFocus?: boolean
}) {
  // ⚠️ UMA PEÇA SÓ, NUNCA EMPILHADA. A versão anterior era `flex-col
  // sm:flex-row`: no celular o campo e o botão viravam dois blocos de 48 px com
  // um vão no meio, e a dobra 1 inteira virava formulário, sem sobrar tela para
  // o mapa. Aqui a moldura é uma só, o botão mora DENTRO dela (recuado 3 px em
  // todos os lados), e a linha inteira mede 48 px no celular.
  //
  // ⚠️ SEM VIDRO (feedback_dogcity_design_taste): o fundo é chapado, não
  // backdrop-blur, porque atrás desta peça passa o mapa, que é fundo ocupado.
  return (
    <form onSubmit={onSubmit} className="w-full max-w-xl mx-auto">
      <div
        className={`flex items-stretch h-12 md:h-[52px] bg-void/85 border ${HAIR}
                    transition-colors duration-200 focus-within:border-lava/70`}
      >
        <input
          type="text"
          inputMode="text"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          autoFocus={autoFocus}
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          placeholder="paste a Bitcoin address"
          aria-label="Your Bitcoin address"
          className="min-w-0 flex-1 h-full bg-transparent pl-3.5 pr-2 md:pl-5 text-snow placeholder:text-dusty
                     font-mono text-[13px] focus:outline-none"
        />
        <button
          type="submit"
          disabled={carregando || valor.trim().length === 0}
          className="shrink-0 my-[3px] mr-[3px] px-4 md:px-6 font-mono font-bold text-[11px] md:text-[12px]
                     tracking-[0.12em] bg-lava text-void hover:bg-lava-light transition-colors duration-200
                     disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {carregando ? "READING…" : "FIND OUT"}
        </button>
      </div>
    </form>
  )
}

// ── o motor de busca, compartilhado pelas duas variantes ────────────────────
function useLookup() {
  const [valor, setValor] = useState("")
  const [carregando, setCarregando] = useState(false)
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const buscar = async (e: FormEvent) => {
    e.preventDefault()
    const address = valor.trim()
    if (!address) return
    setCarregando(true)
    setErro(null)
    setResultado(null)
    try {
      const r = await fetch(`/api/dogcity/lookup?address=${encodeURIComponent(address)}`, {
        signal: AbortSignal.timeout(8000),
      })
      const j = await r.json()
      if (!r.ok) {
        setErro(j?.error === "invalid Bitcoin address" ? "That does not look like a Bitcoin address." : "The chain is busy, try again in a moment.")
        return
      }
      setResultado(j as Resultado)
    } catch {
      setErro("The chain is busy, try again in a moment.")
    } finally {
      setCarregando(false)
    }
  }

  return { valor, setValor, carregando, resultado, erro, buscar }
}

// ═══ variante HERO: a dobra 1 inteira ═══════════════════════════════════════
export function WalletLookupHero() {
  const { valor, setValor, carregando, resultado, erro, buscar } = useLookup()

  return (
    <section
      id="lookup"
      className="relative bg-void border-b border-white/10 overflow-hidden min-h-[62svh] md:min-h-[520px]"
    >
      {/* ── O MAPA REAL DA CIDADE COMO FUNDO ────────────────────────────────
          public/city/hero-mapa.jpg (1920x1080), a cidade enquadrada com a
          Satoshi Plaza no centro, já escurecida nas bordas na própria imagem.
          O que estava aqui antes era um render da praça (plaza-home.webp) a
          28% de opacidade: lia como textura, não como cidade.

          ⚠️ <img> CRU, NUNCA `import`. O arquivo é servido de /public e não
          entra no bundle; `next/image` aqui só acrescentaria uma rota de
          otimização por cima de um JPG que já está no tamanho certo.

          ⚠️ A BANDA TEM TETO DE ALTURA. Quando o resultado aparece a seção
          cresce várias centenas de pixels, e sem o `max-h` a imagem esticaria
          junto: o mesmo mapa seria reenquadrado a cada busca e a parte de baixo
          da página ficaria com cidade atrás do rodapé da dobra. Com o teto, o
          mapa continua sendo o topo e o resto da seção é void. O documento em
          si nunca depende disso, porque o cartão é opaco (ver `Documento`).

          ⚠️ ENQUADRAMENTO NO CELULAR: a 400 px de largura a imagem é cortada
          na HORIZONTAL (o recipiente é mais alto que 16:9), então quem manda é
          o eixo X do object-position. `object-center` mantém a Plaza no meio,
          logo abaixo do campo. Mexer no Y aqui não faria NADA no celular.
          No desktop é o contrário, o corte é vertical, e o Y em 12% empurra a
          Plaza para baixo da copy em vez de deixá-la atrás do título. */}
      <div aria-hidden className="absolute inset-x-0 top-0 h-full max-h-[660px] md:max-h-[760px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/city/hero-mapa.jpg"
          alt=""
          fetchPriority="high"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover object-center md:object-[50%_12%]"
        />
        {/* véu em duas camadas: um piso chapado, que garante o contraste do
            texto em qualquer recorte, e um gradiente que escurece o topo (onde
            mora a copy), abre no meio (onde mora a Plaza) e fecha em void na
            costura com a dobra 2. */}
        <div className="absolute inset-0 bg-void/50" />
        <div className="absolute inset-0 bg-gradient-to-b from-void/85 via-void/10 to-void" />
      </div>

      <div className="relative max-w-3xl mx-auto px-6 md:px-10 pt-9 pb-10 md:pt-16 md:pb-16 text-center">
        <p className="font-mono text-[10px] md:text-[11px] tracking-[0.28em] text-lava">
          BLOCK {SNAPSHOT_PROOF.block.toLocaleString("en-US")} · THE CITY WAS DECIDED
        </p>
        <h1 className="font-display font-bold text-snow mt-3 leading-[1.1] text-[26px] md:text-[42px]">
          Find out what your wallet owns.
        </h1>

        <div className="mt-5 md:mt-7">
          <Campo valor={valor} onChange={setValor} onSubmit={buscar} carregando={carregando} autoFocus />
        </div>

        <p className="text-[12px] md:text-[13px] text-mist mt-3 [text-shadow:0_1px_8px_rgba(8,8,10,0.95),0_0_2px_rgba(8,8,10,0.9)]">
          No connect, no signature, no cost. The chain already answered this.
        </p>

        {erro && <p className="text-[13px] text-lava mt-5">{erro}</p>}

        {resultado && (
          <div className="mt-7 text-left">
            <Documento r={resultado} />
          </div>
        )}
      </div>
    </section>
  )
}

// ═══ variante REPEAT: a dobra 7, o campo sozinho ════════════════════════════
export function WalletLookupRepeat() {
  const { valor, setValor, carregando, resultado, erro, buscar } = useLookup()

  return (
    <section className={`relative border-t ${HAIR_SOFT}`}>
      <div className="max-w-3xl mx-auto px-6 md:px-10 py-14 md:py-16 text-center">
        <p className="font-mono text-[10px] md:text-[11px] tracking-[0.28em] text-lava">
          ONE LAST THING
        </p>
        <h2 className="font-display font-bold text-snow mt-2.5 text-xl md:text-2xl">
          Still haven&apos;t looked up your wallet?
        </h2>
        <div className="mt-5">
          <Campo valor={valor} onChange={setValor} onSubmit={buscar} carregando={carregando} />
        </div>
        {erro && <p className="text-[13px] text-lava mt-4">{erro}</p>}
        {resultado && (
          <div className="mt-6 text-left">
            <Documento r={resultado} />
          </div>
        )}
      </div>
    </section>
  )
}
