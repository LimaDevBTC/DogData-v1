# DogCity: Plano Diretor

Mare Tranquillitatis, sítio `btc-core`, raio 3.500 m (`lib/city/lunar/sites.ts:73`).
Versão final, 28/08/2026. Escrito a partir do Plano das 780 Superquadras (vencedor, 23,1
pontos) com os enxertos que os três jurados mandaram trazer da Roseta da Gênese (21,3) e
da Armadura Verde (18,3). Cada número desta página ou foi medido nesta sessão, ou está
marcado como NÃO MEDIDO.

---

## 1. A ideia-mãe

**A cidade é um quarto de 540 por 540 m repetido 81 vezes: oito quarteirões de moradia em
volta de uma praça de 2,82 ha, e a idade do UTXO decide o passo dentro do setor, nunca o
raio dentro da cidade.**

O sítio é cortado em 12 setores de 30°. Cada setor recebe uma malha cartesiana própria,
girada em k vezes 7,5°, e nenhuma via do plano é curva: a face mais longa tem 168,0 m antes
de virar. Dentro de cada setor a regra é absoluta e legível do chão: andando em direção à
Praça Central você atravessa carteiras estritamente mais velhas, sem uma única inversão. O
que impede o anel concêntrico não é ruído nem sorteio, é o fato medido de que os 12 setores
têm profundidades entre 300 m (rumo 45°, espremido pelo Parque Runestone) e 2.200 m
(oeste), de modo que a mesma idade cai em 12 raios diferentes, com espalhamento de até
1.773 m. A moradia ocupa 648 quarteirões de 168 por 168 m com 84 lotes de 300,0 m² cada, e
tudo o mais no tabuleiro, das 81 praças de quarto ao cinturão de borda, é terra do projeto.

---

## 2. Orçamento de terra

Sítio medido: 38,486 km² (π · 3.500² = 38,485). Base de medição: leitura de
`public/lunar/btc-core-heightmap.f32` fora do navegador, malha de amostragem de 8 m,
875 por 875 pontos, exagero vertical importado de `app/city/plaza/vex.ts` (vale 1 dentro do
sítio), platô zerado até 960 m e fundido até 1.300 m, pegada real do parque
`PARK_HALF = 3600` (`app/city/plaza/park-site.ts:21`).

Terra já comprometida, medida célula a célula, com sobreposição zero entre as quatro peças:
**12,401 km²**, 32,22% do sítio.

Terra livre para o plano: **26,085 km²**.

### 2.1 A tabela

| # | Uso | km² | % do sítio |
|---|---|---|---|
| **METADE DO HOLDER** | | **19,240** | **49,99** |
| 1 | Lotes, 54.432 unidades de 300,0 m² | 16,330 | 42,43 |
| 2 | Alameda local de 12,0 m (banda de módulo dos 648 quarteirões) | 2,706 | 7,03 |
| 3 | Sobrelargura de mobilidade dos 12 bulevares (11,0 m × 18.576 m) | 0,204 | 0,53 |
| **METADE DO PROJETO** | | **19,246** | **50,01** |
| 4 | Precinto da Praça Central, r ≤ 910 m, permanente | 2,602 | 6,76 |
| 5 | Rampa do platô, 910 a 1.300 m | 2,708 | 7,04 |
| 6 | Parque Runestone, disco real de 3.600 m a 5,2 km | 6,309 | 16,39 |
| 7 | Spaceport, 845 × 599 m, centro a r 3.156 m | 0,509 | 1,32 |
| 8 | Cratera da Batalha, 760 × 364 m, rumo 225° | 0,274 | 0,71 |
| 9 | Travessas plantadas, 1.296 unidades de 9,0 × 168 m | 1,960 | 5,09 |
| 10 | 81 Praças de Quarto, células inteiras de 180 m | 2,624 | 6,82 |
| 11 | Jardim linear dos 12 bulevares (11,0 m × 18.576 m) | 0,204 | 0,53 |
| 12 | Cívico, 6 células | 0,194 | 0,50 |
| 13 | Reserva de negociação, 6 células em 2 blocos de 3 | 0,194 | 0,50 |
| 14 | Esporte, 8 complexos na orla e na cratera | 1,037 | 2,69 |
| 15 | Cinturão de borda e verge de costura (resíduo verde) | 0,631 | 1,64 |
| | **TOTAL** | **38,486** | **100,00** |

As colunas de porcentagem, arredondadas a duas casas, somam 99,98%; em três casas a soma é
100,00%. A diferença entre as duas metades é de 6.000 m², 0,016%.

### 2.2 O raio NÃO cresce, e o motivo é medido

Fica em 3.500 m, o número de `lib/city/lunar/sites.ts:73`. A frente de aritmética mediu o
sítio inteiro para dez raios até 4.000 m (limite do dado da NASA, a grade tem meia-largura
de 4.027 m). A folga de terra ≤ 3° utilizável sobre a metade do sítio faz pico em **3.700 m
com +0,600 km²**, contra +0,447 km² hoje, e **zera em 3.868 m**. Motivo: o anel de 3.500 a
4.000 m é só 52,4% de terra ≤ 3°, enquanto a metade do sítio cresce com o quadrado do raio.
Crescer 200 m compra 0,153 km². O déficit que este plano precisa cobrir é de 1,85 km².
O raio não é a solução, e por isso não peço raio.

### 2.3 A premissa de declive: ≤ 3° NÃO cabe, e o número é este

Esta é a divergência declarada em relação ao briefing, e ela é aritmética, não gosto.

O tecido de moradia é uma grade de células de 180 m cujo miolo de 168 por 168 m tem que ser
plano de ponta a ponta. A medição por abertura morfológica (erosão seguida de dilatação,
elemento quadrado de 160 m, malha de 8 m) deu:

| Faixa de declive | Terra livre bruta | Utilizável por quarteirão | Células de 180 m, teto teórico |
|---|---|---|---|
| ≤ 2° | 14,793 km² | 8,200 km² | 253 |
| ≤ 3° | 22,014 km² | 19,689 km² | 607 |
| ≤ 4° | 24,548 km² | 23,723 km² | 732 |

O plano precisa de **664 células planas**: 648 de lote mais 16 de folga para os campos
esportivos que exigem piso nivelado. Em ≤ 3° existem no máximo 607, e isso já supondo
empacotamento perfeito, que não existe. **Faltam 57 células, 1,85 km².** Em ≤ 4° existem
732, com 68 células de margem, 9,3%, que é todo o orçamento de perda de costura.

Três consequências, todas com preço:

1. **Adotado: ≤ 4°, lote de 300,0 m².** Terraplenagem leve nos 2,534 km² de terra entre 3° e
   4°. O precedente já está na cena: o platô da praça achata 960 m de raio inteiros
   (`app/city/plaza/vex.ts`). Volume de corte e aterro NÃO MEDIDO.
2. **Alternativa, se o fundador vetar terraplenagem:** manter ≤ 3° e baixar o lote para
   250,0 m² (10,0 × 25,0 m), quarteirão de 170 × 170 m com 6 fileiras de 17 lotes = 102
   lotes, módulo de 182 m. São 524 quarteirões, 53.448 lotes, 17,357 km² de tecido contra
   19,689 disponíveis, folga de 8,8%. Cabe. Preço: o lote encolhe 16,7% e a metade do holder
   cai para 15,575 km², 40,5% do sítio, o que quebra o 50/50 a favor do projeto.
