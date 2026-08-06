# Auditoria do uso de Supabase, 2026-08-06

Levantado direto da API do projeto, não de suposição. Motivo: o uso estourou o
limite e havia a sensação de que a causa era algo que ninguém usa. As duas
coisas são verdade, e são problemas diferentes.

---

## 1. Inventário

Projeto `iqkoscgqpamorpxqygwo`, 12 tabelas.

| Tabela | Linhas | ~MB estimado | Última escrita |
|---|---|---|---|
| `dog_transactions` | 469.234 | ~880 | agora |
| `system_health_log` | 332.210 | ~119 | agora |
| `dogcity_lots` | 84.830 | ~62 | **2026-07-10** |
| `tx_class_block` | 80.741 | ~22 | via daemon local |
| `page_events` | 16.378 | ~7 | agora |
| `dogcity_events` | 192 | ~0 | **2026-07-10** |
| `dogcity_cursors` | 17 | ~0 | **2026-07-10** |
| resto | ~10.000 | ~5 | agora |

Estimativa de MB por amostragem da largura em JSON com fator 1,8 de sobrecarga
de linha e índice. O número exato sai de
`select pg_size_pretty(pg_database_size(current_database()));`

O plano Free entra em modo somente leitura acima de 500 MB. A escrita está
funcionando em tudo, o que indica plano pago.

## 2. ⚠️ O vazamento principal era egress, não armazenamento

`/api/status/full` montava a barra de uptime assim:

```js
const HARD_CAP = 100_000 // safety stop; today's table is ~7k rows / 90d
for (let from = 0; from < HARD_CAP; from += PAGE_SIZE) { ... }
```

Medido: a janela de 90 dias tem **309.069 linhas** e a tabela cresce **4.070 por
dia**. O comentário errou por 50x, com duas consequências.

**Custo.** Cada carregamento fazia até 100 consultas sequenciais e puxava algo
como 15 MB. A página se re-consulta a cada 30 segundos:

```js
setInterval(() => fetchStatus(true), 120_000)      // era 30_000
fetch("/api/status/full", { cache: "no-store" })   // ignorava o cache
'Cache-Control': 's-maxage=30'                     // expirava junto com a sondagem
```

O cache de 30 segundos vencia exatamente quando a próxima sondagem chegava,
então quase toda sondagem virava origin hit. Uma única aba aberta valia algo na
ordem de **1,8 GB por hora de egress**. O plano Free tem 5 GB por mês.

**Correção.** O teto de 100.000 cortava antes dos 90 dias. A barra dizia "90
dias" mostrando uns 24, sem avisar.

E nada daquelas linhas chegava ao cliente. Elas viravam quatro números por
componente: último estado, uptime de 30 dias, uptime de 90 dias e um balde por
dia. Tudo agregável no servidor, onde não custa egress.

### O ciclo vicioso

A rota também **escreve** a cada chamada (observações ao vivo e sondagens de
frescor). Então cada visualização engorda a tabela que a próxima visualização
tem que ler. Mais audiência, mais linhas, mais egress, indefinidamente.

## 3. ⚠️ 69% das escritas vêm de tráfego de usuário

Distribuição real em 24h:

| Componente | Linhas/24h | Por hora | Origem |
|---|---|---|---|
| `external:mempool` | 1.585 | 66 | `app/api/bitcoin`, uma linha por requisição |
| `external:tenero` | 1.235 | 51 | `lib/multichain/tenero`, idem |
| `cron:update-transactions` | 480 | 20 | cron de 3 em 3 min, bate certo |
| `external:twitter` | 288 | 12 | cron de 5 em 5 min |
| `cron:whale-poster` | 288 | 12 | cron de 5 em 5 min |
| `external:tenero:holder_stats` | 144 | 6 | cron de 10 em 10 min |
| `cron:stacks-snapshot` | 24 | 1 | horário |
| `cron:dog-rune-holders` | 24 | 1 | horário |

