/**
 * Confere o campus esportivo inteiro: DOG Athletics, $DOG ARENA e THE GEODE
 * sobre a mesma parcela, com pódio quadrado e terreno terraplanado.
 *
 *   npx tsx scripts/city/verificar-campus.ts
 *
 * O que ele NÃO faz: não valida lotes do snapshot, não mede FPS nem GPU, não
 * abre navegador e não olha os GLB — a peça aqui é o CHÃO. A conferência da peça
 * do atletismo sozinha (matriz de sondagem, corte de distância, água) continua em
 * `verificar-atletismo.ts`.
 */
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { caixaDoModulo, polyDoModulo, AVENIDAS, anelPonto } from '../../app/city/plaza/teia'
import { CAMPUS_MOD, TERRACOS, BERMA, FRANJA, comPodio, podioTopo, terracoSitio, saiasDoCampus } from '../../app/city/plaza/campus'
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

/** o quadrado do pódio no mundo, na MESMA matriz que o Three usa para o GLB */
function quadrado(t: (typeof TERRACOS)[number], lado: number): Pt[] {
  const s = terracoSitio(t), C = Math.cos(s.a), S = Math.sin(s.a), h = lado / 2
  return ([[-h, -h], [h, -h], [h, h], [-h, h]] as Pt[]).map(([lx, lz]) => [s.x + C * lx - S * lz, s.z + S * lx + C * lz])
}

