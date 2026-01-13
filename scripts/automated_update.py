#!/usr/bin/env python3
"""
Script automatizado para atualização completa:
1. Executa update_holders_and_fees.py
2. Extrai holders da Solana e Stacks via scraping
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

try:
    from bs4 import BeautifulSoup
except ImportError:
    print("❌ ERRO: Biblioteca 'beautifulsoup4' não instalada.")
    print("   Execute: pip3 install --user beautifulsoup4")
    print("   Ou: sudo pip3 install beautifulsoup4")
    sys.exit(1)

# Caminhos
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
DATA_DIR = PROJECT_ROOT / 'data'
PUBLIC_DATA_DIR = PROJECT_ROOT / 'public' / 'data'

# URLs para scraping
SOLANA_HOLDERS_URL = "https://solscan.io/token/dog1viwbb2vWDpER5FrJ4YFG6q6XuyFohUe9TXN65u#holders"
STACKS_HOLDERS_URL = "https://stxtools.io/tokens/SP14NS8MVBRHXMM96BQY0727AJ59SWPV7RMHC0NCG.pontis-bridge-DOG"

def log(message):
    """Log com timestamp"""
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    print(f"[{timestamp}] {message}", flush=True)

def get_solana_holders():
    """Extrai número de holders da Solana via scraping"""
    try:
        log("🔍 Buscando holders da Solana...")
        
        # Headers para simular navegador
        headers = {
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
        }
        
        response = requests.get(SOLANA_HOLDERS_URL, headers=headers, timeout=30)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Procurar pelo elemento específico
        element = soup.find('div', class_='not-italic font-normal text-neutral7 text-[14px] leading-[24px]')
        
        if element:
            text = element.get_text(strip=True)
            # Remover vírgulas e converter para int
            holders = int(text.replace(',', ''))
            log(f"✅ Solana holders encontrados: {holders:,}")
            return holders
        else:
            # Fallback: procurar por padrão numérico na página
            log("⚠️ Elemento específico não encontrado, tentando fallback...")
            # Procurar por padrões como "10,483 holders" ou números grandes
            text = soup.get_text()
            # Procurar por padrões numéricos com vírgulas
            matches = re.findall(r'(\d{1,3}(?:,\d{3})+)', text)
            if matches:
                # Pegar o maior número encontrado (provavelmente o total de holders)
                numbers = [int(m.replace(',', '')) for m in matches]
                # Filtrar números razoáveis (entre 1k e 100k)
                valid_numbers = [n for n in numbers if 1000 <= n <= 100000]
                if valid_numbers:
                    holders = max(valid_numbers)
                    log(f"✅ Solana holders encontrados (fallback): {holders:,}")
                    return holders
        
        log("❌ Não foi possível extrair holders da Solana")
        return None
        
    except Exception as e:
        log(f"❌ Erro ao buscar holders da Solana: {e}")
        return None

def get_stacks_holders():
    """Extrai número de holders da Stacks via scraping"""
    try:
        log("🔍 Buscando holders da Stacks...")
        
        # Headers para simular navegador
        headers = {
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Connection': 'keep-alive',
        }
        
        response = requests.get(STACKS_HOLDERS_URL, headers=headers, timeout=30)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Procurar pelo elemento específico
        element = soup.find('p', class_='chakra-text css-16kdow3')
        
        if not element:
            # Tentar buscar por classe parcial
            element = soup.find('p', class_=lambda x: x and 'chakra-text' in str(x))
        
        if not element:
            # Tentar buscar qualquer elemento com texto que pareça número de holders
            all_elements = soup.find_all(['p', 'div', 'span'])
            for elem in all_elements:
                text = elem.get_text(strip=True)
                # Procurar por padrão "305.00" ou similar
                match = re.search(r'(\d{3}(?:\.\d+)?)', text)
                if match:
                    num = int(float(match.group(1)))
                    if 300 <= num <= 310:  # Faixa esperada para Stacks
                        log(f"✅ Stacks holders encontrados (busca alternativa): {num}")
                        return num
        
        if element:
            text = element.get_text(strip=True)
            # Remover pontos e vírgulas, converter para int
            holders = int(float(text.replace(',', '')))
            log(f"✅ Stacks holders encontrados: {holders}")
            return holders
        
        # Fallback: procurar por padrão numérico
        log("⚠️ Elemento específico não encontrado, tentando fallback...")
        text = soup.get_text()
        # Procurar por números próximos de "305" ou padrões similares
        matches = re.findall(r'(\d{3}(?:\.\d+)?)', text)
        if matches:
            # Filtrar números razoáveis (entre 300 e 310)
            numbers = [int(float(m)) for m in matches]
            valid_numbers = [n for n in numbers if 300 <= n <= 310]
            if valid_numbers:
                holders = max(valid_numbers)
                log(f"✅ Stacks holders encontrados (fallback): {holders}")
                return holders
        
        log("❌ Não foi possível extrair holders da Stacks")
        return None
        
    except Exception as e:
        log(f"❌ Erro ao buscar holders da Stacks: {e}")
        import traceback
        log(f"   Detalhes: {traceback.format_exc()}")
        return None

def update_holders_values(solana_holders, stacks_holders):
    """Atualiza valores de Solana e Stacks nos arquivos do projeto"""
    try:
        log("📝 Atualizando valores nos arquivos...")
        
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
                        if 'Solana' in line and 'font-mono' in line:
                            match = re.search(r'>(\d{1,3}(?:,\d{3})?)<', line)
                            if match:
                                old_val = int(match.group(1).replace(',', ''))
                                if 10000 <= old_val <= 11000:  # Faixa esperada
                                    lines[i] = re.sub(
                                        r'>\d{1,3}(?:,\d{3})?<',
                                        f'>{solana_holders:,}<',
                                        line
                                    )
                                    changes_made = True
                                    log(f"  ✅ Atualizado Solana display em {file_path.name}: {old_val:,} -> {solana_holders:,}")
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
                        if 'Stacks' in line and 'font-mono' in line:
                            match = re.search(r'>(\d{2,3})<', line)
                            if match:
                                old_val = int(match.group(1))
                                if 300 <= old_val <= 310:  # Faixa esperada
                                    lines[i] = re.sub(
                                        r'>\d{2,3}<',
                                        f'>{stacks_holders}<',
                                        line
                                    )
                                    changes_made = True
                                    log(f"  ✅ Atualizado Stacks display em {file_path.name}: {old_val} -> {stacks_holders}")
                content = '\n'.join(lines)
            
            # Atualizar total (calcular novo total se ambos valores foram atualizados)
            if solana_holders and stacks_holders:
                # Ler valor atual de Bitcoin do JSON
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
                        bitcoin_holders = 0
                
                new_total = bitcoin_holders + solana_holders + stacks_holders
                
                # Atualizar total no page.tsx (linha com "101,395")
                if 'page.tsx' in str(file_path) and 'holders' not in str(file_path):
                    lines = content.split('\n')
                    for i, line in enumerate(lines):
                        # Procurar linha com o total (formato: "101,395")
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

def main():
    """Função principal"""
    log("="*80)
    log("🤖 INICIANDO ATUALIZAÇÃO AUTOMATIZADA")
    log("="*80)
    
    success_count = 0
    total_steps = 4
    
    # 1. Executar script de holders, fees e UTXOs
    if run_holders_script():
        success_count += 1
    else:
        log("⚠️ Continuando mesmo com falha no script de holders...")
    
    # 2. Extrair holders da Solana
    solana_holders = get_solana_holders()
    if solana_holders:
        success_count += 1
    
    # 3. Extrair holders da Stacks
    stacks_holders = get_stacks_holders()
    if stacks_holders:
        success_count += 1
    
    # 4. Atualizar valores nos arquivos
    if update_holders_values(solana_holders, stacks_holders):
        success_count += 1
    
    # 5. Commit e push
    if git_commit_and_push():
        success_count += 1
        total_steps = 5
    
    # Resumo final
    log("="*80)
    log(f"📊 RESUMO: {success_count}/{total_steps} etapas concluídas com sucesso")
    log("="*80)
    
    if success_count >= 3:  # Pelo menos 3 de 5 etapas
        log("✅ Atualização concluída com sucesso!")
        return 0
    else:
        log("⚠️ Algumas etapas falharam, mas processo continuou")
        return 1

if __name__ == "__main__":
    sys.exit(main())

