# Painel de operação — DogData

Sala fechada onde o fundador e o Vava acompanham a operação inteira do DogData
e da DogCity. Não é uma página nova de números: é a casca que reúne o que já
existe, fecha o que hoje está aberto, e põe uma camada que lê os números por nós.

Escopo: DogData e DogCity. OrdCards fica de fora, é outro produto e outro repo.

## Por que existe

Hoje a operação se acompanha em sete lugares: `/analytics/dashboard`, `/status`,
`journalctl`, `logs/*.log`, o painel da Vercel, o do Supabase e o do Upstash.
Nenhum deles sabe do outro. Quando algo quebra, a descoberta é por acaso.

## Regra de ouro

**A Vercel não alcança esta máquina.** bitcoind, dog-scanner, tx-class-scanner,
dog-mempool e os quatro crons do `crontab` rodam em casa. Então a máquina bate
ponto em `system_health_log`, e o painel LÊ. Nunca o contrário. Um mostrador que
diga "de pé" sem batimento fresco está mentindo, e é assim que painel de operação
perde a confiança de quem olha.

---

## Bloco A — o portão  (o urgente)

Hoje `/analytics/dashboard` é secreto por não estar linkado, e
`/api/analytics/report` responde para qualquer um. O repo é PÚBLICO: o caminho
não é segredo. Isto é o que existe hoje, não uma hipótese.

- `lib/admin/gate.ts`: `getAdmin(req)` = sessão `dg_wallet` já provada
  (BIP-322/ECDSA/Schnorr em `lib/wallet/verify.ts`) + endereço na allowlist
  `ADMIN_ADDRESSES`. Sem tabela nova, sem senha nova.
- A allowlist é ENV na Vercel, nunca commitada. O repo é público.
- `app/admin/layout.tsx`: gate no servidor. Quem não é admin recebe 404, não 403.
  403 confirma que a sala existe.
- Toda rota sob `/api/admin/*` chama o mesmo gate. O gate da página não protege a API.
- `/analytics/dashboard` migra para `/admin/analytics`, e `/api/analytics/report`
  passa a exigir admin. `/api/analytics/track` continua aberta: é o coletor.

## Bloco B — saúde da máquina

- `scripts/heartbeat.py` (systemd timer, 1 min): estado de cada unit, atraso do
  último bloco lido por cada scanner, altura do bitcoind contra a rede, espaço em
  disco, PSI de memória (o `systemd-oomd` já matou o gnome-shell uma vez),
  idade do último sucesso de cada cron do `crontab`. Uma linha por componente
  em `system_health_log`.
- O painel marca componente sem batimento dentro de `expected_interval_minutes`
  como `down`. Silêncio é falha, não é "ok".
- Vercel: crons, último deploy, erros de runtime. Supabase: IO e tamanho das
  tabelas grandes (o incidente de 26/08 nasceu de IO esgotado por backfill).

## Bloco C — funil de marketing

Estender o `analytics_funnel` que já existe para o arco inteiro, com o número
de gente em cada degrau e a queda entre eles:

  visita → landing /dogcity → conecta carteira → cria perfil (@handle)
        → entra na cidade → doa → passa de 10k

Por origem (utm, referrer, campanha de `ad_events`) e por período. A pergunta que
o painel tem que responder sem ajuda: **qual degrau está vazando e de onde vinha
quem vazou.**

## Bloco D — a cadeia e a cidade

Uma aba por assunto, tudo já servido por rota existente:
mempool DOG, alertas de baleia, deltas do top 20, rótulos novos, holders
entrando e saindo, lotes da cidade, chat da praça, carteiras conectadas,
chaves de API emitidas (`/api/keys/generate` hoje emite sem verificar nada).

## Bloco E — a camada que lê por nós

1. **Leitura por bloco.** Cada mostrador vem com uma frase gerada sobre os números
   do momento, e um aviso quando algo saiu da faixa. O que é "faixa" se MEDE de
   uma amostra do histórico, não se chuta: um limiar chutado ou dispara toda hora
   ou nunca dispara.
2. **Caixa de pergunta.** "Por que o tráfego caiu ontem" consulta as rotas internas
   e responde com número e link. O `/mcp` já expõe a casa inteira em ferramenta:
   a caixa fala com ele, em vez de ganhar um segundo caminho para os mesmos dados.

Ordem: A → B → C → E1 → D → E2. O portão primeiro porque é o único bloco que
conserta um buraco que já está aberto.
