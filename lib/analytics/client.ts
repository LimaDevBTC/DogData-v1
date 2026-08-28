// ═══════════════════════════════════════════════════════════════════════════
// Analytics do DogData — o lado do navegador.
//
// Separado do componente de propósito: qualquer parte do site precisa poder
// marcar um evento (`track('donate_address_copied')`) sem montar um provider
// nem importar React. A identidade e a sessão vivem aqui, em uma cópia só, e
// o componente em components/analytics-tracker.tsx só liga os fios do ciclo
// de vida da rota nelas.
// ═══════════════════════════════════════════════════════════════════════════

const VISITOR_KEY = 'dog_vid'
const SESSION_KEY = 'dog_sid'
const SESSION_TS = 'dog_sid_ts'
const OPTOUT_KEY = 'dog_analytics_off'

// Meia hora parado encerra a sessão. É o corte que a indústria usa e é também
// a correção estrutural do bug medido em 27/08: com sessão presa ao tempo de
// vida da aba, um navegador deixado aberto virava uma "sessão" de 2h32 e a
// média de permanência do site inteiro subia para 9.132 segundos.
const SESSION_TIMEOUT_MS = 30 * 60 * 1000

// Rotas que o site mede mas não conta. O painel interno é a primeira: quem
// mais o abre é o fundador, e cada consulta ao próprio dashboard entrava na
// audiência como visita real, engordando justamente o número usado pra decidir.
const NAO_MEDIR = [/^\/analytics(\/|$)/, /^\/api(\/|$)/]

export function medirEstaRota(path: string): boolean {
  return !NAO_MEDIR.some((re) => re.test(path))
}

// ── consentimento e desligamento ───────────────────────────────────────────
// Sem cookie, sem banner: um interruptor local. Serve pro fundador tirar a
// própria navegação da conta (`localStorage.dog_analytics_off = '1'`) e serve
// como resposta honesta a quem não quer ser medido.
export function estaDesligado(): boolean {
  try {
    if (localStorage.getItem(OPTOUT_KEY) === '1') return true
    // Do Not Track e Global Privacy Control são respeitados. Custa uma linha.
    const nav = navigator as Navigator & { globalPrivacyControl?: boolean; doNotTrack?: string }
    if (nav.globalPrivacyControl === true) return true
    if (nav.doNotTrack === '1') return true
    return false
  } catch {
    return false
  }
}

function uuid(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  }
}

// ── identidade ─────────────────────────────────────────────────────────────
// UUID anônimo no localStorage. Não é cookie, não vai em header nenhum, não
// sai do domínio e não carrega nada que identifique uma pessoa. É só o que
// permite dizer "esses 40 pageviews são de uma pessoa, não de quarenta".
//
// Devolve null quando o storage não está disponível (aba anônima com storage
// bloqueado, navegador travado). Nesse caso o evento é gravado sem visitante:
// o pageview conta, o visitante único não — que é a verdade, e é melhor que
// inventar um id novo a cada batida e inflar o total de únicos.
export function visitorId(): string | null {
  try {
    let id = localStorage.getItem(VISITOR_KEY)
    if (!id) {
      id = uuid()
      localStorage.setItem(VISITOR_KEY, id)
    }
    return id
  } catch {
    return null
  }
}

// ── sessão ─────────────────────────────────────────────────────────────────
// sessionStorage guarda o id, mas quem manda é o carimbo de atividade: passou
// meia hora sem nada, a próxima batida abre sessão nova mesmo que a aba nunca
// tenha fechado.
export function sessionId(): string | null {
  try {
    const agora = Date.now()
    const anterior = Number(sessionStorage.getItem(SESSION_TS) || 0)
    let sid = sessionStorage.getItem(SESSION_KEY)
    if (!sid || !anterior || agora - anterior > SESSION_TIMEOUT_MS) {
      sid = uuid()
      sessionStorage.setItem(SESSION_KEY, sid)
    }
    sessionStorage.setItem(SESSION_TS, String(agora))
    return sid
  } catch {
    return null
  }
}

// ── contexto do cliente ────────────────────────────────────────────────────

