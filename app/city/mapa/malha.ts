// ═══════════════════════════════════════════════════════════════════════════
// O TECIDO VIÁRIO E O PROGRAMA, PRÉ-PROCESSADOS PARA CANVAS 2D.
//
// Lê as MESMAS fontes que a cena 3D lê — public/city/cidade-malha.json
// (quarteirões, quartos, bulevares, lagos, anéis) e public/city/mapa-v1.json
// (teia, avenidas, alça, água, programa, âncoras) — e faz só a conta de
// geometria que falta para desenhar linha e polígono uma vez, no carregamento,
// em vez de recalcular seno e cosseno a cada quadro.
//
// ⚠️ GIRO/RUMO EM GRAUS AQUI, EM RADIANOS NO REGISTRO DE LOTES. As duas fontes
// usam graus (esquema delas); registro.ts já converte o giro do LOTE para
// radianos na leitura. Convertemos aqui uma vez, no carregamento.
//
// ⚠️ "ang" DA TEIA JÁ É RUMO DE BÚSSOLA, não ângulo matemático cru. Conferido
// em 23/09 contra as 12 avenidas: radiais[14].ang = 0,5236 rad = 30°, igual ao
// rumo da avenida de 30° (168 radiais / 12 avenidas = espaçamento de 14). O
// mundo é x=leste, z=sul: wx = r·sin(rumo), wz = -r·cos(rumo).
//
// ⚠️ PROGRAMA E ÂNCORAS JÁ TÊM POLÍGONO ABSOLUTO. Os 70 itens de `programa` (e
// as 7 âncoras dentro dele) trazem `poly` em coordenadas de mundo prontas — só
// os 70 diagnosticados por gerar-derivados.mjs como "sem poly" precisariam de
// fallback por retângulo, e hoje (23/09) são zero. Se um dia existir algum, ele
// simplesmente não desenha (silencioso, não quebra o mapa).
//
// ⚠️ ESTE MÓDULO NÃO DECIDE COR NEM NOME — isso é estilo.ts, que por sua vez
// importa de app/dogcity/dogcity-data.ts (a fonte pública única).
// ═══════════════════════════════════════════════════════════════════════════

const RAD = Math.PI / 180

/** ponto (x,z) de um rumo de bússola (0 = norte = -z, cresce para leste = +x) */
const doRumo = (rumoGraus: number, r: number): [number, number] => {
  const a = rumoGraus * RAD
  return [Math.sin(a) * r, -Math.cos(a) * r]
}

export interface Segmento { x0: number; z0: number; x1: number; z1: number; larguraM: number; papel: string }
export interface AneisDodecagono { id: string; nome: string; larguraM: number; vertices: Float32Array /* 12×2 */ }
export interface ArcoAlca { r: number; larguraM: number; rumoIni: number; rumoFim: number /* sentido horário, atravessa 0 */ }
export interface Peca { id: string; tipo: string; nomeEn: string; poly: Float32Array /* n×2 */; cx: number; cz: number }
export interface Quarteiroes { n: number; setor: Uint8Array; poligonos: Float32Array /* n×8: 4 cantos */ }

export interface Malha {
  bulevares: Segmento[]
  avenidas: Segmento[]
  aneisViarios: AneisDodecagono[]
  alca: ArcoAlca
  teiaRadiais: Segmento[]
  teiaAneis: number[]
  quarteiroes: Quarteiroes
  programa: Peca[]
  ancoras: Peca[]
  contorno: Float32Array /* n×2, polígono do sítio */
  raioSitio: number
  raioCasca: number
}

export interface Selo {
  bloco: number
  merkleRoot: string
  lotes: number
  lapides: number
  carteiras: number
  fundo: { arquivo: string; n: number; x0: number; z0: number; celula: number }
  agua: { arquivo: string; n: number; extensao: number; cabecalhoBytes: number }
}

export interface Agua { n: number; ext: number; bits: Uint8Array }

