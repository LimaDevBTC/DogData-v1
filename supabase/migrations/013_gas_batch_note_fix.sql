-- Correção de leitura na nota da carteira de gás das desks (012): o lote de 51
-- saídas do 1G47 não pulveriza infraestrutura desconhecida; ele paga CINQUENTA
-- pedaços de 0,01 BTC direto na própria carteira de gás (pré-fragmentação de
-- UTXOs de taxa, pra co-assinar muitas transações sem encadear troco). A
-- primeira leitura veio de um dict que colapsou 50 chaves repetidas.
--
-- (Aplicada no banco em 24/08/2026 como `gas_batch_note_fix`; este arquivo
-- existe pro repositório contar a mesma história que o banco. A nota foi
-- depois refinada de novo pela 014, que identificou a escala do 1G47.)

UPDATE dog_labels SET updated_at = now(),
  evidence_note = 'Fee infrastructure proven at node level (2026-08-24): co-signs the gas input and takes the change in 47 sampled transactions of the desks bc1peczz (MM1) and bc1prdyz (Whale23). Funded by 1G47mSr3oANX…, an airdrop-recipient wallet that received a 94-address legacy consolidation (co-spending proves one owner) and pre-fragments fee UTXOs: one 0.63 BTC batch pays fifty 0.01 BTC chunks straight into this wallet in a single transaction.'
WHERE address = 'bc1pqdtrwkjwdutzs5z8f75gc5srhcwewx4u77pdnumc0fh7l47aanqqa8n4da';
