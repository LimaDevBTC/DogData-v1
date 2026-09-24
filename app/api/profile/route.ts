import { NextRequest, NextResponse } from 'next/server'
import { redisClient } from '@/lib/upstash'
import { supabase } from '@/lib/supabase'
import { validateHandle } from '@/lib/identity/handle'
import { comPrazo, falhaPrivada } from '@/lib/api/prazo'
import { escrituras, buscarEscritura } from '@/lib/city/escrituras'
import {
  CORTE_CEMITERIO_DOG, CORTE_CEMITERIO_PUBLICADO, SNAPSHOT_PROOF,
  BAIRRO_DO_SETOR, TIPOLOGIA_DA_FORMA, COLUMBARIO_NOME, linkDoMapa,
} from '@/app/dogcity/dogcity-data'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface WalletSession {
  address: string
  walletId: string | null
  verifiedAt: string
}

// Mesmo padrao de leitura de app/api/wallet/session/route.ts: cookie dg_wallet
// aponta pra wsess:<sid> no Redis. A sessao so existe depois que a assinatura
// bateu em /api/wallet/verify, entao presenca com address e a propria prova
// de verified, nao ha um campo "verified" separado gravado no Redis.
async function getSession(req: NextRequest): Promise<WalletSession | null> {
  const sid = req.cookies.get('dg_wallet')?.value
  if (!sid) return null
  const session = await redisClient.get<WalletSession>(`wsess:${sid}`)
  return session?.address ? session : null
}

// GET /api/profile            perfil da sessao atual
// GET /api/profile?address=x   parte publica de qualquer endereco
//
// A resposta junta o handle e a foto (dogcity_profiles), quantas vezes o
// endereco ja falou na praca (dogcity_chat) e o LUGAR DELE NA CIDADE, que sai
// do registro selado no bloco 966.670. `verified` so e true para o endereco da
// sessao: os outros campos sao publicos, a posse nao.
//
// ⚠️ O LOTE NAO VEM MAIS DE `dogcity_lots` (24/09, LIGAR.md FS3). Aquela tabela
// e o registro antigo da CrossChainCity (rua, numero, prestigio, distrito) e
// nao e a cidade que o jogo desenha: o /profile mostrava um lote que nao
// existe. Agora `city` segue a MESMA regra de /api/dogcity/lookup, para a
// landing e o /profile nunca dizerem coisas diferentes do mesmo endereco:
//   * `dog_snapshot_lookup` (uma consulta pela chave primaria) decide o RAMO:
//     lote ou lapide (coluna `destino`, com o saldo como plano B para linha
//     anterior a migracao 031), ou fora do snapshot;
//   * `public/city/escrituras.bin` (buscarEscritura) da a POSICAO e a AREA
//     gravada no registro. A area da tabela nao entra: ela ainda serve a curva
//     (ver o cabecalho da rota de lookup), e misturar as duas fontes e o erro
//     que aquela rota documenta.
// Se o indice nao responder a tempo, `position: 'unavailable'` e o lote sai
// sem lot_id nem area; nunca um lote inventado. O ALVO DA CURVA (area
// prometida) nao e servido: a tela calcula com `alvoDaCurva(dog, area_m2)`,
// como a landing.
const PRAZO_MS = 5000
// teto so da posicao, mesmo da rota de lookup: o indice carrega em paralelo e,
// se nao chegar ate aqui, a resposta sai sem posicao
const POSICAO_MS = 1500

type CidadePerfil = {
  block: number
  status: 'lot' | 'headstone' | 'not_in_snapshot' | 'unavailable'
  dog: number | null
  position: 'ok' | 'unavailable'
  lot: {
    lot_id: string
    sector: number
    district: string | null
    typology: string | null
    dsc: boolean
    area_m2: number
    map: string
  } | null
  headstone: { id: string; place: string; map: string } | null
  lot_floor_dog: number
}

async function cidadeDe(
  endereco: string,
  indicePromise: ReturnType<typeof escrituras>,
  signal: AbortSignal,
): Promise<CidadePerfil> {
  const base: CidadePerfil = {
    block: SNAPSHOT_PROOF.block, status: 'unavailable', dog: null, position: 'unavailable',
    lot: null, headstone: null, lot_floor_dog: CORTE_CEMITERIO_PUBLICADO,
  }
  const { data: row, error } = await supabase
    .from('dog_snapshot_lookup')
    .select('dog, destino, bloco')
    .eq('address', endereco)
    .abortSignal(signal)
    .maybeSingle()
  if (error) {
    console.error('[api/profile GET city]', error.message)
    return base
  }
  if (!row) return { ...base, status: 'not_in_snapshot' }

  const dog = Number(row.dog)
  const block = Number(row.bloco) || SNAPSHOT_PROOF.block
  const indice = await Promise.race([
    indicePromise.catch(() => null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), POSICAO_MS)),
  ])
  const esc = indice ? buscarEscritura(indice, endereco) : null

  const lapide = row.destino === 'lapide' || (row.destino == null && dog < CORTE_CEMITERIO_DOG)
  if (lapide) {
    const h = esc?.kind === 'lapide' ? esc : null
    return {
      ...base, block, dog, status: 'headstone', position: h ? 'ok' : 'unavailable',
      headstone: h ? { id: h.id, place: COLUMBARIO_NOME, map: linkDoMapa(h.id) } : null,
    }
  }
  const l = esc?.kind === 'lote' ? esc : null
  return {
    ...base, block, dog, status: 'lot', position: l ? 'ok' : 'unavailable',
    lot: l
      ? {
          lot_id: l.lotId,
          sector: l.setor,
          district: BAIRRO_DO_SETOR[l.setor] ?? null,
          typology: TIPOLOGIA_DA_FORMA[l.forma] ?? null,
          dsc: l.dsc,
          area_m2: l.area_m2,
          map: linkDoMapa(l.lotId),
        }
      : null,
  }
}

