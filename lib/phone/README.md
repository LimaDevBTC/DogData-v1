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

## Ligações, Mural e Runes (migração 047, NÃO APLICADA)

- `extra.ts` e as rotas `/api/dogcity/phone/calls` e `/wall`: mesma regra da casa (a conta vem da sessão, as regras moram no SQL).
- Ligações: o servidor só guarda a sinalização do WebRTC (uma oferta e uma resposta por chamada, apagadas no fim) e decide quem
  liga para quem (amigos, sem bloqueio; não perturbe e silêncio não tocam e não são revelados a quem liga; ocupado). O áudio é
  ponta a ponta. TURN opcional por `PHONE_TURN_URLS`, `PHONE_TURN_USERNAME`, `PHONE_TURN_CREDENTIAL`.
- Mural: posts de texto, curtida, denúncia e apagar o próprio; bloqueio some com os posts nos dois sentidos.
- `/api/dogcity/phone/runes`: as cinco runes do app (ids fixos) no endereço da sessão, pela UniSat. NÃO testada contra a UniSat.
- Testes: `PGLITE=... npx tsx --test lib/phone/extra.sql.test.ts` (5, com três contas).

## Fotos da Câmera (migração 048)

A Câmera do DOG Phone tira fotos de quadros do jogo (frente e selfie do $DOG). O registro fica em `dogcity_phone_photo`;
o arquivo, num bucket **privado** do Supabase Storage, escrito e lido só pelo servidor.

- **Antes de publicar:** aplicar a 048 e criar o bucket `dogcity-phone-photos` no painel do Supabase (privado, sem política
  pública). Sem o bucket, guardar responde 503 e o jogo mantém a foto só no aparelho; o resto do celular não depende dele.
- Rotas: `GET /api/dogcity/phone/photos` (a galeria da conta), `POST` com `image/jpeg` no corpo (`?kind=front|selfie`) guarda,
  `POST` JSON `{ action: "delete", id }` apaga, `GET /api/dogcity/phone/photos/<id>` devolve o arquivo à dona, ou a qualquer conta do celular quando a foto está num post vivo do Social City (sem bloqueio entre as duas).
- O servidor não confia no arquivo (`lib/phone/fotos.ts`): confere a estrutura do JPEG, as medidas (64 a 1600 px) e o
  tamanho (até 600 KB), remove todo metadado (EXIF, XMP, ICC, comentários) e só então grava. Tetos: 60 fotos por dia e 300
  guardadas por conta; uma a cada 2 s.
- A foto pode ir num post do Social City (a 048 acrescenta `photo` ao post). Enviar por mensagem ainda não existe.
- Testes: `PGLITE=... npx tsx --test lib/phone/fotos.sql.test.ts` (2).


## Acesso às tabelas e funções (revisão de 26/11/2026)

O fim de cada migração (046, 047, 048) tira de `anon`, `authenticated` e `public` todo acesso às tabelas e funções `dogcity_phone_*` e dá `execute` só ao `service_role` (como 044/045). O bloco só age quando os papéis do Supabase existem; no PGlite dos testes não faz nada.

## Como aplicar

1. No SQL Editor do Supabase de produção (como as 040 a 045; não há `supabase/config.toml`), rodar `046`, depois `047`, depois `048`, nessa ordem, cada uma numa execução. Todas são aditivas e idempotentes (`if not exists`); a única linha que toca tabela existente é a coluna `avatar_inscription_id` em `dogcity_profiles`, que já existe em produção.
2. Storage > New bucket: nome `dogcity-phone-photos`, **Public bucket desligado**, sem política.
3. Publicar este repositório (merge do #97 em `main`). Antes disso as rotas respondem 503 `not_open`, sem quebrar nada.
4. Só depois publicar o jogo.
