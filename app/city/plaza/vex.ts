// ═══════════════════════════════════════════════════════════════════════════
// O EXAGERO VERTICAL DO SÍTIO, sozinho num arquivo só de matemática.
//
// ⚠️ ELE MORA AQUI, e não dentro de terrain.ts, por um motivo medido: a prancha
// de fundação (app/city/plan) precisa deste número e só dele. Enquanto a conta
// estava junto do renderizador, a prancha não podia importá-la sem arrastar o
// Three inteiro para o pacote, então alguém (eu) cravou `const VEX = 2` lá e
// esqueceu. Quando o exagero da cena virou radial, a prancha continuou medindo
// um terreno duas vezes mais íngreme do que o que a cidade desenha, e ninguém
// percebeu porque os dois números eram plausíveis. Função pura, sem
// dependência, importável de qualquer lugar: é o que impede a próxima deriva.
//
// A regra: a cidade é plana como o mare de verdade, o horizonte é dramatizado.
// ═══════════════════════════════════════════════════════════════════════════

export const VEX_CIDADE = 1
export const VEX_HORIZONTE = 2
/** raio até onde a cidade é plana como a Lua real */
export const VEX_R_CIDADE = 3500
/** e o raio onde o exagero do horizonte já está cheio */
export const VEX_R_HORIZONTE = 6000

/** o exagero vertical aplicado a uma distância `r` do centro da praça, em metros */
export function exageroEm(r: number): number {
  if (r <= VEX_R_CIDADE) return VEX_CIDADE
  if (r >= VEX_R_HORIZONTE) return VEX_HORIZONTE
  const t = (r - VEX_R_CIDADE) / (VEX_R_HORIZONTE - VEX_R_CIDADE)
  return VEX_CIDADE + (VEX_HORIZONTE - VEX_CIDADE) * (t * t * (3 - 2 * t))
}

/** compatibilidade: quem só quer um número usa o do horizonte */
export const VERTICAL_EXAGGERATION = VEX_HORIZONTE
