-- Contrapartes do dogarmy.space entram como orientação, não como afirmação.
--
-- ⚠️ POR QUE third_party E POR QUE internal = true. O dogarmy.space (turma
-- dogdamassa) mantém uma sala de vigília com carteiras rotuladas, e cita o
-- dogdata.xyz como verificação dos rótulos que publica. Rótulo que veio de fora
-- é `third_party` por definição da 007: aceita para ORIENTAR, nunca para
-- publicar sozinho. `internal = true` é o mecanismo que cumpre a segunda metade
-- da frase: o rotulador e o detector enxergam a linha, as páginas não. Quando
-- co_flow ou desenho de fluxo confirmar com dado NOSSO, o grau sobe e o
-- internal cai.
--
-- ⚠️ UMA JÁ TINHA SIDO ACHADA POR DENTRO. A "Market Maker 2" deles é a desk
-- que o detector de flow_pattern achou sozinho (bc1p8d8ke…). Convergência de
-- dois métodos independentes não vira grau novo; fica registrada na nota.
--
-- ⚠️ A NARRATIVA DELES LÊ O NOSSO RANK 1 COMO "BALEIA ANÔNIMA". A prova
-- own_flow diz Kraken quente. As notas abaixo traduzem as alegações deles sem
-- adotar essa leitura: onde eles dizem "absorvida pela baleia", o registro diz
-- "depositou na Kraken".

INSERT INTO dog_labels (address, entity, role, kind, evidence, evidence_note, internal) VALUES
  ('bc1qhuv3dhpnm0wktasd3v0kt6e4aqfqsd0uhfdu7d', 'Binance', 'hot', 'exchange', 'third_party',
   'Community tag via dogarmy.space, explicitly unconfirmed by them: "Binance Ordinals hot wallet". 51 outbound withdrawals funding the desk cluster, zero coming back, and the wallet holds 0 DOG itself (funding, not custody). Needs our own co_flow before the name can be published.', true),
  ('bc1pt02fw3aty825yaujdnmzml0qny28l9ecc77df2vgc26qfcket3hqc634ar', NULL, 'router', 'desk', 'third_party',
   'dogarmy.space "Intermediary #1 (bridge)": shuttle between the suspected Binance funding wallet and the desk cluster, per their fase2-forensics report (2026-08).', true),
  ('bc1p52673nrtsed5n5nal7cm02u6pg63p0e6u4nm2fhm90xd8r4w3ass090zzy', NULL, 'router', 'desk', 'third_party',
   'dogarmy.space "Intermediary #2": same shuttle role as Intermediary #1 in their fase2-forensics report (2026-08).', true),
  ('bc1pu03udw507wj58y5lv3dky03lxuj0m74uqdnqllckv3s32sw9ahrscjch8j', NULL, 'router', 'desk', 'third_party',
   'dogarmy.space "Intermediary #3" / "Relay #3": the bridge that pulls from the suspected Binance wallet, per their watch room. Holds 0 DOG today, checked against our node on 2026-08-24.', true),
  ('bc1peczzt9rq30pdaj3v9ne86u6v83mfq29rxxgnqxl96uknddzekm9qfreae9', NULL, NULL, 'desk', 'third_party',
   'dogarmy.space "Market Maker 1". Their reading: absorbed by the #1 wallet on Jun 25-26 2026, ~3.9B together with MM2 and Whale7, running today as a zero-balance shuttle recycling exchange withdrawals. With the #1 identified as Kraken hot by own_flow, the same movement reads as a deposit into Kraken.', true),
  ('bc1prdyzwdg0rcdgf9cg0a4zyx0cq3mdr3n6mcym95f3eg4dexfvnsjq200ly4', NULL, NULL, 'desk', 'third_party',
   'dogarmy.space "Whale23": wash trading pattern, documented in their watch room. Rank 28 holder in our index as of 2026-08-24. The codename is theirs, not a real-world identity.', true)
ON CONFLICT (address) DO NOTHING;

-- corroboração externa da desk que o detector já tinha achado por flow_pattern
UPDATE dog_labels
   SET evidence_note = evidence_note ||
       ' Independently tagged "Market Maker 2" by dogarmy.space (watch room, 2026-08): the same desk reading, reached from outside.',
       updated_at = now()
 WHERE address = 'bc1p8d8kexdxatnfejdvd9dq7uky4m9wjxl59r3dnqg7nqq9gaxz2jxq6ntach'
   AND evidence_note NOT LIKE '%dogarmy.space%';
