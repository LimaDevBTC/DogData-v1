'use client'

/**
 * Esta pessoa abre a sala de operação?
 *
 * ⚠️ A RESPOSTA VEM DO SERVIDOR, SEMPRE. A allowlist é ENV do servidor, e
 * comparar o endereço no navegador exigiria mandar a lista junto, o que
 * publicaria exatamente quais carteiras abrem a sala. O que este hook faz é
 * perguntar a /api/admin/me, que responde 404 a quem não abre.
 *
 * E é só cosmético: esconder um link não protege nada. Quem protege é o portão
 * em app/admin/layout.tsx e em cada rota sob /api/admin. O único efeito de
 * errar aqui é um link a mais ou a menos numa tela.
 *
 * Só pergunta depois que a posse foi provada: antes disso não existe sessão
 * para o servidor consultar, e a resposta seria "não" por falta de prova, não
 * por falta de permissão.
 *
 * A resposta fica guardada no módulo porque o header remonta a cada navegação,
 * e sem isso a mesma pergunta iria ao servidor em toda página.
 */

import { useEffect, useState } from 'react'

let lembrado: boolean | null = null

export function useIsAdmin(verified: boolean): boolean {
  const [admin, setAdmin] = useState(lembrado ?? false)

  useEffect(() => {
    if (!verified) {
      // Desconectar tem que apagar a lembrança, senão o link continuaria
      // aparecendo para quem entrasse depois no mesmo navegador.
      lembrado = null
      setAdmin(false)
      return
    }
    if (lembrado !== null) {
      setAdmin(lembrado)
      return
    }
    let vivo = true
    fetch('/api/admin/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        lembrado = Boolean(d?.admin)
        if (vivo) setAdmin(lembrado)
      })
      .catch(() => {})
    return () => {
      vivo = false
    }
  }, [verified])

  return admin
}
