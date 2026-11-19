// ═══════════════════════════════════════════════════════════════════════════
// QUEM DIVIDE DIVISA COM QUEM, SÓ NO SERVIDOR (a propriedade, 19/11/2026).
//
// `data/dogcity_lot_vizinhos.json` (uns 640 KB, SEM endereço) é gerado por scripts/city/gerar_vizinhos.ts a
// partir dos cantos de verdade dos lotes (dogcity-mundo plano/saida/lotes.json). A regra está em
// lib/dog/lot-property.ts. Sem o arquivo, o leitor devolve null e cada lote vira uma propriedade sozinha:
// nunca uma união inventada.
// ═══════════════════════════════════════════════════════════════════════════
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { lerVizinhos, type Vizinhanca } from '@/lib/dog/lot-property'

let tabela: Vizinhanca | null = null
let carregando: Promise<Vizinhanca | null> | null = null
let falhouEm = 0

async function carregar(): Promise<Vizinhanca | null> {
  try {
    // ⚠️ caminho literal: o rastreio de arquivos do Next só segue path.join(process.cwd(), '<literal>')
    const txt = await readFile(path.join(process.cwd(), 'data', 'dogcity_lot_vizinhos.json'), 'utf8')
    return lerVizinhos(JSON.parse(txt))
  } catch {
    return null
  }
}

export async function vizinhancaDosLotes(): Promise<Vizinhanca | null> {
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
