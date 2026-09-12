# DogCity Master Plan — A Constituição da Fundação (`masterplan.md`)

> **Meta:** consolidar TODAS as decisões de fundação da DogCity num documento canônico —
> as fórmulas que transformam histórico on-chain em lote, o ciclo de vida do prédio, a
> linha do tempo do snapshot, o schema do deed (Ordinal), o programa cívico completo e a
> Reserva Urbana do projeto. Este doc é a **lei**; o gerador do registry é o **cartório**;
> a cidade 3D é o **renderer**. Onde qualquer doc anterior divergir
> (`reorganizecity.md`, `crosschaincity.md`, `mintcity.md`), **vale este**.
>
> **Origem:** conversas de design com o dono, 2026-07-10. Todas as decisões de fundação
> marcadas 🔒 foram travadas pelo dono nessa data.
>
> ✅ **§2 IMPLEMENTADO (dry-run) em 2026-07-10:** `scripts/foundation_generator.ts` roda
> as fórmulas deste doc contra as 86.252 carteiras reais (zero escrita em Supabase, zero
> chamada a ord/bitcoin-cli, zero gasto). Achou e **corrigiu** um bug estrutural real na
> geometria herdada do crosschaincity — ver §2.1. §§3–6 (snapshot, deed/mint, cívico,
> reserva) seguem apenas como plano; nada de dinheiro/inscription foi implementado.

---

## §0 — Princípios invioláveis

1. **A localização não se compra.** Posição = história on-chain no bloco do snapshot. Nada
   que se pague (licença, doação, parceria) muda a posição de uma carteira. Jamais.
2. **Prédio é da carteira, como os UTXOs.** 🔒 O deed é intransferível *na prática*: o
   vínculo lote↔endereço mora no **registry** (a lei); a inscription é o **certificado**.
   Transferir a inscription não transfere nada — o renderer ignora o novo portador.
3. **A fundação é uma fotografia.** 🔒 Lote (posição, área, distrito, tipologia) congela no
   bloco do snapshot, para sempre. Gastar UTXO antigo *depois* não move o prédio.
4. **Só o prédio respira.** Altura/classe/estado derivam do saldo vivo — calculados pelo
   indexador (padrão deed+oráculo), **nunca armazenados on-chain**.
5. **Don't trust, verify.** Algoritmo público + snapshot reproduzível + merkle root do
   registry inscrito no Charter ANTES do mint + janela de auditoria pública.
6. **Nenhum lote de carteira jamais se move.** Terra cívica e Reserva Urbana são
   subtraídas do terreno ANTES da atribuição de lotes.

---

## §1 — Ciclo de vida do prédio 🔒 (banda 20k / 10k / 20k)

| Estado | Condição | Visual |
|---|---|---|
| **Lote à espera** | Nunca atingiu 20k DOG | Terreno demarcado, sem prédio (periferia) |
| **Construção** | Cruzou **20.000 DOG** (1ª vez ou reconstrução) | Animação de canteiro → prédio ergue |
| **Em pé** | Saldo ≥ **10.000 DOG** (já construído) | Prédio vivo; altura respira com o saldo |
| **Ruína** | Saldo caiu abaixo de **10.000 DOG** | Colapso; ruína permanente no lote |
| **Reconstrução** | Voltou a ≥ **20.000 DOG** (punição: 2× o piso) | Nova animação de construção |

- Lote **nunca** é realocado ou confiscado — ruínas são arqueologia on-chain.
- Simetria de marketing: *"10k doados = licença + deed; 20k mantidos = prédio de pé."*
- Histerese embutida na banda (20 constrói / 10 sustenta) elimina flicker na fronteira.

---

## §2 — LotGenesis: as fórmulas da fundação

Entradas por endereço, lidas **no bloco N do snapshot** (nunca de exports datados):
saldo `S`; conjunto de UTXOs `{valor, block_height_de_confirmação}`; `LTH%`; coorte de
airdrop. **Idade = block height absoluto** (🔒 dias relativos a export são proibidos na
fundação — não são reproduzíveis).

### Campos CONGELADOS (imutáveis, vão no deed)

| Campo | Fórmula |
|---|---|
| Elegibilidade | `S ≥ 1 DOG` (abaixo = poeira, sem lote) — igual ao registry atual (`DUST_MAX`) |
| **position_score** | Block height do **UTXO mais antigo ≥ 20.000 DOG** 🔒 (constante única, alinhada ao gatilho de construção; substitui o 10k do reorganizecity/registry). Carteiras sem UTXO ≥20k → **periferia**, ordenadas pelo UTXO mais antigo de qualquer valor 🔒 |
| Distrito | Banda do ranking de position_score (10 coortes centro→borda, Genesis Core → Fresh Arrivals). ⚠️ O **anel 0** dos 85 "Satoshi Visionary" colado à plaza foi REVOGADO em 2026-09-10: essa coorte mora na Orla Nobre da alça (§10), e o anel 0 fica só com o núcleo cívico. Ver o registro no §9 |
| **lot_area** | `área = 40 + 7960 · √(S / supply)`; lado = `√área` (curva atual de `footprintWidth` — piso 40 visível, teto 8.000 campus-de-baleia; já validada visualmente) |
| Coordenadas | `(x, z, rot)` determinísticos do gerador (phyllotaxis/idade centro→fora, append-only) + endereço de rua (`streetAddress`) |
| **Tipologia** | Derivada do `utxo_count` no snapshot e CONGELADA 🔒: poucos UTXOs = torre concentrada; muitos = condomínio horizontal (reorganizecity §forma). Consolidar UTXOs depois NÃO morfa o prédio |
| founding_prestige | Estrelas 1–5 na fundação: `0.5·idade(cap 2a) + 0.2·log₁₀(S) + 0.3·LTH%` (fórmula atual) |

### Campos DINÂMICOS (oráculo `/api/deed/{lot_id}` — nunca inscritos)

| Campo | Fórmula |
|---|---|
| building_class | `floor(log₁₀(saldo vivo))` 0–9 → Cottage · House · Condo · Tower · Skyscraper · Landmark |
| state | à espera / em pé / ruína / reconstrução (banda do §1) |
| prestige atual | Mesma fórmula de estrelas, com dados vivos |

**Fonte de dados:** `dog_utxos_by_address.json` já tem `ts` (timestamp absoluto do bloco
de confirmação) em 100% dos UTXOs — usado como `position_score` direto, sem precisar
patch no scanner Python (dias-relativos-ao-export foi descartado; `ts` é imutável).
**Unificação pendente:** o `/api/plot` do /donate (hoje por saldo) ainda precisa passar
a ler o registry — uma fonte de verdade só (não feito nesta rodada).

### §2.1 — Correção de geometria (2026-07-10, implementada)

