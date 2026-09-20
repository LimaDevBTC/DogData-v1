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
| 7 | HODL Hero | 301 | O Grupo (§3.5) | 🔒 regra decidida |
| 8 | Steady Holder | 411 | O Grupo (§3.5) | 🔒 regra decidida |
| 9 | Profit Taker | 823 | O Grupo (§3.5) | 🔒 regra decidida |
| 10 | Early Exit | 824 | O Grupo (§3.5) | 🔒 regra decidida |
| 11 | Panic Seller | 715 | O Grupo (§3.5) | 🔒 regra decidida |
| 12 | Paper Hands | 50.627 (só 2.084 ainda holders) | O Grupo (§3.5) | 🔒 regra decidida |
| — | **sem tier** (nunca receberam airdrop) | **58.827** + 15 de infra | O Grupo (§3.5) | 🔒 regra decidida |

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
| projeto | **18 (6 blocos de 3)** | **47 (15 blocos de 3 + 1 em cada ponta)** |
| total | 207 lotes | 303 lotes |
| testada | 74,9 m | 51,6 m |
| fundo garantido | 214 m | 246 m |
| área do lote | 1,60 ha | 1,27 ha |
| gabarito | **2 pavimentos** | livre |

⚠️ **OS LOTES DO PROJETO NA ORLA SÃO RESERVA DE VALOR, NÃO SOBRA DE DESENHO**
(fundador, 2026-09-20): *"os lotes na área nobre são uma reserva importante. Se o projeto
hypar, um mint public pra novos holders pode ser uma bela fonte de renda."*

Isso muda o peso de qualquer pedido futuro de pôr programa nosso ali. Cada bloco do projeto
na Orla Nobre tem **dois** valores concorrentes: o urbano (destino público na orla, que é o
motivo de eles existirem, ver invariante 5) e o **financeiro** (estoque para um mint público
quando a demanda aparecer). Gastar um bloco com peça nossa consome os dois de uma vez.

