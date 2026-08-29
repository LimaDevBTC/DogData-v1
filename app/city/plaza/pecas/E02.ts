// E02 Hipodromo
// Parcela de 1080 x 540 m (58,3 ha), referencia de tamanho e o Hipodromo de
// Longchamp em Paris, que tem 57 ha de area total.
//
// Composicao: fundo de grama cobrindo toda a parcela. Por cima, uma pista de
// corrida de areia em formato oval (eixo maior 900 m, eixo menor 400 m,
// largura de pista 20 m), montada com duas retas paralelas (as retas de
// chegada e de fundo) e dois arcos de meia volta nas curvas, exatamente como
// um hipodromo de verdade e desenhado. Dentro do oval, um segundo oval mais
// estreito serve de pista de treino, e no miolo ha um gramado com um lago
// ornamental, presenca quase obrigatoria em hipodromos classicos.
// Do lado de fora da reta principal fica a arquibancada (24 degraus corridos
// de 460 m), e ao lado dela o paddock com quatro cavalarices. Na reta oposta
// um placar eletronico marca o andamento da prova. Arvores acompanham as
// duas bordas longas da parcela.
import { Prancheta, COR, Y, type Ctx, type Desenho } from './kit'

export function desenhar(c: Ctx): Desenho {
  const p = new Prancheta(c)
  const { a, b } = c

  p.moldura()

  // Fundo verde cobrindo toda a parcela.
  p.chao(COR.VERDE, -a + 6, -b + 6, a - 6, b - 6, Y.PARCELA)

  // ----- Pista principal de areia -----
  // Retas: 460 m de comprimento, 20 m de largura, nas linhas z = -200 e z = +200.
  p.chao(COR.TERRACOTA, -230, -210, 230, -190, Y.L1)
  p.chao(COR.TERRACOTA, -230, 190, 230, 210, Y.L1)
  // Curvas: arcos de meia volta, raio interno 190, raio externo 210,
  // centrados nas pontas das retas (+-230, 0).
  // Curva direita (x = +230): do angulo 0 (aponta -z) ate PI (aponta +z),
  // passando por +x, isto e a volta pelo lado de fora em x positivo.
  p.anel(COR.TERRACOTA, 230, 0, 190, 210, Y.L1, 0, Math.PI)
  // Curva esquerda (x = -230): completa a volta do lado de x negativo.
  p.anel(COR.TERRACOTA, -230, 0, 190, 210, Y.L1, Math.PI, Math.PI * 2)

  // ----- Pista de treino -----
  // Oval mais estreito (12 m), 60 m por dentro da pista principal.
  // Pista principal: raio interno efetivo 190 nas curvas.
  // Pista de treino fica encostada 60 m para dentro: raio externo 130, raio interno 118.
  p.chao(COR.ESCURO, -230, -136, 230, -124, Y.L2)
  p.chao(COR.ESCURO, -230, 124, 230, 136, Y.L2)
  p.anel(COR.ESCURO, 230, 0, 118, 130, Y.L2, 0, Math.PI)
  p.anel(COR.ESCURO, -230, 0, 118, 130, Y.L2, Math.PI, Math.PI * 2)

  // ----- Miolo -----
  // Gramado interno da pista de treino.
  p.disco(COR.VERDE, 0, 0, 116, Y.L2)
  // Lago ornamental oval, 120 x 50 m, presenca classica de hipodromo.
  p.oval(COR.AGUA, 0, 0, 60, 25, Y.L4, true)

  // ----- Arquibancada -----
  // Na reta de baixo (z = +200), do lado de fora da pista (z > 210).
  // 24 degraus retos de 460 x 2,2 m, cada um 1,4 m mais alto, comecando em
  // z = 215 e recuando 2,2 m por degrau (isto e, cada degrau mais afastado
  // fica mais alto, como uma arquibancada normal).
  const DEGRAUS = 24
  const LARG_DEGRAU = 2.2
  const ALT_DEGRAU = 1.4
  for (let i = 0; i < DEGRAUS; i++) {
    const z0 = 215 + i * LARG_DEGRAU
    const z1 = z0 + LARG_DEGRAU
    const yDegrau = Y.L1 + i * ALT_DEGRAU
    p.chao(COR.CLARO, -230, z0, 230, z1, yDegrau)
  }

  // ----- Paddock e cavalarices -----
  // Patio a esquerda da arquibancada, 200 x 90 m, na mesma faixa externa.
  const paddockCx = -230 - 100 - 20 // desloca o patio para a esquerda da pista e da arquibancada
  p.chao(COR.CLARO, paddockCx - 100, 220, paddockCx + 100, 310, Y.L1)
  // Quatro baias de 90 x 18 m, 9 m de altura, enfileiradas dentro do patio.
  const nBaias = 4
  const espBaia = 20
  const inicioZ = 228
  for (let i = 0; i < nBaias; i++) {
    p.vol(COR.MEDIO, paddockCx, inicioZ + i * espBaia, 90, 9, 18)
  }

  // ----- Placar -----
  // Volume de 40 x 6 m, 14 m de altura, na reta de cima (fora da pista, z < -210).
  p.vol(COR.MEDIO, 0, -235, 40, 14, 6)

  // ----- Arborizacao -----
  // Fileiras de arvores acompanhando as duas bordas longas da parcela.
  p.alinhamento(-a + 20, -b + 20, a - 20, -b + 20, 14)
  p.alinhamento(-a + 20, b - 20, a - 20, b - 20, 14)

  // ----- Cobertura da arquibancada -----
  // Arco que cobre a reta de baixo da arquibancada, 26 m de altura,
  // com arco de 2π*0.72 a 2π*1.28 (cobre o espectador em cota alta).
  p.cobertura(0, 470, 250, 276, 26, Math.PI * 0.72, Math.PI * 1.28)

  // ----- Refletores -----
  // Torres de iluminacao de 34 m de altura (padrao de estadio grande).
  // Posicionadas nos quatro cantos (±300, ±230) e dois na reta de cima (0, ±235).
  // 34 m e a altura real de refletor de estadio grande para cobertura completa.
  p.refletor(300, 230, 34)
  p.refletor(-300, 230, 34)
  p.refletor(300, -230, 34)
  p.refletor(-300, -230, 34)
  p.refletor(0, 235, 34)
  p.refletor(0, -235, 34)

  // ----- Guarda-corpo -----
  // Acompanha a raia externa do oval, 24 pontos distribuidos ao redor
  // da pista (8 na reta de cima, 5 na curva direita, 7 na reta de baixo, 4 na curva esquerda).
  // Altura de corrimao padrao: 0.66 m (Y.L4).
  const pontosGuardaCorpo: [number, number][] = [
    [-230, -210], [-160, -210], [-90, -210], [-20, -210], [20, -210], [90, -210], [160, -210], [230, -210],
    [305, -170], [320, -70], [320, 70], [305, 170], [230, 210],
    [160, 210], [90, 210], [20, 210], [-20, 210], [-90, 210], [-160, 210], [-230, 210],
    [-305, 170], [-320, 70], [-320, -70], [-305, -170],
  ]
  p.guardaCorpo(pontosGuardaCorpo, Y.L4)

  // ----- Placar eletronico -----
  // Painel de 40 m de largura, 14 m de altura, na reta de cima (z < -210).
  // Giro 0 = frontal, enxerga os cavalos chegando na reta.
  p.placar(0, -215, 40, 14, 0)

  // ----- Postes de servico -----
  // Fila de postes no paddock: de (-320, +120) a (-120, +120), passo 40 m.
  // 6 postes totais, altura padrao de 9 m (iluminacao de patio).
  p.postes(-320, 120, -120, 120, 40)

  // ----- Mastro de chegada -----
  // Mastro fino de 16 m em (230, 200), marco da linha de chegada.
  // 16 m permite bandeira grande e visibilidade da meta.
  p.mastro(230, 200, 16)

  return p.fechar()
}
