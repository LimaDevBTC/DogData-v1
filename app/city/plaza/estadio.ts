// ═══════════════════════════════════════════════════════════════════════════
// $DOG ARENA na cena da cidade.
//
// O modelo vem de `blender/build_estadio.py` (bacia calculada pela linha de
// visada em `scripts/bacia_estadio.py`) e entra na praça como GLB, igual às
// torres. A posição NÃO é escolhida aqui: ela é a da reserva `E03` que já está
// gravada em `data/dogcity_programa_congelado.json`, e é o gerador quem manda.
// Mudar o número aqui sem mudar a reserva põe o estádio em cima de lote.
//
// Plano em `estadio.md`.
// ═══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three'

/** Centro da reserva E03, em coordenadas de mundo. */
export const ESTADIO_X = 2398.4
export const ESTADIO_Z = 1481.2

/**
 * ⚠️ O GIRO DA PEÇA É O NEGATIVO DO `rot` DA RESERVA. O gerador escreve a peça
 * com `x = lx·cos(rot) − lz·sin(rot)`, `z = lx·sin(rot) + lz·cos(rot)`, ou seja
 * o eixo longo dela aponta para `(cos rot, sin rot)` no plano (x, z). Em three
 * um objeto com `rotation.y = φ` manda o próprio X local para
 * `(cos φ, 0, −sin φ)`, então alinhar os dois pede `φ = −rot`.
 */
export const ESTADIO_ROT_DEG = 285.0

/** A peça tem 300 m de envelope: some bem depois das torres. */
export const ESTADIO_CULL = 7000

/** Assenta o GLB no terreno, no centro da reserva, com o giro dela. */
export function assentarEstadio(
  root: THREE.Object3D,
  alturaEm: (x: number, z: number) => number,
): THREE.Object3D {
  root.name = 'DOG_ARENA'
  root.position.set(ESTADIO_X, alturaEm(ESTADIO_X, ESTADIO_Z), ESTADIO_Z)
  root.rotation.y = -(ESTADIO_ROT_DEG * Math.PI) / 180
  return root
}
