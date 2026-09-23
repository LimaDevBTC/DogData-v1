#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// GERA `public/city/escrituras.bin`: o índice endereço -> posição do lote.
//
// POR QUE EXISTE. A rota /api/dogcity/lookup lê `dog_snapshot_lookup` no
// Supabase, e aquela tabela tem só as sete colunas públicas (dog, area_m2,
// destino, genesis, runestones, utxo_count, bloco). Nada de posição. O holder
// sabia quantos metros tinha e não sabia onde. Este arquivo é a posição, lida
// do REGISTRO SELADO (data/dogcity_lotes.csv e data/dogcity_cemiterio.csv),
// servida pelo próprio app. Nunca por banco: a cidade está fechada e a única
// fonte da verdade sobre onde cada lote fica é o CSV que o merkle root sela.
//
// ⚠️ ESTE SCRIPT SÓ LÊ OS CSVs. Ele não regenera cidade nenhuma e não escreve
// em `data/`. Quem muda o CSV é `scripts/gerar_cidade.py`, e só o fundador roda.
// Se o CSV mudar, roda-se este script de novo e o .bin acompanha.
//
// FORMATO (little-endian, sem dependência, lido por lib/city/escrituras.ts):
//   cabeçalho, 16 bytes: "DOGESCR1" (8), uint32 n, uint16 bytesPorRegistro (36),
//                        uint16 versão (1)
//   registro, 36 bytes, ORDENADO por (hi, lo) para busca binária:
//     0  uint32 hi     bytes 0-3 do sha256(address), lidos como big-endian
//     4  uint32 lo     bytes 4-7 idem
//     8  uint32 chk    bytes 8-11 idem (confere o acerto: 96 bits de chave)
//    12  uint8  kind   1 = lote, 2 = lápide
//    13  uint8  setor  1..9 (lote) / 0
//    14  uint8  quarto (lote) / 0
//    15  uint8  forma  0..4 (lote, `forma_de` do gerador) / 0
//    16  uint16 quarteirão (lote) / 0
//    18  uint16 lote (lote) / número da lápide (lápide)
//    20  int32  x em CENTÍMETROS (x leste)
//    24  int32  z em CENTÍMETROS (z sul)
//    28  uint32 área em m² (lote; o CSV só tem inteiros, conferido) / 0
//    32  int16  cota em DECÍMETROS
//    34  uint8  flags: bit0 = DSC
//    35  uint8  reservado (0)
//
// POR QUE HASH E NÃO O ENDEREÇO. 86.511 endereços de até 62 caracteres são
// 5,3 MB só de chave; 12 bytes de sha256 dão 96 bits, e a chance de um endereço
// qualquer bater num registro que não é dele é da ordem de 1e-24. A rota
// calcula o mesmo sha256 e faz busca binária em ~17 passos sem alocar nada.
//
// ⚠️ ENDEREÇO `__projeto_*` FICA DE FORA. São os 693 lotes de projeto da Orla
// (sem dono), e a rota rejeita esse texto antes de consultar qualquer coisa:
// guardá-los seria prometer busca por uma chave que nunca chega.
//
// ⚠️ REGISTRO v3 (retângulo) OU v4 (4 cantos, masterplan §41): ESTE ARQUIVO NÃO
// PRECISA SABER A DIFERENÇA. Ele só lê x_m, z_m, area_m2, cota_m, setor, quarto,
// quarteirao, lote, forma e dsc, que existem com o mesmo nome nos dois formatos
// (no v4, x_m/z_m viram centróide e area_m2 vira a área exata do polígono, mas
// continuam sendo colunas numéricas normais). As nove colunas novas do v4
// (p0x_m…p3z_m, geo) ficam nas linhas lidas e nunca são usadas aqui: quem quiser
// o polígono lê o CSV, não este índice.
//
// USO: node scripts/city/gerar_escrituras.mjs
//      [--csv=ARQ] [--cemiterio=ARQ] [--merkle=ARQ] [--saida=DIR]
// Sem opções, os quatro caminhos são os de sempre (data/ e public/city/ na raiz
// do repositório). Cada opção sobrepõe UM caminho, relativo à raiz do
// repositório (ou absoluto) — é assim que se aponta para
// `public/city/_v4teste/` sem escrever em cima do `public/city/escrituras.bin`
// de produção: `--saida=` manda o .bin e o .json de teste para outro lugar.
// ═══════════════════════════════════════════════════════════════════════════

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

// caminho por opção (--chave=valor), relativo à RAIZ (ou absoluto); sem a
// opção, cai no padrão de sempre.
function opcao(chave, padrao) {
  const achado = process.argv.slice(2).find((a) => a.startsWith(`--${chave}=`))
  if (!achado) return padrao
  const v = achado.slice(chave.length + 3)
  return path.isAbsolute(v) ? v : path.join(RAIZ, v)
}

