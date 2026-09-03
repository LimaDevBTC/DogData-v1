// Os ADEREÇOS da praça: modelos de fora (public/city/sf/*.glb) colocados por
// TABELA, não por código. Acrescentar uma peça é acrescentar uma linha em
// `props-table.ts`; este módulo carrega uma vez, instancia quando a peça se
// repete, assenta no terreno, e registra tudo no culling por distância.
//
// Regras que valem para todo adereço (praca-jardins.md):
//   · licença CC0/CC-BY, com o crédito em `sf-assets.ts` (o menu Places mostra);
//   · o modelo já vem em metros, com a origem no chão (o conversor cuida);
//   · nada é decorativo por decorar: cada linha da tabela diz o porquê.
//
// ⚠️ ORÇAMENTO DE MATERIAL, medido em 02/09 (frente orçamento). O exportador
// glTF quebra cada modelo em uma primitiva POR MATERIAL, e a linha 90 (hoje)
// cria um `InstancedMesh` por primitiva: um modelo de duas texturas (tronco e
// folha) vira duas chamadas de desenho e, na prática, dois programas de
// shader. Contagem estática em 02/09, lendo o JSON de cada .glb em
// `public/city/sf/` (52 arquivos, 100 primitivas ao todo) e cruzando com
// `props-table.ts` (24 espécies em uso hoje): **45 primitivas**, logo **45
// `InstancedMesh`/malhas** só nesta tabela. É a fatia deste módulo nas 404
// chamadas de desenho medidas na entrada padrão.
//
// A FUSÃO (`?fundir=1`, ver `FUNDIR` abaixo). Nem toda primitiva pode se
// fundir sem mudar um pixel: a maioria (folha, tronco, pedra com textura)
// carrega um mapa de cor próprio, e fundir duas texturas diferentes num
// material só pede um atlas novo (trabalho de arte, fora deste módulo). O que
// ESTE módulo faz sozinho, sem tocar em nenhum .glb: quando duas ou mais
// primitivas do MESMO modelo são material PBR liso: cor, rugosidade e
// metalicidade em número, sem textura nenhuma, sem transparência. Elas se
// fundem numa geometria e num material só, com a cor/rugosidade/metalicidade/
// emissão de cada parte indo para ATRIBUTO POR VÉRTICE em vez de material.
// É a técnica que `fundacao-gta5.md` (Bloco F) pede: "cor de instância, que é
// atributo e não material". A reconstrução é exata (lida direto dos valores
// que o GLTFLoader já resolveu), não uma aproximação, e por isso é candidata a
// SAIR da bandeira assim que a chapa `?fundir=1` for conferida ao lado da
// chapa sem ela.
//
// Hoje isso alcança 1 peça da tabela: `sp-complex` (pátio do spaceport), 4
// primitivas lisas (concreto, queimado, aço, luz) → 1. As demais primitivas
// puramente lisas do acervo (`sp-tank`, `sp-dish`, `fountain-basin`,
// `tree-gnarled`, entre outras) já são uma primitiva sozinha: não há o que
// fundir ali, e SOZINHAS elas não pesam no orçamento de material. O peso
// está nas espécies com textura, e essas dependem de atlas por família
// (Bloco C/D), fora do alcance de um módulo de three.js puro.
//
// ⚠️ A VARIAÇÃO DE COR POR INSTÂNCIA (`?copa=1`), achada em falta em 03/09 pela
// frente de espécies: `setColorAt` tinha ZERO ocorrências neste arquivo, então
// toda cópia plantada de uma espécie saía bit a bit idêntica à anterior. Uma
// alameda inteira de tamareiras, todas do MESMO tom de verde. `InstancedMesh`
// já tem `instanceColor`; o que faltava era chamar `setColorAt` com uma cor
// por instância, semeada pelo MESMO hash de `place()` (giro e escala), nunca
// por um segundo gerador: a mesma semente tem de plantar a mesma árvore
// sempre, cor incluída.
//
// A variação é por ESPÉCIE, não global: o campo opcional `variacaoCor` do
// `PropSpec` (matiz/saturação/luz do giro de cor, ver `corInstancia` abaixo)
// entra na TABELA (`props-table.ts`, hoje da frente de paisagismo). Sem o
// campo, uma peça ainda recebe `VARIACAO_PADRAO`, conservador de propósito:
// é a rede de segurança até a tabela ganhar valor por espécie.
//
// ⚠️ `instanceColor` MULTIPLICA o albedo do material (medido lendo os
// `ShaderChunk` do three instalado: `color_vertex.glsl.js` faz
// `vColor.xyz *= instanceColor.xyz` no vértice, e `color_fragment.glsl.js`
// faz `diffuseColor.rgb *= vColor` no fragmento; a textura da folha entra
// nessa conta como parte de `diffuseColor`, ANTES desta multiplicação). Por
// isso `corInstancia` centra o multiplicador de luz em 1,0 (faixa
// `[1−luz, 1+luz]`, nunca `[1−luz, 1]`): uma faixa que só vai para baixo
// escurece toda a alameda de novo, o mesmo defeito com outro nome.
//
// ⚠️ ORÇAMENTO, medido em 03/09. `instanceColor` é um `Float32Array(count·3)`:
// 12 bytes por instância (3 floats). Somando `props-table.ts` hoje (30
// espécies com `?verde=1` ligado, a bandeira dos jardins temáticos): 344
// instâncias, 4.128 bytes, 4 KB: NÃO são "dezenas de milhares", esse volume
// mora no gerador procedural de `arborizacao.ts`, que já tem `setColorAt`
// (três ocorrências, achadas no mesmo grep que provou a falta aqui). O que
// faltava era só a árvore DISCRETA, de modelo real, plantada por tabela.
//
// ⚠️ `instanceColor` MUDA O PROGRAMA. Lendo `WebGLPrograms.js`: `instancingColor`
// entra no bitmask que vira parte da chave de cache
// (`getProgramCacheKeyBooleans`), e `WebGLProgram.js` só define
// `USE_INSTANCING_COLOR` quando ele está ligado. Ou seja: a MESMA espécie,
// com e sem `instanceColor`, são DOIS programas. Como cada espécie desta
// tabela já tem textura própria (nenhuma divide programa com outra hoje,
// visto no censo de 02/09), o custo real é NO MÁXIMO +1 programa por espécie
// que ganhar `?copa=1`, não uma explosão: meça com `__plazaProgramas()`.
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { loadSf, dressSf } from './sf-assets'
import type { PerfProfile, DistanceCuller } from './perf'

