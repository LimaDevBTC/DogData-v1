"use client"

// Todo link da landing para o mint.dogcity.space passa a levar `?ref=@handle` quando o visitante chegou por um link de embaixador.
// Só no cliente, depois de montar (o HTML do servidor sai sem ref, então SSR e hidratação não divergem). Reescreve o href dos
// <a> que já existem e dos que aparecerem depois (a landing troca os botões conforme a fase do mint).
import { useEffect } from "react"
import { captureRef, readStoredRef } from "../../../lib/referral/client"
import { withMintRef } from "./mint-ref"

function patch(root: ParentNode, handle: string) {
  root.querySelectorAll<HTMLAnchorElement>('a[href*="mint.dogcity.space"]').forEach((a) => {
    const cur = a.getAttribute("href")
    if (!cur) return
    const next = withMintRef(cur, handle)
    if (next !== cur) a.setAttribute("href", next)
  })
}

export function MintRefLinks() {
  useEffect(() => {
    // o efeito do filho roda antes do da WalletContext: guarda aqui também (o primeiro link vale, é idempotente)
    try { captureRef(window.location.search) } catch { /* sem storage, sem ref */ }
    const handle = readStoredRef()
    if (!handle) return
    patch(document, handle)
    let queued = false
    const mo = new MutationObserver(() => {
      if (queued) return
      queued = true
      window.requestAnimationFrame(() => { queued = false; patch(document, handle) })
    })
    mo.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["href"] })
    return () => mo.disconnect()
  }, [])
  return null
}
