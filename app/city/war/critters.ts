// Os dois exércitos, esculpidos em voxel e fundidos numa geometria cada.
//
// ⚠️ MILHARES DE UNIDADES SÓ FICAM BARATAS COM InstancedMesh, e InstancedMesh
// pede UMA geometria por espécie. Cada bicho nasce de caixas transformadas e
// fundidas, com a cor pintada POR VÉRTICE (casaco laranja Bitcoin no cão, pelo
// marrom no urso); o material liga vertexColors e o resto é de graça.
//
// O cão olha para +x (ataca para a direita), o urso para -x. A linha de frente
// fica em x = 0 e cada exército marcha de costas para a própria retaguarda.
//
// ⚠️ ORÇAMENTO DE CAIXAS: no máximo ~26 por bicho (há até 4000 instâncias por
// lado, e cada caixa custa 24 vértices fundidos na mesma geometria). Todo
// detalhe novo abaixo foi contado a dedo pra caber nesse teto; se for
// adicionar mais, tire uma caixa de algum lugar antes de somar em outro.
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

// ⚠️ o hex do casaco NÃO é o #f7931a da marca: sob sol quente + exposição 1.42
// + ACES ele sai DOURADO na tela. O canal verde vai mais baixo aqui pra que o
// tonemap devolva laranja de verdade; a marca continua #f7931a só no HUD 2D.
const BITCOIN_ORANGE = new THREE.Color('#f0680b')
const SHIBA_TAN = new THREE.Color('#c9722a')
const SHIBA_CREAM = new THREE.Color('#efe2c6')
// a mesma cor de orelha de sempre, agora usada como miolo escuro da orelha
// (a orelha externa virou SHIBA_TAN pra fechar com a cabeça) e não mais como
// tom único da peça inteira
const SHIBA_EAR = new THREE.Color('#a35d24')
// nariz, coronha e cano são detalhes pequenos (poucos vértices na silhueta
// total), então não entram na regra de compensação ACES abaixo: escurecem um
// pouco no tonemap e isso é até desejável, lê como sombra do focinho/arma
const SHIBA_NOSE = new THREE.Color('#241712')
const RIFLE_STOCK = new THREE.Color('#3d2817')
const RIFLE_BARREL = new THREE.Color('#33363b')

// ⚠️ a massa do urso precisa nascer MAIS CLARA do que o tom real de pelo de
// urso, senão a exposição 1.42 + ACES devolve breu contra o fundo #040305
// assim que a cena encolhe pra miniatura de card no X. Por isso o marrom de
// trabalho abaixo (família #8a5a36 do pedido) é puxado pra cima; o tom cru
// #8a5a36 volta como sombra (pé, parte funda do pelo), porque nesse papel ele
// já é a versão "queimada" que queríamos ver na tela.
const BEAR_FUR = new THREE.Color('#ac7043')
const BEAR_FUR_DARK = new THREE.Color('#8a5a36')
const BEAR_MUZZLE_TAN = new THREE.Color('#d9a877')
const BEAR_NOSE_DARK = new THREE.Color('#2a1811')
// mesma lógica de exposição pro vermelho da camisa: #c22b38 cru murcha sob
// ACES, então o tom de trabalho sai mais vivo pra pousar correto na tela
const SHIRT_RED = new THREE.Color('#e6394a')

function caixa(w: number, h: number, d: number, x: number, y: number, z: number, cor: THREE.Color) {
  const g = new THREE.BoxGeometry(w, h, d)
  g.translate(x, y, z)
  const n = g.attributes.position.count
  const cores = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    cores[i * 3] = cor.r
    cores[i * 3 + 1] = cor.g
    cores[i * 3 + 2] = cor.b
  }
  g.setAttribute('color', new THREE.BufferAttribute(cores, 3))
  return g
}

