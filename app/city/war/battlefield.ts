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
import { buildCanhaoGeometry, buildBombardeiroGeometry, BOCA_CANHAO_DIST } from './arsenal'
import { createExplosionLibrary } from './explosions'
import {
  buildCavaleiroGeometry,
  buildHelicopteroGeometry,
  buildJipeGeometry,
  ALTURA_ROTOR,
  HELI_ROTOR_X,
  HELI_ROTOR_Z,
  HELI_CAUDA_X,
  HELI_CAUDA_Y,
  HELI_CAUDA_Z,
  PONTA_ARMA_HELI,
  JIPE_PIVO_ARMA_X,
  JIPE_PIVO_ARMA_Y,
  BOCA_ARMA_JIPE,
} from './vehicles'
import {
  buildAntiAereaGeometry,
  BOCA_AA_DIST,
  buildNinhoGeometry,
  BOCA_MG_DIST,
  buildTrincheiraGeometry,
} from './emplacements'

export const CAMPO_X = 88
export const FRENTE = 7

// ⚠️ ASSINATURA POR ARMA: cada arma fala a linguagem visual dela (biblioteca
// explosions.ts), nao mais a mesma bola branca pra tudo. 'baleia' cobre a
// salva de trade grande (nao esta na enumeracao original do pedido, mas o
// mapa de assinaturas exige um caso proprio pra ela: incendiaria != tiro).
// 'canhao' cobre o par de teatro (proxCanhao): mesmo pool de `tiros` do trade
// comum, mas com clarao e rastro proprios (ver atira() e o laco de tiros).
type Arma = 'fuzil' | 'tiro' | 'morteiro' | 'mlrs' | 'bomba' | 'tanque' | 'baleia' | 'canhao'

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
  /** profundidade TOTAL do book (100 níveis da Kraken), em DOG e em USD:
   *  é o tamanho real de cada exército, não só a encenação */
  bidsDog: number
  asksDog: number
  bidsUsd: number
  asksUsd: number
  spread: number
  /** régua absoluta da encenação e profundidade real recebida do feed */
  dogPorSoldado: number
  niveisBook: number
  niveisEncenados: number
  vwap24: number
  volume24: number
  /** quantos assaltos ja aconteceram desde que a batalha nasceu. Existe para
   *  ser MEDIDO: ate 27/08 o assalto disparava uma vez por carregamento de
   *  pagina e este numero ficava travado em 1. */
  assaltos: number
  /** quantas vezes cada EVENTO DE MERCADO ja armou uma arma, por motivo.
   *  E o que o painel de legenda publica: prova, em numero, que o que se ve
   *  na tela veio da Kraken e nao de um temporizador. */
  eventos: Record<string, number>
  /** eventos esperando arma livre agora (fila do barramento) */
  filaEventos: number
  /** churn do book contra o normal recente: 1 = ritmo de sempre, 3 = fervendo.
   *  E o que comanda a fuzilaria de fundo. */
  churnRelativo: number
  trades24: number
  /** fita: últimos trades reais, mais novo primeiro */
  fita: Array<{ lado: 'buy' | 'sell'; qty: number; preco: number; t: number }>
}

export interface Battlefield {
  group: THREE.Group
  update(agora: number): void
  setLive(on: boolean): void
  hud(): HudBatalha
  /** Acende `n` das `orc.maxLuzes` luzes de impacto e, se `frente` vier, a luz
   *  da frente. Devolve quantas PointLights o campo tem acesas DEPOIS da troca
   *  (obeliscos incluídos), que é o número que o anfitrião precisa para fechar
   *  a conta do orçamento global dele. Ver `luzesAcesas()` para a leitura. */
  setLuzes(n: number, frente?: boolean): number
  /** PointLights que o campo tem acesas AGORA: pool de impacto ligado + luz da
   *  frente + os dois obeliscos (que só aparecem quando o book chega). */
  luzesAcesas(): number
  dispose(): void
}

const hash = (a: number, b: number) => {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453
  return s - Math.floor(s)
}

const fmtPreco = (p: number) => (p > 0 ? p.toFixed(6) : '-')

export interface OpcoesBatalha {
  /** ESTADO INICIAL da luz da frente. Falso no mundo da cidade, onde o
   *  orçamento global de PointLight nasce no limite; o anfitrião acende depois
   *  pelo `setLuzes()`, quando tiver de onde tirar a vaga. */
  luzesAmbiente?: boolean
  /** quantas das `orc.maxLuzes` de impacto nascem ACESAS. Padrão: todas. A
   *  praça nasce com 2 e sobe para 6 quando a câmera entra na cratera. */
  luzesIniciais?: number
  /** motas de poeira suspensas sobre a frente (o palco solo tem as dele, no
   *  anfitrião; a cidade pede as do motor para as duas batalhas terem os
   *  MESMOS elementos). 0 ou ausente = sem motas. */
  motas?: number
  /** ⚠️ BRILHO SEM PÓS-PROCESSAMENTO: quando o anfitrião não pode manter uma
   *  cadeia de composer (a praça não pode, ver plaza-scene.tsx), o clarão de
   *  impacto cresce e demora mais, para o halo ler na cena em vez de vir do
   *  bloom. Falso onde existe bloom de verdade, senão empilha os dois. */
  brilhoInterno?: boolean
  /** impacto pesado (morteiro, canhão de tanque): o anfitrião pode sacudir a
   *  câmera sem o motor conhecer câmera nenhuma */
  onImpactoGrande?: (forca: number) => void
  /** ⚠️ A ESCALA DO GRUPO NO ANFITRIÃO (a praça usa 2,6; o palco solo, 1).
   *  Malha e Sprite herdam a escala do grupo sozinhos. `THREE.Points` NÃO: o
   *  tamanho do ponto sai em pixels de `gl_PointSize`, que ignora a matriz de
   *  modelo e só divide pela profundidade. Como a cena escalada põe a câmera
   *  proporcionalmente mais longe, todo ponto encolhe na mesma medida em que o
   *  mundo cresce. PointLight tem o mesmo problema por outro caminho: `distance`
   *  e `decay` são metros de MUNDO, então um alcance de 26 que cobria meio campo
   *  no palco solo cobre um sexto dele num campo 2,6x maior.
   *  Passar a escala aqui devolve poeira, brasas, motas e halo de luz ao tamanho
   *  relativo que eles têm no palco solo. Não cria partícula nem luz nova: só
   *  multiplica tamanho e alcance, que não entram na chave de programa do three. */
  escala?: number
}

