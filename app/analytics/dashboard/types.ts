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

export interface DiaTrafego {
  dia: string
  sessoes: number
  /** null = nenhuma sessão daquele dia tinha identidade. NÃO é zero visitantes. */
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
  resumo: Resumo
  anterior: ResumoAnterior
  por_dia: DiaTrafego[]
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

// A rota devolve os quatro em paralelo. Qualquer um pode vir null: uma função
// que falhe custa UMA aba, não a página inteira.
export interface Relatorio {
  trafego: Trafego | null
  comportamento: Comportamento | null
  vitais: Vitais | null
  funil: Funil | null
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
