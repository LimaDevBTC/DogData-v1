// ═══════════════════════════════════════════════════════════════════════════
// OS LOTES: a demarcação dos 52.984 lotes, e nada além dela.
//
// Este módulo é a seção 2 de maquete-spec.md. Ele substitui, no modo 'lote', o
// plinto de 0,45 m e o marco por lote de tecido.ts:92-213. O que vai ao ar é um
// LOTEAMENTO SEM PRÉDIOS: chão demarcado, divisa gravada, marco de quarteirão.
//
// ⚠️ POR QUE UM QUAD INSTANCIADO E NÃO UMA CAIXA. O plinto de hoje são 52.984
// caixas de 12 triângulos (635.808) mais 52.984 marcos (outros 635.808), tudo
// lançando sombra. O levantamento mediu as três alternativas: decal custa 30,03
// ms POR lote (26,5 minutos de CPU para a cidade), atlas de textura pede 1,24
// giga texel, e o quad instanciado com a divisa desenhada no fragmento custa
// 0,47 a 0,66 ms contra 1,67 a 2,11 ms do plinto. São 2 triângulos por lote,
// 105.968 no total, UMA chamada de desenho.
//
// ⚠️ polygonOffset É INERTE NESTA CENA e não adianta tentar. plaza-scene.tsx
// liga logarithmicDepthBuffer, o fragmento escreve gl_FragDepthEXT e apaga o
// deslocamento do rasterizador: medido, fator 0, -16 e -64 dão os MESMOS 9.556
// px de cobertura. O que resolve é ALTURA, e 0,02 m bastam de 300 m a 9.000 m.
//
// ⚠️ MeshStandardMaterial COM onBeforeCompile, E NÃO UM ShaderMaterial CRU. A
// spec pede "ShaderMaterial, nunca RawShaderMaterial, com seis includes"; o
// motivo dela é não perder logdepth, tonemapping e colorspace. onBeforeCompile
// sobre o MeshStandard entrega os seis includes POR CONSTRUÇÃO e mais três
// coisas que um shader próprio teria de reescrever à mão: recebimento de
// sombra, o environment lunar (lunar-env.ts) e a MESMA resposta de luz das vias
// e do terreno. Sem isso as razões de contraste da §1.5 (calçada/lote 1,55:1)
// seriam medidas contra um lote iluminado por outra fórmula e não fechariam.
// Continua sendo 1 material e 1 programa.
//
// Lê public/city/cidade-lotes.bin (11 bytes por lote) e, para os marcos,
// public/city/cidade-malha.json (1.182 quarteirões com centro, lado e giro).
//
// Three.js puro (regra da casa: nada de react-three-fiber).
// ═══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three'

export interface LotesMeta {
  /** graus de giro por setor; a malha do setor k está girada k * este valor */
  giroPorSetor: number
  setores?: number
}

interface QuarteiraoMalha {
  id: string; setor: number; x: number; z: number; giro: number; lado: number
}
interface MalhaLotes {
  constantes: { giroPorSetor: number; quarteirao: number }
  quarteiroes: QuarteiraoMalha[]
}

export interface LotesOpts {
  /** ⚠️ tem de ser o superficieAt de terrain.ts, que é o plano que a malha do
   *  terreno realmente desenha. heightAt cru é bilinear e cai ABAIXO da malha em
   *  42,3% dos pontos, até 2,04 m: o lote apareceria recortado. */
  heightAt: (x: number, z: number) => number
  /** public/city/cidade.json já carregado; se faltar, o módulo busca */
  meta?: LotesMeta
  /** public/city/cidade-lotes.bin já carregado; se faltar, o módulo busca */
  buf?: ArrayBuffer
  /** public/city/cidade-malha.json já carregado; se faltar, o módulo busca */
  malha?: MalhaLotes
  /** sombra própria do marco de quarteirão (o quad do lote nunca lança) */
  sombra?: boolean
}

