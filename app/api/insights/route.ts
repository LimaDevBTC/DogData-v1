import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// O FEED DE INSIGHTS: o que os dados da casa dizem hoje, em frases.
//
// ⚠️ A REGRA EDITORIAL É UMA SÓ, E O FUNDADOR A FECHOU EM 24/08/2026: "não existe
// contra próprio interesse, queremos a verdade". Então saída de corretora e
// entrada de corretora aparecem com o mesmo peso, e uma venda grande vira notícia
// mesmo quando a venda é ruim para o preço. Mídia que só publica o que lhe convém
// não vira fonte, vira panfleto.
//
// ⚠️ E NADA AQUI É GERADO POR MODELO. Cada item sai de uma consulta ao nosso
// índice, carrega o número que o sustenta e um link para a transação ou o
// endereço. Se alguém quiser conferir, consegue. É essa a diferença entre o que a
// gente publica e um bot de alerta.
//
// ⚠️ APELIDO, NÃO NOME. Baleia aparece por posição no ranking ("whale #7"), não
// por @: o endereço é público, mas a LIGAÇÃO entre endereço e pessoa seria feita
// por nós. Quem vinculou o X no perfil é outra história, e é opt-in.
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } },
)

interface Insight {
  id: string
  /** o que aconteceu, em uma frase */
  headline: string
  /** o número que sustenta a frase */
  value?: string
  kind: 'exchange_in' | 'exchange_out' | 'whale' | 'donation' | 'mempool' | 'holders'
  /** para onde a pessoa vai conferir */
  href?: string
  at: string
  /** de onde saiu, dito na cara: nome do rótulo ou "índice" */
  source: string
}

