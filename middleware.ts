import { NextResponse, type NextRequest } from 'next/server'

/**
 * CSP com NONCE, só nas rotas que MOSTRAM ENDEREÇO DE PAGAMENTO.
 *
 * ⚠️ POR QUE SÓ NESSAS ROTAS. `next.config.js` registra que a CSP nunca entrou no site
 * inteiro porque o TradingView e o Scalar da `/docs` injetam script de terceiro. Medido em
 * 13/09/2026: **`/dogcity` e `/dogcity/founders` não carregam script externo nenhum**, então
 * a objeção não vale onde a trava mais importa. O resto do site continua sem CSP, e isso está
 * registrado como dívida, não como decisão.
 *
 * ⚠️ POR QUE NONCE E NÃO `unsafe-inline`. O Next hidrata com script inline. Com
 * `unsafe-inline` a CSP aceitaria QUALQUER script inline, inclusive um injetado, e a ameaça
 * que a gente quer barrar é exatamente essa: script injetado trocando o endereço de destino
 * para todos os visitantes. Com nonce, só o script que a gente emitiu roda. É a diferença
 * entre CSP de enfeite e CSP de verdade.
 *
 * ⚠️ O QUE ISTO NÃO PROTEGE, e é honesto dizer: dependência npm comprometida vira código
 * `'self'` depois do bundle, e nenhuma CSP barra isso. Contra esse vetor o que vale é a tela
 * de confirmação da carteira, que mostra o destino e que atacante na nossa página não altera.
 */
const ROTAS_COM_ENDERECO = /^\/dogcity(\/|$)/

/**
 * AS SAIDAS DA PRACA ANTIGA NA PROPRIA /city (24/09 22:30, a cidade antiga saiu
 * do ar). `/city?view=war` era a porta 02 da landing e o portao da WebView, e
 * `/city?classic=1` o rollback por pessoa. Os dois viram a /city limpa, com o
 * resto da consulta (`?addr=`, `?lot=`, utm) intacto.
 *
 * ⚠️ POR QUE AQUI E NAO NO next.config. Um redirect de la repassa a query do
 * pedido ao destino: `/city?view=war` voltaria para `/city?view=war`, em laco.
 * Aqui a consulta sai de verdade. O matcher so casa com essas consultas, entao
 * a /city normal nunca invoca o middleware (nem custo, nem latencia).
 *
 * ⚠️ 307, NAO 308: a batalha nova do jogo (src/guerra) vai usar `?view=war`.
 * Um 308 ficaria no cache do navegador e sequestraria o link depois; quando a
 * batalha chegar, basta tirar a regra do matcher abaixo.
 */
function semSaidaAntiga(req: NextRequest) {
  const url = req.nextUrl.clone()
  if (url.searchParams.getAll('view').includes('war')) url.searchParams.delete('view')
  url.searchParams.delete('classic')
  return NextResponse.redirect(url, 307)
}

/**
 * O DOMINIO DA DOGCITY (22/10/2026, decisao do fundador): `dogcity.space` e' a landing, `play.dogcity.space` o jogo,
 * `mint.dogcity.space` o mint. A landing continua sendo ESTA (app/dogcity): o dominio aponta para este projeto e o
 * middleware mostra /dogcity na raiz. A Xverse lista `dogcity.space` no explorer dela, e quem chega por la' cai aqui.
 *
 * ⚠️ NENHUM LINK DE JOGO QUEBRA. Ate' 22/10 a raiz era o jogo, entao `dogcity.space/?addr=`, `?lot=`, `?tour=carro&live=1`
 * e qualquer outra consulta de jogo circulam por ai'. Raiz com consulta que nao seja de campanha vai para o `play` com a
 * consulta inteira. 307 e nao 308: se um dia a landing usar um parametro, o navegador nao guardou o desvio.
 * Os arquivos do jogo (`/city/...`, de HTML antigo em cache) tambem vao para o `play`.
 */
const HOST_SPACE = /^(www\.)?dogcity\.space$/
const PLAY = 'https://play.dogcity.space'
const CAMPANHA = /^(utm_[a-z_]+|ref|gclid|fbclid|twclid|mc_cid|mc_eid|s|src)$/
const ROTAS_SPACE: Record<string, string> = { '/': '/dogcity', '/docs': '/dogcity/docs', '/founders': '/dogcity/founders', '/support': '/dogcity/support', '/atlas': '/dogcity/atlas' }

