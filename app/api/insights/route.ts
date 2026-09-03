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
  /** magnitude em DOG: é ela que ordena o feed, não a direção */
  dog?: number
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
        .select('txid, timestamp, type, net_transfer, senders, receivers')
        .gte('timestamp', desde)
        .order('net_transfer', { ascending: false })
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
    // ⚠️ TODA CLASSE PASSA PELO MESMO LÍQUIDO, e a exceção é que quebrava a conta.
    // O troco de rune volta para quem gastou: um mercado que move um UTXO de 100M
    // para pagar 2M recebe 98M de volta, e somar a saída bruta punha os 98M de
    // troco na frase "mudou de mão nos mercados". A corretora já era lida no
    // líquido; mercado e mesa somavam bruto. Agora a chave carrega a CLASSE junto
    // do nome, e o saldo da entidade dentro da transação é o único número que sai
    // daqui — troco e remanejo interno se cancelam sozinhos.
    const CH = '\u0000'
    for (const t of txs) {
      const recebeu = new Map<string, number>()
      const mandou = new Map<string, number>()
      for (const r of arr(t.receivers)) {
        const lab = rotulo.get(r.address)
        if (!lab || !(Number(r.amount_dog) > 0)) continue
        const k = `${lab.kind}${CH}${lab.nome}`
        recebeu.set(k, (recebeu.get(k) || 0) + Number(r.amount_dog))
      }
      for (const s of arr(t.senders)) {
        const lab = rotulo.get(s.address)
        if (!lab || !(Number(s.amount_dog) > 0)) continue
        const k = `${lab.kind}${CH}${lab.nome}`
        mandou.set(k, (mandou.get(k) || 0) + Number(s.amount_dog))
      }
      // ⚠️ O QUE A MESA MANDOU PARA CADA CORRETORA, CONTADO POR TRANSAÇÃO E COM
      // TETO. A primeira versão somava, para cada remetente-mesa, TODOS os
      // destinatários daquela transação, e pôs no ar a frase "a mesa moveu 90M,
      // 155M deles para a Kraken": a parte maior que o todo. Numa transação com
      // vários remetentes, o que foi para a Kraken não saiu todo da mesa. O teto
      // é o que a mesa efetivamente mandou naquela transação, e a atribuição
      // acontece UMA vez por transação, não uma por remetente.
      {
        // ⚠️ O TETO É O LÍQUIDO DA MESA, não o que ela gastou. Uma mesa que gasta
        // um UTXO de 100M para mandar 5M recebe 95M de troco; o bruto dizia que
        // ela mandou 100M para a corretora, e a frase saía dez vezes maior que o
        // fato.
        const mesaNestaTx = Math.max(
          0,
          Array.from(mandou.entries()).reduce((n, [k, v]) => (k.startsWith(`desk${CH}`) ? n + v : n), 0) -
            Array.from(recebeu.entries()).reduce((n, [k, v]) => (k.startsWith(`desk${CH}`) ? n + v : n), 0),
        )
        if (mesaNestaTx > 0) {
          let sobra = mesaNestaTx
          // ⚠️ QUEM MANDOU NÃO É DESTINO. Endereço que aparece nos dois lados da
          // transação está recebendo troco, e troco atribuído como destino faz a
          // frase dizer que a corretora recebeu o que ela mesma gastou.
          const remetentes = new Set(arr(t.senders).map((x: any) => x.address))
          for (const r of arr(t.receivers)) {
            if (sobra <= 0) break
            if (remetentes.has(r.address)) continue
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
      for (const k of Array.from(new Set([...Array.from(recebeu.keys()), ...Array.from(mandou.keys())]))) {
        const liquido = (recebeu.get(k) || 0) - (mandou.get(k) || 0)
        if (liquido === 0) continue
        const corte = k.indexOf(CH)
        const classe = k.slice(0, corte)
        const entity = k.slice(corte + 1)
        if (classe === 'exchange') {
          if (liquido > 0) entrou.set(entity, (entrou.get(entity) || 0) + liquido)
          else saiu.set(entity, (saiu.get(entity) || 0) - liquido)
        } else if (classe === 'marketplace') {
          if (liquido > 0) mercado += liquido
        } else if (classe === 'desk') {
          if (liquido > 0) mesaRecebeu += liquido
          else mesaMandou += -liquido
        }
      }
    }
    // ⚠️ ENTRADA E SAÍDA COMPETEM PELO MESMO ESPAÇO. A versão anterior empurrava
    // todas as entradas antes de todas as saídas, e com cinco corretoras
    // nomeadas o visor ficava vermelho por CONSTRUÇÃO: 1,26M entrando na CoinEx
    // ocupava vaga acima de qualquer saque grande. A regra editorial da casa é
    // "as duas direções com o mesmo peso", e o peso que não mente é a
    // MAGNITUDE: a direção vira seta e cor na tela, nunca precedência.
    //
    // ⚠️ E COM PISO DE RELEVÂNCIA RELATIVO AO LÍDER DO DIA: fluxo de corretora
    // menor que 2% do maior fluxo do dia não é manchete, é ruído ocupando vaga.
    // O piso é relativo de propósito: num dia parado, 2M lidera e 100K ainda
    // entra; num dia de 183M, a mixaria sai da frente.
    const fluxos: Array<{ entity: string; dog: number; dir: 'in' | 'out' }> = [
      ...Array.from(entrou.entries()).map(([entity, dog]) => ({ entity, dog, dir: 'in' as const })),
      ...Array.from(saiu.entries()).map(([entity, dog]) => ({ entity, dog, dir: 'out' as const })),
    ]
    const lider = Math.max(0, ...fluxos.map((f) => f.dog))
    for (const f of fluxos) {
      if (f.dog < lider * 0.02) continue
      out.push({
        id: `${f.dir}-${f.entity}`,
        kind: f.dir === 'in' ? 'exchange_in' : 'exchange_out',
        at: new Date().toISOString(), source: f.entity, dog: f.dog,
        headline: f.dir === 'in'
          ? `${fmt(f.dog)} DOG moved into ${f.entity} in the last 24 hours`
          : `${fmt(f.dog)} DOG left ${f.entity} in the last 24 hours`,
        value: `${fmt(f.dog)} DOG`,
      })
    }

    // ── o que passou pelos mercados ─────────────────────────────────────────
    // ⚠️ FRASE DIFERENTE DE PROPÓSITO. Entrar numa corretora é pressão de venda;
    // passar por um mercado é só volume negociado, e os dois na mesma frase
    // enganariam quem lê. Os mercados ainda não têm nome próprio, então a soma
    // sai agregada, que é o que a prova sustenta.
    if (mercado > 0) {
      out.push({
        id: 'marketplace-24h', kind: 'whale', at: new Date().toISOString(), source: 'our index', dog: mercado,
        headline: `${fmt(mercado)} DOG changed hands on marketplaces in the last 24 hours`,
        value: `${fmt(mercado)} DOG`,
      })
    }

    // ── a mesa ──────────────────────────────────────────────────────────────
    if (mesaMandou > 0) {
      const destino = Array.from(mesaPara.entries()).sort((a, b) => b[1] - a[1])[0]
      out.push({
        id: 'desk-24h', kind: 'exchange_in', at: new Date().toISOString(), source: 'our index', dog: mesaMandou,
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
    // ⚠️ `total_dog_moved` É BRUTO NESTA TABELA, e ler essa coluna aqui pôs a
    // mesma manchete de 1.27B no ar em 31/08 e 02/09 com txid diferente: a
    // carteira bc1plzs2ll… reembala o próprio UTXO de tempos em tempos, e o
    // bruto conta o troco como se fosse transferência. Nas 24h dessa segunda
    // leitura havia 2.88B de auto-transferência com líquido ZERO contra 177M de
    // movimento real, e a maior transferência de verdade era 20M.
    //
    // ⚠️ A COLUNA HONESTA É `net_transfer`, e ela existe porque as duas pontas do
    // pipeline discordam: o scanner grava o bruto em `total_dog_moved`, a rota
    // `update-transactions` grava o líquido na mesma coluna. Uma coluna com duas
    // convenções não serve de manchete. Heatmap, busca e extrato já leem
    // `net_transfer`; o feed era o último a ler o número errado.
    //
    // ⚠️ E `self_transfer` FICA DE FORA POR NOME, não só por número. Líquido zero
    // já a derrubaria, mas dizer o motivo evita que a próxima pessoa "conserte" o
    // filtro achando que ele é redundante.
    const maior = txs.find((t: any) => t.type !== 'self_transfer' && Number(t.net_transfer) > 0)
    if (maior) {
      out.push({
        id: `big-${maior.txid}`, kind: 'whale', at: maior.timestamp, source: 'our index',
        dog: Number(maior.net_transfer),
        headline: `Largest transfer of the day: ${fmt(Number(maior.net_transfer))} DOG`,
        value: `${fmt(Number(maior.net_transfer))} DOG`,
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
        id: 'donation-24h', kind: 'donation', at: new Date().toISOString(), source: 'our index', dog: doado,
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
        id: 'mempool-now', kind: 'mempool', at: new Date().toISOString(), source: 'our node', dog: emVoo,
        headline: `${pend.length} DOG transaction${pend.length === 1 ? '' : 's'} waiting for a block, carrying ${fmt(emVoo)} DOG`,
        value: `${pend.length} tx`,
        href: '/transactions',
      })
    }

    // ⚠️ A ORDEM FINAL É UMA SÓ: magnitude de DOG, decrescente, tudo competindo.
    // Nenhuma seção tem assento cativo; num dia de saque grande o verde lidera
    // porque foi o que a cadeia fez, e é isso que a regra editorial pede.
    out.sort((a, b) => (b.dog ?? 0) - (a.dog ?? 0))
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
