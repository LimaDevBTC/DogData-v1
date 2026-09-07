/**
 * Confere o campus esportivo: UMA laje sobre a parcela inteira, com DOG
 * Athletics, $DOG ARENA e THE GEODE pousando nela.
 *
 *   npx tsx scripts/city/verificar-campus.ts
 *
 * O que ele NÃO faz: não valida lotes do snapshot, não mede FPS nem GPU, não
 * abre navegador e não olha os GLB. A peça aqui é o CHÃO.
 */
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { caixaDoModulo, polyDoModulo, AVENIDAS, anelPonto } from '../../app/city/plaza/teia'
import { CAMPUS_MOD, CAMPUS_Y, PODIO_TOPO, FRANJA, CALCADA, PECAS, comPodio, pecaSitio, lajeDoCampus, naLaje, muroDoCampus, criarCampus } from '../../app/city/plaza/campus'
import { assentarEstadio } from '../../app/city/plaza/estadio'
import { assentarGeode } from '../../app/city/plaza/geode'
import { assentarAtletismo, ATLETISMO_FOLGA_Y } from '../../app/city/plaza/atletismo'
type Pt = [number, number]
const M = JSON.parse(readFileSync('public/city/cidade-malha.json', 'utf8'))

function inside(p: Pt, poly: Pt[]) { let yes = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) yes = !yes } return yes }
function pointSeg(p: Pt, a: Pt, b: Pt) { const x = b[0] - a[0], z = b[1] - a[1], t = Math.max(0, Math.min(1, ((p[0] - a[0]) * x + (p[1] - a[1]) * z) / (x * x + z * z || 1))); return Math.hypot(p[0] - a[0] - t * x, p[1] - a[1] - t * z) }
function cross(a: Pt, b: Pt, p: Pt) { return (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) }
function segDist(a: Pt, b: Pt, c: Pt, d: Pt) { if (cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0) return 0; return Math.min(pointSeg(a, c, d), pointSeg(b, c, d), pointSeg(c, a, b), pointSeg(d, a, b)) }
function segmentDist(poly: Pt[], a: Pt, b: Pt) { if (inside(a, poly) || inside(b, poly)) return 0; return Math.min(...poly.map((p, i) => segDist(p, poly[(i + 1) % poly.length], a, b))) }

const roads: { id: string; a: Pt; b: Pt; half: number }[] = []
function radial(id: string, rumo: number, r0: number, r1: number, half: number) { const a = rumo * Math.PI / 180; roads.push({ id, a: [Math.sin(a) * r0, -Math.cos(a) * r0], b: [Math.sin(a) * r1, -Math.cos(a) * r1], half }) }
for (const b of M.bulevares) radial(`bulevar:${b.id}`, b.rumo, b.rInicio, b.rFim, b.largura / 2 + 6)
for (const b of AVENIDAS) radial(`avenida:${b.rumo}`, b.rumo, 1420, 8000, b.largura / 2 + 6)
for (const a of M.autopistas) { const r = a.rumo * Math.PI / 180, c = Math.cos(r), s = Math.sin(r), o = a.afastamento ?? 0; roads.push({ id: `autopista:${a.id}`, a: [c * o + s * -12000, s * o - c * -12000], b: [c * o + s * 12000, s * o - c * 12000], half: a.largura / 2 + 6 }) }
for (const a of M.aneisViarios) for (let i = 0; i < 12; i++) roads.push({ id: `anel:${a.id}`, a: anelPonto(a.r, i * Math.PI / 6), b: anelPonto(a.r, (i + 1) * Math.PI / 6), half: a.larg / 2 + 8 })

