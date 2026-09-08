// ═══════════════════════════════════════════════════════════════════════════
// O JARDIM DO PÓDIO DE THE SPHERE: a geometria.
//
// O DESENHO está em `sphere-jardim-plano.ts` (sem `three`, para quem planta e
// quem pavimenta lerem o mesmo papel). Aqui só se constrói: piso, aro de
// canteiro, relva, sebe, parapeito, balaustrada, escadaria, floreira e poste.
// As ÁRVORES (tamareira, buxo em bola, cipreste) não nascem aqui: elas são três
// linhas em `props-table.ts`, porque modelo de acervo é assunto da tabela e
// porque assim elas herdam de graça o cache de arquivo, a poda de textura, a
// vestimenta e o corte por distância que `props.ts` já paga.
//
// ⚠️ PEDIDO DO FUNDADOR, 07/09/2026: *"precisamos de um agente para fazer o
// paisagismo proposital sobre o pódio que a esfera está em cima. Não adianta
// colocar de qq jeito, pois o solo está a alguns metros abaixo no solo.
// Precisamos de paisagismo profissional no pódio da esfera, e que possa ser
// 'movido' junto com ela pra outro lugar por exemplo."* As três exigências e o
// que cada uma virou:
//
//   PROPOSITAL      → anéis concêntricos de passo angular constante, com o
//                     portão feito APAGANDO vaga. Ver o partido no cabeçalho do
//                     plano.
//   O SOLO ESTÁ     → nada aqui consulta `heightAt` para achar o próprio y.
//   ABAIXO            Tudo pousa em DUAS cotas construídas: o deck (116,4 m,
//                     medido por `sphereAssentar`) e o pódio (deck + 2,20). O
//                     verde vive em CANTEIRO de alvenaria com aro de 45 cm e
//                     terra dentro, não em cova no regolito. `arborizacao.ts`
//                     planta em `heightAt` (linha 880) e por isso não serve
//                     aqui: sob o deck o relevo vai de 99,78 a 116,00 m, e a
//                     árvore da borda ficaria enterrada em até 16,6 m.
//   MOVE JUNTO      → zero coordenada de mundo neste arquivo. Todo ponto sai de
//                     `sphere-jardim-plano.ts`, que sai de `SPHERE_MOD`.
//                     `scripts/city/verificar-sphere-jardim.ts` troca o módulo e
//                     confere que todas as 110 peças plantadas andam com desvio
//                     **0,00e+0 m** em coordenada local.
//
// ⚠️ ORÇAMENTO: SEIS CHAMADAS DE DESENHO E NENHUM PROGRAMA DE SHADER NOVO. Em
// 07/09 a cena de perto media 555 programas compilados e 4,87 M de triângulos, e
// programa passou a ser recurso escasso de verdade. Por isso este módulo usa
// exatamente as quatro combinações de material que a praça já compila
// (`MeshStandardMaterial` normal, `MeshStandardMaterial` instanciado,
// `MeshBasicMaterial` sem tone mapping e `PointsMaterial` com mapa), sem
// `vertexColors`, sem `instanceColor` e sem shader próprio. As cores são as que
// o precinto e a própria Sphere já usam.
// ═══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { PerfProfile, DistanceCuller } from './perf'
import { makeGlowTexture } from './light-pool'
import { SPHERE_PODIO_H, sphereCotaDeck } from './sphere'
import {
  ARO_H, TERRA_H, BORDADURA_ARO_H, PARAPEITO_H, PARAPEITO_LARG,
  RECUO_BORDA, R_COLAR, R_PODIO_EXT, R_BORDADURA_EXT,
  R_BALAUSTRADA_INT, R_COROA, FLOREIRA_R, FLOREIRA_H,
  R_CINTO_INT, R_CINTO_EXT, ESCADA_ESPELHOS, ESCADA_ESPELHO_H, ESCADA_PISO,
  ESCADA_AVANCO, PORTAO_LARG, PORTAO_MEIA_LARG, PORTOES,
  SPHERE_POSTES, arcosDeCanteiro, doJardim, doLocal, jardimQuadro,
  raioDoDeck, noCanteiro, sphereJardimCentro,
} from './sphere-jardim-plano'

// ── a paleta, toda emprestada ────────────────────────────────────────────────
/** o piso do jardim, um passo mais escuro que a laje do deck (`#B4AC9E` em
 *  `sphere.ts`): sem essa diferença o cinto não LÊ como piso assentado, lê como
 *  a mesma laje com uma emenda */
const COR_PISO = new THREE.Color('#A29A8C')
/** a alvenaria: exatamente o `COR_PLINTO` do embasamento da Sphere, para o aro,
 *  a floreira, o parapeito e a balaustrada serem a mesma pedra do pódio */
const COR_ALVENARIA = new THREE.Color('#4A4A52')
/** os mesmos verdes do precinto, que o fundador já aprovou */
const COR_RELVA = new THREE.Color('#183121')
const COR_SEBE = new THREE.Color('#1a3a1f')
/** o mesmo branco quente de poste e meio-fio do precinto */
const COR_LUZ = new THREE.Color('#F2EAD6')

/** aro do canteiro: 0,60 m de largura, e é o assento */
const ARO_LARG = 0.6
/** a sebe aparada: 1,05 m de altura e 1,20 de largura, o mesmo porte do buxo
 *  de contorno do precinto */
const SEBE_H = 1.05
const SEBE_W = 1.2
/** o módulo de sebe. 5,5 m é o mesmo passo de `hedgeArc` no precinto, escolhido
 *  lá para não dobrar a contagem de instâncias sem mudar um pixel */
const SEBE_PASSO = 5.5
/** o poste: haste de 9,0 m e globo a 9,4, o mesmo do precinto */
const POSTE_H = 9.0