3. **Não adotado: crescer o raio.** Ver 2.2.

### 2.4 A margem de empacotamento, dita sem maquiagem

Chão livre 26,085 km². Chão alocado em células e bulevares: 729 células de 32.400 m²
(23,620 km²) mais a sobrelargura dos bulevares (0,408 km²) mais o esporte da orla
(1,037 km²) mais o cívico e a reserva já contados nas células, total **25,065 km²**. Resíduo
orçado: **0,631 km²**, 2,4% do chão livre.

Isso é otimista e eu digo por quê. A perda de costura entre 12 malhas de azimutes
diferentes foi estimada por um dos jurados em 2,27 km² (12 costuras × 2.200 m × meia célula
de 90 m). Este plano evita a maior parte dessa perda pondo **os 12 bulevares exatamente em
cima das 12 costuras**: as meias-células rasgadas na junta são absorvidas pelo corredor do
bulevar, cuja largura passa a ser variável de 34,0 m a até 100,0 m, e corredor de bulevar já
é terra do projeto. **Essa absorção NÃO FOI MEDIDA e é o portão do passo 0 da obra
(capítulo 8).**

Ordem de encolhimento publicada, se o resíduo medido passar de 0,631 km²:

| Ordem | O que sai | Células liberadas | km² |
|---|---|---|---|
| 1 | Reserva de negociação | 6 | 0,194 |
| 2 | Cívico | 6 | 0,194 |
| 3 | Quarteirões de lote, de 648 para 636 (53.424 lotes, margem 0,8%) | 12 | 0,389 |
| 4 | Taxa de praça, de 1 em 8 para 1 em 9 (81 para 72 praças) | 9 | 0,292 |

O plano aguenta um resíduo de até **1,700 km², 6,5% do chão livre**, sem tocar no lote de
300 m² e sem deixar carteira nenhuma de fora.

---

## 3. O sistema verde

Cinco níveis, todos com área, quantidade e raio medidos. A distância é sempre em metros
caminhados, com fator de rota 1,15 sobre a linha reta, e o tempo é sempre a **0,85 m/s**,
que é a velocidade de projeto lunar (transição andar/corrida por número de Froude 0,5 com
perna de 0,90 m e g = 1,625 m/s², contra 1,20 m/s do Highway Capacity Manual terrestre:
toda isócrona encolhe 29%).

| Nível | Peça | Área unitária | Quantidade | Área total | Distância máxima da porta | Tempo |
|---|---|---|---|---|---|---|
| 1 | Alameda local arborizada, 12,0 m | 6,0 m de faixa central plantada | 253,7 km de eixo | 2,706 km² de caixa | **0 m**, 100% dos lotes testam nela | 0 s |
| 2 | Travessa plantada, 9,0 × 168 m | 1.512 m², 5,0 m de jardim | 1.296 | 1,960 km² | **84 m** (meia face do quarteirão) | 99 s |
| 3 | Praça de Quarto, 168 × 168 m | 2,822 ha | 81 | 2,286 km² de miolo verde | **293 m** até a borda da praça | 5,7 min |
| 4 | Jardim linear de bulevar, 11,0 m | 2,97 ha em média | 12 | 0,204 km² | 890 m no pior rumo | 17,4 min |
| 5 | Cinturão de borda e verge de costura | variável | contínuo | 0,631 km² | encosta na borda externa da cidade, extensão NÃO MEDIDA | contínuo |
| extra | Precinto da Praça Central, r ≤ 910 m | 260,2 ha | 1 | 2,602 km² | 2.200 m do lote mais externo | Parque Metropolitano |
| extra | Parque Runestone, disco real | 630,9 ha | 1 | 6,309 km² | 5,2 km do centro | Parque Regional |

### 3.1 A Praça de Quarto é o coração do sistema

Regra de Oglethorpe, Savannah 1733, com o quarteirão inteiro no lugar do square. Cada quarto
é uma grade de 3 por 3 células de 180 m, ou seja **540 por 540 m, 29,16 ha**. Oito células
são de moradia (672 lotes) e a **célula central é a praça**: 168 por 168 m de verde, 2,822 ha.

Isso compra o degrau que o plano vencedor declarava não ter: o **Local Park do London Plan,
2 ha a 400 m**. Aqui são 2,82 ha a 293 m caminhados. Do canto mais distante de um quarto até
a borda da praça são 255 m em linha reta e 293 m pela malha. A regra 3-30-300 pede 300 m até
verde público de pelo menos 0,5 ha: cumprida com 2,4 pontos de folga em área e 7 m de folga
em distância, para 100% dos 54.432 lotes.

Dentro de cada praça, sem custo de terra adicional: 1 área de jogo equipada de 1.700 m²
(41 × 41 m, com 63,5 m de recuo até a borda, contra os 30,0 m que a norma NEAP exige) e 1
quadra poliesportiva de marcação tripla de 37,0 × 18,5 m.

### 3.2 As travessas são passantes, não becos

Correção enxertada da Armadura Verde. As duas travessas de 9,0 m de cada quarteirão correm
na mesma direção da malha do setor e são **alinhadas de quarteirão a quarteirão**, formando
veia verde contínua ao longo de toda a profundidade do setor. Nos setores do oeste isso dá
**2.200 m de corredor plantado sem interrupção**. São 1.296 travessas, 217,7 km de corredor
capilar, uma a cada 56,0 m em uma direção e a cada 180 m na outra.

Custo de terra dessa correção sobre o traçado original: zero m². É só a orientação das
travessas.

### 3.3 As contas

Verde novo designado:

| Peça | ha |
|---|---|
| Travessas plantadas | 196,0 |
| Miolo verde das 81 Praças de Quarto | 228,6 |
| Jardim linear dos bulevares | 20,4 |
| Cinturão de borda e verge de costura | 63,1 |
| Parte mole dos 8 complexos esportivos (70%) | 72,6 |
| **Total novo** | **580,7 ha = 5,807 km²** |

- Verde novo por lote: 5.807.000 / 54.432 = **106,7 m²**.
- Somando Parque Runestone (630,9 ha) e precinto da praça (260,2 ha): 1.471,8 ha, ou
  **270,4 m² por lote**.
- Fração do sítio: 1.471,8 / 3.848,6 = **38,24%**. Viena está em 53%, Curitiba em 13%.
- Provisão por mil lotes: **27,04 ha/1000**, contra 2,40 do Six Acre Standard (11,3 vezes),
  5,35 do pacote completo da Fields in Trust (5,1 vezes) e 0,80 da meta de Singapura
  (33,8 vezes).
- Por habitante, tratando 1 lote como 1 habitante: 270,4 m²/hab, contra 9 m²/hab de mínimo
  atribuído à OMS (atribuição secundária, o estudo primário não foi localizado), 50 m²/hab
  de ideal e 64,5 m²/hab de Curitiba, que é a referência brasileira mais dura: **4,19 vezes
  Curitiba**.
