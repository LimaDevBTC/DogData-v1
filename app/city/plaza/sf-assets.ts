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
//
// CONSERTO DE CRÉDITO (frente espécies, 02-03/09): o levantamento de maquete
// achou 3 modelos JÁ PUBLICADOS em public/city/sf/ sem linha aqui:
// tree-olive-old, tree-date-hero, tree-sakura-hero, o que é violação de
// CC-BY (a licença EXIGE crédito). Origem e licença conferidas direto no
// `license.txt` que o Sketchfab grava junto de cada download em
// blender/assets-sketchfab/<nome>/license.txt (fonte primária, não a memória
// de ninguém): os três são CC-BY-4.0, uid batendo com blender/picks4.json.
// Linhas abaixo, marca ⚠️ CRÉDITO ATRASADO.
//
// CATÁLOGO NOVO (frente espécies, 02-03/09): sequoia gigante e flamboyant
// pedidos pelo fundador NÃO ENTRARAM: nenhum modelo CC0/CC-BY encontrado no
// Sketchfab é uma árvore inteira (só tronco/cone de fotogrametria para
// sequoia; zero resultado para flamboyant/royal poinciana). Araucaria
// araucana, fig tree (Ficus carica) e jacaranda entraram no pipeline e
// FALHARAM na conversão (fotogrametria com ruído topológico ou geometria
// Sketchfab_model quebrada; ver blender/convert_one_asset.py e o relatório da
// frente para os números), não foram publicados. Os 7 abaixo passaram por
// carga real no Blender e saíram com silhueta íntegra (chapa conferida em
// blender/assets-sketchfab/<nome>/preview.png, renderizada pelo próprio
// conversor, não pela cena).
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

export interface Credit { title: string; author: string; license: string; url: string }

