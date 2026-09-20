# DOG GAME MODE

Plano aberto em 09/09/2026. Estrutura a passagem da DogCity de **maquete que se
sobrevoa** para **lugar onde se anda, se dirige e se constrói**.

O pedido do fundador, em três frases dele, nesta ordem:

> "Não existe a gente ter que ficar criando blocos enormes de concreto."
>
> "Temos, ainda, depois de muitas revisões, ruas levitando fora do chão... parece
> que nossas vias foram jogadas de qualquer forma no terreno, geradas por um
> script único que não conversa com o terreno."
>
> "Precisamos ter em mente que o user vai andar pela cidade com um boneco do $DOG
> de 1,70 m, dirigir carro..."

**Nada aqui foi implementado.** Este documento é o diagnóstico medido, as leis que
passam a valer e a ordem de execução.

## 1. A régua nova: 1,70 m

Tudo o que segue se julga contra o boneco. Um erro de 30 cm era invisível numa
câmera a 700 m de altura e é um degrau de 18% da altura do personagem no chão.
As tolerâncias da cidade mudam de ordem de grandeza junto com o ponto de vista.

| referência | medida |
|---|---|
| personagem | **1,70 m** |
| meio-fio da cidade | 0,15 m |
| degrau de calçada para canteiro | 0,07 m |
| erro aceitável de piso, daqui em diante | **≤ 0,03 m** |

## 2. O diagnóstico, medido em 09/09/2026

### 2.1 Existem DUAS superfícies, e ninguém garantiu que elas coincidem

`terrain.ts` declara a doutrina: quem **desenha chão** (via, praça, lote, peça)
usa `superficieAt`; quem precisa da **superfície real** (câmera, física) usa
`heightAt`. Medido agora, no tecido, 20.000 sondas:

| diferença entre `heightAt` e `superficieAt` | mediana | p90 | p99 | máximo |
|---|---:|---:|---:|---:|
| | 3,3 cm | **25,7 cm** | **109,3 cm** | **6,79 m** |

⚠️ **E `vias.ts` usa a função ERRADA.** Treze chamadas a `heightAt`, nenhuma a
`superficieAt`. A rua é desenhada sobre uma superfície e o chão que aparece é
outra. É a causa mecânica de "ruas levitando", e não é ajuste fino: é a doutrina
do próprio motor sendo violada em 13 pontos.

### 2.2 Duas tesselações desencontradas da mesma função

A via poligoniza em cordas de **24 m** escolhidas pelo traçado da rua. A malha do
terreno usa células de **~59 m** alinhadas à grade do terreno. Mesma função,
vértices em lugares diferentes: uma estoura acima da outra por construção.

Flecha entre a corda de dois nós e o chão, medida em 4.000 trechos por
espaçamento, no tecido:

| nós a cada | mediana | p90 | p99 | máximo |
|---:|---:|---:|---:|---:|
| 8 m | 0 cm | **1 cm** | 9 cm | 500 cm |
| 12 m | 0 cm | 2 cm | 15 cm | 707 cm |
| 20 m | 1 cm | 6 cm | 43 cm | 795 cm |
| 40 m | 4 cm | **27 cm** | 126 cm | 682 cm |
| 80 m | 19 cm | **82 cm** | 253 cm | 959 cm |

O meio-fio tem 15 cm. A partir de nós a cada 40 m a rua flutua mais que a altura
do próprio meio-fio.

### 2.3 Os outros dois sintomas têm a mesma raiz

**A grama picotada** é o ombro (banda verde de 5 a 9 m entre calçada e terreno).
Ele é amostrado no mesmo passo de 24 m e tem um limitador de desnível de **3 m**
que, quando estoura, vira degrau em vez de rampa. Por isso o defeito aparece
justamente onde há relevo, que é onde há grama.

