# 🤖 Script de Atualização Automatizada

Este script automatiza a atualização completa dos dados do site:

1. **Executa** o script `update_holders_and_fees.py` (Bitcoin holders, fees, UTXOs)
2. **Extrai** holders da Solana via scraping (solscan.io)
3. **Extrai** holders da Stacks via scraping (stxtools.io)
4. **Atualiza** os arquivos do projeto com os novos valores
5. **Faz commit e push** para o GitHub automaticamente

## 📋 Pré-requisitos

### Dependências Python

```bash
pip3 install --user beautifulsoup4 requests
```

Ou com sudo (se necessário):
```bash
sudo pip3 install beautifulsoup4 requests
```

### Verificar dependências

```bash
bash scripts/check_dependencies.sh
```

## 🚀 Configuração do Cron

### Opção 1: Script automático (recomendado)

```bash
bash scripts/setup_cron.sh
```

Este script irá:
- Verificar se o script existe
- Adicionar o cron job para executar de hora em hora
- Configurar logs em `logs/automated_update.log`

### Opção 2: Manual

Edite o crontab:
```bash
crontab -e
```

Adicione a linha:
```
0 * * * * cd /home/bitmax/Projects/bitcoin-fullstack/DogData-v1 && /usr/bin/python3 scripts/automated_update.py >> logs/automated_update.log 2>&1
```

## 📊 Execução Manual

Para testar o script manualmente:

```bash
cd /home/bitmax/Projects/bitcoin-fullstack/DogData-v1
python3 scripts/automated_update.py
```

## 📝 Logs

Os logs são salvos em:
- `logs/automated_update.log` (quando executado via cron)
- Saída no terminal (quando executado manualmente)

Para acompanhar os logs em tempo real:
```bash
tail -f logs/automated_update.log
```

## 🔍 Verificar Cron Job

Para ver se o cron está configurado:
```bash
crontab -l
```

## 🗑️ Remover Cron Job

Para remover o cron job:
```bash
crontab -l | grep -v 'automated_update.py' | crontab -
```

## ⚙️ Como Funciona

### 1. Execução do Script de Holders
- Roda `update_holders_and_fees.py`
- Atualiza `data/dog_holders.json` e `public/data/dog_holders.json`
- Processa holders do Bitcoin, fees e UTXOs

### 2. Scraping da Solana
- Acessa: https://solscan.io/token/dog1viwbb2vWDpER5FrJ4YFG6q6XuyFohUe9TXN65u#holders
- Extrai o número de holders do elemento: `<div class="not-italic font-normal text-neutral7 text-[14px] leading-[24px]">10,483</div>`

### 3. Scraping da Stacks
- Acessa: https://stxtools.io/tokens/SP14NS8MVBRHXMM96BQY0727AJ59SWPV7RMHC0NCG.pontis-bridge-DOG
- Extrai o número de holders do elemento: `<p class="chakra-text css-16kdow3">305.00</p>`

### 4. Atualização dos Arquivos
Atualiza os seguintes arquivos:
- `app/page.tsx` - Valores de Solana, Stacks e Total
- `app/holders/page.tsx` - Valores hardcoded de Solana e Stacks

### 5. Git Commit e Push
- Adiciona todos os arquivos modificados
- Cria commit com timestamp
- Faz push para `origin/main`

## ⚠️ Notas Importantes

1. **Bitcoin Holders**: Sempre vem do JSON (dinâmico, não hardcoded)
2. **Solana e Stacks Holders**: Valores hardcoded (únicos valores fixos)
3. **Total**: Calculado automaticamente (Bitcoin + Solana + Stacks)
4. **Timeout**: O script de holders tem timeout de 1 hora
5. **Falhas**: O script continua mesmo se alguma etapa falhar (exceto git push)

## 🐛 Troubleshooting

### Erro: "ModuleNotFoundError: No module named 'bs4'"
```bash
pip3 install --user beautifulsoup4
```

### Erro: "Connection refused" (Bitcoin Core)
Certifique-se de que o Bitcoin Core está rodando:
```bash
bash manage_services.sh start_bitcoin
```

### Erro no scraping
- As páginas podem ter mudado de estrutura
- Verifique os logs para ver o erro específico
- O script tem fallbacks, mas pode precisar de ajustes

### Git push falha
- Verifique se há credenciais configuradas
- Verifique se há mudanças para commitar
- Verifique conexão com GitHub

## 📅 Frequência

O cron está configurado para rodar **de hora em hora** (`0 * * * *`).

Para mudar a frequência, edite o crontab:
- A cada 30 minutos: `*/30 * * * *`
- A cada 2 horas: `0 */2 * * *`
- Diariamente às 00:00: `0 0 * * *`


