#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// O PORTÃO DE CONFERÊNCIA DA CIDADE. Uma carga da cena, N chapas, um navegador.
//
// ⚠️ POR QUE ISTO EXISTE, e o motivo é medido. Em 02/09 quatro agentes estavam
// com aba aberta ao mesmo tempo, cada uma renderizando a cidade inteira, e a
// máquina do fundador travou. Antes disso, no dia 01, um agente reportou 37 fps
// onde o coordenador media 58, porque tinha três abas abertas: a medição dele
// estava errada e ele não sabia.
//
// O gargalo desta casa não é token nem merge, é RUNTIME COMPARTILHADO: um
// `next dev`, um `.next`, um navegador e uma GPU para todo mundo. A regra que
// sai daí é dura e simples:
//
//   AGENTE NÃO ABRE NAVEGADOR. Agente escreve código e diz o que quer ver.
//   A conferência visual roda AQUI, uma vez, para todos.
//
// Uma carga da cena leva uns 40 segundos. Rodar seis enquadramentos em seis
// abas custa seis cargas e seis contextos de GPU; aqui custa UMA, porque a
// câmera se move dentro da mesma cena já montada.
//
// Uso:
//   node scripts/city/chapas.mjs                      todos os enquadramentos, look 2
//   node scripts/city/chapas.mjs --look=1             o caminho antigo
//   node scripts/city/chapas.mjs --vistas=orla,foz    só alguns
//   node scripts/city/chapas.mjs --vistas=olhobulevar,olhonucleo,olhobairro,olhoborda
//                                                     as quatro de altura do olho
//   node scripts/city/chapas.mjs --saida=/tmp/x       onde gravar
//   node scripts/city/chapas.mjs --url-extra='&hour=night'
//
// Sai: um JPEG por enquadramento e um chapas.json com stats e console.
// Código de saída 1 se aparecer erro de console que não seja da lista conhecida.
// ═══════════════════════════════════════════════════════════════════════════
import { chromium } from '/home/bitmax/.npm/_npx/705bc6b22212b352/node_modules/playwright/index.mjs'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

