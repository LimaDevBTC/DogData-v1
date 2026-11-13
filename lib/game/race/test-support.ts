// So' para os testes: um piloto de mentira que da' a volta inteira da AN7 passando no meio de cada portao, a velocidade de cruzeiro
// constante, e devolve (a) a trajetoria no formato `d1` do cliente e (b) os carimbos que o servidor poria. Nada daqui entra em rota.
import { AN7, RUMO_LARGADA, VOLTA_M, type Pista } from './track'
import type { Carimbo } from './rules'

const RAD = Math.PI / 180

export interface TraceD1 {
  fmt: 'd1'
  hz: 5
  n: number
  q: number[]
}

export interface OpcoesVolta {
  pista: Pista
  /** velocidade de cruzeiro (m/s) */
  vCruzeiro: number
  /** arrancada (m/s2) a partir do repouso, 40 m antes da linha */
  aceleracao?: number
  /** atraso de rede de cada portao no carimbo do servidor (ms) */
  latenciaMs?: (i: number) => number
  /** o epoch do servidor (ms) em que a trajetoria comeca */
  t0Servidor?: number
  /** desvio lateral extra (m, para dentro) no s dado: o piloto errou a abertura */
  desvioU?: (s: number) => number
  /** as amostras a cada `periodoMs` (200 = 5 Hz) */
  periodoMs?: number
}

export interface VoltaSimulada {
  carimbos: Carimbo[]
  trace: TraceD1
  lapMs: number
  /** o `t` (ms, cliente) em que cada portao foi cruzado */
  tCruz: number[]
}

export const RECUO_M = 40

/** u do eixo para um s: interpola o centro dos portoes (passa no meio de cada abertura). */
function uDoCaminho(pista: Pista, s: number): number {
  const g = pista.noAnel
  if (s <= g[0]!.s_m) return g[0]!.u
  for (let k = 1; k < g.length; k++) {
    if (s <= g[k]!.s_m) {
      const a = g[k - 1]!
      const b = g[k]!
      const f = (s - a.s_m) / (b.s_m - a.s_m)
      return a.u + (b.u - a.u) * f
    }
  }
  return g[g.length - 1]!.u
}

export function pontoDoMundo(s: number, u: number): { x: number; z: number } {
  const rumo = RUMO_LARGADA + s / AN7.raio / RAD
  const r = AN7.raio - u
  return { x: Math.sin(rumo * RAD) * r, z: -Math.cos(rumo * RAD) * r }
}

export function simularVolta(op: OpcoesVolta): VoltaSimulada {
  const a = op.aceleracao ?? 8
  const periodo = op.periodoMs ?? 200
  const vc = op.vCruzeiro
  const tAcel = vc / a
  const sAcel = 0.5 * a * tAcel * tAcel
  // s(t): parte de -RECUO_M parado, acelera ate' vc, depois constante
  const sDe = (tS: number): number => (tS <= tAcel ? -RECUO_M + 0.5 * a * tS * tS : -RECUO_M + sAcel + vc * (tS - tAcel))
  const vDe = (tS: number): number => (tS <= tAcel ? a * tS : vc)
  const tDeS = (s: number): number => {
    const d = s + RECUO_M
    return d <= sAcel ? Math.sqrt((2 * d) / a) : tAcel + (d - sAcel) / vc
  }
  const portoes = op.pista.noAnel
  const tCruzS = portoes.map((p) => tDeS(p.s_m))
  const fimS = tCruzS[tCruzS.length - 1]!
  const t0 = op.t0Servidor ?? 1_800_000_000_000
  const carimbos: Carimbo[] = portoes.map((p, i) => ({ i, t: Math.round(t0 + tCruzS[i]! * 1000 + (op.latenciaMs?.(i) ?? 0)) }))

  const q: number[] = []
  const ant = [0, 0, 0, 0, 0]
  let n = 0
  const gravar = (tMs: number, x: number, y: number, z: number, v: number): void => {
    const cur = [Math.round(tMs), Math.round(x * 10), Math.round(y * 10), Math.round(z * 10), Math.round(v * 10)]
    for (let j = 0; j < 5; j++) {
      q.push(cur[j]! - ant[j]!)
      ant[j] = cur[j]!
    }
    n++
  }
  for (let tMs = 0; ; tMs += periodo) {
    const tS = tMs / 1000
    const s = sDe(tS)
    const u = uDoCaminho(op.pista, s) + (op.desvioU?.(s) ?? 0)
    const { x, z } = pontoDoMundo(s, u)
    gravar(tMs, x, 0, z, vDe(tS))
    if (tS >= fimS) break
  }
  return {
    carimbos,
    trace: { fmt: 'd1', hz: 5, n, q },
    lapMs: carimbos[carimbos.length - 1]!.t - carimbos[0]!.t,
    tCruz: tCruzS.map((t) => t * 1000),
  }
}

/** A mesma trajetoria sem as ultimas `k` amostras (o cliente nem sempre grava o quadro da chegada). */
export function semAsUltimas(tr: TraceD1, k: number): TraceD1 {
  return { fmt: 'd1', hz: 5, n: tr.n - k, q: tr.q.slice(0, (tr.n - k) * 5) }
}

/** Soma de s da volta, so' para os testes lerem o numero redondo. */
export const VOLTA_DO_TESTE_M = VOLTA_M
