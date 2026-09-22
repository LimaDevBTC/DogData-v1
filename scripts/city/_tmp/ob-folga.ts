// Folga MEDIDA entre o desenho da orla e as três ilhas que caem na janela.
import { ILHAS, campoIlha } from '../../../app/city/plaza/ilhas'
import {
  ORLA_BAIA_DEDO_RUMOS, ORLA_BAIA_DEDO_PONTA, ORLA_BAIA_DEDO_LARGURA,
  ORLA_BAIA_R_AGUA, orlaBaiaLinhaDagua, ORLA_BAIA_PRAIA,
} from '../../../app/city/plaza/orla-baia'

const ALVO = ['IL01', 'IL02', 'IL04']
const ilhas = (ILHAS as any[]).filter((i) => ALVO.includes(i.id))

// amostra a costa de cada ilha: onde alt() cruza zero (a lâmina)
function costa(spec: any): { x: number; z: number }[] {
  const c = campoIlha(spec)
  const g = (spec.giro * Math.PI) / 180
  const cg = Math.cos(g), sg = Math.sin(g)
  const pts: { x: number; z: number }[] = []
  for (let k = 0; k < 720; k++) {
    const th = (k / 720) * Math.PI * 2
    let lo = 0, hi = Math.max(c.Lx, c.Lz) * 1.6
    // acha o raio local onde a altura cruza 0
    for (let it = 0; it < 40; it++) {
      const m = (lo + hi) / 2
      const sx = Math.cos(th) * m, sz = Math.sin(th) * m
      if (c.alt(sx, sz) > 0) lo = m; else hi = m
    }
    const m = (lo + hi) / 2
    if (m < 1) continue
    const sx = Math.cos(th) * m, sz = Math.sin(th) * m
    pts.push({ x: spec.x + sx * cg - sz * sg, z: spec.z + sx * sg + sz * cg })
  }
  return pts
}

for (const sp of ilhas) {
  const pts = costa(sp)
  const rs = pts.map((p) => Math.hypot(p.x, p.z))
  console.log(`\n${sp.id} ${sp.nome}: costa amostrada em ${pts.length} pontos, r ${Math.min(...rs).toFixed(0)} a ${Math.max(...rs).toFixed(0)}`)
  // distância mínima a cada eixo de dedo (segmento da base à ponta) e à linha d'água
  for (const rumo of ORLA_BAIA_DEDO_RUMOS) {
    const a = (rumo * Math.PI) / 180
    const ux = Math.sin(a), uz = -Math.cos(a)
    let dmin = Infinity
    for (const p of pts) {
      const t = Math.max(ORLA_BAIA_R_AGUA - ORLA_BAIA_PRAIA, Math.min(ORLA_BAIA_DEDO_PONTA, p.x * ux + p.z * uz))
      const d = Math.hypot(p.x - ux * t, p.z - uz * t) - ORLA_BAIA_DEDO_LARGURA / 2
      if (d < dmin) dmin = d
    }
    console.log(`   dedo ${rumo}: folga mínima ${dmin.toFixed(0)} m${dmin < 0 ? '   <<< O DEDO ENTRA NA ILHA' : dmin < 150 ? '   <<< APERTADO' : ''}`)
  }
  let dCosta = Infinity
  for (const p of pts) {
    let ang = Math.atan2(p.x, -p.z) * 180 / Math.PI; if (ang < 0) ang += 360
    const d = Math.hypot(p.x, p.z) - orlaBaiaLinhaDagua(ang)
    if (d < dCosta) dCosta = d
  }
  console.log(`   linha d'água da orla: folga mínima ${dCosta.toFixed(0)} m${dCosta < 0 ? '   <<< A ILHA ENTRA NA TERRA NOVA' : ''}`)
}
