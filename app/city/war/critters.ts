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

const BITCOIN_ORANGE = new THREE.Color('#f7931a')
const SHIBA_TAN = new THREE.Color('#d69a55')
const SHIBA_CREAM = new THREE.Color('#efe2c6')
const SHIBA_EAR = new THREE.Color('#b57c3c')
const BEAR_DARK = new THREE.Color('#4a2620')
const BEAR_HEAD = new THREE.Color('#573129')
const BEAR_MUZZLE = new THREE.Color('#6f453a')

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

/** Shiba Inu de casaco laranja Bitcoin, ~1.4 de altura, olhando para +x. */
export function shibaGeometry(): THREE.BufferGeometry {
  const partes = [
    // o casaco é o corpo: laranja Bitcoin, a marca do exército comprador
    caixa(0.95, 0.5, 0.55, 0, 0.62, 0, BITCOIN_ORANGE),
    caixa(0.22, 0.42, 0.45, 0.52, 0.6, 0, SHIBA_CREAM),      // peito
    caixa(0.42, 0.38, 0.44, 0.64, 1.06, 0, SHIBA_TAN),       // cabeça
    caixa(0.18, 0.15, 0.2, 0.9, 0.98, 0, SHIBA_CREAM),       // focinho
    caixa(0.12, 0.17, 0.1, 0.58, 1.32, 0.13, SHIBA_EAR),     // orelha
    caixa(0.12, 0.17, 0.1, 0.58, 1.32, -0.13, SHIBA_EAR),    // orelha
    caixa(0.13, 0.36, 0.13, 0.33, 0.18, 0.18, SHIBA_CREAM),  // pernas
    caixa(0.13, 0.36, 0.13, 0.33, 0.18, -0.18, SHIBA_CREAM),
    caixa(0.13, 0.36, 0.13, -0.33, 0.18, 0.18, SHIBA_CREAM),
    caixa(0.13, 0.36, 0.13, -0.33, 0.18, -0.18, SHIBA_CREAM),
    caixa(0.2, 0.24, 0.16, -0.55, 0.98, 0, SHIBA_CREAM),     // rabo enrolado
  ]
  const g = mergeGeometries(partes, false)!
  partes.forEach((p) => p.dispose())
  return g
}

/** Urso, mais parrudo, ~1.5 de altura, olhando para -x. */
export function bearGeometry(): THREE.BufferGeometry {
  const partes = [
    caixa(1.15, 0.72, 0.68, 0, 0.7, 0, BEAR_DARK),
    caixa(0.42, 0.22, 0.52, 0.18, 1.12, 0, BEAR_DARK),        // corcova
    caixa(0.5, 0.44, 0.5, -0.72, 1.04, 0, BEAR_HEAD),
    caixa(0.18, 0.18, 0.22, -1.02, 0.94, 0, BEAR_MUZZLE),
    caixa(0.14, 0.14, 0.1, -0.64, 1.32, 0.17, BEAR_HEAD),
    caixa(0.14, 0.14, 0.1, -0.64, 1.32, -0.17, BEAR_HEAD),
    caixa(0.2, 0.38, 0.2, 0.38, 0.19, 0.22, BEAR_DARK),
    caixa(0.2, 0.38, 0.2, 0.38, 0.19, -0.22, BEAR_DARK),
    caixa(0.2, 0.38, 0.2, -0.38, 0.19, 0.22, BEAR_DARK),
    caixa(0.2, 0.38, 0.2, -0.38, 0.19, -0.22, BEAR_DARK),
  ]
  const g = mergeGeometries(partes, false)!
  partes.forEach((p) => p.dispose())
  return g
}
