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

export function middleware(req: NextRequest) {
  if (req.nextUrl.pathname === '/city') return semSaidaAntiga(req)
  if (!ROTAS_COM_ENDERECO.test(req.nextUrl.pathname)) return NextResponse.next()

  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  const csp = [
    "default-src 'self'",
    // ⚠️ `strict-dynamic` deixa o script com nonce carregar os chunks do Next sem listar
    // cada um. O `unsafe-inline` no fim é ignorado por navegador que entende nonce, e serve
    // só de rede de segurança para navegador velho.
    // ⚠️ `unsafe-eval` SÓ EM DEV: o hot reload do Next usa eval, e sem isto a página quebra
    // EM SILÊNCIO, sem erro de console. Em produção o Next não usa eval e ele NÃO entra.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline'${
      process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",       // o Next emite style inline na hidratacao
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https:",
    "frame-ancestors 'none'",                  // clickjacking
    "base-uri 'none'",                         // <base> injetado redireciona caminho relativo
    "form-action 'self'",                      // exfiltracao por formulario
    "object-src 'none'",
    'upgrade-insecure-requests',
  ].join('; ')

  const headers = new Headers(req.headers)
  headers.set('x-nonce', nonce)                // o Next le daqui e aplica nos scripts dele
  const res = NextResponse.next({ request: { headers } })
  res.headers.set('Content-Security-Policy', csp)
  return res
}

export const config = {
  // ⚠️ NÃO casar com _next/static nem com imagem: middleware em ativo estatico e custo puro.
  matcher: [
    '/dogcity/:path*',
    '/dogcity',
    { source: '/city', has: [{ type: 'query', key: 'view', value: 'war' }] },
    { source: '/city', has: [{ type: 'query', key: 'classic' }] },
  ],
}
