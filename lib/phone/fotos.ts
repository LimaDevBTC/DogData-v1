// DOG PHONE: as fotos da Câmera (regras na migração 048). A foto é um JPEG que o jogo tirou de um quadro dele mesmo; o
// servidor NÃO confia nisso: confere a estrutura do arquivo, as medidas e o tamanho, tira todo metadado (EXIF, comentários,
// perfis) e só então grava no bucket privado. O arquivo só sai pelo servidor, para a dona da foto.
import { randomUUID } from 'node:crypto'
import { lerIdMensagem } from './rules'
import { contaDe, type Falha, type PhoneDeps } from './service'

/** Onde os arquivos moram. Em produção: Supabase Storage (deps.ts). Na prova: memória. */
export interface Armazem {
  gravar(caminho: string, bytes: Uint8Array): Promise<void>
  ler(caminho: string): Promise<Uint8Array | null>
  apagar(caminho: string): Promise<void>
}

export const BUCKET_FOTOS = 'dogcity-phone-photos'
export const LIMITES_FOTO = { bytes: 600_000, ladoMin: 64, ladoMax: 1600, dia: 60, total: 300, pagina: 30 } as const

export interface Foto {
  id: number
  at: string
  w: number
  h: number
  kind: 'front' | 'selfie'
}

/**
 * Confere que os bytes são um JPEG inteiro e devolve o MESMO desenho sem metadado: ficam só os segmentos que a imagem
 * precisa (JFIF, tabelas, cabeçalho do quadro e os dados); APP1..APP15 (EXIF, XMP, ICC, miniaturas) e comentários saem.
 */
export function limparJpeg(b: Uint8Array): { ok: true; bytes: Uint8Array; w: number; h: number } | Falha {
  const n = b.length
  if (n < 128 || n > LIMITES_FOTO.bytes) return { ok: false, why: n > LIMITES_FOTO.bytes ? 'too_big' : 'not_jpeg' }
  if (b[0] !== 0xff || b[1] !== 0xd8 || b[n - 2] !== 0xff || b[n - 1] !== 0xd9) return { ok: false, why: 'not_jpeg' }
  const partes: Uint8Array[] = [b.subarray(0, 2)]
  let w = 0
  let h = 0
  let i = 2
  for (let guarda = 0; guarda < 200; guarda++) {
    if (i + 4 > n || b[i] !== 0xff) return { ok: false, why: 'not_jpeg' }
    const m = b[i + 1]!
    if (m === 0xff) {
      i++ // enchimento entre segmentos
      continue
    }
    const tam = (b[i + 2]! << 8) | b[i + 3]!
    if (tam < 2 || i + 2 + tam > n) return { ok: false, why: 'not_jpeg' }
    if (m === 0xda) {
      // início dos dados: daqui até o fim vai como está (os dados não carregam metadado)
      if (!w || !h) return { ok: false, why: 'not_jpeg' }
      partes.push(b.subarray(i))
      break
    }
    const quadro = m === 0xc0 || m === 0xc1 || m === 0xc2
    if (quadro) {
      if (tam < 8) return { ok: false, why: 'not_jpeg' }
      h = (b[i + 5]! << 8) | b[i + 6]!
      w = (b[i + 7]! << 8) | b[i + 8]!
    }
    const fica = quadro || m === 0xdb || m === 0xc4 || m === 0xdd || m === 0xe0
    const aceito = fica || (m >= 0xe1 && m <= 0xef) || m === 0xfe
    if (!aceito) return { ok: false, why: 'not_jpeg' }
    if (fica) partes.push(b.subarray(i, i + 2 + tam))
    i += 2 + tam
  }
  if (partes.length < 2 || !w || !h) return { ok: false, why: 'not_jpeg' }
  if (w < LIMITES_FOTO.ladoMin || h < LIMITES_FOTO.ladoMin || w > LIMITES_FOTO.ladoMax || h > LIMITES_FOTO.ladoMax) return { ok: false, why: 'bad_size' }
  const total = partes.reduce((s, p) => s + p.length, 0)
  const limpo = new Uint8Array(total)
  let o = 0
  for (const p of partes) {
    limpo.set(p, o)
    o += p.length
  }
  return { ok: true, bytes: limpo, w, h }
}

