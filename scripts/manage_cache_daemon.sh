#!/bin/bash
#
# Script para gerenciar o daemon de cache de transações
#

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DAEMON_SCRIPT="$SCRIPT_DIR/transactions_cache_daemon.sh"
PID_FILE="/tmp/dog_cache_daemon.pid"

case "$1" in
    start)
        if [ -f "$PID_FILE" ]; then
            PID=$(cat "$PID_FILE")
            if ps -p "$PID" > /dev/null 2>&1; then
                echo "❌ Daemon já está rodando (PID: $PID)"
                exit 1
            else
                echo "⚠️ Removendo PID file antigo..."
                rm -f "$PID_FILE"
            fi
        fi
        
        echo "🚀 Iniciando daemon de cache..."
        nohup bash "$DAEMON_SCRIPT" > /dev/null 2>&1 &
        echo "✅ Daemon iniciado!"
        echo "📝 Logs: $SCRIPT_DIR/../logs/transactions_cache.log"
        ;;
    
    stop)
        if [ -f "$PID_FILE" ]; then
            PID=$(cat "$PID_FILE")
            if ps -p "$PID" > /dev/null 2>&1; then
                echo "🛑 Parando daemon (PID: $PID)..."
                kill "$PID"
                rm -f "$PID_FILE"
                echo "✅ Daemon parado"
            else
                echo "⚠️ Daemon não está rodando"
                rm -f "$PID_FILE"
            fi
        else
            echo "⚠️ Daemon não está rodando (PID file não encontrado)"
        fi
        ;;
    
    restart)
        $0 stop
        sleep 2
        $0 start
        ;;
    
    status)
        if [ -f "$PID_FILE" ]; then
            PID=$(cat "$PID_FILE")
            if ps -p "$PID" > /dev/null 2>&1; then
                echo "✅ Daemon está rodando (PID: $PID)"
                echo "📝 Logs: tail -f $SCRIPT_DIR/../logs/transactions_cache.log"
            else
                echo "❌ Daemon não está rodando (PID file existe mas processo morreu)"
            fi
        else
            echo "❌ Daemon não está rodando"
        fi
        ;;
    
    logs)
        LOG_FILE="$SCRIPT_DIR/../logs/transactions_cache.log"
        if [ -f "$LOG_FILE" ]; then
            tail -f "$LOG_FILE"
        else
            echo "❌ Arquivo de log não encontrado"
        fi
        ;;
    
    update-now)
        echo "🔄 Executando atualização manual..."
        python3 "$SCRIPT_DIR/update_transactions_cache.py"
        ;;
    
    *)
        echo "Uso: $0 {start|stop|restart|status|logs|update-now}"
        echo ""
        echo "Comandos:"
        echo "  start       - Inicia o daemon"
        echo "  stop        - Para o daemon"
        echo "  restart     - Reinicia o daemon"
        echo "  status      - Verifica status do daemon"
        echo "  logs        - Mostra logs em tempo real"
        echo "  update-now  - Executa atualização manual agora"
        exit 1
        ;;
esac

