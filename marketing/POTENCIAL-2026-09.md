# POTENCIAL REAL DA DOGCITY, medido em 23/09/2026

Gerado por quatro frentes (analytics, vendas, economia do mint, sintese) e um adversario. Numeros com fonte; premissas marcadas.

---

# Potencial real da DogCity: mint, licenças e o resto, em três cenários

Data: 23/09/2026. Horizonte: 12 meses. Preço do DOG usado em toda conversão: US$ 0,0011748 (tabela `dog_metrics_history`, última linha, 23/09 04h39 UTC). Toda cifra em US$ deste relatório é DOG convertido a esse preço, salvo quando dito o contrário. Onde está escrito PREMISSA, o número não saiu de tabela nenhuma.

Fontes abreviadas: [A] = funções `analytics_traffic()` e `analytics_funnel()` (migrações 021 a 025) e `analytics_doacoes()` (022); [B] = tabela `dog_transactions` filtrada pela carteira de doação, replicando `app/api/donate/leaderboard/route.ts`; [C] = `data/dogcity_lotes.csv` e `data/dogcity_cemiterio.csv` (registro selado de 23/09), colunas `dog` e `utxo_count`, contadas com awk; [E] = tabela `page_events` agrupada por `event_name`, últimos 30 dias.

## 1. A resposta curta

| Linha | Conta do fundador | Pessimista | Base | Otimista |
|---|---:|---:|---:|---:|
| Mint dos lotes (margem de US$ 2) | 140.000 | 1.400 | 3.000 | 7.000 |
| Licenças (DOG recebido, a preço de hoje) | 88.000 | 10.700 | 55.600 | 128.100 |
| Itens secundários | não somou | 0 | 3.400 | 17.500 |
| Parcerias institucionais | 8.000 | 0 | 8.000 | 20.000 |
| Lotes do projeto (699), venda direta | não somou | 0 | 5.000 | 30.000 |
| **Total 12 meses** | **236.000** | **12.100** | **75.000** | **202.600** |

Três coisas para ler nessa tabela antes de qualquer outra:

1. O total otimista chega perto da conta do fundador, mas com a composição invertida. Na conta dele o mint carrega (140k) e a licença ajuda (88k). Na medição, a licença carrega e o mint é troco. O motivo está na seção 3.1: o masterplan exige licença para mintar, então o mint não é um segundo canal, é a mesma carteira pagando US$ 2 a mais depois de já ter pago a licença.
2. Os US$ 140 mil pressupõem que 100% das 69.989 carteiras mintam. Até hoje, 0,122% das carteiras do snapshot pagaram qualquer licença (105 de 85.818 [B]). Nem o cenário otimista deste relatório passa de 5% de carteiras pagantes, e ele já exige sustentar por 52 semanas um ritmo 3 vezes maior que a melhor semana já medida.
3. A régua da realidade: em toda a história, o projeto arrecadou o equivalente a US$ 7.454 ao preço do dia de cada doação [B]. Nos últimos 30 dias entraram 4.790.632 DOG [A], ou US$ 5.628 a preço de hoje; anualizado, US$ 67,5 mil. O cenário base (US$ 75 mil) está colado nesse run-rate. Não é um número de sonho nem de medo, é o que a máquina já faz hoje, mantido por um ano.

## 2. O que está medido

### 2.1 O funil do site (30 dias, 24/08 a 23/09) [A]

| Degrau | Valor | % da sessão |
|---|---:|---:|
| Sessões humanas | 8.592 | 100% |
| Viram a oferta | 4.241 | 49,4% |
| Copiaram o endereço | 105 | 1,2% |
| Conectaram carteira | 71 | 0,8% |
| Endereços que cruzaram 10.000 DOG | 92 | (fora do navegador) |
| Doações de qualquer valor | 114 doações, 100 doadores, 4.790.632 DOG | |

Visitantes únicos em 4 semanas: 4.927 [B]. Conversão visitante para doador: cerca de 2% [B]. Celular: 57,4% das sessões [A].

Por canal, o dinheiro não segue a visita: Social/X é 34,8% das sessões (2.972 via t.co) e trouxe 8 doadores e 130.000 DOG; Direct é 63,0% das sessões e trouxe 27 doadores e 1.918.402 DOG; 1 doador via Search trouxe 500.000 DOG sozinho; 40,4% do DOG recebido (1.934.330 DOG) não tem canal porque o doador nunca conectou carteira no site [A].

O topo do funil do mint já dá para medir [E]: entre 04/09 e 21/09, 645 visitantes distintos (1.055 sessões) viram a seção do snapshot na landing (`snapshot_hero_view`); 106 visitantes escolheram um caminho de custódia (`snapshot_custody_choice`, último evento em 14/09); 63 visitantes conectaram carteira em 30 dias (`wallet_connected`). Ou seja: de quem chega até a parte da cidade, 1 em 6 interage e 1 em 10 chega a assinar. O gargalo não é a página; é quantas carteiras chegam nela.

### 2.2 Quem paga (histórico completo, desde 02/11/2025) [B]

