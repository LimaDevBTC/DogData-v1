// As regras da corrida no SERVIDOR (PLANO_CORRIDA_PERIMETRAL.md: "Regra do prêmio", "Padrões propostos", "Contrato jogo <-> servidor"):
// ordem e piso de tempo dos portoes, bandeiras da volta, fase do campeonato, regra do premio e desempate. PURO (sem banco, sem Redis,
// sem relogio): o servico (service.ts) e os testes leem daqui. O relogio que vale e' o do servidor: os tempos entram como numero.
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

// ---- o campeonato e o premio ----

/** A janela do campeonato de uma pista (config: race_championship). */
export interface JanelaCampeonato {
  startsAtMs: number
  endsAtMs: number
}

/**
 * `sem_campeonato` (nao ha config), `antes` (a janela ainda nao abriu), `durante` (nada e' premiado na hora; o vencedor de cada modelo
 * sai no fechamento) e `depois` (recorde novo do modelo gera premio na hora).
 */
export type FaseCampeonato = 'sem_campeonato' | 'antes' | 'durante' | 'depois'

export function faseDoCampeonato(agoraMs: number, janela: JanelaCampeonato | null): FaseCampeonato {
  if (!janela) return 'sem_campeonato'
  if (agoraMs < janela.startsAtMs) return 'antes'
  if (agoraMs < janela.endsAtMs) return 'durante'
  return 'depois'
}

/** Uma volta dentro da janela do campeonato? (`[inicio, fim)`; vale o instante em que a volta TERMINOU.) */
export function dentroDaJanela(finishedAtMs: number, janela: JanelaCampeonato): boolean {
  return finishedAtMs >= janela.startsAtMs && finishedAtMs < janela.endsAtMs
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

/**
 * A regra do premio no momento em que uma volta valida termina:
 *   - so' os carros da DOG MOTORS dao premio (Cyber e Moto2 rankeiam sem premio);
 *   - fora da fase `depois` nada e' premiado na hora (sem campeonato configurado, antes da janela e durante a janela);
 *   - na fase `depois`, so' o recorde novo do modelo vale;
 *   - UM premio por carteira por modelo: quem ja' tem o do modelo atualiza o recorde mas nao ganha outro.
 * `desafio` = gera race_prizes `pending_review` agora.
 */
export function decidirPremioNaHora(args: { modeloComPremio: boolean; fase: FaseCampeonato; recorde: boolean; jaTemPremio: boolean }): 'none' | 'desafio' {
  if (!args.modeloComPremio) return 'none'
  if (args.fase !== 'depois') return 'none'
  if (!args.recorde) return 'none'
  if (args.jaTemPremio) return 'none'
  return 'desafio'
}

export interface VoltaDaJanela extends VoltaComparavel {
  wallet: string
  model: string
}

/**
 * O fechamento do campeonato: o vencedor de CADA modelo com premio = a melhor volta valida terminada dentro da janela (empate: a mais
 * antiga). Modelo sem volta na janela nao tem vencedor. `jaTemPremio` (carteira, modelo): quem ja' tem o carro do modelo nao ganha outro
 * (o segundo colocado NAO herda: o premio so' vai para quem fez a melhor volta).
 */
export function vencedoresDoFechamento(
  voltas: ReadonlyArray<VoltaDaJanela>,
  janela: JanelaCampeonato,
  modelosComPremio: ReadonlyArray<string>,
  jaTemPremio: (wallet: string, model: string) => boolean = () => false,
): Array<{ model: string; volta: VoltaDaJanela; premiar: boolean }> {
  const out: Array<{ model: string; volta: VoltaDaJanela; premiar: boolean }> = []
  for (const model of modelosComPremio) {
    let melhor: VoltaDaJanela | null = null
    for (const v of voltas) {
      if (v.model !== model || !dentroDaJanela(v.finishedAtMs, janela)) continue
      if (!melhor || compararVoltas(v, melhor) < 0) melhor = v
    }
    if (melhor) out.push({ model, volta: melhor, premiar: !jaTemPremio(melhor.wallet, model) })
  }
  return out
}
