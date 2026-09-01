# DogCity: a spec do sócio

Estado de 01/09/2026. Montado contra `scripts/gerar_cidade.py`, a rodada de
`public/city/cidade.json` de 31/08 01:21, a rota de doações em produção e os
documentos `plano-diretor.md`, `masterplan.md`, `orcamento-de-terra.md`,
`loteamento.md`, `fundacao.md` e `maquete-spec.md`.

Versão em página: https://claude.ai/code/artifact/95b830e3-c570-4e97-8e99-03da373bf419

⚠️ **Onde este texto divergir do gerador, o gerador vence.**

---

## 1. A ideia

A DogCity é a base de holders do rune DOG desenhada como cidade real, sobre o
relevo lunar de verdade da NASA (SLDEM2015, Mare Tranquillitatis). Cada carteira
com DOG recebe um lote com endereço, e a posição é a história dela na cadeia:
quem chegou primeiro mora mais perto da praça.

**A posição não se compra.** Doação, parceria e licença mudam o que se pode
construir, nunca onde se mora. É o que separa isso de um mapa de venda de
terreno.

**Estado honesto:** a cidade está no ar em `/city` como canteiro de obras
(terreno, baía, vias, canais, arborização, programa cívico demarcado). O prédio
não existe. Nada foi mintado, a regra de alocação não foi publicada, e por isso
tudo ainda é reversível de graça.

---

## 2. Onde mora dentro do DogData

| rota | o que é |
|---|---|
| `/dogcity` | landing oficial, funil de doação, registro de fundadores |
| `/city` | a cidade em 3D, pública |
| `/city/plan` | pranchas de fundação, fechadas por chave |
| `/galaxy` | genealogia das carteiras |
| `/runestone` | o parque nacional e seus holders |

---

## 3. As três regras da fundação

| dado | decide | como |
|---|---|---|
| idade do UTXO mais antigo | ONDE | ordem por `(ts, txid, vout)`, zero colisões em 85.843 |
| saldo | QUANTO | área pela RAIZ do saldo, com gradiente centro-periferia |
| `utxo_count` | QUE FORMA | 1 massa única, 2 a 9 pátio, 10 a 99 torre, 100+ quarteirão |

A chave é `(ts, txid, vout)` porque endereço é grindável e idade em dias empata
três quartos da cidade. `txid` e `vout` são escolhidos por quem envia.

**O corte de 20k mudou de sentido em 29/08:** decidia quem existe no mapa, hoje
decide quem pode construir. Toda carteira com DOG recebe chão; abaixo de 20k o
lote fica demarcado e vazio. As 32.863 carteiras abaixo do corte somam 0,10% do
supply e custam 2,7% de área de cada um.

---

## 4. O sítio

