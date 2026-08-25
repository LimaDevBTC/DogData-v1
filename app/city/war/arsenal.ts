// ARSENAL PESADO: bateria de canhão e bombardeiro voxel, mesma lógica de
// identidade dos tanques (tanks.ts) — caixas fundidas, cor por vértice, um
// degrau a mais de encenação sem InstancedMesh porque são poucas unidades
// (3 baterias por lado, 1 bombardeiro por lado).
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { CoresTanque } from './tanks'

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

export interface CanhaoGeo {
  base: THREE.BufferGeometry
  cano: THREE.BufferGeometry
}

// ⚠️ a boca fica em (sentido * BOCA_CANHAO_DIST, 0, 0) no espaço LOCAL do
// grupo que recebe `cano` (pivô na culatra): quem chama transforma esse ponto
// pela matrixWorld do pivô pra achar a origem real do disparo em mundo.
export const BOCA_CANHAO_DIST = 2.75

/** peça de artilharia voxel, ~2.6m de altura. `base` fica parada (plataforma
 *  + pedestal); `cano` é filho de um grupo-pivô que gira em Z (elevação) e
 *  translada em X (recuo) — ver battlefield.ts. sentido=1 mira +x (cães),
 *  sentido=-1 mira -x (ursos), já embutido nos offsets da geometria. */
export function buildCanhaoGeometry(cores: CoresTanque, sentido: 1 | -1): CanhaoGeo {
  const s = sentido
  const base = mergeGeometries([
    caixa(2.2, 0.4, 2.2, 0, 0.2, 0, cores.cascoSombra), // plataforma
    caixa(1.3, 2.0, 1.3, 0, 1.2, 0, cores.casco), // pedestal
    caixa(1.5, 0.26, 1.5, 0, 2.33, 0, cores.detalhe), // anel de giro
    caixa(0.26, 0.26, 2.2, s * 0.9, 0.2, 0, cores.detalhe), // trilho de recuo
    caixa(0.5, 0.5, 0.5, 0.85, 0.2, 0.85, cores.esteira),
    caixa(0.5, 0.5, 0.5, -0.85, 0.2, 0.85, cores.esteira),
    caixa(0.5, 0.5, 0.5, 0.85, 0.2, -0.85, cores.esteira),
    caixa(0.5, 0.5, 0.5, -0.85, 0.2, -0.85, cores.esteira),
  ], false)!
  base.computeVertexNormals()

  const cano = mergeGeometries([
    caixa(0.8, 0.8, 0.8, s * 0.1, 0, 0, cores.cascoSombra), // culatra
    caixa(2.6, 0.34, 0.34, s * 1.5, 0, 0, cores.casco), // cano
    caixa(0.42, 0.42, 0.42, s * BOCA_CANHAO_DIST, 0, 0, cores.detalhe), // boca
    caixa(0.5, 0.7, 0.2, s * -0.3, 0.5, 0, cores.detalhe), // escudo
  ], false)!
  cano.computeVertexNormals()

  return { base, cano }
}

/** ~5.5m de comprimento, nariz fixo em +z (o motor sempre atravessa o campo
 *  ao longo de z; ver atualizaBombardeiros). Cor vem da paleta do lado. */
export function buildBombardeiroGeometry(cores: CoresTanque): THREE.BufferGeometry {
  const g = mergeGeometries([
    caixa(0.9, 0.7, 4.2, 0, 0, 0, cores.casco), // fuselagem
    caixa(0.7, 0.5, 1.0, 0, 0.08, 1.9, cores.cascoSombra), // nariz
    caixa(5.0, 0.22, 1.1, 0, 0.1, -0.3, cores.detalhe), // asas
    caixa(0.9, 0.9, 0.85, 0, 0.5, -1.85, cores.cascoSombra), // cauda vertical
    caixa(2.2, 0.2, 0.5, 0, 0.32, -2.05, cores.detalhe), // estabilizador horizontal
    caixa(0.5, 0.5, 0.5, 1.6, -0.15, -0.3, cores.esteira), // motor esquerdo
    caixa(0.5, 0.5, 0.5, -1.6, -0.15, -0.3, cores.esteira), // motor direito
  ], false)!
  g.computeVertexNormals()
  return g
}
