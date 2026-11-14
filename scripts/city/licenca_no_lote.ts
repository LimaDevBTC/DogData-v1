/**
 * LICENÇA NO LOTE: a migração de dados (12/11/2026, LICENCA_NO_LOTE_CONTRATO.md).
 *
 * Cada carteira com licença hoje -> o lote dela no snapshot 966.670, com source 'migration'. Este script NÃO
 * escreve no banco: GERA o SQL, que o fundador roda no SQL Editor do Supabase DEPOIS da migração 037.
 *
 *   fonte do que cada carteira conta: o placar público (/api/donate/leaderboard: `leaderboard` + `btc_licences`,
 *                                     campo `licence_total` = DOG do livro + BTC creditado, a conta de
 *                                     standingOfWallet), lido da URL ou de um arquivo salvo (--placar)
 *   fonte do lote:                    data/dogcity_lotes.csv (o registro selado: lot_id, address)
 *
 * IDEMPOTENTE: cada linha é `select dogcity_licence_apply(..., 'migration', 'migration:<carteira>', 0)`. Só
 * entra se a carteira ainda não aplicou NADA (p_applied_before = 0) e se o ref ainda não existe. Rodar de
 * novo, ou rodar depois que a aplicação automática já pôs o crédito num lote, não muda nada. Crédito que
 * chegar entre gerar e rodar vira crédito livre e a aplicação automática o põe no lote.
 *
 * Uso:
 *   npx tsx scripts/city/licenca_no_lote.ts --saida /tmp/licenca_no_lote.sql
 *   npx tsx scripts/city/licenca_no_lote.ts --placar placar.json --saida /tmp/licenca_no_lote.sql
 *   --parciais   inclui também o crédito abaixo de Personal (o contrato migra só quem tem licença)
 * O resumo sai no stderr; o SQL no arquivo (ou no stdout sem --saida).
 */
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { planoDeMigracao, sqlDaMigracao, type PlacarLinha } from '../../lib/dog/licence-lot'

const PLACAR_URL = 'https://www.dogdata.xyz/api/donate/leaderboard'
const args = process.argv.slice(2)
const opcao = (nome: string) => { const i = args.indexOf(`--${nome}`); return i >= 0 ? args[i + 1] : undefined }
const tem = (nome: string) => args.includes(`--${nome}`)

async function placar(): Promise<{ linhas: PlacarLinha[]; fonte: string }> {
  const arq = opcao('placar')
  const j = arq
    ? JSON.parse(readFileSync(arq, 'utf8'))
    : await fetch(PLACAR_URL, { cache: 'no-store', signal: AbortSignal.timeout(30_000) }).then((r) => {
        if (!r.ok) throw new Error(`placar HTTP ${r.status}`)
        return r.json()
      })
  const lb = Array.isArray(j?.leaderboard) ? j.leaderboard : null
  if (!lb || lb.length === 0) throw new Error('placar sem `leaderboard`: não migro no escuro')
  const btc = Array.isArray(j?.btc_licences) ? j.btc_licences : []
  return { linhas: [...lb, ...btc], fonte: arq ? `arquivo ${arq}` : `${PLACAR_URL} (${j.last_updated ?? 'sem hora'})` }
}

function lotesDoSnapshot(): Map<string, { lotId: string; address: string }> {
  const csv = readFileSync(path.join(__dirname, '..', '..', 'data', 'dogcity_lotes.csv'), 'utf8').split('\n')
  const cab = csv[0].split(',')
  if (cab[0] !== 'lot_id' || cab[1] !== 'address') throw new Error('data/dogcity_lotes.csv: cabeçalho inesperado')
  const m = new Map<string, { lotId: string; address: string }>()
  for (const linha of csv.slice(1)) {
    if (!linha) continue
    const [lotId, address] = linha.split(',', 2)
    const k = address.toLowerCase()
    // "no snapshot nenhuma carteira tem mais de um lote": se tiver, é defeito do registro, não migração
    if (m.has(k)) throw new Error(`carteira com dois lotes no registro: ${address}`)
    m.set(k, { lotId, address })
  }
  return m
}

async function main() {
  const { linhas, fonte } = await placar()
  const lotes = lotesDoSnapshot()
  const plano = planoDeMigracao(linhas, (a) => lotes.get(a) ?? null, { parciais: tem('parciais') })
  const porDegrau: Record<string, number> = {}
  for (const l of plano.linhas) porDegrau[l.tier ?? 'below personal'] = (porDegrau[l.tier ?? 'below personal'] ?? 0) + 1
  const sql = sqlDaMigracao(plano.linhas, [
    'Licença no lote: migração de dados (scripts/city/licenca_no_lote.ts). Rodar DEPOIS da migração 037.',
    `Gerado em ${new Date().toISOString()} a partir de ${fonte} e data/dogcity_lotes.csv (snapshot 966.670).`,
    `${plano.linhas.length} carteiras -> o lote do snapshot: ${JSON.stringify(porDegrau)}.`,
    `Fora: ${plano.semLote.length} com licença e sem lote no snapshot (o crédito espera um lote), ${plano.setor8.length} no setor 8, ${plano.parciais} abaixo de Personal (aplicação automática).`,
    'Idempotente: p_applied_before = 0 e ref migration:<carteira>. Rodar de novo não muda nada (devolve null).',
  ])
  const saida = opcao('saida')
  if (saida) writeFileSync(saida, sql)
  else process.stdout.write(sql)
  console.error(`[licenca_no_lote] ${plano.linhas.length} linhas ${JSON.stringify(porDegrau)}`)
  console.error(`[licenca_no_lote] sem lote no snapshot (${plano.semLote.length}): ${plano.semLote.join(' ') || '-'}`)
  console.error(`[licenca_no_lote] setor 8 (${plano.setor8.length}): ${plano.setor8.join(' ') || '-'}`)
  console.error(`[licenca_no_lote] abaixo de Personal, deixadas para a automática: ${plano.parciais}`)
  if (saida) console.error(`[licenca_no_lote] SQL em ${saida}`)
}

main().catch((e) => { console.error('[licenca_no_lote]', (e as Error).message); process.exit(1) })
