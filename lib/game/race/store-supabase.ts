// O RaceStore em producao: Supabase com a service role (lib/supabase.ts), nas tabelas da migration 038. So' as rotas do servidor
// importam este arquivo. Cada metodo e' UMA operacao atomica do banco; o que compete (abrir, gravar portao, validar, premiar, recordar)
// se resolve pelos indices unicos, pelos gatilhos e pelas funcoes da migration, nunca por "le e depois grava".
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Carimbo, VoltaDaJanela } from './rules'
import type { CampeonatoRow, DadosValidos, LinhaRanking, MelhorDaCarteira, PremioNovo, RaceStore, VoltaRow } from './service'

type Linha = Record<string, unknown>

const iso = (ms: number): string => new Date(ms).toISOString()
const ms = (v: unknown): number | null => {
  if (typeof v !== 'string') return null
  const t = Date.parse(v)
  return Number.isFinite(t) ? t : null
}
const PG_UNIQUE = '23505'
const PG_RAISE = 'P0001'

function falha(contexto: string, error: { message: string } | null): void {
  if (error) throw new Error(`race ${contexto}: ${error.message}`)
}

function voltaDe(r: Linha): VoltaRow {
  return {
    id: r.id as string,
    trackId: r.track_id as string,
    wallet: r.wallet as string,
    model: r.model as string,
    status: r.status as VoltaRow['status'],
    voidReason: (r.void_reason as string | null) ?? null,
    startedAtMs: ms(r.started_at) ?? 0,
    expiresAtMs: ms(r.expires_at) ?? 0,
    finishedAtMs: ms(r.finished_at),
    lapMs: typeof r.lap_ms === 'number' ? r.lap_ms : null,
  }
}

const COLUNAS_VOLTA = 'id, track_id, wallet, model, status, void_reason, started_at, expires_at, finished_at, lap_ms'

