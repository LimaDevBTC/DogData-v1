#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// OS DERIVADOS DO MAPA NAVEGÁVEL (/city/mapa).
//
// O mapa 2D lê o registro selado direto do que a cena 3D já lê:
// public/city/cidade-lotes.bin (15 bytes por lote) e cidade-cotas.bin. Mas o
// .bin NÃO carrega quarto, quarteirão nem número do lote, e sem eles não existe
// lot_id no navegador. O CSV que os tem pesa 9,6 MB e leva o endereço do dono
// junto, que NÃO deve descer para o cliente por padrão. Este script fabrica
// quatro arquivos pequenos em public/city/mapa/, todos DERIVADOS do registro,
// nunca fonte:
//
//   lotes-indice.bin   4 bytes por lote, na MESMA ORDEM do cidade-lotes.bin:
//                      quarto, quarteirão, lote e a área exata do CSV (como
//                      delta contra frente×fundo do .bin, que arredonda em até
//                      11 m²). É o que dá o lot_id a cada registro.
//   fundo.webp         relevo sombreado + água, lido de data/superficie.f32, o
//                      chão COMO CONSTRUÍDO (não marketing/mapas/topo.f32).
//                      data/ não é servido pelo Next, então a imagem vai para
//                      public/.
//   agua.bin           máscara de bits da água (512×512 sobre ±9.600 m): serve
//                      para NÃO desenhar a teia viária em cima da baía.
//   selo.json          bloco, merkle root e as digitais das fontes, lidos de
//                      data/dogcity_merkle.json. O cartucho da legenda imprime
//                      daqui; ninguém digita o root.
//
// ⚠️ O SCRIPT MORRE SE O REGISTRO MUDOU. Ele confere o sha256 do .bin e do CSV
// contra os selos do merkle e confere, lote a lote, que a linha i do CSV é o
// registro i do .bin (x, z, setor). Um índice desalinhado em silêncio faria o
// mapa dar a escritura de um lote a outro.
//
// ⚠️ NÃO ESCREVE EM NENHUMA FONTE. Só lê data/ e public/city/cidade*, e só
// grava em public/city/mapa/.
//
// Uso: node scripts/city/mapa/gerar-derivados.mjs
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const p = (...s) => join(RAIZ, ...s)
const sha = (b) => createHash('sha256').update(b).digest('hex')
const SAIDA = p('public', 'city', 'mapa')
mkdirSync(SAIDA, { recursive: true })

const morre = (msg) => {
  console.error(`gerar-derivados: ${msg}`)
  process.exit(1)
}

// ── 1. o registro: .bin contra CSV, e o índice ─────────────────────────────
const bin = readFileSync(p('public', 'city', 'cidade-lotes.bin'))
const csvBuf = readFileSync(p('data', 'dogcity_lotes.csv'))
const cidade = JSON.parse(readFileSync(p('public', 'city', 'cidade.json'), 'utf8'))
const merkle = JSON.parse(readFileSync(p('data', 'dogcity_merkle.json'), 'utf8'))

const shaBin = sha(bin)
const shaCsv = sha(csvBuf)
if (merkle.selos['public/city/cidade-lotes.bin'] !== shaBin)
  morre('cidade-lotes.bin não bate com o selo do merkle: o registro mudou depois de selado')
if (merkle.selos['data/dogcity_lotes.csv'] !== shaCsv)
  morre('dogcity_lotes.csv não bate com o selo do merkle: o registro mudou depois de selado')

const REG = cidade.registroBytes
if (REG !== 15 || cidade.registroVersao !== 3)
  morre(`esperava registro v3 de 15 bytes, cidade.json declara v${cidade.registroVersao} de ${REG}`)
const n = Math.floor(bin.length / REG)

const linhas = csvBuf.toString('utf8').split('\n').filter((l) => l.length)
const cab = linhas.shift().split(',')
const col = Object.fromEntries(cab.map((c, i) => [c, i]))
for (const c of ['lot_id', 'setor', 'quarto', 'quarteirao', 'lote', 'x_m', 'z_m', 'area_m2'])
  if (!(c in col)) morre(`CSV sem a coluna ${c}`)
if (linhas.length !== n) morre(`CSV tem ${linhas.length} linhas e o .bin ${n} registros`)

