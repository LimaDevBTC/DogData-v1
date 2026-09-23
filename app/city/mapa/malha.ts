// ═══════════════════════════════════════════════════════════════════════════
// O TECIDO VIÁRIO E O PROGRAMA, PRÉ-PROCESSADOS PARA CANVAS 2D.
//
// Lê as MESMAS fontes que a cena 3D lê para o programa: public/city/
// cidade-malha.json (quarteirões) e public/city/mapa-v1.json (programa,
// âncoras, contorno), e faz só a conta de geometria que falta para desenhar
// polígono uma vez, no carregamento, em vez de recalcular seno e cosseno a
// cada quadro.
//
// ⚠️ A REDE VIÁRIA NÃO É MAIS DERIVADA AQUI — ELA É LIDA PRONTA. Até 23/09 este
// módulo rederivava avenida, anel viário e teia a partir do manifesto CRU
// (`cidade-malha.json.aneisViarios`, `mapa-v1.json.avenidas/alca/teia`), sem as
// regras de água/alça/orla que só existem em código dentro de
// `app/city/plaza/vias.ts`. Resultado, visto pelo fundador na chapa do
// /city/mapa: "tem radial em cima da água, tem dodecaedro na orla nobre, isso
// tinha sido resolvido anteriormente" — e tinha, só que na CENA, não no mapa
// 2D, que nunca leu aquele resultado. RÉPLICA DIVERGE; A FONTE NÃO.
//
// O conserto é `carregarVias()`, logo abaixo: ela lê `public/city/mapa/
// vias.json`, um DUMP da rede que a cena 3D desenha de verdade — já viva, já
// cortada por água/alça/orla e, na teia fina, já podada por componente conexo
// — assado por `scripts/city/mapa/assar-vias.mjs` (Playwright, chama
// `window.__plazaVias()` atrás de `?stats=1`). Se o arquivo faltar, o mapa
// desenha sem rede viária e avisa no canto (ver `mapa-client.tsx`); ele NUNCA
// volta a rederivar em silêncio, porque foi exatamente esse silêncio que
// produziu a regressão.
//
// ⚠️ GIRO EM GRAUS AQUI, EM RADIANOS NO REGISTRO DE LOTES. A fonte usa graus
// (esquema dela); registro.ts já converte o giro do LOTE para radianos na
// leitura. Convertemos aqui uma vez, no carregamento.
//
// ⚠️ PROGRAMA E ÂNCORAS JÁ TÊM POLÍGONO ABSOLUTO. Os 70 itens de `programa` (e
// as 7 âncoras dentro dele) trazem `poly` em coordenadas de mundo prontas, só
// os 70 diagnosticados por gerar-derivados.mjs como "sem poly" precisariam de
// fallback por retângulo, e hoje (23/09) são zero. Se um dia existir algum, ele
// simplesmente não desenha (silencioso, não quebra o mapa).
//
// ⚠️ ESTE MÓDULO NÃO DECIDE COR NEM NOME: isso é estilo.ts, que por sua vez
// importa de app/dogcity/dogcity-data.ts (a fonte pública única).
// ═══════════════════════════════════════════════════════════════════════════

const RAD = Math.PI / 180

/**
 * Um trecho já vivo da rede viária, exatamente como `app/city/plaza/vias.ts`
 * desenhou (ver a doutrina de `viasDump` lá dentro). `tipo` é a FORMA do
 * traço, não a largura real de todas as vias que ele cobre:
 *
 *   avenida   as 12 avenidas radiais (34-44 m)
 *   anel      o anel viário arterial (26-44 m, inclui a AN7 em círculo) E o
 *             arco fino da teia (12 m) — a mesma forma circular, larguras
 *             diferentes; `larg` é quem separa os dois na hora de desenhar
 *             (ver `LARG_ANEL_ESTRUTURAL` em `desenho.ts`)
 *   radial    o radial grosso da teia (12 m, `SEC_RUA`)
 *   travessa  o radial fino da teia (9 m, `SEC_TRAVESSA_C`, só a partir do
 *             anel 14)
 *   orla      a via de orla que costura a margem dos lagos (12 m)
 *
 * `pontos` já vem em coordenadas de mundo, arredondado a 10 cm no dump (ou a
 * 1 m se `assar-vias.mjs` precisou simplificar por Douglas-Peucker).
 */
export interface Via {
  tipo: 'anel' | 'radial' | 'travessa' | 'avenida' | 'orla'
  larg: number
  pontos: [number, number][]
}

export interface Peca { id: string; tipo: string; nomeEn: string; poly: Float32Array /* n×2 */; cx: number; cz: number }
export interface Quarteiroes { n: number; setor: Uint8Array; poligonos: Float32Array /* n×8: 4 cantos */ }

export interface Malha {
  /** `null` só quando `public/city/mapa/vias.json` não existe ou não carregou;
   *  ver a doutrina completa no cabeçalho deste arquivo. */
  vias: Via[] | null
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

/**
 * `public/city/mapa/vias.json`, o dump da rede que a cena 3D desenha (ver a
 * doutrina no cabeçalho do arquivo). `null` se faltar ou vier malformado — o
 * mapa não é fatal por causa disso, só perde a camada de rua e avisa.
 */
async function carregarVias(): Promise<Via[] | null> {
  try {
    const r = await fetch('/city/mapa/vias.json')
    if (!r.ok) return null
    const v = await r.json()
    return Array.isArray(v) ? (v as Via[]) : null
  } catch {
    return null
  }
}

export async function carregarMalha(): Promise<Malha> {
  const [cidadeMalha, mapaV1, vias] = await Promise.all([
    json<any>('/city/cidade-malha.json'),
    json<any>('/city/mapa-v1.json'),
    carregarVias(),
  ])

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
    vias,
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
