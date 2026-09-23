// ═══════════════════════════════════════════════════════════════════════════
// A PALETA E OS NOMES DO MAPA NAVEGÁVEL.
//
// Linguagem de plot-map ESCURO (gosto do fundador): fundo quase preto, relevo
// em cinza quente, água em azul fundo, e o loteamento em tons por setor. O
// laranja da marca (#E8660D) é DESTAQUE: seleção e a Orla Nobre, que é o
// endereço mais nobre da cidade e tem só 505 lotes. Nada de lava (#F56E0F) em
// área grande, verde só para status (por isso parque é cáqui e não verde),
// roxo banido.
//
// ⚠️ NOME PÚBLICO VEM DE UM LUGAR SÓ. Bairro e tipologia são importados de
// app/dogcity/dogcity-data.ts, que é o que a escritura da landing imprime; o
// mapa não pode chamar o setor 7 de uma coisa e a escritura de outra.
// ═══════════════════════════════════════════════════════════════════════════
import { BAIRRO_DO_SETOR, TIPOLOGIA_DA_FORMA, linkDoMapa } from '@/app/dogcity/dogcity-data'

export { BAIRRO_DO_SETOR, TIPOLOGIA_DA_FORMA, linkDoMapa }

export const LARANJA = '#E8660D'
export const CREME = '#EDE6D6'
export const FUNDO = '#0A0A0C'
export const AGUA = '#122A3C'
export const CIANO_DSC = '#7FD4E0'

/** a cor de cada setor do registro (1..9). Nove tons distinguíveis sobre
 *  fundo escuro, sem verde nem roxo. S03 e S05 são os maiores (23 mil lotes
 *  cada) e ficam nos neutros; os três bairros nomeados levam as cores fortes. */
export const COR_SETOR: Readonly<Record<number, string>> = {
  1: '#E0B96B', // areia
  2: '#C87A4B', // terracota
  3: '#D8CDBB', // osso
  4: '#B87C7C', // rosa seco
  5: '#7FA7C5', // azul aço
  6: '#A48C6E', // taupe
  7: LARANJA,   // The Spit (Orla Nobre)
  8: '#F2C14E', // Financial District
  9: '#6FC3D4', // Bay Shore
}

/** o nome que a tela escreve para um setor: os três bairros publicados têm
 *  nome; o tecido (1 a 6) é só o número, como na escritura. */
export function nomeDoSetor(s: number): string {
  return BAIRRO_DO_SETOR[s] ?? `Sector ${s}`
}

export const CODIGO_SETOR = (s: number) => `S${String(s).padStart(2, '0')}`

/** as bandas radiais do tecido (cidade-malha quartos[].nome), em inglês */
export const BANDA_EN: Readonly<Record<string, string>> = {
  Nucleo: 'Core',
  Meio: 'Middle',
  Bairro: 'Quarter',
  Borda: 'Edge',
  Horizonte: 'Horizon',
}

/** classe de peça do programa: rótulo em inglês e cor de preenchimento */
export const TIPO_PROGRAMA: Readonly<Record<string, { en: string; cor: string }>> = {
  jardim: { en: 'garden', cor: '#A69B63' },
  floresta: { en: 'forest', cor: '#8E8A5A' },
  lazer: { en: 'leisure', cor: '#A69B63' },
  esporte: { en: 'sports', cor: '#C99A5B' },
  civico: { en: 'civic', cor: '#D9C39A' },
  industria: { en: 'industry', cor: '#8A8A93' },
  transporte: { en: 'transport', cor: '#6E7C8C' },
  distribuicao: { en: 'distribution', cor: '#7A7570' },
  agua: { en: 'water', cor: '#2B5C78' },
  infra: { en: 'infrastructure', cor: '#6B6B78' },
  financeiro: { en: 'finance', cor: '#F2C14E' },
  ancora: { en: 'landmark', cor: '#C99A5B' },
}

/** nome em inglês por id de peça. O que não estiver aqui sai com o nome do
 *  registro (português), que é melhor do que inventar uma tradução na hora. */
