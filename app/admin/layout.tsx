// ═══════════════════════════════════════════════════════════════════════════
// A sala de operação — portão.
//
// Tudo sob /admin passa por aqui ANTES de qualquer pintura, no servidor. Quem
// não é admin recebe a 404 do site: a sala não se anuncia negando acesso.
//
// ⚠️ ISTO NÃO PROTEGE AS ROTAS DE API. Um layout gateia a página, e a página
// busca de /api/admin/*, que é alcançável direto pelo navegador de qualquer
// um. Cada rota chama `getAdminFromRequest` por conta própria — ver
// lib/admin/gate.ts.
// ═══════════════════════════════════════════════════════════════════════════

import { notFound } from 'next/navigation'
import { getAdmin } from '@/lib/admin/gate'

// A sessão mora no cookie, então o resultado é por pessoa: cacheado, o portão
// serviria a primeira resposta a todo mundo que viesse depois.
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdmin()
  if (!admin) notFound()
  return <>{children}</>
}
