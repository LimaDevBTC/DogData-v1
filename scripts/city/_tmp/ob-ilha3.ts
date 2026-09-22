import { ILHAS, campoIlha } from '../../../app/city/plaza/ilhas'
const spec = (id: string) => (ILHAS as any[]).find((i) => i.id === id)
function altIlha(sp: any) {
  const c = campoIlha(sp); const g = (sp.giro * Math.PI) / 180
  const cg = Math.cos(g), sg = Math.sin(g)
  return (x: number, z: number) => {
    const dx = x - sp.x, dz = z - sp.z
    return c.alt(dx * cg + dz * sg, -dx * sg + dz * cg)
  }
}
const fs = ['IL01', 'IL02', 'IL04'].map((id) => ({ id, f: altIlha(spec(id)) }))

console.log('A COSTA DAS TRÊS ILHAS, por rumo (raio mínimo e máximo de terra):')
for (let g = 0; g <= 104; g += 2) {
  const a = (g * Math.PI) / 180
  const marcas: string[] = []
  for (const { id, f } of fs) {
    let r0 = 0, r1 = 0
    for (let r = 4200; r < 7200; r += 10) {
      if (f(Math.sin(a) * r, -Math.cos(a) * r) > 0) { if (!r0) r0 = r; r1 = r }
    }
    if (r0) marcas.push(`${id} ${r0}..${r1}`)
  }
  if (marcas.length) console.log(`  rumo ${String(g).padStart(3)}: ${marcas.join('   ')}`)
}

console.log('\nATÉ ONDE VAI CADA DEDO CANDIDATO (seção 182 m + 200 m de folga):')
const LARG = 182
for (const rumo of [3.3, 8.3, 11.3, 24.3, 27.3, 31.3, 71.3, 75.3, 78.3, 91.3, 94.3, 99.3]) {
  const a = (rumo * Math.PI) / 180
  const ux = Math.sin(a), uz = -Math.cos(a)
  let limite = 6400
  for (const { f } of fs) {
    for (let t = 4700; t < 6400; t += 5) {
      let toca = false
      for (let p = -(LARG / 2 + 200); p <= LARG / 2 + 200; p += 10) {
        const x = ux * t + Math.cos(a) * p, z = uz * t + Math.sin(a) * p
        if (f(x, z) > 0) { toca = true; break }
      }
      if (toca) { limite = Math.min(limite, t); break }
    }
  }
  console.log(`  dedo ${String(rumo).padStart(5)}: até r ${limite >= 6400 ? '6400+ (livre)' : limite}`)
}
