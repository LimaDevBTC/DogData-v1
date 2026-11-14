// So' para os testes: o RaceStore na memoria, com as MESMAS regras do banco das migrations 038 e 041 (uma aberta por carteira, carimbo
// unico por portao e so' em volta aberta, trajetoria unica entre as validas, recorde estritamente melhor, abertura do modelo e premio
// decididos de uma vez em `concluirVolta` como race_finish_lap, um premio por carteira por modelo, ranking pela melhor volta de cada
// carteira com empate pela mais antiga). Nada daqui entra em rota.
import type { Carimbo } from './rules'
import { carteirasDistintas, compararVoltas, decidirPremio, melhorVolta, type VoltaDeCarteira } from './rules'
import type { AberturaDoModelo, DadosValidos, LinhaRanking, MelhorDaCarteira, RaceStore, ResultadoDaVolta, VoltaRow } from './service'

interface VoltaGuardada extends VoltaRow {
  splits: number[] | null
  traceSha: string | null
  clientLapMs: number | null
}

export interface PremioGuardado {
  id: string
  trackId: string
  wallet: string
  model: string
  lapId: string
  lapMs: number
  phase: 'abertura' | 'desafio' | 'campeonato'
  state: 'pending_review' | 'approved' | 'delivered' | 'rejected'
}

/** A linha de race_openings: a abertura fechada de um modelo (a volta que fechou e a que leva o carro). */
export interface AberturaGuardada {
  closingLapId: string
  winningLapId: string
  prizeId: string | null
  drivers: number
}

export class StoreMemoria implements RaceStore {
  voltas = new Map<string, VoltaGuardada>()
  hits = new Map<string, Array<Carimbo & { pos: [number, number, number]; v: number }>>()
  recordes = new Map<string, { lapId: string; wallet: string; lapMs: number }>()
  premios: PremioGuardado[] = []
  /** race_openings: por `pista|modelo` */
  aberturas = new Map<string, AberturaGuardada>()
  perfis = new Map<string, string>()
  /** quantas chamadas ao banco (para provar que o replay nao regrava nada) */
  gravacoes = 0

  async anularAbertas(wallet: string, motivo: string, agoraMs: number): Promise<void> {
    for (const v of this.voltas.values()) if (v.wallet === wallet && v.status === 'open') this.fechar(v, motivo, agoraMs)
  }

  private fechar(v: VoltaGuardada, motivo: string, agoraMs: number): void {
    v.status = 'void'
    v.voidReason = motivo
    v.finishedAtMs = agoraMs
  }

  async abrirVolta(n: { id: string; trackId: string; wallet: string; model: string; startedAtMs: number; expiresAtMs: number }): Promise<'ok' | 'conflito'> {
    for (const v of this.voltas.values()) if (v.wallet === n.wallet && v.status === 'open') return 'conflito'
    this.voltas.set(n.id, { ...n, status: 'open', voidReason: null, finishedAtMs: null, lapMs: null, splits: null, traceSha: null, clientLapMs: null })
    this.hits.set(n.id, [])
    this.gravacoes++
    return 'ok'
  }

  async volta(id: string): Promise<VoltaRow | null> {
    const v = this.voltas.get(id)
    return v ? { ...v } : null
  }

  async voltaAberta(wallet: string): Promise<VoltaRow | null> {
    for (const v of this.voltas.values()) if (v.wallet === wallet && v.status === 'open') return { ...v }
    return null
  }

  async ultimoPortao(raceId: string): Promise<Carimbo | null> {
    const l = this.hits.get(raceId) ?? []
    const u = l[l.length - 1]
    return u ? { i: u.i, t: u.t } : null
  }

  async gravarPortao(h: { raceId: string; i: number; tMs: number; pos: [number, number, number]; v: number }): Promise<'ok' | 'duplicado'> {
    const v = this.voltas.get(h.raceId)
    const l = this.hits.get(h.raceId)
    if (!v || !l || v.status !== 'open' || l.some((x) => x.i === h.i)) return 'duplicado'
    l.push({ i: h.i, t: h.tMs, pos: h.pos, v: h.v })
    l.sort((a, b) => a.i - b.i)
    this.gravacoes++
    return 'ok'
  }

