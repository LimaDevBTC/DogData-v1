#!/usr/bin/env python3
"""
Script automatizado para atualização completa:
1. Executa update_holders_and_fees.py (Bitcoin holders, fees, UTXOs)
2. Lê holders da Solana e Stacks do arquivo externo (atualizado via GitHub)
3. Atualiza arquivos do projeto
4. Faz commit e push para GitHub

Uso:
    python3 automated_update.py
    
Ou via cron (de hora em hora):
    0 * * * * cd /home/bitmax/Projects/bitcoin-fullstack/DogData-v1 && /usr/bin/python3 scripts/automated_update.py >> logs/automated_update.log 2>&1
"""

import subprocess
import json
import sys
import os
import re
import time
from datetime import datetime
from pathlib import Path

# Verificar dependências
try:
    import requests
except ImportError:
    print("❌ ERRO: Biblioteca 'requests' não instalada.")
    print("   Execute: pip3 install --user requests")
    print("   Ou: sudo pip3 install requests")
    sys.exit(1)

# BeautifulSoup não é mais necessário (scraping removido - valores atualizados via GitHub)
# requests ainda é usado para outras funcionalidades

# Caminhos
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
DATA_DIR = PROJECT_ROOT / 'data'
PUBLIC_DATA_DIR = PROJECT_ROOT / 'public' / 'data'

# Arquivo externo para holders de Solana e Stacks (atualizado via GitHub)
EXTERNAL_HOLDERS_FILE = DATA_DIR / 'external_holders.json'

def log(message):
    """Log com timestamp"""
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    print(f"[{timestamp}] {message}", flush=True)

def get_external_holders():
    """Lê holders de Solana e Stacks do arquivo externo (pode ser atualizado remotamente)"""
    solana = None
    stacks = None
    
    # Tentar ler do arquivo local primeiro
    if EXTERNAL_HOLDERS_FILE.exists():
        try:
            with open(EXTERNAL_HOLDERS_FILE, 'r') as f:
                data = json.load(f)
                if 'solana' in data and 'holders' in data['solana']:
                    solana = data['solana']['holders']
                if 'stacks' in data and 'holders' in data['stacks']:
                    stacks = data['stacks']['holders']
            if solana or stacks:
                log(f"✅ Valores externos carregados: Solana={solana}, Stacks={stacks}")
        except Exception as e:
            log(f"⚠️ Erro ao ler arquivo externo: {e}")
    
    return solana, stacks

def get_solana_holders():
    """Lê número de holders da Solana do arquivo externo (atualizado via GitHub)"""
    try:
        external_solana, _ = get_external_holders()
        if external_solana:
            log(f"✅ Solana holders do arquivo externo: {external_solana:,}")
            return external_solana
        else:
            log("⚠️ Solana holders não encontrado no arquivo externo")
            return None
    except Exception as e:
        log(f"❌ Erro ao ler holders da Solana: {e}")
        return None

def get_stacks_holders():
    """Lê número de holders da Stacks do arquivo externo (atualizado via GitHub)"""
    try:
        _, external_stacks = get_external_holders()
        if external_stacks:
            log(f"✅ Stacks holders do arquivo externo: {external_stacks}")
            return external_stacks
        else:
            log("⚠️ Stacks holders não encontrado no arquivo externo")
            return None
    except Exception as e:
        log(f"❌ Erro ao ler holders da Stacks: {e}")
        return None