export interface Lotes {
  group: THREE.Group
  lotes: number
  quarteiroes: number
  marcos: number
  /** lotes que subiram +0,04 m por estarem contidos numa superquadra (D9) */
  elevados: number
  superquadras: number
  triangulos: number
  /** ms de montagem na CPU, para o log não mentir */
  montagemMs: number
  dispose(): void
}

// ── a paleta, §1.1 da spec ────────────────────────────────────────────────
// ⚠️ NÃO INVENTE TOM AQUI. Os três tons de miolo estão a ±7% de luminância um
// do outro de propósito: o critério 3 do júri mede contraste local entre 8,0 e
// 14,0 num recorte de tecido puro, e a paleta de hoje (4 tons de tecido.ts com
// ruído de 0,88 a 1,04) mede 18,81, que é grão, não cidade.
const MIOLO = ['#A8A296', '#A39D91', '#9E988C'] // LOTE A, B, C
const LABIO = '#D8D2C4'                          // o fio de fora da divisa
const SULCO = '#5F5A4E'                          // a ranhura de dentro
const ACENTO = '#E8660D'                         // só os 34 lotes DSC
const COR_MARCO = '#8F8879'                      // MEDIO, o mesmo do meio-fio

// ── as cotas e as larguras, todas medidas ─────────────────────────────────
/** Altura do quad sobre o terreno. Medida: com 0 m a fita fica manchada já a
 *  300 m; 0,005 m segura até 1.000 m; 0,010 até 3.000; 0,020 aguenta 9.000 m. */
const ALTURA_LOTE = 0.02
/** O degrau da regra D9: lote contido em superquadra desenha em +0,06 m. */
const ALTURA_CONTIDO = 0.06
/** Largura nominal da divisa, em metros (§2.2). */
const LARG_DIVISA = 0.3
/** Piso de largura em PIXEL. Medido: 1,2 px sobe o contraste local da vista de
 *  topo de 13,23 (largura fixa) para 20,89; 2,0 px não melhora e piora a
 *  cintilação (7,41 contra 7,97), por isso está proibido. */
const PISO_PX = 1.2
/** A troca de contorno por tom. A frente do lote mediano (12,5 m) mede 3,00 px
 *  a 4.884 m; abaixo de 3 px uma borda de 1,2 px de cada lado come o lote
 *  inteiro, então o contorno some e o miolo fica opaco. */
const RAMPA_DE = 4900
const RAMPA_ATE = 6500
/** Opacidade do miolo de perto: a divisa é o que se lê, o miolo deixa o relevo
 *  do regolito aparecer por baixo. De longe vira 1,0 (§2.2). */
const ALFA_MIOLO_PERTO = 0.62

// ⚠️ O RECUO DE MEIO METRO NÃO É ESTÉTICA, É O ARREDONDAMENTO DO .BIN. O
// registro guarda x, z, frente e prof em INTEIROS de metro, então o retângulo
// que se lê não é o que o gerador calculou. Medido em 29/08 sobre os 43.571
// pares de lotes vizinhos do mesmo quarteirão: 17.444 pares (40,0%) se
// SOBREPÕEM depois do arredondamento, mediana 0,346 m, p95 0,938 m, máximo
// 10,076 m. Dois quads coplanares na mesma cota brigam no z-buffer e, pior, a
// divisa de um cai dentro do miolo do outro. Recuar 0,25 m de cada lado (meia
// unidade do arredondamento) devolve uma folga mediana de 0,154 m entre os
// retângulos desenhados e mantém o par lábio/lábio da divisa dentro de 0,60 m,
// que é o que o critério 5 mede (1,2 a 2,8 px a meia altura).
const RECUO_DIVISA = 0.25

// ⚠️ O MICRO-DEGRAU EXISTE PARA OS 4,3% QUE O RECUO NÃO RESOLVE. Sobram 1.974
// pares sobrepostos depois do recuo. Sem uma cota própria eles são exatamente
// coplanares (o terreno é PLANO por triângulo de 59 m, então dois lotes dentro
// do mesmo triângulo recebem o mesmo plano até o último bit) e o par pisca ao
// mover a câmera. 4 níveis de 4 mm quebram o empate e medem 0,014 px a 300 m.
const DEGRAU_MM = 0.004

