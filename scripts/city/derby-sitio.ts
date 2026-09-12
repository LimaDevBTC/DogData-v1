/**
 * Varredura de sítio do DOG DERBY nos módulos da teia.
 *   npx tsx scripts/city/derby-sitio.ts
 *
 * ⚠️ POR QUE ISTO EXISTE. A peça estava endereçada pela parcela do GERADOR (a
 * peça E02 de cidade.json) e a rua é desenhada pela TEIA da cena (26 anéis × 168
 * radiais). São duas grades, e é exatamente o defeito que `programa.ts` já
 * documenta: "a peça caía rente às ruas em vez de emoldurada por elas". O
 * fundador viu na chapa: o canódromo em cima de uma rua, com terreno sobrando em
 * volta. A regra da casa é uma só e é o que faz nada quebrar: TODA PEÇA OCUPA UM
 * NÚMERO INTEIRO DE MÓDULOS DA TEIA, porque os lados do módulo SÃO ruas.
 */
import { readFileSync } from 'node:fs'
import { ANEIS, N_RAD, passoNoRaio, caixaDoModulo, polyDoModulo, AVENIDAS, anelPonto,
         type Modulo, aneisDaCidade} from '../../app/city/plaza/teia'
import { DERBY_PECA_X, DERBY_PECA_Z } from '../../app/city/plaza/derby'
import { SPHERE_MOD } from '../../app/city/plaza/sphere'
import { CAMPUS_MOD } from '../../app/city/plaza/campus'
import { ATLETISMO_MOD } from '../../app/city/plaza/atletismo'

type Pt = [number, number]
const M = JSON.parse(readFileSync('public/city/cidade-malha.json', 'utf8'))
const C = JSON.parse(readFileSync('public/city/cidade.json', 'utf8'))
const X = DERBY_PECA_X, Z = DERBY_PECA_Z

function site(m: Modulo) {
  const c = caixaDoModulo(m), a = (c.a0 + c.a1) / 2
  return { x: Math.sin(a) * c.rm, z: -Math.cos(a) * c.rm, a, c }
}
function point(m: Modulo, x: number, z: number): Pt {
  const s = site(m), c = Math.cos(-s.a), sn = Math.sin(-s.a)
  return [s.x + c * x + sn * z, s.z - sn * x + c * z]
}
/** o envelope da peça amostrado no perímetro, não só nas quinas: quina de
 *  trapézio curvo engana, e foi assim que a posição anterior saiu da parcela */
function borda(m: Modulo): Pt[] {
  const out: Pt[] = []
  for (let k = 0; k <= 24; k++) {
    const t = -X / 2 + (X * k) / 24
    out.push(point(m, t, -Z / 2), point(m, t, Z / 2))
  }
  for (let k = 0; k <= 20; k++) {
    const t = -Z / 2 + (Z * k) / 20
    out.push(point(m, -X / 2, t), point(m, X / 2, t))
  }
  return out
}
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
function polyDist(a: Pt[], b: Pt[]) {
  if (a.some((p) => inside(p, b)) || b.some((p) => inside(p, a))) return 0
  let d = Infinity
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      d = Math.min(d, segDist(a[i], a[(i + 1) % a.length], b[j], b[(j + 1) % b.length]))
    }
  }
  return d
}
// ⚠️ O CAMPUS NÃO ESTÁ EM cidade.json E É O VIZINHO MAIS PERIGOSO. As três
// arenas (atletismo, $DOG ARENA e THE GEODE) dividem `CAMPUS_MOD`, que é uma
// parcela da TEIA criada na cena e nunca publicada pelo gerador. Varrer só o
// programa de cidade.json aprovaria um módulo em cima delas.
const ocupado: { id: string; poly: Pt[] }[] = [
  { id: 'SPHERE', poly: polyDoModulo(SPHERE_MOD) },
  { id: 'CAMPUS', poly: polyDoModulo(CAMPUS_MOD) },
  { id: 'ATLETISMO', poly: polyDoModulo(ATLETISMO_MOD) },
  ...(C.programa as { id: string; poly?: Pt[] }[])
    .filter((p) => p.id !== 'E02' && p.poly?.length)
    .map((p) => ({ id: `programa:${p.id}`, poly: p.poly as Pt[] })),
]
const vias: { id: string; a: Pt; b: Pt; half: number }[] = []
for (const b of M.bulevares as { id: string; rumo: number; rInicio: number; rFim: number; largura: number }[]) {
  const a = (b.rumo * Math.PI) / 180
  vias.push({ id: b.id, a: [Math.sin(a) * b.rInicio, -Math.cos(a) * b.rInicio],
    b: [Math.sin(a) * b.rFim, -Math.cos(a) * b.rFim], half: b.largura / 2 + 6 })
}
for (const av of AVENIDAS) {
  const a = (av.rumo * Math.PI) / 180
  vias.push({ id: `avenida:${av.rumo}`, a: [Math.sin(a) * 1420, -Math.cos(a) * 1420],
    b: [Math.sin(a) * 8000, -Math.cos(a) * 8000], half: av.largura / 2 + 6 })
}
for (const an of aneisDaCidade(M.aneisViarios as { id: string; r: number; larg: number }[])) {
  for (let i = 0; i < 12; i++) {
    vias.push({ id: an.id, a: anelPonto(an.r, (i * Math.PI) / 6),
      b: anelPonto(an.r, ((i + 1) * Math.PI) / 6), half: an.larg / 2 + 8 })
  }
}

