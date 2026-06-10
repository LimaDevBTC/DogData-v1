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
                    # No holders/page.tsx: useState<number>(10754) // Hardcoded
                    if 'holders/page.tsx' in str(file_path) and 'useState<number>' in line and 'Solana' in line and 'Hardcoded' in line:
                        match = re.search(r'useState<number>\((\d+)\)', line)
                        if match:
                            old_val = int(match.group(1))
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

def run_price_history_script():
    """Estende o histórico de preços (Gate.io) até hoje — incremental.

    Roda ANTES do holders porque update_holders_and_fees.py usa price_history
    para o cost basis (realized cap / MVRV / supply-in-profit). Sem isso, o
    histórico defasa e o cost basis dos UTXOs recentes fica errado.
    """
    try:
        log("💰 Atualizando histórico de preços (price_history)...")
        script_path = SCRIPT_DIR / 'build_price_history.py'
        if not script_path.exists():
            log(f"❌ Script não encontrado: {script_path}")
            return False
        result = subprocess.run(
            [sys.executable, str(script_path)],
            cwd=str(PROJECT_ROOT),
            capture_output=True,
            text=True,
            timeout=600,
        )
        if result.returncode == 0:
            log("✅ price_history atualizado")
            return True
        log(f"❌ Erro ao atualizar price_history: {result.stderr}")
        return False
    except subprocess.TimeoutExpired:
        log("❌ build_price_history excedeu o timeout")
        return False
    except Exception as e:
        log(f"❌ Erro ao atualizar price_history: {e}")
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

def clean_rebase_state():
    """Remove estado de rebase travado para pull/push funcionarem."""
    rebase_merge = PROJECT_ROOT / '.git' / 'rebase-merge'
    rebase_apply = PROJECT_ROOT / '.git' / 'rebase-apply'
    if rebase_merge.exists() or rebase_apply.exists():
        try:
            subprocess.run(
                ['git', 'rebase', '--abort'],
                cwd=str(PROJECT_ROOT),
                capture_output=True,
                text=True,
                timeout=10
            )
            log("   ↩️ Estado de rebase travado removido (rebase --abort).")
        except Exception:
            pass
        import shutil
        if rebase_merge.exists():
            try:
                shutil.rmtree(rebase_merge)
                log("   ↩️ Removido .git/rebase-merge.")
            except Exception:
                pass
        if rebase_apply.exists():
            try:
                shutil.rmtree(rebase_apply)
                log("   ↩️ Removido .git/rebase-apply.")
            except Exception:
                pass

