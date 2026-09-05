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
// ⚠️ O RADIAL TROCOU MURO POR PRAIA EM 05/09 (QUARTA RODADA). O muro vertical
// (`COR_MURO`, o que restou dele hoje é só o pé submerso e a foz) fazia sentido
// contra um talude de 40 m: o chão ao lado da água já estava perto da cota da
// rua, então "muro curto + cais" bastava. Com o relevo real do sítio (a sonda
// mediu até 53 m de diferença entre o leito e a borda em menos de 100 m), aquele
// muro vertical de dezenas de metros era exatamente o que lia como "fosso",
// palavra do fundador. `terrain.ts` agora esculpe a margem com perfil absoluto
// (`canalRadialAbsAt`, ver a nota grande em `CANAL_BANDA`) até 950 m de cada
// lado; este módulo só precisa pintar a faixa de areia (`CANAL_PRAIA`, 40 m) que
// já existe no chão, não mais erguer parede nenhuma. O muro que sobra aqui é só
// o pé debaixo d'água (a face que a lancha encosta) e a foz, que continua com
// cais de verdade porque ali é rio encontrando baía, não margem de casa.
//
// Three.js puro (regra da casa: nada de react-three-fiber).
// ═══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three'
import { COR_AGUA, aguaDeVerdade, AREIA_SECA, AREIA_MOLHADA } from './lago'
import { look2 } from './look'
import { CANAL_PRAIA, CANAL_BANDA } from './terrain'

