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
const LARG = 10           // sem raias: galgo corre solto atrás da lebre
const PERALTE = 7.0       // 10 × tan 35°
const RI = RAIO - LARG / 2, RE = RAIO + LARG / 2
// o oval fica 45 m para dentro do centro do conjunto, e os 90 m que sobram atrás
// dele são a tribuna (40) e os canis (25), com as folgas
const PZ = OZ - 45
const CX_L = OX - RETA / 2, CX_R = OX + RETA / 2   // centros das duas curvas

/** o peralte entra e sai por smoothstep no primeiro e no último quarto da curva,
 *  senão a pista teria um degrau de 7 m na boca dela */
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
   *  três níveis da tribuna, que `p.vol()` sozinho não faz (ele sempre assenta) */
  const bloco = (cor: string, cx: number, cz: number, sx: number, sz: number,
                 y0: number, h: number) => {
    const g = new THREE.BoxGeometry(sx, h, sz)
    g.translate(cx, c.alt(cx, cz) + Y.PARCELA + y0 + h / 2, cz)
    p.solto(cor, g)
  }

  p.moldura()

  // ── o chão ───────────────────────────────────────────────────────────────
  // a parcela inteira é verde: os 48 ha que sobram do conjunto ficam no chão
  // natural e a inclinação deles vira paisagem, não aterro
  p.chao(COR.VERDE, -a + 6, -b + 6, a - 6, b - 6, Y.PARCELA)
  // a esplanada do conjunto, 400 × 300
  p.chao(COR.CLARO, OX - 200, OZ - 150, OX + 200, OZ + 150, Y.L1)

  // ── a pista, e o peralte que é a peça ────────────────────────────────────
  // retas: planas, 190 m, uma de cada lado
  p.chao(COR.TERRACOTA, CX_L, PZ + RI, CX_R, PZ + RE, Y.L2)
  p.chao(COR.TERRACOTA, CX_L, PZ - RE, CX_R, PZ - RI, Y.L2)

  // curvas: 180° cada, com a borda externa subindo PERALTE
  const FAIXAS = 4, SEG = 36
  const curva = (cx: number, a0: number, a1: number) => {
    for (let k = 0; k < SEG; k++) {
      const u0 = k / SEG, u1 = (k + 1) / SEG
      const t0 = a0 + (a1 - a0) * u0, t1 = a0 + (a1 - a0) * u1
      const e0 = peralteEm(u0), e1 = peralteEm(u1)
      for (let f = 0; f < FAIXAS; f++) {
        const r0 = RI + ((RE - RI) * f) / FAIXAS, r1 = RI + ((RE - RI) * (f + 1)) / FAIXAS
        // altura da faixa: fração radial vezes o peralte daquele ponto do arco
        const h = (rr: number, ee: number) => Y.L2 + ((rr - RI) / LARG) * PERALTE * ee
        const Q = (rr: number, tt: number, ee: number) =>
          P(cx + Math.sin(tt) * rr, PZ - Math.cos(tt) * rr, h(rr, ee))
        p.quad(COR.TERRACOTA, Q(r0, t0, e0), Q(r0, t1, e1), Q(r1, t1, e1), Q(r1, t0, e0))
      }
      // ⚠️ A PAREDE EXTERNA PRECISA SER FECHADA. Sem esta face a pista peraltada
      // vira uma fita flutuando a 7 m do chão vista de fora, que foi o defeito da
      // primeira tentativa: por baixo dela aparecia a esplanada.
      const yTopo = (ee: number) => Y.L2 + PERALTE * ee
      const A0 = P(cx + Math.sin(t0) * RE, PZ - Math.cos(t0) * RE, yTopo(e0))
      const A1 = P(cx + Math.sin(t1) * RE, PZ - Math.cos(t1) * RE, yTopo(e1))
      const B0 = P(cx + Math.sin(t0) * RE, PZ - Math.cos(t0) * RE, Y.L1)
      const B1 = P(cx + Math.sin(t1) * RE, PZ - Math.cos(t1) * RE, Y.L1)
      p.quad(COR.CLARO, B0, B1, A1, A0)
    }
  }
  curva(CX_R, 0, Math.PI)                  // curva leste
  curva(CX_L, Math.PI, Math.PI * 2)        // curva oeste

  // ── o miolo é campo de treino, não jardim ────────────────────────────────
  p.chao(COR.VERDE, CX_L, PZ - RI, CX_R, PZ + RI, Y.L2)
  p.anel(COR.VERDE, CX_R, PZ, 0, RI, Y.L2, 0, Math.PI)
  p.anel(COR.VERDE, CX_L, PZ, 0, RI, Y.L2, Math.PI, Math.PI * 2)
  // a reta de aferição tem 165,4 m: é a distância exata em que o cão chega ao
  // pico, e é nela que o desempenho de um cão se mede
  p.chao(COR.ESCURO, OX - 82.7, PZ - 4, OX + 82.7, PZ + 4, Y.L3)
  // trilho da lebre, por dentro do bordo interno
  p.anel(COR.ESCURO, CX_R, PZ, RI - 2.2, RI - 0.6, Y.L3, 0, Math.PI)
  p.anel(COR.ESCURO, CX_L, PZ, RI - 2.2, RI - 0.6, Y.L3, Math.PI, Math.PI * 2)
  p.chao(COR.ESCURO, CX_L, PZ + RI - 2.2, CX_R, PZ + RI - 0.6, Y.L3)
  p.chao(COR.ESCURO, CX_L, PZ - RI + 0.6, CX_R, PZ - RI + 2.2, Y.L3)

  // ── a lâmina: o edifício, 190 × 40 em três níveis ────────────────────────
  // ⚠️ 190 m é a MEDIDA DA RETA, e a coincidência é o projeto: a horizontal do
  // prédio responde à inclinação do anel, e as duas têm o mesmo comprimento.
  const TZ = PZ + RE + 30            // 20 m de recuo da borda externa da pista
  // N1: a arquibancada, degraus voltados para a pista
  const DEG = 14, PISO = 1.6, ESPELHO = 0.46
  for (let i = 0; i < DEG; i++) {
    const z0 = TZ - 20 + i * PISO
    p.chao(COR.CLARO, OX - 95, z0, OX + 95, z0 + PISO, Y.L3 + i * ESPELHO)
  }
  // N0 e N2: o volume atrás da arquibancada, recuado no alto
  bloco(COR.CLARO, OX, TZ + 8, 190, 24, 0, 6.5)      // salão de apostas
  bloco(COR.CLARO, OX, TZ + 10, 190, 20, 6.5, 6.5)   // lounge e restaurante
  // a cobertura em balanço de 12 m sobre a arquibancada: a linha horizontal que
  // define a peça vista da pista
  bloco(COR.CLARO, OX, TZ - 4, 194, 52, 17.2, 0.8)

  // ── a torre do juiz, único elemento vertical, na linha de chegada ────────
  // a chegada fica no meio da reta principal, em frente ao centro da tribuna
  p.cilindro(COR.CLARO, OX, PZ + RE + 9, 5.5, 22, 12)

  // ── o paddock de exibição: é a peça que o jogo mais usa ──────────────────
  // 60 m de diâmetro, na ponta oeste da tribuna, junto à saída para as caixas.
  // Apostar é olhar o cão aqui antes da prova.
  const PDX = OX - 130, PDZ = TZ + 34
  p.disco(COR.CLARO, PDX, PDZ, 32, Y.L2)
  p.disco(COR.VERDE, PDX, PDZ, 30, Y.L3)
  p.guardaCorpo(Array.from({ length: 20 }, (_, i) => {
    const t = (i / 20) * Math.PI * 2
    return [PDX + Math.cos(t) * 31, PDZ + Math.sin(t) * 31] as [number, number]
  }), Y.L4)

  // ── canis, veterinário e pesagem: barra de serviço, sem cruzar o público ──
  bloco(COR.MEDIO, OX + 20, TZ + 52, 120, 25, 0, 9)
  p.chao(COR.CLARO, OX - 60, TZ + 40, OX + 20, TZ + 80, Y.L2)   // pátio de soltura

  // ── as duas caixas de largada, uma no início de cada reta ────────────────
  // ⚠️ SÃO DUAS PORQUE AS PROVAS SÃO DUAS e as duas terminam na mesma linha de
  // chegada: 600 m largando na reta de fundo, 1.100 m na reta principal.
  bloco(COR.MEDIO, CX_R - 3, PZ + RAIO, 3, LARG, 0, 2.2)
  bloco(COR.MEDIO, CX_L + 3, PZ - RAIO, 3, LARG, 0, 2.2)

  // ── o telão, na reta de fundo, virado para a tribuna ─────────────────────
  p.placar(OX, PZ - RE - 26, 40, 14, 0)

  // ── iluminação: quatro torres nas quinas da esplanada ────────────────────
  p.refletor(OX - 190, OZ - 140, 34)
  p.refletor(OX + 190, OZ - 140, 34)
  p.refletor(OX - 190, PZ + RE + 6, 34)
  p.refletor(OX + 190, PZ + RE + 6, 34)

  // ── arborização: fora do conjunto, nas duas bordas longas da parcela ─────
  p.alinhamento(-a + 20, -b + 20, a - 20, -b + 20, 14)
  p.alinhamento(-a + 20, b - 20, a - 20, b - 20, 14)
  // e a alameda de chegada do público, do lado curto da parcela até a tribuna
  p.alinhamento(OX + 210, OZ + 40, a - 40, OZ + 40, 16)

  return p.fechar()
}
