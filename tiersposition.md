# Posição por tier (`tiersposition.md`)

> **Para que serve:** acumular, num lugar só, TODA decisão de "qual tier mora onde" na
> DogCity, até dar para **reconstruir o `foundation_generator` a partir daqui**. O
> `masterplan.md` continua sendo a constituição; este arquivo é o caderno de trabalho da
> atribuição, e o que fecha aqui sobe para lá com 🔒.
>
> **Regra do caderno:** cada linha é marcada como **MEDIDO** (saiu de dado, com o script
> que mediu), **DECIDIDO** (escolha do dono, com data) ou **PENDENTE**. Não misturar. Um
> número sem fonte não entra.
>
> ⚠️ **TODA decisão de posicionamento é gravada AQUI, na hora em que é tomada.** Dono,
> 2026-09-10. Não vale deixar em conversa, em comentário de código ou só na cabeça de
> quem decidiu: se a regra diz onde uma carteira vai parar, ela entra neste arquivo antes
> de virar código. É esta pilha, e não o histórico do chat, que reconstrói o gerador.
>
> **Idioma:** português, como o `masterplan.md` e o resto da documentação interna. Regra
> da casa: doc e comentário de código em português, produto em inglês. Se um holder lê, é
> inglês; isto aqui nenhum holder lê.
>
> ⚠️ **Nada aqui é lote demarcado.** Contagem e posição são SAÍDAS do snapshot. Estes
> números dimensionam o desenho; eles não viram promessa pública nem entram em copy da
> landing antes do snapshot.
>
> ⚠️ **Repo público.** Este arquivo é visível. Não colocar aqui nada que não possa ser
> lido por qualquer pessoa.

---

## 1. De onde vem o tier

**MEDIDO.** Fonte única: `data/forensic_behavioral_analysis.json`, gerado por
`scripts/update_forensic_analysis.py`. Rótulos em `lib/airdrop-tiers.ts`.

A régua tem dois campos em cascata:

```
change_pct = (saldo_hoje − airdrop) / airdrop * 100   → decide os 6 primeiros tiers
retention  =  saldo_hoje / airdrop * 100              → decide os 6 últimos
```

⚠️ **O tier cobre um terço da cidade, não a cidade.** Medido em 10/09/2026 cruzando com
`data/holders_by_age.csv`:

```
holders hoje:      85.791
com tier:          26.954  (31,4%)
sem tier nenhum:   58.837  (68,6%)   ← compraram DOG, nunca receberam airdrop
```

Qualquer regra de posição baseada em tier PRECISA dizer o que fazer com os 68,6%. Ver §4.

---

## 2. A tabela mestra

**MEDIDO** (contagens de 10/09/2026, 19:39). **DECIDIDO/PENDENTE** por linha.

| # | tier | carteiras | posição | estado |
|---|---|---|---|---|
| 1 | Satoshi Visionary | 88 | Orla Nobre, frente, **23,2° a 77,7°** (centro do arco) | 🔒 **fechado** (§3.1, §3.2) |
| 2 | BTC Maximalist | 99 | Orla Nobre, frente, os dois flancos | 🔒 **fechado** (§3.1, §3.2) |
| 3 | Rune Master | 258 | Orla Nobre, fileira de trás | 🔒 **fechado** (§3.1, §3.2) |
| 4 | Ordinal Believer | 715 | Orla interna da baía, **de frente para as mansões** | 🔒 lugar decidido (§3.3) |
| 5 | DOG Supporter (`dog_legend`) | 1.347 | Segunda faixa, **atrás do tier 4** | 🔒 lugar decidido (§3.3) |
| 6 | Diamond Paws | 19.289 | **Tecido de bairros** (miolo entre a praça e o cinturão) | 🔒 lugar decidido (§3.4) |
| 7 | HODL Hero | 301 | — | PENDENTE |
| 8 | Steady Holder | 411 | — | PENDENTE |
| 9 | Profit Taker | 823 | — | PENDENTE |
| 10 | Early Exit | 824 | — | PENDENTE |
| 11 | Panic Seller | 715 | — | PENDENTE |
| 12 | Paper Hands | 50.627 (só 2.084 ainda holders) | — | PENDENTE |
| — | **sem tier** (nunca receberam airdrop) | **58.837** | — | **PENDENTE, e é a maior fatia** |

