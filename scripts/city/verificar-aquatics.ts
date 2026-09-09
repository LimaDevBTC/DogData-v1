/**
 * Confere a parcela de DOG AQUATICS: a laje, a terraplanagem, o muro e o sítio
 * da peça.
 *
 *   npx tsx scripts/city/verificar-aquatics.ts
 *
 * O que ele NÃO faz: não valida lotes do snapshot, não mede FPS nem GPU, não
 * abre navegador e não olha o GLB. A peça aqui é o CHÃO.
 */
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { AVENIDAS, anelPonto, caixaDoModulo, polyDoModulo } from '../../app/city/plaza/teia'
import {
  AQUATICS_MOD, AQUATICS_Y, AQUATICS_PECA_X, AQUATICS_PECA_Z, AQUATICS_FOLGA_Y, FRANJA, CALCADA,
  PODIO_TOPO, aquaticsParcela, aquaticsSitio, comPodioAquatics, criarAquatics, envelopeAquatics,
  lajeDoAquatics, muroDoAquatics, naLajeAquatics, pecaNaLaje, assentarAquatics,
} from '../../app/city/plaza/aquatics'
import * as THREE from 'three'

type Pt = [number, number]
const M = JSON.parse(readFileSync('public/city/cidade-malha.json', 'utf8'))
const CID = JSON.parse(readFileSync('public/city/cidade.json', 'utf8'))

