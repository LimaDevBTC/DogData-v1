// ═══════════════════════════════════════════════════════════════════════════
// A ABÓBADA DE COLMEIA sobre a DogCity inteira.
//
// Decisão do fundador, 28/08/2026: UMA abóbada só, cobrindo a cidade e o
// coliseu da Cratera da Batalha. Foguete voa fora dela. Não existe abóbada
// separada para o coliseu, e se a estação de foguetes atrapalhar, a estação é
// que se muda.
//
// Por que colmeia, e é a única parte da física que sobreviveu ao corte: a
// tração de membrana de uma calota é N = p·Rc/2, e o raio de curvatura de uma
// célula hemisférica é o raio da própria célula. Então a célula pequena divide
// a tração linearmente, e com ela a espessura do vidro. A baia de 168 m da
// proposta original pedia 107 mm de vidro, que não existe; a célula de 42 m
// pede 23,7 mm, que é vidraça. Isso importa aqui porque decide a ESPESSURA DA
// NERVURA, que é a única coisa desta lista que a câmera vê.
//
// O resto da engenharia (gás, radiação, incêndio) foi descartado pelo fundador
// e com razão: esta cidade é virtual. O critério é a tela.
//
// ⚠️ CINTILAÇÃO É O ÚNICO RISCO REAL. Uma nervura de 0,9 m cai abaixo de 1
// pixel além de ~1.300 m, e a partir daí a malha pisca contra o céu preto
// estrelado, que é o pior artefato possível nesta cena. A cura não é
// estrutural, é LOD: além de `distTextura` a casca devia virar textura
// projetada com mipmap. NÃO IMPLEMENTADO nesta primeira passada, e é a próxima
// coisa a fazer se o fundador aprovar a forma.
//
// Three.js puro (regra da casa: nada de react-three-fiber).
// ═══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/** raio em planta, usado só como piso quando o contorno da cidade não chega */
// ⚠️ ANDA COM O SÍTIO. 3.500 -> 4.500 em 28/08, e em 30/08 deixou de ser um
// NÚMERO para virar um CONTORNO. A cidade parou de ser um disco: ela é uma
// superelipse 1,25:1 cujo alcance vai de 6.054 a 7.573 m, e uma casca circular
// sobre ela ou sobrava 1,5 km de um lado ou cortava a cidade do outro.
// A abóbada agora recorta no MESMO contorno que o gerador publica em
// `cidade-malha.json` -> `contorno`, com uma folga. Sem contorno, cai neste raio.
export const DOME_R = 7600

export interface DomeOpts {
  /** o chão, para a saia da borda pousar no relevo real */
  heightAt: (x: number, z: number) => number
  /**
   * ⚠️ A SUPERFÍCIE QUE A CÂMERA VÊ, e é ela que a sapata usa. `heightAt` é
   * contínua; a malha do regolito lineariza em células de ~59 m e a diferença
   * entre as duas já mediu 1,00 m nesta cena. Assentar pela contínua deixa a
   * sapata boiando ou enterrada por um valor que ninguém vê no código.
   */
  superficieAt?: (x: number, z: number) => number
  /**
   * ⚠️ O CONTORNO DA CIDADE, de `cidade-malha.json`. É ele que dá a forma à
   * casca: sem ele a abóbada volta a ser um círculo sobre uma cidade que não é.
   * Pontos [x, z] em ordem angular; a folga de `rimFolga` é somada.
   */
  contorno?: [number, number][]
  /** quanto a saia da casca passa da borda da cidade, em metros */
  rimFolga?: number
  /**
   * ⚠️ ONDE A CASCA FICA. A geometria é sempre construída em torno da ORIGEM e o
   * grupo é transladado no fim; `heightAt` é consultado já somando este centro,
   * senão a saia do domo anexo pousaria no relevo do lugar errado. Sem isto só
   * existe uma abóbada possível, a da cidade, e o Vale do Poente não teria casca.
   */
  centro?: { x: number; z: number }
  /** raio circunscrito da célula, em metros. 42 = um quarto do quarteirão de 168 m */
  cell?: number
  /** altura da borda sobre o datum da praça (o relevo do sítio vai de −85 a +66) */
  rim?: number
  /** altura da coroa sobre o datum. 1.200 deixa a câmera do herói (y 640) por dentro */
  crown?: number
  /** largura da nervura em metros; é ela que decide quanto céu a malha come */
  rib?: number
  /** distância (m) em que a casca apaga; é o anti-cintilação */
  fade?: number
}