- Densidade de corredor verde contínuo: 217,7 km de travessa mais 18,6 km de bulevar sobre
  38,486 km² = **6,14 km/km²**, contra 0,68 km/km² de Singapura (500 km em 730 km²): 9,0
  vezes.

### 3.4 Árvores, copa e o teto de renderização

Contagem, com o espaçamento de cada família declarado:

| Onde | Espaçamento | Árvores |
|---|---|---|
| Lote, 1 por lote | uma por lote de 300,0 m² | 54.432 |
| Alameda, dois lados de 253,7 km de eixo | 10,0 m entre eixos | 50.740 |
| Travessa, fileira única em 217,7 km | 12,0 m | 18.144 |
| Praças de Quarto, 228,6 ha | 80 árv/ha | 18.288 |
| Bulevares, 4 fileiras em 18,6 km | 10,0 m | 7.430 |
| Cinturão e parte mole do esporte, 135,7 ha | 80 árv/ha | 10.856 |
| **Total** | | **159.890** |

Copa madura de 8,0 m de diâmetro = 50,3 m² por árvore. Copa total 8,042 km² sobre 21,864 km²
de área urbanizada (metade do holder mais as praças) = **36,8%**, acima dos 30% da regra
3-30-300. O "3" da regra fecha por construção: 1 árvore dentro do lote mais 2 na testada da
alameda.

Canteiro viário contínuo de 2,0 m, acima do mínimo de 1,68 m do padrão da SDOT em Seattle, o
que dispensa cova isolada. Espaçamento de 10,0 m adotado acima da faixa de 6,1 a 9,1 m da
NYC Parks, porque a copa de 8,0 m fecha antes.

**Orçamento de render, com a ressalva que a Armadura Verde levantou e ninguém mais viu:**
159.890 árvores mais 54.432 prédios = **214.322 instâncias**, contra o teto medido de
300.000 a 37 fps. Folga de 28,6%. Mas o teto de 300.000 foi levantado com **caixa de lote**,
não com árvore, e o bípede medido custa 312 triângulos com 5.246 cópias a 13,3 ms por
quadro. Portanto: **impostor billboard além de 900 m é requisito, não opção**, e a árvore
tem que ser medida antes de virar código (passo 0 do capítulo 8).

Teto duro de material: **4 espécies de árvore e 4 famílias de fachada**, com variação por
cor de instância, que é atributo e não material. Somando 6 superfícies de esporte, regolito,
água e piso, o plano inteiro fecha em cerca de **16 materiais**, contra os 5 draw calls
medidos hoje nos 83.017 lotes. Precisa de chapa antes de commit.

---

## 4. Mobilidade

Não existe carro particular. O que isso elimina, em metros: as duas faixas de rolamento de
3,0 m de toda via local; a vaga de 2,5 por 5,0 m, ou seja 12,5 m² por lote, que a 1 vaga por
lote seriam **0,680 km² de estacionamento que não existem**; o raio de esquina de veículo de
projeto, que cai de 9 a 15 m para 3,0 m. A rua de 20,0 m do Cerdà vira alameda de 12,0 m,
40% mais estreita, com 6,0 m de passeio somados contra 5,0 m do Eixample.

### 4.1 Hierarquia viária, 4 caixas que se substituem e não se somam

| Nível | Caixa | Composição, em metros | Comprimento |
|---|---|---|---|
| Travessa plantada | **9,0 m** | 2,0 passeio + 5,0 jardim + 2,0 passeio. Só pé. | 217,7 km |
| Alameda local | **12,0 m** | 3,0 passeio + 6,0 faixa central livre e arborizada + 3,0 passeio. Zero veículo particular. | 253,7 km |
| Corda tangencial | **12,0 m** de caixa, 24,0 m de uso | O bonde ocupa os 6,0 m centrais que já existem: 0 m² de terra nova. | 15,4 km |
| Bulevar radial | **34,0 m** | 4,25 passeio + 3,00 ciclovia + 6,75 jardim + 6,00 faixa de bonde + 6,75 jardim + 3,00 ciclovia + 4,25 passeio | 18,6 km |

Dos 34,0 m do bulevar, 12,0 m já são a alameda que ele substitui, 11,0 m são sobrelargura de
mobilidade (metade do holder) e 11,0 m são jardim linear (metade do projeto).

A faixa central de 6,0 m da alameda serve três coisas ao mesmo tempo: caminhada larga,
emergência e carga autônoma, e trilho de bonde onde uma linha passa. Essa tripla função é o
que faz as 6 cordas custarem **0 m² de terra**.

### 4.2 Quarteirão e permeabilidade

- Quarteirão: **168 por 168 m = 28.224 m²**. Três faixas de 50,0 m (duas fileiras de lotes
  de 12,0 × 25,0 m costas com costas) separadas por duas travessas de 9,0 m.
  Conferência: 50 + 9 + 50 + 9 + 50 = 168,0 m exatos.
- Lotes: 6 fileiras de 14 lotes a 12,0 m de testada (168 / 12 = 14 exato) = **84 lotes de
  300,0 m²**. Área de lote 25.200 m², travessas 3.024 m², soma 28.224 m² = 168², fecha sem
  sobra.
- Módulo com a alameda: **180 por 180 m = 32.400 m²**. Banda de alameda = 180² − 168² =
  4.176 m². Conferência: 25.200 + 3.024 + 4.176 = 32.400 m², fecha exato.
- Sobrecarga viária real: 2,706 / (16,330 + 2,706) = **14,21%**, abaixo dos 17,4% que
  `app/city/plan/plan-client.tsx:51` assume.
- Face de quarteirão: 168 m, contra 113 m do Cerdà e 61 m de Portland. Mas a travessa parte
  a face em duas metades de 79,5 m, mais curta que Barcelona.
- Cruzamentos por km²: 30,9 de via (grade de 180 m) mais 123,4 de travessa = **154,3
  caminháveis por km²**. Portland faz 160, Barcelona 57, Manhattan 33. A travessa conta
  porque é passagem pública de 9,0 m que atravessa o quarteirão de alameda a alameda, não
  um beco de 2,0 m nem um toco que morre num miolo.
- Quarto: 3 por 3 células, **540 por 540 m, 29,16 ha**, 8 quarteirões (672 lotes) e 1 praça.
- Bairro: 2 por 2 quartos, **1.080 por 1.080 m, 116,6 ha**, 32 quarteirões, 2.688 lotes, 4
  praças. São 20 bairros.

### 4.3 O bonde

Rede: 12 bulevares (18.576 m) + 6 cordas (15.400 m) + anel de transbordo na borda do platô,
r = 1.300 m, perímetro 8.168 m. Total **42.144 m = 42,1 km de via dupla**.

Paradas a cada 400 m no eixo: **106 paradas**. Velocidade comercial de projeto 18 km/h,
dentro da faixa medida de 17,7 a 22,8 km/h em VLT francês. Intervalo de 5 min, espera média
2,5 min. Sem carro não há atraso de semáforo, então os 7 a 8% de tempo de semáforo do estudo
francês viram folga.

