import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { cityTier, type CityTier } from '@/lib/airdrop-tiers'

// ═══════════════════════════════════════════════════════════════════════════
// TIER, DISTRITO E RUA DE CADA LOTE, SÓ NO SERVIDOR (landing v3, 18/10/2026).
//
// `data/dogcity_lot_info.json` (4 MB, 70.714 lotes, SEM endereço) é gerado pelo
// mesmo código que desenha a escritura (dogcity-mundo plano/carta: dadosDoLote +
// viaDoLado, cidade dogcity-966670-v1) e copiado para cá por
// scripts/landing/sync-v3.mjs. Formato:
//   { campos: ['tier','distrito','area_m2','rua_frente','acesso','frente_da_para'],
//     lote: { "<lot_id>": [tier, distrito, area_m2, rua_frente|null, [codigo, lado]|null, w|b|p|z|o|null] } }
//
// ⚠️ NUNCA NO BUNDLE DO CLIENTE: quem lê é a rota (/api/dogcity/lookup e
// /api/dogcity/lot). Sem o arquivo, o leitor devolve null e a tela omite as
// linhas de tier e rua; nunca inventa.
// ═══════════════════════════════════════════════════════════════════════════

type Linha = [string, string, number, string | null, [string, string] | null, string | null]

export interface LotInfo {
  tier: CityTier | null
  /** como a escritura imprime: "S09 · BAY SHORE" ou "S01" */
  district: string
  /** só o nome, quando o setor tem nome publicado ("BAY SHORE"); senão null */
  districtName: string | null
  area_m2: number
  /** código da rua de frente ("R14", "AN7", "3.07", "L2195.4", "SHORE") */
  frontRoad: string | null
  /** sem rua de frente: por onde se chega */
  access: { road: string; side: string } | null
  /** sem rua de frente: para o que a frente dá */
  faces: string | null
}

const FRENTE: Record<string, string> = {
  w: 'the water', b: 'the shore', p: 'a park', z: 'the plaza', o: 'open ground',
}

let tabela: Record<string, Linha> | null = null
let carregando: Promise<Record<string, Linha> | null> | null = null
let falhouEm = 0

async function carregar(): Promise<Record<string, Linha> | null> {
  try {
    // ⚠️ caminho literal: o rastreio de arquivos do Next só segue path.join(process.cwd(), '<literal>')
    const txt = await readFile(path.join(process.cwd(), 'data', 'dogcity_lot_info.json'), 'utf8')
    const j = JSON.parse(txt) as { campos?: string[]; lote?: Record<string, Linha> }
    if (j.campos?.join(',') !== 'tier,distrito,area_m2,rua_frente,acesso,frente_da_para' || !j.lote) return null
    return j.lote
  } catch {
    return null
  }
}

export async function lotInfoTable(): Promise<Record<string, Linha> | null> {
  if (tabela) return tabela
  if (carregando) return carregando
  if (falhouEm && Date.now() - falhouEm < 60_000) return null
  carregando = carregar()
    .then((t) => {
      if (t) tabela = t
      else falhouEm = Date.now()
      return t
    })
    .finally(() => { carregando = null })
  return carregando
}

export async function lotInfo(lotId: string): Promise<LotInfo | null> {
  const t = await lotInfoTable()
  const l = t?.[lotId]
  if (!l) return null
  const [tier, distrito, area, rua, acesso, frente] = l
  const nome = distrito.includes('·') ? distrito.split('·').slice(1).join('·').trim() : null
  return {
    tier: cityTier(tier),
    district: distrito,
    districtName: nome || null,
    area_m2: area,
    frontRoad: rua,
    access: acesso ? { road: acesso[0], side: acesso[1] } : null,
    faces: frente ? FRENTE[frente] ?? null : null,
  }
}
