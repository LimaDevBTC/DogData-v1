"use client"

// ═══════════════════════════════════════════════════════════════════════════
// O MODO "CAR" da janela de pagamento (DonateProvider, ./donate-modal.tsx): comprar um carro da DOG MOTORS em $DOG
// ou BTC. O cartão da vitrine (/dogcity/motors) chama `useDonate().open({ car })` e esta janela entra no lugar da
// janela da licença, com o mesmo provedor, as mesmas funções de envio pela carteira (lib/wallet/donate.ts), o mesmo
// QR (./qr-code.tsx), o mesmo BIP-21 (lib/wallet/bip21.ts) e a mesma regra: depois do envio, quem diz para onde o
// dinheiro foi é o SERVIDOR (GET /api/dogcity/car-order), não esta página.
//
// AS REGRAS DE DINHEIRO (falha fechada, nada confiado ao cliente):
//   1. DONO = a carteira da SESSÃO (cookie dg_wallet, BIP-322). Sem sessão, ou sessão de outra carteira: a janela
//      pede a assinatura antes de qualquer pedido. O corpo do pedido nunca nomeia dono.
//   2. O PEDIDO vem do servidor (POST /api/dogcity/car-quote), gravado antes da resposta. A tela confere a resposta
//      inteira (lib/game/cars/order-view.ts) e, fora da forma, não mostra instrução de pagamento nenhuma.
//   3. O VALOR é o EXATO do pedido: BTC em sats inteiros, $DOG em átomos inteiros (lib/wallet/donate.ts
//      sendDogExactAtoms, sem ponto flutuante). Nada se digita.
//   4. O DESTINO só aparece quando bate com a segunda declaração (lib/game/cars/pay-to.ts). Não bateu: sem endereço,
//      sem QR, sem botão.
//   5. A TRAVA corre pelo relógio do SERVIDOR (deslocamento medido na resposta) e é conferida de novo no clique.
//   6. Pedido sem pagamento NÃO volta do localStorage (uma extensão poderia trocar o endereço guardado): só o par
//      pedido + txid volta, e o estado dele vem do servidor.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useWallet } from '@/contexts/WalletContext'
import { donationSupport, sendBtcDonation, sendDogExactAtoms } from '@/lib/wallet/donate'
import { normalizeAddress } from '@/lib/dog/licence-btc'
import { atomsPretty, orderErrorText, parseCarOrder, type CarCurrency, type CarOrderView } from '@/lib/game/cars/order-view'
import { payToConfirmed } from '@/lib/game/cars/pay-to'
import type { OrderStage, OrderWarning } from '@/lib/game/cars/order-status'
import { BIP21_LABEL_MOTORS, bip21Uri } from '@/lib/wallet/bip21'
import { QrCode } from './qr-code'

export interface CarPick {
  id: string
  name: string
  classLabel: string
  /** o preço em $DOG que o cartão mostrou (do GET car-quote); o pedido tem de dar o MESMO número */
  priceDog: number
  /** a prévia em sats do cartão (indicativa) */
  sats: number | null
  photo: { avif: string; webp: string; fallback: string }
}

/** o evento que a vitrine escuta para reler a garagem (o carro chegou) */
export const GARAGE_EVENT = 'dogmotors:garage-changed'

const STORE_KEY = 'dogmotors-sent-v1'
const TXID = /^[0-9a-f]{64}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

interface SentRecord { orderId: string; txid: string; model: string; wallet: string; currency: CarCurrency; at: number }

function readSent(model: string, wallet: string): SentRecord | null {
  try {
    const all = JSON.parse(localStorage.getItem(STORE_KEY) || '{}') as Record<string, SentRecord>
    const r = all[`${wallet}:${model}`]
    if (!r || !UUID.test(r.orderId) || !TXID.test(r.txid) || r.model !== model || r.wallet !== wallet) return null
    if (r.currency !== 'btc' && r.currency !== 'dog') return null
    // depois de 8 dias (a revisão do $DOG vai até 7) o registro só atrapalha
    if (!Number.isFinite(r.at) || Date.now() - r.at > 8 * 24 * 3600_000) return null
    return r
  } catch { return null }
}
function writeSent(r: SentRecord | null, key: { model: string; wallet: string }) {
  try {
    const all = JSON.parse(localStorage.getItem(STORE_KEY) || '{}') as Record<string, SentRecord>
    if (r) all[`${key.wallet}:${key.model}`] = r
    else delete all[`${key.wallet}:${key.model}`]
    localStorage.setItem(STORE_KEY, JSON.stringify(all))
  } catch { /* modo privado: o estado só vive enquanto a janela está aberta */ }
}

