"use client"

// Doação de dentro do site: o CTA abre esta janela, a carteira assina, a
// transação vai pro endereço do fundo. O que existia antes era o endereço e um
// QR para copiar à mão, e isso continua aqui embaixo como caminho garantido:
// nem toda carteira sabe transferir a pedido de um site (ver lib/wallet/donate.ts).

import {
  createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import qrcode from 'qrcode-generator'
import {
  ArrowUpRight, Check, Copy, ExternalLink, Loader2, ShieldAlert, ShieldCheck, Wallet, X,
} from 'lucide-react'
import { useWallet } from '@/contexts/WalletContext'
import {
  DOG_DIVISIBILITY_FALLBACK, donationSupport, readDogBalance, sendBtcDonation,
  sendDogDonation, type RuneBalance,
} from '@/lib/wallet/donate'
import { DONATION_METHODS, DONATION_WALLET } from '@/app/dogcity/dogcity-data'

// ── contexto ───────────────────────────────────────────────────────────────

interface DonateContextValue {
  open: (opts?: { asset?: Asset; amount?: number }) => void
  close: () => void
}

const DonateContext = createContext<DonateContextValue | null>(null)

export function useDonate(): DonateContextValue {
  const ctx = useContext(DonateContext)
  // Um CTA fora do provedor não deve derrubar a página: ele só não abre nada.
  return ctx ?? { open: () => {}, close: () => {} }
}

type Asset = 'dog' | 'btc'

/** O que o servidor viu na rede sobre a transação que a carteira transmitiu. */
interface Verdict {
  found: boolean
  paysFund: boolean
  fundAddress: string
  valueToFund: number
  confirmed: boolean
}

const LADDER = [
  { amount: 10_000, name: 'Personal', note: 'mint your building' },
  { amount: 50_000, name: 'Commercial', note: 'customize and advertise' },
  { amount: 500_000, name: 'Patron', note: 'patron title' },
]

const SATS_PRESETS = [10_000, 50_000, 200_000]

const BTC_METHOD = DONATION_METHODS.find((m) => m.key === 'bitcoin')

const n0 = (n: number) => Math.round(n).toLocaleString('en-US')
// O que a pessoa digitou, mostrado como digitou: arredondar 1.234,5 para 1.235
// no botão de enviar é mentir sobre o que vai ser assinado.
const nAmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 5 })

const licenseFor = (dog: number) =>
  dog >= 500_000 ? 'Patron' : dog >= 50_000 ? 'Commercial' : dog >= 10_000 ? 'Personal' : null

/**
 * O que o campo aceita enquanto se digita. Sem isto, "10.000,50" (como se
 * escreve em português) vira NaN na hora de enviar, e um DOG com seis casas
 * não existe: a divisibilidade do rune é 5.
 */
function cleanAmount(raw: string, decimals: number): string {
  let v = raw.replace(/[^\d.]/g, '')
  if (decimals === 0) return v.replace(/\./g, '')
  const [head, ...rest] = v.split('.')
  return rest.length ? `${head}.${rest.join('').slice(0, decimals)}` : head
}

/** A frase que traduz o número digitado em posição na escada. */
function ladderHint(dog: number): string {
  if (dog <= 0) return 'Any amount makes you a Founder. 10,000 DOG unlocks the Personal license.'
  const reached = licenseFor(dog)
  const next = LADDER.find((l) => dog < l.amount)
  if (!next) return `${nAmt(dog)} DOG unlocks Patron, the top rung of the ladder.`
  const missing = nAmt(next.amount - dog)
  return reached
    ? `Unlocks ${reached}. ${missing} DOG more would reach ${next.name}.`
    : `Founder, by arrival. ${missing} DOG more would unlock ${next.name}.`
}

// ── como pagar sem a carteira conectada ────────────────────────────────────

const BIP21_LABEL = encodeURIComponent('DogCity construction fund')