**Acesso a pé à parada, dito com honestidade.** O plano vencedor prometia 285 m e um jurado
provou que aquilo era a captação AO LONGO da linha, não o acesso perpendicular. O número
real desta rede: bulevares a 30° um do outro, meia-lacuna angular de 890 m em r = 3.400 m;
as cordas cortam essa lacuna nos quadrantes livres; o pior ponto que sobra fica no nordeste,
onde o raio máximo é 1.886 m e a meia-lacuna vale **494 m**. Somando até 200 m ao longo da
linha até a parada, o pior acesso em linha reta é **532 m**, e com fator de rota 1,15
**612 m, 12,0 min a 0,85 m/s**. Isso é um limite geométrico sobre o grafo do bonde, **não
uma medição de distância de rede sobre a malha real de alamedas**, e a medição de rede é
passo obrigatório da obra.

### 4.4 Bicicleta

Ciclovia unidirecional de 3,0 m, duas por bulevar, **37,2 km dedicados**, dentro da faixa
CROW de 3,0 m para 150 a 750 ciclistas por hora. Fora dos bulevares a bicicleta usa a faixa
central de 6,0 m das alamedas. A escala fina desta cidade é a bicicleta: o módulo de 180 m
sai em 43 s a 15 km/h, e o quarto inteiro de 540 m em 130 s.

### 4.5 Tempos, todos a 0,85 m/s

| Percurso | Distância | A pé | De bicicleta | De bonde |
|---|---|---|---|---|
| Porta à alameda arborizada | 0 m | 0 s | | |
| Porta à travessa plantada | 84 m | 99 s | | |
| Porta à Praça de Quarto de 2,82 ha | 293 m | 5,7 min | | |
| Porta à parada de bonde, pior caso | 612 m | 12,0 min | 2,4 min | |
| Porta ao complexo esportivo, pior caso | 1.344 m | 26,4 min | 5,4 min | |
| **Lote mais externo (r 3.400) à borda do platô (r 960)** | 2.684 m | **52,6 min** | **10,7 min** | **22,6 min** |

Os 22,6 min de bonde são 8,1 min de marcha, 12,0 min de acesso e 2,5 min de espera.

**DITO SEM MAQUIAGEM: a Praça Central não é alcançável a pé em 15 minutos de lugar nenhum
além do primeiro quarto.** Ela é destino de bonde e de bicicleta. Quem prometer 15 minutos a
pé até a praça está mentindo, e a causa é física: 0,85 m/s.

**A cidade de 15 minutos fica no quarto**, não na praça central. As seis funções sociais
(mercado, escola, oficina, clínica, café, salão) ficam nas quatro testadas voltadas para a
Praça de Quarto, a **293 m e 5,7 min** do pior lote do quarto. Folga de 2,6 vezes sobre os
15 minutos.

---

## 5. Esporte

Orçamento: **8 complexos, 103,7 ha, 1,91 ha por 1.000 lotes**, contra os 1,60 ha/1000 que a
Fields in Trust exige para esporte formal ao ar livre. Sobra de 19,4%, **sem contar as 81
quadras das Praças de Quarto**, que é exatamente a maquiagem que derrubou o plano vencedor
no julgamento.

Os complexos NÃO ficam em células da grade: ficam no **cinturão de borda, na orla do
spaceport e na Cratera da Batalha**, porque não precisam de módulo, só de piso nivelado. Com
isso a cratera deixa de ser a peça grande movível e vira o anfiteatro do setor de saltos.

### 5.1 Onde ficam, e o que tem em cada um

| Complexo | Rumo | Raio | Programa |
|---|---|---|---|
| 1 | 15° | 1.500 a 1.860 m | 1 pista de 400 m com campo FIFA dentro; 2 quadras poliesportivas |
| 2 | 105° | 2.600 a 2.960 m | **Hangar Ícaro**; **Centro Aquático** de 50 m; **Torre de Saltos** de 60,35 m |
| 3 | 150° | 1.750 a 2.110 m | **Estádio de 20.000 lugares**, 220 × 150 m; 1 centro de recreação com ginásio de 4 quadras |
| 4 | 195° | 3.000 a 3.360 m | **Arena coberta de 12.000 lugares**, 160 × 140 m, pé-direito 40,0 m; a 320 m do centro do spaceport |
| 5 | 240° | 2.300 a 2.660 m | 3 campos FIFA avulsos; 4 quadras de tênis; 2 piscinas de bairro de 25 m; 1 centro de recreação |
| 6 | 300° | 2.850 a 3.210 m | 1 pista de 400 m com campo FIFA; 4 quadras de tênis; 1 campo FIFA avulso |
| 7 | 225°, na Cratera | 2.600 a 3.000 m | **Skatepark distrital** de 1.500 m² na borda da cratera; **2 poços de salto lunar** de 100 × 12 m dentro dela |
| 8 | 330° | 1.900 a 2.260 m | 1 pista de 400 m com campo FIFA; 1 campo FIFA avulso; 2 quadras poliesportivas |

### 5.2 Inventário, com medida e norma

| Equipamento | Medida | Quantidade | Norma de referência |
|---|---|---|---|
| Pista de atletismo de 400 m | reta 84,39 m, raio interno 36,50 m, 8 raias de 1,22 m, envelope 176,91 × 92,52 m = 16.368 m² | 3 | World Athletics |
| Campo de futebol 105 × 68 m | envelope 111 × 74 = 8.214 m² | 8 (3 dentro de pista, 5 avulsos) | FIFA / IFAB |
| Quadra poliesportiva de marcação tripla (basquete, vôlei, futsal) | 37,0 × 18,5 m = 684,5 m² | **89** (81 nas praças, 8 nos complexos) | FIBA / Sport England |
| Quadra de tênis | 36,6 × 18,3 m = 669,8 m² | 8 | ITF |
| Centro aquático de 50 m | tanque 50 × 25, 10 raias; edifício 70 × 45 m | 1 | World Aquatics |
| Piscina de bairro de 25 m, 8 raias | 45 × 30 m | 2 | World Aquatics |
| Centro de recreação com ginásio de 4 quadras | jogo 34,5 × 20,0 m, edifício 2.400 m² | 2 | Sport England |
| Área de jogo equipada | 1.700 m², recuo de 63,5 m | **81** | Fields in Trust, acima do NEAP de 1.000 m² |
| Skatepark distrital + spots | 1.500 m² + 4 × 250 m² | 1 + 4 | World Skate |
| Caninódromo | 2.500 m² | **12** | NRPA pediria 1; a cidade se chama DogCity |
| Estádio | 20.000 lugares, 220 × 150 m | 1 | Green Guide, SGSA |
| Arena coberta | 12.000 lugares, 160 × 140 m, pé-direito 40,0 m | 1 | Green Guide, SGSA |

Contra a mediana da NRPA para jurisdição de 50.000 a 99.999 (que é a nossa faixa): pedia 14
playgrounds, entrego 81; pedia 8 campos retangulares, entrego 8; pedia 6 quadras de basquete
mais 2 poliesportivas, entrego 89 poliesportivas; pedia 7 de tênis, entrego 8; pedia 1
piscina, entrego 1 de 50 m mais 2 de 25 m; pedia 1 skatepark, entrego 1 mais 4 spots; pedia
2 centros de recreação, entrego 2; pedia 1 caninódromo, entrego 12.

