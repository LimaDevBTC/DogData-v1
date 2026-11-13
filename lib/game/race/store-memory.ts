// So' para os testes: o RaceStore na memoria, com as MESMAS regras do banco da migration 038 (uma aberta por carteira, carimbo
// unico por portao e so' em volta aberta, trajetoria unica entre as validas, recorde estritamente melhor, um premio por carteira por
// modelo, ranking pela melhor volta de cada carteira com empate pela mais antiga). Nada daqui entra em rota.
import type { Carimbo, VoltaDaJanela } from './rules'
import { compararVoltas } from './rules'
import type { CampeonatoRow, DadosValidos, LinhaRanking, MelhorDaCarteira, PremioNovo, RaceStore, VoltaRow } from './service'

interface VoltaGuardada extends VoltaRow {
  splits: number[] | null
  traceSha: string | null
  clientLapMs: number | null
}

interface PremioGuardado extends PremioNovo {
  id: string
  state: 'pending_review' | 'approved' | 'delivered' | 'rejected'
}

export class StoreMemoria implements RaceStore {
  voltas = new Map<string, VoltaGuardada>()
  hits = new Map<string, Array<Carimbo & { pos: [number, number, number]; v: number }>>()
  recordes = new Map<string, { lapId: string; wallet: string; lapMs: number }>()
  premios: PremioGuardado[] = []
  campeonatos = new Map<string, CampeonatoRow>()
  perfis = new Map<string, string>()
  /** quantas chamadas ao banco (para provar que o replay nao regrava nada) */
  gravacoes = 0

  async campeonato(trackId: string): Promise<CampeonatoRow | null> {
    return this.campeonatos.get(trackId) ?? null
  }

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

  async reivindicarRecorde(n: { trackId: string; model: string; lapId: string; wallet: string; lapMs: number }): Promise<boolean> {
    const k = `${n.trackId}|${n.model}`
    const atual = this.recordes.get(k)
    if (atual && !(atual.lapMs > n.lapMs)) return false
    this.recordes.set(k, { lapId: n.lapId, wallet: n.wallet, lapMs: n.lapMs })
    this.gravacoes++
    return true
  }

  async recordeEh(trackId: string, model: string, lapId: string): Promise<boolean> {
    return this.recordes.get(`${trackId}|${model}`)?.lapId === lapId
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

  async criarPremio(p: PremioNovo): Promise<'ok' | 'ja_tem'> {
    if (this.premios.some((x) => x.wallet === p.wallet && x.model === p.model && x.state !== 'rejected')) return 'ja_tem'
    this.premios.push({ ...p, id: `premio-${this.premios.length + 1}`, state: 'pending_review' })
    this.gravacoes++
    return 'ok'
  }

  async temPremio(wallet: string, model: string): Promise<boolean> {
    return this.premios.some((x) => x.wallet === wallet && x.model === model && x.state !== 'rejected')
  }

  async premioDaVolta(lapId: string): Promise<boolean> {
    return this.premios.some((x) => x.lapId === lapId && x.state !== 'rejected')
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

  /** a view race_championship_best */
  async candidatosDoFechamento(trackId: string): Promise<VoltaDaJanela[]> {
    const c = this.campeonatos.get(trackId)
    if (!c) return []
    const por = new Map<string, VoltaGuardada>()
    for (const v of this.voltas.values()) {
      if (v.status !== 'valid' || v.trackId !== trackId || v.finishedAtMs! < c.startsAtMs || v.finishedAtMs! >= c.endsAtMs) continue
      const m = por.get(v.model)
      if (!m || compararVoltas(cmp(v), cmp(m)) < 0) por.set(v.model, v)
    }
    return [...por.values()].map((v) => ({ id: v.id, wallet: v.wallet, model: v.model, lapMs: v.lapMs!, finishedAtMs: v.finishedAtMs! }))
  }

  async fecharCampeonato(trackId: string, agoraMs: number): Promise<boolean> {
    const c = this.campeonatos.get(trackId)
    if (!c || c.closedAtMs !== null) return false
    c.closedAtMs = agoraMs
    return true
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
