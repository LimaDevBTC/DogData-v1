# Orçamento de terra da DogCity, sítio de raio 4.500

> ## ⚠️ SUPERADO EM 01/09/2026. LEIA ISTO ANTES DO RESTO.
>
> Este documento mede a cidade de **raio 4.500 m com 52.991 carteiras**. Em
> 31/08 o sítio foi para **raio 7.000** e o corte de 20.000 DOG caiu, então
> **toda carteira com qualquer DOG recebe lote**. Praticamente todo número
> abaixo está desatualizado por um fator grande.
>
> O documento continua valendo como REGISTRO DE DECISÃO: o raciocínio, os
> critérios e as armadilhas seguem bons. O que não vale mais é a aritmética.
>
> Números correntes, medidos em 01/09 contra `public/city/cidade.json` e os 180
> vértices de `public/city/cidade-malha.json` -> `contorno`:
>
> | | antes (este doc) | agora |
> |---|--:|--:|
> | raio do sítio | 4.500 m | 5.983 a 7.571 m |
> | área do sítio | 63,617 km² | **149,250 km²** |
> | carteiras | 52.991 | **85.843** |
> | tecido disponível | 25,522 km² | **47,298 km²** |
> | área de lote | 21,140 km² | **30,359 km²** |
> | lote mediano | 315 m² | **238 m²** |
> | **tecido livre** | 4,382 km² | **16,939 km²** |
>
> E o cinturão de reserva fora da cidade **acabou**: a cúpula tem 156,145 km² de
> disco contra 149,250 km² de sítio, e ela recorta no contorno, não no raio. Não
> existe mais terra sobrando fora do tecido. Ver `app/city/plaza/dome.ts`.


Decisão fechada em 2026-08-28, contra `scripts/gerar_cidade.py` md5
`eebceca231aab4a40ce0ad9aa6ce2b9c` (mtime 22:33:57) e `public/city/cidade.json`
(mtime 22:34:03). O arquivo é alvo móvel: durante esta rodada de análise o gerador
foi editado e a cidade foi regravada cinco vezes, e as duas primeiras medidas desta
decisão (amplitude 0 e ritmo por setor) **já entraram em HEAD às 22:33:57**, antes
deste documento. Todo número abaixo é medido contra esse estado ou declarado
NÃO MEDIDO.

Todas as rodadas de gerador citadas foram feitas com uma cópia de HEAD com apenas
variáveis de ambiente acrescentadas (`RB`, `PROG`, `BIS`, `TOL`), em
`/tmp/claude-1000/-home-bitmax-Projects-bitcoin-fullstack/a7947692-66ae-4ac7-bf51-3673fd2fc258/scratchpad/sint/h.py`.
As medições de terra são raster disjunto de 4 m sobre o disco de 4.500 m,
3.976.044 amostras, 63,617 km² amostrados contra 63,617 km² analíticos
(`.../scratchpad/sint/medir2.py` e `.../scratchpad/sint/anal.py`).

---

## 1. A decisão, em uma frase

O contorno lobado morre (amplitude 0, já em HEAD) e a modulação de cinco passa a
viver no ritmo com que cada setor enche; a terra recuperada vira lote até o raio
4.400, os 100 m entre 4.400 e 4.500 viram o **Cinturão**, que é verde de borda mais
o pé da saia da abóbada, o programa cívico entra como máscara **antes** do lote
(cinturão e programa juntos custam 0,85 km² de lote contra HEAD), e a Regra 7 muda
de base: deixa de ser metade do
sítio e passa a ser **metade do tecido urbano**, 56,21% de lote medidos contra
48,87% no estado que abriu esta discussão.

Configuração decidida, gerador rodado de verdade: amplitude 0, ritmo 0,45, borda
construída 4.400, programa mascarado 1,169 km², bisseção fina. Resultado:
**52.991 de 52.991 plantadas, lote 21,140 km², mediana 315 m²**
(`RB=4400 PROG=1 BIS=20 TOL=0.002 python3 .../sint/h.py`).

### Os três estados, lado a lado

