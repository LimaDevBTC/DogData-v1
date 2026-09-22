// Gera a tabela polar da costa de cada ilha, no quadro LOCAL dela, com margem.
import { ILHAS, campoIlha } from '../../../app/city/plaza/ilhas'
const BUCKETS = 72, MARGEM = 60
for (const id of ['IL01', 'IL02', 'IL04']) {
  const sp = (ILHAS as any[]).find((i) => i.id === id)
  const c = campoIlha(sp)
  const tab = new Array(BUCKETS).fill(0)
  for (let k = 0; k < 2880; k++) {
    const th = (k / 2880) * Math.PI * 2
    let lo = 0, hi = Math.max(c.Lx, c.Lz) * 1.6
    for (let it = 0; it < 44; it++) {
      const m = (lo + hi) / 2
      if (c.alt(Math.cos(th) * m, Math.sin(th) * m) > 0) lo = m; else hi = m
    }
    const m = (lo + hi) / 2
    // o balde e os dois vizinhos, para a tabela nunca cortar entre amostras
    const b = Math.floor((k / 2880) * BUCKETS)
    for (const d of [-1, 0, 1]) {
      const bb = (b + d + BUCKETS) % BUCKETS
      tab[bb] = Math.max(tab[bb], m + MARGEM)
    }
  }
  console.log(`  { id: '${id}', x: ${sp.x}, z: ${sp.z}, giro: ${sp.giro}, r: [${tab.map((v) => Math.ceil(v)).join(',')}] },`)
}