| Medida | Valor |
|---|---:|
| Carteiras que doaram qualquer valor | 117 |
| Carteiras com Personal License ou acima (10.000+ DOG) | 105 |
| Distribuição | 61 Personal, 36 Commercial, 8 Patron [A] |
| Total doado | 8.369.340 DOG (83,7% da meta de 10.000.000) |
| Falta para a meta que fecha a janela de Fundador | 1.630.660 DOG (US$ 1.916 a preço de hoje) |
| Mediana por carteira | 10.000 DOG (US$ 11,75) |
| Média por carteira | 71.533 DOG [B] / 79.508 DOG entre as 105 licenciadas [A] |
| Top 10 doadores | 5.294.973 DOG, 63,3% de tudo |
| Média de quem NÃO está no top 10 | 28.732 DOG (US$ 33,75), derivado: (8.369.340 menos 5.294.973) / 107 |
| Ticket médio ao preço do DIA de cada doação | US$ 65,97; mediana US$ 11,70 |
| Ticket médio ao preço de hoje | US$ 83 a 93 conforme a base (B usa 0,0011642; A usa 0,0011748) |
| Ritmo de doadores novos, últimas 4 semanas | 22/semana (pico de 48 na semana de 14 a 20/09) |
| Ritmo, últimas 8 semanas | 13,4/semana |
| Ritmo desde o início | 8,4/semana, com 8 meses parados entre nov/2025 e jun/2026 |
| Doadores que já têm lote na cidade | 109 de 117 (93,2%); só 6 (5,1%) vêm de fora do snapshot |

### 2.3 Quem tem lote: o universo do mint [C]

Sobre as 70.016 linhas com endereço em `dogcity_lotes.csv` (69.989 holders mais as 27 institucionais; as outras 693 linhas são `__projeto_reserva`):

| Faixa de saldo em DOG | Carteiras | % |
|---|---:|---:|
| 10.000 ou mais (paga a Personal License sem comprar nada) | 57.378 | 82% |
| 100.000 ou mais | 44.200 | 63% |
| 1.000.000 ou mais | 8.441 | 12% |
| 10.000.000 ou mais | 859 | 1,2% |
| Abaixo de 10.000 | 12.638 | 18% |

Mediana de saldo: 339.100 DOG (US$ 398). Quartil inferior: 19.413 DOG (US$ 23). Quartil superior: 889.806 DOG (US$ 1.045, o airdrop intacto). Carteiras com `utxo_count` 2 ou mais: 21.680 (31%); com 5 ou mais: 7.392 (10,6%).

Leitura: a licença mínima custa 2,9% do saldo da carteira mediana. Dinheiro não é a barreira; 82% dos holders pagam a licença com o que já têm. A barreira é atenção: a carteira precisa saber que tem um lote e decidir agir.

O cemitério: 15.802 carteiras abaixo de 592 DOG. A coluna `direito` do CSV diz "licença paga + mint do deed = lote no anel de expansão". Essas carteiras têm menos de US$ 0,70 em DOG; para licenciar, precisam comprar.

### 2.4 Tráfego: picos que não viram piso [A]

| Data | Sessões/dia | O que aconteceu (cruzado com git log) |
|---|---:|---|
| 28/07 | 110 | Landing v2 (+22% sobre a semana anterior) |
| 17/08 | 209 | Praça Central em /city |
| 27 a 28/08 | 673 e 696 | Deploy grande (analytics, /admin, /donate aposentada) |
| 04/09 | 154 | Live (sem pico; YouTube derrubado, X abaixo de 100 views) |
| 12 a 14/09 | 498, 696, 1.087 | Hero com o mapa da cidade (commit ce682370f4) |
| 16 a 22/09 | 130 a 250 | Volta ao patamar anterior |

Cada lançamento dá 2 a 3 dias de pico e o tráfego volta ao piso de antes. Não há curva composta. Isso importa para o modelo: qualquer cenário acima do pessimista depende de uma SEQUÊNCIA de lançamentos, não de um.

## 3. Modelo linha por linha

### 3.1 Mint dos lotes

**Premissa que governa tudo:** `masterplan.md` seção 4 (decisão travada, 10/07/2026) exige Personal License (10.000+ DOG doados) para mintar QUALQUER deed, do lote próprio ou do anel de expansão, e promete que o serviço do projeto inscreve "cobrando exatamente a taxa de rede BTC". Duas consequências: (a) mints, no regime publicado, são no máximo iguais a licenças; (b) cobrar US$ 2 de margem é mudança de política publicada, não detalhe de implementação. O documento avisa que nada de dinheiro/inscription foi implementado, então dá para mudar; mas tem que ser decidido e comunicado, não só codado.

**Custo unitário [B]:** taxa de rede medida no nó em 1,0 a 1,2 sat/vB; BTC a US$ 86.802 (mempool.space, cotação do instante). Inscrição de texto pequena: US$ 0,003 a 0,005 (PREMISSA por tamanho típico, o schema do deed não existe). A conta de "sobra US$ 2 inteiros" está certa nas condições de hoje. Como o comprador paga a taxa, a margem se mantém mesmo se a mempool subir; o que muda é a conversão.