const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null)

function foto(v: unknown): Foto | null {
  const o = obj(v)
  const id = lerIdMensagem(o?.id)
  if (!o || !id) return null
  return { id, at: String(o.at ?? ''), w: Number(o.w) || 0, h: Number(o.h) || 0, kind: o.kind === 'selfie' ? 'selfie' : 'front' }
}

/** POST /api/dogcity/phone/photos (corpo: o JPEG; ?kind=front|selfie) */
export async function guardarFoto(deps: PhoneDeps, arm: Armazem, address: string, bruto: Uint8Array, kind: unknown): Promise<{ ok: true; photo: Foto } | Falha> {
  const me = await contaDe(deps, address)
  const limpo = limparJpeg(bruto)
  if (!limpo.ok) return limpo
  const tipo = kind === 'selfie' ? 'selfie' : 'front'
  // o caminho não diz nada sobre a carteira: a conta (uuid interno) e um nome sorteado
  const caminho = `${me}/${randomUUID()}.jpg`
  await arm.gravar(caminho, limpo.bytes)
  const r = obj(await deps.rpc('dogcity_phone_photo_add', { p_me: me, p_path: caminho, p_bytes: limpo.bytes.length, p_w: limpo.w, p_h: limpo.h, p_kind: tipo, p_cap_day: LIMITES_FOTO.dia, p_cap_total: LIMITES_FOTO.total }))
  const id = lerIdMensagem(r?.id)
  if (r?.status !== 'ok' || !id) {
    // o registro não entrou (teto): o arquivo não fica órfão no bucket
    await arm.apagar(caminho).catch(() => undefined)
    return { ok: false, why: r?.status === 'cap_day' || r?.status === 'cap_total' ? r.status : 'failed' }
  }
  return { ok: true, photo: { id, at: new Date().toISOString(), w: limpo.w, h: limpo.h, kind: tipo } }
}

/** GET /api/dogcity/phone/photos?before= */
export async function listarFotos(deps: PhoneDeps, address: string, before: unknown): Promise<{ ok: true; photos: Foto[]; more: boolean } | Falha> {
  const me = await contaDe(deps, address)
  const antes = before === null || before === undefined || before === '' ? null : lerIdMensagem(before)
  if (before && !antes) return { ok: false, why: 'invalid_id' }
  const r = await deps.rpc('dogcity_phone_photo_list', { p_me: me, p_before: antes, p_limit: LIMITES_FOTO.pagina + 1 })
  const todas = (Array.isArray(r) ? r : []).flatMap((x: unknown) => {
    const f = foto(x)
    return f ? [f] : []
  })
  return { ok: true, photos: todas.slice(0, LIMITES_FOTO.pagina), more: todas.length > LIMITES_FOTO.pagina }
}

/** GET /api/dogcity/phone/photos/<id>: os bytes, para a dona ou para quem pode ver o post em que a foto está (048) */
export async function lerFoto(deps: PhoneDeps, arm: Armazem, address: string, id: unknown): Promise<{ ok: true; bytes: Uint8Array } | Falha> {
  const me = await contaDe(deps, address)
  const n = lerIdMensagem(id)
  if (!n) return { ok: false, why: 'invalid_id' }
  const caminho = await deps.rpc('dogcity_phone_photo_path', { p_me: me, p_id: n })
  if (typeof caminho !== 'string' || !caminho) return { ok: false, why: 'not_found' }
  const bytes = await arm.ler(caminho)
  return bytes ? { ok: true, bytes } : { ok: false, why: 'not_found' }
}

/** POST /api/dogcity/phone/photos { action: delete, id } */
export async function apagarFoto(deps: PhoneDeps, arm: Armazem, address: string, id: unknown): Promise<{ ok: true; id: number } | Falha> {
  const me = await contaDe(deps, address)
  const n = lerIdMensagem(id)
  if (!n) return { ok: false, why: 'invalid_id' }
  const caminho = await deps.rpc('dogcity_phone_photo_delete', { p_me: me, p_id: n })
  if (typeof caminho !== 'string' || !caminho) return { ok: false, why: 'not_found' }
  await arm.apagar(caminho).catch(() => undefined)
  return { ok: true, id: n }
}