/** Uma peça posta na praça. `at` são pontos (x, z) em metros no quadro three. */
export interface PropSpec {
  /** nome do arquivo em public/city/sf/, sem .glb */
  file: string
  /** por que está aqui (aparece só no código, mas é a regra da praça) */
  why: string
  at: [number, number][]
  /** giro em torno de y, em graus; 'center' = de frente para o centro da praça */
  yaw?: number | 'center' | 'out'
  scale?: number
  /** variação de escala por peça (± fração), semeada pela posição */
  jitter?: number
  /** metros acima do terreno (para peça que deve afundar ou flutuar) */
  lift?: number
  /** a partir de quantos metros some; padrão: o `smallCull` do perfil */
  cull?: number
  castShadow?: boolean
  envMapIntensity?: number
  /** Atrás de `?copa=1` (ver `COPA` abaixo): a faixa de variação de cor POR
   *  INSTÂNCIA, semeada pelo mesmo hash de posição que já decide giro e
   *  escala em `place()`. Sem este campo, a peça ainda varia, mas com
   *  `VARIACAO_PADRAO` (conservador); a espécie que precisa de uma
   *  personalidade própria (oliveira em prata, cerejeira em rosa e branco,
   *  conífera em verde-azulado) declara a SUA faixa aqui. Ver `corInstancia`
   *  para o que cada campo faz e por quê os três são centrados em zero
   *  desvio, nunca em "sempre escurece". */
  variacaoCor?: {
    /** amplitude do giro de matiz, em fração da volta (0 a 1 = 0° a 360°);
     *  por instância, o giro sorteado vai de −matiz a +matiz */
    matiz: number
    /** o quanto do giro de matiz aparece, 0 (nenhum, só a luz varia) a 1
     *  (a cor do giro pura); por instância, de 0 a `sat` */
    sat: number
    /** amplitude do multiplicador de luz, centrado em 1: por instância, de
     *  `1 − luz` a `1 + luz`. NUNCA usar uma faixa que só vai para baixo de
     *  1: `instanceColor` multiplica o albedo, e uma faixa como `[1−luz, 1]`
     *  escurece a alameda inteira de novo (a razão de existir este campo). */
    luz: number
  }
}

