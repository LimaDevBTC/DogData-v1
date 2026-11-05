# 🚀 Vercel KV Setup Guide - DOG Transactions Tracker

## Arquitetura Implementada

```
External Cron (cron-job.org - 3 min)
    ↓
/api/update-transactions?secret=<SEGREDO>
    ↓
Busca Unisat API → Processa → Salva no Vercel KV
    ↓
/api/dog-rune/transactions-kv (cache 3 min)
    ↓
Frontend (dados em tempo real)
```

---

## 📋 Passo 1: Configurar Vercel KV (Dashboard)

### 1.1 Criar KV Database

1. Acesse: https://vercel.com/dashboard
2. Vá em **Storage** → **Create Database**
3. Escolha **KV (Redis)**
4. Nome sugerido: `dog-transactions-kv`
5. Região: **US East** (mais próximo)
6. Clique em **Create**

### 1.2 Conectar ao Projeto

1. Na página do KV, clique em **Connect Project**
2. Selecione: `bitcoin-fullstack` (seu projeto)
3. Environment: **Production, Preview, Development** (todos)
4. Clique em **Connect**

✅ **Pronto!** As variáveis `KV_URL`, `KV_REST_API_URL`, etc. serão adicionadas automaticamente.

---

## 📋 Passo 2: Adicionar Variável de Ambiente

### 2.1 Secret Token (Produção)

1. Ainda no dashboard da Vercel
2. Vá em **Settings** → **Environment Variables**
3. Adicione nova variável:
   - **Key:** `UPDATE_SECRET`
   - **Value:** `<SEGREDO>-2025-production-key-secure` (ou crie um token forte)
   - **Environments:** Production, Preview, Development
4. Clique em **Save**

### 2.2 Local Development (.env.local)

Crie o arquivo `.env.local` na raiz do projeto:

```bash
# Vercel KV - Copie as credenciais do dashboard após criar o KV
KV_URL=redis://default:xxxxx@xxxxx.upstash.io:6379
KV_REST_API_URL=https://xxxxx.upstash.io
KV_REST_API_TOKEN=xxxxx
KV_REST_API_READ_ONLY_TOKEN=xxxxx

# Secret para proteger API
UPDATE_SECRET=<SEGREDO>-2025-production-key-secure
```

**Onde encontrar as credenciais:**
- Dashboard Vercel → Storage → seu KV → aba `.env.local`

---

## 📋 Passo 3: Deploy na Vercel

```bash
# Commit das mudanças
git add .
git commit -m "feat: Add Vercel KV integration for transactions"
git push origin main

# A Vercel vai fazer deploy automático
```

**Aguarde ~2 minutos** para o deploy completar.

---

## 📋 Passo 4: Popular o Cache (Primeira Vez)

Após o deploy, execute manualmente a primeira atualização:

```bash
curl "https://seu-dominio.vercel.app/api/update-transactions?secret=<SEGREDO>"
```

Resposta esperada:
```json
{
  "success": true,
  "message": "Transações atualizadas com sucesso",
  "data": {
    "total_transactions": 1000,
    "last_block": 922258,
    "timestamp": "2025-11-05T..."
  }
}
```

---

## 📋 Passo 5: Configurar Cron Automático (cron-job.org)

### 5.1 Criar Conta

1. Acesse: https://console.cron-job.org/signup
2. Crie conta gratuita (confirme email)

### 5.2 Criar Cron Job

1. Dashboard → **Create cronjob**
2. Preencha:
   - **Title:** `DOG Transactions Update`
   - **Address:** `https://seu-dominio.vercel.app/api/update-transactions?secret=<SEGREDO>`
   - **Schedule:** 
     - **Every:** `3 minutes`
     - **Execution:** `Every day`
     - **Time zone:** `UTC` ou seu fuso
   - **Notifications:** 
     - ✅ Enable failure notifications (opcional)
     - Email: seu-email@exemplo.com
3. Clique em **Create cronjob**

### 5.3 Verificar Funcionamento

