// Os lagos de cratera: a água que a GEOGRAFIA dá, não a que o desenho impõe.
//
// ⚠️ ESTE MÓDULO EXISTE PORQUE OS CANAIS DE ANEL MORRERAM (fundador, 30/08).
// Eles eram sete círculos geométricos jogados sobre um relevo que não é
// circular — o CA07 passava 20,5 dos seus 34,4 km DENTRO de cratera — e nivelar
// os quinze canais numa lâmina só custaria 276 Mm³ de terraplenagem, mais do que
// o Canal do Panamá inteiro moveu (205 Mm³). A saída foi dele: "já que temos que
// usar o terreno real, é só transformar as crateras em lagos".
//
// ⚠️ E A LÂMINA É UMA SÓ, EM TODA A CIDADE. Também dele, e é hidráulica básica:
// "toda água da cidade precisa ter exatamente o mesmo nível, já que está tudo
// interligado". Água conectada acha um nível. O nível é `cota`, medido em −40 m
// porque é onde o custo desaba: afoga 163 lotes (0,2%) contra 14.958 em −20.
//
// ⚠️ O CONTORNO SE TRAÇA AQUI, NÃO VEM PUBLICADO. O gerador conhece o heightmap
// CRU; o chão que a cidade tem é `superficieAt`, com o pódio da abóbada, a cova
// do parque e a vala do canal já aplicados. Publicar polígono do chão cru poria
// a margem no lugar errado, então o cliente traça a orla a partir do chão final.
//
// Three.js puro (regra da casa: nada de react-three-fiber).
// ═══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three'
import { COR_AGUA, aguaDeVerdade } from './lago'
import { look2 } from './look'
import { superficie, quebrarRepeticao } from './materiais'
import { ANEIS, N_RAD, anguloDe, nasceEm, passoNoRaio } from './teia'

const COR_AREIA = '#8E856F'    // a faixa de praia, no mesmo tom do cais dos canais
const COR_FUNDO = '#243B47'    // o raso junto à margem, para a água não virar chapa
// A ORLA usa a MESMA paleta do cais dos canais (canais.ts), de propósito: é a
// mesma peça urbana encostando na mesma água, e duas paletas para isso leria
// como dois projetos.
const COR_CAIS = '#8E856F'     // o passeio de cima
const COR_MURO = '#6E685C'     // o muro de arrimo e o talude de trás
const COR_PISTA = '#57534B'    // a faixa de rolamento, o valor mais escuro da cidade

export interface LagosOpts {
  /** a lâmina, única para toda a cidade */
  cota: number
  /** o chão que a câmera vê, com pódio, cova e vala já aplicados */
  superficieAt: (x: number, z: number) => number
  /** até onde procurar água: a casca */
  raio: number
  /** ⚠️ ONDE FICA A BAÍA, segundo o gerador (`cidade-malha.json` -> `lagos.baia`).
   *
   *  ⚠️ SEM ISTO A BAÍA É ELEITA POR TAMANHO, E ISSO QUEBRA QUANDO O RAIO CRESCE.
   *  A regra antiga era "o maior corpo é a baía", o que valia enquanto a casca
   *  fechava em 7.050. Com a casca em 9.050 (02/09) entra no alcance um anel de
   *  água externo de 34,5 km² que GANHA da baía do fundador, e a orla construída
   *  (cais, muro, passeio) muda de lugar sozinha, em silêncio.
   *
   *  Passando o ponto que o gerador publica, a eleição vira "o corpo que contém
   *  ESTE ponto", que é fonte única e não depende de quem é maior. */
  baiaEm?: [number, number]
  /** passo da amostragem em metros; 30 dá orla lisa sem pesar */
  passo?: number
  /** ⚠️ ONDE A MARGEM NÃO SE DESENHA, mas a ÁGUA ENTRA.
   *
   *  ⚠️ ESTA DISTINÇÃO É O CONSERTO DA BOCA DO CANAL. A versão anterior tirava a
   *  ÁGUA do corredor do canal, e o efeito colateral foi pior que o problema: sem
   *  água ali, o contorno da baía CONTORNA a boca do canal, e a orla (cais, muro,
   *  talude) é construída atravessada na frente dela. O fundador viu um U de cais
   *  fechando a saída do canal e disse, com razão, que a terra bloqueava a saída.
   *
   *  Água e margem são coisas separadas. A lâmina do lago PODE inundar o
   *  corredor: ela está na mesma cota do canal (−40), então as duas se sobrepõem
   *  sem diferença visual nenhuma. O que não pode é a MARGEM cruzar a boca, porque
   *  o canal já tem cais próprio. Aqui só a margem é suprimida. */
  semMargem?: (x: number, z: number) => boolean

  /** ⚠️ ONDE O LAGO NÃO ENTRA. Continua existindo para quem precisar, mas o canal
   *  NÃO usa mais: ver `semMargem` acima. O leito do canal
   *  é cavado a −44, abaixo da lâmina de −40, então o marching squares daqui
   *  inundava a vala inteira e desenhava a borda dela — uma linha azul sinuosa
   *  seguindo o fundo irregular da escavação, por cima da água RETA que
   *  `canais.ts` já desenha no mesmo lugar. O fundador viu as duas sobrepostas e
   *  chamou de "pedaços de um rio tortuoso colocado num canal reto". Não são dois
   *  desenhos do mesmo canal: são dois sistemas de água pisando um no outro. */
  foraDe?: (x: number, z: number) => boolean
  sombra?: boolean
}

export interface Lagos {
  group: THREE.Group
  area: number
  corpos: number
  triangulos: number
  /** ⚠️ ESTÁ NA BAÍA? (o maior corpo, não uma poça qualquer)
   *
   *  Existe porque a RUA precisa saber. Travessia sobre um canal de 60 m ou sobre
   *  uma cratera de 300 m é ponte; travessia sobre 20,5 km² não é ponte, é outra
   *  coisa — e o fundador decidiu que ali não passa estrada. Sem esta consulta a
   *  via não tem como distinguir os dois casos, porque para ela toda água é água.
   *
   *  A resposta sai da mesma rotulagem por preenchimento que decide quem ganha
   *  orla, então as duas pontas nunca divergem. */
  naBaia: (x: number, z: number) => boolean
  /** ⚠️ ESTÁ MOLHADO? QUALQUER CORPO, não só a baía.
   *
   *  Existe porque a ÁRVORE precisa saber, e por muito tempo não soube: medido em
   *  31/08, 13,7% da plantação (cerca de 6.800 de 49.818 mudas) estava plantada
   *  em cima d'água. A fileira da avenida de rumo 0 seguia reta da margem até
   *  r 5.400, com a rua parando na baía e as árvores atravessando. Foi o que o
   *  fundador viu como "fileiras de árvores em locais que não temos ruas".
   *
   *  ⚠️ E É SEPARADA DA `naBaia` DE PROPÓSITO. Para a RUA a distinção importa
   *  (cratera de 300 m é ponte, 20,5 km² não é); para quem PLANTA não importa
   *  nada: toda água é igualmente inplantável. Uma consulta só, respondendo as
   *  duas perguntas, faria uma das duas errar.
   *
   *  `folga` é em METROS e é medida de verdade, não dilatação de célula: a grade
   *  tem passo de 30 m e crescer por célula saltaria de 0 para 30. */
  naAgua: (x: number, z: number, folga?: number) => boolean
  /** ⚠️ ESTA ÁGUA EMPURRA A MALHA VIÁRIA, em vez de receber ponte?
   *
   *  É a terceira consulta, e ela existe porque as duas de cima respondiam
   *  perguntas diferentes desta. `naBaia` é sobre UM corpo (o que ganha cais);
   *  `naAgua` é sobre plantar árvore, onde toda água é igual. Esta é sobre a RUA,
   *  e a resposta dela é uma CLASSIFICAÇÃO medida: o corpo cujo maior vão contra
   *  a teia passa de `LIMIAR_PONTE` faz a via parar na linha d'água; o resto
   *  continua atravessando sobre o tabuleiro. Ver o bloco de `LIMIAR_PONTE`. */
  bloqueiaMalha: (x: number, z: number) => boolean
  /** ⚠️ POR ONDE A VIA DE ORLA PASSA, um array de [x,z,x,z,…] por eixo.
   *
   *  A outra metade do pedido de 03/09. Parar a rua na margem sozinho deixaria a
   *  malha com tocos cegos apontando para a água; estes eixos são o que os costura,
   *  e eles são CURVA de verdade — seguem a linha d'água suavizada, não a grade.
   *  Só os corpos que empurram a malha entram, e a baía fica de fora porque a orla
   *  construída dela já tem pista própria. Quem desenha é `vias.ts`. */
  orlasDesvio: number[][]
  update: (t: number) => void
  dispose: () => void
}

/**
 * ⚠️ MARCHING SQUARES, E É O QUE FAZ A ORLA FICAR LISA. A tentação é emitir um
 * quadrado por célula abaixo da cota — sai em degrau de 30 m, que a 200 m de
 * distância lê como serra. Aqui cada célula da grade é resolvida pelo caso dos
 * seus quatro cantos e o corte cai no ponto INTERPOLADO em que o chão cruza a
 * lâmina. A margem passa a ser a curva de nível de verdade.
 *
 * Os 16 casos saem de uma tabela: para cada combinação de cantos submersos,
 * o polígono da parte molhada, em índices onde 0..3 são os cantos e 4..7 são os
 * pontos das arestas.
 */
