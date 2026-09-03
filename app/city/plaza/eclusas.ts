// ═══════════════════════════════════════════════════════════════════════════
// AS ECLUSAS: as três entradas da cidade, e a do Spaceport é a artéria do DOG.
//
// A transação chega assim: a nave pousa no pátio (r 11.200), a carga embarca no
// veículo, o veículo entra pela BOCA da eclusa, atravessa três câmaras em série
// por baixo da casca e sobe dentro da cidade, no anel r 4.450, de onde segue até
// o endereço da carteira que recebe. Este módulo desenha isso. Ele não inventa
// traçado nenhum: lê `eclusas` de `public/city/cidade-malha.json`.
//
// ═══ O QUE ESTAVA ERRADO, E POR QUÊ ═════════════════════════════════════════
//
// ⚠️ 1. O DADO NUNCA ESTEVE TORTO. Medido em 03/09 contra o JSON publicado: o
//    eixo de cada eclusa (a reta portalExterno → portalInterno) aponta para o
//    centro da cidade com desvio de 0,0° nas três. Quem viu túnel "apontando
//    para o lado errado" leu o campo `rumo` com a convenção trocada.
//
// ⚠️ 2. A CONVENÇÃO DO `rumo`, MEDIDA. `cidade-malha.json` → `esquema` diz
//    "rumo em graus, 0 = norte (−z), cresce para leste (+x)", e o gerador
//    confirma (`scripts/gerar_cidade.py:2161`): x = sin(rumo)·r, z = −cos(rumo)·r,
//    ou seja rumo = atan2(x, −z). Conferido nas três, casa em 0,1°:
//      ECParque    rumo 43,0  → portal (6240,3; −6691,9)
//      ECExtracao  rumo 214,0 → portal (−5368,3;  7958,8)
//      ECSpaceport rumo 183,0 → portal ( −580,9; 11084,8)
//    Uma leitura por atan2(−x, −z) devolve 317, 146 e 177, que é o MESMO raio
//    com o x espelhado: 360 − rumo. É essa a origem do "desvio" que não existe.
//    Este módulo NÃO usa `rumo`. Ele deriva o eixo dos dois portais publicados,
//    que é o dado que não depende de convenção, e ainda mede o desvio contra o
//    azimute do centro e devolve em `desvios` para quem quiser conferir.
//
// ⚠️ 3. A BOCA FLUTUAVA PORQUE A COTA ERA ABSOLUTA. `cota: −42` no JSON é
//    LEGADO e está marcado como tal no gerador (`AUTO_COTA`, linha 870:
//    "⚠️ LEGADO: use AUTO_PROF"). O sítio ondula de −90 a +160 m; no pátio do
//    Spaceport o chão está em ~190 m, então uma boca em −42 nasce 232 m abaixo
//    do solo, e qualquer peça pendurada nela sai voando. O contrato certo é
//    `profundidade` (35 m de COBERTURA sob a superfície): teto = solo − 35.
//    Aqui TODA cota de superfície sai de `superficieAt`, nunca de `cota`.
//
// ⚠️ 4. `superficieAt`, NUNCA `heightAt`. São dois modelos e misturá-los já
//    custou 42 m de erro no pátio do spaceport nesta semana (ver a nota do
//    SPACEPORT_SHIFT em `orbit-layer.ts`). Este módulo recebe a função por
//    `opts` e não conhece outra.
//
// ═══ POR QUE A BOCA É UM MACIÇO CONSTRUÍDO, E NÃO UMA VALA ══════════════════
//
// ⚠️ O TERRENO NÃO É CAVADO AQUI, E ISSO MANDA NA FORMA. `CanalCava` (terrain.ts)
//    só sabe abrir vala RADIAL e de ANEL, para os canais; não existe corte para
//    a boca de eclusa e este módulo não pode abrir um. Consequência medida na
//    geometria: qualquer piso desenhado ABAIXO da superfície é escondido pela
//    malha do regolito, que continua contínua por cima dele. Com o olho a 1,8 m
//    e o piso a só 0,6 m abaixo do chão, o raio já cruza a superfície a 75% da
//    distância, ou seja: uma rampa "cavada" some inteira e a boca lê como
//    parede. Por isso o desenho INVERTE o gesto: a pista fica NO nível do chão
//    (solo + 0,30, sempre acima dele) e quem sobe é o MACIÇO dos dois lados,
//    de 1,6 m na ponta do corredor a 16 m no emboque. O olho lê descida (as
//    paredes crescem em volta) sem que um triângulo sequer fique enterrado.
//    É também a leitura certa para a Lua: aterro de regolito é blindagem.
//
// ⚠️ E O FUNDO DO FALSO TÚNEL É UMA PORTA, NÃO ESCURIDÃO. A 180 m do emboque
//    fecha a primeira porta de câmara. Isso resolve o mesmo problema de oclusão
//    (dali para dentro a pista desce a 8% e passa sob o terreno, invisível) e é
//    exatamente o que a peça é: eclusa tem porta, buraco não tem.
//
// ⚠️ A BOCA DO SPACEPORT PASSA A 13,2 m DO `PAD_MAIN`. Medido em 03/09 sobre a
//    geometria emitida: o maciço do corredor (meia-largura 30,9 m mais ombreira
//    de 34 m na estação do pad) chega a 13,2 m do pad principal. É de propósito
//    que fique perto: quem desce do foguete embarca ali mesmo, é essa a razão
//    de o portal ter ido para r 11.100 junto com o pátio. Mas é folga de treze
//    metros: SE `SPACEPORT_SHIFT` (orbit-layer.ts) MEXER DE NOVO, isto encosta
//    no modelo. Conferir a folga antes de aceitar o próximo deslocamento.
//
// ⚠️ E O `ECParque` ABRE A 100 m DA CASCA, o que encolhe a peça dele. Ver a nota
//    de `alcance` no laço: o falso túnel e o aterro são cortados 40 m antes de
//    r 9.050 para não furar a saia da abóbada. Medido na geometria emitida: a
//    peça acima do solo mais próxima da casca fica a exatos 40,0 m dela.
//
// Três chamadas de desenho no total, para as três eclusas somadas: um maciço de
// concreto, um de pavimento e um de faixa luminosa. Nenhuma textura nova: tudo
// vem de `vestir`/`superficie` de `./materiais`, que compartilham imagem entre
// módulos. Nenhum `onBeforeCompile` próprio, logo nenhum programa novo.
//
// Three.js puro (regra da casa: nada de react-three-fiber).
// ═══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three'
import { vestir } from './materiais'