const LOTES = opcao('csv', path.join(RAIZ, 'data', 'dogcity_lotes.csv'))
const CEMITERIO = opcao('cemiterio', path.join(RAIZ, 'data', 'dogcity_cemiterio.csv'))
const MERKLE = opcao('merkle', path.join(RAIZ, 'data', 'dogcity_merkle.json'))
const SAIDA_DIR = opcao('saida', path.join(RAIZ, 'public', 'city'))
const SAIDA_BIN = path.join(SAIDA_DIR, 'escrituras.bin')
const SAIDA_JSON = path.join(SAIDA_DIR, 'escrituras.json')

const MAGIC = 'DOGESCR1'
const CAB = 16
const REG = 36
const VERSAO = 1
const KIND_LOTE = 1
const KIND_LAPIDE = 2

// ── CSV mínimo, com aspas, sem dependência ─────────────────────────────────
// O campo `direito` do cemitério tem texto livre; hoje sem vírgula, mas um
// parser que só faz split(',') morreria calado no dia em que ganhasse uma.
function lerCsv(caminho) {
  const texto = readFileSync(caminho, 'utf8')
  const linhas = []
  let campo = '', linha = [], aspas = false
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i]
    if (aspas) {
      if (c === '"') {
        if (texto[i + 1] === '"') { campo += '"'; i++ } else aspas = false
      } else campo += c
    } else if (c === '"') aspas = true
    else if (c === ',') { linha.push(campo); campo = '' }
    else if (c === '\n') { linha.push(campo); linhas.push(linha); linha = []; campo = '' }
    else if (c !== '\r') campo += c
  }
  if (campo.length || linha.length) { linha.push(campo); linhas.push(linha) }
  const cab = linhas.shift()
  return linhas.filter((l) => l.length > 1 || l[0] !== '').map((l) => {
    const o = {}
    cab.forEach((k, i) => { o[k] = l[i] })
    return o
  })
}

// mesma normalização da rota: bech32 é canonicamente minúsculo, base58 não se toca
const normaliza = (a) => (a.toLowerCase().startsWith('bc1') ? a.toLowerCase() : a)

function chave(address) {
  const d = createHash('sha256').update(normaliza(address)).digest()
  return { hi: d.readUInt32BE(0), lo: d.readUInt32BE(4), chk: d.readUInt32BE(8) }
}

const pad = (n, w) => String(n).padStart(w, '0')
const lotIdDe = (s, q, b, l) => `S${pad(s, 2)}-Q${pad(q, 2)}-B${pad(b, 3)}-L${pad(l, 3)}`

// ── lê os dois registros ───────────────────────────────────────────────────
// ⚠️ SÓ O CSV SELADO ENTRA. data/dogcity_merkle.json grava o sha256 dos dois
// arquivos no momento do selo; se o CSV em disco não bater, alguém mexeu nele
// depois do merkle root e este índice mentiria sobre a cidade publicada.
const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex')
const merkle = existsSync(MERKLE) ? JSON.parse(readFileSync(MERKLE, 'utf8')) : null
for (const [rel, abs] of [['data/dogcity_lotes.csv', LOTES], ['data/dogcity_cemiterio.csv', CEMITERIO]]) {
  const selo = merkle?.selos?.[rel]
  if (selo && selo !== sha(abs)) throw new Error(`${rel} não é o arquivo selado pelo merkle root (${merkle.root}); não gravo`)
}
const lotes = lerCsv(LOTES)
const lapides = lerCsv(CEMITERIO)

// ⚠️ LAÇO COM CONTADOR POR MOTIVO (feedback_laco_sem_contador_e_cego): toda
// linha que não entra é contada pelo motivo, e no fim a soma tem de fechar.
const rejeitados = { projeto: 0, lot_id_diverge: 0, duplicado: 0, fora_da_faixa: 0 }
const vistos = new Map()   // `${hi}:${lo}` -> address, para acusar colisão/duplicata
const registros = []

function empurra(address, campos) {
  const k = chave(address)
  const id = `${k.hi}:${k.lo}`
  if (vistos.has(id)) {
    // ou o endereço aparece duas vezes (não deveria: um lote por carteira) ou
    // dois endereços diferentes colidem em 64 bits (não deveria acontecer nunca).
    rejeitados.duplicado++
    console.error(`duplicado/colisão: ${address} contra ${vistos.get(id)}`)
    return
  }
  vistos.set(id, address)
  registros.push({ ...k, ...campos })
}