const n0 = (n: number) => Math.round(n).toLocaleString('en-US')
const short = (a: string) => (a.length > 18 ? `${a.slice(0, 8)}…${a.slice(-6)}` : a)
function clock(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
function btcText(sats: number): string {
  const s = String(sats).padStart(9, '0')
  return `${s.slice(0, -8)}.${s.slice(-8)}`
}

const REVIEW_TEXT: Record<string, string> = {
  underpaid: 'The payment was smaller than the order.',
  overpaid: 'The payment was more than twice the order.',
  amount_mismatch: 'The $DOG amount was not the exact amount of the order.',
  payer_mismatch: 'The payment came from a different address than the order.',
  order_expired: 'The payment arrived after the order expired.',
  already_owned: 'This wallet already had this car.',
  order_already_paid: 'This order had already been paid.',
  ambiguous_owner: 'The paying address is tied to more than one wallet.',
  ambiguous_order: 'The payment matched more than one order.',
  above_ceiling: 'The payment is above the limit for one car.',
  invalid_amount: 'The amount could not be read.',
}

interface StatusView {
  stage: OrderStage
  reason: string | null
  warnings: OrderWarning[]
  confirmations: number | null
  needed: number
  network: 'read' | 'unavailable' | 'not_needed'
}

function parseStatus(j: any): StatusView | null {
  const stages: OrderStage[] = ['awaiting_payment', 'expired', 'sent', 'in_mempool', 'confirming', 'in_review', 'not_matched', 'delivered']
  if (!j || !stages.includes(j.stage)) return null
  const warnings = Array.isArray(j.warnings) ? j.warnings.filter((w: unknown) => w === 'wrong_destination' || w === 'underpaid' || w === 'other_payer') : []
  const c = Number.isSafeInteger(j.confirmations) && j.confirmations >= 0 ? j.confirmations : null
  return {
    stage: j.stage, reason: typeof j.reason === 'string' ? j.reason : null, warnings, confirmations: c,
    needed: Number.isSafeInteger(j.needed) && j.needed > 0 ? j.needed : 6,
    network: j.network === 'read' || j.network === 'unavailable' ? j.network : 'not_needed',
  }
}

// ── peças de tela ──────────────────────────────────────────────────────────

function Label({ n, children, right }: { n?: string; children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <p className="dc-label flex items-baseline gap-3 text-dc-mist">
        {n && <span className="text-dc-lava">{n}</span>}
        <span>{children}</span>
      </p>
      {right}
    </div>
  )
}

function Row({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-dc-snow/[0.08] py-2.5 last:border-0">
      <dt className="dc-label shrink-0 text-dc-dusty">{k}</dt>
      <dd className="min-w-0 break-all text-right font-mono text-[12px] text-dc-snow">{children}</dd>
    </div>
  )
}

function Notice({ tone, title, children }: { tone: 'warn' | 'danger' | 'ok' | 'info'; title: string; children?: ReactNode }) {
  const c = tone === 'danger' ? 'border-[#EF4444]/60 bg-[#EF4444]/[0.07] text-[#F87171]'
    : tone === 'warn' ? 'border-[#F59E0B]/50 bg-[#F59E0B]/[0.06] text-[#FBBF24]'
      : tone === 'ok' ? 'border-dc-lava/60 bg-dc-lava/[0.07] text-dc-hot'
        : 'border-dc-snow/[0.16] bg-dc-snow/[0.03] text-dc-snow'
  return (
    <div className={`border px-4 py-3 ${c}`} role={tone === 'danger' ? 'alert' : undefined}>
      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em]">{title}</p>
      {children && <div className="mt-1.5 font-body text-[14px] leading-[21px] text-dc-snow/[0.86]">{children}</div>}
    </div>
  )
}

function CopyBtn({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(value).then(() => { setDone(true); setTimeout(() => setDone(false), 1500) }).catch(() => {})
      }}
      className="dc-label shrink-0 text-dc-mist transition-colors hover:text-dc-hot"
      aria-label={`Copy ${label}`}
    >
      {done ? 'Copied' : 'Copy'}
    </button>
  )
}

// ── a janela ───────────────────────────────────────────────────────────────

