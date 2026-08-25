// O MOTOR DA BATALHA, desacoplado do palco.
//
// ⚠️ POR QUE MÓDULO: a guerra vive em DOIS lugares com o MESMO motor: a rota
// /city/war (palco próprio, câmera própria, céu próprio) e a cratera dentro do
// mundo da DogCity, onde o usuário chega passeando e a interface vira "modo
// jogo" por proximidade. Tudo que é batalha (exércitos, costura, obeliscos,
// pools de projéteis e impactos, partículas, feed da Kraken) mora num
// THREE.Group que o anfitrião posiciona onde quiser; tudo que é palco (céu,
// Terra, chão, câmera, HUD React, pós) fica com o anfitrião.
//
// ⚠️ O RELEVO É DO ANFITRIÃO. O construtor recebe `altura(x, z)` em coordenadas
// LOCAIS do grupo: o palco solo passa a função da cratera; a praça passa o
// terreno dela traduzido pro espaço local. Assim as tropas pisam certo nos dois
// mundos sem o motor conhecer nenhum deles.
//
// ⚠️ NADA ALOCA POR TRADE: pools criados uma vez, orçados por tier (o objeto
// `orc` vem do anfitrião). `setLive(false)` desliga o feed quando o usuário se
// afasta na cidade; os exércitos congelam no último book e o mundo fica leve.
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { connectKraken, type BookLevel, type WarTrade, type KrakenFeed } from './kraken'
import { shibaGeometry, bearGeometry } from './critters'
import { buildTankGeometry, CORES_TANQUE_DOG, CORES_TANQUE_URSO } from './tanks'

export const CAMPO_X = 88
export const FRENTE = 7

export interface OrcamentoBatalha {
  cap: number
  niveis: number
  maxOndas: number
  maxLuzes: number
  detritos: number
  poeiraMax: number
  faiscaMax: number
}

export interface HudBatalha {
  preco: number
  low24: number
  high24: number
  open24: number
  status: 'connecting' | 'live' | 'down'
  ursosCaidos: number
  caesCaidos: number
  compra: number
  venda: number
}

export interface Battlefield {
  group: THREE.Group
  update(agora: number): void
  setLive(on: boolean): void
  hud(): HudBatalha
  dispose(): void
}

const hash = (a: number, b: number) => {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453
  return s - Math.floor(s)
}

const fmtPreco = (p: number) => (p > 0 ? p.toFixed(6) : '-')

export interface OpcoesBatalha {
  /** falso no mundo da cidade: o orçamento global de PointLight de lá está no
   *  limite, então a frente e os obeliscos ficam só com o emissivo */
  luzesAmbiente?: boolean
  /** impacto pesado (morteiro, canhão de tanque): o anfitrião pode sacudir a
   *  câmera sem o motor conhecer câmera nenhuma */
  onImpactoGrande?: (forca: number) => void
}

