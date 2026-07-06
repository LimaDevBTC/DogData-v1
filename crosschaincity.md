# CrossChainCity — A DogCity viva e multichain (`crosschaincity.md`)

> **Meta:** transformar a DogCity de um retrato estático em um **organismo vivo e
> cross-chain**. Cada carteira ganha um **endereço permanente**; cada transação de
> DOG (BTC + Solana + Stacks) vira uma **viagem** pela cidade — carro, caminhão ou
> helicóptero, por valor. A cidade **respira** com o estado real dos holders:
> constrói quando uma carteira recebe pela 1ª vez, **cresce/encolhe** com o saldo, e
> **implode em ruína** quando zera. Sucessor do `cityupdate3.md`; este é o plano de
> implementação **canônico** deste ciclo.
>
> **Como nasceu (2026-07-06):** conversa de design com o dono. Ideia-mãe: "uma
> carteira = um endereço" evolui para "**uma transação = uma viagem**".

---

## Decisões do dono (travadas)

| Tema | Decisão |
|---|---|
| **Arquitetura** | Cidade **persistente e movida a delta** (não regenera tudo). Registro `wallet→lote` permanente. |
| **Multichain** | 3 redes com **lista completa de holders (endereço + saldo)**: BTC (centro), **bairro Solana** e **bairro Stacks** em áreas pouco ocupadas. Fonte: página *holders* do dogdata. |
| **Endereço permanente** | Atribuído 1× e nunca teleporta. Carteira que zera vira **ruína** (lote preservado). Se voltar, **reconstrói no mesmo lugar**. |
| **Skyline** | Lote permanente vale mesmo se a carteira muda de tier (micro que vira baleia = **torre solitária no subúrbio**, aceito de propósito). |
| **Snapshot de holders** | A cada **1 hora**, disponível por volta do **minuto 28**. Delta calculado nessa cadência. |
| **Feed de TX** | **Ao vivo** (TX fica disponível ~3 min depois). |
| **Veículos (por valor em DOG)** | `< 1M` **carro** · `1M–5M` **caminhão** · `> 5M` **helicóptero**. |
| **Tráfego** | **Híbrido**: ambiente discreto/anônimo para densidade + veículos-TX com **luz especial**, clicáveis. |
| **Clique no veículo** | Abre a **TX de DOG** (painel: valor, chain, protocolo, descrição, timestamp + link pro explorer da rede). |
| **Fora do escopo agora** | TX `type: 'bridge'` e **burns** não entram nesta fase. Movimento é **dentro de cada chain** (sem cruzar zonas por ora). |

---

## Diagnóstico — por que o modelo atual não serve

Hoje `app/api/city/data/route.ts` **regenera a cidade inteira** a cada request: o
raio cresce com N, os lotes são ordenados por saldo, tudo é recalculado. Isso é
incompatível com **endereço permanente** e com **implodir/construir** — o prédio de
uma carteira **se move** de uma geração pra outra. A base de tudo neste ciclo é
**inverter isso**: a posição vira um **fato armazenado**, não um cálculo.

Os dados de TX **já existem** e batem com a ideia — `ChainTransaction`
(`lib/multichain/types.ts`) tem `chain`, `tx_id`, `type`, `from_address`,
`to_address`, `amount`, `amount_usd`, `timestamp`, `protocol`, `description`,
`all_transfers[]`. A API `app/api/multichain/transactions/route.ts` já serve as 3
redes. **Não há varredura nova de dados** — é orquestração.

---

## BLOCO A — Registro de endereços (a fundação inegociável)

**Objetivo:** cada carteira (BTC + SOL + STX) tem um lote fixo, guardado.

1. **Tabela Supabase `dogcity_lots`** (chave = `address`):
   ```
   address      text PK
   chain        text        -- 'bitcoin' | 'solana' | 'stacks'
   zone         text        -- macro-zona (btc-core / solana / stacks)
   district     smallint    -- distrito de riqueza dentro da zona
   lot_x, lot_z real        -- posição-mundo permanente
   rot          real
   street       text        -- (Bloco E) nome da rua
   number       int         -- (Bloco E) número do prédio
   state        text        -- 'active' | 'ruin'
   last_balance double      -- saldo do último snapshot (p/ diff)
   assigned_at  timestamptz
   updated_at   timestamptz
   ```
2. **Atribuição idempotente e append-only:** ao ver um endereço **novo** num
   snapshot, aloca o **próximo lote livre na fronteira** da sua zona/distrito, grava,
   e **nunca reatribui**. Endereço que já tem lote → mantém.
3. **Ruína e retorno:** carteira ausente do snapshot (saldo 0) → `state='ruin'`
   (lote preservado, `last_balance=0`). Reaparece → `state='active'`, **mesmo lote**.