// cabeçalho: magic, n, versão, reservado. O leitor recusa o que não casar com
// o .bin que ele mesmo baixou, então um índice velho nunca rotula lote novo.
const CAB = 12
const indice = Buffer.alloc(CAB + n * 4)
indice.write('DCMI', 0, 'ascii')
indice.writeUInt32LE(n, 4)
indice.writeUInt16LE(1, 8)
indice.writeUInt16LE(0, 10)

let deltaMin = 0, deltaMax = 0
for (let i = 0; i < n; i++) {
  const off = i * REG
  const x = bin.readInt16LE(off) / 4
  const z = bin.readInt16LE(off + 2) / 4
  const s = bin.readUInt8(off + 4)
  const w10 = bin.readUInt16LE(off + 9)
  const d10 = bin.readUInt16LE(off + 11)
  const f = linhas[i].split(',')
  // ⚠️ O SETOR DO .bin É 0-BASED e o do CSV/lot_id é 1-based. tecido.ts não se
  // importa (só usa o setor como balde), mas o lot_id se importa.
  if (parseInt(f[col.setor], 10) !== s + 1)
    morre(`linha ${i}: setor CSV ${f[col.setor]} vs bin ${s}+1`)
  if (Math.abs(parseFloat(f[col.x_m]) - x) > 0.13 || Math.abs(parseFloat(f[col.z_m]) - z) > 0.13)
    morre(`linha ${i} (${f[col.lot_id]}): posição CSV (${f[col.x_m]}, ${f[col.z_m]}) vs bin (${x}, ${z})`)
  const q = parseInt(f[col.quarto], 10)
  const b = parseInt(f[col.quarteirao], 10)
  const l = parseInt(f[col.lote], 10)
  const esperado = `S${String(s + 1).padStart(2, '0')}-Q${String(q).padStart(2, '0')}-B${String(b).padStart(3, '0')}-L${String(l).padStart(3, '0')}`
  if (f[col.lot_id] !== esperado) morre(`linha ${i}: lot_id ${f[col.lot_id]} não segue S-Q-B-L (${esperado})`)
  if (q > 31 || b > 511 || l > 511) morre(`linha ${i}: q=${q} b=${b} l=${l} não cabe nos bits do índice`)
  // a área do registro é round(frente×fundo) em precisão cheia; o .bin tem
  // decímetro e por isso erra até 11 m². Guardamos a diferença, 1 byte.
  const areaBin = Math.round((w10 / 10) * (d10 / 10))
  const delta = parseInt(f[col.area_m2], 10) - areaBin
  if (delta < -128 || delta > 127) morre(`linha ${i}: delta de área ${delta} fora de int8`)
  deltaMin = Math.min(deltaMin, delta)
  deltaMax = Math.max(deltaMax, delta)
  // bits 0-8 lote, 9-17 quarteirão, 18-22 quarto, 23-30 delta+128, 31 livre
  const palavra = (l & 511) | ((b & 511) << 9) | ((q & 31) << 18) | (((delta + 128) & 255) << 23)
  indice.writeUInt32LE(palavra >>> 0, CAB + i * 4)
}
writeFileSync(join(SAIDA, 'lotes-indice.bin'), indice)
console.log(`lotes-indice.bin: ${n} lotes, ${indice.length} bytes, delta de área [${deltaMin}, ${deltaMax}]`)

// ── 2. o chão: relevo sombreado e máscara de água ──────────────────────────
const sup = JSON.parse(readFileSync(p('data', 'superficie.json'), 'utf8'))
const supBuf = readFileSync(p('data', 'superficie.f32'))
const shaSup = sha(supBuf)
if (sup.digitalDoChao && sup.digitalDoChao !== shaSup)
  console.warn(`aviso: superficie.f32 (${shaSup.slice(0, 12)}) difere da digitalDoChao em superficie.json (${sup.digitalDoChao.slice(0, 12)})`)
const N = sup.n
const R = sup.raio
const CEL = (2 * R) / (N - 1)
if (supBuf.length !== N * N * 4) morre(`superficie.f32 tem ${supBuf.length} bytes, esperava ${N * N * 4}`)
// Buffer do readFileSync pode vir com byteOffset não múltiplo de 4: copia.
const alt = new Float32Array(N * N)
for (let k = 0; k < N * N; k++) alt[k] = supBuf.readFloatLE(k * 4)
// ⚠️ A GRADE É LINHA POR LINHA (j*N+i), i é x e j é z. Conferido em 23/09
// contra a cota gravada de 100 lotes: mediana de 0,5 m nesta ordem, 68 m na
// transposta.
const h = (i, j) => alt[j * N + i]
const hEm = (x, z) => {
  const i = Math.max(0, Math.min(N - 1, Math.round((x + R) / CEL)))
  const j = Math.max(0, Math.min(N - 1, Math.round((z + R) / CEL)))
  return h(i, j)
}

