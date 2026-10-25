# Referral: placar da fase 1 (so contar)

Decisao do fundador, 25/10/2026: a fase 1 so CONTA. Um placar publico mostra quantos referrals cada conta
verificada trouxe; o que isso destrava sera anunciado depois, com os dados na mao. Tudo off-chain, no DogData.
Nenhum texto publico promete valor.

## Como funciona

1. **Quem indica.** So conta verificada COM `@handle` (o handle so nasce com sessao provada em `POST /api/profile`).
   No `/profile`, a secao "Your referral link" mostra `https://dogcity.space/?ref=@handle` com botao de copiar. O mesmo
   `?ref=@handle` vale em `https://www.dogdata.xyz/`. O link leva o handle, nunca o endereco.
2. **Quem chega pelo link.** O navegador guarda o `ref` em `localStorage` (chave `dogdata-ref`) por 30 dias, por origem.
   O primeiro link valido ganha enquanto estiver no prazo. Na primeira verificacao de carteira bem sucedida o ref e
   enviado no corpo do verify e apagado, tenha vinculado ou nao.
3. **O vinculo.** `POST /api/wallet/verify` recebe `ref` e o servidor grava `carteira -> indicador` em `referral_links`.
4. **A conta.** Um cron le o que cada carteira indicada fez DEPOIS do vinculo e grava em `referral_progress`; o placar so le
   o resultado pronto.

## Contrato do campo `ref` (para o jogo e o mint repassarem depois)

`POST /api/wallet/verify` aceita um campo opcional no corpo JSON:

```json
{ "address": "...", "signature": "...", "protocol": "bip322", "walletId": "unisat", "ref": "@handle" }
```

* `ref`: o `@handle` (ou o handle puro) de quem indicou. 3 a 15 caracteres `a-z 0-9 _`, a mesma regra do perfil. Qualquer outra
  coisa e ignorada em silencio. Vai no CORPO, nunca em cookie: `play.dogcity.space` e `mint.dogcity.space` usam esta mesma API
  pelo rewrite de `/api` e nao dividem cookie com o DogData.
* Resposta: `{ ok, address, verifiedAt, referral?: { linked: boolean } }`. `referral` so aparece quando `ref` veio. `linked: false`
  nao diz por que (nao e erro: o verify funcionou). Nao mostre erro ao usuario por causa dele.
* O que o jogo e o mint precisam fazer: ler `?ref=` na entrada (a landing `dogcity.space/?ref=@handle` ja o preserva na raiz, ver
  `CAMPANHA` em `middleware.ts`), guardar por 30 dias na PROPRIA origem (localStorage nao atravessa dominio), e mandar `ref`
  no corpo do verify na primeira verificacao. Para o link sobreviver ao salto da landing para o jogo/mint, os botoes da landing
  que levam para esses dominios precisariam carregar `?ref=` (nao feito nesta fase).

## Regras do vinculo (servidor, `lib/referral/link.ts`; falha FECHADA, nunca derruba o verify)

* So vincula a carteira que verifica pela PRIMEIRA vez. "Ja verificou antes" = ja esta em `wallet_first_verify`, OU ja tem
  perfil ou ponte de analytics (verificou antes da tabela existir), OU o navegador ja trazia sessao verificada para o mesmo
  endereco. Toda verificacao registra a carteira em `wallet_first_verify`, com ou sem `ref`.
* Um indicador por carteira, o primeiro, para sempre: `referred_address` e chave primaria e um trigger recusa update e delete.
* Auto-indicacao nao vale: mesma carteira, ou o handle de quem verifica (checado no servidor e por `check` no banco).
* O `ref` precisa ser de conta verificada existente (handle em `dogcity_profiles`); desconhecido, reservado ou malformado e ignorado.
* O passo inteiro tem prazo de 3 s dentro do verify e a funcao nunca lanca: banco fora do ar significa "nao vinculou".
* Limite conhecido: quem verificou antes, nunca teve perfil nem ponte de analytics, e tinha limpo os cookies e' indistinguivel de
  carteira nova. O dano e' limitado: o indicador so recebe o que essa carteira fizer DEPOIS do vinculo.

