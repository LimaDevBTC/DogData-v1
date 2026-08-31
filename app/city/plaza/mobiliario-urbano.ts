// ═══════════════════════════════════════════════════════════════════════════
// MOBILIÁRIO URBANO: a infraestrutura que faz a malha virar cidade à noite.
//
// Vias sem luminária têm escala de loteamento: há geometria, mas nenhuma medida
// humana, nenhuma cadência e nenhum motivo para atravessar a cidade depois do
// pôr do sol. Este módulo desenha um único tipo de poste, repetido com disciplina
// nas avenidas e nos anéis. Não é decoração de praça: acompanha a rede viária.
//
// Duas InstancedMesh (mastro e luminária) mantêm milhares de pontos de luz em
// duas chamadas de desenho. A cidade já é grande; objetos individuais aqui seriam
// a maneira errada de ganhar detalhe.
// ═══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three'
import { AVENIDAS, avenidasGeom } from './teia'

export interface AnelViario { r: number; larg: number }
export interface MobiliarioUrbanoOpts {
  heightAt: (x: number, z: number) => number
  /** A malha viária termina na baía; iluminação também. */
  molhado?: (x: number, z: number) => boolean
  aneis: AnelViario[]
  sombra?: boolean
}

export interface MobiliarioUrbano {
  group: THREE.Group
  postes: number
  dispose(): void
}

const PASSO_AVENIDA = 36
const PASSO_ANEL = 44
const MAX_POSTES = 7200

export function buildMobiliarioUrbano(o: MobiliarioUrbanoOpts): MobiliarioUrbano {
  const group = new THREE.Group()
  group.name = 'mobiliario-urbano'
  const pontos: { x: number; z: number; giro: number }[] = []
  const molhado = o.molhado ?? (() => false)

  const por = (x: number, z: number, giro: number) => {
    if (pontos.length >= MAX_POSTES || molhado(x, z)) return
    pontos.push({ x, z, giro })
  }

  // Em avenidas, os mastros ficam no passeio, voltados para a pista. As duas
  // fileiras alternam meio passo: a rua ganha ritmo sem parecer pista de pouso.
  for (const av of avenidasGeom()) {
    const dx = av.x1 - av.x0, dz = av.z1 - av.z0
    const L = Math.hypot(dx, dz)
    const ux = dx / L, uz = dz / L
    const px = -uz, pz = ux
    const distBorda = av.largura / 2 - 2.15
    for (const lado of [-1, 1]) {
      const inicio = lado < 0 ? PASSO_AVENIDA * 0.5 : PASSO_AVENIDA
      for (let d = inicio; d < L - 22; d += PASSO_AVENIDA) {
        por(av.x0 + ux * d + px * distBorda * lado,
            av.z0 + uz * d + pz * distBorda * lado,
            Math.atan2(uz, ux) + (lado < 0 ? Math.PI : 0))
      }
    }
  }

  // Os anéis são polígonos, como as vias em vias.ts: a iluminação percorre cada
  // corda entre rotatórias, em vez de desenhar um círculo que escaparia da rua.
  for (const anel of o.aneis) {
    for (let i = 0; i < AVENIDAS.length; i++) {
      const a0 = (i / AVENIDAS.length) * Math.PI * 2
      const a1 = ((i + 1) / AVENIDAS.length) * Math.PI * 2
      const x0 = Math.sin(a0) * anel.r, z0 = -Math.cos(a0) * anel.r
      const x1 = Math.sin(a1) * anel.r, z1 = -Math.cos(a1) * anel.r
      const dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz)
      const ux = dx / L, uz = dz / L
      const px = -uz, pz = ux
      const distBorda = anel.larg / 2 - 1.8
      for (const lado of [-1, 1]) {
        const inicio = lado < 0 ? PASSO_ANEL * 0.5 : PASSO_ANEL
        for (let d = inicio; d < L - 20; d += PASSO_ANEL) {
          por(x0 + ux * d + px * distBorda * lado,
              z0 + uz * d + pz * distBorda * lado,
              Math.atan2(uz, ux) + (lado < 0 ? Math.PI : 0))
        }
      }
    }
  }

  // O mastro tem base, fuste e braço curto em uma geometria. A luminária é
  // separada para ter emissivo próprio — a forma continua legível de dia.
  const fuste = new THREE.CylinderGeometry(0.12, 0.19, 6.4, 8)
  fuste.translate(0, 3.2, 0)
  const base = new THREE.CylinderGeometry(0.34, 0.42, 0.18, 8)
  base.translate(0, 0.09, 0)
  const braco = new THREE.BoxGeometry(0.9, 0.10, 0.10)
  braco.translate(0.42, 6.22, 0)
  const posteGeo = merge([fuste, base, braco])
  const luzGeo = new THREE.CylinderGeometry(0.23, 0.18, 0.18, 8)
  luzGeo.rotateZ(Math.PI / 2)
  luzGeo.translate(0.88, 6.18, 0)

  const posteMat = new THREE.MeshStandardMaterial({ color: '#272A30', roughness: 0.42, metalness: 0.78 })
  const luzMat = new THREE.MeshStandardMaterial({ color: '#FFD59A', emissive: '#F6A74B', emissiveIntensity: 2.2, roughness: 0.32, metalness: 0.08 })
  const mastros = new THREE.InstancedMesh(posteGeo, posteMat, Math.max(1, pontos.length))
  const luminarias = new THREE.InstancedMesh(luzGeo, luzMat, Math.max(1, pontos.length))
  mastros.name = 'urbano:mastros'
  luminarias.name = 'urbano:luminarias'
  mastros.castShadow = o.sombra ?? true
  mastros.receiveShadow = true
  luminarias.castShadow = false
  mastros.frustumCulled = false
  luminarias.frustumCulled = false

  const m = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1)
  const eixoY = new THREE.Vector3(0, 1, 0)
  pontos.forEach((pt, i) => {
    p.set(pt.x, o.heightAt(pt.x, pt.z) + 0.35, pt.z)
    q.setFromAxisAngle(eixoY, pt.giro)
    m.compose(p, q, s)
    mastros.setMatrixAt(i, m)
    luminarias.setMatrixAt(i, m)
  })
  mastros.instanceMatrix.needsUpdate = true
  luminarias.instanceMatrix.needsUpdate = true
  group.add(mastros, luminarias)

  return {
    group,
    postes: pontos.length,
    dispose() {
      posteGeo.dispose(); luzGeo.dispose(); posteMat.dispose(); luzMat.dispose(); group.clear()
    },
  }
}

function merge(geometrias: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const pos: number[] = [], nor: number[] = [], ind: number[] = []
  for (const g of geometrias) {
    const base = pos.length / 3
    const p = g.getAttribute('position') as THREE.BufferAttribute
    const n = g.getAttribute('normal') as THREE.BufferAttribute
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i))
      nor.push(n.getX(i), n.getY(i), n.getZ(i))
    }
    const ix = g.getIndex()
    if (ix) for (let i = 0; i < ix.count; i++) ind.push(base + ix.getX(i))
    else for (let i = 0; i < p.count; i++) ind.push(base + i)
    g.dispose()
  }
  const out = new THREE.BufferGeometry()
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  out.setIndex(ind)
  return out
}
