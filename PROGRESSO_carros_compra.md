# Compra dos carros da DOG MOTORS (backend no DogData)

Branch `claude/carros-compra`, de `origin/main` em `9b5d083121` (buscado por HTTPS). Worktree `DogData-v1-carros`; `node_modules` é link para o da árvore principal (não entra em commit).
Regras desta frente: migration só como arquivo (quem aplica é o fundador), nada de deploy, nenhuma variável criada na Vercel (só lidas), PR sem merge.
Dinheiro de verdade: falha fechada, teto absoluto em todo valor, nenhum número do cliente é confiado, NaN/Infinity/negativo conferidos, um teste por ataque.

## O que foi feito

- [C1] `supabase/migrations/039_dogcity_cars.sql` (NÃO aplicada; numerada depois da 038 da corrida, PR #61): `car_models` (18 modelos, preço em $DOG PROVISÓRIO, `active`), `car_orders` (imutável: modelo, carteira ordinals, moeda, endereço pagador, `pay_to`, sats ou `dog_exact_atoms`, cotações, prazo), `car_payments` (chave moeda + txid + vout; observed / credited / unmatched / pending_review; creditado imutável e só a função cria crédito), `car_ownership` (UM modelo por carteira, origem purchase | prize, `ref` única). Funções `dogcity_car_credit` (pagamento creditado + posse numa transação só, confere de novo moeda, pagador e valor, trava por carteira + modelo), `dogcity_car_owned`, `dogcity_cars_of`, `dogcity_car_prize_owned` (lê `race_prizes` approved/delivered da 038 quando a tabela existe). RLS ligada, zero policies, revoke anon/authenticated, execute só para service_role.
- [C2] `lib/game/cars/`: `catalog.ts` (os 18 ids e nomes de `tipos_carro.ts`, preços marcadores, `PRECOS_PROVISORIOS = true`, tetos), `config.ts` (loja aberta só com `CAR_FUND_BTC_ADDRESS` e `CAR_FUND_DOG_ADDRESS` válidos, diferentes do fundo da licença, e preços confirmados), `order.ts` (cotação + pedido), `payment.ts` (casamento puro), `sweep.ts` (leitura do BTC no mempool.space e do $DOG em `dog_transactions`, varredura), `supabase.ts` (stores e garagem).
- [C3] Rotas: `GET/POST /api/dogcity/car-quote`, `GET /api/dogcity/cars?address=`, `GET /api/cron/car-pay`.
- [C4] `lib/game/cars/cars.test.ts`: 31 testes (`npx tsx --test lib/game/cars/cars.test.ts`).

## Decisões (uma por linha)

- [D1] Rota IRMÃ: nenhuma tabela da licença é lida ou escrita; funções puras da licença reaproveitadas só por import (`satsForDog`, `normalizeAddress`, mediana de `price-sources.ts`, `BTC_MIN_CONFIRMATIONS`). Um teste tranca o isolamento nos dois sentidos.
- [D2] Endereços próprios do carro; a loja recusa endereço igual ao `FUND_BTC_ADDRESS` ou `FUND_DOG_ADDRESS` da licença (`licence_address`). Assim o carro nunca entra no placar, no livro dos founders nem no gatilho dos 10M. O BTC e o $DOG do carro podem ser o mesmo endereço (as linhas não colidem: a chave tem a moeda).
- [D3] Preços PROVISÓRIOS fecham a loja: com `PRECOS_PROVISORIOS = true` toda rota de compra responde 503 `sales_closed`, mesmo com as variáveis criadas. Carro não se vende por preço marcador.
- [D4] O preço só vale quando o catálogo do código e `car_models` dão o MESMO número e o modelo está ativo (um teste tranca que o seed da 039 é igual ao código). Mudar preço = mudar os dois.
- [D5] Dono = carteira da SESSÃO (`dg_wallet`, o endereço ordinals que assinou). O corpo do POST não nomeia dono; campos extras são ignorados.
- [D6] BTC: sats pela mediana (mesma régua da licença), trava de 15 min, pagamento tem de sair do endereço pagador do pedido e cobrir os sats. Pago depois da trava vai para `pending_review` (`order_expired`), nunca credita à taxa velha nem à do bloco (diferente da licença: carro é item, não degrau).
- [D7] $DOG: valor EXATO = preço + sufixo de 1 a 99.999 átomos (menos de 1 $DOG), sorteado com `crypto.randomInt` e único enquanto um pagamento ainda pode casar. Casa pelo remetente E pelo valor exato, átomos INTEIROS do índice (`amount`, nunca o float `amount_dog`), consumido por txid + vout do receptor. Prazo de 60 min para enviar, folga de 6 h para o bloco; depois, revisão por 7 dias. Pagador padrão = a própria carteira (as runas moram no endereço ordinals).
- [D8] Confirmações: 6 (a regra do B). BTC pela ponta do mempool.space; $DOG pela ponta do próprio índice (o scanner nunca está à frente da rede).
- [D9] Fora de par vai para `pending_review` com o motivo: underpaid, overpaid (mais que 2x), amount_mismatch (a menor, a maior, sem sufixo), payer_mismatch (valor certo de outro endereço), order_expired, ambiguous_owner (pagador ligado a duas carteiras), ambiguous_order, above_ceiling, invalid_amount, already_owned, order_already_paid. Fundo como pagador e poeira: `unmatched`.
- [D10] Um modelo por carteira: 409 `already_owned` na cotação; na varredura, pagar de novo um modelo que já tem (compra ou prêmio approved/delivered da corrida) vai para revisão (devolução humana). `car_ownership` tem `unique (wallet, model)` e a função trava por carteira + modelo.
- [D11] Tetos: preço 1.000 a 5.000.000 $DOG; pedido e pagamento BTC até 50.000.000 sats (0,5 BTC); $DOG até o maior valor exato possível; 10 pedidos por carteira e 10 por pagador por hora; 60 por IP por hora (freio Redis); corpo até 2 KB; prazo de 10 s nas rotas.
- [D12] A primeira vista da rede (mempool.space `transaction-times`) é pedida para TODOS os pagamentos BTC lidos, não só os da mempool: um pagamento que a varredura só viu já confirmado (cron parado) não parece posterior a um pedido criado depois dele.
- [D13] Leitura do $DOG das mais novas para as mais antigas, teto de 2.000 linhas: poeira mandada ao endereço não trava a loja; o que não foi lido nunca vira carro.
- [D14] O cron NÃO foi posto no `vercel.json`: ligar é do fundador. Com a loja fechada ele responde 200 `sales_closed` e não lê rede nem banco.

## Contrato para o jogo

- Vitrine: `GET /api/dogcity/car-quote` -> `{ models: [{ id, name, class, priceDog, available, sats }], dogUsd, btcUsd, sources, asOf, lockMinutes }` (sats null sem cotação confiável; em $DOG ainda se compra).
- Comprar: `POST /api/dogcity/car-quote` com cookie `dg_wallet`, corpo `{ model, currency: 'btc' | 'dog', paymentAddress? }` (BTC exige `paymentAddress`). Resposta: `{ id, model, name, currency, priceDog, payTo, payerAddress, expiresAt, serverTime }` + BTC `{ sats, dogUsd, btcUsd, sources }` ou $DOG `{ dogExact: "20000.04217", dogExactAtoms }`. Erros: 401 unauthenticated, 400 por campo, 409 already_owned / model_not_for_sale, 429, 503 sales_closed / model_unavailable / no reliable quote right now.
- Garagem: `GET /api/dogcity/cars?address=<ordinals>` -> `{ address, cars: [{ model, name, source: 'purchase' | 'prize', since }] }`, CORS aberto, `s-maxage=15`. 503 = não afirme nada.
- O carro aparece na garagem depois de 6 confirmações e da volta seguinte do cron (2 min).

## Provas

- 31 testes verdes (`npx tsx --test lib/game/cars/cars.test.ts`), um por ataque: pagamento a menor, cotação vencida (BTC e $DOG), txid repetido, endereço pagador trocado (e pedido com o pagador de outra pessoa), valor $DOG sem sufixo, NaN/Infinity/negativo, teto. `npx tsc --noEmit` verde.
- Migration 039 em PGlite (Postgres de verdade em WASM, fora do repo, nada versionado), sem e com a 038: roda 2x; checks do pedido (sem sufixo, sufixo >= 1 $DOG, teto de sats, preço negativo, prazo de 3 h, modelo fora do catálogo); pedido imutável; crédito direto recusado em `car_payments` e `car_ownership`; função recusa a menor, pagador trocado, moeda trocada, acima do teto, $DOG sem sufixo; idempotente no mesmo txid; segundo pagamento do mesmo modelo vira `already_owned`; prêmio pending_review não é posse, approved é; garagem com compra + prêmio; anon sem grant e sem execute; RLS ligada e zero policies; o caminho manual de resolução (bandeira só dentro da transação).
- Ponta a ponta em PGlite com o `supabase.ts` de verdade (shim do subconjunto do supabase-js): pedido BTC e $DOG gravados, preço divergente no banco = 503, varredura credita os dois, volta repetida pula, garagem certa, 409 depois, segundo pagamento em revisão.
- `next dev` em porta alta (Supabase e Redis fora de propósito): car-quote GET/POST 503 `sales_closed` sem variáveis, com endereço da licença (`licence_address`) e com preços provisórios (`provisional_prices`); cars 400 sem endereço e torto, 503 com o banco fora (CORS e cache certos), OPTIONS 204; cron 401 sem segredo e 200 `sales_closed` com segredo.
- NÃO provado: PostgREST de verdade (nenhuma migration aplicada em banco nenhum), mempool.space ao vivo, pagamento real na mainnet.

## O que o fundador faz

1. Decidir os preços reais: trocar os `priceDog` em `lib/game/cars/catalog.ts`, pôr `PRECOS_PROVISORIOS = false`, e gravar os MESMOS números em `car_models` (`update public.car_models set price_dog = <preço>, updated_at = now() where id = '<modelo>';`). Desligar um modelo: `active = false`.
2. Criar dois endereços novos (de uma carteira que só o fundador controla) e as variáveis `CAR_FUND_BTC_ADDRESS` e `CAR_FUND_DOG_ADDRESS` na Vercel (Production). Não podem ser os endereços do fundo da licença.
3. Aplicar a 039 (de preferência depois da 038; funciona sem ela) ANTES de criar as variáveis.
4. Ligar o cron: acrescentar em `vercel.json` -> `crons`: `{ "path": "/api/cron/car-pay", "schedule": "*/2 * * * *" }` (usa o mesmo `CRON_SECRET`).
5. Revisar `car_payments` em `pending_review` (devolver na cadeia, ou dar o carro pelo bloco SQL do cabeçalho da 039).

## Riscos

- Preços e endereços são decisões do fundador; enquanto não houver as duas coisas a loja fica fechada (de propósito).
- O $DOG depende do scanner (`dog_transactions`): scanner parado = carro em $DOG não credita (falha fechada, nunca carro errado). Receptor sem `vout` ou sem átomos inteiros não vira pagamento.
- Pagamento em BTC visto pela primeira vez já confirmado e sem a primeira vista do mempool.space pode casar com pedido criado até 2 h depois do bloco (folga do horário de bloco); exige o mesmo pagador e o valor que cobre o pedido.
- Prêmio da corrida dado DEPOIS de uma compra do mesmo modelo: a 038 não confere `car_ownership`; a garagem mostra um carro só (a compra), mas o prêmio fica registrado. Conferir no fechamento do campeonato.
- A 038 e a 039 citam `race_prizes`; a 039 usa SQL dinâmico e não quebra sem a 038.