Os crons somam 816 por dia e são previsíveis. Os dois primeiros somam 2.820, ou
seja **69% do total**, e crescem com a audiência. Registrar uma observação de
saúde por requisição de usuário é amostragem muito mais fina do que a barra
diária consegue usar.

**Ainda não mexi nisto**, porque é uma decisão sobre fidelidade de observação e
não uma correção óbvia. Ver §7.

## 4. ⚠️ Existem dois mapas de lotes, e eles discordam

**Correção de uma conclusão errada minha.** Eu li "sem escrita há 27 dias" e
escrevi que o DogCity estava abandonado. Está errado: `dogcity_lots` é um
**registro de alocação permanente**, e ficar parado é o comportamento correto
de um registro permanente, não um defeito. Lote não muda, esse é o ponto dele.

O problema real é outro, e é bem mais sério.

### Os dois mapas

| | `dogcity_lots` (Supabase) | `data/foundation/lots.json` |
|---|---|---|
| gerado por | `scripts/dogcity_backfill.ts` | `scripts/foundation_generator.ts` |
| data | 2026-07-10 21:29 | 2026-07-10 18:02 |
| entradas | 84.830 (BTC + SOL + STX) | 84.639 (só BTC elegível) |
| ordenação | `age_days`, que **recalcula** a cada exportação | `ts` do bloco, **imutável** |
| núcleo cívico | não reserva | 200 slots reservados antes das carteiras |
| Reserva Urbana | não existe | 25 parcelas |
| Ring 0 Satoshi | não existe | 85 assentos |

### A comparação, em dez carteiras amostradas

```
distrito       json | supabase      x                    rua
               3    | 1             -242   |  1298.6     Runes Blvd / OG Row
               6    | 9             -817.1 |  3927.3     HODLer Ave / Micro Ave
               1    | 0             681.5  | -190        Leonidas Blvd / HODL Ave
```

**Zero de dez idênticos.** Os `height_tier` batem, porque derivam do saldo e as
duas fórmulas são a mesma. Distrito, coordenada e rua divergem em todas. E um
endereço presente no `lots.json` nem existe na tabela.

São duas cidades diferentes para as mesmas carteiras.

### Por que isso importa muito mais do que 62 MB

O `masterplan.md` é a constituição do mint, e a promessa central dele é que a
**posição do lote codifica procedência**, ordenada por idade de UTXO, e que o
lote é **permanente**. Se o mint resolver o lote pela tabela de hoje, cada
holder é congelado num mapa que:

- usa `age_days`, que muda conforme a data da exportação, e portanto não é
  reproduzível;
- não reserva o núcleo cívico, então uma carteira pode ter recebido um lote que
  o masterplan destina a prédio institucional;
- não tem Ring 0.

E permanência é uma via de mão única: **só dá para errar uma vez.**

### O que ainda falta antes de qualquer mint

O próprio `report.json` do gerador declara `dry_run: true` e lista o que não
está pronto. Duas coisas bloqueiam de verdade:

1. **Ring 0 é um proxy provisório** (os 85 `position_score` mais antigos). A
   coorte real, airdrop mais acumulação de 100x, exige um join com o conjunto
   comportamental que não está ligado no script.
2. **Núcleo cívico e Reserva Urbana são contagens de índice reservadas**, não
   uma implantação 3D com posição real.

Ou seja: **nenhum dos dois mapas está pronto para mintar contra.**

### A lógica recomendada

1. **Não derrubar nada.** Os 62 MB são irrelevantes e a tabela é o único
   registro de alocação que existe.
2. **Tratar `dogcity_lots` como registro de renderização**, que é o que ele de
   fato alimenta hoje. A cidade 3D pode continuar lendo dele.
3. **Não ligar o mint nele.** Nem `resolveAddresses`, nem `ensureLot`. Hoje
   nada em `app/` chama essas funções, e isso é sorte, não desenho: chamar
   `ensureLot` no fluxo de mint congelaria a pessoa no mapa superado.
4. **Fechar as duas ressalvas** do `report.json` e só então escrever a fundação
   **uma vez** numa tabela de gênese separada, que passa a ser a fonte do mint.
   Separada de propósito: o mapa de renderização pode ser regerado à vontade, o
   de gênese nunca mais pode mudar.

