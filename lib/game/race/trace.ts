// A trajetoria da volta (POST /api/game/race/finish, `trace`): decodificacao e validacao. PURO.
//
// Formato `d1` (o do cliente, `src/corrida/regras.ts` GravadorTrace): n amostras a ~5 Hz, cada uma [t (ms), x (dm), y (dm), z (dm),
// v (dm/s)] em DELTAS inteiros, a primeira absoluta; `t` e' o relogio do CLIENTE desde o inicio da corrida (o carro nasce 40 m antes da
// linha). Uma volta de 13 min sao ~3.900 amostras.
//
// O que a trajetoria prova (e o que nao prova): ela e' dita pelo cliente, entao NAO e' prova de nada sozinha. Vale como conferencia
// cruzada contra o que so' o servidor sabe, o carimbo de cada portao: o robo que so' manda portoes no tempo do piso tem de fabricar uma
// trajetoria fisicamente possivel, que passa em cada abertura na hora certa do relogio do servidor. Confere:
//   1. forma: formato, tamanho, inteiros seguros, `q` com 5 numeros por amostra;
//   2. cada amostra perto da AN7 (faixa e cota) e velocidade informada <= 1,2 x Vmax;
//   3. tempo estritamente crescente, sem buraco maior que `maxIntervaloMs` (impede "duas amostras e uma volta inteira");
//   4. SALTO MAXIMO: o deslocamento entre amostras cabe em 1,05 x Vmax x dt (mais 1 m de arredondamento);
//   5. a trajetoria cruza TODOS os portoes, em ordem, DENTRO da abertura (mais 2 m de folga);
//   6. o relogio bate: o tempo entre portoes na trajetoria (relogio do cliente) e o carimbado pelo servidor diferem no maximo
//      `toleranciaRelogioMs` em cada portao, e a mediana da diferenca e' pequena (um robo que SEGURA o POST da largada para encurtar a
//      volta desloca todos os portoes pelo mesmo tanto).
import { AN7, RUMO_LARGADA, medirNoAnel, type Pista } from './track'
import { REGRAS, type Carimbo } from './rules'

const RAD = Math.PI / 180

export const REGRAS_TRACE = {
  minAmostras: 10,
  maxAmostras: 12_000,
  /** o cliente grava a 5 Hz; num aparelho lento chega a 1 quadro por segundo: nenhum buraco honesto passa disto (ms) */
  maxIntervaloMs: 5_000,
  /** deslocamento: arredondamento de 0,1 m por eixo e do relogio (m) */
  folgaDistM: 1.0,
  /** folga alem da meia abertura do portao ao conferir a trajetoria (m): a trajetoria tem 5 Hz, o cliente confere por quadro */
  folgaPortaoM: 2.0,
  /** diferenca maxima, por portao, entre o relogio do cliente e o carimbo do servidor (ms): atraso de rede e as 2 repeticoes do cliente */
  toleranciaRelogioMs: 4_000,
  /** mediana da diferenca (ms): o atraso honesto e' ruido de media zero */
  medianaRelogioMs: 1_000,
  /** a ultima amostra pode parar este tempo antes da chegada (o cliente grava a cada 200 ms) (s) */
  folgaChegadaS: 0.45,
} as const

export interface AmostraTrace {
  /** ms, relogio do cliente desde o inicio */
  t: number
  x: number
  y: number
  z: number
  /** m/s */
  v: number
}

export type MotivoTrace = 'trace_formato' | 'trace_pouco' | 'trace_tempo' | 'trace_fora' | 'trace_salto' | 'trace_portao' | 'trace_relogio'
export type ResultadoTrace = { ok: true } | { ok: false; motivo: MotivoTrace }
export type ResultadoDecodificar = { ok: true; amostras: AmostraTrace[] } | { ok: false; motivo: 'trace_formato' | 'trace_pouco' }

/** Desfaz a compressao `d1`, com cada campo conferido (todo payload de rede e' hostil). */
export function decodificarTrace(tr: unknown): ResultadoDecodificar {
  if (typeof tr !== 'object' || tr === null || Array.isArray(tr)) return { ok: false, motivo: 'trace_formato' }
  const o = tr as Record<string, unknown>
  if (o.fmt !== 'd1' || o.hz !== 5) return { ok: false, motivo: 'trace_formato' }
  const n = o.n
  if (typeof n !== 'number' || !Number.isInteger(n) || n < 0 || n > REGRAS_TRACE.maxAmostras) return { ok: false, motivo: 'trace_formato' }
  const q = o.q
  if (!Array.isArray(q) || q.length !== n * 5) return { ok: false, motivo: 'trace_formato' }
  const acc = [0, 0, 0, 0, 0]
  const out: AmostraTrace[] = []
  for (let k = 0; k < n; k++) {
    for (let j = 0; j < 5; j++) {
      const d = q[k * 5 + j]
      if (typeof d !== 'number' || !Number.isSafeInteger(d)) return { ok: false, motivo: 'trace_formato' }
      acc[j]! += d
    }
    out.push({ t: acc[0]!, x: acc[1]! / 10, y: acc[2]! / 10, z: acc[3]! / 10, v: acc[4]! / 10 })
  }
  if (out.length < REGRAS_TRACE.minAmostras) return { ok: false, motivo: 'trace_pouco' }
  return { ok: true, amostras: out }
}

