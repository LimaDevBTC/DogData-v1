#!/bin/bash
# Script para instalar dependências do automated_update.py

echo "📦 Instalando dependências Python para automated_update.py..."
echo ""

# Verificar se pip3 está disponível
if ! command -v pip3 &> /dev/null; then
    echo "❌ pip3 não encontrado!"
    echo "   Instale o pip3 primeiro."
    exit 1
fi

# Tentar instalar com --user primeiro
echo "🔍 Tentando instalar com --user (sem sudo)..."
if pip3 install --user beautifulsoup4 requests 2>&1 | grep -q "Successfully installed"; then
    echo "✅ Dependências instaladas com sucesso (--user)!"
    exit 0
fi

# Se falhar, tentar com sudo
echo ""
echo "⚠️  Instalação com --user falhou ou já estava instalado."
echo "🔍 Tentando verificar se já está instalado..."
python3 << EOF
try:
    import requests
    from bs4 import BeautifulSoup
    print("✅ Todas as dependências já estão instaladas!")
    exit(0)
except ImportError as e:
    print(f"❌ Dependência faltando: {e}")
    print("\n💡 Tente instalar manualmente:")
    print("   sudo pip3 install beautifulsoup4 requests")
    exit(1)
EOF

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo ""
    echo "✅ Pronto! Todas as dependências estão instaladas."
    exit 0
else
    echo ""
    echo "⚠️  Instalação automática falhou."
    echo ""
    echo "💡 Para instalar manualmente, execute:"
    echo "   sudo pip3 install beautifulsoup4 requests"
    echo ""
    echo "   Ou se preferir instalar apenas para o usuário:"
    echo "   pip3 install --break-system-packages --user beautifulsoup4 requests"
    exit 1
fi


