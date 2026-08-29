// ═══════════════════════════════════════════════════════════════════════════
// E01 · PARQUE OLIMPICO — a peca principal da cidade, a que prova o padrao.
//
// Parcela 1080 x 1080 m (a = b = 540), 116,6 ha. A composicao e a malha de
// 180 m da cidade dobrada: nove parcelas de 360 x 360 m em grade 3x3, com uma
// cruz de esplanadas de 90 m de largura cruzando no meio (o eixo civico que
// leva o publico de um equipamento a outro). Verde de fundo cobre tudo antes.
//
// Centro das nove parcelas em (i*360, j*360), i,j em -1,0,1:
//   (-360,-360) Estadio Olimpico      (+360,-360) Centro Aquatico
//   (   0,-360) Quadras de tenis      (-360,   0) Skatepark e quadras urbanas
//   (   0,   0) Praca das Medalhas    (+360,   0) Ginasio e pavilhao
//   (-360,+360) Velodromo             (+360,+360) Arena coberta
//   (   0,+360) Campo de aquecimento
// ═══════════════════════════════════════════════════════════════════════════
import { Prancheta, COR, Y, type Ctx, type Desenho } from './kit'

export function desenhar(c: Ctx): Desenho {
  const p = new Prancheta(c)
  const { a, b } = c
  p.moldura()

  // verde de fundo cobrindo a parcela toda, respeitando a borda de 6 m da via
  p.chao(COR.VERDE, -(a - 6), -(b - 6), a - 6, b - 6, Y.PARCELA)

  // cruz de esplanadas, 90 m de largura, cruzando no centro
  const LARG = 90
  p.chao(COR.CLARO, -(a - 6), -LARG / 2, a - 6, LARG / 2, Y.L1)   // braco horizontal
  p.chao(COR.CLARO, -LARG / 2, -(b - 6), LARG / 2, b - 6, Y.L1)   // braco vertical

  // ── (-360,-360) ESTADIO OLIMPICO ─────────────────────────────────────────
  // arquibancada oval de 30 degraus, raio 150 a 190, 42 m de altura (estadio
  // de porte grande, algo como 60 mil lugares em bacia continua); alongar
  // 1.18 estica o eixo x para dar a forma oval classica de estadio.
  // pista de atletismo real em esc 1.55 (raia 1 com R=56,6 m, S=130,8 m) cabe
  // dentro do raio interno de 150 m com folga de campo.
  {
    const cx = -360, cz = -360
    p.arquibancada(COR.CLARO, cx, cz, 150, 190, 30, 42, 0, Math.PI * 2, 1.18)
    p.pista400(cx, cz, 1.55)
  }

  // ── (+360,-360) CENTRO AQUATICO ──────────────────────────────────────────
  // laje civica 250 x 170, volume fechado (a nave do centro aquatico) de
  // 22 m de pe direito cobrindo 230 x 150, e tres laminas d'agua sobre a
  // laje: piscina olimpica 50 x 25 (medida real, 10 raias), e duas piscinas
  // menores de 25 x 20 para salto e para aquecimento/reabilitacao.
  {
    const cx = 360, cz = -360
    p.chao(COR.CLARO, cx - 125, cz - 85, cx + 125, cz + 85, Y.L1)
    p.vol(COR.CLARO, cx, cz, 230, 22, 150)
    p.chao(COR.AGUA, cx - 25, cz - 45, cx + 25, cz - 20, Y.L4, true)   // olimpica 50x25
    p.chao(COR.AGUA, cx - 55, cz + 10, cx - 30, cz + 30, Y.L4, true)   // salto 25x20
    p.chao(COR.AGUA, cx + 30, cz + 10, cx + 55, cz + 30, Y.L4, true)   // aquecimento 25x20
  }

  // ── (-360,+360) VELODROMO ────────────────────────────────────────────────
  // pista de 250 m inclinada: vista de cima e um anel de raio 78 a 118.
  // miolo civico ate 78 m, e um anel de arquibancada externo de 12 degraus,
  // raio 120 a 145, 16 m de altura (velodromo e menor que estadio de atletismo).
  {
    const cx = -360, cz = 360
    p.anel(COR.TERRACOTA, cx, cz, 78, 118, Y.L1)
    p.disco(COR.CLARO, cx, cz, 78, Y.L2)
    p.arquibancada(COR.CLARO, cx, cz, 120, 145, 12, 16)
  }

  // ── (+360,+360) ARENA COBERTA ─────────────────────────────────────────────
  // volume unico 280 x 236 de 28 m (arena multiuso, ginastica/boxe/final de
  // handebol), com adro de 300 x 60 virado para a esplanada vertical (lado
  // x negativo, de frente para o cruzamento das esplanadas).
  {
    const cx = 360, cz = 360
    p.vol(COR.CLARO, cx, cz, 280, 28, 236)
    p.chao(COR.CLARO, cx - 150, cz - 30, cx - 150 + 60, cz + 30, Y.L1)
  }

  // ── (0,-360) QUADRAS DE TENIS ─────────────────────────────────────────────
  // laje verde 280 x 200. doze quadras de saibro 36 x 18 m (medida real de
  // quadra de tenis com recuo de fundo e lateral) em grade 4 colunas x 3
  // linhas, espacamento 66 x 62 (folga de circulacao entre quadras). mais
  // uma quadra central maior, 44 x 24, com arquibancada pequena de 8 degraus
  // (a quadra central, tipo estadio, para as finais).
  {
    const cx = 0, cz = -360
    p.chao(COR.VERDE, cx - 140, cz - 100, cx + 140, cz + 100, Y.L1)
    const QX = 36, QZ = 18, EX = 66, EZ = 62
    for (let col = 0; col < 4; col++) {
      for (let lin = 0; lin < 3; lin++) {
        const qx = cx + (col - 1.5) * EX
        const qz = cz + (lin - 1) * EZ
        p.chao(COR.TERRACOTA, qx - QX / 2, qz - QZ / 2, qx + QX / 2, qz + QZ / 2, Y.L2)
      }
    }
    // quadra central maior com arquibancada em volta
    p.chao(COR.TERRACOTA, cx - 22, cz - 12, cx + 22, cz + 12, Y.L3)
    p.arquibancada(COR.CLARO, cx, cz, 30, 42, 8, 8)
  }

  // ── (0,+360) CAMPO DE AQUECIMENTO ─────────────────────────────────────────
  // pista de atletismo secundaria, esc 1.2, sem arquibancada: apoio de
  // treino para o estadio principal.
  {
    p.pista400(0, 360, 1.2)
  }

  // ── (-360,0) SKATEPARK E QUADRAS URBANAS ─────────────────────────────────
  // laje escura 230 x 250 (piso de concreto do skatepark). tres bowls, discos
  // claros de raios 34, 24 e 30 m em posicoes diferentes (variedade de porte,
  // como um parque de skate de verdade tem pistas de tamanhos distintos).
  // duas quadras de basquete de rua, 28 x 15 m (medida de meia-quadra
  // ampliada para jogo de rua), lado a lado.
  {
    const cx = -360, cz = 0
    p.chao(COR.ESCURO, cx - 115, cz - 125, cx + 115, cz + 125, Y.L1)
    p.disco(COR.CLARO, cx - 60, cz - 70, 34, Y.L2)
    p.disco(COR.CLARO, cx + 50, cz - 60, 24, Y.L2)
    p.disco(COR.CLARO, cx - 10, cz + 60, 30, Y.L2)
    p.chao(COR.TERRACOTA, cx - 75, cz + 5, cx - 47, cz + 20, Y.L2)
    p.chao(COR.TERRACOTA, cx + 40, cz + 5, cx + 68, cz + 20, Y.L2)
  }

  // ── (+360,0) GINASIO E PAVILHAO ───────────────────────────────────────────
  // dois volumes: ginasio principal 236 x 132 de 18 m (basquete/volei/futsal
  // indoor), e pavilhao menor 120 x 90 de 12 m (lutas e modalidades menores),
  // separados por um patio civico.
  {
    const cx = 360, cz = 0
    p.vol(COR.CLARO, cx - 55, cz - 40, 236, 18, 132)
    p.vol(COR.CLARO, cx + 70, cz + 70, 120, 12, 90)
    p.chao(COR.CLARO, cx - 55 - 40, cz + 40, cx + 70 - 20, cz + 100, Y.L1)
  }

  // ── (0,0) PRACA DAS MEDALHAS ──────────────────────────────────────────────
  // disco civico de raio 120, espelho d'agua de raio 64 no centro, e o
  // pebeteiro: cilindro de raio 6 e 24 m de altura, o marco vertical da peca
  // inteira, visivel do alto de toda a cidade.
  {
    p.disco(COR.CLARO, 0, 0, 120, Y.L2)
    p.disco(COR.AGUA, 0, 0, 64, Y.L4, true)
    p.cilindro(COR.MEDIO, 0, 0, 6, 24)
  }

  // ── ARBORIZACAO ───────────────────────────────────────────────────────────
  // fileiras de arvores nas quatro bordas das duas esplanadas, passo 12 m
  // (alameda arborizada classica), e um anel de 24 covas de raio 150 em
  // volta da Praca das Medalhas (a coroa de arvores da praca central).
  {
    const A = a - 6, B = b - 6
    // bordas da esplanada horizontal (z = +-45)
    p.alinhamento(-A, -LARG / 2, A, -LARG / 2, 12)
    p.alinhamento(-A, LARG / 2, A, LARG / 2, 12)
    // bordas da esplanada vertical (x = +-45)
    p.alinhamento(-LARG / 2, -B, -LARG / 2, B, 12)
    p.alinhamento(LARG / 2, -B, LARG / 2, B, 12)
    // anel de 24 covas em volta da Praca das Medalhas
    const N = 24, R = 150
    for (let k = 0; k < N; k++) {
      const ang = (k / N) * Math.PI * 2
      p.cova(Math.sin(ang) * R, -Math.cos(ang) * R)
    }
  }

  // ── MOBILIARIO VERTICAL ────────────────────────────────────────────────────

  // ESTADIO: 4 refletores de 46 m nos cantos do bowl
  {
    const cx = -360, cz = -360
    const offset = 168  // raio interno da arquibancada
    // 46 m: altura real de torre de iluminacao de estadio grande
    p.refletor(cx - offset, cz - offset, 46)
    p.refletor(cx + offset, cz - offset, 46)
    p.refletor(cx - offset, cz + offset, 46)
    p.refletor(cx + offset, cz + offset, 46)
    // cobertura da arquibancada: raios 168 (interno) e 196 (externo), altura 46 m
    p.cobertura(cx, cz, 168, 196, 46, 0, Math.PI * 2, COR.CLARO, 1.18)
  }

  // VELODROMO: cobertura de 20 m sobre o anel de ciclismo
  {
    const cx = -360, cz = 360
    // raios 118 (interno) a 148 (externo), altura 20 m de cobertura leve
    p.cobertura(cx, cz, 118, 148, 20)
  }

  // ARENA: 2 mastros de 30 m ladeando o adro
  {
    const cx = 360, cz = 360
    // 30 m: mastros laterais para identidade visual de arena coberta
    p.mastro(cx - 130, cz - 30, 30)
    p.mastro(cx - 130, cz + 30, 30)
  }

  // CAMPO DE AQUECIMENTO: 4 refletores de 30 m nos cantos
  {
    const cx = 0, cz = 360
    const ox = 120, oz = 90  // offset dos cantos da pista de treino
    // 30 m: refletores menores que no estadio principal (treino, nao competicao)
    p.refletor(cx - ox, cz - oz, 30)
    p.refletor(cx + ox, cz - oz, 30)
    p.refletor(cx - ox, cz + oz, 30)
    p.refletor(cx + ox, cz + oz, 30)
  }

  // QUADRAS DE TENIS: postes nas duas bordas longas, passo 44 m, altura 12 m
  {
    const cx = 0, cz = -360
    const larg = 280  // comprimento da laje (eixo x)
    // 12 m: altura de cobertura lateral para protecao de jogo em quadra
    p.postes(cx - larg / 2, cz - 100, cx + larg / 2, cz - 100, 44, 12)
    p.postes(cx - larg / 2, cz + 100, cx + larg / 2, cz + 100, 44, 12)
  }

  // ESPLANADAS: 4 filas de postes ao longo dos bracos da cruz, passo 60 m, altura 11 m
  {
    const A = a - 6  // 534 m: limite interno da parcela (menos borda de 6 m)
    // 11 m: iluminacao de esplanada civica, intermetiaria entre passeio e estrutura
    // as filas estao offset (+/-20) das arvores que ocupam o eixo central (+/-45)
    // braco horizontal
    p.postes(-A, 20, A, 20, 60, 11)   // acima do eixo x
    p.postes(-A, -20, A, -20, 60, 11)  // abaixo do eixo x
    // braco vertical
    p.postes(-20, -A, -20, A, 60, 11)  // esquerda do eixo z
    p.postes(20, -A, 20, A, 60, 11)   // direita do eixo z
  }

  // PRACA DAS MEDALHAS: 8 mastros de 18 m em anel de raio 96
  {
    const R = 96  // raio do anel de mastros
    const N = 8   // numero de mastros (8, um por direcao cardinais + intermediarias)
    // 18 m: marco vertical de identidade local (maior que guarda-corpo, menor que arena)
    for (let k = 0; k < N; k++) {
      const ang = (k / N) * Math.PI * 2
      p.mastro(Math.sin(ang) * R, -Math.cos(ang) * R, 18)
    }
  }

  // PRACA DAS MEDALHAS: guarda-corpo em anel de raio 120 com 24 montantes
  {
    const R = 120  // raio do anel de guarda-corpo
    const N = 24   // numero de pontos do circulo (24 = 15 graus cada)
    const pts: [number, number][] = []
    for (let k = 0; k < N; k++) {
      const ang = (k / N) * Math.PI * 2
      pts.push([Math.sin(ang) * R, -Math.cos(ang) * R])
    }
    // 1.2 m: altura padrao de guarda-corpo de seguranca em praca publica
    p.guardaCorpo(pts, 1.2, COR.CLARO)
  }

  return p.fechar()
}
