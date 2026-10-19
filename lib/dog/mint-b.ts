// ═══════════════════════════════════════════════════════════════════════════
// O BLOCO B DA DOGCITY: a conta pura do detector, sem rede e sem banco.
// A rota /api/dogcity/mint-b só busca as linhas, chama detectB() e resolveB().
//
// DEFINIÇÃO (contrato público, /dogcity/docs seção 7): B é o bloco da transação
// de doação que fez o acumulado do fundo de construção cruzar 10.000.000 $DOG,
// em ordem de cadeia (altura, depois posição no bloco), nunca por hora de chegada
// ao banco. Por isso:
//  1. Só entra o que está num bloco: `block_height` inteiro e positivo. Linha
//     sem altura (mempool, ingestão incompleta) não conta, nunca.
//  2. As contribuições são as do MESMO livro que alimenta o placar
//     (lib/dog/founders-ledger.ts): mesma regra de quem é doação, mesmos
//     átomos inteiros (10^-5 DOG). Retirada do fundo não é doação e nunca
//     abate o total: devolver DOG a alguém não desfaz o B.
//  3. B é o PRIMEIRO bloco cujo acumulado (até o bloco inteiro) chega à meta.
//     A ordem dentro do bloco só decide qual transação cruzou (`txid`, auditoria).
//  4. Confirmações de B = altura da ponta - B + 1 (o próprio B é a 1ª).
//  5. B só VALE com 6 confirmações (status "set"). Antes disso é provisório
//     ("full_unconfirmed") e uma reorg pode movê-lo ou desfazê-lo. Com 6, B é
//     CONGELADO (FrozenB, persistido pela rota) e nada mais o muda, nem
//     doação devolvida, nem linha antiga que o scanner insira depois.
// ═══════════════════════════════════════════════════════════════════════════

export const DONATION_WALLET = 'bc1pxk7aw9ug55jkkz02z7ayhlkxxq92ya0ctegcwm5j8jumgaavjlkqdylk2p'
export const DOG_GOAL = 10_000_000
export const ATOMOS_POR_DOG = 100_000n
export const GOAL_ATOMOS = BigInt(DOG_GOAL) * ATOMOS_POR_DOG

/** confirmações de B antes de o calendário valer (o mesmo número do contador da landing) */
export const B_CONFIRMATIONS = 6

/** Origens que podem ler a rota pelo navegador (a landing, no mesmo domínio, não precisa de CORS). */
export const MINT_B_ORIGINS = ['https://mint.dogcity.space', 'https://ensaio.dogcity.space'] as const

/** O que o detector precisa de uma contribuição (subconjunto de `Contribution` do livro). */
export interface BContribution {
  bloco: number
  txid: string
  fundoAtomos: bigint
  /** posição da transação no bloco (founders-positions.json); ausente = depois das conhecidas */
  posicao?: number
}

export interface DetectedB {
  B: number
  /** a transação que levou o acumulado a cruzar a meta */
  txid: string
}

export type BStatus = 'filling' | 'full_unconfirmed' | 'set'

/** A resposta PÚBLICA e estável de GET /api/dogcity/mint-b. Não acrescente campos sem avisar quem lê. */
export interface MintBPublic {
  status: BStatus
  /** DOG confirmado no fundo (em `set`, o total no instante em que B foi congelado) */
  raised: number
  goal: number
  /** `set`: o B definitivo. `full_unconfirmed`: provisório, NÃO use. `filling`: null. */
  B: number | null
  /** ponta - B + 1; null enquanto não há B ou a ponta é desconhecida */
  confirmations: number | null
  /** altura da ponta lida; null se desconhecida */
  tip: number | null
}

/** B depois de congelado: o que a rota persiste na primeira vez que vê B com 6 confirmações. */
export interface FrozenB {
  B: number
  /** DOG confirmado no fundo no instante do congelamento */
  raised: number
  /** ponta lida no instante do congelamento */
  tip: number
  /** a transação que cruzou, só para auditoria */
  txid: string | null
}

const isBloco = (n: unknown): n is number => typeof n === 'number' && Number.isSafeInteger(n) && n > 0

const dog = (a: bigint) => Number(a) / Number(ATOMOS_POR_DOG)

/**
 * Primeiro bloco em que o acumulado confirmado chega à meta, ou null.
 * Ordem de CADEIA: altura, depois posição no bloco (estável: empate fica na ordem
 * recebida, que o livro já entrega por posição, id e txid). Nunca por hora de chegada.
 * Contribuição sem altura válida é descartada.
 */
