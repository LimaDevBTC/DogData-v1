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
import Image from "next/image"
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

// ── DESENHO DO LOTE: o número vira coisa (marketing/LANDING-V3-DESENHO.md,
// dobra 1). NADA de posição aqui: só a forma e o tamanho do terreno,
// isolados. Nunca bairro, distrito, coordenada, vizinho ou o lote dentro do
// mapa: regra travada do fundador, e este componente não pode inventar
// nenhuma delas.
//
// Lado do lote = raiz quadrada de area_m2 (lote quadrado), a mesma fórmula
// travada em masterplan.md §2 (lot_area / lado). O quadro de desenho usa
// SEMPRE o mesmo tamanho relativo (QUADRO=100 unidades de viewBox): o que
// muda com a área real é só a escala interna (unidades por metro), nunca o
// tamanho do quadro em si. É isso que faz o lote mediano da cidade (314,7
// m2) e o teto (40.000 m2) caberem no mesmo componente sem um virar ponto e
// o outro estourar.
interface Referencia {
  ateM2: number   // teto exclusivo da faixa (a última usa Infinity)
  larg: number    // largura real do objeto de referência, em metros
  alt: number     // profundidade real, em metros
  area: number    // área real, em m2
  nome: string    // singular, com artigo, para leitura corrida
  plural: string  // plural, para a legenda "Nx referência"
  dim: string     // dimensão real exibida na legenda
}

// tabela travada no briefing: cada faixa de área usa UM objeto de
// comparação, o "maior que cabe" naquela ordem de grandeza. A contagem é
// razão de ÁREA, nunca encaixe geométrico perfeito: um campo de futebol
// (105 x 68 m) é mais comprido que o lado de um lote de 10.609 m2 (103,0 m),
// por exemplo, então "1,5x campo" nunca é um encaixe literal, é proporção de
// área. O ladrilho recortado na própria borda do lote (abaixo) mostra isso
// com honestidade, em vez de fingir um encaixe que não existe.
const REFERENCIAS: Referencia[] = [
  { ateM2: 100, larg: Math.sqrt(70), alt: Math.sqrt(70), area: 70, nome: "an apartment", plural: "apartments", dim: "70 m2" },
  { ateM2: 1000, larg: 23.77, alt: 10.97, area: 260.8, nome: "a tennis court", plural: "tennis courts", dim: "23.77 x 10.97 m" },
  { ateM2: 20000, larg: 105, alt: 68, area: 7140, nome: "a football pitch", plural: "football pitches", dim: "105 x 68 m" },
  { ateM2: Infinity, larg: 100, alt: 100, area: 10000, nome: "a hectare", plural: "hectares", dim: "10,000 m2" },
]

function referenciaPara(areaM2: number): Referencia {
  return REFERENCIAS.find((r) => areaM2 < r.ateM2) ?? REFERENCIAS[REFERENCIAS.length - 1]
}

// ── tipologia: MESMO limiar de scripts/foundation_generator.ts
// (typologyFromUtxoCount, masterplan.md §2: "poucos UTXOs = torre
// concentrada, muitos = condomínio horizontal", CONGELADO). Aquela função
// tem 3 baldes (tower <=2, house <=10, condo >10); o desenho pedido aqui é
// binário (concentrada OU espalhada), então tower+house (<=10, ainda uma
// massa única) viram "concentrada" e só condo (>10) vira "espalhada". Acima
// de 40 UTXOs a grade satura em 3x3 (9 pegadas): a contagem exata de blocos
// é só textura visual, o fato congelado é o formato binário.
function blocosTipologia(utxoCount: number): 1 | 4 | 9 {
  if (utxoCount <= 10) return 1
  if (utxoCount <= 40) return 4
  return 9
}

// ⚠️ AQUI MORAVA O DESENHO DO LOTE (quadrado em escala, referência humana ladrilhada e
// pegadas de tipologia pelo utxo_count). O fundador cortou em 13/09/2026 e pediu "algo
// genérico e bonito no lugar". O desenho estava quase pronto e sai por `git log` deste
// arquivo se alguém quiser de volta.
//
// O que ficou: curvas de nível lunares, decorativas. Elas NÃO codificam dado nenhum, e é de
// propósito: qualquer coisa derivada do lote aqui viraria pista de posicionamento, que não
// vai a público. É a mesma linguagem do mapa topográfico da cidade, então lê como DogCity
// sem afirmar nada.
function TerrainMark() {
  // anéis irregulares e determinísticos, não aleatórios: sem `Math.random`, o desenho é
  // sempre o mesmo e não muda entre renders nem entre servidor e cliente.
  const aneis = [46, 38, 30.5, 23.5, 17, 11.5, 7]
  const caminho = (r: number, i: number) => {
    const pts = Array.from({ length: 28 }, (_, k) => {
      const a = (k / 28) * Math.PI * 2
      // deformação suave e reprodutível, para a curva não virar círculo perfeito
      const d = r * (1 + 0.055 * Math.sin(a * 3 + i) + 0.03 * Math.cos(a * 5 - i * 2))
      return `${(60 + d * Math.cos(a)).toFixed(2)},${(60 + d * Math.sin(a) * 0.82).toFixed(2)}`
    })
    return `M${pts.join('L')}Z`
  }
  return (
    <div className="mt-5 flex justify-center" aria-hidden="true">
      <svg viewBox="0 0 120 120" className="w-full max-w-[200px] md:max-w-[230px] block">
        {aneis.map((r, i) => (
          <path
            key={r}
            d={caminho(r, i)}
            fill="none"
            stroke="#E8660D"
            strokeOpacity={0.10 + i * 0.055}
            strokeWidth={i === aneis.length - 1 ? 1.1 : 0.6}
          />
        ))}
        <circle cx="60" cy="60" r="1.6" fill="#E8660D" fillOpacity={0.85} />
      </svg>
    </div>
  )
}