export interface SphereJardim {
  group: THREE.Group
  /** a cota do deck que o jardim mediu, para quem quiser conferir */
  plataformaY: number
  custo: {
    chamadas: number
    triangulos: number
    instanciasSebe: number
    postes: number
    aroMetros: number
    /** os portões que alcançaram o chão e viraram soleira de rua, com o
     *  desnível medido no `heightAt` real na boca de cada um */
    soleiras: { portaoDeg: number; desnivel: number; degraus: number }[]
  }
  dispose(): void
}

// ═══════════════════════════════════════════════════════════════════════════
// UM ACUMULADOR DE QUADRILÁTEROS
//
// ⚠️ ELE EXISTE PARA O JARDIM CABER EM SEIS CHAMADAS DE DESENHO. Todo o
// hardscape (piso, aro, parede, degrau, floreira) é quadrilátero plano com
// normal conhecida; construir cada peça como uma malha do three e somar noventa
// malhas era o que o precinto teve de desfazer depois com `mergeByMaterial`.
// Aqui já se acumula direto no buffer, uma geometria por material.
// ═══════════════════════════════════════════════════════════════════════════
class Acumulador {
  pos: number[] = []
  nor: number[] = []
  idx: number[] = []
  /**
   * Um quadrilátero a→b→c→d, com a normal dada.
   *
   * ⚠️ A ORDEM DOS ÍNDICES ESTAVA INVERTIDA E A PRIMEIRA CHAPA PEGOU, e o modo
   * como ela pegou merece ficar escrito porque o defeito é INVISÍVEL numa
   * revisão de código. O three descarta a face de trás quando o material é
   * `FrontSide` (o padrão), e "de trás" se decide pelo SENTIDO DOS ÍNDICES, não
   * pela normal do atributo. Com `(k, k+1, k+2)` a conta dá, para uma faixa
   * horizontal com raio crescente e φ crescente:
   *
   *     (b−a) × (c−a) = (0, −dr·r·dφ, 0)     ou seja normal para BAIXO
   *
   * Resultado na chapa de 07/09: **o piso e a relva simplesmente não existiam**.
   * E o jardim parecia quase certo, porque a alvenaria é `DoubleSide` (o
   * parapeito, o aro, a floreira, a balaustrada e o degrau apareceram todos) e a
   * sebe é `InstancedMesh` de `BoxGeometry`, que vem do three com o sentido
   * certo. Quem sumiu foram exatamente os dois materiais `FrontSide`: no lugar
   * do cinto e do gramado aparecia a laje da própria Sphere (`#B4AC9E`), que é
   * clara e passa por piso. A pista foi medir o pixel: o canteiro lia
   * (214, 206, 193) onde `COR_RELVA` é (24, 49, 33).
   *
   * ⚠️ E A MESMA INVERSÃO CONSERTA A PAREDE. Com o sentido antigo, `parede` com
   * `fora = +1` produzia normal geométrica `−n` (para dentro); com este, produz
   * `+n`. As duas ficam certas de uma vez, e por isso a correção é aqui e não
   * em cada chamador.
   */
  quad(a: number[], b: number[], c: number[], d: number[], n: number[]) {
    const k = this.pos.length / 3
    for (const p of [a, b, c, d]) { this.pos.push(p[0], p[1], p[2]); this.nor.push(n[0], n[1], n[2]) }
    this.idx.push(k, k + 2, k + 1, k, k + 3, k + 2)
  }
  get vazio() { return this.idx.length === 0 }
  geometria(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3))
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3))
    g.setIndex(this.idx)
    g.computeBoundingSphere()
    return g
  }
  get triangulos() { return this.idx.length / 3 }
}

const CIMA = [0, 1, 0]