  async portoes(raceId: string): Promise<Carimbo[]> {
    return (this.hits.get(raceId) ?? []).map((x) => ({ i: x.i, t: x.t }))
  }

  async anular(raceId: string, motivo: string, agoraMs: number): Promise<void> {
    const v = this.voltas.get(raceId)
    if (v && v.status === 'open') this.fechar(v, motivo, agoraMs)
  }

  async validar(raceId: string, d: DadosValidos): Promise<'ok' | 'perdida' | 'trace_repetido'> {
    const v = this.voltas.get(raceId)
    if (!v || v.status !== 'open') return 'perdida'
    for (const o of this.voltas.values()) if (o.status === 'valid' && o.traceSha === d.traceSha) return 'trace_repetido'
    Object.assign(v, { status: 'valid', finishedAtMs: d.finishedAtMs, lapMs: d.lapMs, clientLapMs: d.clientLapMs, splits: d.splits, traceSha: d.traceSha })
    this.gravacoes++
    return 'ok'
  }

  /** race_claim_record: true so' se NAO havia recorde ou a volta e' ESTRITAMENTE mais rapida (empate fica com a mais antiga) */
  private reivindicarRecorde(n: { trackId: string; model: string; lapId: string; wallet: string; lapMs: number }): boolean {
    const k = `${n.trackId}|${n.model}`
    const atual = this.recordes.get(k)
    if (atual && !(atual.lapMs > n.lapMs)) return false
    this.recordes.set(k, { lapId: n.lapId, wallet: n.wallet, lapMs: n.lapMs })
    this.gravacoes++
    return true
  }

  /** a view race_best_laps: a melhor volta valida de cada carteira por modelo */
  private melhores(trackId: string, model: string): VoltaGuardada[] {
    const por = new Map<string, VoltaGuardada>()
    for (const v of this.voltas.values()) {
      if (v.status !== 'valid' || v.trackId !== trackId || v.model !== model) continue
      const m = por.get(v.wallet)
      if (!m || compararVoltas(cmp(v), cmp(m)) < 0) por.set(v.wallet, v)
    }
    return [...por.values()].sort((a, b) => compararVoltas(cmp(a), cmp(b)))
  }

  async posicao(trackId: string, model: string, wallet: string, lapMs: number, finishedAtMs: number): Promise<number> {
    const outros = this.melhores(trackId, model).filter((v) => v.wallet !== wallet)
    return 1 + outros.filter((v) => v.lapMs! < lapMs || (v.lapMs === lapMs && v.finishedAtMs! < finishedAtMs)).length
  }

  /** o indice unico (wallet, model) onde state <> 'rejected' */
  private temPremio(wallet: string, model: string): boolean {
    return this.premios.some((x) => x.wallet === wallet && x.model === model && x.state !== 'rejected')
  }

  private criarPremio(p: Omit<PremioGuardado, 'id' | 'state'>): string | null {
    if (this.temPremio(p.wallet, p.model)) return null
    const id = `premio-${this.premios.length + 1}`
    this.premios.push({ ...p, id, state: 'pending_review' })
    this.gravacoes++
    return id
  }

