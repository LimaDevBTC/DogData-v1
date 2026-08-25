// O TANQUE: mesma lógica de identidade dos exércitos (critters.ts), um degrau
// mais pesado, chapa em vez de pelagem. Entra em cena quando o VOLUME REAL do
// DOG sobe; é o troféu visível de um mercado acordado.
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

export interface CoresTanque {
  casco: THREE.Color
  cascoSombra: THREE.Color
  detalhe: THREE.Color
  esteira: THREE.Color
}

export const CORES_TANQUE_DOG: CoresTanque = {
  casco: new THREE.Color('#e06207'),
  cascoSombra: new THREE.Color('#8a480f'),
  detalhe: new THREE.Color('#efe2c6'),
  esteira: new THREE.Color('#2a1f14'),
}
export const CORES_TANQUE_URSO: CoresTanque = {
  casco: new THREE.Color('#4a1220'),
  cascoSombra: new THREE.Color('#2c0a12'),
  detalhe: new THREE.Color('#8f2a3f'),
  esteira: new THREE.Color('#1a0c10'),
}

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

export interface TanqueGeo {
  casco: THREE.BufferGeometry
  torre: THREE.BufferGeometry
}

/** ~3.5 de comprimento. sentido=1 olha pra +x (cães); sentido=-1 pra -x
 *  (ursos). A torre volta com pivô em (0,0,0): quem gira é o grupo que a
 *  recebe, não a geometria. */
export function buildTankGeometry(cores: CoresTanque, sentido: 1 | -1 = 1): TanqueGeo {
  const s = sentido
  const rodas: THREE.BufferGeometry[] = []
  for (let i = 0; i < 4; i++) {
    const rx = -1.3 + i * 0.9
    rodas.push(caixa(0.3, 0.3, 0.1, rx, 0.16, 0.78, cores.detalhe))
    rodas.push(caixa(0.3, 0.3, 0.1, rx, 0.16, -0.78, cores.detalhe))
  }
  const casco = mergeGeometries([
    caixa(3.5, 0.62, 1.55, 0, 0.5, 0, cores.casco),
    caixa(0.7, 0.5, 1.4, s * 1.5, 0.34, 0, cores.cascoSombra),
    caixa(3.4, 0.22, 0.26, 0, 0.26, 0.68, cores.esteira),
    caixa(3.4, 0.22, 0.26, 0, 0.26, -0.68, cores.esteira),
    caixa(3.2, 0.12, 0.18, 0, 0.62, 0.72, cores.cascoSombra),
    caixa(3.2, 0.12, 0.18, 0, 0.62, -0.72, cores.cascoSombra),
    caixa(0.5, 0.16, 1.2, s * -1.35, 0.86, 0, cores.detalhe),
    caixa(0.16, 0.16, 0.16, s * 1.7, 0.7, 0.5, cores.detalhe),
    caixa(0.16, 0.16, 0.16, s * 1.7, 0.7, -0.5, cores.detalhe),
    ...rodas,
  ], false)!
  casco.computeVertexNormals()

  const torre = mergeGeometries([
    caixa(1.05, 0.5, 1.0, 0, 0.28, 0, cores.casco),
    caixa(0.32, 0.16, 0.32, s * -0.15, 0.58, 0, cores.detalhe),
    caixa(2.0, 0.15, 0.15, s * 1.3, 0.16, 0, cores.cascoSombra),
    caixa(0.26, 0.26, 0.26, s * 2.3, 0.16, 0, cores.detalhe),
  ], false)!
  torre.computeVertexNormals()

  return { casco, torre }
}
