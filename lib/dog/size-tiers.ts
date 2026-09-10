/**
 * A escada de TAMANHO da carteira: whale, shark, dolphin, fish, shrimp, plankton.
 *
 * ⚠️ ELA MORA AQUI, E NÃO EM `taxonomy.ts`, DE PROPÓSITO. O cabeçalho daquele
 * arquivo define a linha divisória do sistema de rótulos: "CLASSE É FUNÇÃO, NÃO
 * TAMANHO", e diz literalmente que `whale` não entra na lista de lá porque a
 * mesma palavra com dois sentidos na mesma tela é como um dado bom vira ruído.
 * Esta escada diz QUANTO a carteira tem; a de lá diz O QUE ela faz. Duas
 * perguntas, dois arquivos.
 *
 * ⚠️ ERA CÓDIGO DUPLICADO, palavra por palavra, em
 * `api/address/bitcoin/[address]/route.ts` e `api/tx/bitcoin/[txid]/route.ts`.
 * As duas cópias ainda estavam idênticas em 10/09/2026, e é justamente esse o
 * momento de unificar: a mesma carteira é rotulada pelas duas rotas (a página
 * de endereço e a página de uma transação que ela assinou), então qualquer
 * divergência futura apareceria como a MESMA carteira com dois tamanhos
 * diferentes em duas telas do mesmo site.
 *
 * ⚠️ E A DESCRIÇÃO NÃO PROMETE MAIS RANKING. As cópias antigas diziam "Top 10
 * holder", "Top 50", "Top 100", "Top 1,000" e "Top 10,000", números escritos à
 * mão quando os limiares foram escolhidos e que a distribuição já desmentiu.
 * MEDIDO em 10/09/2026 contra as 85.795 carteiras de `holders_by_age.csv`:
 *
 *     >= 500M DOG   diz "Top 10"       real       9 carteiras
 *     >= 100M DOG   diz "Top 50"       real      58
 *     >=  50M DOG   diz "Top 100"      real     119
 *     >=  10M DOG   diz "Top 1,000"    real     855
 *     >=   1M DOG   diz "Top 10,000"   real   8.438
 *
 * Rank é um número que anda sozinho toda vez que alguém compra ou vende; a
 * FAIXA é o que o limiar realmente afirma, e ela não envelhece. Quem quiser o
 * rank de verdade já o recebe em `holder_rank`, calculado do dado.
 */

export interface SizeTier {
  id: 'whale' | 'shark' | 'dolphin' | 'fish' | 'shrimp' | 'plankton'
  text: string
  description: string
}

/** Os degraus, do maior para o menor. Em DOG. */
export const SIZE_TIERS: { min: number; tier: SizeTier }[] = [
  { min: 500_000_000, tier: { id: 'whale',   text: 'Whale',   description: '500M+ DOG' } },
  { min: 100_000_000, tier: { id: 'shark',   text: 'Shark',   description: '100M+ DOG' } },
  { min:  50_000_000, tier: { id: 'dolphin', text: 'Dolphin', description: '50M+ DOG'  } },
  { min:  10_000_000, tier: { id: 'fish',    text: 'Fish',    description: '10M+ DOG'  } },
  { min:   1_000_000, tier: { id: 'shrimp',  text: 'Shrimp',  description: '1M+ DOG'   } },
  { min:           0, tier: { id: 'plankton', text: 'Holder', description: 'DOG holder' } },
]

/** O degrau de tamanho de um saldo. Nunca devolve null: todo saldo tem um. */
export function sizeTierFor(totalDog: number): SizeTier {
  for (const { min, tier } of SIZE_TIERS) {
    if (totalDog >= min) return tier
  }
  return SIZE_TIERS[SIZE_TIERS.length - 1].tier
}
