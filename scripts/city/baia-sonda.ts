// ═══════════════════════════════════════════════════════════════════════════
// SONDA DA BAÍA: onde cabe a Ilha dos Founders.
//
// Uso:  npx tsx scripts/city/baia-sonda.ts [--cel=20]
//
// ⚠️ MEDE A ÁGUA DESENHADA, não o número publicado. `cidade-malha.json` publica
// só o centro e a área da baía; a FORMA dela nasce do relevo cortado pela cota,
// e é a forma que decide onde uma ilha cabe sem estrangular o espelho d'água.
//
// Responde três perguntas, nesta ordem:
//   1. qual é a lâmina real da baía (flood fill a partir do centro publicado)
//   2. onde está o ponto mais longe de qualquer margem (transformada de distância)
//   3. o que se vê da orla nobre: distância e ângulo da alça (AN7, r 6.950)
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { AVENIDA_ALCA, ALCA_TERRA } from '../../app/city/plaza/teia'

const arg = (k: string, d: string) =>
  (process.argv.find((a) => a.startsWith(`--${k}=`)) || `--${k}=${d}`).split('=')[1]
const CEL = +arg('cel', 20)

const M = JSON.parse(readFileSync('public/city/cidade-malha.json', 'utf8'))
const COTA = M.lagos.cota as number
const BAIA = M.lagos.baia as { x: number; z: number; area: number }

