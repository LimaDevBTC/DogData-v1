#!/bin/bash
# Script para configurar o cron job de atualização automática

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CRON_LOG="$PROJECT_ROOT/logs/automated_update.log"

# Caminho completo do script Python
PYTHON_SCRIPT="$PROJECT_ROOT/scripts/automated_update.py"

# Verificar se o script existe
if [ ! -f "$PYTHON_SCRIPT" ]; then
    echo "❌ Erro: Script não encontrado: $PYTHON_SCRIPT"
    exit 1
fi

# Verificar se python3 está disponível
if ! command -v python3 &> /dev/null; then
    echo "❌ Erro: python3 não encontrado"
    exit 1
fi

# Criar diretório de logs se não existir
mkdir -p "$(dirname "$CRON_LOG")"

# Linha do cron (executa de hora em hora)
CRON_LINE="0 * * * * cd $PROJECT_ROOT && /usr/bin/python3 $PYTHON_SCRIPT >> $CRON_LOG 2>&1"

# Verificar se já existe no crontab
if crontab -l 2>/dev/null | grep -q "$PYTHON_SCRIPT"; then
    echo "⚠️  Cron job já existe. Removendo entrada antiga..."
    crontab -l 2>/dev/null | grep -v "$PYTHON_SCRIPT" | crontab -
fi

# Adicionar novo cron job
(crontab -l 2>/dev/null; echo "$CRON_LINE") | crontab -

echo "✅ Cron job configurado com sucesso!"
echo ""
echo "📋 Detalhes:"
echo "   Script: $PYTHON_SCRIPT"
echo "   Log: $CRON_LOG"
echo "   Frequência: A cada hora (0 * * * *)"
echo ""
echo "📝 Para verificar o cron job:"
echo "   crontab -l"
echo ""
echo "📊 Para ver os logs:"
echo "   tail -f $CRON_LOG"
echo ""
echo "🗑️  Para remover o cron job:"
echo "   crontab -l | grep -v '$PYTHON_SCRIPT' | crontab -"

