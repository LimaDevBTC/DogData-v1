#!/bin/bash
# Script para acompanhar o monitor em tempo real

clear
echo "🔄 Monitorando DOG Monitor 24/7"
echo "================================"
echo "Pressione Ctrl+C para sair"
echo ""

# Função para mostrar status
show_status() {
    clear
    echo "🔄 DOG Monitor 24/7 - Status em Tempo Real"
    echo "=========================================="
    echo ""
    
    # Status do processo
    if ps aux | grep -q "[d]og_monitor_24_7"; then
        pid=$(ps aux | grep "[d]og_monitor_24_7" | awk '{print $2}')
        uptime=$(ps -p $pid -o etime= 2>/dev/null | xargs)
        mem=$(ps -p $pid -o rss= 2>/dev/null | awk '{printf "%.1f MB", $1/1024}')
        echo "✅ Monitor: RODANDO"
        echo "   PID: $pid"
        echo "   Uptime: $uptime"
        echo "   RAM: $mem"
    else
        echo "❌ Monitor: PARADO"
    fi
    
    echo ""
    
    # Últimas linhas do log
    echo "📋 Últimas Atividades:"
    echo "----------------------------------------"
    tail -10 /home/bitmax/Projects/bitcoin-fullstack/DogData-v1/data/logs/dog_monitor_24_7.log 2>/dev/null | sed 's/^/   /'
    
    echo ""
    echo "----------------------------------------"
    
    # Status de transações
    if [ -f /home/bitmax/Projects/bitcoin-fullstack/DogData-v1/backend/data/dog_transactions.json ]; then
        total=$(cat /home/bitmax/Projects/bitcoin-fullstack/DogData-v1/backend/data/dog_transactions.json | jq -r '.total_transactions' 2>/dev/null)
        last_block=$(cat /home/bitmax/Projects/bitcoin-fullstack/DogData-v1/backend/data/dog_transactions.json | jq -r '.last_block' 2>/dev/null)
        echo "📊 Transações DOG: $total (último bloco: $last_block)"
    else
        echo "📊 Transações DOG: Aguardando primeiro bloco..."
    fi
    
    # Bloco atual
    current_block=$(bitcoin-cli getblockcount 2>/dev/null)
    echo "⛓️  Bloco Bitcoin: $current_block"
    
    echo ""
    echo "🔄 Atualizando a cada 5 segundos..."
    echo "   Pressione Ctrl+C para sair"
}

# Loop
while true; do
    show_status
    sleep 5
done

