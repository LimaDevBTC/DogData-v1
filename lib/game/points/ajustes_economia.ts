// CÓPIA do jogo (dogcity-mundo @ 27dc4fa83, 15/11/2026), como src/economia/README.md pede: as regras puras dos DC Points
// repetidas no servidor, com teste de igualdade (lib/game/points/igualdade.test.ts). NÃO editar aqui sozinho: mudou no jogo,
// copia de novo e o teste confere. Adaptações mínimas, sem mudar uma conta: imports sem a extensão .ts e
// Object.hasOwn(o, k) escrito como Object.prototype.hasOwnProperty.call(o, k) (o tsconfig do DogData é ES2020).
//
// Origem: src/economia/ajustes_economia.ts

// Numeros de partida da economia (T07, #178; plano/PLANO_ECONOMIA_CIDADE.md, secao 2.6 e decisoes 1, 5 e 7 da secao 6).
// Dado puro, sem import: as regras puras (regras_preco.ts, regras_saldo.ts) recebem este objeto por parametro e os
// testes (testes/economia/) importam o arquivo direto no Node. Os numeros sao de partida, para o fundador mexer "no
// feeling" (regra 5 da secao 0); as estimativas por atividade estao marcadas "a medir" no README.md desta pasta.
//
// A ancora de valor (comentario da banca na #178): 1 DC Point vale cerca de 1 minuto de esforco casual. Todo preco base
// do catalogo (src/inventario/catalogo_itens.ts, precoBase) e toda taxa por hora derivam disso: um item de 6 pontos
// custa uns 6 minutos de jogo casual, e nenhuma atividade paga mais de 1,5x a que paga menos, senao ela vira o unico
// conteudo jogado.
//
// Teto diario: DC Points nao inflacionam (os precos sao formula, os pontos sao intransferiveis), mas acumulam. O teto de
// recebimento por carteira e por dia e' o freio contra farm (o mesmo principio do pote dos drops): 8 horas de esforco
// casual. O dia vira as 08:00 UTC (NECESSIDADES.viradaUtcHoras, src/jogador/ajustes_necessidades.ts), nunca aqui.

export const ECONOMIA = {
  /** a ancora: minutos de esforco casual que valem 1 DC Point */
  minutosPorPonto: 1,
  /** pontos por hora de esforco casual que a ancora da' (60 / minutosPorPonto) */
  pontosPorHoraCasual: 60,
  /** a atividade que mais paga por hora nunca passa deste tanto da que menos paga (comentario da banca na #178) */
  desvioMaximoAtividades: 1.5,
  /**
   * DC Points por hora por atividade: estimativas de partida, A MEDIR com a telemetria de cada cadeia (T09, T11, T12,
   * T13, T25, T27). O teste testes/economia/ajustes_economia.test.ts guarda o desvio de 1,5x entre a maior e a menor.
   * O turno da fazenda (T11) deriva da venda real; o numero aqui e' a meta que a fazenda tem de honrar.
   */
  pontosPorHora: {
    turno: 50,
    pescar: 60,
    cortar: 60,
    cacar: 65,
    minerar: 70,
    domar: 75,
  },
  /** teto de DC Points RECEBIDOS por carteira por dia do jogo, todas as fontes somadas (8 h de esforco casual) */
  tetoDiarioRecebido: 480,
  /** teto absoluto de um credito ou debito (um valor acima disto e' erro ou ataque, nunca uma venda) */
  valorMaximoPorOperacao: 10_000,
  /** teto absoluto do saldo (tambem contra estado salvo inflado) */
  saldoMaximo: 1_000_000,
  /** a recompensa fixa da missao "Verified", igual para todo mundo (decisao 7 de 29/10); T16 paga, aqui so' o numero */
  recompensaVerified: 30,
  /** a demanda do dia fica entre 1 - amplitude e 1 + amplitude (25%: o jogador percebe, mas nao vira loteria) */
  amplitudeDemanda: 0.25,
  /** a escassez (estoque por regiao, T09 e T21) e' aceita nesta faixa; fora dela, ou nao finita, vale 1 */
  escassezMin: 0.5,
  escassezMax: 3,
  /** teto absoluto do preco do dia de um item, em DC Points */
  precoMaximo: 100_000,
  /** preco base por categoria, para o item que ainda nao tem precoBase (0 = a categoria nao se negocia) */
  precoBasePorCategoria: {
    Food: 3,
    Drink: 2,
    Fuel: 15,
    Tools: 40,
    Materials: 5,
    Documents: 0,
    Keys: 0,
    Cosmetics: 10,
  },
  /**
   * O mercado central (o painel MARKET) no ensaio da Fase 0, antes de T04 e T10 registrarem os pontos de troca com as
   * listas deles (src/sustento/pontos.ts, `vende` e `compra`): o que ele vende (carne e garrafa de agua pagas sao o sumidouro
   * diario; a nascente so' ENCHE garrafas vazias) e o que ele compra ao preco do dia (o que as cadeias produzem).
   */
  mercado: {
    vende: ['garrafa_agua', 'carne', 'galao', 'vara', 'rede', 'covo', 'machado', 'picareta'],
    compra: ['peixe_cru', 'peixe_assado', 'carne_caca', 'ave', 'ave_caca', 'javali', 'mirtilo', 'melancia', 'tora', 'tabua', 'minerio', 'lingote'],
  },
  /** gravar no localStorage no maximo a cada tanto (e no pagehide) */
  gravarCadaMs: 5000,
} as const;

export type AjustesEconomia = typeof ECONOMIA;
