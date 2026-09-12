/**
 * DOG DERBY: o sítio, o assentamento e os orçamentos do modelo.
 *   npx tsx scripts/city/verificar-derby.ts
 *
 * Reprova se a peça sair da parcela, se houver água sob ela, se a saia do modelo
 * não alcançar o ponto mais baixo da pegada, se uma via principal cruzar o
 * envelope, se um vizinho de programa sobrepor, ou se os GLB publicados
 * estourarem o orçamento de carga.
 *
 * ⚠️ NÃO VALIDA O QUE SÓ O NAVEGADOR SABE: FPS, GPU, memória de textura (são
 * zero texturas de propósito) e o ciclo de carga do loader. Também não regenera
 * o loteamento nem fixa lote de holder: o snapshot ainda não aconteceu.
 */
import { readFileSync, existsSync } from 'node:fs'
import assert from 'node:assert/strict'
import { DERBY_ID, DERBY_MOD, DERBY_PECA_X, DERBY_PECA_Z, DERBY_FOLGA_Y,
         DERBY_AMPLITUDE_MEDIDA, derbySitio, derbyCull, derbyParcela } from '../../app/city/plaza/derby'
import { polyDoModulo, caixaDoModulo, anelPonto, aneisDaCidade } from '../../app/city/plaza/teia'

type Pt = [number, number]
const C = JSON.parse(readFileSync('public/city/cidade.json', 'utf8'))
const M = JSON.parse(readFileSync('public/city/cidade-malha.json', 'utf8'))
const peca = C.programa.find((p: { id: string }) => p.id === DERBY_ID)
assert.ok(peca, `peça ${DERBY_ID} não está em cidade.json`)
assert.equal(peca.nome, 'DOG Derby', `o nome publicado é "${peca.nome}"`)

const s = derbySitio()
const parcela = polyDoModulo(DERBY_MOD) as Pt[]
const caixa = caixaDoModulo(DERBY_MOD)
const giro = -(s.rumoDeg * Math.PI) / 180
const cg = Math.cos(giro), sg = Math.sin(giro)
/** um ponto do quadro do MODELO em mundo, com a mesma matriz do Three */
const pt = (dx: number, dz: number): Pt =>
  [s.x + cg * dx + sg * dz, s.z - sg * dx + cg * dz]
const env: Pt[] = ([[-1, -1], [1, -1], [1, 1], [-1, 1]] as const)
  .map(([a, b]) => pt((a * DERBY_PECA_X) / 2, (b * DERBY_PECA_Z) / 2))

function inside(p: Pt, poly: Pt[]) {
  let yes = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j]
    if ((a[1] > p[1]) !== (b[1] > p[1]) &&
        p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) yes = !yes
  }
  return yes
}
function pointSeg(p: Pt, a: Pt, b: Pt) {
  const x = b[0] - a[0], z = b[1] - a[1]
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * x + (p[1] - a[1]) * z) / (x * x + z * z || 1)))
  return Math.hypot(p[0] - a[0] - t * x, p[1] - a[1] - t * z)
}
function segDist(a: Pt, b: Pt, c: Pt, d: Pt) {
  const cr = (u: Pt, v: Pt, p: Pt) => (v[0] - u[0]) * (p[1] - u[1]) - (v[1] - u[1]) * (p[0] - u[0])
  if (cr(a, b, c) * cr(a, b, d) < 0 && cr(c, d, a) * cr(c, d, b) < 0) return 0
  return Math.min(pointSeg(a, c, d), pointSeg(b, c, d), pointSeg(c, a, b), pointSeg(d, a, b))
}
const envDist = (a: Pt, b: Pt) =>
  inside(a, env) || inside(b, env) ? 0
    : Math.min(...env.map((p, i) => segDist(p, env[(i + 1) % env.length], a, b)))

const arco = (caixa.a1 - caixa.a0) * caixa.rm, prof = caixa.r1 - caixa.r0
console.log(`E02 "${peca.nome}" no módulo `
  + `{i:${DERBY_MOD.i},nr:${DERBY_MOD.nr},j:${DERBY_MOD.j},ns:${DERBY_MOD.ns}}`
  + `  bloco ${arco.toFixed(0)} x ${prof.toFixed(0)} m  r ${caixa.rm.toFixed(0)}  rumo ${s.rumoDeg.toFixed(3)}°`)
console.log(`sítio: (${s.x.toFixed(1)}, ${s.z.toFixed(1)})`)
console.log(`envelope ${DERBY_PECA_X} x ${DERBY_PECA_Z} m = ${(DERBY_PECA_X * DERBY_PECA_Z / 1e4).toFixed(2)} ha`
  + `, ocupando ${(100 * DERBY_PECA_X * DERBY_PECA_Z / (arco * prof)).toFixed(0)}% do bloco`)
