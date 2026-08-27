"use client"

// /profile: a pagina de identidade da carteira conectada.
//
// Ela existe porque a identidade estava presa num modal de 384px que abria
// dentro do header (o header tem backdrop-blur, o que faz dele o bloco de
// conteudo de qualquer filho `fixed`, entao o modal aparecia cortado por cima
// do banner). Aqui a mesma informacao vira uma pagina no dialeto do resto do
// site: chapa quadrada, fio de cabelo, mono sobre regua.
//
// Tres fontes se encontram nesta tela e nenhuma delas e nova:
//   /api/profile                     handle, lote na cidade, falas na praca
//   /api/address/bitcoin/<address>   saldo, posicao, rotulos, historico
//   /api/donate/leaderboard          licenca e numero de fundador
//
// Nada aqui depende de posse provada para LER: o endereco e publico. A prova
// so destranca escrever (handle) e falar na praca.

import { useCallback, useEffect, useMemo, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import {
  ArrowDownLeft, ArrowLeftRight, ArrowUpRight, AtSign, Building2, Check, Copy,
  ExternalLink, Fingerprint, Image as ImageIcon, Loader2, LogOut, MessageSquare,
  ShieldAlert, ShieldCheck, Trophy, Wallet,
} from "lucide-react"
import { Layout } from "@/components/layout"
import { Plate, PlateHead, PlotGrid, StatTile, CAT } from "@/app/analytics/dashboard/ui"
import { useWallet } from "@/contexts/WalletContext"
import { useDonate } from "@/components/donate/donate-modal"
import { WALLETS } from "@/lib/wallet"
import { handleProblem, normalizeHandle } from "@/lib/identity/handle"

// ── tipos ──────────────────────────────────────────────────────────────────

interface Lot {
  street: string | null
  number: number | null
  zone: string
  district: number
  kind: "build" | "open"
  prestige: number
  height_tier: number
  last_balance: number
  utxo_count: number
  age_score: number
  state: string
}

interface ProfilePayload {
  address: string | null
  verified: boolean
  handle: string | null
  claimed_at: string | null
  avatar_inscription_id: string | null
  avatar_number: number | null
  lot: Lot | null
  chat_count: number
}

interface OwnedInscription {
  id: string
  number: number
  contentType: string | null
}

/** A arte de qualquer inscrição sai pelo nosso domínio, nunca por um gateway
 *  público direto: ver app/api/inscription/[id]/content/route.ts. */
const inscriptionArt = (id: string) => `/api/inscription/${id}/content`

interface Tx {
  txid: string
  block_height: number
  timestamp: string
  direction: "in" | "out" | "self"
  amount_dog: number
  counterparty: string | null
}

interface ChainData {
  status: "holder" | "forensic_only" | "tx_only" | "not_a_dog_holder"
  holder: { rank: number; total_dog: number; utxo_count: number; percentile: number } | null
  forensic: {
    behavior_pattern: string
    behavior_detail: string
    airdrop_rank: number
    airdrop_amount: number
    retention_rate: number
    diamond_score: number
    insights: string[]
  } | null
  labels: { id: string; text: string; description: string }[]
  transactions: Tx[]
  tx_count: number
  stats: { first_tx_block: number | null; last_tx_block: number | null }
  metadata: { total_holders: number }
}

interface Standing {
  total: number
  license: string | null
  founder_seq: number | null
}

// ── formatadores ───────────────────────────────────────────────────────────

const n0 = (n: number) => Math.round(n).toLocaleString("en-US")
const dog = (n: number) =>
  n >= 1_000_000_000 ? `${(n / 1_000_000_000).toFixed(2)}B`
  : n >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)}M`
  : n0(n)

const short = (a: string) => (a.length > 20 ? `${a.slice(0, 10)}…${a.slice(-8)}` : a)

const day = (iso: string | null) => {
  if (!iso) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? null
    : d.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" })
}

// Os dois nomes que a licenca ja tem em /donate, repetidos aqui para a chapa
// de posicao nao inventar um terceiro vocabulario.
const LICENSE_LABEL: Record<string, string> = {
  personal: "Personal license",
  commercial: "Commercial license",
  patron: "Patron",
}

// ── pecas pequenas ─────────────────────────────────────────────────────────

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-dusty">{children}</span>
  )
}

/**
 * Cabecalho de secao no dialeto do site, porem SEM as primitivas de entrada.
 * O <SectionHead/> compartilhado revela no scroll a partir de um observador
 * com margem negativa no topo: numa pagina de aplicativo, onde a pessoa chega
 * pelo menu e nao rolando, o titulo simplesmente nunca aparece. Aqui o texto
 * e texto.
 */
function Head({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  return (
    <div className="max-w-2xl">
      <span className="font-mono text-[11px] tracking-[0.3em] text-lava uppercase">{eyebrow}</span>
      <div className="mt-3 w-14 h-px bg-lava/70" />
      <h2 className="font-display font-bold text-2xl md:text-3xl text-snow mt-4 leading-tight">{title}</h2>
      {sub && <p className="text-[13px] text-mist mt-3 leading-relaxed">{sub}</p>}
    </div>
  )
}

// O selo de posse: sempre icone mais palavra mais cor, nunca so a cor.
function VerifyChip({ verified }: { verified: boolean }) {
  const tone = verified ? "#10B981" : "#F59E0B"
  const Icon = verified ? ShieldCheck : ShieldAlert
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.18em] border shrink-0"
      style={{ color: tone, borderColor: `${tone}59` }}
    >
      <Icon className="w-3 h-3" aria-hidden />
      {verified ? "Ownership verified" : "Not verified"}
    </span>
  )
}

// A marca da carteira: o mesmo desenho do lote da cidade, uma grade de
// levantamento com a inicial do handle carimbada por cima.
function Sigil({ text, art }: { text: string; art?: string | null }) {
  return (
    <div className="relative w-20 h-20 md:w-[104px] md:h-[104px] shrink-0 border border-white/10 bg-void overflow-hidden">
      <span
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(to right, #F56E0F1f 1px, transparent 1px)," +
            "linear-gradient(to bottom, #F56E0F1f 1px, transparent 1px)",
          backgroundSize: "8px 8px",
        }}
      />
      {art ? (
        // eslint-disable-next-line @next/next/no-img-element -- arte de inscrição
        // é servida pela nossa rota de conteúdo, sem passar pelo otimizador
        <img
          src={art}
          alt="Your ordinal"
          className="absolute inset-0 w-full h-full object-cover"
          // Quase toda arte de Ordinals é pixel art de 24 a 64 px: suavizar
          // borra justamente o que a peça é.
          style={{ imageRendering: "pixelated" }}
        />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center font-display font-bold text-2xl md:text-3xl text-snow uppercase">
          {text}
        </span>
      )}
    </div>
  )
}

/**
 * Escolha de foto de perfil entre os ordinals da própria carteira.
 *
 * A grade só é buscada quando a pessoa pede: listar inscrição custa uma ida ao
 * indexador por página e um metadado por peça, e a maioria das visitas ao
 * perfil não vai trocar de foto.
 */
function AvatarPicker({
  current, verified, onPick,
}: {
  current: string | null
  verified: boolean
  onPick: (id: string | null) => Promise<string | null>
}) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<OwnedInscription[] | null>(null)
  const [scanned, setScanned] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    fetch("/api/profile/inscriptions")
      .then(async (r) => {
        const j = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(j?.error || "Could not read your inscriptions.")
        return j
      })
      .then((j) => {
        setItems(j.inscriptions ?? [])
        setScanned(j.scanned ?? 0)
      })
      .catch((e) => setError(String(e.message || e)))
      .finally(() => setLoading(false))
  }, [])

  const choose = useCallback(async (id: string | null) => {
    setBusy(id ?? "clear")
    setError(null)
    try {
      const problem = await onPick(id)
      if (problem) setError(problem)
    } finally {
      setBusy(null)
    }
  }, [onPick])

  if (!verified) {
    return (
      <Plate>
        <PlateHead icon={ImageIcon}>profile picture</PlateHead>
        <p className="text-[12px] text-mist leading-relaxed max-w-xl">
          Verify ownership to use one of your ordinals as your picture. We read the collection
          your address holds, and only you can point at it.
        </p>
      </Plate>
    )
  }

  return (
    <Plate>
      <PlateHead icon={ImageIcon} right={
        current ? (
          <button
            onClick={() => choose(null)}
            disabled={busy !== null}
            className="font-mono text-[9px] uppercase tracking-[0.18em] text-dusty hover:text-[#EF4444] transition-colors disabled:opacity-40"
          >
            {busy === "clear" ? "Removing" : "Remove"}
          </button>
        ) : undefined
      }>
        profile picture
      </PlateHead>

      <div className="flex flex-wrap items-center gap-4">
        <div className="w-16 h-16 border border-white/10 bg-void overflow-hidden shrink-0">
          {current ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={inscriptionArt(current)} alt="" className="w-full h-full object-cover"
              style={{ imageRendering: "pixelated" }} />
          ) : (
            <span className="w-full h-full flex items-center justify-center font-mono text-[9px] text-dusty uppercase">
              none
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] text-mist leading-relaxed">
            Any image ordinal held by this address can be your picture. It stays yours: point at a
            different one whenever you like, and it follows the address if you ever sell the piece.
          </p>
          {!open && (
            <button
              onClick={() => { setOpen(true); if (!items) load() }}
              className="mt-3 inline-flex items-center gap-2 border border-lava/50 bg-lava/[0.08] px-4 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-lava transition-colors hover:bg-lava/[0.16]"
            >
              <ImageIcon className="w-3.5 h-3.5" />
              {current ? "Choose another ordinal" : "Choose from your ordinals"}
            </button>
          )}
        </div>
      </div>

      {open && (
        <div className="mt-5 border-t border-white/[0.06] pt-5">
          {loading && (
            <p className="inline-flex items-center gap-2 font-mono text-[11px] text-dusty">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Reading your wallet…
            </p>
          )}
          {error && <p className="font-mono text-[11px] text-[#EF4444]">{error}</p>}

          {!loading && items && items.length === 0 && (
            <p className="font-mono text-[11px] text-dusty">
              {scanned > 0
                ? `Nothing to show: the ${scanned} inscriptions read from this address are not images.`
                : "This address holds no inscriptions yet."}
            </p>
          )}

          {!loading && !!items?.length && (
            <>
              <div className="flex flex-wrap gap-px bg-white/10 border border-white/10 p-px">
                {items.map((ins) => {
                  const active = ins.id === current
                  return (
                    <button
                      key={ins.id}
                      onClick={() => choose(ins.id)}
                      disabled={busy !== null}
                      title={ins.number ? `Inscription ${n0(ins.number)}` : ins.id}
                      className={`relative w-[82px] h-[82px] md:w-[92px] md:h-[92px] bg-void group ${active ? "outline outline-1 outline-lava outline-offset-[-1px]" : ""}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={inscriptionArt(ins.id)}
                        alt=""
                        loading="lazy"
                        className="w-full h-full object-cover transition-opacity group-hover:opacity-80"
                        style={{ imageRendering: "pixelated" }}
                      />
                      {busy === ins.id && (
                        <span className="absolute inset-0 flex items-center justify-center bg-black/70">
                          <Loader2 className="w-4 h-4 text-lava animate-spin" />
                        </span>
                      )}
                      {active && (
                        <span className="absolute bottom-0 right-0 bg-lava text-void px-1 font-mono text-[8px] uppercase tracking-wider">
                          in use
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
              <p className="mt-3 font-mono text-[10px] text-dusty">
                {n0(items.length)} image {items.length === 1 ? "ordinal" : "ordinals"} from the{" "}
                {n0(scanned)} inscriptions read on this address.
              </p>
            </>
          )}
        </div>
      )}
    </Plate>
  )
}

