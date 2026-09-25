import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { isValidAddress } from '@/app/api/holders/tree/_shared'
import { resolveIdentity } from '@/lib/dog/identity'
import { escrituras, buscarEscritura } from '@/lib/city/escrituras'
import {
  CORTE_CEMITERIO_DOG, CORTE_CEMITERIO_PUBLICADO, LAPIDES,
  BAIRRO_DO_SETOR, TIPOLOGIA_DA_FORMA, COLUMBARIO_NOME, linkDaCidade,
} from '@/app/dogcity/dogcity-data'

// ═══════════════════════════════════════════════════════════════════════════
// A ROTA DA DOBRA 1 (marketing/LANDING-V3-DESENHO.md). Devolve o que a carteira
// do visitante já é, a partir da tabela pública `dog_snapshot_lookup`, e DESDE
// 23/09/2026 também ONDE o lote fica, a partir do registro selado.
//
// DUAS FONTES, E CADA UMA RESPONDE UMA COISA:
//   * `dog_snapshot_lookup` (Supabase): as sete colunas públicas: dog, area_m2,
//     destino, genesis, runestones, utxo_count, bloco. É quem decide o STATUS.
//   * `public/city/escrituras.bin` (arquivo servido pelo próprio app, gerado por
//     scripts/city/gerar_escrituras.mjs a partir de data/dogcity_lotes.csv e
//     data/dogcity_cemiterio.csv): lot_id, setor, forma, coordenada, cota. É
//     quem responde a POSIÇÃO. Nunca banco: a cidade está fechada e selada
//     (merkle 2178966f…0ebe) e o CSV que ela lê é o mesmo que o root sela.
//
// ⚠️ A POSIÇÃO ERA PROIBIDA AQUI ATÉ 22/09 (masterplan §3.12, §14: "só entra o
// que pode ser público"). O argumento morreu quando a cidade fechou: o CSV
// inteiro está público no GitHub com endereço, lot_id e coordenada, então esta
// rota devolver lot_id e setor não vaza nada novo. O que ela NÃO devolve por
// padrão é a coordenada crua: só com `?full=1`, para quem for desenhar.
//
// ⚠️ SE O ARQUIVO FALTAR, A ROTA CONTINUA. `position: "unavailable"` no JSON e
// o resto igual ao que sempre foi. Nunca inventa lot_id; nunca cai em 503 por
// causa da posição. A carga do índice tem teto próprio (POSICAO_MS) e roda em
// paralelo com o Supabase: se não estiver pronta a tempo, esta resposta sai sem
// posição e a próxima já acha o índice em cache.
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
// ⚠️ E A TABELA NÃO CUMPRIU ESSA DECISÃO. Medido em 23/09/2026, amostra de 36
// lotes de carteira pela própria rota: em 34 o `area_m2` da tabela era a CURVA
// (igual ao alvo até o centésimo), não a área gravada; o registro selado dava
// 859 m² onde a tabela dizia 930,51. Ou a recarga de 22/09 nunca subiu, ou a
// regeneração de 23/09 01:04 a deixou para trás. Por isso, desde 23/09, quando
// o índice responde `area_m2` SAI DO REGISTRO SELADO e o valor da tabela só
// aparece como `area_m2_table`, e só quando diverge, para quem for conferir.
// A tabela continua sendo quem decide o STATUS (destino, dog, genesis...).
//
// ⚠️ QUEM ENCHE A TABELA É `scripts/city/sobe_lookup.py`, E SÓ O FUNDADOR RODA.
// Esta rota não escreve no banco, nunca. Enquanto a tabela não for recarregada
// do CSV selado, `area_m2_table` é o alarme visível da defasagem.
//
// QUATRO RESPOSTAS, e a ordem de checagem importa:
//   1. exchange:  o endereço bate com `dog_labels` (o que a casa deduziu da
//                   cadeia) ou com `verified_addresses.json` (o que a própria
//                   entidade confirmou). Checada PRIMEIRO: uma corretora que
//                   por acaso também está no snapshot (custódia agregada tem
//                   saldo) deve ouvir o aviso de custódia, não "you own this".
//   2. memorial: a carteira estava no bloco e o saldo dela não alcança o MENOR
//                LOTE da cidade (24 m², masterplan §17). Ela recebe lápide no
//                cemitério, não lote, e a tela não pode anunciar metro quadrado
//                para ela. Checada antes de `in_snapshot` porque as duas leem a
//                mesma linha da tabela. Ganha `headstone` (id e link /city?addr=).
//   3. in_snapshot: a carteira está em `dog_snapshot_lookup` e alcança o lote.
//                Ganha `lot` (lot_id, setor, bairro, tipologia, link /city?addr=).
//   4. not_in_snapshot: nenhuma das anteriores.
//
// ⚠️ QUEM DECIDE O RAMO É A TABELA, NÃO O ÍNDICE. Se um dia os dois divergirem
// (a tabela diz lápide e o índice diz lote, ou vice-versa), a posição sai como
// indisponível em vez de a rota escolher um lado: os dois nascem do mesmo CSV
// e divergência é defeito de carga, não empate a desempatar aqui.
//
// ⚠️ A MENSAGEM NÃO DIZ SÓ "exchange". `dog_labels` também classifica bridge,
// marketplace, swap_pool, desk e treasury (lib/dog/taxonomy.ts); chamar uma
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