**Sobre o "1 satoshi":** o que dá para economizar é o postage (valor preso na saída da inscrição), no máximo US$ 0,29 a 0,47 por lote, e isso é patrimônio que fica travado, não taxa paga [B]. Nota técnica minha, a verificar antes de prometer: saída P2TR abaixo de 330 sats é dust pela política padrão do Core e não é retransmitida por nós comuns; o nó em DOG MODE aceita localmente, mas a transação ainda precisa chegar a um minerador, o que exige canal fora da mempool padrão. Nada disso muda o lucro do mint de forma relevante.

**Regime A (masterplan como está: mint só com licença):**

| Cenário | Carteiras pagantes em 12 meses | Âncora | Mint a US$ 2 |
|---|---:|---|---:|
| Pessimista | 700 (1,0%) | 13,4/semana x 52 (ritmo das últimas 8 semanas mantido) [B] | US$ 1.400 |
| Base | 1.500 (2,1%) | 22/semana x 52 = 1.144 [B] mais ondas de lançamento (abertura do mint, expansão) somando ~350, PREMISSA | US$ 3.000 |
| Otimista | 3.500 (5,0%) | 67/semana por 52 semanas, 3x a melhor semana medida (48) [B]; equivale a metade das 7.392 carteiras com utxo_count 5+ [C], PREMISSA | US$ 7.000 |
| Teto físico | 70.688 (100%) | 1.359 mints/semana por 52 semanas; os 4.927 visitantes únicos de 4 semanas inteiras [B] são 7% dos lotes | US$ 141.376 |

**Regime B (abrir o mint a US$ 2 sem exigir licença):** a fricção cai e a conversão sobe, mas o valor por carteira cai de US$ 11,75 (licença mínima) para US$ 2, e a licença perde a razão de existir para quem só quer o lote próprio.

| Cenário | Conversão dos 69.989 | Âncora | Receita |
|---|---:|---|---:|
| Pessimista | 2% (1.400) | dobro do ritmo de conexão de carteira anualizado (63 visitantes/30 d x 12 = 756) [E] | US$ 2.800 |
| Base | 5% (3.500) | metade do grupo utxo_count 5+ [C], PREMISSA | US$ 7.000 |
| Otimista | 15% (10.500) | metade do grupo utxo_count 2+ (31%) [C], PREMISSA | US$ 21.000 |

Nos dois regimes, o mint em 12 meses fica abaixo de US$ 25 mil. E o regime B ainda exige construir um trilho de pagamento em BTC (US$ 2 = ~2.300 sats a US$ 86.802, com fatura e confirmação por mint) que hoje não existe, para a menor linha do modelo. O trilho em DOG (carteira de doação + leaderboard) já funciona.

**Alavanca:** não é a margem, é a quantidade de carteiras que descobrem o próprio lote. Hoje 645 visitantes viram a seção do snapshot em 18 dias [E]; o universo é 69.989. O mint é o único evento do projeto com motivo individual para cada carteira agir ("o SEU lote"), e é isso que tem que chegar nas carteiras, não no X em geral (X converte pior que qualquer outro canal [A]).

### 3.2 Licenças (pré-venda até o mint e depois)

**Premissas:** (1) ticket da cauda = 28.732 DOG por carteira fora do top 10 [B], derivado; no pessimista, a mediana de 10.000 DOG; (2) baleias contadas uma a uma, não como percentual: cada baleia vale 529.497 DOG (média do top 10 [B]) = US$ 622 = 53 licenças mínimas; ritmo medido de patrons: 8 no histórico, cerca de 1 a cada 6 semanas [B]; (3) preço do DOG constante em US$ 0,0011748 (PREMISSA; caiu de 0,0013 para 0,0010 entre 24/08 e 16/09 [B], cada 10% no preço move esta linha inteira 10%).

| Cenário | Carteiras | Cauda (DOG) | Baleias | DOG total | US$ |
|---|---:|---:|---:|---:|---:|
| Pessimista | 700 x 10.000 | 7.000.000 | 4 x 529.497 = 2.117.988 | 9.117.988 | 10.700 |
| Base | 1.500 x 28.732 | 43.098.000 | 8 x 529.497 = 4.235.976 | 47.333.976 | 55.600 |
| Otimista | 3.500 x 28.732 | 100.562.000 | 16 x 529.497 = 8.471.952 | 109.033.952 | 128.100 |

Verificação contra o real: o base pede 47,3M DOG em 12 meses. O ritmo médio desde julho anualiza em ~36M DOG (8,37M em ~12 semanas); o ritmo dos últimos 30 dias anualiza em 57,5M DOG (4,79M x 12) [A]. O base está entre os dois.

**Pré-venda:** faltam 1.630.660 DOG (US$ 1.916) para os 10M que fecham a janela de Fundador e abrem o mint. Com 10 carteiras fazendo 63% do bolo, isso fecha em 1 a 2 semanas se aparecer mais uma baleia, ou em ~4 semanas no ritmo de 30 dias. A pré-venda como fonte de receita está praticamente encerrada; o que vem depois é a licença como pedágio do mint.

**"Bater mil":** faltam 883 carteiras licenciadas (de 117). A 22/semana, 40 semanas; a 13,4/semana, 66 semanas; para caber em 12 meses precisa de 17/semana sustentadas. Está entre o ritmo de 8 semanas e o de 4. É alcançável, mas o padrão de tráfego (pico e volta) diz que não acontece sozinho.

