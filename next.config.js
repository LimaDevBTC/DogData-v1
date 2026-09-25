// ═══════════════════════════════════════════════════════════════════════════
// A /city e o jogo novo (projeto Vercel `dogcity-mundo`), servido aqui
// ═══════════════════════════════════════════════════════════════════════════
// Plano em dogcity-mundo/LIGAR.md, secao 2. O jogo vira `www.dogdata.xyz/city`
// por rewrite externo, na MESMA origem: cookie `dg_wallet`, `dog_vid`,
// `dogdata-wallet-account` e as rotas `/api/*` valem sem CORS e sem relogar.
//
// ⚠️ A CIDADE ANTIGA SAIU (decisao do fundador, 24/09 22:30: "agora e so
// jogo"). `app/city` nao esta mais no repositorio (fica so na maquina do
// fundador, ignorada pelo .gitignore) e nao ha mais saida para a praca antiga:
// `?classic=1`, `?view=war` e a env DOGCITY_GUERRA_ANTIGA acabaram.
//
// A ENV SO DIZ ONDE O JOGO ESTA. Sem `DOGCITY_MUNDO_ORIGEM` valida (formato
// `https://host`, sem barra no fim) nao ha rewrite e a /city nao existe num
// clone limpo (404); na arvore do fundador cai na cidade antiga ignorada, so
// local. Com ela, os tres rewrites abaixo. Rollback agora e so do lado do jogo
// (Instant Rollback ou `scripts/desviar.sh` no dogcity-mundo). NUNCA Instant
// Rollback neste projeto: desliga a promocao automatica e congela os dados do
// bot.
//
// ⚠️ TRES REGRAS DURAS, todas medidas no levantamento de 24/09:
//   1. `beforeFiles`, nunca `afterFiles`: em afterFiles uma `app/city/page.tsx`
//      (a copia local ignorada do fundador) ganharia e o rewrite nunca rodaria.
//   2. Diretorios do jogo LISTADOS POR NOME. `/city/:path*` engoliria os
//      115 MB de `public/city`, e dali saem `/city/carta.svg`, `carta-v4.svg`
//      e `hero-mapa.jpg` (landing /dogcity), `/city/mapa-topo.svg`
//      (/dogcity/docs), os GLB e posters de /dogcity/partners e
//      `/city/escrituras.bin`, que e a reserva por URL do leitor de
//      `/api/dogcity/lookup` e `/api/profile`. Nenhum dos seis nomes abaixo
//      existe em `public/city`. Arquivo novo do jogo mora num dos seis; pasta
//      nova do jogo exige mudar esta lista.
//   3. Nunca sob `/dogcity`: a CSP com nonce do middleware bloqueia o script
//      estatico do jogo.
//
// Links internos para a /city sao `<a href>` cru, NUNCA `<Link>` do Next: o
// Link navega no cliente, nao passa pelo rewrite e ainda faz prefetch do RSC.
const ORIGEM_JOGO = /^https?:\/\/[^/]+$/.test(process.env.DOGCITY_MUNDO_ORIGEM || '')
  ? process.env.DOGCITY_MUNDO_ORIGEM
  : ''
const DIRS_JOGO = 'assets|dados|modelos|texturas|draco|basis'
const ARQS_JOGO = 'manifesto\\.json|creditos\\.json'

async function rewritesDoJogo() {
  return {
    beforeFiles: [
      // `via=dogdata` e a marca de que o pedido veio por aqui: a origem do jogo
      // manda quem abre o endereco da Vercel direto (sem a marca) para esta /city.
      { source: '/city', destination: `${ORIGEM_JOGO}/city/index.html?via=dogdata` },
      { source: `/city/:dir(${DIRS_JOGO})/:path*`, destination: `${ORIGEM_JOGO}/city/:dir/:path*` },
      { source: `/city/:arq(${ARQS_JOGO})`, destination: `${ORIGEM_JOGO}/city/:arq` },
    ],
  }
}

// Rotas da cidade antiga que o jogo nao tem: 308 para a /city, com ou sem a
// env (o que morreu nao volta). O Next repassa a query do pedido ao destino,
// entao `/city/mapa?lot=X` vira `/city?lot=X` e `/city/war?addr=Y` vira
// `/city?addr=Y` (o jogo le `?addr=` e `?lot=`). `mapa` so EXATO: em
// `public/city/mapa/` ha arquivos servidos, e `/city/mapa/:path*` os engoliria.
// Nenhum dos outros nomes existe em `public/city`. As consultas antigas da
// propria /city (`?view=war`, `?classic=1`) saem no middleware.ts, porque um
// redirect daqui repassaria a query e voltaria para si mesmo.
const ROTAS_ANTIGAS = 'war|plan|explore|luna|plaza'

async function redirectsDaCidadeAntiga() {
  return [
    { source: `/city/:antiga(${ROTAS_ANTIGAS})/:resto*`, destination: '/city', permanent: true },
    { source: '/city/mapa', destination: '/city', permanent: true },
  ]
}