export interface Props {
  group: THREE.Group
  dispose: () => void
}

const hash = (x: number, z: number) => {
  const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453
  return s - Math.floor(s)
}

// ── a bandeira, no padrão de `look.ts`/`materiais.ts`: lida uma vez, no
// módulo, porque a fusão troca geometria e material no BOOT da cena, não a
// cada quadro. Off por padrão: o bot de auto-commit publica de hora em hora,
// e a fusão só assume o lugar do caminho de hoje depois da chapa lado a lado
// (ver o pedido de medição no fim de `fundacao-gta5.md`). ──────────────────
const FUNDIR = typeof window !== 'undefined'
  && new URLSearchParams(window.location.search).get('fundir') === '1'

// ── outra bandeira, outro assunto: `?copa=1` liga a variação de cor por
// instância (ver o cabeçalho, seção "A VARIAÇÃO DE COR"). `?fundir=1` não
// serve aqui porque não muda pixel nenhum da MASSA do prédio, muda a cor de
// CADA árvore plantada; as duas bandeiras são independentes e podem conviver
// na mesma URL. ──────────────────────────────────────────────────────────
const COPA = typeof window !== 'undefined'
  && new URLSearchParams(window.location.search).get('copa') === '1'

/** A rede de segurança de toda espécie sem `variacaoCor` própria na tabela:
 *  um giro de matiz pequeno (±3,6°), pouca saturação do giro (até 10%) e uma
 *  luz que varia ±6% em torno de 1, visível o bastante para quebrar o clone
 *  perfeito, subtil o bastante para não brigar com nenhuma espécie que ainda
 *  não tem número próprio. */
const VARIACAO_PADRAO = { matiz: 0.01, sat: 0.10, luz: 0.06 }

/** A cor de UMA instância, determinística por (x, z): mesma semente, mesma
 *  árvore, sempre. Usa a MESMA função `hash` de `place()` (giro e escala),
 *  só que em três pontos deslocados, para os três canais não andarem
 *  amarrados um no outro (senão a árvore mais alta seria sempre a mais rosada
 *  também). Isto NÃO é um segundo gerador: é a mesma fórmula determinística,
 *  avaliada em outra coordenada.
 *
 *  A matemática, e por que ela não escurece a alameda (ver o cabeçalho):
 *   · `luz` é um multiplicador de cinza centrado em 1 (`1−luz` a `1+luz`),
 *     livre para passar de 1, não é luminância de HSL, que não passaria de
 *     branco; é o fator que `instanceColor` de fato aplica no shader.
 *   · o giro de matiz vira uma cor PURA (`setHSL`, saturação 1) que se
 *     mistura ao cinza na fração `sat` (0 = só o cinza; `sat` = a cor pura
 *     inteira). Por isso a tabela deve manter `sat` modesto (a própria
 *     `VARIACAO_PADRAO` usa 0,10): a mistura com uma cor pura, mesmo em
 *     fração pequena, puxa a média um pouco pra baixo de `luz` sozinho (a
 *     cor pura em HSL l=0,5 não é branca), e é essa a razão de o padrão desta
 *     casa ficar em 0,10 e não mais alto. */
