# Fundacao da DogCity: levantamento e plano (28/08/2026)

Levantado por seis frentes em paralelo mais uma sintese, todas medindo no
codigo, no heightmap real e no banco. Nenhum numero aqui e chute; onde nao deu
para medir, esta escrito que nao deu.

## Estado de hoje

1. A praca esta pronta e no ar em /city, sobre terreno lunar REAL (SLDEM2015 da NASA, 137x137 celulas de 59,2253 m, meio-lado 4.027,3 m, relevo real de -89,87 a +96,44 m), e nao desenha um unico lote de carteira: a decisao D4 de praca-central.md mandou retirar todos os lotes de proposito. O terreno esta limpo, nada precisa ser desfeito.
2. A galaxia esta no ar em /galaxy e e, literalmente, uma esfera: app/galaxy/galaxy.ts:147-151 calcula out.x = sin(phi)*cos(theta)*r, out.y = cos(phi)*r, out.z = sin(phi)*sin(theta)*r, com r = shellRadius(depth) (linha 68). O raio carrega UM unico dado: a profundidade genealogica. Theta e phi sao leque mais ruido de hash. Sao conchas concentricas por construcao.
3. Um gerador de fundacao ja rodou de verdade: scripts/foundation_generator.ts produziu data/foundation/lots.json em 2026-07-10, com 84.639 lotes, 0 colisoes, distrito, tipologia, rua, numero e estado por carteira. As formulas ja foram provadas contra a base real inteira.
4. Existe loteamento sobre a Lua: public/lunar/btc-core-lots.json, 83.017 lotes com latitude e longitude selenografica por carteira. Mas o sitio esta CHEIO (raio maximo medido 3.499,9 m contra limite de 3.500) sem uma unica rua ocupando espaco.
5. Existe cartorio gravado: dogcity_lots com 84.830 linhas, mas a parte Bitcoin esta congelada desde 2026-07-08, usa corte de 10.000 DOG (registry.ts:114) e coordenadas de um litoral TERRESTRE que nao existe mais.
6. Existem QUATRO modelos de lote incompativeis rodando ao mesmo tempo: /api/plot (faixa de saldo, pino de hash), dogcity_lots (decil de idade, cidade da Terra), data/foundation (cunha angular de 40 graus) e btc-core-lots.json (faixa de saldo na Lua). Nenhum concorda com o outro.
7. O corte de 20k existe em UM lugar so (foundation_generator.ts:49, BUILD_THRESHOLD). O codigo que serve a cena em producao usa 10.000 (registry.ts:114). Medi hoje: 53.001 carteiras com saldo total >= 20k, 57.444 com >= 10k.
8. Nao existe uma unica rua com perfil, calcada, meio-fio ou canteiro fora do jardim murado da praca. As vias do /city/explore sao fitas de asfalto de 14 a 30 m sem passeio. Zero estadio, zero quarteirao, zero contorno de bairro, zero marcacao de doador no terreno.
9. O que ja esta pronto e sobra: multidao instanciada com animacao na GPU (5.246 bipedes medidos a 13,3 ms por quadro em 4 chamadas de desenho, boneco de 312 triangulos), 83.017 lotes num InstancedMesh a 66,4 fps em 5 chamadas, poeira e faisca em pool, tabela de adereços, pipeline Blender e Sketchfab.
10. O funil de dinheiro esta vivo e medido por mim hoje no banco: 31 transacoes de doacao, 3.673.708,14 DOG, 36,74% da meta de 10M, 28 carteiras doadoras distintas, primeira em 2025-11-02 e ultima em 2026-08-27. Dessas 28, apenas 21 passam no corte de 20k.

## Os numeros que mandam

