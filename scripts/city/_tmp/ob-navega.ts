// Os dois canais do distrito desaguam na enseada? Inundação simples a partir de um
// ponto que é água na baía aberta, contra a cota esculpida da orla, sem o relevo
// natural (natural = -30, ou seja plataforma seca em toda parte que a orla não cava).
import { orlaBaiaAlturaAt, ORLA_BAIA_CANAL_EIXOS, ORLA_BAIA_ARCO } from '../../../app/city/plaza/orla-baia'
const CEL = 10, R0 = 3200, R1 = 6600
const N = Math.ceil((2 * R1) / CEL)
const idx = (i: number, j: number) => j * N + i
const agua = new Uint8Array(N * N)
const xy = (i: number, j: number) => [(i - N / 2) * CEL, (j - N / 2) * CEL] as const
for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
  const [x, z] = xy(i, j)
  const r = Math.hypot(x, z)
  if (r < R0 || r > R1) continue
  // o natural aqui imita a baía real: leito abaixo da lâmina fora da linha
  // d'água imposta, plataforma seca para dentro. Sem isso o teste não tem baía.
  const nat = r > 4860 ? -45 : -30
  if (orlaBaiaAlturaAt(x, z, nat) < -40) agua[idx(i, j)] = 1
}
// semente: baía aberta no eixo, bem além da linha d'água
const a = 51.3 * Math.PI / 180
const sx = Math.sin(a) * 5600, sz = -Math.cos(a) * 5600   // baía aberta no eixo
const si = Math.round(sx / CEL + N / 2), sj = Math.round(sz / CEL + N / 2)
if (!agua[idx(si, sj)]) { console.log('semente não é água, aborta'); process.exit(1) }
const vis = new Uint8Array(N * N)
const fila = [idx(si, sj)]; vis[idx(si, sj)] = 1
while (fila.length) {
  const k = fila.pop() as number
  const i = k % N, j = (k - i) / N
  for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    const ni = i + di, nj = j + dj
    if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue
    const nk = idx(ni, nj)
    if (vis[nk] || !agua[nk]) continue
    vis[nk] = 1; fila.push(nk)
  }
}
// quanto de cada canal foi alcançado, por rumo
for (const eixo of ORLA_BAIA_CANAL_EIXOS) {
  let tot = 0, alc = 0
  for (let g = ORLA_BAIA_ARCO[0]; g <= ORLA_BAIA_ARCO[1]; g += 0.25) {
    const ra = g * Math.PI / 180
    const x = Math.sin(ra) * eixo, z = -Math.cos(ra) * eixo
    const i = Math.round(x / CEL + N / 2), j = Math.round(z / CEL + N / 2)
    if (!agua[idx(i, j)]) continue
    tot++
    if (vis[idx(i, j)]) alc++
  }
  console.log(`canal r ${eixo}: ${tot} amostras de lâmina no arco, ${alc} alcançadas da baía (${(100 * alc / Math.max(1, tot)).toFixed(1)}%)`)
}
let totAgua = 0, totVis = 0
for (let k = 0; k < N * N; k++) { if (agua[k]) totAgua++; if (vis[k]) totVis++ }
console.log(`água na janela: ${(totAgua * CEL * CEL / 1e6).toFixed(3)} km², alcançada da baía: ${(totVis * CEL * CEL / 1e6).toFixed(3)} km²`)
