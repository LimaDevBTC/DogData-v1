// ═══════════════════════════════════════════════════════════════════════════
// O REGISTRO NO NAVEGADOR: os lotes decodificados em arrays tipados, mais um
// índice espacial de 200 m para o mapa não desenhar a cidade inteira a cada
// quadro nem varrer a cidade inteira a cada clique.
//
// Lê os MESMOS arquivos que a cena 3D lê (app/city/plaza/tecido.ts) quando o
// registro é v3:
//   public/city/cidade-lotes.bin   registro v3, 15 bytes, <hhBBHBHHH>
//   public/city/cidade-cotas.bin   int16 em CENTÍMETROS, mesma ordem
// e, quando `cidade.json` diz `registroVersao: 4` (masterplan §41), o
// registro novo de 4 cantos absolutos:
//   public/city/cidade-lotes-v4.bin   21 bytes, <8hBBHB>: 8 cantos (quartos
//                                      de metro), setor, coorte, familia, flags
// mais um derivado deste mapa, gerado por scripts/city/mapa/gerar-derivados.mjs:
//   public/city/mapa/lotes-indice.bin   uint32 por lote: quarto, quarteirão,
//                                        lote e a área exata do CSV
//
// ⚠️ QUEM DECIDE A VERSÃO É cidade.json, NUNCA O TAMANHO DO ARQUIVO. Este
// leitor busca cidade.json primeiro; `registroVersao === 4` liga o
// decodificador de 21 bytes (cantos prontos, lidos de `registroArquivo`),
// qualquer outro valor (ou o campo ausente) cai no decodificador v3 de
// sempre (15 bytes, retângulo em `cidade-lotes.bin`).
//
// ⚠️ DEPOIS DE DECODIFICADO, V3 E V4 SÃO A MESMA COISA. Os quatro cantos de
// TODO lote (calculados a partir do retângulo no v3, lidos prontos no v4) vão
// para `cantos`; a grade espacial, o hit-test e o desenho só enxergam
// `cantos` + `geo` daqui para baixo, nunca giro/frente/prof de novo. `geo` só
// existe de fato no v4 (bits 4-5 da flag); o v3 não reserva esse bit e este
// leitor sempre grava 3 (retângulo) para ele, que é o que um lote v3 sempre foi.
//
// ⚠️ FATIA DE ANEL (geo 1) NÃO É QUADRILÁTERO. Emenda de 23/09 ao §41: a
// frente (p0-p1) e o fundo (p2-p3) de um lote geo=1 são ARCOS de círculo
// centrados na ORIGEM (Satoshi Plaza), não a corda entre os pontos gravados
// — uma corda cortaria dezenas de metros para dentro num arco largo (o caso
// medido: 57° de abertura, 114 m de corda). `cantos` guarda os 4 pontos do
// ARQUIVO (as pontas dos dois arcos, raios = |p0| e |p2|, rumos = rumo(p0) e
// rumo(p1)); `loteEm` e a grade tratam geo=1 à parte (raio+rumo), e quem
// desenha (desenho.ts, scripts/city/carta.mjs) traça o arco de verdade,
// nunca a corda reta. geo 0 (célula da teia) e 2 (reta) continuam
// quadrilátero reto, igual a 3.
//
// ⚠️ x e z em QUARTOS de metro (int16), setor 0-BASED (o lot_id usa setor+1).
// No v3: frente e fundo em DECÍMETROS (uint16), giro em CENTÉSIMOS de grau
// (uint16), flags: bit0 DSC, bits 1-3 forma. O nibble alto da flag do v3 é
// sempre zero (o registro v3 tirou os quatro bits de quarto de metro que a
// v2 tinha ali) e este leitor o ignora, como sempre ignorou.
//
// ⚠️ A ORDEM É O ELO. O índice, as cotas e o .bin (v3 OU v4) são "o registro
// i": o leitor recusa índice com contagem diferente da do .bin, porque um
// índice velho sobre um .bin novo daria o lot_id de um lote a outro sem
// nenhum erro visível. O .bin v4 de teste (23/09) é o v3 de hoje convertido
// lote a lote, MESMA ORDEM e MESMA CONTAGEM: o índice de produção continua
// válido sobre ele sem regenerar nada.
//
// ⚠️ ?reg=NOME (só desenvolvimento, ver `raizCidade` abaixo): desvia
// cidade.json, o .bin de lotes, o de cotas e cidade-malha.json para
// /city/NOME/. Sem o parâmetro, os quatro vêm de /city/ como sempre.
// lotes-indice.bin, mapa-v1.json e vias.json NUNCA desviam: não fazem parte
// do registro de lotes (ver a mesma convenção em malha.ts).
// ═══════════════════════════════════════════════════════════════════════════

