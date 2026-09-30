// Posse ATUAL de um Ordinal oficial do DOG SOCIAL CLUB, para a porta do lounge
// da sede KRAY•SPACE no DOGCITY (app/api/dogcity/dsc-access). Modulo puro: as
// fontes entram por parametro (a rota liga as de verdade), para o teste rodar
// em Node sem rede (scripts/salas.test.mjs).
//
// A REGRA: pelo menos um dos 306 IDs de dsc-colecao.ts (filhos diretos do pai
// da colecao, conferidos em 29/09 contra ordinals.com /r/children e a lista da
// propria Kray) na carteira da SESSAO, agora. Nada de nome, imagem, rune DOG,
// token DSC ou NFT de L2; nada que o cliente mande. Item anunciado a' venda que
// continua no UTXO do dono (as listagens da Kray sao PSBT) continua dele: o ord
// devolve o endereco do dono.
//
// COMO (revisao de 30/09, depois do falso negativo relatado):
//   1. a LISTA do endereco vem de UMA fonte por vez, na ordem dada (a rota:
//      UniSat se houver token, depois a Kray, depois o ord). Fonte que cai, a
//      proxima assume; a paginacao segue o cursor da propria fonte (UniSat anda
//      em LINHAS: lib/ordinals/inscriptions.ts, lerPaginaUnisat);
//   2. o candidato e' CONFERIDO no ord (/r/inscription/<id> -> address): so'
//      vale se o dono atual for o endereco da sessao;
//   3. nenhuma fonte de lista respondeu, carteira grande demais para varrer, ou
//      nenhuma conferencia respondeu: `indisponivel` (a rota responde 503 e
//      NENHUMA autorizacao nova nasce). Indisponivel nunca vira "sem posse".

import { DSC_IDS } from './dsc-colecao'

export interface InscricaoListada {
  id: string
  number: number
}

export interface FonteLista {
  nome: string
  /** uma pagina: `proximo` e' o cursor da proxima (na unidade da fonte) */
  listar(endereco: string, cursor: number, tamanho: number): Promise<{ items: InscricaoListada[]; total: number; proximo: number }>
}

export interface FontesDsc {
  listas: FonteLista[]
  /** dono atual da inscricao numa fonte independente; null = a fonte nao respondeu */
  dono(id: string): Promise<string | null>
}

export type ResultadoDsc =
  | { status: 'holder'; inscricao: { id: string; numero: number | null }; fonte: string }
  | { status: 'sem_posse'; fonte: string; varridas: number }
  | { status: 'indisponivel'; motivo: 'indexador' | 'conferencia' | 'carteira_grande' }

const TAMANHO = 100
const MAX_PAGINAS = 30
const CONFERIR_ATE = 3

const OFICIAIS = new Set(DSC_IDS)

export function eOficialDsc(id: string): boolean {
  return OFICIAIS.has(id)
}

/** bech32 sem caixa; base58 exato */
export function mesmoEndereco(a: string, b: string): boolean {
  const bech = /^(bc1|tb1)/i
  return bech.test(a) && bech.test(b) ? a.toLowerCase() === b.toLowerCase() : a === b
}

/** Varre a lista de UMA fonte ate' o fim (ou ate' achar candidatos suficientes). Lanca se a fonte cair. */
async function varrer(endereco: string, fonte: FonteLista): Promise<{ candidatos: InscricaoListada[]; tudo: boolean; varridas: number }> {
  const candidatos: InscricaoListada[] = []
  const vistos = new Set<string>()
  let cursor = 0
  let varridas = 0
  for (let pagina = 0; pagina < MAX_PAGINAS; pagina++) {
    const res = await fonte.listar(endereco, cursor, TAMANHO)
    for (const it of res.items) {
      if (vistos.has(it.id)) continue
      vistos.add(it.id)
      varridas++
      if (OFICIAIS.has(it.id)) candidatos.push(it)
    }
    // o cursor precisa andar (senao a fonte repete a pagina): fim
    if (res.proximo <= cursor || res.proximo >= res.total || res.items.length === 0) return { candidatos, tudo: true, varridas }
    cursor = res.proximo
    if (candidatos.length >= CONFERIR_ATE) return { candidatos, tudo: false, varridas }
  }
  return { candidatos, tudo: false, varridas }
}

export async function verificarDsc(endereco: string, fontes: FontesDsc): Promise<ResultadoDsc> {
  let achou: { candidatos: InscricaoListada[]; tudo: boolean; varridas: number; fonte: string } | null = null
  for (const f of fontes.listas) {
    try {
      const r = await varrer(endereco, f)
      achou = { ...r, fonte: f.nome }
      break
    } catch {
      // esta fonte caiu: a proxima assume
    }
  }
  if (!achou) return { status: 'indisponivel', motivo: 'indexador' }
  // varreu tudo e nao achou: sem posse. Parou no teto antes do fim: nao da' para afirmar
  if (achou.candidatos.length === 0) return achou.tudo ? { status: 'sem_posse', fonte: achou.fonte, varridas: achou.varridas } : { status: 'indisponivel', motivo: 'carteira_grande' }
  let conferiuAlgum = false
  for (const c of achou.candidatos.slice(0, CONFERIR_ATE)) {
    let dono: string | null
    try {
      dono = await fontes.dono(c.id)
    } catch {
      dono = null
    }
    if (dono === null) continue
    conferiuAlgum = true
    if (mesmoEndereco(dono, endereco)) return { status: 'holder', inscricao: { id: c.id, numero: Number.isFinite(c.number) && c.number > 0 ? c.number : null }, fonte: achou.fonte }
  }
  // a lista mostrou, mas o ord diz que o dono e' outro (transferencia): sem posse.
  // Nenhuma conferencia respondeu: nao da' para afirmar nada.
  return conferiuAlgum ? { status: 'sem_posse', fonte: achou.fonte, varridas: achou.varridas } : { status: 'indisponivel', motivo: 'conferencia' }
}