for (const r of lotes) {
  if (r.address.startsWith('__')) { rejeitados.projeto++; continue }
  const setor = +r.setor, quarto = +r.quarto, quarteirao = +r.quarteirao, lote = +r.lote
  if (lotIdDe(setor, quarto, quarteirao, lote) !== r.lot_id) {
    // o formato do lot_id é reconstruído pela rota a partir dos quatro inteiros;
    // se o CSV mudar de padrão (mais dígitos, outro prefixo), este é o alarme.
    rejeitados.lot_id_diverge++
    console.error(`lot_id fora do padrão: ${r.lot_id}`)
    continue
  }
  const x = Math.round(+r.x_m * 100), z = Math.round(+r.z_m * 100)
  // ⚠️ AREA ARREDONDA, NÃO EXIGE INTEIRO. No registro v3 `area_m2` já saía
  // inteiro do gerador; no v4 (masterplan §41) ela vira "a área exata do
  // polígono" (shoelace dos cantos selados), que pode ter casas decimais. O
  // campo do índice continua uint32 em m² inteiros (documentado em `esquema`
  // abaixo), então quem arredonda é aqui, uma vez, em vez de o CSV ter de
  // mentir sendo inteiro para este leitor não rejeitar a linha.
  const area = Math.round(+r.area_m2), cota = Math.round(+r.cota_m * 10), forma = +r.forma
  if (
    setor < 1 || setor > 255 || quarto < 0 || quarto > 255 || quarteirao > 65535 || lote > 65535 ||
    forma < 0 || forma > 7 || !Number.isFinite(area) || area < 0 || area > 0xffffffff ||
    Math.abs(x) > 0x7fffffff || Math.abs(z) > 0x7fffffff || Math.abs(cota) > 0x7fff
  ) { rejeitados.fora_da_faixa++; console.error(`fora da faixa: ${r.lot_id}`); continue }
  empurra(r.address, {
    kind: KIND_LOTE, setor, quarto, forma, quarteirao, lote, x, z, area, cota,
    flags: r.dsc === '1' ? 1 : 0,
  })
}

for (const r of lapides) {
  const n = +r.lapide.replace(/^L/, '')
  if (!Number.isInteger(n) || n < 1 || n > 65535) { rejeitados.fora_da_faixa++; continue }
  const x = Math.round(+r.x_m * 100), z = Math.round(+r.z_m * 100)
  // o cemitério não grava cota; o Campo do Columbário está no platô do pódio,
  // e a rota devolve 0 aqui e não finge precisão que o registro não tem.
  empurra(r.address, { kind: KIND_LAPIDE, setor: 0, quarto: 0, forma: 0, quarteirao: 0, lote: n, x, z, area: 0, cota: 0, flags: 0 })
}

const somaRejeitados = Object.values(rejeitados).reduce((a, b) => a + b, 0)
if (registros.length + somaRejeitados !== lotes.length + lapides.length) {
  throw new Error(`contagem não fecha: ${registros.length} + ${somaRejeitados} != ${lotes.length + lapides.length}`)
}
if (rejeitados.duplicado || rejeitados.lot_id_diverge || rejeitados.fora_da_faixa) {
  throw new Error(`registro com defeito, não gravo: ${JSON.stringify(rejeitados)}`)
}

// ── ordena e grava ─────────────────────────────────────────────────────────
registros.sort((a, b) => (a.hi - b.hi) || (a.lo - b.lo))

const buf = Buffer.alloc(CAB + REG * registros.length)
buf.write(MAGIC, 0, 'ascii')
buf.writeUInt32LE(registros.length, 8)
buf.writeUInt16LE(REG, 12)
buf.writeUInt16LE(VERSAO, 14)
registros.forEach((r, i) => {
  const o = CAB + i * REG
  buf.writeUInt32LE(r.hi, o)
  buf.writeUInt32LE(r.lo, o + 4)
  buf.writeUInt32LE(r.chk, o + 8)
  buf.writeUInt8(r.kind, o + 12)
  buf.writeUInt8(r.setor, o + 13)
  buf.writeUInt8(r.quarto, o + 14)
  buf.writeUInt8(r.forma, o + 15)
  buf.writeUInt16LE(r.quarteirao, o + 16)
  buf.writeUInt16LE(r.lote, o + 18)
  buf.writeInt32LE(r.x, o + 20)
  buf.writeInt32LE(r.z, o + 24)
  buf.writeUInt32LE(r.area, o + 28)
  buf.writeInt16LE(r.cota, o + 32)
  buf.writeUInt8(r.flags, o + 34)
  buf.writeUInt8(0, o + 35)
})
writeFileSync(SAIDA_BIN, buf)

