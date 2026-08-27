'use client'

// MEMORIA DE ROTA (26/08). Sintoma do fundador: "estou na batalha, mudo de
// tela no celular, volto e caio na landing; na galaxia, a mesma coisa".
//
// Duas causas somadas, as duas cobertas aqui:
//
// 1. A RAIZ manda pra landing sempre que sessionStorage esta vazio, e SO a
//    landing marcava a sessao. Quem entra direto numa rota profunda (link
//    compartilhado, ou o iOS descartando a aba por memoria, o que acontece
//    justamente nas paginas WebGL pesadas) volta com a sessao zerada e
//    qualquer passagem pela raiz reabre a landing. Agora TODA pagina marca.
//
// 2. Navegador in-app (X, Telegram) reabre a URL ORIGINAL do link quando o
//    app volta do multitarefa, perdendo a navegacao que aconteceu depois.
//    Contra isso nao ha conserto do nosso lado: o que da pra fazer e
//    lembrar onde a pessoa estava e oferecer a volta em um toque.
//
// A ultima rota IMERSIVA (galaxia, cidade, batalha, praca) fica em
// localStorage com carimbo de tempo. Nada de restaurar sozinho: sequestrar
// a navegacao de quem quis mesmo ir pra home e pior que o problema.

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

export const CHAVE_ULTIMA = 'dogdata-ultima-rota'
export const JANELA_MS = 6 * 60 * 60 * 1000

// rotas que valem a pena retomar: as que custam carregamento e nas quais a
// pessoa estava fazendo alguma coisa
const IMERSIVAS = [/^\/galaxy/, /^\/city/, /^\/holders\/tree/]

export interface UltimaRota {
  path: string
  t: number
}

export function lerUltimaRota(): UltimaRota | null {
  try {
    const cru = localStorage.getItem(CHAVE_ULTIMA)
    if (!cru) return null
    const v = JSON.parse(cru) as UltimaRota
    if (!v || typeof v.path !== 'string' || typeof v.t !== 'number') return null
    if (Date.now() - v.t > JANELA_MS) return null
    return v
  } catch {
    return null
  }
}

export function esquecerUltimaRota() {
  try {
    localStorage.removeItem(CHAVE_ULTIMA)
  } catch {
    /* modo privado: nao ha o que limpar */
  }
}

export function RouteMemory() {
  const pathname = usePathname()

  useEffect(() => {
    if (!pathname) return
    try {
      // marca a sessao em QUALQUER rota: a raiz so deve empurrar pra landing
      // quem esta chegando pela primeira vez, nunca quem ja estava dentro
      sessionStorage.setItem('dogdata-session', '1')
    } catch {
      /* modo privado: a raiz volta ao comportamento antigo, sem quebrar */
    }
    try {
      if (IMERSIVAS.some((re) => re.test(pathname))) {
        const busca = window.location.search || ''
        localStorage.setItem(CHAVE_ULTIMA, JSON.stringify({ path: pathname + busca, t: Date.now() }))
      }
    } catch {
      /* idem */
    }
  }, [pathname])

  return null
}
