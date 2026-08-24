/**
 * O vocabulário fechado dos rótulos de carteira.
 *
 * ⚠️ ESTE ARQUIVO É A DEFINIÇÃO, não uma lista de conveniência. Toda linha de
 * `dog_labels` tem que cair numa destas classes, o banco recusa o que não cair
 * (CHECK na migração 008) e a tela desenha a partir daqui. Um rótulo de explorer
 * é uma afirmação sobre o mundo real que gente cita, agrega e repete; sem
 * vocabulário fechado, cada rodada de rotulação inventa uma palavra nova e seis
 * meses depois ninguém sabe se "exchange" e "cex" na mesma tabela querem dizer a
 * mesma coisa.
 *
 * ⚠️ CLASSE É FUNÇÃO, NÃO TAMANHO, e essa é a linha divisória que faz o sistema
 * inteiro funcionar. O explorer JÁ tem rótulos de coorte (whale, shark, dolphin,
 * top 10) e eles dizem QUANTO a carteira tem. Estes aqui dizem O QUE ela faz.
 * Por isso `whale` NÃO existe nesta lista, por mais natural que pareça: a mesma
 * palavra com dois sentidos na mesma tela é como um dado bom vira ruído.
 *
 * ⚠️ E A CLASSE PODE EXISTIR SEM O NOME. É o caso que motivou este arquivo: uma
 * carteira aparece em 18% de todas as transferências de DOG, com 222 contrapartes
 * que voltam. A gente sabe com segurança O QUE ela é (um mercado) e não sabe DE
 * QUEM ela é. Dizer "mercado" é verdade; chutar "UniSat" é invenção. Por isso o
 * nome é opcional e a tela distingue os dois casos: nome próprio sai inteiro,
 * classe sem nome sai como classe.
 */

export type WalletKind =
  | 'exchange'
  | 'marketplace'
  | 'swap_pool'
  | 'bridge'
  | 'desk'
  | 'treasury'
  | 'distributor'
  | 'project'
  | 'burn'

export interface KindSpec {
  /** o nome que vai para a tela quando não há nome próprio */
  label: string
  /** o que a classe afirma, numa frase */
  definition: string
  /** o desenho na cadeia que qualifica uma carteira para esta classe */
  signature: string
  /** com o que ela é confundida, e por quê não é a mesma coisa */
  notThis: string
  /** custódia dinheiro de terceiros, ou mexe o próprio */
  group: 'infrastructure' | 'actor' | 'special'
  /** token de cor do tema. Ver project_chart_palette: verde é status, roxo é banido. */
  tone: 'lava' | 'cyan' | 'dusty' | 'amber'
}

export const KINDS: Record<WalletKind, KindSpec> = {
  exchange: {
    label: 'Exchange',
    definition: 'Centralised exchange: holds customer balances and settles off-chain.',
    signature:
      'many distinct depositors swept into a few hot wallets, withdrawals to many distinct destinations, and constant internal shuffling between its own wallets.',
    notThis: 'Not a desk: a desk sends to exchanges, it does not take deposits from strangers.',
    group: 'infrastructure',
    tone: 'lava',
  },
  marketplace: {
    label: 'Marketplace',
    definition: 'Order-book venue for runes or ordinals: matches two sides and takes a fee.',
    signature:
      'appears in a large share of every transfer of the asset, counterparties come back, and fills are small and uniform (1 to 2 inputs, 2 to 3 outputs).',
    notThis:
      'Not a swap pool: a pool holds inventory and the balance is the point; a venue matches two users and mostly does not keep the asset.',
    group: 'infrastructure',
    tone: 'cyan',
  },
  swap_pool: {
    label: 'Swap pool',
    definition: 'Automated pool: trades against its own inventory.',
    signature:
      'a high standing balance, two-way flow with many counterparties, and the balance is the instrument rather than a leftover.',
    notThis: 'Not a marketplace: there the inventory belongs to users, here it belongs to the pool.',
    group: 'infrastructure',
    tone: 'cyan',
  },
  bridge: {
    label: 'Bridge',
    definition: 'Moves the asset to another chain, locking it on this side.',
    signature: 'receives on one side and does not return by the same path; the balance climbs in steps and rarely falls.',
    notThis: 'Not a treasury: a bridge has a minted counterpart elsewhere, a treasury only holds.',
    group: 'infrastructure',
    tone: 'cyan',
  },
  desk: {
    label: 'Trading desk',
    definition: 'OTC desk or market maker: cycles its own inventory between venues.',
    signature:
      'high two-way volume with exchanges, few retail counterparties, and inventory that turns over instead of piling up.',
    notThis:
      'Not a size cohort: a large wallet that only accumulates is a large holder, which the explorer already says another way.',
    group: 'actor',
    tone: 'amber',
  },
  treasury: {
    label: 'Treasury',
    definition: 'A project reserve, either declared or moved rarely and with notice.',
    signature: 'a large balance sitting still for long stretches, with sparse, large moves.',
    notThis: 'Not a project wallet: a treasury holds, an operating wallet spends.',
    group: 'actor',
    tone: 'lava',
  },
  distributor: {
    label: 'Distributor',
    definition: 'Pays many people: airdrops, rewards, payroll.',
    signature: 'one to many, repeatedly, with few incoming sources.',
    notThis: 'Not an exchange: exchange withdrawals come alongside deposits from strangers, and here there are no deposits.',
    group: 'actor',
    tone: 'dusty',
  },
  project: {
    label: 'Project wallet',
    definition: 'A project operating wallet: donations, expenses, contracts.',
    signature: 'published by the project itself, or linked to an address already proven to belong to it.',
    notThis: 'Not a treasury: this one spends, that one holds.',
    group: 'actor',
    tone: 'lava',
  },
  burn: {
    label: 'Burn',
    definition: 'A provably unspendable destination: the asset leaves circulation.',
    signature: 'an output with no possible key, or an OP_RETURN pointed at by an edict.',
    notThis: 'Not a lost wallet: loss is an assumption, a burn is demonstrable.',
    group: 'special',
    tone: 'dusty',
  },
}

