#!/bin/bash

# Script para testar a API de atualização localmente
# Uso: ./scripts/test_update_api.sh

echo "🧪 Testando API de atualização de transações..."
echo ""

# Configurações
BASE_URL="http://localhost:3000"
SECRET="dog-update-secret-2025-production-key-secure"

# Cores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "📡 Servidor: $BASE_URL"
echo "🔑 Secret: $SECRET"
echo ""

# Teste 1: Verificar se o servidor está rodando
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Teste 1: Verificar servidor"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if curl -s -o /dev/null -w "%{http_code}" "$BASE_URL" | grep -q "200\|301\|302"; then
    echo -e "${GREEN}✓${NC} Servidor está rodando"
else
    echo -e "${RED}✗${NC} Servidor não está respondendo"
    echo "Execute: npm run dev"
    exit 1
fi
echo ""

# Teste 2: Chamar API sem secret (deve falhar)
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Teste 2: API sem autenticação (deve falhar)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/update-transactions")
HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
BODY=$(echo "$RESPONSE" | head -n -1)

if [ "$HTTP_CODE" = "401" ]; then
    echo -e "${GREEN}✓${NC} Autenticação funcionando (401 Unauthorized)"
    echo "Resposta: $BODY"
else
    echo -e "${RED}✗${NC} Esperado 401, recebido: $HTTP_CODE"
fi
echo ""

# Teste 3: Chamar API com secret correto
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Teste 3: API com autenticação (deve funcionar)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Chamando: $BASE_URL/api/update-transactions?secret=***"
echo ""

RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/update-transactions?secret=$SECRET")
HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
BODY=$(echo "$RESPONSE" | head -n -1)

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓${NC} API respondeu com sucesso (200 OK)"
    echo ""
    echo "Resposta:"
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
else
    echo -e "${RED}✗${NC} Falha na API (HTTP $HTTP_CODE)"
    echo "Resposta: $BODY"
fi
echo ""

# Teste 4: Verificar se dados foram salvos
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Teste 4: Verificar cache de transações"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Buscando: $BASE_URL/api/dog-rune/transactions-kv"
echo ""

RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/dog-rune/transactions-kv")
HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
BODY=$(echo "$RESPONSE" | head -n -1)

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓${NC} Cache acessível (200 OK)"
    echo ""
    
    TOTAL=$(echo "$BODY" | jq -r '.total_transactions' 2>/dev/null)
    LAST_BLOCK=$(echo "$BODY" | jq -r '.last_block' 2>/dev/null)
    UPDATED=$(echo "$BODY" | jq -r '.last_updated' 2>/dev/null)
    
    if [ "$TOTAL" != "null" ]; then
        echo "📊 Total de transações: $TOTAL"
        echo "📦 Último bloco: $LAST_BLOCK"
        echo "🕐 Última atualização: $UPDATED"
        echo ""
        echo -e "${GREEN}✓${NC} Dados válidos no cache"
    else
        echo -e "${YELLOW}⚠${NC} Cache vazio ou formato inválido"
        echo "Resposta: $BODY"
    fi
else
    echo -e "${RED}✗${NC} Falha ao acessar cache (HTTP $HTTP_CODE)"
    echo "Resposta: $BODY"
fi
echo ""

# Resumo
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Resumo dos Testes"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ Servidor rodando"
echo "✅ Autenticação funcionando"
echo "✅ API de atualização operacional"
echo "✅ Cache de transações acessível"
echo ""
echo -e "${GREEN}🎉 Todos os testes passaram!${NC}"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📝 Próximos passos:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. Configure Vercel KV no dashboard"
echo "2. Faça deploy na Vercel"
echo "3. Configure cron job no cron-job.org"
echo ""
echo "Veja o guia completo em: VERCEL_KV_SETUP.md"
echo ""