// Cache de borda do rewrite externo, so com a env. O que tem hash no nome
// (assets) ou `?h=` (os outros cinco diretorios) pode ficar na borda do
// DogData; o HTML e os dois json nunca, para um deploy do jogo aparecer na
// hora sem purgar este projeto (a borda daqui nao e purgada pelo deploy de
// la). Se a Vercel nao honrar o header vindo do next.config, conferir
// `x-vercel-cache: HIT` no preview e mover estas regras para o vercel.json.
const HEADERS_DO_JOGO = ORIGEM_JOGO
  ? [
      {
        source: `/city/:dir(${DIRS_JOGO})/:path*`,
        headers: [{ key: 'x-vercel-enable-rewrite-caching', value: '1' }],
      },
      {
        source: '/city',
        headers: [{ key: 'x-vercel-enable-rewrite-caching', value: '0' }],
      },
      {
        source: `/city/:arq(${ARQS_JOGO})`,
        headers: [{ key: 'x-vercel-enable-rewrite-caching', value: '0' }],
      },
    ]
  : []

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(ORIGEM_JOGO ? { rewrites: rewritesDoJogo } : {}),
  redirects: redirectsDaCidadeAntiga,
  // Um segundo `next dev` (revisao visual, screenshot) nao pode disputar o
  // .next do servidor que ja esta rodando: com NEXT_DIST_DIR ele compila num
  // diretorio proprio. Sem a variavel, nada muda.
  //
  // ⚠️ SO NOME RELATIVO COMECANDO EM .next, e a regra existe por acidente
  // medido: o Next resolve distDir SEMPRE contra a raiz do projeto, entao um
  // caminho absoluto tipo /tmp/x/next-build vira tmp/x/next-build DENTRO do
  // repositorio. Em 27/08 isso encheu tmp/ com 788 MB de cache do webpack, o
  // bot de auto-commit engoliu tudo, e como o GitHub recusa arquivo acima de
  // 100 MB o push do repositorio inteiro passou a ser rejeitado. Qualquer
  // outro valor aqui e ignorado de proposito.
  distDir: /^\.next[A-Za-z0-9._-]*$/.test(process.env.NEXT_DIST_DIR || '')
    ? process.env.NEXT_DIST_DIR
    : '.next',
  images: {
    unoptimized: true,
  },

  // Cabeçalhos de segurança em todas as respostas. Nenhum deles muda o que a
  // página faz; eles fecham portas que estavam abertas por omissão:
  //   nosniff        impede que um conteúdo servido como imagem seja tratado
  //                  como HTML pelo navegador (a rota de conteúdo de inscrição
  //                  serve bytes de terceiro, então isto importa aqui)
  //   SAMEORIGIN     ninguém pode embutir o site num iframe e sobrepor um
  //                  botão falso de doação em cima do nosso (clickjacking)
  //   Referrer       endereço de carteira na URL não vaza para terceiros
  //   Permissions    câmera, microfone, localização e a API de pagamento ficam
  //                  desligadas para qualquer script da página
  // ⚠️ FALTA a Content-Security-Policy, que é a tranca de verdade contra
  // script injetado trocar o endereço de destino. Ela não entra de graça: os
  // widgets do TradingView e o Scalar do /docs injetam script na nossa página,
  // e o Next usa script inline na hidratação. Ver o relatório de segurança.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
          },
        ],
      },
      ...HEADERS_DO_JOGO,
    ]
  },
  experimental: {
    outputFileTracingIncludes: {
      '/api/address/bitcoin/[address]': [
        './data/dog_holders_by_address.json',
        './data/forensic_behavioral_analysis.json',
      ],
      '/api/tx/bitcoin/[txid]': [
        './data/dog_holders_by_address.json',
        './data/forensic_behavioral_analysis.json',
      ],
      // dynamic fs.readFile paths are not traced automatically, and the
      // Runestone dossier route is read at request time
      '/api/runestone/dossier': [
        './data/runestone_dossier.json',
      ],
      '/api/runestone/holders': [
        './data/runestone_holders_today.json',
        './data/forensic_behavioral_analysis.json',
      ],
      '/api/runestone/stats': [
        './data/runestone_dossier.json',
      ],
      // a escritura da landing: endereco -> posicao do lote, lido do registro
      // selado. Vive em public/ para tambem ser servido pela CDN (o leitor em
      // lib/city/escrituras.ts cai para a URL publica se o fs nao achar).
      '/api/dogcity/lookup': [
        './public/city/escrituras.bin',
      ],
      // o /profile le o mesmo registro selado (LIGAR.md FS3); sem isto a funcao
      // cai no plano B do leitor e baixa os 3 MiB pela URL a cada instancia fria
      '/api/profile': [
        './public/city/escrituras.bin',
      ],
    },
    outputFileTracingExcludes: {
      '*': [
        './data/forensic_airdrop_data.json',
        './data/dog_data/**',
        './data/backup_ord_data/**',
        './data/airdrop_recipients_complete.json',
        './data/airdrop_final.json',
        './data/airdrop_dog_only.json',
        './data/airdrop_recipients_exact.json',
        './data/merlin_*.json',
        './data/wallet_analysis_*.json',
        './data/dog_transactions/**',
        './mcp-server/**',
        './sdk/**',
      ],
    },
  },
}

module.exports = nextConfig