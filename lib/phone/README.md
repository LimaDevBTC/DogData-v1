# lib/phone: DOG Phone, o app Mensagens do jogo (22/11/2026)

Conversa privada 1:1 em texto entre duas contas que se aceitaram. Contrato das rotas em `app/api/dogcity/phone/route.ts`.

- `rules.ts`: validação de entrada (handle exato, uuid, cid, texto de 1 a 500 caracteres) e a chave da cutucada.
- `service.ts`: recebe o endereço da SESSÃO, resolve a conta interna e chama as funções da migração 046.
- `http.ts`: mesma origem, freios, sessão e corpo injetados; só Request e Response da Web.
- `deps.ts`: os fios de verdade (Supabase service role, `dg_wallet`, Upstash).
- `sql-local.ts`: a 046 num Postgres em memória (PGlite), para o teste e para a prova do jogo.

As regras moram no SQL (`supabase/migrations/046_dogcity_phone.sql`, NÃO APLICADA), em funções atômicas com trava por conta:
antes do aceite não há envio; bloqueio desfaz o vínculo e impede pedido e mensagem; a busca não revela bloqueio nem carteira;
a identidade é o id interno, e o handle é lido de `dogcity_profiles` na hora (trocar o handle não perde conversa).

Tempo real: a resposta de envio e de aceite traz `nudge`, um HMAC do id de quem recebe. O jogo publica só essa chave no lobby do
multijogador; quem a reconhece busca o que é seu com o próprio cookie. Escutar o canal não dá acesso a nada.

Testes: `npx tsx --test lib/phone/phone.test.ts` e, com `PGLITE=<.../@electric-sql/pglite/dist/index.js>`,
`npx tsx --test lib/phone/phone.sql.test.ts` (12 ao todo; sem `PGLITE` os de SQL são pulados e não valem como aprovados).

Pendente: aplicar a 046; conta pelo X sem carteira (coluna `x_id` pronta, sem sessão); leitura das denúncias.