| | briefing (AMP 0,12) | HEAD 22:34 (AMP 0) | DECIDIDO (AMP 0 + cinturão + programa) |
|---|---|---|---|
| amplitude do contorno | 0,12 | 0 | 0 |
| borda construída | 4.480 m | 4.480 m | 4.400 m |
| programa mascarado | 0 | 0 | 1,169 km² |
| tecido (prateleira) | 21,577 km² | 27,352 km² | 25,522 km² |
| **área de lote** | **15,547 km²** | **21,989 km²** | **21,140 km²** |
| mediana do lote | 227 m² | 322 m² | 315 m² |
| menor / maior | 30 / 42.840 m² | 39 / 42.840 m² | 33 / 42.840 m² |
| p99 | 1.496 m² | 2.136 m² | 2.047 m² |
| lotes no piso de 5 m de frente | 20,2% | 12,6% | 13,7% |
| lotes abaixo de 100 m² | 11,4% | 5,4% | 6,1% |
| ocupação da prateleira (área) | 71,8% | 80,4% | 82,8% |
| testada ocupada | 623,1 de 863,1 km (72,2%) | 861,1 de 1.094,1 km (78,7%) | 828,9 de 1.020,9 km (81,2%) |
| portas por 100 m de testada | 8,5 | 6,2 | 6,4 |
| R² coorte contra raio | 0,8004 | 0,6132 | 0,6276 |
| coorte 0: fatias de 10° tocadas | 35 de 36 | 28 de 36 | 26 de 36 |
| faixa p10-p90 de raio da coorte 0 | 304 m | 806 m | 777 m |
| raio máximo de lote | 3.995 m | 4.462 m | 4.398 m |
| raio mediano de lote | 2.379 m | 2.660 m | 2.615 m |
| quartos / quarteirões | 196 / 980 | 235 / 1.239 | 226 / 1.169 |
| k da curva | 0,189425 | 0,237962 | 0,229679 |

Fonte: coluna 1 reproduzida por mim com `AMP=0.12` (reproduz o `cidade.json` do
briefing nos totais e no k, 0,18942467676062064; o binário daquele estado já tinha
sido sobrescrito e não pude comparar md5); coluna 2 é `public/city/cidade.json` de HEAD
mais análise minha do `public/city/cidade-lotes.bin`; coluna 3 é a rodada
`h4400pf`. Onde o json e o binário divergem, é arredondamento de frente e
profundidade a inteiro: lote 21,140 no json contra 21,110 no binário (0,14%),
mediana 315 no json contra 325 recontada no binário.

---

## 2. A tabela do orçamento

Configuração decidida. Classes exclusivas, cada metro quadrado num balde só, na
ordem da máscara do gerador.

| # | Uso | km² | % do sítio | fonte |
|---|---|---|---|---|
| 1 | Lote de holder, 52.991 lotes | 21,140 | 33,23 | `cidade.json` da rodada `h4400pf` (`areaLotes_km2`); binário dá 21,110 |
| 2 | Parque Runestone, parte dentro do sítio | 12,384 | 19,47 | raster; lente analítica para d 5.200, R 4.500, r 3.600 dá 12,385 |
| 3 | Alameda local de 12 m, a rua que só serve o lote | 4,754 | 7,47 | raster |
| 4 | Prateleira urbanizada e não ocupada | 4,364 | 6,86 | 25,504 do raster menos 21,140 de lote |
| 5 | Terra brava, declive acima de 4° | 3,751 | 5,90 | raster sobre `public/lunar/btc-core-heightmap.f32` |
| 6 | Praça de quarto, 226 quartos | 3,600 | 5,66 | raster (contagem disjunta; malhas de setores vizinhos se sobrepõem na costura) |
| 7 | Travessa plantada dentro dos 1.169 quarteirões | 3,101 | 4,87 | raster |
| 8 | Platô da Praça Central, r ≤ 960 m | 2,895 | 4,55 | raster; `scripts/gerar_cidade.py:49` |
| 9 | Rampa do platô, 960 a 1.300 m | 2,414 | 3,80 | raster |
| 10 | **Cinturão, 4.400 a 4.500 m** | 2,097 | 3,30 | raster; 1,881 km² dele com declive até 4° |
| 11 | **Reserva do Programa Cívico** | 1,169 | 1,84 | raster; **posições provisórias**, ver ressalva 2 |
| 12 | Bulevares, 12 costuras de 34 m | 0,967 | 1,52 | raster |
| 13 | Resíduo do tecido, 185 enclaves e sobras de quarteirão | 0,646 | 1,02 | raster |
| 14 | Reserva do Coliseu congelado | 0,333 | 0,52 | raster; `scripts/gerar_cidade.py:65-67` |
| | **TOTAL** | **63,615** | **100,01** | |

**Resíduo declarado:** a tabela soma 63,615 km² contra 63,617 km² do sítio
(π × 4.500²). Faltam **0,002 km², 2.000 m²**, e isso é arredondamento a três casas
decimais, não terra perdida. A coluna de porcentagem, arredondada a duas casas,
soma 100,01%.

Duas leituras derivadas da mesma tabela:

- **Terra verde ou aberta do projeto** (linhas 2, 5, 6, 8, 9, 10, 13):
  27,787 km², 43,68% do sítio, 524,4 m² por carteira.
- **Terra que o holder tem em nome dele mais a rua que só serve ele**
  (linhas 1, 3, e 11 de 34 do bulevar da linha 12, que é a fração que
  `plano-diretor.md:49` chama de sobrelargura de mobilidade): 26,207 km², 41,20%.

---

## 3. O que a Regra 7 passa a significar

### Onde ela foi enunciada

A frase travada é do fundador e está em `fundacao.md:299-301`: *"a cidade será
composta por 50% existente e 50% reservado pra nós, pode ser parque e praça por
enquanto"*, e a linha seguinte diz que o reservado é ao mesmo tempo o verde da
cidade e o estoque para negociar com coleções parceiras. **A frase não nomeia
denominador.**