// ── o que o JSON publica ────────────────────────────────────────────────────

export interface EclusaPortal { x: number; z: number; r: number }

export interface EclusaCamaraSpec {
  ordem: number
  papel: string
  raio: number
  x: number
  z: number
  r: number
  profundidade: number
}

export interface EclusaSpec {
  id: string
  nome: string
  /** ⚠️ NÃO USADO PARA ORIENTAR NADA. Ver a nota 2 do cabeçalho: o eixo sai dos
   *  portais. O campo entra só para a conferência publicada em `desvios`. */
  rumo: number
  /** ⚠️ LEGADO, e é o defeito da boca flutuante. Ver a nota 3 do cabeçalho. */
  cota?: number
  /** metros de COBERTURA sob a superfície: teto = superficieAt − profundidade */
  profundidade: number
  largura: number
  comprimento: number
  portalExterno: EclusaPortal
  portalInterno: EclusaPortal
  camaras: EclusaCamaraSpec[]
}

export interface EclusasOpts {
  /** `eclusas` de `public/city/cidade-malha.json`, como veio */
  eclusas: EclusaSpec[]
  /** ⚠️ `terrain.superficieAt`, NUNCA `terrain.heightAt`. Ver a nota 4. */
  superficieAt: (x: number, z: number) => number
  /** o centro da cidade; só entra na conferência de eixo. Padrão (0, 0). */
  centro?: { x: number; z: number }
  /** raio da casca (dome.ts DOME_R). A câmara que cair a menos de `folgaCasca`
   *  dele não ganha marca de superfície, senão a marca nasce dentro do vidro. */
  raioCasca?: number
  folgaCasca?: number
  /** desenha o subsolo (tubo e volume das câmaras). Padrão true; é barato e o
   *  terreno esconde tudo, mas quem for medir triângulo pode desligar. */
  subsolo?: boolean
  /** desenha a boca do portal INTERNO (r 4.450), que cai no tecido urbano.
   *  Padrão true, em versão compacta. Ver "o que ficou de fora" na entrega. */
  interno?: boolean
  sombra?: boolean
}

export interface Eclusas {
  group: THREE.Group
  triangulos: number
  /** chamadas de desenho que este módulo acrescenta à cena */
  chamadas: number
  /** a conferência de eixo, por eclusa, em graus */
  desvios: { id: string; rumoPublicado: number; azimuteDoCentro: number; desvio: number }[]
  dispose(): void
}

// ── as medidas da peça ──────────────────────────────────────────────────────
// Todas em metros. As que vêm do JSON (largura 26, profundidade 35) NÃO estão
// aqui: são lidas por eclusa.

/** metros de mundo por unidade de UV. O mesmo valor de `pracas.ts`, e pelo mesmo
 *  motivo: a peça é feita de quads de tamanhos muito diferentes e um UV 0..1 por
 *  quad esticaria o ladrilho num e espremeria no outro.
 *  ⚠️ E É ELE QUE VAI PARA `vestir(mat, nome, UV_ESCALA)`. Passar 1 trava o
 *  `repeat` em 1 (a conta é `max(1, mundo/metros)`) e o ladrilho vira 1 m. */
const UV_ESCALA = 100

/** pé-direito da caixa até o arranque da abóbada do túnel */
const OMBRO = 8
/** o corredor de aproximação, do emboque para fora */
const APROX = 200
/** o falso túnel: do emboque até a porta da primeira câmara */
const FALSO = 180
/** largura do maciço de cada lado do corredor */
const OMBREIRA = 34
/** altura do maciço no emboque e na ponta do corredor, acima da pista */
const CRISTA_ARCO = 16
const CRISTA_PONTA = 1.6
/** altura do emboque acima da pista */
const EMBOQUE_H = 26
/** espessura do emboque, para dentro do maciço */
const EMBOQUE_ESP = 18
/** o aterro que cobre o falso túnel, atrás do emboque */
const ATERRO = 260
/** a pista fica SEMPRE acima do chão. Ver a nota grande do cabeçalho. */
const FOLGA_PISTA = 0.30
/** declive da rampa depois da porta de câmara, onde ninguém vê */
const RAMPA = 0.08