const DIR_ICON = { in: ArrowDownLeft, out: ArrowUpRight, self: ArrowLeftRight } as const
const DIR_TONE = { in: "text-[#10B981]", out: "text-[#EF4444]", self: "text-dusty" } as const

// ── pagina ─────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { account, verified, status, prove, disconnect, openModal } = useWallet()
  const { open: openDonate } = useDonate()
  const proving = status === "proving"
  const address = account?.ordinalsAddress ?? null

  const [profile, setProfile] = useState<ProfilePayload | null>(null)
  const [chain, setChain] = useState<ChainData | null>(null)
  const [standing, setStanding] = useState<Standing | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const [input, setInput] = useState("")
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const loadProfile = useCallback(() => {
    if (!address) return
    fetch(`/api/profile?address=${encodeURIComponent(address)}`)
      .then((r) => r.json())
      .then((d: ProfilePayload) => {
        setProfile(d)
        setInput(d?.handle ?? "")
      })
      .catch(() => setProfile(null))
  }, [address])

  // O perfil e a cadeia sao pedidos separados de proposito: o handle volta em
  // milissegundos e a pagina ja pode pintar a identidade enquanto o historico
  // do endereco ainda esta vindo.
  useEffect(() => {
    if (!address) {
      setProfile(null)
      setChain(null)
      setStanding(null)
      return
    }
    loadProfile()
    setLoading(true)
    fetch(`/api/address/bitcoin/${address}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(setChain)
      .catch(() => setChain(null))
      .finally(() => setLoading(false))

    fetch("/api/donate/leaderboard")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => {
        const lower = address.toLowerCase()
        const mine = (d?.leaderboard ?? []).find((e: any) => e.address?.toLowerCase() === lower)
        const founder = (d?.founders ?? []).find((f: any) => f.address?.toLowerCase() === lower)
        setStanding(
          mine || founder
            ? {
                total: mine?.total ?? founder?.total ?? 0,
                license: mine?.license ?? founder?.license ?? null,
                founder_seq: founder?.founder_seq ?? null,
              }
            : null,
        )
      })
      .catch(() => setStanding(null))
  }, [address, loadProfile, verified])

  const copyAddress = useCallback(() => {
    if (!address) return
    navigator.clipboard?.writeText(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [address])

  const localProblem = input.length > 0 ? handleProblem(input) : null

  const saveHandle = useCallback(async () => {
    if (localProblem) return
    setSaving(true)
    setSaveError(null)
    setSaved(false)
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle: input }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        // A API devolve codigo curto; a tela sempre traduz para copy fixa.
        if (res.status === 409) setSaveError("That handle is already taken.")
        else if (res.status === 422)
          setSaveError(
            data?.error === "reserved"
              ? "That handle is reserved."
              : "3 to 15 characters: lowercase letters, numbers and underscore.",
          )
        else if (res.status === 401) setSaveError("Verify ownership first.")
        else setSaveError("Could not save. Try again.")
        return
      }
      setSaved(true)
      loadProfile()
      window.dispatchEvent(new CustomEvent("dogdata:identity-changed"))
    } catch {
      setSaveError("Could not save. Try again.")
    } finally {
      setSaving(false)
    }
  }, [input, localProblem, loadProfile])

  const setAvatar = useCallback(async (id: string | null): Promise<string | null> => {
    try {
      const res = await fetch("/api/profile/avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inscription_id: id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return data?.error || "Could not save your picture."
      loadProfile()
      // O botão do cabeçalho guarda a identidade em memória pra não repetir a
      // chamada a cada navegação; sem este aviso ele mostraria a foto antiga
      // até a próxima recarga.
      window.dispatchEvent(new CustomEvent("dogdata:identity-changed"))
      return null
    } catch {
      return "Could not save your picture."
    }
  }, [loadProfile])

  const meta = account ? WALLETS[account.walletId] : null
  const monogram = useMemo(() => {
    if (profile?.handle) return profile.handle.slice(0, 2)
    if (address) return address.slice(-2)
    return "??"
  }, [profile?.handle, address])

  const displayName = profile?.handle ? `@${profile.handle}` : "Unclaimed wallet"
  const holders = chain?.metadata?.total_holders ?? 0

  // ── carteira ausente ─────────────────────────────────────────────────────
  if (!account) {
    return (
      <Layout currentPage="profile" setCurrentPage={() => {}}>
        <div className="px-3 md:px-6 py-8 md:py-16 max-w-[900px] mx-auto">
          <Eyebrow>◆ wallet identity</Eyebrow>
          <h1 className="font-display font-bold text-3xl md:text-5xl text-snow mt-3 leading-none">
            Your profile
          </h1>
          <p className="text-[13px] md:text-[15px] text-mist mt-4 max-w-xl leading-relaxed">
            Connect a Bitcoin wallet to see everything DOG DATA already knows about your address,
            claim a handle, and take your seat in the city.
          </p>

          <div className="mt-8 border border-white/10 bg-white/[0.02] p-6 md:p-8">
            <PlateHead icon={Wallet}>no wallet connected</PlateHead>
            <div className="grid md:grid-cols-3 gap-px bg-white/10 border border-white/10">
              {[
                ["Standing", "Balance, rank, cohort and labels, read from our own node."],
                ["Handle", "One @name per verified address, used across the site and the plaza."],
                ["City", "Your plot on the lunar map, prestige and street address."],
              ].map(([t, d]) => (
                <div key={t} className="bg-void p-5">
                  <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-lava">{t}</div>
                  <p className="text-[12px] text-mist mt-2 leading-relaxed">{d}</p>
                </div>
              ))}
            </div>
            <button
              onClick={openModal}
              className="mt-6 inline-flex items-center gap-2 border border-lava/50 bg-lava/[0.08] px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.2em] text-lava transition-colors hover:bg-lava/[0.16]"
            >
              <Wallet className="w-3.5 h-3.5" />
              Connect wallet
            </button>
          </div>
        </div>
      </Layout>
    )
  }

  // ── carteira conectada ───────────────────────────────────────────────────
  return (
    <Layout currentPage="profile" setCurrentPage={() => {}}>
      <div className="px-3 md:px-6 py-4 md:py-8 max-w-[1200px] mx-auto space-y-10 md:space-y-14">

        {/* ── cabecalho de identidade ──
            Texto puro: as primitivas de reveal do dialeto so disparam depois de
            cruzar a dobra, e esta chapa nasce acima dela. */}
        <header className="space-y-5">
          <Eyebrow>◆ wallet identity · bitcoin mainnet</Eyebrow>

          <Plate corners accent="#F56E0F" pad="p-5 md:p-8">
            <div className="flex flex-col md:flex-row md:items-start gap-5 md:gap-7">
              <Sigil
                text={monogram}
                art={profile?.avatar_inscription_id ? inscriptionArt(profile.avatar_inscription_id) : null}
              />

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="font-display font-bold text-2xl md:text-4xl text-snow leading-none break-all">
                    {displayName}
                  </h1>
                  <VerifyChip verified={verified} />
                  {standing?.founder_seq && (
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 border border-lava/40 font-mono text-[9px] uppercase tracking-[0.18em] text-lava">
                      <Trophy className="w-3 h-3" /> Founder #{standing.founder_seq}
                    </span>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
                  <code className="font-mono text-[11px] md:text-[12px] text-mist break-all">{address}</code>
                  <button
                    onClick={copyAddress}
                    className="inline-flex items-center gap-1 border border-white/10 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.18em] text-dusty transition-colors hover:border-white/25 hover:text-snow"
                  >
                    {copied ? <Check className="w-3 h-3 text-[#10B981]" /> : <Copy className="w-3 h-3" />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                  <Link
                    href={`/address/bitcoin/${address}`}
                    className="inline-flex items-center gap-1 border border-white/10 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.18em] text-dusty transition-colors hover:border-lava/50 hover:text-lava"
                  >
                    Explorer view
                  </Link>
                  <a
                    href={`https://mempool.space/address/${address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="mempool.space"
                    className="text-dusty transition-colors hover:text-snow"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 font-mono text-[10px] text-dusty">
                  {meta && (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="relative w-3.5 h-3.5 overflow-hidden border border-white/10">
                        <Image src={meta.logo} alt="" fill sizes="14px" className="object-cover" />
                      </span>
                      {meta.name}
                    </span>
                  )}
                  {profile?.claimed_at && <span>handle claimed {day(profile.claimed_at)}</span>}
                  {!!profile?.chat_count && (
                    <span className="inline-flex items-center gap-1.5">
                      <MessageSquare className="w-3 h-3" />
                      {n0(profile.chat_count)} {profile.chat_count === 1 ? "message" : "messages"} in the plaza
                    </span>
                  )}
                </div>
              </div>

              <div className="flex md:flex-col gap-2 md:w-auto shrink-0">
                {!verified && (
                  <button
                    onClick={() => prove().catch(() => {})}
                    disabled={proving}
                    className="inline-flex items-center justify-center gap-2 border border-lava/50 bg-lava/[0.08] px-4 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-lava transition-colors hover:bg-lava/[0.16] disabled:opacity-50"
                  >
                    {proving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                    {proving ? "Signing" : "Verify ownership"}
                  </button>
                )}
                <button
                  onClick={disconnect}
                  className="inline-flex items-center justify-center gap-2 border border-white/10 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-dusty transition-colors hover:border-[#EF4444]/50 hover:text-[#EF4444]"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Disconnect
                </button>
              </div>
            </div>
          </Plate>
        </header>

        {/* ── posicao na cadeia ── */}
        <section className="space-y-5">
          <Head
            eyebrow="◆ on chain standing"
            title="What the chain says about this address"
            sub="Balance and rank come from our own UTXO scan of the DOG rune, not from a marketplace API."
          />

          {loading && !chain ? (
            <div className="border border-white/10 bg-white/[0.02] p-8 font-mono text-[11px] text-dusty">
              Reading the address from our node…
            </div>
          ) : chain?.holder ? (
            <PlotGrid className="grid-cols-2 lg:grid-cols-4">
              <StatTile label="DOG balance" value={chain.holder.total_dog} format={dog} />
              <StatTile
                label="Holder rank"
                value={chain.holder.rank}
                format={(n) => `#${n0(n)}`}
                sub={holders ? `of ${n0(holders)} holders` : undefined}
                accent={CAT[1]}
              />
              <StatTile
                label="Top percentile"
                value={chain.holder.percentile}
                format={(n) => `${n.toFixed(2)}%`}
                sub="lower is rarer"
                accent={CAT[1]}
              />
              <StatTile
                label="UTXOs"
                value={chain.holder.utxo_count}
                sub="the shape of the building in the city"
              />
            </PlotGrid>
          ) : (
            <Plate>
              <PlateHead>no DOG in this address</PlateHead>
              <p className="text-[12px] text-mist leading-relaxed">
                This wallet holds no DOG right now. Identity still works: claim a handle, and the
                profile fills in the moment the balance lands.
              </p>
            </Plate>
          )}

          {!!chain?.labels?.length && (
            <div className="flex flex-wrap gap-2">
              {chain.labels.map((l) => (
                <span
                  key={l.id}
                  title={l.description}
                  className="inline-flex items-center gap-2 border border-white/10 bg-white/[0.02] px-2.5 py-1.5 font-mono text-[10px] text-mist"
                >
                  <span className="w-1.5 h-1.5 shrink-0" style={{ background: CAT[0] }} />
                  {l.text}
                </span>
              ))}
            </div>
          )}

          {chain?.forensic && (
            <Plate>
              <PlateHead icon={Fingerprint}>behaviour since the airdrop</PlateHead>
              <div className="grid md:grid-cols-3 gap-px bg-white/10 border border-white/10">
                <div className="bg-void p-4">
                  <Eyebrow>pattern</Eyebrow>
                  <p className="font-display font-bold text-lg text-snow mt-2 capitalize">
                    {chain.forensic.behavior_pattern.replace(/_/g, " ")}
                  </p>
                  <p className="text-[11px] text-mist mt-1.5 leading-relaxed">{chain.forensic.behavior_detail}</p>
                </div>
                <div className="bg-void p-4">
                  <Eyebrow>airdrop</Eyebrow>
                  <p className="font-display font-bold text-lg text-snow mt-2 tabular-nums">
                    #{n0(chain.forensic.airdrop_rank)}
                  </p>
                  <p className="text-[11px] text-mist mt-1.5">{dog(chain.forensic.airdrop_amount)} DOG claimed</p>
                </div>
                <div className="bg-void p-4">
                  <Eyebrow>retention</Eyebrow>
                  <p className="font-display font-bold text-lg text-snow mt-2 tabular-nums">
                    {chain.forensic.retention_rate.toFixed(1)}%
                  </p>
                  <p className="text-[11px] text-mist mt-1.5">of the original airdrop still held</p>
                </div>
              </div>
              {!!chain.forensic.insights?.length && (
                <ul className="mt-4 space-y-1.5">
                  {chain.forensic.insights.slice(0, 4).map((i) => (
                    <li key={i} className="flex gap-2 text-[11px] text-mist leading-relaxed">
                      <span className="text-lava shrink-0">·</span>
                      {i}
                    </li>
                  ))}
                </ul>
              )}
            </Plate>
          )}
        </section>

        {/* ── identidade ── */}
        <section className="space-y-5">
          <Head
            eyebrow="◆ identity"
            title={profile?.handle ? "Your handle" : "Claim your handle"}
            sub="One name per verified address. It signs your messages in the plaza and travels with your address across the site."
          />

          <Plate>
            <PlateHead icon={AtSign}>handle</PlateHead>

            {!verified ? (
              <div className="space-y-3">
                <p className="text-[12px] text-mist leading-relaxed max-w-xl">
                  Signing a message proves the address is yours. It is free, it never touches your
                  coins, and it is the only gate between you and a handle.
                </p>
                <button
                  onClick={() => prove().catch(() => {})}
                  disabled={proving}
                  className="inline-flex items-center gap-2 border border-lava/50 bg-lava/[0.08] px-4 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-lava transition-colors hover:bg-lava/[0.16] disabled:opacity-50"
                >
                  {proving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                  {proving ? "Signing" : "Verify ownership"}
                </button>
              </div>
            ) : (
              <div className="space-y-3 max-w-xl">
                <div className="flex items-center gap-2 border border-white/10 bg-white/[0.02] px-3 py-2 focus-within:border-lava/50 transition-colors">
                  <AtSign className="w-4 h-4 text-dusty shrink-0" />
                  <input
                    value={input}
                    onChange={(e) => {
                      setInput(e.target.value.trim().toLowerCase())
                      setSaveError(null)
                      setSaved(false)
                    }}
                    placeholder="yourhandle"
                    maxLength={15}
                    spellCheck={false}
                    autoCapitalize="off"
                    autoCorrect="off"
                    className="flex-1 min-w-0 bg-transparent font-mono text-[14px] text-snow placeholder:text-white/20 outline-none"
                  />
                  <button
                    onClick={saveHandle}
                    // O campo nasce preenchido com o handle atual, entao sem
                    // estas travas o Save fica aceso sem ter o que salvar.
                    disabled={
                      saving || !!localProblem || input.length === 0 ||
                      normalizeHandle(input) === profile?.handle
                    }
                    className="inline-flex items-center gap-1.5 border border-lava/50 bg-lava/[0.08] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-lava transition-colors hover:bg-lava/[0.16] disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                  >
                    {saving && <Loader2 className="w-3 h-3 animate-spin" />}
                    {profile?.handle ? "Rename" : "Claim"}
                  </button>
                </div>

                {localProblem && input.length > 0 && (
                  <p className="font-mono text-[10px] text-[#F59E0B]">{localProblem}</p>
                )}
                {saveError && !localProblem && (
                  <p className="font-mono text-[10px] text-[#EF4444]">{saveError}</p>
                )}
                {saved && !saveError && (
                  <p className="inline-flex items-center gap-1.5 font-mono text-[10px] text-[#10B981]">
                    <Check className="w-3 h-3" /> Saved as @{profile?.handle}
                  </p>
                )}
                <p className="font-mono text-[10px] text-dusty">
                  3 to 15 characters: lowercase letters, numbers and underscore.
                </p>
              </div>
            )}
          </Plate>

          <AvatarPicker
            current={profile?.avatar_inscription_id ?? null}
            verified={verified}
            onPick={setAvatar}
          />
        </section>

        {/* ── cidade e registro de fundadores ── */}
        <section className="space-y-5">
          <Head
            eyebrow="◆ dogcity"
            title="Your seat in the city"
            sub="Every wallet with DOG gets a plot on the lunar map. Donors get a plaque in the Founders Register."
          />

          <div className="grid md:grid-cols-2 gap-px bg-white/10 border border-white/10">
            <div className="bg-void p-5 md:p-6">
              <PlateHead icon={Building2}>plot</PlateHead>
              {profile?.lot ? (
                <div className="space-y-3">
                  <p className="font-display font-bold text-xl text-snow">
                    {profile.lot.street ?? "Unnamed street"}
                    {profile.lot.number != null ? ` ${profile.lot.number}` : ""}
                  </p>
                  <div className="grid grid-cols-3 gap-px bg-white/10 border border-white/10">
                    {[
                      ["Kind", profile.lot.kind === "build" ? "Building" : "Open space"],
                      ["Prestige", "★".repeat(profile.lot.prestige)],
                      ["District", `#${profile.lot.district}`],
                    ].map(([k, v]) => (
                      <div key={k} className="bg-void p-3">
                        <Eyebrow>{k}</Eyebrow>
                        <p className="font-mono text-[12px] text-snow mt-1.5">{v}</p>
                      </div>
                    ))}
                  </div>
                  <Link
                    href="/city"
                    className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-lava hover:underline"
                  >
                    Visit the plaza <ArrowUpRight className="w-3 h-3" />
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-[12px] text-mist leading-relaxed">
                    No plot registered for this address yet. The city registry mints lots from the
                    holder snapshot: hold DOG and the map builds your address in.
                  </p>
                  <Link
                    href="/city"
                    className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-lava hover:underline"
                  >
                    See the city <ArrowUpRight className="w-3 h-3" />
                  </Link>
                </div>
              )}
            </div>

            <div className="bg-void p-5 md:p-6">
              <PlateHead icon={Trophy}>founders register</PlateHead>
              {standing ? (
                <div className="space-y-3">
                  <p className="font-display font-bold text-xl text-snow tabular-nums">
                    {dog(standing.total)} <span className="text-mist text-sm font-mono">DOG donated</span>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {standing.founder_seq && (
                      <span className="border border-lava/40 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.18em] text-lava">
                        Founder #{standing.founder_seq}
                      </span>
                    )}
                    {standing.license && LICENSE_LABEL[standing.license] && (
                      <span className="border border-white/15 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.18em] text-mist">
                        {LICENSE_LABEL[standing.license]}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      onClick={() => openDonate({ asset: "dog" })}
                      className="inline-flex items-center gap-1.5 border border-lava/50 bg-lava/[0.08] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-lava hover:bg-lava/[0.16] transition-colors"
                    >
                      Add to it
                    </button>
                    <Link
                      href="/dogcity#build"
                      className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-dusty hover:text-lava transition-colors"
                    >
                      Your plaque <ArrowUpRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-[12px] text-mist leading-relaxed">
                    This address has not donated to the build yet. Any amount before the goal makes
                    you a Founder, and the register records the order of arrival.
                  </p>
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      onClick={() => openDonate({ asset: "dog" })}
                      className="inline-flex items-center gap-1.5 border border-lava/50 bg-lava/[0.08] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-lava hover:bg-lava/[0.16] transition-colors"
                    >
                      Donate now
                    </button>
                    <Link
                      href="/dogcity#build"
                      className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-dusty hover:text-lava transition-colors"
                    >
                      Read the ladder <ArrowUpRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── historico ── */}
        {!!chain?.transactions?.length && (
          <section className="space-y-5">
            <Head
              eyebrow="◆ activity"
              title="Latest movements"
              sub="The most recent DOG transactions touching this address, straight from the indexed blocks."
            />

            <Plate pad="p-0">
              <div className="divide-y divide-white/[0.06]">
                {chain.transactions.slice(0, 6).map((tx) => {
                  const Icon = DIR_ICON[tx.direction]
                  return (
                    <Link
                      key={tx.txid}
                      href={`/tx/bitcoin/${tx.txid}`}
                      className="flex items-center gap-3 md:gap-4 px-4 md:px-5 py-3.5 transition-colors hover:bg-white/[0.03]"
                    >
                      <Icon className={`w-4 h-4 shrink-0 ${DIR_TONE[tx.direction]}`} />
                      <div className="min-w-0 flex-1">
                        <p className="font-mono text-[11px] text-snow truncate">
                          {tx.direction === "in" ? "Received" : tx.direction === "out" ? "Sent" : "Self transfer"}
                          {tx.counterparty ? ` · ${short(tx.counterparty)}` : ""}
                        </p>
                        <p className="font-mono text-[10px] text-dusty mt-0.5">
                          block {n0(tx.block_height)}
                          {day(tx.timestamp) ? ` · ${day(tx.timestamp)}` : ""}
                        </p>
                      </div>
                      <span className={`font-mono text-[12px] tabular-nums shrink-0 ${DIR_TONE[tx.direction]}`}>
                        {tx.direction === "out" ? "-" : tx.direction === "in" ? "+" : ""}
                        {dog(tx.amount_dog)}
                      </span>
                    </Link>
                  )
                })}
              </div>
              <div className="border-t border-white/[0.06] px-4 md:px-5 py-3">
                <Link
                  href={`/address/bitcoin/${address}`}
                  className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-lava hover:underline"
                >
                  Full history, {n0(chain.tx_count)} transactions <ArrowUpRight className="w-3 h-3" />
                </Link>
              </div>
            </Plate>
          </section>
        )}
      </div>
    </Layout>
  )
}