/** ?reg=_v4teste (ou qualquer nome de pasta sob public/city/) desvia os
 *  quatro arquivos do registro para lá; sem o parâmetro, comportamento de
 *  sempre. Só é lido no navegador (SSR não tem window nem query string aqui). */
function raizCidade(): string {
  if (typeof window === 'undefined') return '/city'
  const nome = new URLSearchParams(window.location.search).get('reg')
  return nome ? `/city/${nome}` : '/city'
}

export const URL_INDICE = '/city/mapa/lotes-indice.bin'

const REG_V3 = 15
const REG_V4 = 21
const CEL_GRADE = 200
const DOIS_PI = Math.PI * 2

export interface Grade {
  cel: number
  x0: number
  z0: number
  nx: number
  nz: number
  /** CSR: início da célula k em `itens` (comprimento nx*nz+1) */
  inicio: Int32Array
  itens: Int32Array
}

export interface Registro {
  n: number
  x: Float32Array
  z: Float32Array
  /** 1..9, já somado o 1 do lot_id */
  setor: Uint8Array
  coorte: Uint8Array
  familia: Uint16Array
  forma: Uint8Array
  dsc: Uint8Array
  /** metros; derivado (§41), calculado do canto no v4 */
  frente: Float32Array
  prof: Float32Array
  /** radianos, positivo de +x para +z (esquema de cidade-malha.json); derivado */
  giro: Float32Array
  /** metros */
  cota: Float32Array
  /** m² do registro (CSV no v3; shoelace exato no v4) */
  area: Uint32Array
  quarto: Uint8Array
  quarteirao: Uint16Array
  lote: Uint16Array
  /** meia diagonal, só informativo (nada aqui usa mais para corte por caixa) */
  raio: Float32Array
  /** 4 cantos por lote, mundo, METROS: p0x p0z p1x p1z p2x p2z p3x p3z (i*8).
   *  p0-p1 é a frente, p2-p3 é o fundo (mesma convenção do CSV, §41). No v3
   *  são calculados do retângulo; no v4 vêm prontos do arquivo. Para geo=1
   *  são as PONTAS dos dois arcos, não os cantos de um quadrilátero: ver o
   *  aviso do cabeçalho antes de desenhar ou testar ponto direto daqui. */
  cantos: Float32Array
  /** 0 célula da teia, 1 fatia de anel (arco, ver aviso do cabeçalho),
   *  2 reta, 3 retângulo legado. Registro v3 sempre grava 3 aqui. */
  geo: Uint8Array
  grade: Grade
  porChave: Map<number, number>
  /** índices dos lotes de S07 (The Spit / Orla Nobre), S08 (Financial
   *  District) e S09 (Bay Shore), ver a doutrina em desenho.ts. */
  especiais: Int32Array
}

async function baixar(url: string): Promise<ArrayBuffer> {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`)
  return r.arrayBuffer()
}

async function baixarJson<T>(url: string): Promise<T> {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`)
  return r.json() as Promise<T>
}

export const chaveDoLote = (s: number, q: number, b: number, l: number) =>
  ((s & 31) << 23) | ((q & 31) << 18) | ((b & 511) << 9) | (l & 511)

