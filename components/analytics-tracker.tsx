'use client'

// ═══════════════════════════════════════════════════════════════════════════
// O tracker. Um por aplicação, montado no layout raiz.
//
// O que ele mede além do que media antes:
//
//  · PERMANÊNCIA. A versão anterior mandava um pageview e ia embora, então
//    "tempo no site" era incalculável — medido em 27/08, dava média de 9.132s
//    e mediana 0. Aqui o tempo é ACUMULADO enquanto o documento está visível
//    e descarregado em eventos próprios. Aba aberta esquecida não acumula: é
//    tempo de atenção, não de calendário.
//  · PROFUNDIDADE DE ROLAGEM. Quanto da página a pessoa realmente desceu.
//    Numa landing longa é a diferença entre "viu o herói" e "chegou nos tiers".
//  · IDENTIDADE. visitor_id persistente, para único e recorrente existirem.
//  · CAMPANHA. UTM lido da URL e guardado na sessão.
//
// A regra que governa o arquivo: telemetria NUNCA pode custar quadro nem
// derrubar a página. Nada aqui roda em render, tudo é passivo, todo envio é
// silencioso, e o único trabalho por rolagem é uma comparação de inteiro.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import {
  contextoBase, enviar, estaDesligado, medirEstaRota, referrerExterno, sessionId,
} from '@/lib/analytics/client'

// Batida de segurança. O descarregamento em `pagehide` cobre a saída normal;
// isto cobre a aba morta pelo sistema (o que o iOS faz o tempo todo) e a
// sessão de dez minutos numa página só, que sem heartbeat chegaria inteira
// só no fim — ou nunca.
const HEARTBEAT_MS = 15_000

// Abaixo de um segundo não é permanência, é ruído de troca de rota. Cortar na
// origem evita encher a tabela de linhas de 40ms que só somam zero.
const MINIMO_MS = 1_000

