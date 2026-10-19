// ═══════════════════════════════════════════════════════════════════════════
// O BLOCO B DA DOGCITY: a conta pura do detector, sem rede e sem banco.
// A rota /api/dogcity/mint-b só busca as linhas e chama detectB().
//
// DEFINIÇÃO (contrato público, /dogcity/docs seção 7): B é o bloco em que o
// fundo de construção chega a 10.000.000 $DOG: a soma das contribuições ao
// fundo confirmadas até o bloco B INTEIRO, inclusive, chega à meta. Por isso:
//  1. Só entra o que está num bloco: `block_height` inteiro e positivo. Linha
//     sem altura (mempool, ingestão incompleta) não conta, nunca.
//  2. As contribuições são as do MESMO livro que alimenta o placar
//     (lib/dog/founders-ledger.ts): mesma regra de quem é doação, mesmos
//     átomos inteiros (10^-5 DOG). O total daqui e o `total_received` de
//     /api/donate/leaderboard nunca divergem.
//  3. Dentro de um bloco a ordem não muda o B (a soma é do bloco inteiro);
//     ela só decide qual transação aparece como a que cruzou a meta (`txid`),
//     e aí vale a ordem do livro: posição no bloco, depois id, depois txid.
//  4. `raisedAtB` é o acumulado ao fim do bloco B inteiro, que costuma passar
//     da meta. Nunca a meta escrita como se fosse o arrecadado.
//  5. Confirmações de B = altura da ponta - B + 1 (o próprio B é a 1ª).
// ═══════════════════════════════════════════════════════════════════════════

export const DONATION_WALLET = 'bc1pxk7aw9ug55jkkz02z7ayhlkxxq92ya0ctegcwm5j8jumgaavjlkqdylk2p'
export const DOG_GOAL = 10_000_000
export const ATOMOS_POR_DOG = 100_000n
export const GOAL_ATOMOS = BigInt(DOG_GOAL) * ATOMOS_POR_DOG

/** O que o detector precisa de uma contribuição (subconjunto de `Contribution` do livro). */
export interface BContribution {
  bloco: number
  txid: string
  fundoAtomos: bigint
}

export interface DetectedB {
  B: number
  /** a transação que levou o acumulado a cruzar a meta */
  txid: string
  /** acumulado ao fim do bloco B inteiro, em átomos */
  raisedAtBAtomos: bigint
}

export interface BResult {
  goal: number
  /** total confirmado até a ponta lida, em DOG */
  raised: number
  B: number | null
  txid: string | null
  /** acumulado ao fim do bloco B inteiro, em DOG */
  raisedAtB: number | null
  /** ponta da cadeia usada para as confirmações; null se desconhecida */
  tip: number | null
  /** tip - B + 1; null sem B ou sem ponta */
  confirmations: number | null
}

const isBloco = (n: unknown): n is number => typeof n === 'number' && Number.isSafeInteger(n) && n > 0

const dog = (a: bigint) => Number(a) / Number(ATOMOS_POR_DOG)

/**
 * Primeiro bloco em que o acumulado confirmado chega à meta, ou null.
 * `contribs` já deve vir em ordem de bloco/posição (é o que o livro entrega);
 * aqui só se reordena por bloco (estável), por segurança. Contribuição sem
 * altura válida é descartada.
 */
export function detectB(contribs: BContribution[], goalAtomos: bigint = GOAL_ATOMOS): { found: DetectedB | null; totalAtomos: bigint } {
  const confirmadas = contribs.filter((c) => isBloco(c.bloco) && c.fundoAtomos > 0n)
  const ordenadas = [...confirmadas].sort((a, b) => a.bloco - b.bloco)
  const totalAtomos = ordenadas.reduce((s, c) => s + c.fundoAtomos, 0n)

  let acc = 0n
  let i = 0
  while (i < ordenadas.length) {
    const bloco = ordenadas[i].bloco
    let cruzou: string | null = null
    // o bloco inteiro entra na soma; o B é o bloco, não a transação
    for (; i < ordenadas.length && ordenadas[i].bloco === bloco; i++) {
      const antes = acc
      acc += ordenadas[i].fundoAtomos
      if (cruzou === null && antes < goalAtomos && acc >= goalAtomos) cruzou = ordenadas[i].txid
    }
    if (cruzou !== null) return { found: { B: bloco, txid: cruzou, raisedAtBAtomos: acc }, totalAtomos }
  }
  return { found: null, totalAtomos }
}

/** A resposta pública a partir do que o detector achou e da ponta lida. */
export function buildBResult(found: DetectedB | null, totalAtomos: bigint, tip: number | null): BResult {
  const t = isBloco(tip) ? tip : null
  if (!found) {
    return { goal: DOG_GOAL, raised: dog(totalAtomos), B: null, txid: null, raisedAtB: null, tip: t, confirmations: null }
  }
  return {
    goal: DOG_GOAL,
    raised: dog(totalAtomos),
    B: found.B,
    txid: found.txid,
    raisedAtB: dog(found.raisedAtBAtomos),
    tip: t,
    confirmations: t == null ? null : Math.max(0, t - found.B + 1),
  }
}
