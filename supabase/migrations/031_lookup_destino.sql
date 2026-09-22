-- 031 — a consulta da landing precisa distinguir LOTE de LÁPIDE
--
-- ⚠️ ELA MENTE HOJE PARA 15.802 CARTEIRAS. `dog_snapshot_lookup` tem 85.818
-- linhas e NÃO tem a coluna `destino`: a busca da landing devolve área para
-- todo mundo, inclusive para quem está abaixo do corte do cemitério e recebe
-- lápide, não terra (masterplan §17). A rota `/api/dogcity/lookup` e a seção
-- `wallet-lookup.tsx` já sabem tratar o quarto estado `memorial`; o que falta
-- é o dado.
--
-- O corte é DERIVADO, nunca escolhido: é o saldo que paga o menor lote de
-- 24 m² na curva publicada, (24 / 0,986443)² = 591,9411 DOG. A copy publica ele
-- arredondado PARA CIMA (591,95), porque 591,94 pagam 23,999978 m².
--
-- Depois de aplicar isto, rode `python3 scripts/city/sobe_lookup.py`, que
-- reescreve as 85.818 linhas com `destino` e com `area_m2 = 0` para as lápides.

alter table public.dog_snapshot_lookup
  add column if not exists destino text not null default 'lote';

comment on column public.dog_snapshot_lookup.destino is
  'lote | lapide. Abaixo de 591,9411 DOG o endereço recebe lápide no cemitério e area_m2 vai a 0.';

create index if not exists dog_snapshot_lookup_destino_idx
  on public.dog_snapshot_lookup (destino);