/** Menor diferenca angular com sinal (graus, em (-180, 180]). */
function difGraus(d: number): number {
  let r = d % 360
  if (r > 180) r -= 360
  else if (r <= -180) r += 360
  return r
}

/**
 * Valida a trajetoria contra o tracado, o modelo (`vmax`, m/s) e os carimbos do servidor (todos os portoes, ja' conferidos em ordem e
 * no piso de tempo). Devolve o primeiro motivo de reprovacao.
 */
export function validarTrace(amostras: ReadonlyArray<AmostraTrace>, pista: Pista, carimbos: ReadonlyArray<Carimbo>, vmax: number): ResultadoTrace {
  const R = AN7.raio
  const portoes = pista.noAnel
  const N = portoes.length
  if (amostras.length < REGRAS_TRACE.minAmostras) return { ok: false, motivo: 'trace_pouco' }
  if (carimbos.length !== N) return { ok: false, motivo: 'trace_relogio' }

  // 1) cada amostra: perto da AN7, cota razoavel, velocidade de verdade
  for (const a of amostras) {
    if (![a.t, a.x, a.y, a.z, a.v].every(Number.isFinite)) return { ok: false, motivo: 'trace_formato' }
    if (a.y < REGRAS.yMin || a.y > REGRAS.yMax) return { ok: false, motivo: 'trace_fora' }
    if (Math.abs(medirNoAnel(a.x, a.z).u) > AN7.meia + REGRAS.portaoForaM) return { ok: false, motivo: 'trace_fora' }
    if (Math.abs(a.v) > vmax * REGRAS.margemVelocidadeInformada + 2) return { ok: false, motivo: 'trace_salto' }
  }

  // 2) o tempo, o salto maximo e os portoes cruzados, numa passada
  const tCruz: number[] = []
  const folgaFinalM = vmax * REGRAS.margemVmax * REGRAS.margemVelocidadeInformada * REGRAS_TRACE.folgaChegadaS
  let prev = amostras[0]!
  let m0 = medirNoAnel(prev.x, prev.z)
  let sPrev = difGraus(m0.rumo - RUMO_LARGADA) * RAD * R
  let uPrev = m0.u
  let rumoPrev = m0.rumo
  let k = 0 // proximo portao a cruzar
  for (let idx = 1; idx < amostras.length; idx++) {
    const cur = amostras[idx]!
    const dt = cur.t - prev.t
    if (!(dt > 0) || dt > REGRAS_TRACE.maxIntervaloMs) return { ok: false, motivo: 'trace_tempo' }
    const dist = Math.hypot(cur.x - prev.x, cur.y - prev.y, cur.z - prev.z)
    if (dist > vmax * REGRAS.margemVmax * (dt / 1000) + REGRAS_TRACE.folgaDistM) return { ok: false, motivo: 'trace_salto' }

    const m1 = medirNoAnel(cur.x, cur.z)
    const sCur = sPrev + difGraus(m1.rumo - rumoPrev) * RAD * R
    // portoes cruzados para a frente neste passo (como o cliente: s0 < s_portao <= s1)
    while (k < N && sPrev < portoes[k]!.s_m && sCur >= portoes[k]!.s_m) {
      const p = portoes[k]!
      const f = sCur > sPrev ? (p.s_m - sPrev) / (sCur - sPrev) : 1
      const uX = uPrev + (m1.u - uPrev) * f
      if (Math.abs(uX - p.u) > p.w / 2 + REGRAS_TRACE.folgaPortaoM) return { ok: false, motivo: 'trace_portao' }
      tCruz[k] = prev.t + dt * f
      k++
    }
    prev = cur
    sPrev = sCur
    uPrev = m1.u
    rumoPrev = m1.rumo
  }

  // 3) todos os portoes; a chegada pode ter ficado entre a ultima amostra e a linha (o cliente grava a cada 200 ms)
  if (k < N - 1) return { ok: false, motivo: 'trace_portao' }
  if (k === N - 1 && sPrev < portoes[N - 1]!.s_m - folgaFinalM) return { ok: false, motivo: 'trace_portao' }

  // 4) o relogio do cliente bate com o do servidor, portao a portao (a largada e' o zero dos dois)
  const t0Servidor = carimbos[0]!.t
  const difs: number[] = []
  for (let g = 1; g < k; g++) {
    const d = carimbos[g]!.t - t0Servidor - (tCruz[g]! - tCruz[0]!)
    if (Math.abs(d) > REGRAS_TRACE.toleranciaRelogioMs) return { ok: false, motivo: 'trace_relogio' }
    difs.push(d)
  }
  if (difs.length) {
    difs.sort((a, b) => a - b)
    const mediana = difs.length % 2 ? difs[(difs.length - 1) / 2]! : (difs[difs.length / 2 - 1]! + difs[difs.length / 2]!) / 2
    if (Math.abs(mediana) > REGRAS_TRACE.medianaRelogioMs) return { ok: false, motivo: 'trace_relogio' }
  }
  return { ok: true }
}
