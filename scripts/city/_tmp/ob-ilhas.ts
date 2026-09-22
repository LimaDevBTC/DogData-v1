import { ILHAS } from '../../../app/city/plaza/ilhas'
for (const i of ILHAS as any[]) {
  const r = Math.hypot(i.x, i.z)
  let a = Math.atan2(i.x, -i.z) * 180 / Math.PI; if (a < 0) a += 360
  const dentro = a >= -5 && a <= 110 && r > 3300 && r < 6700
  console.log(`${(i.id ?? i.nome ?? '?').toString().padEnd(18)} r ${r.toFixed(0).padStart(5)} rumo ${a.toFixed(1).padStart(6)}  raio~${(i.raio ?? i.a ?? '?')}  ${dentro ? '<< DENTRO DA JANELA DA ORLA' : ''}`)
}
