#!/bin/bash

# Sistema Automatizado DOG Data
# Inicia todos os serviços necessários

echo "🚀 Iniciando Sistema Automatizado DOG Data..."

# Diretórios
ORD_DIR="/home/bitmax/Projects/bitcoin-fullstack/ord"
BACKEND_DIR="/home/bitmax/Projects/bitcoin-fullstack/DogData-v1/backend"
FRONTEND_DIR="/home/bitmax/Projects/bitcoin-fullstack/DogData-v1"
SYSTEM_DIR="/home/bitmax/Projects/bitcoin-fullstack"

# Função para matar processos existentes
cleanup_processes() {
    echo "🧹 Limpando processos existentes..."
    pkill -f "node.*server" 2>/dev/null
    pkill -f "next dev" 2>/dev/null
    pkill -f "realtime_dog_monitor" 2>/dev/null
    pkill -f "automated_dog_system" 2>/dev/null
    sleep 2
}

# Função para verificar se Bitcoin Node está rodando
check_bitcoin_node() {
    echo "🔍 Verificando Bitcoin Node..."
    if ! bitcoin-cli getblockcount >/dev/null 2>&1; then
        echo "❌ Bitcoin Node não está rodando!"
        echo "   Inicie o Bitcoin Node antes de executar este script"
        exit 1
    fi
    echo "✅ Bitcoin Node está rodando"
}

# Função para verificar se Ord está disponível
check_ord() {
    echo "🔍 Verificando Ord CLI..."
    if [ ! -f "$ORD_DIR/target/release/ord" ]; then
        echo "❌ Ord CLI não encontrado!"
        echo "   Compile o Ord antes de executar este script"
        exit 1
    fi
    echo "✅ Ord CLI disponível"
}

# Função para extrair dados iniciais
extract_initial_data() {
    echo "📊 Extraindo dados iniciais de DOG..."
    cd "$ORD_DIR"
    python3 efficient_dog_extractor.py
    if [ $? -eq 0 ]; then
        echo "✅ Dados iniciais extraídos"
    else
        echo "❌ Erro ao extrair dados iniciais"
        exit 1
    fi
}

# Função para iniciar backend
start_backend() {
    echo "⚙️ Iniciando Backend..."
    cd "$BACKEND_DIR"
    node src/server.js &
    BACKEND_PID=$!
    echo "✅ Backend iniciado com PID: $BACKEND_PID"
    
    # Aguardar backend estar pronto
    sleep 5
    if curl -s "http://localhost:3001/api/health" >/dev/null; then
        echo "✅ Backend respondendo"
    else
        echo "❌ Backend não está respondendo"
        exit 1
    fi
}

# Função para iniciar frontend
start_frontend() {
    echo "🌐 Iniciando Frontend..."
    cd "$FRONTEND_DIR"
    npm run dev &
    FRONTEND_PID=$!
    echo "✅ Frontend iniciado com PID: $FRONTEND_PID"
    
    # Aguardar frontend estar pronto
    sleep 10
    if curl -s "http://localhost:3000" >/dev/null; then
        echo "✅ Frontend respondendo"
    else
        echo "⚠️ Frontend pode não estar pronto ainda"
    fi
}

# Função para iniciar sistema automatizado
start_automated_system() {
    echo "🤖 Iniciando Sistema Automatizado..."
    cd "$SYSTEM_DIR"
    python3 automated_dog_system.py &
    SYSTEM_PID=$!
    echo "✅ Sistema Automatizado iniciado com PID: $SYSTEM_PID"
}

# Função para mostrar status
show_status() {
    echo ""
    echo "🎉 Sistema DOG Data iniciado com sucesso!"
    echo ""
    echo "📊 Serviços:"
    echo "   • Bitcoin Node: ✅ Rodando"
    echo "   • Backend API: http://localhost:3001"
    echo "   • Frontend: http://localhost:3000"
    echo "   • Sistema Automatizado: ✅ Monitorando blocos"
    echo ""
    echo "📋 Logs:"
    echo "   • Sistema: $SYSTEM_DIR/dog_system.log"
    echo "   • Backend: Verifique o terminal do backend"
    echo "   • Frontend: Verifique o terminal do frontend"
    echo ""
    echo "🛑 Para parar: Ctrl+C ou pkill -f automated_dog_system"
    echo ""
}

# Função para parada limpa
cleanup_on_exit() {
    echo ""
    echo "🛑 Parando sistema..."
    pkill -f "automated_dog_system" 2>/dev/null
    pkill -f "node.*server" 2>/dev/null
    pkill -f "next dev" 2>/dev/null
    echo "✅ Sistema parado"
    exit 0
}

# Configurar trap para parada limpa
trap cleanup_on_exit INT TERM

# Executar sequência de inicialização
cleanup_processes
check_bitcoin_node
check_ord
extract_initial_data
start_backend
start_frontend
start_automated_system
show_status

# Manter script rodando
wait