// ⚠️ OS ENQUADRAMENTOS SÃO CONTRATO, não gosto. Eles estão repetidos em
// `wiki-dogdata/dogcity/orcamento.md` e é assim que uma chapa de hoje se compara
// com uma de semana passada. Acrescente, evite mudar os que existem.
const VISTAS = {
  rua:      [980, 46, 240, 500, 6, 120, 45],
  rasante:  [2100, 6, 2100, 1200, 4, 1200, 55],
  perto:    [700, 12, 330, 560, 4, 250, 40],
  longe:    [1500, 220, 2600, 200, 0, 900, 45],
  aerea:    [0, 1400, 2200, 0, 0, 0, 45],
  orla:     [2000, 70, -1500, 2900, -35, -2500, 45],
  foz:      [1100, 95, -2650, 1620, -35, -3260, 42],
  // ⚠️ ATUALIZADO EM 02/09: o pátio saiu de r 9.200 para r 11.200 quando a casca
  // foi a 9.050. O enquadramento antigo apontava para o lugar vazio, e a primeira
  // conferência depois da mudança fotografou chão nenhum sem ninguém perceber.
  spaceport:[-508, 520, 9700, -508, 180, 11188, 42],
  // a parada do tour, exatamente como o visitante a recebe
  padtour:  [-388, 227, 11618, -528, 299, 11148, 42],
  zenite:   [0, 300, 0, 0, 1200, 0, 60],
  // ⚠️ AS TRÊS DO DOG DERBY (08/09/2026) SÓ MOSTRAM ALGO COM `--url-extra=&pecas3d=1`.
  // A peça E02 é planta de prancheta, e as parcelas do programa saíram da cena em
  // 31/08 ("retire todos os elementos extras"): sem a flag estas chapas saem com
  // o terreno pelado e a conclusão errada é "a peça não foi desenhada".
  // Coordenadas derivadas do quadro local pela fórmula de buildPecas, não medidas
  // à mão: centro do oval (2187,4; 2389,7), tribuna (2101,8; 2285,4).
  // ⚠️ AS CINCO COORDENADAS DO DERBY SAÍRAM DAQUI EM 09/09. Enquanto a peça vinha
  // endereçada pela parcela do gerador, os enquadramentos eram coordenada crua e
  // tiveram de ser recalculados à mão a cada vez que ela se mexeu (duas vezes, e
  // numa delas a chapa saiu fotografando o chão). Agora a peça mora num módulo da
  // teia e quem devolve a câmera é `viewFor`, a partir de `derbySitio()`: estas
  // três pedem o MESMO enquadramento que o tour usa, pelo mecanismo `'view'`
  // logo abaixo, e acompanham a peça sozinhas se ela mudar de célula outra vez.
  // ⚠️ AS TRÊS BOCAS DE CANAL, onde o radial encontra o Lago da Praça. Elas são
  // o assunto de 10/09 ("o traço passa o destino final") e não havia
  // enquadramento nenhum para julgá-las: as vistas `canais` e `canaisfoz` olham
  // a FOZ, na baía, que é a outra ponta do mesmo canal.
  boca1:      [1637, 150, -925, 592, -38, -1269, 45],
  boca2:      [1880, 150, 17, 1147, -38, -803, 45],
  boca3:      [1619, 150, 955, 1395, -38, -122, 45],
  derby:      'view',
  derbyalto2: 'view',
  derbyperto: 'view',
  // ⚠️ AS QUATRO DE DOG AQUATICS TAMBÉM PEDEM `viewFor`, e pelo mesmo motivo que
  // as do derby: o que a live mostra é o enquadramento do tour, então julgar por
  // uma câmera escrita aqui julgaria outra coisa.
  aquatics:        'view',
  aquaticsrasante: 'view',
  aquaticstorre:   'view',
  aquaticsdentro:  'view',
  // pedidos pelos agentes da água em 02/09, para conferir borda molhada e fusão
  // da areia no chão. Rasante de verdade: a câmera fica NA cota da lâmina.
  aguarase: [-971.93, -36, -5400, -842.47, -40.5, -5400, 55],
  areiarase:[2504, -35, -2190, 2714, -40, -1980, 55],
  // o mar e o arquipelago, de cima: a baia nova tem centro em (4815, -3589) e
  // raio equivalente 4.246 m, e a aerea padrao nao alcanca ela.
  mar:      [-1200, 4200, 3800, 4815, -40, -3589, 50],
  // pedido pelo agente do canal central em 02/09: rasante na margem INTERNA do
  // Lago da Praca, para julgar a praia por inclinacao e a juncao da malha fina
  lagointerno:[1000, 14, 300, 1200, -6, 360, 45],
  lagoponte: [0, 60, 1700, 0, -6, 1300, 50],
  // a Ilha do Fundador (IL01) de perto: forma da costa, praia, mata e patamar
  ilhaperto:[2650, 620, -3560, 3526, -30, -4340, 42],
  // a margem do Lago da Praca, o canal central: camera baixa sobre a beirada
  lagocentral:[0, 55, 2050, 0, -38, 1150, 48],
  lagorase:  [0, -30, 1750, 0, -39, 1250, 55],
  // ⚠️ O MACIÇO OESTE, acrescentado em 03/09 quando ele deixou de ser morro e
  // virou estação de inverno. O cume medido fica em r 8.330, azimute 268 graus,
  // ou seja (-8.325, 291), a 1.065,9 m. Estes dois enquadramentos são contrato:
  // é contra eles que a montanha de amanhã se compara com a de hoje.
  inverno:   [-3800, 1250, 400, -8325, 700, 291, 42],
  // ⚠️ A CASCA, acrescentada em 03/09 quando a flecha foi de 2.566 para 5.500 e a
  // borda deixou de ser constante. Os três são contrato: `abobada` julga se ela
  // lê como cúpula ou como lente de dentro, `cascaoeste` é o arco onde a borda
  // sobe para 353 m e é o único lugar onde a forma nova aparece, e `abobadafora`
  // é a silhueta de fora. Coordenadas copiadas de `viewFor()`, e a do oeste é
  // espelhada da `abobadafora` para pegar o lado que mudou.
  abobada:   [0, 900, 3000, 0, 620, 0, 45],
  // ⚠️ O ESTADIO, acrescentado em 05/09 quando o $DOG ARENA entrou na cena. O
  // centro e o da reserva E03 (2.398, 1.481), raio 2.819 m, rumo 121,7 graus, ao
  // lado do Parque Central. `estadio` mostra a IMPLANTACAO (a peca com o parque
  // e o tecido em volta) e `estadioperto` julga o predio.
  estadio:   [4053, 620, 1086, 3184, 10, 853, 45],
  estadioalto:[3435, 1150, 920, 3184, 0, 853, 45],
  estadioperto:[3599, 175, 964, 3184, 25, 853, 42],
  // THE GEODE, a arena coberta. Sitio CORRIGIDO em 06/09 para (2.968, 1.429),
  // raio 3.294: o anterior tinha o Anel Medio passando por cima. Mesmo anel do
  // estadio e 615 m dele. `geode` julga a IMPLANTACAO (a peca com a malha em
  // volta), `geodeperto` julga o predio e o letreiro.
  // ⚠️ ENQUADRAMENTO CORRIGIDO: a primeira tentativa olhava de FORA para dentro,
  // de cima do estadio, e a peca saia fora de quadro. A implantacao se julga do
  // lado da PRACA, que e de onde a cidade e vista, com o estadio ao fundo.
  geode:     [1840, 420, 886, 2968, 30, 1429, 50],
  // ⚠️ O CAMPUS ESPORTIVO, acrescentado em 07/09, quando as tres arenas passaram
  // a dividir uma parcela so. Os tres centros ficam no anel r 3.294, 615,1 m um
  // do outro: atletismo (3.285, 246), ARENA (3.182, 853) e GEODE (2.968, 1.429).
  // O centroide e (3.145, 843). `campus` julga o CONJUNTO do lado da praca (que
  // e de onde a cidade e vista) e `campustopo` julga o alinhamento e a calcada.
  campus:    [1599, 900, 429, 3145, 10, 843, 45],
  campustopo:[3145, 2200, 844, 3145, 0, 843, 45],
  // ⚠️ A PARCELA DE DOG AQUATICS, 09/09. Ela fica do outro lado da avenida de
  // 90°, centro medido em (3.211,4; −733,0), r 3.294, rumo 77,143°. `aquatics`
  // olha do lado da praça, que é de onde a cidade vê; `aquaticstopo` julga a
  // laje, a calçada de borda e o muro. A parcela tem 460 m de eixo, um quarto
  // do campus, então o olho de cima desce na mesma proporção.
  aquatics:    [1605, 700, -366, 3211, 10, -733, 45],
  aquaticstopo:[3211, 1100, -732, 3211, 0, -733, 45],
  // OS TRES CANAIS RADIAIS E A BAIA, de cima. Enquadra da praca (origem) ate a
  // borda externa da agua, ~9 km de vao: e a vista em que a foz de cada canal e
  // a continuidade da lamina se leem de uma vez.
  canais:    [1200, 8240, 1800, 3800, -40, -3000, 50],
  canaisfoz: [1500, 3400, 900, 4200, -40, -2600, 45],
  // cada canal pelo EIXO, de dentro para a boca: e a unica vista em que se ve o
  // canal chegar na baia em vez de atravessa-la
  cr02:      [983, 520, -688, 2568, -40, -1798, 45],
  cr03:      [3985, 700, -349, 6087, -40, -533, 45],
  geodeperto:[2671, 130, 1286, 2968, 34, 1429, 42],
  // ⚠️ OS TRÊS INTERIORES DO CAMPUS, acrescentados em 08/09 quando o fundador
  // reprovou os takes do tour. Eles NÃO cravam coordenada: pedem o mesmo
  // `viewFor` que o tour usa, por `?view=`, senão a chapa julga um enquadramento
  // que o espectador nunca vê. Ver a nota de `sitioNoCampus` em plaza-scene.
  estadiodentro:  'view',
  geodedentro:    'view',
  atletismodentro:'view',
  atletismoperto: 'view',
  // ⚠️ THE SPHERE, acrescentada em 07/09 quando o fundador apontou em produção
  // que "o texto está somente na parte de baixo". O sítio é o módulo
  // {i:20, j:108}: centroide medido em (-4.164,8, 3.072,5), r 5.175,5, e o
  // CENTRO da esfera a y = 158,54 (tabuleiro 116,4 + 0,43 R). As quatro vistas
  // são contrato e existem porque a queixa é de LATITUDE: onde a faixa cai na
  // silhueta muda com a altura do olho, então uma chapa só não julga a peça.
  //   `sphere`      a chapa do fundador: olho na cota do CENTRO, 520 m
  //   `sphererua`   pedestre a 500 m (y=0 é elevado para chão+1,7 pela cena)
  //   `spherealto`  de cima, 700 m e 500 m de altura: o pior caso da faixa baixa
  //   `spherelonge` 1.600 m, onde só sobra o anel aceso
  // ⚠️ REENDEREÇADAS EM 08/09: a esfera saiu do módulo da teia (-4.164,8, 3.072,5,
  // deck 116,4) e virou a QUARTA ÂNCORA da praça central, em (0, -620), sobre a
  // laje plana `PRACA_Y = -35`. As antigas fotografavam chão vazio. Cada uma
  // guarda o MESMO enquadramento relativo à peça que tinha antes; o que mudou é
  // só a origem. Centro da esfera agora em y = -35 + 0,43 x 98 = 7,14.
  // ⚠️ A `sphere` USA O MESMO ENQUADRAMENTO DO TOUR, e isso é de propósito: o
  // `viewFor('sphere')` de `plaza-scene.tsx` é o que o espectador da live vê, e
  // a chapa de contrato tem de julgar exatamente aquilo. A primeira tentativa de
  // reendereçar manteve os 520 m de distância da peça e pôs a câmera em r 100,
  // ou seja DENTRO do inlay do Bitcoin no deck: o ₿ tapava metade do quadro.
  sphere:     [380, 175, 70, 0, 20, -620, 42],
  spherelive: [210, 60, -380, 0, 36, -620, 42],
  spherealto: [0, 465, 80, 0, 7, -620, 42],
  spherelonge:[0, 365, 980, 0, 7, -620, 42],
  // ⚠️ TRÊS VISTAS NOVAS, 07/09, PARA O JARDIM DO PÓDIO, e elas existem porque
  // as quatro acima NÃO julgam o que o fundador pediu. Todas as quatro miram o
  // centro da esfera de 500 m ou mais: nelas o embasamento tem 20 pixels e o
  // jardim inteiro cabe numa linha. O pedido é de PAISAGISMO SOBRE O PÓDIO, e
  // paisagismo se julga a 1,7 m de altura de olho, que é para onde a cidade vai
  // (terceira pessoa estilo GTA).
  //
  // ⚠️ E AS TRÊS TÊM `y` CRAVADO, ao contrário de `sphererua`, DE PROPÓSITO:
  // `OLHOSFIXOS` pergunta a cota ao vivo, e a cota ao vivo é o RELEVO (82 a
  // 116 m por ali), não a laje. Um olho pedido ao terreno em cima do deck sai
  // DEBAIXO dele, em até 16,6 m de rocha. As cotas aqui são as duas construídas
  // e medidas: deck 116,4 (mais 1,7 de olho = 118,1) e pódio 118,6 (mais 1,7 =
  // 120,3). Se `SPHERE_MOD` mudar, estas três linhas mudam com ele, e o jeito
  // de recalculá-las é `doJardim(r, φ)` de `sphere-jardim-plano.ts`.
  //
  //   `spherejardim`  pedestre DENTRO do canteiro 3 (r 168, φ 232), olhando a
  //                   esfera por cima do parterre: julga aro, relva, sebe,
  //                   topiária, cipreste, escadaria e coroa no mesmo quadro
  //   `spherepodio`   pedestre SOBRE o pódio, na promenade (r 95), olhando ao
  //                   longo da coroa de tamareiras: é a chapa do pedido
  //   `spherechao`    de 700 m de altura e r 265, para ler o DESENHO do deck:
  //                   os quatro compartimentos, os quatro portões e o cinto
  // as três do jardim, transladadas pelo mesmo vetor: o deslocamento do sítio
  // (-4.164,8 -> 0 em x, 3.072,5 -> -620 em z) e a queda de cota (116,4 -> -35).
  spherejardim:[166.8, -33.3, -599.6, 0, -3, -620, 55],
  spherepodio:[73.9, -31.1, -679.8, 92, -23.8, -581, 60],
  spherechao: [240.2, 665, -732, 0, -35, -620, 42],
  // ⚠️ ENQUADRAMENTOS NOVOS, 03/09, e o motivo é o que o cabeçalho do terrain.ts
  // avisa: MEXER NA ALTURA MOVE O MUNDO. A coroa foi de 2.619 para 5.513 m e a
  // `abobada` acima, calibrada para a casca velha, passou a fotografar céu preto:
  // a colmeia subiu para fora do cone da câmera. Estes dois OLHAM PARA CIMA.
  cupula:    [0, 240, 2400, 0, 3600, 0, 60],
  cupulaoeste:[-5200, 300, 1200, -8600, 2200, 500, 60],
  abobadafora:[4600, 1250, 4600, 0, 380, 0, 45],
  cascaoeste:[-6400, 1700, 4200, -8000, 500, 300, 45],
  invernope: [-7300, 240, 700, -8325, 600, 291, 50],
  // ⚠️ A ÁGUA CONTRA A MALHA VIÁRIA, acrescentados em 03/09 quando o fundador
  // apontou "estrada passa por cima de lagos, inclusive formando quarteirão sobre
  // o lago". Os dois são os piores casos MEDIDOS, não escolhidos a olho:
  //   `lagogrid`  o corpo de 48,5 ha em (785, -3506): 42 arestas da teia por cima
  //               dele, 5,5 km de deck, vãos de 239 m. É o retrato do defeito.
  //   `bacialeste` a bacia rasa em (5665, 1493), onde 44 quarteirões têm o centro
  //               abaixo da lâmina (até 15,1 m) e 311 lotes vieram junto. Aqui a
  //               água é do CHÃO DA CENA e o gerador não a enxergou.
  lagogrid:  [480, 520, -2147, 785, -40, -3506, 45],
  bacialeste:[4100, 620, 1200, 5665, -40, 1493, 45],
  // ⚠️ O CANAL CONTRA O PÓDIO, acrescentado em 03/09 quando o gerador passou a
  // medir o terreno da cena. Os três canais radiais foram de rFim 3.640/4.540/
  // 5.660 para 7.180/7.200: no relevo corrigido a água mais próxima naqueles
  // rumos só começa em r ~7.320, logo depois do pódio, e a regra do gerador é
  // que o canal morre onde encontra água. O resultado é uma trincheira de 60 m
  // cortando o anel do pódio três vezes, e é isso que esta vista julga.
  //   `canalpodio` a boca do CR01 (rumo 25) chegando na borda do pódio
  //   `canallongo`  o mesmo canal visto de dentro, para medir o corte no tecido
  canalpodio:[2662, 420, -5710, 3043, -40, -6525, 45],
  canallongo:[1775, 900, -3806, 3043, -40, -6525, 50],
  // ⚠️ A CIDADE INTEIRA NUM QUADRO, acrescentada em 03/09 a pedido do fundador.
  // `cidadetoda` é a oblíqua de masterplan: a 9 km de altura e 13 km ao sul, o
  // alvo a 15,9 km, o campo cobre 21 km na horizontal contra os 13,8 km do
  // tecido (r 6.900), então o sítio inteiro cabe com folga e a casca ainda faz
  // silhueta. `cidadeplano` é a mesma coisa em NADIR, para ler a malha como
  // prancha; rode-a com `--url-extra='&domo=0'`, senão a casca lava o quadro.
  // ⚠️ O ENCONTRO DA AVENIDA COM O ANEL DE SERVICO (AN7, vertice em r 7.600 no
  // rumo 0). Ate 06/09 nao existia: a avenida morria em R_FORA 6.900 e o anel
  // inteiro ficava ilhado. Esta chapa e a prova de que ele encostou na cidade.
  // ⚠️ A AVENIDA DA ALCA (AN7 virou circulo em r 6.950 no arco 346 a 116,5). O
  // enquadramento olha de dentro da cidade para fora, cortando a secao inteira:
  // baia, praia, fileira de lote, avenida, fileira de lote, praia, agua externa.
  // ⚠️ DE CIMA, A REGIAO INTEIRA DA ALCA. O arco vai do rumo 346 ao 116,5 em
  // r 6.950: x de -1.682 a 6.950 e z de -6.950 a 3.103, entao o centro cai em
  // (2.634, -1.924) e 9.600 m de altura com fov 60 cobrem os 11 km do lado maior.
  // ⚠️ O ALVO LEVA 1 m DE DESLOCAMENTO EM z, como `cidadeplano`: camera
  // exatamente a prumo degenera o vetor "para cima" e a chapa sai girada.
  // ⚠️ O LAGO DA PRACA DE CIMA, com as bocas dos tres canais radiais (25, 55 e
  // 85 graus). E aqui que a banda do canal comia a bacia ate 07/09.
  lagotopo:  [0, 3400, 1, 0, 0, 0, 60],
  lagobocas: [1500, 1500, -1500, 1500, -40, -900, 50],
  alcatopo:  [2634, 9600, -1923, 2634, 0, -1924, 60],
  // e o corte de perto, no meio do arco (rumo 45): praia, lote, via, lote, praia
  alcatopoperto: [4914, 2600, -4913, 4914, 0, -4914, 50],
  alca:      [3900, 700, -3900, 5300, 0, -5300, 45],
  alcalongo: [2600, 1500, -6600, 5600, 0, -3100, 50],
  // a ponte do anel viario sobre canal radial, que antes boiava fora do asfalto
  pontecanal: [3260, 210, -140, 2898, -30, -205, 45],
  cidadetoda: [0, 9000, 13000, 0, 0, -500, 45],
  cidadeplano:[0, 17000, 1, 0, 0, 0, 60],
  // ⚠️ AS VISTAS DA RODADA DA MONTANHA (04/09/2026), CORRIGIDAS NA OBRA 2. O
  // quartel da rodada é `montanha.md`, na raiz do repo; aqui só a câmera.
  //
  // A primeira versão (obra 1) escrevia `y` absoluto à mão, somando
  // `alturaInvernoAt` (a ADIÇÃO do maciço) a uma base lunar assumida
  // constante de 254 m (a mediana que a Fase 0 mediu). O revisor mediu o
  // erro real: em (-6945, 1476), o alvo de `vagalagoa`, a superfície de
  // verdade (`superficieAt`, a mesma que a malha desenha) é 146,3 m e a base
  // local ali é 11,9 m, não 254: erro de até 242 m, câmera mirando lugar
  // nenhum. E o relevo em si mudou no mesmo working tree (a frente do
  // `inverno.ts` alargou os carimbos de crista nesta mesma rodada), então
  // até a ADIÇÃO que a primeira versão usava já tinha ficado velha.
  //
  // O CONSERTO NÃO É RECALCULAR A CONSTANTE, É PARAR DE ESCREVER `y`. Estas
  // quatro (e a quinta, `florestaolho`, que já nasceu certa em `OLHOSFIXOS`
  // logo abaixo) moram agora em `MONTANHAVISTAS`, depois de `VISTAS` fechar:
  // `x` e `z` continuam fixos (são o LUGAR, e esse não mudou), mas `y` é
  // sempre chão-mais-deslocamento, perguntado à cena em tempo de chapa por
  // `window.__plazaChao`, o mesmo padrão que `OLHOS`/`OLHOSFIXOS` já usam
  // desde 02/09, comentado ali embaixo. O relevo mudar de novo não invalida
  // a câmera: só muda o que ela vê, que é exatamente o ponto.
  //
  // A vista antiga `inverno` (03/09) fica a 4.560 m do alvo: contrato bom
  // para "existe uma montanha ali", curto demais para julgar floresta, neve
  // ou o pé dela. Estas quatro entram do lado dela, sem tocar `inverno` nem
  // `invernope`.
}