// ── marco de quarteirão (§2.4) ────────────────────────────────────────────
const MARCO_LARG = 0.6
const MARCO_ALT = 1.2
/** recuo do marco para dentro da esquina do quarteirão */
const MARCO_RECUO = 1.0
/** Onde o marco morre. ⚠️ O CORTE É POR INSTÂNCIA E MEDE A DISTÂNCIA DO CENTRO
 *  DO QUARTEIRÃO, que é o que a §2.4 pede. O DistanceCuller de perf.ts liga e
 *  desliga um Object3D inteiro e não sabe cortar instância dentro de um
 *  InstancedMesh: registrar os 4.728 marcos nele só daria a escolha entre
 *  desenhar todos ou nenhum, e registrar com centro na origem é justamente o
 *  erro de props.ts:98. Por isso o corte foi para o vertex shader. */
const MARCO_CULL_DE = 1000
const MARCO_CULL_ATE = 1200

/** as cinco sondas internas do lote (centro e quatro meios-quadrantes), em
 *  coordenada normalizada -1..1 */
const SONDAS = [0, 0, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5]

/** ruído determinístico por lote: a cidade é a mesma em toda visita.
 *  Mesma função de tecido.ts:69-74, repetida porque lá ela não é exportada. */
function hash01(i: number): number {
  let t = (i + 0x9e3779b9) >>> 0
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

export async function buildLotes(o: LotesOpts): Promise<Lotes> {
  const t0 = performance.now()
  const [meta, buf, malha] = await Promise.all([
    o.meta ? Promise.resolve(o.meta) : fetch('/city/cidade.json').then((r) => r.json() as Promise<LotesMeta>),
    o.buf ? Promise.resolve(o.buf) : fetch('/city/cidade-lotes.bin').then((r) => r.arrayBuffer()),
    o.malha ? Promise.resolve(o.malha) : fetch('/city/cidade-malha.json').then((r) => r.json() as Promise<MalhaLotes>),
  ])

  const REG = 11
  const dv = new DataView(buf)
  const n = Math.floor(buf.byteLength / REG)
  const giroPorSetor = meta.giroPorSetor ?? 7.5
  const group = new THREE.Group()
  group.name = 'lotes'

  // ── 1. lê o .bin de uma vez para arrays planos ──────────────────────────
  const cx = new Float32Array(n), cz = new Float32Array(n)
  const fr = new Float32Array(n), pf = new Float32Array(n)
  const setorDe = new Uint8Array(n), formaDe = new Uint8Array(n), dscDe = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    const off = i * REG
    cx[i] = dv.getInt16(off, true)
    cz[i] = dv.getInt16(off + 2, true)
    setorDe[i] = dv.getUint8(off + 4)
    const flags = dv.getUint8(off + 8)
    dscDe[i] = flags & 1
    formaDe[i] = Math.min(4, (flags >> 1) & 7)
    fr[i] = dv.getUint8(off + 9)
    pf[i] = dv.getUint8(off + 10)
  }

  // ── 2. a regra D9: quem está contido em quem ────────────────────────────
  // ⚠️ O NÚMERO DA SPEC ERA 141 E HOJE É OUTRO, E ISSO NÃO É ERRO DESTE MÓDULO.
  // scripts/gerar_cidade.py:586-609 tem o ramo gigante que grava uma superquadra
  // por cima de lotes já plantados; a semente de 52.991 lotes que o levantamento
  // mediu tinha 7 superquadras cobrindo 141 lotes. Medido em 29/08 sobre o .bin
  // publicado (52.984 lotes): as 26 superquadras estão sozinhas no quarteirão
  // delas e cobrem ZERO lotes. A regra fica implementada porque a semente se
  // mexe; o log diz o que ela achou HOJE, e é o log que manda.
  const contido = new Uint8Array(n)
  const grandes: number[] = []
  for (let i = 0; i < n; i++) if (fr[i] * pf[i] >= 2500) grandes.push(i)
  // grade uniforme de 200 m para não fazer 52.984² comparações
  const CEL = 200
  const balde = new Map<number, number[]>()
  const chave = (gx: number, gz: number) => gx * 100000 + gz
  for (let i = 0; i < n; i++) {
    const k = chave(Math.floor(cx[i] / CEL), Math.floor(cz[i] / CEL))
    const b = balde.get(k)
    if (b) b.push(i); else balde.set(k, [i])
  }
  const superqComLote = new Set<number>()
  for (const g of grandes) {
    const ang = -THREE.MathUtils.degToRad(setorDe[g] * giroPorSetor)
    const cg = Math.cos(ang), sg = Math.sin(ang)
    const raio = Math.hypot(fr[g], pf[g]) / 2
    const g0x = Math.floor((cx[g] - raio) / CEL), g1x = Math.floor((cx[g] + raio) / CEL)
    const g0z = Math.floor((cz[g] - raio) / CEL), g1z = Math.floor((cz[g] + raio) / CEL)
    for (let gx = g0x; gx <= g1x; gx++) for (let gz = g0z; gz <= g1z; gz++) {
      for (const j of balde.get(chave(gx, gz)) ?? []) {
        if (j === g || setorDe[j] !== setorDe[g]) continue
        if (fr[j] * pf[j] >= fr[g] * pf[g]) continue
        // quadro local do gigante: a rotação é a mesma (mesmo setor), então
        // basta girar o vetor entre os centros e comparar meias-extensões
        const dx = cx[j] - cx[g], dz = cz[j] - cz[g]
        const lx = dx * cg + dz * sg, lz = -dx * sg + dz * cg
        if (Math.abs(lx) + fr[j] / 2 <= fr[g] / 2 && Math.abs(lz) + pf[j] / 2 <= pf[g] / 2) {
          contido[j] = 1
          superqComLote.add(g)
        }
      }
    }
  }
  let elevados = 0
  for (let i = 0; i < n; i++) if (contido[i]) elevados++

  // ── 3. os atributos por instância ───────────────────────────────────────
  const iOff = new Float32Array(n * 2)
  const iRot = new Float32Array(n)
  const iDim = new Float32Array(n * 2)
  const iAlt = new Float32Array(n * 4)
  const iTint = new Float32Array(n * 3)
  const iFlag = new Float32Array(n)
  const tint = new THREE.Color()

  for (let i = 0; i < n; i++) {
    const ang = -THREE.MathUtils.degToRad(setorDe[i] * giroPorSetor)
    const cg = Math.cos(ang), sg = Math.sin(ang)
    const larg = Math.max(1, fr[i] - 2 * RECUO_DIVISA)
    const prof = Math.max(1, pf[i] - 2 * RECUO_DIVISA)
    const meiaL = larg / 2, meiaP = prof / 2
    const ox = cx[i], oz = cz[i]
    /** altura do terreno num ponto dado no quadro local do lote */
    const chao = (lx: number, lz: number) => o.heightAt(ox + lx * cg - lz * sg, oz + lx * sg + lz * cg)

    // ⚠️ AS QUATRO ALTURAS DE QUINA SÃO OBRIGATÓRIAS. O declive do lote tem
    // mediana 1,72 grau, p95 3,80 e máximo 6,11. Com um quad plano na altura do
    // centro o chão passa POR CIMA do lote em 0,340 m na mediana e 3,296 m no
    // pior caso, e na chapa isso aparece como lote recortado em triângulo. Com
    // as quinas o resíduo cai para 0,005 m na mediana.
    const q00 = chao(-meiaL, -meiaP), q10 = chao(+meiaL, -meiaP)
    const q01 = chao(-meiaL, +meiaP), q11 = chao(+meiaL, +meiaP)

    // ⚠️ E AS QUINAS AINDA NÃO BASTAM. O quad interpola linear entre elas e a
    // malha do terreno é plana por TRIÂNGULO de 59 m: quando a diagonal de uma
    // célula cruza o lote, o meio do lote fica abaixo do chão. Cinco sondas
    // internas medem essa flecha e a folga sobe o lote inteiro por ela.
    let folga = 0
    for (let s = 0; s < SONDAS.length; s += 2) {
      const u = SONDAS[s], v = SONDAS[s + 1]
      const tu = (u + 1) / 2, tv = (v + 1) / 2
      const bil = (q00 * (1 - tu) + q10 * tu) * (1 - tv) + (q01 * (1 - tu) + q11 * tu) * tv
      const d = chao(u * meiaL, v * meiaP) - bil
      if (d > folga) folga = d
    }

    const lift = ALTURA_LOTE + folga + DEGRAU_MM * (i % 4) + (contido[i] ? ALTURA_CONTIDO - ALTURA_LOTE : 0)
    iOff[i * 2] = cx[i]; iOff[i * 2 + 1] = cz[i]
    iRot[i] = ang
    iDim[i * 2] = larg; iDim[i * 2 + 1] = prof
    iAlt[i * 4] = q00 + lift
    iAlt[i * 4 + 1] = q10 + lift
    iAlt[i * 4 + 2] = q01 + lift
    iAlt[i * 4 + 3] = q11 + lift

    // três tons, índice (i + forma) % 3, com um ruído CURTO por cima. O ruído
    // largo de tecido.ts (0,88 a 1,04) é metade do grão de 18,81 que o critério
    // 3 reprova; ±3% mantém a variação sem virar cascalho.
    tint.set(MIOLO[(i + formaDe[i]) % 3])
    const k = 0.97 + 0.06 * hash01(i)
    iTint[i * 3] = tint.r * k
    iTint[i * 3 + 1] = tint.g * k
    iTint[i * 3 + 2] = tint.b * k
    iFlag[i] = dscDe[i] ? 1 : 0
  }

  // ── 4. a malha: um quad instanciado, 1 chamada de desenho ───────────────
  const base = new THREE.PlaneGeometry(1, 1)
  base.rotateX(-Math.PI / 2) // deitado, normal para cima
  const geo = new THREE.InstancedBufferGeometry()
  geo.setIndex(base.getIndex())
  geo.setAttribute('position', base.getAttribute('position'))
  geo.setAttribute('normal', base.getAttribute('normal'))
  geo.setAttribute('uv', base.getAttribute('uv'))
  geo.setAttribute('iOff', new THREE.InstancedBufferAttribute(iOff, 2))
  geo.setAttribute('iRot', new THREE.InstancedBufferAttribute(iRot, 1))
  geo.setAttribute('iDim', new THREE.InstancedBufferAttribute(iDim, 2))
  geo.setAttribute('iAlt', new THREE.InstancedBufferAttribute(iAlt, 4))
  geo.setAttribute('iTint', new THREE.InstancedBufferAttribute(iTint, 3))
  geo.setAttribute('iFlag', new THREE.InstancedBufferAttribute(iFlag, 1))
  geo.instanceCount = n
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 6000)

  const mat = new THREE.MeshStandardMaterial({
    roughness: 0.95,
    metalness: 0,
    // ⚠️ transparent: true é o que faz o alfa de 0,62 do miolo existir (§2.2).
    // O quad não lança sombra (é chão) e por isso não gera material de
    // profundidade nem programa extra na passada de sombra.
    transparent: true,
  })
  mat.name = 'lote'
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uLabio = { value: new THREE.Color(LABIO) }
    sh.uniforms.uSulco = { value: new THREE.Color(SULCO) }
    sh.uniforms.uAcento = { value: new THREE.Color(ACENTO) }
    sh.vertexShader = sh.vertexShader
      .replace(
        '#include <common>',
        /* glsl */`
        #include <common>
        attribute vec2 iOff;
        attribute float iRot;
        attribute vec2 iDim;
        attribute vec4 iAlt;
        attribute vec3 iTint;
        attribute float iFlag;
        varying vec2 vLocalM;
        varying vec2 vHalfM;
        varying vec3 vTint;
        varying float vFlag;
        varying float vDistCam;
        `,
      )
      .replace(
        '#include <beginnormal_vertex>',
        /* glsl */`
        float lc = cos(iRot);
        float ls = sin(iRot);
        // a normal é a do PLANO DO LOTE, tirada das quatro quinas: assim o
        // relevo do regolito continua modelando o campo de lotes em vez de ele
        // virar uma placa chapada de 20 km².
        float dhx = ((iAlt.y + iAlt.w) - (iAlt.x + iAlt.z)) * 0.5 / max(iDim.x, 1.0);
        float dhz = ((iAlt.z + iAlt.w) - (iAlt.x + iAlt.y)) * 0.5 / max(iDim.y, 1.0);
        vec3 nLocal = normalize(vec3(-dhx, 1.0, -dhz));
        vec3 objectNormal = vec3(nLocal.x * lc + nLocal.z * ls, nLocal.y, -nLocal.x * ls + nLocal.z * lc);
        `,
      )
      .replace(
        '#include <begin_vertex>',
        /* glsl */`
        vec2 lm = position.xz * iDim;
        vec2 wxz = iOff + vec2(lm.x * lc + lm.y * ls, -lm.x * ls + lm.y * lc);
        vec2 t01 = position.xz + 0.5;
        float hy = mix(mix(iAlt.x, iAlt.y, t01.x), mix(iAlt.z, iAlt.w, t01.x), t01.y);
        vec3 transformed = vec3(wxz.x, hy, wxz.y);
        vLocalM = lm;
        vHalfM = iDim * 0.5;
        vTint = iTint;
        vFlag = iFlag;
        vDistCam = distance(cameraPosition, transformed);
        `,
      )
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        /* glsl */`
        #include <common>
        uniform vec3 uLabio;
        uniform vec3 uSulco;
        uniform vec3 uAcento;
        varying vec2 vLocalM;
        varying vec2 vHalfM;
        varying vec3 vTint;
        varying float vFlag;
        varying float vDistCam;
        `,
      )
      .replace(
        '#include <color_fragment>',
        /* glsl */`
        // distância à divisa mais próxima, EM METROS
        vec2 dEdge = vHalfM - abs(vLocalM);
        float dist = min(dEdge.x, dEdge.y);
        // ⚠️ fwidth(dist) É QUANTO VALE UM PIXEL ALI, e é por isso que a largura
        // não pode ser fixa em metro: uma linha de 0,30 m mede 1,17 px a 300 m e
        // 0,06 px a 6.213 m. O piso em pixel é o que mantém a divisa legível.
        float mpp = max(fwidth(dist), 1e-5);
        float ehDsc = step(0.5, vFlag);
        float nominal = mix(${LARG_DIVISA.toFixed(3)}, ${(LARG_DIVISA * 2).toFixed(3)}, ehDsc);
        float piso = mix(${PISO_PX.toFixed(2)}, ${(PISO_PX * 2).toFixed(2)}, ehDsc);
        float larg = max(nominal, piso * mpp);
        // troca de contorno por TOM: passado 6.500 m o lote é só uma mancha
        float k = smoothstep(${RAMPA_DE.toFixed(1)}, ${RAMPA_ATE.toFixed(1)}, vDistCam);
        float aa = mpp * 0.5;
        float banda = (1.0 - smoothstep(larg - aa, larg + aa, dist)) * (1.0 - k);
        // 40% de fora é LÁBIO, 60% de dentro é SULCO: é o par claro-escuro que
        // faz o olho ler ranhura gravada em vez de linha pintada.
        float tb = clamp(dist / larg, 0.0, 1.0);
        float tw = clamp(aa / larg, 0.001, 0.4);
        vec3 corBorda = mix(uLabio, uSulco, smoothstep(0.4 - tw, 0.4 + tw, tb));
        corBorda = mix(corBorda, uAcento, ehDsc);
        diffuseColor.rgb = mix(vTint, corBorda, banda);
        diffuseColor.a = mix(mix(${ALFA_MIOLO_PERTO.toFixed(2)}, 1.0, k), 1.0, banda);
        `,
      )
  }

  const malhaLotes = new THREE.Mesh(geo, mat)
  malhaLotes.name = 'lotes:quad'
  malhaLotes.frustumCulled = false
  malhaLotes.receiveShadow = true
  malhaLotes.castShadow = false
  // o chão desenha depois do terreno e antes de qualquer coisa erguida
  malhaLotes.renderOrder = 1
  group.add(malhaLotes)

  // ── 5. o marco de quarteirão ────────────────────────────────────────────
  // ⚠️ O MARCO DE LOTE MORREU AQUI. Os 52.984 marcos de tecido.ts:159-197
  // custavam 635.808 triângulos e um material inteiro para produzir 0,59 px de
  // largura na vista aérea, ou seja grão. Quatro por quarteirão são 4.728, onze
  // vezes menos, e existem só na chapa onde se leem.
  const quart = malha.quarteiroes ?? []
  const nm = quart.length * 4
  const geoMarco = new THREE.BoxGeometry(MARCO_LARG, MARCO_ALT, MARCO_LARG)
  geoMarco.translate(0, MARCO_ALT / 2, 0) // pivô no pé
  const matMarco = new THREE.MeshStandardMaterial({ color: COR_MARCO, roughness: 0.95, metalness: 0 })
  matMarco.name = 'marco-quarteirao'
  const marcos = new THREE.InstancedMesh(geoMarco, matMarco, Math.max(1, nm))
  marcos.name = 'lotes:marco'
  const m4 = new THREE.Matrix4()
  const pm = new THREE.Vector3()
  const qm = new THREE.Quaternion()
  const eixoY = new THREE.Vector3(0, 1, 0)
  const um = new THREE.Vector3(1, 1, 1)
  let im = 0
  for (const q of quart) {
    const g = (q.giro * Math.PI) / 180
    const cg = Math.cos(g), sg = Math.sin(g)
    const meio = q.lado / 2 - MARCO_RECUO
    qm.setFromAxisAngle(eixoY, -g)
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
      const lx = sx * meio, lz = sz * meio
      const wx = q.x + lx * cg - lz * sg
      const wz = q.z + lx * sg + lz * cg
      pm.set(wx, o.heightAt(wx, wz) + ALTURA_LOTE, wz)
      m4.compose(pm, qm, um)
      marcos.setMatrixAt(im++, m4)
    }
  }
  marcos.count = im
  marcos.instanceMatrix.needsUpdate = true
  marcos.frustumCulled = false
  marcos.castShadow = o.sombra ?? true
  marcos.receiveShadow = true

  // o corte por distância, por instância, no vertex shader (ver MARCO_CULL_DE)
  const cull = (sh: { vertexShader: string }) => {
    sh.vertexShader = sh.vertexShader.replace(
      '#include <begin_vertex>',
      /* glsl */`
      #include <begin_vertex>
      // instanceMatrix[3].xyz é o pé do marco, ou seja a esquina do quarteirão:
      // a distância sai do OBJETO e não da origem da cena (o erro de props.ts:98)
      float dMarco = distance(cameraPosition, instanceMatrix[3].xyz);
      transformed *= 1.0 - smoothstep(${MARCO_CULL_DE.toFixed(1)}, ${MARCO_CULL_ATE.toFixed(1)}, dMarco);
      `,
    )
  }
  matMarco.onBeforeCompile = cull
  // ⚠️ E A SOMBRA TEM DE ENCOLHER JUNTO. Sem isto o marco some passado 1.200 m e
  // a sombra dele fica no chão sozinha, porque a passada de profundidade usa
  // outro material e não recebe a injeção do material visível.
  const matMarcoDepth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking })
  matMarcoDepth.onBeforeCompile = cull
  marcos.customDepthMaterial = matMarcoDepth
  group.add(marcos)

  const triangulos = n * 2 + im * 12
  const montagemMs = performance.now() - t0

  return {
    group,
    lotes: n,
    quarteiroes: quart.length,
    marcos: im,
    elevados,
    superquadras: superqComLote.size,
    triangulos,
    montagemMs,
    dispose() {
      base.dispose()
      geo.dispose()
      mat.dispose()
      geoMarco.dispose()
      matMarco.dispose()
      matMarcoDepth.dispose()
    },
  }
}