function inside(p: Pt, poly: Pt[]) { let yes = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) yes = !yes } return yes }
function pointSeg(p: Pt, a: Pt, b: Pt) { const x = b[0] - a[0], z = b[1] - a[1], t = Math.max(0, Math.min(1, ((p[0] - a[0]) * x + (p[1] - a[1]) * z) / (x * x + z * z || 1))); return Math.hypot(p[0] - a[0] - t * x, p[1] - a[1] - t * z) }
function cross(a: Pt, b: Pt, p: Pt) { return (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) }
function segDist(a: Pt, b: Pt, c: Pt, d: Pt) { if (cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0) return 0; return Math.min(pointSeg(a, c, d), pointSeg(b, c, d), pointSeg(c, a, b), pointSeg(d, a, b)) }
function polySegDist(poly: Pt[], a: Pt, b: Pt) { if (inside(a, poly) || inside(b, poly)) return 0; return Math.min(...poly.map((p, i) => segDist(p, poly[(i + 1) % poly.length], a, b))) }

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
  const AGUA = M.lagos.cota as number

  const parcela = aquaticsParcela().poly as Pt[]
  const laje = lajeDoAquatics() as unknown as Pt[]
  const cx = caixaDoModulo(AQUATICS_MOD)
  const avisos: string[] = []

  // 1. o chão da laje ficou plano na cota?
  let pior = 0, molhado = 0, n = 0
  const xs = laje.map((p) => p[0]), zs = laje.map((p) => p[1])
  for (let x = Math.min(...xs); x <= Math.max(...xs); x += 6)
    for (let z = Math.min(...zs); z <= Math.max(...zs); z += 6) {
      if (!inside([x, z], laje)) continue
      const y = alturaEm(x, z)
      n++
      pior = Math.max(pior, Math.abs(y - AQUATICS_Y))
      if (y < AGUA) molhado++
    }
  assert(n > 5000, `poucas sondas na laje: ${n}`)
  assert(pior <= 0.05, `a laje não ficou plana: desvio de ${pior.toFixed(3)} m em ${n} sondas`)
  assert(molhado === 0, `${molhado} sondas abaixo da lâmina dentro da laje`)
  console.log(`1. laje plana em ${AQUATICS_Y} m: ${n} sondas, pior desvio ${pior.toFixed(4)} m, nenhuma molhada`)

  // 2. a terraplanagem para na divisa: fora da parcela o chão é o natural
  const fora = (d: number) => {
    const a = (cx.a0 + cx.a1) / 2
    return [Math.sin(a) * (cx.r1 + d), -Math.cos(a) * (cx.r1 + d)] as Pt
  }
  for (const d of [10, 40, 120]) {
    const [x, z] = fora(d)
    assert(!inside([x, z], parcela), `sonda de fora caiu dentro da parcela (d=${d})`)
  }
  const naDivisa = alturaEm(...fora(6))
  assert(Math.abs(naDivisa - AQUATICS_Y) > 0.4,
    `o chão logo fora da divisa está na cota da laje (${naDivisa.toFixed(2)}): a franja transbordou`)
  console.log(`2. franja para na divisa: 6 m fora dela o chão está em ${naDivisa.toFixed(2)} m`)

  // 3. declive máximo na rampa da franja, entre a divisa e a borda da laje
  let piorDeclive = 0
  for (let i = 0; i < laje.length; i++) {
    const p = laje[i], q = laje[(i + 1) % laje.length]
    for (let t = 0; t <= 1; t += 0.02) {
      const x = p[0] + (q[0] - p[0]) * t, z = p[1] + (q[1] - p[1]) * t
      const r = Math.hypot(x, z) || 1
      const y0 = alturaEm(x, z)
      const y1 = alturaEm(x + (x / r) * 6, z + (z / r) * 6)
      piorDeclive = Math.max(piorDeclive, Math.abs(y1 - y0) / 6)
    }
  }
  assert(piorDeclive < 0.35, `borda da laje sobre rampa de ${(100 * piorDeclive).toFixed(1)}%`)
  console.log(`3. pior declive medido junto à borda da laje: ${(100 * piorDeclive).toFixed(1)}%`)

  // 4. a peça inteira dentro da laje, e com folga
  assert(pecaNaLaje(), 'a peça de 324 × 180 não cabe na laje')
  const env = envelopeAquatics() as Pt[]
  let folga = Infinity
  for (const p of env) {
    for (let i = 0; i < laje.length; i++) folga = Math.min(folga, pointSeg(p, laje[i], laje[(i + 1) % laje.length]))
  }
  assert(folga > 20, `folga de quina pequena demais: ${folga.toFixed(1)} m`)
  const s = aquaticsSitio()
  console.log(`4. peça 324 × 180 dentro da laje, rumo ${s.rumoDeg.toFixed(3)}°, folga de quina ${folga.toFixed(1)} m`)

  // 5. nenhuma via publicada invade a parcela
  const vias = roads.map((r) => ({ id: r.id, d: polySegDist(parcela, r.a, r.b) - r.half })).sort((a, b) => a.d - b.d)
  const invade = vias.filter((v) => v.d < 0)
  for (const v of invade) avisos.push(`via dentro da parcela: ${v.id} a ${v.d.toFixed(1)} m`)
  assert(invade.length === 0, `${invade.length} vias invadem a parcela: ${invade.map((v) => v.id).join(', ')}`)
  console.log(`5. nenhuma via invade a parcela; a mais próxima é ${vias[0].id} a ${vias[0].d.toFixed(1)} m`)

  // 6. nenhuma reserva publicada colide
  const prog = CID.programa.filter((p: { poly?: Pt[] }) => Array.isArray(p.poly) && p.poly.length > 2)
  const colide = prog.filter((p: { poly: Pt[] }) => p.poly.some((q) => inside(q, parcela)) || parcela.some((q) => inside(q, p.poly)))
    .map((p: { id: string }) => p.id)
  assert(colide.length === 0, `a parcela colide com ${colide.join(', ')}`)
  console.log(`6. nenhuma das ${prog.length} reservas publicadas colide com a parcela`)

  // 7. o muro do pódio
  const muro = muroDoAquatics(alturaEm)
  const alturas = muro.map((m) => m.maxima)
  assert(Math.min(...muro.map((m) => m.minima)) > 0, 'o muro do pódio some em alguma aresta')
  console.log(`7. muro do pódio: ${Math.min(...muro.map((m) => m.minima)).toFixed(2)} a ${Math.max(...alturas).toFixed(2)} m, `
    + `por aresta ${muro.map((m) => `${m.comprimento.toFixed(0)}m:${m.maxima.toFixed(1)}`).join(' ')}`)

  // 8. a peça pousa exatamente no topo do pódio
  const root = new THREE.Object3D()
  assentarAquatics(root, comPodioAquatics(alturaEm))
  const erro = Math.abs(root.position.y - (PODIO_TOPO + AQUATICS_FOLGA_Y))
  assert(erro < 1e-6, `a peça pousou ${erro.toFixed(4)} m fora do topo do pódio`)
  assert(naLajeAquatics(root.position.x, root.position.z), 'o sítio da peça caiu fora da laje')
  console.log(`8. peça pousa em y=${root.position.y.toFixed(3)} (topo ${PODIO_TOPO} + folga ${AQUATICS_FOLGA_Y}), giro ${(root.rotation.y * 180 / Math.PI).toFixed(3)}°`)

  // 9. a laje desenhada: contagem e normais para cima
  const grupo = criarAquatics(alturaEm)
  const mesh = grupo.children[0] as THREE.Mesh
  const pos = mesh.geometry.getAttribute('position')
  const nor = mesh.geometry.getAttribute('normal')
  let paraBaixo = 0
  for (let i = 0; i < nor.count; i += 3) if (nor.getY(i) < -0.5) paraBaixo++
  console.log(`9. laje desenhada: ${pos.count / 3} triângulos, ${paraBaixo} com normal para baixo, castShadow ${mesh.castShadow}`)
  assert(mesh.castShadow === false, 'a laje não pode projetar sombra (ver o defeito do campus)')

  // 10. a cota continua parecida com o chão em volta?
  //
  // ⚠️ O CUSTO DE TERRA NÃO É MEDÍVEL DEPOIS QUE A TERRAPLANAGEM ENTRA, e as
  // duas primeiras versões deste teste erraram por isso. `heightAt` já passa por
  // `aquaticsAlturaAt` e devolve a cota terraplanada dentro da laje (a conta
  // media a rampa da franja, e deu 48% de desequilíbrio); `baseAt` vai longe
  // demais para o outro lado, porque é o heightmap com a saia e SEM o pódio da
  // abóbada, e nesta parcela ele diz que o natural vai de −70,68 a −21,09,
  // enquanto o chão que a cidade realmente tem ali vai de −37,21 a −30,11.
  //
  // O corte e o aterro publicados (0,175 e 0,171 Mm³ para a cota −34,3) foram
  // medidos em 09/09/2026 contra `heightAt` ANTES de esta parcela existir, e
  // esse número não volta. O que dá para conferir para sempre é a plausibilidade
  // da cota: ela tem de ficar junto do chão que a cidade tem em volta da divisa.
  let soma = 0, k = 0, volta = { min: Infinity, max: -Infinity }
  for (let g = 0; g < 360; g += 2) {
    const a = g * Math.PI / 180
    for (const d of [40, 90, 140]) {
      const x = s.x + Math.cos(a) * (240 + d), z = s.z + Math.sin(a) * (240 + d)
      if (inside([x, z], parcela)) continue
      const y = alturaEm(x, z)
      soma += y; k++
      volta.min = Math.min(volta.min, y); volta.max = Math.max(volta.max, y)
    }
  }
  const media = soma / k
  console.log(`10. chão em volta da parcela: ${k} sondas, de ${volta.min.toFixed(1)} a ${volta.max.toFixed(1)} m, `
    + `média ${media.toFixed(2)} m contra a cota ${AQUATICS_Y} m`)
  assert(Math.abs(media - AQUATICS_Y) < 4.0,
    `a cota ${AQUATICS_Y} está ${(media - AQUATICS_Y).toFixed(2)} m fora do chão em volta: remeça o equilíbrio de corte e aterro`)

  if (avisos.length) console.log('\navisos:\n' + avisos.map((a) => '  · ' + a).join('\n'))
  console.log('\nDOG AQUATICS: parcela conferida.')
}

main()