Correção de procedência, porque o briefing atribui a regra ao masterplan §9:
`masterplan.md` tem **zero** ocorrências de "50/50" e de "metade"
(`grep -c -i` sobre o arquivo). O rótulo "Regra 7" existe em um único lugar,
`plano-diretor.md:641`. A tabela que escolheu o denominador está em
`plano-diretor.md:44-66`, e ela escolheu o **sítio bruto**.

### A regra MUDA. Base nova: o tecido urbano

A leitura antiga (metade do sítio bruto) morre, e morre por aritmética, não por
gosto. `plano-diretor.md:46-49` define a metade do holder como lote **mais** alameda
local **mais** sobrelargura de bulevar, e nessa definição:

| estado | metade do holder | % do sítio | teto com prateleira 100% | teto com os 97% que o próprio gerador escreve |
|---|---|---|---|---|
| briefing, AMP 0,12 | 19,895 km² | 31,27% | 25,906 km² = 40,72% | 25,260 km² = 39,71% |
| HEAD 22:34, AMP 0 | 27,390 km² | 43,06% | 32,745 km² = 51,47% | 31,925 km² = **50,18%** |
| DECIDIDO | 26,207 km² | 41,20% | 30,571 km² = 48,05% | 29,806 km² = **46,85%** |

Metade do sítio são 31,808 km². Leitura: com o lobo em 0,12 a regra era
**impossível**, não descumprida, porque nem com empacotamento perfeito e zero rua a
mais o lado do holder passava de 40,72%. Sem o lobo ela vira teoricamente possível
(50,18% com 97% de prateleira ocupada), mas só num disco cheio sem cinturão e sem
uma única máscara cívica, e o melhor empacotamento que já medi é 82,8%. Com o
cinturão e o programa cívico o teto cai para 46,85% e a entrega é 41,20%. Ou seja: a
leitura de sítio bruto não é alcançável em nenhuma configuração que ainda tenha
Parque Runestone, platô, cinturão e cívico.

E ela nunca foi área de lote: na própria tabela original, `plano-diretor.md:47` põe
o lote em **42,43%** do sítio, não em 50%.

**A Regra 7 v2, em duas cláusulas:**

1. **Na rua: metade do tecido urbano é lote de holder.** Tecido urbano é
   prateleira mais travessa mais alameda mais praça de quarto mais resíduo, tudo
   dentro da borda construída. Medido: briefing 15,547 de 31,811 = **48,87%**;
   HEAD 22:34 21,989 de 40,160 = **54,75%**; decidido 21,140 de 37,605 = **56,21%**.
   É o número que o fundador vê andando: metade do chão da cidade é lote de alguém,
   a outra metade é rua, travessa e praça. Não é tautologia: o tecido é definido
   pela máscara e pela malha, não pelos lotes, e o mesmo tecido já produziu 48,87%
   e 56,21%.
2. **O lado do projeto é estrutura, não mercadoria.** `fundacao.md:300-301` diz que
   o reservado também serve de estoque para coleções parceiras, e isso continua
   valendo, mas o **tamanho** do estoque é o que `masterplan.md:281-283` escreve
   (cerca de 25 parcelas, menos de 1% da área, ou seja menos de 0,636 km² no sítio
   de hoje), não os 50%. Parque, platô, cinturão, terra brava e programa cívico não
   são estoque de venda.

O que a regra protegia continua protegido e agora com número: verde, mobilidade e
esporte entram antes do lote (`fundacao.md:329-334` e a regra de ouro de
`masterplan.md:268-269`), e a linha 11 da tabela é a primeira vez que isso vira
máscara de verdade no gerador.

### Onde o júri discordou sobre a base

Os três jurados escolheram a mesma aposta vencedora (7,5 / 8,5 / 8) e discordaram
sobre o denominador.

- A aposta **pétala-gorda** mediu com lote mais alameda mais sobrelargura contra o
  sítio bruto e declarou a regra aritmeticamente impossível, teto de 40,52% com o
  lobo. Eu meço 39,71% com a alameda amostrada em vez de estimada. Mesma conclusão.
- A aposta **verde-estrutural** mediu máscara contra terra livre, achou 31,807
  contra 31,810 km² e declarou a regra já cumprida com 0,005% de diferença. O
  jurado de regras respondeu que isso é artefato de `LOBO_AMP`: com o lobo a terra
  livre é 50,01% do sítio e sem ele é 63,13%. **Eu confirmo pelo tecido:** ele mede
  31,811 km² (50,00% do sítio) com amplitude 0,12 e 37,605 km² (59,11%) na
  configuração decidida. A coincidência morre junto com o lobo, e por isso não pode
  virar lei.
- Nenhuma das duas propôs a base que adotei. A escolha é minha e está declarada
  como mudança de regra, não como descoberta.

---

## 4. A forma

