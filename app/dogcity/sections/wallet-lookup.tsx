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

function LotDrawing({ areaM2, utxoCount }: { areaM2: number; utxoCount: number }) {
  const lado = Math.sqrt(areaM2)
  const ref = referenciaPara(areaM2)
  const contagem = areaM2 / ref.area
  const blocos = blocosTipologia(utxoCount)
  const concentrada = blocos === 1
  const n = Math.round(Math.sqrt(blocos)) // 1, 2 ou 3: lado da grade da tipologia

  const QUADRO = 100 // lado do lote no desenho, em unidades de viewBox (relativo, nunca px)
  const px = QUADRO / lado // unidades de desenho por metro real DESTE lote

  const tileW = Math.max(ref.larg * px, 1)
  const tileH = Math.max(ref.alt * px, 1)

  // pegadas da tipologia: grade N x N sempre CHEIA e igualmente espaçada,
  // nunca uma linha parcial (o fundador prefere simetria a densidade exata,
  // ver feedback_founder_prefere_simetria.md).
  const razaoBloco = n === 1 ? 0.22 : 0.55
  const celula = QUADRO / n
  const ladoBloco = celula * razaoBloco
  const desloc = (celula - ladoBloco) / 2
  const pegadas = Array.from({ length: n * n }, (_, i) => ({
    x: (i % n) * celula + desloc,
    y: Math.floor(i / n) * celula + desloc,
  }))

  const MX = 15 // margem lateral do viewBox
  const MY = 20 // margem de cima (rótulo do lado do lote)
  const vbW = QUADRO + MX * 2
  const vbH = MY + QUADRO + 40 // 40 = legenda de baixo, duas linhas + respiro
  const patternId = `lotref-${Math.round(areaM2 * 10)}-${utxoCount}` // estável por resultado, sem colidir entre buscas

  return (
    <div className="mt-4 flex flex-col items-center">
      <svg
        viewBox={`0 0 ${vbW} ${vbH}`}
        className="w-full max-w-[220px] md:max-w-[260px] block"
        role="img"
        aria-label={`Square lot, ${lado.toFixed(1)} meters per side. Footprint ${concentrada ? "concentrated, like a tower" : "spread out, like a low rise"}.`}
      >
        <defs>
          <pattern id={patternId} patternUnits="userSpaceOnUse" width={tileW} height={tileH} x={MX} y={MY}>
            <rect x={0.5} y={0.5} width={Math.max(tileW - 1, 0.5)} height={Math.max(tileH - 1, 0.5)}
              fill="none" stroke="#9CA3AF" strokeOpacity={0.35} strokeWidth={0.5} />
          </pattern>
        </defs>

        {/* o lote: quadrado ladrilhado com a referência humana, recortada na própria borda do lote (nunca um encaixe fingido) */}
        <rect x={MX} y={MY} width={QUADRO} height={QUADRO} fill={`url(#${patternId})`} />
        <rect x={MX} y={MY} width={QUADRO} height={QUADRO} fill="none" stroke="#F0F0F2" strokeWidth={1.5} />

        {/* tipologia: pegadas sólidas por cima da grade de referência. cor de DADO da casa
            (#E8660D), nunca a lava de UI (#F56E0F, ver project_chart_palette) */}
        {pegadas.map((p, i) => (
          <rect key={i} x={MX + p.x} y={MY + p.y} width={ladoBloco} height={ladoBloco} fill="#E8660D" />
        ))}

        <text x={vbW / 2} y={MY - 6} textAnchor="middle" fontSize={7.5} fontWeight={700} fill="#F0F0F2" className="font-mono">
          {lado.toFixed(1)} m side
        </text>

        <text x={vbW / 2} y={MY + QUADRO + 17} textAnchor="middle" fontSize={7} fill="#F0F0F2" className="font-mono">
          ~{contagem.toFixed(1)}x {ref.plural}
        </text>
        <text x={vbW / 2} y={MY + QUADRO + 29} textAnchor="middle" fontSize={6} fill="#6B6B78" className="font-mono">
          ({ref.dim} each)
        </text>
      </svg>

      <p className="text-[11px] text-dusty mt-2.5 leading-relaxed text-center max-w-[240px]">
        Footprint from {utxoCount.toLocaleString("en-US")} UTXO{utxoCount === 1 ? "" : "s"} at the snapshot:{" "}
        {concentrada ? "concentrated, like a tower" : "spread out, like a low rise"}. Frozen: merging UTXOs later will not change it.
      </p>
    </div>
  )
}

// ── o resultado, desenhado como ESCRITURA, não como notificação ─────────────
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

      <LotDrawing areaM2={r.area_m2} utxoCount={r.utxo_count} />

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
