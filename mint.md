# O mint dos terrenos, plano de execução (`mint.md`)

Escrito em 17/09/2026. Este documento é o PLANO. A lei continua sendo `masterplan.md`,
e nada aqui revoga um `🔒` de lá. Onde este plano precisa de uma emenda na constituição,
ele diz isso com todas as letras.

---

## §0 Decisões do fundador nesta rodada (17/09/2026)

1. **A escritura é a imagem.** Prancha de terreno, na linguagem de mapa escuro da casa.
   O prédio não vai na cadeia, porque o prédio respira com o saldo (masterplan §13).
2. **Mint barato:** taxa de rede do Bitcoin mais um serviço da ordem de **US$ 1,50**.
3. **O mapa fecha antes de gravar.** O Charter é inscrito assim que o traçado fechar.
4. **O número de Fundador vai carimbado na escritura.**
5. **Três janelas de mint:**
   ```
   guaranteed   Fundadores (licenca paga antes dos 10M)
   whitelist    todas as carteiras do snapshot 966.670, posicao ja demarcada
   public       qualquer carteira
   ```
   A janela de whitelist dura **21 dias ou 2.500 blocos** (ver §5.2, os dois números
   divergem e um tem de ganhar).
6. **Bateu 10M, abre um countdown.** Revisão de no máximo 24 h para fechar quem foram os
   últimos Fundadores, e só então o mint é liberado. O motivo é real: emitir dado no mesmo
   instante em que a doação que fecha a meta chega é receita de erro.
7. **A licença é comprável em qualquer fase.**
8. **No dia do mint** o fundador quer: catálogo de casas por bairro, escolha de detalhes,
   itens, mercado de itens e a animação de construção (que não deve passar de um dia).

---

## §1 O estado real hoje, medido

**O fundo (API de produção, 17/09 19:16 UTC)**
```
8.218.338 de 10.000.000 DOG     82,2%     faltam 1.781.662
110 doadores:  8 patron   35 commercial   56 personal   11 citizen
```
Em 12/09 o fundo estava em 4.901.656. Subiu **3,3M em 5 dias**. Cinco dos oito patrons
chegaram nesses mesmos 5 dias. O masterplan §11 ainda fala em "os quatro patron", e isso
já está desatualizado.

**Quem minta no dia 1**
```
99 carteiras com licenca (personal ou acima)
95 delas estao no snapshot 966.670
86 tinham >= 20k DOG no bloco, ou seja, o predio sobe na hora
 4 pagaram licenca e NAO estao no snapshot (1 commercial, 3 personal)
```
⚠️ Essas 4 são um caso de produto que ainda não tem resposta escrita: pagaram o direito de
construir e não têm terra no Anel 1. Ver §5.5.

**O snapshot** está fechado e verificado: 85.818 carteiras, e a ordem final das posições já
existe em `data/snapshots/dog_snapshot_966670_ordem.json` (régua DOG-tempo, masterplan §12).

**O endereço de quem vai receber a escritura**
```
p2tr (taproot)   76.668   89,33B DOG
segwit v0         7.804    7,17B DOG
p2sh                738    3,12B DOG
legacy              608    0,36B DOG
```
9.150 carteiras (10,7%) não são taproot. Ver §5.4.

**O mapa** está publicado em `public/city/cidade-malha.json` com mtime de **08/09**, sítio
`R_SITIO = 9000`. Nele, `parques` e `diagonais` estão VAZIOS, e `hidrografia.md:139` registra
a dívida do `rInicio: 1450` que deveria ser 1.340.

**O registro de lotes NÃO EXISTE na forma que o mint exige.** Nenhum script consome
`dog_snapshot_966670_ordem.json` para alocar terreno. Os dois que chegam perto leem arquivos
VIVOS que o cron reescreve toda hora:
```
scripts/foundation_generator.ts   le dog_holders.json e dog_utxos_by_address.json
scripts/gerar_cidade.py           le dog_utxos_by_address.json  (linha 2528)
```
⚠️ **Essa é a correção mais importante do plano.** Um gerador que lê o presente produz uma
cidade diferente a cada noite. A fundação é uma fotografia (masterplan §0.3), então o gerador
tem de ler a fotografia.

**O merkle root não existe.** Hoje existe o sha256 do artefato, que prova que o arquivo não
mudou e não deixa ninguém recomputar a lista.

**O Charter não foi inscrito.**