export interface Dome {
  group: THREE.Group
  /** quantas células a casca tem, para o painel de ?stats=1 */
  celulas: number
  /** triângulos somados das duas malhas */
  triangulos: number
  /** altura da coroa sobre o datum: a órbita das naves lê daqui para passar por cima */
  coroa: number
  dispose(): void
}

const COR_NERVURA = new THREE.Color('#C6C9D2')
const COR_VIDRO = new THREE.Color('#C8D6E0')
const COR_SAIA = new THREE.Color('#26262B')

/** O trecho de vértice que os dois materiais dividem: normal, direção de vista e
 *  DISTÂNCIA À CÂMERA, que é o que mata a cintilação sem LOD de textura. */
// ⚠️ NÃO USE `cameraPosition` AQUI. O three só alimenta essa uniforme embutida
// para os materiais dele; num ShaderMaterial cru ela fica em (0,0,0) e toda
// conta de distância passa a medir do CENTRO DA CIDADE. O sintoma é bonito e
// enganoso: a casca some do raio do desvanecimento para fora e sobra só a
// calota central boiando sobre a praça, que de fora parece uma abóbada ATRÁS
// do tabuleiro. `uCam` é preenchida no onBeforeRender de cada malha.
const VS = `
  uniform vec3 uCam;
  varying vec3 vN; varying vec3 vV; varying float vD;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vec4 mv = viewMatrix * wp;
    vN = normalize(normalMatrix * normal);
    vV = normalize(-mv.xyz);
    vD = distance(wp.xyz, uCam);
    gl_Position = projectionMatrix * mv;
  }`

/** O vidro: invisível de frente, aceso na rasante, e NUNCA escurece o céu.
 *  Mistura aditiva de propósito: com mistura normal a casca virava um véu azul
 *  escuro sobre as estrelas (medido na primeira chapa, ficou rede de galinheiro).
 *  Sem transmissão de verdade, que a 8 mil células não paga. */
