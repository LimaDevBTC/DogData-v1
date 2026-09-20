// ═══════════════════════════════════════════════════════════════════════════
// A LUNETA DA PRAÇA.
//
// 🔒 FUNDADOR, 2026-09-20: **"a lua é visível, não precisa de mirante com
// púlpito, coloque a luneta na praça principal, posicione ela ali em algum
// ponto e tá tudo certo."**
//
// ⚠️ ESTE ARQUIVO JÁ FOI `mirantes.ts` E TINHA DOIS MIRANTES COM DECK. Os dois
// caíram, e o histórico fica aqui para não ser reproposto:
//
//   1. mirante do PÓDIO, r 7.050. Barrado: medido com `naAlcaDeTerra`, o rumo 16
//      é alça de r 6.400 a 7.300 inteiro, e alça é Orla Nobre.
//   2. mirante na Orla Nobre, num dos 18 lotes do PROJETO da fileira da frente.
//      Tecnicamente cabia e o fundador tirou assim mesmo: aqueles lotes são
//      RESERVA DE VALOR (estoque para um mint público futuro), não sobra de
//      desenho. Ver `tiersposition.md` §3.1.
//   3. o deck da PRAÇA, 20 m de diâmetro com parapeito e escada. Retirado pelo
//      fundador: **o céu já está lá, o instrumento basta.**
//   4. o PLINTO de 30 cm que sobrou do deck. Também retirado, no mesmo dia:
//      *"luneta completamente funcional, porém sem pódio, na praça principal"*.
//      A luneta pousa no piso da praça como pousa um instrumento de verdade.
//
// ⚠️ A LIÇÃO, e ela vale para toda peça nova: a Terra não precisa de arquitetura
// para ser vista. Ela mede 1,9 grau, está parada no azimute 196 e não se põe. O
// que faltava nunca foi um púlpito, era um MOTIVO para olhar, e o motivo é a
// luneta: um objeto que diz "há o que ver ali" e que, clicado, abre a luneta de
// verdade (campo de 42 para 8 graus, em `plaza-scene`).
//
// Three.js puro (regra da casa: nada de react-three-fiber).
// ═══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three'
import type { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { carregarCenaGlb } from './carga-glb'

/** o azimute da Terra no céu, em graus. O mesmo de `plaza-scene`. */
export const AZ_TERRA = 196
/**
 * O rumo onde ela fica: oposto ao da Terra, para a cidade entrar no quadro.
 *
 * ⚠️ 26 E NÃO 16, E O MOTIVO É A ESFERA. Sondando a linha de visada real (raio
 * no azimute 196 e elevação 16, saindo da altura do olho, 1,6 m do chão):
 *
 *     rumo 340   Clouds a 37.422 m      a Terra, ceu livre
 *     rumo 350   prop:palm-date a 27 m  uma palmeira
 *     rumo   0   SPHERE_CASCA a 97 m    a Esfera
 *     rumo  16   SPHERE_CASCA a 211 m   a Esfera  <- o rumo "ideal"
 *     rumo  26   Clouds a 37.551 m      a Terra, ceu livre
 *     rumo  60   Kray_Tower_4 a 453 m   a torre
 *
 * O rumo 16 é o melhor enquadramento no papel e o pior na prática: a Esfera tapa
 * a Terra a 211 m. O 26 é o vizinho livre mais próximo, e 10 graus não mudam
 * nada na composição.
 */
export const RUMO_LUNETA = 26
/**
 * ⚠️ TRÊS POSIÇÕES ERRADAS ANTES DESTA, e as três me ensinaram a mesma coisa:
 *
 *   1.380  DENTRO do lago (sonda de terra contra água: água de 1.150 a 1.400)
 *   1.120  terra, mas regolito CRU. O instrumento ficou sozinho num areal
 *   1.005  idem. "Na praça principal" não é "perto da praça"
 *
 * ⚠️ AS TRÊS VIERAM DE PERGUNTAR A COISA ERRADA À SONDA. "É terra?" devolve um
 * número verdadeiro e uma conclusão falsa. A pergunta certa tem duas metades, e
 * a resposta é o PAR: **qual peça está sob o pé** e **o que a linha da Terra
 * encontra primeiro**. Perguntadas juntas, em 20 pontos:
 *
 *     r 780 e 840   piso Lawns      vista livre
 *     r 900         piso Paving     vista livre   <- passeio da praça
 *     r 940         piso Regolith   vista livre
 *
 * 900 é o passeio pavimentado que contorna a praça: piso de gente e céu livre.
 */
export const R_LUNETA = 900
/** a altura real do instrumento, em metros */
export const ALTURA = 1.6

export interface LunetaPraca {
  group: THREE.Group
  x: number
  z: number
  y: number
}

interface Opts {
  superficieAt: (x: number, z: number) => number
  gltf: GLTFLoader
}

export function buildLunetaPraca(o: Opts): LunetaPraca {
  const a = (RUMO_LUNETA * Math.PI) / 180
  const x = Math.sin(a) * R_LUNETA
  const z = -Math.cos(a) * R_LUNETA
  const y = o.superficieAt(x, z)

  const group = new THREE.Group()
  group.name = 'luneta-praca'
  group.position.set(x, y, z)

  void (async () => {
    try {
      const cena = await carregarCenaGlb(o.gltf, '/city/sf/luneta-tripe.glb', '[luneta] tripe')
      const caixa = new THREE.Box3().setFromObject(cena)
      const h = caixa.max.y - caixa.min.y || 1
      cena.scale.setScalar(ALTURA / h)
      const c2 = new THREE.Box3().setFromObject(cena)
      // ⚠️ O PÉ DO TRIPÉ NO CHÃO, SEM BASE NENHUMA: `-c2.min.y` põe a caixa do
      // modelo apoiada exatamente na cota do piso. Sem isso, um modelo cuja
      // origem não está na sola nasce enterrado ou flutuando, e num objeto de
      // 1,6 m os dois defeitos se veem de longe.
      cena.position.set(-(c2.min.x + c2.max.x) / 2, -c2.min.y, -(c2.min.z + c2.max.z) / 2)
      // ⚠️ SÓ GIRO EM Y. Inclinar o modelo para a elevação da Terra inclinaria o
      // TRIPÉ junto, e tripé torto lê como peça caída. Ela aponta o rumo certo;
      // a inclinação do tubo é a que o instrumento tem.
      const giro = new THREE.Group()
      giro.rotation.y = -((AZ_TERRA - RUMO_LUNETA) * Math.PI) / 180
      giro.add(cena)
      group.add(giro)
    } catch {
      // rede ou parse: a praça sobe sem o instrumento, e isso é melhor do que a
      // praça não subir. O clique na Terra continua abrindo a luneta.
    }
  })()

  return { group, x, z, y }
}
