-- Quem é quem no grafo do DOG.
--
-- ⚠️ ISTO É O QUE A ARKHAM VENDE, E A GENTE PRECISA TER O NOSSO. Sem rótulo, uma
-- transferência de 900 milhões de DOG é só um número; com rótulo, ela é "alguém
-- depositou na Kraken", que é notícia. A tabela é pequena de propósito: cada linha
-- é uma afirmação sobre o mundo real, e afirmação errada aqui vira manchete errada
-- lá na frente.
--
-- ⚠️ TODO RÓTULO CARREGA O GRAU DA PROVA, e é essa coluna que separa a gente de um
-- palpite bem escrito. Em ordem decrescente de confiança:
--
--   own_flow     o fundador mandou ou recebeu desta carteira e mostrou a tx.
--                É a prova mais forte que existe: testemunha com recibo.
--   first_party  a própria corretora publicou o endereço.
--   co_flow      fluxo exclusivo e numa direção só com um endereço já provado
--                (tesouraria que só abastece a carteira quente, por exemplo).
--   topology     co-gasto de entradas, o agrupamento clássico. Sozinho não basta
--                para dizer o NOME da entidade, só que o dono é o mesmo.
--   third_party  veio de fora. Aceita para orientar, nunca para publicar sozinho.
--
-- ⚠️ E `internal = true` NUNCA SAI DAQUI. O endereço de depósito pessoal do
-- fundador está nesta tabela porque o rotulador precisa dele para não confundir
-- venda pessoal com fluxo de mercado. Mas publicá-lo ao lado da carteira pública
-- de doações contaria a qualquer um quando e quanto ele vendeu. Toda leitura que
-- vira página tem que filtrar por `internal = false`, e a de /api/insights filtra.

CREATE TABLE IF NOT EXISTS dog_labels (
  address       text PRIMARY KEY,
  -- o nome que vai para a tela: "Kraken", "CoinEx", "UniSat"
  entity        text NOT NULL,
  -- o papel dentro da entidade: hot, treasury, deposit, withdrawal, fee, pool
  role          text,
  -- exchange | marketplace | bridge | pool | project | whale
  kind          text NOT NULL,
  evidence      text NOT NULL
                CHECK (evidence IN ('own_flow','first_party','co_flow','topology','third_party')),
  -- por que a gente acredita, em uma frase, com os números que sustentam
  evidence_note text,
  internal      boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dog_labels_entity_idx ON dog_labels (entity);
-- o índice que as páginas usam: só o que é publicável
CREATE INDEX IF NOT EXISTS dog_labels_public_idx ON dog_labels (address) WHERE internal = false;

ALTER TABLE dog_labels ENABLE ROW LEVEL SECURITY;

INSERT INTO dog_labels (address, entity, role, kind, evidence, evidence_note, internal) VALUES
  ('bc1plzs2lltvv29k603w5m0aqma5e8w0n3pc77dt89l5w9hurmdfgd0swdhspn', 'Kraken', 'hot', 'exchange', 'own_flow',
   'Varre os depositos do fundador: 7 depositos dele, 7 varreduras, mesma janela de 17/07 a 19/08/2026. 2.457 contrapartes distintas.', false),
  ('bc1pap56p2rgmqgk4rc0vxpkldszhgldx49cfs3zer8e2k7q9q6x079scfa8nx', 'Kraken', 'treasury', 'exchange', 'co_flow',
   'Alimenta a carteira quente: 169 transferencias, 10,78 bilhoes de DOG, uma direcao so, de 25/06 a 24/08/2026. Cluster de co-gasto com 1.696 enderecos.', false),
  ('bc1pwxdpn5c9weqctt8yx3kpxmyv0ej6dvgcssp3hzdg7c5t7n468mxq9zt477', 'Kraken', 'withdrawal', 'exchange', 'own_flow',
   'Pagou um saque do fundador (tx 89c88705...), com abastecedor de gas separado, que e o padrao de corretora com runes.', false),
  ('bc1qmscmeqqxqz7vkfscfs8pvl98gkdkcr8e0egkhm', 'CoinEx', 'deposit', 'exchange', 'first_party',
   'Endereco divulgado pela propria corretora. 3.568 transacoes, 673 contrapartes desde 03/07/2024.', false),
  ('bc1pf57ydds0ldxyrhq9s2p4ecnxe4hr0taxvgjpza3tjlyrpukt0fnqxwd6xs', 'Kraken', 'deposit', 'exchange', 'own_flow',
   'Endereco de deposito pessoal do fundador. INTERNO: publicar isto ao lado da carteira de doacoes revela quando e quanto ele vendeu.', true)
ON CONFLICT (address) DO NOTHING;
