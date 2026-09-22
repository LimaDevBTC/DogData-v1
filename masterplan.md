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

### §11.3 — O desenho da ilha 🔒 (2026-09-18)

**A ilha é um ATOL, e o nome dela é `The Founders Club`.** Projeto em
`scripts/city/ilha-founders.py` (que também exporta a geometria), geometria publicada em
`public/city/founders-club.json`, chapa IF-01.

```
posicao      rumo 51,3, r 5.600, NO EIXO do meio da orla nobre
             900 m de lamina aberta entre a ilha e a orla
anel         24,6 ha de terra, dodecagono r 450 com faixa de 120 m
bacia        32,7 ha de agua abrigada, r 330
a Casa       1,5 ha, ilhota central: assembleia, conselho, mesa
10 pavilhoes 96 x 54 m, um por face, 5 de cada lado
2 bocas      90 m, nas pontas do eixo. paredes RETAS, nao setor angular
porto        2 cais de 200 m dentro da bacia, na boca da cidade
2 helipontos r 26 m, nas pontas da perpendicular, na cabeceira das passarelas
cota         lamina -40, conves -32, gabarito 2 pavimentos
```

⚠️ **A POSIÇÃO NÃO É O MEIO DA BAÍA, É O EIXO.** A folga máxima da água está no rumo 42
(1.210 m medidos), mas o meio da orla nobre está no 51,3. Um objeto que 510 lotes olham todo
dia, posto fora do eixo deles, lê como acidente. Custou 260 m de folga.

⚠️ **E ELA É BAIXA DE PROPÓSITO.** O topo fica **23 m abaixo do datum da cidade**, porque a
baía está a -40. A ilha nunca encobre a skyline de ninguém: é joia acesa numa bacia, vista de
cima. Isso também mata a ideia do farol, que o fundador descartou em 18/09.

⚠️ **UMA ENTRADA SÓ, e é isso que torna o portão possível.** Com duas entradas equivalentes,
controle vira cerca; com uma, vira porta. A boca norte fica aberta ao barco (é a janela para a
orla nobre), mas quem desembarca desembarca na boca da cidade.

### §11.4 — O Portão 🔒 (2026-09-18)

**O portão é literal:** uma passarela atravessa o canal por cima. O barco passa por baixo, a
pessoa passa por cima, e é ali que a carteira é conferida. Fica desenhado, não é regra
invisível.

**A regra de acesso, decidida pelo fundador:**
```
passa    Founder QUE TAMBEM TEM LICENCA (>= personal, 10k)
passa    endereco na lista manual do fundador
NAO passa  quem so doou (citizen). doar nao da acesso.
NAO passa  quem licenciou DEPOIS dos 10M: licenca sem Founder nao abre o portao
```
Medido em 17/09: dos 110 doadores, **99 teriam acesso** (56 personal, 35 commercial, 8 patron)
e 11 não. A lista manual é campo próprio, nunca um remendo na lista de doação.

**A máquina já existe e está em produção na `/city`:** conectar carteira, provar posse
(BIP-322 no Xverse e OKX, Schnorr no Kray), sessão no Redis. ⚠️ **Conectar não é provar:** só
existe sessão quando a posse foi assinada, e é a sessão que o portão lê.

**O mirante público é o funil, não cortesia.** Plataforma na água 190 m antes do portão, com
molhe para o barco de visita. Quem não passa chega até lá, vê o clube aceso do outro lado e
não entra. É o melhor outdoor da cidade e não custa um metro de lote a ninguém.

### §11.5 — O convite é item 🔒 (2026-09-18)

**Convidado existe, e o convite é um ITEM**, não uma lista. Consequências que isso traz de
graça: o convite tem dono, aparece no inventário, pode ser dado de presente e pode ser raro.

⚠️ **Ele é a exceção útil à regra de §11 sobre item soulbound:** o convite é **transferível
enquanto fechado** e **queima no uso**, ligando-se ao endereço que entrou. Assim ele tem
mercado antes de virar prova, e deixa de ter mercado no instante em que vira prova.

**Em aberto:** quantos convites por Fundador e por degrau, se o convite expira, e se o
convidado entra sozinho ou só acompanhado. O item em si depende do pipeline de inscrição
(`marketing/mint.md`, F6), então na primeira versão ele pode nascer como registro fora da
cadeia e ser inscrito depois.

### O que o Fundador NÃO é

Não é cota, não é investimento, não é rendimento. Não muda a posição do lote de ninguém,
inclusive a dele.

### Aberto

- **A data do sorteio.** É ela que vira o relógio da campanha.
- **Os quatro `patron`.** Consertado no código em 12/09 (`licenseFor` não tinha o degrau e os
  quatro doadores de 500k+ apareciam como `commercial`), mas a comunicação da escada ainda
  precisa sair com o rótulo certo.

---

## §12 — A régua de posição: DOG-tempo 🔒 (2026-09-12)

**DECIDIDO pelo dono.** *"Organizar tudo por nível de acumulação, independentemente do
airdrop. Quem for do airdrop ganha um emblema. Joga todas as carteiras pelo mesmo filtro."*

⚠️ **ISTO EMENDA §3.1 a §3.6 DO CADERNO.** O tier deixa de decidir onde a carteira mora.
Ele vira **emblema**: história do airdrop, não passaporte de endereço.

### A régua

```
DOG-tempo = soma, por UTXO, de (DOG x idade em dias) no bloco 966.670

ordem = (lth_pct >= 50) desc
        DOG-tempo desc
        transacoes assinadas desc
        sha256(endereco + hash do bloco 966.670) asc
```

**Por que DOG-tempo.** Ela responde "quanto você acumulou e por quanto tempo segurou" com
uma pergunta só, e a mesma para todo mundo. Não precisa saber se a carteira recebeu airdrop,
comprou, ou as duas coisas.

⚠️ **POR QUE NÃO "NÚMERO DE COMPRAS", que era a leitura literal de acumulação.** Medido:
**99,7% dos Diamond Paws (19.223 de 19.279) têm UM dia de aquisição**, porque receberam e
nunca mexeram. Numa régua de "quantas vezes você adicionou", a coorte que o projeto promete
premiar marca zero e some do mapa. DOG-tempo não faz isso: segurar 889.806 por 872 dias É
acumulação medida. Os Diamond Paws ficam com melhor posição 30 e **19.067 dos 19.279 dentro
das primeiras 26.943**.

⚠️ **O FILTRO DE CUSTÓDIA É `lth_pct >= 50`, E NÃO UMA LISTA DE ENDEREÇOS.** Quem gira não
lidera. Medido: exclui 3.058 carteiras, entre elas as DUAS MAIORES da cidade (12,9B e 3,1B
DOG, ambas com 0,0% do saldo parado há 155 dias). Nenhum endereço de corretora precisa ser
nomeado à mão, e isso é muito mais defensável do que manter uma lista curada.

⚠️ **O DESEMPATE É TRANSAÇÃO ASSINADA, e ele não é detalhe: 33.065 carteiras (38,5%) estão
em empate EXATO de DOG-tempo.** O maior bloco tem **5.847 Diamond Paws** com 889.806 DOG num
UTXO só, do mesmo bloco: mesma quantidade, mesma idade, mesmo DOG-tempo até o último dígito.
Decisão do dono: *"carteira que nunca mais assinou nada pode estar perdida e deixamos ela
mais de lado; galera que fez mais tx está segurando porque quer"*. Isso é coerente com a
regra da casa de que **só gasto prova controle**. Medido nesse bloco: 2.043 nunca gastaram
nada na vida, e o desempate o quebra em 376 valores distintos.

⚠️ **A FONTE DO DESEMPATE TEM COBERTURA PARCIAL, e isso é dívida declarada.**
`chain_stats.jsonl` traz `chain_spent_txo_count` da cadeia inteira (via mempool.space) para
os 19.279 Diamond Paws, o que cobre **56,7% das carteiras empatadas e 100% do maior bloco**.
Para o resto, o desempate cai para contagem de envios de DOG no corpus, que é sinal mais
pobre. Fechar isso exige uma passada de cadeia para as 85.818. O terceiro desempate
(`sha256` com o hash do bloco) garante ordem determinística e auditável onde os dois
primeiros empatam: ninguém podia conhecer esse hash antes do bloco 966.670.

### O que a régua produz

```
                              sem airdrop   com airdrop
orla nobre (445 de carteira)        282         163
faixa nobre da baia (10.425)      3.441       6.984
bloco dos 26.943                  5.142      21.801
```

Os 61 lotes do land bank do projeto na orla nobre **ficam** (decisão do dono), e os 4 que
faltavam para caber as carteiras saem deles: 65 menos 4 é 61.

### O preço, escrito para não ser esquecido

**291 das 449 carteiras dos tiers 1 a 3 saem da água.** A defesa é que nenhum lote existe
demarcado, ninguém foi informado de assento, o snapshot é de hoje e o Charter não aconteceu:
emendar agora custa coerência interna, não promessa rompida com holder. ⚠️ Isso deixa de ser
verdade no instante em que a primeira posição for publicada.

⚠️ **E a campanha educativa da Fase 1 (§3) nunca aconteceu.** Consolidar UTXO destrói idade
e, nesta régua, custa DOG-tempo. Quem consolidou não foi avisado.

### A lista

`data/snapshots/dog_snapshot_966670_ordem.json`, 85.818 carteiras na ordem final, com
posição, DOG, DOG-tempo, lth_pct, transações assinadas, emblema e área.

### §12.1 — Custódia não se mede na cadeia 🔒 (2026-09-13)

Sete métricas de cadeia foram medidas para separar custódia de convicção e **todas falharam**.
A razão é estrutural: **custódia CONSOLIDA**. O endereço de uma corretora recebe da própria
infraestrutura, não do público, então tem poucas contrapartes, saldo velho e pouco giro. Ou
seja, custódia se parece com convicção, e no sentido que mais importa parece melhor.

Consequência: a frase `"filtro_custodia: ... nao usa lista de endereco de corretora"` gravada
em `dog_snapshot_966670_ordem.json` **não é cumprível** e sai. O programa de rótulos deixa de
ser recurso de analytics e passa a ser infraestrutura de posicionamento.

O instrumento que sobrou, medido contra o censo completo da população comparável:

```
n >= 100 depositos E R < 0,15    R = concentracao circadiana (teste de Rayleigh) na hora
                                 UTC do deposito. servico opera 24 h, pessoa dorme.
```

Custo: 3 de 71 carteiras do controle, e as 3 assinaram 300+ vezes (são serviço escondido no
controle). Zero carteira honesta rebaixada. ⚠️ O limiar depende de n: o R esperado sob
uniformidade é 0,886/√n, então limiar fixo sobre amostra pequena é puro ruído.

**Decisão:** atacadista e mesa que compraram de gente real e seguraram **acumularam de verdade
e FICAM**. Só sai custódia, moeda que é de outra pessoa. No top 60 isso é uma carteira: a #6,
endereço de depósito da CoinEx, sabida por rótulo.

Detalhe completo em `data/snapshots/dog_966670_dossie_topo.json` e nos scripts
`scripts/city/{forma_tx,dossie_topo,pagadores}.py`.

## §13 — A altura é dado, não recompensa 🔒 (2026-09-13)

Decisão fechada pelo fundador depois de avaliar três caminhos: altura por saldo, por item de
loja, ou por tamanho de doação. **Fica no saldo**, e a regra em uma linha é:

> **O saldo decide o TAMANHO. Todo o resto decide a APARÊNCIA.**

```
massa, andares, altura medida     SALDO VIVO. nao vende, nao doa, nao presenteia.
pele, coroa, luz, material,       LOJA. e onde o mercado cosmetico vive, e nao tem teto
  telhado, fachada                porque gosto nao tem teto.
licenca, ordem de chegada,        DOACAO. dizem QUEM CHEGOU PRIMEIRO, nunca QUANTO E GRANDE.
  marca, luz do Founder, numero
  na fachada, nome de rua
```