**Pétalas: zero. Amplitude do contorno: 0. A borda construída é um círculo em
4.400 m, dentro de um sítio que continua com 4.500 m.**

### O que vira as reentrâncias

Elas deixam de existir como terra. Medido no meu raster, a classe "fora do contorno
lobado" valia **10,294 km²** com amplitude 0,12 e vale **2,097 km²** na configuração
decidida, que é o Cinturão. Os 8,197 km² que mudaram de dono foram para:
prateleira +3,946, programa cívico +1,169, terra brava +1,314 (era terra íngreme
escondida atrás do lobo, e agora aparece), alameda +0,745, praça de quarto +0,565,
travessa +0,472, resíduo +0,066, bulevar -0,082. A soma fecha em 8,195, com 0,002
de arredondamento.

A modulação de cinco não morre, **migra para o tempo**. Cada setor consome a sua
prateleira com peso `1 + 0,45 · cos(5 · (rumo da costura - 18°))`
(`scripts/gerar_cidade.py:372-374`), então setor de peso alto enche devagar, a
frente de idade dele fica para trás e a mesma coorte cai em raios muito diferentes,
que é exatamente o que a regra 2 pede. Preço em terra: **zero**. Medido em rodada
isolada, com a forma divisiva do ritmo, ele até **acrescenta** 0,34 km² de lote
(22,01 sem ritmo contra 22,35 com, mesma bisseção), porque tira área de setor
saturado e dá a setor faminto. A mesma isolação com a forma de HEAD: NÃO MEDIDA.

O anel, medido: R² de coorte contra raio cai de **0,8004** para **0,6276**, a coorte
mais antiga deixa de fechar a volta (35 de 36 fatias de 10° passam a 26 de 36) e a
faixa p10-p90 de raio dela vai de **304 m para 777 m**.

### Por que o lobo tinha de morrer, medido

1. Ele custava **5,775 km² de prateleira** e **91 m² de lote mediano** e não
   entregava a forma: no Fourier do envelope p95 do raio em 72 faixas de 5°, o
   harmônico k=5, que são as cinco pétalas, valia 183 m pico a pico contra os
   1.075 m pedidos (2 × 0,12 × 4.480), atrás de k=1 (636 m), k=2 (543), k=3 (382) e
   k=4 (236). Medição do jurado de regras e do jurado de produto, coincidentes.
2. Ele não quebrava o anel, que era a justificativa escrita: com o lobo ligado o R²
   era 0,8004 e a coorte 0 fechava 35 das 36 fatias.
3. A "cunha verde que entra até perto da praça" do comentário de
   `scripts/gerar_cidade.py:80-82` nunca existiu: o piso da reentrância está em
   4.480 × 0,76 = **3.404,8 m** e `R_INICIO` é 1.300 m. A cunha para 2.104,8 m antes
   do precinto.
4. A prancha nunca desenhou o contorno lobado: `app/city/plan/cidade/cidade-client.tsx:116`
   desenha um arco de raio `meta.raioSitio`.

Registro para ninguém reconstruir o lobo com o mapa errado: as duas apostas
discordaram sobre qual pétala o Parque Runestone come, e a verde-estrutural errou.
`raio_borda` usa `atan2(z, x)` e `rumo_de` usa `atan2(x, -z)`, então
rumo = (θ + 90°) mod 360, e os cinco vales caem nos rumos **144, 216, 288, 0 e 72**.
O parque está no rumo 43, logo os vales que ele come são os de rumo 72 e rumo 0, e
não o de "54 graus" que a verde-estrutural cancelou. O jurado de regras está certo
(2,867 km² vivos naquele vale).

### O Cinturão

Anel contínuo de 100 m entre a borda construída (4.400) e a borda do sítio (4.500),
**2,097 km² líquidos**, dos quais 1,881 km² com declive até 4°, cortado pelos 12
bulevares. Ele tem três funções medidas:

1. **Segura o pé da saia da abóbada.** `DOME_R = 4500` em `app/city/plaza/dome.ts:35`
   e a saia desce ali até o relevo. No disco cheio o lote mais externo vai a
   **4.462 m** em HEAD e a **4.479 m** na rodada com bisseção fina, contra
   `R_ABOBADA = 4.480` (`scripts/gerar_cidade.py:73`): sobra 1 m de folga. Com o
   cinturão o lote mais externo para em **4.398 m** e sobram 102 m. Lote atribuído
   não se desfaz, e essa colisão era o risco que a aposta vencedora deixou marcado
   como NÃO MEDIDO.
2. **É verde de borda contínuo**, que é a única forma de reserva que atende a
   exigência de contiguidade de `plano-diretor.md:641-642`.
3. **Tem precedente escrito no próprio plano**: `plano-diretor.md:62` já traz
   "Cinturão de borda e verge de costura (resíduo verde), 0,631 km²" como linha 15
   da metade do projeto.