Contra a Fields in Trust: esporte formal exigido 1,60 ha/1000 × 54,432 = 87,1 ha, entrego
103,7 ha (**1,91 ha/1000**). Play equipado exigido 0,25 ha/1000 = 13,6 ha, entrego 81 ×
1.700 m² = 13,77 ha (**0,253 ha/1000**). Os dois cumprem sem contar peça de vizinhança como
sítio formal.

Escoamento pelo Green Guide da SGSA: 82 pessoas por metro de largura por minuto em piso
plano. Esvaziar 20.000 pessoas em 8,0 min exige 30,5 m de saída, 12.000 exigem 18,3 m. Uma
esplanada de 30,5 m escoa 2.501 por minuto e serve os dois. Os 8,0 min são premissa de
projeto, não medição.

### 5.3 O que só existe a 1/6 de gravidade

Com g = 1,625 m/s² a razão de alcance balístico é **6,035**. Isso não é decoração, é o que
obriga a mudar a norma:

- **Hangar Ícaro**, voo humano por propulsão muscular. Piso de 240 × 120 m = 28.800 m²,
  altura livre 35,0 m, pressurizado a 1,225 kg/m³. Potência de voo escala com g elevado a
  1,5, então aqui é **6,74% da terrestre: 15,5 W contra 230 W**. Piloto e asa de 100 kg com
  15 m² e CL 1,4 pesam 162 N, estolam a 3,55 m/s, cruzam a 4,62 m/s, curvam em 22,8 m a 30°
  de inclinação, com 13,4 m de envergadura em alongamento 12. Cabem 3 raias de voo de
  40,0 m, folga de 26,6 m. **Um adulto sem treino voa por músculo próprio: 15,5 W é menos
  que subir escada devagar.**
- **Torre de Saltos de 60,35 m**, base 40 × 40 m. É a altura que entrega os mesmos 14,00 m/s
  de velocidade de entrada da plataforma de 10 m terrestre. Tempo de voo do saltador: 8,62 s
  em vez de 1,43 s.
- **Poços de salto lunar**, 100 × 12 m cada (corrida de 40 m mais 60 m de areia). O recorde
  terrestre de 8,95 m vira **54,01 m**. Os 9 m de poço da norma terrestre não servem.
- **Salto com vara lunar**, no mesmo pé-direito de 35,0 m do Hangar: corrida de 9,5 m/s dá
  27,77 m de subida do centro de massa e barra por volta de **28,97 m**.
- **Ginásio coberto com pé-direito de 12,0 m**, não os 7,5 m do Sport England: o aro de
  basquete sobe de 3,05 m para **6,52 m** (alcance de 2,30 m mais impulso de 0,70 m vezes
  6,035) e a bola pede mais 1 m de ápice. O vão é o mesmo, só a altura muda, e altura em
  1/6 g é barata.
- **Skatepark descoberto por obrigação**: a mesma impulsão multiplica a altura de air por
  6,035, e o vão livre acima do bowl teria que passar de 3 m para 18 m. Coping e muro ficam
  iguais.

### 5.4 Percurso contínuo

18.576 m de bulevar mais 15.400 m de corda mais 8.168 m do anel de transbordo =
**42.144 m**, marcados em 1, 5, 10, 21,1 e 42,195 km. A maratona fecha em **1,001 volta**.

Orçamento de material do programa esportivo inteiro: **6 superfícies** (grama tratada, piso
de quadra, tartan, água, concreto, areia). As 89 quadras poliesportivas são 89 instâncias de
1 malha e 1 material, no lugar das 10 peças em 3 materiais que a mediana da NRPA pediria.

---

## 6. Os bairros: a idade do UTXO vira endereço sem virar anel

Este é o capítulo que o gerador implementa. Está escrito para não sobrar pergunta.

### 6.1 O dado, medido hoje

`data/holders_by_age.csv`, 85.841 linhas de dados. Filtro `total_dog >= 20000`:
**52.996 carteiras**. (`app/city/plan/plan-client.tsx:53` grava 53.001 e o briefing diz
52.999. A diferença de 5 não foi reconciliada e não muda o plano, que tem 1.436 lotes de
margem.)

**Descoberta que muda a regra de endereço.** A coluna `oldest_age_days` tem duas casas
decimais, ou seja resolução de 864 s, que é 1,44 bloco. Medido no CSV:

| Valor de `oldest_age_days` | Carteiras |
|---|---|
| 855,75 | **9.771** |
| 855,74 | **7.308** |
| 855,73 | **3.241** |
| soma das três | **20.320 (38,3% da cidade)** |

E **39.702 carteiras, 74,9% do total, estão em valores repetidos**. Só existem 19.564
valores distintos para 52.996 carteiras.

Conclusão dura: **idade em dias não ordena esta cidade.** O dia do airdrop empilha 38,3% dos
holders em três escalões. Sem um desempate publicado, 20.320 carteiras estariam em empate
técnico pela posição mais valiosa do mapa.

### 6.2 A chave de idade, e o desempate

Enxerto da Roseta da Gênese: a chave é **altura de bloco, não data**, porque bloco é o
relógio da rede. E como a altura empata dentro dos blocos do airdrop, a chave é uma tupla de
quatro campos, comparada nesta ordem, toda ela ascendente:

1. **altura do bloco** do UTXO mais antigo da carteira;
2. **índice da transação dentro do bloco** (`txindex`);
3. **índice da saída dentro da transação** (`vout`);
4. **o endereço em ordem lexicográfica**, como desempate final.

Determinística, auditável por qualquer holder com um nó, e sem semente aleatória nenhuma.
`data/holders_by_age.csv` **não tem** os campos 1 a 3: eles têm que sair do índice do `ord`
(ver capítulo 9, pergunta 2).

### 6.3 A geometria: 12 setores, 12 azimutes

O disco é cortado em **12 setores de 30°**, com as costuras nos rumos 0°, 30°, 60°, ...,
330°. Cada setor recebe uma **malha cartesiana própria, girada em k × 7,5°** para k de 0 a
11, cobrindo 0° a 82,5°. Como a malha quadrada tem simetria de 90°, o setor 11 volta a 7,5°
do setor 0: **todo par vizinho difere exatamente 7,5°, inclusive o par que fecha a volta.**
Não existe costura privilegiada, e nenhuma rua atravessa uma costura.

Sobre cada uma das 12 costuras corre um **bulevar radial de 34,0 m**, de r = 1.300 m até a
borda utilizável daquele rumo. É ele que come a meia-célula rasgada da junta.

Nada começa antes de **r = 1.300 m** (fim da rampa do platô). O briefing permitia começar em
960 m; os 340 m de folga são o precinto ajardinado da praça.

Profundidade utilizável por rumo, medida:

| Rumo | Raio livre | Profundidade a partir de 1.300 m | Células de 180 m |
|---|---|---|---|
| 15° | 1.944 m | 644 m | 3 |
| 45° | 1.600 m | 300 m | 1 |
| 75° | 2.092 m | 792 m | 4 |
| 105° a 195° | 3.500 m | 2.200 m | 12 |
| 225° | 2.740 m | 1.440 m | 8 |
| 255° a 345° | 3.500 m | 2.200 m | 12 |