**Por que não pode vir de outro lugar.** A altura é a única coisa na cidade que é **dado vivo**:
andando por ela, sem abrir interface nenhuma, você lê quem segura o quê. É o DogData renderizado
como cidade, e é o que o projeto tem de mais difícil de copiar. No momento em que a altura vem
de outra fonte, a cidade vira cenário bonito com números ao lado, que qualquer um faz.

E colide com a frase que sustenta tudo: se "localização não se compra" mas altura se compra, a
promessa vira advogado.

⚠️ **Item de loja que adiciona andar é doação com um passo a mais.** Proibido pelo mesmo motivo.

### 🔑 A saída que abre a loja sem tocar no dado: AGULHA NÃO É ANDAR

Pináculo, antena e coroa iluminada **não são pavimento**. O Chrysler Building é famoso por uma
ponta que não tem escritório nenhum dentro. A loja pode vender **estatura percebida** enquanto a
altura medida continua honesta: o prédio parece maior, o dado não muda.

### ⚠️ Pendência que sai daqui: a direção do encolhimento

Se a altura respira com o saldo (§1), o prédio **ENCOLHE quando a pessoa vende**. É a parte que
dói e é de onde vem reclamação. Falta decidir se encolhe na hora, com atraso, ou se existe piso.

### §11.1 — A escada do Founder sobe em qualidade 🔒 (2026-09-13)

Todo degrau inclui tudo dos de baixo, e **onde existe variante o degrau de cima recebe a VERSÃO
EXCLUSIVA do mesmo item**, não só itens novos. Exemplo do fundador: o rover do Commercial é o
lunar rover; o do Patron é o **rover preto tunado**.

⚠️ **Toda variante exclusiva é SOULBOUND.** Se a versão exclusiva puder ser vendida, a
exclusividade vira mercadoria e o status do Patron se compra no secundário, o que derruba a
frase do pacote de que ninguém compra a prova de ter chegado primeiro.

### §11.2 — A fronteira do custom building 🔒 (2026-09-13)

```
CUSTOM        forma, fachada, materiais, coroa, ornamento, planta, telhado
NAO CUSTOM    altura, massa, pavimentos   vem do SALDO VIVO (§13)
              pegada                      vem da AREA DO LOTE (curva do snapshot)
```

**O Patron ganha prédio ÚNICO, não prédio MAIOR.** Sem essa fronteira escrita, um Patron que
doa 500.000 $DOG segurando 15.000 $DOG espera torre e recebe casa pequena de desenho único, e
reclama com alguma razão.

⚠️ Isso também mata a ideia de "coroa exclusiva do Patron" como benefício separado: se o prédio
é de desenho único, a coroa já vem no desenho. A agulha de §13 é produto de LOJA para quem tem
prédio de catálogo, não benefício de degrau.

## §14 — Anéis de expansão: a cidade cresce, nunca se divide 🔒 (2026-09-13)

Pergunta do fundador: carteira nova que aparece hoje divide o terreno existente com as do
airdrop, ou a gente cria lote novo? Três caminhos, e só um serve.

**Dividir o terreno existente: DESCARTADO.** Diluir quem já estava para caber quem chegou
destrói a promessa central, de que posição vem do histórico e ninguém mexe nela. Quem comprou
hoje ganharia às custas de quem segurou dois anos.

**Não dar nada a quem chega: DESCARTADO.** Mata o funil para sempre e contradiz o que já está
publicado: *"nothing about arriving today shuts you out"*.

