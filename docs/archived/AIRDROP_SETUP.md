# 🎁 Setup do Dossiê do Airdrop - Guia Rápido

## 📦 Arquivos Criados

### Scripts Python:
1. **`scripts/trace_airdrop_distribution.py`** - Rastreia distribuição do airdrop
2. **`scripts/analyze_airdrop.py`** - Gera analytics comparando com holders atuais
3. ~~`scripts/airdrop_analyzer.py`~~ - (substituído pelos acima)

### Documentação:
- **`docs/airdrop-dossie-workflow.md`** - Workflow completo e detalhado

### Dados Gerados:
- **`data/airdrop_recipients.json`** - Lista de 79k recipients (a gerar)
- **`data/airdrop_analytics.json`** - Analytics dinâmicos (a gerar)

---

## 🚀 Comandos Rápidos

### Setup Inicial (uma vez):
```bash
# Rastrear distribuição do airdrop (~10-30min)
python3 scripts/trace_airdrop_distribution.py
```

### Atualização Regular (automatizar):
```bash
# 1. Atualizar holders
cd /home/bitmax/Projects/bitcoin-fullstack/ord
python3 efficient_dog_extractor.py

# 2. Atualizar analytics do airdrop
cd /home/bitmax/Projects/bitcoin-fullstack/DogData-v1
python3 scripts/analyze_airdrop.py
```

---

## 📊 Próximos Passos

- [ ] Testar `trace_airdrop_distribution.py` (pode precisar ajustes no comando ord)
- [ ] Ajustar comandos do ord CLI se necessário
- [ ] Executar setup inicial para gerar `airdrop_recipients.json`
- [ ] Criar endpoints da API no backend
- [ ] Conectar frontend com API
- [ ] Automatizar com cron job ou systemd

---

## 💡 Estratégia

**O dossiê do airdrop funciona em 2 etapas:**

1. **Rastreamento** (uma vez): Mapeia TODOS os 79k endereços que receberam DOG
2. **Analytics** (periódico): Compara com holders atuais e gera estatísticas

**Isso mantém o dossiê sempre atualizado com dados reais!** 🎯
