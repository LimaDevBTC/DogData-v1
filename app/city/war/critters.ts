// Os dois exércitos, esculpidos em voxel e fundidos numa geometria cada.
//
// ⚠️ MILHARES DE UNIDADES SÓ FICAM BARATAS COM InstancedMesh, e InstancedMesh
// pede UMA geometria por espécie. Cada bicho nasce de caixas transformadas e
// fundidas, com a cor pintada POR VÉRTICE (casaco laranja Bitcoin no cão, pelo
// escuro no urso); o material liga vertexColors e o resto é de graça.
//
// O cão olha para +x (ataca para a direita), o urso para -x. A linha de frente
// fica em x = 0 e cada exército marcha de costas para a própria retaguarda.
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

// ⚠️ o hex do casaco NÃO é o #f7931a da marca: sob sol quente + exposição 1.42
// + ACES ele sai DOURADO na tela. O canal verde vai mais baixo aqui pra que o
// tonemap devolva laranja de verdade; a marca continua #f7931a só no HUD 2D.
const BITCOIN_ORANGE = new THREE.Color('#f0680b')
const SHIBA_TAN = new THREE.Color('#c9722a')
const SHIBA_CREAM = new THREE.Color('#efe2c6')
const SHIBA_EAR = new THREE.Color('#a35d24')
// ⚠️ a massa do urso precisa de cor tão alta quanto o laranja Bitcoin, senão o
// lado vendedor vira breu contra o fundo #040305 assim que a cena encolhe pra
// miniatura de card no X; a paleta foi calibrada pra thumbnail, não pro close
const BEAR_DARK = new THREE.Color('#7a2436')
const BEAR_HEAD = new THREE.Color('#8f2a3f')
const BEAR_MUZZLE = new THREE.Color('#a8354a')

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
 *  silhueta vertical lê como tropa a qualquer distância. */
export function shibaGeometry(): THREE.BufferGeometry {
  const partes = [
    caixa(0.18, 0.5, 0.16, 0.02, 0.25, 0.13, SHIBA_CREAM),   // pernas
    caixa(0.18, 0.5, 0.16, 0.02, 0.25, -0.13, SHIBA_CREAM),
    // o casaco é o tronco: laranja Bitcoin, a marca do exército comprador
    caixa(0.5, 0.72, 0.56, 0, 0.86, 0, BITCOIN_ORANGE),
    caixa(0.1, 0.5, 0.4, 0.26, 0.82, 0, SHIBA_CREAM),        // peito
    caixa(0.34, 0.16, 0.14, 0.28, 1.05, 0.3, SHIBA_TAN),     // braços em guarda
    caixa(0.34, 0.16, 0.14, 0.28, 1.05, -0.3, SHIBA_TAN),
    caixa(0.12, 0.12, 0.14, 0.47, 1.0, 0.3, SHIBA_CREAM),    // patas
    caixa(0.12, 0.12, 0.14, 0.47, 1.0, -0.3, SHIBA_CREAM),
    caixa(0.44, 0.4, 0.46, 0.06, 1.44, 0, SHIBA_TAN),        // cabeça
    caixa(0.18, 0.16, 0.2, 0.32, 1.38, 0, SHIBA_CREAM),      // focinho
    caixa(0.12, 0.18, 0.1, 0.02, 1.71, 0.14, SHIBA_EAR),     // orelhas
    caixa(0.12, 0.18, 0.1, 0.02, 1.71, -0.14, SHIBA_EAR),
    caixa(0.2, 0.24, 0.16, -0.32, 1.0, 0, SHIBA_CREAM),      // rabo enrolado
  ]
  const g = mergeGeometries(partes, false)!
  partes.forEach((p) => p.dispose())
  return g
}

/** Urso EMPINADO, ~2.15 de altura, garras adiante, olhando para -x.
 *  Mais alto que o cão de propósito: urso de pé é a postura de ameaça, e a
 *  diferença de estatura entre as linhas conta a história sozinha. */
export function bearGeometry(): THREE.BufferGeometry {
  const partes = [
    caixa(0.24, 0.46, 0.22, -0.02, 0.23, 0.17, BEAR_DARK),   // pernas
    caixa(0.24, 0.46, 0.22, -0.02, 0.23, -0.17, BEAR_DARK),
    caixa(0.66, 0.95, 0.74, 0, 1.02, 0, BEAR_DARK),          // tronco
    caixa(0.5, 0.22, 0.6, 0.06, 1.55, 0, BEAR_DARK),         // ombros
    caixa(0.5, 0.2, 0.2, -0.38, 1.42, 0.33, BEAR_HEAD),      // braços erguidos
    caixa(0.5, 0.2, 0.2, -0.38, 1.42, -0.33, BEAR_HEAD),
    caixa(0.14, 0.16, 0.22, -0.66, 1.38, 0.33, BEAR_MUZZLE), // garras
    caixa(0.14, 0.16, 0.22, -0.66, 1.38, -0.33, BEAR_MUZZLE),
    caixa(0.48, 0.44, 0.5, -0.12, 1.85, 0, BEAR_HEAD),       // cabeça
    caixa(0.18, 0.18, 0.22, -0.42, 1.78, 0, BEAR_MUZZLE),    // focinho
    caixa(0.14, 0.14, 0.12, -0.04, 2.11, 0.18, BEAR_HEAD),   // orelhas
    caixa(0.14, 0.14, 0.12, -0.04, 2.11, -0.18, BEAR_HEAD),
  ]
  const g = mergeGeometries(partes, false)!
  partes.forEach((p) => p.dispose())
  return g
}