export function lotIdDe(r: Registro, i: number): string {
  return `S${String(r.setor[i]).padStart(2, '0')}-Q${String(r.quarto[i]).padStart(2, '0')}-B${String(r.quarteirao[i]).padStart(3, '0')}-L${String(r.lote[i]).padStart(3, '0')}`
}

export const idDoQuarteirao = (r: Registro, i: number) =>
  `S${String(r.setor[i]).padStart(2, '0')}-Q${String(r.quarto[i]).padStart(2, '0')}-B${String(r.quarteirao[i]).padStart(3, '0')}`

const RE_LOT = /^S(\d{2})-Q(\d{2})-B(\d{3})-L(\d{3})$/i
const RE_LAPIDE = /^L(\d{5})$/i

export function parseLotId(id: string): { s: number; q: number; b: number; l: number } | null {
  const m = RE_LOT.exec(id.trim())
  if (!m) return null
  return { s: +m[1], q: +m[2], b: +m[3], l: +m[4] }
}

/** id de lápide (L01234), como a escritura da landing emite para quem recebe nicho */
export function parseLapideId(id: string): number | null {
  const m = RE_LAPIDE.exec(id.trim())
  return m ? +m[1] : null
}

export function indiceDoLotId(r: Registro, id: string): number {
  const p = parseLotId(id)
  if (!p) return -1
  return r.porChave.get(chaveDoLote(p.s, p.q, p.b, p.l)) ?? -1
}

/** rumo (bearing) de um ponto do MUNDO em relação à ORIGEM (Satoshi Plaza):
 *  0 = norte (-z), cresce para leste (+x). Mesma convenção de
 *  scripts/city/carta.mjs (rumoDe) e do giro_graus de fatia de anel no CSV.
 *  Radianos, sempre em [0, 2π) depois de normAngulo. */
export const rumoMundo = (x: number, z: number) => Math.atan2(x, -z)

const normAngulo = (a: number) => ((a % DOIS_PI) + DOIS_PI) % DOIS_PI

/** o rumo está no arco [a0,a1] ANDANDO NO SENTIDO CRESCENTE de a0 até a1
 *  (contrato do §41: p0->p1 é sempre rumo crescente, vale também para os
 *  dois arcos de um geo=1). */
function noArco(rumo: number, a0: number, a1: number): boolean {
  const span = normAngulo(a1 - a0)
  const rel = normAngulo(rumo - a0)
  return rel <= span
}

const CARDEAIS = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]

/** limites (retângulo alinhado aos eixos) do lote i: os 4 cantos armazenados
 *  mais, só para geo=1, qualquer direção cardeal (N/L/S/O) que caia dentro
 *  do arco, medida no raio EXTERNO (a aresta em arco só abaula para FORA da
 *  origem; a interna nunca passa dos próprios cantos, então nunca estende o
 *  limite além do que a externa já cobriu na mesma direção). */
function limitesDoLote(cantos: Float32Array, geo: Uint8Array, i: number, out: Float32Array): void {
  const co = i * 8
  let xmin = Infinity, xmax = -Infinity, zmin = Infinity, zmax = -Infinity
  for (let k = 0; k < 4; k++) {
    const px = cantos[co + k * 2], pz = cantos[co + k * 2 + 1]
    if (px < xmin) xmin = px
    if (px > xmax) xmax = px
    if (pz < zmin) zmin = pz
    if (pz > zmax) zmax = pz
  }
  if (geo[i] === 1) {
    const r0 = Math.hypot(cantos[co], cantos[co + 1]), r1 = Math.hypot(cantos[co + 4], cantos[co + 5])
    const rExt = Math.max(r0, r1)
    const a0 = rumoMundo(cantos[co], cantos[co + 1]), a1 = rumoMundo(cantos[co + 2], cantos[co + 3])
    for (const c of CARDEAIS) {
      if (!noArco(c, a0, a1)) continue
      const px = rExt * Math.sin(c), pz = -rExt * Math.cos(c)
      if (px < xmin) xmin = px
      if (px > xmax) xmax = px
      if (pz < zmin) zmin = pz
      if (pz > zmax) zmax = pz
    }
  }
  out[0] = xmin; out[1] = xmax; out[2] = zmin; out[3] = zmax
}

