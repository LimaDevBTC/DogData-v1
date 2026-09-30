#!/usr/bin/env node
// Gera lib/ordinals/dsc-colecao.ts: a lista FECHADA dos Ordinals oficiais do
// DOG SOCIAL CLUB que liberam o lounge da sede KRAY•SPACE no DOGCITY
// (app/api/dogcity/dsc-access). Regra (conferida em 29/09/2026, altura 969189):
//
//   oficial = FILHO DIRETO da inscricao pai 8a18494d...e29e4eci0
//
// e so' isso. Neto nao entra (o unico neto e' o "DSC manifesto", text/markdown,
// reinscricao do criador), e nome ou imagem parecidos tambem nao: a porta
// compara ID. A Kray (kray.space/ordinals?collection=dog-social-club) mostra o
// mesmo pai, 306 itens, verified; o atlas da praca antiga do DOGCITY tambem.
//
// O pai continua na carteira do criador, entao filhos novos PODEM surgir. Este
// script nunca aceita isso sozinho: rodar de novo so' reescreve o arquivo se o
// conjunto bater com o anterior, ou com --aceitar-mudanca (decisao humana).
//
// uso: node scripts/dsc-colecao.mjs [--aceitar-mudanca]
import fs from 'node:fs'
import path from 'node:path'

const PAI = '8a18494da6e0d1902243220c397cdecf4de9d64020cf0fa9fa16adfc6e29e4eci0'
const ORD = process.env.ORD_PUBLICO ?? 'https://ordinals.com'
const SAIDA = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'lib', 'ordinals', 'dsc-colecao.ts')
const ID = /^[0-9a-f]{64}i\d{1,5}$/

async function json(url) {
  for (let tentativa = 0; tentativa < 4; tentativa++) {
    const r = await fetch(url, { headers: { Accept: 'application/json' } })
    if (r.ok) return r.json()
    await new Promise((ok) => setTimeout(ok, 1500 * (tentativa + 1)))
  }
  throw new Error(`falhou: ${url}`)
}

const ids = []
for (let pagina = 0; pagina < 50; pagina++) {
  const j = await json(`${ORD}/r/children/${PAI}/${pagina}`)
  for (const id of j.ids ?? []) if (ID.test(id)) ids.push(id)
  if (!j.more) break
}
if (new Set(ids).size !== ids.length) throw new Error('ids repetidos na resposta do ord')

let anterior = null
try {
  const m = fs.readFileSync(SAIDA, 'utf8').match(/DSC_IDS[^=]*=\s*\[([\s\S]*?)\]/)
  if (m) anterior = [...m[1].matchAll(/'([0-9a-f]{64}i\d+)'/g)].map((x) => x[1])
} catch {
  /* primeira vez */
}
if (anterior) {
  const a = new Set(anterior)
  const b = new Set(ids)
  const novos = ids.filter((x) => !a.has(x))
  const sumiram = anterior.filter((x) => !b.has(x))
  if ((novos.length || sumiram.length) && !process.argv.includes('--aceitar-mudanca')) {
    console.error(`A colecao mudou: +${novos.length} -${sumiram.length}. Nada foi escrito.`)
    console.error('novos:', novos.slice(0, 10), 'sumiram:', sumiram.slice(0, 10))
    console.error('Confirme com o criador/Kray e rode com --aceitar-mudanca.')
    process.exit(2)
  }
}

const agora = new Date().toISOString()
const corpo = `// GERADO por scripts/dsc-colecao.mjs em ${agora}. Nao editar a mao.
//
// Os Ordinals oficiais do DOG SOCIAL CLUB: os ${ids.length} filhos DIRETOS da
// inscricao pai ${PAI}
// (${ORD}/r/children/<pai>). Conferido igual a' lista da Kray
// (kray.space/ordinals?collection=dog-social-club: parentId igual, 306 itens,
// verified) e ao atlas da praca antiga do DOGCITY. Neto nao conta.

export const DSC_PAI = '${PAI}'

export const DSC_IDS: readonly string[] = [
${ids.map((x) => `  '${x}',`).join('\n')}
]

export const DSC_CONFERIDO_EM = '${agora}'
`
fs.writeFileSync(SAIDA, corpo)
console.log(`${ids.length} ids escritos em ${path.relative(process.cwd(), SAIDA)}`)