// teto só da posição: o índice carrega em paralelo com o Supabase e, se não
// chegar até aqui, a resposta sai sem posição e a próxima já o acha em cache.
// Medido em 23/09: leitura local do .bin de 3 MiB fica abaixo de 10 ms; o
// fallback pela rede (cold start na Vercel sem o arquivo rastreado) é que
// pode passar de 1 s, e é para ele que este teto existe.
const POSICAO_MS = 1500

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
  const full = req.nextUrl.searchParams.get('full') === '1'

  // bech32 é insensível a caixa mas canonicamente minúsculo; base58 (1.../3...)
  // É sensível a caixa e não pode ser normalizado. Mesma regra de
  // app/api/profile/route.ts.
  const address = raw.toLowerCase().startsWith('bc1') ? raw.toLowerCase() : raw

  if (!isValidAddress(address)) {
    return NextResponse.json({ error: 'invalid Bitcoin address' }, { status: 400 })
  }

  // a origem serve só para o plano B do leitor (buscar o .bin pela URL pública
  // quando o fs não o alcança); VERCEL_URL cobre o caso de nextUrl vir sem host
  const origin = req.nextUrl.origin || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
  const indicePromise = escrituras(origin)

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

    // a posição, com teto próprio; null = indisponível agora, nunca erro
    const indice = row
      ? await Promise.race([
          indicePromise.catch(() => null),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), POSICAO_MS)),
        ])
      : null
    const escritura = indice && row ? buscarEscritura(indice, address) : null

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
      const h = escritura?.kind === 'lapide' ? escritura : null
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
        position: h ? 'ok' : 'unavailable',
        ...(h && {
          headstone: {
            id: h.id,
            place: COLUMBARIO_NOME,
            map: linkDaCidade(address),
            ...(full && { x_m: h.x_m, z_m: h.z_m }),
          },
        }),
      })
    }

    // checagem 3: a carteira já tem lote
    if (row) {
      const l = escritura?.kind === 'lote' ? escritura : null
      // a área é a do registro selado quando ele responde (ver o cabeçalho:
      // a tabela ainda serve a curva); a da tabela fica como alarme se divergir
      const areaTabela = Number(row.area_m2)
      const area = l ? l.area_m2 : areaTabela
      const diverge = l !== null && Math.abs(l.area_m2 - areaTabela) >= 1
      return NextResponse.json({
        status: 'in_snapshot',
        address,
        dog: row.dog,
        area_m2: area,
        ...(diverge && { area_m2_table: areaTabela }),
        genesis: row.genesis,
        runestones: row.runestones,
        utxo_count: row.utxo_count,
        block: row.bloco,
        position: l ? 'ok' : 'unavailable',
        ...(l && {
          lot: {
            lot_id: l.lotId,
            sector: l.setor,
            // só três setores têm nome publicado; o tecido é só o número
            district: BAIRRO_DO_SETOR[l.setor] ?? null,
            typology: TIPOLOGIA_DA_FORMA[l.forma] ?? null,
            form: l.forma,
            dsc: l.dsc,
            map: linkDaCidade(address),
            ...(full && { x_m: l.x_m, z_m: l.z_m, elevation_m: l.cota_m }),
          },
        }),
      })
    }

    // checagem 4: chegou depois do bloco 966.670
    return NextResponse.json({ status: 'not_in_snapshot', address })
  } catch {
    return NextResponse.json({ error: 'data backend busy, retry shortly' }, { status: 503 })
  }
}