def update_holders_values(solana_holders, stacks_holders):
    """Atualiza valores de Solana e Stacks nos arquivos do projeto"""
    try:
        log("📝 Atualizando valores nos arquivos...")
        
        # Ler valor atual de Bitcoin do JSON (uma vez, antes do loop)
        bitcoin_holders = None
        try:
            with open(PUBLIC_DATA_DIR / 'dog_holders.json', 'r') as f:
                holders_data = json.load(f)
                bitcoin_holders = holders_data.get('total_holders', 0)
        except:
            try:
                with open(DATA_DIR / 'dog_holders.json', 'r') as f:
                    holders_data = json.load(f)
                    bitcoin_holders = holders_data.get('total_holders', 0)
            except:
                bitcoin_holders = None
        
        if bitcoin_holders:
            log(f"  📊 Bitcoin holders carregados: {bitcoin_holders:,}")
        
        # Arquivos a atualizar
        files_to_update = [
            PROJECT_ROOT / 'app' / 'page.tsx',
            PROJECT_ROOT / 'app' / 'holders' / 'page.tsx'
        ]
        
        updated_files = []
        
        for file_path in files_to_update:
            if not file_path.exists():
                log(f"⚠️ Arquivo não encontrado: {file_path}")
                continue
            
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            original_content = content
            changes_made = False
            
            # Atualizar Solana
            if solana_holders:
                lines = content.split('\n')
                for i, line in enumerate(lines):
                    # No holders/page.tsx: useState<number>(10483) // Hardcoded
                    if 'holders/page.tsx' in str(file_path) and 'useState<number>' in line and 'Solana' in line and 'Hardcoded' in line:
                        match = re.search(r'useState<number>\((\d+)\)', line)
                        if match:
                            old_val = int(match.group(1))
                            if 10000 <= old_val <= 11000:  # Faixa esperada
                                lines[i] = re.sub(
                                    r'useState<number>\(\d+\)',
                                    f'useState<number>({solana_holders})',
                                    line
                                )
                                changes_made = True
                                log(f"  ✅ Atualizado Solana useState em {file_path.name}: {old_val} -> {solana_holders}")
                    
                    # No page.tsx: <span className="text-gray-300 font-mono">10,483</span>
                    elif 'page.tsx' in str(file_path) and 'holders' not in str(file_path):
                        # Procurar linha com "Solana" e depois a próxima linha com o número
                        if 'Solana' in line:
                            # Verificar as próximas 2 linhas para encontrar o número
                            for j in range(i, min(i+3, len(lines))):
                                if 'font-mono' in lines[j]:
                                    match = re.search(r'>(\d{1,3}(?:,\d{3})?)<', lines[j])
                                    if match:
                                        old_val = int(match.group(1).replace(',', ''))
                                        if 10000 <= old_val <= 11000:  # Faixa esperada
                                            lines[j] = re.sub(
                                                r'>\d{1,3}(?:,\d{3})?<',
                                                f'>{solana_holders:,}<',
                                                lines[j]
                                            )
                                            changes_made = True
                                            log(f"  ✅ Atualizado Solana display em {file_path.name}: {old_val:,} -> {solana_holders:,}")
                                            break
                content = '\n'.join(lines)
            
            # Atualizar Stacks
            if stacks_holders:
                lines = content.split('\n')
                for i, line in enumerate(lines):
                    # No holders/page.tsx: useState<number>(305) // Hardcoded
                    if 'holders/page.tsx' in str(file_path) and 'useState<number>' in line and 'Stacks' in line and 'Hardcoded' in line:
                        match = re.search(r'useState<number>\((\d+)\)', line)
                        if match:
                            old_val = int(match.group(1))
                            if 300 <= old_val <= 310:  # Faixa esperada
                                lines[i] = re.sub(
                                    r'useState<number>\(\d+\)',
                                    f'useState<number>({stacks_holders})',
                                    line
                                )
                                changes_made = True
                                log(f"  ✅ Atualizado Stacks useState em {file_path.name}: {old_val} -> {stacks_holders}")
                    
                    # No page.tsx: <span className="text-gray-300 font-mono">305</span>
                    elif 'page.tsx' in str(file_path) and 'holders' not in str(file_path):
                        # Procurar linha com "Stacks" e depois a próxima linha com o número
                        if 'Stacks' in line:
                            # Verificar as próximas 2 linhas para encontrar o número
                            for j in range(i, min(i+3, len(lines))):
                                if 'font-mono' in lines[j]:
                                    match = re.search(r'>(\d{2,3})<', lines[j])
                                    if match:
                                        old_val = int(match.group(1))
                                        if 300 <= old_val <= 320:  # Faixa esperada (ajustada para incluir 307)
                                            lines[j] = re.sub(
                                                r'>\d{2,3}<',
                                                f'>{stacks_holders}<',
                                                lines[j]
                                            )
                                            changes_made = True
                                            log(f"  ✅ Atualizado Stacks display em {file_path.name}: {old_val} -> {stacks_holders}")
                                            break
                content = '\n'.join(lines)
            
            # Atualizar Bitcoin no page.tsx (home) - sempre atualizar se tivermos o valor
            if bitcoin_holders and 'page.tsx' in str(file_path) and 'holders' not in str(file_path):
                lines = content.split('\n')
                for i, line in enumerate(lines):
                    # Procurar linha com "Bitcoin L1"
                    if 'Bitcoin L1' in line:
                        # Procurar número nas próximas 2 linhas
                        for j in range(i, min(i+3, len(lines))):
                            match = re.search(r'(\d{1,3}(?:,\d{3})+)', lines[j])
                            if match:
                                old_btc = int(match.group(1).replace(',', ''))
                                if 80000 <= old_btc <= 100000:  # Faixa esperada para Bitcoin
                                    lines[j] = re.sub(
                                        r'\b\d{1,3}(?:,\d{3})+\b',
                                        f"{bitcoin_holders:,}",
                                        lines[j],
                                        count=1
                                    )
                                    changes_made = True
                                    log(f"  ✅ Atualizado Bitcoin em {file_path.name}: {old_btc:,} -> {bitcoin_holders:,}")
                                    break
                        break
                content = '\n'.join(lines)
            
            # Atualizar total (calcular novo total se tivermos todos os valores)
            if solana_holders and stacks_holders and bitcoin_holders:
                new_total = bitcoin_holders + solana_holders + stacks_holders
                
                # Atualizar total no page.tsx (linha com "101,424")
                if 'page.tsx' in str(file_path) and 'holders' not in str(file_path):
                    lines = content.split('\n')
                    for i, line in enumerate(lines):
                        # Procurar linha com o total (formato: "101,424")
                        if 'text-3xl font-bold text-white font-mono' in line:
                            # Próxima linha deve ter o número
                            if i + 1 < len(lines):
                                match = re.search(r'(\d{1,3}(?:,\d{3})+)', lines[i + 1])
                                if match:
                                    old_total = int(match.group(1).replace(',', ''))
                                    if 100000 <= old_total <= 110000:  # Faixa esperada
                                        lines[i + 1] = re.sub(
                                            r'\d{1,3}(?:,\d{3})+',
                                            f"{new_total:,}",
                                            lines[i + 1]
                                        )
                                        changes_made = True
                                        log(f"  ✅ Atualizado Total em {file_path.name}: {old_total:,} -> {new_total:,}")
                    content = '\n'.join(lines)
            
            if changes_made and content != original_content:
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(content)
                updated_files.append(file_path)
                log(f"  💾 Arquivo atualizado: {file_path.name}")
        
        return len(updated_files) > 0
        
    except Exception as e:
        log(f"❌ Erro ao atualizar arquivos: {e}")
        return False