## 4b. `dog_transactions`: por que eu recomendo NÃO normalizar agora

A normalização (tabela de endereços com chave inteira, trocando strings de 42 a
62 bytes por `int4` em `senders`, `receivers` e `addresses`) economizaria algo
como 300 a 400 MB e encolheria muito o índice GIN.

**Mas a premissa mudou.** A auditoria começou porque o uso estourou, e a causa
foi identificada e corrigida: era **egress**, não bytes em disco. Com o log de
saúde podado e o laço da página de status fechado, o banco tem cerca de 1 GB
num plano que inclui 8 GB. Não existe pressão de armazenamento.

Contra isso, o custo da normalização é alto: é reescrever a tabela que serve o
explorer inteiro (busca por endereço, por txid, heatmap), com migração de dados,
janela de inconsistência e um índice GIN novo para validar. Risco alto,
benefício que hoje não compra nada.

**Recomendação: adiar.** Reabrir quando o banco passar de uns 4 GB, ou quando a
busca por endereço ficar lenta o suficiente para incomodar. Nenhuma das duas
está perto.

O que **de fato** valia a pena naquela rota era egress outra vez, e já foi
feito: `app/api/address/[address]/transactions` fazia `cache: 'no-store'` no
fetch interno para a rota pesada, anulando o `s-maxage=300` dela. Cada página de
cada caminhada de paginação repagava uma leitura de 10.000 linhas com `senders`
e `receivers`. É literalmente o mesmo erro da página de status, no mesmo
repositório, em dois lugares diferentes.

### ⚠️ E fica registrada uma aresta da mesma família

`app/api/address/bitcoin/[address]` usa `.limit(10000)` e depois fatia em
JavaScript. Um endereço com mais de 10.000 transações DOG é **truncado em
silêncio**, e o saldo reconciliado sai errado para ele, porque `indexedNet`
soma só o que veio. É o terceiro corte silencioso encontrado nesta auditoria,
depois do `HARD_CAP = 100_000` e do teto de 1.000 do PostgREST. Não corrigi
porque a correção certa é agregar no banco, e isso precisa de DDL.

## 5. `dog_transactions`, a maior tabela

Ela **é** usada (busca por endereço, por txid, heatmap), então não é desperdício.
Mas a linha de ~1 KB tem gordura estrutural:

```
receivers   320 bytes   "[{\"address\": \"bc1q...\", \"amount\": ...}]"   JSON como TEXTO
addresses   178 bytes   ["bc1q...", "bc1p..."]                            derivável
senders     151 bytes   "[{\"address\": \"bc1p...\", ...}]"               JSON como TEXTO
```

- `addresses` é a união dos endereços de `senders` e `receivers`, denormalizada
  na migração 001 para servir `.contains('addresses', [addr])`. São ~83 MB de
  duplicação, mais um índice GIN sobre `text[]`, que nessa escala é caro.
- `senders` e `receivers` são **texto com JSON escapado**, não `jsonb`. O
  escape é puro desperdício e impede consultar por dentro.

Caminho de maior ganho, se virar prioridade: uma tabela de endereços com chave
inteira, trocando cada string de 42 a 62 bytes por um `int4`. Encolhe as três
colunas de uma vez e o índice GIN passa a ser sobre `int[]`, que é bem mais
compacto. É refatoração de verdade, não ajuste.

Aresta relacionada: `app/api/address/bitcoin/[address]/route.ts` usa
`.limit(10000)` trazendo `senders` e `receivers`. Num endereço movimentado isso
é uns 4,7 MB por requisição.

## 6. O que já foi feito

### Migração `003_health_rollup.sql`, **precisa ser rodada à mão**

Separa log bruto de rollup, porque podar sozinho não resolvia: sustentar a barra
de 90 dias exigia guardar 90 dias de linha bruta, o que estabiliza em ~366.000
linhas.