**Preço do cinturão, medido.** Contra HEAD como ele está hoje (bisseção grossa),
cinturão mais programa custam 0,85 km² de lote e 7 m² de mediana: 21,989 e 322 no
disco cheio, 21,140 e 315 com os dois. Isolando com a mesma bisseção fina nas três
rodadas: disco cheio 22,392 e 331, só cinturão 21,211 e 308, cinturão mais programa
21,140 e 315. Ou seja o cinturão sozinho custa 1,181 km² e 23 m², e o programa
acrescentado a ele não custa área mensurável (0,071 km², dentro do ruído da
bisseção, que vale 0,40 km²).

**O que o Cinturão NÃO é:** ele tem 100 m de largura e não segura o estádio de
20.000 lugares, que é 220 × 150 m (`plano-diretor.md:383`), nem a arena coberta de
12.000, 160 × 140 m (`plano-diretor.md:384`), nem um bairro de coleção parceira, que
pede um quarto de 540 m. Por isso o programa grande entra no tecido, e paga.

### Onde o júri discordou sobre a forma

- O jurado de **urbanismo** queria a borda construída em 4.200, e mediu 19,252 km²
  de lote e mediana 281 nessa configuração. Eu meço 19,386 e 280 com bisseção fina,
  com cinturão de 4,143 km². O argumento dele é Adelaide 1837, onde o vazio é a
  forma (fonte externa que **eu não conferi**).
- Os jurados de **produto** e de **regras** queriam o disco cheio até 4.480, porque
  cidade que encosta na cúpula vende lote e cidade flutuando num vazio preto não.
  Eu meço 22,392 e 331 nessa configuração.
- Decidi 4.400. É o ponto onde o cinturão custa 0,85 km² de lote e 7 m² de mediana;
  ir para 4.300 custaria **2,90 km² de lote e 42 m² de mediana** por 2,05 km² de
  cinturão a mais (série de bisseção fina medida com a forma anterior do ritmo,
  divisiva e no centro do setor, não com a de HEAD). Não há consenso aqui e o
  número que decide é esse.
- Discordância sobre a calçada, sem consenso: portas por 100 m de testada caem de
  8,5 para 6,4 e a frente mediana sobe de 9 para 12 m. Urbanismo lê isso como perda
  de caminhabilidade; produto lê a queda dos lotes de 5 m de frente de 20,2% para
  13,7% como ganho de silhueta. Os dois números são a mesma mudança. Fico com o
  lado do produto, porque uma tira de 5 × 25 m não vira prédio na cena 3D, e
  registro que a objeção do urbanismo não foi respondida com número.

---

## 5. O que muda no código

Contra `scripts/gerar_cidade.py` md5 `eebceca231aab4a40ce0ad9aa6ce2b9c`. Cito
linha **e** texto literal, porque o arquivo se mexeu cinco vezes hoje e a linha pode
ter andado.

### Já aplicado em HEAD às 22:33:57, não refazer

- `scripts/gerar_cidade.py:87`, `LOBO_AMP = 0.0`. Feito.
- `scripts/gerar_cidade.py:372-374`, `RITMO_LOBOS, RITMO_AMP = 5, 0.45` e
  `peso_setor`, com o consumo em `:387` (`folga = (capg[s] - usado[s]) / capg[s] * peso_setor[s]`).
  Feito, e a forma de HEAD (multiplicativa, ângulo da costura) mede **melhor** que a
  que a aposta propôs (divisiva, centro do setor): R² 0,6132 contra 0,6468 na minha
  rodada. **Manter a de HEAD.**
- A conferência de máscara no ponto gravado (`:475-496`) e o conserto da rotação
  dupla (`:507-519`). Feito. A frente verde-estrutural mediu que isso removeu
  5,1 km² de lote falso (20,648 para 15,547 km²), lote que estava plantado dentro do
  Parque e do Coliseu; medição dela, não minha. O que eu confirmo no binário de HEAD
  é o resultado: **0 lotes dentro do disco do Parque, 0 dentro do Coliseu**.

### 1. O Cinturão: a borda do lote deixa de ser a borda do sítio

`scripts/gerar_cidade.py:73`, hoje `R_ABOBADA = R_SITIO - 20`. Passa a ser duas
constantes:

- `R_BORDA_LOTE = 4400.0`, a borda construída. (O `os.environ.get('RB', ...)` que
  usei nas medições é do harness, não é para entrar no repo.)
- O comentário de `:69-72` ainda diz que a casca fecha em 3.500 e que 3.480 deixa a
  calçada de serviço. Está errado por 1.000 m: `DOME_R = 4500` em
  `app/city/plaza/dome.ts:35`. Reescrever dizendo que a abóbada fecha em 4.500, o
  lote para em 4.400 e os 100 m entre as duas são o Cinturão.

Os três usos acompanham: `:91` (`raio_borda` devolve `R_BORDA_LOTE` constante, e com
`LOBO_AMP = 0` a função inteira pode virar uma linha), `:333` (`_mg`, o raio médio da
curva) e `:605` (`'raioBorda': R_ABOBADA` no json, que passa a gravar os dois).

