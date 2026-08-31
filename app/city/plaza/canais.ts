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
  /** trechos em que o anel está interrompido, em rumo (graus) */
  vaos?: [number, number][]
}
export interface Avenida { rumo: number; largura: number }
export interface CanaisOpts {
  /** as avenidas radiais: cada uma ganha ponte sobre cada anel de canal */
  avenidas?: Avenida[]
  /** os φ das ruas de anel: cada uma ganha ponte sobre cada canal radial */
  aneisPhi?: number[]
  /** os ANÉIS VIÁRIOS, em raio de mundo e largura. Não são os mesmos que
   *  `aneisPhi`: aqueles são as linhas de anel da teia, estes são as avenidas
   *  circulares (Anel Interior, Médio, Exterior, Cinturão, Doca, Escoamento,
   *  Pista de Serviço). Sem eles aqui, três avenidas ficam sem travessia. */
  aneisViarios?: { r: number; larg: number }[]
  /** φ -> raio naquele rumo, para achar onde a rua de anel cruza o canal */
  raioEmPhi?: (ang: number, phi: number) => number
  /** ⚠️ `superficieAt`, NUNCA `heightAt`: é o chão que a câmera vê */
  heightAt: (x: number, z: number) => number
  /** ⚠️ A COTA ABSOLUTA DA LÂMINA, a mesma dos lagos e da baía (−40). Sem ela o
   *  módulo volta ao comportamento antigo, em que cada trecho tirava o nível do
   *  terreno ao lado e a água virava escada. */
  cota?: number
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
const LAMINA = 1.0       // a água, abaixo do passeio: altura de convés (modo antigo)
const RUA_ALT = 0.35     // o nível do passeio, acima do chão (modo antigo)
const DECK = 2.2         // o cais acima da lâmina: o MESMO valor da orla da baía
// ⚠️ 40 m, NÃO 16. O cais fica a −37,8 e a cidade ao redor a −28: são quase 10 m
// para subir, e em 16 m isso é uma rampa de 61%, que lê como parede e ainda deixa
// o regolito furar. Em 40 m dá 25%, que é talude de aterro de verdade.
const TALUDE = 40        // onde o cais encontra o chão de verdade
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
  // ⚠️ A LÂMINA DO CANAL É ABSOLUTA E É A MESMA DE TODA A ÁGUA DA CIDADE.
  //
  // O fundador, em 30/08: "veja o canal como está completamente serrilhado, não é
  // um fluxo de água contínuo, parece pedaços de um rio tortuoso colocado num
  // canal reto". A causa estava aqui: cada trecho de 18 m tirava a própria cota
  // amostrando o TERRENO ao lado (`ref`), então a água subia e descia em degraus
  // acompanhando o relevo, e entre um degrau e outro aparecia a parede. É o mesmo
  // defeito que ele já tinha matado nos lagos, sobrevivendo nos três radiais.
  //
  // Agora a água é uma lâmina só, na cota que o gerador publica (−40, a mesma dos
  // lagos e da baía), e quem negocia com o relevo é a PAREDE: ela estica do nível
  // da água até o passeio, que continua acompanhando a rua. Água plana, cais em
  // degrau — que é como um canal de verdade se comporta.
  const COTA = o.cota
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
      const wA = COTA !== undefined ? COTA : ya - LAMINA
      const wB = COTA !== undefined ? COTA : yb - LAMINA
      B(COR_AGUA).quad(p(ax, az, -meiaA, wA), p(bx, bz, -meiaA, wB),
                       p(bx, bz, +meiaA, wB), p(ax, az, +meiaA, wA))
      // ── a margem: DUAS PAREDES VERTICAIS, e nada mais ─────────────────
      //
      // ⚠️ ESTA É A QUARTA VERSÃO DA SEÇÃO E AS TRÊS ANTERIORES SERRILHARAM, cada
      // uma por um motivo, todas pelo mesmo vício: tentar acompanhar o terreno.
      //   v1: a água tirava a cota do terreno a cada 18 m -> escada de água.
      //   v2: água plana, mas o CAIS ainda seguia o terreno -> passeio em zigue-
      //       zague ao longo de um canal reto.
      //   v3: cais plano, mas o TALUDE era um quad entre dois pontos amostrados,
      //       e o regolito furava essa reta no meio do vão -> a fita d'água
      //       aparecia só nos furos.
      //
      // O que não pode serrilhar é uma PAREDE VERTICAL num deslocamento FIXO: ela
      // não interpola terreno em nenhuma direção. A seção virou o mínimo que
      // descreve um canal: lâmina plana em `COTA`, e de cada lado uma parede que
      // sobe do leito até o chão daquele ponto. O chão em volta continua sendo o
      // terreno da cidade, que já está cavado; a parede só impede que ele apareça
      // por dentro do canal.
      //
      // ⚠️ A PAREDE É AMOSTRADA NO MESMO PASSO DA ÁGUA (18 m) e no MESMO
      // deslocamento (±meiaC). Como os dois vértices de cima de um painel são o
      // terreno naqueles dois pontos e os de baixo são a cota do leito, o painel
      // encosta no chão por construção nas duas pontas — e entre elas ele fica
      // ACIMA do chão, nunca abaixo, porque o leito é plano e o chão sobe.
      // ⚠️ NA FOZ A PAREDE PARA, e sem isto ela continua desenhada POR CIMA da
      // água aberta: o fundador viu a linha do canal atravessando a baía, mais um
      // banco de areia na frente dele. A parede só existe onde há TERRA para
      // conter — se os dois lados já estão abaixo da lâmina, a margem acabou e o
      // canal virou baía. É o mesmo princípio do talude: quem negocia com o
      // relevo é a parede, e onde não há relevo não há parede.
      const _terraA = Math.max(o.heightAt(ax + px * meiaC, az + pz * meiaC),
                               o.heightAt(ax - px * meiaC, az - pz * meiaC))
      const _terraB = Math.max(o.heightAt(bx + px * meiaC, bz + pz * meiaC),
                               o.heightAt(bx - px * meiaC, bz - pz * meiaC))
      if (_terraA < wA + 0.5 && _terraB < wB + 0.5) continue
      for (const sg of [-1, 1]) {
        const w = sg * meiaC
        const ta = Math.max(o.heightAt(ax + px * w, az + pz * w), wA + 0.5)
        const tb2 = Math.max(o.heightAt(bx + px * w, bz + pz * w), wB + 0.5)
        B(COR_MURO).quad(p(ax, az, w, wA - 4.0), p(bx, bz, w, wB - 4.0),
                         p(bx, bz, w, tb2), p(ax, az, w, ta))
        // a guia de 2,5 m no topo da parede: é ela que dá a linha clara da margem
        const wg = sg * (meiaC + 2.5)
        const ga = Math.max(o.heightAt(ax + px * wg, az + pz * wg), ta)
        const gb = Math.max(o.heightAt(bx + px * wg, bz + pz * wg), tb2)
        B(COR_CAIS).quad(p(ax, az, w, ta), p(bx, bz, w, tb2),
                         p(bx, bz, wg, gb), p(ax, az, wg, ga))
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
  const rFimBridge = o.rFimRadial ?? 4300
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
    // ⚠️ E OS ANÉIS VIÁRIOS TAMBÉM, que não estão em `aneisPhi`. Medido em
    // 30/08: o Anel Interior (r 1.750), a Avenida do Cinturão (4.450) e a
    // Avenida da Doca (5.620) eram cortados pelos oito canais radiais sem uma
    // travessia — 24 interrupções. A do Cinturão é a pior das três: é nela que
    // desembocam os três túneis de eclusa, então o veículo saía do túnel e batia
    // na água oito vezes ao tentar dar a volta. Sem isto, "levar DOG a qualquer
    // endereço da cidade" é falso e nada acusa.
    for (const av of o.aneisViarios ?? []) {
      if (av.r < r.rInicio || av.r > rFimBridge) continue
      ponte(dx * av.r, dz * av.r, Math.cos(g), Math.sin(g), av.larg, r.secao + 24)
    }
  }

