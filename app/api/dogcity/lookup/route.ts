import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { isValidAddress } from '@/app/api/holders/tree/_shared'
import { resolveIdentity } from '@/lib/dog/identity'
import { CORTE_CEMITERIO_DOG, CORTE_CEMITERIO_PUBLICADO, LAPIDES } from '@/app/dogcity/dogcity-data'

// ═══════════════════════════════════════════════════════════════════════════
// A ROTA DA DOBRA 1 (marketing/LANDING-V3-DESENHO.md). Devolve o que a carteira
// do visitante já é, a partir da tabela pública `dog_snapshot_lookup`.
//
// ⚠️ NÃO É `/api/plot`. Aquela rota lê `data/snapshots/` com `fs` (que não
// existe no build da Vercel, clonado do GitHub) e importa `lib/city/zones`
// para devolver POSIÇÃO (bairro, distrito, vizinho, tag institucional), que
// não pode ir a público (masterplan.md §3.12, §14). Esta rota só lê as sete
// colunas públicas de `dog_snapshot_lookup`: dog, area_m2, destino, genesis,
// runestones, utxo_count, bloco. Nada de posição sai daqui, nunca.
//
// 🔒 DECISÃO DO FUNDADOR, 22/09/2026: A RESPOSTA É A ESCRITURA, NÃO A CURVA.
// `area_m2` deixou de ser `clamp(0,986443 × √DOG, 24, 40.000)` e passou a ser
// a área gravada em `data/dogcity_lotes.csv`, que é o que o merkle root sela
// em texto claro. Servir a curva fazia sentido enquanto não havia cidade;
// depois que ela existe é a nossa própria API desmentindo o nosso próprio
// registro. Medido em 22/09: a cidade entrega 0,963 da curva na mediana, ou
// 1.233.074 m² a menos atingindo 65.876 carteiras. A curva continua publicada,
// como ALVO (docs §3), e quem calcula o alvo é a tela, a partir de `dog` e da
// própria `area_m2` (`alvoDaCurva` em app/dogcity/dogcity-data.ts).
//
// ⚠️ QUEM ENCHE A TABELA É `scripts/city/sobe_lookup.py`, E SÓ O FUNDADOR RODA.
// Se aquele script voltar a sair da curva, esta rota não tem como perceber.
//
// QUATRO RESPOSTAS, e a ordem de checagem importa:
//   1. exchange   — o endereço bate com `dog_labels` (o que a casa deduziu da
//                   cadeia) ou com `verified_addresses.json` (o que a própria
//                   entidade confirmou). Checada PRIMEIRO: uma corretora que
//                   por acaso também está no snapshot (custódia agregada tem
//                   saldo) deve ouvir o aviso de custódia, não "you own this".
//   2. memorial: a carteira estava no bloco e o saldo dela não alcança o MENOR
//                LOTE da cidade (24 m², masterplan §17). Ela recebe lápide no
//                cemitério, não lote, e a tela não pode anunciar metro quadrado
//                para ela. Checada antes de `in_snapshot` porque as duas leem a
//                mesma linha da tabela.
//   3. in_snapshot: a carteira está em `dog_snapshot_lookup` e alcança o lote.
//   4. not_in_snapshot: nenhuma das anteriores.
//
// ⚠️ A MENSAGEM NÃO DIZ SÓ "exchange". `dog_labels` também classifica bridge,
// marketplace, swap_pool, desk e treasury (lib/dog/taxonomy.ts) — chamar uma
// tesouraria de "corretora" seria inventar. A rota devolve o NOME e a CLASSE
// que a casa realmente tem (ex.: "Merlin Chain", kind "bridge"), e a seção que
// consome isto escreve a frase em cima do que veio, nunca hardcoded.
// ═══════════════════════════════════════════════════════════════════════════

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// mesmo teto das rotas da árvore (app/api/holders/tree/_shared.ts): a tabela
// é pequena (85.818 linhas, chave primária = address) e a consulta é um
// único eq(), então 5s já é folgado.
const BUDGET_MS = 5000

