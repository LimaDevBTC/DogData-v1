-- O 1G47 tem dono: é a hot wallet BTC da Gate.io, e a prova veio pela cold.
--
-- ⚠️ A CADEIA (24/08/2026): o 1G47mSr… não tem rótulo público em lugar nenhum
-- (Spark, Blockchair, WalletExplorer: cluster 7d94852b sem nome). Mas a MAIOR
-- fonte dele, 162bzZT… com 474 BTC em duas transações, é rotulada
-- "Gate (Cold Wallet)" pelo spark.money (9,8 mil BTC de saldo), e cold wallet
-- só reabastece hot da própria casa. O perfil fecha por todos os lados:
-- cluster nascido em abril de 2018 (era Gate), 1,35M transações, saques em
-- lote saindo, consolidações de 94+ rotas de depósito entrando, e 889.806 DOG
-- do airdrop parados desde abril de 2024, que é o que custódia faz com um
-- Runestone que estava depositado no dia do snapshot.
--
-- ⚠️ O QUE ISSO FECHA: as desks MM1 e Whale23 pagam o gás sacando BTC da conta
-- delas NA GATE.IO (a carteira de taxa bc1pqdtrwk… é recarregada pelo 1G47),
-- espelhando os funis que eram custódia da Bitget. A frase do dogarmy sobre um
-- braço "operando dentro da custódia da Gate" sai corroborada por este caminho.
--
-- ⚠️ E O QUE FICA HONESTO: o nome apoia num rótulo de TERCEIRO (o da cold), então
-- a linha entra third_party e interna, como a hot da Bitget. As rotas de
-- depósito consolidadas eram abastecidas por saques em lote de 3Hemup…, outro
-- gigante sem rótulo público (512 mil BTC de volume), anotado sem nome.

INSERT INTO dog_labels (address, entity, role, kind, evidence, evidence_note, internal) VALUES
  ('1G47mSr3oANXMafVrR8UC4pzV7FEAzo3r9', 'Gate.io', 'hot', 'exchange', 'third_party',
   'Gate.io BTC hot wallet by convergence (2026-08-24): its single largest funding source is 162bzZT…, labeled "Gate (Cold Wallet)" by spark.money (9.8k BTC balance), which injected 474 BTC in two transactions, and a cold wallet refills only its own house. Exchange-scale profile: cluster born April 2018, 1.35M transactions, 426 BTC balance, batch withdrawals out and multi-address deposit consolidations in, plus 889,806 DOG from the airdrop untouched since April 2024, which is what custody does to a Runestone that sat deposited on snapshot day. It tops up bc1pqdtrwk…, the fee wallet of the desks MM1 and Whale23: the desk operator funds fees with Gate.io withdrawals. The name rests on a third-party label of the cold wallet, so the row stays internal.', true)
ON CONFLICT (address) DO NOTHING;

UPDATE dog_labels SET updated_at = now(),
  evidence_note = 'Fee infrastructure proven at node level (2026-08-24): co-signs the gas input and takes the change in 47 sampled transactions of the desks bc1peczz (MM1) and bc1prdyz (Whale23). Funded by 1G47mSr…, identified the same day as a Gate.io BTC hot wallet (refilled 474 BTC by the spark.money-labeled Gate cold wallet 162bzZT…; cluster born 2018, 1.35M transactions), which pre-fragments fee UTXOs: one 0.63 BTC batch pays fifty 0.01 BTC chunks straight into this wallet. The desk operator funds its fees with Gate.io withdrawals.'
WHERE address = 'bc1pqdtrwkjwdutzs5z8f75gc5srhcwewx4u77pdnumc0fh7l47aanqqa8n4da';