| | papel | tamanho em regime |
|---|---|---|
| `system_health_log` | detalhe recente, 14 dias | ~57.000 linhas |
| `system_health_daily` | um balde por componente por dia, para sempre | ~10.000 linhas/ano |

Também cria o índice `(component, checked_at DESC)`, que não existia, e
`health_maintain()`, que faz rollup e poda na ordem certa.

**A ordem de aplicação está no cabeçalho do arquivo e importa**: o backfill do
rollup (`select health_rollup(400)`) tem que rodar e ser conferido **antes** da
primeira poda, senão a barra de 90 dias perde histórico de forma irreversível.

### Código, já aplicado

| Arquivo | Mudança |
|---|---|
| `app/api/status/full/route.ts` | usa `health_daily` e `health_latest`; recuo para leitura bruta com teto de 10.000 (era 100.000) se a migração ainda não rodou; cache de 30s para 150s |
| `app/status/page.tsx` | sondagem de 30s para 120s; `no-store` só no botão de atualizar, não na sondagem nem na primeira pintura |
| `app/cron/health-probes/route.ts` | chama `health_maintain()` a cada 10 min, tolerando a ausência da migração |

O rollup diário pessimista foi preservado exatamente: qualquer `down` pinta o
dia de vermelho, depois qualquer `degraded`, senão verde, e dia vazio fica
cinza. A única diferença é que a janela de 30 dias passou a ser comparada por
chave de dia em vez de timestamp exato, então o dia da fronteira entra inteiro.

Efeito esperado no egress da página de status:

| | consultas por hit | linhas por hit | origin hits/hora |
|---|---|---|---|
| antes | até 100 | 100.000 | ~120 por aba aberta |
| agora, sem a migração | até 10 | 10.000 | ~24, independente de abas |
| depois da migração | 2 | ~2.500 | ~24 |

## 6b. Executado em 06/08, e o que a execução revelou

A migração foi aplicada e o rollup rodou. Números reais:

| | antes | depois |
|---|---|---|
| `system_health_log` | 332.351 linhas | **54.073** |
| linhas removidas | | 278.279 |
| `system_health_daily` | não existia | 1.120 baldes, 15 componentes |
| leitura da barra de 90 dias | 309.069 linhas | **1.025** |

Verificação antes de podar, alinhada por dia sobre exatamente o recorte que
seria apagado: **275.001 linhas brutas antigas contra 275.001 no rollup.**
Bateu exato, e só por isso a poda foi executada.

Fica registrado que comparar `sum(total)` do rollup contra `count(*)` do log
bruto **nunca fecha em zero**: o log recebe cerca de 3 escritas por minuto, então
sobra sempre a diferença do que entrou depois do rollup. O teste certo é o
recorte antigo, não o total.

### ⚠️ Duas coisas que a execução descobriu

**1. PostgREST não pagina RPC.** `health_daily(90)` devolve 1.025 baldes, e pelo
PostgREST vinham 1.000: o teto `max-rows` corta calado, e `Range` **não** é
honrado em POST de função (pedir 1000-1999 devolve as mesmas 1.000 primeiras,
verificado). Eu tinha trocado um corte silencioso de 100.000 por outro de 1.000.
Corrigido lendo a **tabela** `system_health_daily` com Range paginado, onde a
paginação funciona (1000 + 25 = 1025), com quebra por página curta para que o
bug não volte quando o catálogo de componentes crescer.

**2. A página de status estava quebrada desde 28 de julho.** A cobertura por
componente entrega isso sozinha:

```
cron:*  e  external:*     91 dias   ate 2026-08-06
data:*  e  infra:*        48 dias   ate 2026-07-28
```

Os seis que pararam são exatamente os que `/api/status/full` escreve
(`infra:redis`, `infra:supabase`, `infra:dog-scanner`, `data:transactions`,
`data:holders`, `data:stacks-history`). Os que os crons escrevem seguiram
normais. A rota deixou de completar quando a tabela passou do que dava para
paginar dentro do tempo da função. Depois da poda ela voltou a responder em
2,1s, o que confirma o diagnóstico: era volume, não lógica.