def git_commit_and_push():
    """Faz commit e push das mudanças para o GitHub"""
    try:
        log("📤 Preparando commit e push para GitHub...")
        clean_rebase_state()
        
        # Verificar se há mudanças locais primeiro
        status_result = subprocess.run(
            ['git', 'status', '--porcelain'],
            cwd=str(PROJECT_ROOT),
            capture_output=True,
            text=True
        )
        
        has_local_changes = bool(status_result.stdout.strip())
        
        # Se há mudanças locais, commitar primeiro
        if has_local_changes:
            log(f"📋 Mudanças detectadas:\n{status_result.stdout}")
            
            # Adicionar todos os arquivos modificados
            subprocess.run(
                ['git', 'add', '-A'],
                cwd=str(PROJECT_ROOT),
                check=True
            )
            
            # Fazer commit
            timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            commit_message = f"🤖 Auto-update: {timestamp}"
            
            commit_result = subprocess.run(
                ['git', 'commit', '-m', commit_message],
                cwd=str(PROJECT_ROOT),
                capture_output=True,
                text=True
            )
            
            if commit_result.returncode == 0:
                log("✅ Commit criado com sucesso")
            else:
                log(f"⚠️ Aviso no commit: {commit_result.stderr}")
                if "nothing to commit" in commit_result.stderr.lower():
                    log("ℹ️ Nenhuma mudança para commitar (já estava commitado)")
                else:
                    return False
        
        # Agora fazer pull para sincronizar com o remoto (sempre merge, nunca rebase para não travar)
        log("🔄 Sincronizando com o repositório remoto...")
        pull_result = subprocess.run(
            ['git', 'pull', 'origin', 'main', '--no-rebase', '--no-edit'],
            cwd=str(PROJECT_ROOT),
            capture_output=True,
            text=True,
            timeout=300
        )
        if pull_result.returncode != 0:
            log(f"❌ Erro no pull: {pull_result.stderr}")
            return False
        log("✅ Pull realizado com sucesso (merge)")
        
        # Verificar se há mudanças após o pull
        status_result = subprocess.run(
            ['git', 'status', '--porcelain'],
            cwd=str(PROJECT_ROOT),
            capture_output=True,
            text=True
        )
        
        if not status_result.stdout.strip() and not has_local_changes:
            log("ℹ️ Nenhuma mudança para commitar")
            return True
        
        # Se ainda há mudanças após pull, commitar novamente
        if status_result.stdout.strip():
            log(f"📋 Mudanças após pull:\n{status_result.stdout}")
            subprocess.run(
                ['git', 'add', '-A'],
                cwd=str(PROJECT_ROOT),
                check=True
            )
            
            timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            commit_message = f"🤖 Auto-update: {timestamp}"
            
            commit_result = subprocess.run(
                ['git', 'commit', '-m', commit_message],
                cwd=str(PROJECT_ROOT),
                capture_output=True,
                text=True
            )
            
            if commit_result.returncode == 0:
                log("✅ Commit criado com sucesso (após pull)")
            else:
                log(f"⚠️ Aviso no commit: {commit_result.stderr}")
        
        # Push para GitHub
        log("📤 Fazendo push para GitHub...")
        push_result = subprocess.run(
            ['git', 'push', 'origin', 'main'],
            cwd=str(PROJECT_ROOT),
            capture_output=True,
            text=True,
            timeout=60
        )
        
        if push_result.returncode == 0:
            log("✅ Push para GitHub realizado com sucesso")
            return True
        else:
            log(f"❌ Erro no push: {push_result.stderr}")
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
    total_steps = 5

    # 0. Atualizar histórico de preços (antes do holders — cost basis depende dele)
    log("")
    if run_price_history_script():
        success_count += 1
    else:
        log("⚠️ Continuando mesmo com falha no price_history...")

    # 1. Executar script de holders, fees e UTXOs
    log("")
    if run_holders_script():
        success_count += 1
    else:
        log("⚠️ Continuando mesmo com falha no script de holders...")
    
    # 2. Extrair holders da Solana (apenas external_holders.json)
    log("")
    solana_holders = get_solana_holders()
    if not solana_holders:
        log("⚠️ Solana holders não encontrado no external_holders.json — não será atualizada")
    else:
        success_count += 1
    
    # 3. Extrair holders da Stacks (apenas external_holders.json)
    log("")
    stacks_holders = get_stacks_holders()
    if not stacks_holders:
        log("⚠️ Stacks holders não encontrado no external_holders.json — não será atualizada")
    else:
        success_count += 1
    
    # 4. Atualizar valores nos arquivos (só se tivermos valores)
    log("")
    if solana_holders or stacks_holders:
        if update_holders_values(solana_holders, stacks_holders):
            success_count += 1
    else:
        log("⚠️ Nenhum valor para atualizar (Solana e Stacks)")
    
    # 5. Regenerar airdrop analytics (cruzar holders atuais com recipients)
    log("")
    log("📊 Regenerando airdrop analytics...")
    try:
        airdrop_script = SCRIPT_DIR / 'update_airdrop_analytics.py'
        if airdrop_script.exists():
            airdrop_result = subprocess.run(
                [sys.executable, str(airdrop_script)],
                cwd=str(PROJECT_ROOT),
                capture_output=True,
                text=True,
                timeout=300
            )
            if airdrop_result.returncode == 0:
                log("✅ Airdrop analytics regenerado com sucesso")
                if airdrop_result.stdout:
                    for line in airdrop_result.stdout.strip().split('\n'):
                        log(f"   {line}")
            else:
                log(f"⚠️ Erro no airdrop analytics: {airdrop_result.stderr[:200] if airdrop_result.stderr else 'unknown'}")
        else:
            log(f"⚠️ Script não encontrado: {airdrop_script}")
    except subprocess.TimeoutExpired:
        log("⚠️ Airdrop analytics timeout (non-fatal)")
    except Exception as e:
        log(f"⚠️ Airdrop analytics error (non-fatal): {e}")

    # 6. Análise forense comportamental (atualiza forensic_behavioral_analysis.json +
    #    acumula série temporal em forensic_history.json + snapshot diário em snapshots/)
    log("")
    log("🔬 Executando análise forense comportamental...")
    try:
        forensic_script = SCRIPT_DIR / 'update_forensic_analysis.py'
        if forensic_script.exists():
            forensic_result = subprocess.run(
                [sys.executable, str(forensic_script)],
                cwd=str(PROJECT_ROOT),
                capture_output=True,
                text=True,
                timeout=600  # análise de 75k perfis pode levar até 10 minutos
            )
            if forensic_result.returncode == 0:
                log("✅ Análise forense atualizada com sucesso")
                if forensic_result.stdout:
                    for line in forensic_result.stdout.strip().split('\n'):
                        log(f"   {line}")
            else:
                log(f"⚠️ Erro na análise forense: {forensic_result.stderr[:300] if forensic_result.stderr else 'unknown'}")
                if forensic_result.stdout:
                    for line in forensic_result.stdout.strip().split('\n')[-5:]:
                        log(f"   {line}")
        else:
            log(f"⚠️ Script não encontrado: {forensic_script}")
    except subprocess.TimeoutExpired:
        log("⚠️ Análise forense timeout (non-fatal) — será tentada na próxima hora")
    except Exception as e:
        log(f"⚠️ Análise forense error (non-fatal): {e}")

    # 7. Commit e push (sempre tenta) — feito ANTES dos steps lentos pra
    #    publicar holders+forensic+airdrop on-time (~HH:26).
    log("")
    if git_commit_and_push():
        success_count += 1
        total_steps = 6

    # 8. "Possible Lost DOG" — auto-incremental, ~6 min via scantxoutset local.
    #    Roda DEPOIS do git push pra não atrasar a publicação dos dados horários.
    #    O output entra no commit da próxima hora (lost cohort muda muito devagar,
    #    ~2 wallets/h no máximo, então 1h de defasagem é irrelevante).
    log("")
    log("💎 Atualizando análise de Possible Lost DOG (diamond paws)…")
    try:
        lost_script = SCRIPT_DIR / 'update_diamond_paws_lost.py'
        if lost_script.exists():
            lost_result = subprocess.run(
                [sys.executable, str(lost_script)],
                cwd=str(PROJECT_ROOT),
                capture_output=True,
                text=True,
                timeout=900  # local-node scantxoutset ~6 min for 6k addrs
            )
            if lost_result.returncode == 0:
                log("✅ Possible Lost DOG atualizado")
                if lost_result.stdout:
                    for line in lost_result.stdout.strip().split('\n')[-5:]:
                        log(f"   {line}")
            else:
                log(f"⚠️ Erro no Lost DOG (non-fatal): {lost_result.stderr[:300] if lost_result.stderr else 'unknown'}")
        else:
            log(f"⚠️ Script não encontrado: {lost_script}")
    except subprocess.TimeoutExpired:
        log("⚠️ Lost DOG timeout (non-fatal) — será tentado na próxima hora")
    except Exception as e:
        log(f"⚠️ Lost DOG error (non-fatal): {e}")

    # 9. Coletar métricas históricas para Supabase
    log("")
    log("📊 Coletando métricas históricas para Supabase...")
    try:
        collector_result = subprocess.run(
            ['npx', 'tsx', str(PROJECT_ROOT / 'scripts' / 'collect_metrics_history.ts')],
            cwd=str(PROJECT_ROOT),
            capture_output=True,
            text=True,
            timeout=120
        )
        if collector_result.returncode == 0:
            log("✅ Métricas históricas coletadas com sucesso")
            if collector_result.stdout:
                for line in collector_result.stdout.strip().split('\n'):
                    log(f"   {line}")
        else:
            log(f"⚠️ Collector warning: {collector_result.stderr[:200] if collector_result.stderr else 'unknown error'}")
    except subprocess.TimeoutExpired:
        log("⚠️ Collector timeout (non-fatal)")
    except Exception as e:
        log(f"⚠️ Collector error (non-fatal): {e}")

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