async function main() {
  Object.assign(globalThis, { document: { createElement: () => ({ width: 0, height: 0, getContext: () => ({ putImageData() {} }) }) }, ImageData: class { constructor(public data: Uint8ClampedArray, public width: number, public height: number) {} } })
  const { buildTerrain, CANAL_LAMINA, LAGO_R1 } = await import('../../app/city/plaza/terrain')
  const meta = JSON.parse(readFileSync('public/lunar/btc-core-heightmap.json', 'utf8'))
  const bin = readFileSync('public/lunar/btc-core-heightmap.f32')
  const terrain = buildTerrain(meta, new Float32Array(bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength)), {
    radiais: M.canais.radiais.map((r: { rumo: number; rInicio: number; rFim?: number }) => ({ rumo: r.rumo, secao: CANAL_LAMINA, rInicio: Math.min(r.rInicio, LAGO_R1), rFim: r.rFim ?? 4300 })),
    aneis: M.canais.aneis, talude: M.canais.talude, leito: M.lagos.cota - 4,
  }, { faixaSeca: false })

  const caixa = caixaDoModulo(CAMPUS_MOD)
  const parcela = polyDoModulo(CAMPUS_MOD) as Pt[]
  const alturaComPodio = comPodio((x, z) => terrain.heightAt(x, z))
  const assentar = { DOG_ARENA: assentarEstadio, THE_GEODE: assentarGeode, DOG_ATHLETICS: assentarAtletismo } as const

  const podios = TERRACOS.map((t) => {
    const s = terracoSitio(t)
    const foot = quadrado(t, t.lado)
    // o pódio inteiro dentro da parcela, e a menor folga até a divisa
    const dentro = foot.every((p) => inside(p, parcela))
    const folgaDivisa = Math.min(...parcela.map((p, i) => Math.min(...foot.map((q) => pointSeg(q, p, parcela[(i + 1) % parcela.length])))))
    // o terreno sob o pódio depois da terraplanagem
    const C = Math.cos(s.a), S = Math.sin(s.a), h = t.lado / 2
    let mn = Infinity, mx = -Infinity, molhado = 0, n = 0
    for (let i = 0; i <= 50; i++) for (let k = 0; k <= 50; k++) {
      const lx = -h + 2 * h * i / 50, lz = -h + 2 * h * k / 50
      const y = terrain.heightAt(s.x + C * lx - S * lz, s.z + S * lx + C * lz)
      mn = Math.min(mn, y); mx = Math.max(mx, y); n++
      if (y < M.lagos.cota + 1.2) molhado++
    }
    const pousado = assentar[t.id as keyof typeof assentar](new THREE.Group(), alturaComPodio).position.y
    const via = roads.map((r) => ({ id: r.id, folga: segmentDist(foot, r.a, r.b) - r.half })).sort((a, b) => a.folga - b.folga)[0]
    return { id: t.id, lado: t.lado, cota: t.y, x: s.x, z: s.z, rumo: (s.a * 180 / Math.PI + 360) % 360,
      dentroDaParcela: dentro, folgaAteDivisa: folgaDivisa, terreno: { min: mn, max: mx, desnivel: mx - mn, molhado, amostras: n },
      pousadoEm: pousado, topoDoPodio: podioTopo(t), folgaDePouso: pousado - podioTopo(t), viaMaisProxima: via }
  })

  // o declive dentro da parcela, que é o custo da terraplanagem
  let pior = 0, ondeR = 0, ondeRumo = 0, acima15 = 0, total = 0
  for (let r = caixa.r0 + 2; r <= caixa.r1 - 2; r += 6) for (let k = 0; k <= 600; k++) {
    const a = caixa.a0 + (caixa.a1 - caixa.a0) * k / 600
    const x = Math.sin(a) * r, z = -Math.cos(a) * r, y = terrain.heightAt(x, z)
    const g = Math.max(Math.abs(terrain.heightAt(x + 6, z) - y), Math.abs(terrain.heightAt(x, z + 6) - y)) / 6
    total++; if (g > 0.15) acima15++
    if (g > pior) { pior = g; ondeR = r; ondeRumo = a * 180 / Math.PI }
  }

  const d = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z)
  const espacamento = [d(podios[0], podios[1]), d(podios[1], podios[2])]

  const avisos: string[] = []
  const saias = saiasDoCampus((x, z) => terrain.heightAt(x, z))
  for (const p of podios) {
    assert(p.dentroDaParcela, `${p.id}: o pódio sai da parcela do campus`)
    assert(p.terreno.molhado === 0, `${p.id}: água sob o pódio`)
    assert(p.terreno.desnivel < 0.01, `${p.id}: o terraço não ficou plano (${p.terreno.desnivel.toFixed(3)} m)`)
    assert(Math.abs(p.folgaDePouso - ATLETISMO_FOLGA_Y) < 1e-6, `${p.id}: a peça não pousou no topo do pódio (${p.folgaDePouso.toFixed(3)} m)`)
    // ⚠️ O BUL04 CRUZA O BLOCO DO $DOG ARENA e isso é anterior a este arquivo:
    // está medido em `estadio.ts` e o fundador mandou manter a peça onde está
    // ("confirme o estádio na mesma posição de antes", 06/09). Não se relitiga
    // aqui; o que se faz é RELATAR, para ninguém redescobrir sozinho.
    if (p.viaMaisProxima.folga <= 15) avisos.push(`${p.id}: ${p.viaMaisProxima.id} passa a ${p.viaMaisProxima.folga.toFixed(0)} m do pódio`)
    // ⚠️ A FOLGA ATÉ A DIVISA NÃO É ASSERÇÃO, É NÚMERO RELATADO, e a razão está
    // em `campus.ts`: o anel interno é uma FACE do dodecágono, então o canto do
    // pódio quadrado do atletismo fica a 5,6 m da divisa. Quem resolve isso é a
    // saia do pódio, que desce até o terreno; o que se exige aqui é que ela
    // alcance, não que o pódio tenha folga que a geometria da cidade não dá.
    assert(p.folgaAteDivisa > 0, `${p.id}: o pódio sai da parcela`)
  }
  assert(Math.abs(espacamento[0] - espacamento[1]) < 0.5, 'o trio deixou de ser igualmente espaçado')
  // a saia tem de passar abaixo do terreno mais baixo em volta do pódio
  for (const s of saias) {
    const p = podios.find((q) => q.id === s.id)!
    assert(s.pe < p.terreno.min, `${s.id}: a saia do pódio não alcança o terreno`)
  }

  console.log(JSON.stringify({
    ok: true,
    parcela: { modulo: CAMPUS_MOD, radial: caixa.r1 - caixa.r0, arcoInterno: (caixa.a1 - caixa.a0) * caixa.r0,
      rumoDe: caixa.a0 * 180 / Math.PI, rumoAte: caixa.a1 * 180 / Math.PI },
    podios, espacamento, saias, avisos,
    vaoEntrePodios: [espacamento[0] - (podios[0].lado + podios[1].lado) / 2, espacamento[1] - (podios[1].lado + podios[2].lado) / 2],
    terraplanagem: { berma: BERMA, franja: FRANJA, degrauEntreTerracos: [podios[1].cota - podios[0].cota, podios[2].cota - podios[1].cota],
      declive: { pior: pior, ondeRaio: ondeR, ondeRumo, fracaoAcimaDe15pct: acima15 / total, amostras: total } },
    limites: ['Não valida lotes do snapshot nem os GLB; a peça aqui é o chão.',
      'O pior declive cai no canto do rumo 120°, onde o terreno natural já tinha 28,5% de caimento.'],
  }, null, 2))
  terrain.group.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) m.geometry.dispose() }); terrain.material.dispose()
}
main().catch((e) => { console.error(e); process.exitCode = 1 })