def run_holders_script():
    """Executa o script de atualização de holders, fees e UTXOs"""
    try:
        log("🚀 Executando script de holders, fees e UTXOs...")
        
        script_path = SCRIPT_DIR / 'update_holders_and_fees.py'
        
        if not script_path.exists():
            log(f"❌ Script não encontrado: {script_path}")
            return False
        
        result = subprocess.run(
            [sys.executable, str(script_path)],
            cwd=str(PROJECT_ROOT),
            capture_output=True,
            text=True,
            timeout=3600  # 1 hora de timeout
        )
        
        if result.returncode == 0:
            log("✅ Script de holders executado com sucesso")
            return True
        else:
            log(f"❌ Erro ao executar script: {result.stderr}")
            return False
            
    except subprocess.TimeoutExpired:
        log("❌ Script excedeu o timeout de 1 hora")
        return False
    except Exception as e:
        log(f"❌ Erro ao executar script: {e}")
        return False

def git_commit_and_push():
    """Faz commit e push das mudanças para o GitHub"""
    try:
        log("📤 Preparando commit e push para GitHub...")
        
        # Verificar se há mudanças
        result = subprocess.run(
            ['git', 'status', '--porcelain'],
            cwd=str(PROJECT_ROOT),
            capture_output=True,
            text=True
        )
        
        if not result.stdout.strip():
            log("ℹ️ Nenhuma mudança para commitar")
            return True
        
        log(f"📋 Mudanças detectadas:\n{result.stdout}")
        
        # Adicionar todos os arquivos modificados
        subprocess.run(
            ['git', 'add', '-A'],
            cwd=str(PROJECT_ROOT),
            check=True
        )
        
        # Fazer commit
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        commit_message = f"🤖 Auto-update: {timestamp}"
        
        result = subprocess.run(
            ['git', 'commit', '-m', commit_message],
            cwd=str(PROJECT_ROOT),
            capture_output=True,
            text=True
        )
        
        if result.returncode == 0:
            log("✅ Commit criado com sucesso")
        else:
            log(f"⚠️ Aviso no commit: {result.stderr}")
        
        # Push para GitHub
        result = subprocess.run(
            ['git', 'push', 'origin', 'main'],
            cwd=str(PROJECT_ROOT),
            capture_output=True,
            text=True,
            timeout=60
        )
        
        if result.returncode == 0:
            log("✅ Push para GitHub realizado com sucesso")
            return True
        else:
            log(f"❌ Erro no push: {result.stderr}")
            return False
            
    except subprocess.TimeoutExpired:
        log("❌ Push excedeu o timeout")
        return False
    except Exception as e:
        log(f"❌ Erro no git commit/push: {e}")
        return False