**Alavanca:** duas, separadas. Para a cauda, o mesmo motor do mint (carteira descobre o lote e licencia para mintar). Para as baleias, trabalho de relação, uma a uma: 859 carteiras com 10M+ DOG [C] e 8.441 com 1M+ são o universo; as 27 institucionais do Distrito Financeiro são a lista de prospecção mais óbvia (lote nomeado, endereço público). Uma baleia nova vale mais que 50 semanas de Personal na média.

### 3.3 Itens secundários

Nenhum dado. Não há produto definido, tabela, rota nem receita registrada [B]. O que dá para dizer: é uma fração dos pagantes gastando um segundo ticket. PREMISSA: 15% dos pagantes do base gastando US$ 15 = US$ 3.400; 25% dos pagantes do otimista gastando US$ 20 = US$ 17.500; zero no pessimista porque sem produto não há linha. Alavanca: definir o item (nome no lote, fachada, avatar, slot na cidade) e vendê-lo em DOG no mesmo trilho da licença. Só existe depois que a linha de licenças existir em volume.

### 3.4 Parcerias institucionais

Nenhum contrato, tabela ou receita medida [B]. O único precedente é a BitFlow (tabela `ad_events` tem impressões e cliques reais, sem valor em dólar). As 27 institucionais do Distrito Financeiro caíram ali pelas regras de posição do snapshot; não são parceiros pagantes, são prospects.

| Cenário | Valor | Premissa |
|---|---:|---|
| Pessimista | 0 | nada assinado |
| Base | 8.000 | as duas que o fundador citou (coleção 3k, corretora 5k) assinadas |
| Otimista | 20.000 | as duas mais 2 a 3 fechadas entre as 27 institucionais, ticket parecido, PREMISSA |

Alavanca: já existe inventário físico para vender (torre BitFlow, Sphere, fachadas, lote nomeado no Distrito Financeiro). O que falta é a lista, a proposta e o preço. Esse é o mesmo movimento das baleias da seção 3.2: relação direta com poucos, não funil.

### 3.5 Outros que os dados sugerem

- **Lotes do projeto (699):** o único estoque que o projeto possui de fato. Venda direta a quem quer segundo lote ou a quem chegou depois do snapshot. PREMISSA: 100 lotes a US$ 50 no base (US$ 5.000), 300 a US$ 100 no otimista (US$ 30.000). Referência de bolso: a carteira mediana tem US$ 398 em DOG [C]; US$ 50 a 100 é ordem de grandeza plausível, não medida.
- **Lápides (15.802):** caminho publicado é licença + lote no anel de expansão. Têm menos de US$ 0,70 em DOG; conversão baixa. Não modelado além do que já está nas carteiras pagantes.
- **Público fora do snapshot:** hoje 5,1% dos doadores [B]. É quem compra DOG agora e quer lote no anel de expansão. Cresce só com DOG subindo ou com marketing fora da base.
- **Anúncios no site:** 17.607 pageviews/mês [A]. A US$ 5 de CPM (PREMISSA), US$ 88/mês. Irrelevante como receita; relevante como moeda de troca na parceria.
- **Tesouraria:** 8,37M DOG em caixa (US$ 9.744 a 9.832 hoje). Não é receita, mas toda a receita das licenças fica em DOG; a decisão de segurar ou vender é uma segunda aposta em cima do modelo.

## 4. A conta do fundador: o que acerta e o que erra

**Acerta, com dado na mão:**

| Afirmação | Medido |
|---|---|
| "110 licenças na pré-venda" | 105 licenciadas, 117 doadoras [B]. Está no meio, correto. |
| "ticket de cerca de 88 dólares" | 79.508 DOG x 0,0011748 = US$ 93 [A]; 71.533 x 0,0011642 = US$ 83 [B]. Bate. |
| "os patron fazem essa média decolar" | 8 patrons; top 10 = 63,3% do DOG; mediana US$ 11,70 contra média US$ 66 ao preço do dia [B]. Confirmado. |
| "70 mil terrenos" | 69.989 + 699 = 70.688 (selado). |
| "2 dólares de lucro por mint" | taxa 1,0 a 1,2 sat/vB, BTC US$ 86.802: sobra praticamente tudo [B]. A conta unitária está certa. |

**Erra, ou está otimista, com dado na mão:**