/** Shiba Inu DE PÉ, soldado de ~1.8, casaco laranja Bitcoin, olhando para +x.
 *  ⚠️ Bípede de propósito (pedido do fundador): exército é gente em pé, e a
 *  silhueta vertical lê como tropa a qualquer distância.
 *
 *  26 caixas: 18 de corpo/equipamento + 8 do logo do Bitcoin nas costas
 *  (teto do orçamento). Pernas ficaram sem caixa própria de bota porque o
 *  creme claro delas já lê como pata/bota contra o resto do corpo; o
 *  orçamento extra foi todo pro logo, que é o pedido principal desta rodada. */
export function shibaGeometry(): THREE.BufferGeometry {
  const partes = [
    // pernas, pés em y=0
    caixa(0.18, 0.5, 0.16, 0.02, 0.25, 0.13, SHIBA_CREAM),
    caixa(0.18, 0.5, 0.16, 0.02, 0.25, -0.13, SHIBA_CREAM),

    // casaco: tronco laranja Bitcoin, a marca do exército comprador
    caixa(0.5, 0.72, 0.56, 0, 0.86, 0, BITCOIN_ORANGE),
    // gola do casaco, aro creme em volta do pescoço
    caixa(0.3, 0.08, 0.62, 0, 1.24, 0, SHIBA_CREAM),

    // braços convergindo pra frente, segurando o fuzil junto ao corpo
    caixa(0.28, 0.13, 0.11, 0.32, 1.02, 0.09, SHIBA_TAN),
    caixa(0.28, 0.13, 0.11, 0.32, 1.02, -0.09, SHIBA_TAN),
    // fuzil voxel apontado pra +x: coronha marrom escura + cano metal escuro
    caixa(0.12, 0.1, 0.14, 0.5, 1.03, 0, RIFLE_STOCK),
    caixa(0.32, 0.06, 0.06, 0.74, 1.05, 0, RIFLE_BARREL),

    // cabeça
    caixa(0.44, 0.4, 0.46, 0.06, 1.44, 0, SHIBA_TAN),
    // bochechas creme, uma placa só cobrindo os dois lados do focinho
    caixa(0.1, 0.12, 0.4, 0.2, 1.37, 0, SHIBA_CREAM),
    // focinho de duas caixas: base tan + ponta de nariz escura
    caixa(0.14, 0.15, 0.2, 0.29, 1.38, 0, SHIBA_TAN),
    caixa(0.06, 0.07, 0.1, 0.38, 1.36, 0, SHIBA_NOSE),
    // orelhas pontudas com miolo escuro (externa tan, miolo na cor de orelha)
    caixa(0.12, 0.18, 0.1, 0.02, 1.71, 0.14, SHIBA_TAN),
    caixa(0.05, 0.11, 0.06, 0.05, 1.7, 0.14, SHIBA_EAR),
    caixa(0.12, 0.18, 0.1, 0.02, 1.71, -0.14, SHIBA_TAN),
    caixa(0.05, 0.11, 0.06, 0.05, 1.7, -0.14, SHIBA_EAR),

    // rabo enrolado em dois segmentos
    caixa(0.16, 0.18, 0.14, -0.28, 0.95, 0, SHIBA_TAN),
    caixa(0.14, 0.16, 0.12, -0.4, 1.12, 0.03, SHIBA_CREAM),

    // logo do Bitcoin nas costas (face -x do casaco): um B com um tracinho
    // vertical saindo em cima e outro embaixo, em caixinhas rasas creme claro
    // pra ler contra o laranja. Espinha em z negativo, barras esticando pro
    // z positivo, ~0.45 de altura centrado no meio das costas.
    caixa(0.04, 0.07, 0.06, -0.26, 0.97, -0.06, SHIBA_CREAM),
    caixa(0.04, 0.06, 0.11, -0.26, 0.97, 0.03, SHIBA_CREAM),
    caixa(0.04, 0.07, 0.06, -0.26, 0.86, -0.06, SHIBA_CREAM),
    caixa(0.04, 0.06, 0.11, -0.26, 0.86, 0.03, SHIBA_CREAM),
    caixa(0.04, 0.07, 0.06, -0.26, 0.75, -0.06, SHIBA_CREAM),
    caixa(0.04, 0.06, 0.11, -0.26, 0.75, 0.03, SHIBA_CREAM),
    caixa(0.04, 0.08, 0.04, -0.26, 1.045, -0.06, SHIBA_CREAM),
    caixa(0.04, 0.08, 0.04, -0.26, 0.675, -0.06, SHIBA_CREAM),
  ]
  const g = mergeGeometries(partes, false)!
  partes.forEach((p) => p.dispose())
  return g
}

