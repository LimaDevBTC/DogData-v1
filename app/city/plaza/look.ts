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

const PADRAO: Look = 1

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