function corInstancia(x: number, z: number, v: { matiz: number; sat: number; luz: number }): THREE.Color {
  const hLuz = hash(x, z)                 // o MESMO hash de place(): giro/escala/cor amarrados na base
  const hMatiz = hash(x + 1013.1, z - 1013.1)
  const hSat = hash(x - 7919.3, z + 7919.3)
  const luzMul = 1 + (hLuz - 0.5) * 2 * v.luz
  const cinza = new THREE.Color(luzMul, luzMul, luzMul)
  if (v.matiz <= 0 || v.sat <= 0) return cinza
  const matizAng = (((hMatiz - 0.5) * 2 * v.matiz) % 1 + 1) % 1
  const satAmt = hSat * v.sat
  const puro = new THREE.Color().setHSL(matizAng, 1, 0.5)
  return cinza.lerp(puro, satAmt)
}

interface Parte { geo: THREE.BufferGeometry; mat: THREE.Material | THREE.Material[]; local: THREE.Matrix4 }

/** Uma primitiva é fundível quando o material é PBR liso: nenhum mapa, opaco.
 *  É a condição que garante reconstrução EXATA por atributo (ver cabeçalho):
 *  sem textura não há UV para perder, e sem transparência não há ordem de
 *  desenho para quebrar ao virar uma malha só. */
function fundivel(p: Parte): p is Parte & { mat: THREE.MeshStandardMaterial } {
  if (Array.isArray(p.mat)) return false
  const m = p.mat
  if (!(m instanceof THREE.MeshStandardMaterial)) return false
  return !m.map && !m.normalMap && !m.roughnessMap && !m.metalnessMap
    && !m.aoMap && !m.emissiveMap && !m.alphaMap
    && m.transparent === false && m.alphaTest === 0
}

// Chave de programa FIXA para todo material fundido: sem ela o three compila
// um programa por PEÇA fundida (uma para cada espécie que passar por aqui),
// que é o mesmo defeito que motivou este módulo inteiro (ver o cabeçalho de
// `materiais.ts`). Com a chave fixa, `sp-complex` e qualquer fusão futura
// dividem UM programa.
const CHAVE_FUNDIDO = 'dogcity:props-fundido-v1'

/** Veste o material fundido com o par vértice → uniforme que os `#include`
 *  do standard shader normalmente leem de textura. `roughnessmap_fragment` e
 *  `metalnessmap_fragment` SEM mapa já resolvem para `roughness`/`metalness`
 *  do material (uniforme única); aqui eles passam a ler um atributo por
 *  vértice, e o mesmo vale para a radiância emissiva (`emissive *
 *  emissiveIntensity`, que o three já teria pré-multiplicado numa uniforme
 *  única em `WebGLMaterials`). A cor em si viaja pelo atributo `color`
 *  nativo do three (`vertexColors: true` já liga `USE_COLOR` sozinho). */
function vestirFundido(mat: THREE.MeshStandardMaterial) {
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 aRoughMetal;\nattribute vec3 aEmissivo;\nvarying vec2 vRoughMetal;\nvarying vec3 vEmissivo;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRoughMetal = aRoughMetal;\nvEmissivo = aEmissivo;')
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vRoughMetal;\nvarying vec3 vEmissivo;')
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = vRoughMetal.x;')
      .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = vRoughMetal.y;')
      .replace('vec3 totalEmissiveRadiance = emissive;', 'vec3 totalEmissiveRadiance = vEmissivo;')
  }
  mat.customProgramCacheKey = () => CHAVE_FUNDIDO
}

/** Funde um grupo de primitivas lisas do MESMO modelo (mesmo `side`) numa
 *  geometria e num material só. A transformação de cada parte (`local`,
 *  antes aplicada por instância em `setMatrixAt`) é cozida na geometria ANTES
 *  da fusão, porque depois de fundida a peça só tem UMA matriz por instância. */