export const SF_CREDITS: readonly Credit[] = [
  // ── o aquário e a floresta das ilhas (29/08) ──────────────────────────────
  { title: 'Soft Coral Set', author: 'Kanna-Nakajima', license: 'CC BY 4.0', url: 'https://sketchfab.com/3d-models/soft-coral-set-256355f15fcb4095af17b75ae572bff0' },
  { title: 'Coral Piece', author: 'Sharon Kunne', license: 'CC BY 4.0', url: 'https://sketchfab.com/3d-models/coral-piece-bd879158d2c9496fa40eb9a8fd8e75f8' },
  { title: 'Stylaster sanguineus', author: 'The Smithsonian Institution', license: 'CC0', url: 'https://sketchfab.com/3d-models/stylaster-sanguineus-4f1ddd8352944d16bf3b821b3e71b473' },
  { title: 'Scaly Maw Anemone', author: 'gavinpgamer1', license: 'CC BY 4.0', url: 'https://sketchfab.com/3d-models/scaly-maw-anemone-75954c35ab4a4764928bdd83ad6830df' },
  { title: 'Scan of Kelp and Seaweed on sand beach', author: 'sterlingcrispin', license: 'CC BY 4.0', url: 'https://sketchfab.com/3d-models/scan-of-kelp-and-seaweed-on-sand-beach-c9b5ef07047a4b7a90a4ffd6930ec22c' },
  { title: 'Paracheirodon Innesi, Tetra Neon', author: 'BlueMesh', license: 'CC BY 4.0', url: 'https://sketchfab.com/3d-models/paracheirodon-innesi---tetra-neon-2fabf5db754746b7b81ebfa0bbe99161' },
  { title: 'Clownfish', author: 'zixisun02', license: 'CC BY 4.0', url: 'https://sketchfab.com/3d-models/clownfish-47ba2679d91a4f14b3fc0bf8e3805af5' },
  { title: 'Tropical Fern Phlebodium', author: 'The_Structure_World', license: 'CC BY 4.0', url: 'https://sketchfab.com/3d-models/tropical-fern-phlebodium-6008e9741f244dfda3dec50b78760488' },
  { title: 'Realistic Fern Plant Bush', author: 'misty-wind', license: 'CC BY 4.0', url: 'https://sketchfab.com/3d-models/realistic-fern-plant-bush-467e72a68a2f416981e656096b7e3be0' },
  { title: 'Realistic Lowpoly Grass', author: 'Mega 3D', license: 'CC BY 4.0', url: 'https://sketchfab.com/3d-models/realistic-lowpoly-grass-e07f59582b6342b4800ae5fe91bf6f30' },
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
  { title: 'Date Palm', author: 'evolveduk', license: 'CC BY 4.0', url: 'https://sketchfab.com/3d-models/date-palm-11acf710e6c149daa8d6fb8cdc5d087f' },
  { title: 'Realistic Palm Tree Free', author: 'Next Spring', license: 'CC BY 4.0', url: 'https://sketchfab.com/3d-models/realistic-palm-tree-free-39052ea764c945858449e699318efa53' },
  { title: 'Bitcoin ATM', author: 'Rescue3D Assets', license: 'CC BY 4.0', url: 'https://sketchfab.com/3d-models/bitcoin-atm-dd33f6140ebe44e3a572cb5856586863' },
  { title: 'Vasque Versailles', author: 'maxime.montegnies', license: 'CC BY 4.0', url: 'https://sketchfab.com/3d-models/vasque-versailles-bosquet-de-la-colonnade-71b5f187c1b8421b8447127a566025fa' },
  { title: 'Obelisk', author: 'Ankledot', license: 'CC BY 4.0', url: 'https://sketchfab.com/3d-models/obelisk-0b4dc3d42d1b4ceb8a19a0001a427864' },
  { title: 'Armillary Sphere', author: 'ChloeRobynSmith', license: 'CC BY 4.0', url: 'https://sketchfab.com/3d-models/armillary-sphere-22e92fc349eb4f8f9091d9d081d57177' },
  { title: 'Stylized Stone Pedestal', author: 'Asgart', license: 'CC BY 4.0', url: 'https://sketchfab.com/3d-models/stylized-stone-pedestal-lowpoly-game-asset-f97ed585d9ef4b7589c873a686fe6531' },
  { title: 'Doric Order Columns', author: 'Oneironauticus', license: 'CC BY 4.0', url: 'https://sketchfab.com/3d-models/doric-order-columns-asset-pack-e27b5b5c101c480dbf1a9781ae289155' },
  { title: 'Torch Pillar', author: 'roroer', license: 'CC BY 4.0', url: 'https://sketchfab.com/3d-models/torch-pillar-a550cc6cea434f9a9f2d47148add0fdf' },
  { title: 'Medieval Brazier', author: 'Sky_Hunter', license: 'CC BY 4.0', url: 'https://sketchfab.com/3d-models/medieval-brazier-cff29e533e3a4298a5d112cf7bb2558c' },
  { title: 'The Ancient Gnarled Tree', author: 'iGauravRajput', license: 'CC BY 4.0', url: 'https://sketchfab.com/3d-models/the-ancient-gnarled-tree-3d-model-free-c3513bb3daeb4ebfba8954367fb85a14' },
  { title: 'Japanese Maple Tree', author: 'OliverMatheGames', license: 'CC BY 4.0', url: 'https://sketchfab.com/3d-models/japanese-maple-tree-b6eb627413ed40fdb8b0a1e1c9038fa9' },
  { title: 'High Quality Tree 3/6', author: 'EFX', license: 'CC BY 4.0', url: 'https://sketchfab.com/3d-models/high-quality-tree-36-53623598e75844b696abf2b94566afa5' },
  { title: 'Glowing Mushroom', author: 'Jakob_Forseth', license: 'CC BY 4.0', url: 'https://sketchfab.com/3d-models/glowing-mushroom-4d69b432b067413d9d7bac74f02155c0' },
  { title: 'Stylized glowing mushrooms', author: 'RiZoRuS77', license: 'CC BY 4.0', url: 'https://sketchfab.com/3d-models/stylized-glowing-mushrooms-c041db2908ba4bf0a028af10436e1582' },
  { title: 'Human Skull', author: 'CDmir (OpenGameArt)', license: 'CC0', url: 'https://opengameart.org/content/human-skull-0' },
  { title: 'Human Base Meshes', author: 'Blender Studio', license: 'CC0', url: 'https://www.blender.org/download/demo/asset-bundles/' },
  // ── ⚠️ CRÉDITO ATRASADO: já em public/city/sf/ desde antes desta frente,
  // sem esta linha (achado pelo levantamento de maquete) ──────────────────
  { title: 'Old Olive Tree', author: 'AhmetGuner3d', license: 'CC BY 4.0', url: 'https://sketchfab.com/3d-models/old-olive-tree-915d62b65f0d41fba3f473cd047df799' },
  { title: 'Date Palm Photogrammetry Scan', author: 'AirSickLowLander', license: 'CC BY 4.0', url: 'https://sketchfab.com/3d-models/date-palm-photogrammetry-scan-853b4e0d46c54012829a0a68631580d2' },
  { title: 'Cherry Blossom (Sakura) Tree Realistic Model', author: 'Viasky', license: 'CC BY 4.0', url: 'https://sketchfab.com/3d-models/cherry-blossom-sakura-tree-realistic-model-6c70f11081e4438b878f4c007a48ab65' },
  // ── o catálogo novo (frente espécies, 02-03/09): sequoia/pinheiro, jardim
  // japonês, jardim tropical e árvores icônicas do mundo ───────────────────
  { title: 'Low Poly Pine Tree', author: 'Epic wolf studio', license: 'CC BY 4.0', url: 'https://sketchfab.com/3d-models/low-poly-pine-tree-99fb6a37547840e3a295689df032ba28' },
  { title: 'Japanese Black Pine', author: 'matt z chan', license: 'CC BY 4.0', url: 'https://sketchfab.com/3d-models/japanese-black-pine-f0cb4705f1c446c7bc393fdbfcdf024a' },
  { title: 'Bamboo', author: 'arthur', license: 'CC BY 4.0', url: 'https://sketchfab.com/3d-models/bamboo-b2e6f889630e4ab593376a151836a3e1' },
  { title: 'Banana Tree', author: 'Garecra', license: 'CC BY 4.0', url: 'https://sketchfab.com/3d-models/banana-tree-5cb46e64d7fc40978c3d6798017eced1' },
  { title: 'Heliconia Rostrata', author: 'Meownster', license: 'CC BY 4.0', url: 'https://sketchfab.com/3d-models/heliconia-rostrata-bb7240aecc774cd388304b59dcdc7cdb' },
  { title: 'Realistic Baobab Tree', author: 'pighunt3r15', license: 'CC BY 4.0', url: 'https://sketchfab.com/3d-models/realistic-baobab-tree-f3bb8b2c910241d49b5e38351fe9b1b2' },
  { title: 'Cedar Of Lebanon', author: 'Valery.Li', license: 'CC BY 4.0', url: 'https://sketchfab.com/3d-models/cedar-of-lebanon-6bf28d5c230a4dbcbc350ab7e4964a89' },
  // ── a sequoia gigante NAO tem crédito de terceiro porque não veio de acervo
  // nenhum: a busca (02-03/09) só achou tronco/cone de fotogrametria em
  // licença compatível, nenhuma árvore inteira. Nasceu de código,
  // `blender/build_sequoia.py` (perfil do tronco medido no General Sherman,
  // NPS, ver o cabeçalho do script), e por isso não precisa de CC-BY, mas
  // precisa desta linha: sem ela, daqui a três meses ninguém sabe de onde
  // `sequoia.glb`/`sequoia-mass.glb` vieram.
  { title: 'Sequoia gigante (tronco + copa gerados por código)', author: 'DogCity (blender/build_sequoia.py)', license: 'proprio, gerado por codigo nesta casa', url: 'blender/build_sequoia.py' },
  // ── mesmo caso do flamboyant: busca (03/09) devolveu ZERO resultado em
  // licença compatível para "royal poinciana"/"flamboyant tree" no Sketchfab.
  // Nasceu de código pelo mesmo motivo, `blender/build_flamboyant.py` (copa em
  // guarda-chuva achatado, floração vermelho-alaranjada, proporção conferida
  // em gardenia.net/UC Davis, ver o cabeçalho do script).
  { title: 'Flamboyant / Royal Poinciana (copa gerada por código)', author: 'DogCity (blender/build_flamboyant.py)', license: 'proprio, gerado por codigo nesta casa', url: 'blender/build_flamboyant.py' },
]

