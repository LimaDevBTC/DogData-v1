# API Optimizer: Redução de Requests para Fees via Batch por Bloco

## Problema

No arquivo `app/api/update-transactions/route.ts`, o cálculo de fees faz **2 chamadas Xverse por transação** (inputs + outputs), totalizando até **1000+ requests** por atualização. Isso acontece em dois locais:

1. **Loop principal de fees** (linhas 498-548): Itera sobre até 500 transações, chamando `fetchTransactionBtcTotals(txid)` individualmente.
2. **Backfill de fees** (linhas 1204-1255): Processa até 100 transações adicionais das últimas 24h que ainda não têm fees.

Cada chamada a `fetchTransactionBtcTotals` faz:
- `GET /v1/ordinals/tx/{txid}/inputs` (Xverse)
- `sleep(800ms)`
- `GET /v1/ordinals/tx/{txid}/outputs` (Xverse)
- Fallback: `GET https://mempool.space/api/tx/{txid}` (mempool.space)

## Solucao

Agrupar transacoes por `block_height` e buscar fees de todas as txs do bloco de uma vez via **mempool.space Block API**:

- `GET /api/block-height/{height}` → retorna block hash (string)
- `GET /api/block/{hash}/txs/{start_index}` → retorna array de até 25 txs com campo `fee` em sats

**Exemplo**: 500 txs em ~25 blocos = ~75 requests (vs 1000+ atual) = **redução de ~93%**

---

## Plano de Implementacao

### Passo 1: Criar constantes para mempool.space

**Onde**: Topo do arquivo `app/api/update-transactions/route.ts`, junto das outras constantes (linhas 11-18).

**Adicionar apos linha 18** (`const XVERSE_FETCH_FEES = ...`):

```typescript
const MEMPOOL_API_BASE = process.env.MEMPOOL_API_BASE || 'https://mempool.space/api';
const MEMPOOL_BLOCK_TXS_PER_PAGE = 25; // mempool.space retorna 25 txs por pagina
const MEMPOOL_BLOCK_DELAY_MS = Number(process.env.MEMPOOL_BLOCK_DELAY_MS || 300); // delay entre requests de bloco
```

### Passo 2: Criar funcao `fetchBlockFeeMap`

**Onde**: Inserir ANTES da funcao `fetchTransactionsFromXverse` (antes da linha 397).

Esta funcao recebe um `blockHeight` e um `Set<string>` de txids que precisamos, e retorna um `Map<txid, fee_sats>`.

```typescript
/**
 * Busca fees de transacoes de um bloco inteiro via mempool.space.
 * Retorna Map<txid, fee_sats> apenas para os txids solicitados.
 */
async function fetchBlockFeeMap(
  blockHeight: number,
  targetTxids: Set<string>
): Promise<Map<string, number>> {
  const feeMap = new Map<string, number>();

  try {
    // Passo 1: Obter block hash a partir da altura
    const hashUrl = `${MEMPOOL_API_BASE}/block-height/${blockHeight}`;
    const hashResponse = await fetch(hashUrl, {
      headers: { 'User-Agent': 'DogData Explorer/1.0' },
      cache: 'no-store',
      signal: AbortSignal.timeout(10000)
    });

    if (!hashResponse.ok) {
      console.warn(`[BLOCK-FEES] Falha ao obter hash do bloco ${blockHeight}: status ${hashResponse.status}`);
      return feeMap;
    }

    const blockHash = await hashResponse.text();
    if (!blockHash || blockHash.length !== 64) {
      console.warn(`[BLOCK-FEES] Hash invalido para bloco ${blockHeight}: ${blockHash}`);
      return feeMap;
    }

    // Passo 2: Paginar pelas txs do bloco ate encontrar todas as targetTxids
    let startIndex = 0;
    let found = 0;

    while (found < targetTxids.size) {
      if (MEMPOOL_BLOCK_DELAY_MS > 0 && startIndex > 0) {
        await sleep(MEMPOOL_BLOCK_DELAY_MS);
      }

      const txsUrl = `${MEMPOOL_API_BASE}/block/${blockHash}/txs/${startIndex}`;
      const txsResponse = await fetch(txsUrl, {
        headers: { 'User-Agent': 'DogData Explorer/1.0' },
        cache: 'no-store',
        signal: AbortSignal.timeout(15000)
      });

      if (!txsResponse.ok) {
        if (txsResponse.status === 429) {
          rateLimitRetries++;
          if (rateLimitRetries > 3) {
            console.warn(`[BLOCK-FEES] Rate limit persistente mempool.space no bloco ${blockHeight}. Abortando bloco.`);
            break;
          }
          console.warn(`[BLOCK-FEES] Rate limit mempool.space no bloco ${blockHeight}, offset ${startIndex} (tentativa ${rateLimitRetries})`);
          await sleep(2000 * rateLimitRetries);
          continue; // retry mesma pagina
        }
        console.warn(`[BLOCK-FEES] Falha ao buscar txs do bloco ${blockHeight} offset ${startIndex}: status ${txsResponse.status}`);
        break;
      }

      const txs: any[] = await txsResponse.json();

      if (!Array.isArray(txs) || txs.length === 0) {
        break; // Fim das txs do bloco
      }

      for (const tx of txs) {
        if (targetTxids.has(tx.txid) && typeof tx.fee === 'number' && tx.fee > 0) {
          feeMap.set(tx.txid, tx.fee);
          found++;
        }
      }

      // Se retornou menos que 25 txs, nao ha mais paginas
      if (txs.length < MEMPOOL_BLOCK_TXS_PER_PAGE) {
        break;
      }

      startIndex += txs.length;
    }
  } catch (error: any) {
    if (error.name !== 'AbortError') {
      console.warn(`[BLOCK-FEES] Erro ao buscar fees do bloco ${blockHeight}:`, error.message || error);
    }
  }

  return feeMap;
}
```

