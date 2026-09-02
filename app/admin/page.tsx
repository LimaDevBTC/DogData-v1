// ═══════════════════════════════════════════════════════════════════════════
// A sala de operação — índice.
//
// A porta de entrada de /admin. O layout irmão já provou quem entra, então
// aqui não há nenhuma checagem: uma segunda cópia da regra de acesso é uma
// segunda chance de escrevê-la errado.
//
// Fala o mesmo idioma visual do resto do site (casco com header e rodapé,
// Plate e PlateHead do kit plot-map, display para o título) porque um painel
// que parece outro produto é lido como página quebrada.
//
// Lista o que EXISTE e o que ainda não existe, com essa diferença visível.
// Um índice que mostra cinco quadros e entrega um é o jeito mais rápido de
// fazer quem olha parar de confiar no painel.
// ═══════════════════════════════════════════════════════════════════════════

import Link from 'next/link'
import { Activity, ArrowRight, BarChart3, Coins, Filter, Link2 } from 'lucide-react'
import { getAdmin } from '@/lib/admin/gate'
import { Plate } from '@/components/plot/kit'
import AdminShell from './shell'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const SALAS = [
  {
    href: '/admin/analytics',
    icon: BarChart3,
    nome: 'Analytics',
    linha: 'Traffic, behaviour, audience, conversion, speed and ads.',
  },
  {
    href: null,
    icon: Activity,
    nome: 'Machine',
    linha: 'Node, scanners, crons and disk. Waiting on the heartbeat writer.',
  },
  {
    href: null,
    icon: Filter,
    nome: 'Funnel',
    linha: 'Visit to landing to wallet to profile to city to donation to 10k.',
  },
  {
    href: null,
    icon: Link2,
    nome: 'Chain and city',
    linha: 'Mempool, whales, labels, lots, plaza chat, API keys.',
  },
  {
    href: null,
    icon: Coins,
    nome: 'Money',
    linha: 'Donations in DOG and BTC, and where each one came from.',
  },
] as const

export default async function SalaDeOperacao() {
  const admin = await getAdmin()
  const endereco = admin?.address ?? ''
  const curto = endereco ? `${endereco.slice(0, 10)}…${endereco.slice(-6)}` : ''

  return (
    <AdminShell>
      <div className="px-3 md:px-6 py-8 md:py-16 max-w-[900px] mx-auto">
        <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-dusty">
          ◆ operations · internal
        </span>
        <h1 className="font-display font-bold text-3xl md:text-5xl text-snow mt-3 leading-none">
          The whole operation, one room
        </h1>
        <p className="text-[13px] md:text-[15px] text-mist mt-4 max-w-xl leading-relaxed">
          Everything DOG DATA and DogCity know about themselves. Signed in as{' '}
          <code className="font-mono text-snow">{curto}</code>.
        </p>

        <div className="mt-10 space-y-3">
          {SALAS.map(({ href, icon: Icon, nome, linha }) => {
            const miolo = (
              <div className="flex items-center gap-4">
                <Icon className={`w-5 h-5 shrink-0 ${href ? 'text-lava' : 'text-dusty/40'}`} />
                <div className="min-w-0 flex-1">
                  <div className={`font-display font-bold text-lg ${href ? 'text-snow' : 'text-dusty'}`}>
                    {nome}
                  </div>
                  <div className="font-mono text-[11px] text-mist mt-1">{linha}</div>
                </div>
                {href ? (
                  <ArrowRight className="w-4 h-4 shrink-0 text-dusty" />
                ) : (
                  <span className="shrink-0 border border-white/10 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.18em] text-dusty">
                    not built
                  </span>
                )}
              </div>
            )
            return href ? (
              <Link key={nome} href={href} className="block group">
                <Plate corners accent="#F56E0F" pad="p-5">
                  {miolo}
                </Plate>
              </Link>
            ) : (
              <div key={nome} className="opacity-45">
                <Plate pad="p-5">{miolo}</Plate>
              </div>
            )
          })}
        </div>
      </div>
    </AdminShell>
  )
}
