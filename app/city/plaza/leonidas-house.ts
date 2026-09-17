// A CASA DO LEONIDAS — "The Block", na cabeça da alameda SE.
//
// O pedido do LeonidasNFT (Telegram, 2026-09-14), ao pé da letra: "a large
// minimalist cube with a single door", "the block is symbolic of a Bitcoin
// Block", "an ultra brutalist museum" — e, por dentro, a sala do Wallace de
// Blade Runner 2049: "minimalist concrete with diffused light and water pool
// on the ground with walkways on it". Um cubo de concreto carvão de 32 m com
// uma fenda dourada de 6 m; dentro, água escura, passarela de ripas, plataforma
// com duas poltronas e as CÁUSTICAS de ouro ondulando nas paredes.
//
// ⚠️ O MESMO CONTRATO DO CHALÉ (chalet.ts / cryptolution-house.ts): `build…()`
// devolve `{ group, update, dispose }`; quem posiciona, anima e limpa é a
// plaza-scene. Nada de rede aqui.
//
// A carcaça vem do Blender (fonte fora do repo: DOG CITY/leonidas-house/
// LEONIDAS_HOUSE.blend → public/city/leonidas-house.glb, 21 malhas, 166 KB).
// O GLB carrega a SEMÂNTICA nos nomes de material e este módulo aplica o look:
// o exterior é repintado com cor fixa (a lição da Cryptolution: cor fixa, não
// multiplicação) e as paredes internas TROCAM de material — o padrão de
// cáustica procedural do Cycles não sobrevive ao glTF, então ele renasce aqui
// como ShaderMaterial, com os MESMOS números calibrados no Blender (voronoi
// distance-to-edge em duas escalas, distorção líquida, manchas grandes,
// falloff vertical). É a versão viva: ondula com o tempo, o que o render
// parado não fazia.
//
// ⚠️ O INTERIOR VIVE NA CAVE_LAYER (leonidas-cave.ts): o sol da praça é uma
// direcional sem oclusão e atravessa a rocha — e atravessaria o cubo. Tudo que
// é de dentro vai para a layer que o sol não enxerga (a câmera a habilita em
// plaza-scene:812); o interior se ilumina sozinho, por emissão, como no filme.
import * as THREE from 'three'
import { CAVE_LAYER } from './leonidas-cave'

export interface LeonidasHouse {
  group: THREE.Group
  /** topo do cubo (32 m), pra quem quiser mirar a câmera */
  apexY: number
  update: (t: number) => void
  dispose: () => void
}