**A copa de árvore desenhada no chão** não é decalque nem sombra assada: é
**sombra dinâmica real** projetando a silhueta da copa. O que a faz ler errado é
a árvore ser plantada em `heightAt` enquanto o chão que recebe a sombra é
`superficieAt`. Tronco e sombra vivem em superfícies diferentes.

### 2.4 O que hoje impede um personagem de caminhar

| obstáculo | medida | veredito |
|---|---|---|
| degrau invisível no meio da pista | 0,30 a 1,00 m | **quebra o jogo** |
| talude de berma, limitador de desnível | até 3,00 m | **quebra o jogo** |
| transição para tabuleiro de ponte | salto de até 7 m, sem rampa modelada | **quebra o jogo** |
| árvore com base fora do piso | 0,26 m no p90 | quebra a leitura |
| meio-fio | 0,15 m | correto |
| calçada para canteiro | 0,07 m | correto |

### 2.5 O bloco de concreto: a escala é o problema, não o nivelamento

Amplitude do terreno natural por escala, medida no tecido:

| escala | mediana | p90 |
|---|---:|---:|
| **lote mediano, 14 × 14 m** | **0,72 m** | 1,60 m |
| lote grande, 40 × 40 m | 2,03 m | 4,74 m |
| quarteirão, 168 × 168 m | 8,30 m | 15,63 m |
| **parcela cívica, 480 × 480 m** | **21,92 m** | 42,20 m |

Declividade do tecido: mediana **4,2%**, p90 9,7%, p99 24,8%. Só 14,8% do tecido
passa de 8%, 6,7% passa de 12% e 2,2% passa de 20%.

⚠️ **O pódio de concreto existe porque se nivela 480 m de uma vez.** Um lote
varia 72 cm, que é degrau de escada. Uma parcela cívica varia 22 m, que é prédio
de sete andares, e vira muro. A solução atual não escala e também não precisa
escalar: o problema que ela resolve só existe na escala cívica.

E o custo inverte a intuição: nivelar **cada um dos 85.804 lotes**
individualmente custa da ordem de **3,0 Mm³** (197 m² × 0,72 m ÷ 4 por lote,
estimativa, não medição), contra os **2,74 Mm³** que o campus sozinho custou. A
cidade inteira, lote a lote, sai pelo preço de uma parcela cívica.

## 3. As leis do DOG GAME MODE

1. **Uma superfície só. O que se vê é o que se pisa.** Desenho, física, plantio,
   pouso de peça e sombra pousam na MESMA função. A outra deixa de existir como
   destino: vira apenas a fonte de onde a superfície é gerada.
2. **A rua manda o greide.** A via é a referência de nível do quarteirão, com
   greide suavizado ao longo do eixo. O lote se pendura nela. Cidade real não
   nivela bairro, nivela rua.
3. **Nivelamento na escala do lote.** Cada lote ganha uma cota própria, ancorada
   na testada. Cerca de 35 m³ por lote, um caminhão e meio.
4. **Concreto só na escala cívica.** Pódio, laje e muro continuam válidos para
   arena e equipamento público, e são proibidos como solução de tecido.
5. **O desnível entre vizinhos é muro de divisa, não penhasco.** Nada de talude
   solto de 3 m: acima do limite, vira muro modelado ou o terreno não é lotável.
6. **Escala humana é verificável.** Todo piso de circulação passa por um teste
   automático de degrau máximo, declividade máxima e continuidade, com o boneco
   de 1,70 m como régua.

## 4. A arquitetura: um mapa de terraplanagem, não camadas empilhadas

Hoje cada parcela é uma função que intercepta o `heightAt` com uma porta rápida
própria (`campusAlturaAt`, `aquaticsAlturaAt`). Isso funciona para duas parcelas
e **não funciona para 85.804 lotes**: seriam dezenas de milhares de testes por
consulta de altura, e a consulta acontece a cada quadro, para câmera, pouso de
peça, plantio e física.

O caminho é o gerador calcular **um raster de deltas** entre o terreno natural e
o terreno urbanizado, e a consulta de altura virar uma leitura bilinear nele.