export async function carregarRegistro(): Promise<Registro> {
  const raiz = raizCidade()
  const cidade = await baixarJson<{ registroVersao?: number; registroBytes?: number; registroArquivo?: string }>(`${raiz}/cidade.json`)
  const v4 = cidade.registroVersao === 4
  const REG = v4 ? REG_V4 : REG_V3
  const arquivoLotes = v4 ? (cidade.registroArquivo || 'cidade-lotes-v4.bin') : 'cidade-lotes.bin'
  if (cidade.registroBytes !== undefined && cidade.registroBytes !== REG)
    throw new Error(`cidade.json declara registroBytes ${cidade.registroBytes}, este leitor espera ${REG} para registroVersao ${cidade.registroVersao ?? 3}`)

  const [bLotes, bCotas, bIndice] = await Promise.all([
    baixar(`${raiz}/${arquivoLotes}`),
    baixar(`${raiz}/cidade-cotas.bin`),
    baixar(URL_INDICE),
  ])
  const dv = new DataView(bLotes)
  const n = Math.floor(bLotes.byteLength / REG)
  if (bCotas.byteLength !== n * 2) throw new Error(`cidade-cotas.bin: ${bCotas.byteLength} bytes para ${n} lotes`)
  const di = new DataView(bIndice)
  const magic = String.fromCharCode(di.getUint8(0), di.getUint8(1), di.getUint8(2), di.getUint8(3))
  if (magic !== 'DCMI' || di.getUint32(4, true) !== n || di.getUint16(8, true) !== 1)
    throw new Error('lotes-indice.bin não casa com o registro de lotes (regenerar: scripts/city/mapa/gerar-derivados.mjs)')
  const dc = new DataView(bCotas)

  const x = new Float32Array(n), z = new Float32Array(n)
  const setor = new Uint8Array(n), coorte = new Uint8Array(n), familia = new Uint16Array(n)
  const forma = new Uint8Array(n), dsc = new Uint8Array(n)
  const frente = new Float32Array(n), prof = new Float32Array(n), giro = new Float32Array(n)
  const cota = new Float32Array(n), area = new Uint32Array(n)
  const quarto = new Uint8Array(n), quarteirao = new Uint16Array(n), lote = new Uint16Array(n)
  const raio = new Float32Array(n)
  const cantos = new Float32Array(n * 8)
  const geo = new Uint8Array(n)
  const porChave = new Map<number, number>()

  const especiaisTmp: number[] = []
  const limBuf = new Float32Array(4)
  let xmin = Infinity, xmax = -Infinity, zmin = Infinity, zmax = -Infinity

  for (let i = 0; i < n; i++) {
    const off = i * REG
    const co = i * 8
    if (v4) {
      const p0x = dv.getInt16(off, true) / 4, p0z = dv.getInt16(off + 2, true) / 4
      const p1x = dv.getInt16(off + 4, true) / 4, p1z = dv.getInt16(off + 6, true) / 4
      const p2x = dv.getInt16(off + 8, true) / 4, p2z = dv.getInt16(off + 10, true) / 4
      const p3x = dv.getInt16(off + 12, true) / 4, p3z = dv.getInt16(off + 14, true) / 4
      cantos[co] = p0x; cantos[co + 1] = p0z; cantos[co + 2] = p1x; cantos[co + 3] = p1z
      cantos[co + 4] = p2x; cantos[co + 5] = p2z; cantos[co + 6] = p3x; cantos[co + 7] = p3z
      setor[i] = dv.getUint8(off + 16) + 1
      coorte[i] = dv.getUint8(off + 17)
      familia[i] = dv.getUint16(off + 18, true)
      const flags = dv.getUint8(off + 20)
      dsc[i] = flags & 1
      forma[i] = Math.min(4, (flags >> 1) & 7)
      geo[i] = (flags >> 4) & 3

      if (geo[i] === 1) {
        // fatia de anel (emenda 23/09 ao §41): área exata é a da COROA, não a
        // do quadrilátero de corda — `(r_f² − r_t²)/2 · Δθ`, r_f/r_t = raio
        // externo/interno, Δθ = abertura angular. Centróide e giro no MEIO do
        // lote (raio médio, rumo médio): o §41 pede exatamente isso para a
        // fatia ("giro_graus = rumo... do meio do lote"), e a aproximação não
        // afeta hit-test nem desenho (que usam raio+rumo contra os cantos
        // direto, nunca este centróide).
        const r0 = Math.hypot(p0x, p0z), r1 = Math.hypot(p2x, p2z)
        const a0 = rumoMundo(p0x, p0z), a1 = rumoMundo(p1x, p1z)
        const dtheta = normAngulo(a1 - a0)
        const rf = Math.max(r0, r1), rt = Math.min(r0, r1)
        area[i] = Math.round(Math.abs(rf * rf - rt * rt) / 2 * dtheta)
        const rMed = (r0 + r1) / 2, aMed = a0 + dtheta / 2
        x[i] = rMed * Math.sin(aMed)
        z[i] = -rMed * Math.cos(aMed)
        frente[i] = r0 * dtheta
        prof[i] = Math.abs(r1 - r0)
        giro[i] = aMed
      } else {
        // shoelace: área exata e centróide do polígono (§41: "área exata do
        // polígono"); cai para a média simples se a área sair degenerada (não
        // deveria acontecer num lote de verdade, é só rede de segurança)
        let a2 = 0, csx = 0, csz = 0
        for (let k = 0; k < 4; k++) {
          const ax = cantos[co + k * 2], az = cantos[co + k * 2 + 1]
          const bx = cantos[co + ((k + 1) & 3) * 2], bz = cantos[co + ((k + 1) & 3) * 2 + 1]
          const cr = ax * bz - bx * az
          a2 += cr
          csx += (ax + bx) * cr
          csz += (az + bz) * cr
        }
        if (Math.abs(a2) > 1e-6) {
          x[i] = csx / (3 * a2)
          z[i] = csz / (3 * a2)
          area[i] = Math.round(Math.abs(a2) / 2)
        } else {
          x[i] = (p0x + p1x + p2x + p3x) / 4
          z[i] = (p0z + p1z + p2z + p3z) / 4
          area[i] = 0
        }
        // derivados só para quem ainda lê frente/prof/giro (painel.tsx): frente
        // é a aresta p0-p1, giro é o rumo dela, prof a distância perpendicular
        // média do fundo até a reta da frente (§41: "distância entre as retas")
        const dxf = p1x - p0x, dzf = p1z - p0z
        const compFrente = Math.hypot(dxf, dzf)
        frente[i] = compFrente
        giro[i] = Math.atan2(dzf, dxf)
        if (compFrente > 1e-6) {
          const ux = dxf / compFrente, uz = dzf / compFrente
          const perp = (px: number, pz: number) => Math.abs((px - p0x) * -uz + (pz - p0z) * ux)
          prof[i] = (perp(p2x, p2z) + perp(p3x, p3z)) / 2
        } else {
          prof[i] = Math.hypot(p2x - p0x, p2z - p0z)
        }
      }
    } else {
      x[i] = dv.getInt16(off, true) / 4
      z[i] = dv.getInt16(off + 2, true) / 4
      setor[i] = dv.getUint8(off + 4) + 1
      coorte[i] = dv.getUint8(off + 5)
      familia[i] = dv.getUint16(off + 6, true)
      const flags = dv.getUint8(off + 8)
      dsc[i] = flags & 1
      forma[i] = Math.min(4, (flags >> 1) & 7)
      geo[i] = 3
      const w10 = dv.getUint16(off + 9, true), d10 = dv.getUint16(off + 11, true)
      frente[i] = w10 / 10
      prof[i] = d10 / 10
      giro[i] = (dv.getUint16(off + 13, true) / 100) * (Math.PI / 180)
      const c = Math.cos(giro[i]), s = Math.sin(giro[i])
      const f = frente[i] / 2, p = prof[i] / 2
      let k = 0
      for (const [lx, lz] of [[-f, -p], [f, -p], [f, p], [-f, p]] as const) {
        cantos[co + k] = x[i] + lx * c - lz * s
        cantos[co + k + 1] = z[i] + lx * s + lz * c
        k += 2
      }
    }
    cota[i] = dc.getInt16(i * 2, true) / 100
    const palavra = di.getUint32(12 + i * 4, true)
    lote[i] = palavra & 511
    quarteirao[i] = (palavra >>> 9) & 511
    quarto[i] = (palavra >>> 18) & 31
    if (!v4) {
      const delta = ((palavra >>> 23) & 255) - 128
      area[i] = Math.max(0, Math.round(frente[i] * prof[i]) + delta)
    }
    raio[i] = Math.hypot(frente[i], prof[i]) / 2
    porChave.set(chaveDoLote(setor[i], quarto[i], quarteirao[i], lote[i]), i)
    if (setor[i] >= 7 && setor[i] <= 9) especiaisTmp.push(i)

    limitesDoLote(cantos, geo, i, limBuf)
    if (limBuf[0] < xmin) xmin = limBuf[0]
    if (limBuf[1] > xmax) xmax = limBuf[1]
    if (limBuf[2] < zmin) zmin = limBuf[2]
    if (limBuf[3] > zmax) zmax = limBuf[3]
  }

  // ── a grade: CSR em duas passadas, cada lote em toda célula que a caixa
  // (real, dos 4 cantos, com a folga do arco quando geo=1) dele toca ────────
  const x0 = Math.floor(xmin / CEL_GRADE) * CEL_GRADE
  const z0 = Math.floor(zmin / CEL_GRADE) * CEL_GRADE
  const nx = Math.ceil((xmax - x0) / CEL_GRADE) + 1
  const nz = Math.ceil((zmax - z0) / CEL_GRADE) + 1
  const inicio = new Int32Array(nx * nz + 1)
  const caixa = (i: number) => {
    limitesDoLote(cantos, geo, i, limBuf)
    return [
      Math.floor((limBuf[0] - x0) / CEL_GRADE), Math.floor((limBuf[2] - z0) / CEL_GRADE),
      Math.floor((limBuf[1] - x0) / CEL_GRADE), Math.floor((limBuf[3] - z0) / CEL_GRADE),
    ]
  }
  for (let i = 0; i < n; i++) {
    const [ia, ja, ib, jb] = caixa(i)
    for (let j = ja; j <= jb; j++) for (let ii = ia; ii <= ib; ii++) inicio[j * nx + ii + 1]++
  }
  for (let k = 0; k < nx * nz; k++) inicio[k + 1] += inicio[k]
  const itens = new Int32Array(inicio[nx * nz])
  const cursor = inicio.slice(0, nx * nz)
  for (let i = 0; i < n; i++) {
    const [ia, ja, ib, jb] = caixa(i)
    for (let j = ja; j <= jb; j++) for (let ii = ia; ii <= ib; ii++) itens[cursor[j * nx + ii]++] = i
  }

  return { n, x, z, setor, coorte, familia, forma, dsc, frente, prof, giro, cota, area,
           quarto, quarteirao, lote, raio, cantos, geo, porChave,
           grade: { cel: CEL_GRADE, x0, z0, nx, nz, inicio, itens },
           especiais: Int32Array.from(especiaisTmp) }
}

