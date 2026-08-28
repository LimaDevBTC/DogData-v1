// Espelho em TypeScript do que as funções do banco devolvem (migrações 021–023).
// Os nomes são os mesmos do SQL de propósito: um campo que se chama `resumo`
// no Postgres e `summary` aqui é uma tradução a mais pra manter certa e um
// lugar a mais pra errar quando alguém for conferir um número.
//
// Quase tudo é anulável porque quase tudo pode não ter sido medido. Em
// particular `duracao_media_s` é null enquanto a janela só tem sessões
// reconstruídas do histórico — ver o comentário sobre engaged_ms na 021.

export interface Periodo { dias: number; de: string; ate: string }

export interface Resumo {
  visitantes: number
  sessoes: number
  pageviews: number
  /**
   * Quantas sessões da janela chegaram a ter identidade. É a base sobre a qual
   * `visitantes`, `novos` e `recorrentes` foram calculados — e enquanto ela for
   * pequena diante de `sessoes`, esses três números descrevem uma fatia do
   * período, não o período. A interface usa isto para decidir sozinha se já tem
   * base para liderar com visitante ou se ainda deve liderar com sessão.
   */
  sessoes_identificadas: number
  paginas_sessao: number | null
  sessoes_engajadas: number
  taxa_rejeicao: number | null
  /** Sobre quantas sessões as médias de duração abaixo foram tiradas. */
  sessoes_medidas: number
  duracao_media_s: number | null
  duracao_mediana_s: number | null
  rolagem_media: number | null
  novos: number
  recorrentes: number
}

export interface ResumoAnterior {
  visitantes: number
  sessoes: number
  pageviews: number
  sessoes_identificadas: number
  taxa_rejeicao: number | null
  duracao_media_s: number | null
}

/**
 * Um ponto da série temporal. O passo NÃO é fixo: janelas de até 2 dias vêm
 * por hora, acima disso por dia — e `Trafego.granularidade` diz qual foi usada.
 * Por isso o campo é `inicio` (timestamp do balde) e não `dia`: um objeto
 * chamado "dia" carregando hora seria a mesma classe de mentira que este painel
 * vem tirando de si mesmo a cada rodada.
 */
export interface PontoSerie {
  inicio: string
  sessoes: number
  /** null = nenhuma sessão daquele balde tinha identidade. NÃO é zero visitantes. */
  visitantes: number | null
  pageviews: number
  duracao_s: number | null
  rejeicao: number | null
}

export interface LinhaPais {
  pais: string
  sessoes: number
  /** null = sem identidade nesse recorte; ver DiaTrafego.visitantes. */
  visitantes: number | null
  pageviews: number
  duracao_s: number | null
}

export interface LinhaCanal {
  canal: string
  sessoes: number
  /** null = sem identidade nesse recorte; ver DiaTrafego.visitantes. */
  visitantes: number | null
  engajamento: number | null
  duracao_s: number | null
}

export interface Trafego {
  periodo: Periodo
  /** Passo da série: 'hora' em janelas de até 2 dias, 'dia' acima disso. */
  granularidade: 'hora' | 'dia'
  resumo: Resumo
  anterior: ResumoAnterior
  serie: PontoSerie[]
  paises: LinhaPais[]
  cidades: { cidade: string; pais: string; sessoes: number }[]
  canais: LinhaCanal[]
  origens: { origem: string; sessoes: number; engajamento: number | null }[]
  campanhas: { campanha: string; origem: string | null; meio: string | null; sessoes: number; visitantes: number }[]
  paginas: { pagina: string; views: number; visitantes: number }[]
  dispositivos: Record<string, number>
  navegadores: { navegador: string; sessoes: number }[]
  sistemas: { so: string; sessoes: number }[]
  idiomas: { idioma: string; sessoes: number }[]
  telas: { faixa: string; sessoes: number }[]
  agora: { minutos_atras: number; views: number; visitantes: number }[]
  /** O que foi barrado, e por quê. Aparece no painel em vez de sumir dele. */
  robos: { sessoes_robo: number; por_motivo: Record<string, number> }
}

export interface PaginaComportamento {
  pagina: string
  views: number
  visitantes: number
  sessoes: number
  tempo_mediano_s: number
  tempo_medio_s: number
  rolagem_media: number
  /** Quantos eventos de engajamento sustentam os tempos acima. 0 = não medido. */
  amostras_tempo: number
  saidas: number
  taxa_saida: number | null
}

export interface Comportamento {
  periodo: Periodo
  paginas: PaginaComportamento[]
  entradas: { pagina: string; sessoes: number; rejeicao: number | null }[]
  saidas: { pagina: string; sessoes: number }[]
  eventos: { evento: string; total: number; visitantes: number; sessoes: number }[]
  caminhos: { de: string; para: string; n: number }[]
}

export interface Vital {
  p75: number
  media: number
  amostras: number
  nota: number
  pct_bom: number
  pct_medio: number
  pct_ruim: number
  estado: 'bom' | 'medio' | 'ruim'
}

export interface Vitais {
  periodo: Periodo
  metricas: Record<string, Vital>
  nota_geral: number | null
  por_dia: { dia: string; nome: string; p75: number }[]
  por_dispositivo: { dispositivo: string; nome: string; p75: number; amostras: number }[]
  paginas_lentas: { nome: string; paginas: { pagina: string; p75: number; amostras: number }[] }[]
}

export interface Funil {
  periodo: Periodo
  etapas: { etapa: string; n: number }[]
  doacoes: {
    doacoes: number
    doadores: number
    total_dog: number
    ticket_mediano: number
    cruzaram_10k: number
  }
  atribuicao: {
    atribuidas: number
    sem_atribuicao: number
    dog_atribuido: number
    dog_sem_atribuicao: number
  }
  por_canal: { canal: string; doadores: number; dog: number }[]
  tempo_ate_doar: { amostras: number; horas_mediana: number | null }
}

/**
 * O balde "Direto" aberto por página de entrada. Não atribui origem: mostra a
 * FORMA do tráfego sem referrer, porque link com rel="noreferrer" — o caso do
 * CoinMarketCap, que lista o DogData como explorer da DOG — chega
 * indistinguível de quem digitou o domínio.
 */
export interface LinhaDireto {
  pagina: string
  sessoes: number
  rejeicao: number | null
  paginas_sessao: number | null
  duracao_s: number | null
  profundidade: number
}

// A rota devolve os cinco em paralelo. Qualquer um pode vir null: uma função
// que falhe custa UMA aba, não a página inteira.
export interface Relatorio {
  trafego: Trafego | null
  comportamento: Comportamento | null
  vitais: Vitais | null
  funil: Funil | null
  direto: LinhaDireto[] | null
  error?: string
}

// ── Ads: inalterado, a aba continua consumindo /api/ads/report ─────────────
export interface AdsReport {
  advertiser: string
  period: { days: number; from: string; to: string }
  summary: { impressions: number; clicks: number; ctr: string }
  by_page: Record<string, { impressions: number; clicks: number }>
  by_device: Record<string, { impressions: number; clicks: number }>
  by_day: Record<string, { impressions: number; clicks: number }>
}
