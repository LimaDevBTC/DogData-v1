// As regras da corrida no SERVIDOR (PLANO_CORRIDA_PERIMETRAL.md: "Padrões propostos", "Contrato jogo <-> servidor"; regra do premio v2 em
// assets_carros/projeto/CORRIDA_REGRA_V2.md): ordem e piso de tempo dos portoes, bandeiras da volta, abertura do modelo, regra do premio e
// desempate. PURO (sem banco, sem Redis, sem relogio): o servico (service.ts) e os testes leem daqui. O relogio que vale e' o do
// servidor: os tempos entram como numero.
import { AN7, medirNoAnel, type Portao } from './track'

export const REGRAS = {
  /** folga do piso de tempo por trecho sobre a Vmax do modelo (a mesma do cliente: distancia / (1,05 x Vmax)) */
  margemVmax: 1.05,
  /** prazo da volta aberta (ms), contado da largada pedida */
  prazoMs: 30 * 60_000,
  /** o ponto do portao pode estar ate este tanto fora do asfalto da AN7 (m) */
  portaoForaM: 30,
  /** cota (y, m) plausivel de um ponto da pista: a Orla Nobre afunda a -30, o viaduto sobe ate 147 */
  yMin: -100,
  yMax: 300,
  /** velocidade informada acima de Vmax x isto e' lixo */
  margemVelocidadeInformada: 1.2,
} as const

/** O menor tempo possivel (ms) para `ds` metros com a Vmax dada (m/s): o piso do servidor. */
export function pisoDoTrechoMs(ds: number, vmax: number): number {
  return (Math.max(0, ds) / (REGRAS.margemVmax * vmax)) * 1000
}

/** O carimbo do servidor de um portao: `t` em ms desde 1970 no relogio do servidor. */
export interface Carimbo {
  i: number
  t: number
}

export type MotivoCarimbos = 'faltando' | 'ordem' | 'velocidade'
export type ResultadoCarimbos =
  | { ok: true; lapMs: number; splits: number[] }
  | { ok: false; motivo: MotivoCarimbos }

/**
 * A conferencia final dos carimbos: todos os portoes, em ordem, sem repetir e nenhum trecho mais rapido que distancia / (1,05 x Vmax).
 * Tempo oficial = carimbo do ultimo portao menos o da largada; `splits` = ms desde a largada em cada portao.
 */
export function validarCarimbos(portoes: ReadonlyArray<Pick<Portao, 'i' | 's_m'>>, carimbos: ReadonlyArray<Carimbo>, vmax: number): ResultadoCarimbos {
  if (carimbos.length !== portoes.length || portoes.length < 2) return { ok: false, motivo: 'faltando' }
  for (let k = 0; k < carimbos.length; k++) {
    const c = carimbos[k]!
    if (c.i !== k || !Number.isFinite(c.t)) return { ok: false, motivo: 'ordem' }
    if (k > 0) {
      const dt = c.t - carimbos[k - 1]!.t
      if (dt < pisoDoTrechoMs(portoes[k]!.s_m - portoes[k - 1]!.s_m, vmax)) return { ok: false, motivo: 'velocidade' }
    }
  }
  const t0 = carimbos[0]!.t
  return { ok: true, lapMs: carimbos[carimbos.length - 1]!.t - t0, splits: carimbos.map((c) => c.t - t0) }
}

export type MotivoPortao = 'ordem' | 'repetido' | 'velocidade'
export type DecisaoPortao =
  | { tipo: 'gravar' }
  /** o MESMO portao que acabou de ser aceito (o cliente repete o POST quando a resposta se perdeu): devolve o carimbo de antes, sem gravar nada */
  | { tipo: 'repeticao'; t: number }
  | { tipo: 'recusar'; motivo: MotivoPortao }

/**
 * Decide a chegada de um portao. `ultimo` = o ultimo portao aceito da volta (ou null). Aceita so' o proximo da fila; rejeita fora de
 * ordem (pulou), repetido (ja' passou) e trecho mais rapido que distancia / (1,05 x Vmax). O servidor carimba `tMs` ao chegar.
 */
