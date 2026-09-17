# Radiola × DogCity — player no canto do DogCity

O DogCity tem um mini-player no canto que toca as faixas **em trend do
radiola.music em ordem aleatória**. É só música. (Farmar a Rune RADIOLA fica pra
uma fase futura — o backend já está pronto e dormente; ver o fim deste doc.)

Feito no DogCity:
- Player nativo global (`components/radiola/radiola-player.tsx`), logo oficial do
  Radiola (`public/radiola-logo.png`), shuffle da fila (`use-radiola-audio.ts`).
- Catálogo/config em `lib/radiola/catalog.ts`.

## O que falta: a fonte real das faixas em trend

Hoje o player toca **samples de placeholder** — porque falta a lista real. Como
o Radiola funciona (levantado do código público deles):
- As faixas são **NFTs L2 da Kray** na coleção `radiola_music` (sub-coleções por
  artista `radiola-tracks-<12hex>`), servidas via o proxy do Radiola `/proxy/kray`
  → backend `kraywallet-backend.onrender.com`.
- Cada faixa tem `audio_url`, `cover`, `title`, `artist` na metadata. O player do
  Radiola normaliza exatamente esses campos.
- O "trending" é derivado do backend de escuta deles (`/api/listen/*`).

**Como o DogCity vai puxar isso** (uma destas, com o dono do Radiola):
1. **(Mais simples) Um GET público de trending.** O Radiola expõe algo como
   `GET https://www.radiola.music/api/tracks/trending` que devolve
   `[{ id, title, artist, cover, audio_url }]` **com CORS liberado pra
   dogdata.xyz**. O DogCity faz o fetch, embaralha e toca. (O áudio `<audio>`
   cross-origin toca sem CORS; o CORS só importa no fetch da LISTA.)
2. **(Sem mexer no Radiola) Proxy no DogCity.** O DogCity cria
   `GET /api/radiola/tracks` que busca a coleção `radiola_music` no backend Kray
   server-side (sem CORS) e normaliza pro shape acima. Preciso do endpoint/rota
   exata do backend que lista os NFTs dessa coleção com `audio_url`.
3. **(Provisório) Lista fixa.** O dono manda um JSON com as faixas em trend e a
   gente cola em `lib/radiola/catalog.ts` até (1) ou (2) existir.

> Tentei descobrir o endpoint exato de trending automaticamente, mas as travas de
> segurança bloquearam a sondagem do backend de terceiro — então preciso que o
> dono confirme a fonte (endpoint + CORS, ou a rota do backend, ou o JSON).

## Farm da Rune RADIOLA (fase futura, dormente)

Backend já pronto, sem UI: `app/api/radiola/{heartbeat,earnings,ledger}` +
`lib/radiola/ledger.ts` contam escuta verificada por endereço `bc1p` (Redis).
RADIOLA é **Rune L1**, então o DogCity só conta escuta; a distribuição do Rune é
do Radiola, lendo `GET /api/radiola/ledger`. Reativar é só religar a camada de
carteira no player. Enquadramento de marca: recompensa de escuta do Radiola
(parceiro), nunca "retorno do DogCity".