// carimbo por consulta para não visitar duas vezes o lote que está em várias
// células; cresce a cada consulta, e 2^32 consultas não acontecem numa sessão
let carimbo = 0
let visto: Uint32Array | null = null

/** visita cada lote cuja caixa toca o retângulo [xmin,xmax]×[zmin,zmax] */
export function consultarGrade(r: Registro, xmin: number, zmin: number, xmax: number, zmax: number, visita: (i: number) => void): void {
  const g = r.grade
  if (!visto || visto.length !== r.n) visto = new Uint32Array(r.n)
  carimbo++
  const ia = Math.max(0, Math.floor((xmin - g.x0) / g.cel)), ib = Math.min(g.nx - 1, Math.floor((xmax - g.x0) / g.cel))
  const ja = Math.max(0, Math.floor((zmin - g.z0) / g.cel)), jb = Math.min(g.nz - 1, Math.floor((zmax - g.z0) / g.cel))
  for (let j = ja; j <= jb; j++) {
    for (let i = ia; i <= ib; i++) {
      const k = j * g.nx + i
      for (let t = g.inicio[k]; t < g.inicio[k + 1]; t++) {
        const idx = g.itens[t]
        if (visto[idx] === carimbo) continue
        visto[idx] = carimbo
        visita(idx)
      }
    }
  }
}