export function decidirPortao(args: {
  i: number
  ultimo: Carimbo | null
  portoes: ReadonlyArray<Pick<Portao, 'i' | 's_m'>>
  tMs: number
  vmax: number
}): DecisaoPortao {
  const { i, ultimo, portoes, tMs, vmax } = args
  const esperado = ultimo ? ultimo.i + 1 : 0
  if (i === esperado) {
    if (i >= portoes.length) return { tipo: 'recusar', motivo: 'ordem' }
    if (ultimo) {
      const ds = portoes[i]!.s_m - portoes[i - 1]!.s_m
      if (tMs - ultimo.t < pisoDoTrechoMs(ds, vmax)) return { tipo: 'recusar', motivo: 'velocidade' }
    }
    return { tipo: 'gravar' }
  }
  if (ultimo && i === ultimo.i) return { tipo: 'repeticao', t: ultimo.t }
  if (ultimo && i < ultimo.i) return { tipo: 'recusar', motivo: 'repetido' }
  return { tipo: 'recusar', motivo: 'ordem' }
}

/** O ponto informado no portao e' plausivel? (perto do anel da AN7, cota razoavel, velocidade de verdade.) */
export function posicaoPlausivel(pos: ReadonlyArray<number>, v: number, vmax: number): boolean {
  if (pos.length !== 3 || !pos.every((n) => Number.isFinite(n))) return false
  if (!Number.isFinite(v) || Math.abs(v) > vmax * REGRAS.margemVelocidadeInformada + 2) return false
  const [x, y, z] = pos as [number, number, number]
  if (y < REGRAS.yMin || y > REGRAS.yMax) return false
  return Math.abs(medirNoAnel(x, z).u) <= AN7.meia + REGRAS.portaoForaM
}

// ---- as bandeiras da volta ----

export interface FlagsVolta {
  autopilot: boolean
  teleport: boolean
  diag: boolean
  /** o motivo da anulacao no cliente, ou null na volta limpa */
  void: string | null
  /** volta do motorista de prova: nunca entra no ranking */
  bot: boolean
}

/** Le as bandeiras do corpo do finish campo a campo (`void` aceita so' um motivo curto de letras). Invalido: null. */
export function lerFlags(v: unknown): FlagsVolta | null {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return null
  const o = v as Record<string, unknown>
  const bool = (x: unknown): boolean | null => (x === undefined ? false : typeof x === 'boolean' ? x : null)
  const autopilot = bool(o.autopilot)
  const teleport = bool(o.teleport)
  const diag = bool(o.diag)
  const bot = bool(o.bot)
  if (autopilot === null || teleport === null || diag === null || bot === null) return null
  let motivo: string | null = null
  if (o.void !== undefined && o.void !== null) {
    if (typeof o.void !== 'string' || !/^[a-z_]{1,24}$/.test(o.void)) return null
    motivo = o.void
  }
  return { autopilot, teleport, diag, void: motivo, bot }
}

/** Qualquer bandeira de anulacao ou de exclusao: o motivo gravado na volta, ou null se a volta e' limpa. */
export function motivoDasFlags(f: FlagsVolta): string | null {
  if (f.bot) return 'bot'
  if (f.autopilot) return 'flag_autopilot'
  if (f.teleport) return 'flag_teleport'
  if (f.diag) return 'flag_diag'
  if (f.void !== null) return `client_${f.void}`
  return null
}

// ---- a abertura do modelo e o premio (regra v2) ----
//
// Cada um dos 18 carros da DOG MOTORS tem a sua pista de recorde na AN7, independente dos outros. O modelo comeca em ABERTURA: ate NECESSARIOS_ABERTURA
// carteiras verificadas DIFERENTES terem uma volta valida com ele, nenhuma volta e' premiada na hora (o recorde so' acompanha a melhor volta). A
// volta que fecha a primeira volta valida da 10a carteira fecha a abertura: a MELHOR volta valida do modelo ate' aquele instante (de qualquer uma
// das 10 carteiras, inclusive voltas repetidas delas; empate: a mais antiga) leva o carro (fase `abertura`) e e' o recorde. Depois, quem bater o
// recorde (estritamente mais rapido) leva o carro do modelo (fase `desafio`), se ainda nao tem o dele. UM carro de cada modelo por carteira.
// O banco decide isto numa transacao so' (race_finish_lap, migration 041); a conta abaixo e' a MESMA, e' o que o StoreMemoria roda nos testes.

/** Quantas carteiras DIFERENTES precisam ter uma volta valida num modelo para a abertura dele fechar. */
export const NECESSARIOS_ABERTURA = 10

/** `abertura` = ainda juntando pilotos (nada e' premiado); `aberto` = o recorde vale carro. Modelo sem premio (Cyber, Moto2) e' sempre `aberto`. */
export type FaseDoModelo = 'abertura' | 'aberto'

/** A fase de um modelo, do que esta gravado: com premio, ainda sem a abertura fechada = em abertura. */
export function faseDoModelo(args: { modeloComPremio: boolean; aberturaFechada: boolean }): FaseDoModelo {
  return args.modeloComPremio && !args.aberturaFechada ? 'abertura' : 'aberto'
}