### Passo 3: Criar funcao `fetchFeesBatchByBlock`

**Onde**: Logo apos `fetchBlockFeeMap`.

Esta funcao orquestra o batch: agrupa txs por bloco, chama `fetchBlockFeeMap` para cada bloco, e aplica as fees.

```typescript
/**
 * Busca fees em batch agrupando transacoes por bloco.
 * Modifica as transacoes in-place adicionando fee_sats.
 * Retorna estatisticas do processo.
 */
async function fetchFeesBatchByBlock(
  transactions: Transaction[],
  existingMap: Map<string, Transaction>
): Promise<{ calculated: number; fromCache: number; failed: number }> {
  let calculated = 0;
  let fromCache = 0;
  let failed = 0;

  // Separar txs que ja tem fee no cache das que precisam buscar
  const needsFee: Transaction[] = [];

  for (const tx of transactions) {
    const existing = existingMap.get(tx.txid);
    if (existing?.fee_sats !== undefined && existing.fee_sats > 0) {
      tx.fee_sats = existing.fee_sats;
      fromCache++;
    } else if (!tx.fee_sats || tx.fee_sats === 0) {
      needsFee.push(tx);
    }
  }

  if (needsFee.length === 0) {
    console.log(`[FEES-BATCH] Todas as ${transactions.length} txs ja tinham fee no cache`);
    return { calculated, fromCache, failed };
  }

  // Agrupar por block_height
  const byBlock = new Map<number, Transaction[]>();
  for (const tx of needsFee) {
    if (!tx.block_height || tx.block_height === 0) {
      // Txs sem bloco (mempool?) - marcar como failed, serao tentadas individualmente depois
      failed++;
      continue;
    }
    const list = byBlock.get(tx.block_height) || [];
    list.push(tx);
    byBlock.set(tx.block_height, list);
  }

  console.log(`[FEES-BATCH] Buscando fees para ${needsFee.length} txs em ${byBlock.size} blocos...`);

  // Processar cada bloco
  const blockHeights = Array.from(byBlock.keys()).sort((a, b) => b - a); // mais recentes primeiro

  for (const height of blockHeights) {
    const blockTxs = byBlock.get(height)!;
    const targetTxids = new Set(blockTxs.map(tx => tx.txid));

    const feeMap = await fetchBlockFeeMap(height, targetTxids);

    for (const tx of blockTxs) {
      const fee = feeMap.get(tx.txid);
      if (fee !== undefined && fee > 0 && fee <= 10_000_000) {
        tx.fee_sats = fee;
        calculated++;
      } else {
        failed++;
      }
    }

    // Delay entre blocos para nao sobrecarregar mempool.space
    if (MEMPOOL_BLOCK_DELAY_MS > 0) {
      await sleep(MEMPOOL_BLOCK_DELAY_MS);
    }
  }

  console.log(`[FEES-BATCH] Resultado: ${calculated} calculadas, ${fromCache} do cache, ${failed} falhas (${byBlock.size} blocos consultados)`);

  return { calculated, fromCache, failed };
}
```

### Passo 4: Criar funcao fallback individual para txs que falharam

**Onde**: Logo apos `fetchFeesBatchByBlock`.

Para txs que o batch nao conseguiu resolver (bloco nao encontrado, tx nao apareceu no bloco, etc), manter fallback individual usando `fetchTransactionBtcTotals` existente, mas apenas para essas poucas txs.

