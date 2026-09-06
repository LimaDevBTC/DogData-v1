// ═══════════════════════════════════════════════════════════════════════════
// AS VIAS: a rua da DogCity, que até 29/08/2026 não existia.
//
// ⚠️ O DIAGNÓSTICO QUE ORIGINOU ESTE ARQUIVO. O levantamento mediu a cena com
// ?tecido=1 e achou o motivo de o loteamento parecer amador, e não era
// acabamento, era ausência: as únicas ruas com geometria eram os 12 bulevares de
// costura. Tudo que se lia como "rua" dentro dos quarteirões era o VÃO entre os
// plintos dos lotes, o recuo de 1,4 m de tecido.ts. Sem calçada, sem meio-fio,
// sem travessa, sem esquina. Um loteamento sem via desenhada é uma mancha com
// frestas, e é isso que a chapa mostrava.
//
// A referência (maqueteiros de masterplan: RJ Models, Artistic Models, Pipers)
// diz que em maquete a rua é o que se GRAVA, e o limite de lote é implícito. Por
// isso aqui a pista é mais ESCURA que o regolito e a calçada é mais CLARA que o
// lote: de cima a malha viária vira uma teia desenhada, com fio claro na borda e
// miolo escuro, que é como um plano de massas se lê numa prancha.
//
// ⚠️ A FONTE MUDOU EM 03/09 E ELA É `teia.ts`, NÃO O QUARTEIRÃO. Até 02/09 a rua
// saía do registro de cada quarteirão do gerador (centro, lado e GIRO), meia
// seção por quarteirão, e o fundador viu de cima o que isso produz: "essas ruas
// estão completamente desconectadas, sobrepostas, separadas... se elas seguirem a
// malha mãe do dodecaedro, funciona". Agora a rua é um GRAFO sobre a teia, com os
// mesmos 27 anéis e 168 radiais que `programa.ts` já usava para encaixar as peças
// e o cruzamento é desenhado UMA vez, no nó. A seção 2c registra a medição
// inteira. `cidade-malha.json` continua entrando, mas para contar quarteirão e
// medir cobertura, não para desenhar.
//
// A hierarquia, de fora para dentro:
//   bulevar   34 a 44 m  12 avenidas radiais a 30 graus, com canteiro central
//   anel      26 a 34 m  7 anéis viários, dodecágonos, rotatória em cada cruzamento
//   rua       12 m       a teia: 27 anéis x 84 radiais, 168 de ANEIS[13] pra fora
//   travessa   9 m       os 84 radiais do nível fino, que partem a quadra externa
//
// ── O QUE A RODADA DA MAQUETE (maquete-spec.md seção 3) MUDOU AQUI ──────────
//  (1) COR: o canteiro sai de #4A5C3E (L 0,095) para VERDE #7E8A6B (L 0,237). O
//      verde antigo estava a 8 milésimos de luminância da pista e de cima o
//      bulevar lia como TRÊS faixas escuras em vez de duas pistas e um canteiro.
//  (2) FUSÃO: 4 materiais e 4 chamadas de desenho viram 1 material com cor por
//      vértice. A partir daqui acrescentar cor à rua deixa de custar material,
//      que é o recurso escasso desta cena (228 programas compilados na vista de
//      topo, teto de 235).
//  (3) TRAVESSIA ELEVADA nas 4 bocas de cada quarteirão com lote, EIXO tracejado
//      só nos 12 bulevares e FAIXA DE PEDESTRE só onde o bulevar cruza um
//      contorno de quarto. Faixa pintada em rua de 7 m não existe na chapa
//      (0,09 px na zenital); a travessia elevada é volume e existe.
//
// Three.js puro (regra da casa: nada de react-three-fiber).
// ═══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three'
import { LIMIAR_PRACA } from './pracas'
import type { DistanceCuller } from './perf'
import { ANEIS, AVENIDAS, HR, N_RAD, anguloDe, avenidasGeom, nasceEm, raioDodeca } from './teia'
import { look2 } from './look'
import { superficie, vestir, type Superficie } from './materiais'

export interface ViasOpts {
  heightAt: (x: number, z: number) => number
  /** ⚠️ a cota da lâmina: a teia não atravessa a baía. Sem isto os 26 anéis
   *  completos cruzam 20,5 km² de água. */
  cotaAgua?: number
  /** ⚠️ ESTÁ NA BAÍA? A rua PARA na orla dela (fundador, 31/08: "retire as
   *  estradas de cima da baía"). Canal de 60 m e cratera de 300 m continuam
   *  ganhando ponte — o que não existe é viaduto de 20,5 km². Sem esta consulta a
   *  via não distingue os dois casos, porque para ela toda água é água. */
  naBaia?: (x: number, z: number) => boolean
  /** ⚠️ A ÁGUA QUE EMPURRA A MALHA, e é ela que substitui `naBaia` no corte da
   *  teia. `naBaia` respondia por UM corpo e por isso deixava passar tudo o mais:
   *  medido em 03/09, 20,8 km de asfalto da teia sobre 25 lagos, em 168 arestas,
   *  com vãos de até 298 m e quarteirão fechando em cima da lâmina. Quem decide
   *  agora é `lagos.ts`, medindo o vão que a via teria de cruzar em cada corpo
   *  (ver `LIMIAR_PONTE` lá): acima do limiar a via para na linha d'água, abaixo
   *  ela atravessa sobre o tabuleiro, que é a ponte que sempre existiu. A baía
   *  continua entrando aqui, porque ela é o maior dos corpos que empurram. */
  bloqueiaMalha?: (x: number, z: number) => boolean
  /** ⚠️ OS EIXOS DA VIA DE ORLA, de `lagos.ts`: [x,z,x,z,…] por eixo, já recuados
   *  para trás da praia. Sem eles a malha aprende a PARAR na margem e para por
   *  aí, deixando toco cego apontando para a água em cada aresta cortada. Esta é
   *  a metade que costura os tocos, e é ela que faz a rua "se adaptar ao terreno
   *  e fazer curva": o eixo segue a linha d'água suavizada, não a grade. */
  orlasDesvio?: number[][]
  /** ⚠️ as parcelas do programa JÁ ENCAIXADAS na teia (programa.ts). Quando elas
   *  vêm, a máscara de peça é o polígono do MÓDULO, e aí a rua para exatamente na
   *  divisa da parcela: os lados da peça SÃO ruas, por construção. Sem isto a
   *  máscara usa o retângulo antigo do gerador, que é de outra grade. */
  parcelas?: { poly: [number, number][] }[]
  /** sombra própria da rua: é o meio-fio de 0,15 m que dá relevo à seção */
  sombra?: boolean
  /** a malha já carregada (public/city/cidade-malha.json). Sem ela o módulo busca sozinho. */
  malha?: Malha
  /** as 38 peças do programa (public/city/cidade.json). Sem elas o módulo busca sozinho. */
  meta?: Meta
  /** onde registrar as marcas de bulevar; sem ele, chame `update(cam)` a cada quadro */
  culler?: DistanceCuller
}

export interface Vias {
  group: THREE.Group
  quarteiroes: number
  /** anéis desenhados e rotatórias nos cruzamentos com os bulevares */
  aneis: number
  rotatorias: number
  pracas: number
  bulevares: number
  /** travessias elevadas nas bocas de quarteirão */
  travessias: number
  /** ⚠️ CONTRATO NOVO (03/09): os cruzamentos da teia desenhados, um por nó. É a
   *  peça que não existia antes desta rodada: até 02/09 quatro meias-seções
   *  chegavam num cruzamento e nenhuma se tocava. */
  cruzamentos: number
  /** ⚠️ CONTRATO NOVO (03/09): quantos dos quarteirões publicados ficam a mais de
   *  200 m de QUALQUER pavimento. É a regra da casa ("todo lote com frente pra
   *  rua") virada em número medido, contra a máscara que a própria rua acabou de
   *  pintar. Em 02/09 eram 660 de 1.862; medido offline com a teia, zero. */
  quarteiroesSemVia: number
  /** traços do eixo tracejado dos bulevares */
  eixos: number
  /** cruzamentos de bulevar com contorno de quarto que ganharam faixa */
  faixas: number
  triangulos: number
  metrosDeVia: number
  /** true se (x,z) cai sobre pista, sarjeta ou calçada de QUALQUER via
   *  desenhada, mais `folga` metros de margem.
   *
   *  ⚠️ ELA EXISTE PORQUE A ÁRVORE NASCIA DENTRO DO ASFALTO. Até 01/09 a única
   *  máscara que a arborização tinha era `emAvenida` da teia, um teste analítico
   *  sobre as 12 retas radiais, mais um `noAnel` que compara o raio com o raio de
   *  cada anel. Só que o anel É UM DODECÁGONO desde 31/08 (a nota longa da seção
   *  2b), e o meio da aresta fica a 96,6% do raio: uma máscara circular erra por
   *  até 3,4% do raio, que na Pista de Serviço são 259 m. Some a isso as 46
   *  rotatórias, que nenhuma das duas conhecia, e o resultado é o que o fundador
   *  viu: o asfalto cortando a árvore ao meio.
   *
   *  ⚠️ O CANTEIRO CENTRAL NÃO ENTRA NA MÁSCARA, DE PROPÓSITO. Ele é exatamente
   *  onde a arborização de eixo deve plantar (ver SEC_BULEVAR e SEC_ANEL); marcar
   *  a seção inteira apagaria as duas fileiras que a cidade quer ter. */
  naVia(x: number, z: number, folga?: number): boolean
  /** ⚠️ TAREFA 4 (02/09): sobre qual das três superfícies (x,z) cai, ou
   *  `null` se não está em nenhuma. Mesma máscara de `naVia`, célula de 4 m.
   *  MEDIDO (ver a nota grande de `mascara`): 76,2% de acerto em via larga
   *  (bulevar), só 25,9% no contorno de quarteirão (6 m de seção inteira,
   *  menor que 2 células). No contorno isto resolve "estou perto de uma
   *  junta" (sarjeta acerta 99,1% ali); não resolve "pista ou calçada" numa
   *  via estreita. */
  sobreQue(x: number, z: number): 'pista' | 'sarjeta' | 'calcada' | null
  /** quanto custou preencher a grade da máscara, em ms (medido no boot) */
  mascaraMs: number
  /** liga/desliga as marcas de bulevar por distância; redundante se `culler` foi passado */
  update(cam: THREE.Vector3): void
  dispose(): void
}

// ── A BANDEIRA DO CORTE (Bloco B, fundacao-gta5.md, 02/09) ─────────────────
// ⚠️ MESMO PADRÃO DE `look.ts` (lida uma vez, no módulo, com guarda de SSR),
// mas escrita aqui porque `look.ts` não é meu arquivo: cada bandeira desta
// casa mora no módulo dono da peça que ela liga. O corte de verdade da seção
// (abaulamento, sarjeta em V, esquina) é CONTEÚDO NOVO sobre uma via que já
// funciona, não correção de defeito objetivo, e o bot de auto-commit publica
// de hora em hora: sem bandeira, o passo intermediário apareceria pro
// visitante antes de eu e o fundador termos visto as chapas lado a lado.
function lerCorte(): boolean {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get('corte') === '1'
}
const CORTE1 = lerCorte()

// ⚠️ AS COTAS SÃO O QUE FAZ A RUA TER SEÇÃO E NÃO SER UM ADESIVO. O plinto do
// lote em tecido.ts tem 0,45 m; a calçada fica 0,12 abaixo dele e a pista 0,15
// abaixo da calçada. Esses 15 cm são o meio-fio residencial universal dos EUA
// (6 in), o único número de guia que a pesquisa achou em fonte primária.
// ⚠️ NÃO INVERTA ESTAS TRÊS COTAS. pracas.ts:55-58 amarra o Y_BASE 0,33 da praça
// à calçada daqui para que quem anda na rua entre na praça sem degrau; mexer
// aqui quebra as 128 praças de lá em silêncio.
const Y_PISTA = 0.18
const Y_CALCADA = 0.33
const Y_CANTEIRO = 0.40

// ⚠️ 0,02 m É A CONSTANTE ÚNICA DE FOLGA, E ELA FOI MEDIDA. Só ALTURA resolve
// aqui, e 0,02 m segura cobertura plena de 300 m a 9.000 m.
//
// ⚠️ A EXPLICAÇÃO ANTIGA CAIU, A CONSTANTE NÃO. Este comentário dizia que
// polygonOffset era INERTE porque a cena ligava logarithmicDepthBuffer e o
// fragmento escrevia gl_FragDepthEXT, apagando o deslocamento do rasterizador
// (fator 0, -16 e -64 davam os MESMOS 9.556 px na bancada). Isso era verdade
// enquanto o buffer logarítmico estava ligado; ele foi DESLIGADO por padrão
// quando o `near` passou a acompanhar a distância (plaza-scene.tsx), então hoje
// polygonOffset FUNCIONA de novo. A folga por altura continua sendo a escolha:
// ela não depende de estado do rasterizador e sobrevive à próxima troca.
const FOLGA = 0.02

// Paleta: a pista é o valor mais escuro da cidade e a calçada o mais claro. O
// lote (PEDRA em tecido.ts) fica entre os dois de propósito, senão a teia some.
// Razões medidas: calçada/pista 4,41:1, marca/pista 5,08:1, verde/pista 2,09:1.
const COR_PISTA = '#57534B'
const COR_CALCADA = '#CBC4B6'
const COR_MEIOFIO = '#8F8879'
const COR_CANTEIRO = '#7E8A6B'
const COR_MARCA = '#D8D2C4'
// ⚠️ O PLATÔ DO QUARTEIRÃO: a plataforma terraplenada, esperando prédio.
// Ele é MAIS CLARO que a pista de propósito, e é isso que faz a malha existir.
const COR_PLATO = '#9E968A'

type Alvo = 'pista' | 'calcada' | 'canteiro' | 'meiofio' | 'marca' | 'plato'

// ⚠️ AS CORES VIRAM Color UMA VEZ E ENTRAM COMO ATRIBUTO. Com
// ColorManagement.enabled (padrão desde a r152) o setStyle já converte sRGB para
// linear, que é o espaço de trabalho: escrever o hex cru no atributo devolveria
// a rua clara demais.
const COR: Record<Alvo, THREE.Color> = {
  pista: new THREE.Color(COR_PISTA),
  plato: new THREE.Color(COR_PLATO),
  calcada: new THREE.Color(COR_CALCADA),
  canteiro: new THREE.Color(COR_CANTEIRO),
  meiofio: new THREE.Color(COR_MEIOFIO),
  marca: new THREE.Color(COR_MARCA),
}

/** uma faixa da seção: de/até em metros a partir da borda t=0, na cota alt */
interface Banda { de: number; ate: number; alt: number; alvo: Alvo }

// ⚠️ MORTA DESDE 03/09, MANTIDA COMO REGISTRO. Esta era a meia-seção que cada
// quarteirão desenhava por conta própria: 6 m, da borda 84 até 90, com o vizinho
// desenhando a outra metade a partir do PRÓPRIO registro. A ideia era não
// duplicar a via na divisa, e ela funciona enquanto os dois quarteirões forem
// paralelos, só que a grade do gerador GIRA por setor, então em toda costura as
// duas metades se cruzam em ângulo e o pavimento sai desenhado duas vezes na
// mesma cota. Some a isso o cruzamento, que não tem quarteirão para desenhá-lo, e
// está o relato do fundador de 03/09 inteiro: "desconectadas, sobrepostas,
// separadas". Quem desenha rua agora é a seção 2c, a partir da teia, com a seção
// INTEIRA e o cruzamento no nó. Nenhuma linha deste arquivo usa mais esta
// constante; ela fica porque a lógica antiga precisa continuar legível.
const SEC_CONTORNO: Banda[] = [
  { de: 0.0, ate: 2.5, alt: Y_CALCADA, alvo: 'calcada' },
  { de: 2.5, ate: 6.0, alt: Y_PISTA, alvo: 'pista' },
]
// ⚠️ A RUA DA TEIA, 12 m, CENTRADA NA DIVISA E INTEIRA.
// Ela substitui o par de meias-seções que cada quarteirão desenhava por conta
// própria. Ver a nota grande na seção 1: meia-seção por quarteirão nunca fecha
// cruzamento, porque no cruzamento não existe quarteirão para desenhar.
const SEC_RUA: Banda[] = [
  { de: -6.0, ate: -3.5, alt: Y_CALCADA, alvo: 'calcada' },
  { de: -3.5, ate: +3.5, alt: Y_PISTA, alvo: 'pista' },
  { de: +3.5, ate: +6.0, alt: Y_CALCADA, alvo: 'calcada' },
]
// Travessa de 9 m, seção inteira (ela não é compartilhada com ninguém)
const SEC_TRAVESSA: Banda[] = [
  { de: 0.0, ate: 1.5, alt: Y_CALCADA, alvo: 'calcada' },
  { de: 1.5, ate: 7.5, alt: Y_PISTA, alvo: 'pista' },
  { de: 7.5, ate: 9.0, alt: Y_CALCADA, alvo: 'calcada' },
]
// Bulevar de 34 m com canteiro central: 5 + 10 + 4 + 10 + 5. O canteiro não é
// enfeite, é onde a arborização de eixo vai plantar quando ela existir.
const SEC_BULEVAR: Banda[] = [
  { de: 0.0, ate: 5.0, alt: Y_CALCADA, alvo: 'calcada' },
  { de: 5.0, ate: 15.0, alt: Y_PISTA, alvo: 'pista' },
  { de: 15.0, ate: 19.0, alt: Y_CANTEIRO, alvo: 'canteiro' },
  { de: 19.0, ate: 29.0, alt: Y_PISTA, alvo: 'pista' },
  { de: 29.0, ate: 34.0, alt: Y_CALCADA, alvo: 'calcada' },
]

// ⚠️ O ANEL: 26 m, e ele é a hierarquia que faltava. Com 12 bulevares radiais e
// mais nada, ir do setor 4 ao setor 8 obrigava a passar pela praça: a cidade era
// uma roda de bicicleta sem aro. Numa chapa isso não aparece; numa volta de
// carro aparece na primeira curva, e a direção de arte agora é dirigível.
// Seção 3,5 + 8 + 3 + 8 + 3,5: duas pistas com canteiro no meio, igual ao
// bulevar em menor escala, e o canteiro existe para a arborização de eixo.
const SEC_ANEL: Banda[] = [
  { de: 0.0, ate: 3.5, alt: Y_CALCADA, alvo: 'calcada' },
  { de: 3.5, ate: 11.5, alt: Y_PISTA, alvo: 'pista' },
  { de: 11.5, ate: 14.5, alt: Y_CANTEIRO, alvo: 'canteiro' },
  { de: 14.5, ate: 22.5, alt: Y_PISTA, alvo: 'pista' },
  { de: 22.5, ate: 26.0, alt: Y_CALCADA, alvo: 'calcada' },
]
// A rotatória onde o anel cruza um bulevar. Rotatória e não cruzamento porque
// numa malha radial os ângulos não são retos, e semáforo em ângulo agudo é
// impossível de dirigir.
const ROT_RAIO = 40, ROT_ILHA = 16

// ── a travessia elevada (spec 3.5) ────────────────────────────────────────
// Platô de 6 m no sentido da via, na cota da calçada, com rampa de 1 m nas duas
// pontas. Vive dentro da boca da travessa, encostado na calçada do contorno.
const TRV_FORA = 84      // a boca: onde a travessa encontra a calçada do contorno
const TRV_PLATO = 6.0
const TRV_RAMPA = 1.0
// ⚠️ 10 cm DE RECUO DE CADA MEIO-FIO, E É O QUE EVITA UMA BRIGA COPLANAR. Se o
// platô encostasse no meio-fio a face lateral dele (0,17 m) nasceria no MESMO
// plano da face do meio-fio (0,15 m) e as duas piscariam na chapa. Com o recuo o
// platô tem 5,8 m e nenhuma face nova precisa ser desenhada: o meio-fio que já
// existe é a parede da travessia.
const TRV_RECUO = 0.10

// ── o eixo tracejado do bulevar (spec 3.6) ────────────────────────────────
// 3 m de marca por 9 m de vão é a broken lane line do MUTCD (10 ft por 30 ft).
// Largura 0,60 m, quatro vezes a linha normal do manual, porque isto é convenção
// de maquete e não tinta de trânsito: a 300 m mede 2,34 px e a 1.000 m, 0,70.
const EIXO_MARCA = 3.0
const EIXO_VAO = 9.0
const EIXO_LARG = 0.60
// ⚠️ A MARCA DE BULEVAR SÓ EXISTE PARA A VISTA DE PEDESTRE E TEM DE MORRER CEDO.
// Ela é geometria e não shader, então não tem piso em pixel: de longe vira
// cintilação sem entregar desenho. Por isso cada bulevar é uma malha própria
// (mesmo material, zero material novo) registrada no DistanceCuller com o centro
// NO MEIO DO RAIO, e não na origem. props.ts:98 registra com centro na origem e
// mede a distância a partir da praça central; não copie aquele erro.
const MARCA_CULL = 900

// ── a faixa de pedestre (spec 3.7) ────────────────────────────────────────
// 6 barras de 0,60 m separadas por 1,80 m atravessando os 10 m de pista (MUTCD:
// barra continental de 12 in mínimo e 24 in preferido, separação mínima de 6 ft).
const FAIXA_BARRAS = 6
const FAIXA_LARG = 0.60
const FAIXA_VAO = 1.80

// ── A MÁSCARA DA VIA (`naVia`) ─────────────────────────────────────────────
// Um campo de bits em coordenada de mundo, pintado enquanto a rua é desenhada.
//
// ⚠️ A CONSULTA TEM DE SER O(1) PORQUE A ARBORIZAÇÃO CHAMA DEZENAS DE MILHARES DE
// VEZES NO BOOT. Percorrer trilho, anel e rotatória por ponto seria O(n) sobre
// milhares de trechos; aqui a rua vira bit e a consulta é um deslocamento.
//
// ⚠️ 4.096 CÉLULAS DE LADO PORQUE 4.096 = 2^12, e aí o índice é `(iz << 12) | ix`
// sem uma multiplicação sequer. Com célula de 4 m isso cobre 16.384 m, o dobro
// do raio da Pista de Serviço (7.600 m), e o campo inteiro cabe em 2 MB
// (16.777.216 bits). Uma grade de bytes custaria 16 MB pela mesma cobertura.
//
// ⚠️ A CÉLULA DE 4 m É CONSERVADORA POR CONSTRUÇÃO: ela marca até 4 m ALÉM da
// borda real da via. Para uma máscara de plantio esse é o lado certo do erro,
// porque árvore 4 m longe da guia é jardim e árvore 1 m dentro da pista é
// defeito. Quem precisar de precisão de centímetro não deve usar isto.
const MASC_CEL = 4
const MASC_N = 4096
const MASC_MEIO = MASC_N >> 1
// ⚠️ O PASSO DE AMOSTRAGEM TEM DE SER MENOR QUE A CÉLULA, senão sobra furo: uma
// faixa de 12 m amostrada de 5 em 5 deixa células inteiras sem nenhuma sonda
// dentro. 2,5 m em célula de 4 m dá cobertura com folga em qualquer ângulo.
const MASC_PASSO = 2.5

// ── O MEIO-FIO DE VERDADE (só no `?look=2`) ────────────────────────────────
// ⚠️ ATÉ 01/09 O DESNÍVEL DE 15 cm EXISTIA SÓ COMO COTA. A guia era UM retângulo
// vertical e mais nada: sem topo, sem chanfro, sem sarjeta. Guia de verdade tem
// quatro planos, e três deles pegam a luz em ângulo diferente, que é o que faz
// a leitura de "rua" numa câmera a 3 m de altura.
//
//   sarjeta  0,40 m de concreto rente à pista: é a faixa clara que a chapa
//            zenital lê como fio de borda
//   face     vertical, do fundo da sarjeta até o topo menos o chanfro
//   chanfro  5 cm a 45 graus, o único plano da seção que devolve especular na
//            luz rasante de 16 graus desta cena
//   topo     0,28 m de guia, 1,5 cm acima da calçada
//
// ⚠️ A SARJETA NÃO É UMA CONCHA, E NÃO PODE SER. A pista aqui é um quad PLANO de
// até 24 m; uma sarjeta rebaixada ficaria escondida por baixo dele em todo o
// trecho. Ela vai rente, a FOLGA de 2 cm, e o que a distingue da pista é o
// material, não o rebaixo.
//
// ⚠️ O TOPO SOBE 1,5 cm SOBRE A CALÇADA PORQUE COPLANAR BRIGA. Guia e calçada na
// mesma cota é a listra piscando que este arquivo já pagou duas vezes (seção 2b
// e a nota do TRV_RECUO). 1,5 cm é sub-pixel a partir de uns 10 m de câmera.
const CB_SARJETA = 0.40
const CB_CHANFRO = 0.05
const CB_TOPO = 0.28
const CB_LIP = 0.015