// ── as cáusticas: a parede dourada, agora viva ───────────────────────────────
// Réplica em GLSL do material `Parede_Caustica` do blend: duas redes voronoi
// (células ~1,2 m + sub-rede fraca), coordenadas distorcidas por noise pra
// virar água e não polígono, manchas grandes de intensidade (a luz empoça),
// falloff vertical (brilha no alto, esmaece na linha d'água) e juntas de
// painel de pedra. As paredes do GLB são caixas com origem no centro: o eixo
// fino não varia, então u = x+z serve pras quatro sem uniform por parede.
const CAUSTIC_VERT = /* glsl */ `
  varying vec3 vPos;
  varying vec3 vNrm;
  void main() {
    vPos = position;
    vNrm = normal;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const CAUSTIC_FRAG = /* glsl */ `
  precision highp float;
  varying vec3 vPos;
  varying vec3 vNrm;
  uniform float uTime;

  // ⚠️ nomes: 'patch', 'sample', 'filter', 'input' e 'output' são RESERVADOS
  // em GLSL ES 3.00 (o three prefixa '#version 300 es' em WebGL2) — não usar.

  // hash + value noise (barato; o padrão não pede simplex)
  vec2 hash2(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return fract(sin(p) * 43758.5453);
  }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash2(i).x, b = hash2(i + vec2(1, 0)).x;
    float c = hash2(i + vec2(0, 1)).x, d = hash2(i + vec2(1, 1)).x;
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }
  // 3 oitavas: o campo de warp precisa da ondulação fina (detail 4.5 do blend)
  float fbm(vec2 p) {
    float v = 0.5 * vnoise(p);
    v += 0.31 * vnoise(p * 2.1 + 11.7);
    v += 0.19 * vnoise(p * 4.3 + 29.3);
    return v;
  }
  // voronoi distance-to-edge (IQ, duas passadas), com jitter animado leve:
  // as células respiram como a superfície da piscina que as projeta
  float voroEdge(vec2 p, float t) {
    vec2 n = floor(p), f = fract(p);
    vec2 mg, mr;
    float md = 8.0;
    for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 o = hash2(n + g);
      o = 0.5 + 0.35 * sin(t * 0.6 + 6.2831 * o);
      vec2 r = g + o - f;
      float d = dot(r, r);
      if (d < md) { md = d; mr = r; mg = g; }
    }
    md = 8.0;
    for (int j = -2; j <= 2; j++) for (int i = -2; i <= 2; i++) {
      vec2 g = mg + vec2(float(i), float(j));
      vec2 o = hash2(n + g);
      o = 0.5 + 0.35 * sin(t * 0.6 + 6.2831 * o);
      vec2 r = g + o - f;
      if (dot(mr - r, mr - r) > 0.00001)
        md = min(md, dot(0.5 * (mr + r), normalize(r - mr)));
    }
    return md;
  }

  void main() {
    // TRIPLANAR: projeta pelo eixo de menor normal, então parede (vertical) E
    // teto (horizontal) recebem a água na orientação certa. As caixas do GLB
    // têm normal dominante no seu eixo fino, então cada superfície pega o par
    // de eixos ao longo dela.
    vec3 an = abs(normalize(vNrm));
    vec2 q0;
    if (an.y >= an.x && an.y >= an.z) q0 = vPos.xz;      // teto / piso
    else if (an.x >= an.z)            q0 = vPos.zy;      // paredes laterais
    else                              q0 = vPos.xy;      // paredes frente/fundo
    vec2 q = q0;

    // CONCRETO CLARO + CÁUSTICAS SUAVES E ESPARSAS (Blade Runner 2049, a
    // referência original do LeonidasNFT): parede de concreto bege quente, com
    // riscos finos e delicados de luz d'água por cima — não uma rede densa.

    // warp orgânico leve, derivando no tempo (a água nunca para)
    vec2 drift = vec2(uTime * 0.02, uTime * 0.014);
    vec2 dq = vec2(
      fbm(q * 0.45 + drift),
      fbm(q * 0.45 + drift + vec2(19.0, 7.0))
    );
    q += (dq - 0.5) * 1.6;

    // o RISCO: só a borda fina das células voronoi acende (linha delicada)
    float d1 = voroEdge(q * 0.36, uTime);
    float lineC = smoothstep(0.038, 0.0, d1);
    // ESPARSO: máscara de mancha grande deixa só parte da parede com cáustica
    float mask = clamp((vnoise(q0 * 0.12 + drift * 0.3) - 0.46) / 0.14, 0.0, 1.0);
    lineC *= mask;
    // perfil vertical: cáustica mais forte no alto, some perto da água
    float vf = clamp((vPos.y + 4.0) / 11.0, 0.25, 1.0);
    lineC *= vf;

    // CONCRETO: bege quente claro, com mottling sutil e juntas de painel grandes
    float mott = 0.9 + 0.16 * vnoise(q0 * 1.5);
    vec2 seam = abs(fract(q0 / vec2(5.6, 4.2)) - 0.5);
    float mortar = 1.0 - 0.16 * (1.0 - smoothstep(0.0, 0.012, min(seam.x, seam.y)));
    vec3 concrete = vec3(0.55, 0.48, 0.40) * mott * mortar;

    // a luz da água: quente-branca, aditiva e suave (nunca ouro)
    vec3 caustic = vec3(1.0, 0.90, 0.72) * lineC * 0.95;
    vec3 col = concrete + caustic;

    gl_FragColor = vec4(col, 1.0);
  }
