# A INFRA DA DOGCITY: o que modelar, e em que ordem

**Estado:** lista de prioridade aberta em 06/09/2026, depois do `$DOG ARENA`.
**Por que existe:** decisão do fundador, 06/09: *"a qualidade das renderizações 3D
e da modelagem que a gente está fazendo incentiva possíveis parceiros e
patrocinadores a investirem no projeto"*. Ou seja: **a modelagem não é decoração,
é material de venda.** A ordem abaixo é a que maximiza retorno comercial e
visual, não a que é mais fácil.

---

## 1. Onde estamos

| | |
|---|---|
| modelos que existem | 9: as 3 torres, o spaceport, a praça, o marco do Bitcoin, o Leonidas, o mobiliário e o **estádio** |
| reservas sem geometria | **70 peças** no programa, entre elas 14 cívicas já nomeadas |
| o que o estádio provou | uma peça leva ~1 dia de trabalho e sai com 85 mil triângulos e 415 KB, sem textura nenhuma |

## 2. Os cinco critérios da ordem

Não é gosto. Cada peça abaixo foi pontuada por:

1. **Silhueta de longe.** Aparece na aérea, na chapa de imprensa e no tour da
   live? Prédio que só existe de perto rende uma foto e nunca mais.
2. **Prova de tecnologia.** Ele MOSTRA que a cidade é viva, com dado real da
   cadeia? Isso é o que separa uma maquete bonita de um produto.
3. **Naming rights.** Dá para vender o nome dele, como o estádio?
4. **História do projeto.** Ele conta o DOG, o Bitcoin, o airdrop? Conteúdo de
   marca não se compra depois.
5. **Custo.** Obra própria inteira, ou o acervo CC0/CC-BY resolve parte?

## 3. A ordem recomendada

### Onda 1 · as quatro que vendem o projeto

Estas quatro, juntas, contam a história inteira para um patrocinador que abre a
cidade pela primeira vez. Todas já têm reserva no programa.

| # | Peça | Por que é a primeira linha |
|---|---|---|
| 1 | **Colosso do $DOG** | a estátua colossal na chegada. É a Estátua da Liberdade desta cidade: silhueta única, reconhecível em miniatura, e fica exatamente por onde todo mundo entra. Nenhuma outra peça rende tanta imagem por metro cúbico. ⚠️ **Sítio corrigido em 06/09, ver abaixo**: não existe "portão" |
| 2 | **DOG DATA HQ** | a **fachada-ticker ao vivo**: preço, holders, LTH/STH, tudo dado real que o site já publica. É o único prédio que PROVA que a cidade está ligada na cadeia. Para parceiro, vale mais que dez prédios bonitos |
| 3 | **Casa da Moeda** (*The City Mint*) | onde os deeds nascem. A interface de mint leva o holder até a porta dela, então ela é a única peça que participa do produto em vez de ilustrá-lo |
| 4 | **Museu da Runa** | etching, airdrop, halvings e as transações históricas viram espaço. É o lugar onde a história do $DOG fica guardada, e é conteúdo de marca que não se improvisa depois |

> ### ⚠️ Correção de 06/09: não existe portão
>
> Esta lista nasceu com duas peças ancoradas num "Portão" da cidade, e o
> fundador desfez a premissa: **a DogCity é fechada, e a ligação com o exterior
> é só por TÚNEL, com eclusas internas de controle de pressão.** Não há muralha,
> não há arco de entrada, não há estrada chegando do horizonte.
>
> O que isso muda: a peça continua boa, o SÍTIO dela é que estava errado. O
> ponto de chegada real da cidade é a **eclusa** e o **spaceport** da Praça
> Central, que é onde a cena já mostra gente e nave chegando. O Colosso vai para
> a esplanada de desembarque, e o farol vira farol de pouso.
>
> Vale como regra e não só como conserto: peça de infra desta cidade não pode
> ser desenhada a partir de uma cidade genérica. Muralha, portão, porto, estrada
> de entrada e chaminé não existem aqui, e uma lista que os assume vende uma
> cidade que não é esta.

### Onda 2 · o cartão-postal noturno

A cidade já tem uma noite bonita (a fita de LED do estádio provou). Estas quatro
existem para a foto das 3 da manhã.

