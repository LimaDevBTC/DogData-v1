/**
 * GET /api/mempool/dog
 *
 * A órbita da praça: o que o nosso nó vê da mempool sobre o DOG, agora. Lê as
 * tabelas que o scripts/dog_mempool_watcher.py escreve (praca-central.md §4):
 *
 *   pending   as txs de DOG em órbita (ordem de taxa: quem paga mais pousa antes)
 *   landed    as que pousaram nos últimos blocos, mais recente primeiro
 *   dropped   as que sumiram da mempool sem bloco, últimas horas
 *   snapshot  mempool inteira (tamanho, taxas), topo da cadeia, resumo do DOG
 *
 * ?txid=<64 hex>  devolve só aquela tx (follow your DOG), em qualquer estado.
 *
 * Sem cache no CDN além de alguns segundos: a cena pergunta a cada 6 s e a
 * verdade muda a cada bloco.
 */

import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { netTransfer } from '@/lib/dog/net-transfer'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const ROW =
  'txid, status, first_seen, seen_pending, block_height, block_time, confirmed_at, dropped_at, ' +
  'dog_in, dog_out, dog_burn, explicit_edict, cenotaph, senders, receivers, fee_sats, vsize, fee_rate, n_in, n_out, rbf'

type Row = {
  txid: string
  status: 'pending' | 'confirmed' | 'dropped'
  first_seen: string
  seen_pending: boolean
  block_height: number | null
  block_time: string | null
  confirmed_at: string | null
  dropped_at: string | null
  dog_in: string | number
  dog_out: string | number
  dog_burn: string | number
  explicit_edict: boolean
  cenotaph: boolean
  senders: string[]
  receivers: Array<{ address: string; dog: string | number }>
  fee_sats: number | null
  vsize: number | null
  fee_rate: string | number | null
  n_in: number | null
  n_out: number | null
  rbf: boolean
}

// numeric chega como string do PostgREST; a cena quer número.
//
// ⚠️ E AQUI SAI O NÚMERO QUE VAI PARA A TELA. `dog_in` é o UTXO inteiro que foi
// gasto, não o que mudou de mão: mandar 10 mil de um UTXO de 600 mil gasta os
// 600 mil e devolve 590 mil de troco. Quem lê "600.000 DOG" no foguete lê uma
// doação sessenta vezes maior do que a que aconteceu. `dog_net` é o que
// aconteceu, e é ele que as telas usam.
function shape(r: Row) {
  const receivers = (r.receivers || []).map((x) => ({ address: x.address, dog: Number(x.dog) }))
  const fluxo = netTransfer(r.senders, receivers)
  return {
    ...r,
    dog_in: Number(r.dog_in),
    dog_out: Number(r.dog_out),
    dog_burn: Number(r.dog_burn),
    dog_net: fluxo.net,
    dog_change: fluxo.change,
    flow_kind: fluxo.kind,
    fee_rate: r.fee_rate == null ? null : Number(r.fee_rate),
    receivers,
  }
}

const HEADERS = { 'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=15' }

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const txid = (searchParams.get('txid') || '').trim().toLowerCase()

  try {
    if (txid) {
      if (!/^[0-9a-f]{64}$/.test(txid)) {
        return NextResponse.json({ error: 'Valid TXID required (64-char hex)' }, { status: 400 })
      }
      const { data, error } = await supabase.from('dog_mempool').select(ROW).eq('txid', txid).maybeSingle()
      if (error) throw error
      return NextResponse.json({ tx: data ? shape(data as unknown as Row) : null }, { headers: HEADERS })
    }

    const since = new Date(Date.now() - 6 * 3600_000).toISOString()
    const [pending, landed, dropped, snap] = await Promise.all([
      supabase.from('dog_mempool').select(ROW).eq('status', 'pending').order('fee_rate', { ascending: false, nullsFirst: false }).limit(200),
      supabase.from('dog_mempool').select(ROW).eq('status', 'confirmed').order('confirmed_at', { ascending: false }).limit(60),
      supabase.from('dog_mempool').select(ROW).eq('status', 'dropped').gte('dropped_at', since).order('dropped_at', { ascending: false }).limit(30),
      supabase.from('mempool_snapshot').select('*').eq('id', 1).maybeSingle(),
    ])
    for (const r of [pending, landed, dropped, snap]) if (r.error) throw r.error

    const pendentes = ((pending.data || []) as unknown as Row[]).map(shape)
    // ⚠️ O TOTAL EM VOO TAMBÉM ERA BRUTO. O watcher soma `dog_out` de todas as
    // pendentes para o `dog_pending_amount`, e aí a barra da praça anunciava a
    // soma dos UTXOs gastos como se fosse DOG viajando. Recalculado aqui a partir
    // das mesmas linhas que a cena recebe, para os dois números baterem.
    const emVooLiquido = pendentes.reduce((n, t) => n + t.dog_net, 0)
    const s = snap.data as Record<string, unknown> | null
    const snapshot = s
      ? {
          updated_at: s.updated_at,
          tx_count: s.tx_count,
          vbytes: s.vbytes,
          min_fee_rate: s.min_fee_rate == null ? null : Number(s.min_fee_rate),
          fee_fast: s.fee_fast == null ? null : Number(s.fee_fast),
          fee_normal: s.fee_normal == null ? null : Number(s.fee_normal),
          fee_slow: s.fee_slow == null ? null : Number(s.fee_slow),
          tip_height: s.tip_height,
          tip_hash: s.tip_hash,
          tip_time: s.tip_time,
          dog_pending: s.dog_pending,
          // recalculado a partir das mesmas linhas que a cena recebe, para o
          // número da barra bater com os foguetes que estão no céu mesmo quando o
          // watcher está um giro atrás
          dog_pending_amount: emVooLiquido,
          last_dog_block: s.last_dog_block,
          last_dog_block_time: s.last_dog_block_time,
          last_dog_block_count: s.last_dog_block_count,
          last_dog_block_amount: s.last_dog_block_amount == null ? null : Number(s.last_dog_block_amount),
        }
      : null

    return NextResponse.json(
      {
        pending: pendentes,
        landed: ((landed.data || []) as unknown as Row[]).map(shape),
        dropped: ((dropped.data || []) as unknown as Row[]).map(shape),
        snapshot,
        // Idade do dado: se o watcher morrer, a cena sabe que está olhando o passado.
        stale_seconds: s?.updated_at ? Math.max(0, Math.round((Date.now() - new Date(String(s.updated_at)).getTime()) / 1000)) : null,
      },
      { headers: HEADERS },
    )
  } catch (err) {
    console.error('[api/mempool/dog]', err)
    return NextResponse.json({ error: 'mempool feed unavailable' }, { status: 503 })
  }
}