- CORTE, as duas regras concorrentes (medido por mim em data/dog_utxos_by_address.json, 85.842 enderecos): saldo TOTAL >= 20k da 53.001 carteiras; ao menos UM UTXO >= 20k (a regra escrita no masterplan.md:67 e no foundation_generator.ts:49) da 52.090. Diferenca de 911 carteiras. Nenhuma carteira passa na regra do UTXO sem passar na do saldo.
- ESCADA DE CORTE: >= 20k = 53.001 | >= 10k = 57.444 | >= 1 DOG = 84.222 | poeira < 1 DOG = 1.620. O corte de 20k contra o piso de 1 DOG muda a demanda de terra por um fator de 1,59.
- CONCENTRACAO: as 53.001 carteiras do corte seguram 99,9040% do supply. Dentro delas, 860 carteiras (1,6%) seguram 56,2773%. Area de lote linear no saldo esmaga a cidade inteira.
- BAIRRO CHAPADO: 24.724 carteiras estao na faixa 500k a 1M, ou seja 46,6% de todo o loteamento, com saldos quase identicos (coorte de airdrop). Zonear por saldo produz um subúrbio gigante e monotono.
- IDADE NAO SEPARA (medido): dentro do corte, 92,4% sao LTH acima de 365 dias, mediana de 809 dias, p75 e p90 empatados em 856 (o maximo). Dez distritos por idade dariam fatias artificiais.
- UTXO NAO SEPARA (medido): mediana de 1 UTXO por carteira no corte, 63,3% tem exatamente 1, so 17,4% tem mais de 3. A tipologia por contagem de UTXO do reorganizecity colapsa (o dry run deu 71.083 torres contra 2.756 condominios).
- LINHAGEM SEPARA (medido no Supabase): 13.343 carteiras-pai distintas financiaram as 52.883 do corte. 11.582 sao pai de um filho so, 1.626 tem de 2 a 9 filhos, 117 tem de 10 a 99, e 18 tem 100 ou mais, concentrando 33.806 carteiras. O maior grupo tem 25.666 (a carteira do etch, ou seja o airdrop).
- TERRA, medida celula a celula por mim no heightmap real: o circulo de r 3.500 m tem 38,53 km2. Passam no filtro de declive atual (2 graus) apenas 20,98 km2 (54,5%). A 3 graus, 30,71 km2 (79,7%). A 4 graus, 34,88 km2 (90,5%). A 6 graus, 37,04 km2 (96,1%).
- TERRA LIVRE, depois de tirar o plato da praca (2,91 km2) e o nucleo do Parque Runestone que invade o sitio (3,87 km2): sobram 17,77 km2 a 2 graus e 29,20 km2 a 4 graus.
- TETO DE TAMANHO DE LOTE (calculado por mim com quarteirao de 160 m e via de 16 m, ou seja 17,4% de sobrecarga viaria): a 2 graus o lote medio nao pode passar de 277 m2 para as 53.001 carteiras do corte, e de 174 m2 se todas as 84.222 receberem terreno. A 4 graus os tetos sobem para 455 m2 e 287 m2.
- O QUE CABE: 53.001 lotes de 200 m2 pedem 12,83 km2 e CABEM a 2 graus. De 300 m2 pedem 19,24 km2 e so cabem a 4 graus. De 450 m2 pedem 28,86 km2 e so cabem a 4 graus, no limite. De 600 m2 nao cabem em hipotese nenhuma dentro de r 3.500.
- ESCALA: 1 unidade de mundo = 1 METRO (confirmado, lib/city/lunar/lots.ts compara mintLot direto contra siteRadiusM de 3.500). Logo LOT_PITCH = 14 em zones.ts:81 sao 14 metros entre lotes vizinhos, e uma rua local de 16 m NAO CABE entre dois lotes do modelo atual.
- SITIO CHEIO SEM RUA: os 83.017 lotes lunares vao ate raio 3.499,9 m contra um limite de 3.500, com soma de pegada de apenas 6,749 km2. O sitio esgotou sem gastar um metro com via.
- COLISOES JA EXISTENTES nos lotes lunares: 5.360 lotes caem dentro de r 960 (em cima do deck e do jardim da praca) e, pela contagem da frente 3, 25.934 caem dentro do disco do Parque Runestone.
- DOADORES, medido por mim hoje no banco pela mesma regra da rota: 31 transacoes, 3.673.708,14 DOG, 36,74% da meta de 10M, 28 carteiras distintas. Delas, 21 passam no corte de 20k, 3 estao abaixo do corte com saldo, 3 zeraram, 1 nem aparece na genealogia. Apenas 22 tem linha em dogcity_lots.
- ORCAMENTO GRAFICO ja medido: 83.017 lotes num unico InstancedMesh custam 5 chamadas de desenho e rodam a 66,4 fps. A praca sozinha ja gasta 623 chamadas e 2,54M triangulos a 29 fps. Teste de esforco ao vivo aguentou 300.000 instancias a 37 fps. O limite nao e a contagem de lotes, e a contagem de MATERIAIS.
- OPERARIOS: o boneco shiba custa 312 triangulos; 5.246 bipedes vivos foram medidos a 13,3 ms por quadro em 4 chamadas de desenho, com teto de 4.200 por exercito. 500 operarios custam 156.000 triangulos numa chamada.
- RITMO DE ENTRADA: 1.516 carteiras novas em 30 dias, 405 delas ja acima de 20k, ou seja cerca de 13,5 lotes edificaveis novos por dia. O crescimento liquido do corte foi de apenas +544 em 49 dias (52.457 no dry run contra 53.001 hoje): quase toda entrada e compensada por carteira caindo abaixo do corte.
- AREA DE CONVIVENCIA: 31.221 carteiras tem saldo entre 1 e 20k (viram area verde se o corte de 20k valer para o lote). Alem delas ha 178.500 carteiras zeradas na genealogia, das quais 119.595 um dia receberam 20k ou mais.
- COORTE REAL DO ANEL 0: o dry run usou 85 assentos como proxy declarado. A coorte comportamental de verdade existe no dado (data/forensic_behavioral_analysis.json) e tem 89 carteiras satoshi_visionary. O mesmo arquivo traz 12 coortes com boa dispersao: 19.372 diamond_paws, 1.339 dog_legend, 718 ordinal_believer, 255 rune_master, 100 btc_maximalist.

## A proposta de desenho

A QUEIXA, EM UMA FRASE E COM A CAUSA MEDIDA: a galaxia e esferica porque em app/galaxy/galaxy.ts:147-151 a posicao e a equacao parametrica de uma esfera (x = sin(phi)cos(theta)r, y = cos(phi)r, z = sin(phi)sin(theta)r) com r = shellRadius(depth), ou seja o RAIO carrega um unico dado (a geracao genealogica) e todo o resto e leque mais ruido de hash. Qualquer desenho que derive posicao de UM escalar so pode produzir aneis concentricos. O foundation_generator herdou a mesma doenca por outro caminho (cunhas angulares de 40 graus de largura fixa com populacao de 8 a 30.454), e por isso a cidade nasce redonda mesmo trocando o escalar de saldo para idade.

