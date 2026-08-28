"use client"

// ═══════════════════════════════════════════════════════════════════════════
// PRANCHA 1 DA FUNDAÇÃO: o terreno e o orçamento de terra.
//
// Fase 1 do plano de 28/08/2026 (fundacao.md). O fundador travou a regra do
// bairro: "o bairro sai da idade dos UTXO, quanto mais antigo mais perto da
// praça central, e aí precisamos ser criativos pra ir espalhando os bairros
// sem ser cilindricamente".
//
// Esta página não desenha lote nenhum. Ela responde à pergunta que vem ANTES:
// quanta terra existe, onde ela está, e quantos lotes cabem em cada cenário de
// declive. Sem isso, gerar 53 mil lotes é gerar 53 mil lotes no lugar errado.
//
// ⚠️ POR QUE ISTO IMPORTA, medido: o loteamento lunar que existe hoje
// (public/lunar/btc-core-lots.json) esgotou o sítio inteiro (raio máximo
// 3.499,9 m contra limite de 3.500) SEM GASTAR UM METRO COM RUA. Somar via a
// ele não aperta, expulsa. E 5.360 daqueles lotes caem dentro da praça.
//
// ⚠️ O DECLIVE É MEDIDO NO TERRENO RENDERIZADO, porque é nesse chão que o
// prédio vai pousar, e o exagero vem IMPORTADO de app/city/plaza/vex.ts, não
// copiado. Dentro da cidade ele vale 1: o mare é plano de verdade e a cena
// deixou de dramatizá-lo. Enquanto esta prancha tinha o 2 cravado, ela
// publicou um sítio duas vezes mais íngreme do que o que existe, e os números
// de área útil que ela mostrou estavam todos apertados demais.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from 'react'

import { exageroEm } from '../plaza/vex'

// ── constantes do sítio, todas lidas do código que a cena usa ──────────────
// ⚠️ O EXAGERO NÃO É MAIS UM NÚMERO AQUI, e essa é a correção mais importante
// desta prancha. Ele era `const VEX = 2` cravado, e quando a cena passou a usar
// exagero radial (1 dentro de 3.500 m, 2 no horizonte) a prancha continuou
// medindo o terreno antigo: TODO declive publicado aqui estava dobrado, e a
// cidade parecia ter menos da metade da terra que tem. Agora vem da mesma
// função que o renderizador usa, importada, não copiada.
const exagCena = (r: number) => exageroEm(r)
/** só para a coluna de comparação: o que esta prancha dizia antes */
const exagAntigo = () => 2
const PLATO_R = 960           // terrain.ts: chão plano no nível 0 até aqui
const PLATO_FUNDE = 1300      // e volta ao relevo real aqui
const PARK_BEARING_DEG = 43   // park-site.ts
const PARK_DIST = 5200
const PARK_CORE = 3100
const WAR = { x: -2120, z: 2120 }
const SPACEPORT = { x: -140, z: 3090 }

// ── urbanismo, números da pesquisa com fonte (ver fundacao.md) ─────────────
const SOBRECARGA_VIARIA = 0.174   // quarteirão de 160 m com via de 16 m
const TAMANHOS = [125, 200, 300, 450, 600] as const
const CARTEIRAS = 53001       // carteiras com >= 20.000 DOG, medido em 27/08
const R_SITIO = 3500          // lib/city/lunar/sites.ts:73, o tabuleiro de hoje

const FAIXAS = [
  { max: 2, cor: '#F7931A', nome: '≤ 2°' },
  { max: 3, cor: '#C0761B', nome: '2° a 3°' },
  { max: 4, cor: '#8A5A22', nome: '3° a 4°' },
  { max: 6, cor: '#584534', nome: '4° a 6°' },
  { max: 90, cor: '#2E2B27', nome: '> 6°' },
] as const

interface Meta {
  cols: number
  rows: number
  cellSizeM: number
  siteRadiusM: number
  minRelM: number
  maxRelM: number
}

interface Resultado {
  areaFaixa: number[]        // km2 acumulados por faixa, já sem praça e sem parque
  areaPraca: number
  areaParque: number
  areaSitio: number
  bracos: { rumo: number; alcance: number; bom: number }[]
  exageroAntigo: number[]    // a mesma conta com exagero 2, para medir o erro antigo
}