O dry-run achou 4 colisões reais entre lotes de distritos vizinhos. Causa: o modelo
antigo (`BTC_DISTRICT_CENTERS` em `zones.ts`) dava a cada distrito seu próprio centro de
espiral a 109–1.261 unidades de distância dos vizinhos — mas o raio da espiral de UM
distrito sozinho, na população real da fundação (~9.395 lotes/distrito), chega a 1.357
unidades. Ou seja: **toda** espiral se sobrepunha à do vizinho nos anéis externos. Bug
estrutural do modelo pensado pra cidade crescendo aos poucos, não pra ~84 mil carteiras
aterrissando de uma vez.

**Correção 🔒 (implementada em `lib/city/zones.ts`):** distritos 1–9 passam a ter **cunha
angular exclusiva** (40° cada, sequência de Kronecker/Weyl pra preencher sem faixas) —
uma parede matemática que nenhum lote pode atravessar, **para qualquer população**, não
só as testadas. Distrito 0 (ring 0 / Genesis Core) continua com a espiral pequena
antiga, população fixa e minúscula (~85 + buffer cívico), com raio máximo bem abaixo de
onde as cunhas começam. Resultado: **0 colisões em 84.639 lotes**, geometria
comprovadamente segura por construção, não por sorte de espaçamento.

---

## §3 — Linha do tempo da fundação 🔒 (tudo em blocos, nada em datas)

⚠️ **REESCRITA EM 12/09/2026, PORQUE A REALIDADE DESACOPLOU O SNAPSHOT DO FUNDO.** A versão
anterior travava `snapshot em N = B + 1008`, onde B era o bloco em que o fundo cruzasse os
10M. **Não foi o que aconteceu:** o snapshot foi tirado no bloco **966.670** com o fundo em
**4.901.656 DOG, 49,0%**. Manter a linha antiga deixava a constituição descrevendo uma
sequência que já não é a que está em curso, e qualquer um que lesse os dois apontaria.

```
snapshot (966.670)  ────  reconciliacao + regra  ────  auditoria (432 blocos)  ────  Charter  ────  fundo = 10M  ────  MINT
       │                          │                             │                      │                │
   FEITO, fechado          o que ainda falta            mapa + merkle root        deeds nascem      janela de
   e verificado            decidir e publicar           publicos; qualquer        filhos do         Fundador
                                                        um reproduz               Charter           FECHA
```

**O que mudou, em uma frase:** o snapshot deixou de ser consequência do fundo e virou
**marco independente**. O fundo continua sendo o gatilho do MINT e do fechamento da janela
de Fundador; ele não é mais o gatilho da fotografia.