export const NOME_PECA_EN: Readonly<Record<string, string>> = {
  GF01: 'Golf Course',
  VP01: 'West Lake',
  VP02: 'Extraction Forest',
  VP03: 'West Station',
  A01: 'Central Park and Greater Lake',
  A02: 'Botanical Garden',
  A03: 'Cohorts Garden',
  A04: 'West Lake',
  A05: "Founders' Walk",
  E01: 'Olympic Park',
  E02: 'DOG Derby',
  E03: '$DOG Arena',
  F01: 'Financial District',
  G01: 'Runestone Park Gate',
  IN01: 'Ilmenite Processing',
  IN02: 'Hydrogen Reduction',
  IN03: 'Regolith Electrolysis',
  IN04: 'Volatiles Plant (He-3, H2, C, N2)',
  IN05: 'Foundry and Rolling Mill',
  IN06: 'Solar Cell Factory',
  IN07: 'Block Sintering',
  IN08: 'Oxygen Tanks',
  B01: 'East Solar Field',
  B02: 'Belt Reservoir',
  B03: 'Southeast Marshalling Yard',
  B04: 'Radiator Field',
  B05: 'Belt Allotments',
  B06: 'South Solar Field',
  B07: 'Regolith Depot',
  B08: 'South Training Ground',
  B09: 'West Reservoir',
  B10: 'West Solar Field',
  B11: 'West Marshalling Yard',
  B12: 'West Allotments',
  B13: 'North Training Ground',
  B14: 'North Solar Field',
  B15: 'Belt Lookout',
  B16: 'North Depot',
  C01: 'DOG University',
  C02: 'General Hospital and Helipad',
  C03: 'Municipal Theatre',
  C04: 'Rune Museum',
  C05: 'City Hall',
  C06: 'The Mint',
  C07: 'DOG DATA HQ',
  C08: 'Lost DOG Memorial',
  C09: 'Municipal Market',
  C10: 'Belt Observatory',
  C11: 'Gate Lighthouse',
  C12: 'Colossus of the Gate',
  D01: 'Dome Gate',
  D02: 'Customs and Sorting',
  D03: 'Container Yard',
  D04: 'Distribution Centre 1',
  D05: 'Distribution Centre 2',
  D06: 'Distribution Centre 3',
  D07: 'Distribution Centre 4',
  D08: 'Distribution Centre 5',
  D09: 'Distribution Centre 6',
  D10: 'Distribution Centre 7',
  D11: 'Distribution Centre 8',
  D12: 'Distribution Centre 9',
  D13: 'Distribution Centre 10',
  D14: 'Distribution Centre 11',
  D15: 'Distribution Centre 12',
  K01: 'The Columbarium',
  AU1A: 'Expressway 1 Portal',
  AU1B: 'Expressway 1 Portal',
  AU2A: 'Expressway 2 Portal',
  AU2B: 'Expressway 2 Portal',
  AU3A: 'Expressway 3 Portal',
  AU3B: 'Expressway 3 Portal',
  // as sete âncoras de mapa-v1.json (têm polígono e id próprio)
  ESTADIO: '$DOG Arena',
  GEODE: 'The Geode',
  SPHERE: 'The Sphere',
  CAMPUS: 'Sports Campus',
  ATLETISMO: 'DOG Athletics',
  AQUATICS: 'DOG Aquatics',
  DERBY: 'DOG Derby',
}

/** os anéis viários (cidade.json aneis[].id), em inglês */
export const NOME_ANEL_EN: Readonly<Record<string, string>> = {
  AN1: 'Inner Ring',
  AN2: 'Middle Ring',
  AN3: 'Outer Ring',
  AN4: 'Belt Avenue',
  AN5: 'Dock Avenue',
  AN6: 'Outflow Avenue',
  AN7: 'Spit Avenue',
}

export const fmtInt = (n: number) => Math.round(n).toLocaleString('en-US')
export const fmtM = (n: number, casas = 1) =>
  n.toLocaleString('en-US', { minimumFractionDigits: casas, maximumFractionDigits: casas })
