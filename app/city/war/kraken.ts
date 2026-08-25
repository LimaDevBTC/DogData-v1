// O fio com a Kraken: book e trades de DOG/USD pelo WebSocket v2, público.
//
// ⚠️ O BOOK CHEGA COMO SNAPSHOT + DELTAS, e delta com qty 0 REMOVE o nível.
// Perder essa regra deixa fantasma no campo de batalha: nível que já foi
// consumido continuaria com soldados em pé. O estado vive em Map por preço.
//
// ⚠️ RECONEXÃO SEM DRAMA: a Kraken derruba conexões longas de vez em quando.
// Cair é normal; o cliente espera com recuo e reassina, e o snapshot novo
// substitui o estado inteiro (nunca merge de snapshot com resto velho).

export interface BookLevel {
  price: number
  qty: number
}

export interface WarTrade {
  side: 'buy' | 'sell'
  price: number
  qty: number
  at: number
}

export interface KrakenFeed {
  stop: () => void
}

const WS_URL = 'wss://ws.kraken.com/v2'
const SYMBOL = 'DOG/USD'

export function connectKraken(opts: {
  depth?: 25 | 100 | 500
  onBook: (bids: BookLevel[], asks: BookLevel[]) => void
  onTrade: (t: WarTrade) => void
  onStatus: (s: 'connecting' | 'live' | 'down') => void
}): KrakenFeed {
  const depth = opts.depth ?? 100
  let ws: WebSocket | null = null
  let dead = false
  let tentativa = 0
  const bids = new Map<number, number>()
  const asks = new Map<number, number>()

  const publica = () => {
    const b = Array.from(bids, ([price, qty]) => ({ price, qty })).sort((x, y) => y.price - x.price)
    const a = Array.from(asks, ([price, qty]) => ({ price, qty })).sort((x, y) => x.price - y.price)
    opts.onBook(b, a)
  }

  const aplica = (lado: Map<number, number>, rows: any[]) => {
    for (const r of rows || []) {
      const price = Number(r.price)
      const qty = Number(r.qty)
      if (!(price > 0)) continue
      if (qty > 0) lado.set(price, qty)
      else lado.delete(price)
    }
  }

  const abre = () => {
    if (dead) return
    opts.onStatus('connecting')
    ws = new WebSocket(WS_URL)

    ws.onopen = () => {
      tentativa = 0
      ws?.send(JSON.stringify({ method: 'subscribe', params: { channel: 'book', symbol: [SYMBOL], depth } }))
      ws?.send(JSON.stringify({ method: 'subscribe', params: { channel: 'trade', symbol: [SYMBOL] } }))
    }

    ws.onmessage = (ev) => {
      let m: any
      try {
        m = JSON.parse(ev.data)
      } catch {
        return
      }
      if (m.channel === 'book') {
        for (const d of m.data || []) {
          if (m.type === 'snapshot') {
            bids.clear()
            asks.clear()
          }
          aplica(bids, d.bids)
          aplica(asks, d.asks)
        }
        opts.onStatus('live')
        publica()
      } else if (m.channel === 'trade' && m.type === 'update') {
        for (const d of m.data || []) {
          opts.onTrade({
            side: d.side === 'sell' ? 'sell' : 'buy',
            price: Number(d.price),
            qty: Number(d.qty),
            at: Date.now(),
          })
        }
      }
    }

    ws.onclose = () => {
      if (dead) return
      opts.onStatus('down')
      tentativa += 1
      setTimeout(abre, Math.min(30_000, 1000 * 2 ** tentativa))
    }
    ws.onerror = () => {
      try {
        ws?.close()
      } catch {}
    }
  }

  // ⚠️ o primeiro connect espera 200ms de propósito: o StrictMode do React em
  // dev monta-desmonta-monta o efeito em milissegundos, e dois WebSockets
  // seguidos contra a Kraken fazem o segundo entrar em recuo de reconexão.
  // O timer morre na limpeza do primeiro mount e só o mount real abre socket.
  const timer = setTimeout(abre, 200)
  return {
    stop: () => {
      dead = true
      clearTimeout(timer)
      try {
        ws?.close()
      } catch {}
    },
  }
}