- Aguarde 3 minutos
- Verifique na aba **History** do cron-job.org
- Status esperado: ✅ **200 OK**

---

## 📋 Passo 6: Atualizar Frontend (Opcional)

Modificar `app/transactions/page.tsx` para usar a nova API:

```typescript
// ANTES:
const response = await fetch('/data/dog_transactions.json')

// DEPOIS:
const response = await fetch('/api/dog-rune/transactions-kv')
```

---

## 🧪 Testando Localmente (Desenvolvimento)

### 1. Popular o cache local primeiro:

```bash
# Execute o script Python uma vez para criar o JSON
python3 scripts/update_transactions_cache.py
```

### 2. Testar a API:

```bash
# Terminal 1: Servidor dev
npm run dev

# Terminal 2: Testar API
curl "http://localhost:3000/api/dog-rune/transactions-kv"
```

**Fallback:** Se o KV não estiver configurado localmente, a API usa o JSON como fallback.

---

## 📊 Monitoramento

### Logs da Vercel

1. Dashboard → seu projeto → **Logs**
2. Filtrar por: `/api/update-transactions`
3. Verificar:
   - ✅ Execuções a cada 3 minutos
   - ✅ Status 200
   - ✅ Logs: "Cache salvo no KV"

### Métricas do KV

1. Dashboard → Storage → seu KV → **Analytics**
2. Verificar:
   - **Commands:** ~480/dia (1 set + 1 get × 20/hora)
   - **Storage:** ~1-2 MB
   - **Bandwidth:** ~10-20 MB/dia

---

## 🎯 Endpoints Disponíveis

| Endpoint | Método | Descrição | Auth |
|----------|--------|-----------|------|
| `/api/update-transactions` | GET | Atualiza cache do KV | ✅ Secret token |
| `/api/dog-rune/transactions-kv` | GET | Retorna transações cacheadas | ❌ Público |

---

## 🔧 Troubleshooting

### Erro: "Unauthorized"
- Verifique se o `secret` está correto na URL
- Verifique `UPDATE_SECRET` nas env vars da Vercel

### Erro: "No cached data available"
- Execute `/api/update-transactions` manualmente uma vez
- Verifique se o KV está conectado ao projeto

### Erro: "Unisat API error"
- Verifique se a API Key está válida
- Verifique rate limits (1000 requests/dia no plano free)

### Frontend mostra dados desatualizados
- Limpe cache do navegador (Ctrl+Shift+R)
- Verifique se o cron job está rodando
- Verifique logs da Vercel

---

## 💰 Custos (Plano Gratuito)

| Serviço | Limite Free | Uso Estimado | Status |
|---------|-------------|--------------|--------|
| Vercel KV | 256 MB storage | ~2 MB | ✅ OK |
| Vercel KV | 100K commands/mês | ~14K/mês | ✅ OK |
| Vercel Functions | 100K invocations | ~14K/mês | ✅ OK |
| cron-job.org | Ilimitado (free) | 480/dia | ✅ OK |
| Unisat API | 1000 req/dia | ~480/dia | ✅ OK |

**Total:** $0/mês ✅

---

## 📝 Próximos Passos (Opcional)

1. **Webhook de notificação:**
   - Notificar Telegram/Discord quando houver transações grandes

2. **Health check endpoint:**
   - `/api/health` para monitorar o sistema

3. **Dashboard de métricas:**
   - Página interna para ver estatísticas de atualização

4. **Backup automático:**
   - Salvar snapshot diário no GitHub

---

## ✅ Checklist Final

- [ ] Vercel KV criado e conectado
- [ ] Variável `UPDATE_SECRET` configurada
- [ ] Deploy realizado na Vercel
- [ ] Cache populado (primeira execução manual)
- [ ] Cron job configurado no cron-job.org
- [ ] Primeira atualização automática bem-sucedida
- [ ] Frontend exibindo dados atualizados

---

**Pronto!** 🎉 Seu tracker de transações está rodando 24/7 de forma profissional e gratuita!

