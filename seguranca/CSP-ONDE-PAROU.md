# CSP nas rotas de pagamento: onde parou

**13/09/2026.** Tentativa feita, **NÃO foi ao ar**, e o motivo está medido aqui.

## Por que vale insistir

O `next.config.js` registra que a CSP nunca entrou no site inteiro porque TradingView e o
Scalar da `/docs` injetam script de terceiro. **Medido hoje: `/dogcity` e `/dogcity/founders`
não carregam script externo nenhum.** Então a objeção não vale onde a trava mais importa, que é
a página que mostra o endereço de pagamento. CSP com escopo nessas rotas é viável em princípio.

## O que foi feito

`seguranca/csp-middleware.ts.wip` (era `middleware.ts` na raiz): CSP com **nonce**, matcher só
em `/dogcity` e `/dogcity/:path*`. Nonce em vez de `unsafe-inline` de propósito: com
`unsafe-inline` a CSP aceitaria qualquer script inline, inclusive o injetado, que é exatamente
a ameaça (script trocando o endereço de destino para todos os visitantes).

Também foi preciso passar o nonce ao script inline próprio de `app/dogcity/layout.tsx:105`
(o pré-hidratação), lendo `headers().get('x-nonce')`. **Isso resolveu o erro de console**, mas
não resolveu o problema.

## ⚠️ ONDE TRAVOU, e é o achado que importa

**Com a CSP ligada, a busca por endereço para de funcionar, E NÃO APARECE ERRO NENHUM no
console.** Falha silenciosa.

Isolado assim, e é o teste que qualquer retomada deve refazer primeiro:

```
com middleware.ts     busca NAO responde, 0 erro de console
sem middleware.ts     busca responde normal
```

Suspeita principal: `'strict-dynamic'`. Com ele o `'self'` é IGNORADO, e só script carregado
por um script com nonce é confiado. Se algum chunk do Next entra por caminho que não herda a
confiança, morre calado. **Próximo passo sugerido:** tirar `strict-dynamic` e listar `'self'`
explicitamente, testando a busca a cada mudança.

## O que NÃO se perdeu

O peso visual já favorece a carteira conectada, e **a tela de confirmação da carteira é a única
que um atacante na nossa página não consegue alterar**. Essa continua sendo a proteção mais
forte do usuário, e ela está de pé.

## Ainda por fazer, além da CSP

- Publicar o endereço do fundo FORA da página (docs, repo, uma vez no X), para a pessoa ter
  outra fonte de verdade se a página for comprometida.
- Autoverificação em tempo de execução: o componente confere que o endereço que vai mostrar e
  codificar bate com a constante. ⚠️ Não protege contra quem injeta script (remenda a checagem
  junto), mas pega bug nosso e extensão burra.
- ⚠️ Vetor que CSP nenhuma resolve: **dependência npm comprometida vira código `'self'` depois
  do bundle**. Hoje o modal de pagamento usa `qrcode-generator`. Contra isso só vale a
  confirmação na carteira.