Os 6 primeiros somam **21.796 carteiras e 28,13% do supply**: a coorte OG.

---

## 3. Decisões fechadas

### 3.1 — Orla Nobre da alça, tiers 1 a 3 (🔒 2026-09-10)

Registro completo no `masterplan.md` §10, com o 🔒 no §9. Resumo operacional:

**DECIDIDO.** A alça é o endereço mais nobre da cidade, acima do centro. O anel 0 colado
à plaza foi revogado como assento dos Satoshi Visionary; o centro fica cívico.

**MEDIDO.** Por que param no tier 3: a frente de água é o recurso escasso e é fixa em
**14,93 km** na face da baía.

| até o tier | carteiras | testada cada | leitura |
|---|---|---|---|
| Rune Master | **445** | **33,5 m** | lote nobre real |
| + Ordinal Believer | 1.160 | 12,9 m | casa geminada |
| + Diamond Paws | 21.796 | 0,7 m | impossível |

**MEDIDO.** A coorte é estável: 3.057 snapshots de `forensic_history.json` desde
30/04/2026, soma dos 3 tiers entre 440 e 456 (amplitude 3,6%).

**DECIDIDO.** 510 lotes = 445 de carteira + 65 do projeto (land bank do §6).

| | FILEIRA DA FRENTE | FILEIRA DE TRÁS |
|---|---|---|
| orientação | praia da baía → casa → pista | pista → casa → praia dos fundos |
| carteiras | SV (88) + BM (99) = 187 | Rune Master (258) |
| projeto | 20 (4 blocos de 5) | 45 (9 blocos de 5) |
| total | 207 lotes | 303 lotes |
| testada | 74,9 m | 51,6 m |
| fundo garantido | 214 m | 246 m |
| área do lote | 1,60 ha | 1,27 ha |
| gabarito | **2 pavimentos** | livre |

**Invariantes que qualquer implementação tem de respeitar:**

1. ⚠️ **O gabarito de 2 pavimentos na frente é estrutural**, não estético: ele protege a
   vista dos 303 lotes de trás. Com 3 pavimentos na frente, a de trás só alcança a lâmina
   no 4º andar. **MEDIDO:** a baía tem 2,7 km de lâmina e a casa da frente fica a 272 m,
   então a skyline da cidade se vê do TÉRREO nas duas fileiras.
2. ⚠️ **As duas fileiras olham para DENTRO.** Dono: *"a face externa não olha mar aberto,
   ela olha uma faixa de água e a escuridão total"*. A face externa é quintal, não
   fachada. Não vender, não enquadrar câmera, não escrever copy como se fosse orla.
3. ⚠️ **Nenhuma rua nova entra na alça** (dono, 07/09). Os dois lados acessam a mesma AN7,
   e é por isso que ela fica no meio (r 6.950). Terceira fileira exigiria rua de fundo e
   está fora enquanto a regra valer.
4. ⚠️ **Os 20 lotes do projeto na frente existem para a orla ter destino público.** Sem
   eles são 15,5 km de lotes privados em fila e os 30 acessos à praia viram passagem sem
   chegada. Programa da frente é horizontal (marina, clube, píer, restaurante); o que for
   alto vai para a fileira de trás.

### 3.2 — O arranjo dentro da alça: P1, P2 e P3 (🔒 2026-09-10)

**DECIDIDO. A ordem dentro do tier sai do próprio `change_pct`**, o mesmo número que já
define o tier, em ordem decrescente **do centro do arco para as pontas**. Quem multiplicou
mais o airdrop fica mais perto do centro. Não introduz critério novo: o tier diz o bairro
e o mesmo campo diz o endereço dentro dele.

**MEDIDO.** O campo ordena sem empate significativo:

| tier | maior | mediana | menor |
|---|---|---|---|
| Satoshi Visionary | 3.169.318% | 1.566% | 1.013% |
| BTC Maximalist | 989% | 669% | 500% |
| Rune Master | 500% | 288% | 200% |

