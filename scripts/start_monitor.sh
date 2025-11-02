n#!/bin/bash

# Script para iniciar o monitor unificado de DOG
# Este script garante que o monitor rode de forma persistente

echo "🚀 Iniciando Monitor Unificado de DOG..."

# Parar qualquer instância anterior
pkill -f unified_monitor.py

# Aguardar um pouco
sleep 2

# Iniciar o monitor com nohup para persistência
cd /home/bitmax/Projects/bitcoin-fullstack/DogData-v1/scripts
nohup python3 unified_monitor.py > /home/bitmax/Projects/bitcoin-fullstack/DogData-v1/data/logs/unified_monitor_output.log 2>&1 &

# Obter o PID
PID=$!

echo "✅ Monitor iniciado com PID: $PID"
echo "📊 Logs: /home/bitmax/Projects/bitcoin-fullstack/DogData-v1/data/logs/unified_monitor.log"
echo "📋 Output: /home/bitmax/Projects/bitcoin-fullstack/DogData-v1/data/logs/unified_monitor_output.log"
echo ""
echo "Para verificar se está rodando: ps aux | grep unified_monitor"
echo "Para parar: pkill -f unified_monitor"
echo "Para ver logs: tail -f /home/bitmax/Projects/bitcoin-fullstack/DogData-v1/data/logs/unified_monitor.log"
