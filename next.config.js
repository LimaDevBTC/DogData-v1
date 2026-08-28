/** @type {import('next').NextConfig} */
const nextConfig = {
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