Ou seja, aquele `HARD_CAP = 100_000` mal calibrado não custava só egress. Ele
derrubou metade da observabilidade por nove dias, sem alarme, porque o
componente que deveria avisar era um dos que pararam de ser gravados.

### Regressão temporária, assumida

A poda rodou **antes** de o código que lê o rollup estar implantado, o que é a
ordem errada. Enquanto o deploy não sai, a produção lê os 14 dias de bruto que
sobraram e a barra de 90 dias mostra 14. Não há perda de dado: o rollup tem os
91 dias. Resolve no próximo commit do bot.

## 7. O que ficou em aberto

| # | Pendência | Tipo | Estado |
|---|---|---|---|
| S1 | Migração 003, backfill, poda e `vacuum full` | execução | **feito em 06/08** |
| S2 | ~~Decidir o DogCity~~ | | **substituída por S6 e S7**, ver §4 |
| S3 | **Limitar a escrita por requisição de usuário** em `mempool` e `tenero` | fundador | aberto |
| S4 | ~~Paginar a busca por endereço~~ | execução | **cache corrigido**, ver §4b |
| S5 | **Normalizar endereços** em `dog_transactions` | execução | **adiado por recomendação**, ver §4b |
| S6 | **Fechar as duas ressalvas** do `report.json`: coorte real do Ring 0 e implantação 3D do núcleo cívico | fundador | bloqueia o mint |
| S7 | **Tabela de gênese separada**, escrita uma vez a partir da fundação final | execução | depende de S6 |
| S8 | **Não ligar o mint em `resolveAddresses` nem `ensureLot`** até S7 existir | regra | vigente |
| S9 | `.limit(10000)` trunca em silêncio endereços com mais de 10.000 transações, e o saldo reconciliado sai errado para eles | execução | precisa de DDL |

## 8. ⚠️ Segurança: a chave anônima podia apagar o explorer

Levantado a partir dos alertas do painel Advisors, e medido, não deduzido.

### O que foi testado

Com a **chave anônima** e mais nada, usando filtro `id=eq.-1` que não casa com
nenhuma linha, portanto zero linhas afetadas em qualquer cenário:

```
DELETE /rest/v1/dog_transactions   ->  HTTP 204
PATCH  /rest/v1/dog_transactions   ->  HTTP 204
PATCH  /rest/v1/page_events        ->  HTTP 204
```

Nove tabelas aceitam escrita anônima: `dog_transactions`, `page_events`,
`ad_events`, `dog_metrics_history`, `stacks_metrics_history`, `tx_class_block`,
`tx_class_daily`, `dogcity_events`, `dogcity_cursors`.

Ou seja, quem tiver a chave anônima apaga as **469.234 linhas** que são a fonte
de verdade do explorer, num comando.

Três tabelas já estavam protegidas e serviram de controle: `dogcity_lots`,
`system_health_log` e `system_health_daily` devolvem zero linhas para a anon.

### O que reduz a urgência

- A chave anônima é **só de servidor**. Sem prefixo `NEXT_PUBLIC_`, e nenhum
  componente cliente cria client Supabase, então ela não vai para o navegador.
- `.env` e `.env.local` **não estão versionados** e o `.gitignore` cobre. A
  busca no HEAD não encontrou a chave.

⚠️ Ressalva honesta: a varredura do histórico completo de commits estourou o
tempo. Confirmei o HEAD, não todos os commits antigos.

### O que aumenta

Chave anônima é feita para ser publicável, e basta um vazamento para a perda ser
total e imediata. `mcp-server/index.ts` documenta `SUPABASE_ANON_KEY` como
variável aceita, e esse servidor roda fora daqui.

### Um achado lateral: `api_keys` não existe

`middleware/auth.ts` e `app/api/keys/generate` consultam `public.api_keys`, e a
tabela **não existe** (`PGRST205`, inclusive para a service role). A
autenticação por chave de API está quebrada. Não é buraco de segurança, porque
não há o que roubar, mas é uma funcionalidade morta que se anuncia viva.

