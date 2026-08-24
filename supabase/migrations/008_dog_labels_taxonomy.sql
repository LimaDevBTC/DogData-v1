-- O vocabulário dos rótulos vira regra do banco, e o nome vira opcional.
--
-- ⚠️ POR QUE O NOME PRECISA PODER FALTAR. O detector achou uma carteira que
-- aparece em 18% de TODAS as transferências de DOG, com 222 contrapartes que
-- voltam. A gente sabe com segurança O QUE ela é (um mercado) e não sabe DE QUEM
-- ela é. Com `entity NOT NULL` só havia duas saídas, e as duas ruins: chutar um
-- nome, que é invenção, ou não rotular, que joga fora uma informação verdadeira.
-- Agora a classe existe sozinha e a tela escreve "Marketplace" em vez de um nome
-- que ninguém pode sustentar.
--
-- ⚠️ E O CHECK NÃO É BUROCRACIA. Rótulo de explorer é afirmação sobre o mundo
-- real que gente cita, agrega e repete. Sem vocabulário fechado, cada rodada de
-- rotulação inventa uma palavra nova, e seis meses depois ninguém sabe se
-- "exchange" e "cex" na mesma tabela querem dizer a mesma coisa. A lista canônica
-- vive em lib/dog/taxonomy.ts, com a definição de cada classe, o desenho na
-- cadeia que a qualifica e com o que ela costuma ser confundida.
--
-- ⚠️ CLASSE É FUNÇÃO, NÃO TAMANHO. O explorer já tem rótulos de coorte (whale,
-- shark, dolphin, top 10) que dizem QUANTO a carteira tem. Estes dizem O QUE ela
-- faz. Por isso `whale` NÃO está na lista, por mais natural que pareça: a mesma
-- palavra com dois sentidos na mesma tela é como um dado bom vira ruído.

ALTER TABLE dog_labels ALTER COLUMN entity DROP NOT NULL;

-- pelo menos uma das duas afirmações tem que existir, senão a linha não diz nada
ALTER TABLE dog_labels
  DROP CONSTRAINT IF EXISTS dog_labels_diz_alguma_coisa;
ALTER TABLE dog_labels
  ADD CONSTRAINT dog_labels_diz_alguma_coisa
  CHECK (entity IS NOT NULL OR kind IS NOT NULL);

ALTER TABLE dog_labels DROP CONSTRAINT IF EXISTS dog_labels_kind_check;
ALTER TABLE dog_labels
  ADD CONSTRAINT dog_labels_kind_check
  CHECK (kind IN (
    -- infraestrutura: custodia ou intermedia dinheiro de terceiros
    'exchange','marketplace','swap_pool','bridge',
    -- atores: mexem o próprio dinheiro
    'desk','treasury','distributor','project',
    -- especiais
    'burn'
  ));

ALTER TABLE dog_labels DROP CONSTRAINT IF EXISTS dog_labels_role_check;
ALTER TABLE dog_labels
  ADD CONSTRAINT dog_labels_role_check
  CHECK (role IS NULL OR role IN (
    'hot','cold','treasury','deposit','withdrawal','fee',
    'pool','router','escrow','settlement','lock','mint'
  ));

-- ⚠️ SEM PROVA NÃO ENTRA. `evidence` já era NOT NULL com CHECK desde a 007; fica
-- repetido aqui de propósito, para quem ler só esta migração não achar que o
-- grau de prova é opcional.
COMMENT ON COLUMN dog_labels.evidence IS
  'Grau da prova, do mais forte para o mais fraco: own_flow (temos a tx), '
  'first_party (a entidade publicou), co_flow (fluxo exclusivo com endereço provado), '
  'topology (co-gasto: prova o dono ser o mesmo, não quem é), third_party (orienta, não publica sozinho).';
COMMENT ON COLUMN dog_labels.entity IS
  'Nome próprio. NULO quando sabemos o que a carteira faz e não de quem ela é; '
  'nesse caso a tela escreve a classe. Ver lib/dog/taxonomy.ts.';
COMMENT ON COLUMN dog_labels.kind IS
  'Classe de FUNÇÃO, vocabulário fechado. Não confundir com as coortes de TAMANHO '
  'do explorer (whale, shark, top 10), que respondem outra pergunta.';
