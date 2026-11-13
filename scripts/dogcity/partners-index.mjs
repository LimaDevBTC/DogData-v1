// Índice estático da fase Partners para o verificador de carteira da landing (#partners).
//
// Entrada: o corte do mint (parceiros_mint/final: manifesto.json, parceiros.txt, por_colecao/<slug>.txt), o MESMO
// arquivo que o mint carrega por MINT_PARTNERS_URL (sha256 conferido). Saída em public/dc-partners/:
//   collections.json   as coleções na ordem do fundador, com o nº de carteiras, o bloco do corte e o sha256
//   s/<xx>.json        256 pedaços: { endereço: [índices das coleções] }, xx = 2 primeiros hex do sha256(endereço)
// A landing calcula o sha256 do endereço colado e baixa só o pedaço dele (~30 KB), nunca a lista inteira (6 MB).
//
// Uso: node scripts/dogcity/partners-index.mjs <pasta do corte>
import { createHash } from "node:crypto"
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const src = process.argv[2]
if (!src) throw new Error("uso: partners-index.mjs <pasta do corte>")
const out = new URL("../../public/dc-partners/", import.meta.url).pathname
const man = JSON.parse(readFileSync(join(src, "manifesto.json"), "utf8"))
const txt = readFileSync(join(src, "parceiros.txt"))
const sha = createHash("sha256").update(txt).digest("hex")
if (sha !== man.sha256) throw new Error(`parceiros.txt não bate com o manifesto: ${sha}`)
const all = new Set(txt.toString("utf8").split("\n").map((l) => l.trim()).filter(Boolean))

const NAME = (n) => n.replace(/^\$DOG \| Ordinals /, "$DOG Ordinals · ")
const map = new Map()
const collections = man.colecoes.map((c, i) => {
  const addrs = readFileSync(join(src, "por_colecao", `${c.slug}.txt`), "utf8").split("\n").map((l) => l.trim()).filter(Boolean)
  for (const a of addrs) {
    if (!all.has(a)) continue // fora da lista final (custódia): o mint também recusa
    const v = map.get(a)
    if (v) { if (v[v.length - 1] !== i) v.push(i) } else map.set(a, [i])
  }
  return { slug: c.slug, name: NAME(c.nome), wallets: c.carteiras }
})
if (map.size !== all.size) throw new Error(`união das coleções (${map.size}) != parceiros.txt (${all.size})`)

rmSync(out, { recursive: true, force: true })
mkdirSync(join(out, "s"), { recursive: true })
const shards = Array.from({ length: 256 }, () => ({}))
for (const [a, v] of map) shards[parseInt(createHash("sha256").update(a).digest("hex").slice(0, 2), 16)][a] = v
shards.forEach((s, i) => writeFileSync(join(out, "s", `${i.toString(16).padStart(2, "0")}.json`), JSON.stringify(s)))
writeFileSync(join(out, "collections.json"), JSON.stringify({
  format: "DCPARTNERS1", cutHeight: man.altura, cutHeightEnd: man.altura_fim, wallets: all.size, sha256: sha, collections,
}, null, 1))
console.log(`${collections.length} coleções, ${all.size} carteiras, 256 pedaços em ${out}`)
