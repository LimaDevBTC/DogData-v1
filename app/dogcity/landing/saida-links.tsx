"use client"

// Links de saída da DogCity (mint e jogo). Montado UMA vez em app/dogcity/layout.tsx, então vale na landing e em toda página
// da moldura (docs, atlas, ranking, perfil, motors, founders...), nas barras, na gaveta e nos rodapés.
//
// 1. Quem chegou por um link de embaixador (`?ref=@handle`, guardado 30 dias em localStorage) leva o @handle em todo link para
//    mint.dogcity.space E play.dogcity.space. O jogo guarda o ref na origem dele e o manda no verify da carteira (é assim que
//    nasce o vínculo em referral_links); em 27/11 a landing só repassava ao mint, e 294 sessões iam ao jogo sem código.
// 2. Cada clique num desses links vira um evento `landing_cta_click` (onde, destino, rótulo, havia ref guardado), pelo mesmo
//    track() do site (fetch keepalive: sobrevive à navegação, não atrasa o clique).
//
// Só no cliente, depois de montar (o HTML do servidor sai sem ref, então SSR e hidratação não divergem). Reescreve o href dos
// <a> que já existem e dos que aparecerem depois (a landing troca os botões conforme a fase do mint).
import { useEffect } from "react"
import { captureRef, readStoredRef } from "../../../lib/referral/client"
import { track } from "../../../lib/analytics/client"
import { metaDoClique, withOutboundRef } from "./mint-ref"

const SELETOR = 'a[href*="mint.dogcity.space"], a[href*="play.dogcity.space"]'

function patch(root: ParentNode, handle: string) {
  root.querySelectorAll<HTMLAnchorElement>(SELETOR).forEach((a) => {
    const cur = a.getAttribute("href")
    if (!cur) return
    const next = withOutboundRef(cur, handle)
    if (next !== cur) a.setAttribute("href", next)
  })
}

function aoClicar(ev: MouseEvent) {
  try {
    // clique do meio também sai da página (nova aba); o botão direito não
    if (ev.type === "auxclick" && ev.button !== 1) return
    const alvo = ev.target as Element | null
    const a = alvo?.closest?.<HTMLAnchorElement>("a[href]")
    const href = a?.getAttribute("href")
    if (!a || !href) return
    const meta = metaDoClique(a, href, readStoredRef() !== null)
    if (meta) track("landing_cta_click", meta)
  } catch { /* medir nunca atrapalha o clique */ }
}

export function SaidaLinks() {
  useEffect(() => {
    // os cliques são medidos com ou sem ref, e vale para links que a landing monta depois
    document.addEventListener("click", aoClicar, true)
    document.addEventListener("auxclick", aoClicar, true)
    // o efeito do filho roda antes do da WalletContext: guarda aqui também (o primeiro link vale, é idempotente)
    try { captureRef(window.location.search) } catch { /* sem storage, sem ref */ }
    const handle = readStoredRef()
    let mo: MutationObserver | null = null
    if (handle) {
      patch(document, handle)
      let queued = false
      mo = new MutationObserver(() => {
        if (queued) return
        queued = true
        window.requestAnimationFrame(() => { queued = false; patch(document, handle) })
      })
      mo.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["href"] })
    }
    return () => {
      document.removeEventListener("click", aoClicar, true)
      document.removeEventListener("auxclick", aoClicar, true)
      mo?.disconnect()
    }
  }, [])
  return null
}
