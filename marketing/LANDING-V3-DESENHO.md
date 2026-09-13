# Landing da DogCity, v3: o desenho

**13/09/2026.** Documento de direção. Quem constrói segue isto, não improvisa estrutura.

## O diagnóstico da v2, e por que ela ficou fraca

A v2 é uma sequência de seções corretas e **genéricas**. Headline "Get your license to build in
DogCity" poderia estar em qualquer projeto de metaverso dos últimos cinco anos. Nada nela é
impossível de copiar.

O erro foi meu: briefei uma ORDEM DE SEÇÕES, não um desenho.

## A ideia que organiza tudo

> **A carteira do visitante é a única coisa que a gente tem que não é pitch.**

"Uma cidade na Lua" é promessa. **"Você já é dono de 931 m², e quem decidiu isso foi o bloco
966.670"** é um fato sobre ELE, verificável, que existia antes de ele chegar no site.

Então a landing não abre com uma frase. **Abre com um campo de endereço.** Todo o resto existe
para sustentar o que aquele campo devolve.

## O que a gente tem e quase não usa

```
o MAPA           planta cartografica de cidade real em terreno lunar da NASA. ninguem tem isso.
a BUSCA          85.818 carteiras que ja tem lote, sem saber
a PROVA          bloco, hash do bloco, hash dos arquivos, duas verificacoes em zero
o ERRO ASSUMIDO  um usuario nos criticou em publico e a regua inteira foi refeita
as 6 METRICAS    publicamos as que FALHARAM. ninguem faz isso.
o MONUMENTO      registro ao vivo, ordem de chegada, nao se consegue depois
a CIDADE 3D      /city esta no ar e da para andar nela
```

---

# As dobras

## DOBRA 1, O VEREDICTO PESSOAL

⚠️ **Esta é a dobra inteira. Não tem headline de produto, tem um campo.**

O mapa entra como fundo, escurecido, com a Satoshi Plaza enquadrada. Por cima:

```
eyebrow    BLOCK 966,670 . THE CITY WAS DECIDED
titulo     Find out what your wallet owns.
campo      [ paste a Bitcoin address ]   -> botao
sub        No connect, no signature, no cost. The chain already answered this.
```

**O campo não pede carteira conectada.** Pedir assinatura na primeira dobra mata a conversão e
não é necessário: o dado é público.

### O resultado tem de parecer DOCUMENTO, não notificação

Quando responde, a página vira uma **escritura**, com tipografia de documento, monoespaçada nos
números, e a régua de dados da casa:

**Se a carteira está no snapshot:**
```
   YOUR LOT              931 m2
   $DOG AT BLOCK 966,670  889,806.00
   GENESIS BADGE          yes, original airdrop wallet
   RUNESTONES             3
   DECIDED AT             block 966,670, 12 September 2026, 11:26:45 UTC
   BLOCK HASH             00000000000000000001151e...acd927

   You already own this. It was not for sale and it cannot be bought.
   [ GET THE LICENCE TO BUILD ON IT ]
```

**Se a carteira NÃO está no snapshot:**
```
   This wallet arrived after the founding.

   The city grows in rings. Ring 1 closed at block 966,670. Your land comes
   with Ring 2, at a future block that will be announced.

   What closes now is not land, it is ORDER. The Founder number goes by order
   of arrival, does not depend on owning land, and the window shuts at
   10,000,000 $DOG.
   [ LOCK YOUR FOUNDER NUMBER ]
```

**Se o endereço é de corretora conhecida** (cruze com `dog_labels` e `verified_addresses.json`):
```
   This is an exchange address. Coins held there are not yours on chain, and
   the lot goes to the exchange, into the Financial District.
   Withdraw to a wallet you control, then come back.
```
⚠️ Essa terceira resposta é a mais valiosa das três e ninguém espera por ela. Ela pega a pessoa
no momento exato do erro e dá a ela a ação certa.

**Dados:** tabela `dog_snapshot_lookup` no Supabase (endereço, dog, area_m2, genesis,
runestones, utxo_count). ⚠️ **NÃO use `/api/plot`**: ele lê arquivo local com `fs`, importa
`lib/city/zones` e serve POSIÇÃO, que não vai a público.
⚠️ **Nunca mostre posição, bairro, distrito, vizinho ou tag institucional.**

---

## DOBRA 2, "DIZ QUEM?"

A primeira reação a "você é dono" é desconfiança. Responda em seguida, sem rodeio, com prova
que dá para conferir sozinho:

