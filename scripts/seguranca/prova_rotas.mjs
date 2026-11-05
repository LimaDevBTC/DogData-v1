// Banco de provas de seguranca das rotas (auditoria de 05/11/2026): sobe o Next de verdade contra um Redis e um Supabase falsos
// em memoria, com dados e chaves sinteticos, e ataca as rotas de fora, por HTTP. Nao usa credencial nenhuma, nao fala com producao e
// nao move dinheiro: as chaves de carteira nascem aqui e morrem aqui, e sem X_API_KEY a rota do X nao tem como publicar.
//
//   node scripts/seguranca/prova_rotas.mjs            (na raiz do repo, sem .env*; portas livres escolhidas na hora)
//   node scripts/seguranca/prova_rotas.mjs --producao (depois de next build: NODE_ENV=production, confere Secure nos cookies)
//
// Sai com 0 se tudo passou. Cada linha diz o que foi pedido e o que voltou: e' a evidencia que vai em SECURITY_TEST_RESULTS.md.
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { createServer as createNetServer } from 'node:net'
import { randomBytes, webcrypto } from 'node:crypto'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { Address } = require('bip322-js')
const { schnorr } = await import('@noble/curves/secp256k1.js')
const { sha256 } = await import('@noble/hashes/sha2.js')

for (const f of ['.env', '.env.local', '.env.production', '.env.development']) {
  if (existsSync(f)) {
    console.error(`recuso rodar com ${f} presente: este banco de provas nao pode tocar em credencial de verdade`)
    process.exit(2)
  }
}

// ⚠️ A PORTA TEM DE SER NOSSA (incidente de 05/11/2026). A primeira rodada usou uma porta fixa que ja' tinha um Vite de outro worktree em
// 127.0.0.1; o Vite leva /api a producao, e os ataques foram parar la'. Por isso: o sistema escolhe tres portas livres, o Next sobe preso
// em 127.0.0.1 (porta ocupada derruba em vez de dividir) e, antes de qualquer pedido que escreva, o canario mais abaixo prova que quem
// responde e' o Next que le o NOSSO Redis falso.
const portaLivre = () => new Promise((ok, falha) => {
  const s = createNetServer()
  s.on('error', falha)
  s.listen(0, '127.0.0.1', () => {
    const { port } = s.address()
    s.close(() => ok(port))
  })
})
const P_NEXT = await portaLivre()
const P_REDIS = await portaLivre()
const P_SUPA = await portaLivre()
const CRON = 'cron-sintetico-' + randomBytes(8).toString('hex')

// ── Redis falso (REST do Upstash) ──────────────────────────────────────────────────────────────────────────────────
const kv = new Map()
let relogioMs = 0 // avanca o tempo sem esperar
let redisFora = false
const agora = () => Date.now() + relogioMs
const vivo = (k) => {
  const e = kv.get(k)
  if (!e) return null
  if (e.ate && e.ate <= agora()) {
    kv.delete(k)
    return null
  }
  return e
}
function comando([cmd, ...a]) {
  switch (String(cmd).toUpperCase()) {
    case 'PING': return 'PONG'
    case 'GET': return vivo(a[0])?.v ?? null
    case 'SET': {
      const op = a.slice(2).map((x) => String(x).toUpperCase())
      if (op.includes('NX') && vivo(a[0])) return null
      let ate = 0
      const ex = op.indexOf('EX')
      if (ex >= 0) ate = agora() + Number(a[2 + ex + 1]) * 1000
      const px = op.indexOf('PX')
      if (px >= 0) ate = agora() + Number(a[2 + px + 1])
      kv.set(a[0], { v: String(a[1]), ate })
      return 'OK'
    }
    case 'DEL': {
      let n = 0
      for (const k of a) if (vivo(k) && kv.delete(k)) n++
      return n
    }
    case 'INCR': {
      const e = vivo(a[0])
      const n = (e ? Number(e.v) : 0) + 1
      kv.set(a[0], { v: String(n), ate: e?.ate ?? 0 })
      return n
    }
    case 'EXPIRE': {
      const e = vivo(a[0])
      if (!e) return 0
      e.ate = agora() + Number(a[1]) * 1000
      return 1
    }
    case 'RPUSH': {
      const e = vivo(a[0]) ?? { v: [], ate: 0 }
      e.v.push(...a.slice(1).map(String))
      kv.set(a[0], e)
      return e.v.length
    }
    case 'LTRIM': return 'OK'
    case 'LRANGE': return vivo(a[0])?.v ?? []
    // o resto (HGETALL do razao da Radiola, HINCRBY...) nao entra na prova: responde vazio
    default: return null
  }
}
const b64 = (v) => {
  if (typeof v === 'string') return v === 'OK' ? v : Buffer.from(v).toString('base64')
  if (Array.isArray(v)) return v.map(b64)
  return v
}
const lerCorpo = (req) => new Promise((ok) => {
  const p = []
  req.on('data', (c) => p.push(c))
  req.on('end', () => ok(Buffer.concat(p).toString('utf8')))
})
const srvRedis = createServer(async (req, res) => {
  const corpo = JSON.parse((await lerCorpo(req)) || 'null')
  res.setHeader('Content-Type', 'application/json')
  if (redisFora) {
    res.statusCode = 500
    return res.end(JSON.stringify({ error: 'ERR falso: segredo-de-infra-nao-pode-vazar' }))
  }
  const cod = req.headers['upstash-encoding'] === 'base64' ? b64 : (x) => x
  if (req.url.startsWith('/pipeline') || req.url.startsWith('/multi-exec')) {
    return res.end(JSON.stringify(corpo.map((c) => ({ result: cod(comando(c)) }))))
  }
  res.end(JSON.stringify({ result: cod(comando(corpo)) }))
})