| Afirmação | O que os dados dizem |
|---|---|
| "mintar tudo, 140 mil só nos mints" | Pressupõe 100% de conversão. Medido: 0,122% das carteiras pagaram licença [B]; 63 visitantes conectaram carteira em 30 dias [E]; 4.927 visitantes únicos em 4 semanas inteiras = 7% dos lotes [B]. O otimista deste relatório é 5% e dá US$ 7 mil (regime A) ou 15% e US$ 21 mil (regime B). Para chegar em 140 mil a conversão de licença teria que multiplicar por ~820 [B]. |
| mint e licença como dois canais que somam | `masterplan.md` §4: sem licença não há mint. É um funil só; o mint soma US$ 2 sobre uma carteira que já pagou US$ 11,75 ou mais. E o mesmo documento promete inscrição a preço de custo: a margem de US$ 2 precisa de decisão publicada. |
| "890 a 88 dólares = 88 mil" | Média não é típico. A cauda paga US$ 11,75 (mediana) a US$ 33,75 (média fora do top 10). Os US$ 88 só se sustentam se chegarem 8 baleias por 1.000 carteiras, e baleia não escala com a cauda, é relação. O base dá US$ 55,6 mil; o otimista US$ 128 mil. O número dele está dentro da faixa, mas depende das baleias, não da média. |
| "manter a média" no tempo | Ritmo de 4 semanas (22/semana) dá 1.000 em 40 semanas; o de 8 semanas (13,4) em 66. Cabe em 12 meses só sustentando 17/semana, e o tráfego hoje volta ao piso 3 dias depois de cada lançamento [A]. |
| "1 satoshi salva a inscription" | Economiza postage travado, no máximo US$ 0,47 por lote, não custo [B]. E 1 sat em P2TR está abaixo do dust padrão (330 sats): precisa de caminho fora da mempool comum (nota técnica, verificar). |
| "3k coleção, 5k corretora" | Zero medido. Único precedente (BitFlow) não tem valor em dólar registrado. Vai para o base como PREMISSA de assinatura, não como receita. |

**Onde está pessimista, também com dado:**

- O preço unitário do lote está baixo demais para quem tem: 82% dos holders pagam a licença com o que já têm, a carteira mediana tem US$ 398 em DOG [C]. US$ 2 é 0,5% disso. Para lotes do anel de expansão e lotes do projeto (onde não há promessa de preço de custo), dá para cobrar bem mais sem mexer na conversão de forma visível (elasticidade é PREMISSA, mas a folga é medida).
- O momento é melhor do que a média histórica sugere: doadores novos saíram de 7/semana para 48/semana em 5 semanas [B]; a pré-venda está 83,7% feita e fecha com uma baleia.
- O topo da cidade converte: de quem chega à seção do snapshot, 1 em 6 interage e 1 em 10 assina [E]. O problema é volume de chegada, não a página.

## 5. As três coisas que mais movem o resultado, em ordem

1. **Carteiras que descobrem o próprio lote e pagam a licença.** É a variável de que TODAS as linhas dependem (mint, licença, itens). Hoje: 0,122% do snapshot; cada ponto percentual a mais são ~700 carteiras e US$ 8 a 24 mil (mediana a média da cauda). O canal que cresce (X, 34,8% das sessões) traz 8 doadores em 30 dias; Direct traz 27 [A]. A alavanca é chegar nas 69.989 carteiras com a mensagem individual ("seu lote é este"), num calendário de lançamentos em sequência, porque cada lançamento dura 3 dias [A]. Métrica para acompanhar: `snapshot_hero_view` por visitante distinto e `wallet_connected` por semana [E].

2. **Baleias, contadas uma a uma.** 10 carteiras = 63,3% de tudo [B]; uma baleia média (529.497 DOG, US$ 622) vale 53 licenças mínimas. As parcerias institucionais (3k, 5k) são o mesmo movimento: relação direta, lista curta, proposta com inventário da cidade (lote nomeado, torre, Sphere). Lista de partida: 27 institucionais do Distrito Financeiro, 859 carteiras com 10M+ DOG [C]. Entre o pessimista e o otimista da linha de licenças, as baleias explicam US$ 2,5 mil contra US$ 10 mil diretos, e puxam a cauda junto (prova social).

3. **Política de preço do deed, decidida antes de construir.** Três decisões travam o modelo hoje: (a) mint só com licença (masterplan) ou aberto a US$ 2; (b) inscrição a preço de custo (promessa publicada) ou com margem; (c) preço dos lotes do anel de expansão e dos 699 do projeto, onde não há promessa e há folga (mediana de saldo US$ 398). E lembrar que toda receita de licença é em DOG: a linha inteira anda 10% para cada 10% do preço, e o DOG caiu 23% entre 24/08 e 16/09 [B]. Decidir isso primeiro evita construir o trilho de pagamento em BTC para a menor linha da tabela.

## 6. Lacunas desta medição

- `analytics_conversions` tem zero linhas; toda atribuição de doação a canal veio da função ao vivo `analytics_doacoes()`, sem ligar doador a canal específico.
- Ticket em US$ ao preço do dia só existe desde 07/01/2026 (`dog_metrics_history`); 2 doações de nov/2025 (5.800 DOG) ficaram fora, efeito desprezível.
- Não há histórico de preço do BTC no projeto; US$ 86.802 é cotação do instante.
- `snapshot_custody_choice` para de aparecer em 14/09 [E]; ou o componente mudou ou o evento deixou de disparar. Vale conferir, porque é o melhor termômetro do topo do mint.
- Itens secundários e parcerias não têm nenhuma linha em tabela; toda cifra dessas linhas é PREMISSA.
- Nenhum documento do repositório menciona "70 mil terrenos a US$ 2", "1 satoshi" ou mint público sem licença; essa mecânica veio só da fala do fundador e foi tratada como premissa cruzada com o que dava para medir (lotes, taxa de rede, saldo por carteira).
- Nada foi escrito no banco nem tocado na cidade ou em produção; todo acesso foi SELECT.