**A cidade é 12 módulos funda a oeste e 1 módulo funda no rumo 45°.** Diferença de 1.900 m,
fator de 12,0. Essa desigualdade é estrutural, ela é imposta pelo disco do Parque Runestone,
e é a primeira arma contra o anel.

### 6.4 A função de endereço, em seis passos

1. **Qualificação.** `total_dog >= 20000`. São 52.996 carteiras. Este é o único filtro de
   entrada, e nem coleção parceira escapa dele (regra 4).
2. **Ordenação.** Ordena as 52.996 pela tupla de 6.2, ascendente. A carteira de posto `i`
   vale `i = 1` para a mais antiga.
3. **Cota por setor.** Mede a capacidade real `C_s` de cada setor em lotes, contando as
   células que o empacotador entregou. Cota `Q_s = round(52.996 · C_s / ΣC)`. Os setores NÃO
   têm capacidade parecida: o setor do rumo 45° é 12 vezes mais raso que o do oeste.
4. **Rodízio de maior resto.** Percorre a lista ordenada e entrega cada carteira ao setor com
   o **maior déficit relativo à sua cota** naquele instante (empate resolvido pelo menor
   número de setor). Determinístico, sem sorteio. Efeito: **as 12 carteiras mais antigas caem
   uma em cada setor**, espalhadas por 360°, e **cada setor recebe o espectro inteiro de
   idades**.
5. **Passo dentro do setor.** A p-ésima carteira que caiu no setor `s` recebe o p-ésimo lote
   da **ordem de passo do setor**, que é definida assim, sem ambiguidade:
   quarto a quarto por raio médio crescente do quarto; dentro do quarto, quarteirão a
   quarteirão por raio médio crescente do quarteirão; dentro do quarteirão, lote a lote por
   raio crescente do centróide do lote; empate de raio resolvido pelo azimute crescente.
6. **Resultado.** **Dentro do setor, mais antigo é sempre mais perto da Praça Central, sem
   uma única exceção.** É função monótona estrita do passo. Não existe embaralhamento dentro
   do quarteirão, e é por isso que a regra 2 é legível caminhando, e não só auditável em
   planilha.

Endereço legível: **`S07-Q04-B6-L57`** (setor 07, quarto 04 daquele setor, quarteirão 6 do
quarto, lote 57 do quarteirão). Setores de 01 a 12, quartos numerados por setor a partir da
praça, quarteirões de 1 a 8, lotes de 1 a 84.

### 6.5 Por que isso NÃO vira anel concêntrico

Seis mecanismos, cada um com o número que o sustenta.

**1. A mesma idade cai em 12 raios diferentes, com espalhamento de até 1.773 m.** Este é o
motor. Como as cotas são proporcionais à capacidade, o quantil `q` de idade é o mesmo em
todos os setores, mas o raio em que ele cai não é, porque os setores têm raios externos de
1.600 a 3.500 m. Com capacidade crescendo com a área do anel, o raio do quantil `q` num
setor de raio externo `R` vale `r(q) = raiz(1.300² + q·(R² − 1.300²))`. Medido:

| Quantil de idade | Raio no setor mais raso (R = 1.600) | Raio no setor mais fundo (R = 3.500) | Espalhamento |
|---|---|---|---|
| 10% | 1.333 m | 1.657 m | 324 m |
| 30% | 1.397 m | 2.204 m | 807 m |
| 50% | 1.458 m | 2.640 m | 1.182 m |
| 70% | 1.516 m | 3.014 m | 1.498 m |
| **90%** | **1.573 m** | **3.346 m** | **1.773 m** |

**1.773 m sobre um alcance radial de 2.200 m são 80,6%.** A curva de iso-idade desta cidade
não é um círculo: é uma escada de 12 degraus com 1.773 m de altura, e cada degrau está numa
malha girada 7,5° em relação ao vizinho. **Uma carteira do quantil 90% pode estar a 1.573 m
ou a 3.346 m da praça, dependendo de qual setor o rodízio lhe deu.**

**2. A cidade é cartesiana, não polar. Não existe via curva no plano.** Anel só existe em
desenho feito em coordenada polar. Aqui toda via é segmento reto: a alameda tem no máximo
168,0 m de face antes de virar, o bulevar é radial e o corda é reto. A única linha fechada
do plano é o **anel de transbordo do bonde em r = 1.300 m**, e ele é declarado: fica na
fronteira permanente do precinto da praça, não tem um lote sequer, e é a peça que faz o
transbordo entre os 12 bulevares. Se o fundador achar que ele lê como anel, corta-se e o
transbordo passa a ser em Y nos 12 Portais (pergunta 6 do capítulo 9).

**3. Doze malhas com doze azimutes.** O maior alinhamento tangencial possível é o arco de um
setor, 2π·r/12 = 0,524·r. A 2.400 m isso são 1.257 m, e como o alinhamento é reta e o arco é
curvo, essa corda se afasta 82 m da circunferência. Ninguém lê 82 m de desvio como anel.

**4. A profundidade varia por fator de 12,0.** De 1 célula no rumo 45° a 12 células no
oeste. Um anel exige profundidade constante. A borda construída também não é círculo: o raio
livre por rumo vai de 1.600 a 3.500 m, espalhamento de 1.900 m.

**5. A silhueta é ruído em todo raio, e isso está medido.** A altura do prédio sai da
**contagem de UTXOs da carteira**, não da idade e não do bairro. Medido no CSV:

| UTXOs | Carteiras | % | Tipologia |
|---|---|---|---|
| 1 | 33.519 | 63,2% | casa pátio, 2 pavimentos |
| 2 a 4 | 12.274 | 23,2% | bloco, 4 pavimentos |
| 5 a 9 | 3.951 | 7,5% | bloco, 6 pavimentos |
| 10 a 99 | 3.139 | 5,9% | torre, 9 pavimentos |
| 100 ou mais | 113 | 0,21% | torre, 14 pavimentos |

E a correlação medida entre contagem de UTXOs e idade do UTXO mais antigo é
**r = −0,0042**, ou seja zero. **A altura não tem relação nenhuma com o raio.** Se a altura
caísse com o raio a cidade seria um cone, e o cone é o anel visto de lado. Aqui a silhueta é
estatisticamente idêntica em r = 1.400 e em r = 3.400.

**6. Nada contínuo corre ao longo do círculo.** As 81 Praças de Quarto ficam nos 81 raios
médios dos 81 quartos, espalhados de 1.390 a 3.410 m. Os 8 complexos esportivos ficam em 8
raios diferentes (1.500, 2.600, 1.750, 3.000, 2.300, 2.850, 2.600 e 1.900 m) e em 8 rumos
diferentes. Não existe cinturão verde nem cinturão esportivo. E o verde de mais alta
frequência do plano, a travessa plantada, repete a cada 56,0 m: anel é padrão de baixa
frequência, e este é 39 vezes mais fino que o alcance radial da cidade.

### 6.6 A leitura do chão: Portais, Marcos e Remates

Enxerto direto da Roseta da Gênese, e o conserto do único defeito grave do plano vencedor.
A regra 2 não pode existir só na planilha.