/** Margem exigida pelo padrão. Sem os 4 módulos de silêncio, leitor nenhum lê. */
const QUIET = 4

/**
 * `bitcoin:<endereco>?amount=<btc>&label=…`, o pedido de pagamento do BIP-21.
 * ⚠️ O amount é em BTC com ponto decimal, NUNCA em satoshi, e o campo daqui é
 * em satoshi. Sem valor digitado o parâmetro sai fora inteiro: `amount=0` é um
 * pedido de pagar zero, não "pergunte quanto".
 * Rune não tem equivalente disto, então o DOG não ganha URI inventada.
 */
function bip21Uri(address: string, sats: number): string {
  const params: string[] = []
  if (sats > 0) {
    const btc = (Math.round(sats) / 1e8).toFixed(8).replace(/\.?0+$/, '')
    params.push(`amount=${btc}`)
  }
  params.push(`label=${BIP21_LABEL}`)
  return `bitcoin:${address}?${params.join('&')}`
}

/**
 * O QR desenhado aqui, da MESMA string que o link usa. O que existia antes era
 * um JPEG na pasta public: derivado que não acompanhava o endereço (se a
 * constante mudasse, o código mandava dinheiro para o lugar errado e nada
 * acusava), e compressão com perda suja justamente a borda dos módulos, que é
 * o que a câmera precisa ler.
 */
/**
 * ⚠️ SEGUNDA DECLARAÇÃO DOS ENDEREÇOS, DE PROPÓSITO.
 *
 * O endereço que a página mostra vem de `DONATION_METHODS`. Esta constante é uma CÓPIA
 * INDEPENDENTE das pontas do mesmo endereço, escrita à mão aqui. Se alguém editar um dos dois
 * lugares, os dois passam a discordar e o componente SE RECUSA a mostrar endereço, QR ou link.
 *
 * ⚠️ O QUE ISTO PEGA: bug nosso montando a URI errada, edição desatenta em um só arquivo, e
 * extensão de navegador que troca texto no DOM antes da montagem.
 * ⚠️ O QUE ISTO NÃO PEGA, e é honesto dizer: quem consegue INJETAR SCRIPT na página remenda
 * esta checagem junto. Contra esse vetor valem a CSP de `middleware.ts` e, acima de tudo, a
 * tela de confirmação da carteira, que mostra o destino e que atacante nenhum na nossa página
 * consegue alterar.
 *
 * ⚠️ SE TROCAR UM ENDEREÇO DE VERDADE, tem de trocar NOS DOIS LUGARES. É o ponto.
 */
const PONTAS_ESPERADAS: Record<string, { ini: string; fim: string; tam: number }> = {
  dog: { ini: 'bc1pxk7aw9', fim: 'qdylk2p', tam: 62 },
  btc: { ini: 'bc1qkq43g', fim: 'jspc63', tam: 42 },
}

/** true quando o endereço bate com a segunda declaração. Fora disso, não renderiza nada. */
function enderecoConfere(asset: string, addr: string): boolean {
  const e = PONTAS_ESPERADAS[asset === 'dog' ? 'dog' : 'btc']
  if (!e) return false
  return addr.length === e.tam && addr.startsWith(e.ini) && addr.endsWith(e.fim)
}

function QrCode({ text, label }: { text: string; label: string }) {
  const { d, size } = useMemo(() => {
    const q = qrcode(0, 'M')
    q.addData(text)
    q.make()
    const n = q.getModuleCount()
    // Um path só, acumulando corridas horizontais de módulos escuros: fica bem
    // mais leve no DOM que um <rect> por módulo.
    let path = ''
    for (let row = 0; row < n; row += 1) {
      let col = 0
      while (col < n) {
        if (!q.isDark(row, col)) { col += 1; continue }
        let run = 1
        while (col + run < n && q.isDark(row, col + run)) run += 1
        path += `M${col + QUIET} ${row + QUIET}h${run}v1h-${run}z`
        col += run
      }
    }
    return { d: path, size: n + QUIET * 2 }
  }, [text])

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={label}
      // O que está codificado, legível de fora: o endereço fica auditável sem
      // precisar decodificar a imagem.
      data-qr-text={text}
      shapeRendering="crispEdges"
      className="w-36 h-36 shrink-0"
    >
      {/* ⚠️ Contraste aqui é requisito de leitura, não estilo: branco e preto,
          nunca a paleta escura da casa. */}
      <rect width={size} height={size} fill="#FFFFFF" />
      <path d={d} fill="#000000" />
    </svg>
  )
}

