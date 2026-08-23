// A POÇA DE LUZ: o que faz a praça parecer acesa sem gastar uma luz de verdade.
//
// O three avalia CADA luz em CADA fragmento de CADA material iluminado. O custo
// não é "número de luzes", é malhas × luzes, e esta cena tem ~500 malhas
// iluminadas: uma PointLight que existe só para pintar um halo é o pior negócio
// disponível. Por isso o censo de 2026-08-23 encontrou 19 luzes pontuais nos
// monumentos, no chalé, no muro dos fundadores e na galeria.
//
// O padrão nasceu nos postes do precinct.ts e tem duas metades:
//   (a) a peça que ACENDE é emissiva (a lâmpada, a fita, a gravação, a brasa):
//       é ela que o olho registra como fonte;
//   (b) o chão embaixo dela ganha uma POÇA: uma chapa deitada com uma textura
//       radial, somada ao que já está lá e sem gravar profundidade.
// Juntas as duas leem como iluminação pública, e custam UM desenho.
//
// ⚠️ LUZ DE VERDADE SÓ ONDE ELA MODELA VOLUME. A poça não ilumina nada, é tinta
// no piso: se alguém trocar por poça a luz que dá relevo a uma estátua ou ao
// interior de um prédio, a peça vira uma silhueta chapada, e o estrago só
// aparece de perto, com a câmera baixa. As poucas luzes que sobraram na praça
// estão exatamente nesses casos.
import * as THREE from 'three'

/** O quente da praça, o mesmo hex que monumentos, chalé, fundadores e galeria usam. */
const WARM = new THREE.Color('#FFB35C')

/** ⚠️ O BRILHO PADRÃO É O DAS POÇAS DOS POSTES (precinct.ts: `opacity: 0.3`).
 *  Ele foi calibrado contra o regolito da praça em 2026-08-19, quando o fundador
 *  disse que estava tudo escuro. Subir daqui estoura o piso em branco no modo
 *  `?hour=earthlight`, que é o único em que o sol está desligado. */
const DEFAULT_GAIN = 0.3

/** Quantas vezes a poça é maior que a luminária que a produz, em diâmetro.
 *  Vem dos postes do precinct: lâmpada de 1,8 m, poça de 17 m (17 / 1,8 ≈ 9,4). */
export const POOL_SPREAD = 9.4

/** A textura da poça: um disco radial que apaga na borda.
 *
 *  ⚠️ A PARADA DO MEIO (0,35 em 35%) É O QUE FAZ A POÇA PARECER LUZ. Uma rampa
 *  linear do centro à borda desenha um disco chapado com contorno visível; a
 *  quebra dá o miolo quente e a saia longa que a luz artificial tem no chão. */
export function makeGlowTexture(): THREE.Texture {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.35, 'rgba(255,255,255,0.35)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 64, 64)
  return new THREE.CanvasTexture(c)
}

type Spot = THREE.Vector3 | readonly [number, number, number]
const xyz = (s: Spot): [number, number, number] =>
  s instanceof THREE.Vector3 ? [s.x, s.y, s.z] : [s[0], s[1], s[2]]

export interface PoolDisc {
  /** centro da poça, nas coordenadas do grupo que vai recebê-la */
  at: Spot
  /** ⚠️ O RAIO É O DA PEÇA QUE ACENDE, não o alcance da luz que saiu. A poça é o
   *  rastro no piso do monumento; quem usar o `distance` da PointLight antiga
   *  pinta um disco maior que a peça inteira. */
  r: number
  /** brilho somado no centro; o padrão é o das poças dos postes */
  gain?: number
  color?: THREE.ColorRepresentation
}

export interface Pool {
  object: THREE.Object3D
  /** exposto para quem quiser fazer a poça respirar (`opacity`), como as luzes faziam */
  material: THREE.Material
  dispose: () => void
}

/** Poças deitadas no chão, todas numa malha só: uma chamada de desenho para o
 *  quarteirão inteiro, com raio e brilho próprios em cada uma (o raio vai na
 *  geometria, o brilho na cor de vértice). */