- **12 Portais**, um em r = 1.300 m na cabeceira do bulevar de cada setor, gravado com a
  **altura de bloco** da carteira de passo 1 daquele setor.
- **186 Marcos**, um a cada 100 m ao longo dos 18.576 m de bulevar, cada um gravando a
  altura de bloco do passo servido naquele ponto. Com cerca de 120.000 blocos desde o etch
  do rune, dá um Marco a cada 645 blocos.
- **12 Remates de 60,0 m de altura**, no fim de cada bulevar. Visto do Portal a 2.200 m, um
  Remate de 60,0 m subtende 1,56°, contra 0,78° de um remate de 30 m, que sumiria.

Um holder não precisa de mapa para saber quem é mais velho que ele: é quem mora antes do
Marco dele.

### 6.7 Tipologia, comércio, Patron, carteira que zera

- **Padrão por bairro (regra 5).** 12 famílias de fachada, uma por setor, saindo de **4
  materiais de fachada vezes 3 paletas aplicadas por cor de instância**, que é atributo e não
  material. Doze leituras, quatro materiais. Atravessar um círculo é atravessar 12
  arquiteturas; percorrer um bulevar é ficar numa só e ver ela envelhecer.
- **Comercial (regra 5).** Térreo comercial por direito em todo lote que testa em bulevar ou
  em Praça de Quarto. São 12 bulevares (dois lados, testada de 12,0 m) mais as 4 testadas de
  cada uma das 81 praças: cerca de **5.400 lotes, 9,9% da cidade**, com espaço de marca
  padronizado de 12,0 × 3,0 m a 4,0 m de altura, mesma malha e mesma UV em toda a cidade,
  textura trocada por lote.
- **Patron.** Departamento à parte, prédio personalizado, e **ortogonal à posição**. Patron
  não compra raio, porque raio é idade. O que existe é a testada privilegiada, e ela cai por
  idade como todas as outras.
- **Carteira que zera (regra 6).** O prédio implode e o lote fica como plinto pavimentado com
  o endereço gravado, dentro do mesmo quarteirão. Voltando o saldo, o prédio sobe de novo, de
  graça, no mesmo lote, com a mesma família de fachada. **O lote nunca vai para outra
  carteira.** O endereço é permanente, o prédio é que aparece e some.

---

## 7. A reserva da casa

Regra 7: o reservado serve também de estoque para negociar com coleções parceiras. Coleção
parceira quer bairro inteiro, não quadrado solto, então a reserva é **contígua**.

### 7.1 Dog Social Club, rumo 69°, já aprovado

A galeria do DSC já existe dentro da praça em (596, −232), raio 640 m, rumo 68,7°. O
condomínio fica **radialmente para fora dela**, no setor 3 (60° a 90°), ocupando os lotes
mais internos do setor a partir de r = 1.300 m:

- **1 quarteirão inteiro de 84 lotes mais 10 lotes do quarteirão seguinte = 94 lotes.**
- O DSC **pula o passo de idade** (regra 4), mas **continua exigindo 20.000 DOG na mesma
  carteira**. Compra posição, não entrada.
- **Preço medido para quem é deslocado:** o setor 3 tem raio externo 2.092 m e comporta
  cerca de 1.621 lotes. Os 94 lotes do DSC são 5,8% do setor. Quem ocuparia o passo 1 passa
  a ocupar o passo 95, e isso empurra a linha de idade de r = 1.300 m para r = 1.359 m:
  **59 m**. É isso que a parceria custa, e está escrito.

### 7.2 Reserva de negociação, 6 células em 2 blocos de 3

Dois blocos contíguos de 3 células de 180 m (540 × 180 m cada), **0,194 km²**, colocados na
faixa interna (r 1.300 a 1.660 m) dos dois setores mais fundos, rumos 135° e 270°, que é a
posição que uma coleção parceira quer comprar. Valem **504 lotes potenciais** a 84 lotes por
célula.

### 7.3 O estoque real é maior: 1.940 lotes

Somando o excedente da metade do holder:

| Origem | Lotes |
|---|---|
| Excedente de lotes (54.432 entregues contra 52.996 carteiras medidas) | 1.436 |
| Reserva de negociação, 6 células | 504 |
| **Total negociável** | **1.940** |

São **20,6 vezes o condomínio do Dog Social Club** (94 lotes). Como toda coleção parceira
continua obrigada aos 20.000 DOG (regra 4), o excedente da metade do holder é estoque
legítimo: quem o ocupa é holder.

---

## 8. Como construir

Ordem de obra. O passo 0 é portão: se ele reprovar, o plano muda antes de qualquer commit,
não depois.

### Passo 0. Os três portões de medição, antes de escrever uma linha de gerador

1. **Abertura morfológica com elemento de 180 m, não de 160 m.** A tabela de 2.3 foi medida
   com elemento de 160 m e o passo real do módulo é 180 m. O rendimento a 180 m é menor e
   **NÃO FOI MEDIDO**. Portão: contar **células de grade**, não área, e exigir **≥ 664
   células com os 168 m internos inteiramente em ≤ 4°**. O script de referência é o
   `opening.mjs` da frente de aritmética.
2. **Empacotamento real, com as 12 malhas giradas.** Rodar o empacotador e medir o resíduo
   de fato. Portão: resíduo ≤ **1,700 km²**. Acima disso, aplicar a ordem de encolhimento
   publicada em 2.4.
3. **Custo de uma árvore em triângulos e em ms por quadro.** O teto de 300.000 instâncias a
   37 fps foi levantado com caixa de lote. Portão: 159.890 árvores mais 54.432 prédios têm
   que caber com o impostor billboard ligado além de 900 m.

### Passo 1. Corrigir o duplo desconto que já está no código

`app/city/plan/plan-client.tsx:46` e `:315` usam `PARK_CORE = 3100` como pegada do parque,
mas a pegada real é `PARK_HALF = 3600` (`app/city/plaza/park-site.ts:21`). Quem subtrair os
12,402 km² comprometidos da soma das faixas de declive publicadas conta **2,424 km² duas
vezes**. Corrigir antes de rodar qualquer orçamento.

E `lib/city/lunar/sites.ts:73` grava `3500, 2`, ou seja `slopeLimitDeg` 2. Medido: em ≤ 2°
só existem **253 células** utilizáveis contra as 664 necessárias. Esse 2 tem que virar 4 no
código, junto com a decisão de 2.3.

### Passo 2. Gerar a geometria (nenhum dado de holder entra ainda)

1. 12 cunhas de 30°, costuras nos rumos múltiplos de 30°, azimute de malha `k × 7,5°`.
2. Máscara de obstáculos: r < 1.300 (platô), disco do Runestone com `PARK_HALF = 3600`,
   spaceport 845 × 599 centrado em r 3.156, Cratera 760 × 364 no rumo 225°, borda em 3.500.
3. Empacotar a grade de 180 m dentro de cada cunha, clipada pela máscara.
4. Classificar cada célula: declive máximo dentro dos 168 m internos. Célula 100% dentro da
   máscara e ≤ 4° vira **célula de lote**; as demais viram praça, esporte, cívico ou
   cinturão. Isso põe o lote na terra plana e o verde na terra torta, de graça.