---

# O ATAQUE AS PREMISSAS

# Revisão adversarial do modelo "Potencial real da DogCity"

Data da conferência: 23/09/2026, 05h58 UTC. Tudo abaixo foi remedido nas fontes: `analytics_doacoes()` e `analytics_funnel(30)` (Supabase, só leitura), `analytics_sessions`, `page_events`, `dog_metrics_history`, `mempool_snapshot`, `dog_snapshot_lookup`, `dog_labels`, `ad_events`, `data/dogcity_lotes.csv`, `data/dogcity_cemiterio.csv`, `masterplan.md` §4, §6 e §11, `app/dogcity/dogcity-data.ts`, `app/dogcity/sections/ordinals.tsx`, e mempool.space (preço do BTC). Preço do DOG: a última linha de `dog_metrics_history` agora é 0,0011864 (05h38 UTC), 1% acima do 0,0011748 do modelo; mantive o 0,0011748 nas correções para comparar linha a linha.

## 1. Veredito por premissa

| # | Premissa (de quem) | Veredito | O que o dado diz e o número corrigido |
|---|---|---|---|
| 1 | 117 doadoras, 105 licenciadas, 8 patrons, 8.369.340 DOG, top 10 = 5.294.973 (modelo) | Sustentada | Idêntico em `analytics_doacoes()`: 117 / 105 / 8 / 8.369.340 / 5.294.973 (63,3%). Mediana 10.000, média 71.533. 140 doações no histórico. |
| 2 | Funil de 30 dias: 8.592 sessões, 4.241 oferta, 105 cópias, 71 conexões, 92 cruzaram 10k, 114 doações, 100 doadores, 4.790.632 DOG (modelo) | Sustentada | `analytics_funnel(30)` hoje: 8.586 / 4.236 / 105 / 71 / 92 / 114 / 100 / 4.790.632. Deriva de 6 sessões é só o relógio andando. |
| 3 | "4.927 visitantes únicos em 4 semanas", conversão visitante para doador ~2%, "7% dos lotes" (modelo) | **Falsa** | Os 4.927 contam visitantes de sessões marcadas como BOT: `count(distinct visitor_id)` em `analytics_sessions` sem filtro dá 4.931; com `not is_bot`, 28 dias, dá **2.417** (e `page_events` humano confirma 2.417). Corrigido: conversão visitante para doador **4,1%** (100 / 2.417), alcance de 28 dias = **3,5%** dos 69.989 lotes. O modelo estava pessimista na conversão e otimista no alcance. |
| 4 | Cenário base "colado no run-rate" (47,3M DOG/ano, US$ 55,6 mil) (modelo) | **Frágil** | O run-rate de 30 dias (58,3M DOG/ano) é o melhor mês da história: 4.091.531 dos 4.790.632 DOG (85%) entraram em 14 dias, em volta do hero de 12 a 14/09. Últimos 7 dias: 15 doadores e 321.002 DOG (16,7M/ano, US$ 19,6 mil). Últimos 60 dias: 106 doadores e 6.462.338 DOG (39,3M/ano, **US$ 46,2 mil**). Corrigido: base de licenças em US$ 46 mil, ancorado nos 60 dias, não nos 30. |
| 5 | Ritmo de patrons "1 a cada 6 semanas" (modelo) | **Falsa** | 8 patrons entre 29/06 e 21/09 = 12 semanas, ou seja **1 a cada 1,5 semana** no período ativo. O modelo diluiu pelos 8 meses parados de nov/2025 a jun/2026. O efeito já está dentro do run-rate de 60 dias; não some de novo. |
| 6 | Pré-venda "fecha com uma baleia em 1 a 2 semanas" (modelo) | Frágil | Faltam 1.630.660 DOG (10.000.000 menos 8.369.340). A maior doação individual da história é 1.000.000 DOG (`bc1py6vx…`); "uma baleia" precisaria ser 1,6x o recorde. No ritmo de 30 dias (159.688 DOG/dia) fecha em 10 dias; no de 60 dias, 15 dias; no dos últimos 7 dias, 36 dias. Corrigido: **2 a 5 semanas**. |
| 7 | "Bater mil" cabe em 12 meses a 17/semana (modelo) | Sustentada | Novos doadores por semana de primeira doação: 7, 17, 21, **48**, depois 2 (semana de 21/09, 2,5 dias). Média de 4 semanas 23,3; de 8 semanas 12,8; últimos 7 dias 15. Precisa de 17/semana por 52 semanas; hoje oscila entre 13 e 23. |
| 8 | Mint só com licença; margem de US$ 2 contradiz promessa publicada (modelo) | Sustentada, e mais forte | `masterplan.md` §4: "Gate: mint requer Personal License" e "cobrando exatamente a taxa de rede BTC (promessa da landing)". A promessa está em copy de PRODUÇÃO em dois lugares: `app/dogcity/dogcity-data.ts:274` ("paying only BTC network fees") e `app/dogcity/sections/ordinals.tsx:297`. Cobrar US$ 2 exige reescrever as duas strings e o §4, não só decidir. |
| 9 | "Mintar tudo = 140 mil" (fundador) | **Falsa** | Regime A (como publicado): mint ≤ licenciadas; para 70.688 mints em 12 meses seriam 1.359 licenças/semana contra 48 na melhor semana medida (28x). 0,122% do snapshot pagou até hoje (105 / 85.818). Teto físico de 12 meses no otimista do modelo: US$ 7 mil (regime A) ou US$ 21 mil (regime B). |
| 10 | Custo de inscrição US$ 0,003 a 0,005 (modelo) | **Falsa** (o número), conclusão intacta | 1 sat = US$ 0,000865 (BTC US$ 86.542, mempool.space). Taxa no nó: `mempool_snapshot` 05h58: min 1, slow 1,0, normal 1,13, fast 1,2 sat/vB. Um deed JSON em commit+reveal solo pesa 250 a 450 vB (PREMISSA de tamanho) = 280 a 510 sats = **US$ 0,24 a 0,44**; em lote sob o pai, ~170 vB por filho = **US$ 0,17**. O modelo errou por 50 a 100x. Como o comprador paga a taxa, a margem de US$ 2 continua inteira. |
| 11 | "1 satoshi salva a inscription" (fundador) / postage 330 a 546 sats, dust P2TR 330 (modelo) | Sustentada (nota de protocolo, não medida no nó) | Postage não é custo, é patrimônio travado: 330 sats = US$ 0,29, 546 = US$ 0,47. Saída P2TR abaixo de 330 sats é dust pela `dustrelayfee` padrão do Core (3 sat/vB); o nó em DOG MODE aceita local, mas precisa entregar a um minerador por canal fora da mempool padrão. Economia máxima por lote: US$ 0,47. |
| 12 | Venda direta dos 699 lotes do projeto: US$ 5 mil base, US$ 30 mil otimista (modelo) | **Falsa** | `masterplan.md` §6, travado: "Regra de uso: reserva vira prédio comercial/parceiro, **nunca** lote de carteira". A receita da reserva É a linha de parcerias (naming rights, prédio de parceiro), já contada em 3.4. Corrigido: **0** nesta linha. Detalhe: o CSV tem 693 linhas `__projeto_*` (60 `__projeto_orla` + 633 `__projeto_reserva`), não 699. |
| 13 | Itens secundários: "nenhum produto definido" (modelo) | Frágil | §11 do masterplan define a estratégia (item de conquista soulbound, item de catálogo transferível, inscrição por `delegate` com filhos de zero byte, pipeline Sketchfab pronto). O que não existe é catálogo e preço. Os US$ 3,4 mil / 17,5 mil continuam PREMISSA, mas o "zero no pessimista porque não há produto" é exagero: há mecanismo, falta SKU. |
| 14 | Parcerias 3k + 5k (fundador); BitFlow sem valor medido (modelo) | Sustentada como PREMISSA | `ad_events`: BitFlow 11.064 impressões e 83 cliques em 30 dias (CTR 0,75%), sem dólar registrado. A US$ 5 de CPM (PREMISSA) o inventário medido vale US$ 55/mês, não US$ 88. |
| 15 | Ticket médio ~US$ 88, "patrons fazem a média decolar" (fundador) | Sustentada, com correção de causa | Ao preço do dia: US$ 63,91 por carteira (total histórico US$ 7.477); ao preço de hoje US$ 83 a 93. Mas a média não vem só dos patrons: das 105 licenciadas, **55 pagaram exatamente 10k (52%)**, 6 entre 11k e 50k, **36 pagaram 50k a 500k (34%)**, 8 pagaram 500k+. O degrau commercial (US$ 59+) é um terço da base e é o que segura a média junto com os patrons. |
| 16 | Tráfego: "picos que não viram piso", pico de 673/696 em 27 e 28/08 (modelo) | Frágil | 27 e 28/08 é o dia do deploy do próprio analytics: 673 sessões para **71** visitantes distintos (9,5 sessões por visitante) e 696 para 210 (3,3), contra 1,7 em 14/09. Esse pico é em boa parte artefato de medição. Já o piso subiu: julho tinha 50 a 110 sessões/dia; 16 a 22/09 tem 133 a 250 sessões e 58 a 108 visitantes/dia. Há curva composta, só que fraca (piso ~2,5x em 2 meses em sessões; antes de 27/08 não existe `visitor_id`, então visitantes não se comparam). |
| 17 | X converte pior; Direct traz o dinheiro (modelo) | Sustentada, com nuance | Por sessão: Direct 5.408 (63%), Social 2.984 (34,8%). Por VISITANTE distinto inverte: Social 1.529, Direct 973. Direct tem 5,6 sessões por visitante: é a comunidade voltando, não gente nova. Conversão por visitante: Direct 2,8% (27/973), Social 0,52% (8/1.529), Search 1 em 49. O X traz 57% mais gente e converte 5x pior. |
| 18 | 40,4% do DOG sem canal (modelo) | Frágil | A mesma função dá dois números: por doação, 1.934.330 DOG sem atribuição (40,4%); por canal de origem do doador, 2.412.330 DOG e **65 dos 100 doadores** sem canal (50,4%). Metade do dinheiro não tem trilha. |
| 19 | Universo do mint: 82% com 10k+, mediana 339.100 DOG, utxo 2+ 31% (modelo) | Sustentada | Recontado em `dogcity_lotes.csv` (70.016 linhas com endereço): 10k+ 57.378 (82%), 100k+ 44.200, 1M+ 8.441, 10M+ 859, abaixo de 10k 12.638, utxo 2+ 21.680, utxo 5+ 7.392. Mediana recontada **361.846** (q1 20.000, q3 889.806); a diferença não move nada. |
| 20 | Preço "caiu de 0,0013 para 0,0010 entre 24/08 e 16/09" (modelo) | **Falsa** nas datas, certa na volatilidade | `dog_metrics_history` (média diária, sem linhas zeradas): 24/08 0,0010512; 01/09 0,0011968; 10/09 0,0010717; 16/09 0,000973; 22/09 0,0011625. Faixa dos 30 dias: 0,000973 a 0,0014238. Toda linha em DOG oscila **±20%** só com o preço. |
| 21 | Doadores com lote 109/117, 6 de fora (modelo) | Sustentada | `dog_snapshot_lookup`: 109 lote, 2 lápide, 6 fora do snapshot. |
| 22 | Top 10 são carteiras genuínas, não caixa do projeto ou exchange | Sustentada (teste fraco) | Nenhuma das 10 está em `dog_labels` (só 31 rótulos existem, teste fraco). 9 de 10 têm lote; saldos no snapshot: 11,4M, 5,1M, 69,3M, 32,9M, 44,3M, 0,84M, 5,7M, 13,0M, fora do snapshot, 1,1M. A carteira de 69M doou 500k (0,7% do saco). **5 dos 10 estão no clube dos 859 com 10M+**: taxa de conversão desse clube 0,58%. Cada 1% a mais do clube = 8,6 patrons = 4,5M DOG = US$ 5,3 mil. É a alavanca mais barata do modelo. |
| 23 | "8,4 doadores/semana desde o início" (modelo) | Frágil | 117 em 46,6 semanas desde 02/11/2025 = 2,5/semana; 113 em 12,3 semanas desde 29/06 = 9,2/semana. O modelo misturou as duas janelas. |

