-- Um terceiro estado no vocabulário da atribuição de remetente.
--
-- ⚠️ O CHECK da `dog_tx_senders_rebuilt` conhecia dois estados: `direct` (uma
-- única entrada candidata, o valor saiu de graça) e `ambiguous` (mais de uma
-- candidata, valor nulo). O `unisat-load-amounts.py` fecha os ambíguos com os
-- eventos coletados da UniSat, e o estado resultante não é nenhum dos dois:
-- `unisat_event` diz que o QUANTO veio da API de eventos, com a procedência
-- gravada também dentro de cada remetente no `senders` da tabela principal.
-- O coletor levanta blocos pendentes filtrando por `ambiguous`, então este
-- valor novo é o que faz a fila ENCOLHER a cada rodada do carregador.

ALTER TABLE dog_tx_senders_rebuilt DROP CONSTRAINT IF EXISTS dog_tx_senders_rebuilt_dog_attribution_check;
ALTER TABLE dog_tx_senders_rebuilt
  ADD CONSTRAINT dog_tx_senders_rebuilt_dog_attribution_check
  CHECK (dog_attribution IN ('direct', 'ambiguous', 'unisat_event'));
