// CÓPIA do jogo (dogcity-mundo @ 27dc4fa83, 15/11/2026): de src/inventario/catalogo_itens.ts (ITENS), só o que o preço do
// dia usa (id, categoria e precoBase), na mesma ordem. O teste de igualdade (lib/game/points/igualdade.test.ts) confere
// contra o jogo. Mudou um preço base no jogo: muda aqui, ou o servidor cobra outro preço no mercado.
import type { ItemComPreco } from './regras_preco'

const item = (id: string, categoria: string, precoBase: number): ItemComPreco => Object.freeze({ id, categoria, precoBase })

export const ITENS_PRECO: Readonly<Record<string, ItemComPreco>> = Object.freeze({
  garrafa_agua: item('garrafa_agua', 'Drink', 2),
  garrafa_vazia: item('garrafa_vazia', 'Drink', 1),
  peixe_cru: item('peixe_cru', 'Food', 4),
  peixe_assado: item('peixe_assado', 'Food', 6),
  carne: item('carne', 'Food', 8),
  carne_caca: item('carne_caca', 'Food', 12),
  ave: item('ave', 'Food', 6),
  ave_caca: item('ave_caca', 'Food', 9),
  javali: item('javali', 'Food', 10),
  mirtilo: item('mirtilo', 'Food', 3),
  melancia: item('melancia', 'Food', 3),
  galao: item('galao', 'Fuel', 15),
  vara: item('vara', 'Tools', 40),
  rede: item('rede', 'Tools', 60),
  covo: item('covo', 'Tools', 45),
  machado: item('machado', 'Tools', 50),
  picareta: item('picareta', 'Tools', 60),
  tora: item('tora', 'Materials', 6),
  tabua: item('tabua', 'Materials', 5),
  minerio: item('minerio', 'Materials', 8),
  lingote: item('lingote', 'Materials', 20),
})
