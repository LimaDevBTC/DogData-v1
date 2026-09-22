import { orlaBaiaAlturaAt } from '../../../app/city/plaza/orla-baia'
const nat = (x: number, z: number) => -28 + 9 * Math.sin(x / 733) + 7 * Math.cos(z / 517)
const out: string[] = []
for (let a = 0; a < 360; a += 1) {
  for (let r = 3300; r <= 6600; r += 25) {
    const ra = a * Math.PI / 180
    const x = Math.sin(ra) * r, z = -Math.cos(ra) * r
    out.push(`${a} ${r} ${orlaBaiaAlturaAt(x, z, nat(x, z)).toFixed(6)}`)
  }
}
console.log(out.join('\n'))