**Não mexer em `lib/city/lunar/sites.ts:73`**, que grava `4500, 4`: o sítio continua
com 4.500 m e o Cinturão é interno. **Não mexer em `app/city/plaza/dome.ts:35`.**

### 2. O bloco PROGRAMA, e ele entra em `livre()`

Novo bloco depois do bloco do Coliseu (`scripts/gerar_cidade.py:58-67`), no mesmo
formato: lista de peças com id, tipo, centro, meio-eixos, rotação e prioridade
P1/P2/P3, alimentada por `masterplan.md:206-263` e `plano-diretor.md:358-384`.

Novo teste em `livre()` (`scripts/gerar_cidade.py:153-168`), antes do teste de
declive, e uma função `assert_programa_vazio()` chamada depois da bisseção,
conferindo que nenhum dos 52.991 lotes gravados cai dentro de peça.

**Divergência declarada com a aposta verde-estrutural:** ela propôs que a peça só
pudesse pousar onde `livre()` já devolve False, com custo zero de lote. Com
amplitude 0 não existe mais cunha e essa regra fica sem onde pousar: sobram 2,097
km² de cinturão com 100 m de largura e 0,646 km² de resíduo em migalhas. Então o
programa entra em `livre()` e **custa**. Medido em duas rodadas independentes, o
mesmo bloco de 1,169 km² custou 0,92 km² de lote numa e 0,07 km² noutra, ou seja o
preço está dentro do ruído da própria bisseção, que vale 0,40 km² (h4480 contra
h4480f). A regra de ouro de `masterplan.md:268-269` (equipamento vira zona reservada
ANTES do lote) passa a estar cumprida pela primeira vez: hoje **zero** dos 39
equipamentos é máscara.

### 3. A bisseção: piso provado e tolerância fina

- `scripts/gerar_cidade.py:546`, `for tentativa in range(6)` vira `range(20)`.
- `scripts/gerar_cidade.py:561`, `if (k_hi - k_lo) / k_lo < 0.02: break` vira
  `< 0.002`. Vale 0,40 km² de lote e 9 m² de mediana (21,989 e 322 contra 22,392 e
  331, mesma configuração).
- `scripts/gerar_cidade.py:545`, `k_lo, k_hi = K_AREA, None` assume que o k inicial
  cabe, e ele nem sempre cabe. **Defeito medido:** com a borda em 4.300 a passada 1
  não cabe (52.988 de 52.991), a bisseção não tem piso para dividir, sai pelo
  `:561` na primeira volta e o script **grava uma cidade com 3 carteiras sem
  endereço e sai com código 0**. Conserto: quando `k_bom is None` e não coube,
  `K_AREA *= 0.85`, `k_lo = K_AREA` e continua. Com esse conserto a mesma borda
  4.300 planta **52.991 de 52.991**, com lote de 19,386 km² contra os 19,78 km² que
  a versão quebrada gravava faltando 3 endereços.

### 4. Nunca perder carteira em silêncio

`scripts/gerar_cidade.py:532`, `if r is None: continue`. A regra é inegociável
(todo elegível tem endereço) e o gerador a viola calado. Trocar por erro que aborta
a gravação, ou no mínimo por contador que faz o script sair com código diferente de
zero.

### 5. O lote gigante grava o centro deslocado depois de conferir a máscara

`scripts/gerar_cidade.py:461` confere `livre(_cx, _cz)` e `:464` desloca
`ozg = pr['oz'] + (tomadas - 1) * PROF * 0.56` **depois** da conferência.
**Defeito medido:** numa rodada de borda 4.400 sem programa (harness com a forma
anterior do ritmo), 1 lote de 26.712 m² (frente 168, profundidade 159) ficou gravado
em (-2054, 1795), **dentro** da elipse do Coliseu que o fundador mandou guardar
vazia, e `livre()` naquele ponto devolve False. No binário de HEAD de hoje o defeito
está latente, não ativo: contei 0 lotes no Coliseu. Ele depende de qual carteira cai
no ramo do gigante, então some e volta a cada rodada. Conferir a máscara no ponto
final, depois do deslocamento.

### 6. Matar a constante morta

`scripts/gerar_cidade.py:100`, `TECIDO_ALVO = 16.33e6  # m² da metade do holder`.
Uma única ocorrência no arquivo, nunca lida (o alvo real é `CAP_AREA * 0.97` em
`:543`), e é a linha de lote do sítio de 3.500 m, ou seja a origem de metade da
confusão sobre o 50/50. Apagar. As duas apostas pediram isso.

### 7. O gerador passa a emitir o orçamento

`scripts/gerar_cidade.py:594-617` grava o json. Acrescentar um campo `orcamento`
com as 14 linhas medidas mais `tecidoUrbano_km2`, `loteSobreTecido` e
`metadeDoHolder_km2`. Enquanto esse balanço for refeito à mão a cada sessão, ele vai
continuar aparecendo como 16,82 numa frente, 20,648 noutra, 15,547 na terceira e
21,989 no arquivo. Eu vi cinco valores diferentes numa tarde.

