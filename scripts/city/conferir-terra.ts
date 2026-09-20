/** Confere a efeméride do painel da Terra contra valores conhecidos.
 *  Uso: npx tsx scripts/city/conferir-terra.ts */
import { dadosTerra, dur, distanciaKm, julianDay, elevacaoSol, faseLua, SINODICO } from '../../app/city/plaza/terra-dados'
const d = dadosTerra()
console.log('AGORA')
console.log(`  distancia      ${Math.round(d.distancia_km).toLocaleString('pt-BR')} km`)
console.log(`  atraso da luz  ${d.atraso_s.toFixed(3)} s`)
console.log(`  diametro       ${d.diametro_grau.toFixed(2)} graus`)
console.log(`  fase da Terra  ${(d.fase_terra * 100).toFixed(0)}% ${d.crescente ? 'crescente' : 'minguante'}`)
console.log(`  sol no sitio   ${d.sol_elevacao.toFixed(1)} graus, ${d.dia ? 'DIA' : 'NOITE'}`)
console.log(`  cruzamento em  ${dur(d.cruzamento_dias)} (${d.cruzamento_nascendo ? 'nasce' : 'se poe'})`)
let mn = 1e9, mx = -1e9
for (let k = 0; k < 400; k++) {
  const v = distanciaKm(julianDay(new Date(Date.now() + (k * 86400000) / 4)))
  mn = Math.min(mn, v); mx = Math.max(mx, v)
}
console.log(`\nCONFERENCIAS`)
console.log(`  distancia em 100 dias: ${Math.round(mn).toLocaleString('pt-BR')} a ${Math.round(mx).toLocaleString('pt-BR')} km   (real 356.500 a 406.700)`)
const jd0 = julianDay(new Date())
const trocas: number[] = []
let ant = elevacaoSol(jd0) >= 0
for (let k = 1; k < 4 * 60 * 4; k++) {
  const jd = jd0 + k * 0.25
  const v = elevacaoSol(jd) >= 0
  if (v !== ant) { trocas.push(k * 0.25); ant = v }
}
const ciclos = trocas.slice(1).map((t, i) => t - trocas[i])
console.log(`  meia-fase medida: ${ciclos.slice(0, 4).map((v) => v.toFixed(2)).join(', ')} dias   (esperado ${(SINODICO / 2).toFixed(2)})`)
console.log(`  fase da LUA hoje: ${(faseLua(jd0) * 100).toFixed(1)}% iluminada`)
