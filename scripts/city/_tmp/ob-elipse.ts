import { ILHAS, campoIlha } from '../../../app/city/plaza/ilhas'
for (const id of ['IL01', 'IL02', 'IL04']) {
  const sp = (ILHAS as any[]).find((i) => i.id === id)
  const c = campoIlha(sp)
  let ax = 0, az = 0
  const pts: [number, number][] = []
  for (let k = 0; k < 1440; k++) {
    const th = (k / 1440) * Math.PI * 2
    let lo = 0, hi = Math.max(c.Lx, c.Lz) * 1.6
    for (let it = 0; it < 44; it++) {
      const m = (lo + hi) / 2
      if (c.alt(Math.cos(th) * m, Math.sin(th) * m) > 0) lo = m; else hi = m
    }
    const m = (lo + hi) / 2
    const sx = Math.cos(th) * m, sz = Math.sin(th) * m
    pts.push([sx, sz]); ax = Math.max(ax, Math.abs(sx)); az = Math.max(az, Math.abs(sz))
  }
  // aperta a elipse: cresce k até cobrir todo ponto
  let k = 1
  for (const [sx, sz] of pts) k = Math.max(k, Math.hypot(sx / ax, sz / az))
  const AX = Math.ceil(ax * k), AZ = Math.ceil(az * k)
  // o quanto essa elipse alcança para dentro, em raio da cidade
  const g = (sp.giro * Math.PI) / 180, cg = Math.cos(g), sg = Math.sin(g)
  let rmin = 1e9
  for (let t = 0; t < 720; t++) {
    const th = (t / 720) * Math.PI * 2
    const sx = Math.cos(th) * AX, sz = Math.sin(th) * AZ
    const x = sp.x + sx * cg - sz * sg, z = sp.z + sx * sg + sz * cg
    rmin = Math.min(rmin, Math.hypot(x, z))
  }
  console.log(`${id}: elipse local ax=${AX} az=${AZ} giro=${sp.giro}  -> alcança r ${rmin.toFixed(0)} para dentro`)
}