// ⚠️ A PARCELA PUBLICADA DO GERADOR CONTINUA EM OUTRO LUGAR, e isso é dívida
// registrada, não descuido: a peça 3D mora num módulo da teia (a grade da cena) e
// a reserva E02 mora na grade do gerador. O DOG Athletics tem a mesma divergência
// desde que nasceu. Quem fecha isso é uma rodada do gerador movendo a reserva.
const dGer = Math.hypot(s.x - peca.x, s.z - peca.z)
console.log(`⚠️ a reserva E02 do gerador está a ${dGer.toFixed(0)} m do sítio da peça`)

// ── 1. a peça inteira dentro do MÓDULO, amostrada no perímetro ─────────────
// ⚠️ QUINA NÃO BASTA. O bloco da teia tem lados curvos, e testar só as quatro
// quinas foi o que deixou a implantação anterior sair da parcela por 2 m.
const perim: Pt[] = []
for (let k = 0; k <= 24; k++) {
  const t = -DERBY_PECA_X / 2 + (DERBY_PECA_X * k) / 24
  perim.push(pt(t, -DERBY_PECA_Z / 2), pt(t, DERBY_PECA_Z / 2))
}
for (let k = 0; k <= 20; k++) {
  const t = -DERBY_PECA_Z / 2 + (DERBY_PECA_Z * k) / 20
  perim.push(pt(-DERBY_PECA_X / 2, t), pt(DERBY_PECA_X / 2, t))
}
for (const q of perim) {
  assert.ok(inside(q, parcela),
    `ponto do envelope fora do módulo: ${q.map((v) => v.toFixed(1)).join(', ')}`)
}
const folgaParcela = Math.min(...perim.map((q) =>
  Math.min(...parcela.map((a, i) => pointSeg(q, a, parcela[(i + 1) % parcela.length])))))
console.log(`✓ ${perim.length} pontos do perímetro dentro do módulo, folga mínima ${folgaParcela.toFixed(0)} m`)
assert.ok(folgaParcela >= 8, 'folga menor que 8 m até a borda do módulo')
assert.equal(derbyParcela().poly.length, parcela.length, 'derbyParcela divergiu do módulo')

// ── 2. nenhuma via principal cruza o envelope ──────────────────────────────
// ⚠️ O ANEL É DODECÁGONO E ESTE TESTE O MEDIA COMO CÍRCULO. `Math.sin(t)*a.r`
// traça a circunferência que passa pelos 12 VÉRTICES; o asfalto desenhado por
// `vias.ts` some dela no meio de cada face, e a diferença é a flecha da corda,
// 3,5% do raio, ou seja ~125 m no AN3. Um teste que mede 125 m fora do lugar
// aprova peça que está em cima da pista e reprova peça que não está.
// ⚠️ E A LISTA PASSA POR `aneisDaCidade`, não vem crua do JSON. O JSON publica a
// alça em 7.600 (a cena usa 6.950) e publica os seis anéis sem encaixe na divisa
// da teia. Lendo cru, este script audita uma cidade que ninguém desenha.
const piores: { id: string; folga: number }[] = []
for (const a of aneisDaCidade(M.aneisViarios as { id: string; r: number; larg: number }[])) {
  for (let i = 0; i < 24; i++) {
    const t0 = (i * Math.PI) / 12, t1 = ((i + 1) * Math.PI) / 12
    const p0: Pt = anelPonto(a.r, t0)
    const p1: Pt = anelPonto(a.r, t1)
    piores.push({ id: a.id,
      folga: Math.min(...perim.map((q) => pointSeg(q, p0, p1))) - a.larg / 2 })
  }
}
for (const b of M.bulevares as { id: string; rumo: number; largura: number }[]) {
  const r = (b.rumo * Math.PI) / 180
  const a0: Pt = [Math.sin(r) * 1420, -Math.cos(r) * 1420]
  const a1: Pt = [Math.sin(r) * 8000, -Math.cos(r) * 8000]
  piores.push({ id: b.id,
    folga: Math.min(...perim.map((q) => pointSeg(q, a0, a1))) - b.largura / 2 })
}
piores.sort((a, b) => a.folga - b.folga)
console.log(`via principal mais próxima: ${piores[0].id} a ${piores[0].folga.toFixed(0)} m do envelope`)
assert.ok(piores[0].folga > 10,
  `${piores[0].id} entra no envelope da peça (folga ${piores[0].folga.toFixed(0)} m)`)

// ── 3. nenhum vizinho de programa sobrepõe ─────────────────────────────────
const vizinhos = (C.programa as { id: string; nome: string; poly?: Pt[] }[])
  .filter((p) => p.id !== DERBY_ID && p.poly?.length)
  .map((p) => ({ id: p.id, nome: p.nome,
    folga: Math.min(...(p.poly as Pt[]).map((q, i) =>
      envDist(q, (p.poly as Pt[])[(i + 1) % (p.poly as Pt[]).length]))) }))
  .sort((a, b) => a.folga - b.folga)
console.log(`vizinho mais próximo: ${vizinhos[0].id} ${vizinhos[0].nome} a ${vizinhos[0].folga.toFixed(0)} m`)
assert.ok(vizinhos[0].folga > 0, `${vizinhos[0].id} sobrepõe a peça`)

