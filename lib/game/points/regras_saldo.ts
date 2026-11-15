// CÓPIA do jogo (dogcity-mundo @ 27dc4fa83, 15/11/2026), como src/economia/README.md pede: as regras puras dos DC Points
// repetidas no servidor, com teste de igualdade (lib/game/points/igualdade.test.ts). NÃO editar aqui sozinho: mudou no jogo,
// copia de novo e o teste confere. Adaptações mínimas, sem mudar uma conta: imports sem a extensão .ts e
// Object.hasOwn(o, k) escrito como Object.prototype.hasOwnProperty.call(o, k) (o tsconfig do DogData é ES2020).
//
// Origem: src/economia/regras_saldo.ts

// O saldo de DC Points (T07, #178; plano/PLANO_ECONOMIA_CIDADE.md, secoes 0 e 2.6, decisoes 1 e 7 da secao 6). Puro, sem
// three e sem DOM: mercado.ts chama com o dia do relogio de mundo e o perfil da carteira; os testes
// (testes/economia/regras_saldo.test.ts) chamam com dias e perfis sinteticos. Os numeros vem por argumento
// (ajustes_economia.ts, ECONOMIA).
//
// As regras da casa (CLAUDE.md, Dinheiro de verdade), aplicadas a pontos de jogo:
//   - NaN, negativo, Infinity e fracao sao recusados ANTES de qualquer conta ('valor'); o valor tem teto absoluto;
//   - o saldo nunca fica negativo e tem teto absoluto (tambem contra estado salvo inflado);
//   - teto diario de DC Points recebidos por carteira, todas as fontes somadas, tudo ou nada: o que nao cabe no dia
//     nao entra, e nada muda ('teto');
//   - QUEM ACUMULA e' a carteira verificada com handle registrado (decisao 7 de 29/10): o convidado recebe o saldo sem
//     mudar e o motivo 'convidado'. Sem perfil, convidado (falha fechada).
// Nao existe aqui, de proposito, transferencia entre jogadores, compra de pontos nem conversao em $DOG.

/** o que a conta precisa de ECONOMIA (ajustes_economia.ts cabe aqui; os testes passam variantes) */
export interface AjustesSaldo {
  tetoDiarioRecebido: number;
  valorMaximoPorOperacao: number;
  saldoMaximo: number;
}

/** o que de um perfil (src/social/identidade.ts, Perfil) decide quem acumula */
export interface PerfilAcumulo {
  verified: boolean;
  handle: string | null;
}

/** o contador do dia: quanto ja' entrou no dia `dia` do jogo (diaDoJogo, src/jogador/regras_necessidades.ts) */
export interface RecebidoDia {
  dia: number;
  total: number;
}

export type MotivoReceber = 'convidado' | 'valor' | 'saldo' | 'dia' | 'teto';
export type MotivoGastar = 'valor' | 'saldo';

export interface ResultadoReceber {
  ok: boolean;
  /** o saldo depois (o mesmo de antes quando nao entrou) */
  saldo: number;
  /** o contador do dia depois (o mesmo de antes quando nao entrou) */
  recebido: RecebidoDia;
  /** quanto entrou (0 quando nao entrou) */
  creditado: number;
  motivo?: MotivoReceber;
}

export interface ResultadoGastar {
  ok: boolean;
  saldo: number;
  debitado: number;
  motivo?: MotivoGastar;
}

/** Acumula quem tem carteira verificada E handle registrado. Qualquer outra coisa (lixo, null, so' verificada) nao. */
export function podeAcumular(perfil: unknown): boolean {
  if (!perfil || typeof perfil !== 'object') return false;
  const p = perfil as Partial<Record<keyof PerfilAcumulo, unknown>>;
  return p.verified === true && typeof p.handle === 'string' && p.handle.trim().length > 0;
}

/** Um valor que entra ou sai: inteiro de 1 ao teto por operacao. NaN, negativo, zero, Infinity e fracao nao sao. */
export function valorValido(v: unknown, p: AjustesSaldo): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v > 0 && v <= p.valorMaximoPorOperacao;
}