// ── Supabase falso (PostgREST) ─────────────────────────────────────────────────────────────────────────────────────
const tabelas = new Map()
let supaFora = false
const CHAVES = { dogcity_profiles: ['address'], dogcity_game_saves: ['wallet'], dogcity_game_checkins: ['wallet', 'day'] }
const tab = (t) => tabelas.get(t) ?? (tabelas.set(t, []), tabelas.get(t))
function casa(l, filtros) {
  return filtros.every(([c, f]) => {
    const [op, ...r] = f.split('.')
    const v = r.join('.')
    if (op === 'eq') return String(l[c]) === v
    if (op === 'neq') return String(l[c]) !== v
    if (op === 'gte') return String(l[c]) >= v
    if (op === 'lte') return String(l[c]) <= v
    if (op === 'in') return v.replace(/[()"]/g, '').split(',').includes(String(l[c]))
    return true
  })
}
const srvSupa = createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x')
  const texto = await lerCorpo(req)
  res.setHeader('Content-Type', 'application/json')
  if (supaFora) {
    res.statusCode = 500
    return res.end(JSON.stringify({ message: 'falso: connection string postgres://nao-pode-vazar', code: 'XX000' }))
  }
  if (u.pathname.startsWith('/rest/v1/rpc/')) return res.end('null')
  const t = u.pathname.replace('/rest/v1/', '')
  const filtros = [...u.searchParams].filter(([k]) => !['select', 'order', 'limit', 'on_conflict', 'columns', 'offset'].includes(k))
  const prefer = String(req.headers.prefer ?? '')
  const objeto = String(req.headers.accept ?? '').includes('vnd.pgrst.object')
  if (req.method === 'GET' || req.method === 'HEAD') {
    const linhas = tab(t).filter((l) => casa(l, filtros))
    res.setHeader('Content-Range', `0-${Math.max(0, linhas.length - 1)}/${linhas.length}`)
    return res.end(req.method === 'HEAD' ? undefined : JSON.stringify(objeto ? linhas[0] ?? null : linhas))
  }
  if (req.method === 'POST') {
    const novas = [JSON.parse(texto)].flat()
    const chave = CHAVES[t]
    const devolvidas = []
    for (const n of novas) {
      const achada = chave ? tab(t).find((l) => chave.every((c) => l[c] === n[c])) : null
      if (t === 'dogcity_profiles' && n.handle && tab(t).some((l) => l.handle === n.handle && l.address !== n.address)) {
        res.statusCode = 409
        return res.end(JSON.stringify({ code: '23505', message: 'duplicate' }))
      }
      if (achada && prefer.includes('ignore-duplicates')) continue
      if (achada) {
        Object.assign(achada, n)
        devolvidas.push(achada)
        continue
      }
      const l = { id: randomBytes(4).toString('hex'), created_at: new Date(agora()).toISOString(), ...n }
      tab(t).push(l)
      devolvidas.push(l)
    }
    res.statusCode = 201
    if (!prefer.includes('return=representation')) return res.end()
    return res.end(JSON.stringify(objeto ? devolvidas[0] ?? null : devolvidas))
  }
  if (req.method === 'PATCH') {
    for (const l of tab(t).filter((x) => casa(x, filtros))) Object.assign(l, JSON.parse(texto))
    res.statusCode = 204
    return res.end()
  }
  res.statusCode = 405
  res.end('{}')
})

// ── o cliente: um navegador por objeto, com o proprio cookie e o proprio IP ───────────────────────────────────────
const BASE = `http://127.0.0.1:${P_NEXT}`
class Navegador {
  constructor(ip) {
    this.ip = ip
    this.cookies = new Map()
  }
  async pedir(metodo, rota, corpo, cab = {}) {
    const h = { 'x-real-ip': this.ip, ...cab }
    if (this.cookies.size) h.cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ')
    if (corpo !== undefined) h['content-type'] = 'application/json'
    const r = await fetch(BASE + rota, { method: metodo, headers: h, body: corpo === undefined ? undefined : typeof corpo === 'string' ? corpo : JSON.stringify(corpo), redirect: 'manual', signal: AbortSignal.timeout(240_000) })
    this.ultimoSetCookie = r.headers.getSetCookie()
    for (const c of this.ultimoSetCookie) {
      const [par, ...atr] = c.split(';')
      const i = par.indexOf('=')
      const expira = atr.some((a) => /^\s*max-age=0\s*$/i.test(a))
      if (expira || !par.slice(i + 1)) this.cookies.delete(par.slice(0, i))
      else this.cookies.set(par.slice(0, i), par.slice(i + 1))
    }
    const t = await r.text()
    let json = null
    try { json = JSON.parse(t) } catch { /* nem toda resposta e' JSON */ }
    return { status: r.status, json, texto: t, cab: r.headers }
  }
}

