// ═══════════════════════════════════════════════════════════════════════════
// A sala de operação — índice.
//
// A porta de entrada de /admin. O layout irmão já provou quem entra, então
// aqui não há nenhuma checagem: uma segunda cópia da regra de acesso é uma
// segunda chance de escrevê-la errado.
//
// Lista o que EXISTE e o que ainda não existe, com essa diferença visível.
// Um índice que mostra sete quadros e entrega um é o jeito mais rápido de
// fazer quem olha parar de confiar no painel.
// ═══════════════════════════════════════════════════════════════════════════

import Link from 'next/link'
import { Activity, BarChart3, Coins, Filter, Link2 } from 'lucide-react'
import { getAdmin } from '@/lib/admin/gate'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const SALAS = [
  {
    href: '/admin/analytics',
    icon: BarChart3,
    nome: 'Analytics',
    linha: 'Traffic, behaviour, audience, conversion, speed and ads.',
    pronto: true,
  },
  {
    href: null,
    icon: Activity,
    nome: 'Machine',
    linha: 'Node, scanners, crons and disk. Waiting on the heartbeat writer.',
    pronto: false,
  },
  {
    href: null,
    icon: Filter,
    nome: 'Funnel',
    linha: 'Visit to landing to wallet to profile to city to donation to 10k.',
    pronto: false,
  },
  {
    href: null,
    icon: Link2,
    nome: 'Chain and city',
    linha: 'Mempool, whales, labels, lots, plaza chat, API keys.',
    pronto: false,
  },
  {
    href: null,
    icon: Coins,
    nome: 'Money',
    linha: 'Donations in DOG and BTC, and where each one came from.',
    pronto: false,
  },
] as const

export default async function SalaDeOperacao() {
  const admin = await getAdmin()

  return (
    <main className="min-h-screen bg-[#0A0A0C] px-4 py-16 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#6B6B78]">DOG DATA</p>
        <h1 className="mt-2 font-mono text-2xl text-snow">Operations</h1>
        <p className="mt-2 font-mono text-xs text-[#6B6B78]">
          Signed in as <span className="text-snow">{admin?.address.slice(0, 10)}…{admin?.address.slice(-6)}</span>
        </p>

        <ul className="mt-10 space-y-2">
          {SALAS.map(({ href, icon: Icon, nome, linha, pronto }) => {
            const miolo = (
              <>
                <Icon className={`h-4 w-4 shrink-0 ${pronto ? 'text-lava' : 'text-[#3A3A44]'}`} />
                <span className="min-w-0">
                  <span className={`block font-mono text-sm ${pronto ? 'text-snow' : 'text-[#6B6B78]'}`}>{nome}</span>
                  <span className="block font-mono text-[11px] text-[#6B6B78]">{linha}</span>
                </span>
                {!pronto && (
                  <span className="ml-auto shrink-0 font-mono text-[10px] uppercase tracking-wider text-[#3A3A44]">
                    not built
                  </span>
                )}
              </>
            )
            const classe =
              'flex items-start gap-3 rounded-lg border border-white/[0.06] px-4 py-3.5 transition-colors'
            return (
              <li key={nome}>
                {href ? (
                  <Link href={href} className={`${classe} hover:border-lava/40 hover:bg-white/[0.02]`}>
                    {miolo}
                  </Link>
                ) : (
                  <div className={`${classe} opacity-50`}>{miolo}</div>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </main>
  )
}