// ⚠️ ÁGUA É TUDO ABAIXO DE -40 M (lâmina única, cidade.json/malha "lagos.cota").
// Os canais radiais têm cota -40,0 cravada e um limiar `< -40` os deixaria
// secos; por isso a folga de 10 cm. As sondas abaixo imprimem o que o chão diz
// no eixo dos três canais e no centro da baía, para o limiar ser conferível.
const NIVEL_AGUA = -39.9
// ⚠️ E SÓ DENTRO DA CASCA. Fora de r 9.050 (mapa-v1 terraplenagem.casca.r) o
// chão é o relevo lunar cru, que desce a -318 m sem ser lago nenhum; aplicar a
// lâmina lá afogava 30% do recorte. Medido em 23/09 na primeira rodada.
const R_CASCA = 9050
const ehAgua = (x, z, hc) => hc < NIVEL_AGUA && Math.hypot(x, z) <= R_CASCA
for (const c of [[25, 3000], [55, 2500], [85, 3500]]) {
  const a = (c[0] * Math.PI) / 180
  console.log(`sonda canal rumo ${c[0]} r ${c[1]}: cota ${hEm(Math.sin(a) * c[1], -Math.cos(a) * c[1]).toFixed(2)} m`)
}
console.log(`sonda baía (4835,-3661): ${hEm(4835, -3661).toFixed(2)} m; praça (0,0): ${hEm(0, 0).toFixed(2)} m; lago da praça (811,-515): ${hEm(811, -515).toFixed(2)} m`)

// recorte do fundo: ±9.600 m, 1.280 células, resolução nativa (não há o que
// ganhar reamostrando para 2.048: a fonte tem 15 m)
const I0 = 160
const NF = 1280
const X0 = -R + I0 * CEL           // centro da primeira célula do recorte
const rgb = Buffer.alloc(NF * NF * 3)
// luz de noroeste, 45° de altura, relevo exagerado 3x: o sítio tem 1 km de
// desnível em 24 km e sem exagero o sombreado some no escuro do mapa
const LUZ = [-Math.SQRT1_2 * Math.cos(Math.PI / 4), -Math.SQRT1_2 * Math.cos(Math.PI / 4), Math.sin(Math.PI / 4)]
const EXAG = 3
const mix = (a, b, t) => a + (b - a) * t
let celulasAgua = 0
let hMin = Infinity, hMax = -Infinity
for (let j = 0; j < NF; j++) {
  for (let i = 0; i < NF; i++) {
    const gi = I0 + i, gj = I0 + j
    const hc = h(gi, gj)
    if (hc < hMin) hMin = hc
    if (hc > hMax) hMax = hc
    const o = (j * NF + i) * 3
    const wx = X0 + i * CEL, wz = X0 + j * CEL
    const foraDaCasca = Math.hypot(wx, wz) > R_CASCA
    if (ehAgua(wx, wz, hc)) {
      celulasAgua++
      // água: azul fundo, mais escura quanto mais funda (a baía chega a -180)
      const t = Math.max(0, Math.min(1, (NIVEL_AGUA - hc) / 120))
      rgb[o] = Math.round(mix(0x12, 0x08, t))
      rgb[o + 1] = Math.round(mix(0x2a, 0x16, t))
      rgb[o + 2] = Math.round(mix(0x3c, 0x24, t))
      continue
    }
    const dx = (h(Math.min(N - 1, gi + 1), gj) - h(Math.max(0, gi - 1), gj)) / (2 * CEL) * EXAG
    const dz = (h(gi, Math.min(N - 1, gj + 1)) - h(gi, Math.max(0, gj - 1))) / (2 * CEL) * EXAG
    const nl = 1 / Math.hypot(dx, dz, 1)
    const sombra = Math.max(0, (-dx * LUZ[0] - dz * LUZ[1] + LUZ[2]) * nl)
    // base do plot-map escuro: quase preto no vale, cinza quente na crista
    let t = Math.max(0, Math.min(1, sombra * 0.85 + 0.15 * Math.max(0, Math.min(1, (hc + 60) / 400))))
    // fora da casca o relevo continua legível, só mais apagado: é o que diz
    // "aqui acaba a cidade" sem desenhar uma linha
    if (foraDaCasca) t *= 0.55
    rgb[o] = Math.round(mix(0x13, 0x3a, t))
    rgb[o + 1] = Math.round(mix(0x12, 0x36, t))
    rgb[o + 2] = Math.round(mix(0x13, 0x31, t))
  }
}
console.log(`fundo: ${NF}x${NF}, cota de ${hMin.toFixed(1)} a ${hMax.toFixed(1)} m, água em ${((celulasAgua / (NF * NF)) * 100).toFixed(2)}% do recorte`)
await sharp(rgb, { raw: { width: NF, height: NF, channels: 3 } })
  .webp({ quality: 80, effort: 5 })
  .toFile(join(SAIDA, 'fundo.webp'))
