import { ILHAS, campoIlha } from '../../../app/city/plaza/ilhas'
import { ORLA_BAIA_DEDO_RUMOS, ORLA_BAIA_DEDO_LARGURA, ORLA_BAIA_FILEIRAS, ORLA_BAIA_ARCO } from '../../../app/city/plaza/orla-baia'

const spec = (id: string) => (ILHAS as any[]).find((i) => i.id === id)
// altura da ilha acima da lâmina no ponto do mundo (>0 = terra da ilha)
function altIlha(sp: any) {
  const c = campoIlha(sp)
  const g = (sp.giro * Math.PI) / 180
  const cg = Math.cos(g), sg = Math.sin(g)
  return (x: number, z: number) => {
    const dx = x - sp.x, dz = z - sp.z
    return c.alt(dx * cg + dz * sg, -dx * sg + dz * cg)
  }
}

console.log('1) ATÉ ONDE CADA DEDO PODE IR sem tocar ilha (folga pedida de 200 m):')
for (const rumo of ORLA_BAIA_DEDO_RUMOS) {
  const a = (rumo * Math.PI) / 180
  const ux = Math.sin(a), uz = -Math.cos(a)
  let limite = 7000
  for (const id of ['IL01', 'IL02', 'IL04']) {
    const f = altIlha(spec(id))
    for (let t = 4600; t < 7000; t += 5) {
      // varre a seção do dedo mais a folga
      let toca = false
      for (let p = -(ORLA_BAIA_DEDO_LARGURA / 2 + 200); p <= ORLA_BAIA_DEDO_LARGURA / 2 + 200; p += 10) {
        const x = ux * t + Math.cos(a) * p, z = uz * t + Math.sin(a) * p
        if (f(x, z) > 0) { toca = true; break }
      }
      if (toca) { limite = Math.min(limite, t); break }
    }
  }
  console.log(`   dedo ${rumo}: pode ir até r ${limite === 7000 ? '6150 (nenhuma ilha no caminho)' : limite}`)
}

console.log('\n2) A COSTA DA ILHA DO FUNDADOR INVADE O DISTRITO?')
const f1 = altIlha(spec('IL01'))
for (const fl of ORLA_BAIA_FILEIRAS) {
  let n = 0, g0 = 999, g1 = -999
  for (let g = ORLA_BAIA_ARCO[0]; g <= ORLA_BAIA_ARCO[1]; g += 0.1) {
    const a = (g * Math.PI) / 180
    let bate = false
    for (let d = 0; d <= 68; d += 8) {
      const r = fl.r + fl.sentido * d
      if (f1(Math.sin(a) * r, -Math.cos(a) * r) > 0) { bate = true; break }
    }
    if (bate) { n++; g0 = Math.min(g0, g); g1 = Math.max(g1, g) }
  }
  const metros = n * 0.1 * Math.PI / 180 * fl.r
  console.log(`   fileira r ${fl.r} (tier ${fl.tier}): ${n ? `${metros.toFixed(0)} m de testada dentro da ilha, rumos ${g0.toFixed(1)} a ${g1.toFixed(1)}` : 'limpa'}`)
}
