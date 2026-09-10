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
| 1 | Satoshi Visionary | 88 | Orla Nobre, fileira da frente | 🔒 bairro decidido, ordem pendente |
| 2 | BTC Maximalist | 99 | Orla Nobre, fileira da frente | 🔒 bairro decidido, ordem pendente |
| 3 | Rune Master | 258 | Orla Nobre, fileira de trás | 🔒 bairro decidido, ordem pendente |
| 4 | Ordinal Believer | 715 | — | PENDENTE |
| 5 | DOG Supporter (`dog_legend`) | 1.347 | — | PENDENTE |
| 6 | Diamond Paws | 19.289 | — | PENDENTE (é o cinturão da cidade) |
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
| projeto | 25 (5 blocos de 5) | 40 |
| total | 212 lotes | 298 lotes |
| testada | 73,2 m | 52,4 m |
| fundo garantido | 214 m | 246 m |
| área do lote | 1,57 ha | 1,29 ha |
| gabarito | **2 pavimentos** | livre |

**Invariantes que qualquer implementação tem de respeitar:**

1. ⚠️ **O gabarito de 2 pavimentos na frente é estrutural**, não estético: ele protege a
   vista dos 298 lotes de trás. Com 3 pavimentos na frente, a de trás só alcança a lâmina
   no 4º andar. **MEDIDO:** a baía tem 2,7 km de lâmina e a casa da frente fica a 272 m,
   então a skyline da cidade se vê do TÉRREO nas duas fileiras.
2. ⚠️ **As duas fileiras olham para DENTRO.** Dono: *"a face externa não olha mar aberto,
   ela olha uma faixa de água e a escuridão total"*. A face externa é quintal, não
   fachada. Não vender, não enquadrar câmera, não escrever copy como se fosse orla.
3. ⚠️ **Nenhuma rua nova entra na alça** (dono, 07/09). Os dois lados acessam a mesma AN7,
   e é por isso que ela fica no meio (r 6.950). Terceira fileira exigiria rua de fundo e
   está fora enquanto a regra valer.
4. ⚠️ **Os 25 blocos do projeto na frente existem para a orla ter destino público.** Sem
   eles são 15,5 km de lotes privados em fila e os 30 acessos à praia viram passagem sem
   chegada. Programa da frente é horizontal (marina, clube, píer, restaurante); o que for
   alto vai para a fileira de trás.

---

## 4. Pendências abertas

Numeradas para poder fechar uma por vez. Nada aqui foi decidido.

**P1 — A ordem dentro da fileira da frente.** 187 carteiras dividem 15,5 km, e os pontos
não são iguais: as pontas do arco (346° e 116,5°) são onde a alça estreita e onde entram
os dois acessos, com mais movimento e menos exclusividade.

**MEDIDO,** e liga direto ao pedido do dono de que o Satoshi Visionary tenha o melhor
ponto: o meio do arco fica em **51,25°** e o centro da baía em **52,5°**. Quem estiver ali
olha o centro da baía e a cidade de frente, no ponto mais distante das duas entradas.

```
Satoshi Visionary   88 lotes = 53,3° do arco
BTC Maximalist      99 lotes = 59,9°
projeto (5 x 5)     25 lotes = 15,1°
                            ────
                            128,3° de 130,5° disponíveis
```

Proposta em cima da mesa (NÃO decidida): SV centrado no meio, ocupando de **24,6° a
77,9°**, com BM nos dois flancos, 30° de cada lado. Simétrico.

**P2 — A ordem dentro da fileira de trás.** Mesma pergunta para os 258 Rune Master.

**P3 — Onde caem os 5 blocos do projeto** dentro do arranjo de P1.

**P4 — O programa de cada bloco** do projeto (qual é marina, qual é clube, qual é píer).

**P5 — A regra de encaixe coorte × geometria.** Os 445 são de hoje; no snapshot podem vir
440 ou 456. Se vierem MENOS, os lotes que sobram são reserva do projeto e o caso é
trivial. Se vierem MAIS, é preciso escolher entre alargar o número de lotes ou cortar por
saldo dentro do tier de menor prioridade. As duas opções estão abertas.

**P6 — Os tiers 4 a 12.** Nenhum tem posição. O caso grande é Diamond Paws (19.289, 22,5%
de quem tem tier): é o cinturão da cidade e a homogeneidade dele é característica, não
defeito. **MEDIDO:** 17.865 carteiras têm 889.806 DOG exatos, 869,2 dias, 1 UTXO e 100%
LTH, ou seja são indistinguíveis em todo eixo disponível.

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