def get_last_known_values():
    """Retorna últimos valores conhecidos de Solana e Stacks dos arquivos"""
    solana = None
    stacks = None
    
    try:
        # Ler do holders/page.tsx
        holders_file = PROJECT_ROOT / 'app' / 'holders' / 'page.tsx'
        if holders_file.exists():
            with open(holders_file, 'r', encoding='utf-8') as f:
                content = f.read()
                
            # Buscar Solana: const [solanaHolders, setSolanaHolders] = useState<number>(10483)
            match = re.search(r'const\s+\[\s*solanaHolders[^)]*useState<number>\((\d+)\)', content)
            if match:
                solana = int(match.group(1))
            else:
                # Tentar formato alternativo
                match = re.search(r'solanaHolders.*useState<number>\((\d+)\)', content)
                if match:
                    solana = int(match.group(1))
            
            # Buscar Stacks: const [stacksHolders, setStacksHolders] = useState<number>(305)
            match = re.search(r'const\s+\[\s*stacksHolders[^)]*useState<number>\((\d+)\)', content)
            if match:
                stacks = int(match.group(1))
            else:
                # Tentar formato alternativo
                match = re.search(r'stacksHolders.*useState<number>\((\d+)\)', content)
                if match:
                    stacks = int(match.group(1))
    except Exception as e:
        log(f"⚠️ Erro ao ler valores anteriores: {e}")
    
    return solana, stacks

def main():
    """Função principal"""
    log("="*80)
    log("🤖 INICIANDO ATUALIZAÇÃO AUTOMATIZADA")
    log("="*80)
    
    success_count = 0
    total_steps = 4
    
    # 1. Executar script de holders, fees e UTXOs
    log("")
    if run_holders_script():
        success_count += 1
    else:
        log("⚠️ Continuando mesmo com falha no script de holders...")
    
    # 2. Extrair holders da Solana
    log("")
    solana_holders = get_solana_holders()
    if not solana_holders:
        log("⚠️ Solana holders não encontrado no arquivo externo")
        log("   Usando último valor conhecido...")
        solana_holders, _ = get_last_known_values()
        if solana_holders:
            log(f"   Último valor conhecido: {solana_holders:,}")
        else:
            log("   ⚠️ Nenhum valor anterior encontrado. Solana não será atualizada.")
    else:
        success_count += 1
    
    # 3. Extrair holders da Stacks
    log("")
    stacks_holders = get_stacks_holders()
    if not stacks_holders:
        log("⚠️ Stacks holders não encontrado no arquivo externo")
        log("   Usando último valor conhecido...")
        _, stacks_holders = get_last_known_values()
        if stacks_holders:
            log(f"   Último valor conhecido: {stacks_holders}")
        else:
            log("   ⚠️ Nenhum valor anterior encontrado. Stacks não será atualizada.")
    else:
        success_count += 1
    
    # 4. Atualizar valores nos arquivos (só se tivermos valores)
    log("")
    if solana_holders or stacks_holders:
        if update_holders_values(solana_holders, stacks_holders):
            success_count += 1
    else:
        log("⚠️ Nenhum valor para atualizar (Solana e Stacks)")
    
    # 5. Commit e push (sempre tenta)
    log("")
    if git_commit_and_push():
        success_count += 1
        total_steps = 5
    
    # Resumo final
    log("")
    log("="*80)
    log(f"📊 RESUMO: {success_count}/{total_steps} etapas concluídas com sucesso")
    log("="*80)
    
    if success_count >= 2:  # Pelo menos 2 de 5 etapas (Bitcoin + Git)
        log("✅ Atualização concluída!")
        log("")
        log("ℹ️  NOTA: Solana e Stacks são atualizados via arquivo externo (GitHub).")
        log("   Bitcoin é sempre atualizado via script próprio.")
        log("   Para atualizar Solana/Stacks: edite data/external_holders.json no GitHub.")
        return 0
    else:
        log("⚠️ Algumas etapas críticas falharam")
        return 1

if __name__ == "__main__":
    sys.exit(main())