| escopo | resolução | amostras | memória (meia precisão) |
|---|---|---:|---:|
| tecido urbano, 43,5 km² | 4 m | 2,7 M | ~5,4 MB, algo como 2 a 3 MB comprimido |
| sítio inteiro, 248,3 km² | 4 m | 15,5 M | ~31 MB |
| sítio inteiro, 8 m | 8 m | 3,9 M | ~7,8 MB |

**Recomendado: raster de 4 m cobrindo o tecido**, que é onde se anda. Fora dele o
terreno natural continua valendo. Isso é a mesma ordem de grandeza do que a
cidade já baixa em modelos, e substitui toda a lógica de pódio por uma textura.

O que esse mapa carrega, gerado por regra e não à mão: o greide das vias, o platô
de cada lote, os taludes e muros de divisa, e a costura entre eles. Sendo um
produto do gerador, continua reprodutível e verificável, que é a condição para o
snapshot e o mint não dependerem de gosto.

## 5. O editor gráfico

A intuição inicial do fundador foi subdividir o terreno em células de 1 × 1 m.
Medido:

| | |
|---|---:|
| células de 1 m² no sítio | **248,3 milhões** |
| só no tecido | 66,8 milhões |
| memória com 1 byte por célula | 248 MB |
| triângulos se virasse chão desenhado | ~496 milhões |
| triângulos da cena inteira hoje | **4,94 milhões** |

⚠️ **E os jogos da referência não usam nada perto disso: SimCity 4 usa célula de
16 m e Cities: Skylines usa 8 m.** Eles parecem precisos porque tudo neles nasce
alinhado à célula, não porque a célula é pequena.

Esta cidade já tem a célula dela, e ela é polar: o módulo da teia (109, 168, 227
e 286 m conforme a banda), com travessa de 9 m e calçada de 12 m.

**O editor certo é de parâmetros, não de pixels.** Você seleciona a peça, arrasta,
e ela pula de módulo em módulo; gira, e ela trava nas orientações legais. Por
baixo, o que muda é `{i, nr, j, ns}` e um rumo. Isso preserva a regra que segura a
cidade inteira: nenhuma peça tem coordenada absoluta escrita.

⚠️ **E EDIÇÃO LIVRE NÃO CONSERTA ESQUADRO, ELA O DESTRÓI.** O defeito que o
fundador viu na peça aquática tinha **2,143°**. Ninguém acerta 2,1° arrastando com
o mouse. O que resolve é snap, e snap precisa da teia.

⚠️ **O editor emite um arquivo declarativo de edições, nunca muda o estado
direto.** No dia em que a cidade for editada à mão sem isso, ou o editor vira a
fonte de verdade ou ele briga com o `gerar_cidade.py`, e o loteamento dos holders
nasce dessa geometria.

## 6. Ordem de execução

| fase | o que entrega | por que nesta ordem | esforço |
|---|---|---|---|
| 1 | superfície única e passo da via em 8 m | derruba o erro de piso de 27 cm para 1 cm e conserta os três sintomas de uma vez | 1 a 2 dias |
| 2 | rampas nas transições: ponte, berma, meio-fio de esquina | tira os obstáculos que quebram a caminhada | 2 a 3 dias |
| 3 | raster de deltas do tecido, gerado por regra | substitui pódio por terraplanagem de verdade e escala para o mint | 1 a 2 semanas |
| 4 | teste automático de escala humana | impede a regressão: degrau, declividade e continuidade viram portão | 1 dia |
| 5 | editor de parâmetros com snap e overlay declarativo | edição no olho sem perder reprodutibilidade | 2 a 4 dias |
| 6 | catálogo de elementos com pincel de densidade | colocar e tirar árvore, poste, mobiliário | 3 a 5 dias |
| 7 | personagem e veículo sobre a superfície única | o modo jogo em si | a estimar |

