#!/bin/bash
#
# Daemon para atualizar cache de transações a cada 10 minutos
#

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON_SCRIPT="$SCRIPT_DIR/update_transactions_cache.py"
LOG_FILE="$SCRIPT_DIR/../logs/transactions_cache.log"
PID_FILE="/tmp/dog_cache_daemon.pid"

# Criar diretório de logs
mkdir -p "$SCRIPT_DIR/../logs"

# Verificar se já está rodando
if [ -f "$PID_FILE" ]; then
    OLD_PID=$(cat "$PID_FILE")
    if ps -p "$OLD_PID" > /dev/null 2>&1; then
        echo "❌ Daemon já está rodando (PID: $OLD_PID)"
        exit 1
    fi
fi

# Salvar PID
echo $$ > "$PID_FILE"

ENV_FILE="$SCRIPT_DIR/../.env.local"
if [ -f "$ENV_FILE" ]; then
    set -a
    source "$ENV_FILE"
    set +a
fi

echo "🚀 Daemon de cache iniciado (PID: $$)"
echo "📝 Logs: $LOG_FILE"
echo "🕐 Intervalo: 3 minutos"
# Ajustar intervalo em segundos (3 minutos)
INTERVAL=180

# Loop infinito
while true; do
    TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
    echo "" | tee -a "$LOG_FILE"
    echo "═══════════════════════════════════════════════" | tee -a "$LOG_FILE"
    echo "[$TIMESTAMP] Atualizando cache..." | tee -a "$LOG_FILE"
    echo "═══════════════════════════════════════════════" | tee -a "$LOG_FILE"
    
    # Executar script Python
    python3 "$PYTHON_SCRIPT" 2>&1 | tee -a "$LOG_FILE"
    
    EXIT_CODE=${PIPESTATUS[0]}
    
    if [ $EXIT_CODE -eq 0 ]; then
        echo "✅ Atualização concluída com sucesso" | tee -a "$LOG_FILE"
    else
        echo "❌ Erro na atualização (exit code: $EXIT_CODE)" | tee -a "$LOG_FILE"
    fi
    
    # Aguardar 10 minutos
    echo "⏰ Próxima atualização em 3 minutos..." | tee -a "$LOG_FILE"
    sleep $INTERVAL
done

