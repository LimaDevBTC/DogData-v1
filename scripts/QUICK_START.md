# 🚀 Guia Rápido - Atualização Automatizada

## ⚡ Setup Rápido (3 passos)

### 1. Instalar dependências
```bash
cd /home/bitmax/Projects/bitcoin-fullstack/DogData-v1
bash scripts/install_dependencies.sh
```

Se falhar, instale manualmente:
```bash
sudo pip3 install beautifulsoup4 requests
```

### 2. Configurar cron (executa de hora em hora)
```bash
bash scripts/setup_cron.sh
```

### 3. Pronto! 🎉

O script irá rodar automaticamente de hora em hora e:
- ✅ Atualizar holders do Bitcoin (via script)
- ✅ Extrair holders da Solana (via scraping)
- ✅ Extrair holders da Stacks (via scraping)
- ✅ Atualizar arquivos do projeto
- ✅ Fazer commit e push para GitHub

## 📊 Verificar se está funcionando

### Ver logs em tempo real:
```bash
tail -f logs/automated_update.log
```

### Verificar cron job:
```bash
crontab -l
```

### Testar manualmente:
```bash
python3 scripts/automated_update.py
```

## 🛠️ Comandos Úteis

### Ver últimos logs:
```bash
tail -20 logs/automated_update.log
```

### Remover cron job:
```bash
crontab -l | grep -v 'automated_update.py' | crontab -
```

### Verificar dependências:
```bash
bash scripts/check_dependencies.sh
```

## ⚠️ Importante

- O script precisa que o Bitcoin Core esteja rodando
- O script precisa de acesso ao GitHub (credenciais configuradas)
- Os logs são salvos em `logs/automated_update.log`
- O script roda de hora em hora automaticamente

## 📝 Arquivos Criados

- `scripts/automated_update.py` - Script principal
- `scripts/setup_cron.sh` - Configuração do cron
- `scripts/check_dependencies.sh` - Verificar dependências
- `scripts/install_dependencies.sh` - Instalar dependências
- `scripts/README_AUTOMATED_UPDATE.md` - Documentação completa
- `logs/automated_update.log` - Logs (criado automaticamente)

