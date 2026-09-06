import { ANEIS, N_RAD, passoNoRaio, caixaDoModulo, type Modulo } from '/home/bitmax/Projects/bitcoin-fullstack/DogData-v1/app/city/plaza/teia'
import { readFileSync } from 'node:fs'

const M = JSON.parse(readFileSync('public/city/cidade-malha.json', 'utf8'))
const PECA_X = 418, PECA_Z = 376      // arco x radial
const MARGEM = 26                     // metros de respiro alem da meia-largura da via
const EST: Modulo = { i: 11, nr: 3, j: 52, ns: 2 }

function centro(m: Modulo) {
  const c = caixaDoModulo(m); const am = (c.a0 + c.a1) / 2
  return { x: Math.sin(am) * c.rm, z: -Math.cos(am) * c.rm, r: c.rm, am, c }
}
function lateral(x: number, z: number, rumoDeg: number, afast = 0) {
  const a = rumoDeg * Math.PI / 180
  const nx = Math.cos(a), nz = Math.sin(a)
  return Math.abs((x - nx * afast) * nx + (z - nz * afast) * nz)
}
/** a menor folga da peca contra bulevar, autopista e anel viario */
function folgaDeVia(x: number, z: number, r: number) {
  let pior = Infinity, quem = ''
  const meia_t = PECA_X / 2, meia_r = PECA_Z / 2
  for (const b of M.bulevares) {
    const f = lateral(x, z, b.rumo) - b.largura / 2 - meia_t
    if (f < pior) { pior = f; quem = `${b.id} (bulevar ${b.largura} m, rumo ${b.rumo})` }
  }
  for (const a of M.autopistas) {
    const f = lateral(x, z, a.rumo, a.afastamento ?? 0) - a.largura / 2 - meia_t
    if (f < pior) { pior = f; quem = `${a.id} (autopista)` }
  }
  for (const an of M.aneisViarios) {
    const f = Math.abs(r - an.r) - an.larg / 2 - meia_r
    if (f < pior) { pior = f; quem = `${an.id} ${an.nome}` }
  }
  return { folga: pior, quem }
}
function agua(x: number, z: number) {
  let pior = Infinity
  for (const c of M.lagos.corpos) {
    const req = Math.sqrt(c.area / Math.PI)
    const f = Math.hypot(c.x - x, c.z - z) - req - 160
    if (f < pior) pior = f
  }
  for (const cr of M.canais.radiais) {
    const f = lateral(x, z, cr.rumo) - (cr.secao / 2 + cr.talude ?? 0) - 160
    if (f < pior) pior = f
  }
  return pior
}
const cEst = centro(EST)
const res: any[] = []
for (let i = 3; i < ANEIS.length - 2; i++) {
  for (let nr = 1; nr <= 3; nr++) {
    if (i + nr >= ANEIS.length) continue
    for (let ns = 1; ns <= 3; ns++) {
      const passo = passoNoRaio((ANEIS[i] + ANEIS[i + nr]) / 2)
      for (let j = 0; j < N_RAD; j += passo) {
        const m: Modulo = { i, nr, j, ns }
        const c = caixaDoModulo(m)
        if (c.r1 - c.r0 < PECA_Z + 90) continue
        if ((c.a1 - c.a0) * c.rm < PECA_X + 90) continue
        const ct = centro(m)
        const v = folgaDeVia(ct.x, ct.z, ct.r)
        if (v.folga < MARGEM) continue
        if (agua(ct.x, ct.z) < 0) continue
        // ⚠️ nao pode ocupar o mesmo bloco do estadio
        const pa = passoNoRaio(c.rm), pb = passoNoRaio(caixaDoModulo(EST).rm)
        const riSobrepoe = m.i < EST.i + EST.nr && EST.i < m.i + m.nr
        const angSobrepoe = m.j < EST.j + EST.ns * pb && EST.j < m.j + m.ns * pa
        if (riSobrepoe && angSobrepoe) continue
        const dEst = Math.hypot(ct.x - cEst.x, ct.z - cEst.z)
        res.push({ m, ...ct, ...v, dEst, radial: c.r1 - c.r0, arco: (c.a1 - c.a0) * c.rm })
      }
    }
  }
}
res.sort((a, b) => (b.folga - a.folga) || (a.dEst - b.dEst))
const perto = res.filter((o) => o.dEst < 1400)
console.log(`blocos que passam nas TRES familias de via + agua: ${res.length}`)
console.log('ordenados por FOLGA, so os que ficam a menos de 1.400 m de THE GEODE:')
console.log('  i nr   j ns    raio  radial   arco   folga de via                                dist estadio')
for (const o of perto.slice(0, 12)) {
  console.log(`${String(o.m.i).padStart(3)}${String(o.m.nr).padStart(3)}${String(o.m.j).padStart(4)}${String(o.m.ns).padStart(3)}  ${o.r.toFixed(0).padStart(6)}  ${o.radial.toFixed(0).padStart(6)} ${o.arco.toFixed(0).padStart(6)}   ${(o.folga.toFixed(0)+' m').padStart(6)} ate ${o.quem.padEnd(34)} ${o.dEst.toFixed(0).padStart(6)} m`)
}
// o sitio atual, para comparar


const ve = folgaDeVia(cEst.x, cEst.z, cEst.r)
const EST_VELHO: Modulo = { i: 11, nr: 3, j: 46, ns: 3 }
const cv = centro(EST_VELHO); const vv = folgaDeVia(cv.x, cv.z, cv.r)
console.log(`ESTADIO HOJE i11 j46 ns3: raio ${cv.r.toFixed(0)}, folga ${vv.folga.toFixed(0)} m ate ${vv.quem}`)

const NOVO: Modulo = { i: 11, nr: 3, j: 44, ns: 3 }
const cn = centro(NOVO); const vn = folgaDeVia(cn.x, cn.z, cn.r)
console.log(`\nESCOLHIDO PARA O ESTADIO: i11 nr3 j44 ns3`)
console.log(`  centro (${cn.x.toFixed(0)}, ${cn.z.toFixed(0)})  raio ${cn.r.toFixed(0)}  rumo ${((cn.am*180/Math.PI)+360)%360}`)
console.log(`  caixa ${(cn.c.r1-cn.c.r0).toFixed(0)} radial x ${((cn.c.a1-cn.c.a0)*cn.c.rm).toFixed(0)} arco`)
console.log(`  folga ate via grande: ${vn.folga.toFixed(0)} m (${vn.quem})`)
console.log(`  folga ate a rua do proprio modulo: radial ${((cn.c.r1-cn.c.r0-PECA_Z)/2).toFixed(0)} m, arco ${(((cn.c.a1-cn.c.a0)*cn.c.rm-PECA_X)/2).toFixed(0)} m`)
console.log(`  distancia a THE GEODE: ${Math.hypot(cn.x-cEst.x, cn.z-cEst.z).toFixed(0)} m`)
for (const c of M.lagos.corpos.map((c: any) => ({...c, d: Math.hypot(c.x-cn.x, c.z-cn.z) - Math.sqrt(c.area/Math.PI)})).sort((a: any,b: any)=>a.d-b.d).slice(0,1))
  console.log(`  agua mais proxima: ${c.d.toFixed(0)} m de folga`)
for (const cr of M.canais.radiais) {
  const f = lateral(cn.x, cn.z, cr.rumo) - cr.secao/2
  console.log(`  canal ${cr.id} (rumo ${cr.rumo}): ${f.toFixed(0)} m de afastamento lateral`)
}