5. Aplicar a regra do quarto: em cada agrupamento 3 × 3 de células de lote, a célula central
   vira **Praça de Quarto**. Objetivo: 648 células de lote e 81 praças.
6. Subdividir cada célula de lote: quarteirão 168 × 168 m, 3 faixas de 50,0 m, 2 travessas de
   9,0 m alinhadas com as dos quarteirões vizinhos do mesmo setor, 84 lotes de 12,0 × 25,0 m.

Tudo isso é cartesiano, que é exatamente a forma que `lib/city/lunar/zones.ts` passou a usar
depois da correção que matou as colisões dos centros em espiral. **Nenhuma espiral entra
neste plano**, e essa é uma decisão de custo de bug, não de estética.

### Passo 3. Preparar a lista de carteiras

1. Ler `data/holders_by_age.csv`, filtrar `total_dog >= 20000`. Medido: **52.996 linhas**.
2. Para cada endereço, buscar no índice do `ord` a **altura de bloco, o txindex e o vout** do
   UTXO mais antigo. **O CSV não tem esses campos.** Sem eles a ordenação é impossível: 74,9%
   das carteiras empatam na coluna de dias.
3. Ordenar pela tupla (altura, txindex, vout, endereço).
4. Guardar `utxo_count` do CSV para a tipologia vertical (tabela de 6.5).

### Passo 4. Publicar a regra ANTES de gravar qualquer lote

Enxerto do risco 8 do plano vencedor, e é custo zero. Antes de o primeiro lote existir, tem
que estar público e verificável:

- a tupla de desempate de 6.2, inclusive o desempate lexicográfico;
- a tabela de cotas por setor `Q_s`;
- a tabela de espalhamento por quantil de 6.5;
- a lista dos 94 lotes do Dog Social Club.

Sem isso o rodízio vira acusação de favorecimento, e não existe conserto depois.

### Passo 5. Atribuir

1. Reservar os 94 lotes do DSC no setor 3 (7.1).
2. Medir `C_s` real por setor, calcular as cotas, rodar o rodízio de maior resto.
3. Rodar a ordem de passo dentro de cada setor.
4. Gravar `S{setor}-Q{quarto}-B{quarteirão}-L{lote}` por endereço.

### Passo 6. Cena

Ordem de entrega visual, do mais barato ao mais caro:
plinto de lote (1 caixa instanciada 54.432 vezes) → alameda e travessa → árvore com LOD e
impostor → prédio por tipologia (4 famílias, cor por instância) → Praças de Quarto →
Portais, Marcos e Remates → complexos esportivos → Hangar Ícaro.

---

## 9. O que fica em aberto

Dez perguntas. Nenhuma delas tem resposta minha, todas têm o número do preço.

1. **Terreno ou lote?** Em ≤ 3° só existem 607 células de 180 m e o plano precisa de 664.
   Adota-se ≤ 4° com terraplenagem leve em 2,534 km² e lote de 300,0 m², ou ≤ 3° com lote de
   250,0 m² (16,7% menor) e a metade do holder caindo para 40,5% do sítio?
2. **Libera o índice do `ord` para extrair altura de bloco, txindex e vout por carteira?**
   Sem isso não há ordenação: 74,9% das carteiras empatam na coluna de dias do CSV.
3. **O desempate dentro dos blocos do airdrop é por txindex, depois vout, depois endereço?**
   São 20.320 carteiras (38,3% da cidade) nos três primeiros escalões. Publica antes do
   sorteio?
4. **Os 1.436 lotes de excedente entram no estoque negociável com coleções parceiras, ou
   ficam vazios até aparecer holder novo?**
5. **O bonde das 6 cordas cabe nos 6,0 m da faixa central da alameda?** Se o gabarito de via
   dupla pedir 8,0 m, as cordas passam a custar 15.400 × 2,0 = 0,031 km², que sai da reserva
   de negociação (0,194 km²) sem tocar em lote. Gabarito e frenagem em 1/6 g NÃO MEDIDOS.
6. **O anel de transbordo do bonde em r = 1.300 m fica ou sai?** É a única linha fechada do
   plano, tem 8.168 m, não tem lote nenhum e está na fronteira permanente da praça. Se sair,
   o transbordo vira Y nos 12 Portais e o percurso contínuo cai de 42.144 para 33.976 m.
7. **A cidade é pressurizada sob abóbada?** Mare Tranquillitatis não tem atmosfera. Toda a
   conta de 159.890 árvores, de copa, de grama, de piscina e a velocidade de estol do Hangar
   Ícaro pressupõe ar a 1,225 kg/m³. Se não houver pressurização, a armadura verde é dado de
   cena e não de projeto. **Nenhuma das três equipes tratou disso e é a maior dívida do
   plano.**
8. **O Hangar Ícaro entra na fase 1?** 28.800 m² de piso, 35,0 m de altura livre, cerca de
   1,0 milhão de m³ de ar. É o objeto mais caro do plano e o único sem precedente terrestre.
9. **Confirma o raio em 3.500 m?** Medido: a folga de terra ≤ 3° utilizável faz pico em
   3.700 m com +0,600 km² e zera em 3.868 m, porque o anel novo é só 52,4% de terra ≤ 3°.
   Crescer 200 m compra 0,153 km² contra um déficit de 1,85 km². Crescer não resolve.
10. **O Dog Social Club leva 1 quarteirão inteiro de 84 lotes mais 10 lotes do seguinte, ou
    94 lotes exatos partindo um quarteirão ao meio?** A primeira forma é mais limpa de gerar
    e deixa 10 lotes com testada diferente do resto do condomínio.

---

## Anexo: as ressalvas que este plano carrega, listadas

1. **Empacotamento não medido.** Resíduo orçado em 0,631 km² (2,4% do chão livre), tolerância
   até 1,700 km² (6,5%) com a ordem de encolhimento de 2.4. A absorção da costura pelo
   corredor do bulevar é a premissa mais frágil do plano.
2. **Abertura morfológica medida a 160 m, módulo real de 180 m.** O rendimento a 180 m é
   menor e não foi medido. Portão do passo 0.
3. **Declive: ≤ 4°, não ≤ 3°.** Divergência declarada do briefing, com o número (57 células,
   1,85 km²) e com a alternativa precificada.
4. **Acesso ao bonde é limite geométrico, não distância de rede.** 612 m e 12,0 min saem do
   grafo do bonde, não da malha real de alamedas. O número de rede será maior.
5. **Custo de árvore em triângulos não medido.** 214.322 instâncias contra teto de 300.000
   medido com caixa de lote.
6. **16 materiais contra 5 draw calls medidos hoje.** Precisa de chapa antes de commit.
7. **Contagem de carteiras não reconciliada.** CSV 52.996, `plan-client.tsx:53` 53.001,
   briefing 52.999. Margem de 1.436 lotes cobre.
8. **Demanda cívica dimensionada por área, não por matrícula.** 6 células, 0,194 km², 3,6 m²
   por lote. 1 lote é 1 carteira, não 1 família.
9. **Terraplenagem em 2,534 km² de terra entre 3° e 4°: volume não medido.**
10. **Ausência de atmosfera: dívida comum às três equipes, não resolvida por nenhuma.**
