// ═══════════════════════════════════════════════════════════════════════════
// OS CANAIS: a água que corre pela cidade e liga tudo ao lago da praça.
//
// ⚠️ O VALOR DELES NÃO É PAISAGEM, É TESTADA DE ÁGUA. O pedido do fundador foi
// "canais para que sejam criados milhares de lotes com saída para o lago
// principal, tudo interligado" e "não podem ser canais pequenos". Medido no
// loteamento: 12.625 lotes ganharam frente para a água.
//
// As duas escalas vêm de cidade que existe, não de gosto:
//   RADIAL  60 m de lâmina, seção 96 m   Canal Grande de Veneza (30 a 70 m)
//   ANEL    28 m de lâmina, seção 56 m   grachten de Amsterdam (27 m médios; a
//                                        Keizersgracht, a maior, tem 28,31)
// A seção inclui CAIS nas duas margens, que é o que faz o canal ser endereço e
// não vala: em Amsterdam a casa dá para o cais e o cais para a água.
//
// ⚠️ O GERADOR JÁ ABRIU A VALA. `livre()` recusa lote dentro da seção do canal e
// `cidade-malha.json` publica a geometria em `canais`. Este módulo só desenha; se
// ele e o gerador discordarem, aparece água sobre lote ou vala seca.
//
// ⚠️ A LÂMINA ACOMPANHA O CHÃO, e isso é uma licença assumida. Canal de verdade é
// NIVELADO e vence desnível com eclusa; aqui a água segue `superficieAt` menos a
// profundidade, porque o sítio tem relevo real (−182 a +230 m) e uma lâmina
// verdadeiramente plana ou afundaria de um lado ou transbordaria do outro. O dia
// em que houver eclusa desenhada, isto vira degrau por trecho.
//
// Three.js puro (regra da casa: nada de react-three-fiber).
// ═══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three'
import { COR_AGUA, aguaDeVerdade } from './lago'

export interface CanalRadial {
  id: string; rumo: number; secao: number; lamina: number
  rInicio: number; phiFim: number; sobreBulevar?: boolean
}
export interface CanalAnel {
  id: string; phi: number; secao: number; lamina: number; contorno: [number, number][]
}
export interface Avenida { rumo: number; largura: number }
export interface CanaisOpts {
  /** as avenidas radiais: cada uma ganha ponte sobre cada anel de canal */
  avenidas?: Avenida[]
  /** os φ das ruas de anel: cada uma ganha ponte sobre cada canal radial */
  aneisPhi?: number[]
  /** φ -> raio naquele rumo, para achar onde a rua de anel cruza o canal */
  raioEmPhi?: (ang: number, phi: number) => number
  /** ⚠️ `superficieAt`, NUNCA `heightAt`: é o chão que a câmera vê */
  heightAt: (x: number, z: number) => number
  radiais: CanalRadial[]
  aneis: CanalAnel[]
  /** até onde o radial vai, em raio de mundo. Vem do maior anel de canal. */
  rFimRadial?: number
  sombra?: boolean
}
export interface Canais {
  group: THREE.Group
  update(t: number): void
  metros: number
  pontes: number
  triangulos: number
  dispose(): void
}

const COR_CAIS = '#8E856F'     // o passeio de cima
const COR_MURO = '#6E685C'     // o muro de arrimo
const COR_PISTA = '#57534B'    // a pista, o valor mais escuro da cidade
const COR_WERF = '#A79C86'     // o cais baixo, na água

