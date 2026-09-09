// ═══════════════════════════════════════════════════════════════════════════
// E02 DOG DERBY, o canódromo.
//
// Projeto medido em derby.md. Aqui é a PLANTA (registro de massa), que é o que o
// fundador travou em 31/08: "não precisamos das peças ainda, somente do projeto
// delas na cidade". O modelo 3D próprio, no padrão do DOG Athletics, é fase
// seguinte.
//
// ⚠️ O QUE MANDA NA FORMA É 1/6 g, E NÃO O REPERTÓRIO DE CANÓDROMO.
// Com g = 1,625 m/s² a tração cai por 6,035 e duas medidas mudam de escala:
//   a LARGADA precisa de 165,4 m para o cão chegar aos 19,4 m/s (na Terra são
//   27 m), então a RETA tem 190 m e não 70;
//   a CURVA plana pediria raio de 331 m (na Terra, 55), então ela é INCLINADA
//   35°, o que a devolve para raio 100 com 8,9% de folga.
// O resultado é um oval de 1.008,32 m cuja curva sobe 7,00 m da borda de dentro
// para a de fora. Essa parede é a peça: nenhum canódromo terrestre tem isso.
//
// ⚠️ O DESENHO ANTERIOR ERA DE CAVALO E FOI DESCARTADO INTEIRO, não ajustado.
// Ele tinha curvas de raio 190 (o cão sai pela tangente), retas de 460, paddock
// com quatro cavalariças e um lago ornamental no miolo, que era citação de
// Longchamp. Aqui o miolo é campo de treino, porque a peça é o palco do primeiro
// jogo interno da DogCity e treino é mecânica de jogo, não jardim.
//
// ⚠️ ESTA PLANTA NÃO REPRESENTA A TERRAPLANAGEM, e é a diferença mais importante
// entre ela e a peça construída. A pista de verdade tem de ser NIVELADA (prova
// com desnível ao longo do traçado não é prova), e derby.md mede o platô: 400 ×
// 300 m na cota 9,00, 86 mil m³ de corte e 86 mil de aterro. A prancheta desenha
// tudo seguindo o terreno, como todas as outras peças, porque platô plano aqui
// seria atravessado pelo próprio relevo em metade da área. Quem nivela é a fase
// do modelo 3D, com pódio próprio, como `campus.ts` faz.
//
// ⚠️ O ID É E02 E NÃO MUDA: é a chave que ./index.ts usa para achar este módulo.
// ═══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three'
import { Prancheta, COR, Y, type Ctx, type Desenho } from './kit'

// ── A IMPLANTAÇÃO, medida em 08/09/2026 ────────────────────────────────────
// Varredura de 279 posições do retângulo de 400 × 300 dentro dos 60,26 ha da
// parcela, passo de 25 m, sondando a cada 10 m. Este é o ponto mais plano:
// amplitude 7,91 m contra 22,83 m do pior, e 86 mil m³ de corte contra 212 mil.
//
// ⚠️ O SINAL DE `OZ` É NEGATIVO E ISSO NÃO É ESCOLHA, É A CONVENÇÃO DO KIT.
// `buildPecas` leva o quadro local para o mundo por
//     x = px + lx·cos(rot) − lz·sin(rot)
//     z = pz + lx·sin(rot) + lz·cos(rot)
// e a primeira medição desta peça foi feita com o sinal de `lz` trocado nos dois
// termos, que é um ESPELHAMENTO em z, não uma rotação. O ponto continuava dentro
// da parcela e continuava seco, então nada acusaria: só a topografia sob a peça
// mudava, de 7,91 m de amplitude para 10,03 e de 86 mil m³ de corte para 113 mil.
// É o mesmo erro que `assentarEstadio` cometeu em 06/09 medindo um retângulo
// girado 2φ fora do lugar. Quem mexer aqui mede com a fórmula acima, não com a
// inversa dela.
const OX = -175, OZ = -75