```typescript
/**
 * Fallback individual para txs que nao tiveram fee resolvida pelo batch.
 * Usa a funcao existente fetchTransactionBtcTotals (Xverse + mempool individual).
 */
async function fetchFeesIndividualFallback(
  transactions: Transaction[],
  maxRetries: number = 20
): Promise<{ calculated: number; failed: number }> {
  const needsFee = transactions.filter(tx => !tx.fee_sats || tx.fee_sats === 0);

  if (needsFee.length === 0) return { calculated: 0, failed: 0 };

  const toProcess = needsFee.slice(0, maxRetries);
  let calculated = 0;
  let failed = 0;

  console.log(`[FEES-FALLBACK] Tentando ${toProcess.length} txs individualmente...`);

  for (const tx of toProcess) {
    const totals = await fetchTransactionBtcTotals(tx.txid);
    if (totals && totals.inSats > 0 && totals.outSats >= 0) {
      const fee = Math.max(totals.inSats - totals.outSats, 0);
      if (fee > 0 && fee <= 10_000_000) {
        tx.fee_sats = fee;
        calculated++;
      } else {
        failed++;
      }
    } else {
      failed++;
    }

    if (XVERSE_FEE_DELAY_MS > 0) {
      await sleep(Math.min(XVERSE_FEE_DELAY_MS, 300));
    }
  }

  console.log(`[FEES-FALLBACK] Resultado: ${calculated} calculadas, ${failed} falhas`);
  return { calculated, failed };
}
```

### Passo 5: Substituir o loop de fees em `fetchTransactionsFromXverse`

**Onde**: Dentro de `fetchTransactionsFromXverse`, linhas 498-548.

**REMOVER** o bloco inteiro de:
```typescript
  if (XVERSE_FETCH_FEES) {
    let feesCalculated = 0;
    let feesSkipped = 0;
    // ... todo o loop for (const tx of trimmed) ...
    console.log(`[FEES] Calculadas: ${feesCalculated}, Do cache: ${feesFromCache}, Reutilizadas: ${feesSkipped}, Falhas: ${feesFailed}`);
  } else {
    console.log(`[FEES] XVERSE_FETCH_FEES esta desabilitado`);
  }
```

**SUBSTITUIR POR**:
```typescript
  if (XVERSE_FETCH_FEES) {
    // Batch por bloco: busca fees agrupadas por block_height via mempool.space
    const batchResult = await fetchFeesBatchByBlock(trimmed, existingMap);

    // Fallback individual para txs que falharam no batch (limitado a 20)
    if (batchResult.failed > 0) {
      const fallbackResult = await fetchFeesIndividualFallback(trimmed, 20);
      console.log(`[FEES] Total: ${batchResult.calculated + fallbackResult.calculated} calculadas, ${batchResult.fromCache} do cache, ${batchResult.failed - fallbackResult.calculated} sem fee`);
    } else {
      console.log(`[FEES] Total: ${batchResult.calculated} calculadas, ${batchResult.fromCache} do cache, 0 falhas`);
    }
  } else {
    console.log(`[FEES] XVERSE_FETCH_FEES esta desabilitado`);
  }
```

### Passo 6: Substituir o backfill de fees no GET handler

**Onde**: No handler `GET`, linhas 1204-1256.

**REMOVER** o bloco inteiro de backfill:
```typescript
    // BACKFILL: Calcular fees para transacoes antigas que nao tem fees (apenas ultimas 24h)
    if (XVERSE_FETCH_FEES) {
      // ... todo o bloco de backfill ...
    }
```

**SUBSTITUIR POR**:
```typescript
    // BACKFILL: Calcular fees para transacoes antigas que nao tem fees (apenas ultimas 24h)
    if (XVERSE_FETCH_FEES) {
      const now = Date.now();
      const threshold24h = now - 24 * 60 * 60 * 1000;
      const transactionsNeedingFees = merged.filter(tx => {
        const ts = new Date(tx.timestamp).getTime();
        const is24h = !Number.isNaN(ts) && ts >= threshold24h;
        const needsFee = !tx.fee_sats || tx.fee_sats === 0;
        return is24h && needsFee;
      });

      if (transactionsNeedingFees.length > 0) {
        console.log(`[FEES] Backfilling fees para ${transactionsNeedingFees.length} txs das ultimas 24h...`);

        // Usar existingTxMap (ja definido na linha 1154) como referencia
        const backfillBatch = await fetchFeesBatchByBlock(
          transactionsNeedingFees.slice(0, 100),
          existingTxMap
        );

        // Fallback individual limitado a 10 para nao travar
        if (backfillBatch.failed > 0) {
          await fetchFeesIndividualFallback(transactionsNeedingFees.slice(0, 100), 10);
        }

        const remaining = transactionsNeedingFees.length > 100
          ? transactionsNeedingFees.length - 100
          : 0;
        if (remaining > 0) {
          console.log(`[FEES] Backfill: ${remaining} txs aguardando proxima execucao`);
        }
      }
    }
```