interface LookupRow {
  address: string
  dog: number
  area_m2: number
  // 'lote' | 'lapide', coluna da migração 031. Pode vir null numa linha escrita
  // antes daquela migração, e é por isso que a checagem 2 tem plano B.
  destino: string | null
  genesis: boolean
  runestones: number
  utxo_count: number
  bloco: number
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('address')?.trim() ?? ''

  // bech32 é insensível a caixa mas canonicamente minúsculo; base58 (1.../3...)
  // É sensível a caixa e não pode ser normalizado. Mesma regra de
  // app/api/profile/route.ts.
  const address = raw.toLowerCase().startsWith('bc1') ? raw.toLowerCase() : raw

  if (!isValidAddress(address)) {
    return NextResponse.json({ error: 'invalid Bitcoin address' }, { status: 400 })
  }

  const timeout = new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), BUDGET_MS))

  try {
    const race = await Promise.race([
      Promise.all([
        supabase
          .from('dog_snapshot_lookup')
          .select('address, dog, area_m2, destino, genesis, runestones, utxo_count, bloco')
          .eq('address', address)
          .maybeSingle(),
        resolveIdentity(address).catch(() => null),
      ]),
      timeout,
    ])

    if (race === 'timeout') {
      return NextResponse.json({ error: 'lookup timed out, try again' }, { status: 503 })
    }

    const [{ data: row, error }, identity] = race as [
      { data: LookupRow | null; error: { message: string } | null },
      Awaited<ReturnType<typeof resolveIdentity>>,
    ]
    if (error) throw new Error(error.message)

    // checagem 1: identidade conhecida (corretora, ponte, mercado...) manda
    // primeiro, mesmo que o mesmo endereço também apareça no snapshot.
    if (identity) {
      return NextResponse.json({
        status: 'exchange',
        address,
        identity_name: identity.name,
        identity_kind: identity.kind,
      })
    }

    // checagem 2: a carteira está no bloco e recebeu lápide, não lote
    // ⚠️ SEM ESTA CHECAGEM A PÁGINA MENTE PARA 15.802 CARTEIRAS. Elas estão no
    // snapshot, então caíam em `in_snapshot` e a tela imprimia "YOUR LOT: X m2"
    // para quem recebe lápide e não lote (masterplan §17).
    //
    // ⚠️ QUEM MANDA É `destino`, NÃO O SALDO. A coluna vem do registro (o
    // arquivo do cemitério), e reconstituir o destino aqui a partir de `dog`
    // seria a rota decidindo de novo uma coisa que a cidade já decidiu: no dia
    // em que o corte da cidade e o corte da rota divergirem por um centésimo,
    // a tela anuncia terra para quem tem lápide e nada no build acusa.
    // O plano B pelo saldo só existe para linha escrita antes da migração 031,
    // onde `destino` vem null.
    const lapide = row && (row.destino === 'lapide'
      || (row.destino == null && Number(row.dog) < CORTE_CEMITERIO_DOG))
    if (row && lapide) {
      return NextResponse.json({
        status: 'memorial',
        address,
        dog: row.dog,
        corte_dog: CORTE_CEMITERIO_PUBLICADO,
        lapides: LAPIDES,
        genesis: row.genesis,
        runestones: row.runestones,
        utxo_count: row.utxo_count,
        block: row.bloco,
      })
    }

    // checagem 3: a carteira já tem lote
    if (row) {
      return NextResponse.json({
        status: 'in_snapshot',
        address,
        dog: row.dog,
        area_m2: row.area_m2,
        genesis: row.genesis,
        runestones: row.runestones,
        utxo_count: row.utxo_count,
        block: row.bloco,
      })
    }

    // checagem 4: chegou depois do bloco 966.670
    return NextResponse.json({ status: 'not_in_snapshot', address })
  } catch {
    return NextResponse.json({ error: 'data backend busy, retry shortly' }, { status: 503 })
  }
}