/** ponto (px,pz) dentro do lote idx: quadrilátero convexo (giro livre, teste
 *  por produto vetorial consistente) para geo 0/2/3; raio+rumo dentro do arco
 *  para geo=1 (ver o aviso do cabeçalho: a fatia de anel não é reta). */
function dentroDoLote(r: Registro, idx: number, px: number, pz: number): boolean {
  const co = idx * 8
  if (r.geo[idx] === 1) {
    const r0 = Math.hypot(r.cantos[co], r.cantos[co + 1]), r1 = Math.hypot(r.cantos[co + 4], r.cantos[co + 5])
    const raio = Math.hypot(px, pz)
    if (raio < Math.min(r0, r1) || raio > Math.max(r0, r1)) return false
    const a0 = rumoMundo(r.cantos[co], r.cantos[co + 1]), a1 = rumoMundo(r.cantos[co + 2], r.cantos[co + 3])
    return noArco(rumoMundo(px, pz), a0, a1)
  }
  let sinal = 0
  for (let k = 0; k < 4; k++) {
    const ax = r.cantos[co + k * 2], az = r.cantos[co + k * 2 + 1]
    const bx = r.cantos[co + ((k + 1) & 3) * 2], bz = r.cantos[co + ((k + 1) & 3) * 2 + 1]
    const cruz = (bx - ax) * (pz - az) - (bz - az) * (px - ax)
    if (cruz > 1e-9) { if (sinal < 0) return false; sinal = 1 }
    else if (cruz < -1e-9) { if (sinal > 0) return false; sinal = -1 }
  }
  return true
}