const ALVO = { x: 2150, z: 2336 }   // onde a peça está hoje: fica o mais perto possível
async function main() {
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

  const bons: {
    m: Modulo; dist: number; folgaParcela: number; folgaVia: string
    amplitude: number; lo: number; hi: number; ocupa: number
  }[] = []
  for (let i = 4; i < ANEIS.length - 1; i++) {
    for (let nr = 1; nr <= 4 && i + nr < ANEIS.length; nr++) {
      const rm = (ANEIS[i] + ANEIS[i + nr]) / 2
      if (rm < 2200 || rm > 4300) continue
      const passo = passoNoRaio(rm)
      for (let ns = 1; ns <= 5; ns++) {
        for (let j = 0; j < N_RAD; j += passo) {
          const m: Modulo = { i, nr, j, ns }
          const parcela = polyDoModulo(m)
          const env = borda(m)
          if (!env.every((p) => inside(p, parcela))) continue
          const folgaParcela = Math.min(...env.map((p) =>
            Math.min(...parcela.map((q, k) => pointSeg(p, q, parcela[(k + 1) % parcela.length])))))
          if (folgaParcela < 8) continue
          const s = site(m)
          const dist = Math.hypot(s.x - ALVO.x, s.z - ALVO.z)
          if (dist > 1400) continue
          const colide = ocupado.find((o) => polyDist(parcela, o.poly) < 1)
          if (colide) continue
          // ⚠️ DUAS MEDIDAS DIFERENTES, E CONFUNDI-LAS FOI O PRIMEIRO ERRO DESTA
          // VARREDURA. Uma peça precisa de TESTADA (uma via principal encostando
          // na parcela) e de FOLGA (nenhuma via entrando no envelope construído).
          // A primeira rodada só media a testada e aprovou módulos onde o AN3
          // passava 21 m DENTRO da parcela: como os lados do módulo são o EIXO da
          // rua, e o envelope estava a 14 m da borda, o asfalto invadia a peça
          // por 7 m. É o mesmo defeito que o fundador acabou de apontar.
          const testada = vias
            .map((v) => ({ id: v.id, d: Math.min(...parcela.map((q, k) =>
              segDist(q, parcela[(k + 1) % parcela.length], v.a, v.b))) - v.half }))
            .sort((a, b) => a.d - b.d)[0]
          if (testada.d > 60) continue
          const folgaVia = vias
            .map((v) => ({ id: v.id, d: Math.min(...env.map((p) => pointSeg(p, v.a, v.b))) - v.half }))
            .sort((a, b) => a.d - b.d)[0]
          if (folgaVia.d < 10) continue
          const perto = folgaVia
          let lo = Infinity, hi = -Infinity, molhado = 0
          for (let a = 0; a <= 16; a++) {
            for (let b = 0; b <= 14; b++) {
              const [x, z] = point(m, -X / 2 + (X * a) / 16, -Z / 2 + (Z * b) / 14)
              const y = t.superficieAt(x, z)
              lo = Math.min(lo, y); hi = Math.max(hi, y)
              if (y < lamina) molhado++
            }
          }
          if (molhado) continue
          const area = (s.c.a1 - s.c.a0) * s.c.rm * (s.c.r1 - s.c.r0)
          bons.push({ m, dist, folgaParcela, folgaVia: `${perto.id} ${perto.d.toFixed(0)}m`,
            amplitude: hi - lo, lo, hi, ocupa: (X * Z) / area })
        }
      }
    }
  }
  // ⚠️ A ORDEM É AMPLITUDE PRIMEIRO E OCUPAÇÃO DEPOIS, e a ocupação está aqui
  // por causa do atletismo: em 07/09 ele passou em toda verificação e ainda
  // estava errado na chapa, porque a peça ocupava 18% do bloco. Bloco muito
  // maior que a peça é ruim mesmo estando "válido".
  const ordem = process.argv.includes('--perto')
    ? (a: typeof bons[number], b: typeof bons[number]) => a.dist - b.dist
    : (a: typeof bons[number], b: typeof bons[number]) =>
        (a.amplitude + (1 - a.ocupa) * 6) - (b.amplitude + (1 - b.ocupa) * 6)
  bons.sort(ordem)
  console.log(`${bons.length} módulos válidos (envelope ${X} x ${Z} dentro do módulo,`
    + ' folga >= 8 m, seco, sem colisão, com testada de via, a menos de 1.400 m do sítio atual)\n')
  console.log('  módulo                     amplit.  ocupa  folga  via mais próxima        dist')
  for (const b of bons.slice(0, 12)) {
    console.log(`  {i:${b.m.i},nr:${b.m.nr},j:${b.m.j},ns:${b.m.ns}}`.padEnd(28)
      + `${b.amplitude.toFixed(2).padStart(7)} m`
      + `${(100 * b.ocupa).toFixed(0).padStart(6)}%`
      + `${b.folgaParcela.toFixed(0).padStart(6)} m  ${b.folgaVia.padEnd(22)}`
      + `${b.dist.toFixed(0).padStart(5)} m`)
  }
}
void main()
