// ═══════════════════════════════════════════════════════════════════════════
// LEITOR DE `public/city/escrituras.bin`: endereço -> onde o lote fica.
//
// O arquivo é gerado por scripts/city/gerar_escrituras.mjs a partir do registro
// selado (data/dogcity_lotes.csv e data/dogcity_cemiterio.csv). O formato está
// documentado lá e repetido aqui só no que o leitor precisa. Quem mudar um lado
// muda o outro no mesmo commit.
//
// ⚠️ SÓ SERVIDOR (node:fs, node:crypto). Importar isto de um componente cliente
// quebra o bundle. A rota /api/dogcity/lookup é a consumidora.
//
// TRÊS REGRAS DE DEGRADAÇÃO, porque a rota tem de continuar respondendo área e
// destino mesmo sem este arquivo:
//   1. o índice é carregado UMA vez por instância (cache em escopo de módulo) e
//      a leitura é lazy, na primeira consulta;
//   2. se `fs` não achar o arquivo (na Vercel a função só leva o que o rastreio
//      de arquivos incluiu), tenta buscar o mesmo arquivo pela URL pública do
//      próprio app, que é onde `public/` sempre está;
//   3. se as duas falharem, devolve null e GRAVA A HORA da falha: a próxima
//      consulta só tenta de novo depois de RETENTAR_MS, para uma instância com o
//      arquivo faltando não pagar duas leituras falhas por requisição, e uma
//      falha transitória não desligar a posição até o fim da vida da instância.
// ═══════════════════════════════════════════════════════════════════════════

import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'

// caminho público do arquivo (sob /public) e o mesmo caminho na URL
export const ESCRITURAS_PUBLICO = 'city/escrituras.bin'

const MAGIC = 'DOGESCR1'
const CAB = 16
const REG = 36
const VERSAO = 1
const KIND_LOTE = 1
const KIND_LAPIDE = 2
const RETENTAR_MS = 60_000
const FETCH_MS = 4_000

export type Escritura =
  | {
      kind: 'lote'
      lotId: string
      setor: number
      quarto: number
      quarteirao: number
      lote: number
      forma: number
      dsc: boolean
      x_m: number
      z_m: number
      area_m2: number
      cota_m: number
    }
  | { kind: 'lapide'; id: string; n: number; x_m: number; z_m: number }

interface Indice {
  n: number
  dv: DataView
}

let indice: Indice | null = null
let carregando: Promise<Indice | null> | null = null
let falhouEm = 0

function pad(n: number, w: number): string {
  return String(n).padStart(w, '0')
}

// mesmo padrão do CSV: S03-Q12-B004-L017 e L01234
export const lotIdDe = (s: number, q: number, b: number, l: number) =>
  `S${pad(s, 2)}-Q${pad(q, 2)}-B${pad(b, 3)}-L${pad(l, 3)}`
export const lapideIdDe = (n: number) => `L${pad(n, 5)}`

function validar(bytes: Uint8Array): Indice | null {
  if (bytes.byteLength < CAB) return null
  const magic = String.fromCharCode(...bytes.subarray(0, 8))
  if (magic !== MAGIC) return null
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const n = dv.getUint32(8, true)
  const reg = dv.getUint16(12, true)
  const versao = dv.getUint16(14, true)
  if (reg !== REG || versao !== VERSAO) return null
  if (CAB + n * REG !== bytes.byteLength) return null
  return { n, dv }
}

async function lerDoDisco(): Promise<Uint8Array | null> {
  try {
    // ⚠️ CAMINHO LITERAL DE PROPÓSITO: o rastreio de arquivos do Next só segue
    // `path.join(process.cwd(), '<literal>')`. Montar o caminho a partir de uma
    // variável tiraria o arquivo do pacote da função na Vercel sem aviso.
    const b = await readFile(path.join(process.cwd(), 'public', 'city', 'escrituras.bin'))
    return new Uint8Array(b.buffer, b.byteOffset, b.byteLength)
  } catch {
    return null
  }
}

async function lerDaRede(origin: string | null): Promise<Uint8Array | null> {
  if (!origin) return null
  try {
    const r = await fetch(new URL(`/${ESCRITURAS_PUBLICO}`, origin), {
      signal: AbortSignal.timeout(FETCH_MS),
      cache: 'no-store',
    })
    if (!r.ok) return null
    return new Uint8Array(await r.arrayBuffer())
  } catch {
    return null
  }
}

async function carregar(origin: string | null): Promise<Indice | null> {
  const bytes = (await lerDoDisco()) ?? (await lerDaRede(origin))
  return bytes ? validar(bytes) : null
}

/** o índice carregado, ou null se o arquivo não está ao alcance agora */
export function escrituras(origin: string | null): Promise<Indice | null> {
  if (indice) return Promise.resolve(indice)
  if (carregando) return carregando
  if (falhouEm && Date.now() - falhouEm < RETENTAR_MS) return Promise.resolve(null)
  carregando = carregar(origin)
    .then((i) => {
      if (i) indice = i
      else falhouEm = Date.now()
      return i
    })
    .finally(() => {
      carregando = null
    })
  return carregando
}

// mesma normalização da rota e do gerador: bech32 minúsculo, base58 intacto
function normaliza(address: string): string {
  return address.toLowerCase().startsWith('bc1') ? address.toLowerCase() : address
}

/** busca binária por sha256 do endereço; null quando não está no registro */
export function buscarEscritura(ix: Indice, address: string): Escritura | null {
  const d = createHash('sha256').update(normaliza(address)).digest()
  const hi = d.readUInt32BE(0)
  const lo = d.readUInt32BE(4)
  const chk = d.readUInt32BE(8)
  const { dv, n } = ix
  let a = 0
  let b = n - 1
  while (a <= b) {
    const m = (a + b) >>> 1
    const o = CAB + m * REG
    const h = dv.getUint32(o, true)
    const l = dv.getUint32(o + 4, true)
    if (h < hi || (h === hi && l < lo)) a = m + 1
    else if (h > hi || (h === hi && l > lo)) b = m - 1
    else {
      // 64 bits bateram; os 32 de conferência têm de bater também, senão é
      // outro endereço e a resposta certa é "não está", nunca um lote alheio.
      if (dv.getUint32(o + 8, true) !== chk) return null
      return decodificar(dv, o)
    }
  }
  return null
}

function decodificar(dv: DataView, o: number): Escritura | null {
  const kind = dv.getUint8(o + 12)
  const x_m = dv.getInt32(o + 20, true) / 100
  const z_m = dv.getInt32(o + 24, true) / 100
  if (kind === KIND_LAPIDE) {
    const n = dv.getUint16(o + 18, true)
    return { kind: 'lapide', id: lapideIdDe(n), n, x_m, z_m }
  }
  if (kind !== KIND_LOTE) return null
  const setor = dv.getUint8(o + 13)
  const quarto = dv.getUint8(o + 14)
  const forma = dv.getUint8(o + 15)
  const quarteirao = dv.getUint16(o + 16, true)
  const lote = dv.getUint16(o + 18, true)
  return {
    kind: 'lote',
    lotId: lotIdDe(setor, quarto, quarteirao, lote),
    setor,
    quarto,
    quarteirao,
    lote,
    forma,
    dsc: (dv.getUint8(o + 34) & 1) === 1,
    x_m,
    z_m,
    area_m2: dv.getUint32(o + 28, true),
    cota_m: dv.getInt16(o + 32, true) / 10,
  }
}
