// ═══════════════════════════════════════════════════════════════════════════
// O REGISTRO DAS PEÇAS COM PROJETO PRÓPRIO.
//
// Peça que aparece aqui é desenhada pelo módulo dela, com a Prancheta de
// ./kit.ts. Peça que NÃO aparece cai no desenho genérico por tipo de pecas.ts,
// que é placeholder e tem de ler como tal: parcela demarcada, obra não
// projetada.
//
// ⚠️ A CHAVE É O ID DO PROGRAMA, o mesmo de public/city/cidade.json e de
// scripts/gerar_cidade.py. Se o gerador renomear uma peça, o módulo dela para de
// ser chamado em silêncio e ela volta ao genérico sem ninguém perceber.
// ═══════════════════════════════════════════════════════════════════════════
import type { Ctx, Desenho } from './kit'
import { desenhar as A01 } from './A01'
import { desenhar as A02 } from './A02'
import { desenhar as A03 } from './A03'
import { desenhar as A04 } from './A04'
import { desenhar as A05 } from './A05'
import { desenhar as C01 } from './C01'
import { desenhar as C05 } from './C05'
import { desenhar as C09 } from './C09'
import { desenhar as D03 } from './D03'
import { desenhar as E01 } from './E01'
import { desenhar as E02 } from './E02'
import { desenhar as F01 } from './F01'

export type Modulo = (c: Ctx) => Desenho

export const MODULOS: Record<string, Modulo> = {
  A01,
  A02,
  A03,
  A04,
  A05,
  C01,
  C05,
  C09,
  D03,
  E01,
  E02,
  F01,
}