export default function PlanClient() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [res, setRes] = useState<Resultado | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [cenario, setCenario] = useState(0) // índice em FAIXAS: até onde é edificável

  useEffect(() => {
    let vivo = true
    ;(async () => {
      try {
        const [meta, buf] = await Promise.all([
          fetch('/lunar/btc-core-heightmap.json').then((r) => r.json() as Promise<Meta>),
          fetch('/lunar/btc-core-heightmap.f32').then((r) => r.arrayBuffer()),
        ])
        if (!vivo) return
        const alturas = new Float32Array(buf)
        desenha(meta, alturas, canvasRef.current, setRes)
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'falhou ao carregar o terreno')
      }
    })()
    return () => { vivo = false }
  }, [])

  // o cenário escolhido decide a área útil e, com ela, a conta de lotes
  const areaUtil = res ? res.areaFaixa.slice(0, cenario + 1).reduce((a, b) => a + b, 0) : 0
  const areaLote = areaUtil * (1 - SOBRECARGA_VIARIA)
  // ⚠️ "CABE OU NÃO CABE" É PERGUNTA FALSA, e o fundador matou ela: o tabuleiro
  // de 3.500 m é UM NÚMERO em lib/city/lunar/sites.ts:73, e o tile da NASA de
  // onde ele sai (SLDEM2015, 00N-30N, 000-045E) tem 910 por 1.364 km, ou seja
  // 18.854 tabuleiros como o nosso. Terra não é o limite. Então a tabela deixou
  // de dizer se cabe e passou a dizer QUAL RAIO cada tamanho de lote exige.
  // O tamanho do lote vira decisão de como a cidade deve parecer, e o raio
  // segue atrás.
  const fracaoUtil = res && res.areaSitio > 0 ? areaUtil / res.areaSitio : 0
  const raioPara = (lote: number): number => {
    if (!fracaoUtil) return 0
    const precisaKm2 = (CARTEIRAS * lote) / 1e6 / (1 - SOBRECARGA_VIARIA)
    return Math.sqrt(precisaKm2 / fracaoUtil / Math.PI) * 1000
  }

  return (
    <div className="min-h-[100dvh] bg-black px-4 py-6 text-white sm:px-8">
      <header className="mx-auto max-w-6xl">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#F7931A]">DogCity · fundação · prancha 1</p>
        <h1 className="font-display mt-2 text-2xl font-bold sm:text-3xl">O terreno e o orçamento de terra</h1>
        <p className="mt-2 max-w-3xl font-mono text-[12px] leading-relaxed text-white/60">
          Mare Tranquillitatis, sítio de 3.500 m de raio, malha real da NASA (SLDEM2015) de 137 por 137
          células de 59,2 m. Nenhum lote foi desenhado aqui: esta prancha responde quanta terra existe
          antes de qualquer loteamento.
        </p>
      </header>

      <main className="mx-auto mt-6 grid max-w-6xl gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="relative border border-white/10 bg-[#0a0908]">
          <canvas ref={canvasRef} className="block w-full" />
          {!res && !erro && (
            <p className="absolute inset-0 flex items-center justify-center font-mono text-[11px] text-white/40">
              medindo o relevo célula a célula…
            </p>
          )}
          {erro && (
            <p className="absolute inset-0 flex items-center justify-center px-6 text-center font-mono text-[11px] text-red-400">
              {erro}
            </p>
          )}
        </div>

        <aside className="space-y-5 font-mono text-[11px]">
          <section>
            <p className="text-[10px] uppercase tracking-[0.24em] text-white/40">Terra por declive</p>
            <div className="mt-2 border border-white/10">
              {FAIXAS.map((f, i) => (
                <button
                  key={f.nome}
                  type="button"
                  onClick={() => setCenario(i)}
                  className={`flex w-full items-center justify-between gap-3 border-b border-white/[0.06] px-2.5 py-2 text-left last:border-b-0 ${
                    i <= cenario ? 'bg-white/[0.04]' : ''
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="inline-block size-2.5" style={{ background: f.cor }} />
                    <span className={i <= cenario ? 'text-white' : 'text-white/45'}>{f.nome}</span>
                  </span>
                  <span className="tabular-nums text-white/70">
                    {res ? `${res.areaFaixa[i].toFixed(2)} km²` : '…'}
                  </span>
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[10px] leading-relaxed text-white/35">
              Clique numa faixa para adotar o cenário: tudo até ela vira terra edificável. Praça e núcleo
              do parque já saíram da conta.
            </p>
          </section>

          <section>
            <p className="text-[10px] uppercase tracking-[0.24em] text-white/40">O cenário adotado</p>
            <dl className="mt-2 space-y-1">
              <Linha k="Declive aceito" v={`até ${FAIXAS[cenario].nome.replace('≤ ', '')}`} />
              <Linha k="Terra edificável" v={res ? `${areaUtil.toFixed(2)} km²` : '…'} />
              <Linha k="Menos via e calçada" v={`${Math.round(SOBRECARGA_VIARIA * 100)}%`} />
              <Linha k="Sobra para lote" v={res ? `${areaLote.toFixed(2)} km²` : '…'} destaque />
            </dl>
          </section>

          <section>
            <p className="text-[10px] uppercase tracking-[0.24em] text-white/40">Quantos lotes cabem</p>
            <table className="mt-2 w-full border border-white/10">
              <thead>
                <tr className="border-b border-white/10 text-[10px] uppercase tracking-[0.16em] text-white/40">
                  <th className="px-2 py-1.5 text-left font-normal">Lote</th>
                  <th className="px-2 py-1.5 text-right font-normal">Cabem</th>
                  <th className="px-2 py-1.5 text-right font-normal">Raio p/ todos</th>
                </tr>
              </thead>
              <tbody>
                {TAMANHOS.map((t) => {
                  const cabem = res ? Math.floor((areaLote * 1e6) / t) : 0
                  const raio = res ? raioPara(t) : 0
                  // laranja: o tabuleiro de hoje já dá conta. branco: precisa crescer,
                  // e o número diz de quanto, em metros de raio.
                  const jaCabe = cabem >= CARTEIRAS
                  return (
                    <tr key={t} className="border-b border-white/[0.06] last:border-b-0">
                      <td className="px-2 py-1.5 tabular-nums text-white/70">{t} m²</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-white">
                        {res ? cabem.toLocaleString('pt-BR') : '…'}
                      </td>
                      <td
                        className={`px-2 py-1.5 text-right tabular-nums ${jaCabe ? 'text-[#F7931A]' : 'text-white/70'}`}
                      >
                        {res ? (jaCabe ? `${(R_SITIO / 1000).toFixed(1)} km ✓` : `${(raio / 1000).toFixed(1)} km`) : '…'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <p className="mt-1.5 text-[10px] leading-relaxed text-white/35">
              53.001 é o número medido de carteiras com 20.000 DOG ou mais em 27/08. A última coluna é o
              raio que o sítio precisa ter para caber uma carteira em cada lote desse tamanho. Laranja com
              ✓ quer dizer que o tabuleiro de hoje já dá conta. Terra não é o limite: o tabuleiro é um
              número só (lib/city/lunar/sites.ts:73) e o tile da NASA de onde ele sai tem 910 por 1.364 km,
              ou seja 18.854 tabuleiros como este. O tamanho do lote é escolha de como a cidade deve
              parecer, não de quanto espaço sobrou.
            </p>
          </section>

          <section>
            <p className="text-[10px] uppercase tracking-[0.24em] text-white/40">Os braços</p>
            <p className="mt-1.5 text-[10px] leading-relaxed text-white/45">
              As seis direções com mais terra boa saindo da praça, medidas raio a raio no relevo. A
              cidade cresce por elas na ordem da idade do UTXO, e é isso que a impede de virar anel.
            </p>
            <ul className="mt-2 space-y-1">
              {res?.bracos.map((b) => (
                <li key={b.rumo} className="flex items-baseline justify-between tabular-nums">
                  <span className="text-white/55">rumo {b.rumo}°</span>
                  <span className="text-white/75">{(b.alcance / 1000).toFixed(1)} km úteis</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="border-t border-white/10 pt-3">
            <p className="text-[10px] leading-relaxed text-white/35">
              ⚠️ O declive é medido no terreno como a cena o desenha, porque é nesse chão que o prédio
              pousa. Dentro da cidade o exagero vertical é 1, ou seja, o relevo é o da NASA sem
              dramatização: Mare Tranquillitatis é plano de verdade. Esta prancha já publicou este
              mesmo sítio com exagero 2, e naquela conta a terra a menos de 2° dava só{' '}
              {res ? `${res.exageroAntigo[0].toFixed(2)} km²` : '…'}. A diferença não é opinião de
              projeto: era o terreno errado.
            </p>
          </section>
        </aside>
      </main>
    </div>
  )
}

function Linha({ k, v, destaque }: { k: string; v: string; destaque?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-white/45">{k}</dt>
      <dd className={`tabular-nums ${destaque ? 'text-[#F7931A]' : 'text-white/80'}`}>{v}</dd>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// A MEDIÇÃO E O DESENHO
// ═══════════════════════════════════════════════════════════════════════════

function desenha(
  meta: Meta,
  alturas: Float32Array,
  canvas: HTMLCanvasElement | null,
  setRes: (r: Resultado) => void,
) {
  if (!canvas) return
  const n = meta.cols
  const cell = meta.cellSizeM
  const half = (n - 1) / 2

  // altura crua interpolada, em metros, com o exagero que a cena aplica
  const H = (i: number, j: number) =>
    alturas[Math.min(n - 1, Math.max(0, j)) * n + Math.min(n - 1, Math.max(0, i))]
  const cruaEm = (x: number, z: number): number => {
    const fi = Math.min(n - 1.001, Math.max(0, x / cell + half))
    const fj = Math.min(n - 1.001, Math.max(0, z / cell + half))
    const i = Math.floor(fi), j = Math.floor(fj)
    const u = fi - i, v = fj - j
    return (
      H(i, j) * (1 - u) * (1 - v) + H(i + 1, j) * u * (1 - v) +
      H(i, j + 1) * (1 - u) * v + H(i + 1, j + 1) * u * v
    )
  }
  // ⚠️ o platô da praça é chão de VERDADE na cena (terrain.ts): dentro de 960 m
  // o relevo foi zerado e até 1300 volta suave. Medir o declive sem isso
  // acusaria ladeira onde a cena desenhou uma esplanada plana.
  const alturaEm = (x: number, z: number, fator: (r: number) => number): number => {
    const bruto = cruaEm(x, z) * fator(Math.hypot(x, z))
    const r = Math.hypot(x, z)
    if (r >= PLATO_FUNDE) return bruto
    if (r <= PLATO_R) return 0
    const t = (r - PLATO_R) / (PLATO_FUNDE - PLATO_R)
    return bruto * (t * t * (3 - 2 * t))
  }

  const parkX = Math.round(PARK_DIST * Math.sin((PARK_BEARING_DEG * Math.PI) / 180))
  const parkZ = -Math.round(PARK_DIST * Math.cos((PARK_BEARING_DEG * Math.PI) / 180))
  const noParque = (x: number, z: number) => Math.hypot(x - parkX, z - parkZ) <= PARK_CORE

  const R = meta.siteRadiusM
  // ⚠️⚠️ O DECLIVE SE MEDE NA RESOLUÇÃO DO DADO, e a primeira versão desta
  // prancha errou isso. Eu amostrava a cada 8 m sobre uma malha cujo dado tem
  // 59,2 m: a interpolação bilinear cria quebras nas bordas de célula, e o
  // resultado saiu um chiado laranja e preto que parecia relevo e era artefato.
  // Pior, a área a menos de 2° saiu 5,30 km² contra os ~21 km² medidos por
  // outro caminho, e a diferença inteira era método, não terreno.
  // Agora o gradiente é calculado UMA vez por célula, com a linha de base de
  // 59,2 m que o DEM realmente carrega, e a prancha interpola o DECLIVE para
  // desenhar. Um prédio de 15 m pousa num trecho localmente plano entre duas
  // amostras da NASA: a inclinação que importa para ele é a da célula.
  const PASSO = 8
  const lado = Math.ceil((2 * R) / PASSO)
  const areaCelula = (PASSO * PASSO) / 1e6 // km2

  const areaFaixa = new Array(FAIXAS.length).fill(0)
  const exageroAntigo = new Array(FAIXAS.length).fill(0)
  let areaPraca = 0
  let areaParque = 0
  let areaSitio = 0

  // buffer de classe por amostra, para desenhar depois sem medir de novo
  const classe = new Int8Array(lado * lado).fill(-1) // -1 fora, 0..4 faixa, 5 praça, 6 parque

  // campo de declive por célula (uma vez), depois interpolado para desenhar
  const campoDeclive = (fator: (r: number) => number): Float32Array => {
    const g = new Float32Array(n * n)
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const x = (i - half) * cell
        const z = (j - half) * cell
        const hx = (alturaEm(x + cell, z, fator) - alturaEm(x - cell, z, fator)) / (2 * cell)
        const hz = (alturaEm(x, z + cell, fator) - alturaEm(x, z - cell, fator)) / (2 * cell)
        g[j * n + i] = (Math.atan(Math.hypot(hx, hz)) * 180) / Math.PI
      }
    }
    return g
  }
  // ⚠️ O CAMPO PRINCIPAL É O DA CENA. O outro fica só para mostrar de quanto era
  // o erro: é o que esta prancha publicava quando o exagero era 2 em todo lugar.
  const gradeCena = campoDeclive(exagCena)
  const gradeAntigo = campoDeclive(exagAntigo)
  const leDoCampo = (g: Float32Array, x: number, z: number): number => {
    const fi = Math.min(n - 1.001, Math.max(0, x / cell + half))
    const fj = Math.min(n - 1.001, Math.max(0, z / cell + half))
    const i = Math.floor(fi), j = Math.floor(fj)
    const u = fi - i, v = fj - j
    const G = (a: number, b: number) => g[Math.min(n - 1, b) * n + Math.min(n - 1, a)]
    return (
      G(i, j) * (1 - u) * (1 - v) + G(i + 1, j) * u * (1 - v) +
      G(i, j + 1) * (1 - u) * v + G(i + 1, j + 1) * u * v
    )
  }
  const declive = (x: number, z: number) => leDoCampo(gradeCena, x, z)
  const decliveAntigo = (x: number, z: number) => leDoCampo(gradeAntigo, x, z)

  for (let a = 0; a < lado; a++) {
    const z = -R + (a + 0.5) * PASSO
    for (let b = 0; b < lado; b++) {
      const x = -R + (b + 0.5) * PASSO
      const idx = a * lado + b
      if (Math.hypot(x, z) > R) continue
      areaSitio += areaCelula
      if (Math.hypot(x, z) <= PLATO_R) { classe[idx] = 5; areaPraca += areaCelula; continue }
      if (noParque(x, z)) { classe[idx] = 6; areaParque += areaCelula; continue }
      const g = declive(x, z)
      let f = FAIXAS.length - 1
      for (let k = 0; k < FAIXAS.length; k++) if (g <= FAIXAS[k].max) { f = k; break }
      classe[idx] = f
      areaFaixa[f] += areaCelula
      const gr = decliveAntigo(x, z)
      for (let k = 0; k < FAIXAS.length; k++) if (gr <= FAIXAS[k].max) { exageroAntigo[k] += areaCelula; break }
    }
  }

  // ── OS BRAÇOS: as direções com mais terra boa ────────────────────────────
  // Para cada rumo, caminha do fim do platô até a borda somando quanto do raio
  // passa no filtro de 4°, que é o cenário mais provável. O rumo vira candidato
  // a corredor de crescimento. Não é gosto: é onde a Lua deixa construir.
  const bomPorRumo: number[] = []
  for (let rumo = 0; rumo < 360; rumo++) {
    const rad = (rumo * Math.PI) / 180
    let bom = 0
    for (let r = PLATO_R; r < R; r += 12) {
      const x = Math.sin(rad) * r
      const z = -Math.cos(rad) * r
      if (noParque(x, z)) continue
      if (declive(x, z) <= 4) bom += 12
    }
    bomPorRumo.push(bom)
  }
  // seis picos separados por pelo menos 35 graus, para não sair tudo colado
  const bracos: { rumo: number; alcance: number; bom: number }[] = []
  const usados: number[] = []
  const ordem = bomPorRumo.map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v)
  for (const c of ordem) {
    if (bracos.length >= 6) break
    if (usados.some((u) => Math.min(Math.abs(u - c.i), 360 - Math.abs(u - c.i)) < 35)) continue
    usados.push(c.i)
    bracos.push({ rumo: c.i, alcance: c.v, bom: c.v })
  }
  bracos.sort((a, b) => a.rumo - b.rumo)

  setRes({ areaFaixa, areaPraca, areaParque, areaSitio, bracos, exageroAntigo })

  // ── DESENHO ──────────────────────────────────────────────────────────────
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  const W = Math.min(920, canvas.parentElement?.clientWidth ?? 900)
  canvas.width = W * dpr
  canvas.height = W * dpr
  canvas.style.height = `${W}px`
  const ctx = canvas.getContext('2d')!
  ctx.scale(dpr, dpr)
  ctx.fillStyle = '#0a0908'
  ctx.fillRect(0, 0, W, W)

  const px = W / lado
  for (let a = 0; a < lado; a++) {
    for (let b = 0; b < lado; b++) {
      const c = classe[a * lado + b]
      if (c < 0) continue
      ctx.fillStyle = c === 5 ? '#161310' : c === 6 ? '#1d2a22' : FAIXAS[c].cor
      ctx.fillRect(b * px, a * px, px + 0.6, px + 0.6)
    }
  }

  const centro = W / 2
  const emTela = (m: number) => (m / R) * (W / 2)
  const linha = (r: number, cor: string, tracejado?: number[]) => {
    ctx.beginPath()
    ctx.setLineDash(tracejado ?? [])
    ctx.strokeStyle = cor
    ctx.lineWidth = 1
    ctx.arc(centro, centro, emTela(r), 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])
  }
  linha(R, 'rgba(255,255,255,0.35)')
  linha(PLATO_R, 'rgba(255,255,255,0.5)', [4, 4])
  linha(PLATO_FUNDE, 'rgba(255,255,255,0.18)', [2, 6])

  // os braços, saindo da borda do platô
  ctx.lineWidth = 2
  for (const br of bracos) {
    const rad = (br.rumo * Math.PI) / 180
    const x0 = centro + emTela(Math.sin(rad) * PLATO_R)
    const y0 = centro + emTela(-Math.cos(rad) * PLATO_R)
    const x1 = centro + emTela(Math.sin(rad) * R)
    const y1 = centro + emTela(-Math.cos(rad) * R)
    const g = ctx.createLinearGradient(x0, y0, x1, y1)
    g.addColorStop(0, 'rgba(255,255,255,0.75)')
    g.addColorStop(1, 'rgba(255,255,255,0.05)')
    ctx.strokeStyle = g
    ctx.beginPath()
    ctx.moveTo(x0, y0)
    ctx.lineTo(x1, y1)
    ctx.stroke()
    ctx.fillStyle = 'rgba(255,255,255,0.55)'
    ctx.font = '10px ui-monospace, monospace'
    ctx.fillText(`${br.rumo}°`, x1 - 12, y1 + (y1 > centro ? 12 : -4))
  }

  // marcos que já existem no mundo, para o fundador se situar
  const marco = (x: number, z: number, txt: string, cor: string) => {
    const cx = centro + emTela(x)
    const cy = centro + emTela(z)
    ctx.fillStyle = cor
    ctx.beginPath()
    ctx.arc(cx, cy, 3.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.font = '10px ui-monospace, monospace'
    ctx.fillText(txt, cx + 6, cy + 3)
  }
  marco(0, 0, 'Praça', 'rgba(255,255,255,0.9)')
  marco(WAR.x, WAR.z, 'Cratera', '#ff6a4c')
  marco(SPACEPORT.x, SPACEPORT.z, 'Spaceport', '#9ecbff')
  // o parque só aparece de raspão: o núcleo dele entra pelo canto nordeste
  const pxx = centro + emTela(parkX)
  const pzz = centro + emTela(parkZ)
  ctx.strokeStyle = 'rgba(120,200,150,0.5)'
  ctx.setLineDash([5, 5])
  ctx.beginPath()
  ctx.arc(pxx, pzz, emTela(PARK_CORE), 0, Math.PI * 2)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.fillStyle = 'rgba(120,200,150,0.8)'
  ctx.font = '10px ui-monospace, monospace'
  ctx.fillText('Parque Runestone', Math.min(W - 110, pxx - 40), Math.max(12, pzz + 14))

  // escala
  ctx.strokeStyle = 'rgba(255,255,255,0.6)'
  ctx.lineWidth = 2
  const esc = emTela(1000)
  ctx.beginPath()
  ctx.moveTo(16, W - 18)
  ctx.lineTo(16 + esc, W - 18)
  ctx.stroke()
  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  ctx.font = '10px ui-monospace, monospace'
  ctx.fillText('1 km', 16 + esc / 2 - 12, W - 24)
  ctx.fillText('N', centro - 4, 16)
}
