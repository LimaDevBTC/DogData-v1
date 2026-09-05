# A Ria de Tranquillitatis

O projeto do centro da DogCity, fechado em 05/09/2026 por um painel de cinco partidos
independentes, cada um julgado por quatro lentes cegas (estética, lazer, técnica, custo de
Fundação) e sintetizado num projeto único.

Placar: Vale 7,1 | Enseada 6,3 | Lagoa e Restinga 6,1 | Arquipélago 6,0 | Cratera 6,0.
A síntese partiu do Vale e enxertou o resto.

## A ideia, e ela é uma medição antes de ser um desenho

**O sítio já é um plano inclinado.** Ajuste de mínimos quadrados sobre o heightmap real,
anel r 800 a 4.000, 235 mil amostras: o chão desce **1,467% no rumo 49,4**. A cidade vinha
fingindo que o terreno era uma mesa plana e cavando anéis simétricos em cima dessa ficção.

**E a Lua já fez metade da obra.** Média por setor de 40 graus entre r 1.200 e 4.500:

| quadrante | cota |
|---|---|
| NE (azimute 30 a 70) | -16,1 a -44,5 m |
| SW (azimute 200 a 260) | +19,1 a +73,6 m |

São **118 m de diferença no mesmo raio**. Cavar onde já é baixo e deixar alto o que já é
alto é de graça e parece verdade.

Daí o projeto: a água desce pelo rumo 49,4 e vira uma **ria que abre na baía**. A cidade se
parte em Cidade Baixa (norte-nordeste-leste, que encosta na areia em nível) e Cidade Alta
(sul-sudoeste-oeste, que sobe até +74 e vira a arquibancada que olha o vale por cima).

## Os números

| | |
|---|---|
| lâmina nova escavada | 6,171 km² (total do centro 9,881 km²) |
| linha de costa nova | **31,29 km** (um disco de mesma área daria 8,8: índice de forma 3,55) |
| areia sobre a margem | **98,85%**, com 360 m de exceção nomeada (doca do Poente e as três fozes) |
| areia seca | 0,875 km², largura média 28 m |
| corrida mansa da beira | 105 m a 3,81% (orla), 80 m a 4,13% (costão), 100 m a 3,60% (restinga) |
| corte / aterro | 326,7 / 105,4 Mm³, saldo +221,3 destinado a manto de 1,51 m sobre o cinturão |
| primeiro lote | r 2.105, cota -36,2; **124 m até a areia, 1,7%, sem escada** |
| lotes realocados | 11.105 de 85.830 (12,94%) |
| folga contra a casca | cresce em todo o centro; mínima do recorte inalterada (o pódio não é tocado) |

## O que o projeto inventou e que ninguém tinha pedido

**O calçadão.** 55 m de piso nivelado entre a berma e a avenida de orla. Faltou nos cinco
partidos e é ele que faz a praia ser usável: quiosque, sombra construída, vestiário, bar,
feira, ponto de barco.

**A Rampa do White Paper.** As nove estelas correm no rumo 45 e o eixo medido do vale é
49,4: estão a 4,4 graus dele. A alameda que hoje aponta para lugar nenhum passa a apontar
vale abaixo, e vira uma rampa de 635 m com 36 m de queda a 5,66%, com nove patamares, um
por estela, terminando na areia.

**A borda do tecido deixa de ser círculo.** Ela varia de r 1.250 a 3.385 conforme o rumo.
No istmo o primeiro lote fica **239 m mais perto da Needle do que qualquer lote hoje**.

## ⚠️ O conflito, e como foi resolvido

A especificação mantém a **Praça Central na cota 0**, como promontório alto com encosta
arborizada de 21,7% até a praia. O fundador olhou a cena em produção DEPOIS que o painel
começou e mandou o contrário: *"agora é só abaixar a praça central, ela ainda tem uns
degraus pra chegar na água que eu não quero; a praça é uma ilha quase na altura da água"*.

**A ordem do fundador é posterior e vence.** A praça desce para a faixa de -33 a -36, com
praia na borda, e o terraço de cinco degraus sai da beira da água. O que sobrevive da spec
nesse ponto é a ideia de a praça deixar de ser ilha redonda e virar península presa ao lado
alto por um istmo: isso quebra a simetria de compasso sem custar terra e continua valendo
com a praça baixa.

## A ordem de execução, e os dois passos que não são negociáveis

**PASSO 0, TRANCAR O BOT.** `scripts/automated_update.py` varre a árvore de hora em hora e
empurra, e `cidade-lotes.bin` e `data/dogcity_lotes.csv` são rastreados num repositório
PÚBLICO. A regeração da Fundação não pode sair por push automático.

**PASSO 1, O PERFIL VIRA DADO, NÃO CÓDIGO.** O relevo do centro passa a viver num raster
binário versionado, gerado uma vez, e `terrain.ts` e `gerar_cidade.py` LEEM dele em vez de
cada um recalcular. Esta casa já pagou três vezes por escrever a mesma forma duas vezes: o
VEX cravado na prancha, o platô no par velho, e a lagoa alpina que foi ao ar como cova seca
porque a bacia e a água nasceram em frentes diferentes. `altura()` do gerador não conhece
bacia nenhuma: escrever o perfil da ria uma segunda vez em Python é comprar a divergência.

## ⚠️ O custo de lote NAO EXISTE, e isto corrige o que esta escrito acima

Registrado em 05/09/2026, palavra do fundador: **"esqueça lotes, lotes serão gerados
somente no snapshot, faltam 7 dias"**.

Os 85.830 lotes de `cidade-lotes.bin` são provisórios: eles serão **regerados do zero no
snapshot**, sobre o terreno que existir naquele dia. Então:

- os 11.105 lotes "realocados" que a especificação contabiliza **não são custo nenhum**;
- a conta por coorte (4.337 da coorte 0, 2.969 da coorte 1) é sobre dados descartáveis e
  não representa dono nenhum;
- não é preciso trancar o bot por causa do `cidade-lotes.bin`;
- e a ordem certa inverte: **primeiro o terreno, depois os lotes**. O gerador roda uma vez,
  depois do snapshot, sobre o relevo final.

**A consequência prática é que o terreno não tem mais restrição de traçado.** A borda do
tecido pode ir para onde o projeto quiser, a praia pode ter a largura que precisar e a ria
pode ter a forma que a paisagem pedir. Onde a especificação escolheu a variante enxuta para
poupar lote, ela deve ser lida na versão cheia.

**O prazo é o que manda agora: 7 dias até o snapshot.** O terreno precisa estar fechado e
conferido antes dele, porque é sobre o terreno fechado que a Fundação inteira vai nascer.
