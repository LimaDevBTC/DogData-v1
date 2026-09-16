// A Lua da CHEGADA na /city (`app/city/plaza/chegada-lua.tsx`): cor e relevo
// do globo inteiro em dois tamanhos, com a mesma convenção de longitude.
//
//   node scripts/city/lua-textura.mjs
//
// Fontes (geradas por scripts/lunar/fetch_globe.ts, que é ignorado no git, e
// deixadas em public/lunar, também fora do git):
//   globe-color.jpg    LROC color 8k da NASA SVS (domínio público), borda esquerda = -180°
//   globe-height.i16   LOLA LDEM_16 em metros Int16, borda esquerda = 0°E, linha 0 = 90°N
//
// Saídas (versionadas, é o que a produção serve):
//   public/city/moon/moon_color_{2048,1024}.jpg
//   public/city/moon/moon_normal_{2048,1024}.jpg
//
// ⚠️ AS DUAS SAEM COM A BORDA ESQUERDA EM -180°. A altura vem com 0°E na borda
// e é girada meia volta aqui; sem isso o relevo fica 180° fora da cor e a
// cratera acende no mar errado, sem erro nenhum. Com essa convenção, no
// SphereGeometry do three a longitude L aponta para (cos L, 0, -sin L).
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..')
const FONTE = path.join(RAIZ, 'public/lunar')
const SAIDA = path.join(RAIZ, 'public/city/moon')
fs.mkdirSync(SAIDA, { recursive: true })

const corMeta = JSON.parse(fs.readFileSync(path.join(FONTE, 'globe-color.json'), 'utf8'))
if (corMeta.lonOffsetDeg !== -180) throw new Error(`cor com borda esquerda ${corMeta.lonOffsetDeg}°, esperado -180°`)

for (const w of [2048, 1024]) {
  await sharp(path.join(FONTE, 'globe-color.jpg'), { limitInputPixels: false })
    .resize(w, w / 2, { kernel: 'lanczos3' })
    .jpeg({ quality: 86, mozjpeg: true })
    .toFile(path.join(SAIDA, `moon_color_${w}.jpg`))
}

// ── relevo → mapa de normais em espaço tangente (convenção OpenGL, +Y = norte)
const alt = JSON.parse(fs.readFileSync(path.join(FONTE, 'globe-height.json'), 'utf8'))
const buf = fs.readFileSync(path.join(FONTE, 'globe-height.i16'))
const h = new Int16Array(buf.buffer, buf.byteOffset, buf.byteLength / 2)
const { cols: C, rows: L } = alt
if (h.length !== C * L) throw new Error('globe-height.i16 com tamanho inesperado')
const R = 1737400

// Lua boa de ver: crateras em 1:1 somem no disco inteiro, então o relevo sai
// exagerado aqui e o material ainda afina pelo `normalScale`.
const EXAGERO = 4

for (const w of [2048, 1024]) {
  const H = w / 2
  const px = Buffer.alloc(w * H * 3)
  const amostra = (lat, lon) => {
    // bilinear na grade de origem (0°E na coluna 0)
    const lo = ((lon % 360) + 360) % 360
    const cf = (lo / 360) * C - 0.5
    const rf = Math.min(L - 1, Math.max(0, ((90 - lat) / 180) * L - 0.5))
    const c0 = Math.floor(cf), r0 = Math.floor(rf)
    const fc = cf - c0, fr = rf - r0
    const cA = ((c0 % C) + C) % C, cB = (cA + 1) % C, rB = Math.min(L - 1, r0 + 1)
    const v = (r, c) => h[r * C + c]
    return (v(r0, cA) * (1 - fc) + v(r0, cB) * fc) * (1 - fr) + (v(rB, cA) * (1 - fc) + v(rB, cB) * fc) * fr
  }
  const dLon = 360 / w, dLat = 180 / H
  for (let y = 0; y < H; y++) {
    const lat = 90 - (y + 0.5) * dLat
    const cosLat = Math.max(0.05, Math.cos((lat * Math.PI) / 180))
    const mLeste = (2 * Math.PI * R * cosLat) / w
    const mNorte = (Math.PI * R) / H
    for (let x = 0; x < w; x++) {
      const lon = -180 + (x + 0.5) * dLon
      const dx = (amostra(lat, lon + dLon) - amostra(lat, lon - dLon)) / (2 * mLeste)
      const dy = (amostra(lat + dLat, lon) - amostra(lat - dLat, lon)) / (2 * mNorte)
      let nx = -dx * EXAGERO, ny = -dy * EXAGERO, nz = 1
      const n = Math.hypot(nx, ny, nz)
      nx /= n; ny /= n; nz /= n
      const i = (y * w + x) * 3
      px[i] = Math.round((nx * 0.5 + 0.5) * 255)
      px[i + 1] = Math.round((ny * 0.5 + 0.5) * 255)
      px[i + 2] = Math.round((nz * 0.5 + 0.5) * 255)
    }
  }
  await sharp(px, { raw: { width: w, height: H, channels: 3 } })
    .jpeg({ quality: 90, mozjpeg: true })
    .toFile(path.join(SAIDA, `moon_normal_${w}.jpg`))
}

for (const f of fs.readdirSync(SAIDA)) {
  console.log(`${f}  ${(fs.statSync(path.join(SAIDA, f)).size / 1024).toFixed(0)} KB`)
}