// ── A LÂMINA SOBE ATÉ A PORTA, E É POR ISSO QUE NÃO HÁ ESCADA ──────────────
//
// ⚠️ EU TINHA COPIADO UTRECHT E ESTAVA ERRADO. A Oudegracht tem dois níveis (rua
// em cima, cais baixo na água, 96 lances de escada) porque o nível do Oude Rijn
// foi fixado por uma eclusa de 1122 e ficou ABAIXO da rua: eles não podiam
// levantar a água, então desceram as pessoas até ela. É uma solução brilhante
// para uma limitação que NÓS NÃO TEMOS. A cidade é nova, é fechada sob abóbada e
// a cota da lâmina é uma escolha nossa.
//
// O fundador cortou isso na hora certa: "que escada o que, a galera tem que
// poder parar lancha na frente da casa". Então a lâmina sobe para 1,0 m abaixo
// do passeio, que é a altura de convés de lancha: atraca-se encostando, sem
// escada e sem cais intermediário. É o Grande Canal de Veneza, onde o palácio
// tem a porta na água, e não o werf de Utrecht.
//
// A seção por margem, da água para fora:
//   BORDA    a guia de atracação, com cabeços
//   PASSEIO  calçada
//   PISTA    a via que o anel perdeu para a água
//   GUIA     meio-fio e faixa de árvore, encostando no lote
const FUNDO = 4.0        // o leito: 3 m de lâmina, que aceita calado de lancha
const LAMINA = 1.0       // a água, abaixo do passeio: altura de convés
const RUA_ALT = 0.35     // o nível do passeio, acima do chão
const CABECO_CADA = 24   // um cabeço de amarração a cada tantos metros

class Balde {
  vs: number[] = []; ix: number[] = []
  // ⚠️ ANTI-HORÁRIO VISTO DE CIMA, senão a normal aponta para baixo e o backface
  // culling apaga a face inteira. Já custou uma praça e dois anéis nesta cena.
  quad(a: number[], b: number[], c: number[], d: number[]) {
    const i = this.vs.length / 3
    this.vs.push(...a, ...b, ...c, ...d)
    this.ix.push(i, i + 1, i + 2, i, i + 2, i + 3)
  }
}