/** o lote sob o ponto (x,z), ou -1. Com sobreposição (superquadra invadindo
 *  fileira vizinha, medido no gerador) ganha o MENOR, que é o que o dedo quis. */
export function loteEm(r: Registro, px: number, pz: number): number {
  const g = r.grade
  const i = Math.floor((px - g.x0) / g.cel), j = Math.floor((pz - g.z0) / g.cel)
  if (i < 0 || j < 0 || i >= g.nx || j >= g.nz) return -1
  const k = j * g.nx + i
  let melhor = -1, melhorArea = Infinity
  for (let t = g.inicio[k]; t < g.inicio[k + 1]; t++) {
    const idx = g.itens[t]
    if (!dentroDoLote(r, idx, px, pz)) continue
    if (r.area[idx] < melhorArea) { melhorArea = r.area[idx]; melhor = idx }
  }
  return melhor
}

/** os quatro cantos do lote em mundo, na ordem do arquivo: p0 p1 p2 p3 (frente
 *  p0-p1, fundo p2-p3, §41). Retângulo de verdade para geo 0/2/3; para geo=1
 *  (fatia de anel) são as PONTAS dos dois arcos, não os cantos de um
 *  quadrilátero: ver o aviso do cabeçalho antes de ligar os pontos com reta. */
export function cantosDoLote(r: Registro, i: number, out: Float32Array): void {
  out.set(r.cantos.subarray(i * 8, i * 8 + 8))
}