// uma carteira sintetica: chave aleatoria, p2tr, assinatura Schnorr como a da Kray (lib/wallet/verify.ts)
function carteira() {
  const priv = schnorr.utils.randomSecretKey ? schnorr.utils.randomSecretKey() : schnorr.utils.randomPrivateKey()
  const pub = schnorr.getPublicKey(priv)
  const address = Address.convertPubKeyIntoAddress(Buffer.from(pub), 'p2tr').mainnet
  return {
    address,
    publicKey: Buffer.from(pub).toString('hex'),
    assinar: (m) => Buffer.from(schnorr.sign(sha256(new TextEncoder().encode(m)), priv)).toString('hex'),
  }
}
const provar = (n, c, assinatura, publicKey = c.publicKey) => n.pedir('POST', '/api/wallet/verify', { address: c.address, signature: assinatura, protocol: 'bip340-schnorr', publicKey, walletId: 'kray' })
async function logar(n, c) {
  const d = await n.pedir('POST', '/api/wallet/nonce', { address: c.address })
  return provar(n, c, c.assinar(d.json.message))
}

let ok = 0
const falhas = []
function confere(nome, passou, obs = '') {
  console.log(`${passou ? 'PASSOU' : 'FALHOU'}  ${nome}${obs === '' ? '' : `  [${obs}]`}`)
  if (passou) ok++
  else falhas.push(nome)
}
const ipNovo = () => `198.51.100.${(ipSeq++ % 250) + 1}`
let ipSeq = 1
const semVazar = (t) => !/nao-pode-vazar|postgres:\/\/|supabase\.co|upstash\.io|at .*\.ts:\d+/i.test(t)

// ── o Next ─────────────────────────────────────────────────────────────────────────────────────────────────────────
await new Promise((ok) => srvRedis.listen(P_REDIS, '127.0.0.1', ok))
await new Promise((ok) => srvSupa.listen(P_SUPA, '127.0.0.1', ok))
const admin = carteira()
const env = {
  PATH: process.env.PATH, HOME: process.env.HOME, NEXT_TELEMETRY_DISABLED: '1',
  SUPABASE_URL: `http://127.0.0.1:${P_SUPA}`, SUPABASE_SERVICE_ROLE_KEY: 'chave-sintetica', SUPABASE_ANON_KEY: 'chave-sintetica',
  UPSTASH_KV_REST_API_URL: `http://127.0.0.1:${P_REDIS}`, UPSTASH_KV_REST_API_TOKEN: 'token-sintetico',
  CRON_SECRET: CRON, ADMIN_ADDRESSES: admin.address, RADIOLA_ADMIN_KEY: 'radiola-sintetica',
}
const modoProd = process.argv.includes('--producao')
const proc = spawn('npx', ['next', modoProd ? 'start' : 'dev', '-H', '127.0.0.1', '-p', String(P_NEXT)], { env, stdio: ['ignore', 'pipe', 'pipe'], detached: true })
let logNext = ''
proc.stdout.on('data', (d) => { logNext += d })
proc.stderr.on('data', (d) => { logNext += d })
const fim = (cod) => {
  try { process.kill(-proc.pid, 'SIGTERM') } catch { /* ja' saiu */ }
  srvRedis.close()
  srvSupa.close()
  process.exit(cod)
}
const t0 = Date.now()
for (;;) {
  try {
    const r = await fetch(`${BASE}/api/wallet/session`, { signal: AbortSignal.timeout(180_000) })
    if (r.status === 200) break
  } catch { /* subindo */ }
  if (Date.now() - t0 > 420_000) {
    console.error('o Next nao subiu:\n' + logNext.slice(-2000))
    fim(3)
  }
  await new Promise((ok) => setTimeout(ok, 2000))
}
console.log(`Next no ar em ${Math.round((Date.now() - t0) / 1000)} s (${modoProd ? 'next start, NODE_ENV=production' : 'next dev'})\n`)

