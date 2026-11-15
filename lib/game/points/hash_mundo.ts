// CÓPIA do jogo (dogcity-mundo @ 27dc4fa83, 15/11/2026), como src/economia/README.md pede: as regras puras dos DC Points
// repetidas no servidor, com teste de igualdade (lib/game/points/igualdade.test.ts). NÃO editar aqui sozinho: mudou no jogo,
// copia de novo e o teste confere. Adaptações mínimas, sem mudar uma conta: imports sem a extensão .ts e
// Object.hasOwn(o, k) escrito como Object.prototype.hasOwnProperty.call(o, k) (o tsconfig do DogData é ES2020).
//
// Origem: src/recursos/hash_mundo.ts (só hash32 e u01, o que o preço do dia usa)

/** Hash de quatro inteiros em [0, 2^32). Os argumentos viram int32 (|0): NaN e Infinity viram 0. */
export function hash32(a: number, b: number, c: number, d: number): number {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 2147483647) + Math.imul(d | 0, 1103515245)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = h ^ (h >>> 16);
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  return h >>> 0;
}

/** O hash como numero em [0, 1). */
export function u01(h: number): number {
  return h / 4294967296;
}