// ⚠️ Esta função é RESERVA, não a fonte da verdade. Quem classifica navegador é
// `analytics_navegador()` no banco (migração 028), a partir do user-agent lido
// no servidor. Dois motivos: o UA do servidor não pode ser forjado por JS, e —
// o que mais pesa — uma regra em SQL consegue reclassificar o que já está
// gravado quando ela melhora, coisa que uma regra vivendo só no bundle nunca
// faz. Ela continua aqui para o caso de o header não chegar.
//
// A ordem espelha a do SQL de propósito, e a parte de app vem PRIMEIRO: o
// navegador embutido do X manda `Mobile/23G71 Twitter for iPhone/12.20` no
// iPhone (sem o token `Safari/`, o que caía em 'Other') e um UA com `Chrome/`
// no Android. Medido em 28/08: eram 622 eventos, 10% do tráfego limpo, o maior
// segmento único da audiência — escondido em dois baldes errados.
export function detectarNavegador(): string {
  if (typeof navigator === 'undefined') return 'unknown'
  const ua = navigator.userAgent
  // embutidos em app, antes dos normais
  if (/Twitter for iPhone|TwitterAndroid/i.test(ua)) return 'X (app)'
  if (/Instagram/i.test(ua)) return 'Instagram (app)'
  if (/FBAN|FBAV|FB_IAB/i.test(ua)) return 'Facebook (app)'
  if (/MicroMessenger/i.test(ua)) return 'WeChat (app)'
  if (/TikTok|BytedanceWebview|musical_ly/i.test(ua)) return 'TikTok (app)'
  if (/Snapchat/i.test(ua)) return 'Snapchat (app)'
  if (/LinkedInApp/i.test(ua)) return 'LinkedIn (app)'
  // navegadores
  if (/Edg\/|EdgiOS|EdgA\//.test(ua)) return 'Edge'
  if (/OPR\/|Opera|OPiOS/.test(ua)) return 'Opera'
  if (/SamsungBrowser/.test(ua)) return 'Samsung Internet'
  if (/Brave\//.test(ua)) return 'Brave'
  // Chrome no iOS se anuncia CriOS e CARREGA `Safari/`: sem esta linha antes da
  // do Safari, todo Chrome de iPhone era contado como Safari (454 eventos).
  if (/CriOS/.test(ua)) return 'Chrome'
  if (/FxiOS|Firefox\//.test(ua)) return 'Firefox'
  if (/Chrome\//.test(ua)) return 'Chrome'
  if (/Safari\//.test(ua)) return 'Safari'
  if (/AppleWebKit/.test(ua) && /Mobile\//.test(ua)) return 'WebView'
  return 'Outro'
}

export function detectarSO(): string {
  if (typeof navigator === 'undefined') return 'unknown'
  const ua = navigator.userAgent
  // iPadOS 13+ se anuncia como Mac. O desempate é o touch: Mac não tem.
  const tocaveis = (navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints ?? 0
  if (/iPhone|iPod/.test(ua)) return 'iOS'
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && tocaveis > 1)) return 'iPadOS'
  if (/Android/.test(ua)) return 'Android'
  if (/Windows/.test(ua)) return 'Windows'
  if (/Macintosh|Mac OS X/.test(ua)) return 'macOS'
  if (/CrOS/.test(ua)) return 'ChromeOS'
  if (/Linux/.test(ua)) return 'Linux'
  return 'Other'
}

export function detectarDispositivo(): 'mobile' | 'tablet' | 'desktop' {
  if (typeof navigator === 'undefined') return 'desktop'
  const ua = navigator.userAgent
  const so = detectarSO()
  if (so === 'iPadOS' || /Tablet|iPad/i.test(ua)) return 'tablet'
  // Android sem "Mobile" no UA é tablet — é a regra que o próprio Google publica.
  if (so === 'Android' && !/Mobile/.test(ua)) return 'tablet'
  if (/Mobi|Android|iPhone|iPod/i.test(ua)) return 'mobile'
  return 'desktop'
}

export function referrerExterno(): string {
  if (typeof document === 'undefined') return ''
  const ref = document.referrer
  if (!ref) return ''
  try {
    const url = new URL(ref)
    if (url.hostname === window.location.hostname) return ''
    return url.hostname
  } catch {
    return ref
  }
}

// ── UTM ────────────────────────────────────────────────────────────────────
// Lidos da URL e GUARDADOS na sessão. Sem isso, a campanha só existiria no
// primeiro pageview: o visitante clica em qualquer link interno, os parâmetros
// somem da barra de endereço, e a doação que acontecer três páginas depois
// aparece como tráfego direto. A campanha tem que sobreviver à navegação.
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const
type UtmKey = (typeof UTM_KEYS)[number]

export function lerUtm(): Partial<Record<UtmKey, string>> {
  const saida: Partial<Record<UtmKey, string>> = {}
  try {
    const q = new URLSearchParams(window.location.search)
    let achouNaUrl = false
    for (const k of UTM_KEYS) {
      const v = q.get(k)
      if (v) {
        saida[k] = v.slice(0, 120)
        achouNaUrl = true
      }
    }
    // Atalhos que as redes cravam sozinhas. Um clique de anúncio do Google
    // chega só com gclid; sem traduzir, ele seria contado como Referência.
    if (!achouNaUrl) {
      if (q.get('gclid')) { saida.utm_source = 'google'; saida.utm_medium = 'cpc'; achouNaUrl = true }
      else if (q.get('fbclid')) { saida.utm_source = 'facebook'; saida.utm_medium = 'paidsocial'; achouNaUrl = true }
      else if (q.get('twclid')) { saida.utm_source = 'x'; saida.utm_medium = 'paidsocial'; achouNaUrl = true }
      else if (q.get('ref')) { saida.utm_source = q.get('ref')!.slice(0, 120); achouNaUrl = true }
    }

    if (achouNaUrl) {
      sessionStorage.setItem('dog_utm', JSON.stringify(saida))
      return saida
    }
    const guardado = sessionStorage.getItem('dog_utm')
    return guardado ? JSON.parse(guardado) : {}
  } catch {
    return saida
  }
}

// ── envio ──────────────────────────────────────────────────────────────────

const ENDPOINT = '/api/analytics/track'

export interface Evento {
  event_type: 'pageview' | 'vital' | 'engagement' | 'event'
  page: string
  [k: string]: unknown
}

// `beacon` existe porque fetch NÃO sobrevive à página sendo fechada. O evento
// de saída — que é onde mora o tempo de permanência da última página, a mais
// importante da visita — só chega se for enfileirado pelo navegador antes do
// descarregamento. Um fetch normal ali é descartado e a métrica nasce morta.
export function enviar(evento: Evento, beacon = false): void {
  if (estaDesligado()) return
  const corpo = JSON.stringify(evento)
  try {
    if (beacon && typeof navigator !== 'undefined' && navigator.sendBeacon) {
      navigator.sendBeacon(ENDPOINT, new Blob([corpo], { type: 'application/json' }))
      return
    }
    void fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: corpo,
      keepalive: true,
    }).catch(() => {})
  } catch {
    /* silencioso: telemetria nunca pode derrubar a página que ela mede */
  }
}

// Campos que todo evento carrega. Montados na hora do envio e não uma vez no
// começo, porque viewport muda com rotação de tela e redimensionamento.
export function contextoBase(page: string) {
  return {
    page,
    session_id: sessionId(),
    visitor_id: visitorId(),
    device_type: detectarDispositivo(),
    browser: detectarNavegador(),
    os: detectarSO(),
    screen_w: typeof screen !== 'undefined' ? screen.width : undefined,
    screen_h: typeof screen !== 'undefined' ? screen.height : undefined,
    viewport_w: typeof window !== 'undefined' ? window.innerWidth : undefined,
    viewport_h: typeof window !== 'undefined' ? window.innerHeight : undefined,
    language: typeof navigator !== 'undefined' ? navigator.language : undefined,
    ...lerUtm(),
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// track — a porta pública para o resto do site
// ═══════════════════════════════════════════════════════════════════════════
// Chamada de qualquer lugar, cliente ou componente:
//   track('donate_address_copied', { metodo: 'dog' })
//   track('wallet_connected', { carteira: 'kray' })
//
// Não lança nunca, não espera resposta, não bloqueia o clique que a disparou.

export function track(nome: string, meta?: Record<string, unknown>, valor?: number): void {
  if (typeof window === 'undefined') return
  const page = window.location.pathname
  if (!medirEstaRota(page)) return
  enviar({
    event_type: 'event',
    ...contextoBase(page),
    event_name: nome.slice(0, 60),
    event_value: valor,
    event_meta: meta,
    referrer: referrerExterno(),
  })
}