// O CANARIO: uma sessao que so' existe no nosso Redis falso. Se quem responde devolver este endereco, ele le o nosso Redis; qualquer outra
// resposta (um Vite com proxy, um Next com credencial de verdade) para tudo aqui, antes do primeiro pedido que escreva.
{
  const sid = 'canario-' + randomBytes(12).toString('hex')
  const marca = 'bc1qcanario' + randomBytes(10).toString('hex')
  kv.set(`wsess:${sid}`, { v: JSON.stringify({ address: marca, walletId: null, verifiedAt: new Date().toISOString() }), ate: 0 })
  const r = await fetch(`${BASE}/api/wallet/session`, { headers: { cookie: `dg_wallet=${sid}` }, signal: AbortSignal.timeout(120_000) })
  const j = await r.json().catch(() => null)
  if (j?.session?.address !== marca) {
    console.error('CANARIO FALHOU: quem responde nesta porta nao le o Redis falso. Nenhum pedido de escrita foi enviado.')
    fim(4)
  }
  console.log('canario ok: o servidor sob teste le o Redis falso deste processo\n')
}

try {
  console.log('--- login: desafio, assinatura, sessao')
  {
    const v = carteira()
    const n = new Navegador(ipNovo())
    for (const [nome, corpo] of [['curto', { address: 'abc' }], ['objeto', { address: { $ne: 1 } }], ['chave de redis', { address: 'wsess:x' }], ['vazio', {}]]) {
      const r = await n.pedir('POST', '/api/wallet/nonce', corpo)
      confere(`nonce recusa endereco invalido (${nome})`, r.status === 400, r.status)
    }
    let r = await n.pedir('POST', '/api/wallet/nonce', 'nao e json')
    confere('nonce recusa corpo que nao e JSON', r.status === 400, r.status)
    r = await n.pedir('POST', '/api/wallet/nonce', { address: 'x'.repeat(5000) })
    confere('nonce recusa corpo grande', r.status === 413, r.status)

    r = await n.pedir('POST', '/api/wallet/nonce', { address: v.address })
    const cookie = n.ultimoSetCookie.find((c) => c.startsWith('dg_wchal='))
    confere('nonce emite desafio com dominio e endereco', r.status === 200 && r.json.message.includes('URI: https://www.dogdata.xyz') && r.json.message.includes(v.address), r.status)
    confere('cookie do desafio e HttpOnly e SameSite=Lax', /httponly/i.test(cookie ?? '') && /samesite=lax/i.test(cookie ?? ''), cookie?.split(';').slice(1).join(';').trim())
    if (modoProd) confere('cookie do desafio e Secure em producao', /secure/i.test(cookie ?? ''))

    const estranho = new Navegador(ipNovo())
    const sem = await estranho.pedir('POST', '/api/wallet/verify', { address: v.address, signature: v.assinar(r.json.message), protocol: 'bip340-schnorr', publicKey: v.publicKey })
    confere('assinatura valida sem o cookie do navegador nao abre sessao', sem.status === 400 && !estranho.cookies.has('dg_wallet'), sem.status)

    const outroDesafio = await estranho.pedir('POST', '/api/wallet/nonce', { address: v.address })
    confere('estranho pede desafio com o endereco de outro', outroDesafio.status === 200)

    const atacante = carteira()
    let f = await provar(n, v, atacante.assinar(r.json.message), atacante.publicKey)
    confere('chave de outra pessoa nao prova este endereco', f.status === 401 && !n.cookies.has('dg_wallet'), f.status)
    f = await provar(n, v, v.assinar('outra mensagem'))
    confere('assinatura de outra mensagem e recusada', f.status === 401, f.status)
    f = await n.pedir('POST', '/api/wallet/verify', { address: v.address, signature: 'zz', protocol: 'bip322' })
    confere('assinatura lixo nao derruba a rota', f.status === 401 && semVazar(f.texto), f.status)
    f = await n.pedir('POST', '/api/wallet/verify', { address: v.address, signature: 'aa', protocol: 'nenhum' })
    confere('protocolo desconhecido e recusado', f.status === 400, f.status)

    const assinatura = v.assinar(r.json.message)
    f = await provar(n, v, assinatura)
    confere('o desafio do dono sobreviveu ao estranho, e a assinatura certa abre sessao', f.status === 200 && f.json.ok === true && n.cookies.has('dg_wallet'), f.status)
    const sc = n.ultimoSetCookie.find((c) => c.startsWith('dg_wallet='))
    confere('cookie de sessao e HttpOnly e SameSite=Lax', /httponly/i.test(sc ?? '') && /samesite=lax/i.test(sc ?? ''))
    if (modoProd) confere('cookie de sessao e Secure em producao', /secure/i.test(sc ?? ''))

    const dono = n.cookies.get('dg_wallet')
    n.cookies.set('dg_wchal', 'a'.repeat(32))
    f = await provar(n, v, assinatura)
    confere('replay da mesma assinatura e recusado', f.status === 400, f.status)
    n.cookies.set('dg_wallet', dono)

    r = await n.pedir('GET', '/api/wallet/session')
    confere('sessao devolve o endereco provado, sem cache', r.json.session?.address === v.address && /no-store/.test(r.cab.get('cache-control') ?? ''), r.cab.get('cache-control'))

    // concorrencia: a mesma assinatura em 8 pedidos simultaneos abre uma sessao so'
    const par = new Navegador(ipNovo())
    const des = await par.pedir('POST', '/api/wallet/nonce', { address: v.address })
    const sig = v.assinar(des.json.message)
    const res = await Promise.all(Array.from({ length: 8 }, () => provar(par, v, sig)))
    const abertas = res.filter((x) => x.status === 200).length
    confere('8 verify simultaneos com a mesma assinatura: 1 sessao', abertas === 1, `${abertas} de 8`)

    // prazo do desafio
    const venc = new Navegador(ipNovo())
    const dv = await venc.pedir('POST', '/api/wallet/nonce', { address: v.address })
    relogioMs += 301_000
    f = await provar(venc, v, v.assinar(dv.json.message))
    confere('desafio vencido (5 min) e recusado', f.status === 400, f.status)

    // logout revoga de verdade: o cookie antigo nao vale mais
    const velho = n.cookies.get('dg_wallet')
    r = await n.pedir('DELETE', '/api/wallet/session')
    confere('logout responde e limpa o cookie', r.status === 200 && !n.cookies.has('dg_wallet'), r.status)
    n.cookies.set('dg_wallet', velho)
    r = await n.pedir('GET', '/api/game/save')
    confere('cookie de sessao revogada nao abre rota protegida', r.status === 401, r.status)
    n.cookies.delete('dg_wallet')

    // logar de novo mata a sessao anterior do navegador
    const l = new Navegador(ipNovo())
    await logar(l, v)
    const antes = l.cookies.get('dg_wallet')
    await logar(l, v)
    const nova = new Navegador(ipNovo())
    nova.cookies.set('dg_wallet', antes)
    r = await nova.pedir('GET', '/api/game/save')
    confere('novo login revoga a sessao anterior do navegador', r.status === 401 && l.cookies.get('dg_wallet') !== antes, r.status)

    // sessao vencida
    const s = new Navegador(ipNovo())
    await logar(s, v)
    relogioMs += 31 * 24 * 3600_000
    r = await s.pedir('GET', '/api/game/save')
    confere('sessao vencida (30 dias) nao abre rota protegida', r.status === 401, r.status)
  }

  console.log('\n--- rotas protegidas sem login, e com cookie forjado')
  {
    const n = new Navegador(ipNovo())
    const forjado = new Navegador(ipNovo())
    forjado.cookies.set('dg_wallet', 'forjado-' + randomBytes(8).toString('hex'))
    const lista = [
      ['GET', '/api/game/save'], ['PUT', '/api/game/save', { save: { v: 1 } }], ['GET', '/api/game/checkin'], ['POST', '/api/game/checkin'],
      ['POST', '/api/profile', { handle: 'atacante_01' }], ['POST', '/api/profile/avatar', { inscription_id: null }], ['POST', '/api/chat', { text: 'oi' }],
      ['POST', '/api/radiola/heartbeat', { seconds: 30 }], ['GET', '/api/referral/me'], ['POST', '/api/chat/nearby/presenca', { id: 'abc123def456' }],
    ]
    for (const [m, r, c] of lista) {
      const a = await n.pedir(m, r, c)
      const b = await forjado.pedir(m, r, c)
      confere(`${m} ${r} sem login e com cookie forjado`, a.status === 401 && b.status === 401, `${a.status}/${b.status}`)
    }
  }

  console.log('\n--- objeto de outra pessoa (horizontal)')
  {
    const a = carteira()
    const b = carteira()
    const na = new Navegador(ipNovo())
    const nb = new Navegador(ipNovo())
    await logar(na, a)
    await logar(nb, b)
    let r = await na.pedir('PUT', '/api/game/save', { save: { v: 1, economia: { saldo: 10 } } })
    confere('A grava o proprio save', r.status === 200, r.status)
    r = await nb.pedir('PUT', '/api/game/save', { wallet: a.address, address: a.address, save: { v: 1, economia: { saldo: 999 } } })
    confere('B manda o endereco de A no corpo do save', r.status === 200, r.status)
    r = await na.pedir('GET', '/api/game/save?wallet=' + b.address)
    confere('o save de A continua de A', r.json.save?.economia?.saldo === 10, r.json.save?.economia?.saldo)
    r = await nb.pedir('GET', '/api/game/save?wallet=' + a.address)
    confere('B pedindo o save de A pela URL recebe o proprio', r.json.save?.economia?.saldo === 999, r.json.save?.economia?.saldo)

    r = await na.pedir('POST', '/api/profile', { handle: 'dono_a_01', address: b.address })
    confere('A cria handle: o endereco do corpo e ignorado', r.status === 200 && r.json.address === a.address.toLowerCase(), r.json?.address?.slice(0, 8))
    r = await nb.pedir('POST', '/api/profile', { handle: 'dono_a_01' })
    confere('B nao toma o handle de A', r.status === 409, r.status)
  }

  console.log('\n--- papel de administrador (vertical)')
  {
    const comum = carteira()
    const n = new Navegador(ipNovo())
    await logar(n, comum)
    for (const rota of ['/api/admin/me', '/api/analytics/report', '/api/ads/report']) {
      const r = await n.pedir('GET', rota, undefined, { 'x-admin': 'true', 'x-role': 'admin' })
      confere(`${rota} para carteira comum que pede ser admin`, r.status === 404, r.status)
    }
    const na = new Navegador(ipNovo())
    let r = await logar(na, admin)
    r = await na.pedir('GET', '/api/admin/me')
    confere('a carteira da lista, recem provada, entra', r.status === 200 && r.json.admin === true, r.status)
    // o relogio do Next nao anda com o do Redis falso: quem envelhece e' o registro da sessao
    const reg = kv.get(`wsess:${na.cookies.get('dg_wallet')}`)
    reg.v = JSON.stringify({ ...JSON.parse(reg.v), verifiedAt: new Date(Date.now() - 25 * 3600_000).toISOString() })
    r = await na.pedir('GET', '/api/admin/me')
    confere('a mesma carteira com assinatura de mais de 24 h nao entra', r.status === 404, r.status)
    r = await new Navegador(ipNovo()).pedir('GET', '/api/radiola/ledger', undefined, { 'x-admin-key': 'errada' })
    confere('razao da Radiola com chave errada', r.status === 401, r.status)
    r = await new Navegador(ipNovo()).pedir('GET', '/api/radiola/ledger', undefined, { 'x-admin-key': 'radiola-sintetica' })
    // o HGETALL do Redis falso e' vazio: importa que a chave certa passe do portao
    confere('razao da Radiola com a chave certa passa do portao', r.status !== 401, r.status)
  }

  console.log('\n--- crons: nada de cabecalho forjado nem segredo em URL')
  {
    const n = new Navegador(ipNovo())
    const rotas = ['/cron/whale-poster', '/api/cron/whale-poster', '/cron/health-probes', '/api/update-transactions', '/api/stacks/snapshot', '/api/cron/referrals', '/api/cron/licence-btc']
    for (const rota of rotas) {
      const a = await n.pedir('GET', rota, undefined, { 'user-agent': 'vercel-cron/1.0', 'x-vercel-cron': '1' })
      const b = await n.pedir('GET', `${rota}?secret=your-secret-token-here`)
      const c = await n.pedir('GET', rota, undefined, { authorization: 'Bearer errado' })
      confere(`${rota} recusa UA forjado, ?secret= e Bearer errado`, a.status === 401 && b.status === 401 && c.status === 401, `${a.status}/${b.status}/${c.status}`)
    }
    const r = await n.pedir('GET', '/api/dog-rune/holders?snapshot=refresh')
    const gravou = tab('system_health_log').length
    confere('snapshot=refresh publico nao grava saude no banco', gravou === 0, `${r.status}, ${gravou} linhas`)
    const nc = await n.pedir('GET', '/api/dog-rune/holders?snapshot=refresh', undefined, { authorization: `Bearer ${CRON}` })
    confere('snapshot=refresh com o Bearer do cron passa', [200, 503].includes(nc.status), nc.status)
  }

  console.log('\n--- mensagens malformadas e grandes')
  {
    const v = carteira()
    const n = new Navegador(ipNovo())
    await logar(n, v)
    let r = await n.pedir('POST', '/api/profile', { handle: { a: 1 } })
    confere('handle objeto: 422, nao 500', r.status === 422, r.status)
    r = await n.pedir('POST', '/api/profile', { handle: '<script>x' })
    confere('handle com HTML e recusado', r.status === 422, r.status)
    r = await n.pedir('POST', '/api/profile', { handle: 'official' })
    confere('handle de papel da casa e recusado', r.status === 422, r.status)
    r = await n.pedir('POST', '/api/profile', { handle: 'jogador_01' })
    confere('handle normal e aceito', r.status === 200, r.status)
    for (const lixo of [7, ['x'], { a: 1 }, null]) {
      r = await n.pedir('POST', '/api/chat', { text: lixo })
      confere(`chat com text=${JSON.stringify(lixo)}: 422, nao 500`, r.status === 422, r.status)
    }
    r = await n.pedir('POST', '/api/chat', { text: 'x'.repeat(281) })
    confere('chat acima de 280 caracteres', r.status === 422, r.status)
    r = await n.pedir('POST', '/api/chat', { text: '<img src=x onerror=alert(1)>' })
    confere('chat guarda o texto como dado e responde JSON', r.status === 200 && r.json.message.text.startsWith('<img') && /application\/json/.test(r.cab.get('content-type') ?? ''), r.status)
    r = await n.pedir('POST', '/api/chat', { text: 'de novo' })
    confere('chat em menos de 3 s: 429', r.status === 429, r.status)
    r = await n.pedir('PUT', '/api/game/save', { save: { v: 2 } })
    confere('save de outra versao e recusado', r.status === 400, r.status)
    r = await n.pedir('PUT', '/api/game/save', { save: [] })
    confere('save que nao e objeto e recusado', r.status === 400, r.status)
    r = await n.pedir('PUT', '/api/game/save', { save: { v: 1, x: 'a'.repeat(200 * 1024) } })
    confere('save acima do teto e recusado', r.status === 413, r.status)
    r = await n.pedir('PUT', '/api/game/save', 'nao e json')
    confere('save que nao e JSON e recusado', r.status === 400, r.status)
    r = await new Navegador(ipNovo()).pedir('POST', '/api/ads/track', { event_type: 'click', advertiser: '<b>x', page: 'p' })
    confere('anuncio com anunciante invalido', r.status === 400, r.status)
    r = await new Navegador(ipNovo()).pedir('POST', '/api/ads/track', { event_type: 'click', page: 'x'.repeat(4000) })
    confere('anuncio com corpo grande', r.status === 413, r.status)
    r = await new Navegador(ipNovo()).pedir('POST', '/api/ads/track', { event_type: 'click', device_type: 'mobile', page: '/city' })
    confere('anuncio valido continua gravando', r.status === 200, r.status)
    r = await new Navegador(ipNovo()).pedir('POST', '/api/analytics/track', { event_type: 'pageview', page: 'x'.repeat(20 * 1024) })
    confere('telemetria com corpo grande', r.status === 413, r.status)
    r = await new Navegador(ipNovo()).pedir('POST', '/api/analytics/track', { event_type: 'pageview', page: '/city' })
    confere('telemetria valida continua respondendo', r.status === 204, r.status)
    r = await new Navegador(ipNovo()).pedir('POST', '/api/keys/generate', { name: { a: 1 }, email: 'a@b.co' })
    confere('chave de API com nome objeto', r.status === 400, r.status)
    r = await new Navegador(ipNovo()).pedir('GET', '/api/donate/verify?txid=../../etc/passwd')
    confere('doacao com txid fora de formato nao vira URL', r.status === 400, r.status)
    r = await new Navegador(ipNovo()).pedir('GET', '/api/inscription/..%2F..%2Fsecret/content')
    confere('inscricao com id fora de formato nao vira URL', [400, 404].includes(r.status), r.status)
  }

  console.log('\n--- freio por IP, dentro de limite seguro')
  {
    const n = new Navegador('203.0.113.200')
    const v = carteira()
    const st = []
    for (let i = 0; i < 31; i++) st.push((await n.pedir('POST', '/api/wallet/nonce', { address: v.address })).status)
    confere('nonce: 30 passam e o 31o volta 429', st.slice(0, 30).every((s) => s === 200) && st[30] === 429, `${st.filter((s) => s === 200).length} ok, ultimo ${st[30]}`)
    const outro = new Navegador('203.0.113.201')
    const r = await outro.pedir('POST', '/api/wallet/nonce', { address: v.address })
    confere('outro IP nao paga o freio de ninguem', r.status === 200, r.status)
    // os freios caros sao semeados, sem bater em fonte externa
    for (const [balde, teto, m, rota, corpo] of [
      ['apikeys', 5, 'POST', '/api/keys/generate', { name: 'n', email: 'a@b.co' }],
      ['licencequote', 120, 'POST', '/api/dogcity/licence-quote', { tier: 'personal' }],
      ['donateverify', 60, 'GET', `/api/donate/verify?txid=${'a'.repeat(64)}`],
      ['wverify', 30, 'POST', '/api/wallet/verify', { address: v.address, signature: 'aa', protocol: 'bip322' }],
      ['adstrack', 60, 'POST', '/api/ads/track', { event_type: 'click' }],
    ]) {
      const ip = ipNovo()
      kv.set(`freio:${balde}:${ip}`, { v: String(teto), ate: agora() + 60_000 })
      const q = await new Navegador(ip).pedir(m, rota, corpo)
      confere(`${rota.split('?')[0]} acima de ${teto}: 429`, q.status === 429, q.status)
    }
  }

  console.log('\n--- concorrencia em operacao idempotente')
  {
    const v = carteira()
    const n = new Navegador(ipNovo())
    await logar(n, v)
    const res = await Promise.all(Array.from({ length: 12 }, () => n.pedir('POST', '/api/game/checkin')))
    const pagos = res.filter((r) => r.json?.justClaimed === true).length
    const linhas = tab('dogcity_game_checkins').filter((l) => l.wallet === v.address).length
    confere('12 check-ins simultaneos: um dia marcado e uma recompensa', pagos === 1 && linhas === 1, `${pagos} recompensa, ${linhas} linha`)
    const a = await n.pedir('PUT', '/api/game/save', { save: { v: 1, n: 1 } })
    const b = await n.pedir('PUT', '/api/game/save', { save: { v: 1, n: 2 } })
    confere('duas gravacoes do save em 10 s: a segunda volta 429', a.status === 200 && b.status === 429, `${a.status}/${b.status}`)
  }

  console.log('\n--- carimbo de identidade da presenca')
  {
    const v = carteira()
    const n = new Navegador(ipNovo())
    await logar(n, v)
    await n.pedir('POST', '/api/profile', { handle: 'carimbo_01' })
    const id = randomBytes(6).toString('hex')
    let r = await n.pedir('POST', '/api/chat/nearby/presenca', { id })
    const d = r.json?.ass ? JSON.parse(r.json.ass.d) : null
    confere('o carimbo leva o handle e o endereco da sessao', r.status === 200 && d?.k === 'presenca' && d?.id === id && d?.n === '@carimbo_01' && d?.e === v.address.toLowerCase(), r.status)
    const chave = await new Navegador(ipNovo()).pedir('GET', '/api/chat/nearby/key')
    const k = await webcrypto.subtle.importKey('jwk', { ...chave.json.key, ext: true }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify'])
    const sig = Buffer.from(r.json.ass.s, 'base64url')
    const vale = await webcrypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, k, sig, new TextEncoder().encode(r.json.ass.d))
    confere('o carimbo confere com a chave publica', vale === true)
    const outro = new Navegador(ipNovo())
    await logar(outro, carteira())
    r = await outro.pedir('POST', '/api/chat/nearby/presenca', { id })
    confere('outra sessao nao pega carimbo no id de quem ja esta na cidade', r.status === 409, r.status)
    r = await outro.pedir('POST', '/api/chat/nearby/presenca', { id: '../x' })
    confere('id fora de formato', r.status === 400, r.status)
    r = await outro.pedir('POST', '/api/chat/nearby/presenca', { id: randomBytes(6).toString('hex'), handle: 'lima', address: admin.address })
    const dd = r.json?.ass ? JSON.parse(r.json.ass.d) : null
    confere('nome e endereco no corpo sao ignorados', dd?.n !== '@lima' && dd?.e !== admin.address.toLowerCase(), dd?.n)
  }

  console.log('\n--- integracao externa fora do ar: falha fechada e sem vazar detalhe')
  {
    const v = carteira()
    const n = new Navegador(ipNovo())
    await logar(n, v)
    supaFora = true
    let r = await n.pedir('GET', '/api/game/save')
    confere('banco fora: save responde erro generico', r.status === 500 && semVazar(r.texto), `${r.status} ${r.texto.slice(0, 40)}`)
    r = await n.pedir('POST', '/api/chat', { text: 'oi' })
    confere('banco fora: chat responde erro generico', r.status === 500 && semVazar(r.texto), r.status)
    supaFora = false
    const na = new Navegador(ipNovo())
    await logar(na, admin)
    redisFora = true
    r = await new Navegador(ipNovo()).pedir('POST', '/api/wallet/nonce', { address: v.address })
    confere('Redis fora: nonce responde erro generico', r.status === 500 && semVazar(r.texto), `${r.status} ${r.texto.slice(0, 50)}`)
    // com o cookie do desafio, para a rota precisar do Redis
    n.cookies.set('dg_wchal', 'a'.repeat(32))
    r = await n.pedir('POST', '/api/wallet/verify', { address: v.address, signature: 'aa', protocol: 'bip322' })
    confere('Redis fora: verify responde erro generico', r.status === 500 && semVazar(r.texto), `${r.status} ${r.texto.slice(0, 50)}`)
    r = await na.pedir('GET', '/api/admin/me')
    confere('Redis fora: a sala de admin fecha', r.status === 404, r.status)
    r = await n.pedir('GET', '/api/game/save')
    confere('Redis fora: rota protegida nao abre', r.status >= 400 && r.status !== 200 && semVazar(r.texto), r.status)
    redisFora = false
    r = await new Navegador(ipNovo()).pedir('POST', '/api/wallet/nonce', { address: v.address })
    confere('Redis de volta: o login volta sozinho', r.status === 200, r.status)
  }
} catch (e) {
  confere('o banco de provas terminou sem erro', false, e?.message)
  console.error(logNext.slice(-1500))
}

console.log(`\n${ok} passaram, ${falhas.length} falharam`)
for (const f of falhas) console.log('  FALHOU: ' + f)
// o log nao pode ter levado nada que identifique alguem nem segredo
const linhasSeg = logNext.split('\n').filter((l) => l.includes('"seg":'))
const vazou = linhasSeg.filter((l) => /198\.51\.100|203\.0\.113/.test(l) || l.includes(CRON)).length
console.log(`log de seguranca: ${linhasSeg.length} eventos, ${vazou} com IP cru ou segredo; tipos: ${[...new Set(linhasSeg.map((l) => { try { return JSON.parse(l.slice(l.indexOf('{'))).seg } catch { return '?' } }))].join(', ')}`)
fim(falhas.length || vazou ? 1 : 0)