export function CarCheckout({ car, isOpen, onClose }: { car: CarPick; isOpen: boolean; onClose: () => void }) {
  const { account, verified, prove, openModal, isModalOpen, status: walletStatus } = useWallet()
  const walletId = account?.walletId ?? null
  const rpc = account ? donationSupport(walletId) === 'rpc' : false

  const [currency, setCurrency] = useState<CarCurrency>('dog')
  const [session, setSession] = useState<string | null | undefined>(undefined)  // undefined = lendo
  const [owned, setOwned] = useState<boolean | null>(null)
  const [signing, setSigning] = useState(false)
  const [signError, setSignError] = useState<string | null>(null)

  const [order, setOrder] = useState<CarOrderView | null>(null)
  const [ordering, setOrdering] = useState(false)
  const [orderError, setOrderError] = useState<string | null>(null)
  const [clockOffset, setClockOffset] = useState(0)
  const [nowMs, setNowMs] = useState(() => Date.now())

  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [showQr, setShowQr] = useState(false)
  const [sent, setSent] = useState<SentRecord | null>(null)
  const [status, setStatus] = useState<StatusView | null>(null)

  const panel = useRef<HTMLDivElement>(null)
  const closeBtn = useRef<HTMLButtonElement>(null)
  // a janela da carteira por cima: o Escape é dela, não desta
  const walletOpen = useRef(isModalOpen)
  walletOpen.current = isModalOpen

  const ordAddr = account ? normalizeAddress(account.ordinalsAddress) : null
  const payAddr = account ? normalizeAddress(account.paymentAddress) : null
  const signedHere = !!session && !!ordAddr && session === ordAddr

  // ── a sessão (quem fica com o carro): lida do servidor, nunca do localStorage ──
  const readSession = useCallback(async () => {
    try {
      const r = await fetch('/api/wallet/session', { cache: 'no-store' })
      const j = await r.json().catch(() => null)
      setSession(normalizeAddress(j?.session?.address) ?? null)
    } catch { setSession(null) }
  }, [])

  // a cada abertura: estado limpo, sessão relida
  useEffect(() => {
    if (!isOpen) return
    setOrder(null); setOrderError(null); setSendError(null); setShowQr(false); setStatus(null); setSent(null)
    setOwned(null); setSignError(null); setSession(undefined)
    readSession()
  }, [isOpen, car.id, readSession])
  // a carteira mudou (conectou, trocou de conta, provou): relê a sessão
  useEffect(() => { if (isOpen) readSession() }, [isOpen, ordAddr, verified, readSession])

  // ── a garagem da carteira da sessão: já tem este modelo? E há um envio em andamento deste modelo? ──
  useEffect(() => {
    if (!isOpen || !session) return
    let alive = true
    const prev = readSent(car.id, session)
    if (prev) setSent(prev)
    fetch(`/api/dogcity/cars?address=${encodeURIComponent(session)}`)
      .then(async (r) => ({ ok: r.ok, j: await r.json().catch(() => null) }))
      .then(({ ok, j }) => {
        if (!alive) return
        if (!ok || normalizeAddress(j?.address) !== session || !Array.isArray(j?.cars)) { setOwned(null); return }
        setOwned(j.cars.some((c: any) => c?.model === car.id))
      })
      .catch(() => { if (alive) setOwned(null) })
    return () => { alive = false }
  }, [isOpen, session, car.id])

  // ── o relógio da trava (pelo horário do servidor) ──
  useEffect(() => {
    if (!order || sent) return
    const id = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(id)
  }, [order, sent])
  const leftMs = order ? Math.max(0, order.expiresAtMs - (nowMs + clockOffset)) : 0
  const live = !!order && leftMs > 0
  const destinationOk = !!order && payToConfirmed(order.currency, order.payTo)

  // ── o estado do pedido depois do envio: o servidor lê a rede e o banco ──
  useEffect(() => {
    if (!isOpen || !sent) return
    let alive = true
    let timer: ReturnType<typeof setTimeout> | null = null
    let tries = 0
    const tick = () => {
      fetch(`/api/dogcity/car-order?id=${sent.orderId}&txid=${sent.txid}`, { cache: 'no-store' })
        .then(async (r) => (r.ok ? parseStatus(await r.json()) : null))
        .then((s) => {
          if (!alive) return
          if (s) setStatus(s)
          if (s?.stage === 'delivered') {
            setOwned(true)
            window.dispatchEvent(new CustomEvent(GARAGE_EVENT, { detail: { model: car.id } }))
            return
          }
          tries += 1
          // nos primeiros segundos a transação ainda está chegando à rede: olha mais vezes
          timer = setTimeout(tick, tries < 6 ? 5_000 : 15_000)
        })
        .catch(() => { if (alive) timer = setTimeout(tick, 15_000) })
    }
    tick()
    return () => { alive = false; if (timer) clearTimeout(timer) }
  }, [isOpen, sent, car.id])

  // ── teclado, foco e rolagem de fundo ──
  useEffect(() => {
    if (!isOpen) return
    const prev = document.activeElement as HTMLElement | null
    const html = document.documentElement
    const overflow = html.style.overflow
    html.style.overflow = 'hidden'
    const t = setTimeout(() => closeBtn.current?.focus(), 30)
    const onKey = (e: KeyboardEvent) => {
      if (walletOpen.current) return
      if (e.key === 'Escape') onClose()
      if (e.key !== 'Tab' || !panel.current) return
      const f = panel.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled])')
      if (!f.length) return
      const first = f[0], last = f[f.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(t)
      html.style.overflow = overflow
      window.removeEventListener('keydown', onKey)
      prev?.focus?.()
    }
  }, [isOpen, onClose])

  // ── ações ──
  const signIn = useCallback(async () => {
    setSigning(true); setSignError(null)
    try { await prove(); await readSession() } catch (e: any) { setSignError(e?.message || 'The signature did not go through.') } finally { setSigning(false) }
  }, [prove, readSession])

  const placeOrder = useCallback(async () => {
    setOrderError(null); setSendError(null); setOrder(null); setShowQr(false)
    if (!session || !signedHere) { setOrderError('Sign in with this wallet first.'); return }
    const payer = currency === 'btc' ? payAddr : session
    if (!payer) { setOrderError('This wallet did not give a Bitcoin payment address.'); return }
    setOrdering(true)
    try {
      const r = await fetch('/api/dogcity/car-quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currency === 'btc' ? { model: car.id, currency, paymentAddress: payer } : { model: car.id, currency }),
      })
      const j = await r.json().catch(() => null)
      if (!r.ok) {
        if (j?.error === 'already_owned') setOwned(true)
        if (r.status === 401) await readSession()
        throw new Error(orderErrorText(r.status, j?.error))
      }
      const p = parseCarOrder(j, { model: car.id, currency, payerAddress: payer, priceDog: car.priceDog })
      if (!p.ok) {
        throw new Error(p.error === 'price changed'
          ? 'The price of this car changed. Close this window and open the car again to see the new price.'
          : 'The order came back in a shape this page does not accept. Do not pay. Try again in a minute.')
      }
      setClockOffset(p.order.serverTimeMs - Date.now())
      setNowMs(Date.now())
      setOrder(p.order)
    } catch (e: any) {
      setOrderError(e?.message || 'The order did not go through. Nothing was charged.')
    } finally {
      setOrdering(false)
    }
  }, [session, signedHere, currency, payAddr, car.id, car.priceDog, readSession])

  const pay = useCallback(async () => {
    if (!order || !session) return
    setSending(true); setSendError(null)
    try {
      // a trava e o destino conferidos de novo NO CLIQUE
      if (!payToConfirmed(order.currency, order.payTo)) throw new Error('The DOG MOTORS address could not be confirmed. Do not pay from this screen.')
      if (order.expiresAtMs - (Date.now() + clockOffset) <= 0) throw new Error('The order expired. Get a new one.')
      const res = order.currency === 'btc'
        ? await sendBtcDonation(walletId, order.payTo, order.sats as number)
        : await sendDogExactAtoms(walletId, order.payTo, order.dogExactAtoms as number)
      const txid = String(res?.txid ?? '').toLowerCase()
      if (!TXID.test(txid)) throw new Error('The wallet did not return a transaction id. Check your wallet before paying again.')
      const rec: SentRecord = { orderId: order.id, txid, model: car.id, wallet: session, currency: order.currency, at: Date.now() }
      writeSent(rec, { model: car.id, wallet: session })
      setSent(rec)
    } catch (e: any) {
      setSendError(e?.message || 'The payment did not go through.')
    } finally {
      setSending(false)
    }
  }, [order, session, clockOffset, walletId, car.id])

  if (!isOpen || typeof document === 'undefined') return null
  // a janela da carteira (WalletConnectModal, z-100) abre por cima: esta sai da frente e volta quando ela fecha
  if (isModalOpen) return null

  const target = (document.querySelector('[data-motors-portal]') as HTMLElement | null) ?? document.body

  // ── o conteúdo por estágio ──
  let body: ReactNode
  if (sent) body = <StatusPane car={car} sent={sent} status={status} onDone={onClose} onClear={() => { writeSent(null, { model: car.id, wallet: sent.wallet }); setSent(null); setStatus(null); setOrder(null) }} />
  else if (owned === true) {
    body = (
      <Notice tone="ok" title="Already in your garage">
        This wallet already has the {car.name}. DOG MOTORS sells one of each model per wallet.
      </Notice>
    )
  } else if (!order) {
    body = (
      <div className="space-y-6">
        {/* 01 · quem fica com o carro */}
        <section className="space-y-3">
          <Label n="01">The car goes to</Label>
          {!account ? (
            <>
              <button type="button" onClick={openModal} className="dc-btn dc-btn-fill w-full">Connect a wallet</button>
              <p className="font-body text-[14px] leading-[21px] text-dc-mist">Xverse, UniSat, OKX or Kray. The car is registered to the wallet you connect and sign with.</p>
            </>
          ) : session === undefined ? (
            <p className="font-mono text-[12px] text-dc-mist">Reading your wallet session…</p>
          ) : !signedHere ? (
            <>
              <div className="border border-dc-snow/[0.12] bg-dc-deep px-4 py-3">
                <p className="font-mono text-[12px] text-dc-snow">{short(account.ordinalsAddress)}</p>
                <p className="mt-1 font-body text-[14px] leading-[21px] text-dc-mist">
                  {session ? `Your signed session is for ${short(session)}. Sign again with this wallet.` : 'Sign one message to prove this wallet is yours. No transaction, no fee.'}
                </p>
              </div>
              <button type="button" onClick={signIn} disabled={signing || walletStatus === 'proving'} className="dc-btn dc-btn-fill w-full">
                {signing || walletStatus === 'proving' ? 'Confirm in your wallet' : 'Sign in with your wallet'}
              </button>
              {signError && <p className="font-mono text-[12px] text-[#F87171]">{signError}</p>}
            </>
          ) : (
            <dl className="border border-dc-snow/[0.12] bg-dc-deep px-4">
              <Row k="Wallet">{short(session)}</Row>
              <Row k="Session"><span className="text-dc-hot">Signed</span></Row>
            </dl>
          )}
        </section>

        {/* 02 · a moeda */}
        <section className="space-y-3">
          <Label n="02">Pay with</Label>
          <div role="radiogroup" aria-label="Pay with" className="grid grid-cols-2 border border-dc-snow/[0.16]">
            {(['dog', 'btc'] as const).map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={currency === c}
                onClick={() => setCurrency(c)}
                className={`min-h-[52px] px-3 text-left transition-colors ${currency === c ? 'bg-dc-snow/[0.08]' : 'hover:bg-dc-snow/[0.03]'} ${c === 'btc' ? 'border-l border-dc-snow/[0.16]' : ''}`}
              >
                <span className={`block font-mono text-[12px] font-semibold tracking-[0.12em] ${currency === c ? 'text-dc-hot' : 'text-dc-snow'}`}>{c === 'dog' ? '$DOG' : 'BTC'}</span>
                <span className="block font-mono text-[11px] text-dc-mist tabular-nums">
                  {c === 'dog' ? `${n0(car.priceDog)} $DOG` : car.sats ? `About ${n0(car.sats)} sats now` : 'Same value in BTC'}
                </span>
              </button>
            ))}
          </div>
          <p className="font-body text-[14px] leading-[21px] text-dc-mist">
            {currency === 'dog'
              ? 'You get an exact amount for this order, the price plus a few hundred-thousandths of a $DOG that identify it. Send it within 60 minutes from your ordinals address.'
              : 'The same value as the $DOG price, at the median of live exchange prices, locked for 15 minutes. Pay from the payment address of the wallet you connected.'}
          </p>
        </section>

        {orderError && <p className="font-mono text-[12px] leading-[18px] text-[#F87171]">{orderError}</p>}
        <button type="button" onClick={placeOrder} disabled={!signedHere || ordering} className="dc-btn dc-btn-fill w-full">
          {ordering ? 'Creating your order' : currency === 'btc' ? 'Lock the BTC price' : 'Get my exact amount'}
        </button>
        <p className="text-center font-mono text-[11px] leading-[17px] text-dc-dusty">
          Nothing is charged here. Your wallet asks before anything is sent.
        </p>
      </div>
    )
  } else {
    // ── o pedido: o valor exato, o prazo, de onde e para onde ──
    const amountBig = order.currency === 'btc' ? `${n0(order.sats as number)}` : atomsPretty(order.dogExactAtoms as number) ?? ''
    const [intPart, decPart] = order.currency === 'dog' ? amountBig.split('.') : [amountBig, '']
    const uri = order.currency === 'btc' ? bip21Uri(order.payTo, order.sats as number, BIP21_LABEL_MOTORS) : order.payTo
    body = (
      <div className="space-y-5">
        <section className="border border-dc-snow/[0.14] bg-dc-deep px-4 py-4">
          <Label right={<span className="dc-label text-dc-dusty">Order {order.id.slice(0, 8)}</span>}>{order.currency === 'btc' ? 'Pay exactly' : 'Send exactly'}</Label>
          <p className="mt-2 font-cond text-[44px] font-semibold leading-none tabular-nums text-dc-snow">
            {intPart}
            {order.currency === 'dog' && <><span className="text-dc-snow">.</span><span className="text-dc-hot">{decPart}</span></>}
            <span className="ml-2 font-mono text-[13px] font-medium text-dc-mist">{order.currency === 'btc' ? 'SATS' : '$DOG'}</span>
          </p>
          <p className="mt-2 font-mono text-[11px] leading-[17px] text-dc-mist tabular-nums">
            {order.currency === 'btc'
              ? `${btcText(order.sats as number)} BTC${order.sources.length ? ` · median of ${order.sources.join(', ')}` : ''}`
              : `The last five digits identify your order. Send this exact amount, not ${n0(order.priceDog)}.`}
          </p>
          <div className="mt-3 flex items-center justify-between gap-3 border-t border-dc-snow/[0.08] pt-3">
            <p className={`font-mono text-[12px] tabular-nums ${!live ? 'text-[#F87171]' : leftMs < 60_000 ? 'text-[#FBBF24]' : 'text-dc-snow'}`} aria-live="polite">
              {!live ? 'Order expired' : order.currency === 'btc' ? `Price locked for ${clock(leftMs)}` : `Send within ${clock(leftMs)}`}
            </p>
            <button type="button" onClick={placeOrder} className="dc-label text-dc-mist transition-colors hover:text-dc-hot">New order</button>
          </div>
        </section>

        {!destinationOk ? (
          // ⚠️ PORTÃO: o endereço do pedido não bate com a segunda declaração. Nada de endereço, QR ou botão.
          <Notice tone="danger" title="Do not pay from this screen">
            This page could not confirm the DOG MOTORS {order.currency === 'btc' ? 'Bitcoin' : '$DOG'} address of this order, so it shows no address to pay.
            Reach the team on X @dogdatabtc before sending anything.
          </Notice>
        ) : !live ? (
          <button type="button" onClick={placeOrder} className="dc-btn dc-btn-fill w-full">Get a new order</button>
        ) : (
          <>
            <dl className="border border-dc-snow/[0.12] px-4">
              <Row k="From">{short(order.payerAddress)}</Row>
              <Row k="To">
                <span className="inline-flex items-baseline gap-3"><span>{order.payTo}</span><CopyBtn value={order.payTo} label="the DOG MOTORS address" /></span>
              </Row>
              <Row k="Amount">
                <span className="inline-flex items-baseline gap-3">
                  <span>{order.currency === 'btc' ? `${btcText(order.sats as number)} BTC` : `${order.dogExact} $DOG`}</span>
                  <CopyBtn value={order.currency === 'btc' ? btcText(order.sats as number) : (order.dogExact as string)} label="the exact amount" />
                </span>
              </Row>
            </dl>
            <p className="font-mono text-[11px] leading-[17px] text-dc-dusty">
              Your wallet must show this same address. If it shows another one, reject it.
            </p>
            {sendError && <p className="font-mono text-[12px] leading-[18px] text-[#F87171]">{sendError}</p>}
            {rpc ? (
              <button type="button" onClick={pay} disabled={sending} className="dc-btn dc-btn-fill w-full">
                {sending ? 'Confirm in your wallet' : order.currency === 'btc' ? `Pay ${n0(order.sats as number)} sats` : `Send ${order.dogExact} $DOG`}
              </button>
            ) : (
              <p className="font-body text-[14px] leading-[21px] text-dc-mist">
                This wallet cannot send from inside a site. Send the exact amount from {short(order.payerAddress)} in your wallet, to the address above.
              </p>
            )}
            {rpc && (
              <button type="button" onClick={() => setShowQr((v) => !v)} className="dc-label text-dc-mist transition-colors hover:text-dc-snow">
                {showQr ? 'Hide the QR code' : 'Pay from another device'}
              </button>
            )}
            {(showQr || !rpc) && (
              <div className="flex flex-col items-center gap-3 border border-dc-snow/[0.12] px-4 py-5">
                <QrCode text={uri} label={`QR code to pay DOG MOTORS in ${order.currency === 'btc' ? 'Bitcoin' : '$DOG'}`} className="h-40 w-40" />
                <p className="max-w-[34ch] text-center font-mono text-[11px] leading-[17px] text-dc-mist">
                  {order.currency === 'btc'
                    ? `The code carries the address and ${n0(order.sats as number)} sats. Pay from ${short(order.payerAddress)}.`
                    : `$DOG has no payment link: the code carries the address only. Type ${order.dogExact} in your wallet and send from ${short(order.payerAddress)}.`}
                </p>
                {order.currency === 'btc' && <a href={uri} className="dc-btn dc-btn-line dc-btn-sm w-full">Open in a Bitcoin wallet</a>}
              </div>
            )}
          </>
        )}
      </div>
    )
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`Buy the ${car.name}`}
      style={{
        ['--dc-void' as string]: '#15130F', ['--dc-deep' as string]: '#0D0C09', ['--dc-plate' as string]: '#1B1915',
        ['--dc-snow' as string]: '#F5E9D6', ['--dc-mist' as string]: '#A39C90', ['--dc-lava' as string]: '#E8660D', ['--dc-hot' as string]: '#FF8A3D',
        ['--dc-ease' as string]: 'cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <div className="absolute inset-0 bg-dc-deep/[0.86] dc-fade-in" onClick={onClose} />
      <div
        ref={panel}
        className="dc-sheet relative flex max-h-[92svh] w-full flex-col border-t border-dc-snow/[0.14] bg-dc-void text-dc-snow sm:max-w-[520px] sm:border"
      >
        {/* cabeçalho: a marca da loja e fechar */}
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-dc-snow/[0.12] px-5">
          <p className="dc-label text-dc-mist"><span className="text-dc-lava">DOG MOTORS</span> · Checkout</p>
          <button ref={closeBtn} type="button" onClick={onClose} className="dc-label inline-flex h-10 items-center text-dc-snow transition-colors hover:text-dc-hot" aria-label="Close">
            Close
          </button>
        </div>
        <div className="overflow-y-auto overscroll-contain px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-5">
          {/* o carro: a foto, a classe, o nome e o preço do cartão */}
          <div className="flex items-center gap-4 border-b border-dc-snow/[0.12] pb-5">
            <picture className="block w-[120px] shrink-0 sm:w-[148px]">
              <source type="image/avif" srcSet={car.photo.avif} sizes="148px" />
              <source type="image/webp" srcSet={car.photo.webp} sizes="148px" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={car.photo.fallback} alt="" width={296} height={185} className="block aspect-[16/10] w-full border border-dc-snow/[0.1] object-cover" />
            </picture>
            <div className="min-w-0">
              <p className="dc-label text-dc-mist">{car.classLabel}</p>
              <h2 className="mt-1 font-cond text-[28px] font-semibold uppercase leading-[0.95] text-dc-snow sm:text-[32px]">{car.name}</h2>
              <p className="mt-1.5 font-mono text-[12px] tabular-nums text-dc-snow/[0.9]">{n0(car.priceDog)} <span className="text-dc-mist">$DOG</span></p>
            </div>
          </div>
          <div className="pt-5">{body}</div>
        </div>
      </div>
    </div>,
    target,
  )
}