### 8. Comentários que mentem e precisam cair junto

- `scripts/gerar_cidade.py:33-34`: diz que o heightmap tem 137 células e meia
  largura de 4.027 m. Medido em `public/lunar/btc-core-heightmap.json`: **177**
  células de 59,2253 m, meia largura **5.211,8 m**. O dado tem 21,7 km² de folga
  além do sítio, e o comentário diz que não tem.
- `scripts/gerar_cidade.py:53`: diz que o spaceport foi para o raio 4.400. Somando
  `SPACEPORT_SHIFT` de `app/city/plaza/orbit-layer.ts:38` à posição antiga, o raio
  real é **5.150 m**. Com a borda do lote indo para 4.400, esse comentário passa a
  ser perigoso.
- `scripts/gerar_cidade.py:75-86`: o parágrafo inteiro que justifica o lobo. Ele
  ficou como registro do que foi tentado, mas tem de dizer que a amplitude é 0 e por
  quê, com os números da seção 4 deste documento.

### 9. A prancha

`app/city/plan/cidade/cidade-client.tsx`:

- `:116` desenha um arco em `meta.raioSitio` e nada mais. Passa a desenhar **dois**
  círculos, 4.400 e 4.500, com o Cinturão entre eles preenchido, mais as peças do
  PROGRAMA e a reserva do Coliseu, que hoje têm **zero** desenhos.
- `:31` o tipo `Meta` ainda declara `lote_m2`, campo que saiu do json.
- `:41` e `:131` o modo de pintura `forma` existe na paleta e no desenho, e a lista
  de botões em `:208` tem 3 itens. Ou ganha botão, ou sai.
- `:133-134` desenha os lotes como retângulos alinhados aos eixos, sem a rotação de
  setor: a malha girada de 7,5° não aparece.
- `:198-201` a legenda diz que a diferença de fundura entre setores "é ela que
  impede o anel". Agora quem impede o anel é o ritmo, e o número é R² 0,6132 contra
  0,8004. Trocar a copy.

---

## 6. O que fica em aberto, com preço

1. **Onde ficam as peças do programa cívico.** As quatro que usei (discos de 305 m
   nos rumos 120, 210, 270 e 330, a r 3.000) são **sonda de preço, não projeto**.
   Preço medido do bloco de 1,169 km²: entre 0,07 e 0,92 km² de lote, dentro do
   ruído da bisseção. Preço de escolher errado: `masterplan.md:36-37` diz que lote
   não se move, então peça mal colocada é definitiva.
2. **Largura do Cinturão.** Medido com bisseção fina e o ritmo de HEAD:
   4.480 → lote 22,392, mediana 331, cinturão 0,424 km²; 4.400 → 21,211 / 308 /
   2,097. Medido com bisseção fina e a forma anterior do ritmo:
   4.300 → 19,386 / 280 / 4,143; 4.200 → 19,150 / 279 / cinturão **NÃO MEDIDO** por
   raster (anel bruto analítico 8,20 km²). As duas séries não são comparáveis linha
   a linha, e a série de HEAD para em 4.400: **fechar 4.300 e 4.200 com o ritmo de
   HEAD é uma rodada de 30 s e ainda não foi feita.** Na série antiga, sair de 4.400
   para 4.300 custou 2,90 km² de lote e 42 m² de mediana.
3. **A cauda de duas ou três carteiras que trava o k de todo mundo.** Medido: na
   borda 4.300 a bisseção para porque 2 carteiras em 52.991 não acham prateleira, e
   isso segura o k em 0,2186 contra 0,2407 na borda 4.400. **Preço da pergunta:
   2,90 km² de lote e 42 m² de mediana dependem de duas carteiras.** Como consertar
   sem quebrar a regra 1 (a posição vem da idade): NÃO MEDIDO.
4. **Mover o Parque Runestone.** A desigualdade entre setores não melhora com nada
   nesta decisão: o setor 2 tem 15,8 ha de capacidade contra 309,9 ha do setor 9,
   **19,6 vezes**, porque o disco do parque cai inteiro sobre os setores 1, 2 e 3.
   Preço analítico de afastar o parque, pela fórmula da lente: a 5.200 m ele ocupa
   12,385 km² do sítio; a 6.000 m ocupa 7,771 (devolve 4,614); a 6.800 m ocupa
   3,850 (devolve 8,535); some do sítio a 8.100 m. Custo em obra do parque
   construído (cordilheira, 558 pedras, tour de 150 frames em `blender/`): NÃO
   MEDIDO. Ou o parque anda, ou o nordeste é o lado vazio da cidade, e ninguém deve
   prometer o contrário.
