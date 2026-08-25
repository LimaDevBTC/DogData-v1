-- Os "intermediários" do dogarmy são custódia da Bitget, e o rastro do gás foi
-- quem entregou.
--
-- ⚠️ A CADEIA DA PROVA (24/08/2026, medida no nó + explorers públicos):
--   1. Int#1/Int#2/Int#3 mandam 100% do DOG pro cofre de runes da Bitget
--      (bc1p50n9…, rótulo oficial), zero exceções (116/184/1 transações).
--   2. O gás de TODAS essas varreduras é co-assinado por bc1p0jm3u…, que não
--      serve mais ninguém.
--   3. bc1p0jm3u… é recarregada em parcelas de 0,005 BTC por
--      1FWQiwK27EnGXb6BiBMRLJvunJQZZPMcGd, que é a HOT WALLET BTC DA BITGET
--      (rótulo público em múltiplos explorers; 1,19M transações, 728 mil BTC de
--      volume vitalício). A primeira recarga veio via 17Tv3a…, relay cujo único
--      destino é essa mesma hot.
--   Depósito exclusivo no cofre + taxa paga pela própria casa = co_flow, o
--   mesmo grau da tesouraria da Kraken. Endereço de depósito varrendo pro cofre
--   é arquitetura padrão de corretora; os 89/114 remetentes distintos são os
--   CLIENTES da rota, não o dono dela.
--
-- ⚠️ O QUE ISSO DESFAZ: a leitura desk/router da 011 (fica corrigida aqui, com
-- a história na nota) e mais um pedaço da narrativa do dogarmy, cujos
-- "Intermediary bridges" são encanamento de depósito da Bitget.
--
-- ⚠️ O LADO DAS DESKS NÃO MUDA: MM1/Whale23/MM2 continuam desks. A carteira de
-- gás delas (bc1pqdtrwk…) é recarregada por 1G47mSr…, um gigante SEM rótulo
-- público (1,35M transações, 475 BTC de saldo, escala de corretora, Spark não
-- conhece). A nota dela ganha essa precisão.

UPDATE dog_labels SET entity = 'Bitget', role = 'deposit', kind = 'exchange',
  evidence = 'co_flow', internal = false, updated_at = now(),
  evidence_note = 'Bitget custody by co_flow (2026-08-24): every indexed send, 116 transactions and 396M DOG, lands in the official Bitget rune hot wallet with zero exceptions, and the fee input of every sweep is co-signed by bc1p0jm3u…, a fee wallet topped up by the Bitget BTC hot wallet 1FWQiwK… (1.19M transactions, labeled Bitget by multiple public explorers). Exclusive sweep into the vault plus fees paid by the house is the standard exchange deposit architecture; the 89 distinct senders are the customers of this deposit route, not its owner. Reclassified from an earlier desk/router reading; first flagged as "Intermediary #1" by dogarmy.space (2026-08).'
WHERE address = 'bc1pt02fw3aty825yaujdnmzml0qny28l9ecc77df2vgc26qfcket3hqc634ar';

UPDATE dog_labels SET entity = 'Bitget', role = 'deposit', kind = 'exchange',
  evidence = 'co_flow', internal = false, updated_at = now(),
  evidence_note = 'Bitget custody by co_flow (2026-08-24): every indexed send, 184 transactions and 743M DOG, lands in the official Bitget rune hot wallet with zero exceptions, and the fee input of every sweep is co-signed by bc1p0jm3u…, a fee wallet topped up by the Bitget BTC hot wallet 1FWQiwK… (1.19M transactions, labeled Bitget by multiple public explorers). The 114 distinct senders, Kraken and Gate.io withdrawals and the desks among them, are the customers of this deposit route, not its owner. Reclassified from an earlier desk/router reading; first flagged as "Intermediary #2" by dogarmy.space (2026-08).'
WHERE address = 'bc1p52673nrtsed5n5nal7cm02u6pg63p0e6u4nm2fhm90xd8r4w3ass090zzy';

UPDATE dog_labels SET entity = 'Bitget', role = 'deposit', kind = 'exchange',
  evidence = 'co_flow', internal = false, updated_at = now(),
  evidence_note = 'Bitget custody by co_flow (2026-08-24): only 3 indexed transactions (one hop, Gate.io in and the official Bitget rune hot wallet out, 2026-04-30), but the sweep fee was co-signed by bc1p0jm3u…, the same Bitget fee wallet that serves the other deposit routes, which ties the address to the same custody infrastructure. Small sample stated on purpose. First flagged as "Intermediary #3" / "Relay #3" by dogarmy.space (2026-08).'
WHERE address = 'bc1pu03udw507wj58y5lv3dky03lxuj0m74uqdnqllckv3s32sw9ahrscjch8j';

UPDATE dog_labels SET entity = 'Bitget', role = 'fee', kind = 'exchange',
  evidence = 'co_flow', internal = false, updated_at = now(),
  evidence_note = 'Bitget fee infrastructure by co_flow (2026-08-24): co-signs the gas input and takes the change in 64 sampled sweep transactions from the Bitget deposit routes (bc1pt02fw…, bc1p52673…, bc1pu03ud…) into the official Bitget rune hot wallet, and serves nothing else. Topped up in 0.005 BTC instalments by the Bitget BTC hot wallet 1FWQiwK… (1.19M transactions, labeled Bitget by multiple public explorers); its first funding arrived via 17Tv3a…, a relay whose only destination is that same hot wallet.'
WHERE address = 'bc1p0jm3ucw8sh7edx37lw06ce9aaem09tcx2yr2zuenqr33hqce3lps67k0ns';

UPDATE dog_labels SET updated_at = now(),
  evidence_note = 'Fee infrastructure proven at node level (2026-08-24): co-signs the gas input and takes the change in 47 sampled transactions of the desks bc1peczz (MM1) and bc1prdyz (Whale23). Funded by 1G47mSr3oANX…, an exchange-scale wallet with no public label (1.35M transactions, 475 BTC balance, unknown to public labeling services) that received a 94-address legacy consolidation and pre-fragments fee UTXOs: one 0.63 BTC batch pays fifty 0.01 BTC chunks straight into this wallet in a single transaction.'
WHERE address = 'bc1pqdtrwkjwdutzs5z8f75gc5srhcwewx4u77pdnumc0fh7l47aanqqa8n4da';

INSERT INTO dog_labels (address, entity, role, kind, evidence, evidence_note, internal) VALUES
  ('1FWQiwK27EnGXb6BiBMRLJvunJQZZPMcGd', 'Bitget', 'hot', 'exchange', 'third_party',
   'Bitget BTC hot wallet per multiple public explorers (spark.money and others): 1.19M transactions, 728k+ BTC lifetime volume, currently also holding 20.2M DOG. Corroborated by our node-level trace: it tops up the Bitget fee wallet bc1p0jm3u… in 0.005 BTC instalments and receives deposits relayed by 17Tv3a…. The name comes from third parties, so the row stays internal; the flow corroboration is ours.', true)
ON CONFLICT (address) DO NOTHING;

UPDATE dog_labels SET updated_at = now(),
  evidence_note = evidence_note || ' Funding paths fully resolved later on 2026-08-24: the funnel side turned out to be Bitget deposit infrastructure (fee wallet topped up by the Bitget BTC hot wallet), and the desk side is topped up by 1G47mSr…, an exchange-scale wallet with no public label; neither path touches this address.'
WHERE address = 'bc1qhuv3dhpnm0wktasd3v0kt6e4aqfqsd0uhfdu7d'
  AND evidence_note NOT LIKE '%fully resolved%';