## 2. Tabela corrigida (US$, 12 meses, DOG a 0,0011748)

| Linha | Fundador | Modelo (P / B / O) | Corrigido (P / B / O) | Motivo |
|---|---:|---|---|---|
| Mint (margem US$ 2, regime A) | 140.000 | 1.400 / 3.000 / 7.000 | 1.400 / 3.000 / 7.000 | Mantido; exige mudar §4 e duas strings de produção |
| Licenças | 88.000 | 10.700 / 55.600 / 128.100 | 10.700 / **46.000** / 128.100 | Base no ritmo de 60 dias (39,3M DOG), não no melhor mês |
| Itens | 0 | 0 / 3.400 / 17.500 | 0 / 3.400 / 17.500 | PREMISSA; mecanismo existe (§11), SKU não |
| Parcerias | 8.000 | 0 / 8.000 / 20.000 | 0 / 8.000 / 20.000 | PREMISSA; inclui a reserva do §6 |
| Lotes do projeto | 0 | 0 / 5.000 / 30.000 | **0 / 0 / 0** | §6 veda lote de carteira na reserva |
| **Total** | **236.000** | 12.100 / 75.000 / 202.600 | **12.100 / 60.400 / 172.600** | |

Piso de sanidade: o ritmo dos últimos 7 dias anualizado dá US$ 19,6 mil só em licenças, acima do pessimista; o pessimista de US$ 10,7 mil já embute um corte de ~45% por preço ou desânimo, e é um piso honesto dado o ±20% do DOG em 30 dias.