// ── 4. o terreno sob a peça, e a saia que ele exige ────────────────────────
async function terreno() {
  Object.assign(globalThis, {
    document: { createElement: () => ({ width: 0, height: 0, getContext: () => ({ putImageData() {} }) }) },
    ImageData: class { constructor(public data: Uint8ClampedArray, public width: number, public height: number) {} },
  })
  const { buildTerrain, CANAL_LAMINA, LAGO_R1 } = await import('../../app/city/plaza/terrain')
  const meta = JSON.parse(readFileSync('public/lunar/btc-core-heightmap.json', 'utf8'))
  const raw = readFileSync('public/lunar/btc-core-heightmap.f32')
  const t = buildTerrain(meta,
    new Float32Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength)),
    { radiais: M.canais.radiais.map((r: { rumo: number; rInicio: number; rFim?: number }) =>
        ({ rumo: r.rumo, secao: CANAL_LAMINA, rInicio: Math.min(r.rInicio, LAGO_R1), rFim: r.rFim ?? 4300 })),
      aneis: M.canais.aneis, talude: M.canais.talude, leito: M.lagos.cota - 4 },
    { faixaSeca: false })
  const lamina = M.lagos.cota as number
  let lo = Infinity, hi = -Infinity, molhado = 0, n = 0
  const passo = 6
  for (let dx = -DERBY_PECA_X / 2; dx <= DERBY_PECA_X / 2 + 1e-6; dx += passo) {
    for (let dz = -DERBY_PECA_Z / 2; dz <= DERBY_PECA_Z / 2 + 1e-6; dz += passo) {
      const [x, z] = pt(dx, dz)
      const y = t.superficieAt(x, z)
      assert.ok(Number.isFinite(y), 'cota de terreno inválida sob a peça')
      lo = Math.min(lo, y); hi = Math.max(hi, y); n++
      if (y < lamina) molhado++
    }
  }
  const amplitude = hi - lo
  console.log(`terreno em ${n} sondas de ${passo} m: ${lo.toFixed(2)} a ${hi.toFixed(2)} m`
    + `  amplitude ${amplitude.toFixed(2)} m  molhado ${(100 * molhado / n).toFixed(2)}%`)
  assert.equal(molhado, 0, 'há água sob a peça')
  // a peça pousa no ponto MAIS ALTO: a saia tem de alcançar o mais baixo
  const SAIA = 12.0
  assert.ok(Math.abs(amplitude - DERBY_AMPLITUDE_MEDIDA) < 1.0,
    `DERBY_AMPLITUDE_MEDIDA diz ${DERBY_AMPLITUDE_MEDIDA} e a medição dá ${amplitude.toFixed(2)}`)
  console.log(`saia do modelo ${SAIA} m contra amplitude ${amplitude.toFixed(2)} m`
    + ` (+ folga de pouso ${DERBY_FOLGA_Y})`)
  assert.ok(SAIA >= amplitude + DERBY_FOLGA_Y,
    `a saia de ${SAIA} m não alcança o chão: a pegada tem ${amplitude.toFixed(2)} m de amplitude`)
  return amplitude
}

// ── 5. os orçamentos dos GLB publicados ────────────────────────────────────
function glb(path: string) {
  const raw = readFileSync(path)
  const len = raw.readUInt32LE(12)
  const doc = JSON.parse(raw.subarray(20, 20 + len).toString('utf8'))
  let tri = 0
  for (const mesh of doc.meshes ?? []) {
    for (const prim of mesh.primitives) tri += doc.accessors[prim.indices].count / 3
  }
  return { bytes: raw.length, triangles: tri, imagens: (doc.images ?? []).length,
    draco: (doc.extensionsRequired ?? []).includes('KHR_draco_mesh_compression') }
}

// ⚠️ SEM TOP-LEVEL AWAIT: o tsx do projeto transpila para cjs e o esbuild
// recusa. Todo o assíncrono mora dentro de main().
async function main() {
await terreno()
for (const [nome, path, tetoTri, tetoBytes] of [
  ['base', 'public/city/dog-derby-base.glb', 26000, 220000],
  ['detalhe', 'public/city/dog-derby-detail.glb', 44000, 300000],
] as const) {
  assert.ok(existsSync(path), `${path} não existe: rode blender -b -P blender/build_derby.py`)
  const g = glb(path)
  console.log(`${nome}: ${g.bytes.toLocaleString('pt-BR')} bytes, `
    + `${g.triangles.toLocaleString('pt-BR')} triângulos, ${g.imagens} imagens, draco ${g.draco}`)
  assert.ok(g.triangles <= tetoTri, `${nome} estourou o teto de triângulos`)
  assert.ok(g.bytes <= tetoBytes, `${nome} estourou o teto de bytes`)
  assert.equal(g.imagens, 0, `${nome} tem textura: o contrato é zero`)
  assert.ok(g.draco, `${nome} não está comprimido com Draco`)
}
console.log(`corte de distância: celular ${derbyCull('mobile')} m, desktop ${derbyCull('desktop')} m`)
console.log('\nDOG DERBY: aprovado')
}
void main()