📌 **Precedente registrado no mesmo dia:** o segundo mirante da Terra chegou a ser realocado
para um desses blocos, com a justificativa correta de que não tocava lote de carteira, e o
fundador **tirou assim mesmo**. A regra que sai daí: *a Orla Nobre não recebe programa nosso,
nem no lote do projeto.*

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
4. ⚠️ **O RITMO DOS LOTES DO PROJETO MUDOU EM 2026-09-19** (fundador: *"5 acho que pode
   criar um bloco muito grande"*). Era 4 blocos de 5 na frente e 9 de 5 atrás; passou a
   **blocos de 3**, e os 2 que sobravam da frente foram para trás (decisão dele). MEDIDO,
   e é o número que justifica a mudança, a distância entre um destino público e o
   seguinte andando pela orla:

   ```
   FRENTE  207 lotes x 74,9 m = 15,50 km
     4 blocos de 5   bloco de 375 m, um destino a cada 3,88 km   (era isto)
     6 blocos de 3   bloco de 225 m, um destino a cada 2,58 km   (e isto)
   TRAS    303 lotes x 51,6 m = 15,64 km
     9 blocos de 5   bloco de 258 m, um destino a cada 1,74 km   (era isto)
    15 blocos de 3   bloco de 155 m, um destino a cada 1,04 km   (e isto)
   ```

   ⚠️ **OS 2 QUE SOBRARAM VÃO UM EM CADA PONTA DA ALÇA**, não num bloco torto no meio.
   Três não divide 20, e bloco diferente dos outros quebra a regra da casa de que
   elemento repetido fica igualmente espaçado. Nas pontas eles ganham razão de ser: é
   onde a AN7 encontra as radiais de 330 e 120, ou seja a chegada da alça. Um lote de
   projeto em cada chegada é portal, não sobra.

5. ⚠️ **Os lotes do projeto na frente existem para a orla ter destino público.** Sem
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

### 3.5 — O Grupo: tiers 7 a 12 e os sem tier (🔒 2026-09-10)

**MEDIDO.** A conta da cidade fecha em três blocos:

```
infraestrutura (rotulada)         15   0,0%   18,49B  18,5% do supply
tiers 1 a 6 (§3.1 a §3.4)     21.795  25,4%   28,13B  28,1%
O GRUPO (7 a 12 + sem tier)   63.985  74,6%   53,36B  53,4%
                              ──────         ───────
                              85.795         99,98B
```

**DECIDIDO. Três regras, e a cidade fecha.**

**1. Infraestrutura RECEBE lote como qualquer carteira.** Dono, 2026-09-10, recusando a
proposta de excluí-la: *"acho muito agressivo. Fechamos todas as carteiras e o que sobrar é
de infra básica"*. A terra que sobra depois de todas as carteiras é que vira infraestrutura
básica da cidade.

⚠️ **Consequência a saber, não a discutir:** cruzando com `dog_labels`, a **carteira #1 da
cidade é a Kraken hot, com 13,02B DOG**, e a #2 é uma treasury cold com 3,11B. São 15
endereços (Kraken, Binance, Bitget, CoinEx, Gate.io, 3 marketplaces, 4 desks, 3
distributors) com **18,49% do supply**. Pela regra de área proporcional à raiz do saldo,
a Kraken fica com o maior lote da cidade. Casa com o §0.1 do masterplan ("a localização não
se compra; posição é história on-chain"): a cidade é retrato da cadeia, não clube curado.

**2. Abaixo de 20k DOG: distribuição SEM ORDEM na periferia.** É a regra que o masterplan §2
já define, e cobre a maior parte do Grupo.

**3. Acima de 20k DOG: ordem pelo `position_score`**, ou seja o block height do UTXO mais
antigo com 20.000+ DOG. **Quanto mais antigo esse UTXO, mais perto do centro.** Também já é
o masterplan §2; o dono confirmou a regra em vez de criar outra.

**MEDIDO.** O Grupo pelas bandas que essas regras produzem:

| banda | carteiras | % | DOG |
|---|---|---|---|
| ≥ 20k, ordenadas por `position_score` | 31.092 | 48,6% | 53,26B |
| 10k a 20k, constrói sem disputar centro | 4.457 | 7,0% | 0,06B |
| 1 a 10k, lote à espera na periferia | 26.811 | 41,9% | 0,04B |
| poeira < 1 DOG, sem lote (`DUST_MAX`) | 1.625 | 2,5% | ~0 |

Ou seja **44% do Grupo já tinha destino escrito** antes desta rodada. A ordenação só importa
para as 31.092 acima de 20k, que é onde estão 53,26B e as 631 carteiras com 10M+.

### 3.6 — A regra de precedência: o tier decide o anel (🔒 2026-09-10)

**DECIDIDO. O TIER DECIDE O ANEL; O CRITÉRIO PRÓPRIO DO TIER ORDENA DENTRO DO ANEL.**

Fecha a única lacuna que sobrava: o tier 6 e o Grupo acima de 20k ocupam o mesmo tecido e
os dois ordenam "do centro para fora", mas por campos diferentes (intensidade de uso contra
`position_score`). Sem esta regra, não havia resposta para quem fica mais perto entre um
Diamond Paws de 1 transação e uma carteira do Grupo cujo UTXO de 20k é do dia do airdrop.

⚠️ **E ISSO RESOLVE UMA CONTRADIÇÃO COM O MASTERPLAN.** O §9 de lá travou em 2026-07-10
"**20k como metro único de posição**", e a regra de intensidade do tier 6 (§3.4) é um
segundo metro. Com a precedência acima os dois convivem sem se anular: o `position_score`
continua sendo o metro único **ENTRE** carteiras comparáveis, e a intensidade só desempata
**DENTRO** do tier 6. É o mesmo princípio que a alça já usava desde o §3.2: o tier diz o
bairro, um campo do próprio tier diz o endereço.

**O mapa que sai disso**, com a cidade inteira colocada:

| grupo | carteiras | onde |
|---|---|---|
| tiers 1 a 3 | 445 | alça, r 6.950, fora do tecido |
| tiers 4 e 5 | 2.062 | orla interna da baía, r ~5.500, fora do tecido |
| tier 6 Diamond Paws | 19.289 | tecido, do centro para fora |
| Grupo ≥ 20k | 31.092 | tecido, depois do tier 6 |
| Grupo < 20k | 32.893 | periferia, sem ordem |
| infraestrutura | 15 | lote como qualquer carteira |
| **total** | **85.796** | (a cidade tem 85.795; 1 endereço rotulado também tem tier) |

⚠️ **OS RAIOS SÃO CONSEQUÊNCIA, NÃO DECISÃO.** Projetando a densidade de hoje (351 m² por
lote, 52% da área bruta virando lote) sobre a terra livre medida, a sequência cai em r 1.000
a 2.569 (tier 6), 2.569 a 4.251 (Grupo ≥ 20k) e 4.251 a 5.448 (periferia), ou seja **a
cidade inteira cabe dentro de r 5.448 com a abóbada em 9.050**. Esses números servem para
provar que cabe e para dimensionar; eles mudam junto com a densidade e **não são lote
demarcado** (ver o aviso do topo deste arquivo). O que está decidido é a ORDEM.

### 3.7 — O split da terra e a curva de área (🔒 2026-09-10)

**DECIDIDO. 70% da terra livre para os holders, 30% para o projeto.** Dono, 2026-09-10:
*"vamos dividir os terrenos da galera e o que sobrar é nosso"*, com o programa do projeto
definido **por função** (marina, clube, hotel, sede e o que a cidade precisar), não por
número de parcelas escolhido a dedo.

```
terra livre e plana sob a abóbada   128,20 km²
  holders, 70%                       89,74 km²  urbano (lote + rua + verde)
    do qual lote                      46,66 km²  (aproveitamento de 52%)
  PROJETO, 30%                       38,46 km²  ← o resíduo
```

⚠️ **A ORDEM DAS DUAS DECISÕES É O QUE FAZ A REGRA SER HONESTA.** "O que sobrar é nosso" só
funciona com a área por carteira travada ANTES. Se a curva vier depois, não é ela que define
o resíduo: é o resíduo desejado que define a curva, e o projeto passa a ter interesse em
apertar o lote do holder. Isso contradiria o §0.1 do masterplan ("a localização não se
compra"). Por isso o split é a linha pública e a curva é **derivada** dele.

**DECIDIDO. A curva, derivada do split:**

```
area = clamp(0,975228 × √DOG,  40 m²,  40.000 m²)
```

| | DOG | área | lado |
|---|---|---|---|
| 1 DOG (`DUST_MAX`) | 1 | 40 m² | 6,3 m |
| limite do piso | 1.682 | 40 m² | 6,3 m |
| 10k | 10.000 | 98 m² | 9,9 m |
| portão de 20k | 20.000 | 138 m² | 11,7 m |
| mediana | 101.806 | **311 m²** | 17,6 m |
| airdrop típico | 889.806 | 920 m² | 30,3 m |
| p99 | 9.956.682 | 3.077 m² | 55,5 m |
| 100M | 100.000.000 | 9.752 m² | 98,8 m |
| Kraken (maior) | 13,01B | **40.000 m² (teto)** | 200,0 m |

Soma conferida: 46,66 km², exatamente o alvo. **22.020 carteiras ficam no piso** (abaixo de
1.682 DOG) e **6 no teto** de 4,0 ha. Piso de 40 m² é o `A_MIN` que o código já usava, com
justificativa registrada ("smallest wallet still visible"); teto de 4,0 ha é o que a decisão
de 2026-08-28 já queria, para a cidade não virar cem latifundiários.

⚠️ **ISTO REVOGA A CALIBRAÇÃO (NÃO A FORMA) DA DECISÃO DE 2026-08-28.** Aquela rodada
prometeu mediana de 333 m², p99 de 1.333 e maior de 4,0 ha, calibrados sobre **52.993
carteiras e 16,33 km²**. Hoje são 85.795 carteiras e 128,20 km² livres, e **nenhuma curva
única de raiz reproduz os três números ao mesmo tempo**. A FORMA (proporcional à raiz, com
piso e teto) sobrevive inteira; os números foram recalibrados sobre o dado de hoje, e a
mediana de 311 m² fica a 7% dos 333 prometidos.

⚠️ **E A CURVA DO CÓDIGO NÃO É ESTA, NEM NUNCA FOI A DA FUNDAÇÃO.** `footprintWidth` em
`lib/city/zones.ts` devolve mediana de **48 m²** e teto de 0,29 ha: ela é a curva VISUAL da
cidade v3 ("already validated visually in the live 3D city"). Com ela o resíduo do projeto
seria **119,31 km², ou 93,1% da terra livre**, o que mostra o tamanho do estrago de deixar a
curva errada no lugar. ⚠️ **O `foundation_generator` importa `footprintWidth` hoje** (o
cabeçalho dele diz "reused verbatim ... not reinvented"): trocar isso é item obrigatório da
reconstrução, ver §5.

### 3.8 — Declive a 5°, curva recalibrada e praia contínua (🔒 2026-09-10)

**DECIDIDO. `DECLIVE_MAX` sobe de 3° para 5°.** Os 3° do `gerar_bairros.py` descartavam
39,27 km² como montanha, mas **78% disso era ondulação entre 3° e 5°**, não encosta. Medido
sob a abóbada: 3° a 5° são 30,69 km²; acima de 8°, que é montanha de verdade, só 8,68 km².

```
terra livre e plana   122,38 km² (a 3°)  →  148,38 km² (a 5°)
  holders, 70%                              103,87 km² urbanos
  projeto, 30%                               44,51 km²
  lote total (52%)                           54,01 km²
```

**A curva do §3.7 foi RECALIBRADA sobre a terra nova** (a forma não muda):

```
area = clamp(1,132380 × √DOG,  40 m²,  40.000 m²)
```

Mediana **361 m²** (era 311), portão de 20k com 160 m², airdrop típico com 1.068 m². A média
de área urbana por carteira sai em 1.211 m².

**DECIDIDO. Praia de 80 m em TODA margem de água**, não só na alça. Dono: *"se preciso
terraplanamos e fazemos praia em tudo"*. No render ela é calculada por **distância real até a
lâmina** (transformada de distância na grade do relevo), e não por anel de raio: por isso a
orla da baía deixou de sair recortada.

⚠️ **CORREÇÃO DE UM ERRO MEU, encontrado pelo dono olhando o mapa.** Os raios dos bairros
vinham sendo calculados com a densidade do tecido ANTIGO (351 m² por lote) em vez da curva do
split. O efeito era visível: o tecido parava em r 5.080 e todo o resto virava terra do projeto,
que no mapa comia mais da metade do disco quando o combinado era 30%. Refeito por **área útil
acumulada**, faixa de raio a faixa de raio:

| bairro | antes (errado) | agora |
|---|---|---|
| tier 6 Diamond Paws | r 960 a 2.376 | **r 960 a 3.300** |
| Grupo ≥ 20k | 2.376 a 3.975 | **3.300 a 5.300** |
| Grupo < 20k | 3.975 a 5.080 | **5.300 a 6.900** |

⚠️ ~~**IDEIA ABERTA: canais radiais como prêmio dos tiers intermediários.**~~
**DESCARTADA em 2026-09-18 pelo fundador.** A ideia (dele, 2026-09-10) era dar frente de água
aos tiers 7 a 12 (5.158 carteiras), os únicos sem nada próprio, com uma malha de canais a cada
300 m. **MEDIDO antes de descartar:** 1.242 km de testada consumindo **18,62 km²**, que são 28%
do tecido, contra os 14,93 km de testada que a alça inteira tem.

**O motivo do descarte, na palavra do fundador:** *"nós colocamos todas as carteiras sobre o
mesmo filtro, então acho que isso pode ter uma outra resolução. Empresas com perfil financeiro
de comportamento vão pra Satoshi Plaza, todo o restante das carteiras são organizadas pelo
perfil de comportamento que criamos."*

⚠️ **E é a mesma regra que fechou o tier B em §3.9: prêmio que não custa terra.** A identidade
dos tiers intermediários vem do lugar que o perfil de comportamento já dá a eles (§3.5 e
§3.12.5), não de um recorte de água feito só para eles. A cidade congela com a rede de canais
que já existe: 8 radiais de 96 m e 5 anéis de 56 m, que dão frente de água a 12.625 lotes.

### 3.9 — A orla da baía: pedra mais DOG (🔒 2026-09-11)

**MEDIDO, e muda o enquadramento: o airdrop do DOG foi distribuído para holders de
Runestone.** Por isso ter os dois não é raro, é o estado natural. Cruzando
`runestone_holders_today.json` (62.749 endereços) com os holders de DOG:

```
airdrop + nunca vendeu DOG (tiers 1-6)   21.795
  AINDA TEM a pedra                      20.964   (96,2%)
  VENDEU a pedra                            831   ( 3,8%)
Diamond Paws com pedra                   18.642 de 19.288  (96,7%)
```

**O raro é o contrário:** as 831 que se desfizeram da pedra e ficaram com o DOG.

**DECIDIDO. Três classes, e duas delas ganham a orla:**

| | carteiras | DOG | pedras | precisa |
|---|---|---|---|---|
| **A** segurou a pedra E multiplicou o airdrop | 2.322 | 7,65B (7,7%) | 7.633 | 7,78 km² |
| **B** segurou a pedra E o airdrop intacto | 18.642 | 19,07B (19,1%) | 22.712 | 39,83 km² |
| **C** comprou a pedra E o DOG no mercado | 4.071 | 6,72B (6,7%) | 12.250 | 7,42 km² |

⚠️ Repare no C: **3,0 pedras por carteira**, contra 1,2 do B. Quem chegou depois acumulou
pedra com intenção, não recebeu por estar numa lista.

**A orla da baía vai para A e C.** A na primeira fileira, colada à praia, porque segurou a
pedra e ainda multiplicou o airdrop. C na segunda, atrás do boulevard: comprou os dois no
mercado, com convicção e sem histórico. **MEDIDO:** os dois somam 15,20 km² e a faixa nobre
tem 20,56 km² livres depois dos tiers 4 e 5.

**DECIDIDO. Os 5,36 km² que sobram são do projeto, espalhados irregularmente** ao longo da
costa, e não num trecho contínuo. Dono, 2026-09-11. Parcela de projeto concentrada num
pedaço só monopolizaria um setor da orla; espalhada, ela costura a frente de água inteira e
nenhum trecho fica sem um equipamento por perto.

**DIREÇÃO DO DONO, 2026-09-11, no fecho da rodada:** o cruzamento a fazer no snapshot é
*airdrop intacto mais pedra hoje*, e quem estiver nos dois ganha, **"nem que seja uma
runestone no quintal"**. O holder não faz nada: é cruzamento de dados, não resgate, na mesma
doutrina do "no claim, no signature, nothing to register".

**MEDIDO em 11/09, e o grupo é nítido.** 889.806 DOG é o airdrop padrão por pedra e é de
longe o saldo exato mais repetido da cidade:

```
carteiras com EXATAMENTE 889.806 DOG    20.289   (o 2o mais repetido tem 3.272)
  ainda com Runestone hoje              18.288   (90,1%)
  soltaram a pedra, ficaram com o DOG    2.001   ( 9,9%)
```

⚠️ **18.288 não é o mesmo número do B (18.642) e os dois estão certos.** O B é "retenção
exatamente 100%", que para quem recebeu por 2+ pedras é um MÚLTIPLO de 889.806; este recorte
é só quem recebeu por uma pedra e está com o valor cravado. Não somar um com o outro.

**DECIDIDO, 2026-09-11: eles ganham uma RUNESTONE NO QUINTAL.** Um monumento no próprio
lote, e nada mais muda. Dono, no fecho da rodada: *"a gente vai dar uma pedra no quintal pra
esses caras, não precisa reposicionar nada, não precisa nada"*.

⚠️ **É PRÊMIO QUE NÃO CUSTA TERRA, e é por isso que ele fecha o assunto.** Toda saída que eu
vinha testando mexia em posição ou em área, e posição e área são o único recurso escasso da
cidade: qualquer uma delas obrigava a tirar de alguém. A pedra é um objeto sobre o lote que a
carteira já tem. Não reposiciona ninguém, não consome orçamento de faixa, não abre superfície
para dividir carteira (a posse do ordinal é verificável na mesma altura) e não pede ação
nenhuma do holder, igual ao resto do snapshot.

⚠️ O RECORTE É "AIRDROP INTACTO + PEDRA HOJE", e não as classes A/B/C. As letras eram só
rótulo meu para as três combinações de pedra e DOG; este prêmio não usa elas.

**B fica onde já estava, o tecido central**, e ganha uma leitura em vez de um prêmio: com
96,7% dos Diamond Paws segurando pedra, "pedra mais airdrop intacto" praticamente DEFINE o
miolo da cidade. Isso é identidade de bairro, não distinção de minoria. ⚠️ PENDENTE o que
mais fazer por eles; o lugar já está decidido desde o §3.4.

⚠️ **E A ORLA ERA OITO VEZES MAIOR DO QUE EU MEDIA.** Até esta rodada eu tratava "orla útil"
como 8,62 km, limitando ao arco 358,5°-99,5° e exigindo 300 m de lâmina. A baía medida de
verdade, por flood fill a partir do ponto que o gerador publica, tem **69,6 km de perímetro**:
praia 5,33 km², faixa da via 5,28 km², **faixa nobre 25,62 km²**, que comporta 10.425
carteiras. As margens laterais, as reentrâncias e o contorno das ilhas internas são litoral, e
eu os descartava.

---

### 3.10 — Pedra sem DOG não entra (🔒 2026-09-12)

**DECIDIDO pelo fundador, no dia do snapshot:** *"essas que tem pedra e não tem DOG podem
ser descartadas"*. A Runestone qualifica, mas **não sozinha**: sem saldo de DOG no bloco
966.670 a carteira não entra na cidade.

**MEDIDO no snapshot fixado** (`data/snapshots/dog_snapshot_966670.json`):

```
62.632  carteiras tinham Runestone no bloco 966.670        (112.384 pedras)
29.011  delas tinham DOG e entram                          ( 49.623 pedras)
33.621  DESCARTADAS: tem pedra, zero DOG as 08:26          ( 62.761 pedras, 55,8% do total)
```

⚠️ **Mais da metade das pedras fica de fora**, e isso é esperado: o airdrop do DOG foi
distribuído para holders de Runestone, então muita carteira recebeu, vendeu o DOG e
manteve a pedra. A regra premia quem ficou com os dois, que é o que a §3.9 já dizia.

**Os números da §3.9 foram REMEDIDOS no snapshot** e ficam assim (a §3.9 usou o arquivo
`runestone_holders_today.json`, que é do bloco corrente e não do snapshot; a decisão dela
não muda, só a contagem):

```
com pedra E airdrop           24.942
com pedra E Diamond Paws      18.633  de 19.279   (96,6%)
```

⚠️ **A LISTA DE PEDRA TAMBEM E FIXADA NO 966.670, e isso não é detalhe.**
`runestone_holders_today.json` é do bloco corrente: no dia do snapshot ele estava no
966.699, 29 blocos e ~6 horas à frente, e **31 pedras mudaram de dono nessa janela**.
Usar o arquivo corrente marcaria 8 carteiras que não tinham pedra às 08:26 e deixaria de
fora 13 que tinham. O rastreio para trás é por posição de sat e está validado em 9 de 9
casos de dono inequívoco (ver o cabeçalho do artefato).

### 3.11 — O piso de 40 m² cai; a curva passa a ser geométrica (🔒 2026-09-12)

**DECIDIDO pelo fundador**, no dia do snapshot: *"esse lote de 40 m² pra cada carteira
abaixo de 1.600 DOG é generoso demais... essas carteiras não vão receber 40 m² cada, com
certeza não"*. **Isto emenda a §3.7**, que fica válida em tudo menos no piso.

```
antes  area = clamp(0,975228 × √DOG,  40 m²,  40.000 m²)
agora  area = clamp(0,986443 × √DOG,   1 m²,  40.000 m²)
```

⚠️ **A CONSTANTE FOI RECALIBRADA, E ISSO NÃO É DETALHE.** Só tirar o piso e manter
`k = 0,975228` levaria a soma de 46,66 para 46,13 km², ou seja **0,553 km² iriam para o
resíduo do projeto em silêncio**. É exatamente o que a §3.7 proíbe: o split é a linha
pública, a curva é derivada dele. Com `k = 0,986443` a soma volta a **46,66 km² exatos**,
o 70/30 fica de pé, e quem está acima da antiga faixa do piso ganha **+1,2%** de lote.

**O efeito, medido sobre as 85.818 carteiras do snapshot:**

| DOG | antes | agora |
|---|---|---|
| 1 | 40 m² | **1,0 m²** |
| 100 | 40 m² | **9,9 m²** |
| 1.000 | 40 m² | **31,2 m²** |
| 10k | 98 m² | 98,6 m² |
| 20k | 138 m² | 139,5 m² |
| mediana (101.806) | 311 m² | 314,7 m² |
| airdrop típico | 920 m² | 930,5 m² |
| Kraken | 40.000 m² | 40.000 m² (teto) |

```
a faixa abaixo de 1.682 DOG: 22.023 carteiras, de 0,881 km² para 0,333 km²
```

⚠️ **O PISO DE 1 m² É GEOMÉTRICO, NÃO GENEROSO, e a escolha do número é minha, não do
fundador.** A curva pura deixava 2.573 carteiras com menos de 1 m² e a menor com
**0,003 m²**, que são 3 cm²: não é lote, não tem porta, não dá para desenhar. 1 m² custa
**0,001 km²** a mais que a curva pura (0,333 contra 0,332) e garante que todo lote existe
no espaço. Derrubar esse metro é uma linha.

⚠️ **E ISSO MATA O ATAQUE DE POEIRA que o piso de 40 m² criava.** Havia 141 carteiras com
exatamente 0,00001 DOG (mais 82 com 0,00005, e outras repetições), padrão de distribuição
em lote e não de holder. Com o piso antigo elas levavam **5.640 m²** por 0,00141 DOG; agora
levam **141 m²**. ⚠️ A concavidade em si continua premiando quem divide (partir em N partes
iguais multiplica a terra por √N), mas **isso é história**: o snapshot está fechado no bloco
966.670 e ninguém divide mais nada. O que sobra é auditoria, não prevenção.

⚠️ **A FAIXA DO PISO É DE COMPRADOR PEQUENO, NÃO DE VENDEDOR, e o número é que diz isso.**
Das 22.020 carteiras abaixo de 1.682 DOG, **20.973 (95,2%) nunca receberam airdrop**: são
compradores pequenos e recentes, e 797 delas seguram Runestone. Só 1.047 são `paper_hands`.
Qualquer tratamento temático para essa faixa erraria o alvo em 95% dos casos: ela é a porta
de entrada da cidade, não a saída.

## 4. Pendências abertas

Numeradas para poder fechar uma por vez. Nada aqui foi decidido.

**P1, P2 e P3 foram FECHADOS em 2026-09-10.** Ver §3.2.

**P4 — O programa de cada bloco** do projeto (qual é marina, qual é clube, qual é píer).

**P5 — A regra de encaixe coorte × geometria.** Os 445 são de hoje; no snapshot podem vir
440 ou 456. Se vierem MENOS, os lotes que sobram são reserva do projeto e o caso é
trivial. Se vierem MAIS, é preciso escolher entre alargar o número de lotes ou cortar por
saldo dentro do tier de menor prioridade. As duas opções estão abertas.

**P6 e P7 foram FECHADOS em 2026-09-10.** Ver §3.5. Todo tier e todo holder têm lugar.

**P8 foi FECHADO em 2026-09-10.** Os três defeitos das escadas antigas foram tratados, e o
levantamento mudou o conserto: **nenhum consumidor de `assignDistrict` está na linha viva**
(a Praça e a Fundação). `<PlotDeed>` saiu da landing em 04/09 e `/city/explore` não é
linkado de lugar nenhum.

1. **`assignDistrict` corta por saldo com nomes de idade.** Não foi renomeada nem trocada:
   mexer no comportamento mudaria quatro consumidores para arrumar um rótulo que ninguém vê
   hoje. Em vez disso ficou **marcada como LEGADO** em `lib/city/zones.ts` (e a segunda
   cópia dos nomes em `lib/city/generator.ts`), com os números medidos e um aviso apontando
   para cá. O risco que isso cobre é o único real: alguém reconstruir o gerador importando
   `assignDistrict` achando que é a fonte de verdade da posição.
2. **`getTierLabel` duplicado** virou `lib/dog/size-tiers.ts`, importado pelas rotas de
   endereço e de transação. As duas cópias ainda estavam idênticas, e é esse o momento de
   unificar: a mesma carteira é rotulada pelas duas.
3. **As descrições "Top N" saíram.** Diziam "Top 10 / 50 / 100 / 1.000 / 10.000" e a
   distribuição já desmentia (9, 58, 119, 855 e 8.438 carteiras). Viraram faixa de DOG, que
   não envelhece. Rank de verdade continua vindo do dado, em `holder_rank`.

⚠️ Fica aberto o que NÃO era defeito de rótulo: `assignDistrict` e o `foundation_generator`
continuam sendo duas definições de distrito. Isso morre sozinho quando o gerador for
reconstruído a partir do §3 deste arquivo, e não antes.


**P9 — Os holders que estão em corretora.** ABERTO, e é o único item desta lista com
prazo público: o snapshot é amanhã e a landing já diz que saldo em corretora não é lido.

O dono levantou duas saídas em 11/09 e MEDIÇÃO matou a primeira:

1. *Sacou, ganha um pedaço do terreno da corretora.* **Inviável por aritmética.** A curva de
   área é raiz do saldo, e raiz é côncava: a soma das raízes é muito maior que a raiz da
   soma. MEDIDO sobre `data/holders_by_age.csv`, as 20 maiores carteiras somam 33,06B DOG
   (33,07% do supply) e ocupam **0,53 km² juntas**. Esse mesmo DOG, distribuído, pede:

   ```
   sacadores de 10M DOG     3.306 carteiras    10,20 km2   (19x o lote da corretora)
   sacadores de  1M DOG    33.063 carteiras    32,24 km2   (61x)
   sacadores medianos     324.786 carteiras   101,06 km2  (191x)
   ```

   Não é problema de fórmula de rateio: o lote a repartir é 19 a 191 vezes pequeno demais.

2. *Sacou, ganha lote novo na reserva.* Aritmeticamente possível, mas só se for limitada por
   TERRA e não por DOG, e a reserva do projeto (38,46 km²) seria consumida em 84% no
   cenário de 1M por sacador — justo onde moram marina, clube, hotel e sede.

⚠️ **AS DUAS ESBARRAM EM DOIS PROBLEMAS ANTES DA TERRA.**

**"Sacou" não é observável.** Na cadeia se vê uma saída da hot wallet da corretora para um
endereço; não dá para distinguir saque de compra, nem saber de quem era o saldo lá dentro.
Qualquer mecânica baseada nisso vira lista curada, que é o oposto do "no claim, no
signature, nothing to register" que a página promete.

**A curva PAGA para dividir a carteira.** Dividir em N multiplica a área por raiz de N, e o
piso de 40 m² transforma isso em catástrofe. MEDIDO:

```
1M DOG em      1 carteira        975 m2
          em    100 carteiras  9.752 m2      (10x)
          em 25.000 carteiras  1.000.000 m2  (1.025x, todas no piso)
```

O snapshot de amanhã é imune porque lê um passado fechado. Um prêmio por ação FUTURA é uma
porta aberta com preço de gás. ⚠️ O mesmo vale, em menor escala, para quem dividir a bolsa
antes de amanhã: ganha área e perde endereço (UTXO novo cai na periferia, e carteira sem
histórico de airdrop não tem tier). É trade-off conhecido, não defeito.

**DIREÇÃO ACEITA pelo dono em 11/09: há terra para quem sacar.** A saída recomendada não
inventa mecânica nenhuma — a cidade LÊ A CADEIA DE NOVO, numa segunda altura anunciada, sob
a mesma regra. Não reparte lote de ninguém (a não linearidade some), não exige provar saque
(só importa onde a moeda está na altura), e não dá para farmar dividindo (a curva daquela
coorte se recalibra contra um orçamento de terra fechado, como esta se recalibrou).

FICA ABERTO: a altura da segunda leitura, e se a coorte nova usa a coroa externa (§4.1) ou
parte da reserva do projeto.

### 4.1 — A coroa externa: 34,17 km² que o gerador não enxerga

**MEDIDO em 11/09** (`scratchpad/sonda-coroa.mjs`, amostragem polar de 10 m × 0,25° sobre a
superfície como construída, com os nove lagos já cheios):

```
                                  total    agua   ate 5°   5 a 12°   >12°
SOB A CUPULA (0 a 9.050)         257,02   62,90   132,50    38,87   22,75
  dentro da AN7 (0 a 6.950)      151,53   26,39    98,33    20,25    6,56
  COROA EXTERNA (6.950 a 9.050)  105,49   36,51    34,17    18,62   16,19
     os dois cabos                10,99    5,31     3,97     1,56    0,14
     arco da alca                 37,14   31,20     4,80     1,14    0,00
     o resto, 135 a 330           57,36    0,01    25,39    15,92   16,05
```

⚠️ **ELA ESTAVA NA CONTA E FORA DO GERADOR.** Os 128,20 km² do §3.7 saíram de medir todo o
interior da abóbada, então a coroa entrou no número. Mas o loteador nunca chega lá:
`gerar_bairros.py` para em `R_SITIO` 3.500 e as BANDAS travam em φ 5.500. Terra contada como
livre e usada por nada. O dono viu isso sozinho, olhando o mapa.

A parte útil está concentrada: **25,39 km² de chão de lote entre 135° e 330°**, sul e oeste,
com praticamente zero água. Os 4,80 do arco da alça são a própria alça (tiers 1 a 3) e os
3,97 dos cabos são a frente oceânica que ganhou malha e orla em 11/09.

A casca não é o limite: com flecha 5.500 o pé direito é de 2.764 m na AN7, 1.625 m em
r 8.000 e 935 m em r 8.500. Só nos últimos 200 m ela fecha.

⚠️ **TRÊS CONSEQUÊNCIAS, E NENHUMA É PEQUENA.**

1. **Acesso.** Rua comum não desemboca na AN7 (regra fechada em 11/09, ver o gerador do
   mapa). Todo bairro na coroa precisa do bulevar atravessando por trevo, que é o padrão que
   os dois cabos já usam.
2. **15,92 km² são de 5° a 12°:** aceitam rua, não aceitam lote. Viram lote com terraço, e
   sem isso o número real é 25,39 e não 41,31.
3. **"Reserva" hoje quer dizer duas coisas** — os 30% do projeto e a coroa que o gerador não
   alcança. Se a coroa virar destino de coorte, as duas precisam de nomes distintos, senão a
   próxima medição soma uma com a outra.

---

## 5. O que o gerador vai precisar (contrato)

Estado hoje, **MEDIDO** em 10/09/2026: **o gerador não sabe que a alça existe.** Não há
uma única referência a ela em `scripts/foundation_generator.ts`, `scripts/gerar_bairros.py`
ou `lib/city/zones.ts`. O `RING0_SEATS = 85` continua lá com o proxy provisório, e o anel 0
ficou sem dono depois da decisão 3.1.

⚠️ **O GERADOR USA 14,5% DA TERRA QUE TEM.** Medido em 10/09/2026 sobre todo o interior
da abóbada (contorno de `cidade-malha.json`, `DOME_R` 9.050):

```
área total sob a casca      240,71 km²
  núcleo r<960 (praça)        2,90 km²
  ÁGUA                       58,23 km²  (24,2%)
  MONTANHA acima de 3°       39,27 km²  (16,3%)
  reservado (parque, spaceport, guerra)  12,11 km²  (5,0%)
  LIVRE E PLANA             128,20 km²  (53,3%)
```

`scripts/gerar_bairros.py` para em `R_SITIO = 3.500` e usa **18,59 km²**, ou seja 14,5% do
que está livre. Sobram **109,61 km² planos e sem dono**. A 351 m²/lote a terra livre
comporta **365 mil lotes** contra 85.795 carteiras, e mesmo descontando rua e verde na
mesma proporção do tecido atual sobram ~66,7 km² lotáveis, o que bate com o orçamento de
terra já registrado.

⚠️ **CORREÇÃO DE UM ERRO DESTE ARQUIVO.** A versão anterior desta seção dizia que o tecido
"não alcança a cidade" e tratava isso como bloqueio para Diamond Paws. Errado: o limite não
é falta de terra, é o raio do gerador. Dono, 2026-09-10: *"nosso gerador não tá
contemplando tudo que está abaixo da abóbada. Somente o que já reservamos, água e montanha
não serão usados, o resto tem bastante coisa livre"*. Confirmado pela medição acima.

⚠️ **E A CURVA DE ÁREA DELE ESTÁ ERRADA HOJE.** `foundation_generator.ts` importa
`footprintWidth` de `lib/city/zones.ts`, que é a curva visual da v3 (mediana 48 m²). A curva
da fundação está no §3.7 e é outra: `clamp(0,975228 × √DOG, 40 m², 40.000 m²)`.

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

- **2026-09-20** — §3.1: os 65 lotes do projeto na Orla Nobre passam a ser tratados como
  **reserva de valor** (estoque para um mint público futuro), e não só como destino público.
  Programa nosso não entra neles: precedente do mirante da Terra, retirado pelo fundador.
- **2026-09-19** — §3.1: o ritmo dos lotes do projeto na Orla Nobre passa de blocos de 5
  para **blocos de 3**, decisão do fundador, com os 2 excedentes da frente indo para as
  pontas da alça. Um destino público a cada 2,58 km na frente e 1,04 km atrás.
- **2026-09-18** — **canais radiais DESCARTADOS** (§3.8). Todas as carteiras passam pelo mesmo
  filtro, o perfil de comportamento já diz onde cada uma mora, e os 18,62 km² não se gastam.
  Entra também a demarcação dos **anéis de expansão 2 e 3** dentro da abóbada (masterplan §14):
  coroas r 7.200 a 8.100 e r 8.100 a 8.900, 86,1 km² somados, hoje vazias. Depois do Anel 3 a
  cidade precisa de casca nova.
- **2026-09-12** — §3.11: cai o piso de 40 m² (decisão do fundador) e a constante da curva
  é recalibrada de 0,975228 para **0,986443**, para a soma continuar nos 46,66 km² do split
  70/30. Piso geométrico de 1 m² (escolha minha, documentada). A faixa baixa sai de 0,881
  para 0,333 km²; todo mundo acima dela ganha +1,2%. Medido: a faixa do piso é 95,2%
  compradores pequenos, não vendedores, então cemitério ali seria o alvo errado.
- **2026-09-12** — snapshot tirado no bloco 966.670. Entra a §3.10: pedra sem DOG não
  entra (33.621 carteiras descartadas, 62.761 pedras). O artefato
  `data/snapshots/dog_snapshot_966670.json` passa a ser a fonte de saldo, tier, idade,
  contagem de UTXO, `position_score` e `tem_runestone`, todos fixados no bloco do
  snapshot. Contagem de tier no snapshot: 88 / 100 / 261 / 713 / 1.349 / 19.279, contra
  88 / 99 / 258 / 715 / 1.347 / 19.289 de 10/09. Tiers 1 a 3 somam **449** carteiras
  contra os 510 lotes da Orla Nobre: cabe.
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
- **2026-09-10** — fechados P6 e P7 (§3.5): infraestrutura recebe lote como qualquer
  carteira, abaixo de 20k distribui sem ordem na periferia, acima de 20k ordena por
  `position_score`. Todo tier e todo holder passam a ter lugar. Corrigido o erro do §5 que
  dava o tecido como bloqueio: há 128,20 km² livres e planos sob a abóbada, e o gerador usa
  14,5% disso.
- **2026-09-10** — fechado P8: `assignDistrict` marcada como legado (sem mudar
  comportamento), `getTierLabel` deduplicado em `lib/dog/size-tiers.ts` e as descrições de
  rank trocadas por faixa de DOG. `tsc --noEmit` limpo.
- **2026-09-10** — §3.6: o tier decide o anel e o critério próprio ordena dentro dele,
  fechando a colisão entre o tier 6 e o Grupo no tecido e conciliando a intensidade com o
  "20k como metro único de posição" do masterplan. Com isso **toda carteira da cidade tem
  lugar**.
- **2026-09-10** — §3.7: split de 70/30 da terra livre (holders 89,74 km², projeto 38,46
  km²) e a curva de área derivada dele, `clamp(0,975228 × √DOG, 40 m², 40.000 m²)`. Revoga a
  calibração de 28/08 mantendo a forma, e registra que `footprintWidth` (a curva do código,
  mediana 48 m²) nunca foi a da fundação.
- **2026-09-10** — §3.8: `DECLIVE_MAX` a 5° (terra livre 122,38 → 148,38 km²), curva
  recalibrada para `clamp(1,132380 × √DOG, 40 m², 40.000 m²)` com mediana de 361 m², praia de
  80 m em toda margem de água, e correção dos raios dos bairros, que estavam calculados com a
  densidade antiga e inflavam a terra do projeto.
- **2026-09-11** — §3.9: a orla da baía vai para quem tem pedra E DOG. Classe A (2.322,
  multiplicou o airdrop) na primeira fileira, classe C (4.071, comprou os dois) na segunda,
  e os 5,36 km² restantes do projeto espalhados irregularmente pela costa. Registrado que o
  airdrop foi para holders de Runestone, que 96,2% dos OG ainda têm a pedra, e que a orla
  medida tem 69,6 km de perímetro contra os 8,62 km que eu vinha usando.
- **2026-09-11** — aberto o **P9** (holders em corretora) e medida a **coroa externa**
  (§4.1). As duas saídas que o dono levantou foram testadas contra número: repartir o
  terreno da corretora é inviável (o lote dela é 19 a 191 vezes pequeno demais, porque raiz
  é côncava), e prêmio por saque esbarra em dois problemas antes da terra — "sacou" não é
  observável na cadeia, e a curva PAGA para dividir a carteira (1M DOG em 25.000 endereços
  rende 1.025x a área). Direção aceita pelo dono: a cidade **lê a cadeia de novo** numa
  segunda altura, sob a mesma regra. E apareceu onde a coorte cabe: a coroa entre a AN7 e a
  casca tem **34,17 km² de chão de lote**, 25,39 deles entre 135° e 330°, contados nos
  128,20 km² do §3.7 e nunca alcançados pelo gerador. Ficam abertas a altura da segunda
  leitura e a escolha entre coroa e reserva do projeto.
- **2026-09-11** — no fecho da rodada o dono fixou a DIREÇÃO do cruzamento da pedra: airdrop
  intacto mais Runestone hoje, sem ação do holder. MEDIDO: 889.806 DOG é o airdrop padrão
  por pedra e o saldo exato mais repetido da cidade (20.289 carteiras), e 18.288 delas
  (90,1%) ainda seguram a pedra. Medido também, e NÃO é pendência: a faixa nobre do §3.9
  continua de pé (22,47 km² de chão de lote na profundidade em que ela foi dimensionada,
  contra ~20,2 km² alocados). O que difere é só o `ORLA_FUNDO` do gerador do MAPA, que
  desenha 265 m; é parâmetro de desenho, não falta de terra. E medido: 33.644 endereços têm pedra
  e nenhum $DOG, com 55,8% de todas as pedras em carteiras sem a moeda.
- **2026-09-11** — FECHADO o prêmio da pedra: quem tem o airdrop intacto e a Runestone hoje
  ganha **uma Runestone no quintal**, um monumento no próprio lote. Nada de reposicionar,
  nada de área, nada a fazer pelo holder. É a única forma de prêmio testada nesta rodada que
  não disputa o recurso escasso da cidade.


## §3.12 — Distrito Financeiro (decisão em aberto, 2026-09-13)

**O problema:** a régua de DOG-tempo joga a Kraken (maior saldo da cidade, 12,95 B) para a
posição 82.761. O fundador: "as corretoras que a gente busca listagem, a gente joga pro final
da fila? A Kraken trouxe mídia, trouxe tudo isso". Jogar custódia para o fim não é
neutralidade, é punição de quem ajudou.

**A virada:** corretora não é problema de EXCLUSÃO, é problema de ENDEREÇO. A régua mede
acumulação pessoal e instituição nunca competiu nesse eixo. Proposta do fundador: **distrito
financeiro** dentro da Satoshi Plaza ou no primeiro arco em volta dela.

### Dimensionamento medido

```
22 carteiras institucionais JA identificadas   28,85% do supply contado
  pela curva atual                              0,393 km2
  com teto de 40.000 m2 cada                    0,880 km2
projecao ~80 carteiras (14 corretoras x 4 + pontes)  3,20 km2

AN1 Anel Interior, r 1.750   9,19 km2 internos
coroa AN1 a AN2              13,50 km2
```

Cabe com folga: o distrito projetado é um terço do disco interno.

### As 20 listagens (CoinGecko, 13/09/2026)

14 custodiais: Kraken, Gate, MEXC, BigONE, DigiFinex, BingX, Bitget, CoinW, Bitrue, Ourbit,
CoinEx, BitKan, Mercado Bitcoin, UniSat. 6 on-chain: Raydium, DotSwap, Meteora (2), Orca,
Bitflow. **Temos endereço de 5 das 14.**

### Recomendações (a decisão é do fundador)

1. **Área ESCALA com o tamanho** 🔒 (decisão do fundador, 13/09: "são carteiras grandes, então
   merecem espaço adequado no centro financeiro"). Eu havia sugerido lote uniforme e fui
   vencido, com razão: no distrito financeiro ninguém lê o terreno da Kraken como riqueza
   pessoal, lê como sede de instituição, e "endereço não se compra" é promessa da régua
   RESIDENCIAL.

   ⚠️ **Mas o teto de 40.000 m² da cidade EMPATA seis carteiras no máximo** e a Kraken fica do
   tamanho da MEXC. Regra recomendada: **mesma curva da cidade, teto elevado a 150.000 m²
   dentro do distrito**.

   ```
   Kraken     11,22 ha   12,95 B DOG      CoinEx      2,96 ha   0,90 B
   treasury    5,50 ha    3,11 B          teto 150.000 m2 nao corta ninguem hoje
   Gate.io     5,43 ha    3,03 B          (Kraken para em 112.247), e trilho de
   Bitget      5,21 ha    2,79 B          seguranca se aparecer carteira maior
   anonima #2  5,05 ha    2,62 B
   MEXC        4,22 ha    1,83 B
   ```

   Custo de tirar o teto: 0,393 para **0,519 km²** nas 22 conhecidas; projeção de 80 carteiras
   dá **1,89 km²** contra 9,19 km² dentro do AN1. Sobra muito.

   **A raiz quadrada continua funcionando aqui:** a Kraken tem 4,3x o DOG da Gate.io e só 2,1x
   o terreno. O distrito não vira concentração, e a frase é defensável em público igual à do
   bairro residencial.
2. **Entrada por IDENTIDADE VERIFICADA, nunca por medição.** Simetria que o projeto ganha de
   graça: no bairro residencial você prova **o que fez**; no distrito financeiro, **quem é**.
   Fecha a brecha de se declarar corretora para pegar endereço nobre.
3. **As 9 corretoras sem endereço não entram por dedução, procuram a gente.** Vira gancho
   comercial: torre no centro é peça de marketing do time delas.

### §3.12.1 — Decisões travadas do Distrito Financeiro 🔒 (2026-09-13)

1. **LUGAR: a coroa entre AN1 e AN2** (r 1.750 a 2.750), 13,50 km² disponíveis contra 1,89 km²
   projetados. Não disputa o miolo com Praça, Lago, Sphere e Coliseu.
2. **ENTRADA: identidade verificada, e corretora e projeto firmam PARCERIA.** Não se entra por
   dedução nossa. Simetria: no bairro residencial você prova **o que fez**; aqui, **quem é**.
3. **ÁREA escala com o tamanho**, mesma curva, teto 150.000 m² (ver §3.12).
4. **TAG DE COMPORTAMENTO INSTITUCIONAL** para carteira sem parceria mas com comportamento de
   mercado, **com direito a RECURSO**: o dono alega que é pessoal e troca por terreno da
   reserva do projeto.
5. **O PROJETO MANTÉM RESERVA DE TERRENO EM TODOS OS PONTOS NOBRES DA CIDADE**, sem exceção.
   Não é luxo: é o que torna o recurso exequível. Sem reserva no nível certo não há troca.

### ⚠️ A trava que o recurso não cobre sozinho

**A tag institucional EXIGE SAÍDA. Nunca se aplica a carteira que nunca enviou DOG.**
O recurso só funciona para quem percebe e recorre; carteira perdida ou dormente jamais
recorreria, e o erro viraria permanente e silencioso. A regra protege **58.695 carteiras**
(68% da cidade) que nunca assinaram nada, e é estruturalmente correta: serviço que não paga
ninguém não é serviço.

### Cobertura MEDIDA dos instrumentos (o que a tag consegue e o que não consegue)

```
ritmo circadiano (100+ depositos)      120 carteiras   0,14%   concentram 28% do supply
sobreposicao (20+ depositos)         1.170            1,36%
qualquer sinal de forma (10+)        3.353            3,91%   concentram 52% do supply
MUDAS (menos de 10)                 82.465           96,09%
   dessas, nunca assinaram          58.695                    resolvidas por EXCLUSAO
   genuinamente sem sinal           23.770           27,70%
no TOP 500: 57% tem 10+, 38% tem 20+, 10% tem 100+
```

**Não dá para classificar a cidade inteira; dá para classificar onde o dinheiro está.** Com o
recurso, a régua deve ser calibrada para RECALL (pegar instituição mesmo errando um pouco),
porque o erro caro passou a ser corretora na Orla Nobre, não pessoa no distrito.

### A posição 2 NÃO é corretora

2,62 B DOG, a maior carteira anônima da cidade. Corretora tem milhares de destinos e
sobreposição ~zero (Gate.io 1.024 destinos e 0%, MEXC 1.093 e 0%, CoinEx 1.047 e 2%). A #2 tem
**147 destinos e 58% de sobreposição**: perfil de DEPÓSITO E RESGATE, mesma família de #49
(69%), #178 (96%) e da ponte do Stacks (63%). Ponte, pool ou custodial. Institucional do mesmo
jeito, mas de outro tipo, e o distrito precisa comportar os dois.

### §3.12.2 — Reserva do projeto: 15% de TODOS os bairros 🔒 (2026-09-13)

**Decisão do fundador:** o projeto reserva **15% dos lotes em todos os bairros**, distribuídos
em vários pontos dentro de cada um, não concentrados num bloco.

**Por que existe:** não é cota comercial, é **infraestrutura do recurso** contra a tag de
comportamento institucional (§3.12.1). Quem for marcado por engano troca por um terreno da
reserva no mesmo nível. Sem reserva no nível certo, a tag vira sentença sem apelação.

⚠️ **ARITMÉTICA NA ORLA NOBRE, que contraria a intuição:** 15% de 510 é **77**, e hoje a
reserva lá é **65**. A reserva AUMENTA em 12 e os lotes de carteira caem de 445 para **433**.
O que libera espaço na Orla Nobre é outra coisa: as institucionais saindo da fila residencial
fazem as carteiras de trás subirem, sem mudar a contagem de lotes.

Duas leituras possíveis, e a diferença precisa ficar explícita:
- **15% uniforme** (gravado): Orla Nobre vai de 65 para 77 reservados.
- **15% como teto**: mantém os 65 já decididos onde já existe reserva.

**Distribuição:** vários pontos por bairro, nunca um bloco único, para que exista reserva
equivalente perto de onde cada recurso aparecer.

### §3.12.3 — A regra da TAG DE COMPORTAMENTO INSTITUCIONAL 🔒 (2026-09-13)

```
TRAVA DE SAIDA, obrigatoria: a carteira precisa ter ENVIADO DOG alguma vez
                             (destinos distintos >= 1, pela regra do delta)
E pelo menos UM destes:
  A. ROTULO      identidade verificada em verified_addresses.json, ou entrada em
                 dog_labels de corretora, ponte, desk, marketplace ou distributor
  B. FLUXO       >= 300 destinos distintos de DOG na historia completa
  C. DEPOSITO E  sobreposicao >= 50% entre quem paga e quem recebe, com >= 10 destinos
     RESGATE
  D. RITMO       >= 100 depositos E R de Rayleigh < 0,15 na hora UTC do deposito
```

**Por que a trava de saída existe:** o recurso só funciona para quem percebe e recorre.
Carteira perdida ou dormente nunca recorreria, e o erro viraria permanente e silencioso. A
trava protege **58.695 carteiras** (68% da cidade) que nunca assinaram nada. É estruturalmente
correta: serviço que não paga ninguém não é serviço.

**Calibragem dos limiares, medida:**
- **B em 300**: a distribuição de destinos no top 500 tem vale claro em `511, 416, 228`. A
  pessoa que mais paga (pos 22, holder confirmado) tem 191, bem abaixo.
- **C em 50%**: três polos medidos. Pessoa (pos 22) **0%**, corretora (CoinEx) **2%**, ponte do
  Stacks, endereço dado pelo fundador, **63%**.
- **D**: ⚠️ o R esperado sob uniformidade é 0,886/√n, então limiar fixo sem piso de n é ruído.
  Custo medido no censo completo da população comparável: pega 3 de 71, e as 3 assinaram 300+
  vezes, ou seja são serviço. Zero carteira honesta rebaixada.

### Resultado da primeira aplicação (top 500)

```
21 carteiras marcadas de 500        13.660.491.106 DOG = 13,66% do supply
8 delas no top 10, 15 no top 60
13 das 21 pegas por UM sinal so, sem rotulo  <- as frageis, alvo provavel de RECURSO
```

⚠️ **A regra so rodou no TOP 500**, porque a varredura de sobreposição cobre esse recorte.
Abaixo disso só o critério D é aplicável hoje (120 carteiras na cidade têm 100+ depósitos).

**Nova ordem residencial:** `data/snapshots/dog_966670_ordem_residencial.json`, 85.797
carteiras. O novo primeiro colocado é a antiga posição 5: 1,03 B DOG, 18 UTXOs, 5 assinaturas,
R 0,668, uma baleia que dorme. 21 carteiras entram no top 500 vindas de trás, maior salto da
521 para a 500.

### §3.12.4 — A reserva é 15% em TODOS os bairros, orgânica 🔒 (2026-09-13)

**Decisão do fundador, que simplifica e destrava:** não é preciso escolher quais pontos são
nobres. **15% dos lotes em todos os bairros, distribuídos de maneira orgânica.**

Isso ENCERRA o único bloqueio de publicação que existia (o antigo Balde 2). Não há mais
decisão pendente para a tag institucional ir a público.

### Orçamento de terra, medido

```
carteiras residenciais               85.797
lotes com 15% reservado             100.938
lotes de RESERVA do projeto          15.141
area das carteiras (curva atual)      46,30 km2
area da reserva (lote mediano 314 m2)  4,76 km2
TOTAL                                 51,05 km2   contra 66,767 km2 de tecido
folga                                 15,71 km2
```

⚠️ A reserva é **CARVADA do inventário**, não somada: é a mesma conta da Orla Nobre, onde
510 = 445 de carteira + 65 do projeto.

### ⚠️ "Orgânico" tem de virar regra executável, senão o gerador inventa uma

**Orgânico aqui significa RUÍDO AZUL (amostragem de Poisson), não aleatório puro.** Os três
caminhos e por que só um serve:

- **Aleatório puro NÃO serve.** Ele forma grumos e deixa buracos. Um recurso que nascer dentro
  de um buraco recebe oferta de lote distante ou pior, e o recurso vira fachada.
- **Grade NÃO serve.** Vira treliça visível de lotes vazios e lê como artificial. (Ver
  [[feedback_founder_prefere_simetria]]: a preferência por simetria vale para elemento
  repetido construído, não para amostragem de vazio.)
- **Ruído azul serve.** Lê como natural e ao mesmo tempo **garante distância máxima até a
  reserva mais próxima**, que é exatamente o requisito funcional.

**O teste de aceitação, e é ele que importa:** todo lote da cidade precisa ter um lote de
reserva de **qualidade comparável** dentro de um raio curto. Não é estética, é o que torna a
troca do recurso honesta. O raio ainda precisa ser escolhido e medido contra o loteamento real.

### §3.12.5 — O Distrito Financeiro vai para DENTRO da Satoshi Plaza 🔒 (2026-09-13)

**REVOGA a decisão 1 de §3.12.1**, que o punha na coroa entre AN1 e AN2. O fundador levantou
que a Plaza é grande demais para o que tem hoje, e a medida confirma.

**A Satoshi Plaza é tudo que fica dentro de r 1.420**, porque o tecido da cidade só começa em
r 1.450 (banda "Nucleo", 1.450 a 2.180) e os bulevares nascem em 1.420.

```
Satoshi Plaza                        r 1.420 m     6,33 km2
distrito financeiro (80 carteiras)                 1,89 km2   30% da praca
reserva do projeto, 15% da praca                   0,95 km2   15%
sobra para nucleo civico e os 4 predios            3,49 km2   55%
```

**Por que dentro é melhor que na coroa:** o endereço é mais nobre, o espaço já está vazio, e
não tira lote nenhum do tecido residencial. A coroa AN1 a AN2 volta a ser tecido comum.