// ── A PISTA ────────────────────────────────────────────────────────────────
const RETA = 190          // cabe a largada de 165,4 m inteira dentro dela
const RAIO = 100          // linha de medição; a curva segura 21,13 m/s a 35°
// ⚠️ 12 m DE LARGURA, E O NÚMERO SUBIU DEPOIS DA PRIMEIRA CHAPA. Com 10 m a
// pista virava uma fita: 1.008 m de perímetro contra 10 de largura é 1:100,
// contra 1:41 da pista de atletismo, e na chapa aérea de 08/09 o que se lia era
// um campo verde com uma borda vermelha. 12 m é a razão 1:84 de canódromo
// terrestre, cabe 6 cães com folga, e o peralte cresce junto.
const LARG = 12
const PERALTE = 8.4       // 12 × tan 35°
const RI = RAIO - LARG / 2, RE = RAIO + LARG / 2
// o oval fica 40 m para dentro do centro do conjunto; o que sobra atrás dele é
// a arquibancada, a tribuna e os canis
const PZ = OZ - 40
const CX_L = OX - RETA / 2, CX_R = OX + RETA / 2   // centros das duas curvas
// a pista de treino, dentro do miolo: sem peralte, porque treino não é prova
const RT_I = 52, RT_E = 58

/** o peralte entra e sai por smoothstep no primeiro e no último quarto da curva,
 *  senão a pista teria um degrau de 8,4 m na boca dela */
function peralteEm(u: number): number {
  const s = (t: number) => t * t * (3 - 2 * t)
  if (u < 0.25) return s(u / 0.25)
  if (u > 0.75) return s((1 - u) / 0.25)
  return 1
}