1. **Fase 1, FEITA em 12/09/2026.** Snapshot no bloco 966.670. 85.818 carteiras,
   239.432 UTXOs, 99.975.593.202,33 DOG. Supply e identidade do conjunto fecham em zero,
   zero saldo negativo. Artefatos e hashes em `data/snapshots/` (fora do git, ver §11 do
   caderno). Relatório público em `marketing/SNAPSHOT-REPORT.md`.
   ⚠️ A campanha educativa da fase 1 antiga ("não consolide UTXO antigo, isso destrói
   idade e custa posição") **não aconteceu antes do snapshot**, e o custo disso é medido:
   513 Diamond Paws perdem posição central por terem consolidado. Quem consolidou não foi
   avisado. Isso é dívida, não é escolha, e precisa aparecer em qualquer comunicação sobre
   posição.
2. **Fase 2, EM ABERTO.** A régua de posição para as 58.875 carteiras sem tier (68,6% da
   cidade, 69,89B DOG) não está decidida. Ver o caderno. Nada de posição pode ser publicado
   antes dela.
3. **Fase 3.** Registry computado; mapa completo e merkle root publicados; **432 blocos
   (~3 dias) de auditoria pública** 🔒 (144 foi rejeitado como curto demais).
   ⚠️ **Merkle root ainda NÃO EXISTE.** A landing já promete reprodutibilidade; hoje o que
   existe é o sha256 do artefato, que prova que o arquivo não mudou mas não deixa terceiro
   recomputar a lista. Ou nasce o script, ou a promessa muda de texto.
4. **Fase 4:** **DogCity Charter** inscrito (Ordinal-pai com o merkle root) → mint abre.
5. **Fase 5:** o fundo cruza 10M e a **janela de Fundador fecha para sempre** (§11).

---

## §4 — O deed (Ordinal) e o pipeline de mint 🔒

- **Um Ordinal-pai (Charter) origina todos os deeds como filhos** 🔒 — proveniência
  parent/child exige gastar input do pai, que só o projeto detém → **o serviço do projeto
  inscreve** cada deed direto no endereço da carteira (Modelo B), cobrando **exatamente a
  taxa de rede BTC** (promessa da landing). Conteúdo determinístico e conferível contra o
  registry público — confiança verificável, não exigida.
- **Deed JSON (estático):** `lot_id`, distrito, `(x, z, rot)`, endereço de rua, lot_area,
  tipologia, position_score (block height), founding_prestige, snapshot block N, versão do
  algoritmo + **declaração da regra dinâmica** ("building_class = f(saldo DOG vivo da
  carteira); renderer canônico: dogdata"). Nada dinâmico vai on-chain.
- **Gate:** mint requer Personal License (≥10k DOG doados — accumulator do /donate).
  Licenciado com saldo <20k minta o deed normalmente; o lote nasce "à espera".
- **Infra:** ord wallet do projeto (custódia do Charter) + gestão de taxas. ⚠️ O ord CLI
  disputa o lock redb com `dog_scanner` — jobs de inscription rodam em **janelas
  exclusivas agendadas** (ver ord.service).

### §4.1 — Customização: ferramentas internas de edição 🔒

Terceira camada do modelo de dados do prédio, ao lado do que já existia (§0.4):

| Camada | Fonte | Onde mora | Muda quando |
|---|---|---|---|
| **Congelada** | História on-chain no bloco N | Deed (Ordinal) | Nunca |
| **Derivada** | Saldo DOG vivo | Oráculo (renderer) | A cada mudança de saldo |
| **Customização** 🆕 | Escolha do dono | Off-chain, mutável, ligada ao `lot_id` | Quando o dono quiser |

**Regra de ouro:** customização é **cosmética, nunca estrutural** — não pode furar o
envelope físico que a camada derivada já define (`building_class`/`height_tier` cap a
altura; `lot_area` cap a pegada). Ninguém edita para além do que o saldo autoriza.
Nada de customização é inscrito no Bitcoin — não precisa de consenso trustless porque
não afeta posição, propriedade ou escassez, só aparência. O deed continua verificável
contra o registry público exatamente como descrito em §0.5.

**Trilha por tier** 🔒 (owner, 2026-07-10 — "users vão poder usar ferramentas de edição
internas... patrons podem personalizar"):

- **Personal License (10k+) — Kit Básico:** modelo-base do catálogo (restrito pela
  tipologia congelada — torre/casa/condomínio), paleta de cor/material, estilo de
  telhado, add-ons decorativos limitados (varanda, antena, jardim). Escala de graça
  para as ~86k carteiras — nada aqui é gerado sob demanda.
- **Commercial License (50k+) — Kit Estendido:** tudo do Personal + edição livre de
  modelo/altura/cor dentro do envelope, espaço de anúncio na fachada, texto de
  sinalização/endereço comercial (decisão já travada em 2026-07-09, reafirmada aqui).
- **Patron (500k+) — "Personalizar" (camada elevada):** tudo do Commercial + modo
  avançado do MESMO editor interno, sem as restrições combinatórias dos tiers abaixo
  (silhueta customizada, empilhamento livre de add-ons, cor em hex livre). Para pedidos
  verdadeiramente únicos, mantém-se a fila manual de modelagem (brief/imagem → humano)
  como caminho opcional — não obrigatório, já que o modo avançado do editor cobre a
  maioria dos casos sem depender de fila.
- **Licença ≠ saldo vivo:** a licença (paga uma vez) dá acesso PERMANENTE às
  ferramentas do tier, mesmo que o lote esteja `waiting` (ainda não construiu). O dono
  pode desenhar o prédio ANTES de cruzar 20k — no momento em que constrói, a
  customização já escolhida aparece de cara. "Projete enquanto espera."
- **Autenticação:** só a carteira dona do lote edita (assinatura BIP-322 via
  `connectwallet.md` Bloco A, já implementado) — consistente com o princípio soulbound
  do §0.2: a customização é tão intransferível quanto o prédio.

**Fora de escopo nesta rodada:** a UI do editor 3D em si (`/city/explore`), o schema
JSON completo de customização e o catálogo de peças/add-ons por tipologia — são um
projeto de engenharia à parte (pipeline de assets + UX), a ser desenhado quando a
sequência §8 chegar nesse ponto.

---

## §5 — Programa Cívico (terra reservada ANTES dos lotes)

Já existem: Satoshi Plaza + Lunar Spire, BitFlow Tower, Kray Tower + dirigível, lagos
(Founders Pool) c/ praias, montanhas, florestas, parques, malha viária c/ tráfego.
Âncoras DogShopping e BuildSpace seguem planejadas (reorganizecity §1). Decididos antes:
Founders' Monument + Patrons' Walk (plaza).

**Faltantes aprovados (dono, 2026-07-10)** — prioridade de modelagem P1/P2/P3:

### Esporte
| # | Equipamento | Gancho / Localização | P |
|---|---|---|---|
| 1 | **Estádio Olímpico** c/ pista de atletismo 400m | Temporadas do leaderboard; borda + terminal de metrô | P1 |
| 2 | **Estádio de futebol** | Naming rights futuro (precedente BitFlow) | P1 |
| 3 | **Ginásio coberto / arena indoor** | Shows, e-sports | P2 |
| 4 | Complexo aquático | Margem do lago | P2 |
| 5 | Quadras de bairro (basquete/futsal) | Espalhadas pelos distritos | P3 |
| 6 | Skatepark | Cultura jovem | P3 |

### Educação & Ciência
| 7 | **Polo universitário "DOG University"** (reitoria, biblioteca, auditório, dormitórios) | Hospeda docs/educação do protocolo; quarteirão próprio anéis médios | P1 |
| 8 | Escolas de bairro (3-4) | Distritos | P3 |
| 9 | **Observatório** | Topo da montanha existente — mira a lua (DOG•GO•TO•THE•MOON) | P3 |

### Saúde
| 10 | **Hospital geral** c/ heliponto | Helis do tx-layer ganham destino; central | P1 |
| 11 | Postos de saúde (2-3) | Periferia | P3 |

### Cultura
| 12 | **Teatro municipal** | Fachada nobre, praça própria | P1 |
| 13 | **Museu da Runa** | Etching, airdrop, txs históricas, halvings | P2 |
| 14 | Centro de convenções | Conferências | P2 |
| 15 | Anfiteatro ao ar livre | Dentro do parque central | P3 |
| 16 | Cinema | Quarteirão de entretenimento | P3 |

### Cívico
| 17 | **City Hall** | Governança + Founders Register físico | P2 |
| 18 | Corpo de bombeiros (2-3 quartéis) | Distritos | P3 |
| 19 | **Correio central "Mempool Post"** | Cartas = transações pendentes (mempool real) | P3 |
| 20 | **Memorial do DOG Perdido** | Supply queimado/inacessível; par do "Bairro Adormecido" (diamond paws) | P2 |

### Transporte (espinha dorsal)
| 21 | **Aeroporto internacional** (pista, terminal, torre) | Extremo plano; aviões = veículo do tx-layer | P1 |
| 22 | **Linhas de metrô** aeroporto↔centro↔porto, 1 estação/distrito, trem animado | O conector da cidade | P1 |
| 23 | **Porto de navios grandes** + zona industrial (armazéns, guindastes) | Costa VIRADA para as ilhas SOL/STX — daqui saem as balsas multichain | P1 |
| 24 | Estação central (hub tipo Grand Central) | Ao lado da plaza | P2 |
| 25 | Marina pública | Formaliza os barcos existentes | P3 |

### Utilidades & Indústria
| 26 | **Usina = Mineradora de Bitcoin** (mining farm c/ torres de resfriamento) | Hashrate é a energia da cidade; zona industrial do porto | P2 |
| 27 | Torres d'água de bairro | Charme de skyline | P3 |

### Lazer & Ícones
| 28 | Parque central formalizado (c/ anfiteatro) | Consolida os parques existentes | P2 |
| 29 | **DOG Park gigante** | O "zoológico" da cidade do DOG | P3 |
| 30 | Roda-gigante no pier | Cartão-postal noturno da orla | P3 |
| 31 | Mercado municipal | Comércio público coberto | P3 |
| 32 | **Estátua colossal do DOG** na entrada do porto | A Estátua da Liberdade da DogCity — recebe os navios das outras chains | P1 |

### Adições da revisão (2026-07-10)
| 33 | **Casa da Moeda "The City Mint"** | Onde os deeds nascem — materialização do Charter; a UI do mint leva o user "até a Casa da Moeda" | P2 |
| 34 | **DOG DATA HQ / Bolsa de Valores** | Fachada-ticker AO VIVO (preço, holders, LTH/STH — dados reais do site) | P2 |
| 35 | **Torre de transmissão + Redação aibtc.news** | Onde o Xored Pike "trabalha" — a imprensa da cidade é real | P3 |
| 36 | **Farol** | Entrada do porto, girando à noite, ao lado da estátua | P3 |
| 37 | **Ponte icônica** (estilo Golden Gate) | Sobre a água na direção das ilhas; balsas passam por baixo | P2 |
| 38 | **Grand Hotel** | Junto ao centro de convenções; candidato a naming rights | P3 |
| 39 | Teleférico até o observatório | Transporte cênico | P3 |

Opcionais anotados (sem compromisso): Genesis Chapel (bloco gênese "consagrado"), postos
"Node Watch", aquário na orla.

**Regra de ouro:** todos os equipamentos viram **zonas reservadas no gerador ANTES da
atribuição de lotes** — carteiras se distribuem no terreno restante. Nenhum lote se move.

---

## §6 — Reserva Urbana DOG DATA (land bank do projeto) 🔒

Espaços bem localizados, de posse do projeto, à espera de novas ideias — **ativo e fonte
de renda** (parcerias, naming rights, features futuras).

- **Anti-buraco:** cada parcela nasce como **pocket park / praça ajardinada** — completa
  hoje, construível amanhã. Ideia aprovada → parque vira canteiro (animação existente) →
  prédio do parceiro. Precedente: BitFlow Tower.
- **Dotação ORIGINAL, revogada em 2026-09-10 (~25 parcelas, <1% da área):** 1 premium
  colada ao anel da Satoshi Plaza; 2 por distrito nos anéis 0–3 (8 nobres); 4 na
  orla/waterfront; 1 em cada eixo de chegada; 2 grandes na zona de expansão do porto. Fica
  registrada porque descreve BEM as posições que o projeto quer; o que morreu foi o teto de
  ~25 parcelas e de <1% da área, escritos quando o sítio tinha raio 4.500.
- **Dotação VIGENTE (2026-09-10): o RESÍDUO.** A terra livre construtível que sobra depois de
  todas as carteiras receberem lote é do projeto. Split travado em **70% holders / 30%
  projeto** sobre os 128,20 km² livres, ou seja **38,46 km²**, com o programa definido por
  FUNÇÃO (marina, clube, hotel, sede, e o que a cidade precisar) e não por número de parcelas.
  A curva de área que produz esse resíduo está em `tiersposition.md` §3.7. ⚠️ A ordem importa:
  a curva é travada ANTES, senão o resíduo desejado passaria a definir o lote do holder.
- **Transparência:** entram no registry como `owner: DOGDATA_RESERVE` e **vão declaradas
  no merkle root do Charter** — o que é do projeto está escrito na fundação, auditável
  desde o dia 1 (protege o princípio "placement can't be bought").
- **Regra de uso:** reserva vira prédio comercial/parceiro — **nunca** lote de carteira,
  **nunca** engole equipamento cívico.
- **Dotação da Orla Nobre (65 parcelas, 2026-09-10):** a alça da baía tem land bank
  próprio, decidido junto com a orla no §10. Substitui a linha "4 na orla/waterfront"
  acima, que foi escrita antes de a alça existir como projeto. Divisão: **20 na fileira
  da frente** (4 blocos de 5) e **45 na de trás** (9 blocos de 5). Os
  blocos da frente existem para a orla ter destino público: sem eles são 15,5 km de
  lotes privados em fila, e os 30 acessos à praia viram passagem sem chegada. O gabarito
  de 2 pavimentos da fileira da frente decide sozinho o programa de cada face, e não é
  restrição de verdade: marina, clube, píer, restaurante e praça de orla são horizontais
  por natureza. O que for alto (hotel, sede, torre) vai para a fileira de trás, onde não
  há limite.

---

## §7 — Topografia

Terreno procedural **determinístico seedado por block hash do Bitcoin** (proposta: o
bloco de etching da runa DOG) — colinas, linha de costa, posição fina de lagos/rios
derivadas da chain. Auditável, reproduzível, narrativa ("até o relevo veio do Bitcoin").
Restrições: aeroporto exige planície na borda; porto exige costa profunda virada às
ilhas; observatório usa a montanha existente; Founders Pool preservado.

---

## §8 — Sequência de execução

1. ✅ Este documento (constituição aprovada).
2. ✅ **Gerador da fundação (dry-run):** `scripts/foundation_generator.ts` — `ts` como
   position_score (20k), tipologia congelada, terra cívica + Reserva subtraídas antes
   dos lotes, anel 0 provisório. **Rodado contra as 86.252 carteiras reais** → achou e
   corrigiu bug de colisão geométrica (§2.1); 0 colisões no resultado final. Pendente
   ainda dentro deste passo: o join com o cohort comportamental real, que em
   2026-09-10 deixou de ser "preencher o anel 0" e passou a ser "preencher a Orla
   Nobre" (§10). O proxy pelos 85 position_score mais antigos continua no código e
   agora está SOBRANDO: o anel 0 não tem mais dono, e o dataset que falta para o
   join é `data/forensic_behavioral_analysis.json`, que já existe e é atualizado
   pelo `update_forensic_analysis.py`.
3. Topografia + âncoras cívicas P1 no 3D (`/city/explore`).
4. Schema final do deed + pipeline de mint (Modelo B) + janelas do ord.
4.1. **Editor de customização (§4.1):** schema JSON + catálogo de peças por tipologia +
   UI do editor em `/city/explore` — projeto de engenharia à parte, ainda não iniciado.
5. Ajustar copy da landing (10k = licença+deed; 20k = prédio) e unificar `/api/plot`.
6. Publicação do plano + Fase 1 da campanha → aguardar 10M → §3.

---

## §9 — Decisões travadas (registro)

🔒 2026-07-10, dono: soulbound à carteira (registry=lei) · posição congela no snapshot ·
banda 20/10/20 c/ ruína punitiva · lotes <20k à espera na periferia · snapshot B+1008 ·
auditoria mínima 432 blocos · Charter pai de todos os deeds (Modelo B) · 20k como metro
único de posição · idade em block height (`ts`, implementado) · tipologia congelada ·
programa cívico §5 · Reserva Urbana §6 · geometria de distrito em cunha angular exclusiva
(§2.1, implementada, substitui espiral por centro) · customização por ferramentas
internas de edição, Personal/Commercial no kit paramétrico, Patron com modo avançado
elevado (§4.1).

---

🔒 **2026-08-28, dono. A rodada que mexeu na constituição.** Seis decisões, e as três
primeiras revogam texto que estava travado acima. Fica assim de propósito: o registro
guarda o que valia antes e por que mudou, senão daqui a três semanas isto vira discussão
outra vez.

**1. A área do lote deixa de ser fixa e passa a seguir a bag.** O lote de 300,0 m² igual
para todos (`plano-diretor.md` §2.1) morre. Área proporcional à RAIZ do saldo. Medido:
a terra por carteira é 16,33 km² sobre 52.993, ou seja 308 m² de média, então lote premium
maior só existe tirando de alguém. Com a raiz, o portão de 20k fica com 50 m², a mediana
com 333 m² (praticamente o lote de hoje, o tecido sobrevive), o p99 com 1.333 m² e a maior
carteira com 4,0 ha. Razão maior/menor 805x, contra 648.082x do proporcional puro, que
transformaria a cidade em cem latifundiários e 53 mil armários.

**2. `utxo_count` vira o terceiro eixo, e ele não mexe em área, mexe em FORMA.** Medido:
R² de 0,053 contra o saldo, ou seja informação nova de verdade. 1 UTXO (63,2% da cidade)
é massa única, casa no centro e fazenda na borda; 2 a 9 (30,6%) é pátio ou condomínio
baixo; 10 a 99 (5,9%) é torre, a mesma área sobe em vez de espalhar; 100+ (114 carteiras)
é quarteirão com várias torres. **Idade diz onde, saldo diz quanto, número de UTXOs diz
que forma.** Nenhum dos três é inventado.

**3. Gradiente centro-periferia.** Área por DOG cresce com o raio. A mesma carteira
mediana pega 170 m² no centro ou 454 m² na borda. Resolve o problema de a periferia ser
castigo: quem chega novo vai longe e recebe TERRA, quem é velho fica perto e recebe
ENDEREÇO.

**4. Crescimento por geração, não por subdivisão infinita (opção A).** Medido: o supply
comporta 4.969.650 carteiras de 20k, e a cidade construída atende 1,1% disso. Curva
côncava CRIA terra do nada quando a carteira se parte (4M partido em dois 2M rende 41% mais
chão), então a raiz não sobrevive à subdivisão infinita. A cidade fundadora congela nas
~53 mil e quem se dividir manda os filhos para **domos novos**, cada um uma safra datada.
A alternativa recusada era proporcional puro, que conserva para sempre e faz uma cidade
dura hoje.

**5. Peça de customização PODE ser inscrita, revogando o §4.1.** O §4.1 dizia "nada de
customização é inscrito no Bitcoin, porque não afeta posição, propriedade ou escassez, só
aparência". Continua certo enquanto enfeite é enfeite: no momento em que a peça tem edição
limitada e custa DOG, ela vira bem escasso, e bem escasso fora da cadeia é promessa nossa,
não fato. Forma: **prédio é a inscrição pai, cada peça comprada é uma inscrição filha**, e
o HTML recursivo lê `/r/children/<id>`. O prédio cresce sem nunca ser reescrito e a ordem
das filhas é a linha do tempo da obra.
⚠️ Limite duro: a recursão enxerga PROCEDÊNCIA, não POSSE. Peça soldada renderiza 100% na
cadeia e não é vendável; peça negociável precisa do nosso indexador e deixa de ser
trustless. Decisão: soldar, casando com o soulbound do §0.2.
⚠️ Armadilha medida: comprar peça com DOG baixa o saldo e, pela decisão 1, ENCOLHERIA o
prédio. Conserto: a área olha saldo mais o DOG já enterrado na cidade.

**6. Raridade é o registro, não o dado.** Sorteio seria a primeira coisa arbitrária num
projeto cujo pitch é "Don't trust. Verify.". Escassez honesta: edição limitada, peça que a
cadeia autoriza (UTXO anterior a tal bloco, nunca vendeu, Runestone, DSC, fundador) e
janela de blocos. O valor acumula upando.

**Pendente desta rodada, ainda NÃO decidido:** tamanho do apartamento, que por aritmética
decide a altura média da cidade (20 m² dá 12 andares, 35 m² dá 21, 70 m² dá 43).

🔒 **2026-08-28, dono: SOL e STX saem dos polos.** `lib/city/lunar/sites.ts` põe Solana em
Shackleton (polo sul) e Stacks em Peary (polo norte), a milhares de quilômetros do sítio
`btc-core`. A decisão é que os domos das outras cadeias sejam **módulos vizinhos** do domo
fundador, no mesmo mare, e não sítios polares isolados. Isso casa com a decisão 4: expansão
é domo novo ao lado, não cidade nova em outro hemisfério. NÃO IMPLEMENTADO: `sites.ts`
continua polar até alguém mexer.

🔒 **2026-09-10, dono: A ORLA NOBRE DA ALÇA.** A alça de terra que abraça a baía passa a
ser o endereço mais nobre da cidade, acima do centro. Ver o desenho inteiro no §10.

**1. O centro deixa de ser o prêmio.** O Ring 0 do `foundation_generator` guardava 85
assentos para os "Satoshi Visionary" e o próprio cabeçalho marcava o preenchimento como
proxy provisório. A alça ganha porque tem o que o centro não pode ter: frente de água,
vista da cidade inteira do outro lado da baía e uma via só de acesso. O centro fica
cívico, que é para o que já tem 200 `CIVIC_CORE_SLOTS` reservados ao lado.

**2. Quem mora lá são os três primeiros tiers do classificador de airdrop**, ou seja
Satoshi Visionary (88), BTC Maximalist (99) e Rune Master (258): **445 carteiras**, todas
ainda holders. Não é escolha estética, é o que a testada comporta. A frente de água é o
recurso escasso e é fixa em 14,93 km na face da baía: 445 carteiras dão 33,5 m de testada
cada, que é lote nobre de verdade; incluir o 4º tier derruba para 12,9 m, que é casa
geminada; e Diamond Paws (19.289) daria 0,7 m, fisicamente impossível. **A regra que se
explica em uma frase: quem MULTIPLICOU o airdrop mora na alça.** DOG Supporter, que só
somou algo acima de zero, fica na cidade.

**3. A coorte é estável o bastante para dimensionar em cima dela.** Medido nos 3.057
snapshots de `forensic_history.json` desde 30/04/2026: a soma dos três tiers oscila entre
440 e 456, amplitude de 3,6%. Não é um número que dança.

**4. A via voltou para o meio da faixa, em r 6.950** (`AVENIDA_ALCA` em teia.ts,
implementado). A 120 m da água ela não deixava terreno dos dois lados, que era o pedido
original: medido nos 523 rumos, a fileira interna ficava com 16 m de fundo mediano e
NEGATIVO no pior rumo, e a praia de 80 m passava da guia da via em 22,6% do arco. Em 6.950
as duas fileiras têm 214 e 246 m de fundo garantidos em todo rumo e a testada útil dobra,
de 15,3 para 31,1 km.

**5. As duas fileiras olham para DENTRO.** Dono: "a face externa não olha mar aberto, ela
olha uma faixa de água e a escuridão total". A de trás vira-se para a cidade também, com a
praia nos fundos como quintal privado. Funciona porque o alvo é alto e distante: a baía tem
2,7 km de lâmina e a casa da frente fica a 272 m, então a skyline se vê do TÉRREO nas duas
fileiras. **Daí o gabarito de 2 pavimentos na fileira da frente:** com 3 na frente, a de
trás só alcança a lâmina no 4º andar. O que a de trás perde é só a água imediata.

**Pendente desta rodada, ainda NÃO decidido:** (a) o programa de cada bloco do projeto
(qual é marina, qual é clube, qual é píer); (b) a regra de encaixe entre a coorte e a
geometria, para quando o snapshot não devolver exatamente 445. Se vierem menos, os lotes
que sobram são reserva do projeto e o caso é trivial; se vierem mais, é preciso decidir
entre alargar o número de lotes ou cortar por saldo dentro do tier de menor prioridade.

---

## §10 — A Orla Nobre da alça 🔒

A faixa de terra entre a baía e a água externa, arco 346° a 116,5°, 15,85 km de eixo.
Decidida em 2026-09-10 (registro no §9). Os números são medidos, não estimados: vêm das
tabelas por rumo de `alca.ts` e dos verificadores `verificar-alca.ts` e `verificar-orla.ts`.

**510 lotes: 445 de carteira e 65 do projeto.** Os 65 do projeto são o land bank do §6.

| | FILEIRA DA FRENTE | FILEIRA DE TRÁS |
|---|---|---|
| orientação | praia da baía → casa → pista | pista → casa → praia dos fundos |
| carteiras | Satoshi Visionary + BTC Maximalist (187) | Rune Master (258) |
| projeto | 20 (4 blocos de 5) | 45 (9 blocos de 5) |
| total | 207 lotes | 303 lotes |
| testada | 74,9 m | 51,6 m |
| fundo garantido | 214 m | 246 m |
| área do lote | 1,60 ha | 1,27 ha |
| gabarito | **2 pavimentos** | livre |

⚠️ **O gabarito da frente não é decoração, é o que faz a fileira de trás existir.** Ele
protege a vista dos 303 lotes que estão atrás. Quem quiser altura compra na de trás.

⚠️ **Nenhuma rua nova entra na alça.** Dono, 07/09: "lá, por enquanto, teremos apenas a
via central". Os dois lados acessam a mesma AN7, e é por isso que a via tem de ficar no
meio: é ela que dá frente aos dois. Uma terceira fileira exigiria rua de fundo e está
fora até que essa regra mude.

### O arranjo dentro do arco (🔒 2026-09-10)

Ordem dentro do tier: **`change_pct` decrescente, do centro do arco para as pontas**. É o
mesmo campo que define o tier, então o tier diz o bairro e o mesmo número diz o endereço.
O melhor ponto é medido, não opinado: o meio do arco fica em **51,25°** e o centro da baía
em **52,5°**.

```
346,0° ── P1(5) ── BTC Max (50) ── P2(5) ── SATOSHI VISIONARY (88) ── P3(5) ── BTC Max (49) ── P4(5) ── 116,5°
          ponta                    junção     23,2° a 77,7°            junção                  ponta
```

Fileira de trás: 258 Rune Master pela mesma regra, mais 45 do projeto em 9 blocos de 5,
sendo 4 alinhados com os da frente. Detalhe e ajuste fino em `tiersposition.md` §3.2.

⚠️ **São 4 blocos na frente e não 5 de propósito:** 5 simétricos exigiriam um no centro
EXATO, e o centro é dos Satoshi Visionary. Com 4, os SV ficam num trecho contínuo de 54,5°.

⚠️ **A face externa é quintal, não fachada.** Não vender lote, não enquadrar câmera e não
escrever copy tratando a água de fora como orla nobre. Ver a nota em `ALCA_R_MAR`.

🔒 **2026-09-10, dono: tiers 4 e 5 ganham lugar.** Ordinal Believer (715) vai para a **orla
interna da baía, de frente para as mansões da alça**; DOG Supporter (1.347) vai para a
**segunda faixa, atrás dele**. Decidido o LUGAR, não o lote: testada, área e gabarito ficam
para quando aquela orla for desenhada. **MEDIDO:** a orla interna tem 8,62 km úteis (rumo
358,5° a 99,5°), 58% dos 14,93 km da alça, com 1.084 m de lâmina até as mansões na mediana.
O tier 4 sozinho ali dá 12,1 m de testada, que é casa urbana e não mansão, e é essa a
distância que tem de separar o tier 4 do tier 3; os dois tiers juntos na mesma frente
dariam 4,2 m, por isso o 5 vai atrás. Detalhe e pendências em `tiersposition.md` §3.3.

⚠️ **Achado colateral que vira bloqueio adiante:** `scripts/gerar_bairros.py` para em
`R_SITIO = 3.500` e o `bairros.json` gerado tem 140 bairros e **52.996 lotes para 85.791
carteiras** (faltam 32.795). A orla interna da baía fica inteiramente fora desse raio. Não
atrapalha enquanto o loteamento é teste, mas é preciso resolver antes de Diamond Paws
(19.289) precisar de chão.

🔒 **2026-09-10, dono: tier 6 é o tecido da cidade.** Os **19.289 Diamond Paws** ocupam o
tecido de bairros propriamente dito, entre a Praça Central e o cinturão, **ordenados pela
intensidade de uso da carteira, do centro para fora**. Os tiers 1 a 5 pegaram água porque
eram poucos (2.507 somados, 2,9% da cidade); o tier 6 sozinho leva o acumulado a **25,4%**,
e bairro residencial é o que ele é. **MEDIDO:** 19.289 lotes são 36,4% do tecido atual, ou
6,77 km² na densidade de hoje.

**O que o tier é, medido:** saldo exatamente igual ao airdrop em todas as 19.289, ou seja
nunca venderam DOG. **13.396 (69,4%) estão VIVAS** (gastaram BTC e outros runes sem tocar
no DOG; 1.848 delas mais de cem vezes) e **5.893 (30,6%) nunca gastaram nada**, com 5,61B
DOG, 5,61% do supply.

⚠️ **Os dormentes NÃO viram setor próprio.** Um bairro de "carteiras perdidas" afirmaria o
que o dado não sustenta: nunca ter gastado não prova perda, e pode ser cold storage
disciplinado. A intensidade como gradiente contínuo põe os dormentes na borda sem rotular
ninguém, que é o mesmo efeito no mapa sem a afirmação. Casa com o §0.5 ("Don't trust,
verify"). Detalhe em `tiersposition.md` §3.4.

🔒 **2026-09-10, dono: a cidade fecha.** Tiers 7 a 12 e os sem tier (o Grupo, **63.985
carteiras, 74,6% da cidade, 53,4% do supply**) recebem três regras, e com elas todo holder
tem lugar.

**1. Infraestrutura RECEBE lote como qualquer carteira**, revogando a proposta de
excluí-la: *"acho muito agressivo. Fechamos todas as carteiras e o que sobrar é de infra
básica"*. A terra que sobra depois de todas as carteiras é que vira infraestrutura básica.
⚠️ Consequência medida: a **carteira #1 da cidade é a Kraken hot (13,02B DOG)** e a #2 uma
treasury cold (3,11B); são 15 endereços rotulados com 18,49% do supply, e pela área
proporcional à raiz do saldo a Kraken fica com o maior lote. Casa com o §0.1 (a localização
não se compra; posição é história on-chain).

**2. Abaixo de 20k DOG, distribuição sem ordem na periferia** e **3. acima de 20k, ordem
pelo `position_score`** (UTXO mais antigo com 20k+, mais antigo fica mais perto do centro).
As duas já são o §2 deste documento: o dono confirmou a regra existente em vez de criar
outra. **MEDIDO:** dentro do Grupo, 31.092 carteiras passam de 20k (53,26B) e 32.893 ficam
abaixo, ou seja 44% do Grupo já tinha destino escrito.

🔒 **2026-09-10, dono: o gerador usa 14,5% da terra que tem.** MEDIDO sobre todo o interior
da abóbada (`DOME_R` 9.050, contorno de `cidade-malha.json`): **240,71 km² totais, dos quais
58,23 de água, 39,27 de montanha acima de 3°, 12,11 reservados e 128,20 km² LIVRES E
PLANOS**. O `gerar_bairros.py` para em `R_SITIO = 3.500` e usa 18,59 km². A terra livre
comporta 365 mil lotes contra 85.795 carteiras. **O limite nunca foi falta de terra, é o
raio do gerador**, e isso revoga a nota anterior que tratava o tecido como bloqueio para
Diamond Paws.

🔒 **2026-09-10, dono: o tier decide o anel, o critério do tier ordena dentro.** Regra de
precedência que fecha a atribuição da cidade inteira. Ela era necessária porque o tier 6
(§3.4 de `tiersposition.md`, ordenado por intensidade de uso) e o Grupo acima de 20k
(ordenado por `position_score`) ocupam o MESMO tecido e ambos crescem do centro para fora.

⚠️ **E ELA CONCILIA UM CONFLITO COM ESTE PRÓPRIO §9.** A rodada de 2026-07-10 travou "20k
como metro único de posição"; a intensidade do tier 6 é um segundo metro. Com a precedência,
o `position_score` segue sendo o metro único **ENTRE** carteiras comparáveis e a intensidade
só desempata **DENTRO** do tier 6, então nenhuma das duas decisões cai.

**A cidade fica assim, e toda carteira tem lugar:** tiers 1 a 3 na alça (445), tiers 4 e 5
na orla interna da baía (2.062), tier 6 no tecido do centro para fora (19.289), Grupo acima
de 20k no tecido em seguida (31.092), Grupo abaixo de 20k na periferia sem ordem (32.893) e
a infraestrutura com lote como qualquer carteira (15). **MEDIDO:** projetando a densidade de
hoje sobre a terra livre, a cidade inteira cabe dentro de **r 5.448**, com a abóbada em
9.050. ⚠️ Os raios são consequência da densidade e servem para dimensionar; não são lote
demarcado.

🔒 **2026-09-10, dono: o split da terra, e a curva de área recalibrada.** *"Vamos dividir os
terrenos da galera e o que sobrar é nosso"*, com o programa do projeto definido por FUNÇÃO.
Split travado: **70% da terra livre para os holders, 30% para o projeto**.

```
terra livre e plana      128,20 km²
  holders, 70%            89,74 km²  urbano (lote 46,66 + rua e verde)
  PROJETO, 30%            38,46 km²  ← o resíduo, §6
```

**A curva, DERIVADA do split:** `area = clamp(0,975228 × √DOG, 40 m², 40.000 m²)`. Mediana
**311 m²**, portão de 20k com 138 m², airdrop típico com 920 m², p99 com 3.077 m², e as 6
maiores no teto de 4,0 ha. 22.020 carteiras ficam no piso de 40 m².

⚠️ **A ORDEM DAS DUAS DECISÕES É O QUE TORNA A REGRA HONESTA.** "O que sobrar é nosso" só
funciona com a área por carteira travada ANTES: se a curva viesse depois, seria o resíduo
desejado a definir o lote do holder, e o projeto teria interesse em apertá-lo. Isso
contradiria o §0.1. O split é a linha pública; a curva é consequência dele.

⚠️ **ISTO REVOGA A CALIBRAÇÃO DA DECISÃO 1 DE 2026-08-28, NÃO A FORMA DELA.** Aquela rodada
prometeu mediana 333 m², p99 1.333 e maior 4,0 ha sobre **52.993 carteiras e 16,33 km²**. Com
85.795 carteiras e 128,20 km² livres, nenhuma curva única de raiz dá os três números juntos.
A forma (raiz, com piso e teto) fica; os números foram recalibrados, e a mediana de 311 m²
está a 7% dos 333 prometidos.

⚠️ **E O `foundation_generator` USA A CURVA ERRADA HOJE.** Ele importa `footprintWidth` de
`lib/city/zones.ts`, que é a curva VISUAL da cidade v3: mediana de **48 m²**, teto de 0,29 ha.
Com ela o resíduo do projeto seria 119,31 km², ou **93,1% da terra livre**. Trocar por §3.7 é
item obrigatório da reconstrução.

---

## §11 — O Founders Pack 🔒 (2026-09-12)

**O que é um Fundador.** Qualquer contribuição ao fundo de construção antes dele atingir
10.000.000 DOG. **Não há teto de participantes.** O que fecha é o tempo, nunca a vaga.

**Os três eixos**, decididos pelo dono: **ser visto, ser lembrado, ser primeiro.**

⚠️ **O QUE O FUNDADOR NÃO COMPRA: POSIÇÃO.** O §0.1 continua inteiro. O lote de todo mundo,
Fundador ou não, vem do bloco 966.670 e de mais nada. Não existe bairro de Fundador, não
existe escolher lote, e o sorteio NÃO distribui endereço (ver abaixo).

### A escada

| | citizen (qualquer) | personal 10k | commercial 50k | patron 500k | institucional (sob demanda) |
|---|---|---|---|---|---|
| Nome no Monumento, por ordem de chegada | ✓ | ✓ | ✓ | ✓ | ✓ |
| Número de Fundador, permanente e irrepetível | ✓ | ✓ | ✓ | ✓ | ✓ |
| Licença de construção, permanente | | ✓ | ✓ | ✓ | ✓ |
| Minta ANTES da abertura (prédio de pé no dia 1) | | ✓ | ✓ | ✓ | ✓ |
| Acesso antecipado ao jogo, testes e updates | | ✓ | ✓ | ✓ | ✓ |
| A luz do Fundador (visível de cima) | | ✓ | ✓ | ✓ | ✓ |
| Pack de itens base (quintal, placa) | | ✓ | ✓ | ✓ | ✓ |
| Pack ampliado (área de lazer, veículo) | | | ✓ | ✓ | ✓ |
| Rover lunar | | | ✓ | ✓ | ✓ |
| Nome de rua | | | | ✓ | ✓ |
| **Prédio personalizado** | | | | ✓ | ✓ |
| Marca em prédio cívico | | | | | ✓ |
| Concorre ao sorteio | ✓ | ✓ | ✓ | ✓ | ✓ |

⚠️ **ALTURA NÃO SE COMPRA, E EU TENTEI VENDER.** Numa primeira versão desta tabela eu
tinha posto "classe de altura" no degrau commercial. Colide de frente com o §1, que está
travado: *"altura respira com o saldo"*. Se a doação mexesse na altura, o prédio pararia de
informar: olhando um prédio alto ninguém saberia se significa "tem muito DOG" ou "pagou
muito". Removido antes de sair em documento nenhum.

⚠️ **PRÉDIO PERSONALIZADO SÓ NO PATRON E NO INSTITUCIONAL.** A cidade tem **tipologia por
bairro**: cada bairro tem sua casa e suas variáveis, e é isso que a mantém coesa. Personalizar
fora desses dois degraus fura a coerência arquitetônica, que é um ativo da cidade e não um
detalhe. O tier institucional é o maior de todos, preço sob demanda, e não vai nos documentos
públicos de escada.

⚠️ **E É POR ISSO QUE A DISTINÇÃO DO FUNDADOR MORA NO ITEM, NÃO NO PRÉDIO.** Com tipologia
por bairro, a personalidade tem de viver em volta da casa: quintal, veículo, luz e placa. É a
mesma razão pela qual condomínio bonito padroniza fachada e libera jardim.

### O sorteio

Entre TODOS os Fundadores, de qualquer degrau, com **data marcada e anunciada**.

Prêmios: uma **Runestone**, um **prédio personalizado** (normalmente só patron), um **nome de
rua** e o **1 de 1** do catálogo de itens (o primeiro rover já mintado).

⚠️ **NÃO SE SORTEIA LOTE, E A PROPOSTA ORIGINAL ERA ESSA.** O dono propôs sortear um lote em
cada um dos três primeiros tiers da Orla Nobre, com o argumento de que três lotes não fazem
cócegas no land bank. Duas medições mudaram a decisão:

1. **Aritmética.** A Orla Nobre já não fecha: são 445 lotes de carteira para as 449 que o
   snapshot manda (frente 188 contra 187, trás 261 contra 258). Os 4 que faltam já saem do
   land bank (65 → 61); mais 3 do sorteio levaria a 58, uma queda de 10,8%, quebrando duas
   vezes os blocos de 5 do §10, na única fileira que o próprio §10 declara escassa e fixa.
2. **§0.1.** Sortear posição é pagar por chance de posição. Hoje "como se chega na orla
   nobre" tem uma resposta só: história on-chain. Com o sorteio, para três endereços a
   resposta vira "doou e teve sorte", e essa é a pergunta que as outras 445 fariam sobre os
   vizinhos.

O valor do sorteio nunca foi o prêmio, foi o **relógio**: sorteio tem data, e data move gente.
Medido no funil: 38 doadores em 6.252 sessões nos últimos 30 dias, e mediana de 2,6 horas até
doar, ou seja quem não converte no mesmo dia some. O pack não tinha nada que fizesse agir hoje
em vez de mês que vem; o sorteio é isso. Trocar o prêmio preserva o relógio e não custa orla.

### Itens: estratégia MISTA 🔒

```
item de Fundador e de conquista   SOULBOUND     vale por provar algo que você fez
item de catálogo, comprado        TRANSFERÍVEL  vale por gosto, e por isso pode ter mercado
```

Ninguém compra a prova de ter sido primeiro; todo mundo compra decoração. Isso dá mercado sem
transformar mérito em mercadoria.

⚠️ **O PADRÃO DE INSCRIÇÃO JÁ ESTÁ PROVADO NESTA CASA, em 112.384 cópias.** A coleção Runestone
usa `delegate`: um modelo mestre inscrito uma vez e filhos de **zero byte** apontando para ele.
O mestre dela custou 1,0977 BTC porque foi inscrito a 27,7 sats/byte; a taxa em 12/09/2026
estava em **1,0 sat/vB**. Um item de 200 KB custa da ordem de 200 mil sats para existir, uma
vez, e cada cópia depois é só o envelope da transação. É o que torna item de jogo uma
propriedade real na L1 em vez de linha em banco.

Produção: o pipeline do Sketchfab já existe, com as regras de licença decididas (CC0 e CC-BY
entram, SA/NC/ND não, crédito no mesmo commit).

### A Ilha do Founders Club 🔒 (2026-09-12)

**DECIDIDO.** Uma ilha na **baía**, com a sede do Founders Club. Fundador tem **acesso**,
não tem escritura.

```
baía   centro (4.863,8, -3.738,4)   34,3 km2 de água   lâmina em -40
```

⚠️ **CLUBE, NÃO CONDOMÍNIO, E A DIFERENÇA É O PROJETO INTEIRO.** O dono tinha descartado o
bairro dos fundadores poucas horas antes, e condomínio na baía seria o mesmo bairro com
endereço melhor. O que separa um do outro é uma pergunta só: **alguém passa a ser dono de
terra ali?** No clube, não. Há acesso, ancoradouro, salão e vista; não há lote, não há
deed, e o lote de ninguém se move.

⚠️ **POR QUE ILHA E NÃO ORLA.** A orla da baía é a §10 e está **4 lotes curta**: o snapshot
manda 449 carteiras dos tiers 1 a 3 para lá e existem 445 lotes de carteira. Além de não
caber, pôr Fundador na melhor água por ter doado é o §0.1 no ponto mais sensível que existe,
porque é exatamente onde 449 pessoas chegaram por história on-chain. **Ilha é terra NOVA,
criada pelo projeto dentro da própria água**, e não sai da cota de ninguém.

⚠️ **E É O MELHOR OUTDOOR QUE A CIDADE TEM.** A ilha fica na frente da orla nobre. Iluminada
à noite, ela é vista de graça por todo mundo que ainda não é Fundador, todos os dias, sem
custar um metro de lote a ninguém.

**Em aberto:** o desenho da ilha, e se o clube recebe programa próprio no §5 (onde já moram
`Founders Pool`, `Founders' Monument` e `Patrons' Walk`, o mesmo instinto nunca desenhado).

### O que o Fundador NÃO é

Não é cota, não é investimento, não é rendimento. Não muda a posição do lote de ninguém,
inclusive a dele.

### Aberto

- **A data do sorteio.** É ela que vira o relógio da campanha.
- **Os quatro `patron`.** Consertado no código em 12/09 (`licenseFor` não tinha o degrau e os
  quatro doadores de 500k+ apareciam como `commercial`), mas a comunicação da escada ainda
  precisa sair com o rótulo certo.