function fundirGrupo(grupo: (Parte & { mat: THREE.MeshStandardMaterial })[]): Parte {
  const geos = grupo.map(({ geo, mat, local }) => {
    const g = geo.clone()
    g.applyMatrix4(local)
    if (g.attributes.uv) g.deleteAttribute('uv')
    if (g.attributes.uv2) g.deleteAttribute('uv2')
    const n = g.attributes.position.count
    const cor = new Float32Array(n * 3)
    const rm = new Float32Array(n * 2)
    const emit = new Float32Array(n * 3)
    const emissivo = mat.emissive.clone().multiplyScalar(mat.emissiveIntensity)
    for (let i = 0; i < n; i++) {
      cor[i * 3] = mat.color.r; cor[i * 3 + 1] = mat.color.g; cor[i * 3 + 2] = mat.color.b
      rm[i * 2] = mat.roughness; rm[i * 2 + 1] = mat.metalness
      emit[i * 3] = emissivo.r; emit[i * 3 + 1] = emissivo.g; emit[i * 3 + 2] = emissivo.b
    }
    g.setAttribute('color', new THREE.BufferAttribute(cor, 3))
    g.setAttribute('aRoughMetal', new THREE.BufferAttribute(rm, 2))
    g.setAttribute('aEmissivo', new THREE.BufferAttribute(emit, 3))
    return g
  })
  const geo = mergeGeometries(geos, false)
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, side: grupo[0].mat.side })
  vestirFundido(mat)
  return { geo, mat, local: new THREE.Matrix4() }
}

/** Reorganiza as primitivas de UM modelo: as fundíveis (PBR liso, mesmo lado)
 *  viram uma peça só; o resto segue como está. Atrás de `FUNDIR`, ver
 *  cabeçalho do módulo. Sem a bandeira, devolve `parts` inalterado: é o que
 *  garante que o caminho de hoje não muda um pixel. */
function reorganizarParaFusao(parts: Parte[]): Parte[] {
  if (!FUNDIR) return parts
  const porLado = new Map<THREE.Side, (Parte & { mat: THREE.MeshStandardMaterial })[]>()
  const resto: Parte[] = []
  for (const p of parts) {
    if (fundivel(p)) {
      const lista = porLado.get(p.mat.side) ?? []
      lista.push(p)
      porLado.set(p.mat.side, lista)
    } else {
      resto.push(p)
    }
  }
  const fundidas: Parte[] = []
  // `Array.from` em vez de `for...of` direto no Map: o alvo es5 do tsconfig
  // não itera Map sem downlevelIteration.
  Array.from(porLado.values()).forEach((lista) => {
    if (lista.length >= 2) fundidas.push(fundirGrupo(lista))
    else resto.push(...lista) // uma primitiva sozinha: fundir não economiza nada
  })
  return [...resto, ...fundidas]
}