export function createBattlefield(
  altura: (x: number, z: number) => number,
  orc: OrcamentoBatalha,
  onWhale?: (lado: 'buy' | 'sell', forca: number) => void,
  opcoes: OpcoesBatalha = {},
): Battlefield {
  const luzesAmbiente = opcoes.luzesAmbiente !== false
  // ver OpcoesBatalha.escala: 1 no palco solo, 2,6 na cidade
  const esc = Math.max(0.001, opcoes.escala ?? 1)
  // decay 1.6 a 1.8 nas luzes daqui: para manter o MESMO brilho a uma distância
  // multiplicada por `esc`, a intensidade acompanha por potência do decaimento
  const escLuz = Math.pow(esc, 1.8)
  // ⚠️ A CONTAGEM DE PointLight É CHAVE DE PROGRAMA no three (`numPointLights`
  // entra em getProgramCacheKey), então mudar quantas luzes a cena tem manda o
  // renderer recompilar TODO material iluminado. Por isso nada aqui liga luz
  // nova de surpresa: as luzes acima do orçamento nascem invisíveis (o three
  // descarta objeto invisível antes de somar luz) e só acendem quando o
  // anfitrião apaga uma das dele no MESMO quadro, pelo `setLuzes()`.
  let luzesAtivas = Math.max(0, Math.min(orc.maxLuzes, opcoes.luzesIniciais ?? orc.maxLuzes))
  // clarão de impacto: fator de tamanho e de duração quando o anfitrião não
  // tem bloom (o halo tem de nascer na cena, ver OpcoesBatalha.brilhoInterno)
  const halo = opcoes.brilhoInterno ? 1.7 : 1
  const haloMs = opcoes.brilhoInterno ? 260 : 130
  // ⚠️ não existe campo de tier explícito aqui: orc.cap já discrimina os três
  // degraus nos dois anfitriões (1000/900 no low, 2200 no mid, 4200 no high),
  // então os sistemas novos usam esse limiar pra decidir a própria redução
  const low = orc.cap <= 1200
  const group = new THREE.Group()
  // ═══════════════════════════════════════════════════════════════════════
  // ⚠️⚠️ MUNDO NÃO É LOCAL, E ESTE MOTOR RODA EM DOIS ANFITRIÕES.
  //
  // O palco solo (app/city/war) põe este `group` na origem, sem rotação nem
  // escala: ali mundo e local são a MESMA coisa e qualquer confusão entre os
  // dois é invisível. A praça (app/city/plaza) põe o mesmo grupo a 3 km da
  // origem, girado 225° e escalado 2,6x.
  //
  // Toda boca de arma daqui é calculada com `applyMatrix4(pivô.matrixWorld)`,
  // o que dá um ponto em MUNDO. Esse ponto vira `mesh.userData.de` de um
  // projétil e `mesh.position` de um clarão, e esses meshes são FILHOS deste
  // grupo, ou seja leem LOCAL. No palco solo dava certo por acidente. Na
  // cidade o ponto era transformado de novo pelo grupo e o tiro nascia a
  // milhares de metros do campo: "os tiros de canhão estão sendo disparados
  // do nada num ponto distante da batalha" (fundador, 27/08). O mesmo valia
  // para TODOS os clarões de boca (bateria, tanque, helicóptero, jipe,
  // antiaérea, metralhadora), que por isso nunca apareciam na cidade e faziam
  // a batalha de lá parecer ter menos armas que a solo.
  //
  // REGRA: todo ponto e toda direção calculados por matrixWorld passam por
  // `paraLocal`/`direcaoParaLocal` ANTES de virar posição de mesh ou origem
  // de projétil. A matriz nasce identidade, então o palco solo não muda nada.
  // ═══════════════════════════════════════════════════════════════════════
  const _mInvGrupo = new THREE.Matrix4()
  const atualizaBaseLocal = () => {
    group.updateWorldMatrix(true, false)
    _mInvGrupo.copy(group.matrixWorld).invert()
  }
  const paraLocal = (v: THREE.Vector3) => v.applyMatrix4(_mInvGrupo)
  const direcaoParaLocal = (v: THREE.Vector3) => v.transformDirection(_mInvGrupo).normalize()
  // ⚠️ a praça faz raycast recursivo na cena inteira no duplo toque; instância
  // testada uma a uma são milhares de interseções à toa
  const semRaycast = (m: THREE.Object3D) => {
    ;(m as any).raycast = () => {}
  }
  // ⚠️ biblioteca de assinaturas por arma: tier reduzido PROPRIO (2000, não
  // 1200) porque o custo de partículas de impacto pesa mais que o resto da
  // praça; instanciada cedo pra ficar disponível pra tudo que vem depois
  // (impacto, baterias, tanques, MLRS, bombardeiro).
  const lib = createExplosionLibrary({ group, semRaycast, low: orc.cap < 2000 })
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
  // a luz da frente EXISTE nos dois anfitriões; na cidade ela nasce apagada e
  // acende quando a câmera entra na cratera (troca de vaga, ver setLuzes)
  const luzFrente = new THREE.PointLight(0xffc98a, 12 * escLuz, 60 * esc, 1.6)
  luzFrente.position.set(0, 4, 0)
  luzFrente.visible = luzesAmbiente
  group.add(luzFrente)

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

  // ── motas de poeira suspensas sobre a frente ────────────────────────────
  // ⚠️ ESTE SISTEMA É CÓPIA DELIBERADA do que o palco solo monta por fora
  // (war-scene.tsx), e é assim de propósito: aqui ele vive DENTRO do grupo do
  // campo, então acompanha posição, rotação e escala da batalha quando ela
  // está enfiada no mundo da cidade. O palco solo continua com o dele, que é o
  // mesmo quadro de coordenadas por acidente feliz (grupo na identidade); ligar
  // os dois lá dobraria as motas. Um draw call, sem luz.
  let matMotas: THREE.ShaderMaterial | null = null
  if (opcoes.motas && opcoes.motas > 0) {
    const n = opcoes.motas
    const posMo = new Float32Array(n * 3)
    const faseMo = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      const z = (hash(i, 2) - 0.5) * 140
      const x = (hash(i, 4) - 0.5) * 40 * (1 - Math.abs(z) / 90)
      posMo.set([x, 0.4 + hash(i, 6) * 5, z], i * 3)
      faseMo[i] = hash(i, 7) * Math.PI * 2
    }
    const gMo = new THREE.BufferGeometry()
    gMo.setAttribute('position', new THREE.BufferAttribute(posMo, 3))
    gMo.setAttribute('fase', new THREE.BufferAttribute(faseMo, 1))
    matMotas = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      // uEscala declarado na CONSTRUÇÃO: uniforme não entra na chave de programa
      // do three (só a contagem de luzes entra), então isto não recompila nada
      uniforms: { time: { value: 0 }, cor: { value: new THREE.Color(0xd9b98a) }, uEscala: { value: esc } },
      // os chunks de logdepth são no-op no palco solo e obrigatórios na praça
      vertexShader: `
        #include <common>
        #include <logdepthbuf_pars_vertex>
        attribute float fase; uniform float time; uniform float uEscala; varying float vA;
        void main(){
          vec3 p = position;
          p.x += sin(time * 0.15 + fase) * 3.0;
          p.y += sin(time * 0.3 + fase * 2.0) * 0.6 + 0.4;
          vA = 0.5 + 0.5 * sin(time * 0.6 + fase);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          // ⚠️ O *60.0 NÃO É ENFEITE: sem ele isto dá 26/400 = 0,065 px a 400 m e
          // a mota NUNCA aparece, em anfitrião nenhum (no palco solo, a 110 m,
          // dá 0,24 px). A irmã logo abaixo, escrita pela mesma mão para as
          // brasas, tem o fator; esta ficou sem. O clamp segue o padrão dela.
          gl_PointSize = clamp(26.0 * uEscala * 60.0 / -mv.z, 1.0, 4.0 * uEscala);
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
          gl_FragColor = vec4(cor, smoothstep(0.5, 0.0, d) * vA * 0.35);
        }`,
    })
    const motas = new THREE.Points(gMo, matMotas)
    semRaycast(motas)
    group.add(motas)
  }

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
      // postura solta: soldado de verdade não olha todo pro mesmo ponto
      rot[i] = (hash(i, 71) - 0.5) * 0.9
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

  // ── AMOSTRA DOS EXÉRCITOS: onde os soldados DE VERDADE estão ────────────
  // ⚠️ LEGIBILIDADE DE CAUSA E EFEITO (fundador, 25/08): "os tiros são
  // completamente aleatórios". O alvo de toda arma de teatro deixa de ser um
  // z sorteado no campo vazio e passa a ser um soldado REAL: montaExercito
  // guarda cada k-ésimo posto num Float32Array fixo (zero alocação por book)
  // e alvoNoExercito sorteia um deles por hash do relógio (nunca
  // Math.random). O corpo que tomba no impacto cai NO MEIO da formação.
  const AMOSTRA_MAX = 120
  const amostraCaes = new Float32Array(AMOSTRA_MAX * 2)
  const amostraUrsos = new Float32Array(AMOSTRA_MAX * 2)
  let amostraCaesN = 0
  let amostraUrsosN = 0
  // passo do k-ésimo: cobre o cap inteiro do tier com as 120 vagas
  const PASSO_AMOSTRA = Math.max(1, Math.floor(orc.cap / AMOSTRA_MAX))
  // scratches do teatro (criados UMA vez; todo consumidor copia na hora)
  const vAlvoTeatro = new THREE.Vector3()
  const direcaoTeatro = new THREE.Vector3()
  // sequência global: duas chamadas no MESMO milissegundo (par de canhões,
  // salva) ainda sorteiam soldados diferentes sem precisar de Math.random
  let alvoSeq = 0
  const alvoNoExercito = (ladoAlvo: 'buy' | 'sell', out: THREE.Vector3): boolean => {
    const n = ladoAlvo === 'buy' ? amostraCaesN : amostraUrsosN
    if (n === 0) return false
    const arr = ladoAlvo === 'buy' ? amostraCaes : amostraUrsos
    alvoSeq = (alvoSeq + 1) % 8191
    const t = Math.floor(performance.now())
    const k = Math.floor(hash(t % 1499 + alvoSeq * 7, alvoSeq + 3) * n) % n
    // jitter ±1.5: o tiro cai no aglomerado, não sempre no mesmo focinho
    out.set(
      arr[k * 2] + (hash(k + alvoSeq, t % 271) - 0.5) * 3,
      0,
      arr[k * 2 + 1] + (hash(k + alvoSeq + 7, t % 383) - 0.5) * 3,
    )
    out.y = altura(out.x, out.z) + 0.4
    return true
  }

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
    // ⚠️ 1 em cada 3 ciclos deste duelo vira lança-chamas (ver o disparo em
    // 'corre'->'choque'); ciclo conta as repetições, chamas é o resultado
    ciclo: number
    chamas: boolean
  }
  const duelos: Duelo[] = []
  for (let i = 0; i < 10; i++) {
    const cao = new THREE.Mesh(geoShiba, matCaes)
    const urso = new THREE.Mesh(geoUrso, matUrsos)
    cao.visible = urso.visible = false
    semRaycast(cao)
    semRaycast(urso)
    group.add(cao, urso)
    duelos.push({
      cao, urso, fase: 'espera', t0: performance.now() + 600 + i * 900 + hash(i, 3) * 1400, z: 0, vence: 'buy',
      ciclo: i, chamas: false,
    })
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
      uniforms: { time: { value: 0 }, cor: { value: new THREE.Color(0xffa050) }, uEscala: { value: esc } },
      vertexShader: `
        #include <common>
        #include <logdepthbuf_pars_vertex>
        attribute float fase; uniform float time; uniform float uEscala; varying float vA;
        void main(){
          vec3 p = position;
          float h = mod(time * (0.7 + fase) + fase * 7.0, 7.0);
          p.y = h;
          p.x += sin(time * 1.3 + fase * 20.0) * 0.5;
          vA = (1.0 - h / 7.0) * (0.35 + 0.65 * fase);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = 16.0 * uEscala / -mv.z * (60.0);
          gl_PointSize = clamp(gl_PointSize, 1.0, 5.0 * uEscala);
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
  // ── CADÁVERES EM 3 FASES: arremesso (arco + tumble), repouso (rotação
  // final variada, ~22s) e afundamento (desce e libera o slot). MESMO
  // InstancedMesh de sempre, só a coreografia muda. Pool FIXO de
  // orc.detritos entradas com cursor circular: zero alocação por baixa
  // (o `para` antigo alocava Quaternion+Euler novos a cada tombamento; agora
  // cada slot já nasce com o seu Quaternion e só é mutado via setFromEuler).
  const qZero = new THREE.Quaternion()
  const qTumble = new THREE.Quaternion()
  const eScratchTombo = new THREE.Euler()
  const EIXO_TOMBO = new THREE.Vector3(1, 0, 0)
  // ⚠️ O POOL SERVE OS DOIS EXÉRCITOS (cães E ursos, cada um com
  // orc.detritos instâncias): com o tamanho de um só, vaga ativa era roubada
  // no meio do voo e o corpo congelava no ar (o fundador viu a cambalhota)
  const CAP_TOMBOS = orc.detritos * 2
  interface TomboSlot {
    ativo: boolean
    mesh: THREE.InstancedMesh | null
    idx: number
    fase: 0 | 1 | 2
    tFase: number
    x: number
    y: number
    z: number
    esc: number
    apice: number
    paraFinal: THREE.Quaternion
  }
  const tombos: TomboSlot[] = Array.from({ length: CAP_TOMBOS }, () => ({
    ativo: false, mesh: null, idx: 0, fase: 0 as 0 | 1 | 2, tFase: 0,
    x: 0, y: 0, z: 0, esc: 1, apice: 1.6, paraFinal: new THREE.Quaternion(),
  }))
  let curTombo = 0
  // deita a instância do slot no chão na pose final: usada quando um slot
  // ativo precisa ser liberado no meio da animação (jamais congelar no ar)
  const assentaTombo = (s: TomboSlot) => {
    if (!s.mesh) return
    vp.set(s.x, s.y + 0.05, s.z)
    vs.setScalar(s.esc)
    m4.compose(vp, s.paraFinal, vs)
    s.mesh.setMatrixAt(s.idx, m4)
    s.mesh.instanceMatrix.needsUpdate = true
    s.ativo = false
  }
  const tomba = (mesh: THREE.InstancedMesh, cur: { v: number }, p: THREE.Vector3, n: number) => {
    // ⚠️ DONO POR INSTÂNCIA: quando o cursor de instâncias dá a volta, um
    // slot novo passava a animar o MESMO índice que um slot velho ainda
    // ativo: dois escritores brigando pela matriz a cada frame (a "cambalhota
    // aleatória" que o fundador viu). O mapa de dono derruba o escritor velho
    let dono = mesh.userData.donoTombo as Int32Array | undefined
    if (!dono) {
      dono = new Int32Array(orc.detritos)
      mesh.userData.donoTombo = dono
    }
    for (let k = 0; k < n; k++) {
      const idx = (cur.v = (cur.v + 1) % orc.detritos)
      mesh.count = Math.max(mesh.count, idx + 1)
      const donoVelho = dono[idx] - 1
      if (donoVelho >= 0 && tombos[donoVelho].ativo && tombos[donoVelho].mesh === mesh && tombos[donoVelho].idx === idx) {
        tombos[donoVelho].ativo = false
      }
      const px = p.x + (hash(idx, 3) - 0.5) * 2.6
      const pz = p.z + (hash(idx, 7) - 0.5) * 2.6
      const slot = tombos[curTombo]
      dono[idx] = curTombo + 1
      curTombo = (curTombo + 1) % CAP_TOMBOS
      // vaga roubada em pleno voo assenta a instância antiga no chão antes
      if (slot.ativo) assentaTombo(slot)
      slot.ativo = true
      slot.mesh = mesh
      slot.idx = idx
      slot.fase = 0
      slot.tFase = performance.now()
      slot.x = px
      slot.y = altura(px, pz)
      slot.z = pz
      slot.esc = 0.8 + hash(idx, 9) * 0.3
      // arco baixo de corpo arremessado (0.7 a 1.4), não pulo de ginasta
      slot.apice = 0.7 + hash(idx, 33) * 0.7
      // rotação de REPOUSO variada: nem todo mundo cai a exatos 90 graus,
      // soma hash * 0.5 rad nos eixos X e Z
      eScratchTombo.set(
        (Math.PI / 2) * (hash(idx, 1) > 0.5 ? 1 : -1) + (hash(idx, 21) - 0.5) * 0.5,
        hash(idx, 2) * Math.PI,
        (hash(idx, 23) - 0.5) * 0.5,
      )
      slot.paraFinal.setFromEuler(eScratchTombo)
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
    const luz = new THREE.PointLight(0xff9040, 14 * escLuz, 30 * esc, 1.8)
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
  // ⚠️ CAUDA DE COMETA, não cotonete (o fundador cravou): a caixa uniforme
  // esticada com ponta redonda lia como cotonete voando. O rastro agora é um
  // CONE afilado com cor por vértice: brilho pleno na cabeça (z=0), morrendo
  // a nada na cauda (z=-1). Com blending aditivo, o decaimento vira o fade.
  const fazGeoCometa = (raio: number) => {
    const g = new THREE.ConeGeometry(raio, 1, 7, 1, true)
    g.rotateX(-Math.PI / 2)
    g.translate(0, 0, -0.5)
    const pos = g.attributes.position
    const cores = new Float32Array(pos.count * 3)
    for (let i = 0; i < pos.count; i++) {
      const f = Math.pow(Math.max(0, 1 + pos.getZ(i)), 1.6)
      cores[i * 3] = f
      cores[i * 3 + 1] = f
      cores[i * 3 + 2] = f
    }
    g.setAttribute('color', new THREE.BufferAttribute(cores, 3))
    return g
  }
  const geoRastro = fazGeoCometa(0.16)

  const matTiroCompra = new THREE.MeshBasicMaterial({ color: 0xffd9a0 })
  const matTiroVenda = new THREE.MeshBasicMaterial({ color: 0xff6a50 })
  const matRastroCompra = new THREE.MeshBasicMaterial({
    color: 0xffb35c, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false,
    vertexColors: true, side: THREE.DoubleSide,
  })
  const matRastroVenda = matRastroCompra.clone()
  matRastroVenda.color.setHex(0xff5940)

  const POOL_TIROS = orc.maxOndas * 2
  // `arco`: altura do arco por tiro. Tiro de chão mantém a fórmula clássica;
  // foguete disparado do ALTO (heli) leva arco raso, senão o laço de voo
  // jogaria o projétil pro chão no primeiro frame (o y era fixo em 1)
  interface Tiro { i: number; t0: number; dur: number; forca: number; lado: 'buy' | 'sell'; qty: number; arma: Arma; arco: number }
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
  const poolLuzes: THREE.PointLight[] = Array.from({ length: orc.maxLuzes }, (_, i) => {
    const l = new THREE.PointLight(0xffa64d, 0, 26 * esc, 1.8)
    l.visible = i < luzesAtivas
    group.add(l)
    return l
  })
  let cursorLuz = 0
  const ondas: Onda[] = []
  // ⚠️ os obeliscos entram na conta: eles nascem invisíveis e só aparecem
  // quando o book traz máxima e mínima de 24 h, e nesse instante somam DUAS
  // PointLights à cena. Quem administra orçamento global tem de ler daqui, não
  // supor um número fixo.
  const luzesAcesas = () =>
    luzesAtivas + (luzFrente.visible ? 1 : 0) + (obLow.visible ? 1 : 0) + (obHigh.visible ? 1 : 0)

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
    map: texDisco, color: 0xcabfa8, size: 2.4 * esc, transparent: true, opacity: 0.62, depthWrite: false, sizeAttenuation: true,
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
  // ⚠️ `tintHex` é a assinatura visual por arma: a fase brilhante mistura de
  // BRANCO puro (k=0) até esse tom (k=1). Sem argumento reproduz OS MESMOS
  // (1, 0.65, 0.25) de sempre bit a bit, então nenhuma chamada existente muda
  // de cor; o MLRS passa branco puro (sem mistura) pro burst ficar mais frio.
  const explodeBola = (p: THREE.Vector3, forca: number, tintHex?: number) => {
    const sp = bolasFogo[bolaCursor]
    bolaCursor = (bolaCursor + 1) % POOL_BOLA
    sp.position.copy(p).setY(p.y + 0.6 + Math.sqrt(forca) * 0.3)
    // ⚠️ a fase BRILHANTE é o que o olho chama de explosão; curta demais e a
    // guerra vira só fumaça (o fundador assistiu e só viu "tiros pequenos")
    sp.userData.base = 2.6 + Math.sqrt(forca) * 3.2
    sp.userData.t0 = performance.now()
    sp.userData.dur = 650 + forca * 55
    sp.userData.tr = tintHex !== undefined ? ((tintHex >> 16) & 255) / 255 : 1
    sp.userData.tg = tintHex !== undefined ? ((tintHex >> 8) & 255) / 255 : 0.65
    sp.userData.tb = tintHex !== undefined ? (tintHex & 255) / 255 : 0.25
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
  // ⚠️ `cor`: tinge pelo lado (antes era sempre o mesmo 0xffe6c2 fixo pra
  // todo mundo); quem chama passa a força JÁ reduzida por arma, então esta
  // função não decide mais sozinha quem merece flash grande
  const flashDeTela = (p: THREE.Vector3, forca: number, cor: number) => {
    const m = flashesChao[flashChaoCursor]
    flashChaoCursor = (flashChaoCursor + 1) % POOL_FLASH_CHAO
    const raio = 6 + Math.sqrt(forca) * 5.5
    m.position.set(p.x, altura(p.x, p.z) + 0.06, p.z)
    m.scale.set(raio, raio, 1)
    m.userData.t0 = performance.now()
    m.userData.baseOp = Math.min(1, 0.55 + forca * 0.05)
    ;(m.material as THREE.MeshBasicMaterial).color.setHex(cor)
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
  // ⚠️ origemX/origemZ opcionais: metade das rajadas de fundo passa a nascer
  // na boca real de um ninho de metralhadora (ver dispararRajadaNinho na
  // seção 7e), a outra metade continua saindo da infantaria pela fórmula de
  // sempre. Sem os dois, disparaBala cai na fórmula antiga.
  // alvoX/alvoZ opcionais: rajada MIRADA num soldado real (ninho e onda de
  // assalto passam o sorteio de alvoNoExercito); sem eles a bala voa até a
  // costura pela fórmula antiga (escaramuça continua ruído de fundo rápido)
  // origemY opcional: a rajada do heli nasce na ponta da arma EM ALTITUDE;
  // sem ele a bala continua nascendo na cota de infantaria (1.0)
  const filaRajada: Array<{ at: number; lado: 'buy' | 'sell'; z: number; forca: number; ultima: boolean; origemX?: number; origemZ?: number; alvoX?: number; alvoZ?: number; origemY?: number }> = []
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
  const disparaBala = (
    lado: 'buy' | 'sell', z: number, forca: number, ultima: boolean, agora: number,
    origemX?: number, origemZ?: number, alvoX?: number, alvoZ?: number, origemY?: number,
  ) => {
    const s = lado === 'buy' ? 1 : -1
    const i = cursorBala
    cursorBala = (cursorBala + 1) % POOL_BALA
    const mesh = poolBalas[i]
    mesh.material = lado === 'buy' ? matRastroCompra : matRastroVenda
    mesh.visible = true
    if (origemX !== undefined) mesh.userData.de.set(origemX, origemY ?? 1.0, origemZ ?? z)
    else mesh.userData.de.set(-s * (16 + hash(i, 5) * 8) + frenteX, 1.0, z)
    if (alvoX !== undefined) mesh.userData.para.set(alvoX, 1.0, alvoZ ?? z)
    else mesh.userData.para.set(s * (FRENTE - 1) + frenteX, 1.0, z + (hash(i, 9) - 0.5) * 1.2)
    balas.push({ i, t0: agora, dur: 85 + hash(i, 2) * 35, lado, forca, ultima })
    clarao(mesh.userData.de, 0.6, lado === 'buy' ? 0xffd9a0 : 0xffb09a)
  }

  // ── MORTEIRO PESADO: casca escura, arco alto, queda quase vertical ──────
  const geoCasca = new THREE.SphereGeometry(1, 8, 8)
  // ⚠️ A CASCA NÃO É O ESPETÁCULO, o rastro é. Ela era quase preta (0x3a2a1c)
  // num material sem luz, então sobre o regolito claro lia como BURACO redondo
  // recortado no céu, e foi metade do "esteticamente feio" que o fundador
  // apontou. Tom quente e escuro, não preto: continua sendo uma casca de ferro
  // vista contra a luz, mas deixa de ser um furo na imagem.
  const matCascaCompra = new THREE.MeshBasicMaterial({ color: 0x5b4634 })
  const matCascaVenda = new THREE.MeshBasicMaterial({ color: 0x4d2f2c })
  // cauda de cometa também no pesado (mesma cura do cotonete), um tico mais
  // gorda que a do tiro comum; o decaimento por vértice faz o fade da cauda
  const geoRastroPesado = fazGeoCometa(0.3)
  const matRastroPCompra = new THREE.MeshBasicMaterial({
    color: 0xffc27a, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false,
    vertexColors: true, side: THREE.DoubleSide,
  })
  const matRastroPVenda = matRastroPCompra.clone()
  matRastroPVenda.color.setHex(0xff6a4c)
  const POOL_PESADO = 10
  // ⚠️ o mesmo pool de "casca pesada" serve DUAS armas (morteiro e canhão de
  // tanque): `arma` viaja no struct pra impacto() saber qual assinatura tocar
  interface Pesado { i: number; t0: number; dur: number; forca: number; lado: 'buy' | 'sell'; arma: Arma }
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
  const disparaPesado = (lado: 'buy' | 'sell', forca: number, de: THREE.Vector3, para: THREE.Vector3, dur: number, arma: Arma) => {
    const i = cursorPesado
    cursorPesado = (cursorPesado + 1) % POOL_PESADO
    const mesh = poolCascas[i]
    const rastro = poolRastrosP[i]
    mesh.material = lado === 'buy' ? matCascaCompra : matCascaVenda
    rastro.material = lado === 'buy' ? matRastroPCompra : matRastroPVenda
    mesh.visible = rastro.visible = true
    // 1.2x da escala antiga: seguível sem virar balão (a 1.8x a cabeça
    // gorda + rastro uniforme liam como cotonete; a cauda de cometa é quem
    // carrega a leitura agora)
    // menor que antes (era 1.2x): com a fumaça marcando o arco, a leitura vem
    // do traço e não do calibre da bola
    mesh.scale.setScalar((0.5 + Math.sqrt(forca) * 0.16) * 0.85)
    mesh.userData.de.copy(de)
    mesh.userData.para.copy(para)
    mesh.userData.prev.copy(de)
    mesh.userData.marca = -1 // baforadas do voo, ver o laço dos pesados
    pesados.push({ i, t0: performance.now(), dur, forca, lado, arma })
  }
  // ⚠️ a boca do morteiro é a bateria mais próxima do z alvo (mata o tiro que
  // nasce do nada); sem bateria (não deveria acontecer, sempre há pelo menos
  // 2 por lado) cai na fórmula antiga como rede de segurança
  const disparaMorteiro = (lado: 'buy' | 'sell', forca: number, z: number) => {
    const s = lado === 'buy' ? 1 : -1
    // ⚠️ o alvo é um soldado REAL do exército inimigo (amostra viva do book),
    // nunca mais um z solto no campo vazio; o z pedido vira só fallback
    const temAlvo = alvoNoExercito(lado === 'buy' ? 'sell' : 'buy', vAlvoTeatro)
    const zMira = temAlvo ? vAlvoTeatro.z : z
    const bateria = bateriaMaisProxima(lado, zMira)
    let de: THREE.Vector3
    if (bateria) {
      dispararBateria(bateria, performance.now(), forca)
      de = bocaDaBateria(bateria).clone()
    } else {
      de = new THREE.Vector3(-s * (20 + hash(Math.floor(z * 3), 3) * 12) + frenteX, 1, z + (hash(Math.floor(z), 7) - 0.5) * 12)
    }
    const para = new THREE.Vector3(s * (FRENTE + 2 + hash(Math.floor(z), 13) * 8) + frenteX, 0.8, z)
    if (temAlvo) para.copy(vAlvoTeatro)
    else para.y = altura(para.x, para.z) + 0.4
    // voo 1.35x mais lento que o antigo: o espectador segue a casca da boca
    // até o corpo tombando no meio da formação
    disparaPesado(lado, forca, de, para, (1500 + forca * 45) * 1.35, 'morteiro')
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
  const direcaoBocaTanque = new THREE.Vector3()
  const dispararTanque = (t: Tanque, agora: number) => {
    t.recuoT0 = agora
    // boca do cano via matrixWorld, como a bateria faz: o mesh da torre já
    // nasce com o cano deslocado sentido*2.3 no local space (tanks.ts), o
    // pivô que gira é o torreGrupo (mira em Y), então o mundo sai de lá
    t.torreGrupo.updateWorldMatrix(true, false)
    paraLocal(bocaTanque.set(t.sentido * 2.3, 0.16, 0).applyMatrix4(t.torreGrupo.matrixWorld))
    direcaoParaLocal(direcaoBocaTanque.set(t.sentido, 0, 0).transformDirection(t.torreGrupo.matrixWorld))
    clarao(bocaTanque, 3.4, t.lado === 'buy' ? 0xffd9a0 : 0xffb09a)
    solta_fumaca(bocaTanque, 5)
    // clarão de boca de PERTO: cone na direção real do cano + anel de fumaça
    // na boca, no MESMO frame em que a casca nasce dali
    lib.claraoDeBoca(bocaTanque, direcaoBocaTanque, 9)
    // mira um soldado REAL do exército inimigo (amostra); a fórmula antiga de
    // ponto solto vira só rede de segurança pro book ainda vazio
    if (!alvoNoExercito(t.lado === 'buy' ? 'sell' : 'buy', vAlvoTeatro)) {
      vAlvoTeatro.set(
        t.sentido * (FRENTE + 8 + hash(Math.floor(agora) % 811, t.z) * 10) + frenteX,
        0,
        t.z + (hash(Math.floor(agora) % 433, t.z) - 0.5) * 14,
      )
      vAlvoTeatro.y = altura(vAlvoTeatro.x, vAlvoTeatro.z) + 0.4
    }
    // tiro de tanque é TENSO: rápido e raso (o 1.35x lento com corcova lia
    // como parábola de desenho animado); a cauda de cometa dá a leitura
    disparaPesado(t.lado, 9, bocaTanque, vAlvoTeatro, 820, 'tanque')
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

  // ═══════════════════════════════════════════════════════════════════════
  // ENCENAÇÃO PROFUNDA: seis sistemas aditivos que fecham o "tiro nasce do
  // nada" e dão à batalha o nível de teatro do bitcoin-warfront: baterias
  // visíveis, MLRS em salva, bombardeiro na ofensiva, cargas de esquadrão,
  // porta-bandeiras na linha, e assinatura visual por arma (via explodeBola).
  // ═══════════════════════════════════════════════════════════════════════

  // ── 1. BATERIAS: 3 (2 no low) canhões por lado, atrás da linha ──────────
  interface Bateria {
    grupo: THREE.Group
    canoGrupo: THREE.Group
    lado: 'buy' | 'sell'
    sentido: 1 | -1
    z: number
    jit: number
    recuoT0: number
    elevBase: number
  }
  const ANGULO_REPOUSO_CANHAO = 0.3
  const DIST_BATERIA = 34
  const geoCanhaoDog = buildCanhaoGeometry(CORES_TANQUE_DOG, 1)
  const geoCanhaoUrso = buildCanhaoGeometry(CORES_TANQUE_URSO, -1)
  const criaBateria = (lado: 'buy' | 'sell', z: number, jit: number): Bateria => {
    const sentido: 1 | -1 = lado === 'buy' ? 1 : -1
    const geo = lado === 'buy' ? geoCanhaoDog : geoCanhaoUrso
    const baseMesh = new THREE.Mesh(geo.base, matTanque)
    const canoMesh = new THREE.Mesh(geo.cano, matTanque)
    semRaycast(baseMesh)
    semRaycast(canoMesh)
    baseMesh.frustumCulled = canoMesh.frustumCulled = false
    const elevBase = sentido * ANGULO_REPOUSO_CANHAO
    const canoGrupo = new THREE.Group()
    canoGrupo.position.set(0, 2.45, 0)
    canoGrupo.rotation.z = elevBase
    canoGrupo.add(canoMesh)
    const grupo = new THREE.Group()
    grupo.add(baseMesh, canoGrupo)
    group.add(grupo)
    return { grupo, canoGrupo, lado, sentido, z, jit, recuoT0: 0, elevBase }
  }
  const N_BATERIA = low ? 2 : 3
  const Z_BATERIA = low ? [-22, 22] : [-28, 0, 28]
  const baterias: Bateria[] = []
  for (let lIdx = 0; lIdx < 2; lIdx++) {
    const lado: 'buy' | 'sell' = lIdx === 0 ? 'buy' : 'sell'
    for (let k = 0; k < N_BATERIA; k++) {
      baterias.push(criaBateria(lado, Z_BATERIA[k], (hash(k, lIdx + 5) - 0.5) * 6))
    }
  }
  // ⚠️ dispararBateria cobre OS DOIS chamadores que fazem um projétil nascer
  // da boca de uma bateria: o morteiro (disparaMorteiro) e o canhão de
  // teatro (proxCanhao); os dois passam `forca` agora, e os dois ganham o
  // clarão de boca de perto de graça, no mesmo frame do disparo
  const direcaoBateria = new THREE.Vector3()
  const dispararBateria = (b: Bateria, agora: number, forca: number) => {
    b.recuoT0 = agora
    const boca = bocaDaBateria(b)
    direcaoParaLocal(direcaoBateria.set(b.sentido, 0, 0).transformDirection(b.canoGrupo.matrixWorld))
    lib.claraoDeBoca(boca, direcaoBateria, forca)
  }
  const bateriaMaisProxima = (lado: 'buy' | 'sell', z: number): Bateria | null => {
    let melhor: Bateria | null = null
    let melhorD = Infinity
    for (const b of baterias) {
      if (b.lado !== lado) continue
      const d = Math.abs(b.z - z)
      if (d < melhorD) {
        melhorD = d
        melhor = b
      }
    }
    return melhor
  }
  const bocaBateria = new THREE.Vector3()
  const bocaDaBateria = (b: Bateria): THREE.Vector3 => {
    b.canoGrupo.updateWorldMatrix(true, false)
    paraLocal(bocaBateria.set(b.sentido * BOCA_CANHAO_DIST, 0, 0).applyMatrix4(b.canoGrupo.matrixWorld))
    return bocaBateria
  }
  const atualizaBaterias = (agora: number) => {
    for (const b of baterias) {
      const bx = frenteX - b.sentido * DIST_BATERIA + b.jit
      b.grupo.position.set(bx, altura(bx, b.z), b.z)
      if (b.recuoT0 > 0) {
        const f = Math.min(1, (agora - b.recuoT0) / 320)
        if (f >= 1) {
          b.recuoT0 = 0
          b.canoGrupo.position.x = 0
          b.canoGrupo.rotation.z = b.elevBase
        } else {
          const k = 1 - f
          b.canoGrupo.position.x = -b.sentido * 0.5 * k * k
          b.canoGrupo.rotation.z = b.elevBase + b.sentido * 0.22 * k
        }
      }
    }
  }

  // ── 2. MLRS: forca 8-16 dispara salva de 6 foguetes em ripple (90ms), ───
  // cada um explode em cluster de 2 bolas brancas pequenas + faíscas. Baleia
  // (forca 16+) já ganha a salva de artilharia normal (código existente) E
  // o MLRS, porque esse gatilho fica dentro do MESMO `if (forca >= 8)`.
  interface Foguete { i: number; t0: number; dur: number; lado: 'buy' | 'sell'; forca: number }
  const POOL_FOGUETE = low ? 8 : 16
  const matFogueteCorpo = new THREE.MeshBasicMaterial({ color: 0xfff0d0 })
  const poolFoguetes: THREE.Mesh[] = []
  const poolRastroFoguetes: THREE.Mesh[] = []
  for (let i = 0; i < POOL_FOGUETE; i++) {
    const m = new THREE.Mesh(geoRastro, matFogueteCorpo)
    m.visible = false
    m.userData.de = new THREE.Vector3()
    m.userData.para = new THREE.Vector3()
    m.userData.prev = new THREE.Vector3()
    semRaycast(m)
    m.frustumCulled = false
    group.add(m)
    poolFoguetes.push(m)
    const r = new THREE.Mesh(geoRastro, matRastroCompra)
    r.visible = false
    semRaycast(r)
    r.frustumCulled = false
    group.add(r)
    poolRastroFoguetes.push(r)
  }
  let cursorFoguete = 0
  const foguetes: Foguete[] = []
  // `alvoX` opcional: quando a salva mira um aglomerado REAL (alvoNoExercito),
  // cada foguete cai em volta dele; sem amostra, a fórmula antiga segue valendo
  interface FilaFoguete { at: number; lado: 'buy' | 'sell'; forca: number; origemX: number; origemZ: number; zAlvo: number; alvoX?: number }
  const filaFoguete: FilaFoguete[] = []
  const dispararMLRS = (lado: 'buy' | 'sell', zAlvo: number, forca: number) => {
    const s = lado === 'buy' ? 1 : -1
    // a salva inteira cai num AGLOMERADO real do exército inimigo: um sorteio
    // por salva (não por foguete) pra ler como barragem concentrada
    const temAlvo = alvoNoExercito(lado === 'buy' ? 'sell' : 'buy', vAlvoTeatro)
    const zBase = temAlvo ? vAlvoTeatro.z : zAlvo
    const alvoXBase = temAlvo ? vAlvoTeatro.x : undefined
    const origemX = -s * (22 + hash(Math.floor(zBase) % 701, 3) * 10) + frenteX
    const origemZ = zBase + (hash(Math.floor(zBase) % 503, 7) - 0.5) * 10
    for (let k = 0; k < 6; k++) {
      filaFoguete.push({
        at: performance.now() + k * 90,
        lado,
        forca: Math.max(2, forca * 0.5),
        origemX,
        origemZ,
        zAlvo: zBase + (hash(k, zAlvo) - 0.5) * 10,
        alvoX: alvoXBase,
      })
    }
  }
  const dispararFoguete = (r: FilaFoguete, agora: number) => {
    const s = r.lado === 'buy' ? 1 : -1
    const i = cursorFoguete
    cursorFoguete = (cursorFoguete + 1) % POOL_FOGUETE
    const mesh = poolFoguetes[i]
    const rastro = poolRastroFoguetes[i]
    mesh.visible = true
    rastro.material = r.lado === 'buy' ? matRastroCompra : matRastroVenda
    rastro.visible = !low
    // corpo bem mais grosso que o rastro fino (geoRastro é a mesma caixa
    // 0.12×0.12×1 usada nos traçantes; aqui a escala engorda pro foguete
    // ler como projétil físico, não como outra linha de traçante)
    mesh.scale.set(2.4, 2.4, 0.8)
    mesh.userData.de.set(r.origemX, 1.0, r.origemZ)
    // com amostra: o x do soldado sorteado + espalhamento da salva; sem ela,
    // a fórmula antiga (borda da frente)
    const alvoX = r.alvoX !== undefined
      ? r.alvoX + (hash(i, 7) - 0.5) * 6
      : s * (FRENTE + hash(Math.floor(r.zAlvo) % 613, 11) * 8) + frenteX
    mesh.userData.para.set(alvoX, altura(alvoX, r.zAlvo) + 0.4, r.zAlvo)
    mesh.userData.prev.copy(mesh.userData.de)
    foguetes.push({ i, t0: agora, dur: 560 + hash(i, 3) * 140, lado: r.lado, forca: r.forca })
    clarao(mesh.userData.de, 1.1, r.lado === 'buy' ? 0xffe6b0 : 0xffc2a8)
    // clarão de boca no frame do disparo (a bateria e o tanque já tinham; o
    // MLRS disparava "do nada", só com o clarão de luz genérico)
    direcaoTeatro.subVectors(mesh.userData.para, mesh.userData.de).normalize()
    lib.claraoDeBoca(mesh.userData.de, direcaoTeatro, 3)
  }
  // assinatura MLRS: agora vive dentro de impacto() (arma='mlrs' toca
  // lib.clusterQuente, o mesmo estouro seco em rajada da referência), então
  // o foguete ganha onda/poeira/cicatriz/cadáver igual a qualquer outro tiro
  const explodeCluster = (p: THREE.Vector3, forca: number, lado: 'buy' | 'sell') => {
    impacto(p, forca, lado, 0, 'mlrs')
  }

  // ── 3. BOMBARDEIRO: uma passagem por ofensiva, 5 bombas em fila ─────────
  interface Bombardeiro {
    mesh: THREE.Mesh
    ativo: boolean
    t0: number
    dur: number
    x: number
    z0: number
    z1: number
    proximoIdx: number
  }
  const geoBombDog = buildBombardeiroGeometry(CORES_TANQUE_DOG)
  const geoBombUrso = buildBombardeiroGeometry(CORES_TANQUE_URSO)
  const criaBombardeiro = (lado: 'buy' | 'sell'): Bombardeiro => {
    const mesh = new THREE.Mesh(lado === 'buy' ? geoBombDog : geoBombUrso, matTanque)
    mesh.visible = false
    semRaycast(mesh)
    mesh.frustumCulled = false
    group.add(mesh)
    return { mesh, ativo: false, t0: 0, dur: 2200, x: 0, z0: -72, z1: 72, proximoIdx: 0 }
  }
  const bombardeiros: Record<'buy' | 'sell', Bombardeiro> = { buy: criaBombardeiro('buy'), sell: criaBombardeiro('sell') }
  const BOMBAS_FRACOES = [0.14, 0.32, 0.5, 0.68, 0.86]
  const filaBomba: Array<{ at: number; x: number; z: number }> = []
  const dispararBombardeiro = (lado: 'buy' | 'sell', agora: number) => {
    const b = bombardeiros[lado]
    if (b.ativo) return // pool de 1 por lado: uma passagem já em curso não reentra
    const sentido = lado === 'buy' ? 1 : -1
    b.ativo = true
    b.t0 = agora
    b.proximoIdx = 0
    // a LINHA de bombas cruza um aglomerado REAL do inimigo: o x da passagem
    // é o x de um soldado sorteado (limitado ao quadro em volta da frente);
    // sem amostra, a régua antiga (14 além da frente)
    if (alvoNoExercito(lado === 'buy' ? 'sell' : 'buy', vAlvoTeatro)) {
      b.x = THREE.MathUtils.clamp(vAlvoTeatro.x, frenteX - 44, frenteX + 44)
    } else {
      b.x = frenteX + sentido * 14
    }
  }
  const atualizaBombardeiros = (agora: number) => {
    for (const lado of ['buy', 'sell'] as const) {
      const b = bombardeiros[lado]
      if (!b.ativo) continue
      const f = (agora - b.t0) / b.dur
      if (f >= 1) {
        b.ativo = false
        b.mesh.visible = false
        continue
      }
      b.mesh.visible = true
      const z = b.z0 + (b.z1 - b.z0) * f
      // cota mínima 40, mas nunca menos que 26 acima do relevo local (nas
      // bordas do campo o terreno sobe e o avião em cota fixa entrava nele)
      b.mesh.position.set(b.x, Math.max(40, altura(b.x, z) + 26), z)
      while (b.proximoIdx < BOMBAS_FRACOES.length && f >= BOMBAS_FRACOES[b.proximoIdx]) {
        const idx = b.proximoIdx++
        filaBomba.push({ at: agora + 550, x: b.x, z: b.z0 + (b.z1 - b.z0) * BOMBAS_FRACOES[idx] })
      }
    }
  }

  // ── 4. CARGAS DE ESQUADRÃO: 7 (5 no low) soldados até a costura ─────────
  // ⚠️ "esquadrão do lado com pressão": é UM agendador só (não um por lado);
  // no disparo o lado sai da pressão real (mesma régua dos duelos), então só
  // um dos dois pools (cães OU ursos) fica ativo por ciclo.
  interface Soldado { mesh: THREE.Mesh; jitterZ: number; caiu: boolean }
  const N_ESQUADRAO = low ? 5 : 7
  const X_ESQUADRAO = FRENTE + 20
  const criaSoldados = (lado: 'buy' | 'sell'): Soldado[] => {
    const geo = lado === 'buy' ? geoShiba : geoUrso
    const mat = lado === 'buy' ? matCaes : matUrsos
    const soldados: Soldado[] = []
    for (let i = 0; i < N_ESQUADRAO; i++) {
      const mesh = new THREE.Mesh(geo, mat)
      mesh.visible = false
      semRaycast(mesh)
      mesh.frustumCulled = false
      group.add(mesh)
      soldados.push({ mesh, jitterZ: (i - (N_ESQUADRAO - 1) / 2) * 1.6, caiu: false })
    }
    return soldados
  }
  const soldadosCaes = criaSoldados('buy')
  const soldadosUrsos = criaSoldados('sell')
  interface EstadoEsquadrao {
    ativo: 'buy' | 'sell' | null
    fase: 'corre' | 'choque' | 'retirada'
    t0: number
    z: number
    prox: number
  }
  const estadoEsquadrao: EstadoEsquadrao = {
    ativo: null, fase: 'corre', t0: 0, z: 0,
    prox: performance.now() + 5000 + hash(17, 23) * 7000,
  }
  const atualizaEsquadrao = (agora: number, dt: number) => {
    if (estadoEsquadrao.ativo === null) {
      // ⚠️ CARGA DE ESQUADRÃO = SEQUÊNCIA: três trades seguidos do mesmo lado.
      // Era o sistema mais fraco em dado de todo o motor (temporizador de 12 a
      // 20 s, e do mercado só o lado). Três negócios encadeados é a menor
      // unidade de "um lado está mandando" que o feed produz, e é isso que os
      // 16 soldados correndo passam a representar.
      if (agora < estadoEsquadrao.prox) return
      const evSeq = consomeEvento('sequencia')
      if (!evSeq) return
      contagemEventos['sequencia'] = (contagemEventos['sequencia'] ?? 0) + 1
      const lado: 'buy' | 'sell' = evSeq.lado
      estadoEsquadrao.ativo = lado
      estadoEsquadrao.fase = 'corre'
      estadoEsquadrao.t0 = agora
      estadoEsquadrao.z = (hash(Math.floor(agora) % 631, 19) - 0.5) * 90
      for (const s of lado === 'buy' ? soldadosCaes : soldadosUrsos) {
        s.mesh.visible = true
        s.mesh.rotation.set(0, 0, 0)
        s.caiu = false
      }
      return
    }
    const lado = estadoEsquadrao.ativo
    const soldados = lado === 'buy' ? soldadosCaes : soldadosUrsos
    const sentido = lado === 'buy' ? 1 : -1
    const idade = agora - estadoEsquadrao.t0
    if (estadoEsquadrao.fase === 'corre') {
      const f = Math.min(1, idade / 1300)
      const x0 = frenteX - sentido * X_ESQUADRAO
      const x1 = frenteX - sentido * 2.2
      const x = x0 + (x1 - x0) * f
      for (let k = 0; k < soldados.length; k++) {
        const s = soldados[k]
        const zk = estadoEsquadrao.z + s.jitterZ
        const galope = Math.abs(Math.sin(f * 24 + k)) * 0.26
        s.mesh.position.set(x, altura(x, zk) + galope, zk)
      }
      if (f >= 1) {
        estadoEsquadrao.fase = 'choque'
        estadoEsquadrao.t0 = agora
        vp.set(frenteX, altura(frenteX, estadoEsquadrao.z) + 0.5, estadoEsquadrao.z)
        emitFaiscas(vp, 5)
        emitPoeira(vp, 4)
        const c1 = Math.floor(hash(Math.floor(agora) % 701, estadoEsquadrao.z) * soldados.length)
        let c2 = Math.floor(hash(Math.floor(agora) % 503, estadoEsquadrao.z + 1) * soldados.length)
        if (c2 === c1) c2 = (c2 + 1) % soldados.length
        soldados[c1].caiu = true
        soldados[c2].caiu = true
      }
      return
    }
    if (estadoEsquadrao.fase === 'choque') {
      const f = Math.min(1, idade / 300)
      for (const s of soldados) {
        if (s.caiu) s.mesh.rotation.x = (Math.PI / 2) * f * f
        else s.mesh.position.y = altura(s.mesh.position.x, s.mesh.position.z) + Math.abs(Math.sin(f * Math.PI * 2)) * 0.3
      }
      if (f >= 1) {
        estadoEsquadrao.fase = 'retirada'
        estadoEsquadrao.t0 = agora
      }
      return
    }
    // retirada: os dois que caíram ficam no chão, os outros voltam pra linha
    const f = Math.min(1, idade / 1300)
    const x0 = frenteX - sentido * 2.2
    const x1 = frenteX - sentido * X_ESQUADRAO
    const x = x0 + (x1 - x0) * f
    for (const s of soldados) {
      if (s.caiu) {
        s.mesh.position.y -= 0.6 * dt
        continue
      }
      const zk = estadoEsquadrao.z + s.jitterZ
      const galope = Math.abs(Math.sin(f * 20)) * 0.2
      s.mesh.position.set(x, altura(x, zk) + galope, zk)
    }
    if (f >= 1) {
      for (const s of soldados) {
        s.mesh.visible = false
        s.mesh.rotation.x = 0
        s.caiu = false
      }
      estadoEsquadrao.ativo = null
      // ⚠️ isto virou INTERVALO MÍNIMO, não cadência: sem o evento de sequência
      // a carga não acontece por mais que o relógio passe
      estadoEsquadrao.prox = agora + 6000
    }
  }

  // ── 5. PORTA-BANDEIRAS: 2 por lado, seguem a frente, onda em shader ─────
  interface Bandeira {
    grupo: THREE.Group
    mat: THREE.ShaderMaterial
    sentido: 1 | -1
    z: number
  }
  const bandeiraVert = `
    #include <common>
    #include <logdepthbuf_pars_vertex>
    uniform float time;
    varying vec2 vUv;
    void main(){
      vUv = uv;
      vec3 p = position;
      float k = uv.x;
      p.z += sin(time * 3.0 + p.x * 3.0) * 0.09 * k;
      p.y += sin(time * 2.2 + p.x * 2.0) * 0.03 * k;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      #include <logdepthbuf_vertex>
    }`
  const bandeiraFrag = `
    #include <common>
    #include <logdepthbuf_pars_fragment>
    uniform sampler2D mapa; varying vec2 vUv;
    void main(){
      #include <logdepthbuf_fragment>
      gl_FragColor = texture2D(mapa, vUv);
    }`
  // ⚠️ EXIGÊNCIA DO FUNDADOR: bandeira genérica não conta história. A dos
  // cães carrega o B do Bitcoin, a dos ursos a cara de um urso. Cada lado
  // desenha UMA CanvasTexture na montagem (128x96, formas grossas legíveis
  // a distância) e as duas bandeiras do lado compartilham a mesma textura.
  const desenhaBandeiraCaes = (): THREE.CanvasTexture => {
    const cv = document.createElement('canvas')
    cv.width = 128
    cv.height = 96
    const ctx = cv.getContext('2d')!
    ctx.fillStyle = '#ff9a3d'
    ctx.fillRect(0, 0, 128, 96)
    // o B do Bitcoin em creme: haste, duas barrigas em arco grosso e os
    // dois tracinhos verticais saindo em cima e embaixo
    ctx.fillStyle = '#f5ead2'
    ctx.strokeStyle = '#f5ead2'
    ctx.lineWidth = 10
    ctx.fillRect(47, 18, 11, 60)
    ctx.beginPath()
    ctx.arc(58, 33, 15, -Math.PI / 2, Math.PI / 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(58, 63, 15, -Math.PI / 2, Math.PI / 2)
    ctx.stroke()
    ctx.fillRect(49, 6, 6, 12)
    ctx.fillRect(60, 6, 6, 12)
    ctx.fillRect(49, 78, 6, 12)
    ctx.fillRect(60, 78, 6, 12)
    const tex = new THREE.CanvasTexture(cv)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }
  const desenhaBandeiraUrsos = (): THREE.CanvasTexture => {
    const cv = document.createElement('canvas')
    cv.width = 128
    cv.height = 96
    const ctx = cv.getContext('2d')!
    ctx.fillStyle = '#e0483a'
    ctx.fillRect(0, 0, 128, 96)
    // cara de urso estilizada em marrom quase preto: é um estandarte, não um
    // retrato. Duas orelhas redondas, cabeça larga, focinho claro, nariz.
    ctx.fillStyle = '#1a0f0d'
    ctx.beginPath()
    ctx.arc(44, 26, 11, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(84, 26, 11, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(64, 52, 27, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#d8b48f'
    ctx.beginPath()
    ctx.arc(64, 61, 10, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#1a0f0d'
    ctx.beginPath()
    ctx.arc(64, 58, 4, 0, Math.PI * 2)
    ctx.fill()
    const tex = new THREE.CanvasTexture(cv)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }
  const texBandeiraCaes = desenhaBandeiraCaes()
  const texBandeiraUrsos = desenhaBandeiraUrsos()
  const criaBandeira = (lado: 'buy' | 'sell', z: number): Bandeira => {
    const sentido: 1 | -1 = lado === 'buy' ? 1 : -1
    const mastro = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 3.4, 6), new THREE.MeshBasicMaterial({ color: 0x2a2018 }))
    mastro.position.y = 1.7
    semRaycast(mastro)
    mastro.frustumCulled = false
    const mat = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 }, mapa: { value: lado === 'buy' ? texBandeiraCaes : texBandeiraUrsos } },
      vertexShader: bandeiraVert,
      fragmentShader: bandeiraFrag,
      side: THREE.DoubleSide,
    })
    const bandeiraMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.0, 12, 6), mat)
    bandeiraMesh.position.set(sentido * 0.85, 3.0, 0)
    semRaycast(bandeiraMesh)
    bandeiraMesh.frustumCulled = false
    const grupo = new THREE.Group()
    grupo.add(mastro, bandeiraMesh)
    group.add(grupo)
    return { grupo, mat, sentido, z }
  }
  const bandeiras: Bandeira[] = [
    criaBandeira('buy', -20), criaBandeira('buy', 20),
    criaBandeira('sell', -20), criaBandeira('sell', 20),
  ]
  const atualizaBandeiras = (agora: number) => {
    const seg = agora * 0.001
    for (const b of bandeiras) {
      const bx = frenteX - b.sentido * 5
      b.grupo.position.set(bx, altura(bx, b.z), b.z)
      b.mat.uniforms.time.value = seg
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
  // ⚠️ A BASELINE PRECISA NASCER NO VALOR REAL, senão a razão churn/base começa
  // em 176 e leva meia hora para descer. Isso não incomodava enquanto a
  // baseline só alimentava a `intensidade` (que satura), mas passou a importar
  // quando a FUZILARIA DE FUNDO virou função do churn: com a razão saturada, a
  // batalha metralhava no talo por vários minutos toda vez que alguém abria a
  // página, que é justamente o teatro que o fundador mandou tirar.
  // ⚠️ NÃO BASTA SEMEAR NO PRIMEIRO PULSO: `taxaChurn` também nasce em 0,3 e
  // leva alguns segundos para alcançar o churn de verdade, então semear cedo
  // grava um valor falso e a razão volta a estourar. A base fica GRUDADA na
  // taxa durante os primeiros 25 s (razão = 1, batalha no ritmo de sempre) e
  // só depois começa a derivar sozinha, que é quando a taxa já é confiável.
  let esperaBase = 25000
  let baseSemeada = false
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
    if (!baseSemeada) {
      esperaBase -= dt * 1000
      if (esperaBase <= 0) baseSemeada = true
      else {
        baseChurn = taxaChurn
        baseTrades = Math.max(baseTrades, taxaTrades)
        baseVolume = Math.max(baseVolume, taxaVolume)
      }
    }
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

  // ═══════════════════════════════════════════════════════════════════════
  // BARRAMENTO DE EVENTOS REAIS
  //
  // ⚠️ DOUTRINA, decidida com o fundador em 27/08 e que vale para TODA arma
  // nova: nenhum sistema dispara por relógio. Um agente auditou as 4.486
  // linhas deste arquivo e mediu que, num mercado calmo, de cada ~690
  // disparos por minuto na tela 1 ou 2 vinham de um número da Kraken. 0,2%.
  // O resto era temporizador com o mercado escolhendo, no máximo, o lado.
  // A leitura do fundador: "tô achando muito teatro e pouca info de verdade".
  //
  // A regra agora: o mercado PRODUZ eventos, as armas CONSOMEM eventos. Se o
  // DOG está parado, a batalha fica quieta, e ficar quieta é a informação.
  // O que sobra de relógio é só o intervalo mínimo de cada arma, que não gera
  // evento nenhum: serve para uma rajada de trades não virar cinquenta
  // ofensivas empilhadas.
  //
  // ⚠️ A ESCARAMUÇA É A EXCEÇÃO, e é honesta: ela sai do CHURN do book, ou
  // seja das ordens que entram e saem sem virar negócio. Isso acontece muitas
  // vezes por segundo mesmo num dia parado, é dado real da Kraken, e é o que
  // dá o rumor de fundo sem inventar nada.
  // ═══════════════════════════════════════════════════════════════════════
  type MotivoEvento =
    | 'trade-medio'   // ≥ 2x a média: rajada dirigida
    | 'trade-grande'  // ≥ 4x: morteiro pesado
    | 'sequencia'     // 3 trades seguidos do mesmo lado: carga de esquadrão
    | 'maré'          // 5 seguidos do mesmo lado: ofensiva coordenada
    | 'parede'        // nível novo grande no book: par de canhões
    | 'rompimento'    // preço passou da máxima ou mínima da sessão: bombardeiro
    | 'spread'        // spread abriu muito: duelo de vanguarda
    | 'inclinacao'    // o book pendeu para um lado: duelo pequeno
  interface EventoMercado { motivo: MotivoEvento; lado: 'buy' | 'sell'; forca: number; at: number }
  const eventos: EventoMercado[] = []
  const emiteEvento = (motivo: MotivoEvento, lado: 'buy' | 'sell', forca: number) => {
    // teto de fila: numa tempestade o que interessa é a mais recente, não a
    // fila de trinta segundos atrás chegando atrasada na tela
    if (eventos.length > 24) eventos.shift()
    eventos.push({ motivo, lado, forca, at: performance.now() })
  }
  const consomeEvento = (motivo: MotivoEvento): EventoMercado | null => {
    for (let i = 0; i < eventos.length; i++) {
      if (eventos[i].motivo === motivo) return eventos.splice(i, 1)[0]
    }
    return null
  }
  // memória para reconhecer os eventos que não vêm prontos do feed
  let ladoSeguido: 'buy' | 'sell' | null = null
  let contaSeguidos = 0
  let picoSessao = 0
  let valeSessao = 0
  let emaNivelTopo = 0
  let emaSpread = 0
  // amostra do book de 3 s atrás: é contra ela que parede e spread viram evento
  let tAmostraBook = 0
  let amostraTopo = 0
  let amostraSpread = 0
  let amostraInclina = 0
  // contagem por motivo: é o que o painel de legenda publica para o curioso
  const contagemEventos: Record<string, number> = {}

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
  let vwap24 = 0
  let volume24 = 0
  let trades24 = 0
  let bidsDog = 0
  let asksDog = 0
  let bidsUsd = 0
  let asksUsd = 0
  let spreadAtual = 0
  const fita: HudBatalha['fita'] = []
  let feed: KrakenFeed | null = null

  const liga = () => {
    if (feed) return
    status = 'connecting'
    feed = connectKraken({
      depth: 500,
      onBook: (bids, asks) => {
        book = { bids, asks }
        bookSujo = true
      },
      onTrade: (t) => {
        filaTrades.push(t)
        registraVolume(t)
        alimentaTrade(t.qty)
        fita.unshift({ lado: t.side, qty: t.qty, preco: t.price, t: t.at })
        if (fita.length > 8) fita.pop()
        emaQty = emaQty === 0 ? t.qty : emaQty * 0.97 + t.qty * 0.03
        // ── o trade vira evento, e o tamanho dele escolhe a arma ─────────
        {
          const rel = emaQty > 0 ? t.qty / emaQty : 1
          // ⚠️ MEDIDO ANTES DE CALIBRAR: com os limiares em 4x e 2x, a batalha
          // ficou 90 segundos com ZERO eventos, porque o DOG faz cerca de 1,2
          // trades por minuto e quase nenhum passa de duas vezes a média. Uma
          // batalha honesta e morta não é o pedido: o pedido é que o que se vê
          // corresponda ao que se negocia. Então TODO trade arma alguma coisa,
          // e o TAMANHO escolhe qual, que é a leitura que o espectador faz
          // sozinho depois de ler a legenda: tiro pequeno é negócio pequeno,
          // casca no ar é negócio grande.
          if (rel >= 4) emiteEvento('trade-grande', t.side, Math.min(20, rel))
          else emiteEvento('trade-medio', t.side, Math.min(8, Math.max(1, rel)))
          // sequência do mesmo lado: 2 é carga de esquadrão, 4 é maré (a
          // ofensiva do exército inteiro). Um trade contrário zera a conta.
          if (ladoSeguido === t.side) contaSeguidos++
          else { ladoSeguido = t.side; contaSeguidos = 1 }
          if (contaSeguidos === 2) emiteEvento('sequencia', t.side, 1 + Math.min(6, rel))
          if (contaSeguidos >= 4) {
            emiteEvento('maré', t.side, 2 + Math.min(8, rel))
            contaSeguidos = 0
          }
          // rompimento: o preço passou do teto ou do piso desta sessão. Não
          // usa low24/high24 porque aquilo vem do ticker REST a cada 300 s e
          // chegaria tarde; aqui é o extremo que o próprio feed já viu.
          if (t.price > 0) {
            if (picoSessao === 0) { picoSessao = t.price; valeSessao = t.price }
            else if (t.price > picoSessao * 1.0015) { picoSessao = t.price; emiteEvento('rompimento', 'buy', 6) }
            else if (t.price < valeSessao * 0.9985) { valeSessao = t.price; emiteEvento('rompimento', 'sell', 6) }
          }
        }
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
          vwap24 = t.vwap24 ?? 0
          volume24 = t.volume24 ?? 0
          trades24 = t.trades24 ?? 0
        }
      })
      .catch(() => {})
  }
  buscaTicker()
  const tickerTimer = setInterval(buscaTicker, 300000)

  // ⚠️ O PLACAR NASCIA ZERADO (fundador fotografou): os contadores só viam
  // trades chegados DEPOIS da aba abrir, e o DOG fica minutos em silêncio.
  // Semente única na abertura: os últimos ~200 trades públicos da Kraken
  // (via /api/war/trades, cache de 30s) enchem placar, fita e emaQty, SEM
  // disparar visual nenhum; o WebSocket segue somando ao vivo por cima.
  let semeado = false
  fetch('/api/war/trades')
    .then((r) => r.json())
    .then((d) => {
      if (semeado || !Array.isArray(d?.trades) || d.trades.length === 0) return
      semeado = true
      const qtys: number[] = []
      for (const t of d.trades as Array<{ side: 'buy' | 'sell'; qty: number; price: number; at: number }>) {
        if (!(t.qty > 0)) continue
        qtys.push(t.qty)
        if (t.side === 'buy') {
          compra += t.qty
          ursosCaidos += t.qty
        } else {
          venda += t.qty
          caesCaidos += t.qty
        }
      }
      for (const t of (d.trades as Array<{ side: 'buy' | 'sell'; qty: number; price: number; at: number }>).slice(-8).reverse()) {
        fita.push({ lado: t.side, qty: t.qty, preco: t.price, t: t.at })
      }
      if (fita.length > 8) fita.length = 8
      if (emaQty === 0 && qtys.length) {
        qtys.sort((a, b) => a - b)
        emaQty = qtys[Math.floor(qtys.length / 2)]
      }
    })
    .catch(() => {})

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
    // ⚠️ os degraus ficam guardados em X porque o EVENTO DE ASSALTO dispara ao
    // cruzar um deles. Ver o bloco do assalto no update: a marca já está
    // desenhada no chão, então "o exército passou daquela linha" é uma leitura
    // que o espectador faz sozinho, sem legenda.
    degrausX = precos.map(xDoPreco).sort((u, v) => u - v)
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

  // ── A CORTINA DE PREÇO: o gráfico recente erguido SOBRE a linha de frente ─
  // Dado verdadeiro virando cenário (a crista da referência): amostra o mid a
  // cada 2s, guarda ~2 min e ergue uma cortina aditiva ao longo da costura,
  // topo = preço daquele instante mapeado no range de 24h, pé = a costura.
  // Um mesh, 248 vértices, cor por vértice (brilho no topo, morre no pé).
  // ⚠️ FITA, não véu: a 1ª versão ia do chão ao topo e virava um tubo branco
  // estourado que escondia a costura; e mapear no range de 24h deixava a
  // linha chapada (o mid quase não anda em minutos). Agora é uma fita fina
  // pendurada na linha do preço, normalizada pelo min/max da PRÓPRIA janela
  // recente (com piso de vão pra não amplificar ruído de tick).
  const CORTINA_N = 62
  const cortinaMids: number[] = []
  let cortinaProx = 0
  const cortinaGeo = new THREE.BufferGeometry()
  {
    const pos = new Float32Array(CORTINA_N * 2 * 3)
    const cor = new Float32Array(CORTINA_N * 2 * 3)
    const idx: number[] = []
    for (let i = 0; i < CORTINA_N; i++) {
      const z = -62 + (124 * i) / (CORTINA_N - 1)
      pos.set([0, 4.4, z], i * 6)      // barra de baixo (yTopo - 1.1)
      pos.set([0, 5.5, z], i * 6 + 3)  // topo (a linha do preço, y vivo)
      cor.set([1 * 0.04, 0.8 * 0.04, 0.45 * 0.04], i * 6)
      cor.set([1 * 0.5, 0.82 * 0.5, 0.5 * 0.5], i * 6 + 3)
      if (i < CORTINA_N - 1) {
        const a = i * 2
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
      }
    }
    cortinaGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    cortinaGeo.setAttribute('color', new THREE.BufferAttribute(cor, 3))
    cortinaGeo.setIndex(idx)
  }
  const cortina = new THREE.Mesh(cortinaGeo, new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending,
    depthWrite: false, side: THREE.DoubleSide,
  }))
  semRaycast(cortina)
  cortina.frustumCulled = false
  // sem preço a cortina seria uma faixa chapada flutuando; só aparece com dado
  cortina.visible = false
  group.add(cortina)
  const passoCortina = (agora: number) => {
    if (agora < cortinaProx || !(mid > 0) || !(high24 > low24)) return
    cortina.visible = true
    cortinaProx = agora + 2000
    cortinaMids.push(mid)
    if (cortinaMids.length > CORTINA_N) cortinaMids.shift()
    // normaliza pelo min/max da janela, com piso de vão de 0,12% do mid
    let mn = Infinity
    let mx = -Infinity
    for (const m of cortinaMids) {
      if (m < mn) mn = m
      if (m > mx) mx = m
    }
    const vaoMin = mid * 0.0012
    if (mx - mn < vaoMin) {
      const c = (mx + mn) / 2
      mn = c - vaoMin / 2
      mx = c + vaoMin / 2
    }
    const pos = cortinaGeo.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < CORTINA_N; i++) {
      // mais novo na ponta +z; enquanto o histórico enche, repete o mais velho
      const k = Math.max(0, cortinaMids.length - CORTINA_N + i)
      const m = cortinaMids[Math.min(k, cortinaMids.length - 1)] ?? mid
      const frac = Math.min(1, Math.max(0, (m - mn) / (mx - mn)))
      const topo = 3.4 + frac * 8
      pos.setY(i * 2 + 1, topo)
      pos.setY(i * 2, topo - 1.1)
    }
    pos.needsUpdate = true
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

  // ⚠️ PRECISÃO VISUAL (fundador, 25/08): a escala antiga era 6·raiz(qty/mediana),
  // que esmagava diferenças e mudava com o resto do book. A régua nova é UMA
  // SÓ para os dois lados (exércitos sempre comparáveis entre si) e ADAPTATIVA:
  // parte do piso do tier e sobe apenas o necessário para o MAIOR exército
  // encenado caber no orçamento de instâncias (com 500 níveis o lado pesado
  // estourava o teto e os dois lados ficavam iguais na marra). O valor vivo
  // aparece na legenda do HUD: "1 soldier = X DOG".
  const RATIO_PISO = orc.cap >= 4000 ? 25_000 : orc.cap >= 2000 ? 50_000 : 100_000
  let dogPorSoldadoAtual = RATIO_PISO
  const montaExercito = (ex: Exercito, niveis: BookLevel[], lado: 1 | -1) => {
    let i = 0
    // amostra viva da formação: cada k-ésimo posto entra no Float32Array fixo
    // (lado -1 = cães/bids, 1 = ursos/asks); é daqui que alvoNoExercito sorteia
    const amostra = lado === -1 ? amostraCaes : amostraUrsos
    let nAmostra = 0
    for (let li = 0; li < niveis.length && i < orc.cap; li++) {
      const nv = niveis[li]
      const x0 = precoParaX(nv.price)
      const unidades = Math.max(1, Math.round(nv.qty / dogPorSoldadoAtual))
      // ⚠️ NADA DE DESFILE (fundador, 25/08): a grade de 12 colunas com jitter
      // mínimo lia como parada militar, fileiras 100% organizadas e estreitas.
      // Agora cada nível vira ESQUADRÕES de ~5 espalhados pela frente inteira:
      // o centro do esquadrão sorteia um z em toda a largura do campo (com
      // leve viés pro miolo) e os soldados aglomeram em volta dele, cada um
      // com posto próprio. Tudo por hash determinístico (li, u): o book pode
      // atualizar que os postos não pulam, e a marcha continua suave.
      for (let u = 0; u < unidades && i < orc.cap; u++) {
        const esq = Math.floor(u / 5)
        const zc0 = (hash(li * 53 + esq, 29) - 0.5) * 104
        const zc = zc0 * (0.55 + 0.45 * hash(li * 37 + esq, 31))
        const px = x0 + lado * ((hash(li * 31 + u, 7) - 0.5) * 3.6 + hash(li * 41 + esq, 43) * 2.2)
        const pz = zc + (hash(li * 17 + u, 13) - 0.5) * 4.2
        ex.alvo[i * 3] = px
        ex.alvo[i * 3 + 1] = altura(px, pz) + 0.05
        ex.alvo[i * 3 + 2] = pz
        if (i % PASSO_AMOSTRA === 0 && nAmostra < AMOSTRA_MAX) {
          amostra[nAmostra * 2] = px
          amostra[nAmostra * 2 + 1] = pz
          nAmostra++
        }
        i++
      }
    }
    if (lado === -1) amostraCaesN = nAmostra
    else amostraUrsosN = nAmostra
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
    // profundidade TOTAL (o book inteiro, não só os níveis encenados): o
    // tamanho real de cada exército em DOG e em dólar, mais o spread vivo
    bidsDog = book.bids.reduce((s, l) => s + l.qty, 0)
    asksDog = book.asks.reduce((s, l) => s + l.qty, 0)
    bidsUsd = book.bids.reduce((s, l) => s + l.qty * l.price, 0)
    // ⚠️ bids em dólar = USD de fato comprometido (qty×preço do nível); asks em
    // dólar = o DOG à venda avaliado ao preço de MERCADO, senão asks profundos
    // a preços de sonho inflam a muralha (US$48M numa moeda de US$140M de mcap)
    asksUsd = asksDog * mid
    spreadAtual = book.asks[0].price - book.bids[0].price
    // ── eventos que só o BOOK produz ─────────────────────────────────────
    // PAREDE: apareceu um nível muito maior que o normal deste book. É a
    // ordem grande parada esperando, e é o que na batalha vira o par de
    // canhões daquele lado. Comparado contra a média móvel do maior nível,
    // então "grande" é grande PARA ESTE mercado, não um número fixo.
    {
      const topoBid = book.bids.reduce((m, l) => (l.qty > m ? l.qty : m), 0)
      const topoAsk = book.asks.reduce((m, l) => (l.qty > m ? l.qty : m), 0)
      const topo = Math.max(topoBid, topoAsk)
      // ⚠️⚠️ COMPARAR COM 3 SEGUNDOS ATRÁS, NÃO COM UMA MÉDIA. Duas tentativas
      // falharam antes desta e as duas pelo mesmo motivo: o book chega várias
      // vezes por segundo, então qualquer média móvel alcança o próprio valor
      // e nada nunca fica acima dela. Pior, uma parede que SEMPRE esteve lá não
      // é notícia: com média, ela some na referência; com amostra, ela também
      // não dispara, que é o certo. O que vira evento é a parede CRESCER, e
      // "crescer" só existe contra um instante anterior fixo.
      const agoraBook = performance.now()
      if (agoraBook - tAmostraBook > 3000) {
        if (amostraTopo > 0 && topo > amostraTopo * 1.25) {
          emiteEvento('parede', topoBid >= topoAsk ? 'buy' : 'sell', Math.min(10, topo / amostraTopo))
        }
        if (amostraSpread > 0 && spreadAtual > amostraSpread * 1.2) {
          emiteEvento('spread', hash(Math.floor(spreadAtual * 1e8) % 331, 5) < 0.5 ? 'buy' : 'sell', 2)
        }
        // ⚠️ INCLINAÇÃO DO BOOK: o combustível que nunca acaba. Numa madrugada
        // sem um trade sequer (medido: quatro minutos secos em produção), as
        // ordens continuam entrando e saindo e a proporção entre os dois lados
        // se mexe o tempo todo. Uma mudança nessa proporção vira duelo de
        // vanguarda, a animação pequena para o mercado parado. Continua sendo
        // dado, e NÃO se passa por negócio: como toda arma de book, dispara com
        // qty 0 e não entra em placar, letreiro de dano nem fita.
        //
        // ⚠️ O LIMIAR FOI MEDIDO, DEPOIS DE TRÊS CHUTES ERRADOS. Amostrando o
        // book real por 60 s, a proporção bids/(bids+asks) ficou entre 0,23198
        // e 0,23314: a amplitude INTEIRA é 0,116 ponto percentual, e a variação
        // típica de três em três segundos é cerca de 0,01 pp. O primeiro
        // palpite foi 2 pp, dezessete vezes maior que a faixa toda, e por isso
        // não disparava nunca. 0,015 pp é pouco acima do passo normal, o que dá
        // alguns duelos por minuto. Em DOG isso são ~160 mil trocando de lado
        // num book de 1,09 bilhão: ordem de verdade, não ruído de última casa.
        const totalBook = bidsDog + asksDog
        const inclina = totalBook > 0 ? bidsDog / totalBook : 0.5
        if (amostraInclina > 0 && Math.abs(inclina - amostraInclina) > 0.00015) {
          emiteEvento('inclinacao', inclina > amostraInclina ? 'buy' : 'sell', 1.5)
        }
        amostraInclina = inclina
        tAmostraBook = agoraBook
        amostraTopo = topo
        amostraSpread = spreadAtual
      }
      if (emaNivelTopo === 0) emaNivelTopo = topo
      else {
        // ⚠️ 1,25 e NÃO 1,6: o livro de ofertas é o único combustível que não
        // acaba. Numa madrugada de quatro minutos sem um trade sequer (medido
        // em produção em 27/08), era só daqui que a batalha podia tirar
        // movimento sem mentir. Continua 100% dado: a parede existe mesmo, só
        // que "grande" passou a ser 25% acima do normal deste book em vez de
        // 60%. Quem segura a vazão é o intervalo mínimo do canhão, não o
        // limiar. ⚠️ E nada disto conta no placar: as armas de book disparam
        // com qty 0, então não viram baixa, nem letreiro de dano, nem linha na
        // fita. Regra do fundador: "nada que seja o mercado fazendo trade".
        // (o gatilho por média saiu daqui: ver a nota da amostra de 3 s acima.
        // A média continua sendo calculada porque a legenda publica o "normal")
        // ⚠️ MÉDIA LENTA, e isto é o que fazia o evento nunca acontecer. Com
        // 0,02 por atualização e um book que chega várias vezes por segundo, a
        // média alcançava o próprio pico em cerca de um segundo: o topo nunca
        // conseguia ficar 25% acima de uma referência que corria atrás dele.
        // Com 0,002 a referência passa a ser o normal dos últimos minutos, que
        // é o que a palavra "parede" quer dizer.
        emaNivelTopo = emaNivelTopo * 0.998 + topo * 0.002
      }
      // SPREAD ABERTO: o book afinou, os dois lados recuaram. Na batalha isso
      // vira duelo de vanguarda, que é justamente o momento em que ninguém
      // tem massa para atacar e a briga fica individual.
      if (spreadAtual > 0) {
        if (emaSpread === 0) emaSpread = spreadAtual
        else {
          // 1,25 pelo mesmo motivo da parede: o duelo de vanguarda é a
          // animação pequena que o mercado parado tem direito de mostrar
          // (idem: o spread agora dispara pela amostra de 3 s)
          emaSpread = emaSpread * 0.998 + spreadAtual * 0.002 // ver a nota da parede
        }
      }
    }
    const alcance = Math.max(
      bids.length ? mid - bids[bids.length - 1].price : 0,
      asks.length ? asks[asks.length - 1].price - mid : 0,
    )
    spanSuave = spanSuave === 0 ? alcance : spanSuave * 0.92 + alcance * 0.08
    // a régua se ajusta ANTES de montar: o maior lado encenado dita a escala
    const somaB = bids.reduce((t, l) => t + l.qty, 0)
    const somaA = asks.reduce((t, l) => t + l.qty, 0)
    const maior = Math.max(somaB, somaA)
    dogPorSoldadoAtual = Math.max(RATIO_PISO, Math.ceil(maior / (orc.cap * 0.92) / 5000) * 5000)
    montaExercito(exCaes, bids, -1)
    montaExercito(exUrsos, asks, 1)

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
  // ⚠️ `origem`: canhão de teatro passa a boca da bateria mais próxima (mata o
  // tiro que nasce do nada); sem argumento mantém a fórmula de sempre (o tiro
  // de trade real, que representa pressão de mercado, não uma arma parada)
  // ⚠️ `arma` default 'tiro': cobre trade comum E canhão de teatro (os dois
  // passam pelo mesmo pool `tiros`); a salva de baleia é quem passa 'baleia'
  // ⚠️ `alvo`: as armas de teatro passam o soldado REAL sorteado por
  // alvoNoExercito (mata o z aleatório no campo vazio); sem argumento mantém
  // a fórmula antiga do tiro de trade. `arma` 'canhao'/'mlrs' = teatro
  // pesado: projétil 1.8x maior e voo 1.35x mais lento, o olho ACOMPANHA
  const atira = (lado0: 'buy' | 'sell', qty: number, forca: number, zAlvo: number, sem: number, origem?: THREE.Vector3, arma: Arma = 'tiro', alvo?: THREE.Vector3) => {
    const lado = lado0 === 'buy' ? 1 : -1
    const i = cursorTiro
    cursorTiro = (cursorTiro + 1) % POOL_TIROS
    const mesh = poolTiros[i]
    const rastro = poolRastros[i]
    mesh.material = lado0 === 'buy' ? matTiroCompra : matTiroVenda
    rastro.material = lado0 === 'buy' ? matRastroCompra : matRastroVenda
    mesh.visible = rastro.visible = true
    const teatroPesado = arma === 'canhao' || arma === 'mlrs'
    mesh.scale.setScalar((0.22 * Math.sqrt(forca) + 0.12) * (teatroPesado ? 1.25 : 1))
    if (origem) mesh.userData.de.copy(origem)
    else mesh.userData.de.set(-lado * (14 + hash(sem % 31, 3) * 30) + frenteX, 1.2, zAlvo + (hash(sem % 13, 5) - 0.5) * 30)
    if (alvo) mesh.userData.para.copy(alvo)
    else mesh.userData.para.set(lado * (FRENTE + hash(sem % 7, 11) * 6) + frenteX, 0.8, zAlvo)
    mesh.userData.prev.copy(mesh.userData.de)
    const durBase = 750 + 350 * Math.min(3, forca / 8)
    // ⚠️ CANHÃO É ARMA DE TIRO RASO: o 1.35x lento + arco alto da rodada
    // anterior lia como parábola de escola (o fundador viu "trajetória
    // quadrática"). Canhão agora voa RÁPIDO e quase reto; quem faz arco alto
    // é morteiro, que é a arma de lançar
    tiros.push({
      i, t0: performance.now(), dur: arma === 'canhao' ? durBase * 0.8 : teatroPesado ? durBase * 1.1 : durBase,
      forca, lado: lado0, qty, arma,
      arco: mesh.userData.de.y > 5 ? 2.5 : arma === 'canhao' ? 2.6 + Math.min(5, forca * 0.25) : 6 + Math.min(18, forca),
    })
    // artilharia anuncia o disparo: clarão de boca + baforada na origem.
    // canhão de teatro ganha clarão 1.6x mais forte que o tiro comum: o
    // fundador sentia falta justamente de ENXERGAR o par de canhões atirando
    if (forca > 2) {
      const forcaClarao = arma === 'canhao' ? 1.6 : 1
      clarao(mesh.userData.de, (1.6 + Math.sqrt(forca)) * forcaClarao, lado0 === 'buy' ? 0xffd9a0 : 0xffb09a)
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
      // MLRS: mesmo gatilho da salva de artilharia (8+), então a baleia (16+)
      // dispara os dois sistemas juntos, exatamente como a missão pede
      dispararMLRS(t.side, zAlvo, forca)
    } else {
      atira(t.side, t.qty, forca, zAlvo, t.at)
    }
    if (forca > LIMIAR_BALEIA && onWhale) onWhale(t.side, forca)
  }

  const impacto = (p: THREE.Vector3, forca: number, lado: 'buy' | 'sell', qty: number, arma: Arma) => {
    if (qty > 0) {
      mostraDano(p, qty, lado)
      // caveirinha: marcador de BAIXA REAL. qty>0 só acontece em trade de
      // verdade (a escaramuça/rugido de fundo sempre manda qty 0)
      lib.caveira(p, lado)
    } else if (forca >= 2 && arma !== 'fuzil') {
      // baixa de ENCENAÇÃO pesada (morteiro, tanque, canhão, mlrs, bomba)
      // também merece a caveira: o abate tem que aparecer sempre que soldado
      // tomba, senão o marcador some nos minutos quietos do DOG. O NÚMERO
      // continua só no trade real (a camada de dados nunca inventa DOG)
      lib.caveira(p, lado)
    }
    const cor = lado === 'buy' ? 0xffa64d : 0xff5238
    const mesh = poolOndas[cursorOnda]
    cursorOnda = (cursorOnda + 1) % poolOndas.length
    mesh.material = lado === 'buy' ? matOndaCompra : matOndaVenda
    mesh.visible = true
    mesh.position.copy(p).setY(0.25)
    let luz: THREE.PointLight | null = null
    // o cursor gira dentro das ACESAS, não do pool inteiro: as de cima podem
    // estar apagadas por orçamento do anfitrião e um flash nelas seria perdido
    if (luzesAtivas > 0 && (forca > 2 || cursorOnda % 3 === 0)) {
      if (cursorLuz >= luzesAtivas) cursorLuz = 0
      luz = poolLuzes[cursorLuz]
      cursorLuz = (cursorLuz + 1) % luzesAtivas
      luz.color.setHex(cor)
      luz.position.copy(p).setY(2.5)
      luz.intensity = 30 * escLuz * Math.min(6, forca)
    }
    ondas.push({ mesh, luz, t0: performance.now(), forca })

    emitPoeira(p, forca)
    emitFaiscas(p, forca)
    marcaCicatriz(p, forca)

    // ⚠️ A LINGUAGEM DA EXPLOSÃO: cada arma tem a SUA (biblioteca
    // explosions.ts), não mais a mesma bola branca pra todas. O flash de
    // impacto (flashPool aqui + flashDeTela) também deixou de ser gigante
    // pra tudo: só bomba e força alta merecem flash grande agora, o resto
    // reduz proporcionalmente e tinge pelo lado.
    if (forca > 0.3) {
      switch (arma) {
        case 'fuzil': {
          // nada de bola: só faíscas + poeira (já feito acima) + flash pequeno
          const sp = flashPool[flashCursor]
          flashCursor = (flashCursor + 1) % POOL_FLASH
          ;(sp.material as THREE.SpriteMaterial).color.setHex(lado === 'buy' ? 0xffe1b0 : 0xffb0a0)
          sp.position.copy(p).setY(1.3)
          sp.userData.base = 1.1 + Math.sqrt(forca) * 0.7
          sp.scale.setScalar(sp.userData.base)
          ;(sp.material as THREE.SpriteMaterial).opacity = 1
          sp.visible = true
          sp.userData.t0 = performance.now()
          break
        }
        case 'tiro': {
          const sp = flashPool[flashCursor]
          flashCursor = (flashCursor + 1) % POOL_FLASH
          ;(sp.material as THREE.SpriteMaterial).color.setHex(lado === 'buy' ? 0xffe1b0 : 0xffb0a0)
          sp.position.copy(p).setY(1.5)
          sp.userData.base = (2.4 + Math.sqrt(forca) * 2) * 0.65
          sp.scale.setScalar(sp.userData.base)
          ;(sp.material as THREE.SpriteMaterial).opacity = 1
          sp.visible = true
          sp.userData.t0 = performance.now()
          // tiro comum: a bola de sempre, mas tintada pelo lado (não mais o
          // laranja fixo genérico) e com o flash de chão reduzido
          explodeBola(p, forca, cor)
          flashDeTela(p, forca * 0.55, cor)
          break
        }
        case 'morteiro':
          // obus levanta chão: sem bola de fogo
          lib.fontanaDeTerra(p, forca)
          break
        case 'mlrs':
          // rajada seca de 3 estouros brancos-quentes
          lib.clusterQuente(p, forca)
          break
        case 'bomba':
          // a única que pode ser gorda: flash grande de verdade
          lib.bombaAerea(p, forca)
          flashDeTela(p, forca, cor)
          break
        case 'tanque':
          // fontana de terra + flash médio extra (a casca é mais pesada)
          lib.fontanaDeTerra(p, forca)
          flashDeTela(p, forca * 0.55, cor)
          break
        case 'canhao':
          // assinatura própria do canhão de teatro: fontana de terra pequena
          // (a casca é mais leve que a do tanque) + flash médio
          lib.fontanaDeTerra(p, forca * 0.6)
          flashDeTela(p, forca * 0.5, cor)
          break
        case 'baleia':
          // salva de trade grande: chamas residuais contam a história
          lib.incendiaria(p, forca)
          break
      }
    }

    // fumaça genérica e coluna de fogo só sobram pro 'tiro': as outras armas
    // já carregam a própria fumaça/coluna dentro da assinatura da lib, ou
    // (morteiro/mlrs/tanque) são deliberadamente "sem bola de fogo"
    if (forca > 2 && arma === 'tiro') solta_fumaca(p, forca)
    if (forca > 3) {
      opcoes.onImpactoGrande?.(forca)
      if (arma === 'tiro' || arma === 'baleia') {
        colunaDeFogo(p, forca)
        emitDestrocos(p, forca)
      }
    }
    if (lado === 'buy') tomba(detritoUrsos, curUrsos, p, Math.min(14, 1 + Math.round(forca)))
    else tomba(detritoCaes, curCaes, p, Math.min(14, 1 + Math.round(forca)))
  }

  // ── o pulso ─────────────────────────────────────────────────────────────
  let ultimoBook = 0
  let ultimoUpdate = 0
  let ultimaEscaramuca = 0
  // ⚠️ INTERVALO MÍNIMO NÃO É CADÊNCIA: não gera disparo nenhum, só impede que
  // uma rajada de trades vire uma parede de cascas no mesmo segundo
  let ultimoMorteiro = 0
  let ultimoCanhao = 0
  let ultimoEsquadraoEv = 0
  let ultimoDueloEv = 0
  let ultimoBombardeioEv = 0
  let proxArtilharia = 0
  let proxCanhao = 0
  // ⚠️ VIÉS PRO CENTRO: o retrato do celular enquadra um trecho estreito da
  // frente; alvo uniforme em ±52 joga metade das bombas pra fora do quadro e
  // o espectador móvel só vê tiro pequeno. 60% dos disparos caem no miolo.
  const zAlvoGuerra = (a: number, b: number) => {
    const z = (hash(a, b) - 0.5) * 105
    return hash(a + 1, b + 3) < 0.6 ? z * 0.45 : z
  }
  const passo = new THREE.Vector3()
  const zEixo = new THREE.Vector3(0, 0, 1)

  // ═══════════════════════════════════════════════════════════════════════
  // 7. VEÍCULOS (vehicles.ts): cavalaria, helicóptero de ataque e jipe de
  // metralhadora. Mesma técnica de tanques/baterias acima: geometria única
  // fundida por peça, material reaproveitado (matTanque, MeshStandardMaterial
  // vertexColors, nenhum shader novo aqui), pools fixos criados na montagem
  // e um único ponto de atualização por frame (passoVeiculos), chamado logo
  // depois de atualizaBaterias no laço principal.
  // ═══════════════════════════════════════════════════════════════════════

  // orçamento por tier (mesmo corte de orc.cap usado no resto do arquivo):
  // alto ganha cavalaria cheia, helicóptero e 2 jipes por lado; médio ainda
  // tem helicóptero mas só 1 jipe; fraco (mobile) fica sem helicóptero.
  const tierAlto = orc.cap >= 4000
  const tierMedio = orc.cap >= 2000

  // fila de impactos atrasados: helicóptero e jipe agendam rajadas de
  // 'fuzil' que caem alguns quadros no futuro (~90ms entre tiros da mesma
  // rajada). Pool fixo de números, sem Vector3 por evento: a posição só vira
  // THREE.Vector3 no instante do disparo, reaproveitando o `vp` de cima.
  const CAP_IMPACTO_ATRASADO = 32
  const impAt = new Float32Array(CAP_IMPACTO_ATRASADO)
  const impX = new Float32Array(CAP_IMPACTO_ATRASADO)
  const impZ = new Float32Array(CAP_IMPACTO_ATRASADO)
  const impForca = new Float32Array(CAP_IMPACTO_ATRASADO)
  const impLado = new Uint8Array(CAP_IMPACTO_ATRASADO) // 0 = buy, 1 = sell
  const impArma: Arma[] = new Array(CAP_IMPACTO_ATRASADO).fill('fuzil')
  const impAtiva = new Uint8Array(CAP_IMPACTO_ATRASADO)
  let cursorImpAtrasado = 0
  const agendaImpacto = (at: number, x: number, z: number, forca: number, lado: 'buy' | 'sell', arma: Arma) => {
    const i = cursorImpAtrasado
    cursorImpAtrasado = (cursorImpAtrasado + 1) % CAP_IMPACTO_ATRASADO
    impAt[i] = at
    impX[i] = x
    impZ[i] = z
    impForca[i] = forca
    impLado[i] = lado === 'buy' ? 0 : 1
    impArma[i] = arma
    impAtiva[i] = 1
  }

  // ── 7a. CAVALARIA: um InstancedMesh por lado, pool do tamanho do maior
  // grupo de carga possível no tier (8 alto, 5 médio, 3 fraco). Só uma carga
  // fica ativa por vez (mesmo desenho da carga de esquadrão acima): parte da
  // retaguarda, cruza até perto da costura, faz meia-volta larga e volta pra
  // própria linha. 1 em cada 4 cargas termina com o cavaleiro da frente
  // tombando bem na costura.
  const capCavalaria = tierAlto ? 8 : tierMedio ? 5 : 3
  const geoCavaloDog = buildCavaleiroGeometry('dog', 1)
  const geoCavaloUrso = buildCavaleiroGeometry('bear', -1)
  const cavCaes = new THREE.InstancedMesh(geoCavaloDog, matTanque, capCavalaria)
  const cavUrsos = new THREE.InstancedMesh(geoCavaloUrso, matTanque, capCavalaria)
  cavCaes.count = 0
  cavUrsos.count = 0
  for (const m of [cavCaes, cavUrsos]) {
    semRaycast(m)
    m.frustumCulled = false
  }
  group.add(cavCaes, cavUrsos)

  type FaseCavalo = 0 | 1 | 2 | 3 | 4 // 0 indo, 1 virando, 2 voltando, 3 caindo, 4 concluído
  interface Cavaleiro { x: number; z: number; fase: FaseCavalo; t0: number }
  interface Cavalgada { lado: 'buy' | 'sell' | null; sentido: 1 | -1; n: number; temQueda: boolean; cavaleiros: Cavaleiro[] }
  const cavalgada: Cavalgada = {
    lado: null, sentido: 1, n: 0, temQueda: false,
    cavaleiros: Array.from({ length: capCavalaria }, () => ({ x: 0, z: 0, fase: 4 as FaseCavalo, t0: 0 })),
  }
  const FOLGA_CAVALO = 2.6
  const X_CAVALO_RETAGUARDA = FRENTE + 30
  const VEL_CAVALO = 7 * 2.6 // ~2.6x a velocidade de marcha da infantaria (7/s)
  const DUR_VIRADA_CAVALO = 700
  let contadorCargas = 0
  let proxCarga = performance.now() + 7000 + hash(3, 91) * 5000

  const iniciaCargaCavalaria = (agora: number) => {
    const press = matCostura.uniforms.pressao.value
    const lado: 'buy' | 'sell' = hash(Math.floor(agora) % 947, 53) < press ? 'buy' : 'sell'
    const sentido: 1 | -1 = lado === 'buy' ? 1 : -1
    const n = Math.min(capCavalaria, 3 + Math.floor(hash(Math.floor(agora) % 733, 61) * 4))
    contadorCargas++
    cavalgada.lado = lado
    cavalgada.sentido = sentido
    cavalgada.n = n
    cavalgada.temQueda = contadorCargas % 4 === 0
    const zEvento = zAlvoGuerra(Math.floor(agora) % 1451, 67)
    const mesh = lado === 'buy' ? cavCaes : cavUrsos
    mesh.count = n
    for (let i = 0; i < n; i++) {
      const c = cavalgada.cavaleiros[i]
      // espalhamento organico por hash, não uma grade linear
      c.z = zEvento + (hash(contadorCargas * 17 + i, 71) - 0.5) * 26
      c.x = frenteX - sentido * X_CAVALO_RETAGUARDA
      c.fase = 0
      c.t0 = agora + i * (60 + hash(i, contadorCargas) * 90) // partida em leque, não em bloco só
    }
  }

  const atualizaCavalgada = (agora: number, dt: number) => {
    if (cavalgada.lado === null) {
      if (agora >= proxCarga) iniciaCargaCavalaria(agora)
      return
    }
    const lado = cavalgada.lado
    const sentido = cavalgada.sentido
    const mesh = lado === 'buy' ? cavCaes : cavUrsos
    const xSeam = frenteX - sentido * FOLGA_CAVALO
    const xVolta = frenteX - sentido * X_CAVALO_RETAGUARDA
    let algumAtivo = false
    for (let i = 0; i < cavalgada.n; i++) {
      const c = cavalgada.cavaleiros[i]
      const ehFrente = cavalgada.temQueda && i === 0
      const galope = agora * 0.02011 + i * 1.7
      if (c.fase !== 4) algumAtivo = true
      if (c.fase === 0) {
        if (agora >= c.t0) {
          const dx = xSeam - c.x
          c.x += Math.sign(dx) * Math.min(Math.abs(dx), VEL_CAVALO * dt)
        }
        const swayZ = Math.sin(galope) * 0.16
        const bobY = Math.abs(Math.sin(galope * 2)) * 0.14
        eu.set(0, 0, swayZ)
        q.setFromEuler(eu)
        vp.set(c.x, altura(c.x, c.z) + bobY, c.z)
        vs.setScalar(1)
        m4.compose(vp, q, vs)
        mesh.setMatrixAt(i, m4)
        if (Math.abs(xSeam - c.x) < 0.35) {
          if (ehFrente) {
            c.fase = 3
            c.t0 = agora
            vp.set(c.x, altura(c.x, c.z) + 0.4, c.z)
            const detrito = lado === 'buy' ? detritoCaes : detritoUrsos
            const cursorDet = lado === 'buy' ? curCaes : curUrsos
            tomba(detrito, cursorDet, vp, 1)
            lib.fontanaDeTerra(vp, 5)
          } else {
            c.fase = 1
            c.t0 = agora
          }
        }
      } else if (c.fase === 1) {
        // meia-volta larga: gira até PI ao mesmo tempo que a costura empurra
        // o grupo pra fora do eixo Z, como um arco de verdade
        const f = Math.min(1, (agora - c.t0) / DUR_VIRADA_CAVALO)
        const rotY = f * Math.PI
        const zVisual = c.z + Math.sin(f * Math.PI) * sentido * 3.2
        const swayZ = Math.sin(galope) * 0.1
        eu.set(0, rotY, swayZ)
        q.setFromEuler(eu)
        vp.set(c.x, altura(c.x, zVisual), zVisual)
        vs.setScalar(1)
        m4.compose(vp, q, vs)
        mesh.setMatrixAt(i, m4)
        if (f >= 1) {
          c.fase = 2
          c.t0 = agora
        }
      } else if (c.fase === 2) {
        const dx = xVolta - c.x
        c.x += Math.sign(dx) * Math.min(Math.abs(dx), VEL_CAVALO * dt)
        const swayZ = Math.sin(galope) * 0.16
        const bobY = Math.abs(Math.sin(galope * 2)) * 0.14
        eu.set(0, Math.PI, swayZ)
        q.setFromEuler(eu)
        vp.set(c.x, altura(c.x, c.z) + bobY, c.z)
        vs.setScalar(1)
        m4.compose(vp, q, vs)
        mesh.setMatrixAt(i, m4)
        if (Math.abs(xVolta - c.x) < 0.4) c.fase = 4
      } else if (c.fase === 3) {
        // caindo: pitch pra frente + encolhe até sumir, mesma linguagem do
        // tombo de infantaria (arremesso->repouso), só que mais curto
        const f = Math.min(1, (agora - c.t0) / 900)
        eu.set(f * (Math.PI / 2), 0, 0)
        q.setFromEuler(eu)
        vp.set(c.x, altura(c.x, c.z) + 0.05, c.z)
        vs.setScalar(1 - f)
        m4.compose(vp, q, vs)
        mesh.setMatrixAt(i, m4)
        if (f >= 1) c.fase = 4
      }
    }
    mesh.instanceMatrix.needsUpdate = true
    if (!algumAtivo) {
      cavalgada.lado = null
      mesh.count = 0
      const intervalo = 26000 - intensidade * 12000 // 14 a 26s, mais curto com mais intensidade
      proxCarga = agora + intervalo * (0.85 + hash(Math.floor(agora) % 599, 79) * 0.3)
    }
  }

  // ── 7b. HELICÓPTERO DE ATAQUE: 1 por lado, só nos tiers alto e médio (um
  // Group com 3 sub-meshes girando o tempo todo não cabe no tier fraco).
  // ⚠️ LIÇÃO DO FUNDADOR: arma que o espectador nunca vê não existe. O heli
  // NUNCA sai do ar (não há mais 'fora'/'saindo' por limiar de intensidade,
  // só a entrada suave de quando a cena monta); a intensidade deixou de
  // decidir SE ele voa e passou a modular COMO ele voa (velocidade do
  // strafe e cadência da rajada), presença permanente, comportamento
  // variável.
  const X_RECUO_HELI = 18
  const HELI_Z_LIMITE = 46
  const VEL_HELI = 9
  // ⚠️ CORRIDA DE ATAQUE (fundador, 25/08: "os helicópteros ficam voando de
  // lado, não disparam nada"): além da patrulha, o heli entra num ciclo de
  // ataque a cada 9-16s (escalado por intensidade): gira o nariz PARA um
  // soldado real do inimigo, mergulha ~4 de altitude em ~1s, solta 2
  // foguetes visíveis (250ms entre eles) da PONTA_ARMA_HELI, varre o MESMO
  // alvo com uma rajada traçante de ~1s (6 tiros de fuzil a ~90ms, origem na
  // ponta da arma em coordenada de mundo) e só então sobe de volta
  type FaseAtaqueHeli = 'patrulha' | 'mergulho' | 'fogo' | 'rajada' | 'subida'
  interface Heli {
    lado: 'buy' | 'sell'
    sentido: 1 | -1
    grupo: THREE.Group
    corpo: THREE.Mesh
    rotorGrupo: THREE.Group
    rotorCaudaGrupo: THREE.Group
    estado: 'entrando' | 'combate'
    t0: number
    z: number
    dirZ: 1 | -1
    headingY: number
    fase: number
    altBase: number
    faseAtaque: FaseAtaqueHeli
    proxAtaque: number
    tAtaque: number
    alvoAtaqueX: number
    alvoAtaqueZ: number
    foguetesRestantes: number
    proxFoguete: number
    mergulho: number
  }
  const criaHeli = (lado: 'buy' | 'sell', semente: number): Heli => {
    const sentido: 1 | -1 = lado === 'buy' ? 1 : -1
    const geo = buildHelicopteroGeometry(lado === 'buy' ? 'dog' : 'bear')
    const corpo = new THREE.Mesh(geo.corpo, matTanque)
    const rotorMesh = new THREE.Mesh(geo.rotor, matTanque)
    const rotorCaudaMesh = new THREE.Mesh(geo.rotorCauda, matTanque)
    semRaycast(corpo)
    semRaycast(rotorMesh)
    semRaycast(rotorCaudaMesh)
    corpo.frustumCulled = rotorMesh.frustumCulled = rotorCaudaMesh.frustumCulled = false
    const rotorGrupo = new THREE.Group()
    rotorGrupo.position.set(HELI_ROTOR_X, ALTURA_ROTOR, HELI_ROTOR_Z)
    rotorGrupo.add(rotorMesh)
    const rotorCaudaGrupo = new THREE.Group()
    rotorCaudaGrupo.position.set(HELI_CAUDA_X, HELI_CAUDA_Y, HELI_CAUDA_Z)
    rotorCaudaGrupo.add(rotorCaudaMesh)
    const grupo = new THREE.Group()
    grupo.add(corpo, rotorGrupo, rotorCaudaGrupo)
    grupo.visible = true
    group.add(grupo)
    const dirZ: 1 | -1 = hash(semente, 131) < 0.5 ? 1 : -1
    return {
      lado, sentido, grupo, corpo, rotorGrupo, rotorCaudaGrupo,
      estado: 'entrando', t0: performance.now(), z: 0, dirZ,
      headingY: dirZ > 0 ? Math.PI / 2 : -Math.PI / 2,
      fase: hash(semente, 137) * Math.PI * 2,
      altBase: 15,
      faseAtaque: 'patrulha',
      proxAtaque: performance.now() + 5000 + hash(semente, 149) * 5000,
      tAtaque: 0, alvoAtaqueX: 0, alvoAtaqueZ: 0,
      foguetesRestantes: 0, proxFoguete: 0, mergulho: 0,
    }
  }
  // 1 heli por lado em TODOS os tiers, decolando na montagem e NUNCA saindo:
  // são 2 Groups de ~3 meshes, custo irrisório perto do exército instanciado,
  // e o fundador assiste pelo celular
  const helis: Heli[] = [criaHeli('buy', 1), criaHeli('sell', 2)]
  const bocaHeli = new THREE.Vector3()
  const direcaoHeli = new THREE.Vector3()

  const atualizaHelicopteros = (agora: number, dt: number) => {
    for (const h of helis) {
      const emAtaque = h.faseAtaque !== 'patrulha'
      // strafe 0.7x (calmaria) a 1.4x (pico): a intensidade nunca decide SE
      // ele voa, só o RITMO do voo. Na corrida de ataque o vaivém CONGELA:
      // o heli paira e encara o alvo, senão o foguete nasce torto
      if (!emAtaque) {
        const velHeli = VEL_HELI * (0.7 + 0.7 * intensidade)
        h.z += h.dirZ * velHeli * dt
        if (h.z > HELI_Z_LIMITE) { h.z = HELI_Z_LIMITE; h.dirZ = -1 }
        else if (h.z < -HELI_Z_LIMITE) { h.z = -HELI_Z_LIMITE; h.dirZ = 1 }
      }
      const x = frenteX - h.sentido * X_RECUO_HELI
      // o heading persegue a direção do vaivém com atraso: o próprio atraso
      // é a virada, e o quanto falta pra chegar É o banco (rotation.z).
      // Em ataque, persegue o AZIMUTE do alvo (nariz local = +x, mesma
      // convenção da antiaérea: atan2(-dz, dx))
      const alvoHeading = emAtaque
        ? Math.atan2(-(h.alvoAtaqueZ - h.grupo.position.z), h.alvoAtaqueX - h.grupo.position.x)
        : h.dirZ > 0 ? Math.PI / 2 : -Math.PI / 2
      const faltaHeading = anguloWrap(alvoHeading - h.headingY)
      h.headingY += faltaHeading * Math.min(1, dt * (emAtaque ? 4.5 : 3.2))
      // ⚠️ ALTITUDE RELATIVA AO TERRENO, nunca a y=0: com duna ou parede de
      // cratera o voo em cota fixa ENTRAVA NO CHÃO (o fundador viu). Voo de
      // contorno: o chão local + folga, suavizado pra não sacolejar no relevo
      const chao = altura(x, h.z)
      h.altBase += (Math.max(13, chao + 13) - h.altBase) * Math.min(1, dt * 2.2)
      let y = h.altBase - h.mergulho + Math.sin(agora * 0.0009 + h.fase) * 2
      if (h.estado === 'entrando') {
        const f = Math.min(1, (agora - h.t0) / 1200)
        y -= (1 - f) * 14
        if (f >= 1) h.estado = 'combate'
      }
      h.grupo.position.set(x, y, h.z)
      const banco = THREE.MathUtils.clamp(faltaHeading * 0.7, -0.3, 0.3)
      // pitch de mergulho: o nariz abaixa junto com a perda de altitude
      h.grupo.rotation.set(h.mergulho * 0.06, h.headingY, banco)
      h.rotorGrupo.rotation.y += 28 * dt
      h.rotorCaudaGrupo.rotation.x += 40 * dt
      if (h.estado !== 'combate') continue
      // ── o ciclo da corrida de ataque ──────────────────────────────────
      if (h.faseAtaque === 'patrulha') {
        if (agora > h.proxAtaque) {
          // alvo = soldado REAL do exército inimigo; sem amostra (book ainda
          // vazio), tenta de novo daqui a pouco em vez de atirar no nada
          if (alvoNoExercito(h.lado === 'buy' ? 'sell' : 'buy', vAlvoTeatro)) {
            h.faseAtaque = 'mergulho'
            h.tAtaque = agora
            h.alvoAtaqueX = vAlvoTeatro.x
            h.alvoAtaqueZ = vAlvoTeatro.z
          } else {
            h.proxAtaque = agora + 2000
          }
        }
      } else if (h.faseAtaque === 'mergulho') {
        const f = Math.min(1, (agora - h.tAtaque) / 1000)
        h.mergulho = 4 * f
        if (f >= 1) {
          h.faseAtaque = 'fogo'
          h.foguetesRestantes = 2
          h.proxFoguete = agora
        }
      } else if (h.faseAtaque === 'fogo') {
        if (h.foguetesRestantes > 0 && agora >= h.proxFoguete) {
          h.foguetesRestantes--
          h.proxFoguete = agora + 250
          // foguete VISÍVEL saindo da ponta da arma em coordenada de mundo:
          // clarão de boca no nariz + projétil do pool de tiros com origem
          // custom, arco raso (atira detecta origem no ar) e impacto 'mlrs'
          h.corpo.updateWorldMatrix(true, false)
          paraLocal(bocaHeli.set(PONTA_ARMA_HELI, -0.28, 0).applyMatrix4(h.corpo.matrixWorld))
          direcaoParaLocal(direcaoHeli.set(1, 0, 0).transformDirection(h.corpo.matrixWorld))
          lib.claraoDeBoca(bocaHeli, direcaoHeli, 4)
          vAlvoTeatro.set(
            h.alvoAtaqueX + (hash(h.foguetesRestantes, Math.floor(agora) % 311) - 0.5) * 3,
            0,
            h.alvoAtaqueZ + (hash(h.foguetesRestantes + 3, Math.floor(agora) % 271) - 0.5) * 3,
          )
          vAlvoTeatro.y = altura(vAlvoTeatro.x, vAlvoTeatro.z) + 0.4
          atira(h.lado, 0, 4, vAlvoTeatro.z, Math.floor(agora) % 9973, bocaHeli, 'mlrs', vAlvoTeatro)
        }
        if (h.foguetesRestantes === 0 && agora > h.proxFoguete) {
          // acabaram os foguetes: rajada traçante no MESMO alvo, saindo da
          // ponta da arma em mundo. Agenda os 6 tiros de uma vez na fila da
          // fuzilaria (pool fixo) e segura o mergulho até a rajada acabar
          h.faseAtaque = 'rajada'
          h.tAtaque = agora
          h.corpo.updateWorldMatrix(true, false)
          paraLocal(bocaHeli.set(PONTA_ARMA_HELI, -0.28, 0).applyMatrix4(h.corpo.matrixWorld))
          direcaoParaLocal(direcaoHeli.set(1, 0, 0).transformDirection(h.corpo.matrixWorld))
          // clarão pequeno só no primeiro tiro: pontua o início da rajada
          lib.claraoDeBoca(bocaHeli, direcaoHeli, 2)
          for (let k = 0; k < 6; k++) {
            filaRajada.push({
              at: agora + k * 90,
              lado: h.lado,
              z: h.alvoAtaqueZ,
              forca: 1,
              ultima: k === 5,
              origemX: bocaHeli.x,
              origemY: bocaHeli.y,
              origemZ: bocaHeli.z,
              alvoX: h.alvoAtaqueX + (hash(k, Math.floor(agora) % 383) - 0.5) * 2.4,
              alvoZ: h.alvoAtaqueZ + (hash(k + 7, Math.floor(agora) % 359) - 0.5) * 2.4,
            })
          }
        }
      } else if (h.faseAtaque === 'rajada') {
        // paira encarando o alvo enquanto a rajada corre (~0.9s de mergulho
        // a mais); a fila acima cuida dos tiros, aqui só se segura a altitude
        h.mergulho = 4
        if (agora - h.tAtaque > 900) {
          h.faseAtaque = 'subida'
          h.tAtaque = agora
        }
      } else {
        // subida: devolve a altitude e volta pra patrulha
        const f = Math.min(1, (agora - h.tAtaque) / 1200)
        h.mergulho = 4 * (1 - f)
        if (f >= 1) {
          h.faseAtaque = 'patrulha'
          // ciclo a cada 9-16s: 16s no piso de calmaria, 9s no pico, sempre
          // saindo da INTENSIDADE (nunca timer fixo)
          h.proxAtaque = agora + (16000 - intensidade * 7000) * (0.85 + hash(Math.floor(agora) % 431, h.sentido + 5) * 0.3)
        }
      }
    }
  }

  // ── 7c. JIPE DE METRALHADORA: patrulha atrás da própria linha, arma
  // varrendo em Y (já aponta pro inimigo por construção, sentido embutido na
  // geometria), rajada curta de tempos em tempos.
  const N_JIPE = tierAlto ? 2 : 1
  const X_RECUO_JIPE = 24
  const JIPE_Z_LIMITE = 40
  const VEL_JIPE = 4.5
  interface Jipe {
    lado: 'buy' | 'sell'
    sentido: 1 | -1
    grupo: THREE.Group
    armaGrupo: THREE.Group
    z: number
    dirZ: 1 | -1
    fase: number
    proxRajada: number
  }
  const criaJipe = (lado: 'buy' | 'sell', idx: number): Jipe => {
    const sentido: 1 | -1 = lado === 'buy' ? 1 : -1
    const geo = buildJipeGeometry(lado === 'buy' ? 'dog' : 'bear', sentido)
    const corpo = new THREE.Mesh(geo.corpo, matTanque)
    const armaMesh = new THREE.Mesh(geo.arma, matTanque)
    semRaycast(corpo)
    semRaycast(armaMesh)
    corpo.frustumCulled = armaMesh.frustumCulled = false
    const armaGrupo = new THREE.Group()
    armaGrupo.position.set(sentido * JIPE_PIVO_ARMA_X, JIPE_PIVO_ARMA_Y, 0)
    armaGrupo.add(armaMesh)
    const grupo = new THREE.Group()
    grupo.add(corpo, armaGrupo)
    group.add(grupo)
    return {
      lado, sentido, grupo, armaGrupo,
      z: (idx - (N_JIPE - 1) / 2) * 22,
      dirZ: idx % 2 === 0 ? 1 : -1,
      fase: hash(idx, lado === 'buy' ? 7 : 11),
      proxRajada: performance.now() + 1500 + hash(idx, lado === 'buy' ? 13 : 17) * 3500,
    }
  }
  const jipes: Jipe[] = []
  for (const lado of ['buy', 'sell'] as const) {
    for (let k = 0; k < N_JIPE; k++) jipes.push(criaJipe(lado, k))
  }
  const bocaJipe = new THREE.Vector3()
  const direcaoJipe = new THREE.Vector3()

  const atualizaJipes = (agora: number, dt: number) => {
    for (const j of jipes) {
      j.z += j.dirZ * VEL_JIPE * dt
      if (j.z > JIPE_Z_LIMITE) { j.z = JIPE_Z_LIMITE; j.dirZ = -1 }
      else if (j.z < -JIPE_Z_LIMITE) { j.z = -JIPE_Z_LIMITE; j.dirZ = 1 }
      const x = frenteX - j.sentido * X_RECUO_JIPE
      const y = altura(x, j.z) + Math.abs(Math.sin(agora * 0.006 + j.fase * 10)) * 0.05
      j.grupo.position.set(x, y, j.z)
      j.armaGrupo.rotation.y = Math.sin(agora * 0.0007 + j.fase * 10) * 0.3
      if (agora > j.proxRajada) {
        j.proxRajada = agora + 4000 + hash(Math.floor(agora) % 277, j.z + j.sentido) * 4000
        j.armaGrupo.updateWorldMatrix(true, false)
        paraLocal(bocaJipe.set(j.sentido * BOCA_ARMA_JIPE, 0, 0).applyMatrix4(j.armaGrupo.matrixWorld))
        direcaoParaLocal(direcaoJipe.set(j.sentido, 0, 0).transformDirection(j.armaGrupo.matrixWorld))
        lib.claraoDeBoca(bocaJipe, direcaoJipe, 2)
        // a rajada do jipe cai num soldado real da amostra, não num x teórico
        const temAlvoJipe = alvoNoExercito(j.lado === 'buy' ? 'sell' : 'buy', vAlvoTeatro)
        const alvoX = temAlvoJipe ? vAlvoTeatro.x : frenteX + j.sentido * (FRENTE + 4 + hash(Math.floor(agora) % 191, j.z) * 8)
        const alvoZ = temAlvoJipe ? vAlvoTeatro.z : j.z
        for (let k = 0; k < 2; k++) {
          agendaImpacto(agora + k * 90, alvoX + (hash(k + 5, j.z) - 0.5) * 2, alvoZ + (hash(k, j.z + agora) - 0.5) * 6, 1, j.lado, 'fuzil')
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 7e. POSIÇÕES FIXAS (emplacements.ts): tanque de guarda, antiaérea+flak,
  // ninho de metralhadora e trincheira. ⚠️ LIÇÃO DO FUNDADOR: o heli nunca
  // aparecia, o tanque nunca aparecia, o canhão sumiu, tudo porque a
  // presença deles dependia de um gatilho raro. Presença é PERMANENTE aqui;
  // intensidade só modula CADÊNCIA e VELOCIDADE, nunca existência.
  // ═══════════════════════════════════════════════════════════════════════

  // ── 7e-1. TANQUE DE GUARDA: 2 por lado (1 no tier fraco), diferente do
  // surto de avaliaTanques (que entra/sai com o volume real): este nunca
  // sai, só patrulha devagar atrás da própria linha e atira no próprio
  // relógio. Reaproveita a geometria de tanks.ts e dispararTanque/
  // esteiraPoeiraTanque, os mesmos que os tanques de surto já usam.
  // ⚠️ recuo 14 escondia o tanque DENTRO da massa de infantaria (o fundador
  // não viu nenhum); a 9 ele patrulha a borda da terra de ninguém, visível
  const X_TANQUE_GUARDA_RECUO = 9
  const TANQUE_GUARDA_Z_LIMITE = 38
  const VEL_TANQUE_GUARDA = 2.6
  interface TanqueGuarda extends Tanque {
    dirZ: 1 | -1
  }
  const criaTanqueGuarda = (lado: 'buy' | 'sell', z: number): TanqueGuarda => {
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
    const x = frenteX - sentido * X_TANQUE_GUARDA_RECUO
    grupo.position.set(x, altura(x, z), z)
    group.add(grupo)
    return {
      grupo, casco, torreGrupo, lado, sentido, z, estado: 'combate',
      proxTiro: performance.now() + 2000 + hash(z, sentido) * 4000,
      recuoT0: 0, mira: 0, proxPoeira: 0,
      dirZ: hash(z, sentido + 9) < 0.5 ? 1 : -1,
    }
  }
  const N_TANQUE_GUARDA = tierMedio ? 2 : 1
  const Z_TANQUE_GUARDA = tierMedio ? [-18, 18] : [0]
  const tanquesGuarda: TanqueGuarda[] = []
  for (const lado of ['buy', 'sell'] as const) {
    for (let k = 0; k < N_TANQUE_GUARDA; k++) tanquesGuarda.push(criaTanqueGuarda(lado, Z_TANQUE_GUARDA[k]))
  }
  const atualizaTanquesGuarda = (agora: number, dt: number) => {
    for (const t of tanquesGuarda) {
      t.z += t.dirZ * VEL_TANQUE_GUARDA * dt
      if (t.z > TANQUE_GUARDA_Z_LIMITE) { t.z = TANQUE_GUARDA_Z_LIMITE; t.dirZ = -1 }
      else if (t.z < -TANQUE_GUARDA_Z_LIMITE) { t.z = -TANQUE_GUARDA_Z_LIMITE; t.dirZ = 1 }
      const x = frenteX - t.sentido * X_TANQUE_GUARDA_RECUO
      t.grupo.position.set(x, altura(x, t.z) + Math.abs(Math.sin(agora * 0.006 + t.z)) * 0.03, t.z)
      if (Math.abs(t.dirZ) * VEL_TANQUE_GUARDA * dt > 0.02) esteiraPoeiraTanque(t, agora)
      t.mira += (Math.sin(agora * 0.0006 + t.z) * 0.15 - t.mira) * Math.min(1, dt * 1.2)
      t.torreGrupo.rotation.y = t.mira
      // mesmo recuo de canhão de atualizaTanques
      if (t.recuoT0 > 0) {
        const f = (agora - t.recuoT0) / 260
        if (f >= 1) {
          t.recuoT0 = 0
          t.casco.position.x = 0
        } else t.casco.position.x = -t.sentido * 0.45 * (1 - f) * (1 - f)
      }
      // canhão a cada 7-14s, mais rápido quanto maior a intensidade
      if (agora > t.proxTiro) {
        const centro = 14000 - intensidade * 7000
        const jitter = (hash(Math.floor(agora) % 613, t.z) - 0.5) * 4000
        t.proxTiro = agora + Math.max(7000, Math.min(14000, centro + jitter))
        dispararTanque(t, agora)
      }
    }
  }

  // ── 7e-2. ANTIAÉREA + FLAK: 2 por lado (1 no tier fraco), ancorada como
  // as baterias (mesmo frenteX - sentido*DIST_BATERIA, z distinto). Mira
  // qualquer aeronave inimiga no ar (o heli agora está sempre no ar; o
  // bombardeiro quando ativo) e solta flak que erra de propósito: teatro,
  // não abate.
  const geoAADog = buildAntiAereaGeometry('dog')
  const geoAAUrso = buildAntiAereaGeometry('bear')
  const CANO_AA_ALTURA = 0.87 // topo do pedestal em buildAntiAereaGeometry, onde o munhão de `cano` se apoia
  interface AntiAerea {
    grupo: THREE.Group
    giroGrupo: THREE.Group
    canoGrupo: THREE.Group
    lado: 'buy' | 'sell'
    sentido: 1 | -1
    z: number
    azAtual: number
    elevAtual: number
    proxRajada: number
  }
  const criaAntiAerea = (lado: 'buy' | 'sell', z: number): AntiAerea => {
    const sentido: 1 | -1 = lado === 'buy' ? 1 : -1
    const geo = lado === 'buy' ? geoAADog : geoAAUrso
    const baseMesh = new THREE.Mesh(geo.base, matTanque)
    const canoMesh = new THREE.Mesh(geo.cano, matTanque)
    semRaycast(baseMesh)
    semRaycast(canoMesh)
    baseMesh.frustumCulled = canoMesh.frustumCulled = false
    const canoGrupo = new THREE.Group()
    canoGrupo.position.set(0, CANO_AA_ALTURA, 0)
    canoGrupo.add(canoMesh)
    const giroGrupo = new THREE.Group()
    giroGrupo.add(canoGrupo)
    const grupo = new THREE.Group()
    grupo.add(baseMesh, giroGrupo)
    group.add(grupo)
    return {
      grupo, giroGrupo, canoGrupo, lado, sentido, z,
      azAtual: 0, elevAtual: 0,
      proxRajada: performance.now() + 1500 + hash(z, sentido + 21) * 3000,
    }
  }
  const N_AA = tierMedio ? 2 : 1
  const Z_AA = tierMedio ? [-11, 11] : [5]
  const antiAereas: AntiAerea[] = []
  for (const lado of ['buy', 'sell'] as const) {
    for (let k = 0; k < N_AA; k++) antiAereas.push(criaAntiAerea(lado, Z_AA[k]))
  }
  // pool próprio de tracers de flak: sobem da boca até PERTO da aeronave
  // (o erro é proposital, nunca acerta) e estouram via lib.flak
  const POOL_TRACER_AA = 12
  interface TracerAA { i: number; t0: number; dur: number }
  const poolTracersAA: THREE.Mesh[] = Array.from({ length: POOL_TRACER_AA }, () => {
    const m = new THREE.Mesh(geoRastro, matRastroCompra)
    m.visible = false
    m.userData.de = new THREE.Vector3()
    m.userData.para = new THREE.Vector3()
    semRaycast(m)
    group.add(m)
    return m
  })
  let cursorTracerAA = 0
  const tracersAA: TracerAA[] = []
  const vAlvoAA = new THREE.Vector3()
  const vBocaAA = new THREE.Vector3()
  const anguloWrap = (a: number) => {
    let r = a % (Math.PI * 2)
    if (r > Math.PI) r -= Math.PI * 2
    if (r < -Math.PI) r += Math.PI * 2
    return r
  }
  const dispararFlak = (aa: AntiAerea, alvo: THREE.Vector3, agora: number) => {
    aa.canoGrupo.updateWorldMatrix(true, false)
    paraLocal(vBocaAA.set(BOCA_AA_DIST, 0, 0).applyMatrix4(aa.canoGrupo.matrixWorld))
    clarao(vBocaAA, 1.2, aa.lado === 'buy' ? 0xffe1b0 : 0xffc2a8)
    const n = 3 + Math.floor(hash(Math.floor(agora) % 331, aa.z) * 3)
    for (let k = 0; k < n; k++) {
      const ladoCano = k % 2 === 0 ? 0.24 : -0.24
      paraLocal(vBocaAA.set(BOCA_AA_DIST, 0, ladoCano).applyMatrix4(aa.canoGrupo.matrixWorld))
      const i = cursorTracerAA
      cursorTracerAA = (cursorTracerAA + 1) % POOL_TRACER_AA
      const m = poolTracersAA[i]
      m.material = aa.lado === 'buy' ? matRastroCompra : matRastroVenda
      m.visible = true
      m.userData.de.copy(vBocaAA)
      // erra por 2 a 6 unidades em direção aleatória: flak é teatro, nunca abate
      const missMag = 2 + hash(k, agora % 211) * 4
      const angA = hash(k + 3, agora % 97) * Math.PI * 2
      const angB = (hash(k + 5, agora % 83) - 0.5) * Math.PI * 0.6
      m.userData.para.set(
        alvo.x + Math.cos(angA) * Math.cos(angB) * missMag,
        alvo.y + Math.sin(angB) * missMag,
        alvo.z + Math.sin(angA) * Math.cos(angB) * missMag,
      )
      tracersAA.push({ i, t0: agora, dur: 260 + hash(i, k) * 140 })
    }
  }
  const atualizaAntiAereas = (agora: number, dt: number) => {
    for (const aa of antiAereas) {
      const bx = frenteX - aa.sentido * DIST_BATERIA
      aa.grupo.position.set(bx, altura(bx, aa.z), aa.z)
      const inimigoLado: 'buy' | 'sell' = aa.lado === 'buy' ? 'sell' : 'buy'
      let alvoPos: THREE.Vector3 | null = null
      const heliInimigo = helis.find((h) => h.lado === inimigoLado)
      if (heliInimigo) alvoPos = heliInimigo.grupo.position
      const bombInimigo = bombardeiros[inimigoLado]
      if (!alvoPos && bombInimigo.ativo) alvoPos = bombInimigo.mesh.position
      if (!alvoPos) continue
      vAlvoAA.copy(alvoPos).sub(aa.grupo.position)
      const azAlvo = Math.atan2(-vAlvoAA.z, vAlvoAA.x)
      aa.azAtual += anguloWrap(azAlvo - aa.azAtual) * Math.min(1, dt * 2.2)
      aa.giroGrupo.rotation.y = aa.azAtual
      const horiz = Math.hypot(vAlvoAA.x, vAlvoAA.z)
      const elevAlvo = Math.atan2(vAlvoAA.y, horiz)
      aa.elevAtual += (elevAlvo - aa.elevAtual) * Math.min(1, dt * 2.2)
      aa.canoGrupo.rotation.z = THREE.MathUtils.clamp(aa.elevAtual, -0.1, 1.3)
      if (agora > aa.proxRajada) {
        // cadência 3-6s por peça, mais rápida quanto maior a intensidade
        const centro = 6000 - intensidade * 3000
        const jitter = (hash(Math.floor(agora) % 449, aa.z) - 0.5) * 3000
        aa.proxRajada = agora + Math.max(3000, Math.min(6000, centro + jitter))
        dispararFlak(aa, alvoPos, agora)
      }
    }
  }

  // ── 7e-3. NINHO DE METRALHADORA: 3 por lado (2 no fraco), na linha do
  // próprio lado perto da costura. A arma varre em Y e, em ritmo de rajada,
  // dispara a MESMA fuzilaria da escaramuça (rajada/disparaBala), só que com
  // origem real na boca do ninho (ver dispararRajadaNinho e o gatilho de
  // escaramuça em update()). ⚠️ COERÊNCIA (fundador): ninho fixo não serve
  // pra batalha em deslocamento, mas deslizar junto com a frente é movimento
  // sem causa. Ciclo de REDEPLOY: enquanto MONTADO o ninho fica cravado na
  // âncora; quando a frente foge mais de 10u da âncora, a guarnição DESMONTA
  // (encolhe em ~500ms com poeira), fica 2.5s fora carregando a metralhadora
  // e REMONTA na posição nova (~600ms com poeira), atualizando a âncora.
  const geoNinhoDog = buildNinhoGeometry('dog', 1)
  const geoNinhoUrso = buildNinhoGeometry('bear', -1)
  type FaseNinho = 'montado' | 'desmontando' | 'fora' | 'montando'
  interface NinhoMG {
    grupo: THREE.Group
    armaGrupo: THREE.Group
    lado: 'buy' | 'sell'
    sentido: 1 | -1
    z: number
    xOff: number
    proxRajada: number
    faseNinho: FaseNinho
    tFase: number
    xAncora: number
  }
  const criaNinhoMG = (lado: 'buy' | 'sell', idx: number): NinhoMG => {
    const sentido: 1 | -1 = lado === 'buy' ? 1 : -1
    const geo = lado === 'buy' ? geoNinhoDog : geoNinhoUrso
    const baseMesh = new THREE.Mesh(geo.base, matTanque)
    const armaMesh = new THREE.Mesh(geo.arma, matTanque)
    semRaycast(baseMesh)
    semRaycast(armaMesh)
    baseMesh.frustumCulled = armaMesh.frustumCulled = false
    // pedestal de buildNinhoGeometry: topo em y=0.3+0.3=0.6, onde o
    // cabeçote de giro (pivô de `arma`) se apoia
    const armaGrupo = new THREE.Group()
    armaGrupo.position.set(sentido * 0.1, 0.6, 0)
    armaGrupo.add(armaMesh)
    const grupo = new THREE.Group()
    grupo.add(baseMesh, armaGrupo)
    group.add(grupo)
    // âncora do deploy inicial: frenteX ainda é 0 na montagem da factory
    const xOff = 6 + hash(idx, sentido + 31) * 3
    return {
      grupo, armaGrupo, lado, sentido,
      z: (hash(idx, sentido * 13 + 1) - 0.5) * 90,
      xOff,
      proxRajada: performance.now() + 800 + hash(idx, sentido + 7) * 3200,
      faseNinho: 'montado',
      tFase: 0,
      xAncora: -sentido * xOff,
    }
  }
  const N_NINHO = tierMedio ? 3 : 2
  const ninhosMG: NinhoMG[] = []
  for (const lado of ['buy', 'sell'] as const) {
    for (let k = 0; k < N_NINHO; k++) ninhosMG.push(criaNinhoMG(lado, k))
  }
  const vBocaMG = new THREE.Vector3()
  const dispararRajadaNinho = (n: NinhoMG, agora: number) => {
    n.armaGrupo.updateWorldMatrix(true, false)
    paraLocal(vBocaMG.set(n.sentido * BOCA_MG_DIST, 0, 0).applyMatrix4(n.armaGrupo.matrixWorld))
    const nTiros = 3 + Math.floor(hash(Math.floor(agora) % 293, n.z) * 4)
    // a rajada do ninho MIRA um soldado real: um sorteio por rajada, cada
    // bala com dispersão própria em volta dele; sem amostra, fórmula antiga
    const temAlvo = alvoNoExercito(n.lado === 'buy' ? 'sell' : 'buy', vAlvoTeatro)
    for (let k = 0; k < nTiros; k++) {
      filaRajada.push({
        at: agora + k * (35 + hash(k, n.z + 1) * 20),
        lado: n.lado,
        z: n.z + (hash(k, 11) - 0.5) * 1.6,
        forca: 0.9 + hash(Math.floor(agora) % 401, n.z) * 1.4,
        ultima: k === nTiros - 1,
        origemX: vBocaMG.x,
        origemZ: vBocaMG.z,
        alvoX: temAlvo ? vAlvoTeatro.x + (hash(k, 3) - 0.5) * 2.4 : undefined,
        alvoZ: temAlvo ? vAlvoTeatro.z + (hash(k, 17) - 0.5) * 2.4 : undefined,
      })
    }
    clarao(vBocaMG, 0.7, n.lado === 'buy' ? 0xffd9a0 : 0xffb09a)
  }
  const atualizaNinhosMG = (agora: number) => {
    for (const n of ninhosMG) {
      const xDesejado = frenteX - n.sentido * n.xOff
      if (n.faseNinho === 'montado') {
        // posição FIXA na âncora: montado, o ninho não desliza nunca
        n.grupo.position.set(n.xAncora, altura(n.xAncora, n.z), n.z)
        n.grupo.scale.setScalar(1)
        n.armaGrupo.rotation.y = Math.sin(agora * 0.0009 + n.z) * 0.5
        if (Math.abs(xDesejado - n.xAncora) > 10) {
          // a frente fugiu: a guarnição desmonta pra reposicionar
          n.faseNinho = 'desmontando'
          n.tFase = agora
          vp.copy(n.grupo.position)
          emitPoeira(vp, 1.5)
        } else if (agora > n.proxRajada) {
          n.proxRajada = agora + 2000 + hash(Math.floor(agora) % 337, n.z) * 2000
          dispararRajadaNinho(n, agora)
        }
      } else if (n.faseNinho === 'desmontando') {
        const f = Math.min(1, (agora - n.tFase) / 500)
        n.grupo.scale.setScalar(Math.max(0.001, 1 - f))
        if (f >= 1) {
          n.faseNinho = 'fora'
          n.tFase = agora
          n.grupo.visible = false
        }
      } else if (n.faseNinho === 'fora') {
        // 2.5s fora: a guarnição carregando a metralhadora até a posição nova
        if (agora - n.tFase > 2500) {
          n.faseNinho = 'montando'
          n.tFase = agora
          n.xAncora = frenteX - n.sentido * n.xOff
          n.grupo.position.set(n.xAncora, altura(n.xAncora, n.z), n.z)
          n.grupo.visible = true
          vp.copy(n.grupo.position)
          emitPoeira(vp, 1.5)
        }
      } else {
        const f = Math.min(1, (agora - n.tFase) / 600)
        n.grupo.scale.setScalar(Math.max(0.001, f))
        if (f >= 1) {
          n.faseNinho = 'montado'
          n.grupo.scale.setScalar(1)
          // folga antes da primeira rajada no posto novo
          n.proxRajada = agora + 1200 + hash(Math.floor(agora) % 337, n.z) * 1500
        }
      }
    }
  }

  // ── 7e-4. TRINCHEIRA: uma fileira por lado, o cenário clássico que
  // faltava. InstancedMesh com ~10 segmentos (7 no fraco) cobrindo z de -45
  // a +45. ⚠️ COERÊNCIA (fundador): trincheira cavada NÃO DESLIZA com a
  // frente. Ela é a linha de retaguarda FIXA de cada exército: montada uma
  // vez em x = -sentido * 52 e nunca mais tocada.
  const geoTrincheiraDog = buildTrincheiraGeometry(1)
  const geoTrincheiraUrso = buildTrincheiraGeometry(-1)
  const matTrincheira = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 })
  const N_TRINCHEIRA = tierMedio ? 10 : 7
  const X_TRINCHEIRA_FIXO = 52
  const trincheiraCaes = new THREE.InstancedMesh(geoTrincheiraDog, matTrincheira, N_TRINCHEIRA)
  const trincheiraUrsos = new THREE.InstancedMesh(geoTrincheiraUrso, matTrincheira, N_TRINCHEIRA)
  trincheiraCaes.count = trincheiraUrsos.count = N_TRINCHEIRA
  for (const m of [trincheiraCaes, trincheiraUrsos]) {
    semRaycast(m)
    m.frustumCulled = false
  }
  group.add(trincheiraCaes, trincheiraUrsos)
  const montaTrincheiras = () => {
    for (let ladoIdx = 0; ladoIdx < 2; ladoIdx++) {
      const sentido: 1 | -1 = ladoIdx === 0 ? 1 : -1
      const mesh = ladoIdx === 0 ? trincheiraCaes : trincheiraUrsos
      const x = -sentido * X_TRINCHEIRA_FIXO
      for (let i = 0; i < N_TRINCHEIRA; i++) {
        const z = -45 + (90 / N_TRINCHEIRA) * (i + 0.5)
        vp.set(x, altura(x, z), z)
        vs.setScalar(1)
        m4.compose(vp, qZero, vs)
        mesh.setMatrixAt(i, m4)
      }
      mesh.instanceMatrix.needsUpdate = true
    }
  }
  montaTrincheiras()

  // ═══════════════════════════════════════════════════════════════════════
  // 7f. EVENTO DE ASSALTO: o avanço da linha vira ESPETÁCULO. ⚠️ O PEDIDO
  // CENTRAL DO FUNDADOR (25/08): "o preço se move e na linha do meio não
  // acontece nada; o mover de linha deve ser um EVENTO, vários soldados
  // movendo a linha pra frente". Quando |frenteAlvo() - frenteX| > 1.1, o
  // lado vencedor dispara: (a) a frente acelera pra 3.2 u/s enquanto o
  // evento vive; (b) uma ONDA de soldados individuais parte da própria
  // linha, cruza a costura correndo, para além da frente nova e abre
  // fuzilaria mirada (3 tombam no caminho); (c) barragem de cobertura de
  // impactos 'canhao' cai no exército PERDEDOR a cada ~300ms. Pool fixo
  // montado aqui na factory, zero alocação por evento; um evento por vez
  // (eventos em sequência são normais quando o preço anda muito).
  // ═══════════════════════════════════════════════════════════════════════
  const N_ONDA = low ? 10 : 16
  interface SoldadoOnda {
    mesh: THREE.Mesh
    z: number
    parte: number
    cai: boolean
    caiEm: number
    caiu: boolean
  }
  const criaOnda = (lado: 'buy' | 'sell'): SoldadoOnda[] => {
    const geo = lado === 'buy' ? geoShiba : geoUrso
    const mat = lado === 'buy' ? matCaes : matUrsos
    const arr: SoldadoOnda[] = []
    for (let i = 0; i < N_ONDA; i++) {
      const mesh = new THREE.Mesh(geo, mat)
      mesh.visible = false
      semRaycast(mesh)
      mesh.frustumCulled = false
      group.add(mesh)
      arr.push({ mesh, z: 0, parte: 0, cai: false, caiEm: 0, caiu: false })
    }
    return arr
  }
  const ondaCaes = criaOnda('buy')
  const ondaUrsos = criaOnda('sell')
  interface Assalto {
    lado: 'buy' | 'sell'
    sentido: 1 | -1
    fase: 'corrida' | 'fuzilaria' | 'fade'
    t0: number
    x0: number
    proxCobertura: number
    proxFuzil: number
  }
  let assalto: Assalto | null = null
  // ⚠️⚠️ POR QUE ESTE LIMIAR NÃO BASTAVA, e o assalto acontecia uma vez por
  // carregamento de página. `dF` é a distância que FALTA a frente andar, e a
  // frente persegue o alvo a cada quadro: assim que ela alcança, dF fica perto
  // de zero e só volta a passar de 1,1 num salto de 1,6% do range de 24 h de
  // uma vez só. Numa hora quieta isso não acontece, então a onda de 16 soldados
  // correndo, os que tombam com caveira e a barragem de cobertura ficavam
  // guardados depois do primeiro book. O limiar continua aqui porque ele é a
  // leitura certa para SALTO; o que faltava era a leitura de CONQUISTA.
  const LIMIAR_ASSALTO = 1.1
  // marcas da régua em x, preenchidas por constroiRegua
  let degrausX: number[] = []
  // ⚠️ dois freios, os dois necessários: o piso de tempo impede metralhar
  // assalto quando o preço fica oscilando em cima de uma marca, e a folga
  // impede que o mesmo cruzamento conte duas vezes por ruído de ponto flutuante
  // ⚠️ 18 s e não 9: medido em mercado ativo, o assalto batia no piso e saía a
  // cada nove segundos, ou seja quase sete por minuto. O maior sistema do
  // motor virando rotina deixa de ser clímax. O gatilho continua sendo dado
  // (avanço da frente); o que mudou é a distância mínima entre dois eventos.
  const PISO_ENTRE_ASSALTOS = 18000
  const FOLGA_DEGRAU = 0.05
  let ultimoAssaltoT = -Infinity
  let frenteAnterior = 0
  // ⚠️⚠️ O TERCEIRO GATILHO CHEGOU A SER UM TEMPORIZADOR, E FOI RETIRADO NO
  // MESMO DIA. A primeira versão disparava um assalto a cada 40 a 70 segundos
  // com o lado escolhido pela pressão do book, para o clímax não depender de o
  // mercado colaborar. O fundador leu a batalha logo depois e disse: "parece
  // que tem muita coisa ali que não é baseado no movimento do preço, nem em
  // compras e vendas de verdade. Tô achando muito teatro e pouca info de
  // verdade". Ele tem razão, e a régua vale para o que eu mesmo acabara de
  // escrever: um assalto que acontece porque o relógio bateu é uma mentira
  // bonita, e o produto aqui é o mercado, não o roteiro.
  //
  // No lugar entrou AVANÇO ACUMULADO, que é dado: soma quanto a frente andou
  // desde o último assalto e dispara quando o total passa do limiar, com o
  // lado dado pelo sentido líquido do movimento. Numa hora agitada isso
  // dispara muitas vezes; numa madrugada parada não dispara, e não disparar é
  // a resposta certa, porque não houve conquista nenhuma para contar.
  const AVANCO_PARA_ASSALTO = 3.5 // ≈ 5% do range de 24 h
  let avancoAcum = 0
  let avancoLiquido = 0
  // quantos assaltos já rolaram: o número que prova, na sonda, que o sistema
  // deixou de disparar uma vez por carregamento de página
  let assaltosTotal = 0
  const VEL_FRENTE_ASSALTO = 3.2
  const X_ONDA_PARTIDA = 14
  const VEL_ONDA = 9
  const iniciaAssalto = (lado: 'buy' | 'sell', agora: number) => {
    const sentido: 1 | -1 = lado === 'buy' ? 1 : -1
    const soldados = lado === 'buy' ? ondaCaes : ondaUrsos
    const x0 = frenteX - sentido * X_ONDA_PARTIDA
    for (let i = 0; i < N_ONDA; i++) {
      const s = soldados[i]
      // espalhados em z (±38) e partindo em leque, tudo por hash
      s.z = (hash(i * 13 + 3, Math.floor(agora) % 997) - 0.5) * 76
      s.parte = agora + hash(i, Math.floor(agora) % 773) * 350
      s.cai = false
      s.caiu = false
      s.mesh.visible = true
      s.mesh.scale.setScalar(1)
      // rotação 0 pros dois: a geometria de cada espécie já nasce olhando o
      // inimigo (mesma convenção dos duelos e das cargas de esquadrão)
      s.mesh.rotation.set(0, 0, 0)
      s.mesh.position.set(x0, altura(x0, s.z) + 0.05, s.z)
    }
    // 3 tombam no caminho, sorteados por hash com ponto de queda próprio
    for (let k = 0; k < 3; k++) {
      const idx = (Math.floor(hash(k * 7 + 1, Math.floor(agora) % 641) * N_ONDA) + k) % N_ONDA
      soldados[idx].cai = true
      soldados[idx].caiEm = 0.3 + hash(k, 5) * 0.5
    }
    assalto = { lado, sentido, fase: 'corrida', t0: agora, x0, proxCobertura: agora, proxFuzil: 0 }
    assaltosTotal++
    ultimoAssaltoT = agora
    avancoAcum = 0
    avancoLiquido = 0
  }
  const atualizaAssalto = (agora: number, dt: number) => {
    if (!assalto) return
    const a = assalto
    const soldados = a.lado === 'buy' ? ondaCaes : ondaUrsos
    const inimigo: 'buy' | 'sell' = a.lado === 'buy' ? 'sell' : 'buy'
    // (c) barragem de cobertura: impacto 'canhao' no exército PERDEDOR a
    // cada ~300ms enquanto a onda corre e atira
    if (a.fase !== 'fade' && agora >= a.proxCobertura) {
      a.proxCobertura = agora + 260 + hash(Math.floor(agora) % 211, 7) * 120
      if (alvoNoExercito(inimigo, vAlvoTeatro)) impacto(vAlvoTeatro, 3.5, a.lado, 0, 'canhao')
    }
    // a onda para ~4 ALÉM da frente nova (frenteAlvo segue o preço vivo)
    const xDest = frenteAlvo() + a.sentido * 4
    if (a.fase === 'corrida') {
      let todosChegaram = true
      const total = Math.max(0.01, Math.abs(xDest - a.x0))
      for (const s of soldados) {
        if (s.caiu) continue
        if (agora < s.parte) {
          todosChegaram = false
          continue
        }
        const dx = xDest - s.mesh.position.x
        const perc = 1 - Math.min(1, Math.abs(dx) / total)
        if (s.cai && perc >= s.caiEm) {
          // tomba NO caminho: o corpo entra no pool de cadáveres + caveira
          s.caiu = true
          s.mesh.visible = false
          vp.copy(s.mesh.position)
          tomba(a.lado === 'buy' ? detritoCaes : detritoUrsos, a.lado === 'buy' ? curCaes : curUrsos, vp, 1)
          lib.caveira(vp, inimigo)
          continue
        }
        if (Math.abs(dx) > 0.15) {
          todosChegaram = false
          s.mesh.position.x += Math.sign(dx) * Math.min(Math.abs(dx), VEL_ONDA * dt)
          // bob de passada: a corrida vende o assalto
          s.mesh.position.y = altura(s.mesh.position.x, s.z) + Math.abs(Math.sin(agora * 0.02 + s.z)) * 0.3
        } else {
          s.mesh.position.y = altura(s.mesh.position.x, s.z) + 0.05
        }
      }
      // trava de segurança em 6s: preço correndo mais que a onda não pode
      // prender o evento pra sempre
      if (todosChegaram || agora - a.t0 > 6000) {
        a.fase = 'fuzilaria'
        a.t0 = agora
        a.proxFuzil = agora
      }
      return
    }
    if (a.fase === 'fuzilaria') {
      if (agora >= a.proxFuzil) {
        a.proxFuzil = agora + 220 + hash(Math.floor(agora) % 173, 3) * 160
        // um atirador vivo por vez, escolhido por hash a partir de um índice
        // sorteado (varredura linear, zero alocação)
        const ini = Math.floor(hash(Math.floor(agora) % 419, 9) * N_ONDA)
        for (let k = 0; k < N_ONDA; k++) {
          const s = soldados[(ini + k) % N_ONDA]
          if (s.caiu) continue
          if (alvoNoExercito(inimigo, vAlvoTeatro)) {
            filaRajada.push({
              at: agora, lado: a.lado, z: s.z, forca: 1.3, ultima: true,
              origemX: s.mesh.position.x, origemZ: s.mesh.position.z,
              alvoX: vAlvoTeatro.x, alvoZ: vAlvoTeatro.z,
            })
          }
          break
        }
      }
      if (agora - a.t0 > 2600) {
        a.fase = 'fade'
        a.t0 = agora
      }
      return
    }
    // fade: os sobreviventes somem num encolhimento rápido de escala
    const f = Math.min(1, (agora - a.t0) / 450)
    for (const s of soldados) {
      if (s.caiu) continue
      s.mesh.scale.setScalar(Math.max(0.001, 1 - f))
    }
    if (f >= 1) {
      for (const s of soldados) {
        s.mesh.visible = false
        s.mesh.scale.setScalar(1)
      }
      assalto = null
    }
  }

  // ── 7d. um único ponto de atualização por frame pros sistemas de
  // vehicles.ts e das posições fixas da 7e, mais o dreno das filas de
  // impactos atrasados e de tracers de flak que eles agendam.
  const passoVeiculos = (agora: number, dt: number) => {
    atualizaCavalgada(agora, dt)
    atualizaHelicopteros(agora, dt)
    atualizaJipes(agora, dt)
    atualizaTanquesGuarda(agora, dt)
    atualizaAntiAereas(agora, dt)
    atualizaNinhosMG(agora)
    atualizaAssalto(agora, dt)
    for (let i = 0; i < CAP_IMPACTO_ATRASADO; i++) {
      if (!impAtiva[i] || agora < impAt[i]) continue
      impAtiva[i] = 0
      vp.set(impX[i], altura(impX[i], impZ[i]), impZ[i])
      impacto(vp, impForca[i], impLado[i] === 0 ? 'buy' : 'sell', 0, impArma[i])
    }
    // tracers de flak: sobem até perto da aeronave e estouram lá (nunca acertam)
    for (let i = tracersAA.length - 1; i >= 0; i--) {
      const tr = tracersAA[i]
      const mesh = poolTracersAA[tr.i]
      const f = (agora - tr.t0) / tr.dur
      if (f >= 1) {
        mesh.visible = false
        lib.flak(mesh.userData.para, 2.4)
        tracersAA.splice(i, 1)
        continue
      }
      mesh.position.lerpVectors(mesh.userData.de, mesh.userData.para, f)
      passo.subVectors(mesh.userData.para, mesh.userData.de)
      if (passo.lengthSq() > 0.001) mesh.quaternion.setFromUnitVectors(zEixo, passo.normalize())
      mesh.scale.set(0.1, 0.1, 2.0)
    }
  }

  const update = (agora: number) => {
    const dt = ultimoUpdate > 0 ? Math.min(0.05, (agora - ultimoUpdate) / 1000) : 0.016
    ultimoUpdate = agora
    // a matriz do anfitrião pode ter mudado (a praça reposiciona o grupo em
    // troca de qualidade); um invert por quadro paga por todas as bocas
    atualizaBaseLocal()
    passoIntensidade(dt)

    // ── a frente rasteja até onde o preço manda ──────────────────────────
    {
      const dF = frenteAlvo() - frenteX
      // ⚠️ conquista grande NÃO é rastejo silencioso: acima do limiar o lado
      // vencedor dispara o EVENTO DE ASSALTO (delta > 0 = cães conquistando)
      // e a frente acelera enquanto ele vive; um evento por vez, e eventos em
      // sequência são o comportamento esperado quando o preço anda muito
      if (!assalto && mid > 0 && Math.abs(dF) > LIMIAR_ASSALTO) {
        iniciaAssalto(dF > 0 ? 'buy' : 'sell', agora)
      }
      const velFrente = assalto ? VEL_FRENTE_ASSALTO : VEL_FRENTE
      if (Math.abs(dF) > 0.002) {
        const passoF = Math.sign(dF) * Math.min(Math.abs(dF), velFrente * dt)
        frenteX += passoF
        avancoAcum += Math.abs(passoF)
        avancoLiquido += passoF
        // ── CONQUISTA: a frente cruzou uma marca da régua ─────────────────
        // A régua já desenha degraus de preço redondos no chão. Passar de um
        // deles é o momento em que o lado vencedor tomou terreno que dá para
        // apontar, e é aí que o assalto tem de acontecer. Sem isto o maior
        // sistema do motor rodava uma vez e dormia.
        if (!assalto && mid > 0 && agora - ultimoAssaltoT > PISO_ENTRE_ASSALTOS) {
          const antes = frenteAnterior
          const depois = frenteX
          // avanço acumulado: conquista lenta também é conquista
          if (avancoAcum > AVANCO_PARA_ASSALTO) {
            iniciaAssalto(avancoLiquido >= 0 ? 'buy' : 'sell', agora)
          }
          // ⚠️ `!assalto` de novo aqui: o avanço acumulado logo acima pode ter
          // acabado de disparar, e sem esta guarda o cruzamento sobrescrevia o
          // assalto recém-nascido no MESMO quadro, cortando a corrida na
          // primeira fração de segundo
          for (let k = 0; !assalto && k < degrausX.length; k++) {
            const dx = degrausX[k]
            const cruzouSubindo = antes < dx - FOLGA_DEGRAU && depois >= dx
            const cruzouDescendo = antes > dx + FOLGA_DEGRAU && depois <= dx
            if (cruzouSubindo || cruzouDescendo) {
              iniciaAssalto(cruzouSubindo ? 'buy' : 'sell', agora)
              break
            }
          }
        }
        frenteAnterior = frenteX
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
        luzFrente.position.x = frenteX
        cortina.position.set(frenteX, dyF, 0)
        bookSujo = true
      }
    }
    passoCortina(agora)
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
        impacto(mesh.userData.para, t.forca, t.lado, t.qty, t.arma)
        mesh.visible = rastro.visible = false
        tiros.splice(i, 1)
        continue
      }
      mesh.position.lerpVectors(mesh.userData.de, mesh.userData.para, f)
      // o y interpola de origem a alvo (tiro de chão: ~1, igual ao valor fixo
      // antigo; foguete do heli: desce da boca no ar até o soldado) + arco
      mesh.position.y += Math.sin(f * Math.PI) * t.arco
      passo.subVectors(mesh.position, mesh.userData.prev)
      const dist = passo.length()
      if (dist > 0.0005) rastro.quaternion.setFromUnitVectors(zEixo, passo.normalize())
      rastro.position.copy(mesh.position)
      // cauda de cometa: a cabeça fina, o comprimento é quem conta a
      // velocidade (canhão rápido = cauda longa, que é a física certa)
      const espessuraRastro = t.arma === 'canhao' || t.arma === 'mlrs' ? 0.75 : 0.55
      rastro.scale.set(mesh.scale.x * espessuraRastro, mesh.scale.x * espessuraRastro, Math.max(1.6, dist * 19 + t.forca * 0.3))
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
      if (o.luz) o.luz.intensity = 30 * escLuz * Math.min(6, o.forca) * (1 - f)
    }

    for (const sp of flashPool) {
      if (!sp.visible) continue
      // `halo`/`haloMs` valem 1 e 130 no anfitrião com bloom; sem bloom o
      // clarão cresce e demora, que é o halo nascendo na cena (ver
      // OpcoesBatalha.brilhoInterno). O tamanho é reescrito aqui todo quadro,
      // então basta multiplicar num lugar para valer nos três pontos de spawn.
      const k = (agora - sp.userData.t0) / haloMs
      if (k >= 1) {
        sp.visible = false
        continue
      }
      sp.scale.setScalar(sp.userData.base * halo * (1 + k * 0.6))
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

    // ── CADÁVERES: 3 fases. ARREMESSO (sobe em arco + tumble, 550ms) →
    // REPOUSO (rotação final variada, ~22s) → AFUNDAMENTO (desce e libera o
    // slot, ~6s). MESMO InstancedMesh de sempre, pool fixo (cap=orc.detritos).
    for (const t of tombos) {
      if (!t.ativo || !t.mesh) continue
      if (t.fase === 0) {
        const f = Math.min(1, (agora - t.tFase) / 480)
        const arco = t.apice * Math.sin(f * Math.PI)
        vp.set(t.x, t.y + 0.05 + arco, t.z)
        // gira ALÉM da queda: slerp até paraFinal + um giro extra que decai
        // a zero exatamente em f=1 (o corpo sempre pousa na rotação certa).
        // ⚠️ meia volta e só: 2.2π aqui lia como cambalhota de ginasta
        q.slerpQuaternions(qZero, t.paraFinal, f * f)
        const spinRestante = (1 - f) * Math.PI * 0.85 * (hash(t.idx, 31) > 0.5 ? 1 : -1)
        qTumble.setFromAxisAngle(EIXO_TOMBO, spinRestante)
        q.multiply(qTumble)
        vs.setScalar(t.esc)
        m4.compose(vp, q, vs)
        t.mesh.setMatrixAt(t.idx, m4)
        t.mesh.instanceMatrix.needsUpdate = true
        if (f >= 1) {
          t.fase = 1
          t.tFase = agora
          vp.set(t.x, t.y + 0.05, t.z)
          emitPoeira(vp, 0.5)
        }
      } else if (t.fase === 1) {
        vp.set(t.x, t.y + 0.05, t.z)
        vs.setScalar(t.esc)
        m4.compose(vp, t.paraFinal, vs)
        t.mesh.setMatrixAt(t.idx, m4)
        t.mesh.instanceMatrix.needsUpdate = true
        if (agora - t.tFase > 22000) {
          t.fase = 2
          t.tFase = agora
        }
      } else {
        const f = Math.min(1, (agora - t.tFase) / 6000)
        vp.set(t.x, t.y + 0.05 - 0.4 * f, t.z)
        vs.setScalar(t.esc)
        m4.compose(vp, t.paraFinal, vs)
        t.mesh.setMatrixAt(t.idx, m4)
        t.mesh.instanceMatrix.needsUpdate = true
        // libera a entrada; a instância continua no chão até o pool reciclar
        if (f >= 1) t.ativo = false
      }
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
      // ⚠️ A ESCARAMUÇA SAI DO CHURN DO BOOK, não de um piso inventado. Churn
      // é ordem entrando e saindo sem virar negócio: acontece muitas vezes por
      // segundo mesmo num dia parado, é dado real da Kraken, e é o único rumor
      // de fundo que a batalha tem direito de fazer sem trade nenhum.
      // `taxaChurn / baseChurn` é o churn de agora contra o normal recente:
      // 1 = book no ritmo de sempre, 3 = book fervendo.
      const razaoChurn = baseChurn > 1e-6 ? taxaChurn / baseChurn : 1
      // razão 1 = book no ritmo de sempre (~3,7 rajadas/s), 2,2 = fervendo
      // (~7,3). O ganho subiu de 2,2 para 3,0 porque esta é a única arma com
      // combustível permanente: o churn acontece mesmo sem negócio nenhum.
      // Sem piso alto mesmo assim: book PARADO continua sendo batalha calada,
      // porque aí não há nem ordem entrando.
      const rajadaHz = 0.7 + 3.0 * Math.min(2.2, razaoChurn)
      if (agora - ultimaEscaramuca > (1000 / rajadaHz) * (0.7 + hash(Math.floor(agora) % 577, 3) * 0.6)) {
        ultimaEscaramuca = agora
        const lado: 'buy' | 'sell' = hash(Math.floor(agora) % 691, 9) < press ? 'buy' : 'sell'
        // ⚠️ metade das rajadas nasce de um ninho de metralhadora real
        // (boca de verdade), a outra metade continua da infantaria pela
        // fórmula antiga: os dois lêem como o mesmo rugido de fundo
        const ninhosDoLado = ninhosMG.filter((n) => n.lado === lado)
        if (ninhosDoLado.length && hash(Math.floor(agora) % 601, 41) < 0.5) {
          const idxNinho = Math.floor(hash(Math.floor(agora) % 409, 43) * ninhosDoLado.length) % ninhosDoLado.length
          dispararRajadaNinho(ninhosDoLado[idxNinho], agora)
        } else {
          rajada(lado, (hash(Math.floor(agora) % 1213, 5) - 0.5) * 100, 0.9 + hash(Math.floor(agora) % 331, 7) * 1.7, agora)
        }
      }
      // MORTEIRO PESADO = TRADE GRANDE (≥ 4x a média). Era um temporizador de
      // ~20 tiros por minuto que existia porque "sempre tem casca no ar"; agora
      // cada casca no ar é uma negociação de verdade acima de quatro vezes a
      // média, e o tamanho do trade vira a força do impacto.
      if (agora - ultimoMorteiro > 450) {
        const ev = consomeEvento('trade-grande')
        if (ev) {
          ultimoMorteiro = agora
          contagemEventos['trade-grande'] = (contagemEventos['trade-grande'] ?? 0) + 1
          disparaMorteiro(ev.lado, 3 + Math.min(9, ev.forca), zAlvoGuerra(Math.floor(agora) % 1069, 19))
        }
      }
      // RAJADA DIRIGIDA = TRADE MÉDIO (≥ 2x a média): fogo do lado de quem
      // negociou, para o trade médio ter corpo sem virar morteiro
      {
        const ev = consomeEvento('trade-medio')
        if (ev) {
          contagemEventos['trade-medio'] = (contagemEventos['trade-medio'] ?? 0) + 1
          rajada(ev.lado, (hash(Math.floor(agora) % 1213, 5) - 0.5) * 100, 1.2 + ev.forca * 0.35, agora)
        }
      }
      // canhões de teatro: um PAR de tiros parabólicos simultâneos de tempos em
      // tempos (qty 0: sem placar), pra sempre haver mais de uma arma na cena.
      // ⚠️ cadência subida pra 3.5-6.5s (era 7-11s): o fundador sentia falta
      // deles, arma que ninguém vê não existe
      // PAR DE CANHÕES = PAREDE NO BOOK: apareceu uma ordem parada muito maior
      // que o normal deste mercado. Era um temporizador de 3,5 a 6,5 s.
      const evParede = agora - ultimoCanhao > 1800 ? consomeEvento('parede') : null
      if (evParede) {
        ultimoCanhao = agora
        contagemEventos['parede'] = (contagemEventos['parede'] ?? 0) + 1
        const lado: 'buy' | 'sell' = evParede.lado
        const inimigoCanhao: 'buy' | 'sell' = lado === 'buy' ? 'sell' : 'buy'
        // ⚠️ os dois tiros saem da bateria mais próxima de cada z; se as duas
        // caírem na mesma bateria (alvos vizinhos), o segundo tiro ainda sai
        // dela, só não repete o recuo se já estiver recuando. arma 'canhao'
        // (não o 'tiro' genérico) pra ganhar o clarão e o rastro próprios.
        // Cada tiro do par mira um SOLDADO real distinto (alvoSeq garante
        // sorteios diferentes no mesmo milissegundo); sem amostra, z antigo
        const temA1 = alvoNoExercito(inimigoCanhao, vAlvoTeatro)
        const zC = temA1 ? vAlvoTeatro.z : zAlvoGuerra(Math.floor(agora) % 1327, 31)
        const b1 = bateriaMaisProxima(lado, zC)
        const forcaC1 = 3 + hash(Math.floor(agora) % 271, 37) * 2.5
        if (b1) dispararBateria(b1, agora, forcaC1)
        const o1 = b1 ? bocaDaBateria(b1).clone() : undefined
        // atira copia `alvo` na hora, então o scratch pode ser reusado já já
        atira(lado, 0, forcaC1, zC, Math.floor(agora) % 9973, o1, 'canhao', temA1 ? vAlvoTeatro : undefined)
        const temA2 = alvoNoExercito(inimigoCanhao, vAlvoTeatro)
        const zC2 = temA2 ? vAlvoTeatro.z : zC + 14 + hash(Math.floor(agora) % 157, 43) * 18
        const b2 = bateriaMaisProxima(lado, zC2)
        const forcaC2 = 2.5 + hash(Math.floor(agora) % 199, 41) * 2
        if (b2) dispararBateria(b2, agora, forcaC2)
        const o2 = b2 ? bocaDaBateria(b2).clone() : undefined
        atira(lado, 0, forcaC2, zC2, Math.floor(agora) % 7919, o2, 'canhao', temA2 ? vAlvoTeatro : undefined)
      }
      // BOMBARDEIRO = ROMPIMENTO: o preço passou do teto ou do piso que esta
      // sessão já viu. É o evento mais raro e mais alto do mercado, e ganha a
      // arma mais alta do arsenal. Antes ele era um efeito colateral da
      // ofensiva, que por sua vez era um temporizador.
      if (agora - ultimoBombardeioEv > 12000) {
        const ev = consomeEvento('rompimento')
        if (ev) {
          ultimoBombardeioEv = agora
          contagemEventos['rompimento'] = (contagemEventos['rompimento'] ?? 0) + 1
          dispararBombardeiro(ev.lado, agora)
        }
      }
      // OFENSIVA COORDENADA = MARÉ: cinco trades seguidos do mesmo lado. Era
      // um temporizador de 9 a 15 s. Agora o exército inteiro só avança quando
      // um lado de fato encadeou negócios, que é o que "maré" quer dizer.
      if (!ofensiva) {
        const ev = consomeEvento('maré')
        if (ev) {
          contagemEventos['maré'] = (contagemEventos['maré'] ?? 0) + 1
          ofensiva = { lado: ev.lado, fase: 'barragem', t0: agora, proxTiro: agora, proxCasca: agora }
        }
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
          disparaMorteiro(ofensiva.lado, 5 + intensidade * 3.5, zAlvoGuerra(Math.floor(agora) % 977, 11))
        }
        if (idade > 3200) {
          ofensiva.fase = 'avanco'
          ofensiva.t0 = agora
          dispararBombardeiro(ofensiva.lado, agora)
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
    atualizaBaterias(agora)
    atualizaBombardeiros(agora)
    atualizaBandeiras(agora)
    passoVeiculos(agora, dt)

    // rajadas agendadas e balas retas em voo
    for (let i = filaRajada.length - 1; i >= 0; i--) {
      if (filaRajada[i].at <= agora) {
        const r = filaRajada[i]
        disparaBala(r.lado, r.z, r.forca, r.ultima, agora, r.origemX, r.origemZ, r.alvoX, r.alvoZ, r.origemY)
        filaRajada.splice(i, 1)
      }
    }
    for (let i = balas.length - 1; i >= 0; i--) {
      const b = balas[i]
      const mesh = poolBalas[b.i]
      const f = (agora - b.t0) / b.dur
      if (f >= 1) {
        mesh.visible = false
        if (b.ultima) impacto(mesh.userData.para, b.forca, b.lado, 0, 'fuzil')
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
        impacto(mesh.userData.para, mt.forca * 1.6, mt.lado, 0, mt.arma)
        marcaCicatriz(mesh.userData.para, mt.forca * 1.8)
        pesados.splice(i, 1)
        continue
      }
      mesh.position.lerpVectors(mesh.userData.de, mesh.userData.para, f)
      // ⚠️⚠️ PARÁBOLA DE VERDADE, e por que a anterior não era.
      //
      // O fundador: "não fazem uma parábola perfeita, parecem totalmente
      // programados". Ele leu certo. A curva antiga era um seno subindo até
      // f=0,62 e uma quadrática caindo depois, com o y ESCRITO por cima em
      // valor absoluto (`y = 1 + ...`): não é balística, é uma corcova
      // desenhada à mão, assimétrica, que ignorava a altura da boca e a do
      // alvo e sempre pousava em y=1, no ar quando o terreno subia.
      //
      // Agora é a parábola que a física dá: interpolação reta entre boca e
      // alvo, mais 4·H·u·(1−u), que vale zero nas duas pontas e H no meio.
      // Sai do cano na altura do cano, cai exatamente onde o impacto vai
      // acontecer, e a subida espelha a descida, que é o que o olho reconhece
      // como tiro de obus.
      if (mt.arma === 'tanque') {
        mesh.position.y += Math.sin(f * Math.PI) * 2.2
      } else {
        const H = 11 + Math.min(12, mt.forca)
        mesh.position.y += 4 * H * f * (1 - f)
      }
      passo.subVectors(mesh.position, mesh.userData.prev)
      const distP = passo.length()
      if (distP > 0.0005) rastro.quaternion.setFromUnitVectors(zEixo, passo.normalize())
      rastro.position.copy(mesh.position)
      // ⚠️ O ALFINETE. A cauda era `distP * 18` sem teto: numa casca lenta e
      // comprida isso dava uma haste rígida de quase 20 m atrás de uma bola
      // escura, e o conjunto lia como alfinete espetado no céu. Cauda curta e
      // com teto: quem marca a trajetória agora é a FUMAÇA deixada no caminho,
      // que curva junto com o arco em vez de apontar para onde a casca ia.
      rastro.scale.set(1.0, 1.0, Math.min(5.5, Math.max(1.6, distP * 7)))
      // três baforadas ao longo do voo, do pool que já existe: é o traço que
      // faz o espectador ler o arco depois que a casca já passou
      if (mt.arma !== 'tanque') {
        const marca = Math.floor(f * 4)
        if (marca > (mesh.userData.marca ?? -1) && marca < 4) {
          mesh.userData.marca = marca
          solta_fumaca(mesh.position, 0.5 + mt.forca * 0.12)
        }
      }
      mesh.userData.prev.copy(mesh.position)
    }

    // MLRS: a fila agendada dispara na hora, e os foguetes em voo sobem em
    // arco raso (bem mais baixo que o morteiro) até o cluster no impacto
    for (let i = filaFoguete.length - 1; i >= 0; i--) {
      if (filaFoguete[i].at <= agora) {
        dispararFoguete(filaFoguete[i], agora)
        filaFoguete.splice(i, 1)
      }
    }
    for (let i = foguetes.length - 1; i >= 0; i--) {
      const ft = foguetes[i]
      const mesh = poolFoguetes[ft.i]
      const rastro = poolRastroFoguetes[ft.i]
      const f = (agora - ft.t0) / ft.dur
      if (f >= 1) {
        mesh.visible = false
        rastro.visible = false
        explodeCluster(mesh.userData.para, ft.forca, ft.lado)
        foguetes.splice(i, 1)
        continue
      }
      mesh.position.lerpVectors(mesh.userData.de, mesh.userData.para, f)
      mesh.position.y += Math.sin(f * Math.PI) * (3.2 + Math.min(6, ft.forca))
      passo.subVectors(mesh.position, mesh.userData.prev)
      const dist = passo.length()
      if (dist > 0.0005) {
        passo.normalize()
        mesh.quaternion.setFromUnitVectors(zEixo, passo)
        if (!low) rastro.quaternion.copy(mesh.quaternion)
      }
      if (!low) {
        rastro.position.copy(mesh.position)
        rastro.scale.set(0.16, 0.16, Math.max(1, dist * 14))
      }
      mesh.userData.prev.copy(mesh.position)
    }

    // bombas do bombardeiro: caem depois de um curto atraso, a assinatura da
    // bomba (lib.bombaAerea, a única que pode ser gorda) + flash largo, sem
    // passar pelo impacto() genérico (bomba não carrega lado, é queda de área)
    for (let i = filaBomba.length - 1; i >= 0; i--) {
      if (filaBomba[i].at <= agora) {
        const bm = filaBomba[i]
        const y = altura(bm.x, bm.z)
        vp.set(bm.x, y, bm.z)
        const forcaBomba = 7 + intensidade * 3
        lib.bombaAerea(vp, forcaBomba)
        flashDeTela(vp, forcaBomba, 0xffe6c2)
        marcaCicatriz(vp, 3.5)
        emitDestrocos(vp, 4)
        opcoes.onImpactoGrande?.(6)
        filaBomba.splice(i, 1)
      }
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
        mat.color.setRGB(
          1 + (sp.userData.tr - 1) * k,
          1 + (sp.userData.tg - 1) * k,
          1 + (sp.userData.tb - 1) * k,
        )
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
        atira(s.lado, s.qty, s.forca, s.z, Math.floor(s.at), undefined, 'baleia')
        salva.splice(i, 1)
      }
    }

    // a marcha dos exércitos: o movimento que o book comanda
    marcha(exCaes, dt, agora)
    marcha(exUrsos, dt, agora)

    // cargas de esquadrão: vida constante além dos duelos individuais
    atualizaEsquadrao(agora, dt)

    // duelos de vanguarda
    for (const d of duelos) {
      const idade = agora - d.t0
      if (d.fase === 'espera') {
        // ⚠️ DUELO DE VANGUARDA = SPREAD ABERTO. A auditoria mediu os duelos
        // produzindo 117 dos ~690 eventos por minuto, 17% de tudo que se mexe
        // na tela, tirando do mercado apenas o bit de quem ganha. Agora eles
        // acontecem quando o book AFINA, ou seja quando os dois lados recuam e
        // o spread abre: é exatamente o momento em que ninguém tem massa para
        // atacar e a briga vira individual. Um evento arma UM duelo.
        if (agora >= d.t0 && agora - ultimoDueloEv > 900) {
          // o duelo atende aos DOIS eventos de book: spread abrindo (os dois
          // lados recuaram) e inclinação (o book pendeu). O segundo é o que
          // mantém a vanguarda viva quando não há negócio nenhum.
          const evSpread = consomeEvento('spread') ?? consomeEvento('inclinacao')
          if (!evSpread) continue
          ultimoDueloEv = agora
          contagemEventos[evSpread.motivo] = (contagemEventos[evSpread.motivo] ?? 0) + 1
          d.z = (hash(Math.floor(agora) % 977, d.t0 % 131) - 0.5) * 108
          d.fase = 'corre'
          d.t0 = agora
          d.ciclo++
          d.chamas = d.ciclo % 3 === 0
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
          // duelo de lança-chamas: o ganhador crava o jato na direção do
          // rival, marca de queimado pequena no chão do alcance
          if (d.chamas) {
            const ganhadorMesh = d.vence === 'buy' ? d.cao : d.urso
            const perdedorMesh = d.vence === 'buy' ? d.urso : d.cao
            vs.subVectors(perdedorMesh.position, ganhadorMesh.position).normalize()
            lib.jatoDeChamas(ganhadorMesh.position, vs, 6)
            marcaCicatriz(perdedorMesh.position, 0.6)
          }
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

    lib.update(agora, dt)
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
    luzesAcesas,
    setLuzes: (n: number, frente?: boolean) => {
      const alvo = Math.max(0, Math.min(poolLuzes.length, Math.round(n)))
      for (let i = 0; i < poolLuzes.length; i++) {
        const on = i < alvo
        if (poolLuzes[i].visible === on) continue
        poolLuzes[i].visible = on
        // nunca reacende com o brilho da onda velha: a luz volta do zero
        poolLuzes[i].intensity = 0
      }
      luzesAtivas = alvo
      if (cursorLuz >= alvo) cursorLuz = 0
      if (frente !== undefined) luzFrente.visible = frente
      return luzesAcesas()
    },
    hud: () => ({
      preco: mid, low24, high24, open24, status,
      ursosCaidos, caesCaidos, compra, venda,
      bidsDog, asksDog, bidsUsd, asksUsd, spread: spreadAtual,
      dogPorSoldado: dogPorSoldadoAtual, niveisBook: book.bids.length + book.asks.length,
      niveisEncenados: Math.min(orc.niveis, book.bids.length) + Math.min(orc.niveis, book.asks.length),
      vwap24, volume24, trades24,
      fita: [...fita],
      assaltos: assaltosTotal,
      eventos: { ...contagemEventos },
      filaEventos: eventos.length,
      churnRelativo: baseChurn > 1e-6 ? taxaChurn / baseChurn : 1,
    }),
    dispose: () => {
      clearInterval(tickerTimer)
      if (feed) feed.stop()
      lib.dispose()
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