async function main() {
  Object.assign(globalThis, { document: { createElement: () => ({ width: 0, height: 0, getContext: () => ({ putImageData() {} }) }) }, ImageData: class { constructor(public data: Uint8ClampedArray, public width: number, public height: number) {} } })
  const { buildTerrain, CANAL_LAMINA, LAGO_R1 } = await import('../../app/city/plaza/terrain')
  const meta = JSON.parse(readFileSync('public/lunar/btc-core-heightmap.json', 'utf8'))
  const bin = readFileSync('public/lunar/btc-core-heightmap.f32')
  const terrain = buildTerrain(meta, new Float32Array(bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength)), {
    radiais: M.canais.radiais.map((r: { rumo: number; rInicio: number; rFim?: number }) => ({ rumo: r.rumo, secao: CANAL_LAMINA, rInicio: Math.min(r.rInicio, LAGO_R1), rFim: r.rFim ?? 4300 })),
    aneis: M.canais.aneis, talude: M.canais.talude, leito: M.lagos.cota - 4,
  }, { faixaSeca: false })
  const alturaEm = (x: number, z: number) => terrain.heightAt(x, z)

  const caixa = caixaDoModulo(CAMPUS_MOD)
  const parcela = polyDoModulo(CAMPUS_MOD) as Pt[]
  const laje = lajeDoCampus() as unknown as Pt[]
  const alt = comPodio(alturaEm)
  const assentar = { DOG_ARENA: assentarEstadio, THE_GEODE: assentarGeode, DOG_ATHLETICS: assentarAtletismo } as const

  // 1. o chão da parcela ficou plano na cota única?
  const dentro: number[] = []
  let piorDesvio = 0
  const xs = parcela.map((p) => p[0]), zs = parcela.map((p) => p[1])
  for (let x = Math.min(...xs); x <= Math.max(...xs); x += 10)
    for (let z = Math.min(...zs); z <= Math.max(...zs); z += 10) {
      if (!inside([x, z], parcela)) continue
      const y = alturaEm(x, z)
      dentro.push(y)
      // ⚠️ A PERGUNTA CERTA É "O CHÃO SOB A LAJE ESTÁ NA COTA?", e não "qual o
      // declive?". Medir declive por diferença de 6 m encosta na borda da laje e
      // lê a rampa da franja, que é do lado de fora: deu 14,3% de falso positivo.
      // O que a laje exige é que nada do terreno a atravesse, e isso se mede
      // contra a cota, ponto a ponto.
      if (naLaje(x, z)) piorDesvio = Math.max(piorDesvio, Math.abs(y - CAMPUS_Y))
    }


  // 2. as três peças pousam no topo da laje?
  const pecas = PECAS.map((p) => {
    const s = pecaSitio(p.mod)
    const y = assentar[p.id as keyof typeof assentar](new THREE.Group(), alt).position.y
    const C = Math.cos(s.a), S = Math.sin(s.a)
    const mundo = (lx: number, lz: number): Pt => [s.x + C * lx - S * lz, s.z + S * lx + C * lz]
    // ⚠️ O QUE TEM DE ESTAR NA LAJE É A PEGADA DA PEÇA, não um quadrado de
    // conveniência. Com pódio único a "calçada de 12 m" deixou de ser geometria
    // (não existe mais um quadrado por prédio) e virou só uma medida de folga:
    // ela pode passar da borda sem que nada fique pendurado. Quem não pode
    // passar é o chão que o prédio ocupa.
    const cantos: Pt[] = [[-p.x / 2, -p.z / 2], [p.x / 2, -p.z / 2], [p.x / 2, p.z / 2], [-p.x / 2, p.z / 2]]
      .map(([lx, lz]) => mundo(lx, lz))
    const folga = Math.min(...laje.map((p2, i) => Math.min(...cantos.map((c) => pointSeg(c, p2, laje[(i + 1) % laje.length])))))
    return { id: p.id, x: s.x, z: s.z, rumo: (s.a * 180 / Math.PI + 360) % 360,
      pegada: [p.x, p.z], pousadoEm: y, folgaDePouso: y - PODIO_TOPO,
      pegadaNaLaje: cantos.every((c) => naLaje(c[0], c[1])),
      folgaAteABordaDaLaje: folga, sobraParaCalcada: folga - CALCADA }
  })

  // 3. o muro, e o que ele tem de cobrir
  const muro = muroDoCampus(alturaEm)
  const grupo = criarCampus(alturaEm)
  const malha = grupo.children[0] as THREE.Mesh
  const tri = (malha.geometry.getAttribute('position').count) / 3
  const normais = malha.geometry.getAttribute('normal')
  let paraBaixo = 0
  for (let i = 0; i < normais.count; i += 3) if (normais.getY(i) < -0.9) paraBaixo++

  const d = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z)
  const espacamento = [d(pecas[0], pecas[1]), d(pecas[1], pecas[2])]
  const via = roads.map((r) => ({ id: r.id, folga: segmentDist(laje, r.a, r.b) - r.half })).sort((a, b) => a.folga - b.folga)
  const avisos: string[] = []
  for (const v of via.filter((q) => q.folga < 0)) avisos.push(`${v.id} cruza a laje do pódio (${v.folga.toFixed(0)} m)`)
  for (const p of pecas) {
    assert(Math.abs(p.folgaDePouso - ATLETISMO_FOLGA_Y) < 1e-6, `${p.id}: não pousou no topo da laje (${p.folgaDePouso.toFixed(3)} m)`)
    assert(p.pegadaNaLaje, `${p.id}: a pegada do prédio sai da laje`)
    if (p.sobraParaCalcada < 0) avisos.push(`${p.id}: só ${p.folgaAteABordaDaLaje.toFixed(0)} m até a borda da laje, menos que os ${CALCADA} m de calçada`)
  }
  assert(Math.abs(espacamento[0] - espacamento[1]) < 0.5, 'o trio deixou de ser igualmente espaçado')
  assert(piorDesvio < 0.01, `o terreno sob a laje foge da cota em ${piorDesvio.toFixed(3)} m`)
  assert(paraBaixo === 0, `${paraBaixo} triângulos com a normal para baixo: tampa virada`)
  assert(Math.min(...dentro) > M.lagos.cota + 1.2, 'água na parcela')

  console.log(JSON.stringify({
    ok: true,
    parcela: { modulo: CAMPUS_MOD, radial: caixa.r1 - caixa.r0, arcoInterno: (caixa.a1 - caixa.a0) * caixa.r0,
      hectares: dentro.length * 100 / 1e4 },
    podio: { cotaTerraplanada: CAMPUS_Y, topo: PODIO_TOPO, franja: FRANJA, calcada: CALCADA,
      triangulos: tri, normaisParaBaixo: paraBaixo, desvioDoChaoSobALaje: Number(piorDesvio.toFixed(4)),
      muro: muro.map((m) => ({ aresta: m.aresta, comprimento: Math.round(m.comprimento),
        alturaMinima: Number(m.minima.toFixed(1)), alturaMaxima: Number(m.maxima.toFixed(1)) })) },
    pecas, espacamento,
    viaMaisProxima: via[0], avisos,
    limites: ['Não valida lotes do snapshot nem os GLB; a peça aqui é o chão.',
      'O corte e o aterro (2,74M m³ de cada lado) foram medidos contra o terreno natural em 07/09/2026 e não são recalculados aqui: depois da terraplanagem a cota natural não é recuperável sob a laje.'],
  }, null, 2))
  terrain.group.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) m.geometry.dispose() }); terrain.material.dispose()
}
main().catch((e) => { console.error(e); process.exitCode = 1 })