const COR_CONCRETO = new THREE.Color('#B9B7B2')
const COR_MACICO = new THREE.Color('#8E8B85')
const COR_INTERNO = new THREE.Color('#4A4842')
const COR_PORTA = new THREE.Color('#2E2C29')
const COR_PISTA = new THREE.Color('#C9C6C0')
/** a laranja da casa. ⚠️ #E8660D, não a lava #F56E0F: ver `project_chart_palette`. */
const COR_DOG = new THREE.Color('#E8660D')

// ── o balde: um monte de triângulos que vira UMA geometria ──────────────────
// Nada de `mergeGeometries` aqui, e não é preguiça: as primitivas do three não
// trazem atributo de cor, e `mergeGeometries` recusa geometrias com conjuntos de
// atributos diferentes. Emitindo triângulo a triângulo, os quatro atributos
// (posição, normal, uv, cor) saem sempre juntos e a fusão é de graça.

type V3 = [number, number, number]

class Balde {
  pos: number[] = []
  nor: number[] = []
  uv: number[] = []
  cor: number[] = []
  tris = 0

  /** um triângulo, com a normal calculada da própria face e o UV projetado em
   *  metros de mundo: plano XZ quando a face é deitada, corte vertical quando é
   *  parede. É isso que faz a junta do concreto continuar a mesma junta entre
   *  duas peças de tamanhos diferentes. */
  tri(a: V3, b: V3, c: V3, cor: THREE.Color) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2]
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2]
    let nx = uy * vz - uz * vy
    let ny = uz * vx - ux * vz
    let nz = ux * vy - uy * vx
    const len = Math.hypot(nx, ny, nz)
    if (len < 1e-9) return
    nx /= len; ny /= len; nz /= len
    // tangente horizontal da face, para o UV de parede
    const deitada = Math.abs(ny) > 0.65
    let tx = -nz, tz = nx
    const tl = Math.hypot(tx, tz)
    if (tl > 1e-6) { tx /= tl; tz /= tl } else { tx = 1; tz = 0 }
    for (const p of [a, b, c]) {
      this.pos.push(p[0], p[1], p[2])
      this.nor.push(nx, ny, nz)
      if (deitada) this.uv.push(p[0] / UV_ESCALA, p[2] / UV_ESCALA)
      else this.uv.push((p[0] * tx + p[2] * tz) / UV_ESCALA, p[1] / UV_ESCALA)
      this.cor.push(cor.r, cor.g, cor.b)
    }
    this.tris++
  }

  /** quad a→b→c→d, no sentido em que a normal aponta para quem deve ver */
  quad(a: V3, b: V3, c: V3, d: V3, cor: THREE.Color) {
    this.tri(a, b, c, cor)
    this.tri(a, c, d, cor)
  }

  vazio() { return this.tris === 0 }

  geometria(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3))
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3))
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2))
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.cor, 3))
    g.computeBoundingSphere()
    return g
  }
}

// ── geometria de apoio ──────────────────────────────────────────────────────

/** a suavização de 3 pontos do perfil da pista. Sem ela a fita segue cada
 *  ondulação de 59 m da grade grossa do terreno e a pista fica bamba. */
function suavizar(v: number[]): number[] {
  if (v.length < 3) return v.slice()
  const out = v.slice()
  for (let i = 1; i < v.length - 1; i++) out[i] = (v[i - 1] + 2 * v[i] + v[i + 1]) / 4
  return out
}

/** o contorno da caixa do túnel, em (lateral, altura acima do piso): pé
 *  esquerdo, parede até o ombro, abóbada, parede direita, pé direito. */
function secao(hw: number, n: number): [number, number][] {
  const p: [number, number][] = [[-hw, 0]]
  for (let i = 0; i <= n; i++) {
    const th = Math.PI - (Math.PI * i) / n
    p.push([hw * Math.cos(th), OMBRO + hw * Math.sin(th)])
  }
  p.push([hw, 0])
  return p
}

/** onde o raio que sai de (cx, cy) na direção (dx, dy) encontra o retângulo
 *  [−hw, hw] × [yMin, yMax]. É o que preenche a face do emboque em volta do
 *  arco sem precisar de triangulador. */
function noRetangulo(
  cx: number, cy: number, dx: number, dy: number,
  hw: number, yMin: number, yMax: number,
): [number, number] {
  let t = Infinity
  if (dx > 1e-9) t = Math.min(t, (hw - cx) / dx)
  if (dx < -1e-9) t = Math.min(t, (-hw - cx) / dx)
  if (dy > 1e-9) t = Math.min(t, (yMax - cy) / dy)
  if (dy < -1e-9) t = Math.min(t, (yMin - cy) / dy)
  if (!Number.isFinite(t)) t = 0
  return [cx + dx * t, cy + dy * t]
}

function suave(t: number): number {
  const x = Math.max(0, Math.min(1, t))
  return x * x * (3 - 2 * x)
}

// ── a peça ──────────────────────────────────────────────────────────────────

