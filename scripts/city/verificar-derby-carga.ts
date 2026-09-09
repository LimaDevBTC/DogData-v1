/**
 * DOG DERBY: o ciclo de carga do loader, sem navegador.
 *   npx tsx scripts/city/verificar-derby-carga.ts
 *
 * ⚠️ ESTE É O PAR DO PORTÃO DE NAVEGADOR, e os dois medem coisas diferentes.
 * `conferir-derby.mjs` mede a peça numa cidade real com GPU, o que é lento e
 * pede servidor no ar. Este mede a LÓGICA do loader em milissegundos e cobre o
 * que o navegador não consegue provocar de propósito: rede que falha, resposta
 * que chega depois de a câmera ir embora, dispose duplo, passagem voando.
 *
 * Cenários: portão de rede (nada antes de a cidade abrir), celular e economia de
 * dados (nunca pedem detalhe), aproximação com histerese, resposta tardia,
 * descarte assíncrono e falha isolada sem tempestade de requisições.
 */
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { criarDerby, DERBY_BASE_URL, DERBY_DETAIL_URL } from '../../app/city/plaza/derby-loader'

const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve() }
function pendente<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => { resolve = r })
  return { promise, resolve }
}
function cenario(tier: 'mobile' | 'desktop', quality: 'low' | 'balanced' = 'balanced', economizarDados = false) {
  const pedidos: string[] = []
  const fila: ReturnType<typeof pendente<THREE.Object3D>>[] = []
  const peca = criarDerby({
    profile: { tier, quality }, alturaEm: () => 0, economizarDados,
    preparar: async () => {},
    carregar: (url) => { pedidos.push(url); const p = pendente<THREE.Object3D>(); fila.push(p); return p.promise },
  })
  return { peca, pedidos, fila, perto: peca.group.position.clone().add(new THREE.Vector3(0, 40, 200)) }
}

async function main() {
  for (const [tier, quality, save] of [['mobile', 'balanced', false], ['desktop', 'low', false], ['desktop', 'balanced', true]] as const) {
    const c = cenario(tier, quality, save)
    c.peca.update(c.perto, false, 0)
    assert.deepEqual(c.pedidos, [], 'nenhuma rede antes de a cidade abrir')
    c.peca.update(c.perto, true, 0)
    assert.deepEqual(c.pedidos, [DERBY_BASE_URL])
    c.fila[0].resolve(new THREE.Group()); await flush()
    for (let t = 200; t <= 4000; t += 200) c.peca.update(c.perto, true, t)
    assert.equal(c.peca.group.visible, true, 'perfil leve mantém o canódromo visível perto')
    assert.deepEqual(c.pedidos, [DERBY_BASE_URL], 'perfil leve não transfere detalhe')
    c.peca.dispose()
  }
  {
    const c = cenario('desktop')
    const longe = c.perto.clone().add(new THREE.Vector3(2000, 0, 0))
    c.peca.update(longe, true, 0)
    c.fila[0].resolve(new THREE.Group()); await flush()
    c.peca.update(longe, true, 200)
    c.peca.update(c.perto, true, 400)
    c.peca.update(longe, true, 600)
    assert.equal(c.pedidos.length, 1, 'passagem rápida não baixa detalhe')
    for (let t = 800; t <= 1400; t += 200) c.peca.update(c.perto, true, t)
    assert.deepEqual(c.pedidos, [DERBY_BASE_URL, DERBY_DETAIL_URL])
    c.peca.update(longe, true, 1600)
    const detalhe = new THREE.Group(); c.fila[1].resolve(detalhe); await flush()
    assert.equal(detalhe.visible, false, 'resposta tardia respeita distância atual')
    c.peca.update(c.perto, true, 1800)
    assert.equal(detalhe.visible, true)
    c.peca.update(longe, true, 2000)
    assert.equal(detalhe.visible, false)
    c.peca.update(c.perto, true, 2200)
    assert.equal(c.pedidos.length, 2, 'voltar reutiliza o detalhe já carregado')
    c.peca.dispose()
  }
  {
    const c = cenario('mobile')
    c.peca.update(c.perto, true, 0)
    c.peca.dispose(); c.peca.dispose()
    const g = new THREE.Group(), geo = new THREE.BoxGeometry(), mat = new THREE.MeshBasicMaterial()
    let geos = 0, mats = 0
    geo.addEventListener('dispose', () => geos++)
    mat.addEventListener('dispose', () => mats++)
    g.add(new THREE.Mesh(geo, mat), new THREE.Mesh(geo, mat))
    c.fila[0].resolve(g); await flush()
    assert.equal(c.peca.group.children.length, 0, 'não anexa resultado depois de sair da cena')
    assert.equal(geos, 1); assert.equal(mats, 1)
    c.peca.update(c.perto, true, 1000)
    assert.equal(c.pedidos.length, 1)
  }
  {
    let tentativas = 0
    const c = criarDerby({ profile: { tier: 'desktop', quality: 'balanced' }, alturaEm: () => 0,
      preparar: async () => {}, carregar: async () => { tentativas++; throw new Error('falha simulada') } })
    const anterior = console.error
    console.error = () => {}
    try {
      c.update(c.group.position, true, 0); await flush()
      for (let t = 200; t <= 2000; t += 200) c.update(c.group.position, true, t)
      assert.equal(c.group.userData.derby.base, 'error')
      assert.equal(tentativas, 1, 'falha não dispara tempestade de requisições')
    } finally { console.error = anterior; c.dispose() }
  }
  console.log('PASS derby: portão de rede, celular, economia de dados, aproximação, LOD, falha isolada e descarte assíncrono')
}
main().catch((err) => { console.error(err); process.exitCode = 1 })
