// Saldo CONFIRMADO da rune DOG•GO•TO•THE•MOON em Bitcoin L1, para a porta da
// sala DOG DAO da sede KRAY•SPACE no DOGCITY (app/api/dogcity/dao-access).
// Modulo puro: as fontes entram por parametro (scripts/salas.test.mjs roda sem rede).
//
// A REGRA: saldo confirmado > 0 da rune 840000:3 no endereco da SESSAO (o que a
// carteira provou com a assinatura do desafio). Identidade da rune conferida em
// 29/09 em duas fontes: ordinals.com/rune/DOG•GO•TO•THE•MOON (id 840000:3,
// numero 3, divisibilidade 5, simbolo 🐕) e kray.space/api/explorer/rune/840000:3.
// NAO contam: outra rune com "DOG" no nome, saldo DOG da KRAY L2, saldo nao
// confirmado, snapshot antigo, endereco que o cliente mandou sem prova.
//
// Fontes, na ordem da rota (lib/dogcity/fontes-l1.ts):
//   ord   runes_balances e' por NOME espacado; nome de rune e' unico no
//         protocolo, entao DOG_NOME <-> DOG_RUNE_ID e' 1:1 (conferido acima).
//         O ord so' indexa blocos confirmados.
//   Kray  runas por UTXO com runeId; so' UTXO com status.confirmed conta.
// A primeira fonte que responde decide. Nenhuma respondeu: `indisponivel` (a
// rota responde 503 e nenhuma autorizacao nasce). Indisponivel nunca vira "sem DOG".

export const DOG_RUNE_ID = '840000:3'
export const DOG_NOME = 'DOG•GO•TO•THE•MOON'

export interface FonteSaldo {
  nome: string
  /** saldo confirmado em unidades da rune (qualquer escala: so' o > 0 importa); lanca se a fonte nao respondeu */
  saldo(endereco: string): Promise<bigint>
}

export type ResultadoDog =
  | { status: 'holder'; fonte: string }
  | { status: 'sem_posse'; fonte: string }
  | { status: 'indisponivel'; motivo: 'fontes' }

export async function verificarDog(endereco: string, fontes: FonteSaldo[]): Promise<ResultadoDog> {
  for (const f of fontes) {
    let s: bigint
    try {
      s = await f.saldo(endereco)
    } catch {
      continue
    }
    return s > 0n ? { status: 'holder', fonte: f.nome } : { status: 'sem_posse', fonte: f.nome }
  }
  return { status: 'indisponivel', motivo: 'fontes' }
}

/** "8481988.12921" -> 848198812921 (divisibilidade 5); qualquer lixo -> 0 */
export function unidadesDog(decimal: string): bigint {
  const m = /^(\d+)(?:\.(\d{0,5}))?/.exec(decimal.trim())
  if (!m) return 0n
  return BigInt(m[1]!) * 100000n + BigInt((m[2] ?? '').padEnd(5, '0') || '0')
}

/** A fonte ord: o saldo do NOME espacado exato (so' confirmados). */
export function fonteOrdDog(ler: (e: string) => Promise<{ runas: Array<[string, string]> }>): FonteSaldo {
  return {
    nome: 'ord',
    async saldo(endereco) {
      const r = await ler(endereco)
      let total = 0n
      for (const [nome, qtd] of r.runas) if (nome === DOG_NOME) total += unidadesDog(qtd)
      return total
    },
  }
}

/** A fonte Kray: soma das runas 840000:3 nos UTXOs confirmados. */
export function fonteKrayDog(ler: (e: string) => Promise<Array<{ confirmado: boolean; runas: Array<{ id: string; quantidade: bigint }> }>>): FonteSaldo {
  return {
    nome: 'kray',
    async saldo(endereco) {
      const utxos = await ler(endereco)
      let total = 0n
      for (const u of utxos) {
        if (!u.confirmado) continue
        for (const r of u.runas) if (r.id === DOG_RUNE_ID) total += r.quantidade
      }
      return total
    },
  }
}