// ═══════════════════════════════════════════════════════════════════════════
// MONTANHAVISTAS (04/09/2026, obra 2): as vistas da rodada da montanha, com
// `y` resolvido NA CENA em vez de escrito à mão. O porquê está no comentário
// dentro de `VISTAS`, logo acima de onde estas cinco moravam antes.
//
// Formato: [xOlho, zOlho, folgaOlho, xAlvo, zAlvo, folgaAlvo, fov]. `folga`
// é METROS ACIMA do chão de verdade NAQUELE PONTO
// (`window.__plazaChao(x, z).superficieAt`), nunca um `y` absoluto.
// `folgaAlvo` é 0 em todas porque a instrução original de cada uma já era
// "mirar o chão ali": é a distância e a elevação do OLHO que enquadram a
// montanha, não uma cota extra somada ao alvo.
//
//   `silhueta`    câmera bem acima do chão da cidade em (-3220, 54), 620 m
//                 de folga, a mesma margem de "limpar prédio no caminho"
//                 que a vista `inverno` já usa, só que agora sobre o chão
//                 de verdade daquele ponto, não sobre uma base chutada.
//                 Alvo no centro geométrico da cadeia (-7973, 54: x é a
//                 média dos três cumes da Fase 0, z o meio exato entre os
//                 extremos medidos -2.312 e 2.420), mirando o chão ali:
//                 julga se virou cordilheira ou continua três agulhas.
//   `cumenevado`  só o cume principal. Olho 730 m a sudoeste dele em
//                 (-7845, 274), 30 m de folga (margem para a câmera não
//                 cravar no talude ao pousar perto da crista). Alvo em
//                 (-8230, 887), o topo que a Fase 0 mediu: mirando o chão
//                 ali, seja qual for a cota hoje, e não os 1.115,3 m fixos
//                 que a Fase 0 mediu uma vez só. Fov fechado a 34° corta o
//                 talude de baixo fora do quadro: julga se a neve cobre a
//                 rocha do cume ou aparece em retalho (causa 3 do
//                 diagnóstico).
//   `pemontanha`  o penhasco do ENVELOPE, não do relevo: de `R_CRISTA_PICO`
//                 (8.280, inverno.ts:569) a `R_QUEDA` (8.650,
//                 inverno.ts:570), 370 m onde a adição cai a zero. Medido
//                 OFFLINE hoje (`npx tsx`, `alturaInvernoAt` sobre o
//                 `inverno.ts` desta rodada, sem abrir navegador): 582,4 m
//                 no alvo, 0,0 m no olho, e o número vai mudar nas próximas
//                 rodadas, e não precisa ser reescrito aqui porque a chapa
//                 não lê ele, lê o chão ao vivo. Olho em (-8703, 914), no
//                 chão plano além da queda, 10 m de folga (câmera de pé,
//                 não flutuando). Alvo em (-8235, 865), a crista, mirando o
//                 chão ali: mostra os dois extremos no mesmo quadro.
//   `vagalagoa`   ⚠️ INTERINO. A sela em (-6945, 1476) é o ponto que a obra 1
//                 escolheu antes de existir mecanismo de lagoa nenhum
//                 (Fase 1, achado "Lagoa"). Conferido no fechamento desta
//                 frente (04/09, ~18h): `LAGOA_CENTRO`, `LAGOA_RAIO` e
//                 `LAGOA_COTA` AINDA NÃO existem em `inverno.ts`: a frente A
//                 desta rodada não tinha exportado ainda. Olho em
//                 (-6358, 1351), 30 m de folga; alvo na sela, mirando o chão
//                 ali. QUANDO A FRENTE A EXPORTAR OS TRÊS, troque x/z do alvo
//                 (e do olho, a uma distância parecida) pelo centro real da
//                 lagoa, leia o número de `inverno.ts`, não invente aqui.
//                 Até lá isto continua sendo o ANTES: relevo do maciço, sem
//                 lago.
const MONTANHAVISTAS = {
  silhueta:   [-3220, 54, 620, -7973, 54, 0, 42],
  cumenevado: [-7845, 274, 30, -8230, 887, 0, 34],
  pemontanha: [-8703, 914, 10, -8235, 865, 0, 45],
  vagalagoa:  [-6358, 1351, 30, -6945, 1476, 0, 45],
}

