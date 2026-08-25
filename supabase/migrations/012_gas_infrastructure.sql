-- O rastro do gás: duas carteiras de taxa compartilhadas amarram o cluster, e a
-- hipótese Binance sai não corroborada.
--
-- ⚠️ COMO FOI MEDIDO (24/08/2026, no nó, não no índice). As carteiras do cluster
-- não guardam BTC: cada transação de DOG é co-assinada por uma carteira de gás
-- que entra com a taxa e recolhe o troco. O índice grava só o remetente do rune,
-- então essa camada é invisível pra `dog_transactions`; a medição foi feita com
-- getrawtransaction (verbosidade 2) andando a ancestralidade de troco.
--
-- ⚠️ O QUE APARECEU:
--   bc1p0jm3u… co-assina o gás dos TRÊS funis pra Bitget (64 txs na amostra)
--   bc1pqdtrwk… co-assina o gás de MM1 E Whale23 (47 txs na amostra)
--   Uma carteira de taxa servindo braços "distintos" é prova de operação única.
--   Abastecimento: 1FWQiwK… (legacy, segura 20,2M DOG) recarrega a primeira;
--   1G47mSr… (recebedor do airdrop, destino de uma consolidação de 94 endereços
--   legacy, e co-gasto de 94 endereços é dono único) recarrega a segunda com
--   0,5 BTC e pulveriza lotes de operação de 0,01.
--
-- ⚠️ E A bc1qhuv3… NÃO APARECEU EM LUGAR NENHUM dos caminhos de financiamento
-- sondados (2 carteiras de gás × 2 épocas + 1 salto acima dos financiadores).
-- A alegação do dogarmy de que ela financia o cluster fica, por ora, sem
-- corroboração nossa. A nota dela também corrige uma frase minha de ontem:
-- "nunca co-gastou no índice" era artefato, porque o índice nem registra
-- co-assinante de gás.

INSERT INTO dog_labels (address, entity, role, kind, evidence, evidence_note, internal) VALUES
  ('bc1p0jm3ucw8sh7edx37lw06ce9aaem09tcx2yr2zuenqr33hqce3lps67k0ns', NULL, 'fee', 'desk', 'flow_pattern',
   'Fee infrastructure proven at node level (2026-08-24): co-signs the gas input and takes the change in 64 sampled transactions of the three one-way funnels into Bitget (bc1pt02fw, bc1p52673, bc1pu03ud). One fee wallet serving all three funnels is operator-grade evidence that they run together. Topped up in repeated deposits from 1FWQiwK27EnG…, a legacy wallet currently holding 20.2M DOG.', false),
  ('bc1pqdtrwkjwdutzs5z8f75gc5srhcwewx4u77pdnumc0fh7l47aanqqa8n4da', NULL, 'fee', 'desk', 'flow_pattern',
   'Fee infrastructure proven at node level (2026-08-24): co-signs the gas input and takes the change in 47 sampled transactions of the desks bc1peczz (MM1) and bc1prdyz (Whale23). Funded with 0.5 BTC by 1G47mSr3oANX…, an airdrop-recipient wallet that received a 94-address legacy consolidation (co-spending proves one owner) and sprays 0.01 BTC operations batches, one of which lands here.', false)
ON CONFLICT (address) DO NOTHING;

UPDATE dog_labels SET updated_at = now(),
  evidence_note = 'Community tag via dogarmy.space, explicitly unconfirmed by them: "Binance Ordinals hot wallet". Their claim: 51 outbound withdrawals funding the desk cluster, zero coming back, and the wallet holds 0 DOG itself. DOG-index check 2026-08-24: zero DOG transactions (note the index records only rune-carrying senders, so gas co-signing would be invisible here). Node-level gas trace 2026-08-24: the cluster pays fees through two shared fee wallets (bc1p0jm3u…, bc1pqdtrwk…) topped up from the legacy wallets 1FWQiwK… (holds 20.2M DOG) and 1G47mSr… (airdrop recipient, 94-address consolidation); this address appeared nowhere on those funding paths. The funding claim is so far uncorroborated by our own data. Stays third_party and internal.'
WHERE address = 'bc1qhuv3dhpnm0wktasd3v0kt6e4aqfqsd0uhfdu7d';