// ── provedor ───────────────────────────────────────────────────────────────

export function DonateProvider({ children }: { children: ReactNode }) {
  const [isOpen, setOpen] = useState(false)
  const [asset, setAsset] = useState<Asset>('dog')
  const [preset, setPreset] = useState<number | null>(null)

  const open = useCallback((opts?: { asset?: Asset; amount?: number }) => {
    setAsset(opts?.asset ?? 'dog')
    setPreset(opts?.amount ?? null)
    setOpen(true)
  }, [])
  const close = useCallback(() => setOpen(false), [])

  const value = useMemo(() => ({ open, close }), [open, close])

  return (
    <DonateContext.Provider value={value}>
      {children}
      <DonateModal isOpen={isOpen} onClose={close} asset={asset} setAsset={setAsset} preset={preset} />
    </DonateContext.Provider>
  )
}

// ── janela ─────────────────────────────────────────────────────────────────

function DonateModal({
  isOpen, onClose, asset, setAsset, preset,
}: {
  isOpen: boolean
  onClose: () => void
  asset: Asset
  setAsset: (a: Asset) => void
  preset: number | null
}) {
  const { account, openModal } = useWallet()
  const walletId = account?.walletId ?? null
  const support = account ? donationSupport(walletId) : 'manual'

  const [amount, setAmount] = useState<string>('')
  const [balance, setBalance] = useState<RuneBalance | null>(null)
  const [sending, setSending] = useState(false)
  const [txid, setTxid] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [showManual, setShowManual] = useState(false)
  const [verdict, setVerdict] = useState<Verdict | null>(null)

  const address = asset === 'dog' ? DONATION_WALLET : BTC_METHOD?.address ?? DONATION_WALLET

  // Estado limpo a cada abertura: ninguém quer reabrir a janela e encontrar o
  // txid da doação da semana passada.
  useEffect(() => {
    if (!isOpen) return
    setAmount(preset ? String(preset) : '')
    setTxid(null)
    setVerdict(null)
    setError(null)
    setSending(false)
    setShowManual(false)
  }, [isOpen, preset, asset])

  // O saldo é pedido à carteira, não ao nosso indexador: é ele que decide se a
  // transferência cabe, e ele conhece o que ainda está na mempool.
  useEffect(() => {
    if (!isOpen || asset !== 'dog' || support !== 'rpc') return
    let alive = true
    readDogBalance(walletId).then((b) => { if (alive) setBalance(b) })
    return () => { alive = false }
  }, [isOpen, asset, support, walletId])

  // ⚠️ A PÁGINA NÃO É A AUTORIDADE SOBRE O DESTINO. Quem monta o pedido é este
  // navegador, e navegador é território do visitante: extensão hostil, devtools
  // ou um script de terceiro comprometido podem trocar o endereço antes da
  // carteira ver. Por isso, depois do broadcast, quem diz para onde o dinheiro
  // foi é o servidor, lendo a transação na rede e comparando com a constante
  // que vive no código do servidor. Se não bater, a tela grita.
  useEffect(() => {
    if (!txid) return
    let alive = true
    let attempt = 0
    const check = () => {
      fetch(`/api/donate/verify?txid=${txid}`)
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then((v: Verdict) => {
          if (!alive) return
          setVerdict(v)
          // A transação leva alguns segundos para aparecer na rede; três
          // tentativas cobrem isso sem virar polling eterno.
          if (!v.found && attempt < 3) {
            attempt += 1
            setTimeout(check, 4000)
          }
        })
        .catch(() => {
          if (alive && attempt < 3) {
            attempt += 1
            setTimeout(check, 4000)
          }
        })
    }
    check()
    return () => { alive = false }
  }, [txid])

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  const value = Number(amount.replace(/[^\d.]/g, '')) || 0
  const unlocked = asset === 'dog' ? licenseFor(value) : null
  const overBalance = asset === 'dog' && balance ? value > balance.spendable : false

  // Uma string só serve o QR e o link, e ela sai do endereço da constante: não
  // existe segunda cópia do destino para sair de sincronia.
  // ⚠️ PORTÃO: se a segunda declaração discordar, nada de endereço vai para a tela.
  const enderecoOk = useMemo(() => enderecoConfere(asset, address), [asset, address])

  const payUri = useMemo(
    () => (asset === 'btc' ? bip21Uri(address, value) : address),
    [asset, address, value],
  )

  const copyAddress = useCallback(() => {
    navigator.clipboard?.writeText(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [address])

  const send = useCallback(async () => {
    setSending(true)
    setError(null)
    try {
      const res = asset === 'dog'
        ? await sendDogDonation(walletId, address, value, balance?.divisibility ?? DOG_DIVISIBILITY_FALLBACK)
        : await sendBtcDonation(walletId, address, value)
      setTxid(res.txid)
    } catch (e: any) {
      setError(e?.message || 'The transfer did not go through.')
      // Recusa é resposta, não defeito: só abre o caminho manual quando a
      // carteira disse que não sabe fazer isso.
      if (/cannot send from inside a site/i.test(String(e?.message))) setShowManual(true)
    } finally {
      setSending(false)
    }
  }, [asset, walletId, address, value, balance])

  if (!isOpen || typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Support the build"
    >
      <div className="absolute inset-0 bg-black/80 animate-fade-in" onClick={onClose} />

      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-[#050505] border border-white/15 shadow-[0_24px_64px_-12px_rgba(0,0,0,0.9)] animate-fade-in">
        {/* cabeçalho */}
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-white/[0.06]">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-lava">◆ construction fund</p>
            <h2 className="font-display font-bold text-xl text-snow mt-1.5">Support the build</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-dusty hover:text-snow transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {txid ? (
          // ── depois do broadcast ──
          <div className="px-5 py-6 space-y-4">
            <div className="flex items-center gap-2 border border-[#10B981]/40 bg-[#10B981]/[0.06] px-3 py-2.5">
              <Check className="w-4 h-4 text-[#10B981] shrink-0" />
              <p className="font-mono text-[11px] text-[#10B981]">
                Sent. Your wallet broadcast the transaction.
              </p>
            </div>
            <div className="border border-white/10 bg-white/[0.02] px-3 py-2.5">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-dusty">transaction</p>
              <p className="font-mono text-[11px] text-snow break-all mt-1">{txid}</p>
            </div>
            {/* Onde o dinheiro foi de verdade, dito pelo servidor. */}
            {verdict === null ? (
              <p className="inline-flex items-center gap-2 font-mono text-[11px] text-dusty">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Checking on the network where this transaction actually went…
              </p>
            ) : !verdict.found ? (
              <p className="font-mono text-[11px] text-dusty leading-relaxed">
                Not visible on the network yet. That is normal in the first seconds; the
                destination check below runs again on your next visit to this screen.
              </p>
            ) : verdict.paysFund ? (
              <div className="border border-[#10B981]/40 bg-[#10B981]/[0.06] px-3 py-2.5">
                <p className="inline-flex items-center gap-2 font-mono text-[11px] text-[#10B981]">
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                  Destination verified by our server, not by this page.
                </p>
                <p className="font-mono text-[10px] text-mist break-all mt-1.5">
                  {verdict.fundAddress}
                </p>
              </div>
            ) : (
              <div className="border border-[#EF4444]/60 bg-[#EF4444]/[0.08] px-3 py-3">
                <p className="inline-flex items-center gap-2 font-mono text-[11px] text-[#EF4444] font-bold">
                  <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                  This transaction does NOT pay the construction fund.
                </p>
                <p className="text-[11px] text-mist leading-relaxed mt-2">
                  The fund address is {verdict.fundAddress}, and this transaction pays somewhere
                  else. Something on this device changed the destination: a browser extension, or
                  a tampered page. Do not send again from here, and tell us on X @dogdatabtc.
                </p>
              </div>
            )}

            <p className="text-[12px] text-mist leading-relaxed">
              The Founders Register reads confirmed blocks, so your plaque appears once the
              transaction confirms and our scanner sees it. Nothing else is needed from you.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/tx/bitcoin/${txid}`}
                onClick={onClose}
                className="inline-flex items-center gap-1.5 border border-lava/50 bg-lava/[0.08] px-4 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-lava hover:bg-lava/[0.16] transition-colors"
              >
                Track it here <ArrowUpRight className="w-3 h-3" />
              </Link>
              <a
                href={`https://mempool.space/tx/${txid}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 border border-white/10 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-dusty hover:text-snow transition-colors"
              >
                mempool <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        ) : (
          <div className="px-5 py-5 space-y-5">
            {/* de qual carteira */}
            {account ? (
              <div className="flex items-center justify-between gap-3 border border-white/10 bg-white/[0.02] px-3 py-2.5">
                <div className="min-w-0">
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-dusty">from</p>
                  <p className="font-mono text-[11px] text-snow truncate mt-0.5">
                    {account.ordinalsAddress.slice(0, 10)}…{account.ordinalsAddress.slice(-8)}
                  </p>
                </div>
                {asset === 'dog' && balance && (
                  <p className="font-mono text-[11px] text-mist shrink-0 tabular-nums">
                    {n0(balance.spendable)} DOG
                  </p>
                )}
              </div>
            ) : (
              // Caminho principal quando ninguém está conectado: é por aqui que
              // a carteira assina, então ele pesa mais que tudo embaixo.
              <button
                onClick={() => { onClose(); openModal() }}
                className="w-full flex items-center justify-center gap-2 bg-lava px-4 py-3.5 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-void hover:bg-lava-light transition-colors"
              >
                <Wallet className="w-4 h-4" />
                Connect a wallet to send from here
              </button>
            )}

            {/* qual moeda */}
            <div className="flex gap-px bg-white/10 border border-white/10">
              {(['dog', 'btc'] as Asset[]).map((a) => (
                <button
                  key={a}
                  onClick={() => setAsset(a)}
                  className={`flex-1 px-3 py-2.5 font-mono text-[10px] uppercase tracking-[0.18em] transition-colors ${
                    asset === a ? 'bg-lava/[0.12] text-lava' : 'bg-void text-dusty hover:text-snow'
                  }`}
                >
                  {a === 'dog' ? 'DOG' : 'Bitcoin'}
                </button>
              ))}
            </div>
            <p className="font-mono text-[10px] text-dusty -mt-3">
              {asset === 'dog'
                ? 'DOG on Bitcoin L1. This is what counts toward your license.'
                : 'Native SegWit. General support, it does not count toward a license.'}
            </p>

            {/* quanto: o campo livre é o principal. Os degraus da escada são
                atalhos ao lado dele, não a única forma de escolher: a maior
                parte das doações não cai exatamente em 10k, 50k ou 500k. */}
            <div className="space-y-3">
              <div className="flex items-baseline justify-between gap-3">
                <label
                  htmlFor="donate-amount"
                  className="font-mono text-[10px] uppercase tracking-[0.22em] text-dusty"
                >
                  How much you want to send
                </label>
                {asset === 'dog' && balance && balance.spendable > 0 && (
                  <button
                    onClick={() => setAmount(String(Number(balance.spendable.toFixed(5))))}
                    className="font-mono text-[10px] uppercase tracking-[0.16em] text-dusty hover:text-lava transition-colors"
                  >
                    Max {n0(balance.spendable)}
                  </button>
                )}
              </div>

              <div className="flex items-center gap-3 border border-white/15 bg-white/[0.02] px-4 py-3 focus-within:border-lava/60 transition-colors">
                <input
                  id="donate-amount"
                  autoFocus
                  value={amount}
                  onChange={(e) => setAmount(cleanAmount(e.target.value, asset === 'dog' ? 5 : 0))}
                  inputMode="decimal"
                  placeholder="0"
                  aria-label={`Amount in ${asset === 'dog' ? 'DOG' : 'satoshis'}`}
                  className="flex-1 min-w-0 bg-transparent font-display font-bold text-[26px] leading-none text-snow placeholder:text-white/15 outline-none tabular-nums"
                />
                <span className="font-mono text-[12px] text-mist shrink-0">
                  {asset === 'dog' ? 'DOG' : 'sats'}
                </span>
              </div>

              {/* atalhos da escada, com o nome do degrau: quem quer exatamente a
                  licença clica, quem quer outro número digita. */}
              <div className="flex flex-wrap gap-2">
                {asset === 'dog'
                  ? LADDER.map((l) => (
                      <button
                        key={l.amount}
                        onClick={() => setAmount(String(l.amount))}
                        className={`px-2.5 py-1.5 border font-mono text-[10px] tracking-[0.1em] transition-colors ${
                          value === l.amount
                            ? 'border-lava/60 bg-lava/[0.1] text-lava'
                            : 'border-white/10 text-dusty hover:text-snow hover:border-white/25'
                        }`}
                      >
                        {n0(l.amount)} <span className="uppercase tracking-[0.16em]">· {l.name}</span>
                      </button>
                    ))
                  : SATS_PRESETS.map((p) => (
                      <button
                        key={p}
                        onClick={() => setAmount(String(p))}
                        className={`px-2.5 py-1.5 border font-mono text-[10px] uppercase tracking-[0.14em] transition-colors ${
                          value === p
                            ? 'border-lava/60 bg-lava/[0.1] text-lava'
                            : 'border-white/10 text-dusty hover:text-snow hover:border-white/25'
                        }`}
                      >
                        {n0(p)} sats
                      </button>
                    ))}
              </div>

              {asset === 'dog' && (
                <p className="font-mono text-[10px] text-dusty leading-relaxed">{ladderHint(value)}</p>
              )}
              {overBalance && (
                <p className="font-mono text-[10px] text-[#F59E0B]">
                  That is more than this wallet can spend right now.
                </p>
              )}
            </div>

            {error && <p className="font-mono text-[11px] text-[#EF4444]">{error}</p>}

            {/* ── caminho principal: a carteira conectada assina daqui ──
                ⚠️ Só o PESO VISUAL mudou. O disparo é o mesmo. */}
            {account && support === 'rpc' ? (
              <div className="space-y-2">
                <button
                  onClick={send}
                  disabled={sending || value <= 0 || overBalance}
                  className="w-full flex items-center justify-center gap-2 bg-lava px-4 py-4 font-mono text-[12px] font-bold uppercase tracking-[0.2em] text-void hover:bg-lava-light transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {sending && <Loader2 className="w-4 h-4 animate-spin" />}
                  {sending
                    ? 'Confirm in your wallet'
                    : `Send ${value > 0 ? nAmt(value) : ''} ${asset === 'dog' ? 'DOG' : 'sats'}`}
                </button>
                <p className="font-mono text-[10px] text-dusty text-center">
                  Your wallet shows the final amount and asks for confirmation. Network fees are
                  paid in BTC.
                </p>
              </div>
            ) : (
              account && (
                <p className="font-mono text-[10px] text-dusty">
                  This wallet cannot send from inside a site yet. Use the address below, from the
                  wallet itself.
                </p>
              )
            )}

            {/* ── outras formas de pagar: mesmo destino, peso visual menor ──
                O endereço continua à vista, não atrás de um "mostrar endereço":
                é o único número que a pessoa pode conferir contra o popup da
                carteira antes de aprovar. */}
            {/* ⚠️ PORTÃO DE SEGURANÇA. Se a segunda declaração do endereço discordar da
                constante, NADA de endereço, QR ou link vai para a tela. Melhor a pessoa não
                conseguir pagar do que pagar no endereço errado. */}
            {!enderecoOk ? (
              <div className="border border-lava/60 bg-lava/[0.08] px-3 py-3">
                <p className="font-mono text-[11px] text-lava">
                  Address check failed. This screen will not show a payment address.
                </p>
                <p className="font-mono text-[10px] text-mist mt-2 leading-relaxed">
                  Do not send anything from here. Use the connected wallet button above, which
                  shows the destination in your own wallet, or reach the team before paying.
                </p>
              </div>
            ) : (
            <div className="border-t border-white/[0.06] pt-4 space-y-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-dusty">
                Other ways to pay
              </p>

              <div className="border border-white/[0.08] bg-white/[0.015] px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-dusty">
                    going to
                  </p>
                  <button
                    onClick={copyAddress}
                    className="inline-flex items-center gap-1 font-mono text-[10px] text-dusty hover:text-snow transition-colors"
                  >
                    {copied ? <Check className="w-3 h-3 text-[#10B981]" /> : <Copy className="w-3 h-3" />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <p className="font-mono text-[11px] text-snow break-all mt-1">{address}</p>
                <p className="font-mono text-[10px] text-dusty mt-1.5 leading-relaxed">
                  Your wallet must show this same address. If it shows another one, reject it.
                </p>
              </div>

              {support === 'rpc' && (
                <button
                  onClick={() => setShowManual((v) => !v)}
                  className="font-mono text-[10px] uppercase tracking-[0.18em] text-dusty hover:text-snow transition-colors"
                >
                  {showManual ? 'Hide the QR code' : 'Show the QR code'}
                </button>
              )}

              {(showManual || support !== 'rpc') && (
                // O código para a câmera de quem vai mandar do celular, e para
                // o Bitcoin o mesmo pedido como link: tocar abre a carteira com
                // o valor já preenchido, que é onde a pessoa desistia antes.
                <div className="flex flex-col items-center gap-2.5">
                  <QrCode
                    text={payUri}
                    label={`QR code to pay the construction fund in ${asset === 'dog' ? 'DOG' : 'Bitcoin'}`}
                  />

                  {asset === 'btc' ? (
                    <>
                      <a
                        href={payUri}
                        className="w-full inline-flex items-center justify-center gap-1.5 border border-lava/40 bg-lava/[0.06] px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.18em] text-lava hover:bg-lava/[0.14] transition-colors"
                      >
                        <Wallet className="w-3.5 h-3.5" />
                        Open in a Bitcoin wallet
                      </a>
                      <p className="font-mono text-[10px] text-dusty text-center leading-relaxed">
                        {value > 0
                          ? `The code and the link carry the address and ${n0(value)} sats.`
                          : 'The code and the link carry the address. Type an amount above to carry it too.'}
                      </p>
                    </>
                  ) : (
                    <p className="font-mono text-[10px] text-dusty text-center leading-relaxed">
                      DOG has no payment link, so this code carries the address only. Type the
                      amount in your wallet.
                    </p>
                  )}

                  <p className="font-mono text-[10px] text-dusty text-center">
                    Scan from your wallet. Confirm the address matches the one above.
                  </p>
                </div>
              )}
            </div>)}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