async function json<T>(url: string): Promise<T> {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`)
  return r.json() as Promise<T>
}

/** os quatro cantos de um retângulo centrado em (cx,cz), giro em GRAUS */
function retanguloGraus(cx: number, cz: number, meiaLargura: number, meiaProf: number, giroGraus: number): Float32Array {
  const a = giroGraus * RAD
  const c = Math.cos(a), s = Math.sin(a)
  const out = new Float32Array(8)
  let k = 0
  for (const [lx, lz] of [[-meiaLargura, -meiaProf], [meiaLargura, -meiaProf], [meiaLargura, meiaProf], [-meiaLargura, meiaProf]] as const) {
    out[k++] = cx + lx * c - lz * s
    out[k++] = cz + lx * s + lz * c
  }
  return out
}

export async function carregarMalha(): Promise<Malha> {
  const [cidadeMalha, mapaV1] = await Promise.all([
    json<any>('/city/cidade-malha.json'),
    json<any>('/city/mapa-v1.json'),
  ])

  const bulevares: Segmento[] = cidadeMalha.bulevares.map((b: any) => ({
    x0: b.x0, z0: b.z0, x1: b.x1, z1: b.z1, larguraM: b.largura, papel: b.papel,
  }))

  const { rInicio, rFim, lista } = mapaV1.avenidas
  const avenidas: Segmento[] = lista.map((a: any) => {
    const [x0, z0] = doRumo(a.rumo, rInicio)
    const [x1, z1] = doRumo(a.rumo, rFim)
    return { x0, z0, x1, z1, larguraM: a.largura, papel: a.papel }
  })

  // ⚠️ DODECÁGONO, NÃO CÍRCULO (armadilha medida do projeto). O vértice é o
  // `.r` do anel; a face fica a cos(15°) ≈ 96,6% disso. Os 12 vértices caem
  // nos mesmos 12 rumos das avenidas (0°, 30°, …), o que é o motivo de a
  // avenida "chegar" exatamente na esquina do anel.
  const aneisViarios: AneisDodecagono[] = cidadeMalha.aneisViarios.map((an: any) => {
    const v = new Float32Array(24)
    for (let k = 0; k < 12; k++) {
      const [x, z] = doRumo(k * 30, an.r)
      v[k * 2] = x
      v[k * 2 + 1] = z
    }
    return { id: an.id, nome: an.nome, larguraM: an.larg, vertices: v }
  })

  // a alça (AN7): É a via que NÃO é dodecágono — arco de círculo verdadeiro
  // sobre a baía, de rumo 330° a 120° passando por 0° (memória do projeto).
  const alca: ArcoAlca = {
    r: mapaV1.alca.avenida.r,
    larguraM: mapaV1.alca.avenida.larg,
    rumoIni: mapaV1.alca.avenida.arco[0],
    rumoFim: mapaV1.alca.avenida.arco[1],
  }

  const teia = mapaV1.teia
  const teiaRadiais: Segmento[] = teia.radiais.map((rd: any) => {
    const [x0, z0] = doRumo((rd.ang * 180) / Math.PI, rd.nasce)
    const [x1, z1] = doRumo((rd.ang * 180) / Math.PI, teia.rFora)
    return { x0, z0, x1, z1, larguraM: teia.meiaLargura * 2, papel: 'teia' }
  })
  const teiaAneis: number[] = teia.aneis

  // quarteirões: 2.071 retângulos girados, pré-computados uma vez (é barato
  // recalcular todo quadro, mas é mais barato ainda não fazer trigonometria
  // 2.071 vezes por frame durante um pan contínuo)
  const qList = cidadeMalha.quarteiroes as any[]
  const qN = qList.length
  const qSetor = new Uint8Array(qN)
  const qPoly = new Float32Array(qN * 8)
  for (let i = 0; i < qN; i++) {
    const q = qList[i]
    qSetor[i] = q.setor
    qPoly.set(retanguloGraus(q.x, q.z, q.lado / 2, q.prof / 2, q.giro), i * 8)
  }

  const paraPeca = (p: any): Peca => {
    const poly = new Float32Array(p.poly.length * 2)
    for (let k = 0; k < p.poly.length; k++) { poly[k * 2] = p.poly[k][0]; poly[k * 2 + 1] = p.poly[k][1] }
    return { id: p.id, tipo: p.tipo ?? 'ancora', nomeEn: p.nome, poly, cx: p.cx, cz: p.cz }
  }
  const programa: Peca[] = (mapaV1.programa as any[]).filter((p) => p.poly).map(paraPeca)
  const ancoras: Peca[] = (mapaV1.ancoras as any[]).filter((p) => p.poly).map(paraPeca)

  const contornoSrc = mapaV1.contorno as [number, number][]
  const contorno = new Float32Array(contornoSrc.length * 2)
  for (let k = 0; k < contornoSrc.length; k++) { contorno[k * 2] = contornoSrc[k][0]; contorno[k * 2 + 1] = contornoSrc[k][1] }

  return {
    bulevares, avenidas, aneisViarios, alca, teiaRadiais, teiaAneis,
    quarteiroes: { n: qN, setor: qSetor, poligonos: qPoly },
    programa, ancoras, contorno,
    raioSitio: cidadeMalha.esquema ? 9000 : 9000,
    raioCasca: mapaV1.terraplenagem?.casca?.r ?? 9050,
  }
}

export async function carregarSelo(): Promise<Selo> {
  return json<Selo>('/city/mapa/selo.json')
}

export async function carregarAgua(): Promise<Agua> {
  const r = await fetch('/city/mapa/agua.bin')
  if (!r.ok) throw new Error(`agua.bin: HTTP ${r.status}`)
  const buf = new Uint8Array(await r.arrayBuffer())
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  const magic = String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3))
  if (magic !== 'DCAG') throw new Error('agua.bin: assinatura inesperada')
  const n = dv.getUint16(4, true)
  const ext = dv.getFloat32(8, true)
  return { n, ext, bits: buf.subarray(12) }
}

/** célula de água mais próxima de (x,z); usada só para NÃO desenhar via em
 *  cima da baía, nunca para decidir o que é lote (isso é o registro real). */
export function ehAgua(agua: Agua, x: number, z: number): boolean {
  const { n, ext, bits } = agua
  const i = Math.floor(((x + ext) * n) / (2 * ext))
  const j = Math.floor(((z + ext) * n) / (2 * ext))
  if (i < 0 || j < 0 || i >= n || j >= n) return false
  const k = j * n + i
  return ((bits[k >> 3] >> (k & 7)) & 1) === 1
}
