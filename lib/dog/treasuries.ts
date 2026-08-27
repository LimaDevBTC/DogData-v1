import fs from 'fs/promises'
import path from 'path'

/**
 * OS TESOUROS DE DOG QUE A GENTE ACOMPANHA, num lugar só.
 *
 * ⚠️ AS DUAS LINHAS DO CARD NÃO TÊM O MESMO PESO E A TELA PRECISA DIZER ISSO.
 * A C2 Blockchain é uma empresa de capital aberto que ANUNCIA quanto tem: o
 * custódio é a Kraken, não existe endereço público da C2 para ninguém conferir,
 * e o que a gente publica é a declaração dela raspada do painel próprio. O
 * tesouro da Dog of Bitcoin é o contrário: um endereço na cadeia, verificado
 * pelo próprio projeto, e o saldo é MEDIDO pelo nosso índice.
 *
 * "A C2 disse que tem 1,09B" e "a gente contou 1,86M na carteira do projeto"
 * são afirmações de naturezas diferentes, e misturá-las num número só é o tipo
 * de coisa que custa a autoridade de um explorer. Por isso cada tesouro carrega
 * `provenance`, e o componente marca a diferença. Mesma regra do
 * lib/dog/identity.ts.
 */

export type TreasuryProvenance = 'declared' | 'onchain'

export interface Treasury {
  id: 'c2' | 'dogofbitcoin'
  name: string
  logo: string
  /** para onde o clique vai: fora só quando não existe endereço nosso para abrir */
  href: string
  external: boolean
  /** DOG inteiros, já fora das 5 casas decimais do rune */
  dog: number
  provenance: TreasuryProvenance
  /** quando a leitura foi feita (ISO) */
  readAt: string
  /** só a C2: meta declarada por ela */
  goalDog?: number
  /** só a C2: quanto ela declara ter gasto para montar a posição */
  costBasisUsd?: number
  /** só o endereço na cadeia */
  address?: string
  /** true quando a leitura ao vivo falhou e este é o último valor conhecido */
  stale?: boolean
  /** por que está velho, quando está */
  staleReason?: string
}

// ─── C2 Blockchain ───────────────────────────────────────────────────────────

const C2_BASE = 'https://www.c2dog.com'
const FETCH_TIMEOUT_MS = 15_000

/**
 * ⚠️ O ÚLTIMO VALOR LIDO DE VERDADE, e não um número redondo de enfeite.
 *
 * O raspador anterior caiu quando a C2 migrou para o Turbopack e o nome dos
 * pacotes mudou (`/_next/static/chunks/app/page-*.js` deixou de existir). Como
 * o fallback da home era um `?? 1_000_000_000` escrito à mão, o card passou
 * meses anunciando "1.000.000.000 DOG" e 66,7% da meta, enquanto o painel deles
 * dizia 1.095.089.975 e 74,6%. Publicar um número inventado com cara de leitura
 * é pior do que publicar "não deu para ler".
 *
 * Então: quando a raspagem falha, o que sai daqui é ESTA leitura, com a data em
 * que ela foi feita e a marca `stale`, e a tela escreve a data.
 */
const C2_LAST_KNOWN = {
  dog: 1_095_089_975,
  costBasisUsd: 2_087_241.49235,
  readAt: '2026-08-27T00:00:00.000Z',
}

const C2_GOAL_DOG = 1_500_000_000

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    cache: 'no-store',
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36' },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} em ${url}`)
  return res.text()
}

/**
 * A quantia e o custo saem do JS empacotado do painel da C2, porque não existe
 * API pública: o número está gravado no pacote, hoje em hexadecimal, dentro da
 * mesma expressão que multiplica pela cotação e subtrai o custo.
 *
 *   l = r ? 0x4145bf37 * r : null, g = l ? l - 2087241.49235 : null
 *
 * ⚠️ A ÂNCORA É A EXPRESSÃO INTEIRA, não "o primeiro número grande do arquivo".
 * Um pacote minificado está cheio de inteiros de nove dígitos (máscaras de bit,
 * limites de tempo) e casar com qualquer um deles é como o raspador quebra sem
 * avisar. Casando os dois valores de uma vez, ou vem o par certo, ou não vem
 * nada, e "não vem nada" é um erro que a rota sabe tratar.
 */
const C2_PAIR = /(0x[0-9a-fA-F]{6,10}|\d{9,10})\s*\*\s*\w+\s*:\s*null\s*,\s*\w+\s*=\s*\w+\s*\?\s*\w+\s*-\s*(\d+\.\d+)/

function parseNum(raw: string): number {
  return raw.startsWith('0x') || raw.startsWith('0X') ? parseInt(raw, 16) : parseInt(raw, 10)
}