**O DogData não tem uma linha de código de inscrição.** O que existe é leitura de ordinals
para escolher avatar. Já o OrdCards tem o pipeline inteiro, provado em mainnet:
```
quote  ->  order  ->  endereco P2TR de uso unico  ->  pool de chaves  ->  worker em casa
assina o reveal com a seed local, detecta pagamento por listunspent no bitcoind
parent (tag 3) e pointer 546 ja implementados; metadata CBOR (tag 5) so nos pais
SERVICE_FEE = 1.500 sats, gravada POR PEDIDO, nunca a constante de hoje
```
⚠️ A taxa de serviço de 1.500 sats do OrdCards é **exatamente US$ 1,50 com o BTC a 100 mil
dólares**. O valor que o fundador pediu já é o valor que a casa cobra, e cobrar em sats
dispensa oráculo de preço.

---

## §2 O conflito de calendário, que é o achado principal

O gatilho do mint está a **1,78M de DOG** de distância e sobe 660k por dia no ritmo desta
semana. O produto do mint está a semanas: o mapa não fechou, o registro não existe, o merkle
root não existe, o Charter não foi inscrito e não há código de inscrição no DogData.

Com a regra "bateu 10M, 24 h de revisão, abre o mint", o dia dos 10M chega antes do produto.

**Proposta: separar os dois gatilhos, que já são duas coisas diferentes.**

```
FUNDO BATE 10M          fecha a janela de Fundador. PARA SEMPRE, e essa e a promessa
                        publicada. Em ate 24 h sai a lista oficial de Fundadores.
BLOCO ANUNCIADO         abre o mint. Anunciado assim que o Charter for inscrito.
```

