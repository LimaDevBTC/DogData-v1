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
    definition: 'Corretora centralizada: guarda saldo de clientes e liquida fora da cadeia.',
    signature:
      'muitos depositantes distintos varridos para poucas carteiras quentes, saques para muitos destinos distintos, e remanejo interno constante entre carteiras da própria casa.',
    notThis:
      'não é `desk`: a mesa MANDA para corretora, não RECEBE depósito de estranhos.',
    group: 'infrastructure',
    tone: 'lava',
  },
  marketplace: {
    label: 'Marketplace',
    definition: 'Livro de ofertas de runes ou ordinals: casa duas pontas e cobra taxa.',
    signature:
      'aparece numa fatia grande de TODAS as transferências do ativo, contrapartes que voltam, e transações pequenas e uniformes (uma execução tem 1 a 2 entradas e 2 a 3 saídas).',
    notThis:
      'não é `swap_pool`: o pool guarda estoque e o saldo é o ponto; o mercado casa dois usuários e em geral não fica com o ativo.',
    group: 'infrastructure',
    tone: 'cyan',
  },
  swap_pool: {
    label: 'Swap pool',
    definition: 'Pool automatizado: negocia contra o próprio estoque.',
    signature:
      'saldo alto e permanente, fluxo nos dois sentidos com muitas contrapartes, e o saldo é o instrumento e não um resto.',
    notThis: 'não é `marketplace`: ali o estoque é dos usuários, aqui é do pool.',
    group: 'infrastructure',
    tone: 'cyan',
  },
  bridge: {
    label: 'Bridge',
    definition: 'Leva o ativo para outra cadeia, travando deste lado.',
    signature: 'recebe de um lado e não devolve pelo mesmo caminho; saldo sobe em degraus e raramente desce.',
    notThis: 'não é `treasury`: a ponte tem o outro lado emitido, a tesouraria só guarda.',
    group: 'infrastructure',
    tone: 'cyan',
  },
  desk: {
    label: 'Trading desk',
    definition: 'Mesa de OTC ou formador de mercado: gira estoque próprio entre praças.',
    signature:
      'volume alto nos dois sentidos COM corretoras, poucas contrapartes de varejo, e o estoque circula em vez de acumular.',
    notThis:
      'não é coorte de tamanho: uma carteira grande que só acumula é um holder grande, e isso o explorer já diz por outro caminho.',
    group: 'actor',
    tone: 'amber',
  },
  treasury: {
    label: 'Treasury',
    definition: 'Reserva de um projeto, declarada ou de movimentação rara e anunciada.',
    signature: 'saldo grande parado por longos períodos, movimentos esparsos e grandes.',
    notThis: 'não é `project`: a tesouraria guarda, a operacional gasta.',
    group: 'actor',
    tone: 'lava',
  },
  distributor: {
    label: 'Distributor',
    definition: 'Paga muita gente: airdrop, recompensa, folha.',
    signature: 'um para muitos, repetidamente, com poucas fontes de entrada.',
    notThis: 'não é `exchange`: saque de corretora vem acompanhado de depósito de estranhos, aqui não há depósito.',
    group: 'actor',
    tone: 'dusty',
  },
  project: {
    label: 'Project wallet',
    definition: 'Carteira operacional de um projeto: doações, despesas, contratos.',
    signature: 'divulgada pelo próprio projeto, ou ligada a um endereço já provado do projeto.',
    notThis: 'não é `treasury`: esta gasta, aquela guarda.',
    group: 'actor',
    tone: 'lava',
  },
  burn: {
    label: 'Burn',
    definition: 'Destino comprovadamente inaproveitável: o ativo sai de circulação.',
    signature: 'saída sem chave possível, ou OP_RETURN apontado por edict.',
    notThis: 'não é "carteira perdida": perda é suposição, queima é demonstrável.',
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
  hot: 'Carteira quente: paga saques e recebe a varredura dos depósitos.',
  cold: 'Reserva fria: assinatura manual, movimento raro.',
  treasury: 'Alimenta a carteira quente e não fala com o público.',
  deposit: 'Recebe depósito de cliente e é varrida em seguida.',
  withdrawal: 'Paga saques; costuma ter um abastecedor de gás separado.',
  fee: 'Recolhe a taxa da casa.',
  pool: 'Guarda o estoque que negocia.',
  router: 'Encaminha a ordem para o pool, sem guardar estoque.',
  escrow: 'Segura o ativo entre a oferta e a execução.',
  settlement: 'Liquida a execução entre as duas pontas.',
  lock: 'Trava deste lado o que foi emitido do outro.',
  mint: 'Emite deste lado o que foi travado do outro.',
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
    detail: 'mandamos ou recebemos desta carteira e temos a tx. Testemunha com recibo.',
    proves: 'who',
  },
  first_party: {
    label: 'published by the entity',
    detail: 'a própria entidade divulgou o endereço.',
    proves: 'who',
  },
  co_flow: {
    label: 'exclusive flow with a proven address',
    detail: 'fluxo exclusivo e numa direção só com um endereço já provado.',
    proves: 'who',
  },
  topology: {
    label: 'input co-spend clustering',
    detail: 'co-gasto de entradas. Prova o DONO ser o mesmo, não QUEM é o dono.',
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
    detail: 'desenho do fluxo: fatia das transferências, contrapartes que voltam, giro contra saldo. Prova a FUNÇÃO, não a identidade.',
    proves: 'what',
  },
  third_party: {
    label: 'reported elsewhere',
    detail: 'veio de fora. Orienta, nunca publica sozinho.',
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