const DONATION_WALLET = 'bc1pxk7aw9ug55jkkz02z7ayhlkxxq92ya0ctegcwm5j8jumgaavjlkqdylk2p'
const fmt = (n: number) =>
  n >= 1e9 ? `${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : n.toFixed(0)

/** ⚠️ O JSON VEM CODIFICADO DUAS VEZES nesta tabela: a coluna é jsonb e guarda
 *  uma STRING de JSON. Ler direto devolve texto, não lista, e o filtro silencioso
 *  que isso causa é do tipo que some no meio de um feed sem ninguém notar. */
function arr(v: any): any[] {
  if (!v) return []
  if (Array.isArray(v)) return v
  try {
    const once = typeof v === 'string' ? JSON.parse(v) : v
    return Array.isArray(once) ? once : typeof once === 'string' ? JSON.parse(once) : []
  } catch {
    return []
  }
}

export async function GET() {
  const desde = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
  const out: Insight[] = []

  try {
    const [labelsRes, txRes, mempoolRes] = await Promise.all([
      supabase.from('dog_labels').select('address, entity, role, kind').eq('internal', false),
      supabase
        .from('dog_transactions')
        .select('txid, timestamp, total_dog_moved, senders, receivers')
        .gte('timestamp', desde)
        .order('total_dog_moved', { ascending: false })
        .limit(400),
      supabase.from('dog_mempool').select('txid, dog_out, receivers, first_seen').eq('status', 'pending'),
    ])

    const rotulo = new Map<string, { entity: string; role: string | null }>()
    for (const l of labelsRes.data || []) rotulo.set(l.address, { entity: l.entity, role: l.role })
    const txs = txRes.data || []

    // ── fluxo de corretora, nas duas direções e com o mesmo peso ────────────
    const entrou = new Map<string, number>()
    const saiu = new Map<string, number>()
    for (const t of txs) {
      const recebeu = new Map<string, number>()
      const mandou = new Map<string, number>()
      for (const r of arr(t.receivers)) {
        const lab = rotulo.get(r.address)
        if (lab && Number(r.amount_dog) > 0) recebeu.set(lab.entity, (recebeu.get(lab.entity) || 0) + Number(r.amount_dog))
      }
      for (const s of arr(t.senders)) {
        const lab = rotulo.get(s.address)
        if (lab && Number(s.amount_dog) > 0) mandou.set(lab.entity, (mandou.get(lab.entity) || 0) + Number(s.amount_dog))
      }
      // ⚠️ REMANEJO INTERNO NÃO É FLUXO, e contá-lo infla OS DOIS LADOS. A Kraken
      // tem carteira quente, tesouraria e saque, e ela mexe DOG entre as três o
      // tempo todo. Se a mesma entidade aparece mandando e recebendo na mesma
      // transação, o que houve foi mudança de bolso, não gente comprando nem
      // vendendo. Só o SALDO da entidade naquela transação vira notícia.
      for (const entity of Array.from(new Set([...Array.from(recebeu.keys()), ...Array.from(mandou.keys())]))) {
        const liquido = (recebeu.get(entity) || 0) - (mandou.get(entity) || 0)
        if (liquido > 0) entrou.set(entity, (entrou.get(entity) || 0) + liquido)
        else if (liquido < 0) saiu.set(entity, (saiu.get(entity) || 0) - liquido)
      }
    }
    for (const [entity, dog] of Array.from(entrou.entries())) {
      out.push({
        id: `in-${entity}`, kind: 'exchange_in', at: new Date().toISOString(), source: entity,
        headline: `${fmt(dog)} DOG moved into ${entity} in the last 24 hours`,
        value: `${fmt(dog)} DOG`,
      })
    }
    for (const [entity, dog] of Array.from(saiu.entries())) {
      out.push({
        id: `out-${entity}`, kind: 'exchange_out', at: new Date().toISOString(), source: entity,
        headline: `${fmt(dog)} DOG left ${entity} in the last 24 hours`,
        value: `${fmt(dog)} DOG`,
      })
    }

    // ── a maior transferência do dia ────────────────────────────────────────
    const maior = txs[0]
    if (maior && Number(maior.total_dog_moved) > 0) {
      out.push({
        id: `big-${maior.txid}`, kind: 'whale', at: maior.timestamp, source: 'our index',
        headline: `Largest transfer of the day: ${fmt(Number(maior.total_dog_moved))} DOG`,
        value: `${fmt(Number(maior.total_dog_moved))} DOG`,
        href: `/tx/bitcoin/${maior.txid}`,
      })
    }

    // ── quem está bancando a cidade ─────────────────────────────────────────
    let doado = 0
    let ultimaDoacao: string | null = null
    for (const t of txs) {
      for (const r of arr(t.receivers)) {
        if (r.address === DONATION_WALLET && Number(r.amount_dog) > 0) {
          doado += Number(r.amount_dog)
          ultimaDoacao = ultimaDoacao || t.txid
        }
      }
    }
    if (doado > 0) {
      out.push({
        id: 'donation-24h', kind: 'donation', at: new Date().toISOString(), source: 'our index',
        headline: `${fmt(doado)} DOG went into DogCity in the last 24 hours`,
        value: `${fmt(doado)} DOG`,
        href: ultimaDoacao ? `/tx/bitcoin/${ultimaDoacao}` : '/dogcity',
      })
    }

    // ── o que está em órbita agora ──────────────────────────────────────────
    const pend = mempoolRes.data || []
    if (pend.length > 0) {
      const emVoo = pend.reduce((n, m) => n + Number(m.dog_out || 0), 0)
      out.push({
        id: 'mempool-now', kind: 'mempool', at: new Date().toISOString(), source: 'our node',
        headline: `${pend.length} DOG transaction${pend.length === 1 ? '' : 's'} waiting for a block, carrying ${fmt(emVoo)} DOG`,
        value: `${pend.length} tx`,
        href: '/transactions',
      })
    }

    return NextResponse.json(
      { insights: out.slice(0, 8), generated_at: new Date().toISOString() },
      // ⚠️ curto de propósito: um feed que diz "nas últimas 24 horas" servido de
      // um cache de dez minutos está dizendo "há dez minutos, sobre ontem".
      { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' } },
    )
  } catch (err: any) {
    return NextResponse.json({ insights: [], error: err?.message ?? 'falhou' }, { status: 200 })
  }
}
