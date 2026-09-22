import { ILHAS, campoIlha } from '../../../app/city/plaza/ilhas'
for (const id of ['IL01', 'IL02', 'IL04']) {
  const sp = (ILHAS as any[]).find((i) => i.id === id)
  const c = campoIlha(sp)
  let rmax = 0
  for (let k = 0; k < 1440; k++) {
    const th = (k / 1440) * Math.PI * 2
    let lo = 0, hi = Math.max(c.Lx, c.Lz) * 1.6
    for (let it = 0; it < 44; it++) {
      const m = (lo + hi) / 2
      if (c.alt(Math.cos(th) * m, Math.sin(th) * m) > 0) lo = m; else hi = m
    }
    rmax = Math.max(rmax, (lo + hi) / 2)
  }
  console.log(`${id} ${sp.nome}: centro (${sp.x}, ${sp.z})  raio do disco que cobre a costa inteira: ${Math.ceil(rmax)} m  (raio nominal ${sp.raio}, alonga ${sp.alonga})`)
}
