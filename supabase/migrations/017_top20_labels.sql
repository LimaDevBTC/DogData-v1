-- Quatro do top 20 deixam de ser anônimos, por função e sem nome inventado.
--
-- ⚠️ DE ONDE VEIO (24/08/2026): sondagem dirigida nos 15 sem rótulo do top 20
-- (janela sã, troco excluído, elo com quem já tem nome) + rodada do detector.
--
--   #3  nasceu 26/06/2026 e SÓ RECEBE: 2,53B da ponte Merlin no dia do
--       nascimento (duas pernas de 1,27B, o esvaziamento da carteira oficial
--       que hoje está zerada) + 2,6B de saques da Kraken em 38 transações.
--       Zero saídas. Cofre. QUEM é (sucessor da custódia Merlin ou comprador
--       OTC) não está provado, então nome não entra.
--   #10 recebe da Gate.io em parcelas REDONDAS de ~100M e repassa em blocos de
--       120 a 155M pra dezenas de destinos. Hub de redistribuição.
--   #19 e #20 CO-ASSINAM as mesmas vendas: 20 transações idênticas listando
--       590M no marketplace bc1pjywv. Co-gasto é dono único; os dois carregam
--       sacos de 2024 e vendem via marketplace e Kraken.
--
-- ⚠️ A REGRA DE SEMPRE: classe publicada, nome só com prova de identidade.

INSERT INTO dog_labels (address, entity, role, kind, evidence, evidence_note, internal) VALUES
  ('bc1pzsx4xvghxmc0prv4mys0xdly9dh9js3e88e4m24k5gxzkeskx30s4qzjud', NULL, 'cold', 'treasury', 'flow_pattern',
   'Receive-only vault born 2026-06-26 (rank 3, measured 2026-08-24): on its first day it received 2.53B DOG in two 1.27B legs from the official Merlin Chain bridge wallet, which emptied in that event, and it has since absorbed 2.6B more across 38 Kraken withdrawals. Zero outgoing transactions. Whether it is the successor custody of the Merlin bridge or an OTC buyer is not proven, so it carries no name.', false),
  ('bc1p4pkr90vrqspmfddplde05v55gelkvcjwhsu93c9m5zu9gwwvgz0qap0vkn', NULL, NULL, 'distributor', 'flow_pattern',
   'Redistribution hub (rank 10, measured 2026-08-24): receives from Gate.io in round ~100M DOG instalments (5 withdrawals of 99,997,439) and passes 120M to 155M blocks on to about thirty distinct destinations. Flagged independently by the entity detector in the same window.', false),
  ('bc1p6vly9m3e7yh5hwwkz92l89w2qqhyj4htkqewml963g7kn9k79qase0ukl3', NULL, NULL, 'distributor', 'flow_pattern',
   'One half of a same-owner pair proven by co-spending (rank 19, measured 2026-08-24): signs the same 20 marketplace listing transactions as bc1pw56l62… (rank 20), placing 590M DOG into the bc1pjywv marketplace, and also sends to Kraken. Holds an April 2024 era bag and distributes it; 1,709 lifetime transactions.', false),
  ('bc1pw56l62nnaneldkuyyqlr4jh2tptn779c4d06tdmkd0h7xfq59jtquvtxwl', NULL, NULL, 'distributor', 'flow_pattern',
   'One half of a same-owner pair proven by co-spending (rank 20, measured 2026-08-24): signs the same 20 marketplace listing transactions as bc1p6vly9m… (rank 19), placing 590M DOG into the bc1pjywv marketplace. Holds an April 2024 era bag and distributes it; 1,041 lifetime transactions.', false)
ON CONFLICT (address) DO NOTHING;
