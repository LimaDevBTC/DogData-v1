import { orlaBaiaAlturaAt, ORLA_BAIA_FILEIRAS, ORLA_BAIA_VIAS } from '../../../app/city/plaza/orla-baia'
const h = (r: number, a = 20) => {
  const ra = a * Math.PI / 180
  return orlaBaiaAlturaAt(Math.sin(ra) * r, -Math.cos(ra) * r, -30)
}
console.log('perfil radial no rumo 20° (fora da enseada), de 4.080 a 4.820:')
for (let r = 4080; r <= 4820; r += 10) {
  const v = h(r)
  const marca = ORLA_BAIA_FILEIRAS.some(f => Math.abs(f.r - r) < 5) ? ' <- testada'
    : ORLA_BAIA_VIAS.some(v2 => Math.abs(v2.r - r) < 6) ? ' <- rua' : ''
  if (v > -30.5 && !marca) continue
  console.log(`  r ${r}  cota ${v.toFixed(2)}${marca}`)
}
console.log('')
console.log('cada fileira, cota nos dois extremos do fundo (68 m):')
for (const f of ORLA_BAIA_FILEIRAS) {
  const a2 = f.r, b2 = f.r + f.sentido * 68
  console.log(`  r ${f.r} tier ${f.tier}: testada ${h(a2).toFixed(2)}  fundo ${h(b2).toFixed(2)}  meio ${h((a2+b2)/2).toFixed(2)}`)
}
console.log('')
console.log('as quatro ruas:')
for (const v of ORLA_BAIA_VIAS) console.log(`  ${v.id} r ${v.r}: ${h(v.r - 6).toFixed(2)} .. ${h(v.r + 6).toFixed(2)}`)