// ── depois do envio: o estado do pedido, dito pelo servidor ─────────────────

function StatusPane({ car, sent, status, onDone, onClear }: {
  car: CarPick
  sent: SentRecord
  status: StatusView | null
  onDone: () => void
  onClear: () => void
}) {
  const stage = status?.stage ?? 'sent'
  const seen = stage === 'in_mempool' || stage === 'confirming' || stage === 'delivered'
  const conf = status?.confirmations ?? 0
  const needed = status?.needed ?? 6
  const steps: { k: string; done: boolean; now: boolean; text: ReactNode }[] = [
    { k: 'Order placed', done: true, now: false, text: sent.currency === 'btc' ? 'Price locked by DOG MOTORS.' : 'Exact amount reserved for you.' },
    { k: 'Payment sent', done: true, now: stage === 'sent', text: <span className="break-all font-mono text-[11px]">{sent.txid}</span> },
    { k: 'Seen by the network', done: seen, now: stage === 'in_mempool', text: seen ? 'Our server read the transaction on the network.' : 'Waiting for the network to show it.' },
    {
      k: `${needed} confirmations`, done: stage === 'delivered' || conf >= needed, now: stage === 'confirming',
      text: stage === 'delivered' ? 'Confirmed.' : stage === 'confirming' ? `${Math.min(conf, needed)} of ${needed}, about ten minutes each.` : 'About an hour after the first block.',
    },
    { k: 'In your garage', done: stage === 'delivered', now: false, text: stage === 'delivered' ? `The ${car.name} is registered to your wallet.` : 'The car is registered right after the confirmations.' },
  ]
  const w = status?.warnings ?? []
  return (
    <div className="space-y-5">
      {stage === 'delivered' && (
        <Notice tone="ok" title="It is yours">
          The {car.name} is in your garage. Find it in DOG CITY, at the DOG TOWER.
        </Notice>
      )}
      {w.includes('wrong_destination') && (
        <Notice tone="danger" title="This transaction does not pay DOG MOTORS">
          Our server read it on the network and it pays a different address than your order. Something on this device may have changed the
          destination. Do not send again from here, and reach the team on X @dogdatabtc with the transaction id.
        </Notice>
      )}
      {w.includes('underpaid') && (
        <Notice tone="warn" title="Less than the order">
          This transaction pays fewer sats than the order. It goes to a manual check instead of counting on its own.
        </Notice>
      )}
      {w.includes('other_payer') && (
        <Notice tone="warn" title="Sent from another address">
          This payment does not come from the address on the order, so it cannot match on its own. It goes to a manual check.
        </Notice>
      )}
      {(stage === 'in_review' || stage === 'not_matched') && (
        <Notice tone="warn" title="Manual check">
          {REVIEW_TEXT[status?.reason ?? ''] ?? 'This payment could not be matched to the order on its own.'} The team reviews it by hand:
          the car is delivered, or the payment is sent back on chain. Reach @dogdatabtc on X with the transaction id.
        </Notice>
      )}
      {status?.network === 'unavailable' && stage !== 'delivered' && (
        <p className="font-mono text-[11px] text-dc-dusty">The network did not answer this time. Checking again shortly.</p>
      )}

      <ol className="relative">
        {steps.map((s, i) => (
          <li key={s.k} className="relative grid grid-cols-[22px_1fr] gap-x-3 pb-4 last:pb-0">
            {i < steps.length - 1 && <span aria-hidden className={`absolute left-[5px] top-4 bottom-0 w-px ${s.done ? 'bg-dc-lava' : 'bg-dc-snow/[0.16]'}`} />}
            <span aria-hidden className={`relative mt-1 h-[11px] w-[11px] border ${s.done ? 'border-dc-lava bg-dc-lava' : s.now ? 'border-dc-lava bg-dc-void' : 'border-dc-snow/[0.4] bg-dc-void'}`}>
              {s.now && <span className="dc-ping absolute inset-0 border border-dc-lava" />}
            </span>
            <div className="min-w-0">
              <p className={`font-mono text-[12px] font-semibold uppercase tracking-[0.12em] ${s.done || s.now ? 'text-dc-snow' : 'text-dc-dusty'}`}>{s.k}</p>
              <div className="mt-0.5 font-body text-[14px] leading-[20px] text-dc-mist">{s.text}</div>
            </div>
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap gap-2">
        <a href={`https://mempool.space/tx/${sent.txid}`} target="_blank" rel="noopener noreferrer" className="dc-btn dc-btn-line dc-btn-sm">mempool.space</a>
        <button type="button" onClick={onDone} className="dc-btn dc-btn-fill dc-btn-sm">{stage === 'delivered' ? 'Done' : 'Close, keep checking'}</button>
      </div>
      {stage !== 'delivered' && (
        <p className="font-mono text-[11px] leading-[17px] text-dc-dusty">
          You can close this window. Opening this car again shows this payment.{' '}
          <button type="button" onClick={onClear} className="underline decoration-dc-snow/30 underline-offset-2 hover:text-dc-snow">Start a new order instead</button>
        </p>
      )}
    </div>
  )
}
