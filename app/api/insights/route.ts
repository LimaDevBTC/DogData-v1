import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { movedDog } from '@/lib/dog/net-transfer'
import { displayName } from '@/lib/dog/taxonomy'

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
      supabase.from('dog_mempool').select('txid, dog_out, senders, receivers, first_seen').eq('status', 'pending'),
    ])

    // ⚠️ `entity` PODE SER NULO desde a migração 008, e ignorar isso pôs no ar a
    // manchete "98.13M DOG moved into null". Quando não há nome próprio o que
    // vale é a CLASSE, e a classe conta outra história: dinheiro entrando numa
    // corretora é pressão de venda; dinheiro passando por um mercado é só
    // volume negociado. Misturar os dois na mesma frase seria pior que o `null`,
    // porque o erro deixaria de ser visível.
    const rotulo = new Map<string, { nome: string; kind: string | null; role: string | null; nomeado: boolean }>()
    for (const l of labelsRes.data || []) {
      rotulo.set(l.address, {
        nome: displayName(l.entity, l.kind),
        kind: l.kind ?? null,
        role: l.role ?? null,
        nomeado: !!l.entity,
      })
    }
    const txs = txRes.data || []

    // ── fluxo de corretora, nas duas direções e com o mesmo peso ────────────
    const entrou = new Map<string, number>()
    const saiu = new Map<string, number>()
    let mercado = 0            // DOG que passou por mercados no período
    let mesaRecebeu = 0
    let mesaMandou = 0
    const mesaPara = new Map<string, number>()
    for (const t of txs) {
      const recebeu = new Map<string, number>()
      const mandou = new Map<string, number>()
      for (const r of arr(t.receivers)) {
        const lab = rotulo.get(r.address)
        if (!lab || !(Number(r.amount_dog) > 0)) continue
        if (lab.kind === 'exchange') recebeu.set(lab.nome, (recebeu.get(lab.nome) || 0) + Number(r.amount_dog))
        else if (lab.kind === 'marketplace') mercado += Number(r.amount_dog)
        else if (lab.kind === 'desk') mesaRecebeu += Number(r.amount_dog)
      }
      for (const s of arr(t.senders)) {
        const lab = rotulo.get(s.address)
        if (!lab || !(Number(s.amount_dog) > 0)) continue
        if (lab.kind === 'exchange') mandou.set(lab.nome, (mandou.get(lab.nome) || 0) + Number(s.amount_dog))
        else if (lab.kind === 'desk') mesaMandou += Number(s.amount_dog)
      }
      // ⚠️ O QUE A MESA MANDOU PARA CADA CORRETORA, CONTADO POR TRANSAÇÃO E COM
      // TETO. A primeira versão somava, para cada remetente-mesa, TODOS os
      // destinatários daquela transação, e pôs no ar a frase "a mesa moveu 90M,
      // 155M deles para a Kraken": a parte maior que o todo. Numa transação com
      // vários remetentes, o que foi para a Kraken não saiu todo da mesa. O teto
      // é o que a mesa efetivamente mandou naquela transação, e a atribuição
      // acontece UMA vez por transação, não uma por remetente.
      {
        const mesaNestaTx = arr(t.senders)
          .filter((x: any) => rotulo.get(x.address)?.kind === 'desk')
          .reduce((n: number, x: any) => n + Number(x.amount_dog || 0), 0)
        if (mesaNestaTx > 0) {
          let sobra = mesaNestaTx
          for (const r of arr(t.receivers)) {
            if (sobra <= 0) break
            const dst = rotulo.get(r.address)
            if (dst?.nomeado && dst.kind === 'exchange') {
              const parcela = Math.min(Number(r.amount_dog || 0), sobra)
              if (parcela > 0) {
                mesaPara.set(dst.nome, (mesaPara.get(dst.nome) || 0) + parcela)
                sobra -= parcela
              }
            }
          }
        }
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

    // ── o que passou pelos mercados ─────────────────────────────────────────
    // ⚠️ FRASE DIFERENTE DE PROPÓSITO. Entrar numa corretora é pressão de venda;
    // passar por um mercado é só volume negociado, e os dois na mesma frase
    // enganariam quem lê. Os mercados ainda não têm nome próprio, então a soma
    // sai agregada, que é o que a prova sustenta.
    if (mercado > 0) {
      out.push({
        id: 'marketplace-24h', kind: 'whale', at: new Date().toISOString(), source: 'our index',
        headline: `${fmt(mercado)} DOG changed hands on marketplaces in the last 24 hours`,
        value: `${fmt(mercado)} DOG`,
      })
    }

    // ── a mesa ──────────────────────────────────────────────────────────────
    if (mesaMandou > 0) {
      const destino = Array.from(mesaPara.entries()).sort((a, b) => b[1] - a[1])[0]
      out.push({
        id: 'desk-24h', kind: 'exchange_in', at: new Date().toISOString(), source: 'our index',
        // ⚠️ A FRASE MUDA COM O NÚMERO. Quando a mesa mandou tudo para um lugar
        // só, "moveu 90M, 90M deles para a Kraken" é a mesma coisa dita duas
        // vezes, e frase redundante lê como erro mesmo quando está certa.
        headline: !destino
          ? `A trading desk moved ${fmt(mesaMandou)} DOG in the last 24 hours`
          : destino[1] >= mesaMandou * 0.98
            ? `A trading desk sent ${fmt(mesaMandou)} DOG into ${destino[0]} in the last 24 hours`
            : `A trading desk moved ${fmt(mesaMandou)} DOG, ${fmt(destino[1])} of it into ${destino[0]}`,
        value: `${fmt(mesaMandou)} DOG`,
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
      // ⚠️ líquido de troco: somar `dog_out` conta o UTXO inteiro que foi gasto,
      // e a manchete anunciava dez vezes mais DOG em voo do que estava em voo.
      const emVoo = pend.reduce((n, m) => n + movedDog(arr(m.senders), arr(m.receivers)), 0)
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
