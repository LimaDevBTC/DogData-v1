/**
 * Confere o plantio da orla nobre (`app/city/plaza/orla.ts`): nenhuma
 * palmeira na água, na pista ou na faixa de areia fora dos 30 nós, e o
 * alinhamento das duas fileiras contra o passo nominal (18 e 22 m).
 *
 *   npx tsx scripts/city/verificar-orla.ts
 *
 * Roda em número puro (sem THREE, sem navegador, sem canvas): as funções de
 * `orla.ts` que geram posição (`orlaFileiraA`, `orlaFileiraB`, `orlaNos`,
 * `orlaPassoReal`) não dependem do carregador de GLB nem da cena. O
 * triângulo total da cena (portão 1) é medido à parte, com Playwright contra
 * a página viva (ver o relatório da tarefa).
 */
import assert from 'node:assert/strict'
import {
  orlaFileiraA, orlaFileiraB, orlaNos, orlaPassoReal,
  ORLA_R_FILEIRA_A, ORLA_R_FILEIRA_B, ORLA_R_MEIO_FIO_PRAIA, ORLA_R_MEIO_FIO_MANSAO,
  ORLA_N_FILEIRA_A, ORLA_N_FILEIRA_B, ORLA_N_NOS,
  ORLA_PASSO_A_NOMINAL, ORLA_PASSO_B_NOMINAL,
} from '../../app/city/plaza/orla'
import { ALCA_R_BAIA, ALCA_PRAIA_LARGURA, ALCA_R_MAR } from '../../app/city/plaza/alca'

const PRAIA_R0 = ALCA_R_BAIA                      // 6.580, linha d'água
const PRAIA_R1 = ALCA_R_BAIA + ALCA_PRAIA_LARGURA // 6.660, pé do platô