A CURA: parar de mapear escalar para raio e passar a PARTICIONAR AREA a partir da topologia da arvore. A genealogia nao e um numero, e um grafo, e um grafo particiona o plano em poligonos irregulares de tamanho desigual, que e exatamente a forma que ele quer. Distancia ao centro deixa de significar qualquer coisa.

O QUE DECIDE O BAIRRO DE UMA CARTEIRA: a LINHAGEM, nao o saldo e nao o raio. Medi 13.343 carteiras-pai distintas financiando as 52.883 do corte. Cada clã (o conjunto de carteiras que descende de um mesmo financiador) e um bairro candidato. Isso resolve tres coisas de uma vez: a carteira cai perto de quem lhe deu DOG (tem significado narrativo, o vizinho e o parente), os tamanhos ja nascem desiguais de verdade (de 1 a 25.666), e nao ha escalar nenhum virando raio. Os 18 clãs com 100 ou mais membros (33.806 carteiras) viram os bairros grandes com nome proprio; os 117 clãs de 10 a 99 viram bairros medios; os 11.582 clãs de um membro so nao viram bairro, sao alocados por ONDA DE CHEGADA (first_block) em bairros de formacao mista, exatamente como um loteamento real absorve comprador avulso. O clã do etch (25.666 carteiras, o airdrop) e grande demais para um bairro e precisa de segundo eixo: quebro ele pelas ondas de first_block que ja medi (32.947 carteiras nos blocos 840654 a 852428, depois 2.436, 9.186, 2.917, 1.553, 1.175, 760, 570, 488, 849), o que da bairros de fundacao datados, com o mais antigo sendo o maior, como em cidade de verdade.

O QUE DECIDE A FORMA DO BAIRRO: dois dados, um social e um fisico. O social e a POPULACAO do clã, que fixa a AREA da celula (area proporcional a populacao, nao angulo fixo: e isso que mata a fatia de pizza). O fisico e o RELEVO REAL: eu medi celula a celula que 45,5% do sitio reprova no filtro de 2 graus, e essas reprovacoes nao estao distribuidas ao acaso, elas desenham as ondulacoes reais de Mare Tranquillitatis. Em vez de tratar isso como perda, uso como o desenho: o que reprova vira ravina, parque linear, mirante e terraco, e a fronteira do bairro segue a curva de nivel. O resultado sao poligonos com contorno organico e irregular, cada um com silhueta unica, porque a Lua de verdade nao e simetrica. A particao e uma decomposicao ponderada da terra edificavel (semente por clã, peso pela populacao, corte respeitando declive), nao uma cunha. O fractal que ele pediu vem de graca e sem pastiche, porque a mesma operacao se repete em quatro escalas: cidade divide em clãs, clã divide em sub-clãs, sub-clã divide em grupos de irmaos (o quarteirao), grupo de irmaos divide em lotes. Uma arvore particionada e auto-similar por definicao.

O QUE DECIDE A VIA: a hierarquia da propria arvore, com secao somada a partir de numero medido e nunca inventado. A via monumental (70 m, medida no Champs-Elysees) liga a orbita a Praca Central e so existe uma. As arteriais (30 a 34 m) sao as fronteiras ENTRE clãs grandes, ou seja a rua nasce onde a genealogia se separa, e por isso a malha tem logica em vez de ser grelha decorativa. As coletoras (18 a 24 m) servem sub-clã. As locais (16 m, sendo 9,6 m de leito e 3,2 m de passeio de cada lado) servem o quarteirao. Calcada e jardim entram como REGRA e nao como enfeite: caminho livre de 2,4 m mais faixa ajardinada de 2,0 m em toda via, e uma arvore a cada 7,62 m de testada (regra de Nova York), com porte grande a cada 9 a 12 m nas arteriais e porte pequeno a cada 4,6 a 6 m nas locais, o que muda a textura do bairro visto de cima sem custar geometria nova. O quarteirao alvo e de 160 m, que eu escolhi por medicao e nao por gosto: com via de 16 m ele da 17,4% de sobrecarga viaria, e e essa sobrecarga que faz os 53.001 lotes de 200 m2 caberem em 12,83 km2 dentro dos 17,77 km2 que sobram a 2 graus.

O QUE DECIDE O LOTE: area por faixa de saldo com curva ACHATADA, nunca linear, porque medi que 860 carteiras seguram 56,2773% do supply e area linear entregaria a cidade inteira a elas. A curva de raiz que ja existe (footprintWidth, com A_MIN 40 e A_MAX 8000) ja faz isso e deve ser reaproveitada, apenas renormalizada pelo teto de terra que eu medi (277 m2 de media a 2 graus, 455 m2 a 4 graus) em vez de pelo maior holder. A posicao DENTRO do quarteirao e a ordem de chegada (first_block), que da o numero da casa: numero baixo perto da esquina antiga. A tipologia NAO pode sair da contagem de UTXO, porque medi mediana 1 e 63,3% com exatamente um UTXO: ela sai da coorte comportamental, que ja existe medida e tem dispersao boa (19.372 diamond_paws, 1.339 dog_legend, 718 ordinal_believer, 255 rune_master, 100 btc_maximalist, 89 satoshi_visionary), e isso da silhueta variada de verdade por bairro. O anel 0 deixa de ser proxy de 85 assentos e passa a ser a coorte real de 89 satoshi_visionary, que e verificavel.