export const SF = {
  bust: '/city/sf/satoshi-bust.glb',
  palm: '/city/sf/palm.glb',
  rocket: '/city/sf/v2-rocket.glb',
  templeHall: '/city/sf/temple-hall.glb',
  // o jardim do pátio da caverna do Leonidas. Os dois foram escolhidos por
  // trazerem TEXTURA EMISSIVA de fábrica: lá dentro não há sol, e a planta que
  // não brilha sozinha some no preto.
  shroomTall: '/city/sf/shroom-tall.glb',
  shroomCluster: '/city/sf/shroom-cluster.glb',
} as const

/** Carrega um GLB e devolve a cena, ou null se faltar (a praça nunca quebra por
 *  causa de um adereço). */
export function loadSf(gltf: GLTFLoader, url: string): Promise<THREE.Object3D | null> {
  // ⚠️ ESTE AVISO DIZIA "asset ausente" E MENTIA. Ele nasce no `onError` do
  // GLTFLoader, que dispara tanto quando o arquivo não existe quanto quando ele
  // existe e a DECODIFICAÇÃO falha, e as duas coisas não têm o mesmo conserto.
  // Medido em 01/09: `/city/sf/torch-pillar.glb` e `/city/sf/pedestal.glb`
  // avisavam "ausente" enquanto o dev server respondia 200 com 83.464 e 32.160
  // bytes, e os dois arquivos estavam íntegros (glTF 2, chunk JSON válido,
  // Draco + EXT_texture_webp, iguais em espécie aos que carregam bem). Ou seja o
  // aviso mandava a próxima pessoa procurar um arquivo que estava lá.
  // Agora ele carrega o erro junto, que é a única informação que separa os dois
  // casos.
  //
  // ⚠️ UM TERCEIRO CASO, achado em 02/09 (censo da frente orçamento): o arquivo
  // RESPONDE 200, o glTF é VÁLIDO, e a cena vem VAZIA: zero nós, zero malha.
  // `cardume.glb`, `peixe-anjo.glb` e `polvo-jardim.glb` em `public/city/sf/`
  // são assim hoje (132 bytes, `{"scenes":[{"name":"Scene"}]}`, conversão que
  // não terminou). Sem este bloco, `loadSf` devolvia um `Object3D` de verdade
  // (sem erro, sem aviso) e quem chamasse `root.traverse` achava zero malha e
  // seguia calado (`buildProps` já tem `if (!parts.length) return`): a peça
  // simplesmente não aparecia, sem uma linha no console dizendo por quê. Agora
  // uma cena sem malha nenhuma conta como ausente, com o MESMO aviso e o MESMO
  // `null` que o resto desta função já devolve; quem chama não precisa saber
  // que existe um terceiro caso.
  return new Promise((res) => gltf.load(url, (g) => {
    let temMalha = false
    g.scene.traverse((o) => { if ((o as THREE.Mesh).isMesh) temMalha = true })
    if (!temMalha) {
      console.warn('[plaza] asset carregou mas a cena está vazia (zero malhas)', url)
      res(null)
      return
    }
    res(g.scene)
  }, undefined, (err) => {
    console.warn('[plaza] asset não carregou', url, err instanceof Error ? err.message : err)
    res(null)
  }))
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
