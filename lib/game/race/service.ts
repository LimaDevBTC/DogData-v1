// O servico da corrida: o que cada rota /api/game/race/* faz, SEM saber de HTTP, Redis ou Supabase. Tudo que toca o banco passa por
// `RaceStore` (store-supabase.ts em producao; uma memoria nos testes), e o relogio entra como argumento: o instante em que a rota
// recebeu o pedido (carimbo do SERVIDOR). A conta de verdade esta em rules.ts, trace.ts e track.ts (puros).
//
// Contrato jogo <-> servidor (PLANO_CORRIDA_PERIMETRAL.md, dogcity-mundo src/corrida/contrato.ts) com a regra do premio v2
// (assets_carros/projeto/CORRIDA_REGRA_V2.md; a v2 so' ACRESCENTA campos, o cliente antigo ignora):
//   start  {model, track}                  -> {raceId, serverTime, gates, expiresAt}
//   gate   {raceId, i, pos, v}             -> {ok, t}
//   finish {raceId, trace, flags, clientLapMs} -> {valid, lapMs, rank, record, prize,
//                                                 phase: 'opening'|'open', opening: {drivers, needed}, openingClosed}   (v2: os 3 ultimos so' com valid:true)
//   leaderboard ?track&model&limit         -> {track, model, opening: {drivers, needed, open}, entries[{rank, wallet, handle, lapMs, at, splits}]}   (v2: opening)
//   me                                     -> {wallet, best{modelo:{lapMs, rank}}, open}
// A carteira ja' chega verificada e normalizada (sessionWallet). Toda recusa de regra que anula a volta grava o motivo no banco
// (`void_reason`) e NAO o devolve a quem chamou: quem tenta trapacear nao ganha um mapa das regras.
import { createHash } from 'node:crypto'
import { ehModeloCorrida, modeloTemPremio, vmaxMs } from './models'
import {
  NECESSARIOS_ABERTURA,
  REGRAS,
  decidirPortao,
  lerFlags,
  motivoDasFlags,
  posicaoPlausivel,
  validarCarimbos,
  type Carimbo,
  type FlagsVolta,
} from './rules'
import { PISTA_PADRAO, pistaDe } from './track'
import { decodificarTrace, validarTrace } from './trace'

export interface Resposta {
  status: number
  body: unknown
}

export interface VoltaRow {
  id: string
  trackId: string
  wallet: string
  model: string
  status: 'open' | 'valid' | 'void'
  voidReason: string | null
  startedAtMs: number
  expiresAtMs: number
  finishedAtMs: number | null
  lapMs: number | null
}

export interface LinhaRanking {
  lapId: string
  wallet: string
  lapMs: number
  finishedAtMs: number
  /** so' a primeira linha traz (o delta ao vivo do jogo usa o recorde) */
  splits: number[] | null
}

export interface MelhorDaCarteira {
  model: string
  lapId: string
  lapMs: number
  finishedAtMs: number
}

/** O que o banco devolve ao fechar uma volta valida (race_finish_lap): recorde, premio, posicao e a abertura do modelo, numa transacao so'. */
export interface ResultadoDaVolta {
  /** esta volta e' a que segura o recorde do modelo */
  record: boolean
  rank: number
  /** premio para a carteira que terminou ESTA volta (nao rejeitado, sobre esta volta) */
  prize: 'none' | 'pending_review'
  /** `opening` = o modelo ainda junta pilotos; `open` = o recorde vale carro. Modelo sem premio: sempre `open` */
  phase: 'opening' | 'open'
  /** carteiras diferentes com volta valida no modelo */
  drivers: number
  needed: number
  /** esta volta fechou a abertura (o carro pode ter ido para OUTRA carteira) */
  openingClosed: boolean
}

export interface AberturaDoModelo {
  drivers: number
  /** a abertura do modelo ja' fechou (race_openings) */
  fechada: boolean
}

export interface DadosValidos {
  finishedAtMs: number
  lapMs: number
  clientLapMs: number | null
  splits: number[]
  traceSha: string
  flags: FlagsVolta
}