```
BLOCK        966,670
TIME         12 September 2026, 11:26:45 UTC
HASH         00000000000000000001151e3718cd3766940941fa7815f7eaeb1b8588acd927
WALLETS      85,818
UTXOS        239,432
$DOG         99,975,593,202.33

SUPPLY CONSERVATION    closed at exactly zero
SET IDENTITY           matched to the unit
```

Uma linha explicando que 24.406.797,66 $DOG foram queimados, por isso não fecha em 100 bilhões.
**Dizer isso antes de alguém perguntar vale mais do que responder depois.**

---

## DOBRA 3, O MAPA, LARGURA TOTAL

O mapa é **o produto**, não ilustração. Largura total, fundo escuro, clicável para abrir em
resolução real. Legenda curta ao lado explicando que é terreno lunar real do Mare
Tranquillitatis mapeado de dado da NASA, não paisagem procedural inventada.

Uma frase só: a cidade existe e dá para andar nela, com link para `/city`.

---

## DOBRA 4, A OFERTA

**Agora** a licença faz sentido, porque a pessoa já sabe que tem terra e que a terra é real.

```
You own the land. The licence is what lets you build on it.
```

- O fundo, com a barra de progresso e a janela dos 10.000.000 $DOG (`ConstructionFund`)
- A escada: Citizen, Personal, Commercial, Patron (`Tiers`)
- O monumento com o registro ao vivo (`FoundersRegister`)

⚠️ **"A goal, not a sale. A construction fund, not a raise."** A licença é produto e pode ser
comprada; o fundo NÃO é captação. Não misture.

---

## DOBRA 5, AS OBJEÇÕES, NA ORDEM EM QUE A DÚVIDA CHEGA

Cada uma é **curta**: a afirmação, o número que prova, e link para a seção cheia em
`/dogcity/docs`. Não copie a documentação para cá.

```
1. "nao peguei o airdrop, tenho vez?"   a historia do @R_irion66036 (ver dobra 6)
2. "isso nao e coisa de baleia?"        os 20 maiores tem 33,02% do supply e 1,14% da terra.
                                        a area cresce com a RAIZ do saldo: dobrar o saldo nao
                                        dobra a terra, multiplica por 1,41
3. "e esquema de token?"                sem token novo, sem staking, sem APY, sem emissao.
                                        "a city that cannot print land cannot print promises"
4. "e se eu esperar?"                   a janela fecha nos 10M. terra voce consegue no Anel 2,
                                        o numero nao.
```

---

## DOBRA 6, O QUE A GENTE ERROU. 🔑 É A DOBRA QUE NINGUÉM VAI COPIAR

Todo projeto publica o que deu certo. **Publicar o que deu errado é o que compra confiança.**
Duas histórias, contadas sem suavizar:

**A régua estava injusta e quem apontou foi um usuário.** A primeira versão só classificava quem
recebeu o airdrop original. Quem nunca recebeu e acumulou comprando não tinha tier nenhum. O
usuário **@R_irion66036** apontou isso publicamente no X
(https://x.com/r_irion66036/status/2098835847101477099). A crítica estava certa e **a régua
inteira foi refeita**: hoje as 85.818 carteiras são ordenadas por acumulação medida na cadeia,
tenha havido airdrop ou não. O airdrop virou o **Genesis Badge**: identidade e legado, nunca
terra e nunca retorno, uma marca e não um lote. Credite o usuário pelo nome, com o link.

**Testamos seis maneiras de separar pessoa de serviço e as seis falharam.** Publicamos as
falhas. O motivo é estrutural e vale contar: **custódia consolida**, então o endereço de uma
corretora tem poucas contrapartes, saldo velho e pouco giro, e acaba parecendo convicção. O que
funcionou foi o **ritmo**: serviço opera 24 horas, pessoa dorme. Link para a seção 4 dos docs,
que tem a coisa inteira.

---

## DOBRA 7, O FECHO

`Partners`, depois o CTA final, que repete o campo de endereço da dobra 1. Quem chegou até aqui
sem digitar tem a segunda chance no ponto de maior convicção.

---

# Regras de execução

- Texto visível em **INGLÊS**. Comentário de código em português. **Proibido travessão.**
- Funcionar a **400px** sem cortar texto e sem rolagem horizontal.
- **Número redondo de marketing é proibido.** Sempre o número medido: 85.818, não "mais de 85
  mil". A precisão é o argumento.
- Monoespaçado para dado, face de display para afirmação. É o estilo que a casa já usa.
- Seções desmontadas continuam desmontadas, **comentadas e não apagadas**.
- ⚠️ **NÃO rodar `next build`** com o `next dev` no ar: compartilham o `.next`.
- Validar com Playwright em 1440 e 400 e **OLHAR a imagem**. Grep não julga layout.