export function makeGroundPool(discs: readonly PoolDisc[], opts: { texture?: THREE.Texture; name?: string } = {}): Pool {
  const own = opts.texture ? null : makeGlowTexture()
  const tex = opts.texture ?? own!
  const n = discs.length
  const pos = new Float32Array(n * 12)
  const uv = new Float32Array(n * 8)
  const col = new Float32Array(n * 12)
  const idx = new Uint32Array(n * 6)
  const c = new THREE.Color()
  // os quatro cantos da chapa, no sentido anti-horário visto de cima
  const CX = [-1, 1, 1, -1], CZ = [-1, -1, 1, 1]
  discs.forEach((d, i) => {
    const [x, y, z] = xyz(d.at)
    // ⚠️ A COR DE VÉRTICE VAI EM LINEAR, e é por isso que ela sai de um
    // THREE.Color já convertido: o three NÃO converte o atributo de cor, só as
    // cores de material. Escrever o sRGB cru aqui clareia demais a poça.
    c.set(d.color ?? WARM).multiplyScalar(d.gain ?? DEFAULT_GAIN)
    const v = i * 12, u = i * 8, k = i * 4
    for (let j = 0; j < 4; j++) {
      pos[v + j * 3] = x + CX[j] * d.r
      pos[v + j * 3 + 1] = y
      pos[v + j * 3 + 2] = z + CZ[j] * d.r
      uv[u + j * 2] = (CX[j] + 1) / 2
      uv[u + j * 2 + 1] = (CZ[j] + 1) / 2
      col[v + j * 3] = c.r; col[v + j * 3 + 1] = c.g; col[v + j * 3 + 2] = c.b
    }
    idx[i * 6] = k; idx[i * 6 + 1] = k + 1; idx[i * 6 + 2] = k + 2
    idx[i * 6 + 3] = k; idx[i * 6 + 4] = k + 2; idx[i * 6 + 5] = k + 3
  })
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
  geo.setIndex(new THREE.BufferAttribute(idx, 1))
  // ⚠️ ADITIVO E SEM GRAVAR PROFUNDIDADE, e os dois lados desenhados. Sem
  // `depthWrite: false` a poça recorta em preto o que estiver atrás dela; com
  // face única ela desaparece de qualquer ponto de vista abaixo do plano dela,
  // e a praça tem terreno que sobe (o deck, a muralha, as escadas do chalé).
  const material = new THREE.MeshBasicMaterial({
    map: tex, vertexColors: true, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  })
  const mesh = new THREE.Mesh(geo, material)
  mesh.name = opts.name ?? 'LightPool'
  return {
    object: mesh,
    material,
    dispose() { geo.dispose(); material.dispose(); own?.dispose() },
  }
}

export interface HaloOptions {
  color?: THREE.ColorRepresentation
  /** diâmetro aparente em metros (com `sizeAttenuation`, como nos postes) */
  size: number
  opacity?: number
  texture?: THREE.Texture
  name?: string
}

/** Halos que olham para a câmera, para o que acende NO AR e não tem chão embaixo
 *  (o farol do chalé). Mesma receita dos postes: sprites aditivos num Points. */
export function makeHalo(spots: readonly Spot[], opts: HaloOptions): Pool {
  const own = opts.texture ? null : makeGlowTexture()
  const tex = opts.texture ?? own!
  const pos = new Float32Array(spots.length * 3)
  spots.forEach((s, i) => { const [x, y, z] = xyz(s); pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z })
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  const material = new THREE.PointsMaterial({
    map: tex, color: opts.color ?? WARM, size: opts.size, sizeAttenuation: true,
    transparent: true, opacity: opts.opacity ?? DEFAULT_GAIN, depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  const points = new THREE.Points(geo, material)
  points.name = opts.name ?? 'LightHalo'
  // ⚠️ SEM CULLING DE FRUSTUM: a esfera envolvente de um Points não conhece o
  // tamanho do sprite, então o halo desaparece de uma vez quando o PONTO sai do
  // quadro, mesmo com metade dele ainda visível. É o mesmo motivo dos postes.
  points.frustumCulled = false
  return {
    object: points,
    material,
    dispose() { geo.dispose(); material.dispose(); own?.dispose() },
  }
}