5. **Bairro contíguo para coleção parceira.** `plano-diretor.md:641-642` exige
   reserva contígua e o Cinturão de 100 m não segura um quarto de 540 m. Preço
   DERIVADO de reservar 4 quartos dentro do tecido: 1,166 km² brutos, cerca de
   0,9 km² de lote. NÃO MEDIDO diretamente.
6. **Quantas carteiras mudam de endereço.** O ritmo troca o setor de destino sem
   tocar na ordem de idade, e o endereço S-Q-B-L muda para um número desconhecido de
   carteiras. **NÃO MEDIDO.** Janela para aplicar: antes de inscrever qualquer lote.
   Depois do primeiro mint isso deixa de ser possível.
7. **O piso de 5 m de frente.** 13,7% dos lotes na configuração decidida, 20,2% no
   estado do briefing. 5 × 25 m é proporção de casa de canal de Amsterdã e pode ser
   um bom tipo, mas hoje é recorte de curva, não tipo desenhado
   (`scripts/gerar_cidade.py:101`). Preço de subir o piso para 8 m: NÃO MEDIDO.
8. **As 12 peças obsoletas do programa cívico.** Oito dependem de porto, orla, lago
   ou ilha num mare sem água (`masterplan.md` itens 4, 23, 25, 26, 30, 32, 36, 37),
   duas morreram com a abóbada e o spaceport fora do sítio (21 e 22) e duas por a
   cidade já estar na Lua (9 e 39). Se forem apagadas em vez de reinterpretadas, o
   programa cai de 39 para 27 peças e a linha 11 da tabela encolhe. Decisão do
   fundador, não minha.
9. **Custo de render do programa.** Estádio, arena de pé-direito 40 m, universidade
   e museu são geometria única, um draw call cada, contra lote que é
   `InstancedMesh`. **NÃO MEDIDO**, nem por instância nem por draw call.

---

## 7. Ressalvas: o que estou afirmando sem ter medido

1. **A sobrelargura de bulevar de 11 de 34 m** é fração escrita em
   `plano-diretor.md:49` e `:58`, aplicada por mim à área de bulevar medida. Não
   amostrei a faixa. Se ela for zerada, a metade do holder cai de 41,20% para
   40,71% e nenhuma conclusão muda.
2. **A tabela da seção 2 é foto de uma configuração**, com o programa cívico nas
   posições de sonda. Trocar as posições mexe nas linhas 1, 3, 4, 5, 6, 7, 11 e 13.
3. **Mediana e área divergem entre json e binário** por arredondamento de frente e
   profundidade a inteiro: lote 21,140 contra 21,110 km² (0,14%), mediana 315 contra
   325. Usei o json para totais e o binário para distribuição espacial.
4. **O declive vem de uma grade de 59,2253 m interpolada.** O jurado de produto
   mediu que um estimador de passo 6 m move a fração de máscara de 50,08% para
   51,27%. A linha 5 da tabela (terra brava) tem incerteza da ordem de 1 ponto do
   sítio, e as linhas vizinhas absorvem essa diferença.
5. **A praça de quarto é contagem disjunta** (3,600 km²), não o produto
   226 × 32.400 m² = 7,322 km²: malhas de setores vizinhos se sobrepõem na costura e
   contei cada metro quadrado uma vez só.
6. **Não medi a geometria 3D da saia da abóbada** dentro dos 100 m do Cinturão.
   Medi só o raio do lote mais externo (4.398 m contra `DOME_R` 4.500).
7. **Não medi o Cinturão em 4.200 por raster**, só o anel bruto analítico.
8. **Não medi quantas carteiras trocam de setor** com o ritmo, nem o efeito disso
   nos 185 enclaves de família e no condomínio do DSC.
9. **Não conferi as fontes externas dos precedentes** (Adelaide 1837, Palmanova,
   Chandigarh, Washington). Elas aparecem no dossiê dos jurados e não sustentam
   nenhum número desta decisão.
10. **Não medi nada de custo de render.** O teto de "300.000 instâncias e 5 draw
    calls a 66 fps" citado em conversa não foi localizado em
    `app/city/plaza/perf.ts` nem em `plaza-scene.tsx`.
11. **As comparações de norma** (OMS, Fields in Trust, London Plan, Six Acre
    Standard, 3-30-300) estão citadas em `plano-diretor.md:160-208` e eu não abri as
    fontes primárias. O próprio texto já marca a da OMS como atribuição secundária.
12. **Os arquivos de medição estão no scratchpad da sessão** e podem sumir. A
    receita é reprodutível: cópia de HEAD com `RB`, `PROG`, `BIS` e `TOL` como
    variáveis de ambiente, mais o raster de 4 m descrito no cabeçalho.
13. **O alvo se move.** `public/city/cidade.json` foi regravado em 21:28:32,
    21:41:13, 21:44:54 e 22:34:03, e `scripts/gerar_cidade.py` mudou entre duas
    leituras minhas, com um bot de auto-commit empurrando por cima
    (`project_dogdata_autocommit_bot`). Qualquer número daqui precisa ser reconferido
    contra o md5 antes de virar obra.
