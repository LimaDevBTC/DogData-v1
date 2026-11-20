// ═══════════════════════════════════════════════════════════════════════════
// A ÁREA DE CADA LOTE, SÓ NO SERVIDOR (o lazer da propriedade vem da área, 20/11/2026).
//
// `data/dogcity_lot_areas.json` (SEM endereço) é gerado por scripts/city/gerar_areas.ts a partir dos cantos de verdade dos lotes
// (dogcity-mundo plano/saida/lotes.json). Sem o arquivo o leitor devolve null e a prévia cai no mínimo da régua (a piscina): nunca
// promete o que a área não confirmou.
// ═══════════════════════════════════════════════════════════════════════════
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { lerAreas, type AreaDe } from '@/lib/dog/lot-property'

let tabela: AreaDe | null = null
let carregando: Promise<AreaDe | null> | null = null
let falhouEm = 0

async function carregar(): Promise<AreaDe | null> {
  try {
    // ⚠️ caminho literal: o rastreio de arquivos do Next só segue path.join(process.cwd(), '<literal>')
    const txt = await readFile(path.join(process.cwd(), 'data', 'dogcity_lot_areas.json'), 'utf8')
    return lerAreas(JSON.parse(txt))
  } catch {
    return null
  }
}

export async function areasDosLotes(): Promise<AreaDe | null> {
  if (tabela) return tabela
  if (falhouEm && Date.now() - falhouEm < 60_000) return null
  if (!carregando) {
    carregando = carregar().then((t) => {
      if (t) tabela = t
      else falhouEm = Date.now()
      carregando = null
      return t
    })
  }
  return carregando
}
