// ═══════════════════════════════════════════════════════════════════════════
// O REGISTRO NO NAVEGADOR: os 70.709 lotes decodificados em arrays tipados,
// mais um índice espacial de 200 m para o mapa não desenhar a cidade inteira a
// cada quadro nem varrer 70 mil lotes a cada clique.
//
// Lê os MESMOS arquivos que a cena 3D lê (app/city/plaza/tecido.ts):
//   public/city/cidade-lotes.bin   registro v3, 15 bytes, <hhBBHBHHH>
//   public/city/cidade-cotas.bin   int16 em CENTÍMETROS, mesma ordem
// e um derivado deste mapa, gerado por scripts/city/mapa/gerar-derivados.mjs:
//   public/city/mapa/lotes-indice.bin   uint32 por lote: quarto, quarteirão,
//                                        lote e a área exata do CSV
//
// ⚠️ DECODIFICAÇÃO IGUAL À DO 3D, NÃO PARECIDA. x e z em QUARTOS de metro
// (int16), setor 0-BASED (o lot_id usa setor+1), frente e fundo em DECÍMETROS
// (uint16), giro em CENTÉSIMOS de grau (uint16), flags: bit0 DSC, bits 1-3
// forma. O registro v3 (21/09) tirou os quatro bits de quarto de metro da flag
// que a v2 tinha nos bits 4-7 (eles eram remendo do campo de 1 byte); hoje o
// nibble alto é zero em todos os 70.709 registros e este leitor o ignora, como
// tecido.ts. Se um dia voltar a ter valor, é outra versão de registro e
// cidade.json vai dizer.
//
// ⚠️ A ORDEM É O ELO. O índice, as cotas e o .bin são "o registro i": o leitor
// recusa índice com contagem diferente da do .bin, porque um índice velho sobre
// um .bin novo daria o lot_id de um lote a outro sem nenhum erro visível.
// ═══════════════════════════════════════════════════════════════════════════

export const URL_LOTES = '/city/cidade-lotes.bin'
export const URL_COTAS = '/city/cidade-cotas.bin'
export const URL_INDICE = '/city/mapa/lotes-indice.bin'

const REG = 15
const CEL_GRADE = 200

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
  /** metros */
  frente: Float32Array
  prof: Float32Array
  /** radianos, positivo de +x para +z (esquema de cidade-malha.json) */
  giro: Float32Array
  /** metros */
  cota: Float32Array
  /** m² do registro (CSV), não frente×fundo arredondado */
  area: Uint32Array
  quarto: Uint8Array
  quarteirao: Uint16Array
  lote: Uint16Array
  /** meia diagonal, para o corte por caixa */
  raio: Float32Array
  grade: Grade
  porChave: Map<number, number>
}

