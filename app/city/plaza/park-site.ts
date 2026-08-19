// Onde fica o Parque Runestone, e só isso: um módulo sem dependências para o
// terreno (que abre a cova sob o parque) e o parque (que se assenta nela) lerem
// a mesma posição sem se importarem em círculo.
//
// A posição é a da cena da landing (`blender/dogcity-landing.blend`): o Runestone
// está em (2300, 2460) no quadro do Blender, a nordeste da praça, no rumo 43°, com
// a estrada cênica saindo da cidade até ele. O parque V2 tem 7,2 km de lado e a
// chegada (estrada, Portão, Longshadow Plaza) fica 2,8 a 3,7 km a sudoeste do
// Monarca, do lado da praça; a 3,4 km o Portão cairia dentro do jardim. Então o
// mesmo rumo, 43°, e a distância que deixa TODO o construído do parque a mais de
// 2,3 km do centro (fora do platô, que acaba em 1,3 km): 5,2 km. Sem rotação: o
// quadro do parque (x leste, y norte no Blender) já olha com a marca do Monarca
// (az 225) e o vale para a praça, que está a sudoeste dele.
import * as THREE from 'three'

const BEARING = THREE.MathUtils.degToRad(43)
const DIST = 5200
export const PARK_CENTER = new THREE.Vector3(Math.round(DIST * Math.sin(BEARING)), 0, -Math.round(DIST * Math.cos(BEARING)))
export const PARK_ROT_Y = 0
/** meio-lado da malha do parque (o disco tem este raio) */
export const PARK_HALF = 3600
/** até aqui o parque é o parque; daqui a PARK_HALF ele funde no regolito */
export const PARK_CORE = 3100
/** quanto o regolito desce sob o parque, abaixo do datum, para nunca vazar pelo vale (fundo −61) */
export const PARK_PIT = 80

/** Onde o salão do Templo Leonidas ficou, em MUNDO. O parque preenche quando
 *  carrega (a altura só se sabe depois do datum); as vistas leem daqui. Enquanto
 *  for (0,0,0) o marcador do menu cai numa estimativa. */
export const TEMPLE_WORLD = new THREE.Vector3()