const CASOS: number[][] = [
  [],                    // 0000
  [0, 4, 7],             // 0001
  [1, 5, 4],             // 0010
  [0, 1, 5, 7],          // 0011
  [2, 6, 5],             // 0100
  [0, 4, 5, 2, 6, 7],    // 0101 (sela)
  [1, 2, 6, 4],          // 0110
  [0, 1, 2, 6, 7],       // 0111
  [3, 7, 6],             // 1000
  [0, 4, 6, 3],          // 1001
  [1, 5, 4, 3, 7, 6],    // 1010 (sela)
  [0, 1, 5, 6, 3],       // 1011
  [2, 3, 7, 5],          // 1100
  [0, 4, 5, 2, 3],       // 1101
  [1, 2, 3, 7, 4],       // 1110
  [0, 1, 2, 3],          // 1111
]

// ═══════════════════════════════════════════════════════════════════════════
// A ORLA DA BAÍA
//
// ⚠️ A BAÍA É DECISÃO DE PROJETO (fundador, 30/08: "eu gostei da baía, vamos
// organizar a cidade em torno disso"). Ela não foi desenhada: apareceu quando o
// nível único de −40 encontrou a encosta do sítio, e o nordeste inteiro da
// cúpula virou água — 20,5 dos 23,3 km² num corpo só. A cidade para de fingir
// que aquilo é acidente e passa a ter FRENTE PARA A ÁGUA.
//
// ⚠️ E SÓ A BAÍA GANHA CAIS. As outras 19 crateras continuam margem natural, com
// a faixa de praia. A regra é legível de longe: água grande é urbana, poça é
// paisagem. Sem isso, 19 lagoas de 300 m ganhariam muro de arrimo e a cidade
// leria como um parque de concreto.
const ORLA_ALTURA = 2.2        // o passeio acima da lâmina: um cais, não uma praia
const ORLA_PE     = 3.5        // quanto o muro desce dentro d'água
const ORLA_PASSEIO = 26.0      // largura do passeio
const ORLA_PISTA  = 14.0       // a faixa de rolamento atrás dele
const ORLA_TALUDE = 12.0       // onde a orla encontra o chão de verdade

// ═══════════════════════════════════════════════════════════════════════════
// PONTE OU DESVIO: O CORTE ENTRE OS DOIS, E ELE FOI MEDIDO
//
// ⚠️ FUNDADOR, 03/09: "existem locais onde a estrada passa por cima de lagos,
// inclusive formando quarteirão sobre o lago. Temos que selecionar onde precisa
// de ponte e onde a rua deve se adaptar ao terreno e fazer curva."
//
// Antes daqui existiam DUAS respostas e nenhuma escolha. A baía era cortada por
// `naBaia` em vias.ts, e TODO o resto da água virava viaduto automático: a via
// era assentada em `cotaVia = max(terreno, lâmina + gabarito)` e seguia reta por
// cima. Medido na superfície como construída (grade de 1.400², célula 10,3 m):
// dos 1.342,8 km da teia, 214,9 km caíam sobre água; 194,7 eram a baía (esses o
// corte já pegava) e sobravam 20,8 km em 168 arestas sobre 25 corpos, desenhados.
// Cinco lagos levavam 15,15 km disso, com a grade fechando quarteirão inteiro em
// cima da lâmina.
//
// ⚠️ O CRITÉRIO É O VÃO QUE A VIA TERIA DE CRUZAR, NÃO A ÁREA DO CORPO. Área não
// decide nada aqui: uma lagoa comprida e estreita de 30 ha se atravessa em 80 m e
// merece ponte; uma redonda de 18 ha pede 239 m e não merece. O que decide é o
// vão, porque é ele que separa "ponte" de "estrada desenhada por cima da água".
//
// ⚠️ E 150 m NÃO É NÚMERO REDONDO, É UM VÃO NA DISTRIBUIÇÃO. Varri a teia inteira
// contra os corpos rotulados e ordenei pelo maior vão de cada um:
//
//   298 · 298 · 298 · 239 · 239 · 239 · 231 · 190 · 180 · 169 · 165 | 123 · 115 ·
//   110 · 110 · 92 · 87 · 79 · 78 · 78 · 67 · 55 · 42 · 18 · 12 · 12 · 6 · 6
//
// Entre 165 e 123 há um buraco de 42 m e nenhum corpo dentro dele. Cortar em 150
// cai no meio desse buraco: mexer o limiar de 130 a 164 não muda um único corpo
// de lado, que é a prova de que a linha não é gosto. Sai em 10 corpos que
// empurram a malha (mais a baía, que empurra sempre) e 17 que ganham ponte, com
// a maior ponte medindo 123 m — vão de viaduto urbano comum para uma rua de 12 m.
export const LIMIAR_PONTE = 150

// ═══════════════════════════════════════════════════════════════════════════
// A MARGEM DE AREIA, VERSÃO `look2`. O caminho velho continua inteiro embaixo do
// `if (look2)`: em `?look=1` nada aqui é lido.
//
// ⚠️ O DEFEITO QUE ISTO CONSERTA, nas palavras do fundador (01/09): "em alguns
// lugares adicionamos areia nas bordas da baía e dos canais e acho que é o que
// tem de pior no mapa ainda". Medido na chapa antes de mexer, e são quatro
// defeitos empilhados num quadrilátero só por aresta de corte:
//
//  1. LARGURA CONSTANTE de 12 m. Praia de verdade não tem largura própria: ela é
//     a projeção horizontal de uma subida pequena. Encosta de 2% dá 75 m de
//     areia, encosta de 50% não dá areia nenhuma. Fita de largura fixa é a
//     assinatura mais legível de "isto foi gerado por laço".
//  2. ARESTA DURA DOS DOIS LADOS. O quadrilátero ia de −40,4 (dentro d'água por
//     40 cm) a −38,8, e do lado seco simplesmente ACABAVA, cortando o regolito
//     numa linha reta.
//  3. PRATELEIRA. Medido: o lado seco ficava a L + 1,2 m, uma cota FIXA que não
//     tem relação com o chão embaixo dela. Onde o terreno subia devagar, a faixa
//     pairava; onde subia rápido, ela enterrava. Lia como bandeja apoiada.
//  4. EM MANCHAS. A areia saía por ARESTA solta, cada uma com a normal dela: nas
//     curvas os quadriláteros abriam em leque e se sobrepunham, e onde a corrente
//     do cais era descartada (menos de 300 m) a margem ficava com buraco, sem cais
//     E sem praia. É o mesmo defeito do leque que a orla da baía já tinha
//     consertado encadeando, e que a praia nunca recebeu.
const PRAIA_SUBIDA = 1.5       // a subida que a areia acompanha; a largura sai daí
// ⚠️ DUAS SONDAS, E A MAIS ÍNGREME MANDA. Com uma sonda só, uma margem de
// cratera redonda devolvia a MESMA largura em toda a volta e a praia voltava a
// ler como fita, só que curva. Medir perto (6 m) e longe (16 m) e ficar com a
// encosta maior faz a largura respirar com o terreno de verdade, sem hash e sem
// ruído inventado: onde a subida começa mais cedo, a areia acaba mais cedo.
const PRAIA_SONDA  = 6.0       // a sonda curta, em metros
const PRAIA_SONDA2 = 16.0      // a sonda longa
const PRAIA_MAX    = 18.0      // teto: acima disso não é praia, é planície molhada
const PRAIA_MIN    = 2.5       // abaixo disso a água encosta na rocha, e é o certo
const PRAIA_FUNDO  = 0.9       // quanto a areia molhada mergulha sob a lâmina
const PRAIA_ALISA  = 6         // passadas do filtro de largura ao longo da margem
// ⚠️ A BERMA: A PRAIA DEIXOU DE SER UMA RAMPA SÓ, e é o segundo defeito que o
// fundador nomeou ("a areia parece pista de skate"). Mesmo com a normal certa,
// o perfil transversal era UM segmento reto da linha d'água até o chão seco:
// curvatura constante, sem quebra, e a mesma quebra em toda a costa. Praia real
// tem antepraia íngreme, uma CRISTA de berma, e um pós-praia quase plano atrás.
//
// A crista entra como estação intermediária, e as duas coisas que a definem
// variam ao longo da costa em ondas de comprimento DIFERENTE da largura (70 m),
// senão a berma só copiaria a modulação da largura e a fita voltaria a ser fita:
//   posição  em 135 m de onda, entre 45% e 70% da largura
//   altura   em 190 m de onda, escalada pela largura da praia ali
// ⚠️ E A CRISTA POUSA NO CHÃO, NÃO NA CORDA. Medido: a corda reta da linha
// d'água ao chão seco ficava ENTERRADA no regolito em 10,4% das amostras (pior
// caso 1,79 m), porque o terreno entre as duas pontas é convexo. Amostrando o
// chão TAMBÉM na crista, a mesma medição cai para 1,5%.
const PRAIA_BERMA_F0 = 0.45    // a crista mais para a água
const PRAIA_BERMA_F1 = 0.25    // quanto ela pode recuar (fração da largura)
const PRAIA_BERMA_H  = 0.60    // altura da crista numa praia de largura cheia
const PRAIA_BERMA_H0 = 0.22    // o mínimo, para a praia estreita ainda ter quebra
// ⚠️ PONTA DE CORRENTE ABERTA MOSTRA A SEÇÃO. Medido: 98 pontas abertas na
// praia (a `semMargem` da boca do canal e a troca de corpo entre cratera e baía
// cortam a corrente), TODAS com alfa 1, ou seja a fita acabava numa parede de
// areia em pé, virada para quem navega. O cais já tinha tampa; a praia não.
// Aqui ela não ganha tampa, ganha SUMIÇO: a largura afina a zero nos últimos
// vértices e o alfa apaga sozinho, que é o que uma praia faz ao encontrar rocha.
const PRAIA_PONTA = 4          // vértices de afinamento em cada ponta aberta
// ⚠️ CORRENTE DE UM SEGMENTO SÓ NÃO É PRAIA, É MANCHA, e este é o cinto do
// conserto de `encadear` (ver a nota lá). Com o estilhaçamento, 1.032 das 1.186
// correntes de margem tinham UM ÚNICO segmento de 30 m: cada uma virava um
// quadrilátero solto de areia com aresta dura nos quatro lados, que é o defeito
// das "manchas". Com o encadeamento certo sobram 15, e o corte de 90 m tira
// essas 15 mais 6 outras.
// ⚠️ O AFINAMENTO DE PONTA NÃO SALVA CORRENTE DE 2 VÉRTICES: com m = 2 não há
// vértice do meio para segurar largura, então ou ela some ou ela é uma parede.
// Por isso o corte fica, mesmo valendo pouco agora. O cais tem o mesmo, em 300 m.
const PRAIA_CORRENTE = 90      // metros mínimos para uma corrente virar praia
// A cor da areia vira COR POR VÉRTICE, porque a transição dos dois lados é uma
// RAMPA e rampa não cabe num `color` de material. O albedo da textura é
// descartado de propósito (ver a montagem): cor por vértice MULTIPLICA o mapa, e
// areia clara sobre albedo de regolito daria um cinza sujo.
// ⚠️ OS DOIS VALORES SÃO MEDIDOS CONTRA O CHÃO VESTIDO, não contra o hex do
// regolito. Na primeira chapa a areia saiu em creme #9A9078 e leu como glacê: o
// regolito de `look2` tem textura e cai perto de #6B6459 na tela, e areia dois
// passos mais clara que o chão vira anel de bolo. Aqui ela fica UM passo acima.
// ⚠️ E NÃO EXISTE COR DE FUSÃO. Existia (#6B6459, tirada da chapa) e era o erro:
// ver a nota do alfa, adiante. Cor fixa não funde com chão texturado.
const AREIA_MOLHADA = '#463F33' // a franja que a água lambe: escura e sem brilho
const AREIA_SECA    = '#847A66' // o corpo da praia, um passo acima do regolito