/** Resolve uma entrada de MONTANHAVISTAS: olho e alvo têm x,z fixos (o
 *  LUGAR pedido pela vista), e y vem do chão AO VIVO naquele ponto mais a
 *  folga declarada, nunca um y absoluto escrito à mão. Mesmo
 *  `window.__plazaChao` que `acharChao`/`acharRua` já usam logo abaixo, só
 *  que aqui sem buscar pavimento nem projetar um alvo 60 m adiante: os dois
 *  pontos (olho e alvo) já vêm dados, porque a mira de montanha mira um
 *  lugar específico (um cume, uma sela), não "a rua mais perto". */
const acharMontanha = (pag, [x0, z0, folga0, x1, z1, folga1, fov]) =>
  pag.evaluate(
    ([x0, z0, folga0, x1, z1, folga1, fov]) => {
      const olho = window.__plazaChao(x0, z0)
      const alvo = window.__plazaChao(x1, z1)
      return { args: [x0, olho.superficieAt + folga0, z0, x1, alvo.superficieAt + folga1, z1, fov], olho, alvo }
    },
    [x0, z0, folga0, x1, z1, folga1, fov],
  )

// ═══════════════════════════════════════════════════════════════════════════
// OS ENQUADRAMENTOS DE ALTURA DO OLHO (02/09/2026)
//
// ⚠️ POR QUE UMA TABELA SEPARADA, e não mais quatro linhas em VISTAS. Nas de
// cima o `y` é um número escrito à mão, e isso funciona porque a câmera está a
// dezenas ou centenas de metros do chão: errar 3 m numa aérea não muda a chapa.
// A 1,7 m, errar 30 cm põe a câmera dentro do asfalto ou flutuando, e o chão da
// DogCity varia 232 m dentro do sítio. Então aqui o `y` NÃO se escreve: ele se
// pergunta para a cena, com `window.__plazaChao(x, z)`, que devolve a MESMA
// superfície que a malha desenha.
//
// ⚠️ E O PONTO TAMBÉM SE PERGUNTA. O centro de um quarteirão não é rua, é lote.
// Cada semente abaixo é um LUGAR, não uma coordenada exata: o roteiro procura em
// anéis crescentes o pavimento mais próximo, usando `naVia`, que é a mesma
// máscara com que a arborização evita plantar dentro do asfalto. Sem isso a
// chapa de rua saía com a câmera no meio de um lote vazio, olhando para nada.
//
// Formato: [x semente, z semente, rumo em graus, fov].
// Rumo segue a convenção dos bulevares de `cidade-malha.json`: 0 = -z.
// As sementes de quarteirão são os IDs reais da malha, um por banda:
//   olhonucleo  S03-Q04-B001 (Núcleo, k=2, travessa estreita)
//   olhobairro  S06-Q17-B015 (Bairro, k=4)
//   olhoborda   S04-Q19-B017 (Borda, k=5, o quarteirão mais fundo)
const OLHOS = {
  olhobulevar: [12, -2600, 0, 55],          // BUL01, olhando para fora
  olhonucleo:  [1697.7, 802.9, 115.312, 55],
  olhobairro:  [-1258.6, -3809.8, 341.719, 55],
  olhoborda:   [-1778.2, 4609.7, 201.094, 55],
}