/** O que identifica uma volta valida para comparar. */
export interface VoltaComparavel {
  id: string
  lapMs: number
  finishedAtMs: number
}

/** Ordem do ranking: menor tempo primeiro; EMPATE = a volta feita primeiro (a mais antiga); por fim o id, so' para ser total. */
export function compararVoltas(a: VoltaComparavel, b: VoltaComparavel): number {
  return a.lapMs - b.lapMs || a.finishedAtMs - b.finishedAtMs || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
}

/** Recorde novo: ESTRITAMENTE mais rapido que o recorde de agora (empate fica com a volta mais antiga). Sem recorde, toda volta valida e' recorde. */
export function recordeNovo(atual: { lapMs: number } | null, lapMs: number): boolean {
  return atual === null || lapMs < atual.lapMs
}

/** Uma volta valida com a carteira que a fez. */
export interface VoltaDeCarteira extends VoltaComparavel {
  wallet: string
}

/** A melhor volta (menor tempo; empate: a mais antiga). Sem voltas: null. */
export function melhorVolta<T extends VoltaComparavel>(voltas: ReadonlyArray<T>): T | null {
  let melhor: T | null = null
  for (const v of voltas) if (melhor === null || compararVoltas(v, melhor) < 0) melhor = v
  return melhor
}

/** Quantas carteiras DIFERENTES tem nestas voltas. */
export function carteirasDistintas(voltas: ReadonlyArray<{ wallet: string }>): number {
  return new Set(voltas.map((v) => v.wallet)).size
}

export type FasePremio = 'abertura' | 'desafio'

export interface PremioDecidido {
  fase: FasePremio
  /** quem leva o carro: na abertura pode ser OUTRA carteira que a da volta que fechou */
  wallet: string
  lapId: string
  lapMs: number
}

export interface DecisaoDoPremio {
  /** a fase do modelo DEPOIS desta volta */
  fase: FaseDoModelo
  /** esta volta fechou a abertura (o vencedor pode ser outra carteira) */
  fechouAbertura: boolean
  /** o premio a criar agora (`pending_review`), ou null */
  premio: PremioDecidido | null
}

/**
 * A regra do premio no instante em que uma volta valida e' fechada (o que race_finish_lap faz no banco):
 *   - so' os carros da DOG MOTORS dao premio (Cyber e Moto2 so' tem recorde): modelo sem premio nunca premia e nunca tem abertura;
 *   - abertura em andamento: nada e' premiado, a nao ser que esta volta tenha completado as `necessarios` carteiras (conta esta inclusa):
 *     a abertura fecha agora e a melhor volta do modelo (`melhorDoModelo`, esta inclusa) leva o carro `abertura`, mesmo que seja de outra
 *     carteira; se essa carteira ja' tem o modelo, o carro nao sai (o proximo recorde leva);
 *   - abertura ja' fechada: so' o recorde NOVO (`recorde`: estritamente mais rapido) leva o carro `desafio`, e so' se a carteira ainda nao tem o modelo.
 * Quem ja' tem o modelo bate o proprio recorde e segue dono dele, sem carro novo. `jaTemPremio(carteira)`: premio nao rejeitado desse modelo.
 */
export function decidirPremio(args: {
  modeloComPremio: boolean
  aberturaFechada: boolean
  carteiras: number
  necessarios?: number
  volta: VoltaDeCarteira
  recorde: boolean
  melhorDoModelo: VoltaDeCarteira | null
  jaTemPremio: (wallet: string) => boolean
}): DecisaoDoPremio {
  const necessarios = args.necessarios ?? NECESSARIOS_ABERTURA
  if (!args.modeloComPremio) return { fase: 'aberto', fechouAbertura: false, premio: null }
  if (!args.aberturaFechada) {
    if (args.carteiras < necessarios) return { fase: 'abertura', fechouAbertura: false, premio: null }
    const v = args.melhorDoModelo ?? args.volta
    const premio: PremioDecidido | null = args.jaTemPremio(v.wallet) ? null : { fase: 'abertura', wallet: v.wallet, lapId: v.id, lapMs: v.lapMs }
    return { fase: 'aberto', fechouAbertura: true, premio }
  }
  const v = args.volta
  const premio: PremioDecidido | null = args.recorde && !args.jaTemPremio(v.wallet) ? { fase: 'desafio', wallet: v.wallet, lapId: v.id, lapMs: v.lapMs } : null
  return { fase: 'aberto', fechouAbertura: false, premio }
}