export function buildSphereJardim(o: {
  heightAt: (x: number, z: number) => number
  perfil?: PerfProfile
  culler?: DistanceCuller
}): SphereJardim {
  // ⚠️ A COTA É MEDIDA, NÃO LIDA DA CONSTANTE, pela mesma razão que a peça já
  // faz isso: o fundador estuda mudar a Sphere de lugar. `sphereCotaDeck` é a
  // mesma medição de `buildSphere` com memória, então trocar `SPHERE_MOD` move
  // o jardim em x, z E em y, sem ninguém lembrar de remedir. Custo medido:
  // 9 ms na primeira chamada, 0 nas seguintes.
  const PLAT = sphereCotaDeck(o.heightAt)
  const PODIO = PLAT + SPHERE_PODIO_H
  // 6 cm acima da laje: o deck da Sphere já é um plano em PLAT, e dois planos na
  // mesma cota brigam por profundidade (o defeito clássico de z-fighting).
  const PISO_Y = PLAT + 0.06
  const PODIO_Y = PODIO + 0.06

  // ⚠️ O PERFIL DECIDE A DIVISÃO DOS ANÉIS, e o número não é chute: o cinto tem
  // 662 m de circunferência média, então 192 gomos dão uma corda de 3,45 m e 96
  // dão 6,90 m. A 1,7 m de altura de olho, a 5 m do meio-fio, a flecha da corda
  // de 6,90 m vale 3,1 cm: invisível. No celular vale a pena, no desktop não.
  const SEG = o.perfil?.tier === 'mobile' ? 96 : 192
  const SMALL = o.perfil?.smallCull ?? 2600

  const group = new THREE.Group()
  group.name = 'SPHERE_JARDIM'
  const descartar: { dispose(): void }[] = []

  const piso = new Acumulador()
  const alv = new Acumulador()
  const relva = new Acumulador()
  const luz = new Acumulador()

  const q = jardimQuadro()
  /** ponto do mundo, na cota `y`, a partir de (r, φ) do jardim */
  const P = (r: number, phi: number, y: number): number[] => {
    const [x, z] = doJardim(r, phi)
    return [x, y, z]
  }
  /** ponto do mundo a partir de (du, dv) local */
  const L = (du: number, dv: number, y: number): number[] => {
    const [x, z] = doLocal(du, dv)
    return [x, y, z]
  }
  /** normal horizontal apontando para fora no rumo φ */
  const NFora = (phi: number): number[] => [
    Math.cos(phi) * q.ux + Math.sin(phi) * q.vx, 0,
    Math.cos(phi) * q.uz + Math.sin(phi) * q.vz,
  ]

  /** uma faixa horizontal entre dois raios que podem variar com φ */
  const faixa = (
    ac: Acumulador, a0: number, a1: number, n: number,
    rA: (p: number) => number, rB: (p: number) => number, y: number,
  ) => {
    for (let i = 0; i < n; i++) {
      const p0 = a0 + ((a1 - a0) * i) / n, p1 = a0 + ((a1 - a0) * (i + 1)) / n
      ac.quad(P(rA(p0), p0, y), P(rB(p0), p0, y), P(rB(p1), p1, y), P(rA(p1), p1, y), CIMA)
    }
  }
  /** uma parede vertical seguindo r(φ), de `y0` a `y1`; `fora` = +1 a face olha
   *  para fora do centro, −1 para dentro */
  const parede = (
    ac: Acumulador, a0: number, a1: number, n: number,
    r: (p: number) => number, y0: number, y1: number, fora: 1 | -1,
  ) => {
    for (let i = 0; i < n; i++) {
      const p0 = a0 + ((a1 - a0) * i) / n, p1 = a0 + ((a1 - a0) * (i + 1)) / n
      const nn = NFora((p0 + p1) / 2).map((v) => v * fora)
      const A = P(r(p0), p0, y0), B = P(r(p0), p0, y1), C = P(r(p1), p1, y1), D = P(r(p1), p1, y0)
      if (fora > 0) ac.quad(A, D, C, B, nn)
      else ac.quad(A, B, C, D, nn)
    }
  }

  // ═════════════════════════════════════════════════════════════════════════
  // 1. O PÓDIO: a bordadura no pé do colar, a coroa de floreiras, a balaustrada
  // ═════════════════════════════════════════════════════════════════════════

  // ── a bordadura: canteiro rasteiro colado na junta colar/piso ─────────────
  // ⚠️ ELA É A ÚNICA COISA ENTRE O PÉ DE QUEM ANDA E A CASCA DE LED, e é assim
  // que se afasta gente de uma tela sem grade e sem placa. 1,60 m de canteiro,
  // aro de 0,35 m.
  faixa(relva, 0, Math.PI * 2, SEG, () => R_COLAR, () => R_BORDADURA_EXT - 0.4, PODIO + 0.25)
  faixa(alv, 0, Math.PI * 2, SEG, () => R_BORDADURA_EXT - 0.4, () => R_BORDADURA_EXT, PODIO + BORDADURA_ARO_H)
  parede(alv, 0, Math.PI * 2, SEG, () => R_BORDADURA_EXT, PODIO_Y, PODIO + BORDADURA_ARO_H, 1)

  // ── a promenade do pódio: 6,57 m livres, 360°, contra a casca ─────────────
  faixa(piso, 0, Math.PI * 2, SEG, () => R_BORDADURA_EXT, () => R_BALAUSTRADA_INT, PODIO_Y)

  // ── a balaustrada: 2,20 m de queda para o deck, com quatro vãos de portão ──
  // ⚠️ PARAPEITO CHEIO, NÃO BALAÚSTRE. Medido: 500 balaústres a 1,2 m de passo
  // custariam 25.000 triângulos e uma chamada de desenho a mais, para uma peça
  // que na chapa de 500 m (o chão ali está 34,0 m abaixo do deck) vira uma linha
  // cinza de qualquer jeito. O parapeito cheio custa 1.150 triângulos e lê como
  // coroamento, que é o que uma peça de 196 m pede.
  for (const g of PORTOES) {
    const meio = Math.asin(Math.min(1, PORTAO_MEIA_LARG / R_PODIO_EXT))
    const a0 = g + meio, a1 = g + Math.PI / 2 - meio
    const n = Math.max(6, Math.round((SEG * (a1 - a0)) / (Math.PI * 2)))
    parede(alv, a0, a1, n, () => R_PODIO_EXT, PODIO_Y, PODIO + PARAPEITO_H, 1)
    parede(alv, a0, a1, n, () => R_BALAUSTRADA_INT, PODIO_Y, PODIO + PARAPEITO_H, -1)
    faixa(alv, a0, a1, n, () => R_BALAUSTRADA_INT, () => R_PODIO_EXT, PODIO + PARAPEITO_H)
    // a testa dos dois topos, para o vão do portão não mostrar parede oca
    for (const a of [a0, a1]) {
      const t = NFora(a + Math.PI / 2)
      alv.quad(
        P(R_BALAUSTRADA_INT, a, PODIO_Y), P(R_PODIO_EXT, a, PODIO_Y),
        P(R_PODIO_EXT, a, PODIO + PARAPEITO_H), P(R_BALAUSTRADA_INT, a, PODIO + PARAPEITO_H),
        a === a0 ? t.map((v) => -v) : t,
      )
    }
  }

  // ═════════════════════════════════════════════════════════════════════════
  // 2. O DECK: cinto, corredores, passeio de borda e parapeito
  // ═════════════════════════════════════════════════════════════════════════
  faixa(piso, 0, Math.PI * 2, SEG, () => R_CINTO_INT, () => R_CINTO_EXT, PISO_Y)

  // os corredores dos quatro portões, do cinto até o passeio de borda
  for (const g of PORTOES) {
    const rFim = raioDoDeck(g, RECUO_BORDA)
    if (rFim <= R_CINTO_EXT + 0.2) continue
    const du0 = R_CINTO_EXT, du1 = rFim
    const dv = PORTAO_MEIA_LARG
    // no quadro local do portão: gira (du, dv) pelo ângulo do portão
    const gp = (a: number, b: number): number[] => {
      const c = Math.cos(g), s = Math.sin(g)
      return L(a * c - b * s, a * s + b * c, PISO_Y)
    }
    piso.quad(gp(du0, -dv), gp(du1, -dv), gp(du1, dv), gp(du0, dv), CIMA)
  }

  // ── AS SOLEIRAS DE RUA: onde o deck alcança o chão, o parapeito abre ──────
  //
  // ⚠️ ESTE BLOCO ACHOU UM DEFEITO QUE NÃO ESTAVA NA LISTA, e ele é maior que o
  // acesso ao pódio: **o deck não tinha acesso NENHUM a partir da cidade**. Ele
  // é uma laje nivelada com saia VERTICAL em toda a divisa (`construirBase` põe
  // os dois vértices da saia no MESMO x, z), e por isso ninguém sobe nela.
  //
  // Medida a saia aresta por aresta em 07/09, contra o `heightAt` real:
  //
  //     rua EXTERNA (φ = 0)              0,40 a 1,46 m    média 1,05
  //     ponta do arco (φ ≈ 100)          0,40 a 10,89 m   média 6,83
  //     rua INTERNA (φ = 180)           10,66 a 16,62 m   média 12,67
  //     ponta do arco (φ ≈ 269)          1,46 a 16,62 m   média 10,10
  //
  // Ou seja a peça senta num alto INCLINADO: pela rua de fora o deck está
  // praticamente no nível do asfalto, e pela rua de dentro (a que olha para a
  // praça central) ele é um muro de 16,6 m. Então a regra não é "abrir os
  // quatro portões" nem "fechar todos": é MEDIR cada boca de portão e abrir a
  // que o chão alcançar. Um lance curto de degraus resolve até 3,0 m; acima
  // disso é escadaria monumental ou rampa, que é obra de outro porte e continua
  // dívida declarada.
  //
  // ⚠️ E A REGRA CONTINUA VALENDO SE A PEÇA MUDAR DE LUGAR. A medição é no boot,
  // no `heightAt` de verdade, na boca de cada portão: num sítio novo os portões
  // que abrem podem ser outros, e o código decide sozinho.
  const SOLEIRA_SAIA_MAX = 3.0
  const SOLEIRA_ESPELHO = 0.16
  const soleiras: { g: number; meia: number; desnivel: number }[] = []
  for (const g of PORTOES) {
    const rD = raioDoDeck(g, 0)
    const c = Math.cos(g), s = Math.sin(g)
    let soma = 0, n = 0
    for (let k = -PORTAO_MEIA_LARG; k <= PORTAO_MEIA_LARG + 1e-9; k += PORTAO_LARG / 10) {
      const [x, z] = doLocal(rD * c - k * s, rD * s + k * c)
      soma += o.heightAt(x, z); n++
    }
    const desnivel = PLAT - soma / n
    if (desnivel > 0.05 && desnivel <= SOLEIRA_SAIA_MAX) {
      soleiras.push({ g, meia: Math.asin(Math.min(1, PORTAO_MEIA_LARG / rD)), desnivel })
    }
  }

  // o passeio de borda e o parapeito, os dois seguindo o polígono do deck
  // recuado (que é o polígono do lote, não um retângulo: o deck é um trapézio
  // torto, ver `arestasDoDeck` no plano)
  {
    const n = SEG
    const rW = (p: number) => raioDoDeck(p, RECUO_BORDA)
    const rP = (p: number) => raioDoDeck(p, PARAPEITO_LARG)
    const rD = (p: number) => raioDoDeck(p, 0)
    // ⚠️ 2 cm PARA FORA DA DIVISA, DE PROPÓSITO. A saia do deck (`construirBase`
    // em `sphere.ts`) é uma parede VERTICAL que nasce exatamente em (x, PLAT, z)
    // sobre o polígono do lote: uma face de parapeito no mesmo raio ficaria
    // coplanar com ela e as duas brigariam por profundidade. Dois centímetros
    // resolvem e ninguém vê a 1,7 m de altura de olho.
    const rDf = (p: number) => rD(p) + 0.02
    // o parapeito corre em ARCOS, pulando a boca de cada soleira aberta
    const vaos = soleiras.map((s) => [s.g - s.meia, s.g + s.meia] as [number, number])
    const trechos: [number, number][] = []
    {
      let ini = 0
      const cortes = vaos.flat().map((a) => ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)).sort((a, b) => a - b)
      const fechado = (p: number) => !vaos.some(([x, y]) => {
        const d = Math.atan2(Math.sin(p - (x + y) / 2), Math.cos(p - (x + y) / 2))
        return Math.abs(d) <= (y - x) / 2
      })
      for (const c of [...cortes, Math.PI * 2]) {
        if (c > ini && fechado((ini + c) / 2)) trechos.push([ini, c])
        ini = c
      }
      if (!trechos.length) trechos.push([0, Math.PI * 2])
    }
    for (const [a0, a1] of trechos) {
      const nn = Math.max(4, Math.round((n * (a1 - a0)) / (Math.PI * 2)))
      // ⚠️ O PASSEIO CORRE NOS MESMOS ARCOS DO PARAPEITO, e não numa volta
      // inteira. Na boca de uma soleira ele não pode ir até `rP`: os degraus
      // começam antes disso e o passeio passaria 6 cm por cima dos dois
      // primeiros, deixando um espelho único de 0,49 m no lugar de cinco de
      // 0,17. Ali o passeio para em `rEscada` e os degraus continuam.
      faixa(piso, a0, a1, nn, rW, rP, PISO_Y)
      parede(alv, a0, a1, nn, rP, PISO_Y, PLAT + PARAPEITO_H, -1)
      parede(alv, a0, a1, nn, rDf, PLAT - 0.15, PLAT + PARAPEITO_H, 1)
      faixa(alv, a0, a1, nn, rP, rDf, PLAT + PARAPEITO_H)
      // a linha de luz no topo do parapeito: é ela que desenha a silhueta do
      // lote de longe, e o dossiê da peça já mede que ela é vista de 5 km
      faixa(luz, a0, a1, nn, (p) => rP(p) + 0.1, (p) => rP(p) + 0.5, PLAT + PARAPEITO_H + 0.02)
      // a testa do parapeito nos dois topos, para o vão não mostrar parede oca
      for (const a of [a0, a1]) {
        const t = NFora(a + Math.PI / 2)
        alv.quad(
          P(rP(a), a, PISO_Y), P(rDf(a), a, PISO_Y),
          P(rDf(a), a, PLAT + PARAPEITO_H), P(rP(a), a, PLAT + PARAPEITO_H),
          a === a0 ? t.map((v) => -v) : t,
        )
      }
    }
    // e os degraus de cada soleira, DENTRO do lote: eles descem nos últimos
    // metros do deck em vez de avançar sobre a calçada da rua
    for (const s of soleiras) {
      const nDeg = Math.max(1, Math.round(s.desnivel / SOLEIRA_ESPELHO))
      // o passeio da boca da soleira: do recuo até o primeiro degrau
      faixa(piso, s.g - s.meia, s.g + s.meia, 8, rW,
        (p) => raioDoDeck(p, 0) - nDeg * ESCADA_PISO, PISO_Y)
      const c = Math.cos(s.g), sn = Math.sin(s.g)
      const gp = (a: number, b: number, y: number): number[] => L(a * c - b * sn, a * sn + b * c, y)
      const rBorda = raioDoDeck(s.g, 0)
      for (let i = 1; i <= nDeg; i++) {
        const yA = PLAT - ((i - 1) * s.desnivel) / nDeg
        const yB = PLAT - (i * s.desnivel) / nDeg
        const rA = rBorda - (nDeg - i + 1) * ESCADA_PISO
        const rB = rA + ESCADA_PISO
        piso.quad(gp(rA, -PORTAO_MEIA_LARG, yA), gp(rB, -PORTAO_MEIA_LARG, yA), gp(rB, PORTAO_MEIA_LARG, yA), gp(rA, PORTAO_MEIA_LARG, yA), CIMA)
        alv.quad(gp(rB, -PORTAO_MEIA_LARG, yB), gp(rB, PORTAO_MEIA_LARG, yB), gp(rB, PORTAO_MEIA_LARG, yA), gp(rB, -PORTAO_MEIA_LARG, yA), NFora(s.g))
      }
    }
  }

  // ═════════════════════════════════════════════════════════════════════════
  // 3. AS QUATRO ESCADARIAS: a dívida do acesso ao pódio, fechada
  // ═════════════════════════════════════════════════════════════════════════
  // ⚠️ `sphere.md` listava em aberto *"2,2 m de face vertical não se sobe a
  // pé"*. São 14 espelhos de 15,71 cm e 13 pisos de 36 cm (Blondel 67,4 cm,
  // dentro da faixa confortável de 63 a 68), 22,00 m de largura, avanço de
  // 4,68 m. O pé cai em r 106,77 e o cinto vai até 109,00: sobram 2,23 m de
  // piso na frente do último degrau, mais o passeio de borda ou o corredor
  // inteiro, conforme o portão. O piso é contínuo do pódio ao parapeito.
  for (const g of PORTOES) {
    const c = Math.cos(g), s = Math.sin(g)
    const gp = (a: number, b: number, y: number): number[] => L(a * c - b * s, a * s + b * c, y)
    const dv = PORTAO_MEIA_LARG
    for (let i = 1; i <= ESCADA_ESPELHOS; i++) {
      const yA = PODIO - (i - 1) * ESCADA_ESPELHO_H
      const yB = PODIO - i * ESCADA_ESPELHO_H
      const rA = R_PODIO_EXT + (i - 1) * ESCADA_PISO
      const rB = rA + ESCADA_PISO
      // o espelho (face vertical), olhando para fora
      const nn = NFora(g)
      alv.quad(gp(rA, -dv, yB), gp(rA, dv, yB), gp(rA, dv, yA), gp(rA, -dv, yA), nn)
      // o piso (face horizontal), menos no último, que já é o deck
      if (i < ESCADA_ESPELHOS) piso.quad(gp(rA, -dv, yB), gp(rB, -dv, yB), gp(rB, dv, yB), gp(rA, dv, yB), CIMA)
    }
    // as duas faces laterais da escadaria, em rampa
    for (const lado of [-1, 1] as const) {
      const nl = NFora(g + (Math.PI / 2) * lado)
      const r0 = R_PODIO_EXT, r1 = R_PODIO_EXT + ESCADA_AVANCO
      const A = gp(r0, dv * lado, PLAT), B = gp(r1, dv * lado, PLAT)
      const C = gp(r1, dv * lado, PLAT + ESCADA_ESPELHO_H), D = gp(r0, dv * lado, PODIO)
      alv.quad(A, B, C, D, lado > 0 ? nl : nl.map((v) => -v))
    }
  }

  // ═════════════════════════════════════════════════════════════════════════
  // 4. OS QUATRO CANTEIROS: aro de 45 cm, terra, relva
  // ═════════════════════════════════════════════════════════════════════════
  // ⚠️ O ARO É O QUE RESOLVE "O SOLO ESTÁ ALGUNS METROS ABAIXO". Não existe cova
  // aqui: o canteiro é construído sobre a laje, com 45 cm de aro e 35 cm de
  // terra dentro. E 0,45 m é altura de assento, então os 1.302 m de aro medidos
  // são o banco deste jardim: nenhuma espécie de mobiliário precisou entrar
  // (`bench-classic` custaria 3 chamadas de desenho por 16 assentos).
  const arcos = arcosDeCanteiro()
  const sebes: THREE.Matrix4[] = []
  const mObj = new THREE.Object3D()

  /**
   * O giro em y para uma caixa cujo COMPRIMENTO (o x local) tem de ficar na
   * tangente do arco em (r, φ).
   *
   * ⚠️ NÃO É `−φ + π/2`, e essa foi a primeira versão errada. Aquela fórmula
   * vale no precinto porque lá o ponto é polar no quadro do mundo
   * (`cos a · x`, `sin a · z`); aqui `doJardim` ainda aplica a base (u, v) do
   * lote, então o ângulo do mundo não é φ. A tangente se calcula de verdade,
   * derivando o ponto em φ, e o giro sai dela: um giro de θ em y leva o x local
   * para `(cos θ, 0, −sin θ)`, logo `θ = atan2(−tz, tx)`. Com a fórmula errada
   * a sebe vira uma fila de lajotas radiais em vez de uma linha contínua, que é
   * exatamente o defeito que o precinto já corrigiu uma vez.
   */
  const giroTangente = (phi: number): number => {
    const tx = -Math.sin(phi) * q.ux + Math.cos(phi) * q.vx
    const tz = -Math.sin(phi) * q.uz + Math.cos(phi) * q.vz
    return Math.atan2(-tz, tx)
  }
  const porSebe = (x: number, z: number, y: number, giro: number, comp: number, h: number) => {
    mObj.position.set(x, y + h / 2, z)
    mObj.rotation.set(0, giro, 0)
    mObj.scale.set(comp, h, SEBE_W)
    mObj.updateMatrix()
    sebes.push(mObj.matrix.clone())
  }
  /** enfileira sebe ao longo de um arco de raio variável, só onde `cabe` */
  const sebeArco = (
    a0: number, a1: number, r: (p: number) => number, y: number, h: number,
    cabe: (p: number) => boolean = () => true,
  ) => {
    const comp = Math.abs(a1 - a0) * r((a0 + a1) / 2)
    const n = Math.max(1, Math.round(comp / SEBE_PASSO))
    for (let i = 0; i < n; i++) {
      const p = a0 + ((a1 - a0) * (i + 0.5)) / n
      if (!cabe(p)) continue
      const [x, z] = doJardim(r(p), p)
      porSebe(x, z, y, giroTangente(p), SEBE_PASSO * 1.05, h)
    }
  }

  let aroComprimento = 0
  for (const arco of arcos) {
    const { a0, a1 } = arco
    const n = Math.max(24, Math.round((SEG * (a1 - a0)) / (Math.PI * 2)))
    const rIn = () => R_CINTO_EXT
    const rOut = (p: number) => raioDoDeck(p, RECUO_BORDA)
    const prof = (p: number) => rOut(p) - R_CINTO_EXT
    // aro interno (contra o cinto) e aro externo (contra o passeio de borda)
    faixa(alv, a0, a1, n, rIn, () => R_CINTO_EXT + ARO_LARG, PLAT + ARO_H)
    parede(alv, a0, a1, n, rIn, PISO_Y, PLAT + ARO_H, -1)
    faixa(alv, a0, a1, n, (p) => rOut(p) - ARO_LARG, rOut, PLAT + ARO_H)
    parede(alv, a0, a1, n, rOut, PISO_Y, PLAT + ARO_H, 1)
    aroComprimento += (a1 - a0) * (R_CINTO_EXT + rOut((a0 + a1) / 2))
    // as duas cabeceiras, contra os corredores dos portões
    for (const a of [a0, a1]) {
      const paraDentro = a === a0 ? 1 : -1
      const t = NFora(a + Math.PI / 2).map((v) => -v * paraDentro)
      const dOut = rOut(a)
      alv.quad(
        P(R_CINTO_EXT, a, PISO_Y), P(dOut, a, PISO_Y),
        P(dOut, a, PLAT + ARO_H), P(R_CINTO_EXT, a, PLAT + ARO_H), t,
      )
      faixa(alv, a, a + (paraDentro * ARO_LARG) / dOut, 2, rIn, rOut, PLAT + ARO_H)
      aroComprimento += dOut - R_CINTO_EXT
    }
    // a terra e a relva
    faixa(relva, a0, a1, n, () => R_CINTO_EXT + ARO_LARG, (p) => rOut(p) - ARO_LARG, PLAT + TERRA_H)

    // ── a sebe aparada: contorno do compartimento, 1,6 m para dentro do aro ──
    // ⚠️ A FILEIRA DE FORA SÓ EXISTE ONDE HÁ FUNDO PARA DUAS. Nas pontas do
    // compartimento o canteiro afina para 6,0 m (é o mínimo que `noCanteiro`
    // deixa nascer), e ali as duas fileiras de 1,20 m ficariam a 0,40 m uma da
    // outra: duas sebes coladas não são um parterre, são uma sebe grossa mal
    // feita. Abaixo de 12,0 m de fundo fica só a fileira de dentro.
    const rSebeIn = R_CINTO_EXT + ARO_LARG + 1.6
    sebeArco(a0, a1, () => rSebeIn, PLAT + TERRA_H, SEBE_H)
    sebeArco(a0, a1, (p) => rOut(p) - ARO_LARG - 1.6, PLAT + TERRA_H, SEBE_H, (p) => prof(p) >= 12)
    // ── e uma arcada interna, concêntrica, onde o canteiro tem fundo: é ela
    // que faz o parterre ter DESENHO em vez de ser um gramado com borda ──────
    const rBroderie = R_CINTO_EXT + 18.0
    sebeArco(a0, a1, () => rBroderie, PLAT + TERRA_H, SEBE_H, (p) => noCanteiro(rBroderie, p, 4.0))
  }

  // ── a bordadura do pódio também é sebe, mais baixa ────────────────────────
  sebeArco(0, Math.PI * 2, () => (R_COLAR + R_BORDADURA_EXT - 0.4) / 2, PODIO + 0.25, 0.6)

  // ═════════════════════════════════════════════════════════════════════════
  // 5. A COROA DE FLOREIRAS: 40 tambores sobre o pódio
  // ═════════════════════════════════════════════════════════════════════════
  // ⚠️ 1,10 m DE SUBSTRATO É O MÍNIMO PARA ÁRVORE SOBRE LAJE, e é o número que
  // separa canteiro de vaso decorativo. A tamareira em si é uma linha de
  // `props-table.ts` (`palm-date`, a mesma espécie das alamedas dos bulevares);
  // aqui nasce só a alvenaria que a segura.
  const floreiras: THREE.BufferGeometry[] = []
  const geoTambor = new THREE.CylinderGeometry(FLOREIRA_R, FLOREIRA_R, FLOREIRA_H, 8, 1, true)
  const geoAro = new THREE.RingGeometry(FLOREIRA_R - 0.3, FLOREIRA_R, 8)
  const geoTerra = new THREE.CircleGeometry(FLOREIRA_R - 0.3, 8)
  const mat4 = new THREE.Matrix4()
  const terras: THREE.BufferGeometry[] = []
  for (let i = 0; i < 48; i++) {
    const phi = (i + 0.5) * ((Math.PI * 2) / 48)
    // a mesma exclusão do plano: a vaga que cai no portão fica vazia
    let noPortaoAqui = false
    for (const g of PORTOES) {
      const d = phi - g
      if (Math.cos(d) > 0 && Math.abs(Math.sin(d) * R_COROA) <= PORTAO_MEIA_LARG + FLOREIRA_R + 1.0) noPortaoAqui = true
    }
    if (noPortaoAqui) continue
    const [x, z] = doJardim(R_COROA, phi)
    const g1 = geoTambor.clone()
    g1.applyMatrix4(mat4.makeTranslation(x, PODIO + FLOREIRA_H / 2, z))
    floreiras.push(g1)
    const g2 = geoAro.clone()
    g2.rotateX(-Math.PI / 2)
    g2.applyMatrix4(mat4.makeTranslation(x, PODIO + FLOREIRA_H, z))
    floreiras.push(g2)
    const g3 = geoTerra.clone()
    g3.rotateX(-Math.PI / 2)
    g3.applyMatrix4(mat4.makeTranslation(x, PODIO + FLOREIRA_H - 0.12, z))
    terras.push(g3)
  }
  geoTambor.dispose(); geoAro.dispose(); geoTerra.dispose()

  // ═════════════════════════════════════════════════════════════════════════
  // 6. OS POSTES: 24 vagas de 15°, na borda externa do cinto
  // ═════════════════════════════════════════════════════════════════════════
  // ⚠️ AS 24 VAGAS FICARAM TODAS, e a razão está medida: a 15° de passo, a vaga
  // mais próxima de um portão cai a 14,12 m do eixo dele, e o corredor tem
  // 11,00 m de meia largura. Ou seja nenhum poste cai no vão da escadaria e
  // nenhuma vaga precisou ser apagada. Passo entre postes: 28,32 m.
  const hastes: THREE.BufferGeometry[] = []
  const globos: THREE.BufferGeometry[] = []
  const geoHaste = new THREE.CylinderGeometry(0.22, 0.3, POSTE_H, 6)
  const geoGlobo = new THREE.SphereGeometry(0.9, 7, 5)
  const pocas = new Float32Array(SPHERE_POSTES.length * 3)
  SPHERE_POSTES.forEach(([x, z], i) => {
    const g1 = geoHaste.clone()
    g1.applyMatrix4(mat4.makeTranslation(x, PISO_Y + POSTE_H / 2, z))
    hastes.push(g1)
    const g2 = geoGlobo.clone()
    g2.applyMatrix4(mat4.makeTranslation(x, PISO_Y + POSTE_H + 0.4, z))
    globos.push(g2)
    pocas[i * 3] = x; pocas[i * 3 + 1] = PISO_Y + 0.25; pocas[i * 3 + 2] = z
  })
  geoHaste.dispose(); geoGlobo.dispose()

  // ═════════════════════════════════════════════════════════════════════════
  // 7. AS SEIS MALHAS
  // ═════════════════════════════════════════════════════════════════════════
  const juntar = (base: Acumulador, extras: THREE.BufferGeometry[]): THREE.BufferGeometry => {
    const partes: THREE.BufferGeometry[] = []
    if (!base.vazio) partes.push(base.geometria())
    for (const g of extras) {
      // só posição e normal, senão `mergeGeometries` recusa (o `RingGeometry`
      // do three traz `uv`, o acumulador não)
      for (const a of Object.keys(g.attributes)) if (a !== 'position' && a !== 'normal') g.deleteAttribute(a)
      partes.push(g)
    }
    const m = partes.length === 1 ? partes[0] : mergeGeometries(partes, false)!
    if (partes.length > 1) for (const p of partes) p.dispose()
    m.computeBoundingSphere()
    return m
  }

  const matPiso = new THREE.MeshStandardMaterial({ color: COR_PISO, roughness: 0.9, metalness: 0.02 })
  const matAlv = new THREE.MeshStandardMaterial({ color: COR_ALVENARIA, roughness: 0.86, metalness: 0.04, side: THREE.DoubleSide })
  const matRelva = new THREE.MeshStandardMaterial({ color: COR_RELVA, roughness: 0.96, metalness: 0 })
  const matSebe = new THREE.MeshStandardMaterial({ color: COR_SEBE, roughness: 0.92 })
  const matLuz = new THREE.MeshBasicMaterial({ color: COR_LUZ, toneMapped: false, transparent: true, opacity: 0.7 })
  descartar.push(matPiso, matAlv, matRelva, matSebe, matLuz)

  const gPiso = juntar(piso, [])
  const gAlv = juntar(alv, [...floreiras, ...hastes])
  const gRelva = juntar(relva, terras)
  const gLuz = juntar(luz, globos)
  descartar.push(gPiso, gAlv, gRelva, gLuz)

  const mPiso = new THREE.Mesh(gPiso, matPiso); mPiso.name = 'SPHERE_JARDIM_PISO'
  const mAlv = new THREE.Mesh(gAlv, matAlv); mAlv.name = 'SPHERE_JARDIM_ALVENARIA'
  const mRelva = new THREE.Mesh(gRelva, matRelva); mRelva.name = 'SPHERE_JARDIM_RELVA'
  const mLuz = new THREE.Mesh(gLuz, matLuz); mLuz.name = 'SPHERE_JARDIM_LUZ'
  for (const m of [mPiso, mAlv, mRelva]) { m.receiveShadow = true; m.castShadow = false }
  // ⚠️ SÓ A ALVENARIA PROJETA SOMBRA, e é a que tem volume: parapeito,
  // balaustrada, escadaria e floreira. Piso e relva são planos deitados e
  // entrariam no mapa de sombra para não escurecer nada.
  mAlv.castShadow = true
  group.add(mPiso, mAlv, mRelva, mLuz)

  // ── a sebe, instanciada ──────────────────────────────────────────────────
  const geoSebe = new THREE.BoxGeometry(1, 1, 1)
  descartar.push(geoSebe)
  const mSebe = new THREE.InstancedMesh(geoSebe, matSebe, Math.max(1, sebes.length))
  sebes.forEach((m, i) => mSebe.setMatrixAt(i, m))
  mSebe.count = sebes.length
  mSebe.instanceMatrix.needsUpdate = true
  mSebe.receiveShadow = true   // não projeta: centenas de caixinhas no mapa por nada
  mSebe.name = 'SPHERE_JARDIM_SEBE'
  group.add(mSebe)

  // ── as poças de luz dos postes ───────────────────────────────────────────
  // ⚠️ SEM ELAS A LUZ ARTIFICIAL NÃO EXISTE PARA QUEM OLHA, e o defeito já foi
  // apontado uma vez pelo fundador na praça ("tá bem escuro"): globo aceso sem
  // marca no chão lê como pontinho branco flutuando. Uma nuvem de sprites
  // aditivos custa UM desenho, não 24 luzes pontuais.
  const texPoca = makeGlowTexture()
  const geoPoca = new THREE.BufferGeometry()
  geoPoca.setAttribute('position', new THREE.BufferAttribute(pocas, 3))
  const matPoca = new THREE.PointsMaterial({
    map: texPoca, color: 0xffd9a8, size: 15, sizeAttenuation: true,
    transparent: true, opacity: 0.34, depthWrite: false, blending: THREE.AdditiveBlending,
  })
  descartar.push(texPoca, geoPoca, matPoca)
  const mPoca = new THREE.Points(geoPoca, matPoca)
  mPoca.frustumCulled = false
  mPoca.name = 'SPHERE_JARDIM_POCAS'
  group.add(mPoca)

  // ⚠️ O QUE SOME E O QUE NÃO SOME. A regra é a que a própria peça já usa: o
  // embasamento é SILHUETA e não obedece ao `smallCull`, o mobiliário obedece.
  // Piso, alvenaria e relva desenham a planta do lote e são vistos de 5 km, então
  // ficam; sebe, globo e poça de luz são detalhe de perto e caem em `smallCull`.
  const centro = sphereJardimCentro()
  const v3 = new THREE.Vector3(centro[0], PLAT, centro[1])
  o.culler?.add(mSebe, SMALL, v3)
  o.culler?.add(mPoca, SMALL, v3)
  // ⚠️ `mLuz` NÃO ENTRA NO CORTE, e a primeira versão o cortava em `SMALL x 1,4`
  // por engano: essa malha carrega a LINHA DE LUZ DO PARAPEITO, que é o desenho
  // da planta do lote visto de longe, e o dossiê da peça já mede que ela é vista
  // da praça central, a 5.118 m. Cortar a 3.640 m apagava a silhueta do
  // embasamento justamente na faixa de distância em que ela é o único detalhe
  // que sobra. Ela é uma chamada de desenho e 1.716 triângulos.

  const tri = (g: THREE.BufferGeometry) => (g.index?.count ?? g.attributes.position.count) / 3
  const custo = {
    chamadas: 6,
    triangulos: Math.round(tri(gPiso) + tri(gAlv) + tri(gRelva) + tri(gLuz) + sebes.length * 12),
    instanciasSebe: sebes.length,
    postes: SPHERE_POSTES.length,
    /** o aro do canteiro é o banco deste jardim, então o comprimento dele é
     *  quantos metros de assento a praça ganhou */
    aroMetros: Math.round(aroComprimento),
    soleiras: soleiras.map((s) => ({
      portaoDeg: Math.round((s.g * 180) / Math.PI),
      desnivel: Math.round(s.desnivel * 100) / 100,
      degraus: Math.max(1, Math.round(s.desnivel / SOLEIRA_ESPELHO)),
    })),
  }

  return {
    group,
    plataformaY: PLAT,
    custo,
    dispose() { for (const d of descartar) d.dispose() },
  }
}