export function buildCanais(o: CanaisOpts): Canais {
  const group = new THREE.Group()
  group.name = 'canais'
  const baldes = new Map<string, Balde>()
  const B = (cor: string) => {
    let b = baldes.get(cor)
    if (!b) { b = new Balde(); baldes.set(cor, b) }
    return b
  }
  const P = (x: number, z: number, y: number) => [x, y, z]
  let metros = 0

  /**
   * Um trecho de canal entre dois pontos do eixo, com seção completa.
   * ⚠️ O PASSO SAI DO COMPRIMENTO E NÃO É ENFEITE: uma faixa longa sobre terreno
   * ondulado vira ponte reta e o chão fura a água no meio do vão. 18 m é o mesmo
   * passo que a praça e as vias usam nesta cena, pelo mesmo motivo.
   */
  const trecho = (x0: number, z0: number, x1: number, z1: number, secao: number, lamina: number) => {
    const dx = x1 - x0, dz = z1 - z0
    const L = Math.hypot(dx, dz)
    if (L < 1) return
    metros += L
    const ux = dx / L, uz = dz / L
    const px = -uz, pz = ux                      // a perpendicular do eixo
    const n = Math.max(1, Math.ceil(L / 18))
    const meiaA = lamina / 2                     // borda da lâmina
    const meiaC = secao / 2                      // borda do cais
    for (let i = 0; i < n; i++) {
      const t0 = i / n, t1 = (i + 1) / n
      const ax = x0 + dx * t0, az = z0 + dz * t0
      const bx = x0 + dx * t1, bz = z0 + dz * t1
      // ⚠️ A COTA VEM DA RUA, FORA DA VALA, E ISSO É CIRCULARIDADE CONSERTADA.
      // O terreno agora CAVA a vala do canal, então `heightAt` no eixo devolve o
      // FUNDO dela: pôr a lâmina 1 m abaixo disso afundava a água junto com a
      // escavação e o regolito continuava por cima. Medido: chão do eixo a −32,8
      // e água mais abaixo ainda. Amostrando os dois lados FORA da seção sai o
      // nível da rua, que é a referência certa para a lâmina e para o passeio.
      const fora = meiaC + 14
      const ref = (px2: number, pz2: number) =>
        (o.heightAt(px2 + px * fora, pz2 + pz * fora) + o.heightAt(px2 - px * fora, pz2 - pz * fora)) / 2
      const ya = ref(ax, az), yb = ref(bx, bz)
      const p = (cx: number, cz: number, off: number, y: number) =>
        P(cx + px * off, cz + pz * off, y)
      // ⚠️ A LÂMINA É `LAMINA`, NÃO `FUNDO`. Aqui estava desenhando a água na cota
      // do LEITO (4 m abaixo da rua) em vez da superfície (1 m): a água ficava
      // abaixo do fundo da própria vala e o regolito continuava por cima. `FUNDO`
      // é onde o leito fica; `LAMINA` é onde a água encosta na calçada, que é o
      // ponto inteiro de subir o nível para a lancha atracar na porta.
      B(COR_AGUA).quad(p(ax, az, -meiaA, ya - LAMINA), p(bx, bz, -meiaA, yb - LAMINA),
                       p(bx, bz, +meiaA, yb - LAMINA), p(ax, az, +meiaA, ya - LAMINA))
      // ── a margem: um nível só, com a água encostando nele ──────────────
      const banda = meiaC - meiaA
      const fPasseio = 0.26, fPista = 0.52     // o resto é guia e faixa de árvore
      for (const sg of [-1, 1]) {
        const w0 = sg * meiaA
        const w1 = sg * (meiaA + banda * fPasseio)
        const w2 = sg * (meiaA + banda * (fPasseio + fPista))
        const w3 = sg * meiaC
        const yR = (y: number) => y + RUA_ALT
        // 1. a parede de atracação, da lâmina até o passeio: só 1 m, e é ela que
        //    põe o convés da lancha na altura da calçada
        B(COR_MURO).quad(p(ax, az, w0, ya - LAMINA), p(bx, bz, w0, yb - LAMINA),
                         p(bx, bz, w0, yR(yb)), p(ax, az, w0, yR(ya)))
        // 2. o PASSEIO, que encosta na água
        B(COR_CAIS).quad(p(ax, az, w0, yR(ya)), p(bx, bz, w0, yR(yb)),
                         p(bx, bz, w1, yR(yb)), p(ax, az, w1, yR(ya)))
        // 3. a PISTA, que é a via que o anel perdeu para a água
        B(COR_PISTA).quad(p(ax, az, w1, yR(ya) - 0.15), p(bx, bz, w1, yR(yb) - 0.15),
                          p(bx, bz, w2, yR(yb) - 0.15), p(ax, az, w2, yR(ya) - 0.15))
        // 4. a GUIA e a faixa de árvore, encostando no lote
        B(COR_CAIS).quad(p(ax, az, w2, yR(ya)), p(bx, bz, w2, yR(yb)),
                         p(bx, bz, w3, yR(yb)), p(ax, az, w3, yR(ya)))
        // 5. o leito, abaixo da lâmina
        B(COR_MURO).quad(p(ax, az, w0, ya - FUNDO), p(bx, bz, w0, yb - FUNDO),
                         p(bx, bz, w0, yb - LAMINA), p(ax, az, w0, ya - LAMINA))
      }
      // ⚠️ O CABEÇO É O QUE FAZ A MARGEM SER ATRACADOURO e não beira. Sem ele a
      // promessa de parar a lancha na frente de casa não tem onde amarrar.
      if (Math.floor((i * L) / n / CABECO_CADA) !== Math.floor(((i + 1) * L) / n / CABECO_CADA)) {
        for (const sg of [-1, 1]) {
          const wb = sg * (meiaA + 1.1)
          const cx = ax + px * wb, cz = az + pz * wb
          const y0 = ya + RUA_ALT, y1 = y0 + 0.85
          for (let f = 0; f < 4; f++) {
            const b0 = (f / 4) * Math.PI * 2, b1 = ((f + 1) / 4) * Math.PI * 2
            const q = (bb: number, yy: number) =>
              P(cx + Math.cos(bb) * 0.28, cz + Math.sin(bb) * 0.28, yy)
            B(COR_MURO).quad(q(b0, y0), q(b1, y0), q(b1, y1), q(b0, y1))
          }
        }
      }
    }
  }

  // ── AS PONTES: sem elas o canal não é canal, é fosso ─────────────────────
  //
  // ⚠️ ESTE ERA O DEFEITO MAIS GRAVE DE TODOS E NÃO APARECIA EM CHAPA NENHUMA.
  // Cinco anéis de água sem travessia partem a cidade em SEIS ILHAS
  // CONCÊNTRICAS, e oito canais radiais impedem dar a volta em qualquer anel.
  // A cidade ficava com a rede viária inteira desenhada e nenhuma ligação entre
  // as partes. Água por cima de rua não gera erro: só desconecta.
  //
  // Regra: TODA via que cruza um canal ganha ponte. Avenida radial x anel de
  // canal, e rua de anel x canal radial. É o que Amsterdam faz, onde há ponte em
  // praticamente cada quarteirão.
  const ponte = (cx: number, cz: number, dirX: number, dirZ: number, larg: number, vao: number) => {
    const px = -dirZ, pz = dirX
    const y = o.heightAt(cx, cz) + 1.9            // acima da lâmina, que está a −2,6
    const n = 6
    for (let i = 0; i < n; i++) {
      const t0 = -vao / 2 + (vao * i) / n, t1 = -vao / 2 + (vao * (i + 1)) / n
      const q = (t: number, sg: number) =>
        P(cx + dirX * t + px * sg * larg / 2, cz + dirZ * t + pz * sg * larg / 2, y)
      B(COR_CAIS).quad(q(t0, -1), q(t1, -1), q(t1, 1), q(t0, 1))
    }
    // os dois parapeitos, que é o que faz ler como ponte e não como laje
    for (const sg of [-1, 1]) {
      const a = P(cx + dirX * (-vao / 2) + px * sg * larg / 2, cz + dirZ * (-vao / 2) + pz * sg * larg / 2, y)
      const b = P(cx + dirX * (vao / 2) + px * sg * larg / 2, cz + dirZ * (vao / 2) + pz * sg * larg / 2, y)
      const a2 = [a[0], y + 1.1, a[2]], b2 = [b[0], y + 1.1, b[2]]
      B(COR_MURO).quad(a, b, b2, a2)
    }
    pontes++
  }
  let pontes = 0
  const rEm = o.raioEmPhi
  // avenida radial cruzando anel de canal
  for (const av of o.avenidas ?? []) {
    const g = (av.rumo * Math.PI) / 180
    const dx = Math.sin(g), dz = -Math.cos(g)
    for (const a of o.aneis) {
      const r = rEm ? rEm(g, a.phi) : 0
      if (!r) continue
      ponte(dx * r, dz * r, dx, dz, av.largura, a.secao + 24)
    }
  }
  // rua de anel cruzando canal radial
  for (const r of o.radiais) {
    const g = (r.rumo * Math.PI) / 180
    const dx = Math.sin(g), dz = -Math.cos(g)
    for (const ph of o.aneisPhi ?? []) {
      const rr = rEm ? rEm(g, ph) : 0
      if (!rr || rr < r.rInicio) continue
      // a ponte corre TANGENTE, cruzando o canal radial
      ponte(dx * rr, dz * rr, Math.cos(g), Math.sin(g), 12, r.secao + 24)
    }
  }

  // ── os radiais: do lago para fora, até o anel de canal mais externo ───────
  const rFim = o.rFimRadial ?? 4300
  for (const r of o.radiais) {
    const g = (r.rumo * Math.PI) / 180
    const sx = Math.sin(g), sz = -Math.cos(g)
    trecho(sx * r.rInicio, sz * r.rInicio, sx * rFim, sz * rFim, r.secao, r.lamina)
  }

  const feitas: THREE.Mesh[] = []
  let triangulos = 0
  baldes.forEach((b, cor) => {
    if (!b.ix.length) return
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(b.vs, 3))
    g.setIndex(b.ix)
    g.computeVertexNormals()
    const agua = cor === COR_AGUA
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({
      color: cor,
      // os mesmos valores do lago: os dois se encontram e não podem divergir
      roughness: agua ? 0.30 : 0.92,
      metalness: agua ? 0.02 : 0,
      side: THREE.DoubleSide,
    }))
    m.name = `canais:${agua ? 'agua' : cor}`
    m.receiveShadow = !agua
    m.castShadow = (o.sombra ?? true) && !agua
    m.frustumCulled = false
    group.add(m)
    feitas.push(m)
    triangulos += b.ix.length / 3
  })

  const relogios = feitas.map((m) => aguaDeVerdade(m)).filter(Boolean) as { value: number }[]
  return {
    group, metros: Math.round(metros), pontes, triangulos,
    update(t: number) { for (const u of relogios) u.value = t },
    dispose() {
      for (const m of feitas) { m.geometry.dispose(); (m.material as THREE.Material).dispose() }
      group.clear()
    },
  }
}