async function main() {
  Object.assign(globalThis, {
    document: { createElement: () => ({ width: 0, height: 0, getContext: () => ({ putImageData() {} }) }) },
    ImageData: class { constructor(public data: Uint8ClampedArray, public width: number, public height: number) {} },
  })
  const { buildTerrain, CANAL_LAMINA, LAGO_R1 } = await import('../../app/city/plaza/terrain')
  const meta = JSON.parse(readFileSync('public/lunar/btc-core-heightmap.json', 'utf8'))
  const b = readFileSync('public/lunar/btc-core-heightmap.f32')
  const terrain = buildTerrain(
    meta, new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)),
    {
      radiais: M.canais.radiais.map((r: any) => ({
        rumo: r.rumo, secao: CANAL_LAMINA, rInicio: Math.min(r.rInicio, LAGO_R1), rFim: r.rFim ?? 4300,
      })),
      aneis: M.canais.aneis, talude: M.canais.talude, leito: COTA - 4,
    },
    { faixaSeca: false },
  )

  // janela generosa em volta do centro publicado da baía
  const R = +arg("r", "6500")
  const n = Math.ceil((2 * R) / CEL)
  const x0 = BAIA.x - R, z0 = BAIA.z - R
  const agua = new Uint8Array(n * n)
  const prof = new Float32Array(n * n)
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = x0 + i * CEL, z = z0 + j * CEL
      const y = terrain.superficieAt(x, z)
      prof[j * n + i] = y
      if (y < COTA) agua[j * n + i] = 1
    }
  }

  // 1. flood fill a partir do centro publicado: só a baía, não os outros 16 corpos
  const ci = Math.round((BAIA.x - x0) / CEL), cj = Math.round((BAIA.z - z0) / CEL)
  const baia = new Uint8Array(n * n)
  const fila = [cj * n + ci]
  baia[cj * n + ci] = 1
  let cel = 0
  while (fila.length) {
    const k = fila.pop()!
    cel++
    const i = k % n, j = (k - i) / n
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ii = i + di, jj = j + dj
      if (ii < 0 || jj < 0 || ii >= n || jj >= n) continue
      const kk = jj * n + ii
      if (agua[kk] && !baia[kk]) { baia[kk] = 1; fila.push(kk) }
    }
  }

  // 2. transformada de distância até a margem, por varredura de duas passadas
  const INF = 1e9
  const dist = new Float32Array(n * n).fill(INF)
  for (let k = 0; k < n * n; k++) if (!baia[k]) dist[k] = 0
  const relax = (k: number, kk: number, d: number) => {
    if (dist[kk] + d < dist[k]) dist[k] = dist[kk] + d
  }
  const D1 = CEL, D2 = CEL * Math.SQRT2
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const k = j * n + i
    if (i > 0) relax(k, k - 1, D1)
    if (j > 0) relax(k, k - n, D1)
    if (i > 0 && j > 0) relax(k, k - n - 1, D2)
    if (i < n - 1 && j > 0) relax(k, k - n + 1, D2)
  }
  for (let j = n - 1; j >= 0; j--) for (let i = n - 1; i >= 0; i--) {
    const k = j * n + i
    if (i < n - 1) relax(k, k + 1, D1)
    if (j < n - 1) relax(k, k + n, D1)
    if (i < n - 1 && j < n - 1) relax(k, k + n + 1, D2)
    if (i > 0 && j < n - 1) relax(k, k + n - 1, D2)
  }

  let melhor = -1, mk = 0
  for (let k = 0; k < n * n; k++) if (baia[k] && dist[k] > melhor) { melhor = dist[k]; mk = k }
  const mi = mk % n, mj = (mk - mi) / n
  const mx = x0 + mi * CEL, mz = z0 + mj * CEL

  // extensão da baía
  let xi = n, xa = -1, zi = n, za = -1, fundo = 0
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    if (!baia[j * n + i]) continue
    if (i < xi) xi = i; if (i > xa) xa = i
    if (j < zi) zi = j; if (j > za) za = j
    fundo = Math.min(fundo, prof[j * n + i])
  }

  // 3. a orla nobre: a AN7 em r 6.950, arco da alça de terra
  const [a0, a1] = ALCA_TERRA
  const rumoDe = (x: number, z: number) => ((Math.atan2(x, -z) * 180) / Math.PI + 360) % 360
  const pontoAn7 = (rumoDeg: number) => {
    const a = (rumoDeg * Math.PI) / 180
    return [Math.sin(a) * AVENIDA_ALCA.r, -Math.cos(a) * AVENIDA_ALCA.r] as [number, number]
  }
  const meioAlca = (a0 + (((a1 - a0) + 360) % 360) / 2) % 360
  const [ax, az] = pontoAn7(meioAlca)
  const dAlca = Math.hypot(mx - ax, mz - az)

  // largura da lâmina no eixo que liga o centro da cidade ao centro da baía
  const rumoBaia = rumoDe(BAIA.x, BAIA.z)
  const molhado = (x: number, z: number) => terrain.superficieAt(x, z) < COTA
  const varre = (x: number, z: number, dx: number, dz: number) => {
    let d = 0
    while (d < 6000 && molhado(x + dx * d, z + dz * d)) d += 10
    return d
  }
  const ux = Math.sin((rumoBaia * Math.PI) / 180), uz = -Math.cos((rumoBaia * Math.PI) / 180)

  if (process.argv.some((a) => a.startsWith('--dump='))) {
    // ⚠️ A MÁSCARA SAI DAQUI E NÃO DO PYTHON. A forma da baía nasce do relevo
    // JÁ CORTADO por `terrain.ts` (pódio, lago, canais); o heightmap cru não a
    // conhece. Quem desenha a chapa lê este dump, nunca o .f32.
    const dir = arg('dump', '/tmp/baia')
    mkdirSync(dir, { recursive: true })
    writeFileSync(`${dir}/mascara.bin`, Buffer.from(baia))
    writeFileSync(`${dir}/mascara.json`, JSON.stringify({ x0, z0, cel: CEL, n, cota: COTA }))
    console.log(`mascara da baia em ${dir} (${n}x${n} celulas de ${CEL} m)`)
  }

  console.log(`
BAIA, medida com celula de ${CEL} m

lamina         ${((cel * CEL * CEL) / 1e6).toFixed(3)} km2   (publicado: ${(BAIA.area / 1e6).toFixed(3)} km2)
extensao       ${((xa - xi) * CEL).toFixed(0)} m no eixo x, ${((za - zi) * CEL).toFixed(0)} m no eixo z
cota da lamina ${COTA}   fundo medido ${fundo.toFixed(1)} m
centro publicado  (${BAIA.x.toFixed(0)}, ${BAIA.z.toFixed(0)})  rumo ${rumoBaia.toFixed(1)}, r ${Math.hypot(BAIA.x, BAIA.z).toFixed(0)}

PONTO MAIS LONGE DE QUALQUER MARGEM
  (${mx.toFixed(0)}, ${mz.toFixed(0)})   folga ${melhor.toFixed(0)} m ate a margem mais proxima
  rumo ${rumoDe(mx, mz).toFixed(1)}, r ${Math.hypot(mx, mz).toFixed(0)}
  agua para dentro ${varre(mx, mz, -ux, -uz).toFixed(0)} m, para fora ${varre(mx, mz, ux, uz).toFixed(0)} m

ORLA NOBRE (AN7 r ${AVENIDA_ALCA.r}, alca de terra ${a0} a ${a1}, meio em ${meioAlca.toFixed(1)})
  meio da alca   (${ax.toFixed(0)}, ${az.toFixed(0)})
  distancia ate o ponto de maior folga: ${dAlca.toFixed(0)} m
`)

  if (process.argv.includes('--eixo')) {
    // ⚠️ A PERGUNTA NÃO É "onde cabe mais", É "onde cabe no EIXO". A ilha fica
    // entre a cidade e a orla nobre, e um objeto fora do eixo lido de 510 lotes
    // vira acidente. Varre rumo a rumo e raio a raio, e imprime a melhor folga.
    console.log('folga por rumo fino (a ilha mora no eixo da alca, meio em ' + meioAlca.toFixed(1) + '):')
    for (let r = 36; r <= 66; r += 2) {
      let melhorR = 0, rr = 0
      for (let d = 3500; d < 7000; d += 10) {
        const x = Math.sin((r * Math.PI) / 180) * d, z = -Math.cos((r * Math.PI) / 180) * d
        const i = Math.round((x - x0) / CEL), j = Math.round((z - z0) / CEL)
        if (i < 0 || j < 0 || i >= n || j >= n) continue
        const k = j * n + i
        if (baia[k] && dist[k] > melhorR) { melhorR = dist[k]; rr = d }
      }
      const px = Math.sin((r * Math.PI) / 180) * rr, pz = -Math.cos((r * Math.PI) / 180) * rr
      const [qx, qz] = pontoAn7(r)
      console.log(`  rumo ${String(r).padStart(3)}  folga ${melhorR.toFixed(0).padStart(4)} m em r ${String(rr).padStart(4)}  ate a AN7 ${Math.hypot(px - qx, pz - qz).toFixed(0).padStart(4)} m`)
    }
  }

  // perfil: folga maxima por rumo, para escolher posicao com intencao
  console.log('folga maxima da agua por rumo (a partir do centro da cidade):')
  for (let r = 0; r < 360; r += 15) {
    let melhorR = 0, rr = 0
    for (let d = 3000; d < 9000; d += 25) {
      const x = Math.sin((r * Math.PI) / 180) * d, z = -Math.cos((r * Math.PI) / 180) * d
      const i = Math.round((x - x0) / CEL), j = Math.round((z - z0) / CEL)
      if (i < 0 || j < 0 || i >= n || j >= n) continue
      const k = j * n + i
      if (baia[k] && dist[k] > melhorR) { melhorR = dist[k]; rr = d }
    }
    if (melhorR > 0) console.log(`  rumo ${String(r).padStart(3)}  folga ${melhorR.toFixed(0).padStart(4)} m em r ${rr}`)
  }
}

main().catch((e) => { console.error(e); process.exit(1) })

// ── varredura fina no eixo da alça, para a ilha nascer alinhada ─────────────
// (rodar com --eixo=1)
