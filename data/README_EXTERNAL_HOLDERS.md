# 📝 Arquivo de Holders Externos

Este arquivo (`external_holders.json`) permite que você atualize os valores de holders da Solana e Stacks **remotamente** via interface web do GitHub, sem precisar acessar o servidor.

## 📋 Como Usar

### Opção 1: Atualizar via Interface Web do GitHub (Recomendado)

1. Acesse o repositório no GitHub
2. Vá para o arquivo: `data/external_holders.json`
3. Clique em "Edit" (lápis)
4. Atualize os valores:
   ```json
   {
     "solana": {
       "holders": 10524,  ← Atualize aqui
       "last_updated": "2026-01-13T20:30:00Z",
       "source": "manual"
     },
     "stacks": {
       "holders": 305,  ← Atualize aqui
       "last_updated": "2026-01-13T20:30:00Z",
       "source": "manual"
     }
   }
   ```
5. Clique em "Commit changes"
6. O script automatizado irá ler esses valores na próxima execução (de hora em hora)

### Opção 2: Atualizar via App GitHub Mobile

1. Abra o app GitHub no celular
2. Navegue até o arquivo `data/external_holders.json`
3. Toque em "Edit"
4. Atualize os valores e salve
5. O script irá pegar os novos valores automaticamente

## ⚙️ Como Funciona

O script `automated_update.py`:
1. **Primeiro** tenta ler do arquivo `data/external_holders.json`
2. Se encontrar valores válidos, usa eles (mais confiável)
3. Se não encontrar, tenta fazer scraping (pode falhar)

## ✅ Vantagens

- ✅ Atualização rápida e fácil via web
- ✅ Funciona de qualquer lugar (celular, tablet, etc)
- ✅ Não precisa acessar o servidor
- ✅ Valores são commitados no Git (histórico)
- ✅ Mais confiável que scraping

## 📝 Formato do Arquivo

```json
{
  "solana": {
    "holders": 10524,
    "last_updated": "2026-01-13T20:30:00Z",
    "source": "manual"
  },
  "stacks": {
    "holders": 305,
    "last_updated": "2026-01-13T20:30:00Z",
    "source": "manual"
  }
}
```

### Campos

- `holders`: Número de holders (inteiro)
- `last_updated`: Data/hora da última atualização (ISO 8601)
- `source`: Fonte dos dados (geralmente "manual")

## 🔄 Frequência de Atualização

O script roda **de hora em hora** via cron, então:
- Atualize o arquivo quando tiver novos valores
- O script pegará os valores na próxima execução (máximo 1 hora de atraso)