⚠️ O maior Satoshi Visionary multiplicou o airdrop por **31.693 vezes**, contra 99x do
segundo colocado. É essa carteira que fica no ponto central exato.

**MEDIDO.** O melhor ponto do arco não é opinião: o meio fica em **51,25°** e o centro da
baía em **52,5°**. Quem está ali olha o centro da baía e a cidade de frente, no ponto mais
distante dos dois acessos.

**DECIDIDO. Fileira da frente, 207 lotes, do rumo 346° ao 116,5°:**

```
346,0° ── P1(5) ── BTC Max (50) ── P2(5) ── SATOSHI VISIONARY (88) ── P3(5) ── BTC Max (49) ── P4(5) ── 116,5°
          ponta                    junção     23,2° a 77,7°            junção                  ponta
                                              centro em 51,25°
```

**DECIDIDO. Fileira de trás, 303 lotes:** 258 Rune Master pela mesma regra (`change_pct`
decrescente do centro), mais 45 do projeto em 9 blocos de 5, sendo 4 alinhados com os
blocos da frente para o equipamento ter anexo atrás.

**Por que 4 blocos na frente e não 5** (dono, 2026-09-10): 5 blocos simétricos exigiriam um
no centro EXATO do arco, e o centro é dos Satoshi Visionary. Com 4, os SV ficam num trecho
**contínuo** de 54,5°, que de longe lê como "aquele trecho ali são os 88", sem legenda. Os
5 lotes que saíram da frente foram para a fileira de trás (40 → 45), e a testada da frente
subiu de 73,2 para 74,9 m.

**Onde caem os 4 blocos (P3):** 2 nas pontas, que é onde entram os dois acessos e onde o
público chega, e 2 nas junções entre SV e BM, que são pontos de vista ótimos e servem os
dois trechos ao mesmo tempo.

⚠️ **Ajuste fino de implementação:** com os blocos e os 6 acessos consumindo 2,18° do arco,
o centro do trecho SV cai em 50,47°, 95 m fora do meio. A sobra dos acessos é distribuída
de forma assimétrica para zerar esse desvio; o invariante é **o trecho SV centrado em
51,25°**, não a repartição igual dos acessos.

### 3.3 — Orla interna da baía, tiers 4 e 5 (🔒 2026-09-10)

**DECIDIDO.** O **Ordinal Believer (715)** fica na margem oposta da baía, **de frente para
as mansões da alça**. O **DOG Supporter (1.347)** fica na **segunda faixa, atrás dele**,
repetindo o padrão que a alça estabeleceu: primeira fileira na água, segunda atrás olhando
por cima.

⚠️ Escopo desta decisão é **o lugar, não o lote.** Testada, área, gabarito e ordem interna
ficam para quando o desenho daquela orla for feito. Dono, 2026-09-10: *"não precisamos
definir posicionamento e tamanho exato dos lotes agora, só onde cada tier vai ficar"*.

**MEDIDO.** A orla interna, varrendo o relevo com a lâmina em −40:

```
faixa de rumo        358,5° a 99,5°
comprimento útil     8,62 km   (contra 14,93 km da alça, ou seja 58%)
lâmina até a alça    1.084 m mediana, até 3.044 m no ponto mais largo
margem               r 3.536 a 6.264, mediana 5.504
```

**MEDIDO.** Por que o tier 5 não divide a mesma frente: 715 sozinho na orla dá 12,1 m de
testada, que já é casa urbana e não mansão. Os dois juntos dariam **4,2 m**, o que não
existe. A segunda faixa é a única forma de os dois olharem a água.

⚠️ **Doze metros é o ponto, não o defeito.** O tier 4 tem de ler como degrau abaixo da
alça. Casa urbana com frente de água (no espírito dos canais de Amsterdam) contra estate
de 1,6 ha é exatamente a distância que separa o tier 3 do tier 4.

⚠️ **ESSA ORLA ESTÁ FORA DO TECIDO ATUAL.** `gerar_bairros.py` para em **R_SITIO = 3.500**
e a margem mais próxima da baía está em r 3.536, 36 m além. Não é conflito de terra, é
terra que o gerador ainda não alcança. Ver §5.

### 3.4 — Tecido de bairros, tier 6 Diamond Paws (🔒 2026-09-10)