Isso preserva as duas promessas que já estão no ar ("o fundo abre o mint" e "quem chegar
antes dos 10M é Fundador") sem prometer uma data que não se cumpre. E é coerente com a regra
da casa: a data é a nossa palavra, o bloco é a palavra do Bitcoin.

⚠️ **Débito de copy:** `app/dogcity/dogcity-data.ts:274` e `app/dogcity/sections/ordinals.tsx:297`
dizem hoje que o holder minta *"paying only BTC network fees"*. Com a taxa de serviço de
US$ 1,50 isso deixa de ser verdade. Trocar ANTES de qualquer anúncio de mint.

---

## §3 A ordem de execução

```
F1 fechar o mapa
      |
F2 registro determinístico sobre a fotografia (85.818 lotes)
      |
F3 merkle root publicado + 432 blocos de auditoria publica
      |
F4 Charter inscrito  ---->  anuncio do bloco de abertura do mint
      |
F5 escritura (arte + bytes)        F6 pipeline de inscricao       F7 pagina de mint
      \_______________________________________|______________________/
                                   |
                              ABRE O MINT
                       guaranteed -> whitelist -> public
```

F5, F6 e F7 **não dependem de F1**. Podem começar hoje com lote de teste, e é por isso que
elas entram em paralelo. O que depende do mapa é o conteúdo do deed, não a máquina.

F8 (Fundadores e patrons) e F9 (casa, itens, mercado) correm por fora e são as únicas que
podem escorregar sem adiar o mint. Ver §4.9.

---

## §4 As frentes

### F1 Fechar o mapa
**Entrega:** `cidade-malha.json` v1 FINAL, com hash publicado, e um documento de uma página
dizendo o que está congelado.
**Trabalho:**
- Decidir as pendências de traçado que ainda estão abertas: programa dos blocos do projeto na
  Orla Nobre e a regra de encaixe se o snapshot não devolver 445 carteiras (`masterplan.md:470`);
  canais radiais como elemento dos tiers 7 a 12 (`tiersposition.md:441`); o que o tier B recebe
  no miolo (`tiersposition.md:519`).
- Pagar a dívida do `rInicio` (`hidrografia.md:139`).
- Regerar e **rodar as auditorias que já existem**, gravando os números no doc:
  `scripts/city/vias-varredura.mjs` (conectividade por componente), `alca-varredura.mjs`,
  `canais-varredura.mjs`, `verificar-orla.ts`. Hoje nenhuma delas tem resultado registrado.
- Preencher `parques` e `diagonais`, que estão vazios no arquivo publicado.
**Risco:** é a frente mais longa e é a única que trava tudo. Deve começar primeiro.

### F2 O registro
**Entrega:** `data/registry/anel1.json` (e o `.bin` da cena), 85.818 lotes, cada um com
`lot_id`, distrito, `(x, z, rot)`, área, tipologia, endereço de rua, posição na régua.
**Trabalho:** um alocador novo que consome **só** `dog_snapshot_966670_ordem.json` mais o mapa
congelado, sem tocar em `data/*.json` vivo. Roda offline, é determinístico, e rodar duas vezes
tem de dar byte a byte o mesmo arquivo.
**Risco medido:** os geradores de hoje leem arquivo vivo. Se isso não for corrigido, a cidade
muda sozinha entre o anúncio e o mint.

### F3 A prova pública
**Entrega:** script `scripts/registry/merkle.py` que qualquer pessoa roda, a raiz publicada, o
mapa completo no ar e **432 blocos de auditoria** (masterplan §3, 🔒).
**Trabalho:** definir a folha (`sha256` de uma linha canônica do lote), a ordem das folhas, e
publicar o algoritmo junto com o resultado.

### F4 O Charter
**Entrega:** o Ordinal pai inscrito, com a raiz da terra na tag 5 (CBOR), pelo nosso node.
**⚠️ Decisão de projeto que o carimbo do Fundador cria:** se o número de Fundador entra na
escritura e a raiz do Charter cobre a escritura inteira, então o Charter só pode nascer depois
que a janela de Fundador fechar, o que contraria o item 3 do §0. A saída é **duas raízes**:
```
raiz da TERRA         posicao, area, forma, tipologia. Funcao do snapshot + mapa.
                      vai no Charter, e o Charter pode ser inscrito assim que o mapa fechar.
Founders Register     numero de Fundador por ordem de chegada. Hash proprio, publicado
                      quando a janela fechar, e inscrito como irmao do Charter.
```
A escritura carrega os dois campos e cada um tem a sua prova. É o que permite inscrever o
Charter cedo, como o fundador quer, sem mentir sobre o que ele prova.

### F5 A escritura
**Entrega:** o renderizador inscrito uma vez, e o gerador dos parâmetros por lote.
**Desenho:** contorno do lote em laranja `#E8660D`, anel com distância e direção até a Praça,
cartucho DOGCITY em JetBrains Mono creme, barra de escala, norte, número da folha, selo
`Ring 1 · Block 966,670` e o carimbo de Fundador quando houver.
**Técnica:** recursão. Um renderizador mais uma base inscritos uma vez, e cada escritura filha
carrega algumas centenas de bytes de parâmetro. É o mesmo princípio que já baixou o custo da
coleção Runestone, com a diferença de que lá o filho é `delegate` de zero byte e aqui o filho
precisa dos seus próprios parâmetros.
**⚠️ A base na cadeia é permanente.** Decidido com o fundador: fecha-se o mapa antes de gravar.
**A provar no signet antes de qualquer coisa:** que o filho recursivo renderiza no `ord` e nos
marketplaces (Kray primeiro, depois Magic Eden). Se não renderizar, o plano B é SVG autocontido
de uns 3 KB por escritura, que custa mais e continua barato a 1 sat/vB.

### F6 O pipeline de inscrição
**Entrega:** o mesmo pipeline do OrdCards vivendo no DogData.
**Trabalho:** portar `lib/inscribe/{build,order,rpc,sign}.ts` e o worker, trocar o artefato de
carta por escritura, apontar o `parent` para o Charter, manter a taxa de serviço gravada por
pedido (nunca a constante do dia).
**⚠️ Escala, e ela muda o desenho:** cada escritura é filha do Charter, e proveniência exige
gastar um output do pai. Isso serializa. A saída é **lote**: uma transação de reveal com o pai
na entrada e N escrituras, cada uma para um endereço. Com a cadeia de mempool limitada a 25
transações não confirmadas, 25 transações de 50 escrituras dão 1.250 por bloco.
**⚠️ Não precisa do índice ord:** o worker do OrdCards detecta pagamento por `listunspent` no
bitcoind. Isso evita a briga pelo lock do redb com o `dog_scanner`.

### F7 A página de mint
**Entrega:** `/dogcity/mint`, com a busca por endereço decidindo a conversa (masterplan §14).
```
nao esta no snapshot          "a cidade cresce". Anel 2. CTA: virar Fundador
no snapshot, sem licenca      mostra a prancha real do lote. CTA: licenca
licenciado, abaixo de 20k     minta a escritura; o lote nasce "a espera"
licenciado, 20k ou mais       minta e a obra comeca
ja mintou                     link da inscricao e do predio
endereco de corretora         explica que o lote e da corretora e manda sacar
```
Cinco momentos: preview exato dos bytes antes de pagar; botão "verify" que abre a prova merkle
contra o Charter; pagamento no endereço de uso único; cerimônia com voo de câmera até o lote; e
a página canônica `/dogcity/lot/[lot_id]`.

### F8 Fundadores e patrons
**Entrega:** lista oficial de Fundadores (ordem de chegada, congelada nas 24 h após os 10M) e
um canal de contato com os 8 patrons.
**O problema declarado pelo fundador:** hoje só temos o endereço BTC deles.
**Três caminhos, e eu recomendo os três juntos:**
1. **Login por carteira**, que já existe e está em produção (BIP-322 e Schnorr, sessão em
   Redis). Uma página de patron atrás da prova de posse, com formulário de brief.
2. **Convite na cadeia.** O único canal que temos é a cadeia, então a cadeia entrega o convite:
   uma inscrição "Patron Invitation" enviada ao endereço de cada patron, com o link. Com
   `delegate` custa o envelope da transação por patron.
3. **Anúncio público** no X e na landing, pedindo que o patron se identifique pela carteira.
**Risco:** prédio personalizado é trabalho manual e são 8 pedidos. Começar a conversa agora é o
que permite entregar no dia 1.

### F9 Casa do bairro, itens e mercado
**Entrega pedida pelo fundador:** catálogo por bairro, escolha de detalhes, geração da casa
dentro do framework do bairro, animação de construção de até um dia, itens e mercado.
**Recomendação, e é a única parte do plano em que eu discordo do escopo:** isto não cabe no
mesmo dia do mint sem adiar o mint. Proposta em ondas, mantendo o dia 1 inteiro:
```
onda 1, no dia do mint    escritura + lote demarcado + predio PADRAO do bairro subindo,
                          com a animacao de obra. Nada de editor.
onda 2, ate 30 dias       escolha de detalhes dentro do framework do bairro
onda 3                    itens, loja e mercado de itens
```
A animação de obra é o que faz o dia 1 parecer completo, e ela não depende de editor nenhum.
Sugestão de duração: proporcional ao tamanho, de duas horas para casa a 24 h para torre, com o
canteiro visível no meio tempo. Isso traz a pessoa de volta à página no dia seguinte.

---

## §5 Decisões abertas, e cada uma trava uma frente

### 5.1 A fase public dá qual terra?
Depois dos 21 dias, "qualquer carteira pode mintar o terreno". Mas os lotes do Anel 1 são de
carteiras nominais do snapshot. Três leituras possíveis:
- **(a) Anel 2 abre.** Public significa um snapshot novo em bloco futuro (masterplan §14).
- **(b) Vende-se a reserva.** As parcelas do land bank do projeto entram à venda.
- **(c) Lote não mintado do Anel 1 é liberado para qualquer um.**
⚠️ **(c) quebra o §0.6 e o §1 do masterplan** e é perigosa: um holder que não viu o anúncio em
21 dias perderia a terra que a cadeia diz que é dele. **Recomendação: (a) mais (b), e o lote do
snapshot fica reservado ao endereço para sempre, sem prazo.**

### 5.2 Vinte e um dias ou 2.500 blocos?
2.500 blocos são 17,4 dias; 21 dias são 3.024 blocos. Os dois números divergem em 3,6 dias.
**Recomendação: publicar só o bloco**, e usar 3.024 se a intenção era "três semanas".

### 5.3 A copy que promete só a taxa de rede
Dois lugares no ar dizem "paying only BTC network fees". Ou a taxa de US$ 1,50 não existe, ou a
copy muda antes do anúncio. **Recomendação: mudar a copy**, dizendo o valor em sats e o motivo
(o serviço que monta e assina a inscrição).

### 5.4 Os 9.150 endereços que não são taproot
A escritura vai para o endereço do snapshot, porque o vínculo é o endereço. Para p2sh e legacy
(1.346 carteiras) o risco de a inscrição ser gasta como taxa é alto.
**Recomendação:** a página detecta o tipo de endereço, avisa, e oferece uma saída explícita:
mintar mesmo assim, assumindo o risco, ou registrar um endereço taproot de recebimento
**assinando com a carteira do snapshot**. A prova de posse já existe e é o que autoriza o desvio
sem furar o princípio soulbound.

### 5.5 Licenciado sem lote
4 carteiras já pagaram licença e não estão no snapshot. **Recomendação:** licença é permanente e
da carteira, então ela vale no Anel 2, e a página precisa dizer isso hoje, não no dia do mint.

### 5.6 O que o Charter prova
Ver F4. Duas raízes, para o Charter poder nascer quando o mapa fechar.

### 5.7 O gatilho do mint
Ver §2. Fundo fecha a janela de Fundador; um bloco anunciado abre o mint.

---

## §6 Riscos

1. **O fundo bater 10M antes do mapa fechar.** Probabilidade alta no ritmo desta semana. É o
   §2 e é a decisão mais urgente do documento.
2. **O gerador ler arquivo vivo** e a cidade mudar entre o anúncio e o mint. Conserto conhecido,
   frente F2.
3. **A recursão não renderizar no marketplace.** Prova no signet antes de fechar a arte.
4. **A fila de inscrição serializar** e o dia 1 virar espera. Conserto conhecido, lote de 50.
5. **Prometer editor e loja no dia 1** e adiar o mint por causa deles. É o §4.9.
