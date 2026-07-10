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
| Distrito | Banda do ranking de position_score (10 coortes centro→borda, Genesis Core → Fresh Arrivals) + **anel 0** dos 85 "Satoshi Visionary" colado à plaza (reorganizecity §2) |
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

```
fundo 75% ──── fundo = 10M (bloco B) ──── snapshot (N = B + 1008) ──── auditoria (432 blocos ≈ 3 dias) ──── Charter ──── MINT
   │                    │                          │                             │                            │
   educação:       proclamação             registry computado             mapa + merkle root           deeds nascem
   "não gaste/     automática do           do estado da chain             públicos; qualquer           filhos do
   consolide       bloco N (regra          no bloco N                     um reproduz o                Charter
   UTXOs antigos"  pública, zero                                          cálculo
                   arbitrariedade)
```

1. **Fase 1 (fundo ~75%):** campanha educativa — consolidar UTXO destrói idade e custa a
   posição central. Countdown ainda não existe.
2. **Fase 2 (fundo cruza 10M no bloco B):** snapshot auto-agendado para `N = B + 1008`
   (~1 semana). Site mostra contagem regressiva **em blocos**. Semana final = última
   chance de saldo (área do lote) e preservação de UTXO (posição).
3. **Fase 3 (bloco N):** registry computado; mapa completo + merkle root publicados;
   **432 blocos (~3 dias) de auditoria pública** 🔒 (144 foi rejeitado como curto demais).
4. **Fase 4:** **DogCity Charter** inscrito (Ordinal-pai com o merkle root) → mint abre.
   Opcional: inscrever também a proclamação da Fase 2 on-chain.

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
- **Dotação (~25 parcelas, <1% da área):** 1 premium colada ao anel da Satoshi Plaza; 2
  por distrito nos anéis 0–3 (8 nobres); 4 na orla/waterfront; 1 em cada eixo de chegada
  (avenidas do aeroporto, porto e estádio); 2 grandes na zona de expansão do porto.
- **Transparência:** entram no registry como `owner: DOGDATA_RESERVE` e **vão declaradas
  no merkle root do Charter** — o que é do projeto está escrito na fundação, auditável
  desde o dia 1 (protege o princípio "placement can't be bought").
- **Regra de uso:** reserva vira prédio comercial/parceiro — **nunca** lote de carteira,
  **nunca** engole equipamento cívico.

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
   ainda dentro deste passo: join do anel 0 com o cohort real "Satoshi Visionary"
   (hoje é proxy pelos 85 position_score mais antigos).
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
