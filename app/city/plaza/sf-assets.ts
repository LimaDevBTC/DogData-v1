// Os modelos que o fundador trouxe do Sketchfab (2026-08-19), convertidos por
// `blender/convert_sketchfab_assets.py` para `public/city/sf/`: origem no chão,
// metros, texturas 512 WEBP, Draco.
//
// LICENÇA: todos são CC-BY-4.0, que EXIGE crédito ao autor. A lista abaixo é a
// fonte única do crédito e aparece no menu Places da praça. Quem acrescentar um
// modelo acrescenta a linha aqui, senão o crédito fica errado e a licença, rompida.
//
// FICOU DE FORA: "Fur Tree" de Harri Jones é CC-BY-SA-4.0 (share-alike): usar
// obriga a licenciar o derivado (a cena) nos mesmos termos. Decisão do fundador;
// o arquivo está guardado em blender/assets-sketchfab/ com o nome marcado.
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

export interface Credit { title: string; author: string; license: string; url: string }

export const SF_CREDITS: readonly Credit[] = [
  { title: 'Black Spider Warrior Character', author: 'iRahulRajput', license: 'CC BY 4.0', url: 'https://sketchfab.com/3d-models/black-spider-warrior-character-3d-model-free-99225611fda64a34aa197730dd3a67c0' },
  { title: 'Mystery in Bronze', author: 'dialobic', license: 'CC BY 4.0', url: 'https://sketchfab.com/3d-models/mystery-in-bronze-f8362dbac4204c03a9e7cffe7caaa4e4' },
  { title: 'Coconut tree', author: 'Rafael Benites de Souza', license: 'CC BY 4.0', url: 'https://sketchfab.com/3d-models/coconut-tree-a03863e070df4094939d37e60e4a8926' },
  { title: 'Japanese Lowpoly temple', author: 'carolinefangel', license: 'CC BY 4.0', url: 'https://sketchfab.com/3d-models/japanese-lowpoly-temple-cc26af7781344e908d356030e84e4121' },
  { title: 'V2 Rocket', author: 'Diccbudd', license: 'CC BY 4.0', url: 'https://sketchfab.com/3d-models/v2-rocket-c12726a34e534e53af7134e22b1f9cca' },
  { title: 'Cypress tree', author: 'ElectroNick', license: 'CC BY 4.0', url: 'https://sketchfab.com/3d-models/cypress-tree-249d8cb553a8469e9d645713f8e96ed1' },
  { title: 'Old olive tree', author: 'massive-graphisme', license: 'CC BY 4.0', url: 'https://sketchfab.com/3d-models/old-olive-tree-6328df8a0f214143a880a72b86db2ab4' },
  { title: 'Sakura Tree 01', author: 'Jogoss', license: 'CC BY 4.0', url: 'https://sketchfab.com/3d-models/sakura-tree-01-low-poly-model-147ae7d0d332456a99ec6195e9b0cd4f' },
  { title: 'Artemis Fountain', author: 'Rigsters', license: 'CC BY 4.0', url: 'https://sketchfab.com/3d-models/artemis-fountain-b9985a307aac41bbad4339fa46122d7a' },
  { title: 'Fuente de agua', author: 'Harold.Llanos', license: 'CC BY 4.0', url: 'https://sketchfab.com/3d-models/fuente-de-agua-water-fountain-fb0a385842c94a009ea6fba45c2b80d2' },
  { title: 'Garden Urn', author: 'Lyskilde', license: 'CC BY 4.0', url: 'https://sketchfab.com/3d-models/garden-urn-c0c7f5fa24704a23b0f3cbdd689b8176' },
  { title: 'Classic Park Bench', author: 'Berk Gedik', license: 'CC BY 4.0', url: 'https://sketchfab.com/3d-models/classic-park-bench-low-poly-01a5b64427984632bb44242da3813bb1' },
  { title: 'Japanese Stone Lamp', author: 'aya.albayati', license: 'CC BY 4.0', url: 'https://sketchfab.com/3d-models/japanese-stone-lamp-b7a8a3a174e84258980ddd34e1ad1dc2' },
  { title: 'SpaceX Falcon 9 Strongback', author: "Thor's Hammer", license: 'CC BY 4.0', url: 'https://sketchfab.com/3d-models/spacex-falcon-9-strongback-854921c608784624ad2af042a24fded4' },
  { title: 'Rusty airbase fuel tank', author: 'LuddePudde', license: 'CC BY 4.0', url: 'https://sketchfab.com/3d-models/rusty-airbase-fuel-tank-5ac257aee23e47e0a0f91a4e07a40692' },
  { title: 'Old Scifi satellite dish', author: 'CGKnuenz', license: 'CC BY 4.0', url: 'https://sketchfab.com/3d-models/old-scifi-satellite-dish-f01a91e9773e4622b25c4d27903e85c6' },
  { title: 'Coconut Palm', author: 'evolveduk', license: 'CC BY 4.0', url: 'https://sketchfab.com/3d-models/coconut-palm-26e787f2ff2e4c0fb004c3b0210805a3' },
  { title: 'Human Skull', author: 'CDmir (OpenGameArt)', license: 'CC0', url: 'https://opengameart.org/content/human-skull-0' },
  { title: 'Human Base Meshes', author: 'Blender Studio', license: 'CC0', url: 'https://www.blender.org/download/demo/asset-bundles/' },
]

export const SF = {
  bust: '/city/sf/satoshi-bust.glb',
  palm: '/city/sf/palm.glb',
  rocket: '/city/sf/v2-rocket.glb',
  templeHall: '/city/sf/temple-hall.glb',
} as const

/** Carrega um GLB e devolve a cena, ou null se faltar (a praça nunca quebra por
 *  causa de um adereço). */
export function loadSf(gltf: GLTFLoader, url: string): Promise<THREE.Object3D | null> {
  return new Promise((res) => gltf.load(url, (g) => res(g.scene), undefined, () => { console.warn('[plaza] asset ausente', url); res(null) }))
}

/** A primeira geometria de uma cena, já no quadro do mundo dela (os modelos vêm
 *  com uma malha só depois da conversão). */
export function firstGeometry(root: THREE.Object3D): { geo: THREE.BufferGeometry; mat: THREE.Material } | null {
  let found: { geo: THREE.BufferGeometry; mat: THREE.Material } | null = null
  root.updateMatrixWorld(true)
  root.traverse((o) => {
    const m = o as THREE.Mesh
    if (found || !m.isMesh) return
    const geo = m.geometry.clone()
    geo.applyMatrix4(m.matrixWorld)
    found = { geo, mat: m.material as THREE.Material }
  })
  return found
}

/** Ajusta os materiais de um modelo importado ao ambiente da praça. */
export function dressSf(root: THREE.Object3D, opts: { envMapIntensity?: number; roughness?: number; castShadow?: boolean } = {}) {
  root.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    m.castShadow = opts.castShadow ?? true
    m.receiveShadow = true
    const mat = m.material as THREE.MeshStandardMaterial
    if (!mat) return
    if ('envMapIntensity' in mat) mat.envMapIntensity = opts.envMapIntensity ?? 1.1
    if (opts.roughness !== undefined && 'roughness' in mat) mat.roughness = opts.roughness
  })
}
