# Plano: o analytics da DogCity

Escrito em 23/10/2026, a pedido do fundador. Hoje a DogData tem um painel de analytics completo, com 7 abas e banco no Supabase (`page_events`, mais as tabelas `analytics_*`). A DogCity não tem painel próprio: o que ela gera cai no mesmo banco, espalhado. Este plano junta landing, jogo e mint num funil só e prepara a medição fina da cidade.

## O estado em 23/10

| Peça | Mede? | Como aparece no banco |
|---|---|---|
| Jogo (play.dogcity.space) | sim, e bem | página `/city`, cerca de 20 eventos: `find_my_lot`, `deed_open`, `car_enter`, `wallet_connected`, prédios visitados, desempenho (`jogo_resumo`, `jogo_trava`, `jogo_gpu_perdida`) |
| Landing (dogcity.space) | sim, mas misturada | gravava `/`, a mesma linha da home da DogData. Corrigido no PR #36: passa a ser `/dogcity` |
| Mint (mint.dogcity.space) | não media nada | PR #14 do dogcity-mint: `/mint/*` e o funil `mint_*` |
| Painel | só a DogData | nenhuma aba da DogCity |

**Os dados estão inteiros.** São 923 mil eventos desde 04/07. A queda do Redis em 23/10 não tocou no analytics, que mora no Supabase.

**O painel não mostra 90 dias por lentidão, não por perda.** Tempo de cada consulta medido no banco em 23/10:

| Consulta | 30 dias | 90 dias |
|---|---|---|
| `analytics_behavior` | 0,4 s | 41 s |
| `analytics_traffic` | 1,6 s | 8,7 s |
| `analytics_vitals` | 1,6 s | 5,5 s |
| `analytics_funnel` | 0,5 s | 1,0 s |
| `analytics_direto` | 0,1 s | 0,1 s |

## Fase 1 · O painel rápido em qualquer período

Cada consulta lê o evento cru, linha a linha. Com 90 dias já são quase um milhão de linhas.

- **Tabela de resumo diário** `analytics_daily`: uma linha por dia × página × dispositivo × país × canal, com visitantes, sessões, pageviews, engajamento medido e sessões medidas. Para Web Vitals, a mesma ideia com percentis por dia.
- **Atualização:** um cron de hora em hora reescreve só o dia corrente e o anterior. Os dias fechados não mudam. Os dias antigos entram uma vez, por backfill.
- **As consultas** leem o resumo para os dias fechados e o cru só para hoje. A meta é 90 e 365 dias abaixo de 1 s.
- **As regras de hoje continuam:** robô marcado e nunca apagado; duração só de sessão medida (`engaged_ms IS NOT NULL`); `/analytics` fora da conta.

## Fase 2 · A aba DogCity (landing, mint e jogo num funil)

- **O funil:** visitou a landing (`/dogcity`), abriu o jogo (`/city`), abriu o mint (`/mint`), conectou a carteira, criou o pedido, pagou e foi inscrito.
- **De onde vem cada passo:**
  - os passos de navegação vêm de `page_events`;
  - "pagou" e "inscrito" vêm do banco do mint (`dogcity_mint`, a fonte da verdade), nunca do navegador.
- **A ligação entre os domínios:** cada domínio guarda o próprio `visitor_id`, porque o localStorage é separado por origem. Para seguir a mesma pessoa da landing ao mint:
  1. os links da landing para o jogo e o mint levam o id do visitante na URL (`?vid=`), e o destino adota esse id se ainda não tiver um;
  2. quem conecta a carteira fica ligado por `analytics_identity`, o mesmo elo que a DogData já usa.
- **O que a aba mostra:**
  - o funil acima, por dia e por canal;
  - a fase do mint (Founder, Whitelist, Partners, Public);
  - as carteiras usadas;
  - os erros do mint por código;
  - quanto tempo leva do pedido ao inscrito.

## Fase 3 · A cidade inteira (o analytics do jogo)

O objetivo é saber o que os dogs fazem lá dentro, sem pesar o jogo nem o banco. O incidente de IO de 26/08 é o limite a respeitar.

- **Onde andam:** um mapa de calor da cidade em grade de 25 m. A posição é amostrada a cada 10 s e somada no próprio navegador; no máximo 6 células por jogador por minuto, e só as visitadas vão no resumo. O navegador manda o resumo uma vez por minuto, nunca a trilha ponto a ponto.
- **Que lotes visitam:** quando o dog pisa dentro de um lote, conta uma visita àquele lote pelo id dele, com o tempo de permanência. É a medida fina da cidade (mais precisa que qualquer grade): quais lotes atraem gente, se o dono visita o próprio lote, quais vizinhos de prédio famoso recebem visita.
- **Para onde vão:** zonas, distritos e prédios visitados (Xverse HQ, BitFlow, Sphere, Founders Club, PIPS), com tempo de permanência.
- **Como se movem:** a pé, carro, moto, iate e helicóptero. Para cada um: entradas, tempo e distância.
- **O que fazem com os lotes:** buscas, escrituras abertas, o próprio lote visitado e compartilhamentos.
- **Social:** chat, jogadores próximos e encontros.
- **Desempenho:** o que já existe (travadas, perda de GPU, resumo por aparelho).
- **Volume:** um evento-resumo por minuto por jogador, com contadores, em vez de um evento por ação. Tudo fica numa tabela própria do jogo, separada de `page_events`, com o mesmo resumo diário da fase 1.
- **Identidade:** sem carteira, o jogador é só o `visitor_id`. Com carteira conectada, o resumo leva o endereço, que já é público. O interruptor `dog_analytics_off`, o DNT e o GPC continuam desligando tudo.

## Ordem

| # | O que | Onde | Estado |
|---|---|---|---|
| 0 | Landing como `/dogcity` | DogData PR #36 | pronto, aguarda merge |
| 0 | Funil do mint | dogcity-mint PR #14 | pronto, aguarda merge |
| 1 | Resumo diário e painel rápido (90 e 365 dias) | DogData | a fazer |
| 2 | Aba DogCity com o funil e o `?vid=` | DogData, landing, jogo, mint | a fazer |
| 3 | Analytics da cidade (mapa de calor de 25 m, visita por lote, veículos, prédios, social) | dogcity-mundo e DogData | a fazer |

## Decisões do fundador (23/10/2026)

1. A aba DogCity fica **no mesmo painel** da DogData, como uma aba nova.
2. O mapa de calor usa **grade de 25 m**, e a visita a lote é contada **pelo id do lote**. Com 50 m uma rua se mistura com a vizinha. Com 10 m o volume seria 6 vezes maior (cerca de 1,6 milhão de células na cidade, contra 260 mil) sem responder nada que o lote já não responda.
3. Com carteira conectada, o resumo do jogo **leva o endereço**.