export function buildLagos(o: LagosOpts): Lagos {
  const group = new THREE.Group()
  group.name = 'lagos'
  const L = o.cota
  const passo = o.passo ?? 30
  const R = o.raio
  const n = Math.ceil((R * 2) / passo)

  // ⚠️ A ALTURA É AMOSTRADA UMA VEZ SÓ. `superficieAt` interpola a malha do
  // terreno e não é barata; chamá-la dentro do laço dos casos multiplicaria por
  // quatro. A grade inteira sai antes, e os casos só leem.
  const alt = new Float32Array((n + 1) * (n + 1))
  const px = (i: number) => -R + i * passo
  for (let j = 0; j <= n; j++) {
    for (let i = 0; i <= n; i++) {
      const x = px(i), z = px(j)
      // fora da casca não há água: a cidade acaba ali
      alt[j * (n + 1) + i] = (Math.hypot(x, z) > R - 40 || (o.foraDe && o.foraDe(x, z)))
        ? 1e6 : o.superficieAt(x, z)
    }
  }
  const A = (i: number, j: number) => alt[j * (n + 1) + i]

  // ⚠️ QUAL DOS CORPOS É A BAÍA se decide MEDINDO, não por caixa de coordenadas.
  // A tentação é "tudo a nordeste é baía": o sítio muda quando o heightmap muda,
  // e a regra amarrada em rumo já mentiu uma vez nesta cidade. Aqui os corpos são
  // rotulados por preenchimento e o MAIOR é a baía — 20,5 dos 23,3 km², sem
  // segundo lugar próximo (o seguinte tem 0,4).
  const rot = new Int32Array((n + 1) * (n + 1)).fill(-1)
  const tam: number[] = []
  const pilha: number[] = []
  for (let p0 = 0; p0 < rot.length; p0++) {
    if (rot[p0] >= 0 || alt[p0] >= L) continue
    const id = tam.length
    let cont = 0
    pilha.length = 0; pilha.push(p0); rot[p0] = id
    while (pilha.length) {
      const q = pilha.pop() as number
      cont++
      const qi = q % (n + 1), qj = (q / (n + 1)) | 0
      if (qi > 0) { const v = q - 1; if (rot[v] < 0 && alt[v] < L) { rot[v] = id; pilha.push(v) } }
      if (qi < n) { const v = q + 1; if (rot[v] < 0 && alt[v] < L) { rot[v] = id; pilha.push(v) } }
      if (qj > 0) { const v = q - (n + 1); if (rot[v] < 0 && alt[v] < L) { rot[v] = id; pilha.push(v) } }
      if (qj < n) { const v = q + (n + 1); if (rot[v] < 0 && alt[v] < L) { rot[v] = id; pilha.push(v) } }
    }
    tam.push(cont)
  }
  // ⚠️ A BAÍA É QUEM CONTÉM O PONTO PUBLICADO, não quem é maior. Ver `baiaEm`.
  // O maior corpo continua sendo a queda: sem a consulta, o comportamento antigo.
  let baia = -1
  if (o.baiaEm) {
    const [bx, bz] = o.baiaEm
    const bi = Math.round((bx + R) / passo), bj = Math.round((bz + R) / passo)
    if (bi >= 0 && bi <= n && bj >= 0 && bj <= n) baia = rot[bj * (n + 1) + bi]
  }
  if (baia < 0) {
    if (o.baiaEm) console.warn('[lagos] o ponto da baía publicado caiu fora da água; elegendo por tamanho')
    for (let k = 0; k < tam.length; k++) if (baia < 0 || tam[k] > tam[baia]) baia = k
  }

  // ── QUEM EMPURRA A MALHA E QUEM GANHA PONTE ───────────────────────────────
  //
  // ⚠️ A CLASSIFICAÇÃO SE MEDE CONTRA A TEIA, aqui, no boot, e não é uma lista
  // escrita à mão. Escrever "os lagos 7, 22, 23, 31 e 34 desviam" seria uma
  // tabela que mente no dia seguinte: o rótulo do corpo vem de preenchimento e
  // muda se o heightmap, a cota ou o pódio mudarem, e o vão muda se `teia.ts`
  // mudar o passo dos anéis. Varrendo a teia contra os corpos rotulados, a
  // classificação se refaz sozinha nos dois casos. Ver `LIMIAR_PONTE` para o
  // porquê do número.
  //
  // ⚠️ CUSTO: 1.342,8 km de teia amostrados de 6 em 6 m são ~224 mil consultas a
  // um Int32Array já construído. É custo de boot, uma vez, na mesma ordem do
  // preenchimento que acabou de rodar acima.
  const corpoNo = (x: number, z: number): number => {
    const i = Math.round((x + R) / passo), j = Math.round((z + R) / passo)
    if (i < 0 || j < 0 || i > n || j > n) return -1
    return rot[j * (n + 1) + i]
  }
  const vaoMax = new Float64Array(tam.length)
  {
    const AMOSTRA = 6
    /** o maior trecho CONTÍGUO dentro de cada corpo, ao longo de um eixo */
    const varrer = (
      x0: number, z0: number, x1: number, z1: number,
      arco: { r: number; a0: number; a1: number } | null,
    ) => {
      const comp = arco ? arco.r * Math.abs(arco.a1 - arco.a0) : Math.hypot(x1 - x0, z1 - z0)
      const k = Math.max(1, Math.ceil(comp / AMOSTRA))
      const dm = comp / k
      // ⚠️ O RUN SE FECHA NA TROCA DE CORPO, INCLUSIVE PARA A TERRA (-1). Uma
      // aresta que entra num lago, sai numa ilha e volta a entrar tem DOIS vãos,
      // não um: somar os dois daria a um lago com ilha no meio um vão que a via
      // nunca precisa cruzar, e ele seria classificado como desvio sem merecer.
      let atual = -1, acum = 0
      for (let t = 0; t < k; t++) {
        const u = (t + 0.5) / k
        let cx: number, cz: number
        if (arco) {
          const a = arco.a0 + (arco.a1 - arco.a0) * u
          cx = Math.cos(a) * arco.r; cz = Math.sin(a) * arco.r
        } else {
          cx = x0 + (x1 - x0) * u; cz = z0 + (z1 - z0) * u
        }
        const c = corpoNo(cx, cz)
        if (c === atual) { acum += dm; continue }
        if (atual >= 0 && acum > vaoMax[atual]) vaoMax[atual] = acum
        atual = c; acum = c >= 0 ? dm : 0
      }
      if (atual >= 0 && acum > vaoMax[atual]) vaoMax[atual] = acum
    }
    // os arcos, entre radiais vizinhos ATIVOS naquele raio
    for (const rr of ANEIS) {
      const p = passoNoRaio(rr)
      for (let i = 0; i < N_RAD; i += p) {
        varrer(0, 0, 0, 0, { r: rr, a0: anguloDe(i), a1: anguloDe(i + p) })
      }
    }
    // os trechos radiais, de anel a anel, a partir do raio em que cada um nasce
    for (let i = 0; i < N_RAD; i++) {
      const r0n = nasceEm(i)
      if (r0n === null) continue
      const a = anguloDe(i), ca = Math.cos(a), sa = Math.sin(a)
      for (let k = 0; k + 1 < ANEIS.length; k++) {
        if (ANEIS[k] < r0n - 1) continue
        varrer(ANEIS[k] * ca, ANEIS[k] * sa, ANEIS[k + 1] * ca, ANEIS[k + 1] * sa, null)
      }
    }
  }
  /** o corpo empurra a malha para o lado, em vez de receber ponte */
  const empurra = new Uint8Array(tam.length)
  for (let k = 0; k < tam.length; k++) if (vaoMax[k] > LIMIAR_PONTE) empurra[k] = 1
  // ⚠️ A BAÍA EMPURRA SEMPRE, e não por medição. Ela é a frente da cidade, tem
  // orla construída e o fundador decidiu em 03/09 que ela não recebe travessia
  // nenhuma: "não podemos construir uma ponte monumento na baía, dentro dela
  // haverão algumas ilhas com mansões". Uma ponte de 1 km passaria por cima
  // dessas ilhas. Se um dia a teia mal a tocar, ela continua empurrando.
  if (baia >= 0) empurra[baia] = 1

  const bloqueiaMalha = (x: number, z: number): boolean => {
    const c = corpoNo(x, z)
    return c >= 0 && empurra[c] === 1
  }

  const posA: number[] = [], idxA: number[] = []      // a lâmina
  const posP: number[] = [], idxP: number[] = []      // a praia das crateras
  const posM: number[] = [], idxM: number[] = []      // muro de arrimo e talude
  const posC: number[] = [], idxC: number[] = []      // o passeio da orla
  const posR: number[] = [], idxR: number[] = []      // a faixa de rolamento
  const segs: number[] = []                          // (ax,az,bx,bz) da orla da baía
  const segsP: number[] = []                         // (ax,az,bx,bz) da margem de praia (look2)
  // ⚠️ A LINHA D'ÁGUA DOS CORPOS QUE EMPURRAM A MALHA, e ela é coletada aqui
  // porque é aqui que ela existe: `vias.ts` não tem contorno de lago nenhum, só
  // consultas por ponto. Sem esta lista a rua saberia PARAR na margem e não teria
  // como CORRER ao longo dela, que é a metade que o fundador pediu ("a rua deve
  // se adaptar ao terreno e fazer curva"). A baía fica de fora: ela já tem a
  // própria pista dentro da orla construída (`ORLA_PISTA`).
  const segsD: number[] = []                         // (ax,az,bx,bz) da margem de desvio
  const corP: number[] = []                          // cor por vértice da praia (look2)
  const uvP: number[] = []                           // uv em LADRILHOS de mundo (look2)
  let area = 0

  /** o ponto onde o chão cruza a lâmina, entre dois cantos */
  const corta = (xa: number, za: number, ya: number, xb: number, zb: number, yb: number) => {
    const t = Math.abs(yb - ya) < 1e-6 ? 0.5 : (L - ya) / (yb - ya)
    const k = Math.min(1, Math.max(0, t))
    return [xa + (xb - xa) * k, za + (zb - za) * k] as [number, number]
  }

  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x0 = px(i), x1 = px(i + 1), z0 = px(j), z1 = px(j + 1)
      const y0 = A(i, j), y1 = A(i + 1, j), y2 = A(i + 1, j + 1), y3 = A(i, j + 1)
      const c = (y0 < L ? 1 : 0) | (y1 < L ? 2 : 0) | (y2 < L ? 4 : 0) | (y3 < L ? 8 : 0)
      if (c === 0) continue
      const caso = CASOS[c]
      if (!caso.length) continue
      // os oito pontos: 0..3 cantos, 4..7 meios de aresta interpolados
      const P: [number, number][] = [
        [x0, z0], [x1, z0], [x1, z1], [x0, z1],
        corta(x0, z0, y0, x1, z0, y1),
        corta(x1, z0, y1, x1, z1, y2),
        corta(x1, z1, y2, x0, z1, y3),
        corta(x0, z1, y3, x0, z0, y0),
      ]
      const base = posA.length / 3
      for (const k of caso) { posA.push(P[k][0], L, P[k][1]) }
      for (let k = 1; k < caso.length - 1; k++) idxA.push(base, base + k, base + k + 1)
      // área da parte molhada, por shoelace
      let s = 0
      for (let k = 0; k < caso.length; k++) {
        const a = P[caso[k]], b = P[caso[(k + 1) % caso.length]]
        s += a[0] * b[1] - b[0] * a[1]
      }
      area += Math.abs(s) / 2

      // ⚠️ A MARGEM SE ACABA NA ARESTA CORTADA, e sem isso a água encosta no
      // regolito cru — foi o que o fundador viu como "margem faltando
      // acabamento". Qual acabamento depende do CORPO: a baía recebe cais e
      // passeio (é a frente da cidade), a cratera recebe praia (é paisagem).
      // ⚠️ A MARGEM PODE SER SUPRIMIDA SEM QUE A ÁGUA SEJA. Ver `semMargem`: na
      // boca do canal a lâmina entra, mas o cais da baía não pode cruzar, porque
      // o canal já tem o dele.
      // ⚠️ NA BORDA DA CASCA NÃO SE CONSTRÓI MARGEM, SÓ ÁGUA. Fora do raio a
      // grade guarda o sentinela 1e6, e a interpolação de `corta` entre −45 e
      // 1e6 dá t ≈ 5e−5: o corte SNAPA no canto molhado da grade. O resultado
      // não é curva de nível, é escada de 30 m.
      // ⚠️ MEDIDO: 1.036 células molhadas encostam no sentinela, TODAS em
      // r 9.000, e elas sozinhas produziam 1.036 das 5.006 arestas de corte da
      // cidade (20,7%). Ou seja um quinto de toda a costa era serra de grade,
      // num anel colado na saia da abóbada. Aqui a água continua (a lâmina não
      // muda), o acabamento é que para: quem fecha ali é a casca.
      const _naBorda = y0 > 1e5 || y1 > 1e5 || y2 > 1e5 || y3 > 1e5
      if (c !== 15 && !_naBorda) {
        const eBaia = rot[j * (n + 1) + i] === baia || rot[j * (n + 1) + i + 1] === baia
          || rot[(j + 1) * (n + 1) + i] === baia || rot[(j + 1) * (n + 1) + i + 1] === baia
        // ⚠️ O RÓTULO DA CÉLULA SAI DO CANTO MOLHADO, não de um canto qualquer.
        // Um canto seco tem rot −1 e `empurra[−1]` não existe; pegar o primeiro
        // canto daria falso para metade das células de margem, que é justamente
        // onde a linha d'água está.
        let _cd = -1
        for (const _q of [j * (n + 1) + i, j * (n + 1) + i + 1,
                          (j + 1) * (n + 1) + i, (j + 1) * (n + 1) + i + 1]) {
          if (rot[_q] >= 0) { _cd = rot[_q]; break }
        }
        const eDesvio = _cd >= 0 && _cd !== baia && empurra[_cd] === 1
        for (let k = 0; k < caso.length; k++) {
          const ia = caso[k], ib = caso[(k + 1) % caso.length]
          if (ia < 4 || ib < 4) continue          // só as arestas de corte
          const a = P[ia], b = P[ib]
          // ⚠️ A MÁSCARA DA BOCA SE MEDE NA ARESTA, E EXIGE AS DUAS PONTAS. Ela
          // era testada em `(_mx, _mz)`, o meio da CÉLULA de 30 m, e a aresta de
          // corte pode estar a até 21 m dali (meia diagonal): a supressão parava
          // fora de hora e a TAMPA do cais nascia fora do corredor de 76 m que o
          // molhe do `canais.ts` cobre, ou seja uma parede de 5,7 m em água
          // aberta ao lado da foz. Medido: 1 das 8 tampas a 85,5 m do eixo do
          // CR03, 9,5 m fora.
          // ⚠️ E É `&&`, NÃO `||`. Com `||` a aresta que atravessa a fronteira
          // também some, então a última aresta guardada COMEÇA fora do corredor e
          // a tampa vai parar mais longe ainda: medido, 5 das 8 tampas fora, pior
          // que o defeito. Com `&&` a aresta que atravessa fica, e a ponta dela
          // cai DENTRO do corredor por construção. Medido depois: 0 de 8 fora.
          if (o.semMargem && o.semMargem(a[0], a[1]) && o.semMargem(b[0], b[1])) continue
          const dx = b[0] - a[0], dz = b[1] - a[1]
          const dl = Math.hypot(dx, dz) || 1
          // ⚠️ A NORMAL APONTAVA PARA DENTRO DA ÁGUA, E ERA A RAIZ DA MARGEM
          // DEFORMADA. `CASOS` lista o polígono MOLHADO com winding tal que
          // (−dz, dx) é a normal INTERNA: conferido nos 16 casos numa célula
          // unitária, 14 dos 16 apontavam para o miolo molhado (os 2 restantes
          // são as selas, onde o teste do centroide não vale).
          //
          // ⚠️ MEDIDO NO TERRENO DE VERDADE, 5.006 arestas de corte da cidade:
          // sondando 12 m no sentido que o código chamava de "seco", 99,5% caíam
          // ABAIXO da lâmina, com mediana 2,28 m debaixo d'água; no sentido
          // oposto a mediana era 1,17 m ACIMA. Em 4.398 das 5.006 arestas o lado
          // certo era o outro.
          //
          // O estrago era o produto inteiro: a sonda de inclinação da praia lia
          // fundo de lago, devolvia declive 0, e a largura ia ao teto em 73,8%
          // dos vértices. A praia que o fundador chamou de "pista de skate" era
          // literalmente uma fita de 18 m de largura constante deitada DENTRO
          // d'água, com a franja molhada enterrada 0,9 m na terra firme.
          // Depois do sinal certo: declive mediano 8,6%, largura de 2,6 a 20,1 m
          // e só 36,0% no teto.
          const nx = dz / dl, nz = -dx / dl
          if (eDesvio) segsD.push(a[0], a[1], b[0], b[1])
          if (!eBaia) {
            // ⚠️ EM `look2` A PRAIA TAMBÉM SÓ SE COLETA. Ver o bloco de constantes:
            // emitir por aresta é o defeito do leque, e a praia estava emitindo
            // por aresta desde sempre. Aqui ela entra na mesma máquina de
            // corrente que a orla da baía já usava.
            if (look2) { segsP.push(a[0], a[1], b[0], b[1]); continue }
            const fora = 12
            const bp = posP.length / 3
            posP.push(a[0], L - 0.4, a[1])
            posP.push(b[0], L - 0.4, b[1])
            posP.push(b[0] + nx * fora, L + 1.2, b[1] + nz * fora)
            posP.push(a[0] + nx * fora, L + 1.2, a[1] + nz * fora)
            idxP.push(bp, bp + 1, bp + 2, bp, bp + 2, bp + 3)
            continue
          }
          // ⚠️ A ORLA NÃO SE EMITE AQUI, SÓ SE COLETA. Emitir por aresta foi a
          // primeira versão e o defeito apareceu na chapa de perto: cada aresta
          // calculava a própria normal e nas curvas elas DIVERGEM, então os
          // painéis abriam em leque para fora da margem. Extrusão de 52 m sobre
          // grade de 30 m: a quina erra quase duas células. Aqui o contorno vira
          // corrente e a normal passa a ser do VÉRTICE, com esquadria.
          segs.push(a[0], a[1], b[0], b[1])
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // A ORLA: os segmentos viram CORRENTE, e a normal vira do vértice.
  //
  // ⚠️ ISTO É O CONSERTO DO LEQUE. Marching squares devolve segmentos soltos; a
  // versão anterior extrudia cada um pela própria normal e nas curvas os painéis
  // abriam em leque, com respingo de cais espalhado pela água aberta. Encadear
  // resolve os dois: a normal de cada VÉRTICE é a média das duas arestas que
  // chegam nele (esquadria), então painéis vizinhos compartilham a aresta e não
  // existe nem vão nem sobreposição.
  //
  // ⚠️ E CORRENTE CURTA SE JOGA FORA. Os respingos na água aberta eram ilhotas
  // de UMA célula seca dentro da baía: contorno de 3 ou 4 segmentos, 60 m de
  // perímetro, que viravam uma florzinha de cais no meio do lago. O gerador já
  // descarta corpo d'água com menos de 3 ha pelo mesmo motivo; aqui o corte é
  // por número de segmentos.
  // ⚠️ ENCADEAR VIROU FUNÇÃO porque a PRAIA precisa da mesma máquina. Ela era o
  // único acabamento de margem que ainda saía por aresta solta, e por isso era o
  // único que ainda abria em leque nas curvas. Uma máquina só para os dois.
  const encadear = (src: number[]): { pts: number[]; comp: number }[] => {
    const CHAVE = (x: number, z: number) => `${Math.round(x * 100)},${Math.round(z * 100)}`
    const daPonta = new Map<string, number[]>()
    for (let k = 0; k < src.length; k += 4) {
      const ch = CHAVE(src[k], src[k + 1])
      const l = daPonta.get(ch); if (l) l.push(k); else daPonta.set(ch, [k])
    }
    const usado = new Uint8Array(src.length / 4)
    const correntes: { pts: number[]; comp: number }[] = []
    // ⚠️⚠️ AS PONTAS ANDAM PRIMEIRO, E ISTO ERA A MARGEM DEFORMADA INTEIRA.
    //
    // A varredura era `for k0 in ordem de índice`, e o índice é a ordem das
    // CÉLULAS da grade, não a ordem do contorno. Entrar num contorno pelo meio
    // consome só o pedaço da frente; o pedaço de trás é encontrado depois, anda
    // um passo, esbarra no que já foi usado e vira corrente própria. O processo
    // se repete e o contorno se estilhaça de trás para frente.
    //
    // ⚠️ MEDIDO na baía de verdade, 1.826 segmentos: a topologia tem 23 caminhos
    // e 7 ciclos, ou seja 30 correntes. `encadear` devolvia 345, com 279 delas de
    // UM ÚNICO segmento de 30 m. Consequência direta na tela: uma corrente de 2
    // vértices não passa por `alisaContorno` (ele desiste com m < 4), tira as
    // duas normais da mesma aresta e vira um retalho de cais ou de areia com
    // aresta dura nos quatro lados, virado para um rumo qualquer. E o corte de
    // 300 m recusava quase tudo.
    // ⚠️ O QUE ISSO CUSTAVA EM PRODUTO, medido: a orla CONSTRUÍDA da baía tinha
    // 13 pedaços e 32,8 km. Com as pontas primeiro são 7 pedaços e 42,0 km. São
    // 9,2 km de frente d'água contínua que existiam no terreno e não chegavam à
    // tela, porque a corrente que os carregava tinha sido picada abaixo do corte
    // de 300 m. As correntes de praia caem de 841 para 31 pelo mesmo motivo.
    //
    // O conserto é o de sempre para grafo 1-entra-1-sai: começar pelos segmentos
    // SEM PREDECESSOR (as pontas de caminho aberto) e só depois varrer o resto,
    // que aí só pode ser ciclo. Não muda o resultado de um contorno fechado.
    const NS = src.length / 4
    const temPred = new Uint8Array(NS)
    for (let k = 0; k < src.length; k += 4) {
      const l = daPonta.get(CHAVE(src[k + 2], src[k + 3]))
      if (l) for (const q of l) temPred[q / 4] = 1
    }
    const ordem: number[] = []
    for (let s = 0; s < NS; s++) if (!temPred[s]) ordem.push(s * 4)
    for (let s = 0; s < NS; s++) if (temPred[s]) ordem.push(s * 4)
    for (const k0 of ordem) {
      if (usado[k0 / 4]) continue
      const pts: number[] = [src[k0], src[k0 + 1]]
      let k = k0
      // ⚠️ O TETO DO LAÇO NÃO É ENFEITE: uma corrente mal formada (ponta que
      // aponta para si mesma por arredondamento) faria laço infinito e a página
      // congelaria sem erro nenhum no console.
      for (let guarda = 0; guarda < src.length / 4 + 2; guarda++) {
        usado[k / 4] = 1
        pts.push(src[k + 2], src[k + 3])
        const seg = daPonta.get(CHAVE(src[k + 2], src[k + 3]))
        const prox = seg && seg.find((q) => !usado[q / 4])
        if (prox === undefined) break
        k = prox
      }
      // ⚠️ O CORTE É POR COMPRIMENTO, NÃO POR NÚMERO DE SEGMENTOS. Contar
      // segmentos deixou passar o defeito seguinte: BAIXIOS. Onde o leito da
      // baía raspa a cota, o contorno serpenteia em dezenas de fatias de 2 m e
      // some no teste de contagem — na chapa isso vira um rastro pontilhado
      // atravessando a água aberta, que foi exatamente o que sobrou depois de o
      // leque ser consertado. 300 m é a menor coisa que merece cais: menos que
      // isso é banco de areia, e banco de areia não tem passeio.
      let comp = 0
      for (let q = 0; q + 3 < pts.length; q += 2) {
        comp += Math.hypot(pts[q + 2] - pts[q], pts[q + 3] - pts[q + 1])
      }
      correntes.push({ pts, comp })
    }
    return correntes
  }

  /** a normal de cada VÉRTICE, média das duas arestas que chegam nele, com
   *  esquadria limitada. Saiu do laço da orla para a praia usar a mesma. */
  const normais = (pts: number[], limite = 2.5) => {
    const m = pts.length / 2
    const fechada = Math.hypot(pts[0] - pts[2 * m - 2], pts[1] - pts[2 * m - 1]) < 0.01
    const NX = new Float64Array(m), NZ = new Float64Array(m)
    const eN = (k: number) => {
      const dx = pts[2 * k + 2] - pts[2 * k], dz = pts[2 * k + 3] - pts[2 * k + 1]
      const dl = Math.hypot(dx, dz) || 1
      // ⚠️ MESMO SINAL DO LAÇO ACIMA, e pelo mesmo motivo medido: para o winding
      // de `CASOS` a normal externa é (dz, −dx). Se as duas divergirem, o cais
      // sai para um lado e a praia para o outro.
      return [dz / dl, -dx / dl] as [number, number]
    }
    for (let k = 0; k < m; k++) {
      const ant = k > 0 ? eN(k - 1) : (fechada ? eN(m - 2) : eN(0))
      const pro = k < m - 1 ? eN(k) : (fechada ? eN(0) : eN(m - 2))
      let ax = ant[0] + pro[0], az = ant[1] + pro[1]
      const al = Math.hypot(ax, az) || 1
      ax /= al; az /= al
      // ⚠️ O FATOR DE ESQUADRIA SE LIMITA. Numa quina de quase 180° o
      // comprimento de esquadria vai ao infinito e a margem dispararia num
      // espeto, que é a MESMA aparência do defeito que ele veio consertar.
      const f = Math.min(limite, 1 / Math.max(0.4, ax * ant[0] + az * ant[1]))
      NX[k] = ax * f; NZ[k] = az * f
    }
    return { m, fechada, NX, NZ }
  }

  /** ⚠️ ALISA O CONTORNO, e é o conserto da ARESTA FACETADA da areia.
   *
   *  O contorno do marching squares é feito de cordas de uma grade de 30 m: nas
   *  quinas a direção da margem vira 90 graus de um vértice para o outro, e a
   *  normal de esquadria vira junto. Numa faixa larga isso faz duas coisas, e as
   *  duas apareceram na chapa: a borda de fora desenha uma ESCADA, e os painéis
   *  vizinhos se SOBREPÕEM por dentro da quina côncava. Sobreposição em material
   *  opaco não se vê; em material transparente, que é o que a areia virou para
   *  poder sumir no chão, ela soma alfa duas vezes e a quina acende. Era isso o
   *  "cantos retos e segmentos visíveis contra o chão".
   *
   *  ⚠️ E O DESVIO SE LIMITA A 4 m. Alisar sem trava afasta a areia da água e
   *  abre fresta entre as duas. A franja molhada entra de 2 a 6,5 m para dentro
   *  da lâmina, então 4 m de desvio continuam cobertos por ela.
   *  A ÁGUA NÃO É ALISADA: ela é a mesma malha do lago e não pode divergir da
   *  cota nem do contorno que as consultas `naAgua` e `naBaia` usam. */
  const alisaContorno = (pts: number[], passadas = 2, teto = 4) => {
    const m = pts.length / 2
    if (m < 4) return pts
    const orig = pts
    const cur = pts.slice()
    // ⚠️ CORRENTE FECHADA TAMBÉM ALISA NA EMENDA. Deixar o primeiro e o último
    // parados (eles são o MESMO ponto) guardaria uma quina não alisada por lago,
    // e uma quina só numa margem lisa é justamente o que o olho acha.
    const fech = Math.hypot(pts[0] - pts[2 * m - 2], pts[1] - pts[2 * m - 1]) < 0.01
    for (let p = 0; p < passadas; p++) {
      const T = cur.slice()
      for (let k = 1; k < m - 1; k++) {
        cur[2 * k] = T[2 * k] * 0.5 + (T[2 * k - 2] + T[2 * k + 2]) * 0.25
        cur[2 * k + 1] = T[2 * k + 1] * 0.5 + (T[2 * k - 1] + T[2 * k + 3]) * 0.25
      }
      if (fech) {
        cur[0] = T[0] * 0.5 + (T[2 * m - 4] + T[2]) * 0.25
        cur[1] = T[1] * 0.5 + (T[2 * m - 3] + T[3]) * 0.25
        cur[2 * m - 2] = cur[0]; cur[2 * m - 1] = cur[1]
      }
    }
    for (let k = 0; k < m; k++) {
      const dx = cur[2 * k] - orig[2 * k], dz = cur[2 * k + 1] - orig[2 * k + 1]
      const d = Math.hypot(dx, dz)
      if (d > teto) {
        cur[2 * k] = orig[2 * k] + (dx / d) * teto
        cur[2 * k + 1] = orig[2 * k + 1] + (dz / d) * teto
      }
    }
    return cur
  }

  // ═══════════════════════════════════════════════════════════════════════
  // A VIA DE ORLA: o eixo que a rua vai seguir na margem dos lagos de desvio.
  //
  // ⚠️ ESTE MÓDULO NÃO DESENHA A RUA, SÓ DIZ POR ONDE ELA PASSA. Quem tem seção,
  // meio-fio, calçada e material é `vias.ts`; quem tem contorno de lago é aqui. A
  // divisa entre os dois é esta lista de eixos, e ela existe para não haver uma
  // segunda máquina de traçar margem dentro do módulo de rua.
  //
  // ⚠️ E O EIXO É RECUADO, NÃO A LINHA D'ÁGUA. `RECUO_ORLA` põe a rua ATRÁS da
  // praia: a areia tem largura variável (de `PRAIA_MIN` 2,5 a `PRAIA_MAX` 18 m,
  // porque ela é a projeção da subida do terreno, não uma fita), então recuar
  // pelo TETO é o único valor que nunca põe asfalto em cima de areia. Onde a
  // praia é estreita sobra regolito entre a areia e a guia, e isso é o acostamento
  // que uma estrada de beira de lago tem de verdade. Recuar pela largura MÉDIA
  // faria a pista invadir a areia justamente nas enseadas, que é onde ela mais
  // se vê.
  //
  // ⚠️ E O RECUO É PELA NORMAL DO VÉRTICE, com a mesma esquadria da orla e da
  // praia. Recuar cada aresta pela normal DELA é o defeito do leque outra vez, e
  // ele é pior aqui: a orla erra o acabamento, a rua erraria a geometria da
  // pista. Uma máquina só para as três coisas.
  const RECUO_ORLA = PRAIA_MAX + 6 + 2
  const orlasDesvio: number[][] = []
  {
    for (const c of encadear(segsD)) {
      // ⚠️ MESMO CORTE DE 300 m DO CAIS, e pelo mesmo motivo: abaixo disso o
      // contorno é baixio ou ilhota de uma célula, e uma estrada em volta de um
      // banco de areia de 60 m é a "florzinha" que a orla da baía já teve.
      if (c.comp < 300 || c.pts.length < 8) continue
      const pts = alisaContorno(c.pts, 3, 6)
      const { m, NX, NZ } = normais(pts, 2.0)
      // ⚠️ O EIXO SE PARTE ONDE O RECUO CAI NA ÁGUA. Num istmo estreito a normal
      // de um lado empurra o ponto para dentro do lago do outro lado, e a rua
      // atravessaria a lâmina — que é exatamente o defeito que este trabalho veio
      // consertar, reintroduzido pela porta dos fundos. Onde isso acontece o eixo
      // simplesmente ACABA e recomeça depois: dois trechos, e a via morre na
      // ponta, como via de verdade morre.
      let atual: number[] = []
      for (let k = 0; k < m; k++) {
        const ex = pts[2 * k] + NX[k] * RECUO_ORLA
        const ez = pts[2 * k + 1] + NZ[k] * RECUO_ORLA
        if (corpoNo(ex, ez) >= 0) {
          if (atual.length >= 8) orlasDesvio.push(atual)
          atual = []
          continue
        }
        atual.push(ex, ez)
      }
      if (atual.length >= 8) orlasDesvio.push(atual)
    }
    let mt = 0
    for (const e of orlasDesvio) {
      for (let k = 0; k + 3 < e.length; k += 2) mt += Math.hypot(e[k + 2] - e[k], e[k + 3] - e[k + 1])
    }
    if (orlasDesvio.length) {
      console.log(`[lagos] via de orla: ${orlasDesvio.length} eixos, ${(mt / 1000).toFixed(2)} km, `
        + `recuados ${RECUO_ORLA} m da linha d'agua`)
    }
  }

  // as correntes de praia: as da margem natural mais, em look2, as da baía que o
  // corte de 300 m recusou (ver o comentário do descarte, adiante)
  const correntesPraia: number[][] = []

  {
    const w1 = ORLA_PASSEIO
    const w2 = w1 + ORLA_PISTA
    const w3 = w2 + ORLA_TALUDE
    const yD = L + ORLA_ALTURA
    for (const c of encadear(segs)) {
      // ⚠️ O CAIS ERA A ÚNICA MARGEM CONSTRUÍDA SOBRE CONTORNO CRU, e é a
      // primeira margem deformada da baía. A praia já passava por `alisaContorno`
      // desde que a lasca foi consertada; a orla não passava por nada. O contorno
      // do marching squares é feito de cordas de uma grade de 30 m: a direção
      // vira 90 graus de um vértice para o outro, e a esquadria de `normais`
      // multiplica isso por até 2,5 numa extrusão de 52 m. Nas quinas côncavas os
      // painéis se cruzam (auto-interseção do passeio), nas convexas o teto de
      // esquadria trunca e abre um entalhe: era o "quina" e o "largura oscilando"
      // ao mesmo tempo, na mesma peça.
      // ⚠️ E O TETO DE DESVIO AQUI É 1,5 m E NÃO 4. Alisar o contorno afasta o
      // muro da lâmina, e a lâmina NÃO é alisada (ela é a malha que `naAgua` e
      // `naBaia` consultam): 4 m abririam uma fresta de chão entre a água e o pé
      // do muro. 1,5 m fica coberto pelo pé de muro rebaixado, adiante.
      const pts = alisaContorno(c.pts, 2, 1.5)
      // ⚠️ O DESCARTE DEIXAVA BURACO NA MARGEM, e este é o defeito 4 da lista lá
      // em cima: a corrente curta perdia o cais e não ganhava nada no lugar, então
      // a água encostava no regolito cru em trechos sem motivo legível. Em look2
      // ela cai para a PRAIA, que é o acabamento certo para 300 m de margem.
      if (pts.length < 2 * 6 || c.comp < 300) {
        if (look2 && pts.length >= 2 * 3) correntesPraia.push(pts)
        continue
      }
      const { m, NX, NZ } = normais(pts)
      const px = (k: number, w: number) => pts[2 * k] + NX[k] * w
      const pz = (k: number, w: number) => pts[2 * k + 1] + NZ[k] * w
      // ⚠️ AS PONTAS DE CORRENTE ABERTA PRECISAM DE TAMPA, e são elas a margem
      // deformada da BAÍA. `semMargem` suprime a margem no corredor do canal, o
      // que CORTA a corrente da orla: o que sobra é uma corrente aberta cuja
      // ponta cai na foz. Sem tampa, a seção do cais (muro de 3,5 m sob a água,
      // passeio de 26 m, pista de 14 m) termina no vazio e mostra o miolo oco da
      // laje, virada para quem entra no canal, que é justamente o ângulo de
      // quem navega. São duas pontas por foz. A tampa é honesta: cais de
      // verdade acaba em parede.
      const fech = Math.hypot(pts[0] - pts[2 * m - 2], pts[1] - pts[2 * m - 1]) < 0.01
      if (!fech && m >= 2) {
        for (const kt of [0, m - 1]) {
          const bp = posM.length / 3
          const yb = L - ORLA_PE
          posM.push(px(kt, -1.8), yb, pz(kt, -1.8))
          posM.push(px(kt, w2), yb, pz(kt, w2))
          posM.push(px(kt, w2), yD, pz(kt, w2))
          posM.push(px(kt, 0), yD, pz(kt, 0))
          idxM.push(bp, bp + 1, bp + 2, bp, bp + 2, bp + 3)
        }
      }
      for (let k = 0; k < m - 1; k++) {
        const faixa = (
          wa: number, ya: number, wb: number, yb: number,
          dest: number[], di: number[], chaoB = false,
        ) => {
          const bp = dest.length / 3
          const y0 = chaoB ? Math.max(o.superficieAt(px(k, wb), pz(k, wb)), L + 0.2) : yb
          const y1 = chaoB ? Math.max(o.superficieAt(px(k + 1, wb), pz(k + 1, wb)), L + 0.2) : yb
          dest.push(px(k, wa), ya, pz(k, wa))
          dest.push(px(k + 1, wa), ya, pz(k + 1, wa))
          dest.push(px(k + 1, wb), y1, pz(k + 1, wb))
          dest.push(px(k, wb), y0, pz(k, wb))
          di.push(bp, bp + 1, bp + 2, bp, bp + 2, bp + 3)
        }
        // ⚠️ O MURO GANHOU PÉ, e ele não é estética, é o cinto do alisamento acima:
        // a base sai 1,8 m para DENTRO da lâmina, então mesmo com o contorno
        // deslocado até 1,5 m para a terra nunca abre fresta entre água e muro.
        // De brinde o muro fica escarpado em vez de vertical, que é como muro de
        // arrimo de cais real se apoia.
        faixa(-1.8, L - ORLA_PE, 0, yD, posM, idxM)       // o muro, dentro d'água
        faixa(0, yD, w1, yD, posC, idxC)                  // o passeio
        faixa(w1, yD - 0.15, w2, yD - 0.15, posR, idxR)   // a faixa de rolamento
        faixa(w2, yD, w3, yD, posM, idxM, true)           // o talude encontra o chão
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // A PRAIA (look2): largura tirada da INCLINAÇÃO, e transição dos dois lados.
  //
  // ⚠️ A LARGURA NÃO É UMA CONSTANTE, É UMA CONSEQUÊNCIA. `w = subida /
  // inclinação`: a areia acompanha PRAIA_SUBIDA (1,5 m) de subida do terreno, e
  // onde ela vem, vem. Encosta de 8% dá 18 m de areia; encosta de 60% dá 2,5 m e
  // apaga no álibi da transparência, e é isso que põe a água encostando na
  // rocha, que é o certo.
  //
  // ⚠️ DUAS SONDAS, A MAIS ÍNGREME MANDA. Com uma sonda só, a margem de uma
  // cratera redonda devolvia a MESMA largura em toda a volta e a praia voltava a
  // ler como fita, só que curva.
  //
  // ⚠️ E O LADO DE TERRA ACABA EM ALFA, NÃO EM COR. Primeira tentativa: a última
  // linha da faixa recebia a cor do regolito (#6B6459 chutado da chapa) para
  // fundir. Não funde. O chão é textura mais ruído de mundo mais sombra, e uma
  // cor fixa é igual a ele em UM ponto do dia e diferente no resto: o que se via
  // era um contorno de polígono com cantos retos, que foi exatamente o que o
  // fundador apontou. Alfa não chuta nada: a areia se desfaz sobre o chão QUE
  // ESTIVER LÁ. Por isso a cor por vértice aqui tem QUATRO componentes.
  if (look2 && (segsP.length || correntesPraia.length)) {
    for (const c of encadear(segsP)) correntesPraia.push(c.pts)
    const cMol = new THREE.Color(AREIA_MOLHADA)
    const cSec = new THREE.Color(AREIA_SECA)
    // ⚠️ O UV SAI EM LADRILHOS DE MUNDO, não em 0..1 sobre a malha. Esta malha é
    // uma fita de quilômetros com poucos metros de largura: UV normalizado
    // esticaria a textura numa lasanha. Dividir a coordenada de mundo por
    // LADRILHO deixa o grão do mesmo tamanho em toda a orla, e é por isso que
    // aqui NÃO se chama `vestir`: ele resolveria o `repeat` achando que o UV é
    // 0..1 (ver a armadilha do `vestir(mat, nome, 1)`).
    const LADRILHO = 8
    const emite = (x: number, y: number, z: number, cor: THREE.Color, a: number) => {
      posP.push(x, y, z)
      corP.push(cor.r, cor.g, cor.b, a)
      uvP.push(x / LADRILHO, z / LADRILHO)
    }
    // ruído de valor barato em coordenada de mundo, só para a largura respirar
    const rnd = (x: number, z: number) => {
      const h = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453
      return h - Math.floor(h)
    }
    const onda = (x: number, z: number, esc: number) => {
      const xi = Math.floor(x / esc), zi = Math.floor(z / esc)
      const fx = x / esc - xi, fz = z / esc - zi
      const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz)
      const a = rnd(xi, zi), b = rnd(xi + 1, zi), c = rnd(xi, zi + 1), d = rnd(xi + 1, zi + 1)
      return (a + (b - a) * ux) + ((c + (d - c) * ux) - (a + (b - a) * ux)) * uz
    }
    for (const cru of correntesPraia) {
      // ver PRAIA_CORRENTE: corrente curta é mancha, não margem
      let _comp = 0
      for (let q = 0; q + 3 < cru.length; q += 2) {
        _comp += Math.hypot(cru[q + 2] - cru[q], cru[q + 3] - cru[q + 1])
      }
      if (_comp < PRAIA_CORRENTE) continue
      // ⚠️ ESQUADRIA MAIS CURTA QUE A DO CAIS (1,6 contra 2,5). O cais é opaco e
      // uma esquadria longa nele só produz canto cheio; na areia transparente a
      // mesma esquadria produz sobreposição visível. Alisar já tirou a quina;
      // isto é o cinto de segurança.
      const pts = alisaContorno(cru)
      const { m, NX, NZ } = normais(pts, 1.6)
      if (m < 2) continue
      // largura crua, por vértice, a partir da inclinação medida
      const W = new Float64Array(m)
      for (let k = 0; k < m; k++) {
        const x = pts[2 * k], z = pts[2 * k + 1]
        const h1 = o.superficieAt(x + NX[k] * PRAIA_SONDA, z + NZ[k] * PRAIA_SONDA)
        const h2 = o.superficieAt(x + NX[k] * PRAIA_SONDA2, z + NZ[k] * PRAIA_SONDA2)
        const decl = Math.max(0, (h1 - L) / PRAIA_SONDA, (h2 - L) / PRAIA_SONDA2)
        const w = decl < 1e-3 ? PRAIA_MAX : Math.min(PRAIA_MAX, PRAIA_SUBIDA / decl)
        // ⚠️ O CONTORNO DE FORA NÃO PODE SER UM OFFSET PARALELO. Largura só do
        // terreno num trecho de encosta uniforme desenha uma linha paralela à
        // margem, com as MESMAS quinas da grade de 30 m: era o "corpo grande de
        // areia com cantos retos". A modulação de ±25% numa onda de 70 m tira a
        // linha do paralelo sem inventar praia onde não há: ela MULTIPLICA a
        // largura medida, então onde a medida é zero continua zero.
        W[k] = w * (0.75 + 0.5 * onda(x, z, 70))
      }
      // ⚠️ ALISAR É O QUE MATA A LASCA. A sonda cai em células diferentes da
      // grade de 30 m e a largura salta de vértice a vértice; sem filtro, dois
      // vizinhos caem em lados opostos do limiar e a praia pisca. Seis passadas
      // de um filtro de três tomas cobrem cerca de ±6 vértices, que na margem
      // fina de 2 m por segmento é a escala em que a lasca aparecia.
      for (let p = 0; p < PRAIA_ALISA; p++) {
        const T = W.slice()
        for (let k = 0; k < m; k++) {
          const a = T[k > 0 ? k - 1 : 0], b = T[k < m - 1 ? k + 1 : m - 1]
          W[k] = (a + 2 * T[k] + b) / 4
        }
      }
      // ⚠️ E A PONTA ABERTA AFINA. Ver PRAIA_PONTA: corrente fechada não tem
      // ponta, então isto só roda onde a margem foi mesmo cortada.
      const _fechada = Math.hypot(pts[0] - pts[2 * m - 2], pts[1] - pts[2 * m - 1]) < 0.01
      if (!_fechada) {
        const q = Math.min(PRAIA_PONTA, (m - 1) >> 1)
        for (let k = 0; k < q; k++) {
          const f = k / q
          W[k] *= f
          W[m - 1 - k] *= f
        }
      }
      const px = (k: number, w: number) => pts[2 * k] + NX[k] * w
      const pz = (k: number, w: number) => pts[2 * k + 1] + NZ[k] * w
      // ⚠️ NÃO EXISTE MAIS CORTE POR LIMIAR, E ESSA É A CAUSA DA LASCA. A versão
      // anterior zerava a largura abaixo de 2,5 m e pulava o trecho inteiro
      // (`if (W[k] <= 0) continue`), então uma margem cuja encosta oscila em
      // torno de 60% ganhava praia, perdia, ganhava de novo, sem motivo legível
      // no terreno. Agora a faixa é CONTÍNUA e quem desaparece é o alfa: campo
      // contínuo não pisca, porque não há decisão para oscilar em volta.
      const alfa = (w: number) => Math.max(0, Math.min(1, (w - 0.8) / (PRAIA_MIN - 0.8)))
      for (let k = 0; k < m - 1; k++) {
        // cinco linhas por vértice, de dentro d'água para o chão seco:
        //  −wm : a franja submersa, escura, que some sob a lâmina
        //    0 : a linha d'água, 2 cm acima da lâmina
        //  +wb : a CRISTA DA BERMA, a quebra do perfil (ver PRAIA_BERMA_*)
        //   +w : o corpo seco, pousado no CHÃO DE VERDADE
        //  +wf : o rabo de areia, na mesma cor e com alfa zero
        const banda = (k0: number) => {
          const w = W[k0]
          // ⚠️ 5 m É CONTA, NÃO GOSTO: o alisamento do contorno pode afastar a
          // areia da água em até 4 m (teto do `alisaContorno`), então a franja
          // precisa entrar MAIS que isso para não abrir fresta. 5 + 0,25 w dá de
          // 5 a 9,5 m de cobertura, com 1 m de folga sobre o pior caso.
          const wm = -(5 + 0.25 * w)                  // a franja molhada, para dentro
          // ⚠️ O RABO É LONGO DE PROPÓSITO. Com 3 m ele não é fusão, é chanfro: o
          // olho ainda acha a linha. Aqui ele vale quase uma praia inteira, então
          // a queda de alfa se espalha por dezenas de metros e não há aresta.
          const wf = w + Math.max(9, w * 0.9)
          // ⚠️ A COTA SAI DO CHÃO, NÃO DE UMA CONSTANTE. Era L + 1,2 fixo, e por
          // isso a faixa lia como prateleira apoiada. Aqui o lado seco pousa em
          // `superficieAt` mais 6 cm, que é o que faz a areia deitar no terreno.
          const ys = Math.max(L + 0.05, o.superficieAt(px(k0, w), pz(k0, w)) + 0.06)
          const yf = Math.max(L + 0.06, o.superficieAt(px(k0, wf), pz(k0, wf)) + 0.06)
          // a crista: posição e altura em ondas próprias, e pousada no chão
          const cx = pts[2 * k0], cz = pts[2 * k0 + 1]
          const wb = w * (PRAIA_BERMA_F0 + PRAIA_BERMA_F1 * onda(cx, cz, 135))
          const cris = PRAIA_BERMA_H0
            + PRAIA_BERMA_H * (w / PRAIA_MAX) * (0.6 + 0.8 * onda(cx + 311, cz - 177, 190))
          const yb = Math.max(L + 0.10, o.superficieAt(px(k0, wb), pz(k0, wb)) + 0.06) + cris
          return { wm, w, wb, wf, ys, yb, yf, a: alfa(w) }
        }
        const A0 = banda(k), B0 = banda(k + 1)
        if (A0.a <= 0 && B0.a <= 0) continue         // aqui a água encosta na rocha
        const quad = (
          wa0: number, ya0: number, aa0: number, wa1: number, ya1: number, aa1: number,
          wb0: number, yb0: number, ab0: number, wb1: number, yb1: number, ab1: number,
          c0: THREE.Color, c1: THREE.Color,
        ) => {
          const bp = posP.length / 3
          emite(px(k, wa0), ya0, pz(k, wa0), c0, aa0)
          emite(px(k + 1, wa1), ya1, pz(k + 1, wa1), c0, aa1)
          emite(px(k + 1, wb1), yb1, pz(k + 1, wb1), c1, ab1)
          emite(px(k, wb0), yb0, pz(k, wb0), c1, ab0)
          idxP.push(bp, bp + 1, bp + 2, bp, bp + 2, bp + 3)
        }
        const yL = L + 0.02
        // ⚠️ A FRANJA COMEÇA SOB A ÁGUA (−0,9 m) DE PROPÓSITO: assim a areia não
        // tem borda nenhuma do lado molhado, ela só some. Medido antes: a borda
        // interna estava a −0,4 m, rasa demais, e a aresta aparecia pela beirada
        // da lâmina.
        quad(A0.wm, L - PRAIA_FUNDO, A0.a, B0.wm, L - PRAIA_FUNDO, B0.a,
             0, yL, A0.a, 0, yL, B0.a, cMol, cMol)
        // ⚠️ A ANTEPRAIA VAI SÓ ATÉ A CRISTA, e é ela que fica ÍNGREME: a
        // transição molhada-seca acontece nesta faixa curta, não espalhada por
        // toda a largura. Espalhada era o que dava a rampa lisa.
        quad(0, yL, A0.a, 0, yL, B0.a,
             A0.wb, A0.yb, A0.a, B0.wb, B0.yb, B0.a, cMol, cSec)
        // o pós-praia: da crista até o chão, quase plano, e é a quebra entre os
        // dois que o olho lê como praia em vez de rampa
        quad(A0.wb, A0.yb, A0.a, B0.wb, B0.yb, B0.a,
             A0.w, A0.ys, A0.a, B0.w, B0.ys, B0.a, cSec, cSec)
        quad(A0.w, A0.ys, A0.a, B0.w, B0.ys, B0.a,
             A0.wf, A0.yf, 0, B0.wf, B0.yf, 0, cSec, cSec)
      }
    }
  }

  const feitas: THREE.Mesh[] = []
  const monta = (
    pos: number[], idx: number[], cor: string, agua: boolean, nome: string,
    areia = false,
  ) => {
    if (!idx.length) return
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    if (areia) {
      // ⚠️ QUATRO COMPONENTES, e o three só respeita o alfa da cor por vértice se
      // o material for `transparent`. Com itemSize 3 o alfa simplesmente não
      // existe e a faixa volta a acabar em aresta.
      g.setAttribute('color', new THREE.Float32BufferAttribute(corP, 4))
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uvP, 2))
    }
    g.setIndex(idx)
    g.computeVertexNormals()
    const mat = new THREE.MeshStandardMaterial({
      color: areia ? '#ffffff' : cor,
      // os mesmos valores do lago central: os dois se encontram e não podem divergir
      roughness: agua ? 0.30 : 0.92,
      metalness: agua ? 0.02 : 0,
      side: THREE.DoubleSide,
      vertexColors: areia,
      // ⚠️ TRANSPARENTE, MAS SEM ESCREVER PROFUNDIDADE. A faixa se sobrepõe a si
      // mesma nas quinas côncavas (a esquadria tem fator até 2,5) e com
      // `depthWrite` ligado essas sobreposições brigariam em z contra o chão a
      // 6 cm de distância. Desligado, ela é sempre pintada por cima do chão, que
      // é o que a areia faz.
      transparent: areia,
      depthWrite: !areia,
    })
    if (areia) {
      // ⚠️ SÓ NORMAL E RUGOSIDADE, O ALBEDO SE DESCARTA. A cor por vértice
      // MULTIPLICA o mapa (armadilha da casa): areia clara vezes o albedo do
      // regolito daria um cinza sujo, e compensar exigiria clarear a cor por
      // vértice até estourar. Aqui a cor é toda da rampa por vértice e a textura
      // entra só como micro-relevo. Textura COMPARTILHADA do cache: nenhum
      // upload novo de GPU, e o `customProgramCacheKey` de `quebrarRepeticao`
      // mantém tudo num programa só.
      const s = superficie('regolito')
      mat.normalMap = s.normalMap
      mat.roughnessMap = s.roughnessMap
      // ⚠️ NORMAL FRACO DE PROPÓSITO: luz rasante na Lua amplifica normal, e a
      // margem é vista quase sempre rasante. No valor cheio a areia vira lixa.
      const f = s.normalScale * 0.55
      mat.normalScale = new THREE.Vector2(f, f)
      mat.roughness = 1
      mat.metalness = 0
      quebrarRepeticao(mat, 110)
    }
    const m = new THREE.Mesh(g, mat)
    m.name = nome
    m.receiveShadow = !agua
    // ⚠️ AREIA NÃO PROJETA SOMBRA: é uma fita deitada no chão, a sombra dela cai
    // nela mesma, e ela pagaria passe de mapa de sombra em quilômetros de orla.
    m.castShadow = (o.sombra ?? true) && !agua && !areia
    m.frustumCulled = false
    group.add(m)
    feitas.push(m)
  }
  monta(posP, idxP, COR_AREIA, false, 'lagos:praia', look2)
  monta(posM, idxM, COR_MURO, false, 'orla:muro')
  monta(posC, idxC, COR_CAIS, false, 'orla:passeio')
  monta(posR, idxR, COR_PISTA, false, 'orla:pista')
  monta(posA, idxA, COR_AGUA, true, 'lagos:agua')

  // ⚠️ A CONSULTA USA A GRADE JÁ AMOSTRADA, não uma nova. Ela tem passo de 30 m e
  // os rótulos de corpo já estão nela: perguntar é um índice, não um cálculo.
  // ⚠️ AS TRÊS CONSULTAS DIVIDEM O MESMO ÍNDICE (`corpoNo`, lá em cima). Elas
  // tinham a conta de i/j copiada uma em cada, e três cópias da mesma indexação
  // é onde uma delas fica para trás quando o passo da grade muda.
  const naBaia = (x: number, z: number): boolean => corpoNo(x, z) === baia

  /** a mesma grade, perguntando por QUALQUER corpo (rot >= 0 é água rotulada) */
  const molhadoNoPonto = (x: number, z: number): boolean => corpoNo(x, z) >= 0
  const naAgua = (x: number, z: number, folga = 0): boolean => {
    if (molhadoNoPonto(x, z)) return true
    if (folga <= 0) return false
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2
      if (molhadoNoPonto(x + Math.cos(a) * folga, z + Math.sin(a) * folga)) return true
    }
    return false
  }

  const relogios = feitas.map((m) => aguaDeVerdade(m)).filter(Boolean) as { value: number }[]
  {
    const desvio: string[] = [], pontes: string[] = []
    for (let k = 0; k < tam.length; k++) {
      if (vaoMax[k] <= 0 && k !== baia) continue
      const ha = (tam[k] * passo * passo / 1e4).toFixed(1)
      const s2 = `${ha}ha/${vaoMax[k].toFixed(0)}m`
      if (empurra[k]) desvio.push(k === baia ? `${s2}(baia)` : s2); else pontes.push(s2)
    }
    console.log(`[lagos] agua contra a teia, limiar ${LIMIAR_PONTE} m: `
      + `${desvio.length} corpos empurram a malha [${desvio.join(' ')}], `
      + `${pontes.length} ganham ponte [${pontes.join(' ')}]`)
  }

  return {
    group,
    naBaia,
    naAgua,
    bloqueiaMalha,
    orlasDesvio,
    area,
    corpos: 0,
    triangulos: (idxA.length + idxP.length + idxM.length + idxC.length + idxR.length) / 3,
    update(t: number) { for (const u of relogios) u.value = t },
    dispose() {
      for (const m of feitas) { m.geometry.dispose(); (m.material as THREE.Material).dispose() }
      group.clear()
    },
  }
}