/** Um saldo: inteiro de 0 ao teto. */
export function saldoValido(s: unknown, p: AjustesSaldo): s is number {
  return typeof s === 'number' && Number.isInteger(s) && s >= 0 && s <= p.saldoMaximo;
}

/** O dia do jogo e' um inteiro (diaDoJogo devolve NaN para instante ruim, e NaN nao e' dia). */
export function diaValido(d: unknown): d is number {
  return typeof d === 'number' && Number.isInteger(d);
}

/** O total de `quantidade` unidades a `preco` cada, se os dois sao inteiros positivos e o total cabe no teto; senao 0. */
export function totalDe(preco: unknown, quantidade: unknown, p: AjustesSaldo): number {
  if (typeof preco !== 'number' || typeof quantidade !== 'number') return 0;
  if (!Number.isInteger(preco) || !Number.isInteger(quantidade) || preco <= 0 || quantidade <= 0) return 0;
  const total = preco * quantidade;
  return valorValido(total, p) ? total : 0;
}

/** O contador visto do dia `hoje`: o mesmo se e' de hoje e valido, zerado se o dia virou (ou se veio lixo). */
export function recebidoEm(recebido: RecebidoDia | null | undefined, hoje: number): RecebidoDia {
  if (recebido && recebido.dia === hoje && Number.isInteger(recebido.total) && recebido.total >= 0) {
    return { dia: hoje, total: recebido.total };
  }
  return { dia: hoje, total: 0 };
}

/** Quanto ainda cabe receber hoje (0 se o dia nao e' valido). */
export function restanteHoje(recebido: RecebidoDia | null | undefined, hoje: number, p: AjustesSaldo): number {
  if (!diaValido(hoje)) return 0;
  return Math.max(0, p.tetoDiarioRecebido - recebidoEm(recebido, hoje).total);
}

/**
 * Credita `valor` no `saldo` no dia `hoje`, com o contador `recebido` do dia. Na ordem: o valor (antes de qualquer
 * conta), o saldo, o dia, quem acumula (`acumula` = podeAcumular do perfil), o teto diario e o teto do saldo. Tudo ou
 * nada: quando nao entra, saldo e contador voltam como vieram (o saldo que era lixo volta 0).
 */
export function receber(saldo: number, valor: number, hoje: number, recebido: RecebidoDia, acumula: boolean, p: AjustesSaldo): ResultadoReceber {
  const saneado = saldoValido(saldo, p) ? saldo : 0;
  if (!valorValido(valor, p)) return { ok: false, saldo: saneado, recebido, creditado: 0, motivo: 'valor' };
  if (!saldoValido(saldo, p)) return { ok: false, saldo: saneado, recebido, creditado: 0, motivo: 'saldo' };
  if (!diaValido(hoje)) return { ok: false, saldo, recebido, creditado: 0, motivo: 'dia' };
  if (acumula !== true) return { ok: false, saldo, recebido, creditado: 0, motivo: 'convidado' };
  const r = recebidoEm(recebido, hoje);
  if (r.total + valor > p.tetoDiarioRecebido || saldo + valor > p.saldoMaximo) {
    return { ok: false, saldo, recebido, creditado: 0, motivo: 'teto' };
  }
  return { ok: true, saldo: saldo + valor, recebido: { dia: hoje, total: r.total + valor }, creditado: valor };
}

/** Debita `valor` do `saldo`. O saldo nunca fica negativo: sem saldo, nada sai ('saldo'). Valor ruim, nada ('valor'). */
export function gastar(saldo: number, valor: number, p: AjustesSaldo): ResultadoGastar {
  const saneado = saldoValido(saldo, p) ? saldo : 0;
  if (!valorValido(valor, p)) return { ok: false, saldo: saneado, debitado: 0, motivo: 'valor' };
  if (!saldoValido(saldo, p) || saldo < valor) return { ok: false, saldo: saneado, debitado: 0, motivo: 'saldo' };
  return { ok: true, saldo: saldo - valor, debitado: valor };
}