/** Resolve uma semente de OLHOS no argumento de `__plazaOlhar`, dentro da página. */
const acharRua = (pag, [x0, z0, rumo, fov]) =>
  pag.evaluate(
    ([x0, z0, rumo, fov]) => {
      const rad = (rumo * Math.PI) / 180
      const dir = [Math.sin(rad), -Math.cos(rad)]
      let pe = null
      // ⚠️ ANÉIS DE 2 EM 2 m ATÉ 200 m, COM PASSO ANGULAR EM ARCO, e as duas
      // coisas são conserto de erro medido em 02/09. O primeiro laço andava de
      // 10 em 10 graus: a 100 m do centro isso são 17 m entre amostras, e a
      // travessa da cidade tem 9 m de largura. Duas das quatro sementes voltaram
      // "não achei pavimento" com a rua passando a 100 m dali. Passo de arco de
      // 3 m nunca pula uma via, porque a via mais estreita tem 9.
      // O alcance vai a 200 porque o quarteirão mais fundo tem 286 m de prof.,
      // ou seja 143 m do centro ao contorno, e 140 raspava.
      for (let r = 2; r <= 200 && !pe; r += 2) {
        const passos = Math.max(12, Math.ceil((2 * Math.PI * r) / 3))
        for (let k = 0; k < passos; k++) {
          const ar = (k / passos) * 2 * Math.PI
          const c = window.__plazaChao(x0 + r * Math.cos(ar), z0 + r * Math.sin(ar))
          if (c && c.naVia) { pe = c; break }
        }
      }
      if (!pe) return null
      const ax = pe.x + dir[0] * 60, az = pe.z + dir[1] * 60
      const alvo = window.__plazaChao(ax, az)
      // olho a 1,7 m, alvo a 1,6 m: a linha de visada cai 10 cm em 60 m, que é
      // o que o olho de um adulto faz e o que põe o horizonte no lugar certo.
      return { args: [pe.x, pe.superficieAt + 1.7, pe.z, ax, alvo.superficieAt + 1.6, az, fov], achouEm: pe }
    },
    [x0, z0, rumo, fov],
  )

