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
// ⚠️ ACOMPANHA O RAIO DO SÍTIO. Ele foi de 3.500 para 4.500 m em 28/08 para o
// lote mediano sair de 153 para 250 m². Se este número ficasse em 3.500, o anel
// novo de loteamento nasceria com o exagero do horizonte já entrando, ou seja
// com o terreno esticado na vertical debaixo dos lotes.
export const VEX_R_CIDADE = 4500
/** e o raio onde o exagero do horizonte já está cheio */
export const VEX_R_HORIZONTE = 7000

/** o exagero vertical aplicado a uma distância `r` do centro da praça, em metros */
export function exageroEm(r: number): number {
  if (r <= VEX_R_CIDADE) return VEX_CIDADE
  if (r >= VEX_R_HORIZONTE) return VEX_HORIZONTE
  const t = (r - VEX_R_CIDADE) / (VEX_R_HORIZONTE - VEX_R_CIDADE)
  return VEX_CIDADE + (VEX_HORIZONTE - VEX_CIDADE) * (t * t * (3 - 2 * t))
}

/** compatibilidade: quem só quer um número usa o do horizonte */
export const VERTICAL_EXAGGERATION = VEX_HORIZONTE