function noDominioDaCidade(req: NextRequest): NextResponse | null {
  const host = (req.headers.get('host') || '').split(':')[0].toLowerCase()
  if (!HOST_SPACE.test(host)) return null
  const { pathname, search, searchParams } = req.nextUrl
  if (host.startsWith('www.')) return NextResponse.redirect(`https://dogcity.space${pathname}${search}`, 308)
  if (pathname === '/' && Array.from(searchParams.keys()).some((k) => !CAMPANHA.test(k))) return NextResponse.redirect(`${PLAY}/${search}`, 307)
  if (pathname === '/city' || pathname.startsWith('/city/')) return NextResponse.redirect(`${PLAY}${pathname}${search}`, 307)
  // /dogcity/docs aqui vira /docs (o endereco curto e' o canonico deste dominio)
  if (pathname === '/dogcity' || pathname.startsWith('/dogcity/')) {
    const curto = pathname.slice('/dogcity'.length) || '/'
    if (ROTAS_SPACE[curto]) return NextResponse.redirect(`https://dogcity.space${curto}${search}`, 308)
  }
  if (pathname === '/robots.txt' || pathname === '/sitemap.xml') return NextResponse.rewrite(new URL(`/dogcity-space${pathname}`, req.url))
  const alvo = ROTAS_SPACE[pathname.replace(/\/$/, '') || '/']
  if (alvo) return comCsp(req, new URL(alvo + search, req.url))
  // o resto do DogData nao mora neste dominio
  return NextResponse.redirect(`https://www.dogdata.xyz${pathname}${search}`, 308)
}

export function middleware(req: NextRequest) {
  const cidade = noDominioDaCidade(req)
  if (cidade) return cidade
  if (req.nextUrl.pathname === '/city') return semSaidaAntiga(req)
  if (!ROTAS_COM_ENDERECO.test(req.nextUrl.pathname)) return NextResponse.next()
  return comCsp(req, null)
}

/** A CSP com nonce das rotas com endereco; `reescrita` serve a mesma pagina noutro caminho (o dominio da cidade). */
function comCsp(req: NextRequest, reescrita: URL | null) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  const csp = [
    "default-src 'self'",
    // ⚠️ `strict-dynamic` deixa o script com nonce carregar os chunks do Next sem listar
    // cada um. O `unsafe-inline` no fim é ignorado por navegador que entende nonce, e serve
    // só de rede de segurança para navegador velho.
    // ⚠️ `unsafe-eval` SÓ EM DEV: o hot reload do Next usa eval, e sem isto a página quebra
    // EM SILÊNCIO, sem erro de console. Em produção o Next não usa eval e ele NÃO entra.
    // ⚠️ `wasm-unsafe-eval` (18/10/2026, landing v3): o palco do $DOG em /dogcity decodifica
    // o GLB com o meshopt, que é WebAssembly. Sem esta palavra o wasm só compila no dev (por
    // causa do unsafe-eval de lá) e o palco morre EM PRODUÇÃO. Ela libera só a compilação de
    // wasm, não eval de JS. (O GLB é a variante WebP justamente porque o basis do KTX2 pede
    // eval de JS de verdade: ver app/dogcity/sections/dog-stage.tsx.)
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline' 'wasm-unsafe-eval'${
      process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",       // o Next emite style inline na hidratacao
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    // blob: (18/10/2026, landing v3): o GLTFLoader busca as texturas embutidas no GLB do
    // $DOG por fetch de uma URL blob:; sem isto o modelo carrega sem textura nenhuma
    "connect-src 'self' https: blob:",
    "frame-ancestors 'none'",                  // clickjacking
    "base-uri 'none'",                         // <base> injetado redireciona caminho relativo
    "form-action 'self'",                      // exfiltracao por formulario
    "object-src 'none'",
    'upgrade-insecure-requests',
  ].join('; ')

  const headers = new Headers(req.headers)
  headers.set('x-nonce', nonce)                // o Next le daqui e aplica nos scripts dele
  const res = reescrita ? NextResponse.rewrite(reescrita, { request: { headers } }) : NextResponse.next({ request: { headers } })
  res.headers.set('Content-Security-Policy', csp)
  return res
}

export const config = {
  // ⚠️ NÃO casar com _next/static nem com imagem: middleware em ativo estatico e custo puro.
  matcher: [
    // o dominio da cidade: tudo, menos os arquivos do Next, a API e os estaticos com extensao
    { source: '/((?!_next/|api/|.*\\.[a-z0-9]{2,5}$).*)', has: [{ type: 'host', value: '(www\\.)?dogcity\\.space' }] },
    { source: '/:arq(robots.txt|sitemap.xml)', has: [{ type: 'host', value: '(www\\.)?dogcity\\.space' }] },
    '/dogcity/:path*',
    '/dogcity',
    { source: '/city', has: [{ type: 'query', key: 'view', value: 'war' }] },
    { source: '/city', has: [{ type: 'query', key: 'classic' }] },
  ],
}