4. **Migração inicial:** rodar 1× sobre os 3 snapshots completos → povoa a tabela com
   todos os holders atuais. A partir daí é incremental.

**Risco:** concorrência de escrita (a rota é dinâmica). Alocação de lote precisa ser
**transacional** (uma sequência/contador por zona) para dois requests não pegarem o
mesmo lote. **Baixo volume de escrita** (só endereços novos por hora).

---

## BLOCO B — Gerador multichain (3 zonas, lê o registro)

**Objetivo:** o gerador para de calcular posição por saldo e passa a **plantar o que
o registro manda**, criando as 3 zonas.

1. **Macro-layout:** BTC ocupa o centro (a cidade atual). **Solana** e **Stacks**
   ganham **setores próprios** em áreas hoje vazias (borda/ilhas do outro lado da
   água — a metáfora "ilhas ligadas por pontes" já deixa o gancho pro cross-chain
   futuro). Cada zona dimensiona seu raio pelo **N daquela rede** (fórmula derivada do
   BLOCO B do `cityupdate3`), mas **cresce por append** (nunca encolhe posições
   existentes).
2. **Dentro da zona:** mantém distritos por tier de riqueza + anéis (altura = saldo,
   footprint = saldo — BLOCO C do v3), **mas a posição vem do registro**, não de
   `sort(dog)`. O `route.ts` vira um **leitor do registro** + alocador de lotes novos.
3. **Payload:** `buildings[]` passa a carregar `address` (ou id estável) e `state`
   (active/ruin) além de `[x,z,tier,zone,footprint,rot]`. Ruínas viram um tipo de
   prédio próprio (entulho baixo).
4. **Pré-requisito de dados:** as listas SOL/STX da página *holders* expõem **endereço
   + saldo por holder** (dono confirmou que sim).

---

## BLOCO C — Motor de deltas (a cidade respira, 1×/hora)

**Objetivo:** transformar a diferença entre snapshots em **eventos animáveis**.

1. **Gatilho:** logo após o snapshot (min ~28 de cada hora), rodar o diff das 3 redes
   contra `last_balance` do registro:
   - **novo holder** → aloca lote (Bloco A) + evento `construct`.
   - **saldo↑ / saldo↓** (sem zerar) → evento `resize` (recalcula altura/footprint).
   - **zerou** → evento `implode` (`state='ruin'`).
   - **ruína→ativo** → evento `rebuild` (mesmo lote).
2. **Saída:** `app/api/city/deltas` devolve a **fila de eventos** da última janela
   (poucos itens perto dos ~86k+ — barato). O cliente consome e anima.
3. **Animação no cliente:**
   - `construct` → escala Y de 0→cheio (guindaste/poeira opcional).
   - `implode` → cheio→0 + troca por **geometria de ruína**.
   - `resize` → tween da altura/footprint.
   - Prédios são `InstancedMesh` estático → manter um **pool dinâmico pequeno** só pros
     que estão animando; ao terminar, "assar" de volta no mesh estático. (Nunca animar
     86k matrizes; só o delta da hora.)

---

## BLOCO D — Feed de TX + veículos (o coração deste update)

**Objetivo:** cada TX de DOG vira uma viagem clicável pela cidade.

1. **Resolver:** `from_address`/`to_address` → lote via registro (Bloco A). Todo `to`
   é holder válido (recebeu → tem prédio). O único vão é o **destinatário recém-criado**
   ainda não no snapshot → o **`construct` em tempo real** (Bloco C) materializa o lote
   na hora que a TX chega. `bridge`/`burn` **ignorados** por ora.
2. **Endpoint enxuto:** `app/api/city/txfeed` projeta as TX recentes por rede em
   `{ tx_id, chain, from:{x,z}, to:{x,z}, amount, tier, protocol, ts }` — nada de
   payload gordo. Cliente faz **polling ao vivo** (a TX aparece ~3 min depois).
3. **Veículo por valor (DOG):** `<1M` **carro** · `1–5M` **caminhão** · `>5M`
   **helicóptero**. Cor por chain (BTC laranja / SOL roxo / STX azul) + **luz especial**
   que separa TX-real do tráfego ambiente.
4. **Movimento:**
   - **Helicóptero** = arco direto telhado→telhado (resolve pathfinding "por cima").
   - **Carro/caminhão** = segue a malha viária (ou spline) dentro da zona. Muitos →
     `InstancedMesh` + array paralelo de `tx_id` (mesmo padrão do clique dos prédios).
   - Movimento é **intra-zona** (cross-zona só via bridge, fora do escopo).