// ═══════════════════════════════════════════════════════════════════════════
// AS VISTAS DE OLHO SEM RUA (04/09/2026, rodada da montanha).
//
// ⚠️ POR QUE NÃO ENTRAM EM `OLHOS`. `acharRua` procura pavimento (`c.naVia`)
// em anéis crescentes até 200 m e falha ("não achei pavimento") se não achar
// — certo para uma câmera de calçada, errado para uma câmera de floresta: lá
// dentro não tem asfalto nenhum, então a busca falharia sempre e a chapa
// nunca sairia. O que as duas tabelas COMPARTILHAM é o motivo de existir:
// nenhum `y` escrito à mão, porque o chão varia demais (o maciço sobe e desce
// dezenas de metros por passo, ver a Fase 0 em `montanha.md`). `OLHOSFIXOS`
// pergunta a cota ao vivo no PONTO DADO, sem procurar nada ao redor.
//
// Formato: [x, z, rumo em graus, fov]. Mesma convenção de rumo de `OLHOS`
// (0 = -z, sentido horário).
//
//   florestaolho  a 1,7 m dentro do maciço, na faixa de altura onde a
//                 floresta planta de verdade. Esta já nasceu certa (o y
//                 sempre veio de `acharChao`/`__plazaChao`, nunca de uma
//                 constante); o que tinha ficado velho era só o COMENTÁRIO,
//                 porque a frente do `inverno.ts` mexeu nestas mesmas
//                 constantes na mesma rodada. RECONFERIDO OFFLINE em
//                 04/09 (`npx tsx`, `inverno.ts` desta rodada, sem abrir
//                 navegador): densidade vem de `FLORESTA_BAIXO`/
//                 `FLORESTA_ALTO`, hoje 15 a 550 m de alturaInvernoAt (não
//                 mais 15 a 190: a faixa alargou no mesmo working tree).
//                 Semente em r 7.100, azimute 272, dentro da cunha
//                 AZ0..AZ1 (248-288, inverno.ts:548-549, inalterada) e fora
//                 do eixo do cume (264), pra não cair em cima de pista.
//                 `zonaEsquiavelAt` ali mede 0,613 (o gerador só planta
//                 acima de 0,04) e `alturaInvernoAt` mede 119,1, bem dentro
//                 da faixa de plantio: o ponto continua válido no relevo de
//                 hoje. Rumo 225° aponta ladeira acima, para o cume
//                 principal: o alvo a 60 m nessa direção mede 131,3 (12 m de
//                 subida), rampa mansa, não penhasco. (`FLORESTA_R_CHEIA`,
//                 antes citado aqui, não é raio de plantio: é o corte de
//                 distância da CÂMERA que decide malha real vs cone, não
//                 diz nada sobre este ponto, tirado da explicação por não
//                 ser o que importa nesta vista.)
const OLHOSFIXOS = {
  florestaolho: [-7096, -248, 225, 55],
  // ⚠️ A DA ESFERA NÃO PODE TER `y` À MÃO, e a primeira tentativa provou: cravar
  // 0 (esperando que a cena elevasse para chão+1,7) deu chapa preta. O terreno em
  // volta do sítio da Sphere vai de 99,8 a 116,0 m e o deck está em 116,4, então
  // aqui `y` é sempre chão ao vivo, como no resto de OLHOSFIXOS. Ponto a 500 m do
  // centro na direção da praça central, rumo 233,7° (o mesmo radial do módulo).
  // ⚠️ NA PRAÇA A COTA AO VIVO É A LAJE (-35), não relevo: `__plazaChao` devolve
  // o mesmo valor em todo o precinto, então este ponto continua honesto. 500 m ao
  // sul da âncora, olhando para o norte (rumo 0: dir = [sin 0, -cos 0] = (0,-1)).
  sphererua:  [0, -120, 0, 55],
}

/** Resolve uma semente de OLHOSFIXOS: pergunta a cota ao vivo no PONTO DADO
 *  (sem procurar pavimento perto, ao contrário de `acharRua`) e no ponto a
 *  60 m adiante no rumo, mesmo par olho/alvo de 1,7/1,6 m que `acharRua` usa. */
const acharChao = (pag, [x0, z0, rumo, fov]) =>
  pag.evaluate(
    ([x0, z0, rumo, fov]) => {
      const rad = (rumo * Math.PI) / 180
      const dir = [Math.sin(rad), -Math.cos(rad)]
      const pe = window.__plazaChao(x0, z0)
      const ax = x0 + dir[0] * 60, az = z0 + dir[1] * 60
      const alvo = window.__plazaChao(ax, az)
      return { args: [x0, pe.superficieAt + 1.7, z0, ax, alvo.superficieAt + 1.6, az, fov], achouEm: pe }
    },
    [x0, z0, rumo, fov],
  )