## A contagem (`lib/referral/tally.ts`, `sources.ts`)

Para cada indicador: carteiras indicadas, quantas MINTARAM a escritura depois do vinculo, licencas pagas depois do vinculo.

| Numero | Fonte | Como |
|---|---|---|
| Mint | API publica do mint | `GET /api/mint/lookup?address=` (ate 4 por pedido) lista os lotes registrados no nome da carteira e o `state`; `GET /api/mint/lot/{id}` da o `inscriptionId`; o bloco vem da transacao reveal no mempool.space (`/api/tx/{txid}/status`). |
| Licenca em $DOG | `dog_transactions` | por carteira, `addresses @> {fundo, carteira}` (indice GIN), com `contributionOf()` de `founders-ledger.ts`, a regra exata do livro. |
| Licenca em BTC | `dogcity_btc_payments` | `status = 'credited'`, `credit_dog` da cotacao travada, com o teto por carteira de `licence-btc.ts`. |

* "Depois do vinculo" = em bloco ESTRITAMENTE maior que o bloco da ponta da cadeia no instante do vinculo (`linked_block`, lido
  do mempool.space, com o status do mint como reserva). Se um lado nao tem bloco, compara por tempo. Sem bloco nem tempo: nao conta.
* O degrau da licenca e' o que os pagamentos POSTERIORES ao vinculo somam, na escada Personal 10.000, Commercial 50.000, Patron
  500.000 $DOG. Pagamento anterior ao vinculo nunca entra, mesmo que o total da carteira chegue a um degrau maior.
* Aproximacoes documentadas: (1) a API do mint nao serve o bloco do mint, por isso ele sai do reveal no mempool.space; lote sem
  reveal confirmado ainda nao conta. (2) So se enxerga lote registrado no nome da carteira indicada; escritura comprada de lote de
  outro dono nao aparece nessa API. (3) O bloco do vinculo vem de fonte externa; se nenhuma responder, `linked_block` fica nulo e a
  regra cai para o tempo (o tempo do bloco atrasa alguns minutos em relacao ao relogio, o que erra para MENOS, nunca para mais).

## Dados e custo

Migracao `supabase/migrations/035_referral_placar.sql` (ESCRITA, NAO APLICADA):

* `wallet_first_verify`: uma linha por carteira, na primeira verificacao (append-only), com backfill de perfis e ponte de analytics.
* `referral_links`: o vinculo; chave primaria = indice unico por carteira indicada; append-only.
* `referral_progress`: derivada e reconstruivel (o cron a refaz).
* `referral_board(limit, referrer)` e `referral_next_batch(limit)`: funcoes SQL so para `service_role`.

Custo (IO esgotado em 26/08): o placar le UMA funcao que agrega tres tabelas pequenas, com cache de CDN de 5 minutos, memo de 60 s
no processo e prazo de 6 s. A contagem pesada roda no cron `GET /api/cron/referrals` (a cada 10 min, `CRON_SECRET`, lote de 80
carteiras, as nunca contadas primeiro). Nada varre tabela grande por requisicao de pagina.

## Telas

* `/dogcity/referrals` (em `dogcity.space/referrals`): placar publico com as regras de contagem na propria pagina. Mostra @handle ou
  endereco abreviado; nunca o endereco inteiro e nunca as carteiras indicadas.
* `/profile`: secao "Your referral link" com copiar e a contagem propria (`GET /api/referral/me`, so com sessao).

## Aplicar a migracao (depois do go)

Ordem segura: aplicar ANTES de mesclar. Sem as tabelas o codigo falha fechado (nenhum vinculo, o verify segue), mas carteiras que
verificarem enquanto as tabelas nao existem nao ficam registradas como "ja verificou". O backfill e idempotente: rode a migracao inteira
de novo logo apos o deploy para fechar essa janela.

```
# conector Supabase (apply_migration) ou psql no projeto do DogData, em janela calma (o backfill le perfis e analytics_identity uma vez)
psql "$SUPABASE_DB_URL" -f supabase/migrations/035_referral_placar.sql
```

Depois: conferir `select count(*) from wallet_first_verify` (deve passar do numero de perfis) e chamar `GET /api/referral/board`.