/** Tudo que o servico precisa do banco. Cada metodo e' uma operacao so', e as que competem (abrir, gravar, validar, premiar) devolvem o desfecho. */
export interface RaceStore {
  /** anula (open -> void) as voltas abertas da carteira */
  anularAbertas(wallet: string, motivo: string, agoraMs: number): Promise<void>
  /** `conflito` = a carteira ja' tem uma aberta (outra chamada abriu no meio) */
  abrirVolta(v: { id: string; trackId: string; wallet: string; model: string; startedAtMs: number; expiresAtMs: number }): Promise<'ok' | 'conflito'>
  volta(id: string): Promise<VoltaRow | null>
  voltaAberta(wallet: string): Promise<VoltaRow | null>
  ultimoPortao(raceId: string): Promise<Carimbo | null>
  /** `duplicado` = o portao ja' existe ou a volta deixou de estar aberta */
  gravarPortao(h: { raceId: string; i: number; tMs: number; pos: [number, number, number]; v: number }): Promise<'ok' | 'duplicado'>
  portoes(raceId: string): Promise<Carimbo[]>
  /** open -> void */
  anular(raceId: string, motivo: string, agoraMs: number): Promise<void>
  /** open -> valid. `perdida` = ja' nao estava aberta (outra chamada fechou); `trace_repetido` = a mesma trajetoria ja' vale outra volta */
  validar(raceId: string, d: DadosValidos): Promise<'ok' | 'perdida' | 'trace_repetido'>
  /**
   * Depois de validar: numa transacao so' (race_finish_lap, com trava por pista e modelo) o recorde (so' estritamente melhor), as carteiras
   * diferentes do modelo, a fase, o premio (abertura fechando agora ou recorde novo depois dela) e a posicao. Idempotente: o finish repetido
   * devolve o mesmo e nao cria nada. `premio` = o modelo vale carro. null = a volta nao esta valida (anulada no meio).
   */
  concluirVolta(a: { lapId: string; premio: boolean; necessarios: number }): Promise<ResultadoDaVolta | null>
  /** 1 + quantas OUTRAS carteiras tem melhor volta que esta (menor tempo; empate: a mais antiga) */
  posicao(trackId: string, model: string, wallet: string, lapMs: number, finishedAtMs: number): Promise<number>
  /** carteiras diferentes com volta valida no modelo e se a abertura ja' fechou */
  abertura(trackId: string, model: string): Promise<AberturaDoModelo>
  ranking(trackId: string, model: string, limite: number): Promise<LinhaRanking[]>
  melhoresDaCarteira(trackId: string, wallet: string): Promise<MelhorDaCarteira[]>
  /** handle por carteira (so' as que tem perfil) */
  handles(wallets: string[]): Promise<Map<string, string>>
}

export interface Deps {
  store: RaceStore
  novoId: () => string
}

const ok = (body: unknown): Resposta => ({ status: 200, body })
const erro = (status: number, error: string, extra: Record<string, unknown> = {}): Resposta => ({ status, body: { error, ...extra } })

type Obj = Record<string, unknown>
const ehObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

const INVALIDA = { valid: false, lapMs: null, rank: null, record: false, prize: 'none' } as const

// ---- start ----

export async function iniciar(d: Deps, wallet: string, corpo: unknown, agoraMs: number): Promise<Resposta> {
  if (!ehObj(corpo)) return erro(400, 'invalid_request')
  const pista = pistaDe(corpo.track)
  if (!pista) return erro(400, 'invalid_track')
  if (!ehModeloCorrida(corpo.model)) return erro(400, 'invalid_model')
  const id = d.novoId()
  const expiresAtMs = agoraMs + REGRAS.prazoMs
  // uma aberta por carteira: a nova substitui a velha. Duas largadas ao mesmo tempo: o indice unico deixa uma so', a outra tenta de novo.
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    await d.store.anularAbertas(wallet, 'replaced', agoraMs)
    const r = await d.store.abrirVolta({ id, trackId: pista.id, wallet, model: corpo.model, startedAtMs: agoraMs, expiresAtMs })
    if (r === 'ok') return ok({ raceId: id, serverTime: agoraMs, gates: pista.portoes, expiresAt: expiresAtMs })
  }
  return erro(409, 'busy')
}

// ---- gate ----

interface PedidoPortao {
  raceId: string
  i: number
  pos: [number, number, number]
  v: number
}

function lerPortao(v: unknown): PedidoPortao | null {
  if (!ehObj(v)) return null
  const { raceId, i, pos, v: vel } = v
  if (typeof raceId !== 'string' || !UUID.test(raceId)) return null
  if (typeof i !== 'number' || !Number.isInteger(i) || i < 0 || i > 399) return null
  if (!Array.isArray(pos) || pos.length !== 3 || !pos.every((n) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) < 1e6)) return null
  if (typeof vel !== 'number' || !Number.isFinite(vel) || Math.abs(vel) > 1e4) return null
  return { raceId, i, pos: pos as [number, number, number], v: vel }
}

/**
 * Carimba o portao. `agoraMs` = o relogio do servidor quando a rota recebeu o pedido (antes de qualquer espera). Recusa por regra
 * (fora de ordem, repetido, rapido demais, ponto fora do anel) ANULA a volta: o cliente anula do lado dele e fecha com o finish.
 */
