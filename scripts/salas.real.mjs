// O CAMINHO REAL das regras das salas da sede KRAY•SPACE (sem mock): as fontes de
// verdade publicas (ordinals.com e kray.space), as mesmas funcoes que as rotas usam.
// Sem UNISAT_API_TOKEN a lista do DSC vem da Kray e do ord (a ordem da rota sem token).
//
//   DSC  1. descobre o dono ATUAL de cada um dos 306 Ordinals oficiais (ord /r/inscription);
//        2. para varios donos reais (inclusive o de maior carteira), verificarDsc tem de dizer
//           holder; para enderecos sem nenhum dos 306, sem_posse;
//        3. cada fonte de lista sozinha (so' Kray, so' ord) tem de concordar.
//   DOG  4. um holder do snapshot publico do DogData e donos de DSC: o saldo confirmado pelo
//           ord e pela Kray, separados, tem de concordar (> 0 ou 0) e verificarDog decide igual.
//
// Rodar: node --import ./scripts/ts-resolver.mjs scripts/salas.real.mjs [saida.json]
import fs from 'node:fs'
import { verificarDsc } from '../lib/ordinals/dsc.ts'
import { DSC_IDS } from '../lib/ordinals/dsc-colecao.ts'
import { donoNoOrd, lerOrdEndereco, lerUtxosKray } from '../lib/dogcity/fontes-l1.ts'
import { fonteKrayDog, fonteOrdDog, verificarDog } from '../lib/runes/dog-l1.ts'

const SAIDA = process.argv[2] || null
const res = []
const ok = (nome, cond, medida) => {
  res.push({ nome, ok: !!cond, medida })
  console.log(`${cond ? 'OK  ' : 'FALHA'} ${nome}  ${JSON.stringify(medida)}`)
}
const curto = (a) => (a ? `${a.slice(0, 10)}…${a.slice(-6)}` : a)

async function emOndas(itens, fn, largura = 8) {
  const out = []
  for (let i = 0; i < itens.length; i += largura) out.push(...(await Promise.all(itens.slice(i, i + largura).map(fn))))
  return out
}

// com nova tentativa: o ord publico as vezes responde 406/timeout
async function dono(id) {
  for (let t = 0; t < 3; t++) {
    const d = await donoNoOrd(id)
    if (d) return d
    await new Promise((r) => setTimeout(r, 400 * (t + 1)))
  }
  return null
}

const kray = { nome: 'kray', listar: async (e) => { const u = await lerUtxosKray(e); const items = u.flatMap((x) => x.inscricoes.map((id) => ({ id, number: 0 }))); return { items, total: items.length, proximo: items.length } } }
const ord = { nome: 'ord', listar: async (e) => { const r = await lerOrdEndereco(e); const items = r.inscricoes.map((id) => ({ id, number: 0 })); return { items, total: items.length, proximo: items.length } } }

// ---- 1. os donos atuais dos 306 ----
const t0 = Date.now()
const donos = await emOndas(DSC_IDS, async (id) => [id, await dono(id)])
const porDono = new Map()
for (const [id, d] of donos) if (d) porDono.set(d, [...(porDono.get(d) ?? []), id])
const semResposta = donos.filter(([, d]) => !d).length
ok('ord: dono atual de cada um dos 306 Ordinals oficiais', semResposta <= 3, { respondeu: 306 - semResposta, enderecos: porDono.size, s: Math.round((Date.now() - t0) / 1000) })

// ---- 2. holders reais ----
const ordenados = [...porDono.entries()].sort((a, b) => b[1].length - a[1].length)
const amostra = [ordenados[0], ...ordenados.slice(1).filter((_, i) => i % Math.max(1, Math.floor(ordenados.length / 6)) === 0).slice(0, 5)].filter(Boolean)
for (const [endereco, ids] of amostra) {
  const r = await verificarDsc(endereco, { listas: [kray, ord], dono })
  const inscricoes = await lerUtxosKray(endereco).then((u) => u.reduce((n, x) => n + x.inscricoes.length, 0)).catch(() => null)
  ok(`DSC real: ${curto(endereco)} (${ids.length} DSC, ${inscricoes ?? '?'} inscricoes na carteira) -> holder`, r.status === 'holder' && ids.includes(r.inscricao.id), { status: r.status, fonte: r.fonte, inscricao: r.inscricao?.id?.slice(0, 12) })
}