// ── O CORTE DE VERDADE (Bloco B, fundacao-gta5.md, atrás de `?corte=1`) ────
// ⚠️ ABAULAMENTO: 2% de caimento do eixo pra sarjeta, o número do plano
// (fundacao-gta5.md, Bloco B item 1). Aplicado como altura de crista no meio
// de cada banda de pista (ver `faixa`, parâmetro `abaular`): a borda fica na
// mesma cota de sempre, só o meio sobe.
const ABAUL_PCT = 0.02

// ⚠️ RAMPA DO REBAIXAMENTO (Tarefa 3, item 4 do Bloco B): 1:12 é a proporção
// que o plano pede; o comprimento em metros é essa proporção aplicada ao
// próprio degrau já declarado (Y_CALCADA-Y_PISTA=0,15m), não um número novo.
const RAMPA_1_12 = 12
const RAMPA_EXTREMOS = (Y_CALCADA - Y_PISTA) * RAMPA_1_12   // 1,8 m

// ⚠️ A SARJETA EM V, E POR QUE ELA NÃO CONTRARIA O CB_SARJETA=0,40 ACIMA. O
// plano original (fundacao-gta5.md, Bloco B item 2) pede "sarjeta em V de
// 30 cm". A rodada de 02/09 que fixou CB_SARJETA já MEDIU e REJEITOU uma
// sarjeta REBAIXADA nessa largura: "a pista aqui é um quad PLANO de até 24 m;
// uma sarjeta rebaixada ficaria escondida por baixo dele" (nota acima, "A
// SARJETA NÃO É UMA CONCHA"). Essa rejeição continua certa para uma pista
// FLAT. Com o abaulamento acima a pista deixa de ser flat: a borda encosta
// exatamente onde sempre encostou (a rejeição não fala da LARGURA, fala da
// PROFUNDIDADE), então mantenho os 0,40 m já medidos e abro o V DENTRO deles,
// como uma continuação do MESMO caimento que a pista acabou de ganhar, só que
// mais íngreme (é o que concentra a água pro centro da sarjeta em vez de
// deixá-la correr pelos 40 cm inteiros). CB_V_PCT não é medido em campo
// nenhum, nenhuma fonte primária foi achada pra sarjeta de maquete lunar; é
// uma decisão de projeto, registrada como tal, e o valor é deliberadamente
// MAIOR que os 2% da pista (é a sarjeta que tem de vencer, não o contrário).
const CB_V_PCT = 0.05
const CB_V_FUNDO = (CB_SARJETA / 2) * CB_V_PCT   // ~1 cm, o fundo do V

// ⚠️ TRÊS DOS CINCO ITENS DO BLOCO B FICARAM SEM DONO EM 03/09, e é preciso dizer
// qual e por quê. `abaular` (item 1), `rampaExtremos` (item 4) e o leque de
// esquina (item 5) eram ligados SÓ pelo contorno de quarteirão, que saiu junto com
// a arquitetura dele. Os itens 4 e 5 não fazem mais falta: eles existiam porque a
// esquina antiga era um leque chapado de pista, e a rampa 1:12 era o jeito de a
// calçada descer até ele; a teia desenha a esquina com calçada e meio-fio de
// verdade (`teiaCruzamento`), então não há degrau para rampar. O item 1 (a crista
// de 2% da pista) está VIVO no código de `faixa` e sem nenhum chamador: quem
// quiser trazer o abaulamento para a rua da teia enxerta em `teiaBraco`, e o custo
// medido lá atrás é +2 triângulos por banda de pista por passo. Os itens 2 e 3
// (sarjeta em V e face com chanfro) continuam ativos na avenida e no anel viário,
// que são quem chama `meioFio`.
//
// ⚠️ O ESCOPO DO BLOCO B. Dos cinco itens do plano, todos FEITOS:
//   1. abaulamento              `faixa` + parâmetro `abaular`
//   2. sarjeta em V             `meioFio`
//   3. face de meio-fio         JÁ EXISTIA antes deste Bloco B (rodada de
//      com chanfro               02/09 que fixou CB_SARJETA/CB_CHANFRO/CB_TOPO
//                                e `paredeVert`); nenhuma linha nova aqui.
//   4. rebaixamento de esquina  Tarefa 3 (02/09): `rampaExtremos` em `faixa`,
//      rampa 1:12                1,8 m = 0,15 m / (1/12), o degrau já
//                                declarado dividido pela rampa que o plano
//                                pediu. Faz calçada E meio-fio convergirem
//                                pra cota da pista exatamente na ponta do
//                                trilho, ou seja nos quatro cantos do
//                                contorno de quarteirão.
//   5. raio de concordância     Tarefa 3: a solução (a) do fundador, sem
//                                interseção nenhuma. O retângulo local (`hx`,
//                                `hz`, `giro`) já dá os quatro cantos por
//                                construção; um leque de `N_ARCO`=7 triângulos
//                                por canto, raio `R_GAP`=6 m (a própria
//                                meia-seção, a MESMA folga de 6 m que já
//                                evita disputa com o vizinho), fecha a cunha
//                                de 90° que nenhuma das duas arestas retas
//                                alcançava. Zero interseção calculada, zero
//                                dependência do registro do quarteirão vizinho.
//
// ⚠️ O ORÇAMENTO, MEDIDO OFFLINE (node/tsx sobre o JSON, `heightAt` fixo em 0,
// sem baía, sem material novo, mesmas malhas de sempre): a Tarefa 1 sozinha
// (contorno sem corte) levou o grupo `vias` de 557.104 para 1.276.564
// triângulos (+719.460, o custo de dar frente pra rua a 1.862 quarteirões que
// não desenhavam nada). Ligar `?corte=1` por cima (abaulamento + sarjeta em V,
// itens 1 e 2) soma mais 328.524 (1.276.564 -> 1.605.088, +25,7%): a sarjeta
// em V dobrando cada `deitado` de sarjeta em TODA a guia da cidade (contorno,
// bulevar e anel, porque `meioFio` é compartilhada pelas três) é a maior
// fatia disso. A esquina (Tarefa 3, itens 4 e 5) soma mais 104.272
// (1.605.088 -> 1.709.360, +6,5%): 7 triângulos por canto x 4 cantos x 1.862
// quarteirões = 52.136 do leque, o resto é o mesmo custo de sempre só
// redistribuído pela rampa. Chamada de desenho: zero a mais em todo o Bloco B
// (a geometria cai nas MESMAS Fitas de sempre). Material e programa de
// shader: zero a mais, nenhum `new THREE.MeshStandardMaterial` neste bloco
// inteiro. `metrosDeVia` não muda com `?corte=1` (268.204 -> 1.630.669 é só a
// Tarefa 1; o corte é seção e esquina, não comprimento).

// ── O OMBRO DA VIA (02/09) ─────────────────────────────────────────────────
// ⚠️ O DEFEITO: A PISTA ERA UMA FITA DE ASFALTO LARGADA SOBRE REGOLITO NU. Entre
// a calçada e o que vinha depois não havia NADA: nem canteiro, nem guia, nem
// talude, nem transição. Numa vista de cima o bulevar lia como um traço preto no
// marrom, e era isso que fazia a rua parecer genérica mesmo tendo faixa pintada,
// meio-fio de quatro planos e canteiro central. Rua de verdade tem OMBRO: uma
// berma plana rente à calçada e um talude que MORRE NO TERRENO.
//
// ⚠️ A COTA DE FORA É O TERRENO, NÃO UMA CONSTANTE. Se as duas bordas saíssem de
// `cotaVia`, o ombro seria mais uma fita plana, só que verde, e o buraco entre
// ela e o chão continuaria lá 9 m adiante. Aqui a borda de dentro nasce na
// calçada e a de fora assenta em `cotaVia + 3 cm`: o quad É o talude, e o
// encontro com o regolito é uma aresta e não uma emenda seca.
//
// ⚠️ E O DESNÍVEL É LIMITADO A 3 m. Sem trava, um trecho onde o regolito sobe 20 m
// em 9 m de vão devolveria uma PAREDE verde de 20 m ao lado da pista, que lê como
// defeito antes de ler como talude. Não medi a frequência disso; a trava é
// preventiva e barata.
//
// ⚠️ HIERARQUIA, QUE ERA O SEGUNDO DEFEITO: bulevar e anel tinham a MESMA cara e
// só mudavam de largura. O ombro é onde a diferença passa a existir sem custar
// material: o bulevar ganha berma larga com uma soleira clara de 1 m em
// 'calcada' (a faixa de acostamento), o anel ganha só a berma estreita de campo,
// e o mobiliário fecha a leitura (gradil na avenida, balizador no anel, em
// `mobiliario-urbano.ts`).
//
// ⚠️ ZERO CHAMADA DE DESENHO NOVA, DE PROPÓSITO: a berma cai em `fCanteiro` e a
// soleira em `fCalcada`, as duas fitas que a rua já publica. Custo estimado
// (não medido em tela): ~55 mil triângulos sobre os 436.874 do grupo `vias`.
const OMBRO_BULEVAR = 9.0
const OMBRO_ANEL = 5.0
/** a soleira clara rente à calçada, só no bulevar */
const OMBRO_SOLEIRA = 1.0
/** a berma nasce 3 cm abaixo da calçada: nunca coplanar com ela */
const OMBRO_ALT = Y_CALCADA - 0.03
/** quanto o pé do talude pode se afastar da cota da via, para cima ou para baixo */
const OMBRO_DESNIVEL = 3.0
/** folga do pé do talude sobre o regolito, mesma lógica do FOLGA da pista */
const OMBRO_POUSO = 0.03

// ── ONDE A TEIA CRUZA, O OMBRO ABRE (03/09) ────────────────────────────────
//
// ⚠️ O OMBRO ERA UMA PAREDE VERDE ATRAVESSADA NA FRENTE DA RUA LOCAL, e a conta é
// direta: a avenida tem 34 a 44 m de seção MAIS 9 a 11,6 m de berma de cada lado,
// então o corredor que ela ocupa de verdade tem 26 a 33,6 m de meia largura. A rua
// da teia que chega perpendicular a ela precisaria parar aí, ou seja a 12 a 20 m
// depois da guia da avenida, em cima de grama. E a berma fica em `OMBRO_ALT`
// (0,30 m), entre a pista da teia (0,18) e a calçada dela (0,33): sobrepor as duas
// não faz uma emenda ruim, faz o verde ATRAVESSAR o asfalto.
//
// A saída é a de qualquer cruzamento de verdade: onde a via transversal chega, a
// berma ABRE. Os raios em que isso acontece não são chutados, são os 27 anéis da
// teia, e por isso moram aqui em cima, fora de `buildVias`: quem desenha o ombro
// da avenida roda ANTES da seção 2c e precisa deles prontos.
//
// ⚠️ A MITRA É A DE `caixaDoModulo`, NÃO A "CERTA". `passoNoRaio` de teia.ts
// devolve 2 para qualquer raio acima de 1.450 (o laço casa no primeiro nível e
// nunca chega ao segundo), então a cidade inteira usa 1/cos(pi/84). Uso o mesmo
// valor para a rua nascer exatamente na divisa que `programa.ts` publica.
// ⚠️ A MITRA DE 84 LADOS SAIU EM 06/09. Ela corrigia a esquadria de um polígono
// de 84 lados; a malha agora tem 12 faces e quem converte apótema em raio é
// `raioDodeca()`, que precisa do RUMO e por isso não cabe numa constante.
/** meia abertura da boca que a teia pede no ombro alheio: a seção mais uma folga */
const TEIA_BOCA = HR + 4
/** o raio está em cima de um anel da teia? (a boca do ombro da avenida)
 *  ⚠️ COM 12 FACES O ANEL NÃO TEM UM RAIO SÓ: ele depende do rumo do ponto, e a
 *  diferença entre a apótema e a quina é de 3,5%, que num anel de 6.900 são 240
 *  m. Comparar contra o raio do círculo abriria a boca no lugar errado. */
function noAnelDaTeia(x: number, z: number): boolean {
  const r = Math.hypot(x, z)
  const a = Math.atan2(x, -z)
  for (const ap of ANEIS) if (Math.abs(r - raioDodeca(ap, a)) < TEIA_BOCA) return true
  return false
}
/** o rumo está em cima de um radial da teia? (a boca do ombro do anel viário) */
function noRadialDaTeia(x: number, z: number): boolean {
  const r = Math.hypot(x, z)
  if (r < 1) return false
  // ⚠️ O RADIAL FINO SÓ EXISTE DE ANEIS[13] PARA FORA (`nasceEm`), e abrir a boca
  // dele antes disso rasgaria a berma do Anel Interior e do Anel Médio em 84
  // pontos onde não chega rua nenhuma.
  const passo = r >= (nasceEm(1) ?? Infinity) ? 1 : 2
  const salto = ((Math.PI * 2) / N_RAD) * passo
  const u = Math.atan2(x, -z) / salto
  return Math.abs(u - Math.round(u)) * salto * r < TEIA_BOCA
}

// ── O ACABAMENTO DA PISTA (02/09) ──────────────────────────────────────────
//
// ⚠️ O DEFEITO: A PISTA ESTAVA GEOMETRICAMENTE CERTA E VISUALMENTE MORTA. A
// escala foi conferida hoje contra este arquivo e está correta (asfalto de 7 m
// na rua da teia, 6 na travessa, 8+8 no anel, 10+10 no bulevar, meio-fio de
// 0,15 m, eixo tracejado em MUTCD). O que faltava não era largura, era HISTÓRIA:
// a fita saía com tom uniforme de ponta a ponta, e material uniforme lê como
// adesivo em qualquer resolução. Asfalto de verdade guarda o registro de quem
// passou por cima dele.
//
// Quatro coisas entram aqui, todas no FRAGMENTO e nenhuma em geometria nova:
//   trilha    duas rodadas por sentido, mais escuras e mais lisas
//   virgem    a faixa entre a rodada e a guia, mais clara e mais áspera
//   sarjeta   a sujeira que acumula encostada no meio-fio (é ela que faz a
//             transição asfalto/guia/calçada deixar de ser aresta seca)
//   remendo   retângulo de vala com contorno selado, mais trinca
//
// ⚠️ A LARGURA DA BANDA VEM DE ATRIBUTO, NÃO DO UV, E ISSO FOI MEDIDO NO CÓDIGO.
// O UV que a `Fita` publica é métrico (metro/9), mas contado da borda da SEÇÃO
// inteira, que não é a borda do asfalto: em SEC_RUA a pista vai de -3,5 a +3,5 e
// em SEC_BULEVAR de 5 a 15 e de 19 a 29. Um rodado escrito em u fixo cairia em
// lugar diferente em cada uma das cinco seções, e em SEC_BULEVAR nem sequer no
// asfalto. Com `aVia` o shader recebe a banda normalizada e a largura real, e a
// rodada nasce onde a roda passa em TODAS elas.
//
// ⚠️ E ELE TAMBÉM CORRIGE O RODADO JÁ ASSADO NA RECEITA. `amostraAsfalto` de
// materiais.ts tem duas gaussianas em u = 0,3 e u = 0,7 do ladrilho de 9 m, ou
// seja repetidas a cada 9 m ATRAVÉS da pista: numa faixa de 7 m elas caem uma
// vez e meia, fora de lugar. Não posso editar materiais.ts (não é meu arquivo),
// então a rugosidade daqui não SOMA, ela MISTURA por cima com peso 0,7: o perfil
// que o olho lê passa a ser o desta função, e o que sobra da receita é grão.
//
// ⚠️ UM PROGRAMA PARA OS DOIS MATERIAIS, POR UNIFORME E NÃO POR SOURCE. Asfalto
// e calçada compartilham a MESMA fonte e a MESMA `customProgramCacheKey`, e o
// que muda entre eles é `uViaTipo`. Medido no arquivo: os dois já tinham os
// mesmos defines (map + normalMap + roughnessMap, sem vertexColors). Custo: os
// dois saem do balde 'dogcity:macro' e entram num balde novo, ou seja +1
// programa sobre os 402 da vista alta, não +2.
//
// ⚠️ E A CHAVE DE CACHE TEM DE SER DIFERENTE DA DE `quebrarRepeticao`. Duas
// fontes distintas com a MESMA chave fazem o three servir o programa errado, e o
// erro não é de compilação, é de tela.
const CACHE_VIA = 'dogcity:via:acabamento'

/**
 * Veste um material de via já vestido por `materiais.ts` com o acabamento.
 * `tipo`: 1 = asfalto (trilha, remendo, trinca), 0 = calçada (só contato e mancha).
 *
 * ⚠️ ENVOLVE O `onBeforeCompile` QUE JÁ EXISTIA, NÃO O SUBSTITUI. `vestir` chama
 * `quebrarRepeticao`, que instala o ruído de mundo por este mesmo gancho:
 * atribuir por cima apagaria a quebra de ladrilho em silêncio e a grade de 9 m
 * voltaria a aparecer de longe.
 */