| # | Peça | O que ela entrega |
|---|---|---|
| 5 | **Farol do Spaceport** | luz girando de verdade. Um farol é a peça mais barata que existe em triângulo e a mais cara em imagem. Aqui ele não guia navio: guia POUSO, e o spaceport da praça já tem tráfego (a mempool orbita e desce nele) |
| 6 | **Observatório do Cinturão** | no alto, mirando a Terra. Liga direto ao `DOG•GO•TO•THE•MOON` sem precisar escrever a frase |
| 7 | **Teatro Municipal** | a única fachada NOBRE do programa: colunata, escadaria, praça própria. É o contraponto clássico às três torres de vidro |
| 8 | **Mirante do Cinturão** | o ponto de onde se fotografa a cidade inteira. Ele existe para a câmera, e é honesto que seja assim |

### Onda 3 · a receita

| # | Peça | Argumento comercial |
|---|---|---|
| 9 | **Arena coberta** (12.000 lugares) | o segundo naming rights, e o modelo do estádio já resolveu bacia, pele e letreiro: aqui é reaproveitamento direto |
| 10 | **Grand Hotel** | candidato natural a marca parceira, e dá um volume alto perto do centro de convenções |
| 11 | **Centro de convenções** | o lugar onde um evento do ecossistema aconteceria. Vende-se junto com o hotel |

### Onda 4 · a cidade que se habita

DOG University, Hospital Geral com heliponto, City Hall, Mercado Municipal,
Memorial do DOG Perdido, Mempool Post. São as que dão densidade e verdade urbana.
Impacto individual menor, valor somado alto: uma cidade sem elas continua parecendo
maquete de vitrine.

### Fora da fila por enquanto

Aeroporto, porto e ponte icônica são caros e dependem de decisões que ainda não
existem (onde fica a água navegável, se há voo). Escolas, postos de saúde,
quartéis e torres d'água são repetição: entram como KIT depois que uma delas
estiver boa.

## 4. A receita, que o estádio deixou pronta

Toda peça daqui em diante segue o mesmo caminho, e é ele que faz uma por dia ser
possível:

1. **Sítio primeiro, e sítio é MÓDULO da teia**, nunca coordenada. A peça nasce
   com rua nos quatro lados por construção (`programa.ts:22`).
2. **Geometria por parâmetro**, com a conta num script que o documento e o modelo
   compartilham (foi assim que a bacia do estádio nunca divergiu da planta).
3. **Acervo antes de modelar.** Sketchfab CC0/CC-BY para o verticalzinho, com
   crédito no mesmo commit.
4. **Sem textura sempre que possível.** O estádio tem 415 KB e zero imagens: é o
   que o celular aguenta.
5. **Cota de assentamento medida em GRADE, na área que a peça COBRE**, mais o
   platô com talude quando o terreno pedir.
6. **A peça entra no tour da live.** Cada parada nova é exposição contínua na
   transmissão, e isso é metade do valor de marketing de modelar.

## 5. O que já saiu desta lista

**A arena poliesportiva coberta**, escolhida pelo fundador em 06/09 na frente do
Colosso. Fechou no mesmo dia como **THE GEODE**: um cume de obsidiana facetado,
simétrico, com 28.240 lugares e piso de show de 48 x 28 m. Plano completo em
`geode.md`; fonte em `blender/build_arena.py`; peça em
`public/city/dog-geode.glb`, **31.348 triângulos, 182 KB, zero textura**; sítio e
poda de celular em `app/city/plaza/geode.ts`.

Ela mudou três coisas nesta lista, e as três valem para as próximas peças:

- **A linguagem de OBSIDIANA do Parque Runestone escala para edifício.** Peça de
  infra da DogCity não precisa procurar identidade fora.
- **Mas forma emprestada, não.** Duas versões foram descartadas por tentar que a
  arena FOSSE a runestone: um monólito parecido com ela e depois a pedra
  original deitada. O fundador cortou a segunda pelo motivo certo, "o prédio tem
  que ser funcional, não pode apenas ter formato". A regra virou: **a bacia
  desenha a planta, a planta desenha a pele**, e da referência sobra o material.
- **Capacidade se mede contra a casca.** Os 12.000 do programa eram pequenos para
  o envelope que a pele desenhou, e isso só apareceu com o prédio pronto.

## 6. O que eu recomendo começar depois

**O Colosso do $DOG**, agora na esplanada de desembarque. Ele é o maior retorno
de imagem por hora de trabalho de toda a lista e não depende de dado ao vivo nem
de sistema nenhum.

Logo depois, o **DOG DATA HQ**, porque ele é o único que precisa de integração
(a fachada lê o dado real) e portanto é o que mais ganha em ser começado cedo.
