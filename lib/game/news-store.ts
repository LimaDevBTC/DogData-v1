import type { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'

// Lado do servidor das novidades do jogo (so' as rotas importam). A logica pura fica em lib/game/news.ts.

/** o corpo do POST e' minusculo ({ids: ate 12} ou {id}); passou de 2 KB ou nao e' JSON: null (a rota responde 400) */
export async function readJsonBody(req: NextRequest): Promise<unknown> {
  const raw = await req.text()
  if (raw.length > 2048) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/**
 * Grava que a carteira viu (e, com clicked, clicou em) os cards. Idempotente:
 * - ignoreDuplicates = ON CONFLICT DO NOTHING, entao um segundo "visto" nao mexe no seen_at nem apaga o clique;
 * - o clique so' preenche clicked_at enquanto ele for nulo (o primeiro clique vale, o resto e' no-op).
 * Id que nao existe na tabela e' ignorado (o card pode ter sido apagado entre o feed e a chamada), em vez de derrubar o lote
 * inteiro pela chave estrangeira.
 */
export async function markNews(wallet: string, ids: string[], clicked: boolean): Promise<void> {
  if (!ids.length) return
  const known = await supabase.from('dogcity_game_news').select('id').in('id', ids)
  if (known.error) throw known.error
  const okIds = (known.data ?? []).map((r: { id: string }) => r.id)
  if (!okIds.length) return

  const ins = await supabase
    .from('dogcity_game_news_seen')
    .upsert(okIds.map((news_id) => ({ wallet, news_id })), { onConflict: 'wallet,news_id', ignoreDuplicates: true })
  if (ins.error) throw ins.error

  if (clicked) {
    const upd = await supabase
      .from('dogcity_game_news_seen')
      .update({ clicked_at: new Date().toISOString() })
      .eq('wallet', wallet)
      .in('news_id', okIds)
      .is('clicked_at', null)
    if (upd.error) throw upd.error
  }
}