function Documento({ r }: { r: Resultado }) {
  if (r.status === "exchange") {
    return (
      <div className={`border ${HAIR} bg-white/[0.03] px-5 py-6 md:px-7 md:py-7`}>
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
      <div className={`border ${HAIR} bg-white/[0.03] px-5 py-6 md:px-7 md:py-7`}>
        <p className="font-mono text-[10px] tracking-[0.2em] text-lava">RING 2 · ARRIVED AFTER THE FOUNDING</p>
        <h3 className="font-display font-bold text-snow text-lg md:text-xl mt-2.5 leading-snug">
          This wallet arrived after the founding.
        </h3>
        <p className="text-[13px] md:text-sm text-mist mt-2.5 leading-relaxed">
          The city grows in rings. Ring 1 closed at block {SNAPSHOT_PROOF.block.toLocaleString("en-US")}. Your
          land comes with Ring 2, at a future block that will be announced.
        </p>
        <p className="text-[13px] md:text-sm text-mist mt-2.5 leading-relaxed">
          What closes right now is not land, it is order. The Founder number goes by order of
          arrival, does not depend on owning land yet, and the window shuts at 10,000,000 $DOG.
        </p>
        <a
          href="#offer"
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
    <div className={`border ${HAIR} bg-white/[0.03] px-5 py-6 md:px-7 md:py-7`}>
      <p className="font-mono text-[10px] tracking-[0.2em] text-lava">RING 1 · DECIDED AT THE FOUNDING</p>
      <div className="mt-3">
        {linhaDoc("YOUR LOT", `${areaExata(r.area_m2)} m2`)}
        {linhaDoc(`$DOG AT BLOCK ${r.block.toLocaleString("en-US")}`, dogExato(r.dog))}
        {linhaDoc("GENESIS BADGE", r.genesis ? "yes, original airdrop wallet" : "no")}
        {linhaDoc("RUNESTONES", r.runestones.toLocaleString("en-US"))}
        {linhaDoc("DECIDED AT", `block ${r.block.toLocaleString("en-US")}, ${dataDoBloco(SNAPSHOT_PROOF.timeUtc)}`)}
        {linhaDoc("BLOCK HASH", <span className="break-all">{hashCurto(SNAPSHOT_PROOF.hash)}</span>)}
      </div>

      <TerrainMark />

      <p className="text-[13px] md:text-sm text-mist mt-4 leading-relaxed">
        You already own this. It was not for sale and it cannot be bought.
      </p>
      <a
        href="#offer"
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
  return (
    <form onSubmit={onSubmit} className="flex flex-col sm:flex-row gap-2.5 w-full max-w-xl mx-auto">
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
        className={`min-w-0 flex-1 h-12 px-4 bg-void border ${HAIR} text-snow placeholder:text-dusty
                   font-mono text-[13px] focus:outline-none focus:border-lava transition-colors`}
      />
      <button
        type="submit"
        disabled={carregando || valor.trim().length === 0}
        className="h-12 px-6 font-mono font-bold text-[13px] tracking-[0.1em] bg-lava text-void
                   hover:bg-lava-light transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed
                   shrink-0"
      >
        {carregando ? "READING…" : "FIND OUT"}
      </button>
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
    <section id="lookup" className="relative bg-void border-b border-white/10 overflow-hidden">
      {/* o mapa como fundo, escurecido: a Satoshi Plaza enquadrada, não a
          carta topografica (essa é a dobra 3). Atmosfera, não instrumento. */}
      <div aria-hidden className="absolute inset-0">
        <Image
          src="/landing/plaza/plaza-home.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover opacity-[0.28]"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-void/70 via-void/85 to-void" />
      </div>

      <div className="relative max-w-3xl mx-auto px-6 md:px-10 pt-10 pb-10 md:pt-16 md:pb-16 text-center">
        <p className="font-mono text-[10px] md:text-[11px] tracking-[0.28em] text-lava">
          BLOCK {SNAPSHOT_PROOF.block.toLocaleString("en-US")} · THE CITY WAS DECIDED
        </p>
        <h1 className="font-display font-bold text-snow mt-3 leading-[1.1] text-[26px] md:text-[42px]">
          Find out what your wallet owns.
        </h1>

        <div className="mt-6 md:mt-7">
          <Campo valor={valor} onChange={setValor} onSubmit={buscar} carregando={carregando} autoFocus />
        </div>

        <p className="text-[12px] md:text-[13px] text-dusty mt-3">
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