// ⚠️ ERROS QUE NÃO SÃO NOSSOS. O backend local não roda, então estas rotas dão
// 503 sempre. Sem esta lista o portão acusaria falha em toda execução e viraria
// alarme que ninguém olha, que é pior que não ter alarme.
const RUIDO = [/\/api\/mempool\/dog/, /\/api\/donate\/leaderboard/, /\/api\/city\/chat/]

const arg = (n, d) => (process.argv.find((a) => a.startsWith(`--${n}=`)) || `--${n}=${d}`).split('=').slice(1).join('=')
const look = arg('look', '2')
const saida = arg('saida', 'chapas')
const extra = arg('url-extra', '')
const pedidas = arg('vistas', '').split(',').filter(Boolean)
// ⚠️ RESOLUÇÃO PARAMETRIZADA, padrão INALTERADO. 1440x900 continua sendo o que
// sai quando ninguém pede nada, para que a chapa de hoje siga comparável com a
// da semana passada. Peça de marketing é outro caso: banner de YouTube quer
// 2560x1440 e esticar 1440 até lá borra, que é o defeito do banner antigo.
// `escala` é deviceScaleFactor: renderiza em N vezes e reduz, o que suaviza
// serrilhado melhor do que qualquer filtro depois.
const largura = +arg('largura', 1440)
const altura = +arg('altura', 900)
const escala = +arg('escala', 1)
// ⚠️ O PRAZO DE CARGA ESCALA COM O QUADRO. Em 1440x900 a cena abre em ~40 s e os
// 300 s cravados sobravam. Em 2560x1440 são 2,8x mais pixels e a primeira
// tentativa estourou o prazo sem tirar nenhuma chapa. Quem pede quadro grande
// precisa poder pedir prazo grande junto.
// ⚠️ 300 s NÃO BASTAM QUANDO A MÁQUINA ESTÁ COMPARTILHADA, medido em 02/09: duas
// execuções seguidas estouraram o prazo, e uma sonda do mesmo portão, com a
// máquina mais folgada, mediu o portão abrindo em 169,9 s com zero erro de
// console. Ou seja o portão está são e o prazo é que estava justo. 480 s dá a
// folga de 2,8x que o pior caso medido pede.
const prazoCarga = +arg('prazo-carga', 480000)
const lista = pedidas.length ? pedidas : [...Object.keys(VISTAS), ...Object.keys(OLHOS), ...Object.keys(OLHOSFIXOS), ...Object.keys(MONTANHAVISTAS)]
for (const v of lista) if (!VISTAS[v] && !OLHOS[v] && !OLHOSFIXOS[v] && !MONTANHAVISTAS[v]) { console.error(`enquadramento desconhecido: ${v}\nexistem: ${[...Object.keys(VISTAS), ...Object.keys(OLHOS), ...Object.keys(OLHOSFIXOS), ...Object.keys(MONTANHAVISTAS)].join(', ')}`); process.exit(2) }

mkdirSync(saida, { recursive: true })
// ⚠️ `view=deck` NÃO É ENFEITE. Sem `?view=` a cena entra pelo voo de pouso da
// BATALHA, que é a entrada padrão, e esse voo é uma animação de câmera que
// SOBRESCREVE o `__plazaOlhar`: a primeira execução do portão, em 02/09, saiu com
// as três chapas mostrando o campo de guerra em vez dos enquadramentos pedidos.
// Qualquer `?view=` explícito desliga a entrada da guerra.
// ⚠️ `live=0` E OBRIGATORIO AQUI. Sem ele o tour da live comeca depois de 1
// minuto de ocio e VOA a camera para a primeira parada, que e a batalha: uma
// carga da cena leva minutos, entao o tour rouba o quadro antes de o portao
// posicionar a camera. Em 06/09 duas conferencias seguidas do sitio de THE GEODE
// sairam fotografando a batalha, e a conclusao errada foi "a peca sumiu".
const url = `http://localhost:3000/city?stats=1&quality=high&view=deck&live=0&look=${look}${extra}`

// ⚠️ CHROME COM GPU, NÃO O headless-shell PADRÃO. `chromium.launch()` sem canal
// sobe o headless-shell, e nesta máquina ele força SwiftShader: a cidade tem
// ~6M de triângulos e o portão passou a estourar o prazo, saindo com a CORTINA
// de carga na foto em vez da cena. Medido em 10/09: sete chapas seguidas em
// branco, inclusive com a máquina em load 9, enquanto o mesmo boot instrumentado
// com `channel: 'chrome'` abriu em **105 s e sem um erro de console**.
// `conferir-atletismo.mjs` já usava esta linha desde que nasceu, com a
// justificativa escrita (docs/gpu/using-gpu-hardware-in-headless-chrome.md);
// este portão é que tinha ficado para trás.
const nav = await chromium.launch({ channel: 'chrome', args: ['--enable-gpu'] })
const pag = await (await nav.newContext({ viewport: { width: largura, height: altura }, deviceScaleFactor: escala })).newPage()
const erros = [], logs = []
pag.on('console', (m) => {
  const t = m.text()
  if (m.type() === 'error') { if (!RUIDO.some((r) => r.test(t))) erros.push(t) }
  else if (/\[(vias|arborização|mobiliário|praças|lagos|canais|abóbada)\]/.test(t)) logs.push(t)
})
pag.on('pageerror', (e) => erros.push(`pageerror: ${e.message}`))

