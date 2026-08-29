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

  // ⚠️ AS DOZE CENTRAIS DIVIDEM UM MÓDULO SÓ, e isso é decisão e não preguiça:
  // elas têm a mesma parcela de 180 m e a mesma função (alimentar o setor delas).
  // Doze arquivos iguais seriam doze lugares para o mesmo conserto. A variação que
  // impede a cidade de parecer carimbada vem de `c.ruido()` dentro do módulo, que é
  // determinístico por peça: altura de galpão, altura de silo e empilhamento de
  // contêiner mudam de uma para a outra e não mudam entre visitas.
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
}
