# O loteamento da DogCity

Estado de 28/08/2026, conferido sobre o terreno real da NASA e não sobre a planta.
Todo número aqui saiu de uma rodada de `scripts/gerar_cidade.py` ou de uma medição
sobre `public/city/cidade-lotes.bin` e `data/dogcity_lotes.csv`. Onde não foi
medido, está escrito NÃO MEDIDO.

**Nada disto está construído.** É demarcação: terra com nome e com dono, para que
o 3D venha depois sem desfazer endereço nenhum.

---

## 1. A cidade em números

| | |
|---|---|
| carteiras com endereço | **52.991 de 52.991** |
| sítio | raio 4.500 m, 63,617 km² |
| borda construída | 4.400 m (os 100 m seguintes são o Cinturão) |
| tecido disponível | 25,42 km² |
| área dos lotes | 20,24 km² |
| **lote mediano** | **297 m²** |
| menor / maior | 34 m² / 42.840 m² |
| p99 | 1.963 m² |
| quartos / quarteirões | 226 / 1.182 |
| peças demarcadas | 38, somando 136 ha |

---

## 2. As três regras que produzem isso

**Idade do UTXO diz ONDE.** A ordem é a tupla `(ts, txid, vout)` do UTXO mais
antigo, com zero colisões em 52.991. Endereço é grindável e por isso não desempata;
`txid` e `vout` são escolhidos por quem envia, nunca por quem recebe.

**Saldo diz QUANTO.** Área proporcional à raiz do saldo, com gradiente que faz a
área por DOG crescer com o raio. Proporcional puro daria razão de 648.082x entre o
maior e o menor lote; a raiz dá 805x.

**`utxo_count` diz QUE FORMA.** 1 UTXO (63,2%) é massa única, 2 a 9 (30,6%) é pátio
ou condomínio baixo, 10 a 99 (5,9%) é torre, 100+ (114 carteiras) é quarteirão com
várias torres. Medido: R² de 0,053 contra o saldo, ou seja eixo independente.

---

## 3. O teste sobre o terreno real

A planta 2D desenha sobre um disco perfeito. O mundo tem relevo, cova de parque,
platô e a saia da abóbada. Estas chapas são a conferência na cena, com `?tecido=1`
(o módulo é `app/city/plaza/tecido.ts`).

O módulo tem dois registros, e confundir os dois foi erro de origem: `modo=massa`
(padrão) é o modelo de apresentação, e `modo=demarcacao` é a chapa de diagnóstico,
com plinto raso e cor por coorte, boa para achar lote em máscara e costura torta e
péssima como imagem.

### O plano, de cima

![O tecido inteiro visto do alto, com a Praça Central no meio](docs/loteamento/massa-plano.jpeg)

Os doze bulevares de costura saem da praça como artérias, os quarteirões preenchem
entre eles, e as peças demarcadas aparecem em cor: azul escuro os lagos, verde os
jardins, areia o cívico, marrom a cadeia de distribuição.

### O tecido no nível do olho

![Modelo de massa ao amanhecer](docs/loteamento/massa-v1.jpeg)

⚠️ **Isto é modelo de massa, não projeto de prédio.** Volume claro sem fachada, com
a altura vindo da tipologia que o `utxo_count` já determina: massa única, pátio,
condomínio, torre, quarteirão. É como se apresenta plano urbano ANTES de existir
arquitetura, e é o que deixa o plano ter relevo em vez de parecer planta extrudada.

O sol a 16° (`?hour=morning`) é escolha e não acaso: sombra longa é o que dá
profundidade a um modelo de massa. Ao fundo, a Praça Central e as três torres.

### A cidade dentro da abóbada

![A cidade sob a colmeia](docs/loteamento/massa-borda.jpeg)

⚠️ Chapa com defeito conhecido: vista de dentro e de perto, o vidro aditivo da
colmeia lava a cidade em manchas claras e a nervura vira uma grade dura por cima do
tecido. O LOD de textura que resolveria isso está listado como não implementado em
`app/city/plaza/dome.ts`.

---

## 4. A demarcação: 38 peças, 136 ha

Reservadas **antes** do lote, cumprindo `masterplan.md:268-269` pela primeira vez.
O gerador se recusa a gravar se algum lote cair dentro de peça, e a conferência
está em `scripts/gerar_cidade.py`.

| tipo | peças | ha |
|---|---|---|
| distribuição | 15 | 33,5 |
| jardim e parque | 4 | 31,7 |
| água | 2 | 28,5 |
| cívico | 12 | 25,8 |
| esporte | 5 | 16,4 |