5. **Clique → TX:** painel com `amount`, `chain`, `protocol`, `description`, `ts` +
   link pro explorer certo (mempool / solscan / explorer Stacks).
6. **Tráfego híbrido:** manter uma camada **ambiente discreta e não-clicável** pra
   densidade, que **recua quando há muita TX real** e preenche quando está calmo.
7. **Escala/perf:** **cap de agentes concorrentes** + **amostragem** (sempre mostra
   baleias/helis; amostra a poeira de carros). Fila com expiração por tempo.

---

## BLOCO E — Endereço legível + claims (polish)

Nomes de rua + número do prédio **não são pré-requisito** do movimento (o resolver usa
`x,z`), mas são **feature de produto** de altíssimo valor sobre o registro:

- Cada carteira ganha um endereço compartilhável ("**Satoshi District, HODL Ave 4471**").
- Liga direto ao **claim** (10k/50k DOG — já no plano do projeto): reivindicar o **seu
  endereço**.
- Deixa o painel de TX legível ("da HODL Ave 4471 → Runes Blvd 88").

Geração: ruas nomeadas por distrito/tema + numeração sequencial ao longo da via no
momento em que o lote é alocado (grava `street`/`number` no registro).

---

## Ordem de execução

```
BLOCO A (registro Supabase + migração dos 3 chains)              ← a fundação de tudo
  → BLOCO B (gerador multichain lê o registro; 3 zonas)          ← a cidade multichain
  → BLOCO C (motor de deltas + construir/implodir/redimensionar) ← a cidade respira
  → BLOCO D (feed de TX ao vivo + carro/caminhão/heli + clique)  ← uma tx = uma viagem
  → BLOCO E (ruas nomeadas + número + claim do endereço)         ← endereço como produto
```

Racional: A é pré-requisito **físico** (sem lote estável nada disso fecha). B dá o
palco (3 redes). C faz a cidade viva **mesmo sem TX** (já vale sozinho). D é o
espetáculo. E monetiza/viraliza o endereço.

---

## Métricas de aceite

- [ ] Registro persistente: o mesmo endereço devolve o **mesmo lote** entre reloads/regenerações.
- [ ] Carteira que zera vira **ruína** no lote; se volta, **reconstrói no mesmo lote**.
- [ ] As 3 zonas (BTC/SOL/STX) aparecem, cada carteira das listas com seu prédio.
- [ ] Snapshot novo (min ~28) → prédios **constroem/implodem/redimensionam** só nos deltas.
- [ ] TX ao vivo: `from`/`to` resolvem para lotes; veículo certo por valor; **luz especial**; clique abre a TX.
- [ ] Tráfego ambiente recua quando há TX real; cidade nunca fica morta nem lotada.
- [ ] 60fps mantidos (cap + amostragem de veículos; pool dinâmico só p/ prédios em animação).

---

## Arquivos-alvo

- **Novo** `lib/city/registry.ts` — leitura/escrita do registro Supabase (alocação transacional de lote).
- **Novo** `app/api/city/deltas/route.ts` — diff do snapshot → eventos construir/implodir/redimensionar.
- **Novo** `app/api/city/txfeed/route.ts` — TX recentes resolvidas p/ lotes (poll do cliente).
- **Mudar** `app/api/city/data/route.ts` — de "regenera tudo" para **ler o registro** + alocar lotes novos + 3 zonas.
- **Mudar** `app/city/explore/city-3d.tsx` — veículos-TX (carro/caminhão/heli, clique), animações de estado, tráfego híbrido.
- **Fonte pronta:** `app/api/multichain/transactions/route.ts`, `lib/multichain/types.ts`, listas de holders BTC/SOL/STX.

---

## Riscos e notas

- **Concorrência do registro:** alocação de lote precisa ser transacional (sequência por zona) — senão dois requests pegam o mesmo lote.
- **Layout das zonas SOL/STX:** definir onde ficam (ilhas do outro lado da água é a proposta) e dimensionar pelo N de cada rede.
- **Vão de ~1h no primeiro recebimento:** coberto pelo `construct` em tempo real; confirmar cadência real do snapshot por rede (BTC/SOL/STX podem diferir).
- **Perf dos veículos:** carros instanciados + cap + amostragem; helis são poucos. Prédios em animação num **pool dinâmico** separado do mesh estático.
- **Herdadas (sagradas):** sem screenshot headless por software (OOM) — QA visual em GPU real via Playwright MCP; cuidado com `next dev` zumbi servindo bundle velho; gates `tsc` + validação por curl/node.
- **Compatível com v3:** o registro **substitui** o `sort(dog)→lote` do v3, mas herda altura/footprint/telhados/coroas/tipologia (BLOCOS C/typology do v3) e o WORLD_SCALE por zona.
```