export function desenhar(c: Ctx): Desenho {
  const p = new Prancheta(c)
  const { a, b } = c
  const P = (x: number, z: number, y: number) => [x, c.alt(x, z) + y, z]

  /** volume pousado na cota `y0` acima da parcela: é o que permite empilhar os
   *  níveis da tribuna, que `p.vol()` sozinho não faz (ele sempre assenta) */
  const bloco = (cor: string, cx: number, cz: number, sx: number, sz: number,
                 y0: number, h: number) => {
    const g = new THREE.BoxGeometry(sx, h, sz)
    g.translate(cx, c.alt(cx, cz) + Y.PARCELA + y0 + h / 2, cz)
    p.solto(cor, g)
  }

  /** o contorno de "estádio" (duas retas e dois semicírculos) numa faixa radial:
   *  é a forma da pista, da borda dela e da pista de treino */
  const oval = (cor: string, ri: number, re: number, y: number) => {
    p.chao(cor, CX_L, PZ + ri, CX_R, PZ + re, y)
    p.chao(cor, CX_L, PZ - re, CX_R, PZ - ri, y)
    p.anel(cor, CX_R, PZ, ri, re, y, 0, Math.PI)
    p.anel(cor, CX_L, PZ, ri, re, y, Math.PI, Math.PI * 2)
  }

  p.moldura()

  // ── o chão ───────────────────────────────────────────────────────────────
  // ⚠️ NÃO EXISTE MAIS ESPLANADA POR BAIXO DE TUDO, e a primeira chapa é o
  // motivo. A versão anterior punha um retângulo de 400 × 300 em Y.L1 e o miolo
  // verde em Y.L2 por cima: 12 cm de folga não bastam numa peça de 400 m vista
  // de 400, e o miolo saiu estilhaçado de manchas claras, que é a mesma
  // armadilha que rasgou a Praça das Medalhas em 28/08. Aqui o miolo do oval É
  // a parcela (mesma cor, mesma camada, geometria nenhuma) e o concreto só
  // aparece onde tem trabalho: a borda da pista, o piso da tribuna, o paddock e
  // o pátio dos canis. Duas superfícies coplanares empilhadas deixam de existir.
  p.chao(COR.VERDE, -a + 6, -b + 6, a - 6, b - 6, Y.PARCELA)
  oval(COR.CLARO, RE, RE + 8, Y.L1)          // a borda de concreto da pista

  // ── a pista, e o peralte que é a peça ────────────────────────────────────
  p.chao(COR.TERRACOTA, CX_L, PZ + RI, CX_R, PZ + RE, Y.L2)
  p.chao(COR.TERRACOTA, CX_L, PZ - RE, CX_R, PZ - RI, Y.L2)

  const FAIXAS = 4, SEG = 36
  const curva = (cx: number, a0: number, a1: number) => {
    for (let k = 0; k < SEG; k++) {
      const u0 = k / SEG, u1 = (k + 1) / SEG
      const t0 = a0 + (a1 - a0) * u0, t1 = a0 + (a1 - a0) * u1
      const e0 = peralteEm(u0), e1 = peralteEm(u1)
      for (let f = 0; f < FAIXAS; f++) {
        const r0 = RI + ((RE - RI) * f) / FAIXAS, r1 = RI + ((RE - RI) * (f + 1)) / FAIXAS
        const h = (rr: number, ee: number) => Y.L2 + ((rr - RI) / LARG) * PERALTE * ee
        const Q = (rr: number, tt: number, ee: number) =>
          P(cx + Math.sin(tt) * rr, PZ - Math.cos(tt) * rr, h(rr, ee))
        p.quad(COR.TERRACOTA, Q(r0, t0, e0), Q(r0, t1, e1), Q(r1, t1, e1), Q(r1, t0, e0))
      }
      // ⚠️ A PAREDE EXTERNA PRECISA SER FECHADA. Sem esta face a pista peraltada
      // vira uma fita flutuando a 8,4 m do chão vista de fora, e por baixo dela
      // aparece o verde da parcela.
      const yT = (ee: number) => Y.L2 + PERALTE * ee
      const A0 = P(cx + Math.sin(t0) * RE, PZ - Math.cos(t0) * RE, yT(e0))
      const A1 = P(cx + Math.sin(t1) * RE, PZ - Math.cos(t1) * RE, yT(e1))
      const B0 = P(cx + Math.sin(t0) * RE, PZ - Math.cos(t0) * RE, Y.L1)
      const B1 = P(cx + Math.sin(t1) * RE, PZ - Math.cos(t1) * RE, Y.L1)
      p.quad(COR.CLARO, B0, B1, A1, A0)
    }
  }
  curva(CX_R, 0, Math.PI)
  curva(CX_L, Math.PI, Math.PI * 2)

  // ── o miolo trabalha: pista de treino e reta de aferição ─────────────────
  // ⚠️ O MIOLO VAZIO ERA O SEGUNDO DEFEITO DA PRIMEIRA CHAPA: 6,45 ha de grama
  // com uma linha escura no meio lê como campo de futebol sem marcação. Aqui ele
  // tem o programa que o jogo usa, porque treino é mecânica de jogo.
  oval(COR.ESCURO, RT_I, RT_E, Y.L2)                       // pista de treino, 6 m
  p.chao(COR.TERRACOTA, OX - 82.7, PZ - 6, OX + 82.7, PZ + 6, Y.L3)  // aferição
  // trilho da lebre, por dentro do bordo interno da pista de prova
  oval(COR.ESCURO, RI - 2.2, RI - 0.6, Y.L2)

  // ── a lâmina: o edifício ─────────────────────────────────────────────────
  // ⚠️ A ALTURA SUBIU DE 13 PARA 21 m DEPOIS DA PRIMEIRA CHAPA. 190 × 13 é a
  // proporção 1:14,6 e na chapa de 08/09 leu como muro, não como prédio: a
  // tribuna ocupava 2,6° de um quadro de 45°. Três níveis de 7 m dão 1:9, que é
  // a proporção em que a horizontal ainda é o partido mas o volume existe.
  const AB0 = PZ + RE + 12          // pé da arquibancada, 4 m depois da borda
  const DEG = 16, PISO = 1.5, ESPELHO = 0.62
  for (let i = 0; i < DEG; i++) {
    p.chao(COR.CLARO, OX - 95, AB0 + i * PISO, OX + 95, AB0 + (i + 1) * PISO,
           Y.L2 + i * ESPELHO)
  }
  const TZ = AB0 + DEG * PISO + 20   // centro do volume, atrás dos degraus
  // ⚠️ OS TRÊS NÍVEIS COMPARTILHAM O PLANO DE FACHADA, e o recuo é só PARA TRÁS.
  // A versão com recuo simétrico de 2 m por nível parecia mais rica em planta e
  // na chapa de fachada de 08/09 destruiu o prédio: vista de qualquer ângulo
  // acima de 21 m, cada recuo virava uma faixa horizontal de topo de laje, e o
  // edifício lia como uma PILHA DE LAJES sem parede nenhuma. Com as três faces
  // alinhadas em `TZ - 20` a fachada é um plano vertical de 190 × 21 m, que é o
  // que faz uma tribuna ler como tribuna de qualquer altura de câmera. É também
  // o que toda tribuna de estádio faz, e a marquise sai desse plano.
  bloco(COR.CLARO, OX, TZ, 190, 40, 0, 7)         // N0: salão de apostas
  bloco(COR.CLARO, OX, TZ - 2, 190, 36, 7, 7)     // N1: circulação e camarotes
  bloco(COR.CLARO, OX, TZ - 4, 190, 32, 14, 7)    // N2: lounge e restaurante
  // ⚠️ A MARQUISE FICA MAIS BAIXA QUE O PRÉDIO, e isto é a terceira correção do
  // mesmo elemento. Primeiro ela tinha 84 m de profundidade e começava 8 m
  // DENTRO da pista, então avançava sobre a raia. Encurtada para 34 m, ela ainda
  // sumia como elemento: estava na MESMA cota de 21 m do topo da lâmina, e vista
  // de cima as duas viravam uma única chapa branca de 69 m, com o prédio sem
  // volume nenhum. A 15 m ela é o que uma marquise é, pendurada na fachada e
  // abaixo do topo, e o volume dos três níveis volta a existir na silhueta.
  bloco(COR.CLARO, OX, AB0 + 12, 196, 34, 15, 1.2)

  // ── a torre do juiz, único vertical, na linha de chegada ─────────────────
  // ⚠️ FINA E ALTA, senão não é torre. Com r 5,5 e 24 m ela saiu na chapa como um
  // tanque de água atarracado no meio da arquibancada. 4,2 m de raio para 30 m de
  // altura é a proporção 1:7 em que ela lê como o vertical do partido.
  p.cilindro(COR.CLARO, OX, PZ + RE + 4, 4.2, 30, 12)

  // ── o paddock de exibição: a peça que o jogo mais usa ────────────────────
  const PDX = OX - 132, PDZ = TZ + 46
  p.disco(COR.CLARO, PDX, PDZ, 32, Y.L1)
  p.disco(COR.TERRACOTA, PDX, PDZ, 29, Y.L2)
  p.guardaCorpo(Array.from({ length: 24 }, (_, i) => {
    const t = (i / 24) * Math.PI * 2
    return [PDX + Math.cos(t) * 30.5, PDZ + Math.sin(t) * 30.5] as [number, number]
  }), Y.L4)

  // ── canis, veterinário e pesagem: barra de serviço ───────────────────────
  p.chao(COR.CLARO, OX - 40, TZ + 30, OX + 100, TZ + 66, Y.L1)   // pátio de soltura
  bloco(COR.MEDIO, OX + 30, TZ + 48, 120, 25, 0, 9)

  // ── as duas caixas de largada, uma no início de cada reta ────────────────
  bloco(COR.MEDIO, CX_R - 4, PZ + RAIO, 4, LARG, 0, 2.4)
  bloco(COR.MEDIO, CX_L + 4, PZ - RAIO, 4, LARG, 0, 2.4)

  // ── o telão, na reta de fundo, virado para a tribuna ─────────────────────
  p.placar(OX, PZ - RE - 18, 44, 16, 0)

  // ── iluminação: quatro torres nas quinas do envelope ─────────────────────
  p.refletor(CX_L - RE - 20, PZ - RE - 16, 36)
  p.refletor(CX_R + RE + 20, PZ - RE - 16, 36)
  p.refletor(CX_L - RE - 20, PZ + RE + 16, 36)
  p.refletor(CX_R + RE + 20, PZ + RE + 16, 36)

  // ── arborização: fora do conjunto ────────────────────────────────────────
  // ⚠️ PASSO 22 E NÃO 14. Com 14 m as covas escuras de 3,2 m se fundem numa
  // faixa serrilhada contínua na chapa, porque a árvore em si nasce no módulo de
  // arborização e o que a peça desenha é só a marca no chão.
  p.alinhamento(-a + 20, -b + 20, a - 20, -b + 20, 22)
  p.alinhamento(-a + 20, b - 20, a - 20, b - 20, 22)
  p.alinhamento(OX + 215, TZ, a - 40, TZ, 22)

  return p.fechar()
}
