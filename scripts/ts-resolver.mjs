// Deixa o `node --test` (tipos apagados pelo Node) importar TS do lib/ com import sem extensao.
import { register } from 'node:module'
register('data:text/javascript,' + encodeURIComponent(`
export async function resolve(esp, ctx, prox) {
  try { return await prox(esp, ctx) } catch (e) {
    if ((esp.startsWith('./') || esp.startsWith('../')) && !/\\.[cm]?[jt]s$/.test(esp)) return prox(esp + '.ts', ctx)
    throw e
  }
}`))