// prévia PNG para conferência humana, fora do repositório (--previa=/caminho.png)
const previa = process.argv.find((a) => a.startsWith('--previa='))
if (previa) await sharp(rgb, { raw: { width: NF, height: NF, channels: 3 } }).png().toFile(previa.slice(9))

// máscara de água: 512×512 bits sobre ±9.600 m (37,5 m por célula), amostra
// no centro da célula. É para cortar via, não para desenhar margem.
const NA = 512
const EXT = 9600
const agua = Buffer.alloc(12 + (NA * NA) / 8)
agua.write('DCAG', 0, 'ascii')
agua.writeUInt16LE(NA, 4)
agua.writeUInt16LE(0, 6)
agua.writeFloatLE(EXT, 8)
let bitsAgua = 0
for (let j = 0; j < NA; j++) {
  for (let i = 0; i < NA; i++) {
    const x = -EXT + ((i + 0.5) * 2 * EXT) / NA
    const z = -EXT + ((j + 0.5) * 2 * EXT) / NA
    if (ehAgua(x, z, hEm(x, z))) {
      const k = j * NA + i
      agua[12 + (k >> 3)] |= 1 << (k & 7)
      bitsAgua++
    }
  }
}
writeFileSync(join(SAIDA, 'agua.bin'), agua)
console.log(`agua.bin: ${agua.length} bytes, ${bitsAgua} células de água`)

// ── 3. o selo ──────────────────────────────────────────────────────────────
const selo = {
  versao: 1,
  geradoEm: new Date().toISOString(),
  nota: 'derivados do registro selado para /city/mapa; gerado por scripts/city/mapa/gerar-derivados.mjs',
  bloco: merkle.bloco,
  merkleRoot: merkle.root,
  lotes: merkle.lotes,
  lapides: merkle.lapides,
  carteiras: cidade.carteiras,
  registroVersao: cidade.registroVersao,
  fontes: {
    'public/city/cidade-lotes.bin': shaBin,
    'data/dogcity_lotes.csv': shaCsv,
    'data/superficie.f32': shaSup,
    'data/dogcity_merkle.json': sha(readFileSync(p('data', 'dogcity_merkle.json'))),
  },
  indice: { arquivo: 'lotes-indice.bin', cabecalhoBytes: CAB, registroBytes: 4, lotes: n,
            esquema: 'uint32 LE: bits 0-8 lote, 9-17 quarteirao, 18-22 quarto, 23-30 (area_csv - round(frente*fundo)) + 128' },
  fundo: { arquivo: 'fundo.webp', n: NF, x0: X0, z0: X0, celula: CEL, nivelAgua: NIVEL_AGUA, rCasca: R_CASCA,
           nota: 'pixel (i,j) cobre o mundo [x0 + (i-0,5)·celula, x0 + (i+0,5)·celula]; x leste, z sul' },
  agua: { arquivo: 'agua.bin', n: NA, extensao: EXT, cabecalhoBytes: 12 },
}
writeFileSync(join(SAIDA, 'selo.json'), JSON.stringify(selo, null, 1) + '\n')
console.log(`selo.json: bloco ${selo.bloco}, root ${selo.merkleRoot.slice(0, 16)}…, ${selo.lotes} lotes, ${selo.carteiras} carteiras, ${selo.lapides} lápides`)

// diagnóstico das peças sem polígono (o mapa desenha retângulo/elipse delas)
const semPoly = cidade.programa.filter((q) => !q.poly)
console.log(`programa: ${cidade.programa.length} peças, ${semPoly.length} sem poly: ` +
  semPoly.map((q) => `${q.id}(${q.forma ?? '?'} a=${q.a} b=${q.b} rot=${q.rot})`).join(' '))
