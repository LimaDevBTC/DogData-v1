import fs from 'fs/promises'
import path from 'path'

/**
 * Quem é o dono de um endereço, respondido em UM lugar só.
 *
 * ⚠️ EXISTIAM TRÊS FONTES E NENHUMA CONVERSAVA COM AS OUTRAS, que foi o defeito
 * que o fundador apontou: carteira identificada na página de holders aparecia
 * anônima no explorer.
 *
 *   1. `public/data/verified_addresses.json` — verificação PEDIDA pelo dono, que
 *      paga uma taxa e manda nome, logo, site e X. É o que a página de holders
 *      usa, no cliente, pelo `AddressBadge`.
 *   2. `dog_labels` no banco — o que NÓS deduzimos da cadeia, com grau de prova
 *      registrado. É o que o feed de insights usa.
 *   3. os rótulos de coorte do próprio explorer (whale, top 10, airdrop OG), que
 *      são outra coisa: dizem o TAMANHO, não a IDENTIDADE.
 *
 * Este arquivo junta 1 e 2. O 3 continua onde está, porque responde outra
 * pergunta.
 *
 * ⚠️ E AS DUAS PROCEDÊNCIAS NÃO PODEM APARECER IGUAIS NA TELA. "A Bitget disse
 * que este endereço é dela" e "a gente concluiu que este endereço é da Kraken"
 * são afirmações de peso diferente, e quem lê tem direito de saber qual das duas
 * está vendo. Por isso `source` viaja junto com o nome, e o componente de tela
 * marca a diferença.
 */

export type IdentitySource = 'verified' | 'onchain'

export interface Identity {
  address: string
  name: string
  logo: string | null
  /** exchange · marketplace · bridge · pool · project · whale */
  kind: string | null
  /** hot · treasury · deposit · withdrawal · fee · pool */
  role: string | null
  source: IdentitySource
  /** só para `onchain`: own_flow · first_party · co_flow · topology · third_party */
  evidence: string | null
  evidence_note: string | null
  website: string | null
  twitter: string | null
}

/**
 * ⚠️ O LOGO MORA COM O CÓDIGO, não no banco. São arquivos em `public/`, versionados
 * junto com a aplicação; guardar o caminho numa tabela cria a chance de a linha
 * apontar para um arquivo que não foi implantado. A chave é o nome da entidade
 * como ele está em `dog_labels.entity`.
 */
// ⚠️ SÓ ARQUIVO QUADRADO ENTRA AQUI. O selo desenha o logo num quadrado de 12px:
// um logotipo horizontal (o `Kraken.png` é 163x82, o `dogswap_logo.png` é 4:1)
// vira um risco ilegível. Onde só existia o logotipo deitado, o ícone quadrado
// foi recortado do próprio arquivo e gravado ao lado.
const ENTITY_LOGOS: Record<string, string> = {
  Kraken: '/krakencolor.png',       // e não Kraken.png, que é o logotipo deitado
  Bitget: '/Bitget-icon.png',
  'Gate.io': '/Gate-icon.png',
  MEXC: '/Mexc-icon.png',
  'Merlin Chain': '/Merlin-icon.png',
  DotSwap: '/DotSwap.webp',
  DogSwap: '/dogswap-icon.png',     // mascote recortado do logotipo
  Pionex: '/pionex-icon.png',       // glifo recortado; a fonte tem 26px, serve a 12
  // ⚠️ COINEX NÃO TEM ARQUIVO. Fica sem logo, e o selo cai no ícone genérico com
  // o nome ao lado, que é o comportamento correto: nome errado é pior que nome
  // sem logo, e logo inventado é pior que os dois.
}

interface VerifiedEntry {
  type?: string
  name?: string
  logo?: string
  website?: string
  twitter?: string
}

// ── cache de módulo ──────────────────────────────────────────────────────────
// ⚠️ TTL CURTO E FALHA SILENCIOSA DE PROPÓSITO: identidade é enfeite, não dado
// essencial. Se o banco estiver fora do ar, o explorer tem que continuar
// mostrando a transação sem nome em cima, e não devolver erro.
const TTL_MS = 5 * 60_000
let cacheVerified: { at: number; map: Map<string, VerifiedEntry> } | null = null
let cacheOnchain: { at: number; map: Map<string, Identity> } | null = null