export function createBattlefield(
  altura: (x: number, z: number) => number,
  orc: OrcamentoBatalha,
  onWhale?: (lado: 'buy' | 'sell', forca: number) => void,
  opcoes: OpcoesBatalha = {},
): Battlefield {
  const luzesAmbiente = opcoes.luzesAmbiente !== false
  const group = new THREE.Group()
  // ⚠️ a praça faz raycast recursivo na cena inteira no duplo toque; instância
  // testada uma a uma são milhares de interseções à toa
  const semRaycast = (m: THREE.Object3D) => {
    ;(m as any).raycast = () => {}
  }
  let matBrasas: THREE.ShaderMaterial | null = null
  let costuraMesh: THREE.Mesh | null = null
  let brasasPts: THREE.Points | null = null

  // ── a costura: energia viva, um draw call ───────────────────────────────
  // ⚠️ os chunks de logdepth são no-op fora da praça (guardados por ifdef),
  // mas na praça o renderer usa logarithmicDepthBuffer e ShaderMaterial sem
  // eles escreve profundidade errada (z-fighting contra o regolito)
  const matCostura = new THREE.ShaderMaterial({
    transparent: true,
    uniforms: { time: { value: 0 }, pressao: { value: 0.5 } },
    vertexShader: `
      #include <common>
      #include <logdepthbuf_pars_vertex>
      varying vec2 vUv;
      void main(){
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: `
      #include <common>
      #include <logdepthbuf_pars_fragment>
      uniform float time; uniform float pressao; varying vec2 vUv;
      void main(){
        #include <logdepthbuf_fragment>
        float onda = sin(vUv.y * 40.0 - time * 6.0) * 0.5 + 0.5;
        float pulso = 0.6 + 0.4 * sin(time * 3.0);
        vec3 quente = vec3(1.0, 0.71, 0.36);
        vec3 frio = vec3(1.0, 0.28, 0.18);
        vec3 cor = mix(frio, quente, pressao);
        gl_FragColor = vec4(cor * (0.7 + onda * 0.5) * pulso, 1.0);
      }`,
  })
  {
    const partes: THREE.BufferGeometry[] = []
    for (let s = 0; s < 80; s++) {
      const z0 = -62 + s * 1.55
      const z1 = z0 + 1.55
      const y0 = altura(0, z0) + 0.3
      const y1 = altura(0, z1) + 0.3
      const g = new THREE.BoxGeometry(0.35, 0.1, Math.hypot(1.55, y1 - y0))
      g.rotateX(Math.atan2(y1 - y0, 1.55))
      g.translate(0, (y0 + y1) / 2, (z0 + z1) / 2)
      partes.push(g)
    }
    const geo = mergeGeometries(partes, false)!
    partes.forEach((p) => p.dispose())
    costuraMesh = new THREE.Mesh(geo, matCostura)
    group.add(costuraMesh)
  }
  let luzFrente: THREE.PointLight | null = null
  if (luzesAmbiente) {
    luzFrente = new THREE.PointLight(0xffc98a, 12, 60, 1.6)
    luzFrente.position.set(0, 4, 0)
    group.add(luzFrente)
  }

  // ── neblina rasteira colada na frente ───────────────────────────────────
  const gNev = new THREE.PlaneGeometry(26, 130, 1, 1)
  gNev.rotateX(-Math.PI / 2)
  const matNev = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { time: { value: 0 }, cor: { value: new THREE.Color(0x3a2a20) } },
    vertexShader: `
      #include <common>
      #include <logdepthbuf_pars_vertex>
      varying vec2 vUv;
      void main(){
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: `
      #include <common>
      #include <logdepthbuf_pars_fragment>
      uniform float time; uniform vec3 cor; varying vec2 vUv;
      float hash2(vec2 p){ return fract(sin(dot(p, vec2(12.9, 78.2))) * 43758.5); }
      float fbm(vec2 p){ float v = 0.0; float a = 0.5; for (int i = 0; i < 4; i++){ v += a * hash2(floor(p)); p = p * 2.03 + time * 0.02; a *= 0.5; } return v; }
      void main(){
        #include <logdepthbuf_fragment>
        float n = fbm(vUv * vec2(6.0, 14.0));
        float borda = smoothstep(0.0, 0.15, vUv.x) * smoothstep(1.0, 0.85, vUv.x);
        gl_FragColor = vec4(cor, n * 0.5 * borda);
      }`,
  })
  const neblina = new THREE.Mesh(gNev, matNev)
  neblina.position.set(0, 0.55, 0)
  group.add(neblina)

  // ── exércitos: respiração na GPU + rim configurável pelo anfitrião ──────
  const matCaes = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.85, emissive: 0x2a1503, emissiveIntensity: 0.5,
  })
  const matUrsos = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.9, emissive: 0x5c0f1c, emissiveIntensity: 0.75,
  })
  let shaderCaes: any = null
  let shaderUrsos: any = null
  const solDir = new THREE.Vector3(0.4, 0.25, 0.8).normalize()
  matCaes.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 }
    shader.uniforms.solDir = { value: solDir }
    shader.vertexShader = 'attribute float aFase;\nuniform float uTime;\n' + shader.vertexShader
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      float peso = smoothstep(0.0, 1.3, position.y);
      transformed.y += sin(uTime * 2.1 + aFase * 6.283) * 0.035 * peso;
      float bal = sin(uTime * 1.5 + aFase * 6.283) * 0.045 * peso;
      float cb = cos(bal); float sb = sin(bal);
      transformed.xz = mat2(cb, -sb, sb, cb) * transformed.xz;`,
    )
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', 'uniform vec3 solDir;\nvoid main() {')
      .replace('#include <emissivemap_fragment>', `
        #include <emissivemap_fragment>
        float rim = pow(1.0 - max(dot(normalize(vNormal), solDir), 0.0), 3.0);
        totalEmissiveRadiance += rim * vec3(1.0, 0.55, 0.12) * 0.9;
      `)
    shaderCaes = shader
  }
  matUrsos.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 }
    shader.vertexShader = 'attribute float aFase;\nuniform float uTime;\n' + shader.vertexShader
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      float peso = smoothstep(0.0, 1.2, position.y);
      transformed.y += sin(uTime * 1.7 + aFase * 6.283) * 0.03 * peso;`,
    )
    shaderUrsos = shader
  }
  const geoShiba = shibaGeometry()
  const geoUrso = bearGeometry()
  const caes = new THREE.InstancedMesh(geoShiba, matCaes, orc.cap)
  const ursos = new THREE.InstancedMesh(geoUrso, matUrsos, orc.cap)
  caes.count = 0
  ursos.count = 0
  const faseCaes = new Float32Array(orc.cap)
  const faseUrsos = new Float32Array(orc.cap)
  for (let i = 0; i < orc.cap; i++) {
    faseCaes[i] = hash(i, 41)
    faseUrsos[i] = hash(i, 59)
  }
  caes.geometry = geoShiba.clone()
  ursos.geometry = geoUrso.clone()
  caes.geometry.setAttribute('aFase', new THREE.InstancedBufferAttribute(faseCaes, 1))
  ursos.geometry.setAttribute('aFase', new THREE.InstancedBufferAttribute(faseUrsos, 1))
  // a praça faz raycast recursivo e o frustum de instância mente; nos dois
  // palcos é mais barato e mais seguro desligar ambos
  for (const m of [caes, ursos]) {
    semRaycast(m)
    m.frustumCulled = false
  }
  group.add(caes, ursos)

  // ── MARCHA: o book define ALVOS e as tropas ANDAM até eles ───────────────
  // ⚠️ É AQUI QUE A CENA DEIXA DE SER ENFADONHA SEM INVENTAR DADO. O book de
  // DOG/USD muda o tempo todo (o preço anda, os níveis engordam e magram), e
  // antes cada mudança era um teleporte silencioso das fileiras. Agora é uma
  // MARCHA: cada soldado caminha até o posto novo com bob de passada. Preço
  // subindo = o exército inteiro dos cães avançando de verdade.
  interface Exercito {
    mesh: THREE.InstancedMesh
    fase: Float32Array
    alvo: Float32Array
    cur: Float32Array
    rot: Float32Array
    esc: Float32Array
    n: number
    primeira: boolean
  }
  const fazExercito = (mesh: THREE.InstancedMesh, fase: Float32Array): Exercito => {
    const rot = new Float32Array(orc.cap)
    const esc = new Float32Array(orc.cap)
    for (let i = 0; i < orc.cap; i++) {
      rot[i] = (hash(i, 71) - 0.5) * 0.35
      esc[i] = 0.9 + hash(i, 73) * 0.25
    }
    return {
      mesh, fase, rot, esc,
      alvo: new Float32Array(orc.cap * 3),
      cur: new Float32Array(orc.cap * 3),
      n: 0, primeira: true,
    }
  }
  const exCaes = fazExercito(caes, faseCaes)
  const exUrsos = fazExercito(ursos, faseUrsos)

  const detritoCaes = new THREE.InstancedMesh(geoShiba, matCaes, orc.detritos)
  const detritoUrsos = new THREE.InstancedMesh(geoUrso, matUrsos, orc.detritos)
  detritoCaes.count = 0
  detritoUrsos.count = 0
  for (const m of [detritoCaes, detritoUrsos]) {
    semRaycast(m)
    m.frustumCulled = false
  }
  group.add(detritoCaes, detritoUrsos)

  // ── DUELOS DE VANGUARDA: o teatro que nunca para ─────────────────────────
  // ⚠️ DOG/USD tem poucos trades por minuto, e batalha parada é batalha chata.
  // Os duelos são encenação declarada: pares correm da própria linha, se
  // chocam na costura e um cai; MAS o vencedor pende pro lado que tem PRESSÃO
  // real de compra/venda, então até o teatro conta a verdade do mercado.
  interface Duelo {
    cao: THREE.Mesh
    urso: THREE.Mesh
    fase: 'espera' | 'corre' | 'choque' | 'retirada'
    t0: number
    z: number
    vence: 'buy' | 'sell'
  }
  const duelos: Duelo[] = []
  for (let i = 0; i < 10; i++) {
    const cao = new THREE.Mesh(geoShiba, matCaes)
    const urso = new THREE.Mesh(geoUrso, matUrsos)
    cao.visible = urso.visible = false
    semRaycast(cao)
    semRaycast(urso)
    group.add(cao, urso)
    duelos.push({ cao, urso, fase: 'espera', t0: performance.now() + 600 + i * 900 + hash(i, 3) * 1400, z: 0, vence: 'buy' })
  }
  const X_DUELO = FRENTE + 15

  // ── brasas subindo da costura: a frente é uma ferida quente ──────────────
  const N_BRASA = 130
  {
    const pos = new Float32Array(N_BRASA * 3)
    const fase = new Float32Array(N_BRASA)
    for (let i = 0; i < N_BRASA; i++) {
      pos.set([(hash(i, 1) - 0.5) * 4.5, 0, (hash(i, 2) - 0.5) * 122], i * 3)
      fase[i] = hash(i, 5)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('fase', new THREE.BufferAttribute(fase, 1))
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { time: { value: 0 }, cor: { value: new THREE.Color(0xffa050) } },
      vertexShader: `
        #include <common>
        #include <logdepthbuf_pars_vertex>
        attribute float fase; uniform float time; varying float vA;
        void main(){
          vec3 p = position;
          float h = mod(time * (0.7 + fase) + fase * 7.0, 7.0);
          p.y = h;
          p.x += sin(time * 1.3 + fase * 20.0) * 0.5;
          vA = (1.0 - h / 7.0) * (0.35 + 0.65 * fase);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = 16.0 / -mv.z * (60.0);
          gl_PointSize = clamp(gl_PointSize, 1.0, 5.0);
          gl_Position = projectionMatrix * mv;
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader: `
        #include <common>
        #include <logdepthbuf_pars_fragment>
        uniform vec3 cor; varying float vA;
        void main(){
          #include <logdepthbuf_fragment>
          float d = distance(gl_PointCoord, vec2(0.5));
          gl_FragColor = vec4(cor, smoothstep(0.5, 0.0, d) * vA * 0.7);
        }`,
    })
    const brasas = new THREE.Points(g, mat)
    brasas.frustumCulled = false
    group.add(brasas)
    matBrasas = mat
    brasasPts = brasas
  }

  // ── letreiro de dano: o trade vira número flutuando no impacto ───────────
  const POOL_TEXTO = 10
  const textos = Array.from({ length: POOL_TEXTO }, () => {
    const cv = document.createElement('canvas')
    cv.width = 256
    cv.height = 72
    const tx = new THREE.CanvasTexture(cv)
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, transparent: true, depthWrite: false, opacity: 0 }))
    sp.scale.set(13, 3.7, 1)
    sp.visible = false
    group.add(sp)
    return { sp, cv, tx }
  })
  let cursorTexto = 0
  const fmtQtd = (n: number) =>
    n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(0)}K` : n.toFixed(0)
  const mostraDano = (p: THREE.Vector3, qty: number, lado: 'buy' | 'sell') => {
    const t = textos[cursorTexto]
    cursorTexto = (cursorTexto + 1) % POOL_TEXTO
    const cx = t.cv.getContext('2d')!
    cx.clearRect(0, 0, 256, 72)
    cx.font = '700 40px ui-monospace, monospace'
    cx.textAlign = 'center'
    cx.fillStyle = lado === 'buy' ? 'rgba(255,180,92,0.95)' : 'rgba(255,96,72,0.95)'
    cx.fillText(`${lado === 'buy' ? '+' : '-'}${fmtQtd(qty)} DOG`, 128, 50)
    t.tx.needsUpdate = true
    t.sp.position.copy(p).setY(p.y + 3.2)
    t.sp.visible = true
    ;(t.sp.material as THREE.SpriteMaterial).opacity = 1
    t.sp.userData.t0 = performance.now()
  }

  // ── salva de baleia: trade grande vira bombardeio, não bola única ────────
  const salva: Array<{ at: number; lado: 'buy' | 'sell'; qty: number; forca: number; z: number }> = []

  const curCaes = { v: 0 }
  const curUrsos = { v: 0 }
  interface Tombo {
    mesh: THREE.InstancedMesh
    idx: number
    para: THREE.Quaternion
    x: number
    y: number
    z: number
    esc: number
    t0: number
  }
  const tombos: Tombo[] = []
  const qZero = new THREE.Quaternion()
  const tomba = (mesh: THREE.InstancedMesh, cur: { v: number }, p: THREE.Vector3, n: number) => {
    for (let k = 0; k < n; k++) {
      const idx = (cur.v = (cur.v + 1) % orc.detritos)
      mesh.count = Math.max(mesh.count, idx + 1)
      const px = p.x + (hash(idx, 3) - 0.5) * 4
      const pz = p.z + (hash(idx, 7) - 0.5) * 4
      tombos.push({
        mesh, idx,
        para: new THREE.Quaternion().setFromEuler(new THREE.Euler(
          (Math.PI / 2) * (hash(idx, 1) > 0.5 ? 1 : -1), hash(idx, 2) * Math.PI, 0,
        )),
        x: px, y: altura(px, pz), z: pz,
        esc: 0.8 + hash(idx, 9) * 0.3,
        t0: performance.now(),
      })
    }
  }

  // ── obeliscos de obsidiana com coroa acesa ──────────────────────────────
  const obsidiana = new THREE.MeshStandardMaterial({ color: 0x0b0a0d, roughness: 0.25, metalness: 0.1 })
  const matCoroa = new THREE.MeshBasicMaterial({ color: 0xffa050 })
  const fazObelisco = () => {
    const o = new THREE.Mesh(new THREE.BoxGeometry(1.6, 9, 1.6), obsidiana)
    o.position.y = 4.5
    o.rotation.y = 0.4
    const coroa = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.35, 1.75), matCoroa)
    coroa.position.y = 4.35
    o.add(coroa)
    const luz = new THREE.PointLight(0xff9040, 14, 30, 1.8)
    luz.position.y = 5.4
    o.add(luz)
    o.visible = false
    group.add(o)
    return o
  }
  const obLow = fazObelisco()
  const obHigh = fazObelisco()

  const etiqueta = (texto: string) => {
    const cv = document.createElement('canvas')
    cv.width = 512
    cv.height = 96
    const cx = cv.getContext('2d')!
    cx.font = '600 44px ui-monospace, monospace'
    cx.textAlign = 'center'
    cx.fillStyle = 'rgba(240,235,225,0.92)'
    cx.fillText(texto, 256, 62)
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false }))
    sp.scale.set(22, 4.1, 1)
    return sp
  }
  let etLow: THREE.Sprite | null = null
  let etHigh: THREE.Sprite | null = null

  // ── arsenal em pool ─────────────────────────────────────────────────────
  const texDisco = (() => {
    const cv = document.createElement('canvas')
    cv.width = cv.height = 64
    const cx = cv.getContext('2d')!
    const g = cx.createRadialGradient(32, 32, 0, 32, 32, 32)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.4, 'rgba(255,255,255,0.65)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    cx.fillStyle = g
    cx.fillRect(0, 0, 64, 64)
    return new THREE.CanvasTexture(cv)
  })()

  const geoTiro = new THREE.SphereGeometry(1, 10, 10)
  const geoOnda = new THREE.RingGeometry(0.8, 1, 40)
  geoOnda.rotateX(-Math.PI / 2)
  const geoRastro = new THREE.BoxGeometry(0.12, 0.12, 1)
  geoRastro.translate(0, 0, -0.5)

  const matTiroCompra = new THREE.MeshBasicMaterial({ color: 0xffb35c })
  const matTiroVenda = new THREE.MeshBasicMaterial({ color: 0xff5940 })
  const matRastroCompra = new THREE.MeshBasicMaterial({
    color: 0xffb35c, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false,
  })
  const matRastroVenda = matRastroCompra.clone()
  matRastroVenda.color.setHex(0xff5940)

  const POOL_TIROS = orc.maxOndas * 2
  interface Tiro { i: number; t0: number; dur: number; forca: number; lado: 'buy' | 'sell'; qty: number }
  const poolTiros: THREE.Mesh[] = []
  const poolRastros: THREE.Mesh[] = []
  for (let i = 0; i < POOL_TIROS; i++) {
    const m = new THREE.Mesh(geoTiro, matTiroCompra)
    m.visible = false
    m.userData.de = new THREE.Vector3()
    m.userData.para = new THREE.Vector3()
    m.userData.prev = new THREE.Vector3()
    group.add(m)
    poolTiros.push(m)
    const r = new THREE.Mesh(geoRastro, matRastroCompra)
    r.visible = false
    group.add(r)
    poolRastros.push(r)
  }
  let cursorTiro = 0
  const tiros: Tiro[] = []

  const matOndaCompra = new THREE.MeshBasicMaterial({ color: 0xffa64d, transparent: true, side: THREE.DoubleSide })
  const matOndaVenda = new THREE.MeshBasicMaterial({ color: 0xff5238, transparent: true, side: THREE.DoubleSide })
  interface Onda { mesh: THREE.Mesh; luz: THREE.PointLight | null; t0: number; forca: number }
  const poolOndas: THREE.Mesh[] = Array.from({ length: orc.maxOndas }, () => {
    const m = new THREE.Mesh(geoOnda, matOndaCompra)
    m.visible = false
    group.add(m)
    return m
  })
  let cursorOnda = 0
  const poolLuzes: THREE.PointLight[] = Array.from({ length: orc.maxLuzes }, () => {
    const l = new THREE.PointLight(0xffa64d, 0, 26, 1.8)
    group.add(l)
    return l
  })
  let cursorLuz = 0
  const ondas: Onda[] = []

  const POOL_FLASH = 24
  const flashPool = Array.from({ length: POOL_FLASH }, () => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: texDisco, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0,
    }))
    sp.visible = false
    group.add(sp)
    return sp
  })
  let flashCursor = 0
  const clarao = (p: THREE.Vector3, base: number, cor: number) => {
    const sp = flashPool[flashCursor]
    flashCursor = (flashCursor + 1) % POOL_FLASH
    ;(sp.material as THREE.SpriteMaterial).color.setHex(cor)
    sp.position.copy(p)
    sp.userData.base = base
    sp.scale.setScalar(base)
    ;(sp.material as THREE.SpriteMaterial).opacity = 1
    sp.visible = true
    sp.userData.t0 = performance.now()
  }

  // ── FUMAÇA: o efeito que LÊ DE LONGE. Faísca é 1 pixel a 600 m; uma pluma
  // de fumaça de 8 m subindo por 4 segundos é o que faz a batalha parecer
  // batalha da vista de chegada.
  const POOL_FUMACA = 12
  const fumacas = Array.from({ length: POOL_FUMACA }, () => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: texDisco, transparent: true, depthWrite: false, opacity: 0, color: 0x8a7a68,
    }))
    sp.visible = false
    group.add(sp)
    return sp
  })
  let fumacaCursor = 0
  const solta_fumaca = (p: THREE.Vector3, forca: number) => {
    const sp = fumacas[fumacaCursor]
    fumacaCursor = (fumacaCursor + 1) % POOL_FUMACA
    sp.position.copy(p).setY(p.y + 1.5)
    sp.userData.base = 2.5 + Math.sqrt(forca) * 1.6
    sp.userData.t0 = performance.now()
    sp.userData.jit = hash(Math.floor(p.z * 7), 3) - 0.5
    sp.scale.setScalar(sp.userData.base)
    ;(sp.material as THREE.SpriteMaterial).opacity = 0
    sp.visible = true
  }

  const poeiraPos = new Float32Array(orc.poeiraMax * 3)
  const poeiraVel = new Float32Array(orc.poeiraMax * 3)
  const poeiraViva = new Uint8Array(orc.poeiraMax)
  const poeiraT0 = new Float32Array(orc.poeiraMax)
  poeiraPos.fill(-999)
  const geoPoeira = new THREE.BufferGeometry()
  geoPoeira.setAttribute('position', new THREE.BufferAttribute(poeiraPos, 3))
  const matPoeira = new THREE.PointsMaterial({
    map: texDisco, color: 0xcabfa8, size: 2.4, transparent: true, opacity: 0.62, depthWrite: false, sizeAttenuation: true,
  })
  const poeiraPts = new THREE.Points(geoPoeira, matPoeira)
  poeiraPts.frustumCulled = false
  group.add(poeiraPts)
  let poeiraCursor = 0
  const emitPoeira = (p: THREE.Vector3, forca: number) => {
    const n = Math.min(28, 6 + Math.round(forca * 2))
    for (let k = 0; k < n; k++) {
      const i = (poeiraCursor = (poeiraCursor + 1) % orc.poeiraMax)
      const ang = hash(i, k + 1) * Math.PI * 2
      const spd = 1.4 + hash(i, k + 9) * 2.4
      poeiraPos[i * 3] = p.x
      poeiraPos[i * 3 + 1] = p.y + 0.2
      poeiraPos[i * 3 + 2] = p.z
      poeiraVel[i * 3] = Math.cos(ang) * spd
      poeiraVel[i * 3 + 1] = 1.1 + hash(i, k + 3) * 1.5
      poeiraVel[i * 3 + 2] = Math.sin(ang) * spd
      poeiraViva[i] = 1
      poeiraT0[i] = performance.now()
    }
  }

  const faiscaPos = new Float32Array(orc.faiscaMax * 6)
  const faiscaVel = new Float32Array(orc.faiscaMax * 3)
  const faiscaViva = new Uint8Array(orc.faiscaMax)
  const faiscaT0 = new Float32Array(orc.faiscaMax)
  const geoFaisca = new THREE.BufferGeometry()
  geoFaisca.setAttribute('position', new THREE.BufferAttribute(faiscaPos, 3))
  const matFaisca = new THREE.LineBasicMaterial({ color: 0xffe1a8, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending })
  const faiscasSeg = new THREE.LineSegments(geoFaisca, matFaisca)
  faiscasSeg.frustumCulled = false
  group.add(faiscasSeg)
  let faiscaCursor = 0
  const emitFaiscas = (p: THREE.Vector3, forca: number) => {
    const n = Math.min(18, 4 + Math.round(forca))
    for (let k = 0; k < n; k++) {
      const i = (faiscaCursor = (faiscaCursor + 1) % orc.faiscaMax)
      const ang = hash(i, k + 1) * Math.PI * 2
      const spd = 4 + hash(i, k + 2) * 6
      faiscaVel[i * 3] = Math.cos(ang) * spd
      faiscaVel[i * 3 + 1] = 2 + hash(i, k + 5) * 2.6
      faiscaVel[i * 3 + 2] = Math.sin(ang) * spd
      faiscaPos[i * 6] = faiscaPos[i * 6 + 3] = p.x
      faiscaPos[i * 6 + 1] = faiscaPos[i * 6 + 4] = p.y + 0.3
      faiscaPos[i * 6 + 2] = faiscaPos[i * 6 + 5] = p.z
      faiscaViva[i] = 1
      faiscaT0[i] = performance.now()
    }
  }

  const texCicatriz = (() => {
    const cv = document.createElement('canvas')
    cv.width = cv.height = 128
    const cx = cv.getContext('2d')!
    const g = cx.createRadialGradient(64, 64, 0, 64, 64, 64)
    g.addColorStop(0, 'rgba(18,13,9,0.85)')
    g.addColorStop(0.55, 'rgba(18,13,9,0.4)')
    g.addColorStop(1, 'rgba(18,13,9,0)')
    cx.fillStyle = g
    cx.fillRect(0, 0, 128, 128)
    return new THREE.CanvasTexture(cv)
  })()
  const geoCicatriz = new THREE.CircleGeometry(1, 20)
  geoCicatriz.rotateX(-Math.PI / 2)
  const POOL_CICATRIZ = 40
  const cicatrizes = Array.from({ length: POOL_CICATRIZ }, () => {
    const m = new THREE.Mesh(geoCicatriz, new THREE.MeshBasicMaterial({
      map: texCicatriz, transparent: true, opacity: 0, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -4,
    }))
    m.visible = false
    group.add(m)
    return m
  })
  let cicatrizCursor = 0
  const marcaCicatriz = (p: THREE.Vector3, forca: number) => {
    const m = cicatrizes[cicatrizCursor]
    cicatrizCursor = (cicatrizCursor + 1) % POOL_CICATRIZ
    m.position.set(p.x, altura(p.x, p.z) + 0.03, p.z)
    m.scale.setScalar(1.3 + Math.sqrt(forca) * 1.1)
    m.rotation.z = hash(p.x, p.z) * Math.PI * 2
    m.visible = true
    ;(m.material as THREE.MeshBasicMaterial).opacity = 0.75
    m.userData.t0 = performance.now()
  }

  // ── BOLA DE FOGO bifásica: o coração visual da explosão ─────────────────
  const texBola = (() => {
    const cv = document.createElement('canvas')
    cv.width = cv.height = 128
    const cx = cv.getContext('2d')!
    const g = cx.createRadialGradient(64, 64, 0, 64, 64, 64)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.18, 'rgba(255,214,140,0.95)')
    g.addColorStop(0.42, 'rgba(255,120,40,0.75)')
    g.addColorStop(0.7, 'rgba(90,40,20,0.35)')
    g.addColorStop(1, 'rgba(40,20,15,0)')
    cx.fillStyle = g
    cx.fillRect(0, 0, 128, 128)
    return new THREE.CanvasTexture(cv)
  })()
  const POOL_BOLA = 10
  const bolasFogo = Array.from({ length: POOL_BOLA }, () => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: texBola, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0,
    }))
    sp.visible = false
    group.add(sp)
    return sp
  })
  let bolaCursor = 0
  const explodeBola = (p: THREE.Vector3, forca: number) => {
    const sp = bolasFogo[bolaCursor]
    bolaCursor = (bolaCursor + 1) % POOL_BOLA
    sp.position.copy(p).setY(p.y + 0.6 + Math.sqrt(forca) * 0.3)
    // ⚠️ a fase BRILHANTE é o que o olho chama de explosão; curta demais e a
    // guerra vira só fumaça (o fundador assistiu e só viu "tiros pequenos")
    sp.userData.base = 2.6 + Math.sqrt(forca) * 3.2
    sp.userData.t0 = performance.now()
    sp.userData.dur = 650 + forca * 55
    const mat = sp.material as THREE.SpriteMaterial
    mat.blending = THREE.AdditiveBlending
    mat.color.setRGB(1, 1, 1)
    mat.opacity = 1
    sp.scale.setScalar(sp.userData.base * 0.3)
    sp.visible = true
  }

  // coluna de fogo pros impactos pesados (reaproveita texBola)
  const POOL_COLUNA = 6
  const colunas = Array.from({ length: POOL_COLUNA }, () => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: texBola, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0,
    }))
    sp.visible = false
    group.add(sp)
    return sp
  })
  let colunaCursor = 0
  const colunaDeFogo = (p: THREE.Vector3, forca: number) => {
    const sp = colunas[colunaCursor]
    colunaCursor = (colunaCursor + 1) % POOL_COLUNA
    sp.userData.baseY = p.y
    sp.userData.x = p.x
    sp.userData.z = p.z
    sp.userData.forca = forca
    sp.userData.seed = hash(colunaCursor, 3)
    sp.userData.altura = 4.5 + Math.sqrt(forca) * 2.8
    sp.userData.largura = 1.1 + Math.sqrt(forca) * 0.5
    sp.userData.t0 = performance.now()
    sp.userData.fumou = false
    sp.visible = true
  }

  // destroços incandescentes em arco balístico
  const POOL_DESTROCO = 28
  const geoDestroco = new THREE.BoxGeometry(0.1, 0.1, 0.26)
  interface Destroco { m: THREE.Mesh; vx: number; vy: number; vz: number; t0: number; viva: boolean }
  const destrocos: Destroco[] = Array.from({ length: POOL_DESTROCO }, () => {
    const m = new THREE.Mesh(geoDestroco, new THREE.MeshBasicMaterial({ color: 0xfff2c0, transparent: true }))
    m.visible = false
    semRaycast(m)
    group.add(m)
    return { m, vx: 0, vy: 0, vz: 0, t0: 0, viva: false }
  })
  let destrocoCursor = 0
  const emitDestrocos = (p: THREE.Vector3, forca: number) => {
    const n = Math.min(10, 3 + Math.round(Math.sqrt(forca) * 2))
    for (let k = 0; k < n; k++) {
      const d = destrocos[destrocoCursor]
      destrocoCursor = (destrocoCursor + 1) % POOL_DESTROCO
      const ang = hash(destrocoCursor, k + 4) * Math.PI * 2
      const spd = 3.5 + hash(destrocoCursor, k + 8) * 5
      d.vx = Math.cos(ang) * spd
      d.vz = Math.sin(ang) * spd
      d.vy = 5 + hash(destrocoCursor, k + 2) * 4.5
      d.t0 = performance.now()
      d.viva = true
      d.m.position.copy(p).setY(p.y + 0.3)
      d.m.visible = true
      ;(d.m.material as THREE.MeshBasicMaterial).color.setHex(0xfff2c0)
      ;(d.m.material as THREE.MeshBasicMaterial).opacity = 1
    }
  }

  // flash de tela no chão: iluminação falsa sem PointLight (orçamento intacto)
  const geoFlashChao = new THREE.PlaneGeometry(1, 1)
  geoFlashChao.rotateX(-Math.PI / 2)
  const POOL_FLASH_CHAO = 10
  const flashesChao = Array.from({ length: POOL_FLASH_CHAO }, () => {
    const m = new THREE.Mesh(geoFlashChao, new THREE.MeshBasicMaterial({
      map: texDisco, color: 0xffe6c2, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    }))
    m.visible = false
    semRaycast(m)
    group.add(m)
    return m
  })
  let flashChaoCursor = 0
  const flashDeTela = (p: THREE.Vector3, forca: number) => {
    const m = flashesChao[flashChaoCursor]
    flashChaoCursor = (flashChaoCursor + 1) % POOL_FLASH_CHAO
    const raio = 6 + Math.sqrt(forca) * 5.5
    m.position.set(p.x, altura(p.x, p.z) + 0.06, p.z)
    m.scale.set(raio, raio, 1)
    m.userData.t0 = performance.now()
    m.userData.baseOp = Math.min(1, 0.55 + forca * 0.05)
    ;(m.material as THREE.MeshBasicMaterial).opacity = m.userData.baseOp
    m.visible = true
  }

  // ── METRALHADORA: rajadas de traçantes RETOS e rápidos ──────────────────
  const POOL_BALA = 24
  interface Bala { i: number; t0: number; dur: number; lado: 'buy' | 'sell'; forca: number; ultima: boolean }
  const poolBalas: THREE.Mesh[] = Array.from({ length: POOL_BALA }, () => {
    const m = new THREE.Mesh(geoRastro, matRastroCompra)
    m.visible = false
    m.userData.de = new THREE.Vector3()
    m.userData.para = new THREE.Vector3()
    semRaycast(m)
    group.add(m)
    return m
  })
  let cursorBala = 0
  const balas: Bala[] = []
  const filaRajada: Array<{ at: number; lado: 'buy' | 'sell'; z: number; forca: number; ultima: boolean }> = []
  const rajada = (lado: 'buy' | 'sell', z: number, forca: number, agora: number) => {
    const n = 3 + Math.floor(hash(Math.floor(agora) % 401, z) * 4)
    for (let k = 0; k < n; k++) {
      filaRajada.push({
        at: agora + k * (35 + hash(k, z + 1) * 20),
        lado,
        z: z + (hash(k, 11) - 0.5) * 2.4,
        forca,
        ultima: k === n - 1,
      })
    }
  }
  const disparaBala = (lado: 'buy' | 'sell', z: number, forca: number, ultima: boolean, agora: number) => {
    const s = lado === 'buy' ? 1 : -1
    const i = cursorBala
    cursorBala = (cursorBala + 1) % POOL_BALA
    const mesh = poolBalas[i]
    mesh.material = lado === 'buy' ? matRastroCompra : matRastroVenda
    mesh.visible = true
    mesh.userData.de.set(-s * (16 + hash(i, 5) * 8) + frenteX, 1.0, z)
    mesh.userData.para.set(s * (FRENTE - 1) + frenteX, 1.0, z + (hash(i, 9) - 0.5) * 1.2)
    balas.push({ i, t0: agora, dur: 85 + hash(i, 2) * 35, lado, forca, ultima })
    clarao(mesh.userData.de, 0.6, lado === 'buy' ? 0xffd9a0 : 0xffb09a)
  }

  // ── MORTEIRO PESADO: casca escura, arco alto, queda quase vertical ──────
  const geoCasca = new THREE.SphereGeometry(1, 8, 8)
  const matCascaCompra = new THREE.MeshBasicMaterial({ color: 0x3a2a1c })
  const matCascaVenda = new THREE.MeshBasicMaterial({ color: 0x2a1a1c })
  const geoRastroPesado = new THREE.BoxGeometry(0.22, 0.22, 1)
  geoRastroPesado.translate(0, 0, -0.5)
  const matRastroPCompra = new THREE.MeshBasicMaterial({
    color: 0xffcf8a, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false,
  })
  const matRastroPVenda = matRastroPCompra.clone()
  matRastroPVenda.color.setHex(0xff7a5a)
  const POOL_PESADO = 10
  interface Pesado { i: number; t0: number; dur: number; forca: number; lado: 'buy' | 'sell' }
  const poolCascas: THREE.Mesh[] = []
  const poolRastrosP: THREE.Mesh[] = []
  for (let i = 0; i < POOL_PESADO; i++) {
    const m = new THREE.Mesh(geoCasca, matCascaCompra)
    m.visible = false
    m.userData.de = new THREE.Vector3()
    m.userData.para = new THREE.Vector3()
    m.userData.prev = new THREE.Vector3()
    semRaycast(m)
    group.add(m)
    poolCascas.push(m)
    const r = new THREE.Mesh(geoRastroPesado, matRastroPCompra)
    r.visible = false
    semRaycast(r)
    group.add(r)
    poolRastrosP.push(r)
  }
  let cursorPesado = 0
  const pesados: Pesado[] = []
  const disparaPesado = (lado: 'buy' | 'sell', forca: number, de: THREE.Vector3, para: THREE.Vector3, dur: number) => {
    const i = cursorPesado
    cursorPesado = (cursorPesado + 1) % POOL_PESADO
    const mesh = poolCascas[i]
    const rastro = poolRastrosP[i]
    mesh.material = lado === 'buy' ? matCascaCompra : matCascaVenda
    rastro.material = lado === 'buy' ? matRastroPCompra : matRastroPVenda
    mesh.visible = rastro.visible = true
    mesh.scale.setScalar(0.5 + Math.sqrt(forca) * 0.16)
    mesh.userData.de.copy(de)
    mesh.userData.para.copy(para)
    mesh.userData.prev.copy(de)
    pesados.push({ i, t0: performance.now(), dur, forca, lado })
  }
  const disparaMorteiro = (lado: 'buy' | 'sell', forca: number, z: number) => {
    const s = lado === 'buy' ? 1 : -1
    const de = new THREE.Vector3(-s * (20 + hash(Math.floor(z * 3), 3) * 12) + frenteX, 1, z + (hash(Math.floor(z), 7) - 0.5) * 12)
    const para = new THREE.Vector3(s * (FRENTE + 2 + hash(Math.floor(z), 13) * 8) + frenteX, 0.8, z)
    para.y = altura(para.x, para.z) + 0.4
    disparaPesado(lado, forca, de, para, 1500 + forca * 45)
    clarao(de, 1.8 + Math.sqrt(forca) * 0.8, lado === 'buy' ? 0xffd9a0 : 0xffb09a)
    solta_fumaca(de, forca * 0.5)
  }

  // ── OFENSIVA COORDENADA: barragem, avanço do exército inteiro, recuo ────
  type FaseOfensiva = 'barragem' | 'avanco' | 'recuo'
  let ofensiva: { lado: 'buy' | 'sell'; fase: FaseOfensiva; t0: number; proxTiro: number; proxCasca: number } | null = null
  let proxOfensiva = performance.now() + 9000

  // ── TANQUES: entram quando o VOLUME REAL sobe (régua relativa ao DOG) ───
  type EstadoTanque = 'entrando' | 'combate' | 'saindo'
  interface Tanque {
    grupo: THREE.Group
    casco: THREE.Mesh
    torreGrupo: THREE.Group
    lado: 'buy' | 'sell'
    sentido: 1 | -1
    z: number
    estado: EstadoTanque
    proxTiro: number
    recuoT0: number
    mira: number
    proxPoeira: number
  }
  const geoTanqueDog = buildTankGeometry(CORES_TANQUE_DOG, 1)
  const geoTanqueUrso = buildTankGeometry(CORES_TANQUE_URSO, -1)
  const matTanque = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.15 })
  const X_TANQUE_RETAGUARDA = CAMPO_X + 24
  const X_TANQUE_COMBATE = FRENTE + 5
  const tanques: Tanque[] = []
  const criaTanque = (lado: 'buy' | 'sell'): Tanque => {
    const sentido: 1 | -1 = lado === 'buy' ? 1 : -1
    const geo = lado === 'buy' ? geoTanqueDog : geoTanqueUrso
    const casco = new THREE.Mesh(geo.casco, matTanque)
    const torreMesh = new THREE.Mesh(geo.torre, matTanque)
    const torreGrupo = new THREE.Group()
    torreGrupo.position.set(sentido * -0.3, 0.78, 0)
    torreGrupo.add(torreMesh)
    const grupo = new THREE.Group()
    grupo.add(casco, torreGrupo)
    semRaycast(casco)
    semRaycast(torreMesh)
    casco.frustumCulled = torreMesh.frustumCulled = false
    const z = (hash(performance.now() % 5003, sentido) - 0.5) * 80
    grupo.position.set(-sentido * X_TANQUE_RETAGUARDA, altura(-sentido * X_TANQUE_RETAGUARDA, z), z)
    group.add(grupo)
    return { grupo, casco, torreGrupo, lado, sentido, z, estado: 'entrando', proxTiro: performance.now() + 900, recuoT0: 0, mira: 0, proxPoeira: 0 }
  }
  const bocaTanque = new THREE.Vector3()
  const dispararTanque = (t: Tanque, agora: number) => {
    t.recuoT0 = agora
    const tipX0 = t.sentido * 2.3
    const c = Math.cos(t.mira)
    const sMira = Math.sin(t.mira)
    bocaTanque.set(
      t.grupo.position.x + t.torreGrupo.position.x + tipX0 * c,
      t.grupo.position.y + t.torreGrupo.position.y + 0.16,
      t.grupo.position.z + t.torreGrupo.position.z - tipX0 * sMira,
    )
    clarao(bocaTanque, 3.4, t.lado === 'buy' ? 0xffd9a0 : 0xffb09a)
    solta_fumaca(bocaTanque, 5)
    const alvo = new THREE.Vector3(
      t.sentido * (FRENTE + 8 + hash(Math.floor(agora) % 811, t.z) * 10) + frenteX,
      0,
      t.z + (hash(Math.floor(agora) % 433, t.z) - 0.5) * 14,
    )
    alvo.y = altura(alvo.x, alvo.z) + 0.4
    disparaPesado(t.lado, 9, bocaTanque, alvo, 950)
  }
  const esteiraPoeiraTanque = (t: Tanque, agora: number) => {
    if (agora < t.proxPoeira) return
    t.proxPoeira = agora + 70
    const jit = (hash(Math.floor(agora) % 4001, t.z) - 0.5) * 1.3
    const ladoEst = hash(Math.floor(agora / 70) % 97, t.z) < 0.5 ? 0.7 : -0.7
    vp.set(
      t.grupo.position.x - t.sentido * 1.4,
      t.grupo.position.y + 0.12,
      t.grupo.position.z + ladoEst + jit * 0.3,
    )
    emitPoeira(vp, 0.6)
  }
  const atualizaTanques = (agora: number, dt: number) => {
    for (let i = tanques.length - 1; i >= 0; i--) {
      const t = tanques[i]
      const xAlvo = t.estado === 'saindo' ? -t.sentido * X_TANQUE_RETAGUARDA : -t.sentido * X_TANQUE_COMBATE + frenteX
      const dx = xAlvo - t.grupo.position.x
      const passoT = Math.sign(dx) * Math.min(Math.abs(dx), 9 * dt)
      t.grupo.position.x += passoT
      t.grupo.position.y = altura(t.grupo.position.x, t.z) + Math.abs(Math.sin(agora * 0.006 + t.z)) * 0.03
      if (t.estado === 'entrando' && Math.abs(dx) < 0.3) t.estado = 'combate'
      if (t.estado === 'saindo' && Math.abs(dx) < 0.6) {
        group.remove(t.grupo)
        tanques.splice(i, 1)
        continue
      }
      if (Math.abs(passoT) > 0.02) esteiraPoeiraTanque(t, agora)
      t.mira += (Math.sin(agora * 0.0007 + t.z) * 0.12 - t.mira) * Math.min(1, dt * 1.5)
      t.torreGrupo.rotation.y = t.mira
      if (t.recuoT0 > 0) {
        const f = (agora - t.recuoT0) / 260
        if (f >= 1) {
          t.recuoT0 = 0
          t.casco.position.x = 0
        } else t.casco.position.x = -t.sentido * 0.45 * (1 - f) * (1 - f)
      }
      if (t.estado === 'combate' && agora > t.proxTiro) {
        t.proxTiro = agora + 3000 + hash(Math.floor(agora) % 613, t.z) * 2000
        dispararTanque(t, agora)
      }
    }
  }
  // gatilho por janela deslizante de volume, RELATIVA ao trade médio do DOG
  const JANELA_TANQUE_MS = 45000
  const registroVolume: Array<{ t: number; qty: number; lado: 'buy' | 'sell' }> = []
  const registraVolume = (tr: WarTrade) => {
    registroVolume.push({ t: performance.now(), qty: tr.qty, lado: tr.side })
    if (registroVolume.length > 500) registroVolume.shift()
  }
  let proxAvaliacaoTanque = 0
  const avaliaTanques = (agora: number) => {
    while (registroVolume.length && agora - registroVolume[0].t > JANELA_TANQUE_MS) registroVolume.shift()
    let buy = 0
    let sell = 0
    for (const r of registroVolume) {
      if (r.lado === 'buy') buy += r.qty
      else sell += r.qty
    }
    // dez trades médios concentrados em 45s já é "volume de verdade" pro DOG
    const base = Math.max(emaQty, 0.001) * 10
    const domin: 'buy' | 'sell' = buy >= sell ? 'buy' : 'sell'
    const minhaSoma = domin === 'buy' ? buy : sell
    const jaTem = tanques.some((t) => t.lado === domin && t.estado !== 'saindo')
    if (minhaSoma >= base && !jaTem && tanques.length < 2) tanques.push(criaTanque(domin))
    for (const t of tanques) {
      const soma = t.lado === 'buy' ? buy : sell
      if (t.estado !== 'saindo' && soma < base * 0.35) t.estado = 'saindo'
    }
  }

  // ── DIRETOR DE INTENSIDADE: abstrai o volume baixo do DOG ───────────────
  // ⚠️ A REGRA QUE O FUNDADOR CRAVOU: volume pequeno é a NORMA do DOG, e a
  // batalha não pode ser refém disso. Mede-se a atividade real (trades,
  // volume, churn do book) com kernel exponencial e normaliza-se contra a
  // baseline móvel de 30 min: o "normal do DOG" cai em intensidade ~0.5,
  // NUNCA zero (piso cinematográfico), e um pico real empurra pra 1 sem
  // precisar de volume absoluto alto, porque a régua é o próprio DOG.
  const LN2 = Math.log(2)
  const meiaVida = (seg: number) => seg / LN2
  const TAU_PULSO = meiaVida(180)
  const TAU_BASE = meiaVida(1800)
  const TAU_SOBE = meiaVida(4)
  const TAU_DESCE = meiaVida(14)
  let taxaTrades = 0.02
  let taxaVolume = 40
  let taxaChurn = 0.3
  let baseTrades = 0.02
  let baseVolume = 40
  let baseChurn = 0.3
  let churnPendente = 0
  let prevBidQty = 0
  let prevAskQty = 0
  let intensidade = 0.5
  let atividadeNorm = 1

  const alimentaTrade = (qty: number) => {
    taxaTrades += 1 / TAU_PULSO
    taxaVolume += qty / TAU_PULSO
  }
  const alimentaChurn = (bids: BookLevel[], asks: BookLevel[]) => {
    const bidQty = bids.slice(0, 10).reduce((s, l) => s + l.qty, 0)
    const askQty = asks.slice(0, 10).reduce((s, l) => s + l.qty, 0)
    churnPendente += Math.abs(bidQty - prevBidQty) + Math.abs(askQty - prevAskQty)
    prevBidQty = bidQty
    prevAskQty = askQty
  }
  const passoIntensidade = (dt: number) => {
    const dPulso = Math.exp(-dt / TAU_PULSO)
    taxaTrades *= dPulso
    taxaVolume *= dPulso
    taxaChurn = taxaChurn * dPulso + churnPendente / TAU_PULSO
    churnPendente = 0
    const aBase = 1 - Math.exp(-dt / TAU_BASE)
    baseTrades += (taxaTrades - baseTrades) * aBase
    baseVolume += (taxaVolume - baseVolume) * aBase
    baseChurn += (taxaChurn - baseChurn) * aBase
    const raz = (r: number, b: number) => (b > 1e-6 ? r / b : 1)
    const rTr = raz(taxaTrades, baseTrades)
    const rVol = raz(taxaVolume, baseVolume)
    const rCh = raz(taxaChurn, baseChurn)
    const media = rTr * 0.4 + rVol * 0.35 + rCh * 0.25
    const pico = Math.max(rTr, rVol, rCh)
    atividadeNorm = media * 0.7 + pico * 0.3
    const PISO = 0.4
    const K = 3
    const P = 1.3
    const pot = Math.pow(Math.max(0, atividadeNorm), P)
    const alvo = PISO + (1 - PISO) * (pot / (pot + Math.pow(K, P)))
    const tauMov = alvo > intensidade ? TAU_SOBE : TAU_DESCE
    intensidade += (alvo - intensidade) * (1 - Math.exp(-dt / tauMov))
  }

  // ── estado do mercado ───────────────────────────────────────────────────
  let book: { bids: BookLevel[]; asks: BookLevel[] } = { bids: [], asks: [] }
  let bookSujo = false
  let mid = 0
  let spanSuave = 0
  let emaQty = 0
  const filaTrades: WarTrade[] = []
  let ursosCaidos = 0
  let caesCaidos = 0
  let compra = 0
  let venda = 0
  let status: HudBatalha['status'] = 'connecting'
  let low24 = 0
  let high24 = 0
  let open24 = 0
  let feed: KrakenFeed | null = null

  const liga = () => {
    if (feed) return
    status = 'connecting'
    feed = connectKraken({
      depth: 100,
      onBook: (bids, asks) => {
        book = { bids, asks }
        bookSujo = true
      },
      onTrade: (t) => {
        filaTrades.push(t)
        registraVolume(t)
        alimentaTrade(t.qty)
        emaQty = emaQty === 0 ? t.qty : emaQty * 0.97 + t.qty * 0.03
        if (t.side === 'buy') {
          ursosCaidos += t.qty
          compra += t.qty
        } else {
          caesCaidos += t.qty
          venda += t.qty
        }
      },
      onStatus: (s) => {
        status = s
      },
    })
  }

  // o range de 24h é vivo: preço furando o low/high de agora estica a régua,
  // então o quadro se atualiza de tempos em tempos (o rebuild é no aplicaBook)
  const buscaTicker = () => {
    fetch('/api/war/ticker')
      .then((r) => r.json())
      .then((t) => {
        if (t && t.low24) {
          low24 = t.low24
          high24 = t.high24
          open24 = t.open
        }
      })
      .catch(() => {})
  }
  buscaTicker()
  const tickerTimer = setInterval(buscaTicker, 300000)

  // ── A FRENTE VIVA: o preço dentro do range de 24h É a posição da linha ──
  // ⚠️ ANTES A LINHA ERA FIXA EM x=0 e o mundo se recentrava em volta dela,
  // então ninguém conquistava terreno e a guerra parecia estática (o fundador
  // notou na hora). Agora o campo é o RANGE DE 24H: preço no low = frente
  // encostada na retaguarda dos cães, preço no high = fundo do território dos
  // ursos. A linha RASTEJA até o alvo (conquista lê como marcha, nunca
  // teleporte) e deixa cicatrizes no terreno cedido.
  let frenteX = 0
  let cicatrizAcum = 0
  const DESLOC_FRENTE = 34
  const VEL_FRENTE = 1.3
  // a régua territorial: preço → x do TERRENO (não confundir com precoParaX,
  // que espalha o book em volta da frente; esta aqui é fixa no chão)
  const xDoPreco = (p: number) => {
    const pos = Math.min(1, Math.max(0, (p - low24) / (high24 - low24)))
    return (pos - 0.5) * 2 * DESLOC_FRENTE
  }
  const frenteAlvo = () => {
    if (!(mid > 0) || !(high24 > low24)) return 0
    return xDoPreco(mid)
  }

  // ── A RÉGUA NO CHÃO: níveis de preço pintados no terreno ────────────────
  // ⚠️ SEM MARCA FIXA NO CHÃO NÃO EXISTE SENSAÇÃO DE AVANÇO (o fundador
  // cravou): a frente precisa CRUZAR alguma coisa para o olho medir a
  // conquista. Linhas em degraus redondos de preço entre o low e o high de
  // 24h, com o número de cada nível gravado no chão; a frente rasteja por
  // cima delas e cada linha cruzada é território tomado.
  const reguaGrupo = new THREE.Group()
  group.add(reguaGrupo)
  let reguaLow = 0
  let reguaHigh = 0
  const degrauRedondo = (span: number) => {
    const bruto = span / 5
    const mag = Math.pow(10, Math.floor(Math.log10(bruto)))
    const m = bruto / mag
    return (m >= 5 ? 5 : m >= 2 ? 2 : 1) * mag
  }
  const limpaRegua = () => {
    for (const filho of [...reguaGrupo.children]) {
      const mesh = filho as THREE.Mesh
      mesh.geometry?.dispose()
      const mat = mesh.material as THREE.Material | undefined
      if (mat) {
        const map = (mat as THREE.SpriteMaterial).map
        if (map) map.dispose()
        mat.dispose()
      }
      reguaGrupo.remove(filho)
    }
  }
  const constroiRegua = () => {
    limpaRegua()
    reguaLow = low24
    reguaHigh = high24
    const passo = degrauRedondo(high24 - low24)
    const precos: number[] = [low24]
    for (let p = Math.ceil(low24 / passo) * passo; p < high24 - passo * 0.25; p += passo) {
      if (p > low24 + passo * 0.25) precos.push(p)
    }
    precos.push(high24)
    const partes: THREE.BufferGeometry[] = []
    for (const p of precos) {
      const x = xDoPreco(p)
      const extremo = p === low24 || p === high24
      for (let s = 0; s < 20; s++) {
        const z0 = -62 + s * 6.2
        const z1 = z0 + 6.2
        const y0 = altura(x, z0) + 0.12
        const y1 = altura(x, z1) + 0.12
        const g = new THREE.BoxGeometry(extremo ? 0.7 : 0.4, 0.05, Math.hypot(6.2, y1 - y0))
        g.rotateX(Math.atan2(y1 - y0, 6.2))
        g.translate(x, (y0 + y1) / 2, (z0 + z1) / 2)
        partes.push(g)
      }
      const et = etiqueta(fmtPreco(p))
      et.scale.set(10, 1.9, 1)
      ;(et.material as THREE.SpriteMaterial).opacity = 0.75
      et.position.set(x, altura(x, 58) + 1.7, 58)
      semRaycast(et)
      reguaGrupo.add(et)
    }
    const geoRegua = mergeGeometries(partes, false)!
    partes.forEach((g) => g.dispose())
    const linhas = new THREE.Mesh(geoRegua, new THREE.MeshBasicMaterial({
      color: 0xcabfa8, transparent: true, opacity: 0.3, depthWrite: false,
    }))
    semRaycast(linhas)
    linhas.frustumCulled = false
    reguaGrupo.add(linhas)
  }

  // ── book vira fileiras ──────────────────────────────────────────────────
  const m4 = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const eu = new THREE.Euler()
  const vp = new THREE.Vector3()
  const vs = new THREE.Vector3()

  const precoParaX = (preco: number) => {
    if (!(mid > 0) || !(spanSuave > 0)) return 0
    const d = ((preco - mid) / spanSuave) * (CAMPO_X - FRENTE)
    const s = Math.sign(d)
    // o book inteiro acompanha a frente: os exércitos marcham junto da linha
    return s * Math.min(Math.abs(d) + FRENTE, CAMPO_X + 14) + frenteX
  }

  const montaExercito = (ex: Exercito, niveis: BookLevel[], lado: 1 | -1, qMediana: number) => {
    let i = 0
    for (let li = 0; li < niveis.length && i < orc.cap; li++) {
      const nv = niveis[li]
      const x0 = precoParaX(nv.price)
      const unidades = Math.min(96, Math.max(1, Math.round(6 * Math.sqrt(nv.qty / qMediana))))
      for (let u = 0; u < unidades && i < orc.cap; u++) {
        const fila = Math.floor(u / 12)
        const col = u % 12
        const jx = (hash(li * 31 + u, 7) - 0.5) * 0.7
        const jz = (hash(li * 17 + u, 13) - 0.5) * 0.9
        const px = x0 + lado * (fila * 1.5 + jx)
        const pz = (col - 5.5) * 1.45 + (fila % 2) * 0.7 + jz
        ex.alvo[i * 3] = px
        ex.alvo[i * 3 + 1] = altura(px, pz) + 0.05
        ex.alvo[i * 3 + 2] = pz
        i++
      }
    }
    ex.n = i
    ex.mesh.count = i
    if (ex.primeira) {
      // na primeira formação ninguém atravessa o mapa: as tropas nascem em posto
      ex.primeira = false
      ex.cur.set(ex.alvo.subarray(0, i * 3))
      for (let k = 0; k < i; k++) {
        vp.set(ex.cur[k * 3], ex.cur[k * 3 + 1], ex.cur[k * 3 + 2])
        vs.setScalar(ex.esc[k])
        eu.set(0, ex.rot[k], 0)
        q.setFromEuler(eu)
        m4.compose(vp, q, vs)
        ex.mesh.setMatrixAt(k, m4)
      }
      ex.mesh.instanceMatrix.needsUpdate = true
    }
  }

  const marcha = (ex: Exercito, dt: number, agora: number) => {
    let mexeu = false
    for (let i = 0; i < ex.n; i++) {
      const ix = i * 3
      const dx = ex.alvo[ix] - ex.cur[ix]
      const dz = ex.alvo[ix + 2] - ex.cur[ix + 2]
      const d = Math.hypot(dx, dz)
      const dy = ex.alvo[ix + 1] - ex.cur[ix + 1]
      if (d < 0.04 && Math.abs(dy) < 0.02) continue
      if (d >= 0.04) {
        const passo = Math.min(d, 7 * dt)
        ex.cur[ix] += (dx / d) * passo
        ex.cur[ix + 2] += (dz / d) * passo
      } else {
        ex.cur[ix] = ex.alvo[ix]
        ex.cur[ix + 2] = ex.alvo[ix + 2]
      }
      ex.cur[ix + 1] += dy * Math.min(1, 5 * dt)
      // bob de passada só em quem está andando: a passada vende a marcha
      const bob = d >= 0.04 ? Math.abs(Math.sin(agora * 0.012 + ex.fase[i] * 6.283)) * 0.12 : 0
      vp.set(ex.cur[ix], ex.cur[ix + 1] + bob, ex.cur[ix + 2])
      vs.setScalar(ex.esc[i])
      eu.set(0, ex.rot[i], 0)
      q.setFromEuler(eu)
      m4.compose(vp, q, vs)
      ex.mesh.setMatrixAt(i, m4)
      mexeu = true
    }
    if (mexeu) ex.mesh.instanceMatrix.needsUpdate = true
  }

  const aplicaBook = () => {
    const bids = book.bids.slice(0, orc.niveis)
    const asks = book.asks.slice(0, orc.niveis)
    if (!bids.length || !asks.length) return
    alimentaChurn(bids, asks)
    mid = (bids[0].price + asks[0].price) / 2
    const alcance = Math.max(
      bids.length ? mid - bids[bids.length - 1].price : 0,
      asks.length ? asks[asks.length - 1].price - mid : 0,
    )
    spanSuave = spanSuave === 0 ? alcance : spanSuave * 0.92 + alcance * 0.08
    const todas = [...bids, ...asks].map((l) => l.qty).sort((a, b) => a - b)
    const qMediana = todas[Math.floor(todas.length / 2)] || 1
    montaExercito(exCaes, bids, -1, qMediana)
    montaExercito(exUrsos, asks, 1, qMediana)

    if (low24 > 0 && high24 > low24 && mid > 0) {
      // régua e obeliscos vivem na MESMA escala territorial da frente: os
      // obeliscos cravam as pontas do range e a régua os degraus entre eles
      const mudou = reguaLow === 0
        || Math.abs(low24 - reguaLow) / reguaLow > 0.005
        || Math.abs(high24 - reguaHigh) / reguaHigh > 0.005
      if (mudou) {
        constroiRegua()
        if (etLow) {
          for (const sp of [etLow, etHigh!]) {
            const m = sp.material as THREE.SpriteMaterial
            m.map?.dispose()
            m.dispose()
            group.remove(sp)
          }
          etLow = etHigh = null
        }
      }
      obLow.visible = obHigh.visible = true
      obLow.position.x = xDoPreco(low24)
      obHigh.position.x = xDoPreco(high24)
      obLow.position.z = -58
      obHigh.position.z = -58
      obLow.position.y = altura(obLow.position.x, -58) + 4.5
      obHigh.position.y = altura(obHigh.position.x, -58) + 4.5
      if (!etLow) {
        etLow = etiqueta(`24H LOW ${fmtPreco(low24)}`)
        etHigh = etiqueta(`24H HIGH ${fmtPreco(high24)}`)
        group.add(etLow, etHigh!)
      }
      etLow.position.set(obLow.position.x, 11.4, -58)
      etHigh!.position.set(obHigh.position.x, 11.4, -58)
    }
  }

  // ── trades viram disparos ───────────────────────────────────────────────
  const LIMIAR_BALEIA = 16
  const atira = (lado0: 'buy' | 'sell', qty: number, forca: number, zAlvo: number, sem: number) => {
    const lado = lado0 === 'buy' ? 1 : -1
    const i = cursorTiro
    cursorTiro = (cursorTiro + 1) % POOL_TIROS
    const mesh = poolTiros[i]
    const rastro = poolRastros[i]
    mesh.material = lado0 === 'buy' ? matTiroCompra : matTiroVenda
    rastro.material = lado0 === 'buy' ? matRastroCompra : matRastroVenda
    mesh.visible = rastro.visible = true
    mesh.scale.setScalar(0.22 * Math.sqrt(forca) + 0.12)
    mesh.userData.de.set(-lado * (14 + hash(sem % 31, 3) * 30) + frenteX, 1.2, zAlvo + (hash(sem % 13, 5) - 0.5) * 30)
    mesh.userData.para.set(lado * (FRENTE + hash(sem % 7, 11) * 6) + frenteX, 0.8, zAlvo)
    mesh.userData.prev.copy(mesh.userData.de)
    tiros.push({ i, t0: performance.now(), dur: 750 + 350 * Math.min(3, forca / 8), forca, lado: lado0, qty })
    // artilharia anuncia o disparo: clarão de boca + baforada na origem
    if (forca > 2) {
      clarao(mesh.userData.de, 1.6 + Math.sqrt(forca), lado0 === 'buy' ? 0xffd9a0 : 0xffb09a)
      solta_fumaca(mesh.userData.de, forca * 0.6)
    }
  }

  const dispara = (t: WarTrade) => {
    const forca = Math.min(40, Math.max(0.4, emaQty > 0 ? t.qty / emaQty : 1))
    const zAlvo = (hash(t.at % 997, t.qty) - 0.5) * 90
    // ⚠️ BALEIA É BOMBARDEIO, não bola única: trade grande vira salva de tiros
    // espaçados no tempo, e a tela conta a história do tamanho dele
    if (forca >= 8) {
      const k = Math.min(9, 2 + Math.round(forca / 5))
      for (let s = 0; s < k; s++) {
        salva.push({
          at: performance.now() + s * (110 + hash(s, t.at % 89) * 130),
          lado: t.side,
          qty: t.qty / k,
          forca: Math.max(2, (forca / k) * 1.8),
          z: zAlvo + (hash(s, 17) - 0.5) * 26,
        })
      }
    } else {
      atira(t.side, t.qty, forca, zAlvo, t.at)
    }
    if (forca > LIMIAR_BALEIA && onWhale) onWhale(t.side, forca)
  }

  const impacto = (p: THREE.Vector3, forca: number, lado: 'buy' | 'sell', qty: number) => {
    if (qty > 0) mostraDano(p, qty, lado)
    const cor = lado === 'buy' ? 0xffa64d : 0xff5238
    const mesh = poolOndas[cursorOnda]
    cursorOnda = (cursorOnda + 1) % poolOndas.length
    mesh.material = lado === 'buy' ? matOndaCompra : matOndaVenda
    mesh.visible = true
    mesh.position.copy(p).setY(0.25)
    let luz: THREE.PointLight | null = null
    if (forca > 2 || cursorOnda % 3 === 0) {
      luz = poolLuzes[cursorLuz]
      cursorLuz = (cursorLuz + 1) % poolLuzes.length
      luz.color.setHex(cor)
      luz.position.copy(p).setY(2.5)
      luz.intensity = 30 * Math.min(6, forca)
    }
    ondas.push({ mesh, luz, t0: performance.now(), forca })

    const sp = flashPool[flashCursor]
    flashCursor = (flashCursor + 1) % POOL_FLASH
    ;(sp.material as THREE.SpriteMaterial).color.setHex(lado === 'buy' ? 0xffe1b0 : 0xffb0a0)
    sp.position.copy(p).setY(1.5)
    sp.userData.base = 2.4 + Math.sqrt(forca) * 2
    sp.scale.setScalar(sp.userData.base)
    ;(sp.material as THREE.SpriteMaterial).opacity = 1
    sp.visible = true
    sp.userData.t0 = performance.now()

    emitPoeira(p, forca)
    emitFaiscas(p, forca)
    marcaCicatriz(p, forca)
    if (forca > 0.5) {
      explodeBola(p, forca)
      flashDeTela(p, forca)
    }
    if (forca > 2) solta_fumaca(p, forca)
    if (forca > 3) {
      colunaDeFogo(p, forca)
      emitDestrocos(p, forca)
      opcoes.onImpactoGrande?.(forca)
    }
    if (lado === 'buy') tomba(detritoUrsos, curUrsos, p, Math.min(14, 1 + Math.round(forca)))
    else tomba(detritoCaes, curCaes, p, Math.min(14, 1 + Math.round(forca)))
  }

  // ── o pulso ─────────────────────────────────────────────────────────────
  let ultimoBook = 0
  let ultimoUpdate = 0
  let ultimaEscaramuca = 0
  let proxArtilharia = 0
  let proxCanhao = 0
  const passo = new THREE.Vector3()
  const zEixo = new THREE.Vector3(0, 0, 1)

  const update = (agora: number) => {
    const dt = ultimoUpdate > 0 ? Math.min(0.05, (agora - ultimoUpdate) / 1000) : 0.016
    ultimoUpdate = agora
    passoIntensidade(dt)

    // ── a frente rasteja até onde o preço manda ──────────────────────────
    {
      const dF = frenteAlvo() - frenteX
      if (Math.abs(dF) > 0.002) {
        const passoF = Math.sign(dF) * Math.min(Math.abs(dF), VEL_FRENTE * dt)
        frenteX += passoF
        // o terreno cedido guarda a memória: cicatrizes na linha abandonada
        cicatrizAcum += Math.abs(passoF)
        if (cicatrizAcum > 1.6) {
          cicatrizAcum = 0
          vp.set(
            frenteX - Math.sign(passoF) * (1 + hash(Math.floor(agora) % 257, 3) * 4),
            0,
            (hash(Math.floor(agora) % 641, 9) - 0.5) * 100,
          )
          vp.y = altura(vp.x, vp.z)
          marcaCicatriz(vp, 0.5 + hash(Math.floor(agora) % 83, 5) * 1.2)
        }
        const dyF = altura(frenteX, 0) - altura(0, 0)
        if (costuraMesh) costuraMesh.position.set(frenteX, dyF, 0)
        neblina.position.x = frenteX
        neblina.position.y = 0.55 + dyF
        if (brasasPts) brasasPts.position.set(frenteX, dyF, 0)
        if (luzFrente) luzFrente.position.x = frenteX
        bookSujo = true
      }
    }
    if (bookSujo && agora - ultimoBook > 250) {
      bookSujo = false
      ultimoBook = agora
      aplicaBook()
    }

    let drenados = 0
    while (drenados < filaTrades.length && drenados < orc.maxOndas) {
      dispara(filaTrades[drenados])
      drenados++
    }
    if (drenados > 0) filaTrades.splice(0, drenados)

    for (let i = tiros.length - 1; i >= 0; i--) {
      const t = tiros[i]
      const mesh = poolTiros[t.i]
      const rastro = poolRastros[t.i]
      const f = (agora - t.t0) / t.dur
      if (f >= 1) {
        impacto(mesh.userData.para, t.forca, t.lado, t.qty)
        mesh.visible = rastro.visible = false
        tiros.splice(i, 1)
        continue
      }
      mesh.position.lerpVectors(mesh.userData.de, mesh.userData.para, f)
      mesh.position.y = 1 + Math.sin(f * Math.PI) * (6 + Math.min(18, t.forca))
      passo.subVectors(mesh.position, mesh.userData.prev)
      const dist = passo.length()
      if (dist > 0.0005) rastro.quaternion.setFromUnitVectors(zEixo, passo.normalize())
      rastro.position.copy(mesh.position)
      rastro.scale.set(mesh.scale.x * 0.55, mesh.scale.x * 0.55, Math.max(1.2, dist * 16 + t.forca * 0.35))
      mesh.userData.prev.copy(mesh.position)
    }

    for (let i = ondas.length - 1; i >= 0; i--) {
      const o = ondas[i]
      const f = (agora - o.t0) / 650
      if (f >= 1) {
        o.mesh.visible = false
        if (o.luz) o.luz.intensity = 0
        ondas.splice(i, 1)
        continue
      }
      o.mesh.scale.setScalar(1 + f * (3 + Math.sqrt(o.forca) * 2.2))
      ;(o.mesh.material as THREE.MeshBasicMaterial).opacity = 1 - f
      if (o.luz) o.luz.intensity = 30 * Math.min(6, o.forca) * (1 - f)
    }

    for (const sp of flashPool) {
      if (!sp.visible) continue
      const k = (agora - sp.userData.t0) / 130
      if (k >= 1) {
        sp.visible = false
        continue
      }
      sp.scale.setScalar(sp.userData.base * (1 + k * 0.6))
      ;(sp.material as THREE.SpriteMaterial).opacity = 1 - k
    }

    for (let i = 0; i < orc.poeiraMax; i++) {
      if (!poeiraViva[i]) continue
      const dt = (agora - poeiraT0[i]) / 1000
      if (dt > 1.3) {
        poeiraViva[i] = 0
        poeiraPos[i * 3 + 1] = -999
        continue
      }
      poeiraVel[i * 3 + 1] -= 0.038
      poeiraPos[i * 3] += poeiraVel[i * 3] * 0.016
      poeiraPos[i * 3 + 1] += poeiraVel[i * 3 + 1] * 0.016
      poeiraPos[i * 3 + 2] += poeiraVel[i * 3 + 2] * 0.016
    }
    geoPoeira.attributes.position.needsUpdate = true

    for (let i = 0; i < orc.faiscaMax; i++) {
      if (!faiscaViva[i]) continue
      const dt = (agora - faiscaT0[i]) / 1000
      if (dt > 0.45) {
        faiscaViva[i] = 0
        continue
      }
      faiscaVel[i * 3 + 1] -= 0.15
      const hx = faiscaPos[i * 6]
      const hy = faiscaPos[i * 6 + 1]
      const hz = faiscaPos[i * 6 + 2]
      faiscaPos[i * 6] = hx + faiscaVel[i * 3] * 0.016
      faiscaPos[i * 6 + 1] = hy + faiscaVel[i * 3 + 1] * 0.016
      faiscaPos[i * 6 + 2] = hz + faiscaVel[i * 3 + 2] * 0.016
      faiscaPos[i * 6 + 3] = hx
      faiscaPos[i * 6 + 4] = hy
      faiscaPos[i * 6 + 5] = hz
    }
    geoFaisca.attributes.position.needsUpdate = true

    for (const m of cicatrizes) {
      if (!m.visible) continue
      const f = (agora - m.userData.t0) / 12000
      if (f >= 1) {
        m.visible = false
        continue
      }
      ;(m.material as THREE.MeshBasicMaterial).opacity = 0.75 * (1 - f)
    }

    for (let i = tombos.length - 1; i >= 0; i--) {
      const t = tombos[i]
      const f = Math.min(1, (agora - t.t0) / 380)
      q.slerpQuaternions(qZero, t.para, f * f)
      vs.setScalar(t.esc)
      vp.set(t.x, t.y + 0.05 - 0.12 * f, t.z)
      m4.compose(vp, q, vs)
      t.mesh.setMatrixAt(t.idx, m4)
      t.mesh.instanceMatrix.needsUpdate = true
      if (f >= 1) tombos.splice(i, 1)
    }

    // ── ESCARAMUÇA CONSTANTE: a referência (bitcoin-warfront) nunca para de
    // atirar porque BTC tem dezenas de trades por segundo. DOG não tem, então
    // as linhas trocam fogo de fuzilaria por conta própria (qty 0: não conta
    // baixa no placar nem letreiro, é o rugido de fundo da guerra), e a
    // CADÊNCIA acompanha a pressão: mais compra, mais fogo do lado dos cães.
    // ── A DIREÇÃO DA BATALHA: as cadências saem da INTENSIDADE, não de timer
    // fixo. Piso cinematográfico em calmaria, tempestade quando o DOG acorda.
    if (mid > 0) {
      const press = matCostura.uniforms.pressao.value
      // metralhadora em rajadas: ~2 rajadas/s no piso, ~6/s no pico
      const rajadaHz = 1.4 + 4.6 * Math.pow(intensidade, 1.4)
      if (agora - ultimaEscaramuca > (1000 / rajadaHz) * (0.7 + hash(Math.floor(agora) % 577, 3) * 0.6)) {
        ultimaEscaramuca = agora
        const lado: 'buy' | 'sell' = hash(Math.floor(agora) % 691, 9) < press ? 'buy' : 'sell'
        rajada(lado, (hash(Math.floor(agora) % 1213, 5) - 0.5) * 100, 0.9 + hash(Math.floor(agora) % 331, 7) * 1.7, agora)
      }
      // morteiros pesados: sempre tem casca no ar (~28/min no piso, 48 no pico)
      const morteiroPorMin = 16 + 32 * Math.pow(intensidade, 1.6)
      if (agora > proxArtilharia) {
        proxArtilharia = agora + (60000 / morteiroPorMin) * (0.55 + hash(Math.floor(agora) % 449, 11) * 0.9)
        const lado = hash(Math.floor(agora) % 863, 13) < press ? 'buy' : 'sell'
        disparaMorteiro(lado, 4 + intensidade * 5, (hash(Math.floor(agora) % 1069, 19) - 0.5) * 105)
      }
      // canhões de teatro: um PAR de tiros parabólicos simultâneos de tempos em
      // tempos (qty 0: sem placar), pra sempre haver mais de uma arma na cena
      if (agora > proxCanhao) {
        proxCanhao = agora + (7500 - intensidade * 3500) + hash(Math.floor(agora) % 719, 17) * 4000
        const lado: 'buy' | 'sell' = hash(Math.floor(agora) % 523, 29) < press ? 'buy' : 'sell'
        const zC = (hash(Math.floor(agora) % 1327, 31) - 0.5) * 95
        atira(lado, 0, 3 + hash(Math.floor(agora) % 271, 37) * 2.5, zC, Math.floor(agora) % 9973)
        atira(lado, 0, 2.5 + hash(Math.floor(agora) % 199, 41) * 2, zC + 14 + hash(Math.floor(agora) % 157, 43) * 18, Math.floor(agora) % 7919)
      }
      // ofensiva coordenada: barragem + avanço do exército inteiro + recuo
      if (!ofensiva && agora > proxOfensiva) {
        const lado: 'buy' | 'sell' = hash(Math.floor(agora) % 941, 23) < press ? 'buy' : 'sell'
        ofensiva = { lado, fase: 'barragem', t0: agora, proxTiro: agora, proxCasca: agora }
      }
      // tanques: avaliação barata a cada 1.4s
      if (agora > proxAvaliacaoTanque) {
        proxAvaliacaoTanque = agora + 1400
        avaliaTanques(agora)
      }
    }
    if (ofensiva) {
      const idade = agora - ofensiva.t0
      const alvoMesh = ofensiva.lado === 'buy' ? caes : ursos
      const sinal = ofensiva.lado === 'buy' ? -1 : 1
      if (ofensiva.fase === 'barragem') {
        if (agora > ofensiva.proxTiro) {
          ofensiva.proxTiro = agora + 160 + hash(Math.floor(agora) % 233, 3) * 100
          rajada(ofensiva.lado, (hash(Math.floor(agora) % 811, 5) - 0.5) * 100, 1.6, agora)
        }
        // a barragem é de CASCA, não só de bala: morteiros encadeados são o
        // que faz a ofensiva ler como ofensiva a qualquer distância
        if (agora > ofensiva.proxCasca) {
          ofensiva.proxCasca = agora + 380 + hash(Math.floor(agora) % 149, 7) * 180
          disparaMorteiro(ofensiva.lado, 5 + intensidade * 3.5, (hash(Math.floor(agora) % 977, 11) - 0.5) * 95)
        }
        if (idade > 3200) {
          ofensiva.fase = 'avanco'
          ofensiva.t0 = agora
        }
      } else if (ofensiva.fase === 'avanco') {
        const f = Math.min(1, idade / 900)
        alvoMesh.position.x = sinal * -2.6 * Math.sin(f * Math.PI)
        if (f >= 1) {
          ofensiva.fase = 'recuo'
          ofensiva.t0 = agora
        }
      } else {
        const f = Math.min(1, idade / 700)
        alvoMesh.position.x *= 1 - f
        if (f >= 1) {
          alvoMesh.position.x = 0
          ofensiva = null
          proxOfensiva = agora + 9000 + hash(Math.floor(agora) % 601, 7) * 6000
        }
      }
    }
    atualizaTanques(agora, dt)

    // rajadas agendadas e balas retas em voo
    for (let i = filaRajada.length - 1; i >= 0; i--) {
      if (filaRajada[i].at <= agora) {
        const r = filaRajada[i]
        disparaBala(r.lado, r.z, r.forca, r.ultima, agora)
        filaRajada.splice(i, 1)
      }
    }
    for (let i = balas.length - 1; i >= 0; i--) {
      const b = balas[i]
      const mesh = poolBalas[b.i]
      const f = (agora - b.t0) / b.dur
      if (f >= 1) {
        mesh.visible = false
        if (b.ultima) impacto(mesh.userData.para, b.forca, b.lado, 0)
        else {
          emitFaiscas(mesh.userData.para, 0.6)
          marcaCicatriz(mesh.userData.para, 0.4)
        }
        balas.splice(i, 1)
        continue
      }
      mesh.position.lerpVectors(mesh.userData.de, mesh.userData.para, f)
      passo.subVectors(mesh.userData.para, mesh.userData.de)
      if (passo.lengthSq() > 0.001) mesh.quaternion.setFromUnitVectors(zEixo, passo.normalize())
      mesh.scale.set(0.16, 0.16, 2.6)
    }

    // morteiros pesados: sobem alto e caem quase na vertical
    for (let i = pesados.length - 1; i >= 0; i--) {
      const mt = pesados[i]
      const mesh = poolCascas[mt.i]
      const rastro = poolRastrosP[mt.i]
      const f = (agora - mt.t0) / mt.dur
      if (f >= 1) {
        mesh.visible = rastro.visible = false
        impacto(mesh.userData.para, mt.forca * 1.6, mt.lado, 0)
        marcaCicatriz(mesh.userData.para, mt.forca * 1.8)
        pesados.splice(i, 1)
        continue
      }
      mesh.position.lerpVectors(mesh.userData.de, mesh.userData.para, f)
      const subida = f < 0.62 ? Math.sin((f / 0.62) * Math.PI * 0.5) : 1
      const queda = f > 0.62 ? Math.pow(1 - (f - 0.62) / 0.38, 2) : 1
      mesh.position.y = 1 + subida * queda * (14 + Math.min(16, mt.forca) * 1.2)
      passo.subVectors(mesh.position, mesh.userData.prev)
      const distP = passo.length()
      if (distP > 0.0005) rastro.quaternion.setFromUnitVectors(zEixo, passo.normalize())
      rastro.position.copy(mesh.position)
      rastro.scale.set(0.9, 0.9, Math.max(1.6, distP * 14))
      mesh.userData.prev.copy(mesh.position)
    }

    // bolas de fogo bifásicas
    for (const sp of bolasFogo) {
      if (!sp.visible) continue
      const f = (agora - sp.userData.t0) / sp.userData.dur
      if (f >= 1) {
        sp.visible = false
        continue
      }
      const mat = sp.material as THREE.SpriteMaterial
      if (f < 0.42) {
        const k = f / 0.42
        sp.scale.setScalar(sp.userData.base * (0.3 + k * 0.9))
        mat.blending = THREE.AdditiveBlending
        mat.color.setRGB(1, 1 - k * 0.35, 1 - k * 0.75)
        mat.opacity = 1
      } else {
        const k = (f - 0.42) / 0.58
        sp.scale.setScalar(sp.userData.base * (1.2 + k * 1.6))
        mat.blending = THREE.NormalBlending
        mat.color.setRGB(0.35 - k * 0.2, 0.28 - k * 0.15, 0.22 - k * 0.12)
        mat.opacity = 0.65 * (1 - k)
        sp.position.y += 1.1 * dt
      }
    }

    // colunas de fogo
    for (const sp of colunas) {
      if (!sp.visible) continue
      const f = (agora - sp.userData.t0) / 900
      if (f >= 1) {
        sp.visible = false
        continue
      }
      const mat = sp.material as THREE.SpriteMaterial
      const subida = Math.min(1, f / 0.35)
      const h = sp.userData.altura * (0.25 + subida * 0.75) * (1 - Math.max(0, f - 0.6) * 1.6)
      sp.position.set(
        sp.userData.x + Math.sin(agora * 0.02 + sp.userData.seed * 10) * 0.15,
        sp.userData.baseY + h / 2,
        sp.userData.z,
      )
      sp.scale.set(sp.userData.largura * (1 - f * 0.25), Math.max(0.3, h), 1)
      mat.color.setRGB(1, 0.75 - f * 0.35, Math.max(0, 0.3 - f * 0.28))
      mat.opacity = f < 0.7 ? 1 : (1 - f) / 0.3
      if (f > 0.9 && !sp.userData.fumou) {
        sp.userData.fumou = true
        vp.set(sp.userData.x, sp.userData.baseY + sp.userData.altura, sp.userData.z)
        solta_fumaca(vp, sp.userData.forca)
      }
    }

    // destroços em arco balístico
    for (const d of destrocos) {
      if (!d.viva) continue
      const tv = (agora - d.t0) / 1000
      if (tv > 1.1) {
        d.viva = false
        d.m.visible = false
        continue
      }
      d.vy -= 9.2 * dt
      d.m.position.x += d.vx * dt
      d.m.position.y += d.vy * dt
      d.m.position.z += d.vz * dt
      const piso = altura(d.m.position.x, d.m.position.z)
      if (d.m.position.y <= piso + 0.05) {
        d.m.position.y = piso + 0.05
        marcaCicatriz(d.m.position, 0.6)
        d.viva = false
        d.m.visible = false
        continue
      }
      passo.set(d.vx, d.vy, d.vz).normalize()
      d.m.quaternion.setFromUnitVectors(zEixo, passo)
      const k = Math.min(1, tv / 1.1)
      const matD = d.m.material as THREE.MeshBasicMaterial
      matD.color.setRGB(1, 0.94 - k * 0.7, Math.max(0, 0.75 - k * 0.75))
      matD.opacity = 1 - k * 0.3
    }

    // flashes de chão
    for (const m of flashesChao) {
      if (!m.visible) continue
      const f = (agora - m.userData.t0) / 220
      if (f >= 1) {
        m.visible = false
        continue
      }
      ;(m.material as THREE.MeshBasicMaterial).opacity = m.userData.baseOp * (1 - f) * (1 - f)
    }

    // salva de baleia: os tiros agendados saem na hora deles
    for (let i = salva.length - 1; i >= 0; i--) {
      if (salva[i].at <= agora) {
        const s = salva[i]
        atira(s.lado, s.qty, s.forca, s.z, Math.floor(s.at))
        salva.splice(i, 1)
      }
    }

    // a marcha dos exércitos: o movimento que o book comanda
    marcha(exCaes, dt, agora)
    marcha(exUrsos, dt, agora)

    // duelos de vanguarda
    for (const d of duelos) {
      const idade = agora - d.t0
      if (d.fase === 'espera') {
        if (agora >= d.t0) {
          d.z = (hash(Math.floor(agora) % 977, d.t0 % 131) - 0.5) * 108
          d.fase = 'corre'
          d.t0 = agora
          d.cao.visible = d.urso.visible = true
          d.cao.rotation.set(0, 0, 0)
          d.urso.rotation.set(0, 0, 0)
        }
      } else if (d.fase === 'corre') {
        const f = Math.min(1, idade / 1500)
        const xc = frenteX - X_DUELO + (X_DUELO - 1.7) * f
        const xu = frenteX + X_DUELO - (X_DUELO - 1.7) * f
        const galope = Math.abs(Math.sin(f * 26 + d.z)) * 0.3
        d.cao.position.set(xc, altura(xc, d.z) + galope, d.z)
        d.urso.position.set(xu, altura(xu, d.z) + galope * 0.8, d.z)
        if (f >= 1) {
          d.fase = 'choque'
          d.t0 = agora
          // ⚠️ o teatro conta a verdade: quem tem PRESSÃO real ganha mais
          d.vence = hash(Math.floor(agora) % 883, 7) < matCostura.uniforms.pressao.value ? 'buy' : 'sell'
          vp.set(frenteX, altura(frenteX, d.z) + 0.6, d.z)
          emitFaiscas(vp, 4)
          emitPoeira(vp, 3)
        }
      } else if (d.fase === 'choque') {
        const f = Math.min(1, idade / 420)
        const perdedor = d.vence === 'buy' ? d.urso : d.cao
        const ganhador = d.vence === 'buy' ? d.cao : d.urso
        perdedor.rotation.x = (d.vence === 'buy' ? -1 : 1) * (Math.PI / 2) * f * f
        ganhador.position.y = altura(ganhador.position.x, d.z) + Math.abs(Math.sin(f * Math.PI * 2)) * 0.5
        if (f >= 1) {
          d.fase = 'retirada'
          d.t0 = agora
        }
      } else {
        const f = Math.min(1, idade / 1300)
        const ganhador = d.vence === 'buy' ? d.cao : d.urso
        const perdedor = d.vence === 'buy' ? d.urso : d.cao
        const volta = d.vence === 'buy' ? -1 : 1
        const gx = frenteX + volta * (1.7 + (X_DUELO - 1.7) * f)
        ganhador.position.set(gx, altura(gx, d.z) + Math.abs(Math.sin(f * 22)) * 0.28, d.z)
        perdedor.position.y -= 0.9 * dt
        if (f >= 1) {
          d.cao.visible = d.urso.visible = false
          d.fase = 'espera'
          d.t0 = agora + 700 + hash(Math.floor(agora) % 71, 3) * 2400
        }
      }
    }

    // fumaça: nasce, incha, sobe à deriva e some em ~4s
    for (const sp of fumacas) {
      if (!sp.visible) continue
      const f = (agora - sp.userData.t0) / 4200
      if (f >= 1) {
        sp.visible = false
        continue
      }
      sp.position.y += 1.4 * dt
      sp.position.x += sp.userData.jit * 0.6 * dt
      sp.scale.setScalar(sp.userData.base * (1 + f * 2.2))
      ;(sp.material as THREE.SpriteMaterial).opacity = f < 0.12 ? (f / 0.12) * 0.55 : 0.55 * (1 - (f - 0.12) / 0.88)
    }

    // letreiros de dano sobem e somem
    for (const t of textos) {
      if (!t.sp.visible) continue
      const f = (agora - t.sp.userData.t0) / 1250
      if (f >= 1) {
        t.sp.visible = false
        continue
      }
      t.sp.position.y += 3.4 * dt
      ;(t.sp.material as THREE.SpriteMaterial).opacity = f < 0.15 ? f / 0.15 : 1 - (f - 0.15) / 0.85
    }

    const seg = agora * 0.001
    if (shaderCaes) shaderCaes.uniforms.uTime.value = seg
    if (shaderUrsos) shaderUrsos.uniforms.uTime.value = seg
    if (matBrasas) matBrasas.uniforms.time.value = seg
    matNev.uniforms.time.value = seg
    matCostura.uniforms.time.value = seg
    const total = compra + venda
    const alvoPress = total > 0 ? compra / total : 0.5
    matCostura.uniforms.pressao.value += (alvoPress - matCostura.uniforms.pressao.value) * 0.05
  }

  return {
    group,
    update,
    setLive: (on: boolean) => {
      if (on) liga()
      else if (feed) {
        feed.stop()
        feed = null
        status = 'down'
      }
    },
    hud: () => ({
      preco: mid, low24, high24, open24, status,
      ursosCaidos, caesCaidos, compra, venda,
    }),
    dispose: () => {
      clearInterval(tickerTimer)
      if (feed) feed.stop()
      group.traverse((obj) => {
        const g = (obj as THREE.Mesh).geometry
        if (g) g.dispose()
        const mat = (obj as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
        else if (mat) {
          const map = (mat as THREE.SpriteMaterial).map
          if (map) map.dispose()
          mat.dispose()
        }
      })
    },
  }
}
