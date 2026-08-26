// Espelho 1:1 do contrato de GET /api/holders/tree/ego. Unica fonte de
// tipos do front do modo GRAPH: layout, cena e fixture importam daqui e de
// mais lugar nenhum, pra shape do payload e do renderer nunca divergirem em
// silencio. Tipos duplicados de proposito em relacao ao Flow: os dois modos
// evoluem separados e nao podem se acoplar por import.

/** Categoria do rotulo, dita a cor do chip (exchange = azul frio). */
export type LabelCat = 'exchange' | 'vault' | 'mm' | 'distributor' | 'other'

/**
 * Procedencia do rotulo: dogdata (dog_labels) ganha chip sempre visivel,
 * verified so anel fino no disco + nome no hover.
 */
export type LabelSource = 'dogdata' | 'verified'

export interface EgoLabel {
  name: string
  cat: LabelCat
  source: LabelSource
}

/** dir do request: quais listas vem preenchidas na resposta. */
export type EgoDir = 'all' | 'in' | 'out'

/** O no central do ego-grafo (a carteira consultada). */
export interface EgoCenter {
  /** Endereco da carteira central. */
  w: string
  label: EgoLabel | null
  /** Saldo atual em DOG. */
  b: number
  /** is_holder da genealogia. */
  h: boolean
  /** Profundidade na genealogia (0 = tesouraria). */
  depth: number
  /** DOG total recebido (dog_flows). */
  in_dog: number
  /** DOG total enviado. */
  out_dog: number
  /** Quantas contrapartes de entrada existem no total. */
  in_pairs: number
  /** Quantas contrapartes de saida existem no total. */
  out_pairs: number
}

/** Uma contraparte com o fluxo TOTAL do par (dog_flows). */
export interface EgoEdge {
  /** Endereco da contraparte. */
  w: string
  label: EgoLabel | null
  /** Saldo atual da contraparte em DOG. */
  b: number
  /** is_holder da contraparte. */
  h: boolean
  /** DOG total do par nesta direcao. */
  dog: number
  /** Transacoes do par. */
  txs: number
  /** first_block do par. */
  fb: number
  /** last_block do par. */
  lb: number
}

/** Contrapartes alem do limit, agregadas num resto por lado. */
export interface EgoRest {
  /** Quantas carteiras estao somadas aqui. */
  n: number
  /** DOG somado do lado. */
  dog: number
}

export interface EgoMeta {
  w: string
  limit: number
  min: number
  dir: EgoDir
  generated_at: string
}

export interface EgoResponse {
  center: EgoCenter
  /** Ate limit contrapartes de entrada, por total_dog desc. */
  inflows: EgoEdge[]
  /** Ate limit contrapartes de saida, por total_dog desc. */
  outflows: EgoEdge[]
  restIn: EgoRest | null
  restOut: EgoRest | null
  meta: EgoMeta
}
