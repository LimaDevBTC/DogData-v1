# Análise: Problema de Change Outputs sendo contados como Inflow

## Problema Identificado

O usuário reportou que outputs de "troco" (change outputs) estavam sendo contados como transferências, causando valores incorretos nos "Top Inflow Wallets (24h)".

### Exemplo do Problema

**Transação**: `7c87438a85ee5f261d98445cab44a55e170563a0cfcd73cb08628d2045901c81`

**Carteira**: `bc1pczdzvvuulwyna9e6dsl8w0r35prvnmpawcwlrv4y42u5npysrdzqhwa7wl`

**Situação**:
- Tinha 1 UTXO com 968,177,031.6772 DOG
- Enviou esse UTXO na transação
- Transferiu 14,142.731 DOG para `bc1p0wfgr8mr4mclaxgryqx6rnc6rx5gfy2zfusp5qrvsa6k9vglhg7qqdq4ck`
- Recebeu de volta (change) 968,162,888.9462 DOG

**Problema**: O output de change (968,162,888.9462 DOG) estava sendo contado como inflow, aparecendo como o maior inflow do dia.

## Análise do Código

### Como Funciona o Bitcoin

Em uma transação Bitcoin:
1. **Inputs**: UTXOs que estão sendo gastos (senders)
2. **Outputs**: Novos UTXOs criados (receivers)
   - **Outputs de transferência**: Enviados para outras carteiras
   - **Change outputs**: Enviados de volta para o próprio sender (troco)

### Como Identificamos Change Outputs

**Regra**: Um output é considerado "change" se o endereço que recebe também está na lista de senders da mesma transação.

```typescript
const isChange = senderAddresses.has(receiver.address);
```

### Onde Estava o Problema

1. **Dados antigos no cache**: Transações processadas antes da implementação do campo `is_change` podem não ter esse campo setado
2. **Falta de validação**: O código não verificava se `is_change` estava definido antes de usar
3. **Cálculo de inflow**: Não havia verificação dupla para garantir que change outputs fossem excluídos

## Solução Implementada

### 1. Validação Dupla em `sanitizeTransaction`

```typescript
// Criar Set de endereços de senders para identificar change outputs (corrige dados antigos)
const senderAddressesForChange = new Set(senders.map((s: any) => s.address).filter(Boolean));

const receivers = tx.receivers.map((receiver: any) => {
  const address = receiver?.address || '';
  
  // Se is_change não está definido, calcular baseado em se o endereço está nos senders
  const isChange = receiver?.is_change !== undefined
    ? Boolean(receiver.is_change)
    : senderAddressesForChange.has(address);
  
  return {
    address,
    amount,
    amount_dog,
    has_dog: Boolean(receiver?.has_dog),
    is_change: isChange
  };
});
```

### 2. Verificação Dupla em `computeMetrics24h` (Backend)

```typescript
// Processar receivers: NUNCA contar change outputs como inflow
for (const receiver of tx.receivers) {
  if (!receiver.address) continue;
  
  // Verificação dupla: usar is_change se disponível, senão verificar se endereço está nos senders
  const isChange = receiver.is_change !== undefined
    ? Boolean(receiver.is_change)
    : txSenderAddresses.has(receiver.address);
  
  // CRÍTICO: NUNCA contar change outputs como inflow
  if (isChange) {
    continue;
  }
  
  // ... calcular inflow apenas para receivers que NÃO são change
}
```

### 3. Verificação Dupla em `computeMetrics24h` (Frontend)

Mesma lógica aplicada no frontend para garantir consistência.

## Modelo de Dados Correto

### O que devemos mostrar:

1. **Top Inflow Wallets**: Apenas transferências reais (excluindo change)
2. **Top Outflow Wallets**: Apenas transferências reais (excluindo change)
3. **Total Dog Moved**: Volume líquido (net_transfer), excluindo change

### Campos na Transação:

- `total_dog_in`: Total de DOG nos inputs
- `total_dog_out`: Total de DOG nos outputs (incluindo change)
- `change_amount`: Total de DOG em change outputs
- `net_transfer`: Total de DOG realmente transferido (total_dog_out - change_amount)
- `total_dog_moved`: Deve ser igual a `net_transfer` (volume real)

## Como a API Xverse Retorna Dados

A API Xverse retorna atividades separadas por tipo:
- `type: "input"`: Inputs da transação
- `type: "output"`: Outputs da transação

**Não há indicação explícita de change**, então precisamos inferir:
- Se um output tem o mesmo endereço de um input, é change

## Validações Adicionais

1. **Verificação dupla**: Sempre verificar `is_change` E se o endereço está nos senders
2. **Correção de dados antigos**: Calcular `is_change` quando não está presente
3. **Logs de debug**: Adicionar logs quando change outputs são detectados
4. **Validação de limites**: Garantir que valores não excedam limites razoáveis

## Impacto

Esta correção garante que:
- ✅ Change outputs nunca são contados como inflow
- ✅ Dados antigos no cache são corrigidos automaticamente
- ✅ Top Inflow/Outflow Wallets mostram apenas transferências reais
- ✅ Volume total (total_dog_moved) reflete apenas transferências líquidas

## Próximos Passos

1. ✅ Implementar validação dupla em todos os pontos de cálculo
2. ✅ Garantir que dados antigos sejam corrigidos
3. ⏳ Testar com a transação específica mencionada
4. ⏳ Considerar backfill do cache para corrigir dados históricos



