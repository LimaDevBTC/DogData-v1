import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { sessionWallet } from '@/lib/game/session'
import { activeNews, walletNewsState } from '@/lib/game/news'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const NO_STORE = { 'Cache-Control': 'no-store' }
const PUBLIC = { 'Cache-Control': 'public, s-maxage=60' }

// GET -> os cards ativos das novidades do jogo. Publico: a sessao e' opcional e so' acrescenta seen/clicked da carteira.
// Sem sessao a resposta e' igual para todos e pode ficar no CDN por 60 s; com sessao e' pessoal e nunca vai ao cache.
export async function GET(req: NextRequest) {
  try {
    const now = Date.now()
    const nowIso = new Date(now).toISOString()
    // published + janela de data ja no banco (o card vencido nao ocupa vaga no limite); activeNews confere de novo
    const { data, error } = await supabase
      .from('dogcity_game_news')
      .select('id,tag,priority,starts_at,ends_at,audience,image,cta,texts,published')
      .eq('published', true)
      .lte('starts_at', nowIso)
      .or(`ends_at.is.null,ends_at.gt.${nowIso}`)
      .order('priority', { ascending: false })
      .order('starts_at', { ascending: false })
      .limit(100)
    if (error) throw error
    const news = activeNews(data ?? [], now)

    // sessao opcional: se o Redis falhar, a resposta cai para a publica (mesmos cards, sem seen/clicked) em vez de 500
    let wallet: string | null = null
    try {
      wallet = await sessionWallet(req)
    } catch (e) {
      console.error('[game/news GET session]', (e as Error)?.message)
    }
    if (!wallet) return NextResponse.json({ news }, { status: 200, headers: PUBLIC })
    if (news.length === 0) return NextResponse.json({ news, seen: [], clicked: [] }, { status: 200, headers: NO_STORE })

    const { data: rows, error: seenError } = await supabase
      .from('dogcity_game_news_seen')
      .select('news_id,clicked_at')
      .eq('wallet', wallet)
      .in('news_id', news.map((n) => n.id))
    if (seenError) throw seenError
    return NextResponse.json({ news, ...walletNewsState(rows ?? [], news.map((n) => n.id)) }, { status: 200, headers: NO_STORE })
  } catch (e) {
    console.error('[game/news GET]', (e as Error)?.message)
    return NextResponse.json({ error: 'server_error' }, { status: 500, headers: NO_STORE })
  }
}
