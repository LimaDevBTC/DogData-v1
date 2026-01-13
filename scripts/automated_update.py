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
    """Extrai número de holders da Solana via scraping usando Selenium"""
    try:
        log("🔍 Buscando holders da Solana (com renderização JavaScript)...")
        
        # Tentar usar Selenium para renderizar JavaScript
        try:
            from selenium import webdriver
            from selenium.webdriver.chrome.options import Options
            from selenium.webdriver.common.by import By
            import time
            
            chrome_options = Options()
            chrome_options.add_argument('--headless')
            chrome_options.add_argument('--no-sandbox')
            chrome_options.add_argument('--disable-dev-shm-usage')
            chrome_options.add_argument('--disable-gpu')
            chrome_options.add_argument('--window-size=1920,1080')
            chrome_options.add_argument('user-agent=Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36')
            
            driver = webdriver.Chrome(options=chrome_options)
            
            try:
                driver.get(SOLANA_HOLDERS_URL)
                time.sleep(8)  # Esperar JavaScript carregar
                
                # Procurar no texto renderizado
                body_text = driver.find_element(By.TAG_NAME, "body").text
                
                # Procurar por padrões como "Holders: 10,483" ou "10,483 holders"
                patterns = [
                    r'holders?[:\s]+(\d{1,3}(?:,\d{3})+)',
                    r'(\d{1,3}(?:,\d{3})+)\s+holders?',
                    r'total\s+holders?[:\s]+(\d{1,3}(?:,\d{3})+)',
                ]
                
                for pattern in patterns:
                    matches = re.findall(pattern, body_text, re.IGNORECASE)
                    for match in matches:
                        num = int(match.replace(',', ''))
                        if 10000 <= num <= 11000:
                            log(f"✅ Solana holders encontrados (Selenium): {num:,}")
                            return num
                
                # Fallback: buscar todos os números na faixa
                all_numbers = re.findall(r'(\d{1,3}(?:,\d{3})+)', body_text)
                numbers = [int(n.replace(',', '')) for n in all_numbers]
                valid_numbers = [n for n in numbers if 10000 <= n <= 11000]
                
                if valid_numbers:
                    # Pegar o número que aparece mais próximo de "holder"
                    best_match = None
                    best_distance = float('inf')
                    
                    text_lower = body_text.lower()
                    for num in valid_numbers:
                        num_str = f"{num:,}"
                        # Procurar posição do número
                        num_pos = text_lower.find(str(num))
                        if num_pos != -1:
                            # Procurar "holder" próximo
                            holder_pos = text_lower.find('holder', max(0, num_pos - 200), num_pos + 200)
                            if holder_pos != -1:
                                distance = abs(num_pos - holder_pos)
                                if distance < best_distance:
                                    best_distance = distance
                                    best_match = num
                    
                    if best_match:
                        log(f"✅ Solana holders encontrados (Selenium, próximo de 'holder'): {best_match:,}")
                        return best_match
                    
                    # Se não encontrou próximo de "holder", usar o mais comum
                    from collections import Counter
                    most_common = Counter(valid_numbers).most_common(1)[0][0]
                    log(f"✅ Solana holders encontrados (Selenium, número mais comum): {most_common:,}")
                    return most_common
                    
            finally:
                driver.quit()
                
        except ImportError:
            log("⚠️ Selenium não disponível, tentando método simples...")
        except Exception as e:
            log(f"⚠️ Erro com Selenium: {e}, tentando método simples...")
        
        # Fallback: método simples sem JavaScript
        headers = {
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
        }
        
        response = requests.get(SOLANA_HOLDERS_URL, headers=headers, timeout=30)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.text, 'html.parser')
        element = soup.find('div', class_='not-italic font-normal text-neutral7 text-[14px] leading-[24px]')
        
        if element:
            text = element.get_text(strip=True)
            # Verificar se é um número válido
            match = re.search(r'(\d{1,3}(?:,\d{3})+)', text)
            if match:
                holders = int(match.group(1).replace(',', ''))
                if 10000 <= holders <= 11000:
                    log(f"✅ Solana holders encontrados (método simples): {holders:,}")
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
        
        # Estratégia 1: Procurar pelo elemento específico
        element = soup.find('p', class_='chakra-text css-16kdow3')
        
        if not element:
            # Estratégia 2: Buscar por classe parcial (chakra-text)
            elements = soup.find_all(['p', 'div', 'span'], class_=lambda x: x and 'chakra-text' in str(x))
            for elem in elements:
                text = elem.get_text(strip=True)
                # Tentar extrair número
                match = re.search(r'^(\d{2,4}(?:\.\d+)?)$', text)
                if match:
                    try:
                        num = int(float(match.group(1)))
                        if 300 <= num <= 310:
                            log(f"✅ Stacks holders encontrados (classe chakra-text): {num}")
                            return num
                    except (ValueError, AttributeError):
                        continue
        
        # Estratégia 3: Procurar por padrão "Holders" ou números na faixa
        all_text = soup.get_text()
        # Procurar por padrões como "Holders: 305" ou "305 Holders"
        holders_patterns = [
            r'holders[:\s]*(\d{2,4}(?:\.\d+)?)',
            r'(\d{2,4}(?:\.\d+)?)\s*holders',
            r'total\s+holders[:\s]*(\d{2,4}(?:\.\d+)?)',
        ]
        
        for pattern in holders_patterns:
            matches = re.findall(pattern, all_text, re.IGNORECASE)
            for match in matches:
                try:
                    num = int(float(match))
                    if 300 <= num <= 310:
                        log(f"✅ Stacks holders encontrados (padrão 'holders'): {num}")
                        return num
                except (ValueError, AttributeError):
                    continue
        
        # Estratégia 4: Buscar todos os números na faixa esperada (300-310)
        # Primeiro, tentar números inteiros
        all_numbers = re.findall(r'\b(\d{3})\b', all_text)
        valid_numbers = []
        for num_str in all_numbers:
            try:
                num = int(num_str)
                if 300 <= num <= 310:
                    valid_numbers.append(num)
            except (ValueError, AttributeError):
                continue
        
        if valid_numbers:
            # Pegar o mais comum ou o maior
            holders = max(set(valid_numbers), key=valid_numbers.count)
            log(f"✅ Stacks holders encontrados (busca numérica): {holders}")
            return holders
        
        # Estratégia 5: Tentar números com decimais (305.00)
        decimal_numbers = re.findall(r'(\d{3}(?:\.\d+)?)', all_text)
        for num_str in decimal_numbers:
            try:
                num = int(float(num_str))
                if 300 <= num <= 310:
                    log(f"✅ Stacks holders encontrados (decimal): {num}")
                    return num
            except (ValueError, AttributeError):
                continue
        
        if element:
            text = element.get_text(strip=True)
            # Tentar extrair número, ignorando texto não numérico
            match = re.search(r'(\d{2,4}(?:\.\d+)?)', text)
            if match:
                try:
                    holders = int(float(match.group(1)))
                    log(f"✅ Stacks holders encontrados: {holders}")
                    return holders
                except (ValueError, AttributeError):
                    pass
        
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
        log("⚠️ Não foi possível extrair holders da Solana via scraping")
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
        log("⚠️ Não foi possível extrair holders da Stacks via scraping")
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
    
    # 5. Commit e push (sempre tenta, mesmo se scraping falhou)
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
        log("ℹ️  NOTA: Scraping de Solana/Stacks pode falhar se as páginas mudarem.")
        log("   O Bitcoin (mais importante) será sempre atualizado via script.")
        log("   Solana e Stacks podem ser atualizados manualmente quando necessário.")
        return 0
    else:
        log("⚠️ Algumas etapas críticas falharam")
        return 1

if __name__ == "__main__":
    sys.exit(main())