async function baixar(url: string): Promise<ArrayBuffer> {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`)
  return r.arrayBuffer()
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

export async function carregarRegistro(): Promise<Registro> {
  const [bLotes, bCotas, bIndice] = await Promise.all([baixar(URL_LOTES), baixar(URL_COTAS), baixar(URL_INDICE)])
  const dv = new DataView(bLotes)
  const n = Math.floor(bLotes.byteLength / REG)
  if (bCotas.byteLength !== n * 2) throw new Error(`cidade-cotas.bin: ${bCotas.byteLength} bytes para ${n} lotes`)
  const di = new DataView(bIndice)
  const magic = String.fromCharCode(di.getUint8(0), di.getUint8(1), di.getUint8(2), di.getUint8(3))
  if (magic !== 'DCMI' || di.getUint32(4, true) !== n || di.getUint16(8, true) !== 1)
    throw new Error('lotes-indice.bin não casa com cidade-lotes.bin (regenerar: scripts/city/mapa/gerar-derivados.mjs)')
  const dc = new DataView(bCotas)

  const x = new Float32Array(n), z = new Float32Array(n)
  const setor = new Uint8Array(n), coorte = new Uint8Array(n), familia = new Uint16Array(n)
  const forma = new Uint8Array(n), dsc = new Uint8Array(n)
  const frente = new Float32Array(n), prof = new Float32Array(n), giro = new Float32Array(n)
  const cota = new Float32Array(n), area = new Uint32Array(n)
  const quarto = new Uint8Array(n), quarteirao = new Uint16Array(n), lote = new Uint16Array(n)
  const raio = new Float32Array(n)
  const porChave = new Map<number, number>()

  let xmin = Infinity, xmax = -Infinity, zmin = Infinity, zmax = -Infinity, rmax = 0
  for (let i = 0; i < n; i++) {
    const off = i * REG
    x[i] = dv.getInt16(off, true) / 4
    z[i] = dv.getInt16(off + 2, true) / 4
    setor[i] = dv.getUint8(off + 4) + 1
    coorte[i] = dv.getUint8(off + 5)
    familia[i] = dv.getUint16(off + 6, true)
    const flags = dv.getUint8(off + 8)
    dsc[i] = flags & 1
    forma[i] = Math.min(4, (flags >> 1) & 7)
    const w10 = dv.getUint16(off + 9, true), d10 = dv.getUint16(off + 11, true)
    frente[i] = w10 / 10
    prof[i] = d10 / 10
    giro[i] = (dv.getUint16(off + 13, true) / 100) * (Math.PI / 180)
    cota[i] = dc.getInt16(i * 2, true) / 100
    const palavra = di.getUint32(12 + i * 4, true)
    lote[i] = palavra & 511
    quarteirao[i] = (palavra >>> 9) & 511
    quarto[i] = (palavra >>> 18) & 31
    const delta = ((palavra >>> 23) & 255) - 128
    area[i] = Math.max(0, Math.round((w10 / 10) * (d10 / 10)) + delta)
    raio[i] = Math.hypot(frente[i], prof[i]) / 2
    porChave.set(chaveDoLote(setor[i], quarto[i], quarteirao[i], lote[i]), i)
    if (x[i] < xmin) xmin = x[i]
    if (x[i] > xmax) xmax = x[i]
    if (z[i] < zmin) zmin = z[i]
    if (z[i] > zmax) zmax = z[i]
    if (raio[i] > rmax) rmax = raio[i]
  }

  // ── a grade: CSR em duas passadas, cada lote em toda célula que a caixa
  // dele toca (o lote institucional de 891 m de testada entra em ~25) ──────
  const x0 = Math.floor((xmin - rmax) / CEL_GRADE) * CEL_GRADE
  const z0 = Math.floor((zmin - rmax) / CEL_GRADE) * CEL_GRADE
  const nx = Math.ceil((xmax + rmax - x0) / CEL_GRADE) + 1
  const nz = Math.ceil((zmax + rmax - z0) / CEL_GRADE) + 1
  const inicio = new Int32Array(nx * nz + 1)
  const caixa = (i: number) => {
    const c = Math.abs(Math.cos(giro[i])), s = Math.abs(Math.sin(giro[i]))
    const hw = (c * frente[i] + s * prof[i]) / 2
    const hh = (s * frente[i] + c * prof[i]) / 2
    return [
      Math.floor((x[i] - hw - x0) / CEL_GRADE), Math.floor((z[i] - hh - z0) / CEL_GRADE),
      Math.floor((x[i] + hw - x0) / CEL_GRADE), Math.floor((z[i] + hh - z0) / CEL_GRADE),
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
           quarto, quarteirao, lote, raio, porChave,
           grade: { cel: CEL_GRADE, x0, z0, nx, nz, inicio, itens } }
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
    const dx = px - r.x[idx], dz = pz - r.z[idx]
    const c = Math.cos(r.giro[idx]), s = Math.sin(r.giro[idx])
    // inversa de mundo = centro + R(giro)·local
    const lx = dx * c + dz * s, lz = -dx * s + dz * c
    if (Math.abs(lx) <= r.frente[idx] / 2 && Math.abs(lz) <= r.prof[idx] / 2) {
      const a = r.frente[idx] * r.prof[idx]
      if (a < melhorArea) { melhorArea = a; melhor = idx }
    }
  }
  return melhor
}

/** os quatro cantos do lote em mundo, na ordem (-f,-p) (f,-p) (f,p) (-f,p) */
export function cantosDoLote(r: Registro, i: number, out: Float32Array): void {
  const c = Math.cos(r.giro[i]), s = Math.sin(r.giro[i])
  const f = r.frente[i] / 2, p = r.prof[i] / 2
  const cx = r.x[i], cz = r.z[i]
  let k = 0
  for (const [lx, lz] of [[-f, -p], [f, -p], [f, p], [-f, p]] as const) {
    out[k++] = cx + lx * c - lz * s
    out[k++] = cz + lx * s + lz * c
  }
}