**DECIDIDO.** Os **19.289 Diamond Paws** ocupam o **tecido de bairros propriamente dito**,
o miolo entre a Praça Central e o cinturão. **A ordem é a intensidade de uso da carteira,
do centro para fora.**

**Por que não é orla:** os tiers 1 a 5 pegaram água porque eram poucos (2.507 somados,
2,9% da cidade) e água é o recurso escasso. O tier 6 sozinho leva o acumulado a **25,4%**
da cidade. Ele não é um bairro especial, **ele é a cidade**: mesma bag, mesmo
comportamento, dezenove mil vezes. Bairro residencial é o que ele é.

**MEDIDO.** 19.289 lotes = **36,4% do tecido atual** = 6,77 km² na densidade de hoje
(351 m² por lote, com rua e recuo verde já descontados).

**MEDIDO.** O que o tier realmente é, de `data/diamond_paws_analysis/lost_analysis.json`:

```
saldo exatamente igual ao airdrop em TODAS as 19.289   (nunca venderam DOG)

VIVAS      13.396 (69,4%)   14,20B DOG
           gastaram BTC e outros runes e não tocaram no DOG
           nota do próprio dataset: "alive HODLers, not lost"
DORMENTES   5.893 (30,6%)    5,61B DOG (5,61% do supply)
           nunca gastaram nada desde o airdrop
```

**A intensidade que ordena** (transações gastas em outras coisas, com o DOG intacto):

| tx gastas | carteiras |
|---|---|
| 100+ | 1.848 |
| 21 a 100 | 3.637 |
| 6 a 20 | 3.288 |
| 2 a 5 | 2.687 |
| 1 | 1.936 |

As 1.848 do topo usam a carteira toda semana há dois anos e nunca encostaram no DOG. É a
conviction mais demonstrável do dataset inteiro, e por isso ficam mais perto da praça.

⚠️ **NÃO SEPARAR OS 5.893 DORMENTES EM SETOR PRÓPRIO.** Decisão do dono, 2026-09-10. Um
bairro de "carteiras perdidas" seria uma afirmação que o dado não sustenta: nunca ter
gastado não prova perda, prova só que ninguém gastou, e pode ser cold storage disciplinado.
O próprio arquivo chama a categoria de `lost_relaxed` e anota que "incoming proves nothing
about key control". Com a intensidade como gradiente contínuo, os dormentes acabam na borda
do setor sem que ninguém seja rotulado: o efeito no mapa é o mesmo e a afirmação não é
feita. Casa com o princípio §0.5 do masterplan ("Don't trust, verify").

⚠️ **CORREÇÃO DE UM ERRO DESTE ARQUIVO.** A versão anterior do P6 dizia que os gêmeos eram
"indistinguíveis em todo eixo disponível". Isso valia para `holders_by_age.csv` (saldo,
idade, utxo_count, lth_pct). O `lost_analysis.json` usa dados de cadeia e separa o bloco em
vivas e dormentes, com gradação de intensidade dentro das vivas. **Existe eixo; ele mora em
outro arquivo.**

---

## 4. Pendências abertas

Numeradas para poder fechar uma por vez. Nada aqui foi decidido.

**P1, P2 e P3 foram FECHADOS em 2026-09-10.** Ver §3.2.

**P4 — O programa de cada bloco** do projeto (qual é marina, qual é clube, qual é píer).

**P5 — A regra de encaixe coorte × geometria.** Os 445 são de hoje; no snapshot podem vir
440 ou 456. Se vierem MENOS, os lotes que sobram são reserva do projeto e o caso é
trivial. Se vierem MAIS, é preciso escolher entre alargar o número de lotes ou cortar por
saldo dentro do tier de menor prioridade. As duas opções estão abertas.

**P6 — Os tiers 7 a 12.** Nenhum tem posição. São 5.158 carteiras que AINDA são holders
(HODL Hero 301, Steady 411, Profit Taker 823, Early Exit 824, Panic Seller 715, e os 2.084
Paper Hands que sobraram com saldo). Grupo pequeno perto do que já foi colocado, mas é o
único que fala de quem VENDEU parte, e isso ainda não tem tradução no mapa.