export function criarStoreSupabase(db: SupabaseClient): RaceStore {
  return {
    async campeonato(trackId): Promise<CampeonatoRow | null> {
      const { data, error } = await db.from('race_championship').select('starts_at, ends_at, closed_at').eq('track_id', trackId).maybeSingle()
      falha('campeonato', error)
      if (!data) return null
      const startsAtMs = ms(data.starts_at)
      const endsAtMs = ms(data.ends_at)
      if (startsAtMs === null || endsAtMs === null) return null
      return { trackId, startsAtMs, endsAtMs, closedAtMs: ms(data.closed_at) }
    },

    async anularAbertas(wallet, motivo, agoraMs) {
      const { error } = await db.from('race_laps').update({ status: 'void', void_reason: motivo, finished_at: iso(agoraMs) }).eq('wallet', wallet).eq('status', 'open')
      falha('anularAbertas', error)
    },

    async abrirVolta(v) {
      const { error } = await db.from('race_laps').insert({
        id: v.id,
        track_id: v.trackId,
        wallet: v.wallet,
        model: v.model,
        status: 'open',
        started_at: iso(v.startedAtMs),
        expires_at: iso(v.expiresAtMs),
      })
      if (error?.code === PG_UNIQUE) return 'conflito'
      falha('abrirVolta', error)
      return 'ok'
    },

    async volta(id) {
      const { data, error } = await db.from('race_laps').select(COLUNAS_VOLTA).eq('id', id).maybeSingle()
      falha('volta', error)
      return data ? voltaDe(data as Linha) : null
    },

    async voltaAberta(wallet) {
      const { data, error } = await db.from('race_laps').select(COLUNAS_VOLTA).eq('wallet', wallet).eq('status', 'open').maybeSingle()
      falha('voltaAberta', error)
      return data ? voltaDe(data as Linha) : null
    },

    async ultimoPortao(raceId): Promise<Carimbo | null> {
      const { data, error } = await db.from('race_gate_hits').select('i, t_server_ms').eq('race_id', raceId).order('i', { ascending: false }).limit(1)
      falha('ultimoPortao', error)
      const r = data?.[0] as Linha | undefined
      return r ? { i: Number(r.i), t: Number(r.t_server_ms) } : null
    },

    async gravarPortao(h) {
      const { error } = await db.from('race_gate_hits').insert({ race_id: h.raceId, i: h.i, t_server_ms: h.tMs, x: h.pos[0], y: h.pos[1], z: h.pos[2], v: h.v })
      // chave repetida (portao ja' gravado) ou o gatilho recusou (a volta deixou de estar aberta no meio): o portao nao entrou
      if (error?.code === PG_UNIQUE || error?.code === PG_RAISE) return 'duplicado'
      falha('gravarPortao', error)
      return 'ok'
    },

    async portoes(raceId): Promise<Carimbo[]> {
      const { data, error } = await db.from('race_gate_hits').select('i, t_server_ms').eq('race_id', raceId).order('i', { ascending: true }).limit(400)
      falha('portoes', error)
      return (data ?? []).map((r) => ({ i: Number((r as Linha).i), t: Number((r as Linha).t_server_ms) }))
    },

    async anular(raceId, motivo, agoraMs) {
      const { error } = await db.from('race_laps').update({ status: 'void', void_reason: motivo, finished_at: iso(agoraMs) }).eq('id', raceId).eq('status', 'open')
      falha('anular', error)
    },

    async validar(raceId, d: DadosValidos) {
      const { data, error } = await db
        .from('race_laps')
        .update({
          status: 'valid',
          finished_at: iso(d.finishedAtMs),
          lap_ms: d.lapMs,
          client_lap_ms: d.clientLapMs,
          splits: d.splits,
          trace_sha256: d.traceSha,
          flags: d.flags,
        })
        .eq('id', raceId)
        .eq('status', 'open')
        .select('id')
      if (error?.code === PG_UNIQUE) return 'trace_repetido'
      falha('validar', error)
      return data && data.length > 0 ? 'ok' : 'perdida'
    },

    async reivindicarRecorde(v) {
      const { data, error } = await db.rpc('race_claim_record', { p_track: v.trackId, p_model: v.model, p_lap_id: v.lapId, p_wallet: v.wallet, p_lap_ms: v.lapMs })
      falha('reivindicarRecorde', error)
      return data === true
    },

    async recordeEh(trackId, model, lapId) {
      const { data, error } = await db.from('race_records').select('lap_id').eq('track_id', trackId).eq('model', model).maybeSingle()
      falha('recordeEh', error)
      return (data as Linha | null)?.lap_id === lapId
    },

    async posicao(trackId, model, wallet, lapMs, finishedAtMs) {
      const { data, error } = await db.rpc('race_rank_of', { p_track: trackId, p_model: model, p_wallet: wallet, p_lap_ms: lapMs, p_finished_at: iso(finishedAtMs) })
      falha('posicao', error)
      return typeof data === 'number' && Number.isInteger(data) && data >= 1 ? data : 1
    },

    async criarPremio(p: PremioNovo) {
      const { error } = await db.from('race_prizes').insert({
        track_id: p.trackId,
        wallet: p.wallet,
        model: p.model,
        lap_id: p.lapId,
        lap_ms: p.lapMs,
        phase: p.phase,
        state: 'pending_review',
      })
      if (error?.code === PG_UNIQUE) return 'ja_tem'
      falha('criarPremio', error)
      return 'ok'
    },

    async temPremio(wallet, model) {
      const { count, error } = await db.from('race_prizes').select('id', { count: 'exact', head: true }).eq('wallet', wallet).eq('model', model).neq('state', 'rejected')
      falha('temPremio', error)
      return (count ?? 0) > 0
    },

    async premioDaVolta(lapId) {
      const { count, error } = await db.from('race_prizes').select('id', { count: 'exact', head: true }).eq('lap_id', lapId).neq('state', 'rejected')
      falha('premioDaVolta', error)
      return (count ?? 0) > 0
    },

    async ranking(trackId, model, limite): Promise<LinhaRanking[]> {
      const { data, error } = await db
        .from('race_best_laps')
        .select('id, wallet, lap_ms, finished_at')
        .eq('track_id', trackId)
        .eq('model', model)
        .order('lap_ms', { ascending: true })
        .order('finished_at', { ascending: true })
        .order('id', { ascending: true })
        .limit(limite)
      falha('ranking', error)
      const linhas: LinhaRanking[] = (data ?? []).map((r) => {
        const l = r as Linha
        return { lapId: l.id as string, wallet: l.wallet as string, lapMs: Number(l.lap_ms), finishedAtMs: ms(l.finished_at) ?? 0, splits: null }
      })
      // os splits (ms em cada portao) so' do recorde: e' o que o jogo usa para o delta ao vivo
      if (linhas.length) {
        const { data: sp, error: e2 } = await db.from('race_laps').select('splits').eq('id', linhas[0]!.lapId).maybeSingle()
        falha('ranking.splits', e2)
        const s = (sp as Linha | null)?.splits
        if (Array.isArray(s) && s.every((n) => typeof n === 'number')) linhas[0]!.splits = s as number[]
      }
      return linhas
    },

    async melhoresDaCarteira(trackId, wallet): Promise<MelhorDaCarteira[]> {
      const { data, error } = await db.from('race_best_laps').select('id, model, lap_ms, finished_at').eq('track_id', trackId).eq('wallet', wallet).limit(50)
      falha('melhoresDaCarteira', error)
      return (data ?? []).map((r) => {
        const l = r as Linha
        return { model: l.model as string, lapId: l.id as string, lapMs: Number(l.lap_ms), finishedAtMs: ms(l.finished_at) ?? 0 }
      })
    },

    async candidatosDoFechamento(trackId): Promise<VoltaDaJanela[]> {
      const { data, error } = await db.from('race_championship_best').select('lap_id, model, wallet, lap_ms, finished_at').eq('track_id', trackId).limit(100)
      falha('candidatosDoFechamento', error)
      return (data ?? []).map((r) => {
        const l = r as Linha
        return { id: l.lap_id as string, model: l.model as string, wallet: l.wallet as string, lapMs: Number(l.lap_ms), finishedAtMs: ms(l.finished_at) ?? 0 }
      })
    },

    async fecharCampeonato(trackId, agoraMs) {
      const { data, error } = await db.from('race_championship').update({ closed_at: iso(agoraMs) }).eq('track_id', trackId).is('closed_at', null).select('track_id')
      falha('fecharCampeonato', error)
      return (data?.length ?? 0) > 0
    },

    async handles(wallets) {
      const out = new Map<string, string>()
      const chaves = Array.from(new Set(wallets.map((w) => w.toLowerCase())))
      if (!chaves.length) return out
      const { data, error } = await db.from('dogcity_profiles').select('address, handle').in('address', chaves)
      // o handle e' enfeite: sem ele o ranking sai igual
      if (error || !data) return out
      const porChave = new Map(data.map((r) => [(r as Linha).address as string, (r as Linha).handle as string]))
      for (const w of wallets) {
        const h = porChave.get(w.toLowerCase())
        if (h) out.set(w, h)
      }
      return out
    },
  }
}
