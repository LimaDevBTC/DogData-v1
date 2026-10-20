// ═══════════════════════════════════════════════════════════════════════════
// FONTES DE PREÇO da licença em BTC: só leitura de API pública de corretora.
//
// BTC/USD: Kraken, Coinbase, Bitstamp (as mesmas da régua do mint, /dogcity/docs).
// DOG/USD: Kraken e as demais corretoras que listam o par. Hoje Gate.io e MEXC, que cotam
//          em USDT: contam como USD (dólar digital 1:1), e isso está dito nas docs.
// Coinbase e Bitstamp não listam DOG; se listarem um dia, entra aqui uma linha.
//
// A conta da mediana, o mínimo de fontes e a recusa moram em licence-btc.ts. Aqui só se
// busca e se lê o número; qualquer resposta torta vira erro e a fonte sai da conta.
// `fetch` entra por parâmetro: o teste passa respostas gravadas, sem rede.
//
// `at(ts)` é o preço no INÍCIO do minuto que contém `ts` (a abertura da vela de 1 minuto).
// Mercado fino não negocia todo minuto (DOG): sem vela naquele minuto vale o FECHAMENTO da
// última vela anterior, até 30 minutos para trás. Vela posterior ao minuto nunca entra
// (nada olha para frente do bloco), e sem vela nessa janela a fonte sai da conta.
// ═══════════════════════════════════════════════════════════════════════════
import {
  BTC_USD_BOUNDS, DOG_USD_BOUNDS, medianPrice, positive,
  type MedianResult, type PriceAtBlock, type SourceSample,
} from './licence-btc'

export type FetchLike = (url: string, init?: { signal?: AbortSignal; cache?: 'no-store' }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>

const TIMEOUT_MS = 4_000

async function getJson(f: FetchLike, url: string): Promise<any> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const r = await f(url, { signal: ctrl.signal, cache: 'no-store' })
    if (!r.ok) throw new Error(`${url} ${r.status}`)
    return await r.json()
  } finally {
    clearTimeout(t)
  }
}

const need = (n: unknown, what: string): number => {
  const v = positive(n)
  if (!Number.isFinite(v)) throw new Error(`bad ${what}`)
  return v
}

export interface PriceSource {
  name: string
  pair: 'DOG/USD' | 'BTC/USD'
  spot(f: FetchLike): Promise<number>
  /** preço no minuto de `tsSec` (segundos Unix) */
  at(f: FetchLike, tsSec: number): Promise<number>
}

const minute = (tsSec: number) => Math.floor(tsSec / 60) * 60
/** quanto para trás se aceita a última vela quando o minuto pedido não teve negócio */
const LOOKBACK_S = 30 * 60

interface Candle { t: number; open: number; close: number }

/** a abertura da vela do minuto `m`, ou o fechamento da última anterior dentro da janela */
function pickAt(candles: Candle[], m: number, who: string): number {
  const usable = candles
    .filter((c) => Number.isFinite(c.t) && c.t <= m && c.t >= m - LOOKBACK_S)
    .sort((a, b) => b.t - a.t)
  const c = usable[0]
  if (!c) throw new Error(`${who}: no candle at or just before that minute`)
  return need(c.t === m ? c.open : c.close, `${who} candle`)
}

function kraken(pair: 'DOG/USD' | 'BTC/USD', krakenPair: string): PriceSource {
  return {
    name: 'Kraken',
    pair,
    async spot(f) {
      const j = await getJson(f, `https://api.kraken.com/0/public/Ticker?pair=${krakenPair}`)
      if (j?.error?.length) throw new Error('kraken error')
      const first = Object.values(j?.result ?? {})[0] as any
      return need(first?.c?.[0], 'kraken last')
    },
    async at(f, tsSec) {
      const m = minute(tsSec)
      const j = await getJson(f, `https://api.kraken.com/0/public/OHLC?pair=${krakenPair}&interval=1&since=${m - LOOKBACK_S}`)
      if (j?.error?.length) throw new Error('kraken error')
      const rows = (Object.values(j?.result ?? {}).find(Array.isArray) as any[][] | undefined) ?? []
      return pickAt(rows.map((r) => ({ t: Number(r?.[0]), open: Number(r?.[1]), close: Number(r?.[4]) })), m, 'kraken')
    },
  }
}

const coinbaseBtc: PriceSource = {
  name: 'Coinbase',
  pair: 'BTC/USD',
  async spot(f) {
    const j = await getJson(f, 'https://api.exchange.coinbase.com/products/BTC-USD/ticker')
    return need(j?.price, 'coinbase price')
  },
  async at(f, tsSec) {
    const m = minute(tsSec)
    const iso = (s: number) => new Date(s * 1000).toISOString().replace('.000Z', 'Z')
    const j = await getJson(f, `https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=60&start=${iso(m - LOOKBACK_S)}&end=${iso(m + 60)}`)
    return pickAt((Array.isArray(j) ? j : []).map((r: any) => ({ t: Number(r?.[0]), open: Number(r?.[3]), close: Number(r?.[4]) })), m, 'coinbase')
  },
}

