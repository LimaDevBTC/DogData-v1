# CSP nas rotas de pagamento: NO AR desde 13/09/2026

Este arquivo registrava uma tentativa que falhou. **Ela foi resolvida.** Fica o registro do
diagnóstico, porque a causa é uma armadilha que volta.

## A falha silenciosa, e o que era

Com a CSP ligada, a busca por endereço parava de funcionar **sem emitir um único erro de
console**. Parecia a CSP estar errada.

⚠️ **Era o `eval` do HOT RELOAD DO NEXT, em modo DEV.** O dev usa `eval`, a CSP sem
`unsafe-eval` mata isso, e o Chrome não loga. Em **produção** o Next não usa `eval` e a mesma
CSP funciona inteira.

**A lição que generaliza: CSP se testa em `next build && next start`, NUNCA em `next dev`.**
Testar em dev dá falso negativo e faz a pessoa desistir de uma trava que estava certa.

Por isso `middleware.ts` só acrescenta `unsafe-eval` quando `NODE_ENV === 'development'`.

## O que está no ar

- `middleware.ts`: CSP com **nonce**, matcher só em `/dogcity` e `/dogcity/:path*`. Nonce em vez
  de `unsafe-inline` porque a ameaça é script injetado trocando o endereço, e `unsafe-inline`
  aceitaria justamente ele.
- `app/dogcity/layout.tsx`: passa o nonce ao script inline próprio (o Next carimba só os dele).
- `components/donate/donate-modal.tsx`: **segunda declaração dos endereços**, escrita à mão,
  independente de `DONATION_METHODS`. Se as duas discordarem, o componente não mostra endereço,
  QR nem link, e manda usar a carteira conectada.

Conferido em modo produção, seis de seis: busca, QR igual à constante, guarda não disparando à
toa, endereço visível, link BTC correto, zero erro de console.

## ⚠️ O que continua sem proteção

- **O resto do site não tem CSP.** A objeção do `next.config.js` (TradingView, Scalar) vale
  fora de `/dogcity`. Dívida registrada, não decisão.
- **Dependência npm comprometida vira código `self` depois do bundle**, e CSP nenhuma barra
  isso. O modal usa `qrcode-generator`. Contra esse vetor vale a tela de confirmação da
  carteira, que mostra o destino e que atacante na nossa página não altera.
- **Falta publicar o endereço do fundo FORA da página** (docs, repo, uma vez no X), para a
  pessoa ter outra fonte de verdade se a página for comprometida.