## 3. O que muda na leitura para o fundador

1. A conversão do site é melhor do que o modelo disse (4,1% dos visitantes humanos doam, não 2%), e o alcance é pior (2.417 pessoas distintas em 28 dias, 3,5% dos lotes). O gargalo é ainda mais de chegada do que o modelo afirmou.
2. O modelo vendeu o melhor mês como "run-rate". A semana de 48 doadores foi um evento (hero do mapa); a semana seguinte deu 15. Base honesta: US$ 46 mil em licenças, com o mint como evento capaz de repetir a semana de 48 algumas vezes.
3. As baleias vêm mais rápido do que o modelo assumiu (1 a cada 1,5 semana desde julho, não a cada 6) e saem de um clube identificável: 859 carteiras com 10M+, das quais 5 já viraram patron. É lista, não funil.
4. Duas linhas do modelo não existem sob as regras publicadas: venda de lote do projeto (§6) e margem no mint sem reescrever a promessa "paying only BTC network fees" que está no ar em `app/dogcity/`. Ambas são decisões do fundador antes de qualquer código.
5. O custo de inscrever não é meio centavo, é 17 a 44 centavos; irrelevante para a margem enquanto o comprador paga, decisivo se o projeto absorver a taxa "at cost" para 70 mil deeds (US$ 12 mil a 31 mil só em rede, PREMISSA de tamanho, a 1,13 sat/vB).