  /** race_finish_lap: recorde, carteiras diferentes, abertura, premio e posicao numa transacao so' (o JS e' de uma thread: e' atomico) */
  async concluirVolta(a: { lapId: string; premio: boolean; necessarios: number }): Promise<ResultadoDaVolta | null> {
    const lap = this.voltas.get(a.lapId)
    if (!lap || lap.status !== 'valid') return null
    const k = `${lap.trackId}|${lap.model}`
    const doModelo = [...this.voltas.values()].filter((v) => v.status === 'valid' && v.trackId === lap.trackId && v.model === lap.model)
    const comCarteira = (v: VoltaGuardada): VoltaDeCarteira => ({ ...cmp(v), wallet: v.wallet })
    const reivindicou = this.reivindicarRecorde({ trackId: lap.trackId, model: lap.model, lapId: lap.id, wallet: lap.wallet, lapMs: lap.lapMs! })
    const carteiras = carteirasDistintas(doModelo)
    const dec = decidirPremio({
      modeloComPremio: a.premio,
      aberturaFechada: this.aberturas.has(k),
      carteiras,
      necessarios: a.necessarios,
      volta: comCarteira(lap),
      recorde: reivindicou,
      melhorDoModelo: melhorVolta(doModelo.map(comCarteira)),
      jaTemPremio: (w) => this.temPremio(w, lap.model),
    })
    if (dec.fechouAbertura) {
      const vencedora = melhorVolta(doModelo.map(comCarteira))!
      // o recorde da abertura e' a volta vencedora (conserta um recorde velho que tenha sido anulado)
      this.recordes.set(k, { lapId: vencedora.id, wallet: vencedora.wallet, lapMs: vencedora.lapMs })
      const prizeId = dec.premio ? this.criarPremio({ trackId: lap.trackId, wallet: dec.premio.wallet, model: lap.model, lapId: dec.premio.lapId, lapMs: dec.premio.lapMs, phase: 'abertura' }) : null
      this.aberturas.set(k, { closingLapId: lap.id, winningLapId: vencedora.id, prizeId, drivers: carteiras })
    } else if (dec.premio && !this.premios.some((x) => x.lapId === lap.id)) {
      // nunca dois premios na mesma volta, em estado nenhum
      this.criarPremio({ trackId: lap.trackId, wallet: dec.premio.wallet, model: lap.model, lapId: dec.premio.lapId, lapMs: dec.premio.lapMs, phase: 'desafio' })
    }
    const abertura = this.aberturas.get(k)
    return {
      record: this.recordes.get(k)?.lapId === lap.id,
      rank: await this.posicao(lap.trackId, lap.model, lap.wallet, lap.lapMs!, lap.finishedAtMs!),
      prize: this.premios.some((x) => x.lapId === lap.id && x.state !== 'rejected') ? 'pending_review' : 'none',
      phase: a.premio && !abertura ? 'opening' : 'open',
      drivers: carteiras,
      needed: a.necessarios,
      openingClosed: a.premio && abertura?.closingLapId === lap.id,
    }
  }

  async abertura(trackId: string, model: string): Promise<AberturaDoModelo> {
    const doModelo = [...this.voltas.values()].filter((v) => v.status === 'valid' && v.trackId === trackId && v.model === model)
    return { drivers: carteirasDistintas(doModelo), fechada: this.aberturas.has(`${trackId}|${model}`) }
  }

  async ranking(trackId: string, model: string, limite: number): Promise<LinhaRanking[]> {
    return this.melhores(trackId, model)
      .slice(0, limite)
      .map((v, k) => ({ lapId: v.id, wallet: v.wallet, lapMs: v.lapMs!, finishedAtMs: v.finishedAtMs!, splits: k === 0 ? v.splits : null }))
  }

  async melhoresDaCarteira(trackId: string, wallet: string): Promise<MelhorDaCarteira[]> {
    const out: MelhorDaCarteira[] = []
    const modelos = new Set([...this.voltas.values()].filter((v) => v.wallet === wallet && v.status === 'valid').map((v) => v.model))
    for (const model of modelos) {
      const m = this.melhores(trackId, model).find((v) => v.wallet === wallet)
      if (m) out.push({ model, lapId: m.id, lapMs: m.lapMs!, finishedAtMs: m.finishedAtMs! })
    }
    return out
  }

  async handles(wallets: string[]): Promise<Map<string, string>> {
    const m = new Map<string, string>()
    for (const w of wallets) {
      const h = this.perfis.get(w)
      if (h) m.set(w, h)
    }
    return m
  }
}

const cmp = (v: VoltaGuardada) => ({ id: v.id, lapMs: v.lapMs!, finishedAtMs: v.finishedAtMs! })