`

// `shell` é o group já carregado do GLB (quem chama usa o loadGlb da cena).
export function buildLeonidasHouse(shell: THREE.Object3D): LeonidasHouse {
  const group = new THREE.Group()
  group.name = 'LeonidasHouse'
  const disposables: { dispose: () => void }[] = []
  const track = <T extends { dispose: () => void }>(o: T): T => { disposables.push(o); return o }

  shell.name = 'LeonidasBlockShell'
  group.add(shell)

  // ── o pódio: a laje de granito que assenta o Bloco no chão da praça ────────
  // O pavimento da alameda está em y 0,36 (precinct.ts) e os degraus do GLB
  // nascem em y 0: sem pódio, o primeiro degrau some DENTRO do passeio. A
  // solução é a mesma da estátua do Leonidas (monuments.ts): uma soleira com
  // topo em 0,5 — o visitante sobe 14 cm do passeio, e a escadaria inteira
  // vive sobre a laje. Cabe no círculo reservado (BLOCK_R=26 em garden-plan).
  const PODIUM_TOP = 0.5
  const podium = new THREE.Mesh(
    track(new THREE.BoxGeometry(44, 0.6, 44)),
    track(new THREE.MeshStandardMaterial({ color: 0x0d0d0e, roughness: 0.85 })),
  )
  podium.position.set(0, PODIUM_TOP - 0.3, 0) // topo em +0,5
  podium.name = 'LeonidasPodium'
  podium.receiveShadow = true
  group.add(podium)
  shell.position.y = PODIUM_TOP // o cubo e tudo que é dele sobem para o topo da laje

  // ── o espelho d'água em volta do Bloco (a referência do LeonidasNFT) ───────
  // Uma lâmina escura e polida cercando o cubo sobre o pódio: reflete a pedra
  // dourada e a fenda da porta, como na imagem. Fica logo acima do topo da laje
  // e passa POR BAIXO do cubo (que a cobre), então lê como foço só na moldura.
  const apron = track(new THREE.MeshStandardMaterial({
    color: 0x030303, roughness: 0.04, metalness: 0.0, envMapIntensity: 0.7,
  }))
  const pool = new THREE.Mesh(track(new THREE.PlaneGeometry(43.4, 43.4)), apron)
  pool.rotation.x = -Math.PI / 2
  pool.position.y = PODIUM_TOP + 0.02
  pool.name = 'LeonidasApron'
  pool.receiveShadow = true
  group.add(pool)

  const caustic = track(new THREE.ShaderMaterial({
    vertexShader: CAUSTIC_VERT,
    fragmentShader: CAUSTIC_FRAG,
    uniforms: { uTime: { value: 0 } },
  }))

  // percorre o GLB: o exterior ganha o look da praça (cor fixa, sombras — a
  // massa de 32 m projeta a sombra longa que um monólito lunar deve), o
  // interior troca de pele e muda de layer (fora do sol).
  const glbGeo: THREE.BufferGeometry[] = []
  const glbMat = new Set<THREE.Material>()
  shell.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh) return
    if (mesh.geometry) glbGeo.push(mesh.geometry)
    const name = (mesh.name || '').toLowerCase()
    // exterior = tudo que pertence à fachada e pega o sol da praça; o resto é
    // interior e vive na CAVE_LAYER (o ₿ e as inscrições do fundo incluídos)
    const exterior =
      name.startsWith('bloco') || name.startsWith('degrau') ||
      name.startsWith('porta') || name.startsWith('portal') ||
      name.startsWith('veio') || name.startsWith('panelglow') ||
      name.startsWith('inscricao') ||
      (name.startsWith('b_relevo') && !name.includes('interior'))
    if (exterior) {
      mesh.castShadow = true
      mesh.receiveShadow = true
    } else {
      mesh.layers.set(CAVE_LAYER) // dentro do Bloco não entra sol
    }
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const m of mats) {
      if (!m) continue
      glbMat.add(m)
      const sm = m as THREE.MeshStandardMaterial
      if ('envMapIntensity' in sm) sm.envMapIntensity = 0.5
      const n = (m.name || '').toLowerCase()
      // ⚠️ COR FIXA, não multiplicação (a lição da Cryptolution House). O
      // travertino sobe de tom pra ler como pedra dourada contra o céu preto,
      // não como um buraco na cena.
      if (n.includes('travertino')) { sm.color.setRGB(0.34, 0.255, 0.15); sm.roughness = 0.68 }
      // a água: paredes (caustica), colunas dos cantos (onix) e o TETO
      // (teto_agua) — a "piscina acima" da 3ª referência. Mesmo shader,
      // triplanar, então o teto horizontal recebe a água certa.
      else if (n.includes('caustica') || n.includes('onix') || n.includes('teto_agua')) mesh.material = caustic
      else if (n.includes('cove') || n.includes('fresta') || n.includes('veio')) {
        mesh.material = track(new THREE.MeshBasicMaterial({ color: 0xffc37a }))
      }
      else if (n.includes('bronze_porta')) { sm.color.setRGB(0.03, 0.02, 0.012); sm.metalness = 0.7; sm.roughness = 0.3 }
      // Satoshi de bronze polido, pegando o ouro da sala
      else if (n.includes('bronze_satoshi')) { sm.color.setRGB(0.42, 0.27, 0.12); sm.metalness = 0.95; sm.roughness = 0.28 }
      else if (n.includes('gravura')) { sm.color.setRGB(0.06, 0.045, 0.03); sm.roughness = 0.85 }
      else if (n.includes('laje')) { sm.color.setRGB(0.28, 0.22, 0.15); sm.roughness = 0.55 }
      // plataforma central: um pad de concreto escuro fosco (o "tapete" da ref),
      // não mais espelho dourado
      else if (n.includes('plataforma')) { sm.color.setRGB(0.06, 0.052, 0.044); sm.roughness = 0.55 }
      else if (n.includes('teto')) { sm.color.setRGB(0.03, 0.027, 0.022); sm.roughness = 0.9 }
      else if (n.includes('couro')) { sm.color.setRGB(0.055, 0.038, 0.026); sm.roughness = 0.4 }
      else if (n.includes('cromo')) { sm.color.setRGB(0.6, 0.6, 0.62); sm.metalness = 1.0; sm.roughness = 0.15 }
      else if (n.includes('marmore')) { sm.color.setRGB(0.045, 0.038, 0.033); sm.roughness = 0.12 }
      else if (n.includes('prata')) { sm.color.setRGB(0.75, 0.75, 0.78); sm.metalness = 1.0; sm.roughness = 0.1 }
      else if (n.includes('manto')) { sm.color.setRGB(0.014, 0.013, 0.015); sm.roughness = 0.85 }
      // a cara do LeonidasNFT: a caveira pixelada amarela, BEM acesa (ela é o
      // ponto de leitura do personagem — como a máscara da referência)
      else if (n.includes('skull')) {
        sm.color.setRGB(1.0, 0.82, 0.05)
        sm.emissive.setRGB(1.0, 0.80, 0.06)
        sm.emissiveIntensity = 2.4
      }
      // livros, vaso, galho: as cores achatadas do GLB já servem
    }
  })

  // ── a água: espelho escuro no piso (o blend não exporta; aqui é um plano) ──
  // Cobre a cavidade 28×28 na cota da lâmina (y local 0,75 do modelo). Preto
  // quase total + roughness baixa: o que ela mostra é o reflexo do ouro.
  const water = new THREE.Mesh(
    track(new THREE.PlaneGeometry(27.9, 27.9)),
    track(new THREE.MeshStandardMaterial({
      color: 0x020202, roughness: 0.05, metalness: 0.0, envMapIntensity: 0.6,
    })),
  )
  water.rotation.x = -Math.PI / 2
  water.position.y = 0.75 + PODIUM_TOP // a lâmina sobe junto com o cubo (pódio)
  water.name = 'LeonidasWater'
  water.layers.set(CAVE_LAYER)
  group.add(water)

  // ── a luz da porta: o ouro vazando pela fenda sobre os degraus ─────────────
  // Uma PointLight só (o orçamento de luz da praça é curto; o resto do
  // interior é emissivo e não precisa de luz nenhuma). Posição local no túnel
  // da porta: a fachada do GLB olha o +Z local.
  const doorLight = new THREE.PointLight(0xffa64d, 26, 70, 2)
  doorLight.position.set(0, 4.1, 15.2) // +0,5 do pódio
  group.add(doorLight)
  const doorBase = doorLight.intensity

  return {
    group,
    apexY: 32,
    update(t) {
      // a água nunca para: as cáusticas ondulam e a fenda respira de leve
      caustic.uniforms.uTime.value = t
      doorLight.intensity = doorBase * (0.88 + 0.12 * Math.sin(t * 0.9))
    },
    dispose() {
      for (const d of disposables) d.dispose()
      for (const g of glbGeo) g.dispose()
      for (const m of Array.from(glbMat)) m.dispose()
    },
  }
}