async function verified(): Promise<Map<string, VerifiedEntry>> {
  if (cacheVerified && Date.now() - cacheVerified.at < TTL_MS) return cacheVerified.map
  const map = new Map<string, VerifiedEntry>()
  try {
    const raw = await fs.readFile(path.join(process.cwd(), 'public', 'data', 'verified_addresses.json'), 'utf8')
    const json = JSON.parse(raw)
    for (const [address, v] of Object.entries((json?.verified || {}) as Record<string, VerifiedEntry>)) {
      if (v?.name) map.set(address, v)
    }
  } catch {
    // arquivo ausente ou malformado: sem identidade verificada, e a página segue
  }
  cacheVerified = { at: Date.now(), map }
  return map
}

async function onchain(): Promise<Map<string, Identity>> {
  if (cacheOnchain && Date.now() - cacheOnchain.at < TTL_MS) return cacheOnchain.map
  const map = new Map<string, Identity>()
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
  if (url && key) {
    try {
      // ⚠️ `internal=eq.false` NÃO É OPCIONAL. A tabela guarda o endereço de
      // depósito pessoal do fundador para o rotulador não confundir venda pessoal
      // com fluxo de mercado. Publicá-lo ao lado da carteira pública de doações
      // contaria a qualquer um quando e quanto ele vendeu.
      const res = await fetch(
        `${url}/rest/v1/dog_labels?select=address,entity,role,kind,evidence,evidence_note&internal=eq.false`,
        { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: 'no-store' },
      )
      if (res.ok) {
        for (const r of (await res.json()) as any[]) {
          map.set(r.address, {
            address: r.address,
            name: r.entity,
            logo: ENTITY_LOGOS[r.entity] ?? null,
            kind: r.kind ?? null,
            role: r.role ?? null,
            source: 'onchain',
            evidence: r.evidence ?? null,
            evidence_note: r.evidence_note ?? null,
            website: null,
            twitter: null,
          })
        }
      }
    } catch {
      // idem: identidade é enfeite
    }
  }
  cacheOnchain = { at: Date.now(), map }
  return map
}

/**
 * A identidade de cada endereço pedido. Endereço sem identidade não entra no mapa.
 *
 * ⚠️ QUANDO AS DUAS FONTES FALAM DO MESMO ENDEREÇO, o nome e o logo vêm da
 * VERIFICADA (é a entidade falando de si mesma, e ela mandou o arquivo), e o
 * papel e a prova vêm da nossa (a verificação não traz "carteira quente" nem
 * "tesouraria"). O `source` fica 'verified', porque é a afirmação mais forte das
 * duas e é ela que a tela precisa anunciar.
 */
export async function resolveIdentities(addresses: Array<string | null | undefined>): Promise<Map<string, Identity>> {
  const alvos = new Set(addresses.filter(Boolean) as string[])
  if (alvos.size === 0) return new Map()
  const [v, o] = await Promise.all([verified(), onchain()])

  const out = new Map<string, Identity>()
  for (const address of Array.from(alvos)) {
    const ver = v.get(address)
    const nosso = o.get(address)
    if (!ver && !nosso) continue
    out.set(address, ver
      ? {
          address,
          name: ver.name!,
          logo: ver.logo ?? ENTITY_LOGOS[ver.name!] ?? null,
          kind: nosso?.kind ?? null,
          role: nosso?.role ?? null,
          source: 'verified',
          evidence: nosso?.evidence ?? null,
          evidence_note: nosso?.evidence_note ?? null,
          website: ver.website ?? null,
          twitter: ver.twitter ?? null,
        }
      : nosso!)
  }
  return out
}

/** Uma só, para quando a página cuida de um endereço. */
export async function resolveIdentity(address: string | null | undefined): Promise<Identity | null> {
  if (!address) return null
  return (await resolveIdentities([address])).get(address) ?? null
}