O QUE SE REAPROVEITA E O QUE MORRE: reaproveito integralmente o terreno lunar e o heightAt (terrain.ts), a praca inteira como marco zero e como padrao de acabamento (o precinto ja tem meio-fio de 0,7 m, calcada de 8 m, alameda e topiaria, tudo instanciado), as formulas do foundation_generator (elegibilidade, position_score, area, prestigio), a ordem de chegada gravada em data/foundation/lots.json como REGISTRO de precedencia, o esquema de colunas de dogcity_lots, o InstancedMesh de 5 chamadas do /city/luna, o motor de multidao da batalha para os operarios, e o gerador de rede viaria e quarteirao do generator.ts, que e o unico codigo do projeto que sabe fazer via, ponte e mascara de rua. Morrem tres coisas e so tres: a cunha angular de 40 graus de zones.ts (substituida pela particao ponderada), o distrito por faixa de saldo do assignDistrict (substituido por clã), e as COORDENADAS dos 83.017 lotes lunares atuais, que estao erradas (5.360 em cima da praca, o sitio esgotado sem rua). O formato do arquivo fica, os numeros mudam.

## As fases

| # | Fase | Entrega | Risco | Esforco |
|---|---|---|---|---|
| 1 | Prancha 1: o terreno e o orcamento de terra | Um desenho de planta, visto de cima, do sitio inteiro em /city/plan, mostrando em quatro cores o que e edificavel a 2, 3, 4 e 6 graus de declive, com o plato da praca e o nucleo do Parque Ru | baixo | pequeno |
| 2 | Prancha 2: os bairros ganham contorno | O mesmo mapa de planta, agora com os bairros desenhados como poligonos irregulares de tamanho desigual, um por clã genealogico, com area proporcional a populacao e fronteira acompanhando a c | medio | medio |
| 3 | Malha viaria e quarteirao num bairro piloto | Um bairro escolhido, desenhado inteiro em planta com as quatro classes de via na largura certa (monumental 70 m, arterial 30 a 34 m, coletora 18 a 24 m, local 16 m), quarteiroes de 160 m e l | medio | medio |
| 4 | O perfil da via, em 3D, num quarteirao so | Um unico quarteirao levantado em 3D sobre o terreno lunar real, com a rua completa: leito, meio-fio, calcada de 2,4 m, faixa ajardinada de 2,0 m e arvore a cada 7,62 m de testada. E a peca q | baixo | medio |
| 5 | O cartorio: loteamento completo gravado | Todas as carteiras do corte aprovado recebem lote com bairro, quarteirao, rua, numero, area e coordenada selenografica, gravados no banco com contrato de permanencia (o lote nunca se move, n | alto | grande |
| 6 | A cidade aparece na Lua | O /city passa a desenhar a cidade inteira em volta da praca: dezenas de milhares de lotes sobre o terreno lunar real, com os bairros de contorno proprio visiveis do alto e as vias legiveis.  | medio | grande |
| 7 | Programa civico e reservas | Os equipamentos publicos implantados como geometria e nao como tabela: praca de bairro a no maximo 402 m de qualquer lote, parque de bairro a no maximo 805 m, e o terreno do estadio reservad | medio | medio |
| 8 | Marcacao dos doadores e o canteiro de obras vivo | Os terrenos dos doadores marcados no chao (nao apenas no muro da praca), e centenas de DOG operarios trabalhando na cidade, com poeira de escavacao, estaca cravada e tapume nos lotes ainda v | baixo | medio |

### Detalhe de cada fase

**1. Prancha 1: o terreno e o orcamento de terra**

- Entrega: Um desenho de planta, visto de cima, do sitio inteiro em /city/plan, mostrando em quatro cores o que e edificavel a 2, 3, 4 e 6 graus de declive, com o plato da praca e o nucleo do Parque Runestone recortados como buracos, mais uma tabela impressa ao lado dizendo quantos lotes de 125, 200, 300 e 450 m2 cabem em cada cenario. O fundador olha e decide, no mesmo dia, o raio do sitio, o limite de declive e o tamanho do lote. Nao ha 3D, nao ha carteira, e so o chao e a conta.
- Dado que usa: public/lunar/btc-core-heightmap.json e .f32 (137x137 celulas de 59,2253 m, ja publicos e de 75 KB), mais os numeros de area que ja medi: 38,53 km2 no circulo de r 3.500, 20,98 km2 a 2 graus, 34,88 km2 a 4 graus, menos 2,91 km2 de plato e 3,87 km2 de parque.
- Depende de: Nada. Todo o insumo ja esta em disco e ja foi medido nesta rodada.

**2. Prancha 2: os bairros ganham contorno**

- Entrega: O mesmo mapa de planta, agora com os bairros desenhados como poligonos irregulares de tamanho desigual, um por clã genealogico, com area proporcional a populacao e fronteira acompanhando a curva de nivel. E a prancha que mata a cidade esferica: da para olhar e ver que nao ha um unico anel concentrico nem uma unica fatia de pizza. Cada bairro sai rotulado com nome, populacao e carteira-mae.
- Dado que usa: dog_genealogy no Supabase: os 13.343 pais distintos que medi, com 18 clãs acima de 100 membros somando 33.806 carteiras, e as ondas de first_block que quebram o clã do etch (32.947 na primeira onda, depois 2.436, 9.186, 2.917, 1.553, 1.175, 760, 570, 488, 849).
- Depende de: Fase 1, porque a particao so pode semear dentro da terra que o fundador aprovar como edificavel.

**3. Malha viaria e quarteirao num bairro piloto**

- Entrega: Um bairro escolhido, desenhado inteiro em planta com as quatro classes de via na largura certa (monumental 70 m, arterial 30 a 34 m, coletora 18 a 24 m, local 16 m), quarteiroes de 160 m e lotes com testada para a rua. Da para medir com regua na tela e conferir que a conta de sobrecarga viaria de 17,4% fecha.
- Dado que usa: A logica de rede viaria, mascara de rua e quarteirao que ja existe em lib/city/generator.ts (buildRoads, buildStreetMask, generatePlots), portada para o poligono do bairro; as larguras vindas do Global Street Design Guide e da tabela de Boston.
- Depende de: Fase 2, porque o quarteirao precisa do poligono do bairro para saber onde parar.

**4. O perfil da via, em 3D, num quarteirao so**

- Entrega: Um unico quarteirao levantado em 3D sobre o terreno lunar real, com a rua completa: leito, meio-fio, calcada de 2,4 m, faixa ajardinada de 2,0 m e arvore a cada 7,62 m de testada. E a peca que responde ao pedido de calcada e jardim obrigatorios, e serve de padrao aprovado antes de replicar 53 mil vezes.
- Dado que usa: O vocabulario ja instanciado do precinto da praca (meio-fio de 0,7 m, calcada de lote de 8 m, sebe, palmeira, topiaria) e a funcao de fita paralela ribbonGeometry, que ja sabe fazer faixa de largura arbitraria.
- Depende de: Fase 3, e a decisao de declive da Fase 1, porque o assentamento le heightAt.

**5. O cartorio: loteamento completo gravado**

- Entrega: Todas as carteiras do corte aprovado recebem lote com bairro, quarteirao, rua, numero, area e coordenada selenografica, gravados no banco com contrato de permanencia (o lote nunca se move, nunca teleporta). O fundador consulta um endereco e recebe a escritura. Sai tambem o relatorio de validacao com zero colisoes, como o dry run ja provou ser possivel.
- Dado que usa: data/dog_utxos_by_address.json como verdade de saldo (85.842 enderecos, 99,9756% do supply), a ordem de chegada de data/foundation/lots.json como precedencia, e o esquema de colunas de dogcity_lots que ja existe.
- Depende de: Fases 2 e 3, e as decisoes de corte (20k para lote ou para predio) e de congelamento do snapshot.

**6. A cidade aparece na Lua**

- Entrega: O /city passa a desenhar a cidade inteira em volta da praca: dezenas de milhares de lotes sobre o terreno lunar real, com os bairros de contorno proprio visiveis do alto e as vias legiveis. E o momento em que a fundacao deixa de ser planta e vira lugar.
- Dado que usa: O padrao ja medido de um InstancedMesh por familia (83.017 lotes em 5 chamadas de desenho a 66,4 fps), o LOD por contagem do parque e o DistanceCuller que ja existem.
- Depende de: Fase 5. E a Fase 4 para o acabamento da via.

**7. Programa civico e reservas**

- Entrega: Os equipamentos publicos implantados como geometria e nao como tabela: praca de bairro a no maximo 402 m de qualquer lote, parque de bairro a no maximo 805 m, e o terreno do estadio reservado ANTES do resto (11 ha de pegada, ate 48 ha com entorno). Sem essa reserva o estadio nao cabe mais depois sem demolir lote de holder.
- Dado que usa: A classificacao NRPA (mediana de 42,9 m2 de parque por habitante, um parque a cada 2.386 habitantes) e a lista de 39 equipamentos do masterplan secao 5, mais as 200 vagas civicas e 25 parcelas de reserva que o dry run ja separou como contagem.
- Depende de: Fase 2 para os poligonos, e a decisao de quantos habitantes por lote.

**8. Marcacao dos doadores e o canteiro de obras vivo**

- Entrega: Os terrenos dos doadores marcados no chao (nao apenas no muro da praca), e centenas de DOG operarios trabalhando na cidade, com poeira de escavacao, estaca cravada e tapume nos lotes ainda vazios. E a demarcacao visivel da obra que ele pediu.
- Dado que usa: Os 28 doadores medidos hoje (3.673.708,14 DOG, 36,74% da meta), o motor de multidao ja provado com 5.246 bipedes a 13,3 ms por quadro, o boneco de 312 triangulos, a trincheira (que ja tem vala, terra removida e seis estacas) e os pools de poeira e faisca.
- Depende de: Fase 6 para ter cidade onde trabalhar, e a decisao sobre os 7 doadores que nao passam no corte de 20k.

## Decisoes que so o fundador responde

- O corte de 20k e de LOTE ou de PREDIO? Se for de lote, 53.001 carteiras recebem terreno e 31.221 com saldo nao recebem nada. Se for de predio (como manda o masterplan, onde todo mundo acima de 1 DOG recebe terreno demarcado e so quem tem 20k constroi), 84.222 recebem terreno e 53.001 constroem. Isso muda a demanda de terra por um fator de 1,59 e e a decisao que trava todas as outras. Sem ela nao dimensiono nada.
- Saldo TOTAL >= 20k (53.001 carteiras) ou ao menos UM UTXO >= 20k (52.090)? A segunda e a que esta escrita no masterplan.md:67 e no foundation_generator.ts:49. Sao 911 carteiras que mudam de lado, todas com o saldo mas fatiado em pedacos pequenos.
- Qual o raio do sitio e o limite de declive? Hoje o corte e 3.500 m com 2 graus, e nesse cenario sobram 17,77 km2 uteis, o que limita o lote medio a 277 m2. Subindo o declive para 4 graus sobem para 29,20 km2 e o lote medio pode ir a 455 m2. Terraplanar e ganhar terra (e virar obra visivel, que e o que voce quer demarcar), ou respeitar o relevo e aceitar lote menor? O dado da NASA nao e limite: o tile de origem tem 1.364 km por 910 km.
- O bairro e definido pela LINHAGEM (minha proposta: 13.343 clãs genealogicos, tamanho desigual de verdade, vizinho e parente) ou por saldo ou por idade? Preciso registrar que medi as outras duas e elas nao funcionam: idade da 92,4% de LTH acima de 365 dias (fatia artificial) e saldo joga 24.724 carteiras quase identicas num bairro so, que e 46,6% da cidade.
- O mapa e SNAPSHOT CONGELADO ou vivo? O masterplan manda congelar no bloco dos 10M mais 1008, e hoje o fundo esta em 36,74%. Se a regra valer, a cidade so pode ser DESENHADA agora e sorteada depois. Se for viva, preciso saber o que acontece com o lote quando o saldo muda de hora em hora.
- Carteira que vende: o lote continua sendo dela para sempre (como manda o masterplan) ou a area de convivencia vira publica? E venda parcial e igual a zerar? Hoje o codigo tem dois estados diferentes e nao decididos: kind aberto (1 a 10k, 26.831 linhas) e estado de ruina (saldo zero, 0 linhas hoje).
- A curva de tamanho de lote por faixa de saldo. Medi que 860 carteiras seguram 56,2773% do supply: area linear entrega a cidade a elas. Proponho manter a curva de raiz achatada que ja existe, renormalizada pelo teto de terra. Confirma que o maior holder NAO tem o maior lote na proporcao do saldo?
- Os doadores: 7 das 28 carteiras nao passam no corte de 20k (3 estao abaixo com saldo, 3 zeraram, 1 nem aparece na genealogia). A doacao garante terreno mesmo sem saldo, ou a marcacao so existe para quem tambem e holder? Isso bate de frente com a regra de que quem vendeu vira area de convivencia: 3 doadores viraram praca justamente por terem doado e depois vendido.
- A praca central fica no centro da galaxia ou no lote da carteira tesouro? Sao lugares diferentes: o tesouro e apenas a 7.835a maior carteira, e o centro real da galaxia e a carteira do etch (bloco 840001, 80.855 filhos diretos, saldo zero hoje). Voce escreveu que a praca ocupa o lugar do tesouro, e o dado nao confirma isso.
- Carteiras novas em bairros novos: com 13,5 lotes edificaveis novos por dia medidos, um bairro novo por trimestre absorveria cerca de 1.200 lotes. A cadencia e por trimestre, por bairro cheio, ou um sitio lunar novo? Hoje o codigo joga toda carteira nova no distrito 9, que e o anel de borda existente.
- Os 39 equipamentos civicos do masterplan foram escritos para uma cidade terrestre com mar, rio e montanha. Na Lua, quais sobrevivem literais, quais viram equivalente lunar (porto vira spaceport, orla vira borda de mare) e quais morrem? E reservo o terreno do estadio agora (11 a 48 ha), porque depois do loteamento ele nao cabe mais sem demolir lote de holder.
- O /api/plot da landing entrega HOJE um distrito por faixa de saldo e um pino de hash. Quando a fundacao real for gravada, milhares de carteiras vao ver o proprio distrito mudar. Anuncio como 'a fundacao oficial substitui a previa', ou congelo o /api/plot ate a fundacao existir, para ninguem ver o numero mudar duas vezes?
- O anel 0: fico nos 85 assentos publicados (que o proprio gerador declara como proxy provisorio) ou uso a coorte comportamental real, que existe no dado e tem 89 carteiras satoshi_visionary e criterio verificavel?

## Armadilhas medidas

- Reaproveitar mintLot como geometria de posicao garante uma cidade sem ruas. LOT_PITCH e 14 e 1 unidade e 1 metro (confirmado: lib/city/lunar/lots.ts compara mintLot direto contra siteRadiusM de 3.500). Uma rua local de 16 m nao cabe entre dois lotes vizinhos. A cunha angular tem de sair na Fase 2, nao depois.
- O sitio JA ESTA CHEIO sem gastar um metro com via: os 83.017 lotes lunares chegam a raio 3.499,9 m contra o limite de 3.500. Somar rua, calcada e canteiro sem subir o raio ou o declive vai EXPULSAR lotes, nao apertar. Quem nao decidir a Fase 1 antes vai descobrir isso com o loteamento pronto.
- O Parque Runestone invade a cidade. Medi 3,87 km2 do nucleo dele dentro do circulo de r 3.500, e o ponto mais proximo do disco esta a 1.600 m do centro, em cheio onde o primeiro anel de bairros iria. Ou os bairros contornam o parque (e a cidade nasce torta de proposito, o que pode ficar bonito), ou o parque encolhe, ou se afasta. Nao existe quarta opcao.
- 5.360 dos lotes lunares atuais caem dentro de r 960, ou seja em cima do deck e do jardim murado da praca. Qualquer reaproveitamento das coordenadas atuais planta carteira dentro da praca.
- dogcity_lots parece pronta e nao esta: 84.830 linhas, mas a parte Bitcoin esta congelada desde 2026-07-08, usa corte de 10.000 (registry.ts:114, nao os 20.000 do plano) e as coordenadas sao de um litoral TERRESTRE que nao existe mais. Migrar essa tabela em vez de regerar carrega o corte errado e um mundo que morreu.
- Area de lote linear no saldo destroi a cidade: 860 carteiras seguram 56,2773% do supply. Sem a curva achatada, essas 860 ocupam mais da metade do terreno e as outras 52 mil viram poeira ao redor.
- A tipologia por contagem de UTXO nao produz variedade: medi mediana 1 e 63,3% das carteiras do corte com exatamente um UTXO. O dry run ja mostrou o resultado (71.083 torres contra 2.756 condominios). Se ninguem trocar o criterio, a cidade inteira sai com a mesma silhueta.
- Zonear por idade parece seguro e nao e: 92,4% do corte e LTH acima de 365 dias, e p75 e p90 empatam em 856 dias, que e o maximo. Dez distritos por idade seriam dez fatias arbitrarias de uma populacao homogenea.
- O gargalo grafico nao e a quantidade de lotes, e a quantidade de MATERIAIS. A praca ja gasta 623 chamadas de desenho, e 83.017 lotes custam apenas 5 quando estao num InstancedMesh so. Cada material novo por bairro, cada acabamento por lote e uma chamada. Um sistema de lote com material por distrito estoura o orcamento antes de desenhar a primeira rua.
- Nenhuma peca de obra pode trazer PointLight propria: o teto da praca e de 10 luzes e ja esta praticamente gasto (4 na batalha, 7 no parque, 2 nos monumentos, 1 no precinto). Luz de canteiro tem de ser emissao pintada ou poca de luz no chao.
- A exageracao vertical e 2x na cena, mas o filtro de declive julga o heightmap CRU. Uma encosta aprovada como 2 graus aparece na tela como 4. Quem calibrar o assentamento olhando para a tela vai calibrar errado.
- react-three-fiber quebra neste repositorio contra a versao de React instalada. Todo modulo novo tem de nascer Three.js puro no formato que ja existe (uma funcao que devolve grupo, update e dispose).
- Existe um bot de auto-commit que empurra para origin/main periodicamente e pode varrer trabalho em andamento nao commitado. Trabalho longo de fundacao precisa de branch.
- O /api/plot ja publicou um distrito por faixa de saldo para quem digitou o endereco na landing. Gravar a fundacao sem avisar faz milhares de carteiras verem o proprio distrito mudar sem explicacao, e o masterplan ja registra essa divida como nao feita.
- A barra de arrecadacao mostra 3.673.708 DOG brutos, mas a tesouraria ja gastou e tem cerca de 1,4M em caixa. A secao se chama 'Don't trust. Verify.', e quem verificar vai achar numeros diferentes. Se a fundacao amarrar terreno a doacao, essa divergencia vira disputa sobre lote.
- O degrau Patron (500k) nunca e carimbado pelo servidor: a funcao de licenca para no comercial, entao as 3 maiores carteiras aparecem como Commercial. Se o loteamento der quadra nobre a Patron, o carimbo precisa existir antes.
- A praca foi calibrada para uma cena VAZIA em volta (decisao D4 retirou os lotes de proposito). Somar dezenas de milhares de lotes com rua, calcada e jardim muda o orcamento de performance que hoje roda a 29 fps com 623 chamadas, e os tres perfis vao precisar de novo numero e novo raio de culling.
- O dry run de 2026-07-10 envelheceu: 86.252 holders entao contra 85.842 hoje, e 52.457 acima de 20k contra 53.001. As formulas continuam validas, os numeros nao. Regerar e obrigatorio; reusar o arquivo como PRECEDENCIA de chegada e o certo.

## Escopo travado em 28/08 pelo fundador

- A cidade e dimensionada por HOLDER ATIVO, nao pela galaxia inteira. Carteira morta nao entra no dimensionamento.
- O terreno e permanente, o predio nao: saldo zera, o predio some e o lote fica vazio; saldo volta, o predio sobe de novo de graca, porque a licenca e da carteira.
- Tipologia: Personal e padrao POR BAIRRO, Commercial e padrao por bairro com espaco de marca, Patron e personalizado.
- Registro E o fundo. 10M e portao de mint, nao teto de arrecadacao. O loteamento existe independente do portao.

---

## Regra nova, 28/08: coleções parceiras compram POSIÇÃO, não entrada

Decisão do fundador, textual: uma carteira que contenha um DOG Social Club, ou
outra coleção de ordinals que ele escolher, **passa no filtro de idade**. Ela
ainda precisa dos 20 mil DOG. O corte de entrada não muda; o que muda é onde ela
constrói.

Isso separa limpo os dois eixos da cidade:

- **20.000 DOG é o portão.** Quem não tem, não lote.
- **Idade do UTXO é a posição.** Mais antigo, mais perto da praça.
- **Coleção parceira é um atalho de posição, nunca de entrada.**

### Por que isso é coerente e não um favor

O levantamento mediu que a idade sozinha NÃO consegue alocar o anel da frente:
**38,88% das carteiras estão empatadas em apenas cinco blocos do dia 24/04/2024**,
o platô do airdrop. São cerca de 20 mil carteiras disputando um anel que comporta
6.647 lotes de 300 m². O critério de idade precisava de um segundo eixo de
qualquer jeito. Coleção parceira é esse segundo eixo, e é um eixo que a casa
controla e pode negociar.

### O anel da frente, medido

| anel | bruto | líquido (menos 17,4% de via) | lotes de 300 m² |
|---|---|---|---|
| r 960 a 1.300 m | 2,414 km² | 1,994 km² | 6.647 |
| r 1.300 a 1.800 m | 4,869 km² | 4,022 km² | 13.407 |

O loteamento não pode começar antes de r 960: o precinto da praça é permanente
até r 910 e o platô achatado avança até 1.300 m com rampa.

### O DSC cabe folgado, e já tem endereço

A coleção tem **306 inscrições**, então no máximo 306 carteiras. A 300 m² por
lote isso é **0,092 km², ou 3,8% do primeiro anel**. Em terra é troco; em posição
é tudo.

E ela já tem um lugar na cidade: a galeria do Dog Social Club está construída
dentro da praça, em (596, −232), **raio 640 m, rumo 68,7°**. O condomínio natural
é radialmente para fora da própria galeria, no mesmo rumo, começando em r 960.
Medido, o rumo 69° tem **930 m livres** antes do disco do Parque Runestone, e um
condomínio de 306 lotes ali é uma cunha de cerca de **17°**. Cabe.

Isso dá um eixo urbano legível de graça: o muro da coleção dentro da praça, o
portão na muralha, o condomínio lá fora. Quem entra na cidade lê a parceria sem
ninguém explicar.

### Reserva estratégica da casa

O projeto precisa de estoque próprio de terreno premium para negociar. O anel da
frente é o único bem genuinamente escasso da cidade, porque terra não é
(lib/city/lunar/sites.ts:73 é um número só, e o tile da NASA de onde ele sai
comporta 18.854 tabuleiros como o nosso).

Proposta: reservar as **cunhas de portão**, onde as avenidas principais deixam a
muralha. São os endereços mais visíveis do primeiro anel. O DSC fica com a de 69°.

⚠️ Rumos NÃO disponíveis para reserva, por medição: 23° tem só 800 m livres e
45° tem 650 m, os dois espremidos pelo Parque Runestone, cujo disco real é de
3.600 m e come 6,31 km² do sítio (e não os 3,87 km² que este documento afirma em
outro trecho). Livres de verdade, com 2.540 m: 90°, 135°, 180°, 225°, 270°, 315°.
O 0° tem 2.230 m.

### MEDIDO em 28/08: quem detém o DSC e quem passa no portão

Resolvi as **306 inscrições, 306 de 306**, pelo indexador (`inscriptionOwner`,
lib/ordinals/inscriptions.ts, via UniSat) e cruzei com o saldo de
`data/dog_holders_by_address.json`.

| | |
|---|---|
| carteiras distintas com DSC | **94** |
| ... com qualquer DOG | 40 (42,6%) |
| ... que passam nos 20.000 DOG **na mesma carteira** | **34 (36,2%)** |
| mediana de saldo dos 34 | 1.808.373 DOG |
| soma dos 34 | 140.144.065 DOG |
| peças na mão de quem passa | 150 de 306 |

A coleção é concentrada: **duas carteiras detêm 195 das 306 peças** (113 e 82).
Por isso a unidade de terreno é a CARTEIRA, nunca a peça: uma carteira que passa,
um lote. Se fosse por peça, dois endereços levariam 64% do condomínio.

### Dimensionamento real: é bem menor do que parecia

| cenário | lotes | área | cunha no anel da frente |
|---|---|---|---|
| só quem já passa hoje | 34 | 10.200 m² | **1,8°** |
| a coleção inteira, se todos entrarem | 94 | 28.200 m² | **5,1°** |

Recomendação: reservar para os **94**, não para os 34. Passar no portão custa
20.000 × US$ 0,001309 = **US$ 26,18**. O portão é simbólico em dinheiro, então
quase todo detentor que quiser o endereço premium vai simplesmente comprar.

E é aí que a regra da mesma carteira deixa de ser restrição e vira motor: hoje
**60 das 94 carteiras não têm DOG nenhum**. Cada uma delas ganhou um motivo
concreto para ir ao mercado. A regra não exclui o colecionador, ela o converte
em holder.

Como a cunha é de 5°, e não de 17° como a conta inicial supunha, cabem muitas
coleções parceiras no primeiro anel sem comprometer o loteamento por idade.

### O que trava

1. ~~Quem detém cada DSC~~ RESOLVIDO em 28/08, ver acima: 94 carteiras, 34 passam.
2. **Quantas coleções parceiras no total?** O tamanho da reserva sai daí. Com
   5° por coleção do porte do DSC, o primeiro anel comporta dezenas.
3. **MESMA CARTEIRA, decidido pelo fundador em 28/08 e sem apelação.** Eu propus
   aceitar um par de carteiras assinadas (cofre de ordinal + carteira de giro),
   já que `lib/wallet/verify.ts` faz essa prova por BIP-322 e o connect da cidade
   usa isso em produção. O fundador vetou: "a carteira de ordinals é uma só, vai
   ter que ser na mesma carteira". Fica registrado que a regra exclui hoje 60 das
   94 carteiras da coleção, e que isso é intencional.

### Contradições deste documento que precisam ser resolvidas

O levantamento de 28/08 achou que este arquivo contradiz decisões já tomadas:
a Fase 2 inteira foi escrita para bairro por LINHAGEM genealógica, e as linhas
26 e 147 REPROVAM a idade como critério, que é exatamente a regra travada pelo
fundador. A linha 150 carrega uma armadilha invertida. Enquanto isso não for
reconciliado, quem ler este plano para executar a Fase 2 vai construir a cidade
errada.
