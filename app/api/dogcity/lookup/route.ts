import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { isValidAddress } from '@/app/api/holders/tree/_shared'
import { resolveIdentity } from '@/lib/dog/identity'

// ═══════════════════════════════════════════════════════════════════════════
// A ROTA DA DOBRA 1 (marketing/LANDING-V3-DESENHO.md). Devolve o que a carteira
// do visitante já é, a partir da tabela pública `dog_snapshot_lookup`.
//
// ⚠️ NÃO É `/api/plot`. Aquela rota lê `data/snapshots/` com `fs` (que não
// existe no build da Vercel, clonado do GitHub) e importa `lib/city/zones`
// para devolver POSIÇÃO (bairro, distrito, vizinho, tag institucional), que
// não pode ir a público (masterplan.md §3.12, §14). Esta rota só lê as seis
// colunas públicas de `dog_snapshot_lookup`: dog, area_m2, genesis,
// runestones, utxo_count, bloco. Nada de posição sai daqui, nunca.
//
// TRÊS RESPOSTAS, e a ordem de checagem importa:
//   1. exchange   — o endereço bate com `dog_labels` (o que a casa deduziu da
//                   cadeia) ou com `verified_addresses.json` (o que a própria
//                   entidade confirmou). Checada PRIMEIRO: uma corretora que
//                   por acaso também está no snapshot (custódia agregada tem
//                   saldo) deve ouvir o aviso de custódia, não "you own this".
//   2. in_snapshot — a carteira está em `dog_snapshot_lookup`.
//   3. not_in_snapshot — nenhuma das duas.
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
          .select('address, dog, area_m2, genesis, runestones, utxo_count, bloco')
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

    // checagem 2: a carteira já tem lote
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

    // checagem 3: chegou depois do bloco 966.670
    return NextResponse.json({ status: 'not_in_snapshot', address })
  } catch {
    return NextResponse.json({ error: 'data backend busy, retry shortly' }, { status: 503 })
  }
}
