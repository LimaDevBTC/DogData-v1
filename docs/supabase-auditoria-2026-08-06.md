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

## 4. ⚠️ O DogCity parou em 10 de julho

`dogcity_lots` (84.830 linhas), `dogcity_events` e `dogcity_cursors` não recebem
escrita desde **2026-07-10 21:29**, há 27 dias.

- Não existe cron do DogCity no `vercel.json`. Os cinco registrados são
  `update-transactions`, `dog-rune/holders`, `stacks/snapshot`, `whale-poster`
  e `health-probes`.
- `lib/city/registry.ts` é importado por **ele mesmo e pelo script de backfill,
  e por mais nada em `app/`**. É código morto em produção.

Ou seja: a cidade multichain viva foi construída, o backfill rodou uma vez, e a
ligação nunca foi feita. São ~62 MB de dados congelados servindo nada, e a
cidade que está no ar mostra o mundo de 10 de julho para sempre.

**Decisão do fundador**, e são só duas: ligar o cron horário que faltou, ou
derrubar as três tabelas. Manter como está é o único caminho que não faz
sentido.

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

## 7. O que ficou em aberto

| # | Pendência | Tipo |
|---|---|---|
| S1 | **Rodar a migração 003**, na ordem do cabeçalho, com `vacuum full` no fim | execução |
| S2 | **Decidir o DogCity**: ligar o cron horário ou derrubar as três tabelas | fundador |
| S3 | **Limitar a escrita por requisição de usuário** em `mempool` e `tenero` | fundador |
| S4 | **Paginar** o `.limit(10000)` da busca por endereço | execução |
| S5 | **Normalizar endereços** em `dog_transactions` com chave inteira | execução |

### Sobre S3, que é o que tem trade-off

Registrar por requisição dá 66 amostras/hora de um componente cuja barra tem
granularidade **diária**. A opção óbvia é limitar a uma observação por
componente a cada 5 minutos, o que derruba de 4.070 para ~1.800 linhas por dia.

O custo honesto: perde-se a falha isolada de uma única requisição. Em troca, o
uptime fica **mais** correto, não menos, porque hoje a amostragem é proporcional
ao tráfego e portanto enviesada para o horário de pico.

O que não fazer: amostrar só os sucessos e registrar todas as falhas. Parece
esperto e enviesa o uptime para baixo, porque passa a super-representar falha.