**A cidade CRESCE.** É o que o deck do Founder Program já dizia na seção 07 (*"THE CITY GROWS,
around the asset that already exists"*), só que sem mecanismo. Agora tem.

### 🔑 O SNAPSHOT NÃO CRIOU ESCASSEZ DE TERRA, CRIOU ESCASSEZ DE PROXIMIDADE

Terra sempre cabe mais: o sítio tem **248,3 km²** e o tecido de hoje usa **66,8 km², que é
27%**. Cabe quase quatro vezes a cidade atual sem sair do sítio. O que **nunca mais** pode ser
fabricado é estar perto do centro, porque isso foi decidido no bloco 966.670 e acabou.

Isso torna o snapshot MAIS valioso, não menos: quem estava lá é central para sempre, e a
distância até o centro é literalmente o registro de quando a pessoa chegou.

### O mecanismo

Cada anel novo abre com **um snapshot novo, num bloco futuro anunciado**.

```
Anel 1   bloco 966.670    a fundacao, 85.818 carteiras
Anel 2   bloco futuro     quem chegou depois
Anel 3   ...
```

- **Nunca dilui.** Anel fechado é anel fechado, para sempre.
- **O funil nunca fecha.** Sempre existe o próximo, e sempre existe razão para entrar antes,
  porque o próximo é mais longe.
- **Cada anel é um evento repetível:** bloco anunciado, contagem regressiva, lista que fecha.
- **A cidade ganha anéis de idade, como tronco de árvore.** O anel diz quando você chegou, e é
  visível no mapa para sempre, sem interface nenhuma.

⚠️ **Uma carteira pertence ao PRIMEIRO anel em que apareceu**, e o lote é daquele anel. Se ela
acumular depois, o prédio cresce (§13), mas **o endereço não muda**.

### Consequência imediata: a landing tem DOIS públicos, não um

```
QUEM ESTA NO SNAPSHOT     "voce ja tem um lote".  A busca por endereco prova na hora,
(85.818 carteiras)         mostrando a area em m2. CTA: virar Founder para construir nele.
QUEM CHEGA AGORA          "a cidade esta crescendo". A busca devolve "esta carteira nao
                           estava no bloco 966.670". CTA: travar o Founder number antes dos
                           10M, com a terra vindo no Anel 2.
```

**A mesma busca serve aos dois e é ela que RAMIFICA o funil.** Digita o endereço, e a página
decide qual conversa ter. Muito melhor que escolher um discurso e perder metade das pessoas.

⚠️ **O anel precisa estar anunciado ANTES da busca ir ao ar**, nem que seja só como direção sem
bloco marcado. Senão a busca devolve negativa seca para todo recém-chegado.

### O passo que a landing tem de gritar

Para quem chega: **comprar não basta, tem de SACAR para carteira própria.** DOG parado em
corretora não é seu na cadeia, o lote vai para o endereço da corretora, e esse endereço agora
vai para o Distrito Financeiro. Serve ao projeto duas vezes, porque tira moeda de custódia e
põe em auto-custódia.

E o que é escasso para quem chega agora não é a terra, é **a ordem**: o Founder number é por
ordem de chegada, não depende de ter lote, e a janela fecha nos 10M. *"You can build later. You
cannot become a Founder later."*

### §14.1 — Várias carteiras contam SEPARADO 🔒 (2026-09-13)

Decisão do fundador. Cada carteira é um lote, sem agregação por pessoa. Também é o único
resultado possível para o Anel 1, que já está congelado no bloco 966.670, e não existe prova de
posse de múltiplas carteiras que permitisse o contrário.

⚠️ **A CONSEQUÊNCIA, MEDIDA:** como a área cresce com a RAIZ do saldo, dividir em N carteiras
multiplica a terra total por **√N**.

```
1.000.000 DOG em 1 carteira        986 m2
dividido em 10 de 100.000        3.119 m2    3,16x
dividido em 100 de 10.000        9.864 m2   10,00x
```

Para o Anel 1 é irrelevante (congelado). Para o **Anel 2 é incentivo explícito**: quem souber
divide antes do bloco.

**Por que isso se defende sozinho: terra é de graça, CONSTRUIR não é.** Quem divide em 100
carteiras ganha 100 lotes VAZIOS e precisa de 100 licenças de 10.000 $DOG para construir em
todos. O custo de ocupar cresce LINEAR enquanto a terra cresce por RAIZ, então a divisão para
de compensar rápido.

**Na copy, responder direto:** sim, contam separado, pode dividir se quiser, mas cada lote
precisa da própria licença para virar prédio.

## §15 — O relevo não tira terra de ninguém 🔒 (2026-09-19)

Duas decisões do fundador, medidas antes contra os 85.804 lotes de teste e o terreno real.
Elas travavam o registro final e portanto o mint. Diagnóstico completo em `DOGGAMEMODE.md` §7.

**1. Declividade máxima lotável: 12% na escala do lote.**

12% é o que uma pessoa sobe andando e é limite normal de rua. Terreno reprovado vira parque
ou mirante, nunca buraco. A carteira de um lote reprovado não perde nada: a sondagem anda
12 m na mesma prateleira, e se a prateleira acabar ela tenta a seguinte e depois outro
distrito, que é o mecanismo que o gerador já tinha para máscara.

⚠️ **E O TETO NÃO COBRA NADA, PORQUE A CIDADE JÁ ESTAVA ABAIXO DELE.** Medido em 19/09 com
a própria função de altura do gerador, a mesma que a cena desenha, sobre a cidade publicada
e sobre duas cidades geradas inteiras:

```
                          mediana   p90    p99    máx    acima de 12%
cidade publicada (85.804)    3,2%   6,0%   8,0%  11,3%        0
gerada sem a regra (85.933)  3,2%   6,0%   7,9%  12,4%        2
gerada com a regra (85.933)  3,2%   6,0%   7,9%  12,0%        0
```

A máscara grossa de 4° na célula de 59,2 m já segurava quase tudo; a regra nova fecha o
resíduo que passava por ela. Custo da regra, medido lote a lote entre as duas cidades
geradas: **678 lotes mudaram de lugar (0,8%), mediana de 18 m de deslocamento, e a área
somada não mudou**. Ou seja o teto de 12% é GARANTIA, não troca.

⚠️ Uma medição anterior, de 16/09, dizia 2.513 lotes acima de 12% e 1,1% de área perdida.
Ela foi feita reimplementando o terreno fora do gerador e **não se reproduz**: descartada.
A conferência boa é a que ficou no próprio gerador (`AUDITA_BIN=...` mede uma cidade já
gravada, e toda rodada imprime o histograma do que gravou). Falta ainda rodar o
`conferir_terreno.py` completo contra a cena no ar: hoje a igualdade entre as duas
superfícies está conferida nas constantes, não por amostragem de malha.

**2. O desnível entre vizinhos é pago pela cidade, e ninguém perde área.**

Cada lote é entregue plano numa cota própria, ancorada na testada. O desnível com o vizinho
vira **muro de arrimo na divisa, construído pela cidade**. A área do deed é sempre a área
inteira do lote.

⚠️ **Talude dentro do lote está proibido como solução de divisa.** Medido: ele tiraria 5,7%
da área do lote na mediana e 12,1% no p90, e faria o holder pagar pelo azar do relevo, contra
"a localização não se compra" do §0.1. Muro custa obra e custa zero metro quadrado.

**A conta do muro, medida em 19/09 sobre a cidade gerada com a regra, com a cota de cada lote
saindo da própria testada (não mais o centro como proxy):**

```
100.332 divisas (1,17 por lote)
altura do muro   mediana 0,25 m   p90 1,45 m   p99 2,99 m   máx 6,29 m

acima de 0,15 m (o meio-fio)   63.878 divisas   63,7%
acima de 1,00 m                17.141           17,1%
acima de 2,00 m                 4.999            5,0%
acima de 3,00 m                   969            1,0%
acima de 5,00 m                     7            0,0%
```

Ou seja: a conta da cidade é de muro BAIXO em massa, não de obra de arte. Dois terços das
divisas pedem um elemento na altura de um meio-fio a um peitoril, e só 1% passa de 3 m.

**SOCALCO, COM TETO DE 3 m** 🔒 (fundador, 20/09/2026). Onde o desnível entre dois lotes
passa de 3 m, a fileira quebra em duas bancadas e a quebra aparece na calçada como degrau ou
rampa curta. O muro nunca vira paredão: acima de 3 m ele deixaria de ser divisa e viraria
obra, e um muro cego de 6 m encostado na divisa é o bloco de concreto de novo, agora na
escala do vizinho e ao lado de um boneco de 1,70 m.

O teto em 3 m pega 1% das divisas. Em 2 m pegaria 5%, e aí o socalco vira regra geral em vez
de exceção, pica a fileira e briga com a preferência por repetição alinhada.

⚠️ **E A BARRA É DE ACABAMENTO, NÃO SÓ DE REGRA** (fundador: "precisa ser muito bem feito,
pra não ficar feio"). O socalco só se aprova com: muro em pedra de regolito com topo
plantado, nunca concreto aparente; o muro é embasamento do prédio de cima, não traseira; a
quebra acompanha o greide da rua (lei 2 do DOGGAMEMODE), então a calçada degrau a degrau
continua contínua; e cada bancada mantém a fileira legível de fora, sem serrilhado. Isso se
julga em chapa na altura do olho, a 1,70 m, nunca de cima.

⚠️ E o primeiro cálculo desta tabela deu muro de até 139 m, que é relevo inexistente neste
sítio. A causa era defeito do gerador, não do relevo: a bisseção guardava a cópia da cidade
de uma passada e a cota vinha do dicionário vivo, que a passada seguinte reescrevia.
Consertado em 19/09; a cota agora viaja junto com a cópia.

## §16 — O mundo em volta da cidade 🔒 (2026-09-19 e 20)

### §16.1 — As cidades polares estão DESCARTADAS 🔒
**Fundador, 2026-09-19:** *"essa ideia de termos 3 cidades, a que temos, Stacks e Solana em
polos afastados deve ser descartada por completo, isso não vai mais acontecer. Solana e
Stacks serão bairros dentro da cidade atual; numa fase 2 vamos expandir isso."*

Morre aqui a geografia de três sítios (BTC em Mare Tranquillitatis, SOL em Shackleton, STX em
Peary) que vinha de `lib/city/lunar/sites.ts` e do pivô lunar. **SOL e STX são BAIRROS da
cidade atual.** Qualquer proposta futura que os mande para um polo precisa reabrir esta
decisão, não a ignorar.

⚠️ E isso mata junto o argumento comercial que eu tinha acabado de propor (polo tem gelo,
equador tem ilmenita, logo existe rota de comércio entre as três). O argumento era bom e é
FALSO agora: não há três cidades. Se a troca entre correntes precisar de ficção, ela nasce
dentro da mesma cidade, entre bairros.

### §16.2 — A mina pode ficar DENTRO da abóbada 🔒
Fundador, 2026-09-19. Os 16 campos de extração não precisam ficar no arco externo.

⚠️ **E a regra de método que veio junto, que vale para tudo:** *"nós temos certa licença
poética para manipular elementos. Mina é feia e barulhenta, parece que você está levando
muito ao pé da letra as exigências do mundo real, relax um pouco."* O mundo real é INSUMO,
nunca juiz. Usar um fato ("mina faz barulho") para vetar uma decisão do fundador é a mesma
família de erro de [[feedback_wiki_is_input_not_veto]].

### §16.3 — Trabalho é ATIVO, com item 🔒
Fundador, 2026-09-19. A cadeia de produção (mina, beneficiamento, forno, eletrólise,
fundição, fábrica solar, sinterização, fazenda, spaceport) é jogada, não coletada. O retorno
é **item, status e cidade visível**, nunca número que rende. Passivo com número é rendimento
com outro nome e está fora.

### §16.4 — Dia e noite no ciclo REAL 🔒 (2026-09-20)
**Ciclo sinódico de 29,53 dias: 14,8 de sol e 14,8 de noite**, amarrado ao relógio da Lua de
verdade, sem aceleração.

🔑 **A noite não é um problema, é a segunda cidade.** A fase da Terra vista daqui é o oposto
exato da fase da Lua vista da Terra, então **quando o sol se põe aqui, a Terra está CHEIA**.
Terra cheia sobre regolito é da ordem de 40 vezes a luz de uma lua cheia na Terra: dá para
andar, ver cor e fotografar. A cidade ganha uma versão azul.

⚠️ **A hora fica FIXA na landing, no tour e nas chapas de marketing**, senão metade dos
visitantes chega de noite sem escolher. O portão de chapas já aceita a hora.

### §16.5 — A Terra é DIREÇÃO, não posição, e a interação é LUNETA 🔒 (2026-09-20)
O fundador descreveu o defeito antigo: *"era como se a terra fosse um balão na lua, o visual
tava legal, porém se o user interagisse com ela, percebia o erro de posicionamento"*.

**A causa é conceitual:** Terra com POSIÇÃO tem distância, e qualquer distância finita está
errada (384.400 km não cabem no mesmo espaço da cidade). Hoje a cena já faz o certo, e isto
fica registrado para nunca ser desfeito: **a Terra anda junto com a câmera** (`plaza-scene`),
então a direção no céu é sempre a mesma e o tamanho na tela nunca muda.

```
posicao no ceu    azimute 243, elevacao 44   (Tranquillitatis norte, 25 N 40 E)
tamanho aparente  1,98 graus: esfera de 640 m a 37 km, que e o real
movimento         nenhum. A Lua e travada por mare: a Terra nao nasce nem se poe
```

**DECIDIDO: a interação é LUNETA, não viagem.** Clicar na Terra estreita o campo de visão,
como teleobjetiva; a câmera não sai do lugar. ⚠️ O zoom com troca de escala (dar zoom e a Lua
virar satélite) foi **avaliado e adiado**: no instante em que a câmera navega livre entre duas
escalas, aparece o meio do caminho, e o meio do caminho é onde o balão se denuncia. Isso é
projeto de motor, não de cena, e só entra depois da Terra estável de pé.

**O que falta, e é o trabalho de verdade:** a Terra não está EMOLDURADA em lugar nenhum. O
fundador a viu uma única vez, por acaso, quando a câmera girou. Precisa de: a luneta, um
mirante desenhado virado para o azimute 243, e uma parada no tour.


### §16.6 — O terreno desce até a água 🔒 (2026-09-20), EXECUÇÃO ADIADA

**Fundador:** *"não quero rampas, vamos ajustar o terreno para ter um declive natural até a
água. Mas não faça agora, tem outro agente gerando os lotes e isso pode atrapalhar ele."*

**O defeito medido, que motivou a decisão:**
```
lamina da agua      -40,0    unica para a cidade inteira (regra do fundador)
passeio do cais     -37,8    1 m acima da agua, altura de conves de lancha
a cidade ao redor   -28,0
                    ───────
                    12 m de diferenca, vencidos hoje por talude de regolito de
                    40 m a 25%, que e aterro e nao acesso
```
Resultado na auditoria de 20/09: **131.004 m² de cais em 56 ilhas de pavimento**, a 12 a 150 m
da rede. O cais existe e não há como chegar nele a pé.

⚠️ **E ISSO CONTRARIA UMA DECISÃO ANTERIOR DELE**, gravada em `canais.ts`: *"que escada o
que, a galera tem que poder parar lancha na frente da casa"*. Para a lancha parar na porta, a
porta tem de estar no cais; hoje a casa está 12 m acima.

**A solução é o TERRENO, não a obra:** a margem passa a descer em declive natural até a
lâmina, em vez de cair num talude. Rampa foi proposta por mim e **recusada**.

⚠️ **ORDEM DE EXECUÇÃO, e ela é dura:** mexer no relevo muda `superficieAt`, que é a máscara
de água de todo alocador de lote. Fazer isso enquanto o loteamento roda invalida o que ele
está produzindo. **Terreno depois do lote, nunca junto.**


## §16 — O gerador passa a nascer do snapshot 🔒 (2026-09-20)

Até 19/09/2026 o `scripts/gerar_cidade.py` montava a fila lendo `data/holders_by_age.csv`
(que o cron move todo dia) e ordenando pelo UTXO mais antigo, que é a regra 1 do §9. Ou seja
**a régua de DOG-tempo do §12 estava escrita aqui e desmentida pelo código**, e a cidade que
saía era a de hoje, não a do bloco 966.670.

A partir de 20/09 a fonte é `data/snapshots/dog_966670_ordem_residencial.json`, na ordem de
`posicao_residencial`: 85.797 carteiras, que são as 85.818 do snapshot menos as 21
institucionais que vão para o Distrito Financeiro. O `utxo_count`, que decide a forma do lote
pela regra 3 do §9, também passa a vir do bloco: gastar um UTXO depois do snapshot não muda
a tipologia de ninguém. `FONTE=vivo` reproduz o comportamento antigo, e existe só para
comparar as duas cidades lado a lado.

Medido antes da troca: **231 carteiras existem só no snapshot e 369 só no arquivo vivo.**
Plantar pelo arquivo vivo daria lote a quem chegou depois do bloco e tiraria de quem estava
lá na hora combinada.

⚠️ **`elegivel: false` NUNCA TIRA TERRA DE NINGUÉM.** 🔒 Decisão do fundador, 20/09/2026:
"se tinham $DOG no snapshot vão receber a terra de direito". A marca é o filtro de custódia
do §12.1 (`lth_pct >= 50`) e ele é o PRIMEIRO CRITÉRIO DE ORDEM da régua: decide quem LIDERA
a fila, nunca quem existe no mapa. São 3.058 carteiras, e entre elas as duas maiores da
cidade. O gerador sempre as plantou; `scripts/city/lotear.ts:156` as descartava e foi
corrigido em 20/09.

### ⚠️ §16.1 — A ÁREA PROMETIDA NÃO CABE NO TERRENO (aberto, decisão do fundador)

A curva do snapshot (`dog_snapshot_966670.json.curva`) é `area = clamp(0,986443 · √DOG, 1,
40000)` e mira **46,66 km²**. Essa área já é PÚBLICA: `/api/dogcity/lookup` e a seção de
consulta da landing dizem a cada holder "YOUR LOT: X m2" a partir dela.

O terreno não tem isso. Medido em 19 e 20/09:

```
soma das areas prometidas pelo snapshot      46,30 km2
tecido lotavel que o gerador enxerga         43,55 km2
area que o empacotamento realmente entrega   25,56 km2   (59% do tecido)
```

Comparando carteira a carteira, entregue contra prometido: **mediana 0,63, p10 0,33, p90
2,43, e 81,4% das carteiras receberiam MENOS do que a landing já disse a elas.** Nem com
empacotamento perfeito a promessa fecha: 43,55 ainda é menos que 46,30.

**DECISÃO DO FUNDADOR, 20/09/2026** 🔒: **o número publicado fica, e a cidade se ajusta a
ele.** Palavras dele: "tem terra pra caralho, o que mais tem é terra. Use o que precisar,
compacte melhor primeiro, otimize tudo que puder". Ou seja, nesta ordem:

1. **Compactar e otimizar o empacotamento**, que hoje entrega 29,23 dos 43,55 km² de tecido
   (67%). Cada ponto aqui é terra de graça, sem mexer no desenho.
2. **Usar mais terra** onde ainda faltar. O sítio tem 248 km² e o gerador enxerga 43,55; só
   a coroa externa tem 34 km² fora do alcance dele hoje.

Recalibrar a curva para baixo está DESCARTADO: o número já está no ar desde a Dobra 1 da
landing e 81% das pessoas o viram.

### §16.2 — A régua da área é a que a landing publicou 🔒 (2026-09-20)

O gerador distribuía área com um GRADIENTE radial (borda com 2,7x a área por DOG do centro,
§9 regra 2). A curva que a landing publica desde a Dobra 1 não tem gradiente nenhum. Os dois
não podiam continuar valendo ao mesmo tempo, e o fundador escolheu **a régua da landing**.

Medido em 20/09, entregue contra prometido, carteira a carteira:

```
gradiente 1,0 (como estava)   mediana 1,08   p10 0,58   p90 2,43   38% abaixo
meio termo 0,5                mediana 0,95   p10 0,70   p90 2,43   66% abaixo
sem gradiente (a da landing)  mediana 0,82   p10 0,82   p90 2,43   82% abaixo
```

⚠️ **O QUE DECIDE NÃO É A MEDIANA, É O p10.** Com gradiente a mediana parece melhor e a
distribuição é injusta de um jeito indefensável: **quem está no centro recebe 58% do que leu
na tela e quem está na borda recebe 243%**. Sem gradiente todo mundo recebe o MESMO fator, e
aí a diferença vira um número só, que se explica e se corrige com terra. O p90 de 2,43 é só
a carteira minúscula, que recebe o piso de 24 m² onde a curva prometia 1 m².

**E a terra fecha a conta.** Com a régua da landing e o tecido de lote indo a φ 6.500:

```
tecido ate    entregue    mediana    razao (igual para todos)
5.500         36,47 km2    257 m2       0,82
6.500         42,84 km2    305 m2       0,98   <-- padrão a partir de 20/09
7.000         53,64 km2    394 m2       1,26
```

Sem drenar lago, sem terraplanagem e sem mexer no número publicado. O cinturão produtivo não
perde programa: as mesmas 705 ha de peças, 8 plantas e 16 campos de extração, num anel que
ainda tem 2,4 km de largura (φ 6.500 a 8.900). Não vamos a 7.000 porque o pódio da abóbada
começa em 6.950 e porque entregar 26% a mais gasta terra que vale mais como anel de expansão
do §14.

Padrões do gerador a partir daqui: `GRADIENTE = 0` e `PHI_LOTE = 6500`. As duas continuam
reversíveis por variável de ambiente (`GRAD=`, `PHI_LOTE=`).

**Falta 2% para o 1,00, e ele está no empacotamento, não na terra:** a queima de prateleira
está em 13% com o tecido maior (307 km de testada). É a próxima frente.

### §16.3 — Os defeitos que a auditoria de 20/09 achou 🔒

Antes de qualquer merkle root, esta é a lista do que estava errado no gerador e foi
corrigido. Todos são anteriores ao trabalho desta data: a cidade de teste publicada já os
tinha.

**1. Lote em cima de lote.** ⚠️ O pior deles. `PROF_MAX` era a FAIXA inteira (50 m) e a
faixa tem DUAS fileiras costas com costas de 25 m. O lote afundado até o teto atravessava
para a fileira de trás e ocupava o chão de quem tem frente para a outra rua; no limite exato
os dois centros coincidem e os lotes ficam idênticos. Medido: **80 pares com posição e
tamanho iguais para donos diferentes**, e dezenas de milhares de pares com sobreposição
parcial, todos com profundidade entre 49 e 50 m. O teto agora é a FILEIRA (25 m); quem
precisa de mais fundo é superquadra, que ocupa o bloco inteiro por construção.

**2. Área truncada em silêncio.** Quando nenhuma prateleira da janela comportava a testada,
o gerador "afundava o lote" e a profundidade batia no teto: o lote entregava `frente × teto`
e ninguém contava. Uma carteira com 4.768 m² publicados saiu com 261 m². Agora, antes de
aceitar, ele procura no distrito inteiro uma prateleira que honre a área.

**3. Superquadra perdia 26% da área.** Ela devolvia a profundidade do bloco (até 345 m na
banda do Horizonte) para um campo de 1 byte, e o `min(255)` só existia na gravação. O teto
entra antes e a testada compensa.

**4. O corte de escala furava o piso.** `area_de` aplica piso de 24 m² e o corte multiplicava
depois: 24 × 0,8 = 19,2 m². Piso agora sobrevive ao corte.

**5. Meio metro por lado no arredondamento.** `frente` e `profundidade` são uint8 em metros;
arredondar custava até 0,5 m por lado, que num lote de 5 m de testada é 10%, e para o boneco
de 1,70 m é meio metro de divisa fora do lugar. Os quatro bits livres da flag passam a levar
o quarto de metro (bits 4-5 frente, 6-7 fundo). O registro continua com 13 bytes e quem lê
só DSC e forma não vê diferença.

**6. O corte de cabelo virou tosquia.** A escada de 0,6 / 0,35 / 0,15 cortava até 85% da área
de quem chegava no fim da fila do distrito. Agora o gerador tenta TODOS os distritos com a
área inteira antes de cortar, e o corte para em 0,8.

Conferência que passou a existir e deve rodar antes de todo registro: bijeção fila/lote,
mesma ordem em `.bin`/CSV/cotas, `lot_id` único, sobreposição por par dentro do quarteirão,
área entregue contra prometida, cota dentro da faixa do relevo, e o histograma de
declividade do que foi gravado.

## §17 — O Cemitério 🔒 (2026-09-20)

**A regra.** Quem não alcança o MENOR LOTE DA CIDADE não recebe terra: recebe uma LÁPIDE com o
endereço gravado. O corte não é escolhido a dedo, é derivado: é o saldo que paga o piso de
24 m² na curva publicada (`area = 0,986443·√DOG`), ou seja **591,9 DOG**.

```
columbário            15.802 carteiras   18,4% da cidade   0,0019% do supply
cidade com lote       69.995 lotes
área prometida        46,17 km2 (era 46,30: quem sai quase não pedia área)
testada liberada      79 km, o maior desperdício do empacotamento
mediana do lote       593 m2 (era 313)
```

⚠️ **Por que o corte é no menor lote e não em 1 DOG.** A curva entrega 3 m² de mediana para
quem tem entre 1 e 100 DOG. Um lote de 3 m² não é lote, é um azulejo: com o boneco de 1,70 m
andando pela cidade, o dono não cabe em pé no próprio terreno. O corte em 1 DOG resolveria
1.623 carteiras e deixaria o absurdo de pé para outras 14 mil.

**O nicho é direito de MINTAR, não lote adormecido** (fundador, 20/09): "o cara já teria que
mintar o terreno e pagar alguma das licenças para restaurar uma carteira". A conversão pede
as três coisas juntas: voltar a ter saldo, comprar a licença e mintar o deed. Sem isso o
nicho continua sendo o registro de que aquele endereço existiu no bloco 966.670.

**O lote de volta nasce no ANEL DE EXPANSÃO (§14), nunca no Anel 1.** A posição do Anel 1
congelou no bloco; quem estava com poeira lá não reaparece no centro depois. Isso dá ao
columbário uma função urbana: ele é a porta de entrada do Anel 2.

⚠️ **ELES NÃO SAEM DO REGISTRO.** Somem do mapa, não somem da prova: `data/dogcity_columbario.csv`
é artefato de registro e entra no merkle root com estado próprio. Apagar 15.802 endereços em
silêncio quebraria a auditoria pública, que é o que faz o mapa valer alguma coisa.

**Na interface:** quando a carteira conectar, a página avisa que o endereço tem lápide e diz
o caminho da volta. O aviso é o gancho, e o caminho passa pela licença, então a volta
alimenta o fundo em vez de custar terra de graça.

### §17.1 — A forma: cemitério americano, lápide de mármore padronizada 🔒 (fundador, 20/09)

Não é parede de nichos nem cripta: é **campo aberto com lápides iguais**, mármore, no padrão
dos cemitérios americanos. Fileiras alinhadas, espaçamento constante, gramado, alameda
arborizada. É a mesma lei estética que rege o resto da cidade: repetição igualmente espaçada,
e o efeito vem da quantidade, não do gesto.

```
15.802 lápides
1,5 x 3,0 m por sepultura (padrão americano)      7,11 ha de campo
mais 35% de alameda e bosque                      9,60 ha
ou seja um quadrado de 310 x 310 m, a escala de uma parcela cívica
```

⚠️ **Isto é peça de programa e tem de ser reservada ANTES do lote** (regra de ouro do §5).
Entra no `PROGRAMA` do gerador como as outras 52.

**Três coisas que o desenho tem de respeitar, e elas são técnicas:**
1. **Uma malha só, instanciada.** 15.802 lápides iguais são uma instância e um desenho; 15.802
   modelos diferentes derrubam o celular. A variação vem da luz e do terreno, nunca da peça.
2. **O nome só aparece de perto.** Gravar 15.802 textos em textura é impossível; o nome é
   escrito por demanda, quando o boneco chega perto, e de longe a lápide é lisa.
3. **Mármore branco sob luz lunar é o teto de brilho da cidade.** Precisa de valor medido,
   senão o campo inteiro estoura na exposição e vira uma mancha branca vista do alto.

O lugar ainda não está escolhido. A recomendação continua sendo **junto ao anel de expansão**,
porque conta a história certa: a lápide é a porta de entrada do Anel 2, não o fim da linha.

### §17.2 — A primeira cidade aprovada 🔒 (2026-09-20)

```
lotes                    69.995
lápides no cemitério     15.802
carteiras do snapshot    85.797, todas com destino
área entregue            44,21 km2
razão contra o prometido 0,96, IGUAL para todos (p1 0,95, p10 0,96)
mediana do lote          564 m2
sobreposição             zero
lote acima de 12%        zero
```

Receita: `PHI_LOTE=6900 SAIDA_DIR=<fora do repo> python3 scripts/gerar_cidade.py`, cerca de
20 minutos, e depois `python3 scripts/city/conferir_lotes.py --cidade=<saida>`, que devolve
APROVADO ou REPROVADO com código de saída. Nada vira merkle root sem os nove testes verdes.

⚠️ **0,96 é o teto do tecido de hoje**, não uma escolha: o pódio da abóbada começa em 6.950 e
o tecido de lote para em 6.900. Os 4% que faltam estão na queima de prateleira (15%, 392 km
de testada), agora instrumentada por motivo: testada estreita para o lote da vez, máscara, ou
fileira de trás ocupada.

⚠️ **O que esta cidade AINDA NÃO TEM, e não pode virar registro sem:** o posicionamento por
tier do `tiersposition.md` (Orla Nobre, orla da baía, canais), a reserva de 15% dos lotes por
bairro, o cemitério como peça de programa desenhada, e o socalco do §15. Hoje ela planta pela
fila de DOG-tempo do centro para fora, que é a lei do §12 mas não é a do caderno de tiers.

## §18 — O que a cidade passou a ter em 21/09/2026

**Quatro destinos, e todo endereço do snapshot cai em um deles:**

| Destino | O que é | Contagem |
|---|---|---|
| Lote no tecido | a cidade comum, plantada pela fila de DOG-tempo | ~57 mil |
| Lote na Orla Nobre | tiers 1 a 3 na alça, duas fileiras | 446 carteiras |
| Lote institucional | as 21 da régua de custódia, na Satoshi Plaza | 21 |
| Lápide no cemitério | quem não alcança o menor lote (591,9 DOG) | 15.802 |

Mais os lotes do PROJETO, que não são de carteira: 65 na Orla Nobre e ~12.266 de
reserva intercalada, que é o land bank de 15% do contrato público §5.

### §18.1 — Orla Nobre, como ficou

Geometria LIDA da cena (`AVENIDA_ALCA` em `teia.ts`), nunca copiada: via em r 6.950 com
44 m, arco de terra de 346° a 116,5°. Duas fileiras com testada na avenida, a da frente
crescendo para a baía e a de trás para a praia dos fundos. Testada final medida: **74,0 m na
frente e 49,2 m atrás**, contra 74,9 e 51,6 do caderno; a diferença é a passagem pública que
a fileira abre onde o Portão do Parque Runestone atravessa a alça (10 vagas na frente, 15
atrás). Dentro de cada fileira a ordem é por comportamento e as vagas são ocupadas do centro
do arco para os dois lados, o que produz sozinho a regra do §3.2: Satoshi Visionary no
centro, BTC Maximalist nos flancos, Rune Master atrás.

**Área na orla tem regra própria** (decisão do fundador, 20/09): testada fixa, fundo pela
curva publicada e piso de 60 m de fundo. Espelha o precedente já publicado do Distrito
Financeiro, onde o teto sobe para 150.000 m². Sem isso, ou a orla perdia o ritmo (lotes de
testada desigual na mesma fileira) ou quebrava a fórmula única (lote fixo de 1,60 ha, cinco
vezes o que a curva promete às 446).

### §18.2 — Distrito Financeiro, como ficou

As 21 institucionais na faixa seca entre a muralha do precinto (r 915) e a margem interna do
Lago da Praça (r 1.055), de frente para a água, ordenadas por saldo, com a curva publicada e
o teto elevado de 150.000 m². A faixa pula 3,5° em cada bulevar cardeal, que são as pontes.

⚠️ **RESERVA PUBLICADA NÃO É OCUPAÇÃO, e a diferença é grande aqui.** A página fala em
1,89 km² de distrito dentro da praça. Essa terra seca não existe: o Lago da Praça ocupa 2,63
dos 3,79 km² do anel e sobram 1,2 km² secos. Mas as 21 somam **403.911 m², 0,404 km²**, que
cabe três vezes no que sobra, sem tocar no lago. A maior, Gate.io, fica em 54.300 m², 36% do
teto elevado.

### §18.3 — O que a escala do detalhe ganhou

- **Pivô de árvore**: o conversor centrava pela caixa inteira do modelo, e copa assimétrica
  puxava o tronco para fora do eixo. Medido: `palm.glb` com 1,25 m de desvio (a palmeira
  plantada no asfalto que o fundador viu), `tree-pine` com 1,78 m, mais 11 espécies acima de
  20 cm. Corrigido nos dois acervos (`sf/` e o espelho `sf-ktx2/` que o celular carrega) por
  `scripts/city/recentrar_pivo.py`, e na raiz: os dois conversores passam a centrar pela
  fatia de baixo da peça, que é o pé dela.
- **Rua flutuando**: a subdivisão por flecha nunca media o filho. Um trecho de 12 m nascido
  de um pai de 24 entrava na malha sem teste, e 12,37% das folhas ficavam acima da tolerância
  de 4,5 cm, com pior caso de 3,76 m no BUL03. Agora a flecha é sempre medida e o piso decide
  só se ainda dá para dividir.
- **Lei da superfície única**: spaceport, foguete, monumentos e props ainda pousavam em
  `heightAt`. Passaram para `superficieAt`.

### §18.4 — A baía não era a baía 🔒 (medido 21/09/2026)

O gerador chamava de baía o MAIOR corpo d'água, e o maior não é a baía: é uma **faixa colada
no corte da casca**, entre r 7.300 e 8.990, com 34,30 km², que nasce do exagero vertical de
2x além de r 7.000 sem correção de pódio além de 8.300. Artefato de relevo, não paisagem.

A baía de verdade tem **21,04 km², centro em r 4.791, rumo 48°**, e bate com os 20,5 km² que
o projeto já tinha medido em outra frente.

⚠️ **O preço do engano:** a reserva de orla de 60 m, que existe para guardar a frente d'água
mais valiosa da cidade, estava sendo aplicada na faixa externa, e a baía ficava com a margem
genérica de lago, de 30 m. Tudo que se apoiou em `em_baia()` até aqui olhou para o lugar
errado.

**A regra que separa os dois não é tamanho nem centro, é o RAIO DAS CÉLULAS.** A faixa
envolve a cidade, então o centroide dela cai no meio do mapa e ela passa por baía em qualquer
teste de centro. O que ela não consegue fingir é onde a água dela está: mediana de raio 7.800
contra 4.800 da baía.

⚠️ **E fica uma pergunta de paisagem para o fundador:** existe hoje um anel de água de
34,30 km² na borda do sítio que ninguém desenhou, e ele é 63% maior que a baía. Ou ele vira
paisagem de propósito, com nome e desenho, ou o exagero vertical precisa de correção de
pódio além de r 8.300 para ele não existir.

### §18.5 — Estado em 21/09, manhã: nove de dez 🔒

```
carteiras do snapshot        85.797, TODAS com exatamente um destino
  lote no tecido e na orla   69.995
  lápide no cemitério        15.802
lotes do projeto (reserva)    1.350
lotes institucionais             21
linhas no registro           71.366
área entregue                44,66 km2   razão 0,93 contra a publicada
sobreposição                 zero
registro                     v3, 15 bytes, fiel ao CSV em 12 cm
```

⚠️ **A reserva caiu de 15% para 2%** (fundador, 21/09: "15% foi um número que surgiu quando
parecíamos ter terra sobrando"). A conta que fundamenta: cada ponto de reserva custa um ponto
na área de TODO MUNDO, e a reserva tem duas funções de tamanhos muito diferentes. O direito
de apelo precisa de dezenas de lotes (21 marcados, 13 deles chamadas frágeis) e agora tem
1.350, folga de 64 vezes. O land bank grande é produto e sai da coroa externa.

**Dois defeitos que o portão pegou nesta rodada, os dois de dono duplicado ou perdido:**
1. **9.239 carteiras ficaram sem lote e o gerador declarou sucesso.** O teste de "coube todo
   mundo" contava `len(saida)`, e a saída passou a ter quatro naturezas: 12.266 lotes de
   reserva entraram na conta como se fossem gente.
2. **Quatro carteiras receberam DOIS lotes.** Elas são do Dog Social Club e também tier 1 a
   3: o laço do DSC plantava e a Orla Nobre plantava de novo. Dois lotes para o mesmo dono
   não aparece no mapa e só apareceria no dia do mint.

**O único teste que ainda reprova é a ÁREA, e é problema de terra, não de código.** Com tudo
dentro (orla, distrito, reserva de 2%) a cidade entrega 0,93 do publicado. As alavancas que
restam: coroa externa como anel novo (+0,10 a +0,15), empacotamento (+0,02 a +0,04) e zerar
a reserva (+0,02, e aí o apelo publicado fica sem lastro).

### §18.6 — O empacotamento: a perda era ALCANCE 🔒 (medido 21/09/2026)

Quatro medições independentes, rodadas em paralelo, convergiram para a mesma causa. Vale
guardar porque três hipóteses plausíveis morreram aqui, e cada uma teria custado rodadas.

**1. O vazio é maior do que o gerador admitia, e é fileira inteira, não sobra de ponta.**

```
oferta de testada        2.482,0 km
usada por lote           1.677,2 km   67,6%
comida por superquadra      80,7 km    3,2%
VAZIA                      724,0 km   29,2%
  fileira INTEIRA vazia    506,1 km   70% do vazio, em 6.047 prateleiras
  rabo de prateleira       174,3 km   24%
  ponta inicial             38,3 km    5%
```

O orçamento interno dizia 86% porque só conta a testada que ele ZERA de propósito: o passo
de sondagem de 12 m e a prateleira nunca alcançada não entravam na conta.

**2. Reordenar a fila não vale nada.** Simulação 1-D com a distribuição real: primeira que
cabe, melhor encaixe e pool dos 20% menores empatam em 96,6%; ordenar por tamanho
decrescente dentro da banda PIORA para 92,6%. A fila já vem quase decrescente sozinha
(correlação posição x testada = -0,46).

**3. O que separa 88,1% de 96,6% é ALCANCE.** Janela de 24 dá 88,1%, 96 dá 88,8%, distrito
inteiro dá 92,6%, e os 4 pontos finais só saem indo ATRÁS do cursor. Causa em duas linhas:
`JANELA = 24` e o cursor que só anda para a frente.

**4. Fusão de vão não paga.** Existem 30.756 pares de vãos adjacentes, mas fundir recupera
14,8 km contra um degrau de bisseção de 1,7%: o que trava a área não é testada agregada, é
UM DISTRITO SECAR antes de a fila acabar, com 506 km parados em outro. O `k` só sobe se
todo mundo couber, então 2.400 carteiras sem lugar seguram a cidade inteira um degrau abaixo.

**O conserto:** uma árvore de máximos por distrito responde em tempo logarítmico "qual a
primeira prateleira que ainda comporta este lote". Primeira é a mais interna, então a lei de
posição sai de graça. Primeira passada medida: 32.512 lotes e 47,17 km² onde antes eram
27.842 e 42,76 no mesmo k, ou seja 17% mais lotes plantados com a mesma curva.

### §18.7 — A PRIMEIRA CIDADE APROVADA NOS DEZ TESTES 🔒 (21/09/2026)

```
carteiras do snapshot      85.797, todas com um destino e só um
  lote de carteira         69.995
  lápide no cemitério      15.802
lotes do projeto            1.389    (reserva de 2%)
lotes institucionais           21    (Distrito Financeiro)
linhas no registro         71.405

área entregue              46,96 km2
razão contra a publicada   0,98   p1 0,96, p10 0,97
mediana do lote            584 m2
sobreposição               zero
declive                    nenhum lote acima de 12%
registro                   v3, fiel ao CSV em 12 cm
```

Receita: `PHI_LOTE=6900 RESERVA_PCT=2 SAIDA_DIR=<fora do repo> python3 scripts/gerar_cidade.py`
e depois `python3 scripts/city/conferir_lotes.py --cidade=<saida>`.

⚠️ **A PROMESSA FECHOU SEM AMPLIAR A CIDADE.** Em 20/09 a conclusão era que só a coroa
externa fecharia a conta. Estava errada: a cidade tinha 724 km de testada parada dentro
dela, e o alcance (§18.6) trouxe a razão de 0,93 para 0,98 sem um metro quadrado novo. A
coroa volta a ser o que deve ser, anel de expansão do §14 e casa do land bank, não remendo.

⚠️ **E A JUSTIÇA NÃO PIOROU, o que não era garantido.** Preencher buraco interno pode dar
endereço central a quem chegou depois na fila. Medido contra a cidade anterior: desvio de
raio por posição de fila, mediana 312 m contra 300, p90 1.486 contra 1.360, e blocos que
recuam 361 contra 380. A razão é estrutural: a árvore escolhe sempre a prateleira MAIS
INTERNA que cabe, e mais interna é a própria ordem da fila.

## §19 — Banda rígida por tier: NÃO 🔒 (medido 21/09/2026)

O caderno de tiers (§3.4 a §3.8, de 10/09) manda o tier decidir o ANEL onde a carteira mora.
Três medições independentes dizem que isso não cabe, e a própria constituição já tinha
decidido contra: **o §12, travado em 12/09, dois dias depois, escreve que o tier deixa de
decidir onde a carteira mora e vira emblema.**

```
tier 6 Diamond Paws            19.279 carteiras pedindo 18,656 km2
banda do caderno r 960 a 3.300 entrega 14,309 km2 com empacotamento PERFEITO
                               entrega 10,90 km2 com o empacotamento real (0,767)
falta                          4,35 km2 no melhor caso, 7,75 km2 no caso real
fronteira que caberia          r 4.011, ou seja o caderno errou 711 m
```

**Três defeitos de base que a medição pegou no caderno:**
1. O tier 6 começa em **r 960 e essa terra não existe**: o Lago da Praça vai até 1.420 e o
   primeiro quarteirão do tecido está em 1.510.
2. O teto de 6.900 **já vaza**: 1.986 lotes estão além dele, e a Orla Nobre inteira mora em
   r 7.002.
3. A banda de 1 a 10k perde **14.179 das 26.818 carteiras para o cemitério**: ela é metade
   do que está escrito, e a periferia ficou superdimensionada em 11 vezes.

**O que a banda entregaria ao holder: nada que ele consiga medir.** A área não muda (a razão
entregue já está uniforme em 0,975 nos quatro blocos), a curva não muda, o cemitério não
muda e o endereço nunca foi dito a ninguém. Em troca, cobraria 620 a 880 m de deslocamento
mediano e 47,1% do tecido trocando de vizinho.

**O mérito do §3.4 não se perde:** a intensidade de uso que ele pede já está no gerador com
outro nome. O desempate do §12 é transação assinada, e ele ordena 18.707 dos 19.279 Diamond
Paws (97,0%) dentro dos 32 blocos de empate exato de DOG-tempo. Morre o anel, não o critério.

**O que fica:** `PESO_TIER` como válvula no gerador (padrão 0, e 1 reproduz o caderno inteiro),
para que isto seja decisão escrita e não acidente; `DUST_MAX` sai, porque as 1.623 abaixo de
1 DOG já estão dentro do corte de 591,95; e a banda por emblema passa a ser SAÍDA do gerador,
medida e gravada no manifesto a cada rodada, em vez de constante.

⚠️ **PENDENTE, E É DO FUNDADOR:** `app/dogcity/sections/city-map.tsx` e a arte
`public/landing/citymap-1600-v2.webp` pintam os anéis do caderno em inglês desde 13/09.
Com a lei atual não existe anel, então a carta precisa ser repintada de qualquer jeito. E a
legenda diz "no ranking" para quem tem menos de 20k, o que é falso: o DOG-tempo ordena todo
mundo.

⚠️ **A ORLA DA BAÍA CONTINUA VALENDO, mas com CINCO fileiras e não duas.** Medido: em duas
fileiras o tier 4 sai com 12,1 m de testada por 126 m de fundo (1:10,3) e o tier 5 com 6,4
por 175 (1:27,4), proporções que não são lote. Em cinco fileiras dá 24,3 por 63 m (1:2,6),
que é gêmeo do precedente da Orla Nobre.

## §20 — O socalco implementado 🔒 (21/09/2026)

A regra do §15 virou código: dentro da fileira, lotes consecutivos entram na mesma BANCADA
enquanto o terreno não se afasta mais que o teto de 3 m, e todos os lotes de uma bancada
recebem a MESMA cota. Onde o terreno pede mais, a bancada quebra e nasce o degrau, que
aparece na calçada como degrau ou rampa curta, nunca como paredão.

⚠️ **NIVELAR CADA FILEIRA SOZINHA NÃO BASTA, e isso foi medido no primeiro passe.** A
mediana do muro caiu de 0,54 m para zero, que é o que a bancada promete, mas a cauda
ENGORDOU: acima de 3 m subiu de 6,1% para 8,6%. O desnível que sumia entre vizinhos de
frente reaparecia entre bancadas e entre as duas fileiras costas com costas, cada uma
nivelada por conta. A segunda metade da regra é relaxamento: enquanto duas bancadas
vizinhas, na mesma fileira ou na fileira de trás sobre o mesmo trecho, passarem do teto,
as duas andam meio a meio.

```
                        sem socalco   com socalco
muro mediano                0,54 m       0,00 m
p90                         2,44 m       2,38 m
p99                         4,64 m       3,00 m
divisas acima de 3 m     5.978 (6,1%)   324 (0,3%)
divisas acima de 5 m     1.228           25
cota do lote se move          n/a       0,10 m mediana, 1,25 m p90
bancadas                      n/a       17.400 em 13.227 fileiras, 4.173 quebras
```

A cidade continua APROVADA nos dez testes, com os mesmos 46,96 km².

⚠️ **As 324 divisas que sobram (0,3%) não são muro, são degrau de terreno entre bancadas**,
com pior caso de 14,64 m. O tratamento é caso a caso, virando escadaria pública ou trecho
não lotável, e não mudança da regra: mexer no teto para acomodar 0,3% pioraria os 99,7%.

## §21 — O gerador não enxergava a alça esculpida 🔒 (medido 21/09/2026)

⚠️ **ERRO DE 43 METROS NO ENDEREÇO MAIS VALIOSO DA CIDADE.** A cena esculpe a alça numa
plataforma plana em -30 m (`alcaAlturaAt` em `alca.ts`, decisão do fundador em 10/09: "a
praia toda retinha, a via toda circular, esquece isso de seguir o terreno"). O `altura()`
do gerador aplicava só platô e pódio, então os 511 lotes da Orla Nobre foram gravados com
**cota 13 m**, que é a do pódio, contra os **-30** que a cena desenha.

E o estrago não parava na cota gravada: `altura()` alimenta o cálculo de declive, o teto de
12% na pegada, a cota de testada e o socalco. Tudo isso estava sendo medido contra um morro
que a cena não desenha.

**Corrigido:** `alca_altura()` replica a forma da função da cena (plataforma, praia 1:8 dos
dois lados, rampa espelhada na escavação, franja nas pontas medida em metros de arco), com
as constantes LIDAS de `alca.ts`. Depois do conserto: Orla Nobre em cota -30,0 na mediana,
e a área da cidade subiu de 46,96 para **47,51 km²**, porque a plataforma plana não tem o
declive falso que reprovava pegada no teto de 12%.

⚠️ **O `conferir_terreno.py` DEVIA ter pego isto e não pegou.** Ele compara o gerador com a
cena com tolerância de 1,5 m, e deixou passar 43. A causa é a amostragem: ele sorteia 1 de
cada 3 lotes GRAVADOS, e até 20/09 nenhum lote passava de φ 5.500, ou seja a alça inteira
estava fora da amostra. Conferência que não amostra onde o defeito mora não é conferência.

**O padrão, que se repetiu CINCO vezes nesta sessão e é a lição mais reaproveitável dela:**
duas pontas do sistema descrevendo a mesma coisa e discordando em silêncio. A régua de
posição (masterplan contra código), a curva de área (landing contra gerador), a avenida da
alça (6.950 na cena contra 7.600 no gerador), a baía (real contra faixa de artefato) e agora
a plataforma (-30 na cena contra +13 no gerador). Nenhum quebra build, nenhum aparece em
teste, e todos produzem cidade plausível. Só medição cruzada entre as duas pontas pega.

---

## §22 — A Orla da Baía 🔒 (21/09/2026)

A última peça grande do registro. Caderno completo em `tiersposition.md` §3.13; aqui fica
só o que é lei de plano-diretor.

**O que é.** A margem oposta da baía, arco de 100° simétrico no eixo 51,3° (o mesmo eixo
da alça), virou distrito residencial dos **tiers 4 e 5**: 2.062 lotes, 2,587 km². A alça é
a fachada da baía e esta é a arquibancada que a vê.

**As quatro peças:** praia imposta num círculo de r 4.800 (o mesmo gesto do `ALCA_R_BAIA`
na margem de lá), uma enseada de 20° no eixo onde a água mergulha a r 3.780 e **não nasce
lote nenhum**, **dois** dedos (penínsulas) em 11,3 e 91,3, e dois anéis de canal que
transformam uma fileira de frente d'água em seis.

**A lei que sai daqui, e ela é nova:** neste distrito o **fundo é travado em 68 m e a
testada é a área ÷ 68**, o inverso da Orla Nobre. Não é preferência: o maior Ordinal
Believer tem 7.997 m² prometidos e a testada fixa isso pediria 330 m de fundo, cinco vezes
a seção inteira. **Consequência publicável: o distrito entrega 2,587 km² contra 2,587 km²
prometidos, razão 1,000.** É o único pedaço da cidade que entrega a curva exata.

**A Avenida do Cinturão virou bulevar de bairro.** O AN4 (r 4.450, caixa de 30 m)
atravessa o distrito. A primeira seção o ignorou e pôs uma fileira dentro da caixa dele:
6,1 km de testada morreram calados. Desviar o anel foi descartado — ele é círculo por
decisão publicada. **Regra que fica: quando um anel viário atravessa um distrito novo, o
distrito se organiza em volta dele, o anel não desvia.**

**⚠️ O DEDO NÃO TEM PRAIA, E ISSO QUASE PASSOU.** Eu dei à península a mesma rampa de
80 m a 1:8 da costa. Numa faixa de 166 m as duas praias se encontram no meio: o dedo
inteiro virava rampa de 12,5%, o teto de declive do §15 reprovava tudo e **nenhum lote
nasceu nos quatro dedos** — sem erro, sem aviso, só 913 carteiras "que não couberam".

A lição não é sobre praia. É que **um perfil de beira tem de ser dimensionado contra a
LARGURA da terra que ele beira**, e que rejeição silenciosa em laço de plantio é o mesmo
defeito do `if r:` sem `else` que o §16.3 já tinha catalogado. O conserto que fez os dois
aparecerem foi contar o motivo: `OB_REJ` separa água, programa, canal, anel e declive, e
foi a linha `declive 31%` que apontou o dedo. **Laço de plantio sem contador de motivo é
laço cego.**

**⚠️ A BAÍA EM FRENTE AO DISTRITO É UM ARQUIPÉLAGO, E NINGUÉM TINHA OLHADO.** O estudo
desenhou quatro dedos num pente de 20° sem consultar `ILHAS` em `ilhas.ts`. Medido em
22/09: a **Ilha do Fundador** (IL01) ocupa os rumos 28 a 44 entre r 4.670 e 6.520, a Ilha
Norte os rumos 50 a 60 e a Ilha Leste os rumos 66 a 70. O dedo de 31,3° entrava DENTRO da
ilha do fundador e o de 71,3° dentro da Ilha Leste.

E o pente de quatro é **geometricamente impossível** aqui, não é questão de gosto: com
passo igual e o slot do meio vago, o par interno fica em 51,3 ± S; para limpar a Ilha do
Fundador ele precisa de S ≥ 25,3, e aí o par externo cai fora do arco, que começa em 1,3.
Não existe passo que sirva para os dois pares. Vale então a regra do fundador ao pé da
letra: **excluir é melhor que desalinhar.** Sai o par interno inteiro e ficam dois dedos em
11,3 e 91,3, espelhados no eixo e livres até r 6.400. Uma **fileira F** nasceu na borda
interna para pagar a testada perdida.

**A regra que fica: ilha é peça declarada, não relevo.** As ilhas da baía são malha à
parte e NÃO entram em `heightAt`. Para o gerador, o chão debaixo da Ilha do Fundador era o
chão da praia: sem máscara ele plantou 427 m de testada dentro dela, e nem o gerador nem o
portão veriam problema, porque os dois medem cota e a ilha não tem cota. A máscara agora é
a costa MEDIDA de cada ilha, em tabela polar de 72 baldes (`ORLA_BAIA_ILHAS`). Disco e
elipse foram testados e reprovados: os dois alcançam r 4.522 e comeriam a fileira B, contra
os 4.670 da costa real.

**⚠️ E A SAIA DE VOLTA AO NATURAL ERA UM BANCO DE AREIA.** Do lado da água eu devolvia o
leito escavado ao terreno natural em 250 m, para preservar as ilhas. Medido pelo próprio
gerador: **165 de 165 rumos** do arco ficavam com terra entre a linha d'água nova e a baía,
até 760 m dela. A praia imposta olhava para um banco de areia e os canais ficavam presos
atrás dele. A saia não era necessária: as ilhas são malha à parte, com saia própria até
−62 m. Regra agora, a mesma da alça: **do lado da água a orla nunca levanta o chão, só
abaixa** (`min` com o natural). Depois do conserto: 12 rumos de 183, e os que sobram são a
franja das duas pontas do arco, que é onde ela tem de existir.

**O que o estudo previu e a obra desmentiu:** o estudo de 21/09 dizia que a baía CRESCERIA
0,414 km². Medido na cidade gerada: **20,18 km², contra 21,04 do §18.4, ou seja −4,1%**. Os
dedos tiram mais água do que a enseada devolve. Não publicar o número do estudo.

**O que caiu junto:** a §3.9 do caderno (11/09) prometia esta mesma orla às classes A e C
do cruzamento pedra-mais-DOG, 15,20 km² para 6.393 carteiras. Essa terra nunca existiu — a
conta vinha de uma orla imaginada sobre a margem natural sinuosa. Está reaberto como P10 no
caderno. O prêmio que sobrevive é a **Runestone no quintal**, que não custa terra.

---

## §23 — Retângulo tangente não cabe em `testada ÷ raio` 🔒 (medido 22/09/2026)

**O defeito, e ele é dos graves: 210 pares de lotes SOBREPOSTOS**, escondidos desde que a
Orla Nobre e o Distrito Financeiro existem.

```
Orla Nobre (S07)          202 pares   mediana 0,87 m   pior 1,36 m
Distrito Financeiro (S08)   8 pares   mediana 4,76 m   pior 13,98 m
```

**Por que ninguém via.** O teste de sobreposição do portão agrupava por QUARTEIRÃO, e os
três distritos especiais gravam **um quarteirão por lote** (cada lote tem giro próprio).
Com um lote em cada balde, o teste nunca comparava dois. Ele passava com nota cheia sobre
os três distritos que não nascem do alocador de tecido, ou seja justamente os que não têm
prateleira garantindo que ninguém se encosta.

**Por que acontecia.** A conta ingênua divide o arco pelo número de lotes e usa isso como
largura. Mas o lote é um RETÂNGULO e o canto dele fica no raio INTERNO, onde o mesmo
ângulo vale menos metros. Dois retângulos vizinhos, cada um girado do outro, se atravessam
pelos cantos. No Distrito Financeiro o erro é enorme porque a faixa é estreita (140 m) e o
raio é pequeno (985): a maior institucional tem 388 m de testada, ou 22,6° de arco.

**A lei que fica:** o lote ocupa **2·atan((w/2) ÷ r_interno)** de ângulo, não `w ÷ r`. O
raio interno é a testada menos o fundo quando a fileira cresce para dentro, e a própria
testada quando cresce para fora. Consequências aplicadas em 22/09:

- Orla Nobre: a testada da frente caiu de 74,0 para **71,8 m** (o fundo dela chega a 214 m,
  então o canto fica 214 m mais para dentro).
- Distrito Financeiro: o passo virou `2·atan((frente/2) ÷ FIN_R0)`.
- Orla da Baía: as três fileiras que crescem para dentro passam a consumir arco pelo raio
  interno (fator de 1,5%).

**E a lição de portão, que vale mais que o conserto:** um teste que agrupa por chave pode
ficar VAZIO sem nunca reprovar. Sempre que um distrito novo usar uma chave de agrupamento
diferente, o teste que depende dela precisa de um irmão que não dependa. O portão ganhou
`nenhum lote sobre outro nos distritos especiais (S07, S08, S09)`, que compara par a par,
sem agrupar.

---

## §24 — O merkle root do registro 🔒 (22/09/2026)

A fase 4 do plano de mint manda inscrever um Ordinal-pai (o Charter) com o merkle root do
registro. Até 22/09 o root **não existia**: o que havia era o sha256 plano do artefato
(`congelar-mapa.ts`), que prova que o arquivo não mudou mas não deixa ninguém provar que
UMA carteira está lá dentro sem baixar a cidade inteira.

**Construído em `scripts/city/merkle.py`.** sha256 duplo com duplicação do nó ímpar, que é
a construção do Bitcoin e a que qualquer auditor já sabe verificar.

**A folha é o DIREITO, não o desenho:**

```
lote:   L|lot_id|address|x_cm|z_cm|frente_cm|prof_cm|giro_cc|area_m2|cota_cm
lápide: M|address
ordenadas por (address, lot_id)
```

⚠️ **Tudo em centímetros inteiros, nunca em ponto flutuante.** Texto de float muda de forma
entre linguagens e o root mudaria sem a cidade mudar.

⚠️ **O `.bin` não entra.** Ele é a cópia quantizada em quartos de metro que a cena desenha;
o registro de direito é o CSV. Selar os dois daria dois roots para uma cidade só. O
`merkle.json` guarda o sha256 dos quatro artefatos, o que amarra root a arquivo sem
misturar as duas coisas.

**A prova de inclusão é o ponto inteiro:** `--prova=<endereço>` devolve os 17 hashes que
ligam a folha ao root. Com o root publicado, o holder confere o próprio lote sem baixar a
cidade e sem confiar no projeto. Testado ponta a ponta em 22/09.

⚠️ **As 87 mil provas prontas NÃO são gravadas, de propósito:** dariam 47 MB para um dado
que se recomputa em segundos a partir de `dogcity_merkle_folhas.txt`, que é gravado.

**A ordem que fica:** cidade gerada → portão APROVADO → merkle root → Charter → janela de
432 blocos → mint. O root só vale sobre uma cidade que passou no portão, e o script recusa
rodar se duas linhas tiverem o mesmo endereço.

---

## §25 — A rua que nunca foi desenhada 🔒 (medido 22/09/2026)

**A queixa, do fundador, olhando a chapa:** os lotes parecem "soltos no terreno". Ele
estava certo, e não era impressão nem estética.

**MEDIDO** com a própria máscara de pavimento da cena (`naVia`, a mesma que a arborização
usa para não plantar dentro do asfalto), lote a lote nos 70.720:

```
                            lotes com asfalto encostado (até 9 m da divisa)
Orla Nobre (S07)                100,0%     têm via própria
Orla da Baía (S09)               90,6%     têm via própria
Distrito Financeiro (S08)         0,0%
tecido comum                8,9% a 21,3%
─────────────────────────────────────────
cidade inteira                   16,4%

distância até o asfalto mais próximo, busca em 24 direções, tecido comum:
mediana 154 m · 28% sem nada em 250 m · só 9% com rua a 12 m
```

**A causa não era traçado errado, era via que nunca foi desenhada.** O loteamento SEMPRE
previu a rua: `_z_das_filas` monta cada quarteirão como k faixas de 50 m separadas por
**travessas de 9 m**, e o comentário dele diz, desde sempre, *"REGRA DO FUNDADOR: TODA
FILEIRA DÁ FRENTE PARA VIA"*. O vão entre as fileiras estava lá, reservado e vazio. A teia
desenhava o esqueleto (bulevar, anel, radial) e o miolo do quarteirão ficava sem um metro
de asfalto em cima.

**Depois de desenhar as travessas:** 85,8% dos lotes com rua encostada, mediana de 10 m,
**zero** lote sem rua em 250 m.

**⚠️ E A TABELA DO MANIFESTO ESTAVA CURTA.** `travessasPorK` era escrita à mão para k = 2,
3 e 4; as bandas cresceram para 6. **778 quarteirões não tinham travessa publicada** e
quem lia (a arborização, e agora o desenho) simplesmente não fazia nada neles, calado.
Agora ela sai da própria lista de bandas, e o desenho tem derivação de reserva que grita
no log em vez de ficar quieto.

**⚠️ E O DISTRITO FINANCEIRO ERA O ÚNICO EM ZERO.** Os 21 institucionais ocupavam a faixa
seca inteira entre a muralha do precinto (900) e a margem do Lago da Praça, com frente
para a água e fundo para a muralha, sem acesso nenhum. A faixa encolheu 14 m (o fundo
passa a começar em 929) e nasceu a Rua do Distrito Financeiro em r 921: acesso pelos
fundos, vista para a água, que é o arranjo normal de frente d'água.

**A regra que fica:** reservar terra para rua não é desenhar rua. Toda vez que o
loteamento abrir um vão para via, alguém tem de responder QUEM desenha aquele vão, e a
resposta não pode ser "a teia", que é outra escala. E a medição que prova isso é a
pergunta feita à própria máscara de pavimento, lote a lote, não a inspeção de chapa.

### §25.1 — E desenhar rua não é ligar rua (medido na mesma noite)

Desenhar as travessas resolveu a frente do lote e abriu um problema novo, que só apareceu
porque a medição continuou. Elas encadeiam umas nas outras e formam uma **rede TANGENCIAL
paralela aos anéis, que nunca cruza uma arterial**. O quarteirão não encosta na célula da
teia: sobra folga entre os dois, e é na folga que mora o radial.

**MEDIDO com `vias-varredura.mjs --cel=6 --dilata=1`** (e a primeira leitura foi feita SEM
`--dilata=1`, contra a regra que o próprio projeto já tinha registrado: sem ela dois
pavimentos a 1 m viram componentes separados na grade de 6 m):

```
                              pavimento   componentes   ilhas
antes das travessas            5,28 km²         839      9,0%
travessas até a divisa         ~22 km²        2.363     41,4%
+ sobra fixa de 34 m           25,75 km²         828     23,5%
+ ponta no radial da teia      30,06 km²         409     14,0%
```

**A ponta calculada é melhor que a sobra fixa por dois motivos, não um.** Ela fecha mais
ilhas, e sobretudo ela não pode atravessar o lote do quarteirão vizinho: o radial ativo é
a divisa entre células, então encostar nele é o limite natural. Sobra cega não tem limite
natural e ninguém mede hoje se uma via passou por cima de lote.

⚠️ **O QUE FICA ABERTO, E É ESTRUTURAL.** Cada volta destas fecha metade das ilhas e
acrescenta asfalto: 5,3 → 30,1 km². Isso é sintoma de estar consertando geometria com
pavimento. O conserto de verdade é o inverso e mora no GERADOR: fazer a divisa do
quarteirão **coincidir** com a rua da teia. Aí a fileira externa ganha frente sem nada
novo, a travessa termina numa rua de verdade e o asfalto para de crescer. Hoje as duas
famílias estão em módulos diferentes: os anéis da teia andam de cerca de 239 m e a
profundidade do quarteirão é 109/168/227/286/345 por banda. Enquanto isso não for
reconciliado, as ilhas voltam a cada rodada.

---

## §26 — Lote é marcação no chão, não volume 🔒 (22/09/2026)

**A queixa:** *"todos os terrenos são blocos de concreto sobre o terreno, parece que todos
foram levantados, e que todas as ruas estariam no andar de baixo"*.

**As duas causas, somadas:** no modo `lote` cada terreno era uma caixa de 0,45 m, e o pé
dela era o canto **mais alto** dos quatro (assentar pelo centro enterrava metade do lote,
medido em 29/08). Num lote de 68 m de fundo com o teto de declive de 12%, o canto alto
está 8 m acima do baixo: a laje fica pairando metros no ar do lado de baixo.

**O que substitui:** uma moldura de divisa com **quatro cantos de cota própria**, que por
construção não flutua nem corta, e o tracejado por descarte no fragmento (`fract(u/6) >
0.5 → discard`), não por geometria nem por textura. Custa 8 triângulos por lote contra os
12 da caixa. Dash por geometria custaria 60 por lote, 4,2 M na cidade.

⚠️ Ela **não é instância**: instância é transform rígido e uma moldura plana instanciada
voltaria a cortar o chão de um lado e boiar do outro, que é o defeito que ela veio
consertar. São 8 vértices por lote, cerca de 17 MB, e só no modo `lote`, que **não** é o
modo padrão da cena.

---

## §27 — A Satoshi Plaza perde o jardim e ganha três peças no deck 🔒 (22/09/2026)

**A queixa, do fundador:** *"a Satoshi Plaza tá uma zona, com aquele monte de fontes,
jardins... com esse monte de planta aí não dá nem para ver onde estão os terrenos dos caras
na parte central"*.

**DECIDIDO.** Do jardim clássico do precinto ficam **três peças**, e elas se mudam para
cima do deck, debaixo da torre: a **Pata de Diamante com a estátua do Leônidas**, o
**Jardim do White Paper** e o **painel do Dog Social Club**. Saem o Espelho de Satoshi e o
Jardim Ordinal, além das sebes, da topiaria, das palmeiras, das árvores e dos quatro
espelhos d'água. O anel viário, as radiais e as calçadas ficam.

**DECIDIDO, e é o que trava o resto:** o chão liberado (r 332 a 900) continua **cívico**.
Ele recebe prédio do PROJETO, como a BitFlow, a Kray, o Chalé e a Sphere já são, e **não**
lote de carteira. O §3.1 do caderno de tiers (o anel 0 revogado como assento dos Satoshi
Visionary, "o centro fica cívico") segue de pé, e por isso nada disto toca no gerador, no
registro ou no portão.

### O pente de 120°, e por que ele começa em 68,7°

O fundador pediu "120° pra cada". Com esse passo, **qualquer pente cai em cima de um dos
quatro bulevares cardeais, exceto os que saem de 45 em 45**. Entre os que servem, um tem
significado: **68,7° é o `DSC_RUMO` do gerador**, o rumo do setor cujos lotes mais internos
são reservados ao condomínio do Dog Social Club na cidade externa, e é exatamente onde o
painel já estava. Ancorando o pente nele, o painel continua apontando para o condomínio:

```
 68,7°  painel do Dog Social Club    r 200     (não girou)
188,7°  Pata de Diamante + Leônidas  palma 140, estátua 228
308,7°  Jardim do White Paper        estelas 105 a 225, Gênese 240
```

**A faixa livre do deck é r 85 a 245, medida:** por dentro o pedestal da Agulha vai a 56 e
o Círculo dos Fundadores fecha em 77; por fora a colunata dórica está em 250. Os braseiros
ocupam r 150 nas quatro diagonais e as caixas de BTC r 196 perto do norte, e os três rumos
acima passam a 26° ou mais de qualquer um deles.

**As duas peças grandes encolheram, e isso é conta.** A alameda do White Paper ocupava
206 m e a Pata com os dedos 227; a faixa tem 160. O passo das estelas caiu de 25,75 para
15 m e os dedos da pata de 80/92 para 52/62 do centro da palma. **Os ângulos de abertura da
pata não mudaram**, então a forma é a mesma, só a escala.

⚠️ **E A COTA ERA A ARMADILHA.** As três se assentavam por `heightAt`, que é o regolito, e
o piso do deck está `DECK_Y` = 39,95 m acima. Mudar só o (x, z) enterraria a Pata, o
Leônidas e as nove estelas quarenta metros abaixo do chão que se pisa. O conserto entra
numa linha só, onde o módulo lê o terreno, e **por raio** (250, a colunata), para o busto
do Satoshi, que fica fora do deck, não subir junto.

⚠️ **A PATA QUEBROU PELA MESMA FAMÍLIA DE ERRO, E PIOR.** Ao trazê-la da diagonal para o
deck eu encolhi a DISTÂNCIA dos dedos (de 80/92 para 52/62 do centro da palma) e não
encolhi nem o raio do dedo (17) nem o da palma (48). Com 52 − 17 = 35 contra os 48 da
palma, **cada dedo entra 13 m dentro dela**: antes havia 15 m de folga. O fundador viu na
chapa antes de eu medir: *"o monumento da pata da DOG com a estátua do Leônidas está uma
várzea, tudo sobreposto"*.

**A lei, e ela vale para toda peça composta:** mudar de escala é multiplicar **todas** as
medidas pelo mesmo fator, inclusive as que não aparecem no nome do problema. Distância sem
raio, ou raio sem distância, não é escala, é deformação. Quando a peça tem partes que se
tocam, a prova é aritmética e obrigatória: para cada par vizinho, distância entre centros
menos soma dos raios, e nenhum resultado pode ser negativo.

⚠️ **E A PROPORÇÃO DA ALAMEDA NÃO SOBREVIVE A UMA MUDANÇA DE ESCALA SOZINHA.** As estelas
alternam os lados, então a alameda tem `2 × STELA_SIDE` de largura contra o passo radial de
vão. Com 13 m de lado e passo de 25,75 a fileira lia como nave; encolhido o passo para 15 e
mantido o lado, a largura virou MAIOR que o vão e a fileira leu como lápides espalhadas.
`STELA_SIDE` caiu para 7. **Quando uma peça linear muda de escala, o afastamento lateral
muda junto ou o desenho inverte de significado.**

**O que não saiu de propósito:** os geradores `fEspelho` e `fOrdinal` continuam escritos em
`monuments.ts`, fora da fila `trabalhos`. Tirar da fila é o que desliga; deixar o código é
para a peça voltar sem ser reescrita.

---

## §28 — O telão entra e o pente vira 90° 🔒 (22/09/2026)

**A pergunta, do fundador:** *"por acaso tem um telão que fica passando vídeos do Vincent
Cryptolution dentro da praça? O Vavá eu acho que ia criar um telão... só que eu não vi esse
telão ainda, nem sei se ele existe"*.

**Existia e não existia.** `app/city/plaza/cryptolution-house.ts` estava **completo** — casa
modelada no Blender, telão dinâmico com a thumbnail do vídeo do dia, marcação de raycast
para o clique abrir o player — e **ninguém o chamava**. O módulo nunca foi instanciado pela
cena: um prédio inteiro escrito, testado no papel e invisível. A landing (`/dogcity`,
`sections/broadcast.tsx`) mostrava a casa; a cidade, não.

**DECIDIDO, em duas etapas, as duas do fundador.** Primeiro: *"a gente podia separar isso,
colocar o telão passando o vídeo dele na praça principal e deixar a mansão dele separada"*.
Depois, sobre o arranjo: *"prefiro integrar o telão com as outras três peças e quebrar cada
um em 90°"*.

### O passo de 90° não cai em bulevar, e o §27 estava errado sobre isso

O §27 afirma que "qualquer pente cai em cima de um dos quatro bulevares cardeais, exceto os
que saem de 45 em 45". **Isso vale para o passo de 120°, não para o de 90°.** Um pente de
90° é `{o, o+90, o+180, o+270}`, e ele só encosta nos cardeais `{0, 90, 180, 270}` se o
deslocamento `o` for múltiplo de 90. Ancorado nos mesmos **68,7°** (o `DSC_RUMO`, que
continua sendo quem manda), o pente novo passa a 21,3° do bulevar mais próximo — e, de
quebra, a 23,7° das quatro **diagonais**, que é onde moram os braseiros de r 150. O pedido
do fundador não custava nada; a objeção era minha e era falsa.

```
 68,7°  painel do Dog Social Club    r 200     (nunca girou de rumo)
158,7°  Pata de Diamante + Leônidas  palma 120, estátua 222   (girou 30°)
248,7°  Telão da Cryptolution        face 224, canto 239,3    (novo)
338,7°  Jardim do White Paper        estelas 105 a 225, Gênese 240   (girou 30°)
```

Duas peças giraram 30°; o painel do DSC não se mexeu; o telão pegou o braço livre.

### A escala do telão é 0,60, o mesmo fator da pata, e é o assunto da peça

O vão que o Blender abriu na fachada da casa tem **96 × 54 m**. Em tamanho cheio, no deck,
ele não seria a quarta peça de um conjunto: a palma da pata mede 57,6 m de diâmetro depois
do conserto do §27, e uma placa de 96 m ao lado dela faz as outras três lerem como detalhe.
**Em 0,60 o telão fica com 57,6 m de largura, exatamente a palma**, e as quatro peças têm a
mesma escala. Do centro da laje a tela ainda preenche 14° do campo de visão.

⚠️ **O CANTO DE UM RETÂNGULO TANGENTE NÃO FICA EM `r + meia largura`.** A peça inteira
(pódio, peitoril, dois pilares, verga, marquise e parede de trás) é um retângulo tangente de
**79,6 × 20 m**. Lido como círculo de raio 42, ele diria que a peça vai a 266 e fura a
colunata dórica de 250. Medido como retângulo — `√((r + fundo)² + meia largura²)` — com a
face em 224 o canto fica em **239,3 m**, 10,7 m antes da colunata, a mesma ordem de folga
que o Leônidas tem em 237 do outro lado. É o **§23** de novo, agora dentro da praça: o
mesmo erro que custou 210 lotes sobrepostos na Orla da Baía.

⚠️ **E A PRIMEIRA ESCRITA DO PROSCÊNIO TINHA OS PILARES ATRÁS DA TELA.** Eu pus os pilares
em z −3,5 e a tela em z +3,55 no quadro local: de frente eles sumiam por trás dela e não
emolduravam nada. O quadro local agora é explícito — **z = 0 é o plano da tela**, estrutura
em z negativo, e só a marquise avança para z positivo.

### "Passando vídeos" é a fila, não o play

O fundador falou em *"um telão que fica passando os vídeos dele"*. Um telão que **toca**
vídeo do YouTube não existe em WebGL: não há sampler de vídeo do YouTube, e os Termos
exigem que o play aconteça no player deles. O que se entrega é a tela **nunca parada**: o
`/api/cryptolution` devolve os últimos seis despachos, o pôster troca a cada 14 s começando
pelo do dia, e o clique levanta o `<iframe>` oficial por cima da cena com o vídeo **que
estiver na tela naquele instante**. O visitante assiste sem sair da cidade.

⚠️ **A troca anda pelo relógio da cena (`t` do `update`), não por `setInterval`.** Com a
aba em segundo plano o laço de render para, e a fila para junto — em vez de acumular trocas
e dar um salto ao voltar.

### Duas consequências medidas, nenhuma das duas é defeito

1. **Num pente de 90° toda peça tem outra peça às costas, do outro lado do centro.** O
   telão (248,7) fica exatamente de frente para o painel do DSC (68,7), e a pata (158,7)
   para o White Paper (338,7). Com 120° isso não acontecia. Para uma tela é o melhor
   arranjo possível: ela olha para a travessia inteira da praça e tem gente parada no ponto
   oposto. Para as outras três é pano de fundo, não obstrução — a Agulha fica no meio.
2. **As duas câmeras de chapa do deck estavam no rumo 248,7** (`deck` em r 241,6,
   `deckalto` em r 430), porque 248,7 era um VÃO do pente de 120°. Com o pente novo esse
   rumo virou braço: a câmera do `deck` nascia dentro da tela. As duas se mudaram para os
   vãos novos (203,7 e 23,7), e entrou uma terceira, `telao`, de frente para a peça.

### O aro de 48 m que sobrou do espelho antigo

Achado ao medir isto. Quando a pata passou a desenhar a própria água (o `JARDIM = false`
tirou os espelhos de `precinct.ts`, que eram quem desenhava antes), o aro quente novo
nasceu no raio certo, `PAW_PALM_R` = 28,8 — mas a **linha antiga continuou no arquivo**,
com `POOL_R` = 48, que é o raio do Espelho de Satoshi. Resultado: um anel emissivo de 48 m
flutuando vinte metros fora da palma, sobre o piso do deck. Removido.

**A regra:** quando uma peça passa a desenhar o que outra desenhava, a busca não é pelo
nome da peça, é pelo **raio antigo**. `POOL_R` é compartilhado, e todo compartilhado
sobrevive à mudança que devia tê-lo levado junto.

### O que a casa virou

`cryptolution-house.ts` continua no repositório, **dormente e sem telão** (`{ telao: true }`
o devolve). O desenho do pôster — `makeScreenTexture` — mudou-se para `telao.ts` e é um só,
para não existirem dois pôsteres divergindo com o tempo. **Pendente, e é do fundador:** o
que preenche o recesso de 96 × 54 da fachada da mansão quando ela for para o chão liberado.
