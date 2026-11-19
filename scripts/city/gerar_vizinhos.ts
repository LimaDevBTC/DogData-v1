/**
 * A PROPRIEDADE (19/11/2026): gera data/dogcity_lot_vizinhos.json, quem divide divisa com quem, a partir da
 * geometria de verdade dos lotes (dogcity-mundo plano/saida/lotes.json, os 4 cantos de cada lote no quadro do
 * mundo do jogo). A regra é a de lib/dog/lot-property.ts (mesmo quarteirão, uma divisa de pelo menos 2 m).
 *
 * O arquivo NÃO tem endereço (só lot_id): pode ir para o repo público e para a função da rota.
 *
 * Uso:
 *   npx tsx scripts/city/gerar_vizinhos.ts --lotes ../dogcity-mundo/plano/saida/lotes.json [--saida data/dogcity_lot_vizinhos.json]
 * Quem mudar lotes.json no mundo roda de novo e commita o arquivo junto.
 */
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { arquivoDeVizinhos, paresVizinhos, type LoteGeo } from '../../lib/dog/lot-property'

const args = process.argv.slice(2)
const opcao = (nome: string) => { const i = args.indexOf(`--${nome}`); return i >= 0 ? args[i + 1] : undefined }

const lotesPath = opcao('lotes') ?? path.join('..', 'dogcity-mundo', 'plano', 'saida', 'lotes.json')
const saida = opcao('saida') ?? path.join('data', 'dogcity_lot_vizinhos.json')

const bruto = readFileSync(lotesPath)
const sha = createHash('sha256').update(bruto).digest('hex')
const j = JSON.parse(bruto.toString('utf8')) as { lotes?: { lot_id?: unknown; cantos?: unknown }[] }
if (!Array.isArray(j.lotes)) throw new Error(`${lotesPath}: sem a lista "lotes"`)
const lotes: LoteGeo[] = j.lotes.flatMap((l) =>
  typeof l?.lot_id === 'string' && Array.isArray(l.cantos) ? [{ lotId: l.lot_id, cantos: l.cantos as LoteGeo['cantos'] }] : [])

const t0 = Date.now()
const pares = paresVizinhos(lotes)
const arq = arquivoDeVizinhos(pares, `dogcity-mundo plano/saida/lotes.json sha256 ${sha} (${lotes.length} lotes)`)
writeFileSync(saida, JSON.stringify(arq) + '\n')
process.stderr.write(`${lotes.length} lotes, ${pares.size} quarteiroes com vizinhos, ${arq.pares} pares, ${Date.now() - t0} ms -> ${saida}\n`)