function materialVidro(fade: number, coroa: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTint: { value: COR_VIDRO },
      uBase: { value: 0.03 },
      uFres: { value: 0.17 },
      uFade: { value: fade },
      uCoroa: { value: coroa },
      uCam: { value: new THREE.Vector3() },
    },
    vertexShader: VS,
    fragmentShader: `
      uniform vec3 uTint; uniform float uBase; uniform float uFres; uniform float uFade; uniform float uCoroa; uniform vec3 uCam;
      varying vec3 vN; varying vec3 vV; varying float vD;
      // dentro = 1 quando a câmera está sob a casca, 0 quando ela saiu do sítio
      // ou subiu acima da coroa. O apagamento é remédio de quem olha DE DENTRO;
      // visto de fora a abóbada tem que ter silhueta.
      float dentro() {
        float r = 1.0 - smoothstep(3200.0, 3800.0, length(uCam.xz));
        float h = 1.0 - smoothstep(uCoroa * 0.9, uCoroa * 1.4, uCam.y);
        return r * h;
      }
      void main() {
        vec3 n = normalize(vN); vec3 v = normalize(vV);
        float f = pow(1.0 - abs(dot(n, v)), 3.0);
        float d = dentro();
        // ⚠️ O VIDRO TROCA DE REGRA CONFORME O LADO, e isso é escolha, não bug.
        // Por dentro ele tem que sumir para o céu preto e as estrelas
        // aparecerem; por fora ele tem que EXISTIR, senão a abóbada é um anel
        // preto no chão e mais nada (medido: a 6,5 km a nervura de 0,9 m dá
        // 0,05 px e some). Vidro de verdade faria a mesma coisa e ficaria
        // invisível: aqui a cidade é virtual e a imagem manda.
        float base = mix(0.11, uBase, d);
        float fres = mix(0.42, uFres, d);
        float brilho = pow(max(dot(reflect(-v, n), normalize(vec3(0.28, 0.86, 0.18))), 0.0), 36.0) * (1.0 - d) * 0.7;
        float longe = mix(1.0, 1.0 - smoothstep(uFade * 0.45, uFade, vD), d);
        gl_FragColor = vec4(uTint * (base + fres * f + brilho) * longe, 1.0);
      }`,
    transparent: true,
    depthWrite: false,
    // ⚠️ SEM TESTE DE PROFUNDIDADE, e isto é medido, não preguiça. A cena vai do
    // deck até o horizonte a 26 km com plano próximo curto, e a 6 km o buffer
    // de profundidade não separa mais a casca (a 1,2 km de altura) do chão que
    // ela cobre: a metade DA FRENTE da abóbada perdia o teste contra o terreno
    // e sumia, deixando só a coroa contra o céu. De fora a leitura ficava
    // "abóbada atrás do tabuleiro", que foi exatamente o que o fundador viu.
    // Como a mistura é aditiva, desenhar por cima só clareia, nunca esconde.
    // O conserto de verdade é buffer logarítmico no renderizador, e isso mexe
    // na cena inteira: fica para depois da forma aprovada.
    depthTest: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  })
}

/** A nervura: linha clara e fina, com a claridade variando pela inclinação para
 *  a abóbada ter forma, e sumindo com a distância.
 *
 *  ⚠️ O DESVANECIMENTO NÃO É ENFEITE. A nervura de 0,9 m cai abaixo de 1 pixel
 *  além de 1.300 m; sem apagar, a malha do outro lado da cidade (7 km de vão)
 *  vira um emaranhado que pisca a cada movimento de câmera. Aqui ela vai a 12%
 *  de opacidade no longe: a borda continua legível como bruma, e não como rede. */
function materialNervura(fade: number, coroa: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uCor: { value: COR_NERVURA },
      uFade: { value: fade },
      uCoroa: { value: coroa },
      uCam: { value: new THREE.Vector3() },
    },
    vertexShader: VS,
    fragmentShader: `
      uniform vec3 uCor; uniform float uFade; uniform float uCoroa; uniform vec3 uCam;
      varying vec3 vN; varying vec3 vV; varying float vD;
      float dentro() {
        float r = 1.0 - smoothstep(3200.0, 3800.0, length(uCam.xz));
        float h = 1.0 - smoothstep(uCoroa * 0.9, uCoroa * 1.4, uCam.y);
        return r * h;
      }
      void main() {
        vec3 n = normalize(vN);
        float k = 0.45 + 0.55 * abs(dot(n, normalize(vec3(0.28, 1.0, 0.18))));
        float perto = mix(0.12, 1.0, 1.0 - smoothstep(uFade * 0.35, uFade * 1.2, vD));
        gl_FragColor = vec4(uCor * k, mix(0.85, perto, dentro()));
      }`,
    transparent: true,
    depthWrite: false,
    depthTest: false,   // mesmo motivo do vidro, ver o comentário acima
    side: THREE.DoubleSide,
  })
}