**A cadeia de distribuição das moedas** é o caminho de uma transação pagando um
endereço, posto no chão: a nave pousa fora, no Spaceport em r 5.150; a moeda entra
pelo **Portão da Abóbada** (rumo 177°, r 4.450); é triada na **Alfândega**; passa
pelo **Pátio de Contêineres**; e desce pelos bulevares até as **12 Centrais de
Distribuição**, uma por setor, em r 2.200.

**Esporte** tem Estádio Olímpico com pista de 400 m, Estádio de Futebol, ginásio
coberto, complexo aquático e skatepark. **Água** tem Lago Maior (680 × 400 m) e Lago
do Poente. **Jardim** tem Botânico, Parque Central, Jardim das Coortes e Alameda dos
Fundadores.

Já eram estrutura e não precisaram de demarcação: as 226 praças de quarto (cerca de
3,6 km²), os 12 bulevares, o precinto da praça, o Parque Runestone e o Coliseu
congelado.

---

## 5. A abóbada e a estação

![A abóbada de colmeia](docs/loteamento/domo-4500.jpeg)

Colmeia de célula 42 m cobrindo o sítio inteiro: 13.885 células, 334.818 triângulos.
A cidade é pressurizada.

![A estação fora da casca](docs/loteamento/estacao-4500.jpeg)

Foguete não atravessa a abóbada, então a estação foi para **raio 5.150**, com 350 m
de chão livre além da saia. E a órbita das naves subiu 1.020 m para passar por cima
da coroa.

---

## 6. O registro: quem é dono de qual lote

`data/dogcity_lotes.csv`, 52.991 linhas. Uma por carteira, com `lot_id`, endereço,
ordem de chegada, setor, quarto, quarteirão, número, posição, raio, frente,
profundidade, área, saldo, `utxo_count`, forma, coorte, família e a marca do DSC.

O formato do endereço é `S{setor}-Q{quarto}-B{quarteirão}-L{lote}`. A carteira mais
antiga da cidade:

```
lot_id   S04-Q01-B001-L001
raio     1.338 m   (o mais perto da praça que existe)
área     1.392 m²  ·  37,4M DOG  ·  1 UTXO  ·  massa única  ·  coorte 0
```

⚠️ **A ordem das linhas do CSV é a ordem dos registros do `.bin`, uma para uma.** A
prancha e a cena desenham pelo índice e o registro dá o nome. Quebrar essa
correspondência desalinha o mapa inteiro em silêncio.

---

## 7. O que foi conferido, e com que resultado

| conferência | resultado |
|---|---|
| carteiras sem lote | **0** |
| endereços duplicados | **0** |
| `lot_id` duplicados | **0** |
| lotes dentro do Coliseu congelado | **0** |
| lotes dentro do Parque Runestone | **0** |
| lotes fora do sítio | **0** |
| lotes dentro de peça demarcada | **0** |
| CSV alinhado com o `.bin` | **sim, registro a registro** |
| R² de coorte contra raio | **0,6135** (era 0,8004 com o contorno lobado) |
| sobreposição entre coortes vizinhas | 76,1% |
| regra "mais antigo, mais perto da praça" | **10 dos 12 setores monótonos** |

---

## 8. Defeitos conhecidos, sem maquiagem

**O setor 2 tem uma inversão de 35 m** entre as coortes 3 e 4 (1.533 contra 1.498
de raio médio). Ele é o setor que o Parque Runestone esmaga, com 15,8 ha contra os
250 a 290 dos outros; com tão pouca terra, a janela de busca do empacotador às vezes
põe um lote mais novo numa prateleira mais interna. É defeito, não decisão.

**O setor 3 quebra a monotonia de propósito.** É o condomínio do Dog Social Club
ocupando os lotes mais internos ignorando a idade, que é a regra 4 do fundador.

**455 lotes (0,86%) têm o setor gravado diferente do rumo geométrico.** São lotes
cuja borda cruza a costura entre setores. Vieram de 49.021 (92,5%) antes do conserto
da rotação dupla em 28/08.

**O aproveitamento do tecido é 83%.** O resto se perde em ponta de prateleira e na
frente mínima de 5 m. Já foi 71,8%.

**O contorno voltou a ser um disco.** As cinco pétalas foram testadas e reprovadas:
compravam 0,047 de R² e cobravam 6,46 km² de lote e 91 m² na mediana. A modulação de
cinco sobrevive como **ritmo no cotista**, não como recorte no contorno.

---

## 9. O que ainda não existe

O 3D dos prédios. A forma por `utxo_count` está gravada em 3 bits e nada a
renderiza: massa única, pátio, condomínio, torre e quarteirão existem no dado e não
na tela.

A regra publicada. Enquanto a alocação não for pública com a tupla de desempate, a
curva, as cotas e a lista das 38 peças, mudar qualquer coisa ainda é barato. Depois
vira acusação de favorecimento.
