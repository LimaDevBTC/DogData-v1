// Leitura de inscrições de um endereço, para a escolha de foto de perfil.
//
// POR QUE NÃO É O NOSSO NÓ: o índice do `ord` daqui tem as 127 milhões de
// inscrições, mas NÃO tem índice por endereço (`--index-addresses` nunca foi
// ligado, e ligar significa reindexar tudo). Perguntar "o que esta carteira
// segura" é justamente a pergunta que ele não responde, então essa parte vem
// de fora. O que vem de fora é só a LISTA: nada aqui concede autoridade, e a
// posse é reconferida no momento de gravar.
//
// Duas fontes, cada uma no que faz melhor:
//   UniSat open-api   lista por endereço + dono atual de uma inscrição (temos token)
//   ordinals.com /r/  metadado público da inscrição (tipo de conteúdo, delegate)

import { redisClient } from '@/lib/upstash'

const UNISAT = 'https://open-api.unisat.io'
const ORD = 'https://ordinals.com'
const TIMEOUT_MS = 8_000

export interface OwnedInscription {
  id: string
  number: number
  contentType: string | null
}

/** ⚠️ O QUE A TELA ACEITA COMO FOTO. Nada que execute código: um `text/html`
 *  desenha no navegador da carteira, mas como foto de perfil ele viraria um
 *  iframe de terceiro em toda página onde o avatar aparece. Imagem é imagem. */
const IMAGE_TYPES = /^image\/(png|jpeg|jpg|gif|webp|avif|svg\+xml)$/i

export function isImageType(contentType: string | null | undefined): boolean {
  return !!contentType && IMAGE_TYPES.test(contentType.split(';')[0].trim())
}

/**
 * SVG é código disfarçado de imagem: dentro de um `<img>` nunca executa nada,
 * mas aberto direto na barra de endereços vira um documento no nosso domínio.
 * Esta é a regra que recusa esse segundo caso. `Sec-Fetch-Dest` é escrito pelo
 * navegador, não pela página, então uma aba não consegue forjá-lo; quando ele
 * não vem (cliente antigo, curl), o pedido não é uma navegação de navegador e
 * o CSP com sandbox da resposta continua sendo a tranca.
 */
export function refuseSvgNavigation(
  contentType: string | null | undefined,
  secFetchDest: string | null | undefined,
): boolean {
  if (!contentType || !/svg/i.test(contentType)) return false
  return !!secFetchDest && secFetchDest !== 'image'
}

/** Formato do id: <txid 64 hex>i<índice>. Validado antes de virar URL. */
export const INSCRIPTION_ID = /^[0-9a-f]{64}i\d{1,5}$/i

async function timedFetch(url: string, init?: RequestInit): Promise<Response> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: ctrl.signal })
  } finally {
    clearTimeout(t)
  }
}

function unisatHeaders(): Record<string, string> {
  const token = process.env.UNISAT_API_TOKEN
  if (!token) throw new Error('UNISAT_API_TOKEN missing')
  return { Authorization: `Bearer ${token}`, 'User-Agent': 'DOG DATA/1.0' }
}

interface UnisatInscriptionRow {
  inscriptionId: string
  inscriptionNumber: number
  contentType?: string
}

/**
 * Inscrições que o endereço segura AGORA, mais recentes primeiro.
 * `size` é o teto por página da UniSat (100); a tela pede bem menos.
 */
export async function listInscriptions(
  address: string,
  cursor = 0,
  size = 40,
): Promise<{ items: OwnedInscription[]; total: number }> {
  const url = `${UNISAT}/v1/indexer/address/${encodeURIComponent(address)}/inscription-data?cursor=${cursor}&size=${Math.min(size, 100)}`
  const res = await timedFetch(url, { headers: unisatHeaders() })
  if (!res.ok) throw new Error(`unisat ${res.status}`)
  const json = await res.json()
  if (json?.code !== 0) throw new Error(`unisat ${json?.msg ?? 'error'}`)

  const rows: any[] = json.data?.inscription ?? []
  const items: OwnedInscription[] = []
  for (const row of rows) {
    // A resposta vem por UTXO: um output pode carregar mais de uma inscrição.
    const nested: UnisatInscriptionRow[] = row?.utxo?.inscriptions ?? []
    for (const ins of nested) {
      if (!ins?.inscriptionId) continue
      items.push({
        id: ins.inscriptionId,
        number: Number(ins.inscriptionNumber ?? 0),
        // ⚠️ VEM VAZIO NA MAIORIA DAS LINHAS. O indexador só preenche em parte
        // dos casos, então quem decide se é imagem é o metadado do ordinals.com.
        contentType: ins.contentType || null,
      })
    }
  }
  return { items, total: Number(json.data?.total ?? items.length) }
}

interface InscriptionMeta {
  contentType: string | null
  number: number | null
  /** Inscrição delegate não carrega conteúdo: a arte mora no delegado. */
  delegate: string | null
}

/**
 * Metadado público de uma inscrição. O conteúdo de uma inscrição é imutável,
 * então cacheia por 30 dias: só o dono muda, e dono não se pergunta aqui.
 */
export async function inscriptionMeta(id: string): Promise<InscriptionMeta | null> {
  if (!INSCRIPTION_ID.test(id)) return null
  const key = `insmeta:${id}`
  try {
    const hit = await redisClient.get<InscriptionMeta>(key)
    if (hit) return hit
  } catch {
    /* cache é otimização, não dependência */
  }

  const res = await timedFetch(`${ORD}/r/inscription/${id}`, {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) return null
  const j = await res.json()

  let contentType: string | null = j?.content_type ?? null
  const delegate: string | null = j?.delegate ?? null
  // Delegate sem tipo próprio: herda o tipo de quem guarda a arte, senão a
  // coleção inteira (que é como quase toda coleção moderna é feita) sumiria
  // da grade por parecer "sem conteúdo".
  if (!contentType && delegate && INSCRIPTION_ID.test(delegate)) {
    const inner = await timedFetch(`${ORD}/r/inscription/${delegate}`, {
      headers: { Accept: 'application/json' },
    })
    if (inner.ok) contentType = (await inner.json())?.content_type ?? null
  }

  const meta: InscriptionMeta = {
    contentType,
    number: typeof j?.number === 'number' ? j.number : null,
    delegate,
  }
  try {
    await redisClient.set(key, meta, { ex: 60 * 60 * 24 * 30 })
  } catch {
    /* idem */
  }
  return meta
}

/** Dono atual, direto do indexador. É a conferência de posse na hora de gravar. */
export async function inscriptionOwner(id: string): Promise<string | null> {
  if (!INSCRIPTION_ID.test(id)) return null
  const res = await timedFetch(`${UNISAT}/v1/indexer/inscription/info/${id}`, {
    headers: unisatHeaders(),
  })
  if (!res.ok) return null
  const j = await res.json()
  if (j?.code !== 0) return null
  return j.data?.utxo?.address ?? j.data?.address ?? null
}

/** Roda `fn` em ondas para não disparar 40 pedidos de uma vez num serviço público. */
export async function inWaves<T, R>(items: T[], fn: (x: T) => Promise<R>, width = 8): Promise<R[]> {
  const out: R[] = []
  for (let i = 0; i < items.length; i += width) {
    out.push(...(await Promise.all(items.slice(i, i + width).map(fn))))
  }
  return out
}