async function scrapeC2(): Promise<{ dog: number; costBasisUsd: number }> {
  const html = await fetchText(C2_BASE + '/')

  // ⚠️ TODOS OS PACOTES, na ordem em que a página os carrega. O Turbopack dá
  // nomes com hash e sem rota no caminho (`0o.7tc39h5fie.js`), então não dá para
  // adivinhar qual é o da página: procurar em todos custa uns 600 KB e sobrevive
  // ao próximo build deles.
  const srcs = Array.from(html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)).map(m => m[1])
  if (srcs.length === 0) throw new Error('nenhum <script src> no HTML da c2dog')

  for (const src of srcs) {
    const url = src.startsWith('http') ? src : C2_BASE + src
    let js: string
    try {
      js = await fetchText(url)
    } catch {
      continue // um pacote fora do ar não invalida os outros
    }
    const m = js.match(C2_PAIR)
    if (!m) continue

    const dog = parseNum(m[1])
    const costBasisUsd = parseFloat(m[2])

    // ⚠️ FAIXA DE SANIDADE. Se a expressão casar com outra coisa qualquer num
    // build futuro, é melhor cair no último valor conhecido do que publicar
    // lixo com cara de tesouro.
    if (!Number.isFinite(dog) || dog < 100_000_000 || dog > 100_000_000_000) {
      throw new Error(`quantia fora da faixa: ${dog}`)
    }
    if (!Number.isFinite(costBasisUsd) || costBasisUsd < 10_000 || costBasisUsd > 1_000_000_000) {
      throw new Error(`custo fora da faixa: ${costBasisUsd}`)
    }
    return { dog, costBasisUsd }
  }

  throw new Error('par tesouro/custo não encontrado em nenhum pacote da c2dog')
}

export async function c2Treasury(): Promise<Treasury> {
  const base: Treasury = {
    id: 'c2',
    name: 'C2 Blockchain',
    logo: '/C2.png',
    href: 'https://www.c2dog.com/',
    external: true,
    dog: C2_LAST_KNOWN.dog,
    provenance: 'declared',
    readAt: C2_LAST_KNOWN.readAt,
    goalDog: C2_GOAL_DOG,
    costBasisUsd: C2_LAST_KNOWN.costBasisUsd,
  }

  try {
    const { dog, costBasisUsd } = await scrapeC2()
    return { ...base, dog, costBasisUsd, readAt: new Date().toISOString() }
  } catch (err) {
    return { ...base, stale: true, staleReason: String(err instanceof Error ? err.message : err) }
  }
}

// ─── Dog of Bitcoin ──────────────────────────────────────────────────────────

/**
 * ⚠️ O ENDEREÇO NÃO É CHUTE NOSSO: está em `public/data/verified_addresses.json`,
 * que é a verificação PEDIDA pelo dono (o projeto mandou nome, logo e site). A
 * chave é lida de lá em vez de copiada para cá justamente para o dia em que o
 * projeto trocar de carteira: muda um arquivo, não dois.
 */
const DOB_NAME = 'Dog of Bitcoin treasury'

/** o rune DOG tem 5 casas: o snapshot guarda a base, a tela quer DOG inteiro */
const DOG_DIVISOR = 100_000

interface VerifiedEntry {
  name?: string
  logo?: string
  website?: string
}

async function readJson<T>(rel: string): Promise<T> {
  const raw = await fs.readFile(path.join(process.cwd(), rel), 'utf8')
  return JSON.parse(raw) as T
}

export async function dogOfBitcoinTreasury(): Promise<Treasury | null> {
  try {
    const verified = await readJson<{ verified: Record<string, VerifiedEntry> }>(
      'public/data/verified_addresses.json',
    )
    const entry = Object.entries(verified.verified ?? {}).find(
      ([, v]) => (v.name ?? '').toLowerCase() === DOB_NAME.toLowerCase(),
    )
    if (!entry) return null
    const [address, meta] = entry

    const snapshot = await readJson<{
      timestamp: string
      holders: { address: string; total_amount: number }[]
    }>('public/data/dog_holders_by_address.json')

    const row = snapshot.holders.find(h => h.address === address)
    // ⚠️ CARTEIRA ZERADA NÃO É CARTEIRA AUSENTE. Se o projeto esvaziar o tesouro
    // o snapshot deixa de listar o endereço, e a resposta certa é "0 DOG", não
    // sumir com a linha e deixar o card mentir por omissão.
    const dog = row ? row.total_amount / DOG_DIVISOR : 0

    return {
      id: 'dogofbitcoin',
      name: 'Dog of Bitcoin',
      logo: meta.logo ?? '/dogofbitcoin.png',
      // link de carteira fica em casa: o explorer é nosso
      href: `/address/bitcoin/${address}`,
      external: false,
      dog,
      provenance: 'onchain',
      readAt: snapshot.timestamp,
      address,
    }
  } catch {
    // um tesouro que não deu para ler não derruba o outro
    return null
  }
}

export async function allTreasuries(): Promise<Treasury[]> {
  const [c2, dob] = await Promise.all([c2Treasury(), dogOfBitcoinTreasury()])
  return [c2, dob].filter((t): t is Treasury => t !== null)
}