- Terreno real regerado em 30/08 para 11.000 m de raio (429×429, relevo −182 a +230).
- Cidade cresceu de 4.500 para **7.000 m** em 30/08 (fundador: "não existe
  limitação espacial").
- Abóbada de colmeia pressurizada fecha em 6.900; o lote para antes dela.
- Baía: 20,48 km² num corpo só, com orla construída de 52 m (muro, passeio 26 m,
  pista 14 m, talude 12 m). Os outros 19 lagos ficam com praia natural.
- Parque Runestone foi para 9.800 m, fora da abóbada.
- 1 unidade de mundo = 1 metro.

Corte do raio: praça até 1.024 · rampa até 1.450 · tecido 1.450 a 5.500
(bandas de quarteirão 109, 168, 227, 286 m) · cinturão produtivo 5.500 a 6.900 ·
abóbada 6.900 · pista de serviço 7.600 · parque 9.800.

---

## 5. Números (cidade.json de 31/08)

| | |
|---|---|
| carteiras com lote | **85.843 de 85.843** |
| lote mediano | **238 m²** (menor 24, maior 73.818) |
| tecido disponível | 47,30 km² |
| área de lote | 30,36 km² |
| distritos | 6 |
| quartos / quarteirões | 125 / 1.859 |
| programa cívico | 70 peças, 1.608 ha |
| anéis viários | 7, 617 ha |
| enclaves de família | 391, cobrindo 43.392 carteiras |
| lotes do Dog Social Club | 41 |

---

## 6. A organização urbana

- **Teia, não grade.** 6 distritos de abertura desigual, malha girada 34 a 46°
  FORA da tangente ao anel. Malha tangente vira alvo de tiro; fatia igual vira
  mandala.
- **O grão muda com o raio.** Quarteirão único em 53 mil lotes lê como veludo
  cotelê. As bandas saem da regra da rua: toda fileira dá frente para via.
- **A rua é estrutura primária**, grafo de arcos e radiais; o quarteirão é o que
  sobra. Antes ela era derivada do quarteirão e toda esquina tinha buraco de
  12×12 m.
- **Mobilidade:** 9 radiais + 7 anéis na superfície, metrô a −26 m (estação no
  cruzamento não custa lote), 3 autopistas em túnel a 35 m de cobertura, canais
  na escala das grachten.
- **Cinturão produtivo** de 5.500 a 6.900: fazendas de proteína, lagos de pesca,
  campos solares, indústria, floresta, golfe, com 2 avenidas de escoamento.
- **Programa cívico entra ANTES do lote**, como máscara de terra. Lote atribuído
  não se desfaz.

---

## 7. Pipeline e regras da casa

| etapa | onde |
|---|---|
| dado on-chain | `data/dog_utxos_by_address.json`, `data/holders_by_age.csv` |
| cartório | `scripts/gerar_cidade.py` |
| registro | `data/dogcity_lotes.csv` (85.843 linhas) |
| geometria | `public/city/cidade-lotes.bin` (13 bytes por lote, mesma ordem) |
| malha | `public/city/cidade-malha.json` |
| cena | `app/city/plaza/*.ts`, Three.js puro |

Regras: Three.js puro (r3f quebra neste repo) · a ordem infra → peça → lote é lei
· medir e não achar, com NÃO MEDIDO escrito onde não mediu · nenhum lote se move
· sem travessão na copy.

⚠️ **Os `.md` são escritos em camadas por data.** `loteamento.md` e
`orcamento-de-terra.md` descrevem a cidade de 4.500 m com 52.984 carteiras, que
morreu em 30/08. Confira a data antes de usar um número.

---

## 8. Economia

Fundo de construção, medido em 01/09/2026: **3.683.708 DOG, 36,84% da meta de
10M, 29 carteiras doadoras**, a primeira em 02/11/2025.

| nível | limiar | o que dá |
|---|---|---|
| Founder | qualquer valor | nome no Monumento dos Fundadores, sem mint |
| Personal | 10.000 DOG | mint do prédio pagando só a taxa de rede |
| Commercial | 50.000 DOG | + customização de modelo e cor, + anúncio na fachada |
| Patron | 500.000 DOG | título e acesso prioritário |

Ciclo do prédio: constrói em 20k, sustenta em 10k, ruína abaixo de 10k,
reconstrói em 20k. Ruína é arqueologia on-chain, o lote nunca é confiscado.

---

## 9. Linha do tempo (em blocos, nada em datas)

1. fundo perto de 75%: campanha educativa (consolidar UTXO destrói idade)
2. fundo cruza 10M no bloco B: snapshot agendado para **N = B + 1008**
3. bloco N: registro computado, mapa e merkle root públicos, **432 blocos** de auditoria
4. Charter inscrito com o merkle root, mint abre, deeds nascem filhos dele

---

## 10. Estado por frente

**No ar:** terreno, baía, lagos, canais, praça, mempool em órbita, chat, malha
viária, anéis, arborização, programa, loteamento gravado (modo obra), landing e
funil.

**Planta:** prédios em 3D por tipologia, maquete de apresentação
(`maquete-spec.md`), metrô e autopistas, mint e Charter.

**Aberto:** publicar a regra de alocação, quantas coleções parceiras entram, o
que ocupa o miolo do quarteirão.

---

## 11. Defeitos conhecidos

- A cidade de 7.000 m ainda não passou pela bateria de conferência que a de 4.500
  passou (zero sem lote, zero duplicado, zero lote em peça).
- `fundacao.md` defende bairro por linhagem, ideia que a própria medição matou
  (70% da cidade não tem família na cadeia). Venceu a idade.
- Ocupação do tecido é o número a vigiar: quarteirão meio vazio lê como ruína.
- A regra do DSC exige ordinal e 20k na mesma carteira, o que exclui 60 das 94
  carteiras da coleção. Intencional, decidido pelo fundador.
- Nenhum prédio existe, e a promessa visual da landing depende disso.