export async function GET(req: NextRequest) {
  const session = await getSession(req)
  const sessionAddress = session?.address?.toLowerCase() ?? null
  const asked = req.nextUrl.searchParams.get('address')?.trim() ?? ''
  const address = (asked || sessionAddress || '').toLowerCase()

  if (!address) {
    return NextResponse.json({
      address: null, verified: false, handle: null, claimed_at: null,
      avatar_inscription_id: null, avatar_number: null,
      city: null, chat_count: 0, wallet_id: null,
    })
  }

  // O perfil guarda tudo em minusculas, mas o registro da cidade nao: bech32 e
  // canonicamente minusculo, base58 (1... e 3...) e sensivel a caixa. Mesma
  // normalizacao de /api/dogcity/lookup e do gerador das escrituras.
  const bruto = asked || session?.address || ''
  const enderecoCidade = bruto.toLowerCase().startsWith('bc1') ? bruto.toLowerCase() : bruto
  const origin = req.nextUrl.origin || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
  const indicePromise = escrituras(origin)

  return comPrazo(async (signal) => {
    const [profileRes, city, chatRes] = await Promise.all([
      supabase
        .from('dogcity_profiles')
        .select('handle, created_at, avatar_inscription_id, avatar_content_type, avatar_number')
        .eq('address', address)
        .abortSignal(signal)
        .maybeSingle(),
      cidadeDe(enderecoCidade, indicePromise, signal),
      supabase.from('dogcity_chat').select('id', { count: 'exact', head: true }).eq('address', address).abortSignal(signal),
    ])

    if (profileRes.error) {
      console.error('[api/profile GET]', profileRes.error.message)
      return NextResponse.json({ error: 'internal' }, { status: 500 })
    }
    // Cidade e chat sao enfeite do perfil: se o registro estiver fora do ar a
    // pagina ainda tem que abrir com a identidade (city.status 'unavailable').
    if (chatRes.error) console.error('[api/profile GET chat]', chatRes.error.message)

    return NextResponse.json({
      address,
      verified: !!sessionAddress && sessionAddress === address,
      handle: profileRes.data?.handle ?? null,
      claimed_at: profileRes.data?.created_at ?? null,
      avatar_inscription_id: profileRes.data?.avatar_inscription_id ?? null,
      avatar_number: profileRes.data?.avatar_number ?? null,
      city,
      chat_count: chatRes.count ?? 0,
      wallet_id: sessionAddress === address ? session?.walletId ?? null : null,
    })
  }, { ms: PRAZO_MS, falha: falhaPrivada })
}

// POST /api/profile {handle} → cria o handle da carteira logada (upsert por
// address, entao reenviar o mesmo endereco troca o handle em vez de duplicar).
export async function POST(req: NextRequest) {
  const session = await getSession(req)
  if (!session) {
    return NextResponse.json({ error: 'Ownership not verified.' }, { status: 401 })
  }

  let body: { handle?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body.' }, { status: 422 })
  }

  const validation = validateHandle(body.handle ?? '')
  if (!validation.ok || !validation.handle) {
    return NextResponse.json({ error: validation.reason ?? 'invalid_handle' }, { status: 422 })
  }

  const address = session.address.toLowerCase()
  const handle = validation.handle

  // Confere duplicata antes do upsert pra devolver 409 legivel. O unique
  // constraint da tabela e o guarda de verdade (corrida entre duas
  // requisicoes concorrentes), essa checagem so evita o caso comum.
  const { data: taken, error: lookupError } = await supabase
    .from('dogcity_profiles')
    .select('address')
    .eq('handle', handle)
    .neq('address', address)
    .maybeSingle()

  if (lookupError) {
    console.error('[api/profile POST lookup]', lookupError.message)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
  if (taken) {
    return NextResponse.json({ error: 'taken' }, { status: 409 })
  }

  const { error: upsertError } = await supabase
    .from('dogcity_profiles')
    .upsert({ address, handle, updated_at: new Date().toISOString() }, { onConflict: 'address' })

  if (upsertError) {
    // 23505 = unique_violation: outra requisicao ganhou a corrida pelo mesmo handle.
    if (upsertError.code === '23505') {
      return NextResponse.json({ error: 'taken' }, { status: 409 })
    }
    console.error('[api/profile POST upsert]', upsertError.message)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }

  return NextResponse.json({ address, verified: true, handle })
}