export function detectB(contribs: BContribution[], goalAtomos: bigint = GOAL_ATOMOS): { found: DetectedB | null; totalAtomos: bigint } {
  const ordenadas = contribs
    .filter((c) => isBloco(c.bloco) && c.fundoAtomos > 0n)
    .sort((a, b) => a.bloco - b.bloco || (a.posicao ?? Number.MAX_SAFE_INTEGER) - (b.posicao ?? Number.MAX_SAFE_INTEGER))
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
    if (cruzou !== null) return { found: { B: bloco, txid: cruzou }, totalAtomos }
  }
  return { found: null, totalAtomos }
}

/** ponta - B + 1, nunca negativo; null sem ponta válida */
export function confirmationsOf(B: number, tip: number | null): number | null {
  return isBloco(tip) ? Math.max(0, tip - B + 1) : null
}

/**
 * A resposta pública a partir do que o detector achou, da ponta lida e do que já
 * estiver congelado. Pura: quem persiste é a rota.
 *  - congelado: o B congelado manda, sempre. O que foi lido agora é ignorado (e
 *    `diverged` avisa se o livro lido agora achou outro B).
 *  - achou B com >= 6 confirmações: `set`, e `freeze` traz o que persistir.
 *  - achou B com menos (ou sem ponta): `full_unconfirmed`, B provisório, sem congelar.
 *  - não achou: `filling` (uma reorg que desfaz o cruzamento volta aqui).
 */
export function resolveB(input: {
  found: DetectedB | null
  totalAtomos: bigint
  tip: number | null
  frozen: FrozenB | null
}): { body: MintBPublic; freeze: FrozenB | null; diverged: boolean } {
  const { found, totalAtomos, frozen } = input
  const tip = isBloco(input.tip) ? input.tip : null

  if (frozen) {
    // a cadeia só cresce: a ponta de agora nunca fica atrás da do congelamento
    const t = Math.max(tip ?? 0, frozen.tip)
    return {
      body: { status: 'set', raised: frozen.raised, goal: DOG_GOAL, B: frozen.B, confirmations: confirmationsOf(frozen.B, t), tip: t },
      freeze: null,
      diverged: found != null && found.B !== frozen.B,
    }
  }

  const raised = dog(totalAtomos)
  if (!found) {
    return { body: { status: 'filling', raised, goal: DOG_GOAL, B: null, confirmations: null, tip }, freeze: null, diverged: false }
  }
  const confirmations = confirmationsOf(found.B, tip)
  if (confirmations != null && confirmations >= B_CONFIRMATIONS && tip != null) {
    return {
      body: { status: 'set', raised, goal: DOG_GOAL, B: found.B, confirmations, tip },
      freeze: { B: found.B, raised, tip, txid: found.txid },
      diverged: false,
    }
  }
  return { body: { status: 'full_unconfirmed', raised, goal: DOG_GOAL, B: found.B, confirmations, tip }, freeze: null, diverged: false }
}

/** Cabeçalhos de CORS: só as origens do mint; `Vary: Origin` sempre, para o CDN não misturar. */
export function corsHeaders(origin: string | null): Record<string, string> {
  const h: Record<string, string> = { Vary: 'Origin' }
  if (origin && (MINT_B_ORIGINS as readonly string[]).includes(origin)) h['Access-Control-Allow-Origin'] = origin
  return h
}

/** O que a rota fornece à orquestração: banco e cadeia por trás, nada de rede aqui. */
export interface MintBSource {
  /** o B congelado, ou null se ainda não há (ou a tabela não existe). Erro de verdade lança. */
  loadFrozen(): Promise<FrozenB | null>
  /** grava o B congelado UMA vez (conflito = já havia, não toca) */
  saveFrozen(f: FrozenB): Promise<void>
  /** as contribuições confirmadas ao fundo, pelo livro */
  readContributions(): Promise<BContribution[]>
  readTip(): Promise<number | null>
}

/**
 * O passo inteiro da rota: com B congelado só lê a ponta (o livro nem é aberto);
 * sem ele, lê o livro, resolve e, se B acaba de ganhar 6 confirmações, congela e
 * relê o que ficou gravado (outra instância pode ter congelado antes: vale a gravada).
 */
export async function mintBNow(src: MintBSource): Promise<{ body: MintBPublic; diverged: boolean }> {
  const frozen = await src.loadFrozen()
  const tip = await src.readTip()
  if (frozen) {
    const r = resolveB({ found: null, totalAtomos: 0n, tip, frozen })
    return { body: r.body, diverged: false }
  }
  const { found, totalAtomos } = detectB(await src.readContributions())
  const r = resolveB({ found, totalAtomos, tip, frozen: null })
  if (!r.freeze) return { body: r.body, diverged: false }
  await src.saveFrozen(r.freeze)
  const stored = (await src.loadFrozen()) ?? r.freeze
  const final = resolveB({ found, totalAtomos, tip, frozen: stored })
  return { body: final.body, diverged: final.diverged }
}