const bitstampBtc: PriceSource = {
  name: 'Bitstamp',
  pair: 'BTC/USD',
  async spot(f) {
    const j = await getJson(f, 'https://www.bitstamp.net/api/v2/ticker/btcusd/')
    return need(j?.last, 'bitstamp last')
  },
  async at(f, tsSec) {
    const m = minute(tsSec)
    const j = await getJson(f, `https://www.bitstamp.net/api/v2/ohlc/btcusd/?step=60&limit=40&start=${m - LOOKBACK_S}`)
    return pickAt((j?.data?.ohlc ?? []).map((r: any) => ({ t: Number(r?.timestamp), open: Number(r?.open), close: Number(r?.close) })), m, 'bitstamp')
  },
}

const gateDog: PriceSource = {
  name: 'Gate.io',
  pair: 'DOG/USD',
  async spot(f) {
    const j = await getJson(f, 'https://api.gateio.ws/api/v4/spot/tickers?currency_pair=DOG_USDT')
    return need(j?.[0]?.last, 'gate last')
  },
  async at(f, tsSec) {
    const m = minute(tsSec)
    const j = await getJson(f, `https://api.gateio.ws/api/v4/spot/candlesticks?currency_pair=DOG_USDT&interval=1m&from=${m - LOOKBACK_S}&to=${m + 60}`)
    // [tempo, volume em USDT, fechamento, máxima, mínima, abertura, ...]
    return pickAt((Array.isArray(j) ? j : []).map((r: any) => ({ t: Number(r?.[0]), open: Number(r?.[5]), close: Number(r?.[2]) })), m, 'gate')
  },
}

const mexcDog: PriceSource = {
  name: 'MEXC',
  pair: 'DOG/USD',
  async spot(f) {
    const j = await getJson(f, 'https://api.mexc.com/api/v3/ticker/price?symbol=DOGUSDT')
    return need(j?.price, 'mexc price')
  },
  async at(f, tsSec) {
    const m = minute(tsSec)
    // com endTime a MEXC não "pula" para a próxima vela quando o minuto não teve negócio
    const j = await getJson(f, `https://api.mexc.com/api/v3/klines?symbol=DOGUSDT&interval=1m&startTime=${(m - LOOKBACK_S) * 1000}&endTime=${(m + 60) * 1000 - 1}&limit=40`)
    return pickAt((Array.isArray(j) ? j : []).map((r: any) => ({ t: Number(r?.[0]) / 1000, open: Number(r?.[1]), close: Number(r?.[4]) })), m, 'mexc')
  },
}

export const DOG_SOURCES: PriceSource[] = [kraken('DOG/USD', 'DOGUSD'), gateDog, mexcDog]
export const BTC_SOURCES: PriceSource[] = [kraken('BTC/USD', 'XBTUSD'), coinbaseBtc, bitstampBtc]

async function collect(sources: PriceSource[], run: (s: PriceSource) => Promise<number>): Promise<SourceSample[]> {
  const settled = await Promise.allSettled(sources.map(async (s) => ({ name: s.name, price: await run(s) })))
  return settled.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []))
}

export interface Medians { dog: MedianResult; btc: MedianResult }

/** as duas medianas AGORA. Qualquer uma pode vir recusada. */
export async function spotMedians(f: FetchLike, dog = DOG_SOURCES, btc = BTC_SOURCES): Promise<Medians> {
  const [d, b] = await Promise.all([collect(dog, (s) => s.spot(f)), collect(btc, (s) => s.spot(f))])
  return { dog: medianPrice(d, DOG_USD_BOUNDS), btc: medianPrice(b, BTC_USD_BOUNDS) }
}

/** o preço de um bloco (pelo horário dele), ou null se as fontes não bastam */
export async function priceAtTime(f: FetchLike, blockTimeMs: number, dog = DOG_SOURCES, btc = BTC_SOURCES): Promise<PriceAtBlock | null> {
  if (!Number.isFinite(blockTimeMs) || blockTimeMs <= 0) return null
  const ts = Math.floor(blockTimeMs / 1000)
  const [d, b] = await Promise.all([collect(dog, (s) => s.at(f, ts)), collect(btc, (s) => s.at(f, ts))])
  const dm = medianPrice(d, DOG_USD_BOUNDS), bm = medianPrice(b, BTC_USD_BOUNDS)
  return dm.ok && bm.ok ? { dogUsd: dm.price, btcUsd: bm.price } : null
}
