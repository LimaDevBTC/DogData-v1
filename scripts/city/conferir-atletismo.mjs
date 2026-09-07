// Mesmo portão de chapas.mjs: UMA cidade, UM navegador, fechamento no finally.
// node scripts/city/conferir-atletismo.mjs [--mobile]
import { chromium } from '/home/bitmax/.npm/_npx/705bc6b22212b352/node_modules/playwright/index.mjs'
import { mkdirSync, writeFileSync } from 'node:fs'
import assert from 'node:assert/strict'

const mobile = process.argv.includes('--mobile')
const perfil = mobile ? 'mobile' : 'desktop'
const out = '/tmp/dogcity-atletismo/browser'
mkdirSync(out, { recursive: true })
const requests = [], errors = [], warnings = [], logs = []
const started = Date.now()
// O headless-shell padrão força software nesta máquina. Chrome com --enable-gpu
// usa o driver/X11 disponível e evita medir uma cidade de milhões de polígonos
// em SwiftShader. Fonte: Chromium docs/gpu/using-gpu-hardware-in-headless-chrome.md.
const nav = await chromium.launch({ channel: 'chrome', args: ['--enable-gpu'] })
let page
let heartbeat
const report = { perfil, requests, errors, warnings, logs }
try {
  const context = await nav.newContext(mobile ? {
    viewport: { width: 844, height: 390 }, deviceScaleFactor: 1,
    isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  } : { viewport: { width: 960, height: 600 }, deviceScaleFactor: 1 })
  page = await context.newPage()
  report.renderer = await page.evaluate(() => {
    const canvas = document.createElement('canvas'), gl = canvas.getContext('webgl2')
    if (!gl) return 'WebGL2 indisponível'
    const ext = gl.getExtension('WEBGL_debug_renderer_info')
    const renderer = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return renderer
  })
  console.log(`Renderer: ${report.renderer}`)
  assert(!/SwiftShader|llvmpipe|indisponível/i.test(report.renderer), 'Conferência requer GPU disponível')
  // A frente da Sphere pode continuar editando. Esta aba mede a versão que
  // carregou; não disputa HMR nem refaz o boot a cada arquivo salvo por ela.
  await page.routeWebSocket('**/_next/webpack-hmr', () => {})
  heartbeat = setInterval(() => {
    console.log(`Conferência ${perfil}: ${Math.round((Date.now() - started) / 1000)} s; pedidos atletismo=${requests.length}; erros=${errors.length}`)
  }, 20000)
  await page.addInitScript(() => {
    window.__athContextLost = 0
    document.addEventListener('webglcontextlost', () => window.__athContextLost++, true)
  })
  page.on('request', (r) => {
    if (/dog-athletics/.test(r.url())) requests.push({ url: r.url(), ms: Date.now() - started })
  })
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
    if (m.type() === 'warning') warnings.push(m.text())
    if (/atletismo/.test(m.text())) logs.push(m.text())
    if (/\[atletismo\]/.test(m.text())) console.log(m.text())
  })
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  console.log(`Abrindo ${perfil}; aguarda o portão explícito da cidade`)
  await page.goto('http://localhost:3000/city?view=esportes&live=0&stats=1&quality=balanced', { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.waitForFunction(() => window.__plazaPronto === true, null, { timeout: 480000 })
  report.cityReadyMs = Date.now() - started
  console.log(`Cidade aberta (${report.cityReadyMs} ms); aguardando base do estádio`)
  await page.waitForFunction(() => window.__plazaScene?.getObjectByName('DOG_ATHLETICS')?.userData.atletismo?.base === 'ready', null, { timeout: 90000 })
  await page.waitForTimeout(2500)
  const sample = () => page.evaluate(() => {
    const g = window.__plazaScene.getObjectByName('DOG_ATHLETICS')
    let triangles = 0, meshes = 0, textures = 0
    g.traverseVisible((n) => {
      if (!n.isMesh) return
      meshes++
      triangles += (n.geometry.index?.count ?? n.geometry.attributes.position.count) / 3
      for (const m of Array.isArray(n.material) ? n.material : [n.material])
        for (const v of Object.values(m)) if (v?.isTexture) textures++
    })
    return { state: { ...g.userData.atletismo }, visible: g.visible, position: g.position.toArray(), triangles, meshes, textures,
      contextLost: window.__athContextLost, stats: window.__plazaStats,
      detailVisible: g.getObjectByName('ATHLETICS_DETAIL')?.visible ?? false }
  })
  report.far = await sample()
  assert.equal(report.far.state.base, 'ready')
  assert.equal(requests.filter((r) => /detail/.test(r.url)).length, 0, 'não baixa detalhe na vista do complexo')
  await page.screenshot({ path: `${out}/${perfil}-complexo.jpg`, type: 'jpeg', quality: 85, timeout: 180000 })
  console.log('Complexo conferido; aproximando pela opção DOG Athletics do menu Places')
  await page.getByRole('button', { name: /^Places/ }).click()
  await page.getByRole('button', { name: /^DOG Athletics/ }).click()
  if (!mobile) await page.waitForFunction(() => window.__plazaScene.getObjectByName('DOG_ATHLETICS').userData.atletismo.detalhe === 'ready', null, { timeout: 90000 })
  await page.waitForTimeout(3000)
  report.near = await sample()
  assert.equal(report.near.visible, true)
  assert.equal(report.near.textures, 0)
  assert.equal(report.near.contextLost, 0)
  assert.equal(report.near.stats.tier, mobile ? 'mobile' : 'desktop')
  assert.equal(requests.filter((r) => /base/.test(r.url)).length, 1)
  assert.equal(requests.filter((r) => /detail/.test(r.url)).length, mobile ? 0 : 1)
  assert(report.near.triangles <= (mobile ? 15000 : 65000))
  assert(report.near.meshes <= (mobile ? 16 : 28))
  await page.screenshot({ path: `${out}/${perfil}-atletismo.jpg`, type: 'jpeg', quality: 90, timeout: 180000 })
  // Vista baixa e aproximada, por contrato de câmera local da própria peça.
  await page.evaluate(() => {
    const g = window.__plazaScene.getObjectByName('DOG_ATHLETICS'), T = window.__plazaTHREE
    const p = g.localToWorld(new T.Vector3(200, 100, 260))
    const target = g.localToWorld(new T.Vector3(0, 8, 0))
    window.__plazaOlhar(p.x, p.y, p.z, target.x, target.y, target.z, 45)
  })
  await page.waitForTimeout(2000)
  await page.screenshot({ path: `${out}/${perfil}-perto.jpg`, type: 'jpeg', quality: 90, timeout: 180000 })
  assert(!errors.some((e) => /pageerror|atletismo|shader error|THREE.WebGLProgram/i.test(e)), 'erro novo da integração ou shader')
  report.ok = true
  console.log(JSON.stringify({ ok: true, perfil, far: report.far, near: report.near, requests, errors }, null, 2))
} catch (err) {
  report.ok = false
  report.failure = String(err)
  console.error(err)
  if (page) {
    try { report.diagnostic = await page.evaluate(() => ({ ready: window.__plazaPronto,
      athletics: window.__plazaScene?.getObjectByName('DOG_ATHLETICS')?.userData,
      stats: window.__plazaStats, text: document.body.innerText.slice(0, 900) })) } catch {}
  }
  process.exitCode = 1
} finally {
  report.elapsedMs = Date.now() - started
  writeFileSync(`${out}/${perfil}.json`, JSON.stringify(report, null, 2))
  clearInterval(heartbeat)
  await nav.close()
}
