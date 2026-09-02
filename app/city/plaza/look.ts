// ═══════════════════════════════════════════════════════════════════════════
// A BANDEIRA DO ACABAMENTO. `?look=2` liga o pente fino visual (textura, contato
// com o solo, pós-processamento, mobiliário modelado); sem ela a cena desenha
// exatamente o que desenhava antes.
//
// ⚠️ POR QUE EXISTE BANDEIRA. O bot de auto-commit empurra pra `origin/main` de
// hora em hora, e a Vercel publica dali. Sem bandeira, cada passo intermediário
// do pente fino apareceria em produção pro visitante dentro da hora seguinte,
// inclusive o passo feio do meio. Correção de defeito objetivo (árvore dentro
// do asfalto, peça flutuando, máscara morta) NÃO passa por aqui: melhora
// inequívoca entra direto, porque não existe versão do produto em que a árvore
// deva nascer no meio da pista.
//
// ⚠️ LIDO UMA VEZ, NO MÓDULO. Não é `useState`, não é prop, não desce por
// assinatura de função: se descesse, cada módulo do chão precisaria de um campo
// novo no seu `Opts` e o pente fino viraria um refactor de trinta arquivos antes
// de desenhar um pixel. Módulo lê `look`, módulo decide. O custo é que trocar de
// look exige recarregar a página, o que é o comportamento certo mesmo: as
// texturas e o composer nascem no boot da cena.
//
// Quando o acabamento for aprovado, o padrão vira 2 nesta linha e a bandeira
// passa a servir pra VOLTAR (`?look=1`), até o caminho velho ser apagado.
// ═══════════════════════════════════════════════════════════════════════════

export type Look = 1 | 2

// ⚠️ INVERTIDO EM 02/09/2026, por decisão do fundador. O acabamento passou a ser
// o que todo visitante vê, e `?look=1` vira a VOLTA DE EMERGÊNCIA até o caminho
// velho ser apagado.
//
// O que autorizou a inversão, e é o padrão para a próxima vez: varredura dos 17
// enquadramentos do portão (`scripts/city/chapas.mjs`) com ZERO erro de console,
// mais uma conferência da entrada padrão, que o portão não cobre porque força
// `view=deck`. A entrada real da /city é o pouso sobre a batalha, e ela mediu 37
// fps e console limpo.
//
// ⚠️ O `fps` DO PORTÃO NÃO SERVE PARA DECIDIR NADA. Na varredura ele saiu 10 nos
// dezessete enquadramentos, o que é artefato do navegador sem cabeça e não
// medição: as leituras reais do mesmo dia foram 77, 60, 41, 37, 32 e 18. Meça
// quadro numa aba de verdade, com uma aba só aberta.
const PADRAO: Look = 2

function ler(): Look {
  if (typeof window === 'undefined') return PADRAO
  const v = new URLSearchParams(window.location.search).get('look')
  if (v === '2') return 2
  if (v === '1') return 1
  return PADRAO
}

/** O acabamento escolhido pra esta carga da página. */
export const LOOK: Look = ler()

/** Açúcar pra ler no meio de um literal sem quebrar a linha em três. */
export function seLook2<T>(novo: T, velho: T): T {
  return LOOK === 2 ? novo : velho
}

/** true quando o pente fino está ligado. */
export const look2 = LOOK === 2
