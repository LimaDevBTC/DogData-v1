import assert from 'node:assert/strict'
import * as THREE from 'three'
import { criarAtletismo, ATLETISMO_BASE_URL, ATLETISMO_DETAIL_URL } from '../../app/city/plaza/atletismo-loader'

const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve() }
function pendente<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => { resolve = r })
  return { promise, resolve }
}
function cenario(tier: 'mobile' | 'desktop', quality: 'low' | 'balanced' = 'balanced', economizarDados = false) {
  const pedidos: string[] = []
  const fila: ReturnType<typeof pendente<THREE.Object3D>>[] = []
  const estadio = criarAtletismo({
    profile: { tier, quality }, alturaEm: () => 0, economizarDados,
    preparar: async () => {},
    carregar: (url) => { pedidos.push(url); const p = pendente<THREE.Object3D>(); fila.push(p); return p.promise },
  })
  return { estadio, pedidos, fila, perto: estadio.group.position.clone().add(new THREE.Vector3(0, 40, 200)) }
}

async function main() {
  for (const [tier, quality, save] of [['mobile', 'balanced', false], ['desktop', 'low', false], ['desktop', 'balanced', true]] as const) {
    const c = cenario(tier, quality, save)
    c.estadio.update(c.perto, false, 0)
    assert.deepEqual(c.pedidos, [], 'nenhuma rede antes de a cidade abrir')
    c.estadio.update(c.perto, true, 0)
    assert.deepEqual(c.pedidos, [ATLETISMO_BASE_URL])
    c.fila[0].resolve(new THREE.Group()); await flush()
    for (let t = 200; t <= 4000; t += 200) c.estadio.update(c.perto, true, t)
    assert.equal(c.estadio.group.visible, true, 'perfil leve mantém estádio visível perto')
    assert.deepEqual(c.pedidos, [ATLETISMO_BASE_URL], 'perfil leve não transfere detalhe')
    c.estadio.dispose()
  }
  {
    const c = cenario('desktop')
    const longe = c.perto.clone().add(new THREE.Vector3(2000, 0, 0))
    c.estadio.update(longe, true, 0)
    c.fila[0].resolve(new THREE.Group()); await flush()
    c.estadio.update(longe, true, 200)
    c.estadio.update(c.perto, true, 400)
    c.estadio.update(longe, true, 600)
    assert.equal(c.pedidos.length, 1, 'passagem rápida não baixa detalhe')
    for (let t = 800; t <= 1400; t += 200) c.estadio.update(c.perto, true, t)
    assert.deepEqual(c.pedidos, [ATLETISMO_BASE_URL, ATLETISMO_DETAIL_URL])
    c.estadio.update(longe, true, 1600)
    const detalhe = new THREE.Group(); c.fila[1].resolve(detalhe); await flush()
    assert.equal(detalhe.visible, false, 'resposta tardia respeita distância atual')
    c.estadio.update(c.perto, true, 1800)
    assert.equal(detalhe.visible, true)
    c.estadio.update(longe, true, 2000)
    assert.equal(detalhe.visible, false)
    c.estadio.update(c.perto, true, 2200)
    assert.equal(c.pedidos.length, 2, 'voltar reutiliza o detalhe já carregado')
    c.estadio.dispose()
  }
  {
    const c = cenario('mobile')
    c.estadio.update(c.perto, true, 0)
    c.estadio.dispose(); c.estadio.dispose()
    const g = new THREE.Group(), geo = new THREE.BoxGeometry(), mat = new THREE.MeshBasicMaterial()
    let geos = 0, mats = 0
    geo.addEventListener('dispose', () => geos++)
    mat.addEventListener('dispose', () => mats++)
    g.add(new THREE.Mesh(geo, mat), new THREE.Mesh(geo, mat))
    c.fila[0].resolve(g); await flush()
    assert.equal(c.estadio.group.children.length, 0, 'não anexa resultado depois de sair da cena')
    assert.equal(geos, 1); assert.equal(mats, 1)
    c.estadio.update(c.perto, true, 1000)
    assert.equal(c.pedidos.length, 1)
  }
  {
    let tentativas = 0
    const c = criarAtletismo({ profile: { tier: 'desktop', quality: 'balanced' }, alturaEm: () => 0,
      preparar: async () => {}, carregar: async () => { tentativas++; throw new Error('falha simulada') } })
    const anterior = console.error
    console.error = () => {}
    try {
      c.update(c.group.position, true, 0); await flush()
      for (let t = 200; t <= 2000; t += 200) c.update(c.group.position, true, t)
      assert.equal(c.group.userData.atletismo.base, 'error')
      assert.equal(tentativas, 1, 'falha não dispara tempestade de requisições')
    } finally { console.error = anterior; c.dispose() }
  }
  console.log('PASS: portão de carga, celular, economia de dados, aproximação, LOD, falha isolada e descarte assíncrono')
}
main().catch((err) => { console.error(err); process.exitCode = 1 })