export interface CanalRadial {
  id: string; rumo: number; secao: number; lamina: number
  rInicio: number; phiFim: number; sobreBulevar?: boolean
  /** ⚠️ ATÉ ONDE ESTE canal vai, publicado por canal em `cidade-malha.json`.
   *  Ele era IGNORADO: o desenho usava um `rFimRadial` único, o maior de todos,
   *  e por isso CR01 (rFim 4.540) e CR02 (3.640) eram desenhados até 5.660, ou
   *  seja 1.120 e 2.020 m de canal DENTRO da baía. Ver `buildCanais`. */
  rFim?: number
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
const DECK = 2.2         // o cais acima da lâmina: o MESMO valor da orla da baía
// ⚠️ 40 m, NÃO 16. O cais fica a −37,8 e a cidade ao redor a −28: são quase 10 m
// para subir, e em 16 m isso é uma rampa de 61%, que lê como parede e ainda deixa
// o regolito furar. Em 40 m dá 25%, que é talude de aterro de verdade.
const TALUDE = 40        // onde o cais encontra o chão de verdade
// ⚠️ `RUA_ALT` E `CABECO_CADA` SAÍRAM EM 05/09 (QUINTA RODADA), junto com o
// muro que as usava: a margem virou praia (ver a nota grande em "a margem:
// PRAIA, não parede", abaixo), e um cabeço de amarração não pousa em areia.

class Balde {
  vs: number[] = []; ix: number[] = []
  // ⚠️ ANTI-HORÁRIO VISTO DE CIMA, senão a normal aponta para baixo e o backface
  // culling apaga a face inteira. Já custou uma praça e dois anéis nesta cena.
  quad(a: number[], b: number[], c: number[], d: number[]) {
    const i = this.vs.length / 3
    this.vs.push(...a, ...b, ...c, ...d)
    this.ix.push(i, i + 1, i + 2, i, i + 2, i + 3)
  }
  /** o leque da ponta do molhe: quad com dois vértices juntos gastaria um
   *  triângulo degenerado por fatia, e a ponta tem seis */
  tri(a: number[], b: number[], c: number[]) {
    const i = this.vs.length / 3
    this.vs.push(...a, ...b, ...c)
    this.ix.push(i, i + 1, i + 2)
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
  // ── LOOK 2: A FOZ, O NÍVEL DO CAIS E O DESENCONTRO DE LÂMINAS ────────────
  //
  // ⚠️ AS DUAS LÂMINAS JÁ ESTÃO NA MESMA COTA, O DEGRAU ERA NO CAIS. Medido em
  // 02/09 nas constantes dos dois módulos, que é onde o número mora:
  //   água do canal   COTA = −40,0   (`o.cota`, vem de `lagos.cota`)
  //   água da baía    −40,0          (`buildLagos`, mesma constante)   degrau 0
  //   cais do canal   −39,5 na foz   (piso antigo: lâmina + 0,5)
  //   orla da baía    −37,8          (ORLA_ALTURA 2,2 em `lagos.ts`)   degrau 1,7
  // Ou seja: onde o canal encontra a baía, o passeio do canal chegava 1,7 m
  // ABAIXO do passeio da baía, e antes disso já tinha sumido, porque a regra da
  // parede desiste quando não há terra. No look 2 o piso do cais passa a ser
  // COTA + DECK = −37,8, o MESMO valor da orla: os dois passeios se encontram na
  // mesma linha e o degrau vai a zero. `DECK` não muda de valor, ele passa a ser
  // usado como PISO MÍNIMO em vez de só existir na constante.
  //
  // ⚠️ AS DUAS ÁGUAS SÃO COPLANARES EM −40 AO LONGO DO CANAL INTEIRO, e isto não
  // é só na foz: `buildLagos` desenha lâmina em TODO ponto de terreno abaixo da
  // cota, e o leito do canal está escavado a −44, então ele também enche. Duas
  // faces no mesmo plano brigam pelo depth buffer e cintilam. Ninguém tinha
  // medido isto porque água que cintila lê como reflexo. 3 cm de viés resolvem:
  // a água do canal ganha sempre, e 3 cm num sítio de 412 m de relevo é nada.
  const FOZ2 = look2 && COTA !== undefined
  const NIVEL = COTA ?? -40
  const PISO = NIVEL + DECK          // −37,8: o passeio, igual ao da orla da baía
  const PE = NIVEL - 4.0             // o pé do muro, dentro d'água
  const VIES_AGUA = FOZ2 ? 0.03 : 0
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
      const wA = (COTA !== undefined ? COTA : ya - LAMINA) + VIES_AGUA
      const wB = (COTA !== undefined ? COTA : yb - LAMINA) + VIES_AGUA
      B(COR_AGUA).quad(p(ax, az, -meiaA, wA), p(bx, bz, -meiaA, wB),
                       p(bx, bz, +meiaA, wB), p(ax, az, +meiaA, wA))
      // ── a margem: PRAIA, não parede ──────────────────────────────────
      //
      // ⚠️ ESTA É A QUINTA VERSÃO DA SEÇÃO, E A MUDANÇA NÃO É DE DESENHO, É DE
      // TERRENO. As quatro anteriores (a última delas o muro vertical: ver o
      // histórico no header do arquivo) todas erguiam alguma PAREDE porque o
      // chão do lado de fora subia rápido demais para deixar exposto, e é
      // exatamente isso que o fundador leu como "vala seca por causa da
      // margem" (05/09, quarta rodada). A resposta não foi desenhar uma praia
      // em cima da parede: foi tirar a razão de a parede existir. `terrain.ts`
      // agora esculpe o MERGULHO (leito → lâmina) e a PRAIA (lâmina → crista
      // seca, `CANAL_PRAIA` = 40 m) como parte do próprio relevo
      // (`canalRadialAbsAt`), então debaixo d'água e na faixa seca o chão JÁ
      // é a forma certa, e este bloco só PINTA a faixa de areia que já existe,
      // não constrói nada em cima dela. Sem isso ela sairia com a cor comum
      // do regolito, que não lê como praia nenhuma.
      //
      // ⚠️ O QUE SE PERDE: o cabeço de amarração e o convés elevado (o "parar
      // a lancha na frente de casa" do pedido original) saem daqui. Não
      // cabem numa margem de areia: isso é o preço explícito do pedido novo,
      // e fica registrado: se o produto quiser doca por lote de novo, ela
      // precisa de projeto próprio agora que a margem é praia, não cais.
      for (const sg of [-1, 1]) {
        const w0 = sg * meiaA
        const w1 = sg * (meiaA + CANAL_PRAIA)
        const y0a = Math.max(o.heightAt(ax + px * w0, az + pz * w0), wA)
        const y0b = Math.max(o.heightAt(bx + px * w0, bz + pz * w0), wB)
        const y1a = o.heightAt(ax + px * w1, az + pz * w1)
        const y1b = o.heightAt(bx + px * w1, bz + pz * w1)
        B(AREIA_SECA).quad(p(ax, az, w0, y0a), p(bx, bz, w0, y0b),
                           p(bx, bz, w1, y1b), p(ax, az, w1, y1a))
        // a franja molhada, os 6 m mais próximos da água: mesma distinção de
        // tom que a praia do Lago da Praça usa, pra as duas areias lerem como
        // a mesma peça.
        const wm = sg * (meiaA + Math.min(6, CANAL_PRAIA))
        const yma = o.heightAt(ax + px * wm, az + pz * wm)
        const ymb = o.heightAt(bx + px * wm, bz + pz * wm)
        B(AREIA_MOLHADA).quad(p(ax, az, w0, y0a), p(bx, bz, w0, y0b),
                              p(bx, bz, wm, ymb), p(ax, az, wm, yma))
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

  // ═══════════════════════════════════════════════════════════════════════
  // A FOZ: onde o canal entrega a água à baía
  //
  // ⚠️ A FOZ ESTAVA SENDO DESENHADA COMO O LUGAR ONDE A REGRA DESISTIU. Três
  // defeitos empilhados, todos medidos em 02/09:
  //   1. o `rFim` de cada canal era ignorado e todos iam ao maior (5.660), então
  //      CR01 e CR02 desenhavam vala e água ATRAVESSANDO a baía aberta;
  //   2. a parede parava onde não havia terra, e como a linha d'água de CR01 cai
  //      em r 3.405 e a de CR02 em 2.810, o cais evaporava justo na boca;
  //   3. o passeio do canal chegava a −39,5 e a orla da baía está a −37,8.
  // O resultado na chapa era uma vala aberta no regolito, e vala é o oposto do
  // que a baía vende: o valor do canal é TESTADA DE ÁGUA, e testada acaba em
  // endereço, não em barranco.
  //
  // O vocabulário escolhido é o de porto, o mesmo de Amsterdam e de qualquer
  // canal que chega ao mar: a foz ALARGA, o cais DÁ A VOLTA e avança sobre a
  // água como MOLHE, o molhe termina em PONTA arredondada, o lado de fora leva
  // GUARDA-CORPO e o lado de dentro fica livre para atracar, com CABEÇOS e uma
  // ESCADA descendo à água. Nada disso interpola terreno: está tudo sobre a
  // lâmina, na cota da lâmina, então não pode serrilhar.
  const FOZ_ML = 130      // quanto o molhe avança sobre a baía
  // ⚠️ 36, NÃO 40, E O TETO NÃO É ESTÉTICO. `_foraDoCanal` (em `plaza-scene.tsx`)
  // suprime a margem da baía num corredor de secao/2 + talude 40 + 6 = 76 m em
  // volta do eixo. Com 40 o molhe media 30 + 40 + 9 = 79 m e a ponta saía do
  // corredor: a orla da baía voltaria a ser desenhada por cima dela, que é o
  // mesmo "U de cais fechando a saída" que já foi consertado uma vez. Com 36 dá
  // 75 m e a ponta fica dentro, com 1 m de folga.
  const FOZ_ABRE = 36     // quanto a boca abre de cada lado ao longo do molhe
  const FOZ_LARG = 9      // o tabuleiro do molhe: passeio de gente, não pista
  const FOZ_GUARDA = 1.0  // o guarda-corpo, só na face de fora

  /** o degrau de uma escada de cais, saindo da face para dentro d'água */
  const escada = (bx: number, bz: number, ux: number, uz: number, px: number, pz: number,
                  larg: number, fundo: number, topo: number) => {
    // ⚠️ `px,pz` APONTA PARA A ÁGUA e os deslocamentos são POSITIVOS. Com sinal
    // trocado a escada desce para DENTRO do molhe, some no maciço e o cais fica
    // com um rasgo no meio: acontece que ninguém vê, porque o rasgo é do tamanho
    // do degrau.
    const N = 6, dh = (topo - NIVEL) / N
    for (let k = 0; k < N; k++) {
      const y = topo - dh * k, y2 = y - dh
      const o0 = fundo * (k / N)
      const o1 = fundo * ((k + 1) / N)
      const q = (off: number, lat: number, yy: number) =>
        P(bx + px * off + ux * lat, bz + pz * off + uz * lat, yy)
      // o piso do degrau e o espelho dele
      B(COR_CAIS).quad(q(o0, -larg / 2, y), q(o1, -larg / 2, y), q(o1, larg / 2, y), q(o0, larg / 2, y))
      B(COR_MURO).quad(q(o1, -larg / 2, y2), q(o1, larg / 2, y2), q(o1, larg / 2, y), q(o1, -larg / 2, y))
    }
  }

  /** o cabeço de amarração, avulso: a foz precisa dele fora do passo do trecho */
  const cabeco = (cx: number, cz: number, y0: number) => {
    const y1 = y0 + 0.85
    for (let f = 0; f < 4; f++) {
      const b0 = (f / 4) * Math.PI * 2, b1 = ((f + 1) / 4) * Math.PI * 2
      const q = (bb: number, yy: number) => P(cx + Math.cos(bb) * 0.28, cz + Math.sin(bb) * 0.28, yy)
      B(COR_MURO).quad(q(b0, y0), q(b1, y0), q(b1, y1), q(b0, y1))
    }
  }

  /** as duas pontas de molhe de uma foz, a partir do ponto em que o canal cruza
   *  a linha d'água. `ux,uz` aponta para FORA, para a baía. */
  const molhes = (fx: number, fz: number, ux: number, uz: number, meiaC: number) => {
    const px = -uz, pz = ux
    const n = 10
    // ⚠️ ABRE EM SUAVIZAÇÃO, NÃO EM RETA. Boca de canal que abre em reta lê como
    // funil de concreto; a curva em S faz a margem sair tangente ao canal e
    // chegar tangente à baía, que é o desenho de molhe de verdade.
    const abre = (t: number) => meiaC + FOZ_ABRE * (t * t * (3 - 2 * t))
    for (const sg of [-1, 1]) {
      const q = (t: number, off: number, y: number) =>
        P(fx + ux * FOZ_ML * t + px * sg * off, fz + uz * FOZ_ML * t + pz * sg * off, y)
      for (let i = 0; i < n; i++) {
        const t0 = i / n, t1 = (i + 1) / n
        const o0 = abre(t0), o1 = abre(t1)
        B(COR_CAIS).quad(q(t0, o0, PISO), q(t1, o1, PISO),
                         q(t1, o1 + FOZ_LARG, PISO), q(t0, o0 + FOZ_LARG, PISO))
        // a face de dentro, que é onde a lancha encosta
        B(COR_MURO).quad(q(t0, o0, PE), q(t1, o1, PE), q(t1, o1, PISO), q(t0, o0, PISO))
        // a face de fora
        B(COR_MURO).quad(q(t0, o0 + FOZ_LARG, PE), q(t1, o1 + FOZ_LARG, PE),
                         q(t1, o1 + FOZ_LARG, PISO), q(t0, o0 + FOZ_LARG, PISO))
        // o guarda-corpo: só na face de fora, senão fecha o atracadouro
        B(COR_MURO).quad(q(t0, o0 + FOZ_LARG, PISO), q(t1, o1 + FOZ_LARG, PISO),
                         q(t1, o1 + FOZ_LARG, PISO + FOZ_GUARDA),
                         q(t0, o0 + FOZ_LARG, PISO + FOZ_GUARDA))
      }
      // ── A PONTA: o cais dá a volta ──────────────────────────────────────
      const R = FOZ_LARG / 2
      const oC = abre(1) + R
      const cx = fx + ux * FOZ_ML + px * sg * oC
      const cz = fz + uz * FOZ_ML + pz * sg * oC
      const C = P(cx, cz, PISO)
      const NS = 6
      const arco = (k: number) => {
        // −90° é a face de dentro, +90° a de fora, passando pela frente
        const a = (-Math.PI / 2) + (Math.PI * k) / NS
        const ex = Math.cos(a), ey = Math.sin(a) * sg
        return [cx + ux * R * ex + px * R * ey, cz + uz * R * ex + pz * R * ey]
      }
      for (let k = 0; k < NS; k++) {
        const [ax2, az2] = arco(k), [bx2, bz2] = arco(k + 1)
        B(COR_CAIS).tri(C, P(ax2, az2, PISO), P(bx2, bz2, PISO))
        B(COR_MURO).quad(P(ax2, az2, PE), P(bx2, bz2, PE), P(bx2, bz2, PISO), P(ax2, az2, PISO))
        // o guarda-corpo dá a volta na metade de fora da ponta
        if (k >= NS / 2) {
          B(COR_MURO).quad(P(ax2, az2, PISO), P(bx2, bz2, PISO),
                           P(bx2, bz2, PISO + FOZ_GUARDA), P(ax2, az2, PISO + FOZ_GUARDA))
        }
      }
      // ── o remate de uso: escada para a água e três cabeços ───────────────
      const dentro = (t: number) => {
        const off = abre(t)
        return [fx + ux * FOZ_ML * t + px * sg * off, fz + uz * FOZ_ML * t + pz * sg * off]
      }
      const [ex2, ez2] = dentro(0.22)
      escada(ex2, ez2, ux, uz, -px * sg, -pz * sg, 4, 3.2, PISO)
      for (const t of [0.45, 0.7, 0.95]) {
        const [kx, kz] = dentro(t)
        cabeco(kx + px * sg * 1.4, kz + pz * sg * 1.4, PISO)
      }
    }
  }

  /** CR03 não chega à água: em vez de sumir no regolito ele ganha CABECEIRA, que
   *  é o fim construído de um canal, com muro de testa, passeio dando a volta,
   *  escada e cabeços. Uma dársena de verdade precisaria de escavação nova, que é
   *  obra do gerador e não deste módulo (ver relatório). */
  const cabeceira = (ex: number, ez: number, ux: number, uz: number, meiaC: number) => {
    const px = -uz, pz = ux
    const w = (off: number, dl: number, y: number) =>
      P(ex + px * off + ux * dl, ez + pz * off + uz * dl, y)
    // ⚠️ O TOPO SAI DO MAIOR DOS TRÊS PONTOS, senão o passeio da testa fica
    // enterrado de um lado. Nunca abaixo do piso do cais, que é o nível do resto.
    const top = Math.max(PISO,
      o.heightAt(ex + px * meiaC, ez + pz * meiaC),
      o.heightAt(ex - px * meiaC, ez - pz * meiaC),
      o.heightAt(ex + ux * 10, ez + uz * 10))
    B(COR_MURO).quad(w(-meiaC, 0, PE), w(meiaC, 0, PE), w(meiaC, 0, top), w(-meiaC, 0, top))
    B(COR_CAIS).quad(w(-meiaC - 2.5, 0, top), w(meiaC + 2.5, 0, top),
                     w(meiaC + 2.5, 8, top), w(-meiaC - 2.5, 8, top))
    for (const sg of [-1, 1]) {
      B(COR_MURO).quad(w(sg * (meiaC + 2.5), 0, top), w(sg * (meiaC + 2.5), 8, top),
                       w(sg * (meiaC + 2.5), 8, top + FOZ_GUARDA),
                       w(sg * (meiaC + 2.5), 0, top + FOZ_GUARDA))
      cabeco(ex + px * sg * (meiaC - 3) - ux * 2, ez + pz * sg * (meiaC - 3) - uz * 2, top)
    }
    escada(ex, ez, px, pz, -ux, -uz, 5, 3.2, top)
  }

  /** ⚠️ A FOZ SE MEDE, NÃO SE DECLARA. É o primeiro raio em que as DUAS margens
   *  já estão abaixo da lâmina: dali para fora não há terra para conter e o canal
   *  virou baía. Passo grosso de 15 m e refino por bisseção, para a boca não
   *  ficar dependendo de onde caiu a amostra. Devolve −1 se o canal morre seco. */
  const acharFoz = (sx: number, sz: number, r0: number, r1: number, meiaC: number) => {
    const px = -sz, pz = sx
    // ⚠️ AMOSTRA FORA DA ESCAVAÇÃO, e este é o erro que me custou uma medição.
    // A ±meiaC o chão JÁ É a vala, cavada a −44, ou seja abaixo da lâmina: com
    // essa amostra os três canais "chegavam à água" logo depois do começo (medido:
    // CR01 em r 1.730, CR02 em 1.788, CR03 em 1.626, todos a menos de 350 m do
    // rInicio 1.450) e o canal inteiro virava foz.
    //
    // ⚠️ 50 m DEIXOU DE BASTAR NA QUARTA RODADA (05/09): o talude fixo de 40 m
    // virou perfil absoluto de até `CANAL_BANDA` (950 m: ver a nota grande em
    // `canalRadialAbsAt`, `terrain.ts`), e a 100 m a amostra ainda caía dentro
    // da PRAIA do próprio canal (que sobe suave rumo ao relevo natural), lendo
    // "seco" quase no início de novo, o mesmo defeito antigo, por outro
    // motivo. Agora a amostra sai depois da banda inteira, o mesmo raio de
    // onde `_foraDoCanal` (`plaza-scene.tsx`) tira a máscara da orla da baía.
    const fora = meiaC + CANAL_BANDA + 10
    const seco = (r: number) => {
      const x = sx * r, z = sz * r
      return Math.max(o.heightAt(x + px * fora, z + pz * fora),
                      o.heightAt(x - px * fora, z - pz * fora)) >= NIVEL + 0.5
    }
    let ant = r0
    for (let r = r0 + 15; r <= r1; r += 15) {
      if (!seco(r)) {
        let a = ant, b = r
        for (let k = 0; k < 6; k++) { const m = (a + b) / 2; if (seco(m)) a = m; else b = m }
        return b
      }
      ant = r
    }
    return -1
  }

  // ── os radiais: do lago para fora, até a foz (ou até a cabeceira) ─────────
  const rFim = o.rFimRadial ?? 4300
  const fozes: string[] = []
  for (const r of o.radiais) {
    const g = (r.rumo * Math.PI) / 180
    const sx = Math.sin(g), sz = -Math.cos(g)
    if (!FOZ2) {
      trecho(sx * r.rInicio, sz * r.rInicio, sx * rFim, sz * rFim, r.secao, r.lamina)
      continue
    }
    // ⚠️ CADA CANAL TEM O SEU `rFim`, e usar o maior de todos é o que jogava CR01
    // e CR02 baía adentro. O `rFimRadial` continua valendo como teto de segurança.
    const rSeu = Math.min(r.rFim ?? rFim, rFim)
    const rF = acharFoz(sx, sz, r.rInicio, rSeu, r.secao / 2)
    const rPara = rF > 0 ? rF : rSeu
    trecho(sx * r.rInicio, sz * r.rInicio, sx * rPara, sz * rPara, r.secao, r.lamina)
    if (rF > 0) {
      molhes(sx * rF, sz * rF, sx, sz, r.secao / 2)
      fozes.push(`${r.id} foz em r ${Math.round(rF)}`)
    } else {
      cabeceira(sx * rSeu, sz * rSeu, sx, sz, r.secao / 2)
      fozes.push(`${r.id} cabeceira em r ${Math.round(rSeu)} (morre em terra)`)
    }
  }
  if (FOZ2 && fozes.length) console.log('[canais] look 2:', fozes.join(' | '))

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