export function buildDome(o: DomeOpts): Dome {
  const a = o.cell ?? 42
  const rim = o.rim ?? 90
  const crown = o.crown ?? 1200
  const ribW = o.rib ?? 0.9
  const fade = o.fade ?? 2200

  const group = new THREE.Group()
  group.name = 'abobada'

  // ── a calota ───────────────────────────────────────────────────────────────
  // Esfera que passa pela coroa (r 0, y crown) e pela borda (r R, y rim).
  const f = crown - rim
  const Rc = (DOME_R * DOME_R + f * f) / (2 * f)
  const yc = crown - Rc
  /** a normal da esfera em (x, z), que é o que orienta pillow e nervura */
  const normalEm = (x: number, z: number, out: THREE.Vector3) =>
    out.set(x, capY(Math.hypot(x, z), Math.atan2(z, x)) - yc, z).normalize()

  // ⚠️ A CASCA VAI ATÉ 3.500, NÃO ATÉ 3.500 MENOS UMA CÉLULA. A primeira versão
  // parava uma célula antes para não ter hexágono pela metade, e isso custava
  // caro no lugar errado: o loteamento tem de terminar onde a casca termina, e
  // o anel de 3.458 a 3.500 é a faixa mais produtiva do sítio (foram cerca de
  // 1.500 lotes, contra 52.991 carteiras que precisam de endereço). Como os
  // vértices da fileira de fora já são aparados contra o círculo por `apara`,
  // a borda sai limpa de qualquer jeito e a terra volta para a cidade.
  // ── O CONTORNO MANDA, O RAIO É SÓ O PISO ──────────────────────────────────
  // ⚠️ `raioNo(ang)` é o que substitui `rMax` em toda parte. Ele interpola o
  // contorno publicado; sem contorno devolve DOME_R e a casca volta a ser
  // circular, que é o comportamento antigo e continua correto para um sítio
  // redondo.
  const cen = o.centro ?? { x: 0, z: 0 }
  const heightAt = (x: number, z: number) => o.heightAt(x + cen.x, z + cen.z)
  const chaoBorda = o.superficieAt
    ? (x: number, z: number) => o.superficieAt!(x + cen.x, z + cen.z)
    : heightAt
  const folga = o.rimFolga ?? 120
  const cont = (o.contorno ?? []).map(([x, z]) => ({ a: Math.atan2(z, x), r: Math.hypot(x, z) + folga }))
  cont.sort((p, q) => p.a - q.a)
  const raioNo = (ang: number): number => {
    if (!cont.length) return DOME_R
    let a = ang
    while (a < cont[0].a) a += Math.PI * 2
    while (a > cont[cont.length - 1].a + Math.PI * 2) a -= Math.PI * 2
    for (let i = 0; i < cont.length; i++) {
      const p = cont[i], q = cont[(i + 1) % cont.length]
      let qa = q.a; if (qa < p.a) qa += Math.PI * 2
      let aa = a; if (aa < p.a) aa += Math.PI * 2
      if (aa >= p.a && aa <= qa) {
        const t = qa === p.a ? 0 : (aa - p.a) / (qa - p.a)
        return p.r + (q.r - p.r) * t
      }
    }
    return cont[0].r
  }

  const rMax = cont.length ? Math.max(...cont.map((c) => c.r)) : DOME_R

  // ── A BORDA ACOMPANHA O CHÃO ──────────────────────────────────────────────
  //
  // ⚠️ ELA ERA UMA COTA FIXA E O TERRENO VARIA 235 m. Medido em 720 rumos: a
  // parede entre a borda da calota e o solo ia de +163,8 m (rumo 310, chão a
  // −73,8) a **−71,6 m** (rumo 180, chão a +161,6). Negativo quer dizer que o
  // TERRENO ESTAVA ACIMA DA CASCA e a atravessava por 71,6 m. De um lado um
  // penhasco cego de 164 m com 3,46 km² de parede sem nada, do outro a montanha
  // entrando por dentro do domo. Era isso, e não a falta de acabamento, o que
  // aparecia na chapa como o rasgo na borda.
  //
  // Agora a calota inteira é levantada por `baseNo(ang)`: a altura do chão na
  // borda, SUAVIZADA numa janela larga. Suavizar é o ponto: seguir o relevo cru
  // faria a casca ondular como lona; a janela de ±25° deixa a cúpula inclinar
  // devagar acompanhando o sítio, que é o que estrutura grande faz, e mantém a
  // parede com altura parecida em toda a volta.
  const NB = 180
  const bruto: number[] = []
  for (let i = 0; i < NB; i++) {
    const a = (i / NB) * Math.PI * 2
    const rr = raioNo(a)
    bruto.push(chaoBorda(Math.cos(a) * rr, Math.sin(a) * rr))
  }
  const suave: number[] = []
  const JAN = Math.round(NB * 25 / 360)      // ±25° de janela
  for (let i = 0; i < NB; i++) {
    let sm = 0, w = 0
    for (let k = -JAN; k <= JAN; k++) {
      const p = (i + k + NB * 2) % NB
      const peso = 1 - Math.abs(k) / (JAN + 1)
      sm += bruto[p] * peso; w += peso
    }
    suave.push(sm / w)
  }
  const baseNo = (ang: number) => {
    let a = ang % (Math.PI * 2); if (a < 0) a += Math.PI * 2
    const t = (a / (Math.PI * 2)) * NB
    const i = Math.floor(t) % NB, f = t - Math.floor(t)
    return suave[i] * (1 - f) + suave[(i + 1) % NB] * f
  }
  const capY = (r: number, ang?: number) =>
    yc + Math.sqrt(Math.max(0, Rc * Rc - r * r)) + (ang === undefined ? 0 : baseNo(ang))
  // Almofada: quanto a célula estufa acima da calota. 0,18·a dá a leitura de
  // acolchoado sem virar bolha de plástico.
  const pillow = 0.12 * a
  // Célula grande ganha um anel a mais: a 42 m ela ocupa 28,6 graus da tela e
  // um cone de 6 triângulos apareceria como cone.
  const aneis = a >= 30 ? 2 : 1

  // ── a colmeia ──────────────────────────────────────────────────────────────
  // Rede triangular de topo chato: x = 1,5·a·q, z = √3·a·(r + q/2).
  //
  // ⚠️ A FAIXA DE `r` DEPENDE DE `q`, E ESSE FOI UM BURACO DE VERDADE. A rede é
  // CISALHADA: o termo q/2 empurra a coluna inteira em z conforme ela se afasta
  // do centro. Com uma faixa fixa de r (a primeira versão), as colunas extremas
  // pediam índices fora dela e o disco saía com uma cunha vazia a leste e a
  // oeste: 8.041 células geradas contra 8.196 que o disco pede, 1,9% de falta,
  // e a olho lê como pedaço de colmeia faltando. Aqui a faixa é resolvida por
  // coluna, a partir da corda do círculo naquele x.
  const passoQ = 1.5 * a
  const passoR = Math.sqrt(3) * a
  const nQ = Math.ceil(DOME_R / passoQ) + 2

  const centros: { x: number; z: number }[] = []
  for (let q = -nQ; q <= nQ; q++) {
    const x = passoQ * q
    if (Math.abs(x) > rMax) continue
    const meiaCorda = Math.sqrt(rMax * rMax - x * x)   // meia altura do disco neste x
    const rLo = Math.ceil((-meiaCorda) / passoR - q / 2)
    const rHi = Math.floor(meiaCorda / passoR - q / 2)
    for (let r = rLo; r <= rHi; r++) {
      const z = passoR * (r + q / 2)
      if (Math.hypot(x, z) <= raioNo(Math.atan2(z, x))) centros.push({ x, z })
    }
  }

  const CANTO: [number, number][] = []
  for (let k = 0; k < 6; k++) CANTO.push([Math.cos((k * Math.PI) / 3), Math.sin((k * Math.PI) / 3)])

  /** puxa um ponto para dentro do disco quando ele passa da borda */
  const apara = (x: number, z: number, ligado: boolean): [number, number] => {
    if (!ligado) return [x, z]
    const d = Math.hypot(x, z)
    const lim = raioNo(Math.atan2(z, x))
    return d > lim ? [(x * lim) / d, (z * lim) / d] : [x, z]
  }

  // ── vidro: uma almofada por célula, tudo fundido numa malha só ────────────
  const vidros: THREE.BufferGeometry[] = []
  const tmpN = new THREE.Vector3()
  for (const c of centros) {
    const pos: number[] = []
    const idx: number[] = []
    normalEm(c.x, c.z, tmpN)
    // centro
    pos.push(c.x, capY(Math.hypot(c.x, c.z), Math.atan2(c.z, c.x)) + pillow * tmpN.y, c.z)
    // anéis, de dentro para fora; o de fora encosta na calota
    for (let anel = 1; anel <= aneis; anel++) {
      const t = anel / aneis
      const raio = a * t
      const alt = pillow * (1 - t * t)
      for (let k = 0; k < 6; k++) {
        // ⚠️ APARA CONTRA O CÍRCULO no anel de fora. Sem isto a célula da borda
        // entra inteira (o teste é do CENTRO) e o hexágono avança até 42 m além
        // do anel da saia: a silhueta da abóbada fica serrilhada como serra.
        const [x, z] = apara(c.x + CANTO[k][0] * raio, c.z + CANTO[k][1] * raio, anel === aneis)
        pos.push(x, capY(Math.hypot(x, z), Math.atan2(z, x)) + alt, z)
      }
    }
    // leque do centro para o primeiro anel
    for (let k = 0; k < 6; k++) idx.push(0, 1 + k, 1 + ((k + 1) % 6))
    // faixas entre anéis
    for (let anel = 1; anel < aneis; anel++) {
      const b0 = 1 + (anel - 1) * 6
      const b1 = 1 + anel * 6
      for (let k = 0; k < 6; k++) {
        const k2 = (k + 1) % 6
        idx.push(b0 + k, b1 + k, b1 + k2)
        idx.push(b0 + k, b1 + k2, b0 + k2)
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setIndex(idx)
    g.computeVertexNormals()
    vidros.push(g)
  }
  const geoVidro = mergeGeometries(vidros, false)!
  vidros.forEach((g) => g.dispose())
  const matVidro = materialVidro(fade, crown)
  const malhaVidro = new THREE.Mesh(geoVidro, matVidro)
  malhaVidro.frustumCulled = false
  malhaVidro.renderOrder = 5
  // ⚠️ `uniformsNeedUpdate` é obrigatório: num ShaderMaterial cru o three sobe as
  // uniformes uma vez e depois só quando este sinal é levantado. Sem ele a
  // posição da câmera congela no primeiro quadro e o desvanecimento passa a
  // medir de um ponto que não existe mais.
  malhaVidro.onBeforeRender = (_r, _s, cam) => {
    cam.getWorldPosition(matVidro.uniforms.uCam.value)
    matVidro.uniformsNeedUpdate = true
  }
  group.add(malhaVidro)

  // ── nervuras: uma fita por aresta, cada aresta uma vez só ─────────────────
  // A aresta é compartilhada por duas células. Sem a chave de deduplicação a
  // malha desenharia 2x a estrutura e o céu ficaria com o dobro de traço.
  const vistas = new Set<string>()
  const pos: number[] = []
  const nor: number[] = []
  const idx: number[] = []
  const p0 = new THREE.Vector3(), p1 = new THREE.Vector3(), meio = new THREE.Vector3()
  const dir = new THREE.Vector3(), lado = new THREE.Vector3(), nrm = new THREE.Vector3()
  const canto = (cx: number, cz: number, k: number, out: THREE.Vector3) => {
    const [x, z] = apara(cx + CANTO[k][0] * a, cz + CANTO[k][1] * a, true)
    return out.set(x, capY(Math.hypot(x, z), Math.atan2(z, x)), z)
  }
  for (const c of centros) {
    for (let k = 0; k < 6; k++) {
      canto(c.x, c.z, k, p0)
      canto(c.x, c.z, (k + 1) % 6, p1)
      meio.addVectors(p0, p1).multiplyScalar(0.5)
      const chave = `${Math.round(meio.x / 0.5)}:${Math.round(meio.z / 0.5)}`
      if (vistas.has(chave)) continue
      vistas.add(chave)
      normalEm(meio.x, meio.z, nrm)
      dir.subVectors(p1, p0).normalize()
      lado.crossVectors(dir, nrm).normalize().multiplyScalar(ribW / 2)
      // 0,4 m acima do vidro: sem isso as duas superfícies brigam pelo z-buffer
      const sobe = 0.4
      const base = pos.length / 3
      for (const p of [p0, p1]) {
        pos.push(p.x - lado.x, p.y + nrm.y * sobe - lado.y, p.z - lado.z)
        nor.push(nrm.x, nrm.y, nrm.z)
        pos.push(p.x + lado.x, p.y + nrm.y * sobe + lado.y, p.z + lado.z)
        nor.push(nrm.x, nrm.y, nrm.z)
      }
      idx.push(base, base + 1, base + 3, base, base + 3, base + 2)
    }
  }
  const geoNerv = new THREE.BufferGeometry()
  geoNerv.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geoNerv.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  geoNerv.setIndex(idx)
  const matNerv = materialNervura(fade, crown)
  const malhaNerv = new THREE.Mesh(geoNerv, matNerv)
  malhaNerv.renderOrder = 6
  malhaNerv.frustumCulled = false
  malhaNerv.onBeforeRender = (_r, _s, cam) => {
    cam.getWorldPosition(matNerv.uniforms.uCam.value)
    matNerv.uniformsNeedUpdate = true
  }
  group.add(malhaNerv)

  // ── O REMATE COM O SOLO ───────────────────────────────────────────────────
  //
  // ⚠️ O HEXÁGONO NÃO TOCA O CHÃO (fundador, 30/08). Ele morre num ANEL DE
  // COROAMENTO de aço, e é o aço que desce até a sapata. Antes a tela de
  // hexágonos era simplesmente recortada no raio da borda e ia morrer na terra:
  // a chapa mostrava a célula cortada pela metade chegando ao solo, que é o que
  // o fundador chamou de agonia. Engenheiro nenhum aprova uma estrutura
  // pressurizada terminando assim, porque a borda de uma casca é justamente onde
  // o esforço de membrana vira esforço de flexão e precisa de um elemento rígido
  // para receber.
  //
  // A sequência, de cima para baixo, é a de uma casca de verdade:
  //   1. TELA DE HEXÁGONOS      recortada no raio da borda
  //   2. ANEL DE COROAMENTO     caixão de aço preto, onde a tela morre
  //   3. PAREDE                 do anel até o joelho
  //   4. BERMA                  o chanfro
  //   5. SAPATA                 anel horizontal, embutido no solo
  //
  // ⚠️ E AS COTAS SAEM DE `superficieAt`, a superfície que a câmera vê, com 2.880
  // segmentos. Medido antes: com 360 a corda reta entre dois vértices se afastava
  // do chão real em até 4,66 m num perímetro de 44,9 km. Com 2.880 o pior caso é
  // 0,57 m e a berma de 9 m absorve isso com folga de ordem de grandeza.
  const SEG = 2880
  const EMBUTE = 8         // quanto a sapata entra no solo
  const sapata = 26        // largura do anel horizontal
  const berma = 9          // o chanfro entre a parede e a sapata
  const ANEL_H = 7.5       // altura do caixão de coroamento
  const ANEL_W = 4.5       // o quanto ele avança para fora da tela
  const chao = o.superficieAt ?? heightAt

  const sPos: number[] = [], sIdx: number[] = []     // parede, berma e sapata
  const aPos: number[] = [], aIdx: number[] = []     // o anel de aço
  for (let i = 0; i <= SEG; i++) {
    const ang = (i / SEG) * Math.PI * 2
    const rr = raioNo(ang)
    const cx2 = Math.cos(ang), cz2 = Math.sin(ang)
    const x = cx2 * rr, z = cz2 * rr
    const yBorda = capY(rr, ang)            // onde a tela de hexágonos morre
    const yChao = chao(x, z)
    // o anel: caixão que recebe a tela, avança para fora e desce ANEL_H
    aPos.push(cx2 * (rr - ANEL_W), yBorda, cz2 * (rr - ANEL_W))            // 0 aba de dentro
    aPos.push(cx2 * (rr + ANEL_W), yBorda, cz2 * (rr + ANEL_W))            // 1 aba de fora
    aPos.push(cx2 * (rr + ANEL_W), yBorda - ANEL_H, cz2 * (rr + ANEL_W))   // 2 pé de fora
    aPos.push(cx2 * (rr - ANEL_W), yBorda - ANEL_H, cz2 * (rr - ANEL_W))   // 3 pé de dentro
    // a parede e a base, a partir do pé do anel
    sPos.push(x, yBorda - ANEL_H, z)                                        // 0 topo da parede
    sPos.push(x, yChao + berma, z)                                          // 1 pé da parede
    sPos.push(cx2 * (rr + berma), yChao, cz2 * (rr + berma))                // 2 joelho
    sPos.push(cx2 * (rr + sapata), yChao - EMBUTE, cz2 * (rr + sapata))     // 3 borda enterrada
  }
  for (let i = 0; i < SEG; i++) {
    const b = i * 4, c = (i + 1) * 4
    for (let k = 0; k < 3; k++) {
      sIdx.push(b + k, b + k + 1, c + k + 1, b + k, c + k + 1, c + k)
      aIdx.push(b + k, b + k + 1, c + k + 1, b + k, c + k + 1, c + k)
    }
    aIdx.push(b + 3, b, c, b + 3, c, c + 3)     // fecha o caixão por dentro
  }
  const geoSaia = new THREE.BufferGeometry()
  geoSaia.setAttribute('position', new THREE.Float32BufferAttribute(sPos, 3))
  geoSaia.setIndex(sIdx)
  geoSaia.computeVertexNormals()
  const matSaia = new THREE.MeshStandardMaterial({
    color: COR_SAIA, metalness: 0.3, roughness: 0.8, side: THREE.DoubleSide,
  })
  // ⚠️ O ANEL É PRETO E METÁLICO DE PROPÓSITO: é ele que dá a linha de remate que
  // se lê de longe e que separa a tela clara do solo. Sem contraste ele some e o
  // problema volta a ser visual mesmo estando construído.
  const geoAnel = new THREE.BufferGeometry()
  geoAnel.setAttribute('position', new THREE.Float32BufferAttribute(aPos, 3))
  geoAnel.setIndex(aIdx)
  geoAnel.computeVertexNormals()
  const matAnel = new THREE.MeshStandardMaterial({
    color: '#141416', metalness: 0.85, roughness: 0.42, side: THREE.DoubleSide,
  })
  const malhaAnel = new THREE.Mesh(geoAnel, matAnel)
  malhaAnel.name = 'abobada:anel'
  malhaAnel.castShadow = true
  malhaAnel.receiveShadow = true
  malhaAnel.frustumCulled = false
  group.add(malhaAnel)
  const malhaSaia = new THREE.Mesh(geoSaia, matSaia)
  malhaSaia.frustumCulled = false
  group.add(malhaSaia)

  const triangulos =
    geoVidro.index!.count / 3 + geoNerv.index!.count / 3 + geoSaia.index!.count / 3

  group.position.set(cen.x, 0, cen.z)


  return {
    group,
    celulas: centros.length,
    triangulos,
    coroa: crown,
    dispose() {
      geoVidro.dispose(); matVidro.dispose()
      geoNerv.dispose(); matNerv.dispose()
      geoSaia.dispose(); matSaia.dispose()
    },
  }
}