**P7 — Os 58.837 sem tier**, que são 68,6% dos holders. É a maior fatia da cidade e não
tem nem regra nem bairro.

**P8 — O que fazer com os defeitos das escadas antigas.** Levantados em 10/09, nenhum
consertado: `assignDistrict` (`lib/city/zones.ts:45`) corta por SALDO mas usa nomes de
IDADE ("Genesis Core / Oldest coins"), e ela alimenta o registry, `/api/plot`,
`/api/city/data` e `scripts/lunar/generate_lots.ts` enquanto o `foundation_generator` usa
decis de idade: duas definições de distrito na mesma cidade. Ver §5.

---

## 5. O que o gerador vai precisar (contrato)

Estado hoje, **MEDIDO** em 10/09/2026: **o gerador não sabe que a alça existe.** Não há
uma única referência a ela em `scripts/foundation_generator.ts`, `scripts/gerar_bairros.py`
ou `lib/city/zones.ts`. O `RING0_SEATS = 85` continua lá com o proxy provisório, e o anel 0
ficou sem dono depois da decisão 3.1.

⚠️ **E o tecido atual não alcança a cidade.** `scripts/gerar_bairros.py` para em
`R_SITIO = 3.500` e o `public/city/bairros.json` gerado tem 140 bairros e **52.996 lotes
para 85.791 carteiras**: faltam 32.795. A orla interna da baía (§3.3) fica inteiramente
fora desse raio. Isso não é urgente enquanto o loteamento é teste, mas vira bloqueio duro
quando Diamond Paws (19.289) precisar de chão.

⚠️ **Uma segunda fonte de dado entra em jogo a partir do tier 6.** A intensidade de uso
vem de `data/diamond_paws_analysis/lost_analysis.json` (e do `chain_stats.jsonl` que o
alimenta), não do `forensic_behavioral_analysis.json`. São dois datasets, e o gerador
precisa dos dois.

Quando for reconstruir, o gerador precisa:

1. **Ler o tier de verdade**, fazendo join com `data/forensic_behavioral_analysis.json`.
   É o join que o cabeçalho do `foundation_generator` já anotava como pendente, e o
   dataset existe e é atualizado sozinho.
2. **Reservar a Orla Nobre ANTES de enumerar carteiras**, do mesmo jeito que o civic core
   e a Reserva Urbana já são reservados (princípio §0.6 do masterplan: nenhum lote de
   carteira é deslocado por terra cívica ou de projeto).
3. **Tratar a alça como geometria própria**, não como distrito da phyllotaxis: ela é um
   arco com duas fileiras, e a posição dentro dela é ângulo, não índice de espiral.
4. **Resolver P5 explicitamente**, em vez de assumir que a coorte terá o tamanho de hoje.
5. **Decidir o destino de quem não tem tier (P7)** antes de rodar, senão 68,6% das
   carteiras caem num ramo não escrito.

---

## 6. Registro de mudanças deste arquivo

- **2026-09-10** — criado. Entra a decisão 3.1 (Orla Nobre, tiers 1 a 3) e as pendências
  P1 a P8. Implementado no código nesta data: só a geometria da via (AN7 de volta a
  r 6.950, verificada por `verificar-orla.ts`, `verificar-alca.ts` e `vias-varredura.mjs`).
  A atribuição de lotes continua sendo papel.
- **2026-09-10** — fechados P1, P2 e P3 (§3.2): ordem por `change_pct` do centro para as
  pontas, SV contínuo no meio do arco, 4 blocos do projeto na frente em vez de 5. A
  divisão do land bank passou de 25/40 para **20/45**.
- **2026-09-10** — tiers 4 e 5 ganharam lugar (§3.3): Ordinal Believer na orla interna da
  baía de frente para as mansões, DOG Supporter na segunda faixa atrás. Só o lugar; lote e
  tamanho ficam para depois. Registrado que o tecido atual para em r 3.500 e não alcança
  essa orla.
- **2026-09-10** — tier 6 ganhou lugar (§3.4): Diamond Paws no tecido de bairros, ordenado
  por intensidade de uso do centro para fora, sem separar os dormentes. Corrigido o erro do
  P6 anterior que dava os gêmeos como indistinguíveis.