As fases 1, 2 e 4 são baratas e independentes do mint. A fase 3 é a que encosta
no snapshot e precisa das decisões abaixo antes de começar.

## 7. Decisões que são do fundador, e que travam a fase 3

1. **Qual a declividade máxima lotável.** Em 20% custa 2,2% do tecido, em 12%
   custa 6,7%. Isso define quantos lotes existem, e o snapshot depende disso.
2. **Quem paga o talude entre dois lotes vizinhos**: o lote de cima, o de baixo,
   ou a cidade entrega os dois já aplanados. É o que o holder recebe quando minta.
3. **Se o terreno não lotável vira parque, mirante ou nada.**

## 8. Limites deste documento

Nenhuma linha de código foi escrita. As medições de terreno são de 09/09/2026,
offline, contra `buildTerrain` sobre `btc-core-heightmap.f32`, com os canais e o
leito de `cidade-malha.json`. As leituras de `vias.ts`, `arborizacao.ts` e
`terrain.ts` são de auditoria de código, com arquivo e linha, não de execução
instrumentada. O custo de terraplanagem por lote (3,0 Mm³) é estimativa
aritmética, não medição contra o loteamento, que ainda não existe: os lotes de
hoje são teste e os de verdade nascem no snapshot do bloco 966.670. Nada aqui foi
verificado em telefone físico nem com personagem em cena, porque personagem em
cena ainda não existe.

## 9. Decisões do fundador, 16/09/2026

Contexto: snapshot do bloco 966.670 já passou e o fundo está a menos de 2M dos
10M. O modo a pé entra junto com a estruturação da cidade, em três trilhos:
A (caminho do mint), B (modo a pé), C (cidade no chão). O trilho B não pode
bloquear o A.

1. **A vista aérea vira MODO MAPA.** O modo a pé é o principal; o mapa fica para
   visão geral, escolha de destino e o tour da live.
2. **Carro existe, como item.** Carros são Ordinals, itens dentro da cidade. Isso
   substitui a proibição de carro particular do plano diretor.
3. **Celular tem modo a pé já na primeira versão**, em perfil leve.
4. **Arte do boneco:** o fundador está desenhando. Até lá o trilho B anda com
   cápsula no lugar do personagem.
5. **Declividade máxima lotável: 12%.** Decidido em 16/09 contra medição dos
   85.804 lotes de teste: 2.513 lotes (2,9%) ficam acima, o que custa 1,1% da
   área loteada. O limiar quase não muda a terraplanagem (cortar acima de 12%
   economiza 3% do volume), então ele é escolha de qualidade urbana: 12% é o que
   se sobe andando e é limite normal de rua. A carteira de um lote reprovado é
   recolocada pelo gerador, ninguém fica sem lote. Terreno reprovado vira parque
   ou mirante, o que fecha também a terceira pergunta do §7.
6. **O desnível entre vizinhos é pago pela cidade, e ninguém perde área.** Cada
   lote é entregue plano na cota da sua testada. O desnível com o vizinho vira
   muro de arrimo na divisa, construído pela cidade. A área do deed é sempre a
   área inteira do lote. Talude dentro do lote está PROIBIDO como solução de
   divisa: ele tiraria 5,7% da área do lote na mediana e 12,1% no p90, e faria o
   holder pagar pelo azar do relevo, contra a regra "a localização não se
   compra". Medido: 77% das divisas ficam abaixo de 0,5 m, 1% passa de 2 m e
   0,4% passa de 3 m.

Medição em `/tmp` (não versionada), refeita quando o registro real existir: a
cota do lote usou o CENTRO como proxy da testada, então os números de divisa são
ordem de grandeza, não valor final.

Ordem do trilho B: B1 controlador 2,5D sobre `superficieAt` com colisão por
pegada 2D e câmera de ombro (desktop e toque); B2 plano de profundidade, sombra
que segue o jogador, névoa e perfil "a pé"; B3 personagem; B4 portão de escala
humana com robô que percorre o grafo de vias.