// ── prova de leitura: busca binária igual à da rota, sobre o que foi gravado ─
function busca(address) {
  const k = chave(address)
  const n = buf.readUInt32LE(8)
  let a = 0, b = n - 1
  while (a <= b) {
    const m = (a + b) >>> 1
    const o = CAB + m * REG
    const hi = buf.readUInt32LE(o), lo = buf.readUInt32LE(o + 4)
    if (hi < k.hi || (hi === k.hi && lo < k.lo)) a = m + 1
    else if (hi > k.hi || (hi === k.hi && lo > k.lo)) b = m - 1
    else return buf.readUInt32LE(o + 8) === k.chk ? o : -1
  }
  return -1
}
let conferidos = 0
const amostra = [...lotes.filter((r) => !r.address.startsWith('__')).filter((_, i) => i % 997 === 0), ...lapides.filter((_, i) => i % 991 === 0)]
for (const r of amostra) {
  const o = busca(r.address)
  if (o < 0) throw new Error(`prova falhou: ${r.address} não achado`)
  const x = buf.readInt32LE(o + 20) / 100, z = buf.readInt32LE(o + 24) / 100
  if (Math.abs(x - +r.x_m) > 0.006 || Math.abs(z - +r.z_m) > 0.006) throw new Error(`prova falhou: coordenada de ${r.address}`)
  if (r.lot_id) {
    const id = lotIdDe(buf.readUInt8(o + 13), buf.readUInt8(o + 14), buf.readUInt16LE(o + 16), buf.readUInt16LE(o + 18))
    // ⚠️ COMPARA ARREDONDADO, NÃO IGUAL. `area_m2` do v4 pode ter casas
    // decimais (nota acima, na gravação); o campo do índice é inteiro, então
    // a prova tem de refazer o MESMO arredondamento em vez de exigir bater
    // igual a um float que o índice nunca prometeu guardar exato.
    if (id !== r.lot_id || buf.readUInt32LE(o + 28) !== Math.round(+r.area_m2)) throw new Error(`prova falhou: ${r.lot_id}`)
  } else if (buf.readUInt8(o + 12) !== KIND_LAPIDE || `L${pad(buf.readUInt16LE(o + 18), 5)}` !== r.lapide) {
    throw new Error(`prova falhou: ${r.lapide}`)
  }
  conferidos++
}
for (const falso of ['bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4', '1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2', '3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy']) {
  if (busca(falso) >= 0) throw new Error(`prova falhou: ${falso} achado sem estar no registro`)
}

// ── metadados para quem quiser conferir sem abrir o binário ────────────────
const meta = {
  versao: VERSAO,
  geradoEm: new Date().toISOString(),
  nota: 'índice endereço -> posição, lido do registro selado; gerado por scripts/city/gerar_escrituras.mjs, lido por lib/city/escrituras.ts',
  fontes: {
    lotes: { arquivo: 'data/dogcity_lotes.csv', linhas: lotes.length, sha256: sha(LOTES) },
    cemiterio: { arquivo: 'data/dogcity_cemiterio.csv', linhas: lapides.length, sha256: sha(CEMITERIO) },
    merkleRoot: merkle?.root ?? null,
    bloco: merkle?.bloco ?? null,
  },
  registros: {
    total: registros.length,
    lotes: registros.filter((r) => r.kind === KIND_LOTE).length,
    lapides: registros.filter((r) => r.kind === KIND_LAPIDE).length,
    excluidos: rejeitados,
  },
  bin: { arquivo: 'public/city/escrituras.bin', bytes: buf.length, cabecalhoBytes: CAB, registroBytes: REG, sha256: createHash('sha256').update(buf).digest('hex') },
  chave: 'sha256(address normalizado: bc1 em minúsculas, base58 intacto); hi = bytes 0-3 BE, lo = 4-7 BE, chk = 8-11 BE; registros ordenados por (hi, lo)',
  esquema: 'uint32 hi, uint32 lo, uint32 chk, uint8 kind(1 lote, 2 lápide), uint8 setor, uint8 quarto, uint8 forma, uint16 quarteirão, uint16 lote|lápide, int32 x_cm, int32 z_cm, uint32 area_m2, int16 cota_dm, uint8 flags(bit0 DSC), uint8 reservado',
  formas: { 0: 'massa única', 1: 'pátio/geminada', 2: 'condomínio baixo', 3: 'torre', 4: 'quarteirão com várias torres' },
}
writeFileSync(SAIDA_JSON, JSON.stringify(meta, null, 1) + '\n')

console.log(`escrituras: ${registros.length} registros (${meta.registros.lotes} lotes + ${meta.registros.lapides} lápides), ` +
  `${(buf.length / 1024).toFixed(0)} KiB, excluídos ${JSON.stringify(rejeitados)}, prova de leitura em ${conferidos} amostras + 3 negativos`)