/**
 * O papel DENTRO da entidade. Faz sentido só junto de uma classe: "hot" sozinho
 * não quer dizer nada, "exchange · hot" quer.
 */
export type WalletRole =
  | 'hot' | 'cold' | 'treasury' | 'deposit' | 'withdrawal' | 'fee'
  | 'pool' | 'router' | 'escrow' | 'settlement' | 'lock' | 'mint'

export const ROLES: Record<WalletRole, string> = {
  hot: 'Hot wallet: pays withdrawals and receives the deposit sweep.',
  cold: 'Cold reserve: manual signing, rare movement.',
  treasury: 'Feeds the hot wallet and never faces the public.',
  deposit: 'Takes a customer deposit and is swept right after.',
  withdrawal: 'Pays withdrawals; usually has a separate gas funder.',
  fee: 'Collects the venue fee.',
  pool: 'Holds the inventory it trades.',
  router: 'Routes the order to the pool without holding inventory.',
  escrow: 'Holds the asset between listing and fill.',
  settlement: 'Settles the fill between the two sides.',
  lock: 'Locks on this side what was minted on the other.',
  mint: 'Mints on this side what was locked on the other.',
}

/**
 * O GRAU DA PROVA, em ordem decrescente de confiança. Mora aqui junto do resto do
 * vocabulário porque é a mesma decisão: o que a casa está afirmando, e com quanta
 * força.
 */
export type Evidence =
  | 'own_flow' | 'first_party' | 'co_flow' | 'topology' | 'flow_pattern' | 'third_party'

export const EVIDENCE: Record<Evidence, { label: string; detail: string; proves: 'who' | 'what' }> = {
  own_flow: {
    label: 'our own transactions',
    detail: 'we sent to or received from this wallet and we have the transaction. A witness with a receipt.',
    proves: 'who',
  },
  first_party: {
    label: 'published by the entity',
    detail: 'the entity published the address itself.',
    proves: 'who',
  },
  co_flow: {
    label: 'exclusive flow with a proven address',
    detail: 'exclusive, one-way flow with an address already proven.',
    proves: 'who',
  },
  topology: {
    label: 'input co-spend clustering',
    detail: 'input co-spend. Proves the owner is the same, not who the owner is.',
    proves: 'who',
  },
  // ⚠️ ESTE GRAU PROVA OUTRA COISA, e por isso ele existe. Os quatro de cima
  // respondem QUEM é o dono. Este responde O QUE a carteira faz: a fatia de
  // todas as transferências em que ela aparece, as contrapartes que voltam, o
  // giro contra o saldo parado. Carimbar isso de `topology` seria descrever mal a
  // nossa própria prova, porque topologia é co-gasto de entradas e não tem nada a
  // ver com desenho de fluxo. O sistema todo existe para não deixar essa confusão
  // passar.
  flow_pattern: {
    label: 'flow pattern over time',
    detail: 'the shape of the flow: share of transfers, returning counterparties, turnover against balance. Proves function, not identity.',
    proves: 'what',
  },
  third_party: {
    label: 'reported elsewhere',
    detail: 'came from outside. It guides, it never publishes on its own.',
    proves: 'who',
  },
}

/**
 * ⚠️ A REGRA QUE LIGA OS DOIS: um rótulo com NOME PRÓPRIO precisa de prova que
 * responda QUEM (`proves: 'who'`). `flow_pattern` sozinho nunca sustenta um nome,
 * por mais convincente que o desenho seja: saber que uma carteira é um mercado
 * não diz de quem ela é.
 */
export function evidenceSupportsName(evidence: string | null | undefined): boolean {
  const e = EVIDENCE[(evidence || '') as Evidence]
  return !!e && e.proves === 'who'
}

/**
 * O que a tela escreve para uma carteira rotulada.
 *
 * ⚠️ TRÊS NÍVEIS DE AFIRMAÇÃO, e a tela precisa dos três separados:
 *   verified   o dono disse, pagou a taxa e mandou o arquivo
 *   named      a gente concluiu QUEM é
 *   classified a gente concluiu O QUE faz, e não sabe de quem é
 * Passar o terceiro como se fosse o primeiro é onde um explorer perde a
 * autoridade que levou anos para juntar.
 */
export type ClaimLevel = 'verified' | 'named' | 'classified'

export function displayName(entity: string | null | undefined, kind: string | null | undefined): string {
  if (entity) return entity
  const spec = KINDS[(kind || '') as WalletKind]
  return spec ? spec.label : 'Unknown'
}

export function kindSpec(kind: string | null | undefined): KindSpec | null {
  return KINDS[(kind || '') as WalletKind] ?? null
}