function acabamentoVia(mat: THREE.MeshStandardMaterial, tipo: number) {
  const base = mat.onBeforeCompile
  mat.onBeforeCompile = (shader, renderer) => {
    base?.call(mat, shader, renderer)
    shader.uniforms.uViaTipo = { value: tipo }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
attribute float aVia;
varying float vVia;
varying vec2 vViaXZ;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vVia = aVia;
vViaXZ = (modelMatrix * vec4(transformed, 1.0)).xz;`)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
varying float vVia;
varying vec2 vViaXZ;
uniform float uViaTipo;
float vrand(vec2 p){ return fract(sin(dot(p, vec2(21.98, 78.233))) * 41758.5453); }
float vnoi(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(vrand(i), vrand(i + vec2(1.0, 0.0)), u.x),
             mix(vrand(i + vec2(0.0, 1.0)), vrand(i + vec2(1.0, 1.0)), u.x), u.y);
}`)
      // ⚠️ O PONTO DE ENXERTO É `roughnessmap_fragment` PORQUE ELE É O ÚNICO
      // LUGAR ONDE AS DUAS VARIÁVEIS EXISTEM JUNTAS. diffuseColor nasce lá atrás
      // em map_fragment e roughnessFactor nasce aqui; enxertar antes daria
      // roughnessFactor indefinido e o shader não compila.
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
{
  float wcode = floor(vVia);
  float larg = wcode * 0.5;         // ver a nota de comBanda: vai em meios metros
  float tt = fract(vVia);
  float tinta = 1.0;      // multiplica o albedo
  float lisa = 0.0;       // quanto a superficie ficou polida pelo uso
  float aspera = 0.0;     // quanto ela ficou aberta por falta de uso

  if (wcode >= 1.0) {
    float m = tt * larg;              // metros a partir da borda da banda
    float pista = larg * 0.5;         // uma faixa por sentido
    float borda = min(m, larg - m);

    if (uViaTipo > 0.5) {
      // as quatro rodadas: 0,8 m de cada lado do eixo de cada faixa
      float d = 9.0;
      d = min(d, abs(m - (pista * 0.5 - 0.8)));
      d = min(d, abs(m - (pista * 0.5 + 0.8)));
      d = min(d, abs(m - (pista * 1.5 - 0.8)));
      d = min(d, abs(m - (pista * 1.5 + 0.8)));
      float trilha = exp(-d * d / 0.34);
      tinta *= mix(1.0, 0.84, trilha);
      lisa += trilha * 0.34;

      // a faixa que ninguem pisa: entre a rodada e a guia, e no meio da via
      float virgem = smoothstep(0.30, 0.85, borda) * (1.0 - smoothstep(0.85, 1.90, borda));
      virgem = max(virgem, exp(-pow((m - pista) / 0.55, 2.0)) * 0.7);
      tinta *= mix(1.0, 1.10, virgem);
      aspera += virgem * 0.10;

      // junta longitudinal de construcao, no encontro das duas faixas
      float junta = exp(-pow((m - pista) / 0.055, 2.0));
      tinta *= mix(1.0, 0.58, junta);
      lisa += junta * 0.22;
    }

    // a sujeira da sarjeta: e ela que apaga a aresta asfalto/guia/calcada
    float sujo = 1.0 - smoothstep(0.0, uViaTipo > 0.5 ? 0.55 : 0.35, borda);
    tinta *= mix(1.0, uViaTipo > 0.5 ? 0.74 : 0.80, sujo);
    aspera += sujo * 0.08;
  } else if (vVia < -0.5 && uViaTipo > 0.5) {
    // cruzamento e rotatoria: o desgaste concentra e nao tem direcao
    float g = vnoi(vViaXZ * 0.55);
    tinta *= mix(0.86, 0.98, g);
    lisa += 0.26;
  }

  // remendo de vala: um retangulo por celula de 6 m, com insets sorteados para
  // nao desenhar grade, e o contorno selado mais escuro que o miolo
  vec2 cel = vViaXZ / 6.0;
  vec2 cid = floor(cel), cf = fract(cel);
  vec2 lo = vec2(0.08 + vrand(cid + 11.3) * 0.34, 0.08 + vrand(cid + 27.7) * 0.34);
  vec2 hi = lo + vec2(0.20 + vrand(cid + 41.1) * 0.34, 0.20 + vrand(cid + 5.9) * 0.34);
  float dentro = step(lo.x, cf.x) * step(cf.x, hi.x) * step(lo.y, cf.y) * step(cf.y, hi.y);
  float ativo = step(vrand(cid + 3.7), uViaTipo > 0.5 ? 0.09 : 0.05);
  float remendo = dentro * ativo;
  float bd = min(min(cf.x - lo.x, hi.x - cf.x), min(cf.y - lo.y, hi.y - cf.y)) * 6.0;
  float selo = remendo * (1.0 - smoothstep(0.0, 0.14, bd));
  tinta *= mix(1.0, 0.84 + vrand(cid + 61.2) * 0.16, remendo);
  lisa += remendo * 0.10;
  tinta *= mix(1.0, 0.58, selo);

  // trinca: uma crista fina de ruido de mundo, so onde o asfalto ja envelheceu
  if (uViaTipo > 0.5) {
    float n = vnoi(vViaXZ * 0.085);
    float cr = 1.0 - smoothstep(0.004, 0.026, abs(n - 0.5));
    cr *= smoothstep(0.50, 0.72, vnoi(vViaXZ * 0.011));
    tinta *= mix(1.0, 0.52, cr);
    lisa += cr * 0.10;
  }

  diffuseColor.rgb *= tinta;
  // ⚠️ MISTURA, NAO SOMA: ver a nota do rodado assado na receita.
  float alvoRug = clamp(0.96 - lisa + aspera, 0.35, 1.0);
  roughnessFactor = mix(roughnessFactor, roughnessFactor * alvoRug / 0.96, 0.7);
  roughnessFactor = clamp(roughnessFactor, 0.05, 1.0);
}`)
  }
  mat.customProgramCacheKey = () => CACHE_VIA
  mat.needsUpdate = true
}

interface Quarteirao {
  id: string; setor: number; x: number; z: number; r: number
  /** ⚠️ `giro` e `lado` são DO BLOCO agora: 109 no Núcleo, 168 no Meio, 227 no
   *  Bairro, e na Cinta o giro é a tangente local, diferente em cada quarteirão */
  giro: number; lado: number; lotes: number
  /** ⚠️ profundidade RADIAL do quarteirão. Na teia ela difere da testada: `lado`
   *  é o arco (125 a 250 m) e `prof` é o vão entre anéis (109/168/227) */
  prof: number
  /** faixas de 50 m do quarteirão: define quantas travessas e fileiras ele tem */
  k: number
  /** a banda do distrito: é ela que agrupa os quarteirões num anel */
  quarto?: number
}
interface Bulevar {
  id: string; rumo: number; largura: number
  rInicio: number; rFim: number
  x0: number; z0: number; x1: number; z1: number
}
interface Peca { x: number; z: number; a: number; b: number; rot: number; forma?: string }
export interface Parque { id: string; x: number; z: number; a: number; b: number; rot: number }
export interface Diagonal { id: string; rumo: number; afastamento: number; largura: number }
export interface Malha {
  constantes: {
    distritos: number; viaContorno: number
    bulevar: number; raioSitio: number
    // ⚠️ NÃO EXISTE MAIS UM QUARTEIRÃO SÓ, e por isso a travessa também não é
    // uma tabela só: ela depende de k (2, 3 ou 4 faixas). Ler `travessas` fixo
    // desenhava travessa fora do quarteirão no Núcleo e faltava uma no Bairro.
    travessasPorK: Record<string, { z0: number; z1: number }[]>
    bandas: { de: number; ate: number; nome: string; k: number; lado: number }[]
    cinta: { de: number; faixas: number[]; lados: number[] }
    arcoBanda: number; avenidaDistrito: number; diagLargura: number
  }
  bulevares: Bulevar[]
  quarteiroes: Quarteirao[]
  parques?: Parque[]
  diagonais?: Diagonal[]
  contorno?: [number, number][]
}
export interface Anel { id: string; nome: string; r: number; larg: number }
export interface Meta { programa: Peca[]; raioBorda: number; aneis?: Anel[] }

/** acumulador de triângulos: uma malha só por superfície */
class Fita {
  vs: number[] = []
  cs: number[] = []
  us: number[] = []
  ix: number[] = []
  /**
   * ⚠️ O UV SAI EM UNIDADES DE LADRILHO, NÃO EM METROS, e isso é imposição de
   * `materiais.ts`: lá o `repeat` é `Math.max(1, mundo / metros)`, ou seja ele
   * NUNCA fica abaixo de 1. Com `vestir(mat, nome, 1)` o repeat trava em 1 e quem
   * tem de dividir pelo lado do ladrilho é a geometria. `escala` é esse lado, em
   * metros de mundo. Zero desliga o UV inteiro, que é o caminho do `?look=1`:
   * sem textura o atributo seria 1,1 MB de vértice à toa.
   *
   * `comCor` idem: no look 2 cada fita é de UMA superfície só, então a cor sai do
   * material e o atributo de cor não precisa existir.
   */
  /**
   * `comBanda` liga o atributo `aVia`, que é o ÚNICO canal por onde o acabamento
   * do asfalto sabe onde ele está DENTRO da faixa de rolamento. Ver a nota longa
   * de `acabamentoVia` mais abaixo: sem ele o shader só teria o UV do ladrilho,
   * que é métrico mas contado da borda da SEÇÃO inteira, e a trilha de pneu
   * nasceria em lugar diferente em cada uma das cinco seções.
   */
  constructor(readonly escala = 0, readonly comCor = true, readonly comBandaAttr = false) {}

  private uvOn = false
  private uvq = new Float64Array(8)
  /**
   * UV explícito do PRÓXIMO `add`, em unidades de ladrilho.
   *
   * ⚠️ SEM ELE O SULCO DE RODA DO ASFALTO CORRE NO EIXO X DO MUNDO. A projeção XZ
   * é a mais barata, mas a receita `asfalto` de materiais.ts tem duas faixas de
   * rodado gaussianas em u = 0,3 e u = 0,7: projetada em XZ, a marca de pneu
   * atravessa a pista na diagonal em 10 das 12 avenidas. Com o UV da via, u é a
   * seção e v é o comprimento, e o rodado nasce onde a roda passa.
   */
  comUV(a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) {
    const q = this.uvq
    q[0] = a; q[1] = b; q[2] = c; q[3] = d; q[4] = e; q[5] = f; q[6] = g; q[7] = h
    this.uvOn = true
    return this
  }

  bs: number[] = []
  private bandaOn = false
  private bandaq = new Float64Array(4)
  /**
   * A BANDA DO PRÓXIMO `add`, empacotada num float por vértice.
   *
   * Codificação (decodificada no shader de `acabamentoVia`):
   *   valor  <  0   cruzamento ou rotatória: desgaste isotrópico, sem trilha
   *   valor === 0   sem informação de banda (platô, disco, o que não é faixa)
   *   valor  >= 1   parte inteira = LARGURA da banda em MEIOS METROS
   *                 parte fracionária = posição através da banda, 0 a 1
   *
   * ⚠️ UM FLOAT, NÃO DOIS. `fPista` é a maior malha do grupo `vias`; um vec2 por
   * vértice custaria o dobro de VRAM de atributo pelo mesmo desenho.
   *
   * ⚠️ E A LARGURA VAI EM MEIOS METROS, NÃO EM METROS INTEIROS. As bandas deste
   * arquivo são 7, 6, 8 e 10 m de asfalto mas 2,5 e 3,5 m de calçada; arredondar
   * 2,5 para 3 esticaria a escala da sarjeta em 20% em toda calçada da cidade.
   * Meio metro cobre as dez larguras das cinco seções sem sobra.
   *
   * ⚠️ E O t NUNCA CHEGA A 1,0, senão `floor` sobe a largura em um metro na borda
   * de cima e a banda inteira lê 8 m onde tem 7. 0,999 é sub-milímetro em 7 m.
   */
  comBanda(larg: number, ta: number, tb: number, tc: number, td: number) {
    const q = this.bandaq
    const w = Math.max(1, Math.round(larg * 2))
    q[0] = w + ta * 0.999; q[1] = w + tb * 0.999
    q[2] = w + tc * 0.999; q[3] = w + td * 0.999
    this.bandaOn = true
    return this
  }
  /** o próximo `add` é cruzamento: desgaste sem direção */
  comCruzamento() {
    const q = this.bandaq
    q[0] = q[1] = q[2] = q[3] = -1
    this.bandaOn = true
    return this
  }

  // ⚠️ OS QUATRO CANTOS TÊM DE VIR NO SENTIDO ANTI-HORÁRIO VISTO DE CIMA, senão
  // a normal aponta para baixo e o backface culling apaga a face inteira. Custou
  // uma rodada inteira em pracas.ts (a nota está em pracas.ts:101-107).
  add(cor: THREE.Color,
      ax: number, ay: number, az: number, bx: number, by: number, bz: number,
      cx: number, cy: number, cz: number, dx: number, dy: number, dz: number) {
    const b = this.vs.length / 3
    this.vs.push(ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz)
    if (this.comCor) for (let i = 0; i < 4; i++) this.cs.push(cor.r, cor.g, cor.b)
    if (this.escala > 0) {
      if (this.uvOn) {
        const q = this.uvq
        this.us.push(q[0], q[1], q[2], q[3], q[4], q[5], q[6], q[7])
      } else {
        const k = 1 / this.escala
        this.us.push(ax * k, az * k, bx * k, bz * k, cx * k, cz * k, dx * k, dz * k)
      }
    }
    if (this.comBandaAttr) {
      const q = this.bandaq
      if (this.bandaOn) this.bs.push(q[0], q[1], q[2], q[3])
      else this.bs.push(0, 0, 0, 0)
    }
    this.uvOn = false
    this.bandaOn = false
    this.ix.push(b, b + 1, b + 2, b, b + 2, b + 3)
  }

  /**
   * O mesmo quad, mas com UV de face VERTICAL: u corre na horizontal a partir de
   * `a`, v é a altura.
   *
   * ⚠️ PROJEÇÃO XZ NUMA FACE VERTICAL COLAPSA O u E ESTICA O LADRILHO AO INFINITO.
   * Numa guia de 15 cm ninguém veria; o pilar da ponte, que desce do tabuleiro
   * até o leito, tem dezenas de metros de face e é lá que o defeito aparece.
   */
  addV(cor: THREE.Color,
       ax: number, ay: number, az: number, bx: number, by: number, bz: number,
       cx: number, cy: number, cz: number, dx: number, dy: number, dz: number) {
    if (this.escala > 0) {
      const k = 1 / this.escala
      const du = (x: number, z: number) => Math.hypot(x - ax, z - az) * k
      this.comUV(0, ay * k, du(bx, bz), by * k, du(cx, cz), cy * k, du(dx, dz), dy * k)
    }
    this.add(cor, ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz)
  }

  get triangulos() { return this.ix.length / 3 }
  get vazia() { return this.ix.length === 0 }
  malha(mat: THREE.Material, nome: string): THREE.Mesh {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.vs, 3))
    if (this.comCor) g.setAttribute('color', new THREE.Float32BufferAttribute(this.cs, 3))
    if (this.escala > 0) g.setAttribute('uv', new THREE.Float32BufferAttribute(this.us, 2))
    if (this.comBandaAttr) g.setAttribute('aVia', new THREE.Float32BufferAttribute(this.bs, 1))
    g.setIndex(this.ix)
    g.computeVertexNormals()
    const m = new THREE.Mesh(g, mat)
    m.name = nome
    return m
  }
}

/** um eixo de via já discretizado: é ele que devolve a altura EXATA do plano da
 *  pista, que é o que toda marca precisa para não afundar. */
interface Trilho {
  ax: number; az: number; bx: number; bz: number
  perpX: number; perpZ: number
  comp: number; passos: number
  secao: Banda[]
  /** um por passo: false onde a máscara (peça, bulevar, borda) cortou o segmento */
  desenhado: boolean[]
}

export async function buildVias(o: ViasOpts): Promise<Vias> {
  // ⚠️ AS AVENIDAS VÊM DE `teia.ts`, NÃO DA MALHA PUBLICADA. O gerador publica as
  // costuras dos 6 distritos como "bulevares", e elas ficam entre 5,6° e 73,1°
  // uma da outra: divisa de loteamento, não estrutura viária. A avenida quer
  // simetria e mora na teia. Ver a nota longa em `teia.ts`.
  const [malha, meta] = await Promise.all([
    o.malha ?? fetch('/city/cidade-malha.json').then((r) => r.json() as Promise<Malha>),
    o.meta ?? fetch('/city/cidade.json').then((r) => r.json() as Promise<Meta>),
  ])
  // ⚠️ TROCA AS COSTURAS PUBLICADAS PELAS 12 AVENIDAS SIMÉTRICAS. O gerador
  // publica as divisas dos 6 distritos no campo `bulevares`, e elas ficam entre
  // 5,6° e 73,1° uma da outra (medido): isso é divisa de loteamento, não
  // estrutura viária. Ver a nota longa em `teia.ts`.
  // ⚠️ A CONSTRUÇÃO SAIU DAQUI EM 31/08 e foi para `avenidasGeom()` em teia.ts.
  // Ela era feita aqui, na CÓPIA LOCAL deste módulo, e a arborização buscava o
  // mesmo JSON por conta própria: nunca via a troca e plantava nas 9 costuras de
  // distrito enquanto a rua saía nas 12 avenidas. Ver a nota em teia.ts.
  malha.bulevares = avenidasGeom() as Bulevar[]

  const K = malha.constantes
  // ⚠️ `meio` ERA GLOBAL E VALIA 84 PARA A CIDADE INTEIRA. Com o quarteirão
  // variando por banda ele passou a sair do bloco; a constante global aqui
  // desenhava contorno de 168 m em cima de quarteirão de 109 e de 227.
  const group = new THREE.Group()
  group.name = 'vias'

  // ── as duas máscaras que a via tem de respeitar ───────────────────────────
  // (1) as 38 peças do programa: lago, estádio e alfândega já ocupam o chão, e
  //     rua atravessando lago é o erro que a chapa mostra de longe. 26 centros de
  //     quarteirão caem dentro de peça, então o corte tem de ser por SEGMENTO e
  //     não por quarteirão inteiro.
  // ⚠️ A PEÇA VIROU RETÂNGULO DE CÉLULAS DA MALHA (29/08) e a máscara tem de
  // saber disso. Quem ainda é elipse são só as duas da casca (Portão e Farol),
  // que vivem além de R_ABOBADA onde não há malha para ancorar.
  // ⚠️ CONVENÇÃO ÚNICA: MUNDO = R(rot) · LOCAL, a mesma do `giro` da malha, logo
  // LOCAL = R(-rot) · MUNDO. O gerador usava o sinal invertido até 29/08 e por
  // isso a reserva de terra e o desenho eram espelhados: a máscara guardava 0
  // lote e a elipse desenhada caía em cima de 174. Medido, consertado, e agora
  // os dois lados usam esta mesma linha.
  const pecas = (meta.programa ?? []).map((p) => {
    const rr = (p.rot * Math.PI) / 180
    return { x: p.x, z: p.z, a: p.a, b: p.b, ret: p.forma !== 'elipse',
             ca: Math.cos(rr), sa: Math.sin(rr), rr2: (p.a * p.a + p.b * p.b) }
  })
  // ⚠️ QUANDO A CENA MANDA AS PARCELAS ENCAIXADAS, ELAS MANDAM. O polígono do
  // módulo é o mesmo objeto que define a divisa da parcela, então a rua para
  // exatamente nela: sem lasca, sem rua entrando na peça, sem peça pisando na
  // rua. É a diferença entre "conectar a peça à malha" e a peça NASCER conectada.
  const parcelas = o.parcelas ?? []
  const dentroDoPoly = (px: number, pz: number, poly: [number, number][]) => {
    let d = false
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, zi] = poly[i], [xj, zj] = poly[j]
      if ((zi > pz) !== (zj > pz) && px < ((xj - xi) * (pz - zi)) / (zj - zi) + xi) d = !d
    }
    return d
  }
  const emPeca = (px: number, pz: number) => {
    if (parcelas.length) {
      for (const q of parcelas) if (dentroDoPoly(px, pz, q.poly)) return true
      return false
    }
    for (const p of pecas) {
      const dx = px - p.x, dz = pz - p.z
      if (dx * dx + dz * dz > p.rr2) continue
      const lx = dx * p.ca + dz * p.sa, lz = -dx * p.sa + dz * p.ca
      if (p.ret) { if (Math.abs(lx) <= p.a && Math.abs(lz) <= p.b) return true }
      else if ((lx / p.a) ** 2 + (lz / p.b) ** 2 <= 1) return true
    }
    return false
  }
  // (2) o corredor dos 12 bulevares. Os quarteirões giram com o setor, então na
  //     costura a grade de um setor não casa com a do vizinho e a via de contorno
  //     entraria por baixo do bulevar. Duas faixas coplanares brigam no z-buffer
  //     e a chapa mostra a briga.
  // ⚠️ `folga` VIROU PARÂMETRO EM 03/09, e o motivo é a teia da seção 2c. Quem
  // desenha CONTRA a avenida (o contorno antigo) queria margem, para não brigar
  // no z-buffer com ela; quem ENCOSTA nela (a rua da teia, que tem de terminar no
  // pavimento da avenida e não 3 m antes dele) quer margem ZERO, senão sobra uma
  // fresta de regolito de 3 m em toda esquina de avenida, que é a "rua terminando
  // no ar" do relato. Uma função, duas folgas.
  const emCorredorAvenida = (px: number, pz: number, folga: number) => {
    // ⚠️ OS RADIAIS NÃO SÃO MAIS 12 COSTURAS IGUAIS. São as avenidas publicadas
    // em `bulevares`: quatro do eixo das pontes (rumos 0/90/180/270, 34 m) e seis
    // das costuras de distrito, que têm abertura desigual. Calcular por
    // `s * 360/12` errava o rumo de seis delas.
    for (const b of malha.bulevares) {
      const ang = (b.rumo * Math.PI) / 180
      const dirX = Math.sin(ang), dirZ = -Math.cos(ang)
      const ao = px * dirX + pz * dirZ
      if (ao <= 0) continue
      const meia = (b.largura ?? K.bulevar) / 2 + folga
      if (Math.abs(px * Math.cos(ang) + pz * Math.sin(ang)) < meia) return true
    }
    return false
  }
  const noBulevar = (px: number, pz: number) => {
    if (Math.hypot(px, pz) < 40) return true
    return emCorredorAvenida(px, pz, 3)
  }
  const rMax = (meta.raioBorda ?? 4400) + 10
  // Vão máximo de uma face de via, em metros: ver a nota em faixa(). Depois que
  // o chão passou a ser `superficieAt` o vão deixou de precisar ser curto por
  // causa da flecha (a superfície virou a mesma) e passou a precisar só de não
  // pular uma dobra da grade de 59 m do regolito. 24 m mede zero furo em 4.000
  // sondas e custa 210 mil triângulos a menos que 18.
  const PASSO = 24

  // ── as fitas: uma por superfície no look 2, uma só no look 1 ─────────────
  //
  // ⚠️ A DECISÃO DE MATERIAL, MEDIDA ANTES DE ESCOLHER. O look 1 desenha a rua
  // inteira com UM MeshStandardMaterial e cor por vértice: 14 malhas no grupo
  // `vias` (1 chão + 1 guia + 12 marcas), 206.594 triângulos. Vestir esse
  // material único com 'asfalto' não é uma opção defensável, e não é questão de
  // gosto: um material carrega UM albedo, UM normal e UMA rugosidade, então a
  // calçada receberia grão de asfalto e o canteiro central também. A cor por
  // vértice só multiplicaria o mesmo mapa em três tons, que é literalmente o que
  // a rua já faz hoje, com uma foto de asfalto por cima.
  //
  // O custo do caminho separado foi medido, não estimado: chamada de desenho no
  // three é por MALHA, não por material, e o chão vira 3 malhas em vez de 1. Com
  // a guia partida em duas (ver abaixo) o grupo sai de 14 para 17 malhas, ou
  // seja +3 chamadas num orçamento de 442: 0,7%. Programa compilado, que é o
  // recurso de verdade escasso aqui (402 na vista alta), NÃO cresce: os quatro
  // materiais vestidos têm exatamente os mesmos defines (map + normalMap +
  // roughnessMap, sem vertexColors) e todos declaram a mesma
  // `customProgramCacheKey` de `quebrarRepeticao`, então o three compila um só.
  //
  // ⚠️ E A COR POR VÉRTICE SAI DE CENA NO LOOK 2, não fica clareada. O BRIEFING
  // avisa que cor de material e cor por vértice MULTIPLICAM o mapa; a saída
  // "clareia as cores para perto do branco" só faz sentido se as três superfícies
  // dividissem uma textura, e elas não dividem mais. Cada fita é de uma
  // superfície só, então a cor é do material e o atributo nem é gerado.
  const ESC: Record<'asfalto' | 'calcada' | 'campo' | 'pedra', number> = look2
    ? { asfalto: superficie('asfalto').metros, calcada: superficie('calcada').metros,
        campo: superficie('campo').metros, pedra: superficie('pedra').metros }
    : { asfalto: 0, calcada: 0, campo: 0, pedra: 0 }

  const chao = new Fita()                                   // look 1: tudo aqui
  // ⚠️ O ATRIBUTO DE BANDA SÓ EXISTE NO LOOK 2. No look 1 não há material vestido
  // para consumi-lo, e ele seria um float por vértice de puro peso morto na
  // maior malha do grupo.
  const fPista = new Fita(ESC.asfalto, false, look2)
  const fCalcada = new Fita(ESC.calcada, false, look2)
  const fCanteiro = new Fita(ESC.campo, false)
  /** para onde vai um quad de chão, conforme o look */
  const fitaDe = (alvo: Alvo): Fita => {
    if (!look2) return chao
    if (alvo === 'calcada') return fCalcada
    if (alvo === 'canteiro') return fCanteiro
    return fPista                                            // pista, plato, marca
  }

  // ⚠️ A GUIA VAI NUMA MALHA SÓ DELA, E NÃO É CAPRICHO: ela é a única coisa da
  // rua que PODE lançar sombra. Chão plano lançando sombra em chão plano com o
  // sol a 16 graus é a receita da acne de sombra (o gradiente de profundidade
  // por texel fica enorme na luz rasante, e o texel aqui mede de 0,88 a 3,5 m).
  // Duas malhas com o MESMO material custam 1 chamada de desenho a mais e zero
  // material, que é o recurso escasso desta cena.
  const guia = new Fita(ESC.pedra, !look2)
  // ⚠️ E NO LOOK 2 ELA VIRA DUAS, PARA A SOMBRA NÃO TRIPLICAR DE PREÇO. O perfil
  // novo tem 4 quads por junta em vez de 1, mas só UM deles é vertical. Sarjeta,
  // chanfro e topo são planos quase deitados e lançar sombra deles é exatamente
  // a acne que a nota acima descreve. Separadas, a malha que projeta sombra fica
  // com a MESMA contagem de triângulos que tinha antes desta rodada, e o custo
  // do meio-fio novo é 1 chamada de desenho, zero no mapa de sombra.
  const guiaPiso = new Fita(ESC.pedra, !look2)
  let metros = 0

  // ── a máscara da via, pintada durante o desenho ─────────────────────────
  // Ver a nota longa nas constantes MASC_*. Os quads são acumulados aqui e
  // rasterizados de uma vez no fim, o que permite MEDIR o preenchimento em ms
  // sem chamar `performance.now()` cem mil vezes dentro do laço de geometria.
  // ⚠️ TAREFA 4 (02/09): 2 BITS POR CÉLULA, NÃO 1. Até aqui a máscara só
  // respondia sim/não pra `naVia`; a frente de decalque precisa saber SOBRE
  // QUE SUPERFÍCIE o ponto cai (remendo de asfalto pede pista, junta de
  // concretagem pede calçada, e os dois disputavam a mesma zona porque a
  // máscara não distinguia nenhum dos dois). Código por célula: 0 nada,
  // 1 pista, 2 calçada, 3 sarjeta (a mais estreita, 0,40 m; ganha empate de
  // propósito, ver `escreverCel`). Custo medido em MB, não estimado:
  // MASC_N² = 16.777.216 células. A 1 bit (o que existia) são 2.097.152
  // bytes = 2 MB. A 2 bits são 4.194.304 bytes = 4 MB. A 1 byte inteiro (a
  // opção óbvia, um `Uint8Array` sem empacotar) seriam 16.777.216 bytes =
  // 16 MB, quatro vezes mais que o necessário para só 4 estados. 2 bits é a
  // codificação mais barata que ainda responde às três classes: escolhida.
  //
  // ⚠️ A CÉLULA DE 4 m CONTINUA A MESMA (MASC_CEL), E MEDI O LIMITE EM VEZ
  // DE SÓ AVISAR DELE. Amostrando `sobreQue` contra a classe analítica
  // esperada (offline, node/tsx, sem navegador), em vias LARGAS (bulevar de
  // 44 m) a resposta bate em 76,2% dos pontos (calçada 95,0%, sarjeta
  // 100,0%, pista 64,6%, a maior parte do erro perto do canteiro, que não é
  // uma das três classes). No CONTORNO de quarteirão, que tem só 6 m de
  // seção inteira (2,5 calçada + 3,5 pista), a célula de 4 m é maior que
  // metade da via inteira: a resposta bate em só 25,9% dos pontos (sarjeta
  // 99,1%, mas calçada 23,0% e pista 20,9%, porque a prioridade da sarjeta
  // toma conta de quase toda célula que toca a fronteira). **`sobreQue` no
  // contorno serve pra achar "estou perto de uma junta" (é o que a sarjeta
  // responde quase sempre certo); não serve pra decidir "estou no meio da
  // pista ou no meio da calçada" numa via de 6 m.** Isto não é bug: é célula
  // maior que o objeto medindo objeto pequeno, e fica registrado com número
  // em vez de só um aviso qualitativo. Reduzir `MASC_CEL` resolveria, mas ele
  // é compartilhado com `naVia` (a arborização depende do valor de hoje) e
  // mexer nele é fora do escopo desta tarefa.
  const mascara = new Uint8Array((MASC_N * MASC_N) >> 2)
  const quadsVia: number[] = []
  /** cada quad carrega o próprio código de classe: pista/calçada/sarjeta */
  const marcarVia = (codigo: number, ax: number, az: number, bx: number, bz: number,
                     cx: number, cz: number, dx: number, dz: number) => {
    quadsVia.push(codigo, ax, az, bx, bz, cx, cz, dx, dz)
  }
  /** pista, calçada e platô entram na máscara; canteiro NÃO, é onde a
   *  arborização de eixo planta */
  const mascaravel = (alvo: Alvo) => alvo === 'pista' || alvo === 'calcada' || alvo === 'plato'
  /** o platô (plataforma terraplenada do quarteirão) soma no código de
   *  PISTA: são só 4 estados no total e o platô não é uma das três classes
   *  que `sobreQue` promete. */
  const codigoDe = (alvo: Alvo): number => (alvo === 'calcada' ? 2 : (alvo === 'pista' || alvo === 'plato') ? 1 : 0)
  const COD_SARJETA = 3

  // ── A PONTE ───────────────────────────────────────────────────────────────
  //
  // ⚠️ FUNDADOR, 31/08: "se qualquer parte dessas pistas cruzar água precisamos
  // de uma ponte AAA+, já vi estrada sendo interrompida por água na chapa".
  //
  // ⚠️ E ELA NÃO ESTAVA INTERROMPIDA, ESTAVA SUBMERSA. A via era assentada em
  // `heightAt`, que sobre a baía devolve o LEITO (até 90 m abaixo da lâmina): a
  // pista continuava lá, desenhada, 50 m debaixo d'água, e o que a chapa mostrava
  // era a lâmina opaca por cima. Diagnóstico diferente, conserto diferente: não
  // era buraco a tapar, era cota a levantar.
  //
  // ⚠️ E O TABULEIRO É `max(terreno, lâmina + gabarito)`, QUE É CONTÍNUO POR
  // CONSTRUÇÃO. A tentação é `if (molhado) sobe`, e aí nasce um degrau na margem
  // que precisa de rampa, e a rampa precisa saber onde a margem está. Com o
  // máximo, o tabuleiro fica nivelado sobre a água e encontra o chão EXATAMENTE
  // onde ele sobe até a mesma cota: a rampa é o próprio terreno, e não existe
  // junta para errar. É a mesma ideia do talude do canal, ao contrário.
  // ⚠️ UM PREDICADO SÓ PARA AS QUATRO VIAS. O corte da água estava escrito quatro
  // vezes (`o.naBaia && o.naBaia(...)`) — teia, avenida, anel e ombro do anel — e
  // quatro cópias é onde uma fica para trás: quando a classificação de `lagos.ts`
  // entrou, atualizar só a da teia deixaria bulevar e anel viário atravessando os
  // mesmos lagos que a rua acabou de aprender a contornar.
  const paraNaAgua = (x: number, z: number): boolean =>
    o.bloqueiaMalha ? o.bloqueiaMalha(x, z) : (o.naBaia ? o.naBaia(x, z) : false)

  const COTA_AG = o.cotaAgua ?? -40
  const GABARITO = 7                  // altura livre do tabuleiro sobre a lâmina
  const DECK = COTA_AG + GABARITO
  const cotaVia = (x: number, z: number) => Math.max(o.heightAt(x, z), DECK)
  const sobreAgua = (x: number, z: number) => o.heightAt(x, z) < COTA_AG + 0.5

  // ── as três peças do meio-fio (look 2) ───────────────────────────────────
  /** um quad DEITADO entre dois offsets da seção, assentado no terreno */
  const deitado = (
    fita: Fita, oa: number, ob: number, sa: number, sb: number,
    ax: number, az: number, bx: number, bz: number,
    px: number, pz: number, esc: number, vA: number, vB: number,
  ) => {
    // ⚠️ A ORDEM É A MESMA DE `faixa`: menor offset, maior offset, e só então ao
    // longo da via. Inverter devolve normal para baixo e o quad some no culling,
    // que é a armadilha registrada em pracas.ts:98 e na seção 2b daqui.
    const de = Math.min(oa, ob), ate = Math.max(oa, ob)
    const sde = oa <= ob ? sa : sb, sate = oa <= ob ? sb : sa
    const pax = ax + px * de, paz = az + pz * de
    const pbx = ax + px * ate, pbz = az + pz * ate
    const pcx = bx + px * ate, pcz = bz + pz * ate
    const pdx = bx + px * de, pdz = bz + pz * de
    fita.comUV(de / esc, vA / esc, ate / esc, vA / esc, ate / esc, vB / esc, de / esc, vB / esc)
      .add(COR.meiofio,
        pax, cotaVia(pax, paz) + sde, paz,
        pbx, cotaVia(pbx, pbz) + sate, pbz,
        pcx, cotaVia(pcx, pcz) + sate, pcz,
        pdx, cotaVia(pdx, pdz) + sde, pdz)
  }

  /**
   * Uma face VERTICAL virada para (nx,nz).
   *
   * ⚠️ E ESTE É O DEFEITO QUE FAZIA A GUIA ANTIGA NÃO TER SOMBRA LEGÍVEL. Ela era
   * emitida sempre na mesma ordem de vértices, sem olhar de que lado da seção
   * está a pista: numa seção como SEC_RUA, que tem calçada dos DOIS lados, a
   * junta de baixo e a de cima têm a pista em sentidos opostos, então metade das
   * guias da cidade nascia com a normal virada para dentro do lote e o
   * `side: FrontSide` do material simplesmente não a desenhava. Aqui o sentido é
   * escolhido pelo produto vetorial e a face olha sempre para o asfalto.
   */
  const paredeVert = (
    fita: Fita, ax: number, az: number, bx: number, bz: number,
    yaB: number, yaT: number, ybB: number, ybT: number,
    nx: number, nz: number,
  ) => {
    const dx = bx - ax, dz = bz - az
    if (dx * nz - dz * nx > 0) {
      fita.addV(COR.meiofio, ax, yaB, az, bx, ybB, bz, bx, ybT, bz, ax, yaT, az)
    } else {
      fita.addV(COR.meiofio, bx, ybB, bz, ax, yaB, az, ax, yaT, az, bx, ybT, bz)
    }
  }

  /** o perfil inteiro da guia numa junta da seção: sarjeta, face, chanfro, topo */
  const meioFio = (
    ax: number, az: number, bx: number, bz: number,
    off: number, lado: number, baixo: number, alto: number,
    px: number, pz: number, vA: number, vB: number,
  ) => {
    const esc = ESC.pedra || 1
    const yT = alto + CB_LIP
    // ⚠️ TAREFA 4: A PEGADA DA SARJETA NA MÁSCARA, INDEPENDENTE DE `?corte=1`.
    // A sarjeta em si (flat ou em V) sempre existiu aqui; o que não existia
    // era ALGUÉM registrando essa faixa de 0,40 m na máscara. Sem isto
    // `sobreQue` nunca devolveria 'sarjeta', porque nenhum quad da guia
    // chamava `marcarVia`. XZ apenas, então V ou flat dá o mesmo retângulo.
    {
      const sa = off - lado * CB_SARJETA, sb = off
      marcarVia(COD_SARJETA,
        ax + px * sa, az + pz * sa, ax + px * sb, az + pz * sb,
        bx + px * sb, bz + pz * sb, bx + px * sa, bz + pz * sa)
    }
    if (CORTE1) {
      // ⚠️ SARJETA EM V (item 2 do Bloco B): ver a nota grande de CB_V_PCT,
      // acima. Os dois EXTREMOS ficam exatamente onde a sarjeta rente já
      // encostava (a pista de um lado, o chanfro do outro); só o fundo, no
      // meio dos 0,40 m, cai `CB_V_FUNDO`.
      const meio = off - lado * CB_SARJETA * 0.5
      deitado(guiaPiso, off - lado * CB_SARJETA, meio, baixo + FOLGA, baixo + FOLGA - CB_V_FUNDO,
              ax, az, bx, bz, px, pz, esc, vA, vB)
      deitado(guiaPiso, meio, off, baixo + FOLGA - CB_V_FUNDO, baixo + FOLGA,
              ax, az, bx, bz, px, pz, esc, vA, vB)
    } else {
      deitado(guiaPiso, off - lado * CB_SARJETA, off, baixo + FOLGA, baixo + FOLGA,
              ax, az, bx, bz, px, pz, esc, vA, vB)
    }
    deitado(guiaPiso, off, off + lado * CB_CHANFRO, yT - CB_CHANFRO, yT,
            ax, az, bx, bz, px, pz, esc, vA, vB)
    deitado(guiaPiso, off + lado * CB_CHANFRO, off + lado * CB_TOPO, yT, yT,
            ax, az, bx, bz, px, pz, esc, vA, vB)
    const fx0 = ax + px * off, fz0 = az + pz * off
    const fx1 = bx + px * off, fz1 = bz + pz * off
    const h0 = cotaVia(fx0, fz0), h1 = cotaVia(fx1, fz1)
    paredeVert(guia, fx0, fz0, fx1, fz1,
               h0 + baixo, h0 + yT - CB_CHANFRO,
               h1 + baixo, h1 + yT - CB_CHANFRO,
               -lado * px, -lado * pz)
  }

  // ── o ombro: a berma e o talude que costuram a via ao chão ───────────────
  /** cota de um ponto do ombro: `terreno` manda assentar no chão, senão é a via */
  const cotaOmbro = (x: number, z: number, terreno: boolean, ref: number) => {
    if (!terreno) return cotaVia(x, z) + OMBRO_ALT
    const y = cotaVia(x, z) + OMBRO_POUSO
    // ⚠️ ver a nota do OMBRO_DESNIVEL: sem esta trava o talude vira parede.
    return Math.min(ref + OMBRO_DESNIVEL, Math.max(ref - OMBRO_DESNIVEL, y))
  }
  /**
   * Um quad de ombro entre dois offsets da seção.
   *
   * ⚠️ A ORDEM É A MESMA DE `faixa` e de `deitado`: menor offset, maior offset, e
   * só então ao longo da via. Inverter devolve normal para baixo e o quad some no
   * culling, que é a armadilha registrada em pracas.ts:98.
   */
  const bandaOmbro = (
    fita: Fita, cor: THREE.Color,
    x0: number, z0: number, x1: number, z1: number,
    px: number, pz: number, oa: number, ob: number,
    terrA: boolean, terrB: boolean, vA: number, vB: number,
  ) => {
    const de = Math.min(oa, ob), ate = Math.max(oa, ob)
    const tde = oa <= ob ? terrA : terrB, tate = oa <= ob ? terrB : terrA
    const esc = fita.escala || 1
    const pax = x0 + px * de, paz = z0 + pz * de
    const pbx = x0 + px * ate, pbz = z0 + pz * ate
    const pcx = x1 + px * ate, pcz = z1 + pz * ate
    const pdx = x1 + px * de, pdz = z1 + pz * de
    // a referência do desnível é a cota da VIA no início da banda, não a média
    const refA = cotaVia(pax, paz) + OMBRO_ALT
    const refB = cotaVia(pdx, pdz) + OMBRO_ALT
    fita.comUV(de / esc, vA / esc, ate / esc, vA / esc, ate / esc, vB / esc, de / esc, vB / esc)
      .add(cor,
        pax, cotaOmbro(pax, paz, tde, refA), paz,
        pbx, cotaOmbro(pbx, pbz, tate, refA), pbz,
        pcx, cotaOmbro(pcx, pcz, tate, refB), pcz,
        pdx, cotaOmbro(pdx, pdz, tde, refB), pdz)
  }
  /**
   * Os dois ombros de um trecho reto de via, um por borda da seção.
   *
   * ⚠️ O OMBRO NÃO ATRAVESSA ÁGUA. Sobre a baía a via vira ponte, e ponte não tem
   * talude: uma berma de 9 m seguindo o tabuleiro seria uma saia verde boiando
   * sobre a lâmina. O teste é no PÉ do talude, que é a parte que primeiro sai do
   * aterro e entra na água.
   */
  const ombros = (
    x0: number, z0: number, x1: number, z1: number,
    px: number, pz: number, de0: number, ate0: number,
    larg: number, soleira: number, vA: number, vB: number,
  ) => {
    if (larg <= 0) return
    // ⚠️ A BOCA DO CRUZAMENTO: ver a nota de `noAnelDaTeia` lá em cima. `ombros` é
    // chamado só pela AVENIDA (o anel viário monta a berma dele à mão, na seção
    // 2b), e a avenida é radial: quem a cruza é sempre um arco da teia, sempre em
    // cima de um dos 27 raios. A granularidade é a do passo de `faixa` (24 m), o
    // que abre uma boca um pouco mais larga que os 20 m pedidos, que é
    // exatamente o que uma esquina de arterial parece.
    if (noAnelDaTeia((x0 + x1) / 2, (z0 + z1) / 2)) return
    for (const lado of [-1, 1] as const) {
      const base = lado < 0 ? de0 : ate0
      const pe = base + lado * larg
      if (sobreAgua(x0 + px * pe, z0 + pz * pe)) continue
      let borda = base
      if (soleira > 0) {
        const s = base + lado * soleira
        bandaOmbro(fitaDe('calcada'), COR.calcada, x0, z0, x1, z1, px, pz, base, s, false, false, vA, vB)
        borda = s
      }
      bandaOmbro(fitaDe('canteiro'), COR.canteiro, x0, z0, x1, z1, px, pz, borda, pe, false, true, vA, vB)
    }
  }

  // ── o gerador de faixa: um eixo, uma seção, o relevo de verdade ───────────
  // A linha t=0 é a BORDA da via, não o eixo: é assim que a seção fica escrita
  // como "de 0 até 2,5 é calçada", que é como um projeto de via se lê.
  // pular(x,z) decide segmento a segmento; quando um segmento cai fora, a seção
  // inteira cai junto, senão a calçada continuaria dentro do lago sem a pista.
  const faixa = (
    ax: number, az: number, bx: number, bz: number,
    perpX: number, perpZ: number, secao: Banda[],
    respeitaBulevar = true,
    /** largura do ombro em cada borda; 0 desliga (ver a nota do OMBRO_BULEVAR) */
    ombro = 0,
    /** soleira clara rente à calçada, dentro do ombro */
    soleira = 0,
    /** ⚠️ CORTE DE VERDADE (Bloco B, atrás de `?corte=1`): crista a `ABAUL_PCT`
     *  no meio de cada banda de pista. DESLIGADO por padrão de propósito: quem
     *  usa `faixa` pra bulevar e avenida pinta eixo e faixa de pedestre com
     *  `pontoVia`, que lê a altura pela banda FLAT (ver a nota grande dali) e
     *  não sabe da crista. Ligar aqui sem mexer em `pontoVia` enterraria a
     *  tinta sob o asfalto. Só o contorno de quarteirão, que não pinta nada,
     *  liga isto hoje. */
    abaular = false,
    /** ⚠️ REBAIXAMENTO NAS PONTAS (Tarefa 3, 02/09), rampa 1:12. Distância em
     *  metros, medida A PARTIR DE CADA PONTA do trilho (s=0 e s=comp), em que
     *  o meio-fio e a calçada descem de volta pra cota da pista. O número não
     *  é escolhido: é o próprio degrau já declarado (Y_CALCADA-Y_PISTA=0,15m)
     *  dividido pela rampa que a tarefa pediu (1:12) = 1,8 m. Só o contorno
     *  de quarteirão liga isto (as pontas do trilho SÃO os quatro cantos do
     *  quarteirão); bulevar e anel não têm ponta no meio do próprio trilho. */
    rampaExtremos = 0,
  ): Trilho => {
    // ⚠️ O PASSO SAI DO COMPRIMENTO, E ISTO FOI MEDIDO, NÃO ESTIMADO. Com 4
    // passos fixos o lado de 168 m virava trechos de 42 m, e uma faixa plana de
    // 42 m passa POR BAIXO da lombada do regolito no meio do vão: sonda de 4.000
    // pontos achou terreno furando a PISTA em 12,7% das amostras, até 1,00 m
    // acima dela, e a calçada em 5,5%. Não adianta subir a cota (a pista tem de
    // ficar abaixo da calçada, que tem de ficar abaixo do plinto de 0,45): o
    // conserto é encurtar a corda, e o erro cai com o QUADRADO do vão.
    const comp = Math.hypot(bx - ax, bz - az)
    const passos = Math.max(2, Math.ceil(comp / PASSO))
    const larg = secao[secao.length - 1].ate
    const meioSec = larg / 2
    const desenhado: boolean[] = new Array(passos).fill(false)
    for (let k = 0; k < passos; k++) {
      const t0 = k / passos, t1 = (k + 1) / passos
      const x0 = ax + (bx - ax) * t0, z0 = az + (bz - az) * t0
      const x1 = ax + (bx - ax) * t1, z1 = az + (bz - az) * t1
      const mx = (x0 + x1) / 2 + perpX * meioSec, mz = (z0 + z1) / 2 + perpZ * meioSec
      if (Math.hypot(mx, mz) > rMax) continue
      // ⚠️ A AVENIDA PARA NA ORLA. Ver `bloqueiaMalha` nas opções: era só a
      // baía, e agora é todo corpo cujo vão passa de `LIMIAR_PONTE`.
      if (paraNaAgua(mx, mz)) continue
      // ⚠️ A PARCELA NÃO CORTA A AVENIDA. Auditado por raycast em 31/08: 15
      // interrupções nas 12 avenidas, com vãos de até 600 m, todas onde uma
      // parcela do programa cai em cima da via. A rua é a estrutura primária
      // desta cidade e o programa é o que sobra entre ruas — se os dois brigam,
      // quem cede é a parcela. Cortar a avenida quebra a regra que o fundador
      // cobra: "um carro tem que conseguir transitar entre todas as estradas do
      // mapa".
      if (respeitaBulevar && noBulevar(mx, mz)) continue
      desenhado[k] = true
      metros += Math.hypot(x1 - x0, z1 - z0)
      // ⚠️ O v DO UV É O METRO AO LONGO DA VIA, CONTADO DO INÍCIO DO TRILHO, e
      // não o t normalizado: com t o ladrilho esticaria conforme o comprimento do
      // trecho e a emenda entre dois passos apareceria como salto de escala.
      const vA = t0 * comp, vB = t1 * comp
      // ⚠️ TAREFA 3: fRampa VAI DE 0 (na ponta do trilho) A 1 (a partir de
      // `rampaExtremos` metros dela pra dentro). É a MESMA fração pras três
      // coisas que a esquina precisa mexer junto: a altura da calçada, a
      // altura do meio-fio e (mais abaixo, fora deste laço) a crista do
      // abaulamento: as três têm de chegar a ZERO exatamente na ponta, ou o
      // canto arredondado que `?corte=1` desenha lá fora ganha um degrau.
      const sMeio = ((t0 + t1) / 2) * comp
      const distExtremo = rampaExtremos > 0 ? Math.min(sMeio, comp - sMeio) : Infinity
      const fRampa = rampaExtremos > 0 ? Math.min(1, distExtremo / rampaExtremos) : 1
      const rampaAtiva = CORTE1 && rampaExtremos > 0 && fRampa < 1
      for (let i = 0; i < secao.length; i++) {
        const s = secao[i]
        const prox = secao[i + 1]
        // ⚠️ SÓ A BANDA MAIS ALTA DA DUPLA DESCE (a calçada, nunca a pista: a
        // pista já É a cota de chegada da rampa). Sem `prox` (última banda da
        // seção) não há dupla pra ramp ar, então não mexe.
        const altBanda = rampaAtiva && prox && s.alt > prox.alt
          ? prox.alt + (s.alt - prox.alt) * fRampa
          : s.alt
        const pax = x0 + perpX * s.de, paz = z0 + perpZ * s.de
        const pbx = x0 + perpX * s.ate, pbz = z0 + perpZ * s.ate
        const pcx = x1 + perpX * s.ate, pcz = z1 + perpZ * s.ate
        const pdx = x1 + perpX * s.de, pdz = z1 + perpZ * s.de
        const ft = fitaDe(s.alvo)
        const esc = ft.escala || 1
        // ⚠️ A ORDEM DOS t É A ORDEM DOS CANTOS DESTE `add`, e ela não é a mesma
        // do anel (lá é ângulo primeiro). Trocar as duas espelha a trilha de
        // pneu, que numa faixa simétrica não aparece, mas na sarjeta sim.
        if (CORTE1 && abaular && s.alvo === 'pista') {
          // ⚠️ ABAULAMENTO, item 1 do Bloco B. A BORDA (s.de e s.ate) fica
          // EXATAMENTE em `s.alt`, sem mudar: é dali que o degrau do meio-fio
          // e a máscara leem a altura, e as duas contas continuam corretas sem
          // saber que a crista existe. Só o MEIO sobe `ABAUL_PCT` por metro de
          // meia-largura, então a banda vira dois quads (borda -> meio,
          // meio -> borda) em vez de um, com a normal da luz rasante fazendo o
          // resto: `computeVertexNormals` no fim de `Fita.malha` lê a
          // inclinação de verdade, não precisa de mapa de normal pra isso.
          // ⚠️ E A CRISTA TAMBÉM SOME NA PONTA (`* fRampa`), senão ela desenha
          // um lombo entrando bem no meio do leque arredondado da esquina, que
          // lá fora é chapado.
          const meio = (s.de + s.ate) / 2
          const crista = s.alt + ((s.ate - s.de) / 2) * ABAUL_PCT * fRampa
          const tMeio = 0.4995        // ligeiramente antes de 0,5: mesma razão do 0,999 de comBanda
          const meiaBanda = (oa: number, ob: number, altA: number, altB: number, ta: number, tb: number) => {
            const qax = x0 + perpX * oa, qaz = z0 + perpZ * oa
            const qbx = x0 + perpX * ob, qbz = z0 + perpZ * ob
            const qcx = x1 + perpX * ob, qcz = z1 + perpZ * ob
            const qdx = x1 + perpX * oa, qdz = z1 + perpZ * oa
            ft.comBanda(s.ate - s.de, ta, tb, tb, ta)
              .comUV(oa / esc, vA / esc, ob / esc, vA / esc, ob / esc, vB / esc, oa / esc, vB / esc)
              .add(COR[s.alvo],
                qax, cotaVia(qax, qaz) + altA, qaz,
                qbx, cotaVia(qbx, qbz) + altB, qbz,
                qcx, cotaVia(qcx, qcz) + altB, qcz,
                qdx, cotaVia(qdx, qdz) + altA, qdz)
          }
          meiaBanda(s.de, meio, s.alt, crista, 0, tMeio)
          meiaBanda(meio, s.ate, crista, s.alt, tMeio, 0.999)
        } else {
          ft.comBanda(s.ate - s.de, 0, 1, 1, 0)
            .comUV(s.de / esc, vA / esc, s.ate / esc, vA / esc,
                   s.ate / esc, vB / esc, s.de / esc, vB / esc)
            .add(COR[s.alvo],
              pax, cotaVia(pax, paz) + altBanda, paz,
              pbx, cotaVia(pbx, pbz) + altBanda, pbz,
              pcx, cotaVia(pcx, pcz) + altBanda, pcz,
              pdx, cotaVia(pdx, pdz) + altBanda, pdz,
            )
        }
        // ⚠️ A MÁSCARA SÓ CONHECE O QUE SAIU. Estamos DEPOIS de todos os
        // `continue` deste passo, ou seja `desenhado[k]` já é true: marcar antes
        // deles cobriria rua que a baía, a borda ou a avenida cortaram, e a
        // arborização deixaria de plantar num terreno vazio.
        if (mascaravel(s.alvo)) marcarVia(codigoDe(s.alvo), pax, paz, pbx, pbz, pcx, pcz, pdx, pdz)
        // o meio-fio, no degrau entre esta banda e a próxima
        if (prox && prox.alt !== s.alt) {
          const altoNominal = Math.max(s.alt, prox.alt), baixo = Math.min(s.alt, prox.alt)
          // ⚠️ TAREFA 3: A ALTURA DO DEGRAU ENCOLHE COM `fRampa`, NÃO SÓ A
          // CALÇADA. Rampa de 1:12 é FACE, não platô: se só a calçada descesse
          // e o meio-fio continuasse com o degrau nominal de 0,15 m, a rampa
          // ficaria mais íngreme que a calçada que ela carrega. `baixo` nunca
          // muda (é sempre a cota da pista), então em `fRampa=0` a soma dá
          // `alto=baixo`: o meio-fio funde na pista, exatamente onde o leque
          // arredondado de fora começa.
          const alto = rampaAtiva ? baixo + (altoNominal - baixo) * fRampa : altoNominal
          if (look2) {
            meioFio(x0, z0, x1, z1, s.ate, prox.alt > s.alt ? 1 : -1,
                    baixo, alto, perpX, perpZ, vA, vB)
          } else {
            const h0 = cotaVia(pbx, pbz), h1 = cotaVia(pcx, pcz)
            guia.add(COR.meiofio,
              pbx, h0 + baixo, pbz, pbx, h0 + alto, pbz,
              pcx, h1 + alto, pcz, pcx, h1 + baixo, pcz,
            )
          }
        }
        // ⚠️ O PARAPEITO SÓ EXISTE SOBRE A ÁGUA, e é ele que faz a travessia LER
        // como ponte em vez de aterro. 1,1 m, nas duas bordas da seção.
        if ((i === 0 || i === secao.length - 1) && sobreAgua(pax, paz)) {
          const bx2 = i === 0 ? pax : pbx, bz2 = i === 0 ? paz : pbz
          const cx2 = i === 0 ? pdx : pcx, cz2 = i === 0 ? pdz : pcz
          const y0 = cotaVia(bx2, bz2) + s.alt, y1 = cotaVia(cx2, cz2) + s.alt
          guia.addV(COR.meiofio,
            bx2, y0, bz2, bx2, y0 + 1.1, bz2,
            cx2, y1 + 1.1, cz2, cx2, y1, cz2,
          )
          // o PILAR, a cada dois passos: desce do tabuleiro até o leito
          if (i === 0 && k % 2 === 0) {
            const fundo = o.heightAt(bx2, bz2)
            const lx = perpX * 2.2, lz = perpZ * 2.2
            guia.addV(COR.meiofio,
              bx2 - lx, fundo, bz2 - lz, bx2 - lx, y0, bz2 - lz,
              bx2 + lx, y0, bz2 + lz, bx2 + lx, fundo, bz2 + lz,
            )
          }
        }
      }
      // ⚠️ O OMBRO SAI DEPOIS DA SEÇÃO E DENTRO DO MESMO PASSO, senão ele não
      // sabe quais trechos a baía, a borda e a parcela cortaram, e a berma
      // continuaria correndo verde onde a pista já tinha parado.
      ombros(x0, z0, x1, z1, perpX, perpZ,
             secao[0].de, secao[secao.length - 1].ate, ombro, soleira, vA, vB)
    }
    return { ax, az, bx, bz, perpX, perpZ, comp, passos, secao, desenhado }
  }

  // ── a altura EXATA do plano da via, e por que ela não pode ser heightAt ───
  // ⚠️ TODA MARCA PINTADA TEM DE SE APOIAR NO PLANO DO QUAD DA PISTA, NÃO NA
  // SUPERFÍCIE. A pista é uma corda de até 24 m sobre um terreno curvo: um ponto
  // no meio do vão está no plano do quad, não em heightAt, e a diferença chega a
  // dezenas de centímetros. Uma marca posta em heightAt+0,02 some por dentro da
  // pista exatamente onde o vão é mais fundo. Aqui a conta refaz a triangulação
  // do quad (o Fita.add liga a-b-c e a-c-d, ou seja a diagonal é a-c) e devolve
  // o ponto no plano do triângulo certo, com erro zero por construção.
  const pontoVia = (tr: Trilho, s: number, off: number, sobe: number): [number, number, number] => {
    const t = Math.min(1, Math.max(0, s / tr.comp))
    const k = Math.min(tr.passos - 1, Math.max(0, Math.floor(t * tr.passos)))
    const u = t * tr.passos - k
    let banda = tr.secao[0]
    for (const b of tr.secao) if (off >= b.de && off <= b.ate) { banda = b; break }
    const v = (off - banda.de) / (banda.ate - banda.de)
    const t0 = k / tr.passos, t1 = (k + 1) / tr.passos
    const px0 = tr.ax + (tr.bx - tr.ax) * t0, pz0 = tr.az + (tr.bz - tr.az) * t0
    const px1 = tr.ax + (tr.bx - tr.ax) * t1, pz1 = tr.az + (tr.bz - tr.az) * t1
    const hA = o.heightAt(px0 + tr.perpX * banda.de, pz0 + tr.perpZ * banda.de)
    const hB = o.heightAt(px0 + tr.perpX * banda.ate, pz0 + tr.perpZ * banda.ate)
    const hC = o.heightAt(px1 + tr.perpX * banda.ate, pz1 + tr.perpZ * banda.ate)
    const hD = o.heightAt(px1 + tr.perpX * banda.de, pz1 + tr.perpZ * banda.de)
    // baricêntrica no quadrado unitário: a=(0,0) b=(0,1) c=(1,1) d=(1,0)
    const h = v >= u
      ? hA * (1 - v) + hB * (v - u) + hC * u
      : hA * (1 - u) + hC * v + hD * (u - v)
    const px = tr.ax + (tr.bx - tr.ax) * t + tr.perpX * off
    const pz = tr.az + (tr.bz - tr.az) * t + tr.perpZ * off
    return [px, h + banda.alt + sobe, pz]
  }
  /** true se o segmento que contém este ponto do trilho foi realmente desenhado */
  const trechoVivo = (tr: Trilho, s: number) => {
    const t = Math.min(1, Math.max(0, s / tr.comp))
    const k = Math.min(tr.passos - 1, Math.max(0, Math.floor(t * tr.passos)))
    return tr.desenhado[k]
  }
  /** um retângulo deitado na via, em (metro ao longo, metro através) */
  const retangulo = (fita: Fita, cor: THREE.Color, tr: Trilho,
                     s0: number, s1: number, o0: number, o1: number, sobe: number) => {
    const a = pontoVia(tr, s0, o0, sobe)
    const b = pontoVia(tr, s0, o1, sobe)
    const c = pontoVia(tr, s1, o1, sobe)
    const d = pontoVia(tr, s1, o0, sobe)
    fita.add(cor, a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2], d[0], d[1], d[2])
  }

  // ── 1. O DESENHO POR QUARTEIRÃO SAIU INTEIRO ──────────────────────────────
  //
  // ⚠️ ERA O ÚLTIMO RESTO DA ARQUITETURA ANTIGA, e ele explica o que o fundador
  // viu em 31/08: "temos radiais sem a menor conexão, algumas formam quarteirões
  // absolutamente pequenos". Este bloco desenhava, POR QUARTEIRÃO da grade do
  // GERADOR, a meia-seção de contorno nos quatro lados mais duas travessas
  // internas. Ele já não tinha dono desde que a teia passou a ser desenhada dos
  // 26 anéis e dos radiais: as duas grades não coincidem, então cada travessa
  // dele virava um traço solto por cima da teia, e cada meia-seção virava uma
  // rua de 6 m encostada em nada.
  //
  // A regra que ficou vale para a cidade inteira: A RUA VEM DA TEIA, e mais nada
  // desenha rua. Quem quiser rua nova acrescenta anel ou radial em `teia.ts`.
  //
  // ⚠️ A TRAVESSIA ELEVADA foi junto, e por consequência: ela era cotada contra a
  // boca da travessa deste bloco. Quando a teia tiver faixa de pedestre, ela
  // nasce do cruzamento anel × radial, que é um lugar que existe.
  let nq = malha.quarteiroes.length
  let travessias = 0

  // ── 1c. A TEIA FINA SAIU. FICAM SÓ AS VIAS PRINCIPAIS ─────────────────────
  //
  // ⚠️ DECISÃO DO FUNDADOR, 31/08: "milhares de ruas estreitas sem a menor
  // conexão. Criemos algo macro que funcione, depois escalamos. Já sabemos que
  // todas as carteiras cabem aí dentro com folga. Vamos criar apenas as vias
  // principais, em nível AAA+."
  //
  // ⚠️ E A DECISÃO É BOA, PORQUE A VIA PRINCIPAL JÁ ESTAVA PRONTA E BEM FEITA. A
  // cidade tem, desenhados nas seções 2 e 2b com marcação de eixo, canteiro,
  // meio-fio e ROTATÓRIA em cada cruzamento:
  //     7 anéis viários   (Interior 1.750 · Médio 2.750 · Exterior 3.750 ·
  //                        Cinturão 4.450 · Doca 5.620 · Escoamento 6.300 ·
  //                        Serviço 7.600), de 26 a 34 m
  //     9 bulevares       (34 a 44 m, com canteiro central), r 1.420 a 6.900
  //     63 cruzamentos, todos com rotatória
  // Isso é a estrutura macro de uma cidade de 14 km, e é AAA porque cada peça
  // dela tem seção cotada, não porque tem muita linha.
  //
  // ⚠️ O QUE SAIU E POR QUÊ: a teia de 27 anéis × 168 radiais. Ela nasceu para
  // fechar o X em todo cruzamento e chegou lá, mas a densidade estava errada para
  // o momento: rua de 12 m a cada 108 m em 156 km² dá dezenas de milhares de
  // trechos, e qualquer defeito de um deles vira "milhares de ruas sem conexão"
  // na chapa. Cidade se desenha do macro para o micro; a teia fina volta quando o
  // lote voltar, e aí ela nasce DENTRO do quarteirão que as vias principais já
  // delimitaram, não competindo com elas.
  //
  // O que fica registrado para quando ela voltar (`teia.ts` continua no
  // repositório, com os números medidos):
  //   · o anel é POLÍGONO, não círculo — a teia tem arestas retas;
  //   · o radial nasce EM CIMA de um anel, nunca num raio redondo (nascer 56 m
  //     fora do anel foi o que criou radial sem conexão e quarteirão de 56 m);
  //   · subdividir é preciso, mas a interpolação é CARTESIANA, senão a corda
  //     volta a virar arco.

  // ── 1b. A VIA EM VOLTA DA PRAÇA DE QUARTO FOI REMOVIDA ────────────────────
  // ⚠️ NÃO É PODA, É CONSEQUÊNCIA. A praça de quarto era a célula central de cada
  // quarto 3x3, que nunca recebia lote: um buraco a cada 540 m em fileira
  // perfeita, que na planta lia como poá e foi o que o fundador chamou de
  // carimbado. O verde agora é `parques`, poucos e escolhidos, e quem desenha é
  // pracas.ts. Sem quarto não há anel de quarto.

  // ── 2. os 12 bulevares de costura, e só eles ganham marcação ──────────────
  // ⚠️ ELES SAEM DE tecido.ts E PASSAM A MORAR AQUI. Lá a pista era desenhada
  // ACIMA do meio-fio (pista em +0,45 e guia em +0,30), ou seja a seção estava de
  // cabeça para baixo e a via ficava um planalto claro com moldura escura. Se os
  // dois módulos desenharem bulevar ao mesmo tempo as faixas brigam no z-buffer.
  const marcas: { fita: Fita; centro: THREE.Vector3 }[] = []
  let eixos = 0, faixasPed = 0
  for (const b of malha.bulevares) {
    const ang = (b.rumo * Math.PI) / 180
    const perpX = Math.cos(ang), perpZ = Math.sin(ang)
    const dirX = Math.sin(ang), dirZ = -Math.cos(ang)
    const larg = b.largura ?? K.bulevar
    const esc = larg / SEC_BULEVAR[SEC_BULEVAR.length - 1].ate
    const secao = esc === 1 ? SEC_BULEVAR : SEC_BULEVAR.map((s) => ({ ...s, de: s.de * esc, ate: s.ate * esc }))
    // a linha t=0 é a borda esquerda: recua meia largura do eixo
    const tr = faixa(b.x0 - perpX * larg / 2, b.z0 - perpZ * larg / 2,
                     b.x1 - perpX * larg / 2, b.z1 - perpZ * larg / 2,
                     perpX, perpZ, secao, false,
                     // ⚠️ O OMBRO ACOMPANHA A ESCALA DA SEÇÃO. As avenidas vão de
                     // 34 a 44 m e a seção é reescalada por `esc`; um ombro fixo
                     // de 9 m deixaria a avenida de 44 m com berma
                     // proporcionalmente mais estreita que a de 34, que é
                     // exatamente a uniformidade que estamos consertando.
                     OMBRO_BULEVAR * esc, OMBRO_SOLEIRA * esc)

    // ⚠️ A MARCA NÃO GANHA TEXTURA, E É DECISÃO, NÃO ESQUECIMENTO. Ela é tinta
    // de 0,60 m de largura sobre asfalto: qualquer ladrilho de 4 a 9 m dentro
    // dela é um borrão, e vesti-la custaria um material com defines diferentes,
    // ou seja um programa novo. Ela fica chapada, com a rugosidade um pouco mais
    // baixa que a da pista, que é o que a tinta faz de verdade na luz rasante.
    const fita = new Fita(0, !look2)
    // as duas pistas do bulevar: bandas 1 e 3 da seção
    const pistas = [secao[1], secao[3]]

    // ── faixa de pedestre: só onde o bulevar cruza um contorno de QUARTO ────
    // ⚠️ MARCAÇÃO VIÁRIA É PRIVILÉGIO DO BULEVAR. Pintar eixo ou faixa em via
    // local de 7 m dá a ela a linguagem de arterial e apaga a hierarquia
    // bulevar > contorno > travessa que a malha construiu.
    // Os cruzamentos saem dos DADOS, não de um passo inventado: cada quarto tem
    // 540 m de lado, então a divisa dele cruza a costura a 270 m do centro
    // projetado no eixo do bulevar. Os dois setores vizinhos têm grades giradas
    // (7,5 graus por setor), então as duas famílias de divisa não coincidem e é
    // por isso que sai cerca de uma faixa a cada 250 m e não a cada 540.
    // ⚠️ A TRAVESSIA VINHA DOS QUARTOS, QUE NÃO EXISTEM MAIS. Ela nasce onde uma
    // rua do tecido encosta na avenida, e quem sabe disso agora é o QUARTEIRÃO:
    // cada bloco vizinho da avenida projeta a sua divisa sobre o eixo dela. O
    // passo deixa de ser fixo em 270 m e passa a ser meio quarteirão, que muda
    // por banda, então a travessia aparece onde a rua de fato chega.
    const cruz: number[] = []
    for (const q of malha.quarteiroes) {
      const off = q.x * perpX + q.z * perpZ
      if (Math.abs(off) > q.lado + 60) continue
      const ao = q.x * dirX + q.z * dirZ
      const meio = q.lado / 2 + 6
      for (const r of [ao - meio, ao + meio]) {
        if (r < b.rInicio + 80 || r > b.rFim - 80) continue
        if (cruz.some((c) => Math.abs(c - r) < 70)) continue
        cruz.push(r)
      }
    }
    cruz.sort((x, y) => x - y)
    for (const r of cruz) {
      const s = r - b.rInicio
      if (!trechoVivo(tr, s)) continue
      const span = FAIXA_BARRAS * FAIXA_LARG + (FAIXA_BARRAS - 1) * FAIXA_VAO
      for (const p of pistas) {
        for (let i = 0; i < FAIXA_BARRAS; i++) {
          const s0 = s - span / 2 + i * (FAIXA_LARG + FAIXA_VAO)
          retangulo(fita, COR.marca, tr, s0, s0 + FAIXA_LARG, p.de + 0.05, p.ate - 0.05, FOLGA)
        }
      }
      faixasPed++
    }

    // ── eixo tracejado, um por pista ────────────────────────────────────────
    // ⚠️ AQUI EU DESVIEI DA SPEC E O MOTIVO É FÍSICO. A spec 3.6 pede o eixo
    // "sobre o eixo do canteiro" mas na cota Y_PISTA + 0,02 e na razão de
    // contraste marca/PISTA: as três coisas não cabem juntas, porque o eixo do
    // canteiro é terra a 0,40 e uma linha a 0,20 nasceria enterrada nele. Linha
    // tracejada é divisória de faixa e mora no asfalto, então ela vai no meio de
    // cada uma das duas pistas de 10 m, que é exatamente a broken lane line do
    // MUTCD. Custa 12.384 triângulos em vez dos 6.200 previstos, o que é ruído
    // perto do saldo de -790 mil da rodada.
    const periodo = EIXO_MARCA + EIXO_VAO
    for (const p of pistas) {
      const centroPista = (p.de + p.ate) / 2
      for (let s = 0; s + EIXO_MARCA < tr.comp; s += periodo) {
        if (!trechoVivo(tr, s + EIXO_MARCA / 2)) continue
        // nunca em cima de uma faixa de pedestre: paint sobre paint é borrão
        if (cruz.some((c) => Math.abs(c - b.rInicio - (s + EIXO_MARCA / 2)) < 9)) continue
        retangulo(fita, COR.marca, tr, s, s + EIXO_MARCA,
                  centroPista - EIXO_LARG / 2, centroPista + EIXO_LARG / 2, FOLGA)
        eixos++
      }
    }
    if (!fita.vazia) {
      const mx = (tr.ax + tr.bx) / 2 + perpX * larg / 2
      const mz = (tr.az + tr.bz) / 2 + perpZ * larg / 2
      marcas.push({ fita, centro: new THREE.Vector3(mx, o.heightAt(mx, mz), mz) })
    }
  }

  // ── 2b. OS ANÉIS: POLÍGONO QUE LIGA AS ROTATÓRIAS EM RETA ────────────────
  //
  // ⚠️ FUNDADOR, 31/08: "ligue os cruzamentos em linha reta, sem arcos curvos,
  // teia é em linha reta". O anel deixa de ser um círculo amostrado em 96 passos
  // e passa a ser um POLÍGONO cujos vértices incluem, obrigatoriamente, os 9
  // cruzamentos com os bulevares. Entre duas rotatórias a via é uma reta.
  //
  // ⚠️ UM VÉRTICE POR ROTATÓRIA, E MAIS NADA. A primeira tentativa subdividiu
  // cada vão até a flecha da corda ficar abaixo de 8 m, e o resultado é que o
  // anel voltou a parecer círculo — o fundador viu na hora: "não mostra polígonos
  // não, você tá viajando, eu ainda vejo as avenidas todas em curva". Ele tem
  // razão: uma flecha invisível é, por definição, um círculo. Se a teia é em reta,
  // a reta tem de APARECER.
  //
  // Com as 12 avenidas a 30°, cada anel é um DODECÁGONO REGULAR. A flecha vai de
  // 60 m no Anel Interior a 259 m na Pista de Serviço: bem visível, que é o
  // ponto. O raio do anel passa a ser o do VÉRTICE, e o meio da aresta fica
  // cos(15°) = 96,6% dele.
  const _bulRumos = (malha.bulevares ?? []).map((b: Bulevar) => b.rumo)
    .sort((x: number, y: number) => x - y)
  /** os vértices do polígono de um anel: exatamente as rotatórias */
  const verticesDoAnel = (_raio: number): number[] => {
    const base = _bulRumos.length ? _bulRumos : [0, 90, 180, 270]
    return base.map((g) => (g * Math.PI) / 180)
  }
  // ⚠️ O ANEL PARA NA BOCA DA ROTATÓRIA. Sem isso a faixa dele passaria por cima
  // da faixa do bulevar, duas superfícies coplanares no mesmo Y, e o z-buffer
  // decide por pixel: aparece listra piscando exatamente no cruzamento, que é
  // onde o olho vai.
  let nAneis = 0, nRot = 0
  /** os centros das rotatórias desenhadas, em pares (x,z): a teia da seção 2c
   *  precisa deles para não passar por baixo do disco */
  const rotCentros: number[] = []
  for (const an of meta.aneis ?? []) {
    const esc = an.larg / SEC_ANEL[SEC_ANEL.length - 1].ate
    const secao = esc === 1 ? SEC_ANEL : SEC_ANEL.map((b) => ({ ...b, de: b.de * esc, ate: b.ate * esc }))
    const r0 = an.r - an.larg / 2
    const verts = verticesDoAnel(an.r)
    const passos = verts.length
    let desenhou = false
    // ⚠️ CADA LADO SE SUBDIVIDE, E ISSO CONSERTA DOIS DEFEITOS DE UMA VEZ.
    //
    // O fundador, 31/08: "estrada faltando a sudeste... o mapa deve estar cheio
    // desses buracos ainda. Um carro tem que conseguir transitar entre todas as
    // estradas do mapa". Auditado por raycast: 14 lados de anel simplesmente NÃO
    // EXISTIAM, com vãos de até 3.240 m.
    //
    // A causa: o lado do polígono era UM QUAD de até 3.900 m e a máscara testava
    // só o PONTO MÉDIO dele. Uma parcela caindo no meio matava a avenida inteira
    // entre duas rotatórias. Teste pontual em geometria longa é sempre isso.
    //
    // E o segundo defeito era o mesmo quad: 3.900 m de corda sobre terreno que
    // ondula 25 m fica ora boiando ora enterrado no meio do vão.
    //
    // ⚠️ A SUBDIVISÃO É CARTESIANA, entre as duas pontas da corda — interpolar o
    // ÂNGULO devolveria a curva que a teia acabou de perder.
    for (let k = 0; k < passos; k++) {
      const a0 = verts[k], a1 = verts[(k + 1) % passos] + (k + 1 === passos ? Math.PI * 2 : 0)
      const am = (a0 + a1) / 2
      const mx = Math.sin(am) * an.r, mz = -Math.cos(am) * an.r
      // ⚠️ A PARCELA NÃO CORTA VIA PRINCIPAL. A rua é a estrutura primária desta
      // cidade e o programa é o que sobra entre ruas: se uma parcela cai em cima
      // de uma avenida, quem cede é a parcela. Cortar a avenida quebra a regra
      // que o fundador cobra, que é poder dirigir de qualquer ponto a qualquer
      // ponto. `emPeca` continua valendo para o que não é via principal.
      void mx; void mz
      // a boca da rotatória: o anel para antes de entrar no bulevar
      let naBoca = false
      for (let b = 0; b < 12; b++) {
        const d = Math.abs(((am * 180) / Math.PI - b * 30 + 180) % 360 - 180)
        if ((d * Math.PI) / 180 * an.r < ROT_RAIO + 6) { naBoca = true; break }
      }
      if (naBoca) continue
      desenhou = true
      metros += an.r * (a1 - a0)
      const pt = (rr: number, aa: number) => [Math.sin(aa) * rr, -Math.cos(aa) * rr] as const
      const NSUB = Math.max(1, Math.round((2 * an.r * Math.sin((a1 - a0) / 2)) / PASSO))
      for (let i = 0; i < secao.length; i++) {
        const b = secao[i]
        const ra = r0 + b.de, rb = r0 + b.ate
        // ⚠️ ORDEM ANTI-HORÁRIA VISTA DE CIMA: ângulo primeiro, raio depois. A
        // ordem natural de escrever (raio, depois ângulo) dá normal para BAIXO e
        // o backface culling apaga o anel inteiro. Medido: com a ordem errada a
        // sonda vertical achava anel em 8 de 72 pontos, ou seja praticamente só
        // as rotatórias. É a MESMA armadilha de pracas.ts:98.
        // as quatro pontas da corda, nos dois raios da banda
        const [A0x, A0z] = pt(ra, a0), [A1x, A1z] = pt(ra, a1)
        const [B0x, B0z] = pt(rb, a0), [B1x, B1z] = pt(rb, a1)
        // o comprimento da corda deste lado: é ele que dá o v do UV em metros
        const cordaL = Math.hypot(A1x - A0x, A1z - A0z)
        for (let t = 0; t < NSUB; t++) {
          const u0 = t / NSUB, u1 = (t + 1) / NSUB
          const ax = A0x + (A1x - A0x) * u0, az = A0z + (A1z - A0z) * u0
          const dx = A0x + (A1x - A0x) * u1, dz = A0z + (A1z - A0z) * u1
          const cx = B0x + (B1x - B0x) * u1, cz = B0z + (B1z - B0z) * u1
          const bx = B0x + (B1x - B0x) * u0, bz = B0z + (B1z - B0z) * u0
          // ⚠️ O ANEL PARA NA ORLA, pelo mesmo motivo da avenida. O teste
          // é por SUBTRECHO, não pelo lado inteiro: um lado do dodecágono tem até
          // 3.900 m e pode entrar na baía por 300 m — matar o lado todo devolveria
          // o buraco de 3 km que a auditoria acabou de fechar.
          if (paraNaAgua((ax + cx) / 2, (az + cz) / 2)) continue
          // ⚠️ ORDEM ANTI-HORÁRIA VISTA DE CIMA: ângulo primeiro, raio depois. A
          // ordem natural de escrever (raio, depois ângulo) dá normal para BAIXO
          // e o backface culling apaga o anel inteiro. Mesma armadilha de
          // pracas.ts:98.
          // ⚠️ NO ANEL O u DO UV É O RAIO E O v É O ARCO, que é a mesma
          // convenção da avenida (u = seção, v = comprimento) girada 90 graus. Com
          // projeção XZ o sulco de roda do asfalto cortaria o anel na diagonal
          // em todos os lados do dodecágono menos dois.
          const ft = fitaDe(b.alvo)
          const esc = ft.escala || 1
          const vA = u0 * cordaL, vB = u1 * cordaL
          // ⚠️ NO ANEL OS CANTOS SAEM (de,vA) (de,vB) (ate,vB) (ate,vA): o t da
          // banda acompanha essa ordem, e não a de `faixa`.
          ft.comBanda(b.ate - b.de, 0, 0, 1, 1)
            .comUV(b.de / esc, vA / esc, b.de / esc, vB / esc,
                   b.ate / esc, vB / esc, b.ate / esc, vA / esc)
            .add(COR[b.alvo],
              // ⚠️ `cotaVia`, NÃO `heightAt`: sobre a baía o anel viria assentado
              // no LEITO, 50 m debaixo da lâmina. Ver a nota da ponte lá em cima.
              ax, cotaVia(ax, az) + b.alt, az,
              dx, cotaVia(dx, dz) + b.alt, dz,
              cx, cotaVia(cx, cz) + b.alt, cz,
              bx, cotaVia(bx, bz) + b.alt, bz)
          if (mascaravel(b.alvo)) marcarVia(codigoDe(b.alvo), ax, az, dx, dz, cx, cz, bx, bz)
          const prox = secao[i + 1]
          if (prox && prox.alt !== b.alt) {
            const alto = Math.max(b.alt, prox.alt), baixo = Math.min(b.alt, prox.alt)
            if (look2) {
              // ⚠️ A PERPENDICULAR DO ANEL É O RAIO, e ela é tomada no MEIO do
              // subtrecho. Os dois extremos têm raios ligeiramente diferentes,
              // mas o subtrecho tem no máximo 24 m sobre um raio de 1.750 m ou
              // mais (0,8 grau): a diferença sobre os 0,40 m da sarjeta é
              // milimétrica e uma normal só evita quebrar a guia em leque.
              const mxr = (bx + cx) / 2, mzr = (bz + cz) / 2
              const hr = Math.hypot(mxr, mzr) || 1
              meioFio(bx, bz, cx, cz, 0, prox.alt > b.alt ? 1 : -1,
                      baixo, alto, mxr / hr, mzr / hr, vA, vB)
            } else {
              const h0 = cotaVia(bx, bz), h1 = cotaVia(cx, cz)
              guia.add(COR.meiofio, bx, h0 + baixo, bz, bx, h0 + alto, bz,
                       cx, h1 + alto, cz, cx, h1 + baixo, cz)
            }
          }
        }
      }
      // ── o ombro do anel: berma de campo dos dois lados ──────────────────
      // ⚠️ MAIS ESTREITO QUE O DO BULEVAR E SEM SOLEIRA, E É ISSO QUE CRIA A
      // HIERARQUIA. Até 02/09 anel e bulevar tinham a MESMA seção (calçada,
      // pista, canteiro, pista, calçada) e só mudavam de largura: de cima os
      // dois liam como a mesma rua desenhada duas vezes.
      //
      // ⚠️ E O SENTIDO DO OMBRO DE FORA É INVERTIDO DE PROPÓSITO. `bandaOmbro`
      // emite raio primeiro e ângulo depois, que é a ordem ERRADA no anel (a
      // nota de duas seções acima: ângulo primeiro, raio depois). Para o lado de
      // dentro o sinal do raio já corrige sozinho; para o de fora o conserto é
      // percorrer a corda ao contrário, e aí a normal volta a apontar para cima.
      // Sem isto o backface culling apaga metade das bermas do anel, em silêncio.
      {
        const rIn = r0 + secao[0].de
        const rOut = r0 + secao[secao.length - 1].ate
        const largOmb = OMBRO_ANEL * esc
        for (const [rB, sinal] of [[rIn, -1], [rOut, 1]] as [number, number][]) {
          const [P0x, P0z] = pt(rB, a0), [P1x, P1z] = pt(rB, a1)
          const cordaL = Math.hypot(P1x - P0x, P1z - P0z)
          for (let t = 0; t < NSUB; t++) {
            const u0 = t / NSUB, u1 = (t + 1) / NSUB
            const qax = P0x + (P1x - P0x) * u0, qaz = P0z + (P1z - P0z) * u0
            const qdx = P0x + (P1x - P0x) * u1, qdz = P0z + (P1z - P0z) * u1
            const mxr = (qax + qdx) / 2, mzr = (qaz + qdz) / 2
            const hr = Math.hypot(mxr, mzr) || 1
            const nx = (mxr / hr) * sinal, nz = (mzr / hr) * sinal
            const px2 = mxr + nx * largOmb, pz2 = mzr + nz * largOmb
            if (paraNaAgua(px2, pz2)) continue
            if (sobreAgua(px2, pz2)) continue
            // ⚠️ A BOCA DO CRUZAMENTO, o par da que `ombros` abre na avenida. O
            // anel viário é tangencial, então quem o cruza é sempre um trecho
            // RADIAL da teia: a boca sai por rumo, não por raio. Sem ela a berma
            // de 5 a 6,5 m do anel fica atravessada na frente de cada radial que
            // chega, e o verde a 0,30 m fura o asfalto a 0,18 m.
            if (noRadialDaTeia(mxr, mzr)) continue
            if (sinal < 0) {
              bandaOmbro(fitaDe('canteiro'), COR.canteiro, qax, qaz, qdx, qdz, nx, nz,
                         0, largOmb, false, true, u0 * cordaL, u1 * cordaL)
            } else {
              bandaOmbro(fitaDe('canteiro'), COR.canteiro, qdx, qdz, qax, qaz, nx, nz,
                         0, largOmb, false, true, u1 * cordaL, u0 * cordaL)
            }
          }
        }
      }
    }
    if (desenhou) nAneis++
    // as 12 rotatórias deste anel
    for (let b = 0; b < 12; b++) {
      const ang = (b * 30 * Math.PI) / 180
      const cx = Math.sin(ang) * an.r, cz = -Math.cos(ang) * an.r
      // ⚠️ A ROTATÓRIA DO CINTURÃO FICA ALÉM DE rMax DE PROPÓSITO: a Avenida do
      // Cinturão mora em 4.450, fora do tecido, e é lá que os doze bulevares
      // terminam. Cortar por rMax deixaria a avenida sem nenhuma entrada.
      if (emPeca(cx, cz) || Math.hypot(cx, cz) > 4520) continue
      nRot++
      // ⚠️ PUBLICADA PARA A TEIA (seção 2c). O disco tem 80 m de diâmetro e nem
      // `emAvenidaPav` nem `emAnelPav` sabem dele: sem esta lista a rua da teia
      // entra por baixo da rotatória e as duas brigam no z-buffer, que é a
      // "sobreposição" que o fundador apontou em 03/09.
      rotCentros.push(cx, cz)
      const N = 48
      for (let k = 0; k < N; k++) {
        const a0 = (k / N) * Math.PI * 2, a1 = ((k + 1) / N) * Math.PI * 2
        for (const [ra, rb, alt, alvo] of [
          [ROT_ILHA, ROT_RAIO, Y_PISTA, 'pista'],
          [0, ROT_ILHA, Y_CANTEIRO, 'canteiro'],
        ] as [number, number, number, Alvo][]) {
          const P = (rr: number, aa: number) => [cx + Math.sin(aa) * rr, cz - Math.cos(aa) * rr] as const
          const [ax, az] = P(ra, a0), [dx2, dz2] = P(ra, a1)
          const [cx2, cz2] = P(rb, a1), [bx2, bz2] = P(rb, a0)
          // ⚠️ A ROTATÓRIA FICA COM A PROJEÇÃO XZ E ESTÁ CERTO ASSIM: ela é um
          // disco, não tem "ao longo da via", e qualquer UV direcional
          // escolheria arbitrariamente um dos doze sentidos que chegam nela.
          // ⚠️ A ROTATÓRIA NÃO TEM BANDA E É POR ISSO QUE ELA PRECISA DE MARCA
          // PRÓPRIA: doze sentidos chegam nela, então não existe "trilha de
          // pneu" com direção. `comCruzamento` troca a rodada linear por um
          // desgaste sem direção, que é o que o disco pede.
          fitaDe(alvo).comCruzamento().add(COR[alvo],
            ax, o.heightAt(ax, az) + alt, az,
            dx2, o.heightAt(dx2, dz2) + alt, dz2,
            cx2, o.heightAt(cx2, cz2) + alt, cz2,
            bx2, o.heightAt(bx2, bz2) + alt, bz2)
          // ⚠️ AS 46 ROTATÓRIAS ERAM O MAIOR BURACO DA MÁSCARA ANTIGA: um disco
          // de 80 m de asfalto em cada cruzamento anel × avenida, e nem
          // `emAvenida` nem o teste de raio do anel sabiam que ele existia.
          if (mascaravel(alvo)) marcarVia(codigoDe(alvo), ax, az, dx2, dz2, cx2, cz2, bx2, bz2)
        }
      }
    }
  }

  // ── 2c. A TEIA VIRA GRAFO: a rua sai da malha mãe, e só dela ─────────────
  //
  // ⚠️ O QUE SAIU DAQUI EM 03/09: O CONTORNO POR QUARTEIRÃO. Ele nasceu em 02/09
  // para tapar um buraco real e MEDIDO: as duas remoções de 31/08 (a malha antiga
  // do gerador, depois a teia fina) deixaram 660 dos 1.862 quarteirões (35,4%) a
  // mais de 200 m de qualquer pavimento. Ele tapava, e o próprio comentário dele
  // registrava o preço em letras: cada quarteirão desenhava os 6 m da SUA metade
  // do vão de 12 m e "as duas se encontram no meio do vão SEM NENHUMA
  // COORDENAÇÃO entre os dois".
  //
  // ⚠️ É ESSA FRASE QUE O FUNDADOR VIU DE CIMA EM 03/09: "essas ruas estão
  // completamente desconectadas, sobrepostas, separadas, tem de tudo aí. Se elas
  // seguirem a malha mãe do dodecaedro, funciona." Meia-seção por quarteirão
  // produz os três defeitos DE UMA VEZ, e nenhum deles é acabamento:
  //   · SOBREPOSTA   a grade do gerador GIRA por setor (`giro` é o rumo do setor,
  //                  38 a -46 graus conforme o distrito), então duas metades
  //                  vizinhas não são paralelas: onde elas se cruzam há pavimento
  //                  desenhado duas vezes na mesma cota, e duas faces coplanares
  //                  no mesmo Y é o z-fighting que a chapa lê como linha dupla;
  //   · DESCONECTADA no CRUZAMENTO não existe quarteirão para desenhar, logo não
  //                  existe cruzamento: quatro fitas chegam e nenhuma se toca;
  //   · SEPARADA     onde o vizinho não existe (borda de banda, beira de avenida)
  //                  a outra metade nunca sai, e sobra uma rua de 6 m encostada
  //                  em nada.
  //
  // ⚠️ E A CORREÇÃO NÃO É DESENHAR MELHOR O CONTORNO, É TROCAR DE FONTE. `teia.ts`
  // se declara "a definição única da malha viária da cidade" e `programa.ts` já a
  // consome para encaixar as peças em módulo inteiro. A RUA ERA O ÚNICO CONSUMIDOR
  // QUE AINDA NÃO A USAVA, e é literalmente por isso que rua e peça não
  // conversavam: eram duas grades. Aqui a rua passa a ser um GRAFO, e o grafo é a
  // teia:
  //   NÓ      um vértice da teia (anel i x radial j). Medido no JSON de hoje:
  //           27 anéis (1.450 a 6.727 m) x 84 radiais até ANEIS[13]=3.384 e 168
  //           daí para fora = 3.444 nós.
  //   ARESTA  um arco de anel entre dois radiais vizinhos, ou um trecho radial
  //           entre dois anéis vizinhos. 3.444 arcos + 3.276 radiais = 6.720.
  //   CRUZAMENTO  desenhado UMA VEZ, no nó, por todas as arestas que chegam nele.
  //           Não existe mais "duas meias-seções se encontrando por acaso".
  //
  // ⚠️ TUDO ABAIXO FOI MEDIDO RODANDO ESTE ARQUIVO FORA DO NAVEGADOR, não
  // estimado por planilha. O aferidor monta `buildVias` em node (`tsx`, com uma
  // casca mínima de DOM para `materiais.ts`), com `heightAt` fixo em 0, sem baía e
  // sem parcela, e lê os buffers que saem. Ele está CALIBRADO: rodado contra o
  // código de 02/09 devolve 1.271.668 triângulos no grupo e 1.630,7 km, e o
  // contorno de quarteirão sozinho dá 719.460, que é EXATAMENTE o número que o
  // cabeçalho deste arquivo registrou em tela naquele dia.
  //
  // ⚠️ SOBREPOSIÇÃO, QUE É A QUEIXA PRINCIPAL, MEDIDA POR SONDA. 3.000.000 de
  // pontos no disco da teia, contando quantos triângulos de pista ou calçada
  // contêm cada ponto:
  //     02/09 (contorno)  8,01% do pavimento coberto DUAS ou mais vezes
  //     03/09 (teia)      0,79%, e o grafo contribui ZERO com ele
  // Os 0,79% que sobram já existiam sem a teia (é o cruzamento das 12 avenidas
  // com os 7 anéis viários, seções 2 e 2b, que não são desta rodada); rodando a
  // mesma sonda contra a cidade SEM a teia dá os mesmos 0,79%.
  //
  // ⚠️ CONEXÃO, MEDIDA POR PREENCHIMENTO. O asfalto rasterizado em célula de 4 m
  // e percorrido por vizinhança de 8:
  //     02/09   5 componentes, a maior com 92,15% do asfalto
  //     03/09   2 componentes, a maior com 93,99% (r 1.415 a 6.905, todos os rumos)
  // A componente solta que sobra é a Pista de Serviço (r 7.600), que JÁ ESTAVA
  // solta antes desta rodada porque as 12 avenidas morrem em 6.900: fica
  // registrada como defeito herdado, não é meu.
  //
  // ⚠️ COBERTURA: empate, e é honesto dizer. O contorno de 02/09 também entregava
  // ZERO quarteirão a mais de 200 m de pavimento (ele dava frente pra rua por
  // construção). A teia entrega o mesmo ZERO, e a diferença é que agora o número
  // é MEDIDO no boot em `quarteiroesSemVia`, contra a máscara que a própria rua
  // pintou. Só as vias principais, sem teia nenhuma, dão 657 de 1.862, que bate
  // com os 660 contados offline em 02/09 (a diferença é a célula de 4 m da
  // máscara contra a distância analítica).
  //
  // ⚠️ E O ORÇAMENTO CAI. O contorno custava 719.460 triângulos; a teia inteira,
  // com a seção de 12 m INTEIRA em vez de meia, custa 611.640 (-15,0%). No grupo
  // todo: 1.271.668 -> 1.163.848 (-8,5%), com 1.407,1 km de via em vez de 1.630,7.
  // Chamada de desenho: 17 malhas antes, 17 malhas depois. Material e programa de
  // shader: zero a mais, nenhum `new THREE.MeshStandardMaterial` nesta rodada.
  //
  // ⚠️ O MEIO-FIO DA RUA LOCAL É UMA FACE SÓ, E A ESCOLHA FOI ORÇADA. O perfil de
  // quatro planos de `meioFio` (sarjeta, face, chanfro, topo) custa 8 triângulos
  // por junta por passo; a face vertical sozinha custa 2. Sobre os 1.407 km da
  // cidade isso é a diferença entre 611.640 e cerca de 1,28 milhão de triângulos,
  // ou seja o perfil completo em TODA rua local sozinho custaria mais do que a
  // cidade inteira de rua custa hoje, num aparelho que já está estourando a
  // memória do Safari do fundador. O perfil de quatro planos continua exclusivo da
  // AVENIDA e do ANEL VIÁRIO, que é onde a câmera de pedestre vai e onde a seção é
  // larga o bastante para ele aparecer; e o `acabamentoVia` desenha a sujeira de
  // sarjeta no fragmento, então a transição asfalto/guia/calçada não fica seca na
  // rua local.
  //
  // ⚠️ O QUE AINDA NÃO FECHA, MEDIDO: 0,75% do eixo da teia (10,2 km de 1.358 km,
  // em 484 pedaços) fica sem pavimento nenhum, e 200 desses 484 estão a menos de
  // 140 m de um anel viário. Não é bug de emenda, é a cunha que sobra quando duas
  // vias correm quase tangentes: o anel 17 da teia (4.284) passa RENTE à Avenida
  // do Cinturão (4.450, que no meio da aresta do dodecágono mergulha para 4.298), e
  // a faixa de 6 m em que o eixo da teia não cabe entre as duas vira 104 m de arco
  // por não haver ângulo nenhum entre elas. Ali quem serve o trecho é a própria
  // Cinturão, que está a menos de 20 m. Nenhum pedaço passa de 104 m.
  // ⚠️ CONSEQUÊNCIA REGISTRADA: `sobreQue` não devolve mais 'sarjeta' na rua da
  // teia (quem marcava o código 3 era `meioFio`). `naVia` não muda, porque quem a
  // alimenta são as bandas de pista e de calçada. E `sobreQue` está DESLIGADO em
  // produção desde 02/09 pela própria precisão dele (25,9% em via estreita).

  // ⚠️ `TEIA_MITRA` e `RAIOS_TEIA` MORAM NO MÓDULO, NÃO AQUI, e o motivo é ordem
  // de execução: o ombro da avenida (seção 2, acima) precisa saber onde a teia vai
  // cruzar para abrir a boca dele, e ele roda antes desta seção existir.
  /** o índice do anel em que o segundo nível de radiais nasce (ANEIS[13]=3.384) */
  const TEIA_DOBRA = (() => {
    const r = nasceEm(1)
    const k = r === null ? -1 : ANEIS.indexOf(r)
    return k < 0 ? ANEIS.length : k
  })()
  /** quantos índices de 168 vale um passo de módulo naquele anel */
  const teiaPasso = (i: number) => (i < TEIA_DOBRA ? 2 : 1)
  // ⚠️ O NÓ DA TEIA CAI NA FACE DO DODECÁGONO. A malha inteira segue 12 faces
  // (fundador, 06/09), então o raio no rumo `a` é `raioDodeca(apótema, a)` e não
  // um raio constante com a mitra de 84 lados que estava aqui.
  const teiaPt = (i: number, j: number): [number, number] => {
    const a = anguloDe(j), R = raioDodeca(ANEIS[i], a)
    return [Math.sin(a) * R, -Math.cos(a) * R]
  }

  /** a mesma seção, com o zero no EIXO em vez de na borda */
  const centrada = (s: Banda[]): Banda[] => {
    const c = (s[0].de + s[s.length - 1].ate) / 2
    return s.map((b) => ({ ...b, de: b.de - c, ate: b.ate - c }))
  }
  // ⚠️ A TRAVESSA DE 9 m VOLTA A TER DONO, e ela é a hierarquia do nível fino. Os
  // 84 radiais que nascem em ANEIS[13] existem só para partir ao meio um módulo
  // que já ficou largo demais lá fora (o arco do anel 26 tem 252 m); desenhá-los
  // com os mesmos 12 m do resto apagaria a diferença entre "a rua" e "a rua que
  // parte a quadra". 12 contra 9 m é 25% de largura, que de cima se lê.
  const SEC_TRAVESSA_C = centrada(SEC_TRAVESSA)
  const meiaDe = (s: Banda[]) => (s[s.length - 1].ate - s[0].de) / 2
  const meiaPistaDe = (s: Banda[]) => {
    let de = Infinity, ate = -Infinity
    for (const b of s) if (b.alvo === 'pista') { de = Math.min(de, b.de); ate = Math.max(ate, b.ate) }
    return de > ate ? 0 : (ate - de) / 2
  }

  // ── as máscaras que a teia respeita, todas com folga ZERO ────────────────
  //
  // ⚠️ FOLGA ZERO É O REQUISITO, NÃO DESCUIDO. A rua da teia tem de ENCOSTAR no
  // pavimento da avenida e do anel viário: um metro a menos e sobra uma fresta de
  // regolito entre as duas, que é o "termina no ar"; um metro a mais e as duas
  // desenham o mesmo chão na mesma cota, que é o z-fighting. Aqui o corte é
  // analítico, refinado por bisseção, e as duas superfícies compartilham a linha.

  /** dentro do pavimento de um dos anéis viários (que são DODECÁGONOS) */
  const emAnelPav = (px: number, pz: number, folga: number): boolean => {
    const r = Math.hypot(px, pz)
    if (r < 1) return false
    // ⚠️ O ANEL VIÁRIO É DODECÁGONO DESDE 31/08 e comparar `r` com `an.r` erra por
    // até 3,4% do raio (259 m na Pista de Serviço). A corda entre dois vértices a
    // 30 graus tem apótema `an.r*cos(15)`; um raio a `d` graus do meio da corda a
    // cruza em `an.r*cos(15)/cos(d)`. Sem esta conta o anel viário e a teia se
    // sobrepõem no MEIO da aresta, que é justamente onde o dodecágono mais
    // mergulha para dentro: medido nos raios publicados, o Anel Interior (1.750)
    // mergulha para 1.690 e passa a 4 m do anel 2 da teia (1.694), o Anel Médio
    // (2.750 -> 2.656) a 8 m do anel 9 (2.664) e a Avenida do Cinturão
    // (4.450 -> 4.298) a 17 m do anel 17 (4.281). Os três se sobrepunham.
    const u = Math.atan2(px, -pz) / (Math.PI / 6)
    const d = (u - Math.floor(u) - 0.5) * (Math.PI / 6)
    const kf = Math.cos(Math.PI / 12) / Math.cos(d)
    for (const an of meta.aneis ?? []) {
      // ⚠️ A BERMA DO ANEL SÓ CONTA PARA QUEM CORRE PARALELO A ELE. `folga` só é
      // diferente de zero no ARCO, que é a via que corre lado a lado com o anel e
      // portanto a única que pode acabar em cima da berma dele; o trecho RADIAL
      // cruza o anel de frente, e para ele a berma abre (`noRadialDaTeia`, na
      // seção 2b), então somar a berma aqui só o faria parar 6 m antes da guia.
      const ombro = folga > 0 ? OMBRO_ANEL * (an.larg / SEC_ANEL[SEC_ANEL.length - 1].ate) : 0
      const meia = an.larg / 2 + ombro
      if (r > (an.r + meia) * kf + folga) continue
      if (r >= (an.r - meia) * kf - folga) return true
    }
    return false
  }
  /** dentro do disco de uma rotatória JÁ DESENHADA (a lista sai da seção 2b) */
  const naRotatoriaPav = (px: number, pz: number, folga: number): boolean => {
    const rr = (ROT_RAIO + folga) ** 2
    for (let k = 0; k < rotCentros.length; k += 2) {
      const dx = px - rotCentros[k], dz = pz - rotCentros[k + 1]
      if (dx * dx + dz * dz < rr) return true
    }
    return false
  }
  // ⚠️ A PARCELA COM CAIXA ENVOLVENTE, senão o teste não paga. `dentroDoPoly` é
  // O(vértices) e a teia pergunta dezenas de milhares de vezes; a caixa resolve
  // quase todas as consultas em quatro comparações.
  const caixaParcela = parcelas.map((q) => {
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity
    for (const [x, z] of q.poly) {
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (z < z0) z0 = z
      if (z > z1) z1 = z
    }
    return { x0, x1, z0, z1, poly: q.poly }
  })
  const emParcela = (px: number, pz: number): boolean => {
    for (const c of caixaParcela) {
      if (px < c.x0 || px > c.x1 || pz < c.z0 || pz > c.z1) continue
      if (dentroDoPoly(px, pz, c.poly)) return true
    }
    return false
  }
  /**
   * O ponto está em cima de pavimento que NÃO é meu, ou fora do sítio?
   *
   * ⚠️ `folga` É A MEIA LARGURA DA VIA E SÓ VALE PARA O ARCO, e a assimetria tem
   * conta. O teste corre no EIXO do braço, mas quem invade o pavimento alheio é a
   * BORDA dele, a `meia` metros do eixo, e essa borda só avança na direção
   * RADIAL. O arco de anel é tangencial, então a meia largura dele é toda radial e
   * ele precisa da folga inteira: sem ela, o arco 2 da teia (1.694) corre com o
   * eixo 4 m fora da banda do Anel Interior e a calçada DENTRO dela. O trecho
   * radial é radial, então a meia largura dele é toda tangencial e não avança nada
   * na direção do anel: folga zero, e é o que faz ele ENCOSTAR no anel viário em
   * vez de parar 6 m antes. Mesma lógica para a avenida, que é radial: quem cruza
   * ela é sempre o arco, sempre perpendicular, folga zero.
   */
  // ── O CORREDOR DA VIA DE ORLA ────────────────────────────────────────────
  //
  // ⚠️ A TEIA CEDE À ORLA, e não o contrário. As duas se cruzam por construção:
  // a teia morre na linha d'água e a orla corre 26 m atrás dela, então todo toco
  // da teia atravessa a orla. Alguém tem de ceder, senão os dois pavimentos saem
  // desenhados na mesma cota e brigam no z-buffer — e a orla é a via contínua,
  // então quem para é o toco. É o mesmo arranjo que a avenida e o anel viário já
  // têm com a teia, pelo mesmo motivo, e o resultado é o encontro em T desenhado
  // uma vez só.
  //
  // ⚠️ E A CONSULTA É INDEXADA, senão ela custa o boot. `teiaBloqueado` roda
  // dezenas de milhares de vezes, cada uma com 6 bisseções: varrer alguns
  // milhares de segmentos de eixo a cada chamada seria O(n·m). Um balde de 64 m
  // (mais que o alcance máximo da consulta, que é meia via mais folga) deixa a
  // consulta em O(1) com um punhado de segmentos por célula.
  const ORLA_BALDE = 64
  const orlaSegs: number[] = []          // (ax,az,bx,bz)
  const orlaGrade = new Map<number, number[]>()
  const orlaChave = (i: number, j: number) => (i + 2048) * 4096 + (j + 2048)
  if (o.orlasDesvio) {
    for (const eixo of o.orlasDesvio) {
      for (let k = 0; k + 3 < eixo.length; k += 2) {
        const ax = eixo[k], az = eixo[k + 1], bx = eixo[k + 2], bz = eixo[k + 3]
        const id = orlaSegs.length
        orlaSegs.push(ax, az, bx, bz)
        const i0 = Math.floor(Math.min(ax, bx) / ORLA_BALDE), i1 = Math.floor(Math.max(ax, bx) / ORLA_BALDE)
        const j0 = Math.floor(Math.min(az, bz) / ORLA_BALDE), j1 = Math.floor(Math.max(az, bz) / ORLA_BALDE)
        for (let j = j0; j <= j1; j++) {
          for (let i = i0; i <= i1; i++) {
            const c = orlaChave(i, j); const l = orlaGrade.get(c)
            if (l) l.push(id); else orlaGrade.set(c, [id])
          }
        }
      }
    }
  }
  /** distância ao eixo da orla menor que meia via mais `folga`? */
  const naOrlaPav = (px: number, pz: number, folga: number): boolean => {
    if (!orlaSegs.length) return false
    const alc = HR + folga
    const i0 = Math.floor((px - alc) / ORLA_BALDE), i1 = Math.floor((px + alc) / ORLA_BALDE)
    const j0 = Math.floor((pz - alc) / ORLA_BALDE), j1 = Math.floor((pz + alc) / ORLA_BALDE)
    const a2 = alc * alc
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const l = orlaGrade.get(orlaChave(i, j))
        if (!l) continue
        for (const id of l) {
          const ax = orlaSegs[id], az = orlaSegs[id + 1]
          const dx = orlaSegs[id + 2] - ax, dz = orlaSegs[id + 3] - az
          const ll = dx * dx + dz * dz
          let t = ll > 0 ? ((px - ax) * dx + (pz - az) * dz) / ll : 0
          t = t < 0 ? 0 : t > 1 ? 1 : t
          const qx = px - (ax + dx * t), qz = pz - (az + dz * t)
          if (qx * qx + qz * qz < a2) return true
        }
      }
    }
    return false
  }

  const teiaBloqueado = (px: number, pz: number, folga: number): boolean => {
    if (Math.hypot(px, pz) > rMax) return true
    // ⚠️ `bloqueiaMalha` INCLUI A BAÍA, então `naBaia` aqui virou a queda para
    // quando a classificação não vem. Não são duas perguntas somadas: quando as
    // duas existem, a primeira já responde pela segunda.
    if (paraNaAgua(px, pz)) return true
    if (naOrlaPav(px, pz, folga)) return true
    if (emCorredorAvenida(px, pz, 0)) return true
    if (emAnelPav(px, pz, folga)) return true
    if (naRotatoriaPav(px, pz, folga)) return true
    return false
  }

  // ⚠️ 12 m DE AMOSTRA E 6 BISSEÇÕES DÃO 19 cm DE PRECISÃO NA FRONTEIRA, e é
  // dessa ordem que ela precisa ser: a fronteira é onde a teia encosta no
  // pavimento da avenida, e um erro de 3 m para dentro é briga no z-buffer,
  // 3 m para fora é fresta de terra. 12/2^6 = 0,1875 m. O passo de amostra não
  // pode ser maior que a via mais estreita que ele precisa achar (a avenida de
  // 34 m), e 12 m tem folga de quase três vezes.
  const TEIA_AMOSTRA = 12
  const TEIA_BISSECAO = 6
  /** os pedaços VIVOS de um eixo, em pares (s0,s1) de metro ao longo dele */
  const teiaVivos = (cx: number, cz: number, dx: number, dz: number,
                     comp: number, folga: number): number[] => {
    const n = Math.max(2, Math.ceil(comp / TEIA_AMOSTRA))
    const fronteira = (a: number, b: number, vivoEmA: boolean): number => {
      let lo = a, hi = b
      for (let k = 0; k < TEIA_BISSECAO; k++) {
        const m = (lo + hi) / 2
        if (!teiaBloqueado(cx + dx * m, cz + dz * m, folga) === vivoEmA) lo = m
        else hi = m
      }
      return (lo + hi) / 2
    }
    const out: number[] = []
    let ini = 0, ant = false
    for (let k = 0; k <= n; k++) {
      const s = (comp * k) / n
      const v = !teiaBloqueado(cx + dx * s, cz + dz * s, folga)
      if (v && !ant) ini = k === 0 ? 0 : fronteira((comp * (k - 1)) / n, s, false)
      else if (!v && ant) out.push(ini, fronteira((comp * (k - 1)) / n, s, true))
      ant = v
    }
    if (ant) out.push(ini, comp)
    return out
  }

  // ── o grafo: nós, arestas, e um braço por ponta de aresta ────────────────
  interface BracoTeia {
    dx: number; dz: number; ang: number
    /** meia largura da seção e meia largura da pista, em metros */
    meia: number; pm: number
    /** os quatro cantos deste braço no cruzamento: seção e pista, +perp e -perp */
    ce: [number, number]; cd: [number, number]
    ke: [number, number]; kd: [number, number]
    /** os dois pontos da BOCA da pista na face de encontro */
    pe: [number, number]; pd: [number, number]
  }
  interface NoTeia { x: number; z: number; br: BracoTeia[] }
  interface ArestaTeia {
    a: number; b: number; sec: Banda[]
    /** arco de anel (tangencial) ou trecho radial: muda a folga de `teiaBloqueado` */
    arco: boolean
    /** ⚠️ REFERÊNCIA, NÃO ÍNDICE: os braços são REORDENADOS por ângulo no nó, e um
     *  índice guardado antes da ordenação apontaria para outra aresta depois dela. */
    bA?: BracoTeia; bB?: BracoTeia
  }

  const teiaNos: NoTeia[] = []
  const teiaChave = new Map<number, number>()
  const teiaNo = (i: number, j: number): number => {
    const k = i * N_RAD + j
    let n = teiaChave.get(k)
    if (n === undefined) {
      const [x, z] = teiaPt(i, j)
      n = teiaNos.length
      teiaNos.push({ x, z, br: [] })
      teiaChave.set(k, n)
    }
    return n
  }
  const teiaArestas: ArestaTeia[] = []
  // ⚠️ COM 12 FACES O NÓ TEM DE EXISTIR NA QUINA. `N_RAD` é 168 e o passo é 2,
  // ou seja um nó a cada 4,286°: as avenidas ficam a 30°, que é múltiplo exato
  // disso (j = 14, 28, 42...), então a quina JÁ cai em cima de um nó e a aresta
  // nunca a atravessa. Sem essa coincidência a esquina seria cortada em chanfro,
  // e é por isso que ela está conferida aqui e não suposta.
  for (let i = 0; i < ANEIS.length; i++) {
    const p = teiaPasso(i)
    for (let j = 0; j < N_RAD; j += p) {
      teiaArestas.push({ a: teiaNo(i, j), b: teiaNo(i, (j + p) % N_RAD), sec: SEC_RUA, arco: true })
    }
  }
  for (let j = 0; j < N_RAD; j++) {
    // ⚠️ O RADIAL NASCE EM CIMA DE UM ANEL, e quem sabe disso é `nasceEm`. Um
    // radial que começa num raio redondo começa no MEIO de uma face de
    // quarteirão, sem nada para encontrar: é o "radial sem conexão" que o
    // fundador apontou em 31/08 e a nota longa de `teia.ts` mede em 56 m.
    const i0 = j % 2 === 0 ? 0 : TEIA_DOBRA
    const sec = j % 2 === 0 ? SEC_RUA : SEC_TRAVESSA_C
    for (let i = i0; i + 1 < ANEIS.length; i++) {
      teiaArestas.push({ a: teiaNo(i, j), b: teiaNo(i + 1, j), sec, arco: false })
    }
  }

  // ⚠️ A PARCELA ENGOLE A ARESTA INTEIRA, E ISSO É PROJETO, NÃO CORTE. Uma peça
  // do programa ocupa um bloco INTEIRO de módulos (`programa.ts`), então quando
  // ela tem mais de um módulo de fundo ou de testada existem arestas da teia
  // POR DENTRO dela. Cortar essas arestas na divisa devolveria ruas sem saída
  // batendo no muro da peça; apagá-las inteiras devolve o que a peça é de
  // verdade, uma superquadra com rua nos quatro lados. O teste é o ponto médio
  // da aresta, e o polígono é o mesmo objeto que define a divisa da parcela.
  const teiaViva: boolean[] = teiaArestas.map((e) => {
    const A = teiaNos[e.a], B = teiaNos[e.b]
    return !emParcela((A.x + B.x) / 2, (A.z + B.z) / 2)
  })

  for (let e = 0; e < teiaArestas.length; e++) {
    if (!teiaViva[e]) continue
    const ar = teiaArestas[e]
    const A = teiaNos[ar.a], B = teiaNos[ar.b]
    const L = Math.hypot(B.x - A.x, B.z - A.z)
    if (L < 1) { teiaViva[e] = false; continue }
    const dx = (B.x - A.x) / L, dz = (B.z - A.z) / L
    const meia = meiaDe(ar.sec), pm = meiaPistaDe(ar.sec)
    const zero = (): [number, number] => [0, 0]
    const bA: BracoTeia = { dx, dz, ang: Math.atan2(dz, dx), meia, pm,
      ce: zero(), cd: zero(), ke: zero(), kd: zero(), pe: zero(), pd: zero() }
    const bB: BracoTeia = { dx: -dx, dz: -dz, ang: Math.atan2(-dz, -dx), meia, pm,
      ce: zero(), cd: zero(), ke: zero(), kd: zero(), pe: zero(), pd: zero() }
    A.br.push(bA)
    B.br.push(bB)
    ar.bA = bA
    ar.bB = bB
  }

  /**
   * O canto entre dois braços vizinhos: a interseção da borda +perp do primeiro
   * com a borda -perp do segundo, que é a construção clássica de esquina.
   *
   * ⚠️ É ELA QUE FAZ O CRUZAMENTO NÃO TER NEM FRESTA NEM SOBRA, e nenhuma
   * aproximação por quadrado consegue isso aqui. O radial e a corda do anel não
   * são perpendiculares: no vértice do polígono a corda sai a 90 graus MENOS
   * metade do passo angular, ou seja 2,14 graus no nível de 84 radiais e 1,07 no
   * de 168. Um cruzamento quadrado de 12 m alinhado na tangente erraria a ponta
   * do braço em 6*tan(2,14) = 22 cm, metade fresta e metade sobreposição, e a
   * metade sobreposta é z-fighting. Com a interseção, a ponta do braço É o lado
   * do cruzamento, por construção, para qualquer ângulo.
   */
  const cantoEntre = (no: NoTeia, b1: BracoTeia, b2: BracoTeia,
                      w1: number, w2: number): [number, number] => {
    const o1x = no.x - b1.dz * w1, o1z = no.z + b1.dx * w1
    const o2x = no.x + b2.dz * w2, o2z = no.z - b2.dx * w2
    const det = b1.dx * b2.dz - b1.dz * b2.dx
    if (Math.abs(det) < 1e-6) return [o1x, o1z]
    let t = ((o2x - o1x) * b2.dz - (o2z - o1z) * b2.dx) / det
    // ⚠️ A TRAVA NÃO É ESTÉTICA. Dois braços quase alinhados dão determinante
    // quase zero e a interseção foge para o infinito; sem o teto o cruzamento
    // vira uma agulha de centenas de metros atravessando a cidade. `t` negativo
    // é o canto reflexo de um nó com dois braços em L, e ali o certo é não
    // avançar nada.
    const lim = 3 * Math.max(w1, w2)
    if (!(t > 0)) t = 0
    else if (t > lim) t = lim
    return [o1x + b1.dx * t, o1z + b1.dz * t]
  }

  for (const no of teiaNos) {
    const br = no.br
    const m = br.length
    if (m === 0) continue
    br.sort((p, q) => p.ang - q.ang)
    if (m === 1) {
      const b = br[0]
      b.ce = [no.x - b.dz * b.meia, no.z + b.dx * b.meia]
      b.cd = [no.x + b.dz * b.meia, no.z - b.dx * b.meia]
      b.ke = [no.x - b.dz * b.pm, no.z + b.dx * b.pm]
      b.kd = [no.x + b.dz * b.pm, no.z - b.dx * b.pm]
    } else {
      for (let k = 0; k < m; k++) {
        const b1 = br[k], b2 = br[(k + 1) % m]
        const c = cantoEntre(no, b1, b2, b1.meia, b2.meia)
        b1.ce = c
        b2.cd = c
        const kk = cantoEntre(no, b1, b2, b1.pm, b2.pm)
        b1.ke = kk
        b2.kd = kk
      }
    }
    // a boca da pista na face de encontro: onde a calçada acaba e o asfalto começa
    for (const b of br) {
      const td = (b.meia - b.pm) / (2 * b.meia), te = (b.meia + b.pm) / (2 * b.meia)
      b.pd = [b.cd[0] + (b.ce[0] - b.cd[0]) * td, b.cd[1] + (b.ce[1] - b.cd[1]) * td]
      b.pe = [b.cd[0] + (b.ce[0] - b.cd[0]) * te, b.cd[1] + (b.ce[1] - b.cd[1]) * te]
    }
  }

  // ── o braço: uma seção inteira entre duas faces que podem ser tortas ─────
  /**
   * ⚠️ ISTO NÃO É `faixa` COM OUTRO NOME, E A DIFERENÇA É A PONTA. `faixa` corta a
   * fita em ângulo reto com o eixo, que é o certo para a avenida (uma reta longa)
   * e o errado para o braço de um cruzamento: a ponta dele TEM de ser o lado do
   * cruzamento, e o lado do cruzamento não é perpendicular a ninguém. Aqui as
   * duas faces entram como par de pontos e a seção é interpolada bilinearmente
   * entre elas, e os lados continuam paralelos ao eixo (é o que garante que a
   * largura não mude no meio) e só as pontas ficam tortas.
   */
  const teiaBraco = (
    e0x: number, e0z: number, e1x: number, e1z: number,
    f0x: number, f0z: number, f1x: number, f1z: number,
    sec: Banda[],
  ) => {
    const cax = (e0x + e1x) / 2, caz = (e0z + e1z) / 2
    const cbx = (f0x + f1x) / 2, cbz = (f0z + f1z) / 2
    const comp = Math.hypot(cbx - cax, cbz - caz)
    if (comp < 0.6) return
    const dx = (cbx - cax) / comp, dz = (cbz - caz) / comp
    const px = -dz, pz = dx
    const d0 = sec[0].de, W = sec[sec.length - 1].ate - d0
    // ⚠️ MESMO PASSO DE 24 m DO RESTO DO ARQUIVO, e ele foi MEDIDO em 02/09: com
    // trechos de 42 m a sonda de 4.000 pontos achou terreno furando a pista em
    // 12,7% das amostras, até 1,00 m acima dela. O erro cai com o QUADRADO do vão,
    // então encurtar a corda é o único conserto.
    const passos = Math.max(1, Math.ceil(comp / PASSO))
    const em = (t: number, tau: number, out: number[]) => {
      const ax = e0x + (e1x - e0x) * tau, az = e0z + (e1z - e0z) * tau
      const bx = f0x + (f1x - f0x) * tau, bz = f0z + (f1z - f0z) * tau
      out[0] = ax + (bx - ax) * t
      out[1] = az + (bz - az) * t
    }
    const qa: number[] = [0, 0], qb: number[] = [0, 0], qc: number[] = [0, 0], qd: number[] = [0, 0]
    metros += comp
    for (let k = 0; k < passos; k++) {
      const t0 = k / passos, t1 = (k + 1) / passos
      const vA = t0 * comp, vB = t1 * comp
      for (let i = 0; i < sec.length; i++) {
        const s = sec[i]
        const tau0 = (s.de - d0) / W, tau1 = (s.ate - d0) / W
        em(t0, tau0, qa); em(t0, tau1, qb); em(t1, tau1, qc); em(t1, tau0, qd)
        const ft = fitaDe(s.alvo)
        const esc = ft.escala || 1
        // ⚠️ A ORDEM DOS CANTOS É A DE `faixa` (offset primeiro, comprimento
        // depois) e ela dá a normal para CIMA. Trocar as duas apaga a face
        // inteira no backface culling, que é a armadilha registrada em
        // pracas.ts:98 e repetida três vezes neste arquivo.
        ft.comBanda(s.ate - s.de, 0, 1, 1, 0)
          .comUV(s.de / esc, vA / esc, s.ate / esc, vA / esc,
                 s.ate / esc, vB / esc, s.de / esc, vB / esc)
          .add(COR[s.alvo],
            qa[0], cotaVia(qa[0], qa[1]) + s.alt, qa[1],
            qb[0], cotaVia(qb[0], qb[1]) + s.alt, qb[1],
            qc[0], cotaVia(qc[0], qc[1]) + s.alt, qc[1],
            qd[0], cotaVia(qd[0], qd[1]) + s.alt, qd[1])
        if (mascaravel(s.alvo)) {
          marcarVia(codigoDe(s.alvo), qa[0], qa[1], qb[0], qb[1], qc[0], qc[1], qd[0], qd[1])
        }
        // o meio-fio: uma face vertical, no degrau entre esta banda e a próxima
        const prox = sec[i + 1]
        if (prox && prox.alt !== s.alt) {
          const alto = Math.max(s.alt, prox.alt), baixo = Math.min(s.alt, prox.alt)
          const lado = prox.alt > s.alt ? 1 : -1
          const h0 = cotaVia(qb[0], qb[1]), h1 = cotaVia(qc[0], qc[1])
          paredeVert(guia, qb[0], qb[1], qc[0], qc[1],
                     h0 + baixo, h0 + alto, h1 + baixo, h1 + alto,
                     -lado * px, -lado * pz)
        }
        // ⚠️ O PARAPEITO SÓ EXISTE SOBRE ÁGUA, e é ele que faz a travessia ler
        // como ponte em vez de aterro. A teia cruza canal de 60 m e cratera de
        // 300 m; a baía já foi cortada lá atrás por `teiaBloqueado`.
        if ((i === 0 || i === sec.length - 1) && sobreAgua(qa[0], qa[1])) {
          const b2x = i === 0 ? qa[0] : qb[0], b2z = i === 0 ? qa[1] : qb[1]
          const c2x = i === 0 ? qd[0] : qc[0], c2z = i === 0 ? qd[1] : qc[1]
          const y0 = cotaVia(b2x, b2z) + s.alt, y1 = cotaVia(c2x, c2z) + s.alt
          guia.addV(COR.meiofio,
            b2x, y0, b2z, b2x, y0 + 1.1, b2z,
            c2x, y1 + 1.1, c2z, c2x, y1, c2z)
          if (i === 0 && k % 2 === 0) {
            const fundo = o.heightAt(b2x, b2z)
            const lx = px * 2.2, lz = pz * 2.2
            guia.addV(COR.meiofio,
              b2x - lx, fundo, b2z - lz, b2x - lx, y0, b2z - lz,
              b2x + lx, y0, b2z + lz, b2x + lx, fundo, b2z + lz)
          }
        }
      }
    }
  }

  // ── o cruzamento: desenhado UMA vez, no nó ───────────────────────────────
  /**
   * ⚠️ O CRUZAMENTO É O QUE NÃO EXISTIA, e é o defeito central do relato de
   * 03/09. Ele sai em três peças, e a ordem delas é a de uma rua de verdade:
   *   1. o LEQUE de pista, que é a união dos leitos que chegam (uma cruz, não um
   *      quadrado: onde as duas calçadas se cruzariam não há asfalto);
   *   2. a ESQUINA DE CALÇADA, um quadrilátero por vão entre braços vizinhos, que
   *      é o "a calçada faz o canto";
   *   3. o MEIO-FIO da esquina, duas faces por vão, seguindo o contorno da
   *      calçada e olhando para o asfalto.
   * As três nascem dos MESMOS cantos que pararam os braços, então não existe
   * nem fresta nem sobreposição entre o cruzamento e o que chega nele.
   */
  const teiaCruzamento = (no: NoTeia) => {
    const br = no.br
    const m = br.length
    if (m === 0) return
    const yP = (x: number, z: number) => cotaVia(x, z) + Y_PISTA
    const yC = (x: number, z: number) => cotaVia(x, z) + Y_CALCADA
    // o contorno do leque, em sentido de ângulo crescente
    const borda: [number, number][] = []
    for (const b of br) { borda.push(b.pd, b.pe, b.ke) }
    const ftP = fitaDe('pista')
    // ⚠️ EM QUADS, NÃO EM TRIÂNGULOS SOLTOS. `Fita.add` sempre emite 2 triângulos;
    // um leque de triângulo por triângulo pagaria um triângulo degenerado por
    // fatia, ou seja o DOBRO. Como a diagonal do quad é sempre o raio do meio, o
    // par (centro, v+2, v+1, v) é exatamente as duas fatias do leque.
    const nb = borda.length
    for (let k = 0; k < nb; k += 2) {
      const v0 = borda[k]
      const v1 = borda[(k + 1) % nb]
      // ⚠️ COM `nb` ÍMPAR A ÚLTIMA FATIA FICA SOZINHA. Repetir o vértice fecha o
      // quad com um triângulo de área zero; ir buscar `borda[0]` desenharia a
      // PRIMEIRA fatia uma segunda vez, que é pavimento duplicado na mesma cota.
      const v2 = k + 2 <= nb ? borda[(k + 2) % nb] : v1
      // ⚠️ ORDEM INVERTIDA (centro, v2, v1, v0) PORQUE `borda` cresce em ângulo, e
      // ângulo crescente no plano (x,z) é a ordem que dá normal para BAIXO.
      ftP.comCruzamento().add(COR.pista,
        no.x, yP(no.x, no.z), no.z,
        v2[0], yP(v2[0], v2[1]), v2[1],
        v1[0], yP(v1[0], v1[1]), v1[1],
        v0[0], yP(v0[0], v0[1]), v0[1])
      marcarVia(codigoDe('pista'), no.x, no.z, v2[0], v2[1], v1[0], v1[1], v0[0], v0[1])
    }
    if (m < 2) return
    const ftC = fitaDe('calcada')
    for (let k = 0; k < m; k++) {
      const b1 = br[k], b2 = br[(k + 1) % m]
      ftC.comCruzamento().add(COR.calcada,
        b2.pd[0], yC(b2.pd[0], b2.pd[1]), b2.pd[1],
        b1.ce[0], yC(b1.ce[0], b1.ce[1]), b1.ce[1],
        b1.pe[0], yC(b1.pe[0], b1.pe[1]), b1.pe[1],
        b1.ke[0], yC(b1.ke[0], b1.ke[1]), b1.ke[1])
      marcarVia(codigoDe('calcada'), b2.pd[0], b2.pd[1], b1.ce[0], b1.ce[1],
                b1.pe[0], b1.pe[1], b1.ke[0], b1.ke[1])
      // as duas faces de meio-fio da esquina, cada uma olhando para o asfalto do
      // braço que ela margeia
      const face = (ax: number, az: number, bx2: number, bz2: number, nx: number, nz: number) => {
        const h0 = cotaVia(ax, az), h1 = cotaVia(bx2, bz2)
        paredeVert(guia, ax, az, bx2, bz2,
                   h0 + Y_PISTA, h0 + Y_CALCADA, h1 + Y_PISTA, h1 + Y_CALCADA, nx, nz)
      }
      face(b1.ke[0], b1.ke[1], b1.pe[0], b1.pe[1], b1.dz, -b1.dx)
      face(b2.pd[0], b2.pd[1], b1.ke[0], b1.ke[1], -b2.dz, b2.dx)
    }
  }

  // ── e o laço: cada aresta em pedaços vivos, cada nó uma vez ──────────────
  let teiaTrechos = 0
  for (let e = 0; e < teiaArestas.length; e++) {
    if (!teiaViva[e]) continue
    const ar = teiaArestas[e]
    const bA = ar.bA, bB = ar.bB
    if (!bA || !bB) continue
    // as duas faces de encontro, cada uma de -meia (índice 0) até +meia (índice 1)
    const e0 = bA.cd, e1 = bA.ce
    const f0 = bB.ce, f1 = bB.cd
    const cax = (e0[0] + e1[0]) / 2, caz = (e0[1] + e1[1]) / 2
    const cbx = (f0[0] + f1[0]) / 2, cbz = (f0[1] + f1[1]) / 2
    const comp = Math.hypot(cbx - cax, cbz - caz)
    if (comp < 0.6) continue
    const dx = (cbx - cax) / comp, dz = (cbz - caz) / comp
    const px = -dz, pz = dx
    const meia = bA.meia
    const viv = teiaVivos(cax, caz, dx, dz, comp, ar.arco ? meia : 0)
    for (let k = 0; k < viv.length; k += 2) {
      const s0 = viv[k], s1 = viv[k + 1]
      if (s1 - s0 < 1) continue
      // ⚠️ SÓ A PONTA QUE SOBROU INTEIRA HERDA A FACE TORTA DO CRUZAMENTO. Onde a
      // avenida, o anel ou a baía cortaram, a ponta nova é reta e perpendicular:
      // é ali que a teia ENCOSTA no pavimento do outro, e o outro tem borda reta.
      const inteiroA = s0 <= 0.001, inteiroB = s1 >= comp - 0.001
      const g0x = inteiroA ? e0[0] : cax + dx * s0 - px * meia
      const g0z = inteiroA ? e0[1] : caz + dz * s0 - pz * meia
      const g1x = inteiroA ? e1[0] : cax + dx * s0 + px * meia
      const g1z = inteiroA ? e1[1] : caz + dz * s0 + pz * meia
      const h0x = inteiroB ? f0[0] : cax + dx * s1 - px * meia
      const h0z = inteiroB ? f0[1] : caz + dz * s1 - pz * meia
      const h1x = inteiroB ? f1[0] : cax + dx * s1 + px * meia
      const h1z = inteiroB ? f1[1] : caz + dz * s1 + pz * meia
      teiaBraco(g0x, g0z, g1x, g1z, h0x, h0z, h1x, h1z, ar.sec)
      teiaTrechos++
    }
  }
  // ── A VIA DE ORLA: a mesma seção da teia, correndo numa curva ────────────
  //
  // ⚠️ ELA USA `teiaBraco`, E NÃO `faixa`, e a diferença é a mesma que já está
  // registrada duas vezes neste arquivo e uma em lagos.ts: `faixa` corta a fita
  // em ângulo RETO com o eixo. Numa reta isso é o certo; numa curva, dois trechos
  // vizinhos cortam em ângulos diferentes e abrem em LEQUE — sobra vão por fora
  // da curva e sobreposição por dentro. `teiaBraco` recebe as duas FACES e
  // interpola entre elas, então basta dar a ele a face em ESQUADRIA de cada
  // vértice (a bissetriz das duas arestas que chegam nele) e os trechos vizinhos
  // passam a compartilhar a face inteira. É a mesma cura que a orla da baía e a
  // praia já receberam; a rua era a terceira peça de margem e a única que ainda
  // não existia.
  //
  // ⚠️ A ESQUADRIA TEM TETO. Numa quina fechada a bissetriz vai ao infinito e a
  // face viraria uma lasca de centenas de metros atravessada na paisagem. Com o
  // teto, a quina muito fechada volta a abrir um vãozinho — que a 12 m de via e
  // com a margem já alisada em `alisaContorno` fica abaixo do centímetro.
  let orlaTrechos = 0
  let orlaMetros = 0
  if (o.orlasDesvio) {
    const SEC_ORLA = centrada(SEC_RUA)
    const meia = SEC_ORLA[SEC_ORLA.length - 1].ate
    for (const eixo of o.orlasDesvio) {
      const m = eixo.length / 2
      if (m < 2) continue
      // a face de cada vértice: ponto ± normal em esquadria
      const fx: number[] = [], fz: number[] = []
      for (let k = 0; k < m; k++) {
        // a direção que chega e a que sai; nas pontas, a única que existe
        const kAnt = k > 0 ? k - 1 : k, kPro = k < m - 1 ? k + 1 : k
        const ax = eixo[2 * kPro] - eixo[2 * kAnt], az = eixo[2 * kPro + 1] - eixo[2 * kAnt + 1]
        const al = Math.hypot(ax, az) || 1
        let nx = -az / al, nz = ax / al
        // esquadria: a face abre 1/cos(θ/2) na quina, com teto de 2,5
        if (k > 0 && k < m - 1) {
          const d0x = eixo[2 * k] - eixo[2 * k - 2], d0z = eixo[2 * k + 1] - eixo[2 * k - 1]
          const d1x = eixo[2 * k + 2] - eixo[2 * k], d1z = eixo[2 * k + 3] - eixo[2 * k + 1]
          const l0 = Math.hypot(d0x, d0z) || 1, l1 = Math.hypot(d1x, d1z) || 1
          const cos = (d0x * d1x + d0z * d1z) / (l0 * l1)
          const esc = Math.min(2.5, 1 / Math.max(0.4, Math.sqrt((1 + cos) / 2)))
          nx *= esc; nz *= esc
        }
        fx.push(eixo[2 * k] - nx * meia, eixo[2 * k] + nx * meia)
        fz.push(eixo[2 * k + 1] - nz * meia, eixo[2 * k + 1] + nz * meia)
      }
      for (let k = 0; k + 1 < m; k++) {
        const mx = (eixo[2 * k] + eixo[2 * k + 2]) / 2, mz = (eixo[2 * k + 1] + eixo[2 * k + 3]) / 2
        // ⚠️ A ORLA CEDE AO BULEVAR, AO ANEL E À PARCELA, mas NÃO à teia: a teia
        // já cedeu a ela em `teiaBloqueado`. Ceder dos dois lados abriria um
        // buraco no cruzamento em vez de fechá-lo.
        if (Math.hypot(mx, mz) > rMax) continue
        if (paraNaAgua(mx, mz)) continue
        if (emCorredorAvenida(mx, mz, 0) || emAnelPav(mx, mz, meia) || naRotatoriaPav(mx, mz, meia)) continue
        if (emParcela(mx, mz)) continue
        teiaBraco(fx[2 * k], fz[2 * k], fx[2 * k + 1], fz[2 * k + 1],
                  fx[2 * k + 2], fz[2 * k + 2], fx[2 * k + 3], fz[2 * k + 3], SEC_ORLA)
        orlaTrechos++
        orlaMetros += Math.hypot(eixo[2 * k + 2] - eixo[2 * k], eixo[2 * k + 3] - eixo[2 * k + 1])
      }
    }
  }

  if (orlaTrechos) {
    console.log(`[vias] via de orla: ${orlaTrechos} trechos, ${(orlaMetros / 1000).toFixed(2)} km `
      + `costurando a margem dos lagos que empurram a malha`)
  }

  let teiaCruz = 0
  for (const no of teiaNos) {
    if (no.br.length === 0) continue
    // ⚠️ O TESTE É NA PEGADA, NÃO NO CENTRO. O cruzamento tem 12 m de lado; medir
    // só o nó deixaria um deles entrar 6 m por baixo do Anel Interior, que é
    // exatamente a sobreposição que esta rodada veio consertar. `ce` são os cantos
    // externos que a construção de esquina acabou de calcular, ou seja a pegada
    // de verdade e não um raio inventado.
    if (teiaBloqueado(no.x, no.z, 0) || emParcela(no.x, no.z)) continue
    let livre = true
    for (const b of no.br) if (teiaBloqueado(b.ce[0], b.ce[1], 0)) { livre = false; break }
    if (!livre) continue
    teiaCruzamento(no)
    teiaCruz++
  }

  // ── 3. UMA malha, UM material, cor por vértice ────────────────────────────
  // ⚠️ ANTES ERAM 4 MATERIAIS E 4 CHAMADAS. O limite real desta cena não é
  // triângulo nem chamada de desenho (373 numa GTX 1650 é folga), é MATERIAL e
  // PROGRAMA: a vista de topo compila 228 programas e o teto da rodada é 235.
  // Com cor por vértice, acrescentar cor à rua (a marca branca, por exemplo)
  // passou a custar zero material.
  const mats: THREE.Material[] = []
  /** um material de chão vestido com uma superfície de `materiais.ts` */
  const vestido = (nome: Superficie, tinta: string, forcaNormal = 1, macroM = 140) => {
    // ⚠️ `mundo = 1` NÃO É ENGANO. `vestir` calcula `repeat = max(1, mundo/metros)`
    // e o piso desse `max` é 1, então não existe repeat menor que a unidade: quem
    // divide pelo lado do ladrilho é o UV que a Fita gerou. Passar aqui o tamanho
    // do chão em metros, que é o uso normal documentado no BRIEFING, repetiria a
    // textura mais de mil vezes por ladrilho.
    // ⚠️ A TINTA É QUASE BRANCA PORQUE COR DE MATERIAL MULTIPLICA O MAPA. O valor
    // que o olho lê agora vem da receita, não do hex: 'asfalto' entrega base 53
    // em 255, mais escuro que o #57534B (87) que a rua tinha, o que só AUMENTA a
    // separação pista/calçada que a paleta persegue.
    const m = new THREE.MeshStandardMaterial({ color: tinta, roughness: 1, metalness: 0 })
    m.name = `via:${nome}`
    vestir(m, nome, 1, { normal: forcaNormal, macroMetros: macroM })
    mats.push(m)
    return m
  }

  // ⚠️ NO LOOK 1 NADA MUDA: um material, cor por vértice, as mesmas 14 malhas.
  // ⚠️ ANTES ERAM 4 MATERIAIS E 4 CHAMADAS. O limite real desta cena não é
  // triângulo nem chamada de desenho (373 numa GTX 1650 é folga), é MATERIAL e
  // PROGRAMA: a vista de topo compila 228 programas e o teto da rodada é 235.
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.95, metalness: 0,
  })
  mat.name = 'via'
  mats.push(mat)

  // ⚠️ macroMetros MENOR NA CALÇADA (60) QUE NO ASFALTO (90) porque a calçada
  // tem junta de laje a cada 6 m: um ruído de mundo de 140 m sobre um desenho de
  // 6 m não quebra grade nenhuma, só clareia manchas do tamanho de um quarteirão.
  const matPista = look2 ? vestido('asfalto', '#F5EFE4', 1.0, 90) : mat
  const matCalcada = look2 ? vestido('calcada', '#FFFFFF', 0.95, 60) : mat
  // ⚠️ O ACABAMENTO ENTRA DEPOIS DE `vestido`, NUNCA ANTES: ele envolve o
  // `onBeforeCompile` que `vestir` acabou de instalar. Invertido, `vestir`
  // sobrescreveria o gancho e o acabamento sumiria sem erro nenhum.
  if (look2) {
    acabamentoVia(matPista, 1)
    acabamentoVia(matCalcada, 0)
  }
  const matCanteiro = look2 ? vestido('campo', '#FFFFFF', 1.1, 120) : mat
  const matGuia = look2 ? vestido('pedra', '#FFFFFF', 1.0, 70) : mat
  const matMarca = look2
    ? (() => {
        const m = new THREE.MeshStandardMaterial({ color: COR_MARCA, roughness: 0.72, metalness: 0 })
        m.name = 'via:marca'
        mats.push(m)
        return m
      })()
    : mat

  const feitas: THREE.Mesh[] = []
  const porChao: [Fita, THREE.Material, string][] = look2
    ? [[fPista, matPista, 'via:pista'], [fCalcada, matCalcada, 'via:calcada'],
       [fCanteiro, matCanteiro, 'via:canteiro']]
    : [[chao, mat, 'via:chao']]
  for (const [f, mm, nome] of porChao) {
    if (f.vazia) continue
    const piso = f.malha(mm, nome)
    piso.receiveShadow = true
    piso.castShadow = false
    piso.frustumCulled = false
    group.add(piso)
    feitas.push(piso)
  }

  // ⚠️ A SOMBRA DA RUA É A FACE DO MEIO-FIO, e ela é o único relevo que a seção
  // tem. Com plaza-scene.tsx em normalBias 1,2 (o valor antigo) ela não aparece:
  // medido, 1,2 apaga 97% da sombra de um degrau desta ordem. Quem for conferir
  // o relevo tem de estar com o normalBias 0,15 da spec 6.2.
  if (!guia.vazia) {
    const gm = guia.malha(matGuia, 'via:guia')
    gm.receiveShadow = true
    gm.castShadow = o.sombra ?? true
    gm.frustumCulled = false
    group.add(gm)
    feitas.push(gm)
  }
  // sarjeta, chanfro e topo: mesmo material da face, sombra desligada
  if (!guiaPiso.vazia) {
    const gp = guiaPiso.malha(matGuia, 'via:guia:piso')
    gp.receiveShadow = true
    gp.castShadow = false
    gp.frustumCulled = false
    group.add(gp)
    feitas.push(gp)
  }

  const marcaMeshes: THREE.Mesh[] = []
  for (let i = 0; i < marcas.length; i++) {
    const m = marcas[i].fita.malha(matMarca, `via:marca:${malha.bulevares[i]?.id ?? i}`)
    m.receiveShadow = true
    m.castShadow = false            // 2 cm de tinta não lançam sombra
    m.frustumCulled = true
    group.add(m)
    marcaMeshes.push(m)
    feitas.push(m)
    o.culler?.add(m, MARCA_CULL, marcas[i].centro)
  }

  const triangulos = chao.triangulos + fPista.triangulos + fCalcada.triangulos
    + fCanteiro.triangulos + guia.triangulos + guiaPiso.triangulos
    + marcas.reduce((s, m) => s + m.fita.triangulos, 0)

  // ── a máscara: rasteriza tudo de uma vez e mede ──────────────────────────
  // ⚠️ RASTERIZAR NO FIM, E NÃO DENTRO DO LAÇO DE GEOMETRIA, TEM DOIS MOTIVOS. O
  // primeiro é MEDIR: dois `performance.now()` em volta de um laço só, em vez de
  // cem mil chamadas de relógio de 30 a 50 ns dentro do desenho, que sozinhas
  // custariam mais que o trabalho. O segundo é localidade: um laço que só escreve
  // bit num Uint8Array de 2 MB roda em cache, enquanto intercalado com `cotaVia`
  // e `push` de vértice ele briga por linha de cache com tudo.
  // ⚠️ LEITURA E ESCRITA DE 2 BITS, NUM LUGAR SÓ. `escreverCel` prioriza
  // sarjeta > calçada > pista > nada (ver a nota grande de `mascara`, acima):
  // nunca sobrescreve um código MAIOR por um menor, então a ordem em que os
  // quads chegam durante o desenho não importa pro resultado final.
  const lerCel = (gx: number, gz: number): number => {
    const bit = (gz << 12) | gx
    const idx = bit >> 2, desloc = (bit & 3) * 2
    return (mascara[idx] >> desloc) & 3
  }
  const escreverCel = (gx: number, gz: number, codigo: number) => {
    const bit = (gz << 12) | gx
    const idx = bit >> 2, desloc = (bit & 3) * 2
    if (codigo > ((mascara[idx] >> desloc) & 3)) {
      mascara[idx] = (mascara[idx] & ~(3 << desloc)) | (codigo << desloc)
    }
  }
  const tMasc = performance.now()
  for (let q = 0; q < quadsVia.length; q += 9) {
    const codigo = quadsVia[q]
    const ax = quadsVia[q + 1], az = quadsVia[q + 2]
    const bx = quadsVia[q + 3], bz = quadsVia[q + 4]
    const cx = quadsVia[q + 5], cz = quadsVia[q + 6]
    const dx = quadsVia[q + 7], dz = quadsVia[q + 8]
    const l1 = Math.max(Math.hypot(bx - ax, bz - az), Math.hypot(cx - dx, cz - dz))
    const l2 = Math.max(Math.hypot(dx - ax, dz - az), Math.hypot(cx - bx, cz - bz))
    const n1 = Math.max(1, Math.ceil(l1 / MASC_PASSO))
    const n2 = Math.max(1, Math.ceil(l2 / MASC_PASSO))
    for (let i = 0; i <= n1; i++) {
      const u = i / n1
      const p0x = ax + (bx - ax) * u, p0z = az + (bz - az) * u
      const p1x = dx + (cx - dx) * u, p1z = dz + (cz - dz) * u
      for (let j = 0; j <= n2; j++) {
        const v = j / n2
        const gx = (p0x + (p1x - p0x) * v) / MASC_CEL + MASC_MEIO
        const gz = (p0z + (p1z - p0z) * v) / MASC_CEL + MASC_MEIO
        if (gx < 0 || gz < 0 || gx >= MASC_N || gz >= MASC_N) continue
        escreverCel(gx | 0, gz | 0, codigo)
      }
    }
  }
  const mascaraMs = performance.now() - tMasc
  quadsVia.length = 0

  // ── a cobertura, medida na própria máscara ──────────────────────────────
  //
  // ⚠️ ELA É MEDIDA E NÃO PROMETIDA, e o motivo é que a promessa já falhou uma
  // vez. Em 02/09 o portão de conferência achou dois quarteirões sem pavimento
  // por sonda manual, e a conta offline mostrou que eram 660 de 1.862 (35,4%).
  // Agora quem responde é a própria máscara que a rua acabou de pintar, no boot,
  // toda vez: se alguém tirar uma classe de via do desenho, o número sobe no
  // console no mesmo instante em vez de esperar outra chapa.
  //
  // ⚠️ O ANEL QUADRADO ANDA DE DOIS EM DOIS E ISSO É SEGURO POR CONSTRUÇÃO. A via
  // mais estreita desta cidade tem 9 m de seção, ou seja pelo menos duas células
  // de 4 m no sentido curto: ela não cabe entre dois anéis vizinhos sem tocar um
  // deles. Pular de dois corta o custo pela metade sem poder escapar de nada.
  //
  // ⚠️ E A PARADA É PELA DISTÂNCIA EUCLIDIANA, NÃO PELO ANEL. Achar pavimento no
  // anel de Chebyshev `r` significa distância entre (r-1)·4 e r·4·raiz(2): parar
  // no primeiro achado devolveria "coberto" para pontos a 283 m. O laço continua
  // enquanto o anel ainda puder bater o melhor já achado, então o mínimo sai
  // certo com erro de uma célula.
  const RAIO_COBERTURA = 200
  let quarteiroesSemVia = 0
  {
    const nmax = Math.ceil(RAIO_COBERTURA / MASC_CEL) + 2
    const conta = (px: number, pz: number): number => {
      const gx = Math.floor(px / MASC_CEL) + MASC_MEIO
      const gz = Math.floor(pz / MASC_CEL) + MASC_MEIO
      let melhor = Infinity
      const olha = (i: number, j: number) => {
        if (i < 0 || j < 0 || i >= MASC_N || j >= MASC_N) return
        if (lerCel(i, j) === 0) return
        const dx = (i - gx) * MASC_CEL, dz = (j - gz) * MASC_CEL
        const d = Math.hypot(dx, dz)
        if (d < melhor) melhor = d
      }
      for (let r = 0; r <= nmax; r += 2) {
        if ((r - 1) * MASC_CEL >= Math.min(melhor, RAIO_COBERTURA)) break
        if (r === 0) { olha(gx, gz); continue }
        for (let d = -r; d <= r; d++) {
          olha(gx + d, gz - r)
          olha(gx + d, gz + r)
          olha(gx - r, gz + d)
          olha(gx + r, gz + d)
        }
      }
      return melhor
    }
    for (const q of malha.quarteiroes) if (conta(q.x, q.z) > RAIO_COBERTURA) quarteiroesSemVia++
  }

  const naVia = (x: number, z: number, folga = 0): boolean => {
    const f = folga > 0 ? folga : 0
    let i0 = Math.floor((x - f) / MASC_CEL) + MASC_MEIO
    let i1 = Math.floor((x + f) / MASC_CEL) + MASC_MEIO
    let j0 = Math.floor((z - f) / MASC_CEL) + MASC_MEIO
    let j1 = Math.floor((z + f) / MASC_CEL) + MASC_MEIO
    if (i1 < 0 || j1 < 0 || i0 >= MASC_N || j0 >= MASC_N) return false
    if (i0 < 0) i0 = 0
    if (j0 < 0) j0 = 0
    if (i1 >= MASC_N) i1 = MASC_N - 1
    if (j1 >= MASC_N) j1 = MASC_N - 1
    // ⚠️ O LAÇO É O(1) AMORTIZADO E TEM DE CONTINUAR SENDO. Com a folga de 3 a 6 m
    // que a arborização usa, isto varre de 4 a 9 células; a folga não é um raio
    // qualquer, e pedir 200 m aqui varreria 2.500 células por consulta.
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        if (lerCel(i, j) !== 0) return true
      }
    }
    return false
  }

  // ⚠️ TAREFA 4 (02/09), pedida pela frente de decalque: `naVia` só respondia
  // sim/não; remendo de asfalto e junta de concretagem de calçada disputavam
  // a mesma zona porque nada sabia distinguir uma da outra. Mesma máscara,
  // mesma célula de 4 m (ver a nota grande lá em cima e o limite que ela
  // registra pra sarjeta), zero consulta nova: só devolve o código que já
  // estava lá. Sem folga, de propósito: quem quer margem chama `naVia` com
  // `folga` primeiro e usa `sobreQue` só pra classificar um ponto que já sabe
  // que está em cima de via.
  const sobreQue = (x: number, z: number): 'pista' | 'sarjeta' | 'calcada' | null => {
    const gx = Math.floor(x / MASC_CEL) + MASC_MEIO
    const gz = Math.floor(z / MASC_CEL) + MASC_MEIO
    if (gx < 0 || gz < 0 || gx >= MASC_N || gz >= MASC_N) return null
    const c = lerCel(gx, gz)
    return c === 1 ? 'pista' : c === 2 ? 'calcada' : c === 3 ? 'sarjeta' : null
  }

  return {
    group,
    quarteiroes: nq,
    aneis: nAneis,
    rotatorias: nRot,
    pracas: 0,   // ⚠️ a praça de quarto acabou; o verde é `parques`, em pracas.ts
    bulevares: malha.bulevares.length,
    travessias,
    cruzamentos: teiaCruz,
    quarteiroesSemVia,
    eixos,
    faixas: faixasPed,
    triangulos,
    metrosDeVia: Math.round(metros),
    naVia,
    sobreQue,
    mascaraMs,
    update(cam: THREE.Vector3) {
      for (let i = 0; i < marcaMeshes.length; i++) {
        const on = cam.distanceTo(marcas[i].centro) < MARCA_CULL
        if (marcaMeshes[i].visible !== on) marcaMeshes[i].visible = on
      }
    },
    dispose() {
      for (const m of feitas) m.geometry.dispose()
      // ⚠️ TODOS OS MATERIAIS, não só o antigo `mat`: o look 2 cria cinco. Cada um
      // segura três clones de textura (map, normal, roughness) e o clone morre
      // com ele; a IMAGEM na GPU é compartilhada por `materiais.ts` e não é
      // liberada aqui, que é o certo, senão a próxima cena regenera 512² à toa.
      for (const m of mats) m.dispose()
      group.clear()
    },
  }
}