export function buildEclusas(o: EclusasOpts): Eclusas {
  const solo = o.superficieAt
  const cx = o.centro?.x ?? 0
  const cz = o.centro?.z ?? 0
  const rCasca = o.raioCasca ?? 9050
  const folga = o.folgaCasca ?? 150
  const subsolo = o.subsolo !== false
  const comInterno = o.interno !== false

  const group = new THREE.Group()
  group.name = 'eclusas'

  const bConcreto = new Balde()
  const bPista = new Balde()
  const bLuz = new Balde()

  const desvios: Eclusas['desvios'] = []

  for (const e of o.eclusas) {
    const pe = e.portalExterno
    const pi = e.portalInterno
    let dx = pi.x - pe.x
    let dz = pi.z - pe.z
    const dl = Math.hypot(dx, dz)
    if (dl < 1) continue
    dx /= dl; dz /= dl

    // ── a conferência de eixo, e ela é publicada ────────────────────────────
    // azimute do portal externo VISTO DO CENTRO, na convenção do gerador
    // (0 = norte/−z, cresce para +x). O eixo aponta para o centro quando o
    // rumo do portal e o rumo de (portal → centro) diferem de 180°.
    const azPortal = (Math.atan2(pe.x - cx, -(pe.z - cz)) * 180) / Math.PI
    const azEixo = (Math.atan2(-dx, dz) * 180) / Math.PI
    const norm = (a: number) => ((a % 360) + 360) % 360
    let d = Math.abs(norm(azPortal) - norm(azEixo))
    if (d > 180) d = 360 - d
    desvios.push({
      id: e.id,
      rumoPublicado: e.rumo,
      azimuteDoCentro: Number(norm(azPortal).toFixed(2)),
      desvio: Number(d.toFixed(2)),
    })

    const hw = e.largura / 2
    const prof = e.profundidade

    // ── até onde a boca externa pode CONSTRUIR para dentro ─────────────────
    // ⚠️ ECParque ABRE A 100 m DA CASCA, e isso limita a peça. Medido no JSON:
    // o portal externo dele está em r 9.150 e a casca fecha em 9.050. O falso
    // túnel de 180 m mais o aterro de 260 m cruzariam r 8.890, ou seja o aterro
    // (ainda com ~18 m de altura em r 9.050) furaria a saia da abóbada, e a
    // nota do próprio JSON diz "A casca nao e perfurada". Os outros dois abrem
    // longe (9.600 e 11.100) e não tocam nisso. Então o alcance para dentro é
    // cortado 40 m antes da casca, e a boca do Parque nasce compacta.
    const alcance = pe.r > rCasca ? Math.max(55, pe.r - rCasca - 40) : Infinity
    const falsoExt = Math.min(FALSO, alcance)

    // ── as duas bocas ──────────────────────────────────────────────────────
    // `frente` é para onde o arco OLHA. No portal externo o veículo entra vindo
    // do pátio, logo o arco olha para FORA (−eixo). No interno ele sai para a
    // cidade, logo o arco olha para DENTRO (+eixo).
    boca(pe.x, pe.z, -dx, -dz, 1, alcance)
    if (comInterno) boca(pi.x, pi.z, dx, dz, 0.55, Infinity)

    // ── o tubo, entre as duas bocas, a `prof` abaixo da superfície ──────────
    if (subsolo) {
      const s0 = falsoExt, s1 = dl - FALSO * 0.55
      if (s1 > s0 + 50) tubo(pe.x, pe.z, dx, dz, s0, s1, hw, prof)
    }

    // ── as três câmaras ────────────────────────────────────────────────────
    for (const c of e.camaras) {
      // marca de superfície: o anel do diâmetro real, mais um colarinho baixo.
      // ⚠️ A CÂMARA DE EQUALIZAÇÃO CAI EM r 9.050, QUE É O RAIO DA CASCA. Ela
      // fica exatamente sob a saia da abóbada e não ganha marca: um colarinho
      // ali nasce dentro do vidro. É por isso que aparecem 2 marcas por eclusa
      // e não 3: a do meio é a que está sob a casca, por projeto.
      if (Math.abs(c.r - rCasca) > folga) marcaCamara(c)
      if (subsolo) volumeCamara(c, prof)
    }

    // ── e agora as funções que desenham, com o quadro desta eclusa fechado ──

    /** a boca: corredor de aproximação, maciço dos dois lados, emboque com arco,
     *  falso túnel iluminado e a porta da primeira câmara ao fundo. */
    function boca(bx: number, bz: number, fx: number, fz: number,
                  escala: number, alcanceDentro: number) {
      // eixos locais: f = para fora do arco, l = para a esquerda de quem entra
      const lx = -fz, lz = fx
      const aprox = APROX * escala
      const ombreira = OMBREIRA * escala
      const cristaArco = CRISTA_ARCO * escala
      const embH = EMBOQUE_H * (0.55 + 0.45 * escala)
      const vault = 7
      // O que cabe para dentro, com o corte da casca já aplicado. O emboque é o
      // anel grosso dos primeiros metros do falso túnel (os dois se sobrepõem);
      // o aterro começa atrás dele. Logo o alcance total é
      // max(falso, espEmb + aterro).
      const falso = Math.min(FALSO * escala, alcanceDentro)
      const espEmb = Math.min(EMBOQUE_ESP * escala, alcanceDentro)
      const aterro = Math.max(0, Math.min(ATERRO * escala, alcanceDentro - espEmb))

      const P = (s: number, t: number, y: number): V3 =>
        [bx + fx * s + lx * t, y, bz + fz * s + lz * t]
      const chao = (s: number, t: number) => solo(bx + fx * s + lx * t, bz + fz * s + lz * t)

      // meia-largura do corredor: funil, de 17 m no arco a 45 m na ponta
      const meia = (s: number) => hw + 4 + Math.max(0, s / Math.max(1, aprox)) * 28 * escala

      // ── o perfil da pista, e ele NUNCA fica abaixo do chão ───────────────
      // Para cada estação a cota sai do MAIOR chão da seção (eixo e as duas
      // bordas) mais a folga. Suaviza, e depois reaplica o máximo: suavizar
      // sozinho pode reafundar a fita num ponto e o regolito volta por cima.
      const N_AP = 14, N_FA = 12
      const est: number[] = []
      for (let i = 0; i <= N_AP; i++) est.push(aprox - (aprox * i) / N_AP)   // de fora para o arco
      for (let i = 1; i <= N_FA; i++) est.push((-falso * i) / N_FA)          // e para dentro
      // ⚠️ E OS MEIOS DE VÃO ENTRAM NO MÁXIMO. A fita é linear entre estações;
      // com 14 m de estação sobre a grade de 59 m do terreno, um lombo no meio
      // do vão passa por cima da corda e o regolito volta a cobrir a pista.
      // Amostrar o meio de vão nas duas estações vizinhas fecha isso.
      const teto3 = (s: number) => {
        const m = meia(Math.max(0, s))
        return Math.max(chao(s, 0), chao(s, -m), chao(s, m))
      }
      const cru = est.map((s, i) => {
        let h = teto3(s)
        if (i > 0) h = Math.max(h, teto3((s + est[i - 1]) / 2))
        if (i < est.length - 1) h = Math.max(h, teto3((s + est[i + 1]) / 2))
        return h + FOLGA_PISTA
      })
      const sua = suavizar(cru)
      const yP = sua.map((v, i) => Math.max(v, cru[i]))
      /** a cota da pista em qualquer `s`, pela MESMA reta que os quads usam */
      const yPista = (s: number): number => {
        if (s >= est[0]) return yP[0]
        for (let i = 0; i < est.length - 1; i++) {
          if (s <= est[i] && s >= est[i + 1]) {
            const u = (est[i] - s) / Math.max(1e-6, est[i] - est[i + 1])
            return yP[i] + (yP[i + 1] - yP[i]) * u
          }
        }
        return yP[yP.length - 1]
      }

      // ── o corredor de aproximação: pista, muro de arrimo, crista, talude ──
      const iArco = N_AP   // índice da estação s = 0
      for (let i = 0; i < iArco; i++) {
        const s0 = est[i], s1 = est[i + 1]
        const y0 = yP[i], y1 = yP[i + 1]
        const m0 = meia(s0), m1 = meia(s1)
        // altura do maciço: cresce da ponta para o emboque
        const k0 = suave(1 - s0 / Math.max(1, aprox)), k1 = suave(1 - s1 / Math.max(1, aprox))
        const c0 = CRISTA_PONTA + (cristaArco - CRISTA_PONTA) * k0
        const c1 = CRISTA_PONTA + (cristaArco - CRISTA_PONTA) * k1

        // pista
        bPista.quad(P(s0, -m0, y0), P(s1, -m1, y1), P(s1, m1, y1), P(s0, m0, y0), COR_PISTA)

        for (const lado of [-1, 1] as const) {
          const a0 = m0 * lado, a1 = m1 * lado
          const b0 = (m0 + 6) * lado, b1 = (m1 + 6) * lado
          const e0 = (m0 + ombreira) * lado, e1 = (m1 + ombreira) * lado
          // muro de arrimo: a face vertical que o motorista vê subir
          const f0: V3 = P(s0, a0, y0), f1: V3 = P(s1, a1, y1)
          const t0: V3 = P(s0, a0, y0 + c0), t1: V3 = P(s1, a1, y1 + c1)
          if (lado < 0) bConcreto.quad(f0, f1, t1, t0, COR_CONCRETO)
          else bConcreto.quad(f1, f0, t0, t1, COR_CONCRETO)
          // crista: o passeio de serviço em cima do muro
          const g0: V3 = P(s0, b0, y0 + c0), g1: V3 = P(s1, b1, y1 + c1)
          if (lado < 0) bConcreto.quad(t0, t1, g1, g0, COR_CONCRETO)
          else bConcreto.quad(t1, t0, g0, g1, COR_CONCRETO)
          // talude: da crista até o chão natural, lá fora
          const h0: V3 = P(s0, e0, chao(s0, e0) - 1.2)
          const h1: V3 = P(s1, e1, chao(s1, e1) - 1.2)
          if (lado < 0) bConcreto.quad(g0, g1, h1, h0, COR_MACICO)
          else bConcreto.quad(g1, g0, h0, h1, COR_MACICO)
        }
      }

      // ── o falso túnel, do arco para dentro ───────────────────────────────
      const per = secao(hw, vault)
      for (let i = iArco; i < est.length - 1; i++) {
        const s0 = est[i], s1 = est[i + 1]
        const y0 = yP[i], y1 = yP[i + 1]
        // piso
        bPista.quad(P(s0, -hw, y0), P(s1, -hw, y1), P(s1, hw, y1), P(s0, hw, y0), COR_PISTA)
        // casca: normais para DENTRO, porque é por dentro que ela é vista
        for (let k = 0; k < per.length - 1; k++) {
          const [ta, ha] = per[k], [tb, hb] = per[k + 1]
          bConcreto.quad(
            P(s0, ta, y0 + ha), P(s0, tb, y0 + hb),
            P(s1, tb, y1 + hb), P(s1, ta, y1 + ha),
            COR_INTERNO,
          )
        }
        // a fita de luz das duas paredes, na altura do ombro
        for (const lado of [-1, 1] as const) {
          const t = (hw - 0.35) * lado
          bLuz.quad(
            P(s0, t, y0 + OMBRO - 1.6), P(s1, t, y1 + OMBRO - 1.6),
            P(s1, t, y1 + OMBRO - 1.0), P(s0, t, y0 + OMBRO - 1.0),
            COR_DOG,
          )
        }
      }

      // ── a porta da primeira câmara, ao fundo ─────────────────────────────
      // ⚠️ ELA É ESTRUTURAL PARA O DESENHO, não só para a história: dali para
      // dentro a pista desce a 8% e passa sob o terreno, que a esconderia de
      // qualquer jeito. Fechar com porta é a leitura honesta de eclusa.
      {
        const sF = est[est.length - 1]
        const yF = yP[yP.length - 1]
        const topo = OMBRO + hw
        bConcreto.quad(
          P(sF, -hw, yF), P(sF, -hw, yF + topo),
          P(sF, hw, yF + topo), P(sF, hw, yF), COR_PORTA,
        )
        // a junta central e as duas faixas de estado
        bLuz.quad(
          P(sF + 0.3, -0.5, yF), P(sF + 0.3, -0.5, yF + topo),
          P(sF + 0.3, 0.5, yF + topo), P(sF + 0.3, 0.5, yF), COR_DOG,
        )
      }

      // ── o emboque: a face com o arco ─────────────────────────────────────
      const yA = yP[iArco]
      const embW = hw + ombreira
      const yBase = Math.min(chao(0, -embW), chao(0, embW), yA) - 6
      // ⚠️ O TOPO NUNCA PODE FICAR ABAIXO DA CHAVE DO ARCO. Na boca interna, que
      // sai em escala 0,55, `embH` dá 20,7 m e a chave do arco está em 21,0: o
      // leque da face degeneraria e o emboque abriria um rasgo por cima do arco.
      const yTopo = yA + Math.max(embH, OMBRO + hw + 4)
      const per2 = secao(hw, vault)
      // face da frente: leque de quads entre o contorno do arco e o retângulo
      for (let k = 0; k < per2.length; k++) {
        const kk = (k + 1) % per2.length
        const [ta, ha] = per2[k], [tb, hb] = per2[kk]
        const ca = OMBRO
        const ra = noRetangulo(0, yA + ca, ta - 0, (yA + ha) - (yA + ca), embW, yBase, yTopo)
        const rb = noRetangulo(0, yA + ca, tb - 0, (yA + hb) - (yA + ca), embW, yBase, yTopo)
        bConcreto.quad(
          P(0, ta, yA + ha), P(0, ra[0], ra[1]),
          P(0, rb[0], rb[1]), P(0, tb, yA + hb), COR_CONCRETO,
        )
      }
      // intradorso: a espessura do arco, indo para dentro do maciço
      for (let k = 0; k < per2.length - 1; k++) {
        const [ta, ha] = per2[k], [tb, hb] = per2[k + 1]
        bConcreto.quad(
          P(0, ta, yA + ha), P(0, tb, yA + hb),
          P(-espEmb, tb, yA + hb), P(-espEmb, ta, yA + ha),
          COR_INTERNO,
        )
      }
      // topo e laterais do maciço do emboque
      bConcreto.quad(
        P(0, -embW, yTopo), P(0, embW, yTopo),
        P(-espEmb, embW, yTopo), P(-espEmb, -embW, yTopo),
        COR_MACICO,
      )
      for (const lado of [-1, 1] as const) {
        const t = embW * lado
        const q: [V3, V3, V3, V3] = [
          P(0, t, yBase), P(0, t, yTopo),
          P(-espEmb, t, yTopo), P(-espEmb, t, yBase),
        ]
        if (lado < 0) bConcreto.quad(q[0], q[1], q[2], q[3], COR_CONCRETO)
        else bConcreto.quad(q[3], q[2], q[1], q[0], COR_CONCRETO)
      }
      // as duas barbatanas de luz que ladeiam o arco: é o que faz a boca ler
      // como porta de carga acesa, e não como bueiro
      for (const lado of [-1, 1] as const) {
        const t = (hw + 3.5) * lado
        bLuz.quad(
          P(0.4, t, yA + 1.5), P(0.4, t + 1.6 * lado, yA + 1.5),
          P(0.4, t + 1.6 * lado, yA + OMBRO + hw - 2), P(0.4, t, yA + OMBRO + hw - 2),
          COR_DOG,
        )
      }

      // ── o aterro que cobre o falso túnel ─────────────────────────────────
      // Sem ele o emboque é uma parede solta no meio do regolito. Com ele o
      // túnel "entra no morro", que é o que um emboque quer dizer.
      const N_AT = 16
      for (let i = 0; i < N_AT; i++) {
        const u0 = i / N_AT, u1 = (i + 1) / N_AT
        const s0 = -espEmb - aterro * u0
        const s1 = -espEmb - aterro * u1
        const k0 = 1 - suave(u0), k1 = 1 - suave(u1)
        const alt0 = (embH - 2) * k0, alt1 = (embH - 2) * k1
        const w0 = embW * (0.35 + 0.65 * k0), w1 = embW * (0.35 + 0.65 * k1)
        const yc0 = yA + alt0, yc1 = yA + alt1
        // crista
        bConcreto.quad(
          P(s0, -w0 * 0.45, yc0), P(s1, -w1 * 0.45, yc1),
          P(s1, w1 * 0.45, yc1), P(s0, w0 * 0.45, yc0), COR_MACICO,
        )
        // os dois flancos, descendo ao chão natural
        for (const lado of [-1, 1] as const) {
          const a0 = w0 * 0.45 * lado, a1 = w1 * 0.45 * lado
          const b0 = w0 * lado, b1 = w1 * lado
          const p0: V3 = P(s0, a0, yc0), p1: V3 = P(s1, a1, yc1)
          const q0: V3 = P(s0, b0, chao(s0, b0) - 1.2), q1: V3 = P(s1, b1, chao(s1, b1) - 1.2)
          if (lado < 0) bConcreto.quad(p0, p1, q1, q0, COR_MACICO)
          else bConcreto.quad(p1, p0, q0, q1, COR_MACICO)
        }
      }

      // ── as setas da pista: a carga entra por aqui ────────────────────────
      // ⚠️ A COTA DA SETA SE MEDE, NÃO SE INTERPOLA POR ÍNDICE. A primeira
      // versão pegava `yP` pelo índice arredondado da estação e, num trecho de
      // 14 m por estação com o sítio em rampa, 8 vértices saíam até 4,1 m
      // ABAIXO da pista, ou seja enterrados, que é exatamente o defeito que
      // este módulo existe para não repetir. Agora sai do mesmo máximo que a
      // pista usa, mais a folga da própria seta.
      for (let i = 0; i < 6; i++) {
        const s = aprox * 0.82 - i * (aprox * 0.11)
        if (s < 8) break
        const y = yPista(s) + 0.06
        const w = hw * 0.55, c = 5
        bLuz.quad(P(s, -w, y), P(s - c, -w + 2.4, y), P(s - c - 2.2, -w + 2.4, y), P(s - 2.2, -w, y), COR_DOG)
        bLuz.quad(P(s - c - 2.2, w - 2.4, y), P(s - c, w - 2.4, y), P(s, w, y), P(s - 2.2, w, y), COR_DOG)
      }
    }

    /** o tubo enterrado, entre as duas bocas, a `prof` de cobertura */
    function tubo(bx: number, bz: number, ux: number, uz: number,
                  s0: number, s1: number, hwT: number, profT: number) {
      const lx = -uz, lz = ux
      const P = (s: number, t: number, y: number): V3 =>
        [bx + ux * s + lx * t, y, bz + uz * s + lz * t]
      const chaoS = (s: number) => solo(bx + ux * s, bz + uz * s)
      const per = secao(hwT, 4)
      const passo = 120
      const n = Math.max(2, Math.round((s1 - s0) / passo))
      // piso: desce a 8% saindo da porta e depois acompanha a cobertura
      const yDe = (s: number) => {
        const teto = chaoS(s) - profT
        const piso = teto - (OMBRO + hwT)
        const rampa = chaoS(s0) + FOLGA_PISTA - (s - s0) * RAMPA
        return Math.max(rampa, piso)
      }
      for (let i = 0; i < n; i++) {
        const a = s0 + ((s1 - s0) * i) / n
        const b = s0 + ((s1 - s0) * (i + 1)) / n
        const ya = yDe(a), yb = yDe(b)
        bPista.quad(P(a, -hwT, ya), P(b, -hwT, yb), P(b, hwT, yb), P(a, hwT, ya), COR_PISTA)
        for (let k = 0; k < per.length - 1; k++) {
          const [ta, ha] = per[k], [tb, hb] = per[k + 1]
          bConcreto.quad(
            P(a, ta, ya + ha), P(a, tb, ya + hb),
            P(b, tb, yb + hb), P(b, ta, yb + ha), COR_INTERNO,
          )
        }
      }
    }

    /** a marca de superfície de uma câmara: o anel do diâmetro real, para que a
     *  câmara TENHA tamanho aos olhos de quem passa por cima, e o colarinho de
     *  equalização no centro. */
    function marcaCamara(c: EclusaCamaraSpec) {
      const N = 28
      const rIn = c.raio - 7, rOut = c.raio
      for (let i = 0; i < N; i++) {
        const a0 = (i / N) * Math.PI * 2, a1 = ((i + 1) / N) * Math.PI * 2
        const pt = (a: number, r: number): V3 => {
          const x = c.x + Math.cos(a) * r, z = c.z + Math.sin(a) * r
          return [x, solo(x, z) + 0.22, z]
        }
        bConcreto.quad(pt(a0, rIn), pt(a0, rOut), pt(a1, rOut), pt(a1, rIn), COR_CONCRETO)
      }
      // colarinho: um tambor baixo sobre o eixo da câmara
      const M = 16, rc = 22, hc = 4.5
      const y0 = solo(c.x, c.z) - 0.8
      for (let i = 0; i < M; i++) {
        const a0 = (i / M) * Math.PI * 2, a1 = ((i + 1) / M) * Math.PI * 2
        const p = (a: number, y: number): V3 => [c.x + Math.cos(a) * rc, y, c.z + Math.sin(a) * rc]
        bConcreto.quad(p(a0, y0), p(a1, y0), p(a1, y0 + hc), p(a0, y0 + hc), COR_CONCRETO)
        bConcreto.tri([c.x, y0 + hc, c.z], p(a0, y0 + hc), p(a1, y0 + hc), COR_MACICO)
      }
      // a faixa de estado do colarinho
      for (let i = 0; i < M; i++) {
        const a0 = (i / M) * Math.PI * 2, a1 = ((i + 1) / M) * Math.PI * 2
        const p = (a: number, y: number): V3 =>
          [c.x + Math.cos(a) * (rc + 0.1), y, c.z + Math.sin(a) * (rc + 0.1)]
        bLuz.quad(p(a0, y0 + hc - 1.1), p(a1, y0 + hc - 1.1), p(a1, y0 + hc - 0.6), p(a0, y0 + hc - 0.6), COR_DOG)
      }
    }

    /** o volume da câmara, enterrado. O regolito o esconde de cima; ele existe
     *  para quem descer, e para que a peça seja uma eclusa também por dentro. */
    function volumeCamara(c: EclusaCamaraSpec, profT: number) {
      const N = 22, alt = 30
      const piso = solo(c.x, c.z) - profT - (OMBRO + 13)
      for (let i = 0; i < N; i++) {
        const a0 = (i / N) * Math.PI * 2, a1 = ((i + 1) / N) * Math.PI * 2
        const p = (a: number, y: number): V3 => [c.x + Math.cos(a) * c.raio, y, c.z + Math.sin(a) * c.raio]
        // parede vista de DENTRO
        bConcreto.quad(p(a1, piso), p(a0, piso), p(a0, piso + alt), p(a1, piso + alt), COR_INTERNO)
        // piso e teto
        bPista.tri([c.x, piso, c.z], p(a0, piso), p(a1, piso), COR_PISTA)
        bConcreto.tri([c.x, piso + alt, c.z], p(a1, piso + alt), p(a0, piso + alt), COR_INTERNO)
      }
    }
  }

  // ── três materiais, três chamadas, e nenhuma textura nova ─────────────────
  const feitos: THREE.Mesh[] = []
  const materiais: THREE.Material[] = []

  const monta = (b: Balde, nome: string, veste: 'concreto' | 'asfalto' | null) => {
    if (b.vazio()) return
    let mat: THREE.Material
    if (veste) {
      const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 })
      // ⚠️ `UV_ESCALA`, NÃO 1. O UV já sai em metros de mundo dividido por 100;
      // passar 1 travaria o `repeat` (a conta de `vestir` é `max(1, mundo/metros)`)
      // e o ladrilho de 8 m viraria um ladrilho de 1 m.
      vestir(m, veste, UV_ESCALA, { macroMetros: veste === 'asfalto' ? 180 : 260 })
      mat = m
    } else {
      // ⚠️ A FAIXA LUMINOSA COPIA UM MATERIAL QUE JÁ EXISTE NA CENA, LETRA POR
      // LETRA: `MeshBasicMaterial({ color, toneMapped: false })`, o mesmo de
      // `founders-walk.ts:194`, `monuments.ts:248` e `chalet.ts:141`. Sem mapa e
      // SEM `vertexColors`: cada `define` a mais é uma família nova de programa
      // compilado, e a cena já está em 373. A cor é uma só mesmo (a laranja da
      // casa), então o atributo de cor da geometria fica só de carona.
      mat = new THREE.MeshBasicMaterial({ color: COR_DOG, toneMapped: false })
    }
    const mesh = new THREE.Mesh(b.geometria(), mat)
    mesh.name = nome
    mesh.frustumCulled = false
    if (veste) {
      mesh.receiveShadow = true
      mesh.castShadow = !!o.sombra && veste === 'concreto'
    }
    group.add(mesh)
    feitos.push(mesh)
    materiais.push(mat)
  }

  monta(bConcreto, 'eclusas:concreto', 'concreto')
  monta(bPista, 'eclusas:pista', 'asfalto')
  monta(bLuz, 'eclusas:luz', null)

  const triangulos = bConcreto.tris + bPista.tris + bLuz.tris

  return {
    group,
    triangulos,
    chamadas: feitos.length,
    desvios,
    dispose() {
      for (const m of feitos) m.geometry.dispose()
      // ⚠️ SÓ O MATERIAL. As texturas vêm de `superficie()` e são COMPARTILHADAS
      // entre módulos; `vestir` clona a Texture mas divide a mesma `source` na
      // GPU. Descartar o clone derruba a imagem de quem ainda está usando.
      for (const m of materiais) m.dispose()
      group.clear()
    },
  }
}