/** Urso EMPINADO, ~2.15 de altura, garras adiante, olhando para -x.
 *  Mais alto que o cão de propósito: urso de pé é a postura de ameaça, e a
 *  diferença de estatura entre as linhas conta a história sozinha.
 *
 *  20 caixas, bem abaixo do teto de 26: pelo marrom de urso de verdade com
 *  camisa vermelha por cima do tronco (barriga da camisa mais larga que o
 *  pelo por baixo, pra ler como peça vestida e não como pintura no corpo). */
export function bearGeometry(): THREE.BufferGeometry {
  const partes = [
    // pernas e pés, pés em y=0
    caixa(0.24, 0.46, 0.22, -0.02, 0.23, 0.17, BEAR_FUR),
    caixa(0.24, 0.46, 0.22, -0.02, 0.23, -0.17, BEAR_FUR),
    caixa(0.26, 0.12, 0.24, -0.02, 0.06, 0.17, BEAR_FUR_DARK),
    caixa(0.26, 0.12, 0.24, -0.02, 0.06, -0.17, BEAR_FUR_DARK),

    // tronco: pelo por baixo (mais estreito) e camisa vermelha por cima
    // (barriga um tico mais larga, pra parecer roupa vestida sobre o pelo)
    caixa(0.62, 0.95, 0.7, 0, 1.02, 0, BEAR_FUR),
    caixa(0.7, 0.6, 0.8, 0, 1.0, 0, SHIRT_RED),
    caixa(0.3, 0.08, 0.5, 0, 1.33, 0, SHIRT_RED), // gola da camisa
    caixa(0.5, 0.2, 0.58, 0.06, 1.5, 0, SHIRT_RED), // manga curta no ombro

    // braços erguidos: pelo marrom exposto abaixo da manga curta
    caixa(0.5, 0.2, 0.2, -0.38, 1.42, 0.33, BEAR_FUR),
    caixa(0.5, 0.2, 0.2, -0.38, 1.42, -0.33, BEAR_FUR),
    // garras com dedos: duas caixinhas escuras por pata
    caixa(0.08, 0.14, 0.09, -0.68, 1.44, 0.3, BEAR_NOSE_DARK),
    caixa(0.08, 0.14, 0.09, -0.68, 1.32, 0.36, BEAR_NOSE_DARK),
    caixa(0.08, 0.14, 0.09, -0.68, 1.44, -0.3, BEAR_NOSE_DARK),
    caixa(0.08, 0.14, 0.09, -0.68, 1.32, -0.36, BEAR_NOSE_DARK),

    // cabeça com focinho de duas caixas (tan + ponta de nariz escura) e
    // orelhas redondas
    caixa(0.48, 0.44, 0.5, -0.12, 1.85, 0, BEAR_FUR),
    caixa(0.2, 0.18, 0.24, -0.42, 1.78, 0, BEAR_MUZZLE_TAN),
    caixa(0.08, 0.08, 0.1, -0.54, 1.76, 0, BEAR_NOSE_DARK),
    caixa(0.16, 0.16, 0.14, -0.04, 2.11, 0.18, BEAR_FUR),
    caixa(0.16, 0.16, 0.14, -0.04, 2.11, -0.18, BEAR_FUR),

    // cinto marcando a cintura, onde a camisa termina
    caixa(0.64, 0.08, 0.72, 0, 0.62, 0, BEAR_NOSE_DARK),
  ]
  const g = mergeGeometries(partes, false)!
  partes.forEach((p) => p.dispose())
  return g
}