export async function portao(d: Deps, wallet: string, corpo: unknown, agoraMs: number): Promise<Resposta> {
  const p = lerPortao(corpo)
  if (!p) return erro(400, 'invalid_request')
  const volta = await d.store.volta(p.raceId)
  if (!volta || volta.wallet !== wallet) return erro(404, 'not_found')
  if (volta.status !== 'open') return { status: 409, body: { ok: false, t: agoraMs, error: 'closed' } }
  if (agoraMs > volta.expiresAtMs) {
    await d.store.anular(volta.id, 'expired', agoraMs)
    return { status: 410, body: { ok: false, t: agoraMs, error: 'expired' } }
  }
  const pista = pistaDe(volta.trackId)
  if (!pista || p.i >= pista.portoes.length) return erro(400, 'invalid_request')
  const vmax = vmaxMs(volta.model)
  const ultimo = await d.store.ultimoPortao(volta.id)
  const dec = decidirPortao({ i: p.i, ultimo, portoes: pista.portoes, tMs: agoraMs, vmax })
  if (dec.tipo === 'repeticao') return ok({ ok: true, t: dec.t })
  if (dec.tipo === 'recusar') {
    await d.store.anular(volta.id, `gate_${dec.motivo}`, agoraMs)
    return { status: dec.motivo === 'velocidade' ? 422 : 409, body: { ok: false, t: agoraMs } }
  }
  if (!posicaoPlausivel(p.pos, p.v, vmax)) {
    await d.store.anular(volta.id, 'gate_pos', agoraMs)
    return { status: 422, body: { ok: false, t: agoraMs } }
  }
  const r = await d.store.gravarPortao({ raceId: volta.id, i: p.i, tMs: agoraMs, pos: p.pos, v: p.v })
  if (r === 'duplicado') return { status: 409, body: { ok: false, t: agoraMs } }
  return ok({ ok: true, t: agoraMs })
}

// ---- finish ----

interface PedidoFinish {
  raceId: string
  trace: unknown
  flags: FlagsVolta
  clientLapMs: number | null
}

function lerFinish(v: unknown): PedidoFinish | null {
  if (!ehObj(v)) return null
  if (typeof v.raceId !== 'string' || !UUID.test(v.raceId)) return null
  const flags = lerFlags(v.flags)
  if (!flags) return null
  let clientLapMs: number | null = null
  if (typeof v.clientLapMs === 'number' && Number.isFinite(v.clientLapMs) && v.clientLapMs > 0 && v.clientLapMs < 86_400_000) clientLapMs = Math.round(v.clientLapMs)
  return { raceId: v.raceId, trace: v.trace, flags, clientLapMs }
}

/** A soma sha256 da trajetoria (n e os deltas): a mesma trajetoria nao vale duas voltas. */
export function somaDaTrajetoria(trace: unknown): string {
  const o = (ehObj(trace) ? trace : {}) as Obj
  return createHash('sha256').update(`${String(o.n)}:${Array.isArray(o.q) ? o.q.join(',') : ''}`).digest('hex')
}

/**
 * Fecha a volta. Anulada pelo cliente (bandeiras), fora do prazo, carimbos que nao fecham ou trajetoria que nao confere: `valid:false`,
 * a volta fica `void` com o motivo. Valida: tempo oficial = carimbo do ultimo portao menos o da largada; recorde; premio; posicao.
 * Repetir o finish de uma volta ja' valida devolve o mesmo resultado (a resposta pode ter se perdido) e completa o que faltou.
 */
