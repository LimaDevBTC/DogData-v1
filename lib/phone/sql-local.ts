// DOG Phone: um Postgres LOCAL (PGlite, em memória) com a migração 046 aplicada, para o teste e para a prova do jogo.
// Não entra no build do site: só é importado por phone.sql.test.ts e pelo servidor de prova do dogcity-mundo. O PGlite não é
// dependência do projeto: quem roda aponta `PGLITE` para o `dist/index.js` de um `npm i @electric-sql/pglite@0.2.17` à parte.
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import type { Rpc } from './service'

const AQUI = dirname(fileURLToPath(import.meta.url))

export interface BancoLocal {
  rpc: Rpc
  /** SQL direto (só para o teste arrumar o cenário: perfis, relógio) */
  sql(texto: string, params?: unknown[]): Promise<Array<Record<string, unknown>>>
  fechar(): Promise<void>
}

export async function abrirBancoLocal(caminhoPglite: string): Promise<BancoLocal> {
  const mod = (await import(pathToFileURL(caminhoPglite).href)) as { PGlite: new () => { exec(s: string): Promise<unknown>; query(s: string, p?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>; close(): Promise<void> } }
  const db = new mod.PGlite()
  // o que a 046 espera encontrar: a tabela de perfis da 018 (com a foto que a produção já tem)
  await db.exec(`
    create table public.dogcity_profiles (
      address text primary key,
      handle text unique not null check (handle ~ '^[a-z0-9_]{3,15}$'),
      avatar_inscription_id text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  `)
  await db.exec(readFileSync(join(AQUI, '..', '..', 'supabase', 'migrations', '046_dogcity_phone.sql'), 'utf8'))
  await db.exec(readFileSync(join(AQUI, '..', '..', 'supabase', 'migrations', '047_dogcity_phone_calls_wall.sql'), 'utf8'))
  await db.exec(readFileSync(join(AQUI, '..', '..', 'supabase', 'migrations', '048_dogcity_phone_photos.sql'), 'utf8'))
  return {
    async rpc(fn, args) {
      if (!/^dogcity_phone_[a-z_]+$/.test(fn)) throw new Error(`rpc: ${fn}`)
      const nomes = Object.keys(args)
      for (const n of nomes) if (!/^p_[a-z_]+$/.test(n)) throw new Error(`rpc: ${n}`)
      const lista = nomes.map((n, i) => `${n} => $${i + 1}`).join(', ')
      const r = await db.query(`select public.${fn}(${lista}) as r`, nomes.map((n) => args[n]))
      return r.rows[0]?.r ?? null
    },
    async sql(texto, params) {
      return (await db.query(texto, params)).rows
    },
    fechar: () => db.close(),
  }
}
