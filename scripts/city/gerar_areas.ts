/**
 * A ÁREA DE CADA LOTE (20/11/2026): gera data/dogcity_lot_areas.json a partir da geometria de verdade dos lotes (dogcity-mundo
 * plano/saida/lotes.json). O lazer da propriedade unida vem da área (lib/dog/property-merge.ts REGUA_DO_LAZER). O arquivo NÃO tem
 * endereço (só lot_id): pode ir para o repo público e para a função da rota.
 *
 * Uso:
 *   npx tsx scripts/city/gerar_areas.ts --lotes ../dogcity-mundo/plano/saida/lotes.json [--saida data/dogcity_lot_areas.json]
 */
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { arquivoDeAreas, type LoteGeo } from '../../lib/dog/lot-property'

const args = process.argv.slice(2)
const opcao = (nome: string) => { const i = args.indexOf(`--${nome}`); return i >= 0 ? args[i + 1] : undefined }
const lotesPath = opcao('lotes') ?? path.join('..', 'dogcity-mundo', 'plano', 'saida', 'lotes.json')
const saida = opcao('saida') ?? path.join('data', 'dogcity_lot_areas.json')

const bruto = readFileSync(lotesPath)
const sha = createHash('sha256').update(bruto).digest('hex')
const j = JSON.parse(bruto.toString('utf8')) as { lotes?: { lot_id?: unknown; cantos?: unknown }[] }
if (!Array.isArray(j.lotes)) throw new Error(`${lotesPath}: sem a lista "lotes"`)
const lotes: LoteGeo[] = j.lotes.flatMap((l) =>
  typeof l?.lot_id === 'string' && Array.isArray(l.cantos) ? [{ lotId: l.lot_id, cantos: l.cantos as LoteGeo['cantos'] }] : [])
const arq = arquivoDeAreas(lotes, `dogcity-mundo plano/saida/lotes.json sha256 ${sha} (${lotes.length} lotes)`)
writeFileSync(saida, JSON.stringify(arq) + '\n')
process.stderr.write(`${arq.lotes} lotes -> ${saida}\n`)