### Passo 7 (Opcional): Remover chamadas Xverse de inputs/outputs da funcao `fetchTransactionBtcTotals`

A funcao `fetchTransactionBtcTotals` (linhas 284-395) continuara existindo como fallback individual, mas podemos **simplifica-la** para usar apenas mempool.space (removendo a parte Xverse que faz 2 requests), ja que o batch por bloco cobre a maior parte dos casos.

**SUBSTITUIR** a funcao `fetchTransactionBtcTotals` inteira por:

```typescript
async function fetchTransactionBtcTotals(txid: string): Promise<{ inSats: number; outSats: number } | null> {
  // Usar mempool.space que retorna fee diretamente em 1 request
  try {
    const mempoolUrl = `${MEMPOOL_API_BASE}/tx/${txid}`;
    const response = await fetch(mempoolUrl, {
      headers: {
        'User-Agent': 'DogData Explorer/1.0',
        Accept: 'application/json'
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(8000)
    });

    if (response.ok) {
      const txData = await response.json();

      if (typeof txData?.fee === 'number' && txData.fee > 0) {
        const inSats = Array.isArray(txData.vin)
          ? txData.vin.reduce((sum: number, vin: any) => sum + safeInt(vin?.prevout?.value || 0), 0)
          : 0;
        const outSats = Array.isArray(txData.vout)
          ? txData.vout.reduce((sum: number, vout: any) => sum + safeInt(vout?.value || 0), 0)
          : 0;

        if (inSats > 0 && outSats > 0) {
          return { inSats, outSats };
        }
        if (outSats > 0) {
          return { inSats: txData.fee + outSats, outSats };
        }
        if (inSats > 0) {
          return { inSats, outSats: Math.max(0, inSats - txData.fee) };
        }
        return { inSats: txData.fee + 546, outSats: 546 };
      }
    }
  } catch (error: any) {
    if (error.name !== 'AbortError') {
      console.warn(`[FEES] Mempool.space falhou para ${txid.substring(0, 8)}...:`, error.message || error);
    }
  }

  return null;
}
```

Isso elimina completamente os endpoints `/v1/ordinals/tx/{txid}/inputs` e `/v1/ordinals/tx/{txid}/outputs` da Xverse, que eram os maiores geradores de requests.

---

## Resumo de Requests: Antes vs Depois

| Cenario | Antes (atual) | Depois (otimizado) |
|---------|--------------|-------------------|
| 500 txs, 25 blocos | ~1000 requests Xverse (inputs+outputs) | ~75 requests mempool.space (25 blocos x ~3 paginas) |
| Backfill 100 txs | ~200 requests | ~30 requests |
| Fallback individual | N/A | max 20 requests (apenas falhas) |
| **Total worst case** | **~1200** | **~125** |
| **Reducao** | - | **~90%** |

## Constantes/Env Vars novas

| Variavel | Default | Descricao |
|----------|---------|-----------|
| `MEMPOOL_API_BASE` | `https://mempool.space/api` | Base URL da API mempool.space |
| `MEMPOOL_BLOCK_DELAY_MS` | `300` | Delay entre requests de bloco para rate limiting |

## Variaveis que podem ser removidas (opcional)

| Variavel | Motivo |
|----------|--------|
| `XVERSE_FEE_DELAY_MS` | Nao sera mais usada no fallback simplificado |

## Arquivo afetado

Apenas **1 arquivo**: `app/api/update-transactions/route.ts`

## Ordem de execucao

1. Adicionar constantes (Passo 1)
2. Criar `fetchBlockFeeMap` (Passo 2)
3. Criar `fetchFeesBatchByBlock` (Passo 3)
4. Criar `fetchFeesIndividualFallback` (Passo 4)
5. Substituir loop de fees em `fetchTransactionsFromXverse` (Passo 5)
6. Substituir backfill no GET handler (Passo 6)
7. Simplificar `fetchTransactionBtcTotals` (Passo 7)
8. Testar manualmente chamando o endpoint GET com o secret token

## Riscos e mitigacoes

- **mempool.space rate limit**: Delay de 300ms entre requests + retry com backoff no 429
- **Bloco muito grande** (>1000 txs): A paginacao com early-exit (para quando encontra todas as targetTxids) evita requests desnecessarios
- **Tx no mempool (sem bloco)**: Fallback individual cobre esses casos (max 20 requests)
- **mempool.space fora do ar**: Fallback individual usa mempool.space/tx/{txid} que pode funcionar mesmo quando o endpoint de bloco nao funciona