export async function buildProps(opts: {
  specs: readonly PropSpec[]
  heightAt: (x: number, z: number) => number
  gltf?: GLTFLoader
  profile?: PerfProfile
  culler?: DistanceCuller
}): Promise<Props> {
  const group = new THREE.Group()
  group.name = 'Props'
  const disposables: { dispose: () => void }[] = []
  const gltf = opts.gltf ?? new GLTFLoader()
  const yAt = opts.heightAt
  const SMALL = opts.profile?.smallCull ?? 2600

  await Promise.all(opts.specs.map(async (spec) => {
    if (!spec.at.length) return
    const root = await loadSf(gltf, `/city/sf/${spec.file}.glb`)
    if (!root) return
    dressSf(root, { envMapIntensity: spec.envMapIntensity ?? 1.0, castShadow: spec.castShadow ?? true })
    const o = new THREE.Object3D()
    const place = (x: number, z: number) => {
      const h = hash(x, z)
      const s = (spec.scale ?? 1) * (1 + (spec.jitter ?? 0) * (h - 0.5) * 2)
      const yaw = spec.yaw === 'center' ? Math.atan2(-x, -z) : spec.yaw === 'out' ? Math.atan2(x, z) : THREE.MathUtils.degToRad(spec.yaw ?? 0) + (spec.jitter ? h * 6.28 : 0)
      o.position.set(x, yAt(x, z) + (spec.lift ?? 0), z)
      o.rotation.set(0, yaw, 0)
      o.scale.setScalar(s)
      o.updateMatrix()
      return o.matrix.clone()
    }
    // Um InstancedMesh POR PARTE do modelo. O exportador glTF quebra a malha em
    // uma primitiva por material, então um modelo de duas texturas (tronco e
    // folha, pedra e metal) chega aqui como duas malhas: instanciar só a
    // primeira deixava as palmeiras sem folha e as colunas sem capitel. Cada
    // parte recebe a MESMA lista de posições, multiplicada pela matriz de mundo
    // da parte dentro do modelo.
    let parts: Parte[] = []
    root.updateMatrixWorld(true)
    root.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh) parts.push({ geo: m.geometry, mat: m.material, local: m.matrixWorld.clone() })
    })
    if (!parts.length) return
    parts = reorganizarParaFusao(parts)
    if (spec.at.length > 1) {
      const mats = spec.at.map(([x, z]) => place(x, z))
      // `?copa=1`: sem `variacaoCor` própria na linha da tabela, a espécie
      // ainda ganha a rede de segurança de `VARIACAO_PADRAO` (ver cabeçalho).
      // `null` sem a bandeira: nenhum `setColorAt` roda, nenhum pixel muda,
      // nenhum programa novo compila.
      const variacao = COPA ? (spec.variacaoCor ?? VARIACAO_PADRAO) : null
      for (const part of parts) {
        const im = new THREE.InstancedMesh(part.geo, part.mat as THREE.Material, mats.length)
        mats.forEach((m, i) => im.setMatrixAt(i, new THREE.Matrix4().multiplyMatrices(m, part.local)))
        im.instanceMatrix.needsUpdate = true
        if (variacao) {
          // a MESMA posição (x, z) que gerou a matriz de cada instância, não o
          // índice: é a coordenada que `corInstancia` semeia, para a cor
          // continuar amarrada ao lugar e não à ordem de inserção no array.
          spec.at.forEach(([x, z], i) => im.setColorAt(i, corInstancia(x, z, variacao)))
          if (im.instanceColor) im.instanceColor.needsUpdate = true
        }
        im.castShadow = spec.castShadow ?? true
        im.receiveShadow = true
        im.name = `prop:${spec.file}`
        group.add(im)
        opts.culler?.add(im, spec.cull ?? SMALL)
      }
    } else {
      // Antes: `root.clone(true)` reaproveitava a hierarquia inteira do GLB.
      // Agora monta a partir da mesma lista `parts` que o ramo instanciado usa
      // (necessário para a fusão acima também valer aqui, caso de `sp-complex`),
      // com a MESMA conta, `placement × local`, que já valia por instância no
      // ramo de cima: equivalente peça a peça, sem clone extra desnecessário
      // (spec.at.length é sempre 1 neste ramo).
      const [x, z] = spec.at[0]
      const m = place(x, z)
      const holder = new THREE.Group()
      holder.name = `prop:${spec.file}`
      for (const part of parts) {
        const mesh = new THREE.Mesh(part.geo, part.mat as THREE.Material)
        mesh.matrix.multiplyMatrices(m, part.local)
        mesh.matrixAutoUpdate = false
        mesh.castShadow = spec.castShadow ?? true
        mesh.receiveShadow = true
        holder.add(mesh)
      }
      group.add(holder)
      opts.culler?.add(holder, spec.cull ?? SMALL, new THREE.Vector3(x, 0, z))
    }
  }))

  return {
    group,
    dispose() {
      for (const d of disposables) d.dispose()
      group.traverse((o) => {
        const m = o as THREE.Mesh
        if (m.isMesh) { m.geometry?.dispose(); const mm = m.material as THREE.Material; mm?.dispose?.() }
      })
    },
  }
}