  // ── os radiais: do lago para fora, até o anel de canal mais externo ───────
  const rFim = o.rFimRadial ?? 4300
  for (const r of o.radiais) {
    const g = (r.rumo * Math.PI) / 180
    const sx = Math.sin(g), sz = -Math.cos(g)
    trecho(sx * r.rInicio, sz * r.rInicio, sx * rFim, sz * rFim, r.secao, r.lamina)
  }

  // ── os ANÉIS: eles não tinham água nenhuma ────────────────────────────────
  //
  // ⚠️ ESTE MÓDULO SÓ DESENHAVA OS RADIAIS. Os anéis entravam aqui apenas para
  // receber ponte, e o `terrain.ts` cavava a vala deles: sete anéis de 60 m
  // abertos no chão, 4,6 m de fundo, SECOS. Não gerava erro nenhum — vala vazia
  // é só terreno rebaixado — e passou despercebida até a conferência do
  // histograma de vértices da água mostrar 64 por faixa de raio, ou seja o
  // padrão de oito radiais e mais nada. É o mesmo tipo de silêncio que já tinha
  // enterrado o canal 4 m antes: água que não é desenhada não reclama.
  //
  // O anel é desenhado trecho a trecho pelo contorno publicado, pulando os vãos.
  const noVao = (vaos: [number, number][] | undefined, x: number, z: number) => {
    if (!vaos || !vaos.length) return false
    let ru = (Math.atan2(x, -z) * 180) / Math.PI
    ru = ((ru % 360) + 360) % 360
    for (const [a0, a1] of vaos) {
      if (((ru - a0) % 360 + 360) % 360 <= ((a1 - a0) % 360 + 360) % 360) return true
    }
    return false
  }
  for (const a of o.aneis) {
    const c = a.contorno
    if (!c || c.length < 3) continue
    for (let i = 0; i < c.length; i++) {
      const [x0, z0] = c[i], [x1, z1] = c[(i + 1) % c.length]
      // ⚠️ TESTA AS DUAS PONTAS E O MEIO. O contorno vem amostrado a cada 3° e o
      // vão é mais fino que isso: testando só o meio, o trecho que ENTRA no vão
      // era desenhado inteiro e a água invadia a peça. Medido: água em 181° a
      // 183° dentro de um vão que começa em 181,6. Qualquer ponto do trecho no
      // vão derruba o trecho — a água recua até o próximo ponto do contorno, que
      // é o que se quer: melhor água de menos do que água por cima da peça.
      if (noVao(a.vaos, x0, z0) || noVao(a.vaos, x1, z1) ||
          noVao(a.vaos, (x0 + x1) / 2, (z0 + z1) / 2)) continue
      trecho(x0, z0, x1, z1, a.secao, a.lamina)
    }
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
