// Espelho 1:1 do contrato de GET /api/holders/tree/flow e /node.
// Unica fonte de tipos do front do Flow: layout, cena e fixture importam
// daqui e de mais lugar nenhum, pra shape do payload e do renderer nunca
// divergirem em silencio.

/** Categoria do rotulo, dita a cor de header do chip (exchange = azul frio). */
export type LabelCat = 'exchange' | 'vault' | 'mm' | 'distributor' | 'other'

/**
 * Procedencia do rotulo: dogdata (dog_labels) ganha chip sempre visivel,
 * verified so anel fino no no + nome no hover.
 */
export type LabelSource = 'dogdata' | 'verified'

export interface NodeLabel {
  name: string
  cat: LabelCat
  source: LabelSource
}

/**
 * No individual promovido a barra propria no sankey.
 * Campos curtos de proposito: payload alvo < 100KB.
 */
export interface FlowNode {
  /** Endereco da carteira. */
  w: string
  /** Geracao (coluna): 0..3 individuais, 4 = G4+ colapsada. */
  gen: number
  /** Saldo atual em DOG. */
  b: number
  /** DOG total recebido (dog_flows, nunca o fio genealogico). */
  in: number
  /** DOG total enviado. */
  out: number
  /** Fracao ainda retida, 0..1 (b/in com teto 1). Preenchimento solido do no. */
  held_pct: number
  /** is_holder da genealogia. */
  h: boolean
  /** children_count. */
  c: number
  /** subtree_wallets. */
  sw: number
  /** subtree_holders. */
  sh: number
  /** subtree_balance_dog. */
  sb: number
  label: NodeLabel | null
}

/**
 * Resto de coluna: excedente do teto de nos nomeados, sempre DOIS por
 * coluna (holders e spent), rotulo "N wallets, X DOG".
 */
export interface RestNode {
  /** Id estavel no formato g2:holders | g3:spent, tambem usado em ?expand=. */
  id: string
  gen: number
  kind: 'holders' | 'spent'
  /** Quantas carteiras estao somadas aqui. */
  n: number
  /** Saldo somado em DOG. */
  b: number
  /** DOG recebido somado. */
  in: number
  /** DOG enviado somado. */
  out: number
}

/**
 * Fluxo TOTAL do par (dog_flows). s/t podem ser carteira ou id de resto.
 * back = refluxo pra geracao anterior, desenhado como arco por baixo em azul.
 */
export interface FlowLink {
  s: string
  t: string
  dog: number
  txs: number
  /** first_block do par. */
  fb: number
  /** last_block do par (base do filtro active 90d/30d). */
  lb: number
  back?: true
}

export interface FlowCol {
  gen: 0 | 1 | 2 | 3 | 4
  label: string
  nodes: FlowNode[]
  rest: RestNode[]
}

/** No fantasma da origem anterior, ancora visual a esquerda apos re-root. */
export interface FlowGhost {
  w: string
  label: NodeLabel | null
}

/** Os 4 tiles de stats chegam prontos da API, o front so exibe. */
export interface FlowStats {
  wallets: number
  /** Sempre 0: frase de autoridade "0,00% gap" vem dessa garantia. */
  coverage_gap_pct: number
  direct_children: number
  holding_pct: number
  exchange_dog: number
  exchange_pct_supply: number
}

export type FlowsCompleteness = 'complete' | 'partial'
export type ActiveWindow = 'all' | '90d' | '30d'

export interface FlowMeta {
  root: string
  generated_at: string
  /** partial enquanto o backfill de dog_flows nao termina: selo no front. */
  flows: FlowsCompleteness
  /** Corte "ignore flows < X DOG" aplicado no servidor. */
  min: number
  active: ActiveWindow
  /** Links acima do teto de 120, somados e nao descartados em silencio. */
  truncated_links: number
  total_links_considered: number
}

export interface FlowResponse {
  root: FlowNode
  cols: FlowCol[]
  links: FlowLink[]
  ghost: FlowGhost | null
  stats: FlowStats
  meta: FlowMeta
}

// ---- GET /api/holders/tree/node?w= (painel dossie) ----

export interface NodeFlowPeer {
  w: string
  label: NodeLabel | null
  dog: number
  txs: number
}

export interface NodePathHop {
  w: string
  label: NodeLabel | null
}

export interface NodeDossier {
  w: string
  label: NodeLabel | null
  balance_dog: number
  pct_supply: number
  /** Ainda nao calculado no v1 do endpoint. */
  rank: null
  is_holder: boolean
  /** Ainda nao calculado no v1 do endpoint. */
  lth_sth: null
  depth: number
  parent: { w: string; label: NodeLabel | null } | null
  /** Ate 8 saltos em direcao a raiz. */
  path: NodePathHop[]
  path_truncated: boolean
  first_block: number
  /** Ainda nao calculado no v1 do endpoint. */
  cohort_tier: null
  flows: {
    in_dog: number
    out_dog: number
    /** Top 5 contrapartes de entrada. */
    top_in: NodeFlowPeer[]
    /** Top 5 contrapartes de saida. */
    top_out: NodeFlowPeer[]
  }
}