function main() {
  const filA = orlaFileiraA()
  const filB = orlaFileiraB()
  const nos = orlaNos()

  console.log(`geometria: guia da praia r ${ORLA_R_MEIO_FIO_PRAIA}, guia das mansões r ${ORLA_R_MEIO_FIO_MANSAO}; `
    + `Fileira A r ${ORLA_R_FILEIRA_A} (${filA.length} de ${ORLA_N_FILEIRA_A} vagas, ${ORLA_N_FILEIRA_A - filA.length} em clareira), `
    + `Fileira B r ${ORLA_R_FILEIRA_B} (${filB.length} unidades); ${ORLA_N_NOS} nós`)

  // 1. nenhuma palmeira das fileiras dentro da água (r < ALCA_R_BAIA) ───────
  const molhadasA = filA.filter((p) => Math.hypot(p.x, p.z) <= ALCA_R_BAIA).length
  const molhadasB = filB.filter((p) => Math.hypot(p.x, p.z) <= ALCA_R_BAIA).length
  assert.equal(molhadasA, 0, `${molhadasA} unidades da Fileira A caíram na água`)
  assert.equal(molhadasB, 0, `${molhadasB} unidades da Fileira B caíram na água`)
  console.log('1. nenhuma unidade das fileiras está na água (r <= ALCA_R_BAIA)')

  // 2. nenhuma palmeira das fileiras dentro da pista (entre as duas guias) ──
  // ⚠️ É EXATAMENTE O ERRO QUE O CABEÇALHO DE `orla.ts` DOCUMENTA: um raio de
  // 6.705 (o "aproximado" do pedido) caía dentro da segunda faixa de pista.
  // Este teste é a prova de que o raio USADO (`ORLA_R_FILEIRA_A/B`) não erra
  // isso de novo.
  const naPistaA = filA.filter((p) => {
    const r = Math.hypot(p.x, p.z)
    return r >= ORLA_R_MEIO_FIO_PRAIA && r <= ORLA_R_MEIO_FIO_MANSAO
  }).length
  const naPistaB = filB.filter((p) => {
    const r = Math.hypot(p.x, p.z)
    return r >= ORLA_R_MEIO_FIO_PRAIA && r <= ORLA_R_MEIO_FIO_MANSAO
  }).length
  assert.equal(naPistaA, 0, `${naPistaA} unidades da Fileira A caíram dentro do envelope da avenida`)
  assert.equal(naPistaB, 0, `${naPistaB} unidades da Fileira B caíram dentro do envelope da avenida`)
  assert.ok(ORLA_R_FILEIRA_A < ORLA_R_MEIO_FIO_PRAIA, 'Fileira A não está do lado de fora (praia) da guia')
  assert.ok(ORLA_R_FILEIRA_B > ORLA_R_MEIO_FIO_MANSAO, 'Fileira B não está do lado de fora (mansões) da guia')
  console.log(`2. nenhuma unidade das fileiras está dentro do envelope da avenida `
    + `(r ${ORLA_R_MEIO_FIO_PRAIA} a ${ORLA_R_MEIO_FIO_MANSAO})`)

  // 3. as fileiras não pisam na faixa de areia (elas vivem no platô, fora da
  //    praia inteira: r da Fileira A > pé do platô) ─────────────────────────
  assert.ok(ORLA_R_FILEIRA_A > PRAIA_R1, `Fileira A (r ${ORLA_R_FILEIRA_A}) está dentro da faixa de areia (até ${PRAIA_R1})`)
  console.log(`3. Fileira A fica no platô, fora da faixa de areia (r ${ORLA_R_FILEIRA_A} > ${PRAIA_R1})`)

  // 4. a vegetação de praia dos nós vive DENTRO da faixa de areia, com folga
  //    de pelo menos 2 m das duas bordas (água de um lado, platô do outro) ──
  const MARGEM = 2
  let piorMargem = Infinity
  for (const no of nos) {
    for (const p of [...no.palmas, no.oleandro, ...no.grama]) {
      const r = Math.hypot(p.x, p.z)
      assert.ok(r > PRAIA_R0 && r < PRAIA_R1,
        `vegetação do nó (r ${r.toFixed(1)}) caiu fora da faixa de areia (${PRAIA_R0} a ${PRAIA_R1})`)
      piorMargem = Math.min(piorMargem, r - PRAIA_R0, PRAIA_R1 - r)
    }
  }
  assert.ok(piorMargem >= MARGEM, `vegetação de um nó chegou a ${piorMargem.toFixed(2)} m de uma borda da praia (mínimo ${MARGEM} m)`)
  console.log(`4. toda vegetação dos ${nos.length} nós vive dentro da faixa de areia, pior margem ${piorMargem.toFixed(2)} m das bordas`)

  // 5. nenhuma unidade das fileiras (nem da vegetação de praia) além da
  //    margem externa da alça (ALCA_R_MAR) ──────────────────────────────────
  const alemDoMar = filB.filter((p) => Math.hypot(p.x, p.z) > ALCA_R_MAR).length
  assert.equal(alemDoMar, 0, `${alemDoMar} unidades da Fileira B caíram além da margem externa (r > ${ALCA_R_MAR})`)
  console.log(`5. nenhuma unidade passa da margem externa da alça (r <= ${ALCA_R_MAR})`)

  // 6. cada nó abre mesmo uma clareira na Fileira A: o maior vão angular de
  //    A, convertido em metros no raio da própria fileira, tem de ser bem
  //    maior que o passo nominal (18 m) perto de cada nó ────────────────────
  const passoReal = orlaPassoReal()
  let piorClareira = Infinity
  for (const no of nos) {
    // acha o vão (em metros, ao longo do arco) entre as duas unidades de A
    // mais próximas do ângulo do nó, dos dois lados
    let antes: number | null = null, depois: number | null = null
    for (const p of filA) {
      const a = Math.atan2(p.x, -p.z)
      const d = a - no.a
      if (d <= 0 && (antes === null || d > antes)) antes = d
      if (d > 0 && (depois === null || d < depois)) depois = d
    }
    if (antes === null || depois === null) continue
    const vaoMetros = (depois - antes) * ORLA_R_FILEIRA_A
    piorClareira = Math.min(piorClareira, vaoMetros)
  }
  assert.ok(piorClareira >= ORLA_PASSO_A_NOMINAL * 1.8,
    `a menor clareira de nó mediu ${piorClareira.toFixed(1)} m, esperado bem acima do passo nominal (${ORLA_PASSO_A_NOMINAL} m)`)
  console.log(`6. cada um dos ${ORLA_N_NOS} nós abre clareira na Fileira A, a menor com ${piorClareira.toFixed(1)} m `
    + `(passo nominal ${ORLA_PASSO_A_NOMINAL} m)`)

  // 7. alinhamento: desvio do passo real contra o nominal, e regularidade
  //    (todo vão fora de clareira é o MESMO, dentro de ponto flutuante) ─────
  const gapsA: number[] = []
  for (let i = 1; i < filA.length; i++) {
    const a0 = Math.atan2(filA[i - 1].x, -filA[i - 1].z)
    const a1 = Math.atan2(filA[i].x, -filA[i].z)
    let d = a1 - a0
    if (d < 0) d += Math.PI * 2
    gapsA.push(d * ORLA_R_FILEIRA_A)
  }
  const gapsRegularesA = gapsA.filter((g) => g < ORLA_PASSO_A_NOMINAL * 1.5) // fora das 30 clareiras
  const piorGapA = Math.max(...gapsRegularesA.map((g) => Math.abs(g - passoReal.passoA)))
  assert.ok(piorGapA < 0.01, `vão da Fileira A não é regular: pior desvio ${piorGapA.toFixed(4)} m contra o próprio passo real`)
  assert.ok(passoReal.desvioA < 0.5, `desvio do passo A contra o nominal (${ORLA_PASSO_A_NOMINAL} m) ficou grande: ${passoReal.desvioA.toFixed(3)} m`)
  assert.ok(passoReal.desvioB < 0.5, `desvio do passo B contra o nominal (${ORLA_PASSO_B_NOMINAL} m) ficou grande: ${passoReal.desvioB.toFixed(3)} m`)
  console.log(`7. alinhamento: passo A ${passoReal.passoA.toFixed(4)} m (desvio ${passoReal.desvioA.toFixed(4)} m de ${ORLA_PASSO_A_NOMINAL}), `
    + `passo B ${passoReal.passoB.toFixed(4)} m (desvio ${passoReal.desvioB.toFixed(4)} m de ${ORLA_PASSO_B_NOMINAL}); `
    + `${gapsRegularesA.length} vãos regulares medidos na Fileira A, todos a ${piorGapA.toFixed(4)} m do passo real`)

  // 8. contagem: a Fileira B não perde unidade nenhuma (sem clareira) e a A
  //    perde exatamente 2 por nó ──────────────────────────────────────────
  assert.equal(filB.length, ORLA_N_FILEIRA_B, `Fileira B deveria ter ${ORLA_N_FILEIRA_B} unidades, tem ${filB.length}`)
  const esperadoA = ORLA_N_FILEIRA_A - ORLA_N_NOS * 2
  assert.equal(filA.length, esperadoA, `Fileira A deveria ter ${esperadoA} unidades (${ORLA_N_FILEIRA_A} − 2×${ORLA_N_NOS}), tem ${filA.length}`)
  console.log(`8. contagem: Fileira A ${filA.length} (${ORLA_N_FILEIRA_A} vagas − 2×${ORLA_N_NOS} de clareira), Fileira B ${filB.length}`)

  console.log('\nOK: portão 2 (água/pista/areia fora dos nós) e portão 3 (alinhamento) passaram.')
}

main()
