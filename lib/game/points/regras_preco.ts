// CÓPIA do jogo (dogcity-mundo @ 27dc4fa83, 15/11/2026), como src/economia/README.md pede: as regras puras dos DC Points
// repetidas no servidor, com teste de igualdade (lib/game/points/igualdade.test.ts). NÃO editar aqui sozinho: mudou no jogo,
// copia de novo e o teste confere. Adaptações mínimas, sem mudar uma conta: imports sem a extensão .ts e
// Object.hasOwn(o, k) escrito como Object.prototype.hasOwnProperty.call(o, k) (o tsconfig do DogData é ES2020).
//
// Origem: src/economia/regras_preco.ts

// O preco do dia (T07, #178; plano/PLANO_ECONOMIA_CIDADE.md, secao 2.6): preco base x escassez x demanda do dia. Puro,
// sem three e sem DOM: mercado.ts chama com o dia do relogio de mundo e os testes (testes/economia/regras_preco.test.ts)
// chamam com dias sinteticos. Os numeros vem por argumento (ajustes_economia.ts, ECONOMIA).
//
// A demanda e' uma curva deterministica pela semente do dia e pelo id do item: um hash INTEIRO (hash32 de
// src/mar/fauna/hash_mundo.ts, so' Math.imul e deslocamentos, estavel em todo navegador e no servidor), nunca
// Math.random e nunca Math.sin. Duas instancias do jogo no mesmo dia veem o mesmo preco, e o servidor (T21) repete a conta.
// A escassez vem por parametro (1 por enquanto; T09 e T21 ligam ao estoque por regiao de src/mar/fauna/estoque.ts).
//
// Falha fechada: dia que nao e' inteiro vale demanda 1; escassez nao finita ou nao positiva vale 1; fora da faixa, e'
// presa a ela. O resultado e' inteiro, de 1 a precoMaximo; 0 so' quando o item nao se negocia (sem preco base nem por
// categoria).

import { hash32, u01 } from './hash_mundo';

/** o que a conta precisa de ECONOMIA (ajustes_economia.ts cabe aqui; os testes passam variantes) */
export interface AjustesPreco {
  amplitudeDemanda: number;
  escassezMin: number;
  escassezMax: number;
  precoMaximo: number;
  precoBasePorCategoria: Readonly<Record<string, number>>;
}

/** o que a conta precisa de um item (src/inventario/catalogo_itens.ts, ItemDef, cabe aqui) */
export interface ItemComPreco {
  id: string;
  /** preco de partida em DC Points; 0 = cai no preco da categoria */
  precoBase: number;
  categoria: string;
}

/** a semente do preco do dia; sobe quando o algoritmo da demanda muda (os precos de todo mundo mudam juntos) */
export const SEMENTE_PRECO = 0x50524331;

/** FNV-1a de 32 bits do id do item (so' Math.imul: o mesmo inteiro em todo navegador e no servidor). */
export function hashId(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** O sorteio da demanda do item no dia, em [0, 1). */
export function sorteioDemanda(id: string, dia: number): number {
  return u01(hash32(SEMENTE_PRECO, dia | 0, hashId(id), 0));
}

/** A amplitude aceita: de 0 a 0,9 (1 - amplitude tem de ficar acima de zero); nao finita vale 0. */
export function amplitudeValida(a: number): number {
  if (!Number.isFinite(a)) return 0;
  return Math.max(0, Math.min(0.9, a));
}

/** O fator de demanda do item no dia: 1 +- amplitude, pela semente do dia. Dia que nao e' inteiro vale 1. */
export function demandaDoDia(id: string, dia: number, p: AjustesPreco): number {
  if (!Number.isInteger(dia)) return 1;
  const amp = amplitudeValida(p.amplitudeDemanda);
  if (amp === 0) return 1;
  return 1 + amp * (2 * sorteioDemanda(id, dia) - 1);
}

/** A escassez que entra na conta: nao finita ou nao positiva vale 1 (neutra); fora da faixa, presa a ela. */
export function escassezValida(e: number, p: AjustesPreco): number {
  if (!Number.isFinite(e) || e <= 0) return 1;
  return Math.max(p.escassezMin, Math.min(p.escassezMax, e));
}

/** O preco base do item: o seu, se e' inteiro positivo; senao o da categoria; senao 0 (nao se negocia). */
export function precoBaseDe(item: ItemComPreco, p: AjustesPreco): number {
  const proprio = item.precoBase;
  if (Number.isInteger(proprio) && proprio > 0) return Math.min(proprio, p.precoMaximo);
  const tabela = p.precoBasePorCategoria;
  const daCategoria = Object.prototype.hasOwnProperty.call(tabela, item.categoria) ? tabela[item.categoria] : 0;
  if (daCategoria !== undefined && Number.isInteger(daCategoria) && daCategoria > 0) return Math.min(daCategoria, p.precoMaximo);
  return 0;
}

/** O item tem preco (proprio ou da categoria)? */
export function negociavel(item: ItemComPreco, p: AjustesPreco): boolean {
  return precoBaseDe(item, p) > 0;
}

/**
 * O preco do dia em DC Points: base x escassez x demanda(dia, item), arredondado, inteiro de 1 a precoMaximo.
 * 0 so' quando o item nao se negocia.
 */
export function precoDoDia(item: ItemComPreco, dia: number, escassez: number, p: AjustesPreco): number {
  const base = precoBaseDe(item, p);
  if (base <= 0) return 0;
  const fator = escassezValida(escassez, p) * demandaDoDia(item.id, dia, p);
  const preco = Math.round(base * fator);
  if (!Number.isFinite(preco)) return Math.max(1, Math.min(p.precoMaximo, base));
  return Math.max(1, Math.min(p.precoMaximo, preco));
}