### A correção, e a ordem importa

Nada no app precisa de acesso anônimo: tudo roda em rota de servidor, e a
service role ignora RLS. Então a postura correta é a mais simples, **RLS ligado
e zero policies**, deixando o papel anon sem nada.

**Passo 1, já feito em código.** `lib/supabase.ts` passou a usar
`SERVICE_ROLE || ANON` em vez de só anon. Ele é importado por oito rotas, e
várias **escrevem** (`analytics/track`, `ads/track`), o que era exatamente o
motivo de a anon precisar de escrita. As duas rotas de métricas que usavam só a
anon foram junto.

Confirmado que nada mais depende da anon: os scripts Python
(`dog_block_scanner.py`, `tx_class_writer.py`) já preferem a service role, e o
`mcp-server` não fala com o Supabase, só menciona a variável num comentário.

**Passo 2, `004_rls_lockdown.sql`.** Só depois que o passo 1 estiver implantado.
Rodar antes derruba o rastreamento na hora.

### O que aconteceu de fato ao aplicar, e a lição

**A 004 entrou antes do deploy do passo 1.** Eu escrevi o aviso no cabeçalho mas
não conferi se o commit tinha saído. Resultado imediato em produção:

```
/api/analytics/report  ->  pageviews: 0     com 16.378 linhas na tabela
/api/ads/report        ->  impressions: 0   com  3.782 linhas na tabela
```

É a segunda vez nesta auditoria que o mesmo erro de sequenciamento aparece: a
poda do log de saúde também rodou antes do código que lê o rollup. **Escrever a
pré-condição no cabeçalho não é conferir a pré-condição.** A 005 passou a trazer
o comando de verificação junto, não só o aviso.

### Resultado da 004, medido

Nove das doze fecharam. Três não: `dog_transactions`, `tx_class_block` e
`tx_class_daily` já tinham **policies permissivas criadas fora deste
repositório**, dormentes enquanto o RLS estava desligado, que acordaram junto
com ele.

Teste usado, que não grava nada em nenhum desfecho: inserir com a chave anon uma
linha que já existe. `42501` significa que o RLS barrou; `23505` significa que a
escrita passou e só a chave duplicada impediu.

**Passo 3, `005_drop_permissive_policies.sql`.** Dropa essas policies por
varredura, porque os nomes não estão versionados em lugar nenhum. Mesma
pré-condição de deploy, agora com o comando de conferência no cabeçalho.

### ⚠️ O bloqueio de DDL

A partir daqui quase tudo que sobra (S5, S7, S9) precisa de `CREATE`, `ALTER` ou
função nova. Pelo PostgREST, com a service role, dá para **ler, escrever e
chamar função existente**, mas **não** para criar nada. E o SQL Editor no
celular é hostil o suficiente para ter apagado 450 linhas num toque acidental.

O caminho que resolve isso de uma vez é um **Personal Access Token** do Supabase
(Dashboard, ícone da conta, Access Tokens, Generate). Com ele a API de
gerenciamento aceita SQL arbitrário e o SQL Editor deixa de ser necessário para
sempre.

Ressalva honesta: um PAT dá acesso administrativo à conta inteira, bem mais que
a service role. Ele é revogável na mesma tela, então o desenho seguro é gerar,
usar para a migração, revogar, e gerar de novo quando precisar.

### Sobre S3, que é o que tem trade-off

Registrar por requisição dá 66 amostras/hora de um componente cuja barra tem
granularidade **diária**. A opção óbvia é limitar a uma observação por
componente a cada 5 minutos, o que derruba de 4.070 para ~1.800 linhas por dia.

O custo honesto: perde-se a falha isolada de uma única requisição. Em troca, o
uptime fica **mais** correto, não menos, porque hoje a amostragem é proporcional
ao tráfego e portanto enviesada para o horário de pico.

O que não fazer: amostrar só os sucessos e registrar todas as falhas. Parece
esperto e enviesa o uptime para baixo, porque passa a super-representar falha.
