-- Um grau de prova que responde OUTRA pergunta.
--
-- ⚠️ OS GRAUS DA 007 FORAM DESENHADOS PARA NOMEAR, e a classificação expôs o
-- furo. `own_flow`, `first_party`, `co_flow` e `topology` respondem QUEM é o dono.
-- Quando o detector conclui que uma carteira é um mercado porque ela aparece em
-- 18% de TODAS as transferências de DOG, com 222 contrapartes que voltam, isso
-- não é nada disso: topologia é co-gasto de ENTRADAS e não tem relação com
-- desenho de fluxo. Carimbar de `topology` descreveria mal a nossa própria prova,
-- que é exatamente o erro que esta tabela existe para impedir.
--
-- ⚠️ E ELE NUNCA SUSTENTA UM NOME PRÓPRIO. Saber que uma carteira é um mercado
-- não diz de quem ela é. A regra vive junto do vocabulário, em
-- lib/dog/taxonomy.ts (`evidenceSupportsName`), e o CHECK abaixo garante que a
-- linha com nome próprio carregue prova de identidade.

ALTER TABLE dog_labels DROP CONSTRAINT IF EXISTS dog_labels_evidence_check;
ALTER TABLE dog_labels
  ADD CONSTRAINT dog_labels_evidence_check
  CHECK (evidence IN (
    -- provam QUEM é o dono
    'own_flow','first_party','co_flow','topology','third_party',
    -- prova O QUE a carteira faz
    'flow_pattern'
  ));

ALTER TABLE dog_labels DROP CONSTRAINT IF EXISTS dog_labels_nome_precisa_de_identidade;
ALTER TABLE dog_labels
  ADD CONSTRAINT dog_labels_nome_precisa_de_identidade
  CHECK (entity IS NULL OR evidence <> 'flow_pattern');

COMMENT ON CONSTRAINT dog_labels_nome_precisa_de_identidade ON dog_labels IS
  'Desenho de fluxo prova funcao, nunca identidade: linha com nome proprio precisa de prova que responda QUEM.';
