-- As sementes do dogarmy.space medidas contra o nosso índice, e quatro sobem de grau.
--
-- ⚠️ O QUE FOI MEDIDO E ONDE. Sondagem dirigida na `dog_transactions`, só na
-- janela sã do índice (bloco 934.000 pra cima, onde o scanner ao vivo assumiu),
-- em 24/08/2026. Direção separada de troco (contraparte que também é remetente
-- não conta), identidade cruzada com `dog_labels` + `verified_addresses.json`.
--
-- ⚠️ O QUE A MEDIÇÃO MOSTROU, em resumo:
--
--   Int#1  89 fontes (Kraken 114M, Gate 44M...) → UM destino só: Bitget (116 tx, 396M)
--   Int#2  114 fontes (Kraken 206M, Gate 122M, desks 160M) → UM destino só: Bitget (184 tx, 743M)
--   MM1    mão dupla com Kraken/Gate e desks irmãs, 199 fontes, 25 destinos, estoque girando
--   Whale23  moinho: recebe Bitget 431M/Kraken 379M/MEXC 177M, manda desk 412M/Kraken 193M/Gate 193M
--   Int#3  3 transações num dia só: consistente, mas magro demais pra ser padrão
--   Binance?  ZERO transações de DOG e nunca co-gastou: o financiamento é em BTC, fora deste índice
--
-- ⚠️ POR QUE flow_pattern E POR QUE internal CAI. O desenho de fluxo agora é
-- prova NOSSA (grau da 009: responde O QUE a carteira faz, nunca de quem é), e
-- linha com prova nossa da classe publica a classe. Nome próprio continua fora:
-- as quatro ficam com entity NULL e a tela escreve "Desk". O dogarmy.space vira
-- procedência histórica na nota, não sustentação.
--
-- ⚠️ AS DUAS QUE NÃO SOBEM. Int#3 e a suspeita de Binance continuam third_party
-- e internas: uma por magreza de amostra, outra porque a prova que falta é de
-- outro nível (BTC, não DOG).

UPDATE dog_labels SET evidence = 'flow_pattern', internal = false, updated_at = now(),
  evidence_note = 'Function proven by our own index (blocks 934,000+, measured 2026-08-24): receives from 89 distinct sources, Kraken withdrawals (114M) and Gate.io (44M) among them, and sends to exactly ONE destination, the Bitget hot wallet: 116 transactions, 396M DOG, zero exceptions. A one-way funnel recycling exchange withdrawals into Bitget. First flagged as "Intermediary #1" by dogarmy.space (2026-08).'
WHERE address = 'bc1pt02fw3aty825yaujdnmzml0qny28l9ecc77df2vgc26qfcket3hqc634ar';

UPDATE dog_labels SET evidence = 'flow_pattern', internal = false, updated_at = now(),
  evidence_note = 'Function proven by our own index (blocks 934,000+, measured 2026-08-24): 114 distinct sources, Kraken (206M), Gate.io (122M) and three sister desks (160M combined) among them, and sends to exactly ONE destination, the Bitget hot wallet: 184 transactions, 743M DOG, zero exceptions. The widest of the one-way funnels into Bitget. First flagged as "Intermediary #2" by dogarmy.space (2026-08).'
WHERE address = 'bc1p52673nrtsed5n5nal7cm02u6pg63p0e6u4nm2fhm90xd8r4w3ass090zzy';

UPDATE dog_labels SET evidence = 'flow_pattern', internal = false, updated_at = now(),
  evidence_note = 'Function proven by our own index (blocks 934,000+, measured 2026-08-24): high volume both ways with named exchanges and sister desks. Sends 263M to the bc1p8d8k desk, 201M to Gate.io and 124M to Kraken across only 25 destinations; receives 142M from the same desk and 154M from Kraken across 199 sources. Inventory turns over instead of piling up: the desk shape. First flagged as "Market Maker 1" by dogarmy.space (2026-08); their "absorbed by the whale on Jun 25-26 2026" event reads in our index as a deposit into the Kraken hot wallet.'
WHERE address = 'bc1peczzt9rq30pdaj3v9ne86u6v83mfq29rxxgnqxl96uknddzekm9qfreae9';

UPDATE dog_labels SET evidence = 'flow_pattern', internal = false, updated_at = now(),
  evidence_note = 'Function proven by our own index (blocks 934,000+, measured 2026-08-24): a circulation mill across four exchanges and the sister desks. Receives 431M from Bitget, 379M from Kraken, 177M from MEXC and 108M from the bc1p8d8k desk; sends 412M to that desk, 193M to Kraken, 193M to Gate.io and 61M into the bc1p52673 funnel. 651 transactions in the window while holding a rank-28 balance. dogarmy.space documents the same wallet as "Whale23, wash trading pattern" (2026-08); the class recorded here is the flow shape, not the allegation.'
WHERE address = 'bc1prdyzwdg0rcdgf9cg0a4zyx0cq3mdr3n6mcym95f3eg4dexfvnsjq200ly4';

UPDATE dog_labels SET updated_at = now(),
  evidence_note = evidence_note || ' DOG-index check 2026-08-24: only 3 transactions, all on 2026-04-30, one hop, Gate.io in (19.0M) and Bitget out (19.3M). Directionally consistent with the relay claim but too thin to prove a pattern; stays third_party.'
WHERE address = 'bc1pu03udw507wj58y5lv3dky03lxuj0m74uqdnqllckv3s32sw9ahrscjch8j'
  AND evidence_note NOT LIKE '%DOG-index check%';

UPDATE dog_labels SET updated_at = now(),
  evidence_note = evidence_note || ' DOG-index check 2026-08-24: zero DOG transactions and never a co-spender in any indexed transfer, consistent with the funding-only claim; the 51 funding movements live at BTC level, outside this index. Stays third_party pending a BTC-level check.'
WHERE address = 'bc1qhuv3dhpnm0wktasd3v0kt6e4aqfqsd0uhfdu7d'
  AND evidence_note NOT LIKE '%DOG-index check%';
