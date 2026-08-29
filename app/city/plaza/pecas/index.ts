// ═══════════════════════════════════════════════════════════════════════════
// O REGISTRO DAS PEÇAS COM PROJETO PRÓPRIO.
//
// Peça que aparece aqui é desenhada pelo módulo dela, com a Prancheta de
// ./kit.ts. Peça que NÃO aparece cai no genérico de pecas.ts, que é placeholder.
//
// ⚠️ A CHAVE É O ID DO PROGRAMA, o mesmo de public/city/cidade.json e de
// scripts/gerar_cidade.py. Se o gerador renomear uma peça, o módulo dela para de
// ser chamado EM SILÊNCIO e ela volta ao genérico sem ninguém perceber.
// ═══════════════════════════════════════════════════════════════════════════
import type { Ctx, Desenho } from './kit'
import { desenhar as A01 } from './A01'
import { desenhar as A02 } from './A02'
import { desenhar as A03 } from './A03'
import { desenhar as A04 } from './A04'
import { desenhar as A05 } from './A05'
import { desenhar as C01 } from './C01'
import { desenhar as C02 } from './C02'
import { desenhar as C03 } from './C03'
import { desenhar as C04 } from './C04'
import { desenhar as C05 } from './C05'
import { desenhar as C06 } from './C06'
import { desenhar as C07 } from './C07'
import { desenhar as C08 } from './C08'
import { desenhar as C09 } from './C09'
import { desenhar as C10 } from './C10'
import { desenhar as C11 } from './C11'
import { desenhar as C12 } from './C12'
import { desenhar as D01 } from './D01'
import { desenhar as D02 } from './D02'
import { desenhar as D03 } from './D03'
import { desenhar as E01 } from './E01'
import { desenhar as E02 } from './E02'
import { desenhar as F01 } from './F01'
import { desenhar as deposito } from './deposito'
import { desenhar as horta } from './horta'
import { desenhar as mirante } from './mirante'
import { desenhar as patio } from './patio'
import { desenhar as radiadores } from './radiadores'
import { desenhar as reservatorio } from './reservatorio'
import { desenhar as solar } from './solar'
import { desenhar as treino } from './treino'
import { desenhar as central } from './central'

export type Modulo = (c: Ctx) => Desenho

export const MODULOS: Record<string, Modulo> = {
  A01,
  A02,
  A03,
  A04,
  A05,
  C01,
  C02,
  C03,
  C04,
  C05,
  C06,
  C07,
  C08,
  C09,
  C10,
  C11,
  C12,
  D01,
  D02,
  D03,
  E01,
  E02,
  F01,

  // ⚠️ MÓDULO COMPARTILHADO: peça que se repete em tamanho diferente usa o mesmo
  // arquivo e se ajusta por c.a e c.b. Doze arquivos iguais seriam doze lugares
  // para o mesmo conserto, e a variação que impede o carimbo vem de c.ruido().
  D04: central,
  D05: central,
  D06: central,
  D07: central,
  D08: central,
  D09: central,
  D10: central,
  D11: central,
  D12: central,
  D13: central,
  D14: central,
  D15: central,
  B07: deposito,
  B16: deposito,
  B05: horta,
  B12: horta,
  B15: mirante,
  B03: patio,
  B11: patio,
  B04: radiadores,
  B02: reservatorio,
  B09: reservatorio,
  B01: solar,
  B06: solar,
  B10: solar,
  B14: solar,
  B08: treino,
  B13: treino,
}