// ---- 3. cada fonte sozinha concorda ----
{
  const [endereco, ids] = ordenados[0]
  const soKray = await verificarDsc(endereco, { listas: [kray], dono })
  const soOrd = await verificarDsc(endereco, { listas: [ord], dono }).catch(() => ({ status: 'erro' }))
  ok('DSC real: a lista da Kray sozinha acha o item da maior carteira', soKray.status === 'holder' && ids.includes(soKray.inscricao.id), { status: soKray.status })
  ok('DSC real: a lista do ord sozinha acha (ou o ord esta\' fora: indisponivel, nunca sem_posse)', (soOrd.status === 'holder' && ids.includes(soOrd.inscricao.id)) || (soOrd.status === 'indisponivel' && soOrd.motivo === 'indexador'), { status: soOrd.status, motivo: soOrd.motivo })
}

// ---- DOG: um holder do snapshot publico e donos de DSC ----
const snap = JSON.parse(fs.readFileSync(new URL('../data/dog_holders_by_address.json', import.meta.url)))
const holderDog = snap.holders.find((h) => h.address.startsWith('bc1p') && h.utxo_count <= 4 && h.total_dog > 1000 && !porDono.has(h.address))
const candidatos = [holderDog.address, ...ordenados.slice(0, 4).map(([e]) => e)]
for (const endereco of candidatos) {
  const [a, b] = await Promise.all([
    fonteOrdDog(lerOrdEndereco).saldo(endereco).then((s) => s).catch(() => null),
    fonteKrayDog(lerUtxosKray).saldo(endereco).then((s) => s).catch(() => null),
  ])
  const r = await verificarDog(endereco, [fonteOrdDog(lerOrdEndereco), fonteKrayDog(lerUtxosKray)])
  const concordam = a === null || b === null || (a > 0n) === (b > 0n)
  const esperado = a !== null ? (a > 0n ? 'holder' : 'sem_posse') : b !== null ? (b > 0n ? 'holder' : 'sem_posse') : 'indisponivel'
  ok(`DOG real: ${curto(endereco)} ord=${a === null ? 'fora' : String(a)} kray=${b === null ? 'fora' : String(b)} -> ${r.status}`, concordam && r.status === esperado, { fonte: r.fonte ?? null, snapshot: endereco === holderDog.address ? holderDog.total_amount : undefined })
}
// um endereco real sem nenhum dos 306 (holder de DOG, fora do mapa de donos): sem_posse no DSC
{
  const r = await verificarDsc(holderDog.address, { listas: [kray, ord], dono })
  ok(`DSC real: ${curto(holderDog.address)} (tem DOG, nenhum dos 306) -> sem_posse (a rune DOG nao abre o clube)`, r.status === 'sem_posse', r)
}
// o holder do snapshot tem de ser holder hoje por pelo menos uma fonte (snapshot de 29/09)
{
  const r = await verificarDog(holderDog.address, [fonteOrdDog(lerOrdEndereco), fonteKrayDog(lerUtxosKray)])
  ok('DOG real: holder do snapshot publico reconhecido pela leitura ao vivo (nao pelo snapshot)', r.status === 'holder', r)
}

const falhou = res.filter((r) => !r.ok).length
console.log(`\n${res.length - falhou}/${res.length} OK`)
if (SAIDA) fs.writeFileSync(SAIDA, JSON.stringify({ quando: new Date().toISOString(), res }, null, 2))
process.exit(falhou ? 1 : 0)