export async function terminar(d: Deps, wallet: string, corpo: unknown, agoraMs: number): Promise<Resposta> {
  const p = lerFinish(corpo)
  if (!p) return erro(400, 'invalid_request')
  const volta = await d.store.volta(p.raceId)
  if (!volta || volta.wallet !== wallet) return erro(404, 'not_found')
  if (volta.status === 'void') return ok(INVALIDA)
  if (volta.status === 'valid') return concluir(d, volta)

  const anulada = async (motivo: string): Promise<Resposta> => {
    await d.store.anular(volta.id, motivo, agoraMs)
    return ok(INVALIDA)
  }
  if (agoraMs > volta.expiresAtMs) return anulada('expired')
  const motivoFlag = motivoDasFlags(p.flags)
  if (motivoFlag) return anulada(motivoFlag)

  const pista = pistaDe(volta.trackId)
  if (!pista) return erro(500, 'unknown_track')
  const vmax = vmaxMs(volta.model)
  const carimbos = await d.store.portoes(volta.id)
  const conferido = validarCarimbos(pista.portoes, carimbos, vmax)
  if (!conferido.ok) return anulada(`gates_${conferido.motivo}`)
  const dec = decodificarTrace(p.trace)
  if (!dec.ok) return anulada(dec.motivo)
  const vt = validarTrace(dec.amostras, pista, carimbos, vmax)
  if (!vt.ok) return anulada(vt.motivo)

  const r = await d.store.validar(volta.id, {
    finishedAtMs: agoraMs,
    lapMs: conferido.lapMs,
    clientLapMs: p.clientLapMs,
    splits: conferido.splits,
    traceSha: somaDaTrajetoria(p.trace),
    flags: p.flags,
  })
  if (r === 'trace_repetido') return anulada('trace_duplicate')
  if (r === 'perdida') {
    // outra chamada fechou esta volta no meio: le o que ficou e responde por ele
    const atual = await d.store.volta(volta.id)
    if (atual && atual.status === 'valid') return concluir(d, atual)
    return ok(INVALIDA)
  }
  return concluir(d, { ...volta, status: 'valid', lapMs: conferido.lapMs, finishedAtMs: agoraMs })
}

/**
 * O que acontece com uma volta VALIDA: recorde, abertura do modelo, premio e posicao, tudo numa transacao do banco (race_finish_lap, trava
 * por pista e modelo). Idempotente (o finish repetido cai aqui de novo): o recorde so' muda para uma volta estritamente melhor, a abertura
 * fecha uma vez, o premio e' um por carteira por modelo e nunca se repete numa volta; a resposta sai do que ficou gravado.
 * `prize` e' sempre sobre a carteira que terminou a volta; `openingClosed` = esta volta fechou a abertura (o carro pode ter ido para OUTRA).
 */
async function concluir(d: Deps, volta: VoltaRow): Promise<Resposta> {
  const r = await d.store.concluirVolta({ lapId: volta.id, premio: modeloTemPremio(volta.model), necessarios: NECESSARIOS_ABERTURA })
  // a volta foi anulada no meio (revisao a mao): nao vale
  if (!r) return ok(INVALIDA)
  return ok({
    valid: true,
    lapMs: volta.lapMs!,
    rank: r.rank,
    record: r.record,
    prize: r.prize,
    phase: r.phase,
    opening: { drivers: r.drivers, needed: r.needed },
    openingClosed: r.openingClosed,
  })
}

// ---- leaderboard e me ----

export const LIMITE_RANKING = { padrao: 50, max: 200 } as const

export async function ranking(d: Deps, trackId: unknown, model: unknown, limite: number): Promise<Resposta> {
  const pista = pistaDe(trackId)
  if (!pista) return erro(400, 'invalid_track')
  if (!ehModeloCorrida(model)) return erro(400, 'invalid_model')
  const n = Number.isFinite(limite) ? Math.max(1, Math.min(LIMITE_RANKING.max, Math.floor(limite))) : LIMITE_RANKING.padrao
  const [linhas, ab] = await Promise.all([d.store.ranking(pista.id, model, n), d.store.abertura(pista.id, model)])
  const handles = linhas.length ? await d.store.handles(linhas.map((l) => l.wallet)) : new Map<string, string>()
  const entries = linhas.map((l, k) => ({
    rank: k + 1,
    wallet: l.wallet,
    handle: handles.get(l.wallet) ?? null,
    lapMs: l.lapMs,
    at: new Date(l.finishedAtMs).toISOString(),
    splits: k === 0 ? l.splits : null,
  }))
  // a abertura do modelo (v2): `open` = ainda junta pilotos; Cyber e Moto2 nao tem abertura (so' recorde)
  const opening = { drivers: ab.drivers, needed: NECESSARIOS_ABERTURA, open: modeloTemPremio(model) && !ab.fechada }
  return ok({ track: pista.id, model, opening, entries })
}

export async function meu(d: Deps, wallet: string, agoraMs: number): Promise<Resposta> {
  const melhores = await d.store.melhoresDaCarteira(PISTA_PADRAO, wallet)
  const best: Record<string, { lapMs: number; rank: number | null }> = {}
  await Promise.all(
    melhores.map(async (m) => {
      best[m.model] = { lapMs: m.lapMs, rank: await d.store.posicao(PISTA_PADRAO, m.model, wallet, m.lapMs, m.finishedAtMs) }
    }),
  )
  const aberta = await d.store.voltaAberta(wallet)
  const open = aberta && aberta.expiresAtMs > agoraMs ? { raceId: aberta.id, model: aberta.model, expiresAt: aberta.expiresAtMs } : null
  return ok({ wallet, best, open })
}