console.log(`carregando ${url}`)
await pag.goto(url, { waitUntil: 'domcontentloaded' })
await pag.waitForFunction(() => !!window.__plazaStats, null, { timeout: 180000 })
// ⚠️ `__plazaStats` NASCE ANTES DE A CENA ESTAR PRONTA, e esperar só por ele me
// rendeu uma chapa da cortina de carga em 96% na primeira execução, em 02/09. O
// sinal honesto é o portão `boot.ready` do plaza-scene: enquanto ele é falso, a
// cena desenha um overlay preto por cima de tudo. Esperamos o overlay SAIR do DOM.
// ⚠️ O SINAL AGORA E EXPLICITO, e a mudanca veio de tres chapas pretas. A espera
// antiga era pela AUSENCIA de uma frase no DOM, e isso e corrida: em 02 e 03/09
// ela passou com a cortina de carga ainda de pe e o roteiro fotografou preto,
// uma vez com `?plate=1` (que esconde a propria frase que ele procurava) e duas
// sem motivo aparente. `plaza-scene.tsx` agora publica `window.__plazaPronto`
// no MESMO efeito que abre a cena, entao nao ha como os dois divergirem.
// A frase fica como reserva, para o roteiro nao quebrar contra uma versao velha.
// ⚠️ SEM RESERVA, E ISSO E DELIBERADO. Eu tinha deixado a condicao antiga ligada
// por `||` "para nao quebrar contra versao velha", e foi ELA que disparou na
// execucao seguinte: a chapa saiu na cortina de 7 por cento outra vez. Uma
// condicao de reserva mais fraca ligada por OU nao e rede de seguranca, e o
// caminho de menor resistencia para o bug voltar. Ou o sinal existe, ou falha.
await pag.waitForFunction(() => window.__plazaPronto === true, null, { timeout: prazoCarga })
// e uma confirmacao curta: o sinal pode nascer um quadro antes do primeiro
// desenho da cena aberta, e a chapa nao pode pegar esse quadro
await pag.waitForTimeout(1500)
// ⚠️ E DEPOIS DO PORTÃO A CENA AINDA CRESCE. Os módulos pesados continuam
// chegando e a contagem de triângulos sobe por mais uns segundos.
await pag.waitForTimeout(25000)

const relatorio = { url, quando: new Date().toISOString(), vistas: {}, logs, erros }
for (const v of lista) {
  let achouEm = null
  let achouAlvo = null // só MONTANHAVISTAS preenche: lá o alvo também é chão ao vivo, não os 60 m projetados de acharChao/acharRua
  if (OLHOS[v]) {
    const r = await acharRua(pag, OLHOS[v])
    if (!r) { console.error(`  ${v}: não achei pavimento a 200 m da semente (${OLHOS[v][0]}, ${OLHOS[v][1]})`); relatorio.vistas[v] = { erro: 'sem via em 200 m' }; continue }
    achouEm = r.achouEm
    await pag.evaluate((a) => window.__plazaOlhar(...a), r.args)
  } else if (OLHOSFIXOS[v]) {
    const r = await acharChao(pag, OLHOSFIXOS[v])
    achouEm = r.achouEm
    await pag.evaluate((a) => window.__plazaOlhar(...a), r.args)
  } else if (MONTANHAVISTAS[v]) {
    const r = await acharMontanha(pag, MONTANHAVISTAS[v])
    achouEm = r.olho
    achouAlvo = r.alvo
    await pag.evaluate((a) => window.__plazaOlhar(...a), r.args)
  } else if (VISTAS[v] === 'view') {
    // ⚠️ A CHAPA PEDE O MESMO `viewFor` QUE O TOUR USA, em vez de coordenada
    // própria. Existe porque em 08/09 o fundador reprovou os takes dos três
    // interiores do campus: julgar aquilo por uma câmera escrita aqui julgaria
    // outra coisa. `__plazaFly` é o gêmeo de `viewFor` exposto por `?stats=1`.
    // ⚠️ `__plazaFly(nome)` VOA, não teleporta: ele chama o mesmo `flyTo` do menu
    // (1,4 s de tween). Sem esperar, a chapa sai no meio do caminho.
    const ok = await pag.evaluate((k) => { const f = window.__plazaFly; return f ? (f(k), true) : false }, v)
    if (!ok) { console.error(`  ${v}: __plazaFly não existe (a cena é velha?)`); relatorio.vistas[v] = { erro: 'sem __plazaFly' }; continue }
    await pag.waitForTimeout(4000)
  } else {
    await pag.evaluate((a) => window.__plazaOlhar(...a), VISTAS[v])
  }
  await pag.waitForTimeout(2500)
  const st = await pag.evaluate(() => window.__plazaStats)
  const arquivo = join(saida, `${v}-look${look}.jpeg`)
  // ⚠️ A CHAPA ESTOURA O TEMPO PADRÃO NESTA CENA. Medido em 02/09: o Playwright
  // espera as fontes e o compositor antes de capturar, e num quadro pesado isso
  // passa dos 30 s de fábrica. Prazo largo mais uma segunda tentativa: falhar a
  // captura por impaciência é o pior desfecho possível aqui, porque some
  // justamente a chapa do enquadramento mais caro, que é o que mais interessa.
  let tirou = false
  for (const prazo of [60000, 120000]) {
    try { await pag.screenshot({ path: arquivo, type: 'jpeg', quality: 88, timeout: prazo }); tirou = true; break }
    catch (e) { console.log(`  (${v}: chapa estourou ${prazo / 1000}s, tentando de novo)`) }
  }
  if (!tirou) { console.error(`  ${v}: NÃO consegui tirar a chapa`); relatorio.vistas[v] = { erro: 'timeout' }; continue }
  relatorio.vistas[v] = { arquivo, fps: st?.fps, calls: st?.calls, tris: st?.triangles, programas: st?.programs, pos: st?.pos, ...(achouEm ? { olho: achouEm } : {}), ...(achouAlvo ? { alvo: achouAlvo } : {}) }
  // ⚠️ QUANDO HOUVER achouAlvo (só MONTANHAVISTAS), a chapa também imprime a cota
  // do ALVO ao vivo: é a prova, no log, de que a mira não veio de constante
  // nenhuma (ver o comentário da "obra 1" reprovada, dentro de VISTAS).
  console.log(`  ${v.padEnd(12)} ${String(st?.fps).padStart(3)} fps · ${String(st?.calls).padStart(4)} calls · ${((st?.triangles ?? 0) / 1e6).toFixed(2)}M tris · ${String(st?.programs).padStart(3)} prog${achouEm ? ` · olho em (${achouEm.x.toFixed(0)}, ${achouEm.z.toFixed(0)}) cota ${achouEm.superficieAt}` : ''}${achouAlvo ? ` · alvo em (${achouAlvo.x.toFixed(0)}, ${achouAlvo.z.toFixed(0)}) cota ${achouAlvo.superficieAt}` : ''}  -> ${arquivo}`)
}
await nav.close()
writeFileSync(join(saida, 'chapas.json'), JSON.stringify(relatorio, null, 2))

if (erros.length) {
  console.error(`\n⚠️ ${erros.length} erro(s) de console que não são da lista conhecida:`)
  for (const e of erros.slice(0, 10)) console.error('  ' + e)
  process.exit(1)
}
console.log(`\nsem erro de console. ${lista.length} chapas em ${saida}/`)