export function AnalyticsTracker() {
  const pathname = usePathname()

  // Toda a máquina de tempo vive em refs: nada aqui pode causar re-render.
  const paginaRef = useRef<string>(pathname)
  const ativoDesdeRef = useRef<number | null>(null)
  const acumuladoRef = useRef(0)
  const rolagemRef = useRef(0)
  const vitaisRef = useRef(false)
  // A maquina de tempo e criada uma vez no efeito de montagem, mas a troca de
  // rota tambem precisa fechar a conta. Em vez de reimplementar a descarga la
  // — duas copias da mesma soma sao duas chances de contar o mesmo tempo duas
  // vezes — o efeito de montagem publica a funcao aqui e a rota chama ESTA.
  const descarregarRef = useRef<((pagina: string, beacon?: boolean) => void) | null>(null)

  useEffect(() => {
    if (estaDesligado()) return

    const agora = () => Date.now()

    const pausar = () => {
      if (ativoDesdeRef.current != null) {
        acumuladoRef.current += agora() - ativoDesdeRef.current
        ativoDesdeRef.current = null
      }
    }

    const retomar = () => {
      if (ativoDesdeRef.current == null && document.visibilityState === 'visible') {
        ativoDesdeRef.current = agora()
      }
    }

    // Fecha a conta da página que está saindo. `pagina` é passada de fora
    // porque na troca de rota o tempo pertence à página ANTERIOR, não à que
    // acabou de entrar — creditar na nova seria inverter exatamente a métrica
    // que a permanência existe pra responder.
    const descarregar = (pagina: string, beacon = false) => {
      pausar()
      const ms = acumuladoRef.current
      const rolagem = rolagemRef.current
      if (ms < MINIMO_MS) {
        retomar()
        return
      }
      acumuladoRef.current = 0
      if (medirEstaRota(pagina)) {
        enviar(
          {
            event_type: 'engagement',
            ...contextoBase(pagina),
            duration_ms: ms,
            scroll_pct: rolagem,
          },
          beacon,
        )
      }
      retomar()
    }

    descarregarRef.current = descarregar

    const aoRolar = () => {
      const alturaDoc = document.documentElement.scrollHeight
      const visivel = window.innerHeight
      // Página que cabe na tela está 100% vista. Sem essa guarda a divisão
      // por (alturaDoc - visivel) estoura em zero ou negativo e a rolagem de
      // toda página curta vira NaN.
      const pct =
        alturaDoc <= visivel
          ? 100
          : Math.round(((window.scrollY + visivel) / alturaDoc) * 100)
      const limitado = Math.max(0, Math.min(100, pct))
      if (limitado > rolagemRef.current) rolagemRef.current = limitado
    }

    const aoMudarVisibilidade = () => {
      if (document.visibilityState === 'hidden') {
        // Em mobile isto costuma ser o último momento útil: trocar de app
        // frequentemente é o fim da visita, e `pagehide` pode nunca vir.
        descarregar(paginaRef.current, true)
      } else {
        retomar()
      }
    }

    const aoSair = () => descarregar(paginaRef.current, true)

    const pulso = setInterval(() => descarregar(paginaRef.current), HEARTBEAT_MS)

    window.addEventListener('scroll', aoRolar, { passive: true })
    window.addEventListener('resize', aoRolar, { passive: true })
    document.addEventListener('visibilitychange', aoMudarVisibilidade)
    window.addEventListener('pagehide', aoSair)

    retomar()
    aoRolar()

    return () => {
      clearInterval(pulso)
      window.removeEventListener('scroll', aoRolar)
      window.removeEventListener('resize', aoRolar)
      document.removeEventListener('visibilitychange', aoMudarVisibilidade)
      window.removeEventListener('pagehide', aoSair)
      descarregar(paginaRef.current, true)
    }
  }, [])

  // ── troca de rota: fecha a página anterior, abre a nova ─────────────────
  useEffect(() => {
    if (estaDesligado()) return

    const anterior = paginaRef.current
    if (anterior && anterior !== pathname) {
      // Fecha a conta da anterior ANTES de trocar a referência: creditar esse
      // tempo na página nova inverteria exatamente a métrica que a permanência
      // existe pra responder.
      descarregarRef.current?.(anterior)
      // A rolagem é por página. Sem zerar aqui, o 90% de uma landing longa
      // vazaria como piso pra toda página seguinte da visita.
      rolagemRef.current = 0
    }

    paginaRef.current = pathname
    if (!medirEstaRota(pathname)) return

    enviar({
      event_type: 'pageview',
      ...contextoBase(pathname),
      referrer: referrerExterno(),
    })
  }, [pathname])

  // ── Web Vitals, uma vez por sessão ──────────────────────────────────────
  // Continuam presas à primeira rota da visita de propósito: LCP e TTFB
  // descrevem o carregamento do documento, e re-emitir por rota transformaria
  // navegação de SPA em "carregamento" que nunca existiu.
  useEffect(() => {
    if (vitaisRef.current || estaDesligado()) return
    vitaisRef.current = true

    const paginaInicial = pathname

    import('web-vitals')
      .then(({ onLCP, onCLS, onFCP, onTTFB, onINP }) => {
        const reportar = (nome: string) => (metrica: { value: number; rating: string }) => {
          enviar({
            event_type: 'vital',
            ...contextoBase(paginaInicial),
            session_id: sessionId(),
            vital_name: nome,
            // CLS é adimensional e mora entre 0 e ~1; guardar × 1000 mantém a
            // coluna inteira útil pra todos os cinco. Os limites em
            // /api/analytics/report leem na mesma escala.
            vital_value: Math.round(nome === 'CLS' ? metrica.value * 1000 : metrica.value),
            vital_rating: metrica.rating,
          })
        }
        onLCP(reportar('LCP'))
        onCLS(reportar('CLS'))
        onFCP(reportar('FCP'))
        onTTFB(reportar('TTFB'))
        onINP(reportar('INP'))
      })
      .catch(() => {})
  }, [pathname])

  return null
}
