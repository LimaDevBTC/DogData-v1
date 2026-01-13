#!/bin/bash
# Script para verificar e instalar dependências do automated_update.py

echo "🔍 Verificando dependências Python..."

# Verificar python3
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version)
    echo "✅ Python3 encontrado: $PYTHON_VERSION"
else
    echo "❌ Python3 não encontrado!"
    exit 1
fi

# Verificar pip3
if command -v pip3 &> /dev/null; then
    echo "✅ pip3 encontrado"
else
    echo "❌ pip3 não encontrado!"
    exit 1
fi

# Verificar bibliotecas
echo ""
echo "📦 Verificando bibliotecas Python..."

python3 << EOF
import sys

missing = []
try:
    import requests
    print("✅ requests instalado")
except ImportError:
    missing.append("requests")
    print("❌ requests NÃO instalado")

try:
    from bs4 import BeautifulSoup
    print("✅ beautifulsoup4 instalado")
except ImportError:
    missing.append("beautifulsoup4")
    print("❌ beautifulsoup4 NÃO instalado")

if missing:
    print(f"\n⚠️  Bibliotecas faltando: {', '.join(missing)}")
    print("\n💡 Para instalar, execute:")
    print(f"   pip3 install --user {' '.join(missing)}")
    print("\n   Ou com sudo (se necessário):")
    print(f"   sudo pip3 install {' '.join(missing)}")
    sys.exit(1)
else:
    print("\n✅ Todas as dependências estão instaladas!")
    sys.exit(0)
EOF

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo ""
    echo "✅ Todas as dependências estão OK!"
    exit 0
else
    echo ""
    echo "⚠️  Algumas dependências estão faltando."
    echo "   Execute o comando sugerido acima para instalar."
    exit 1
fi

