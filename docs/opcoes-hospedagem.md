# Opções de Hospedagem para o Projeto DOG Data

## ❌ O que NÃO funciona: Firebase executar scripts que acessam seu PC

**Por quê?**
- Firebase não pode "chamar de volta" seu PC
- Seu PC não tem IP público acessível
- Firebase Functions não roda Bitcoin Core/Ord
- Seria extremamente inseguro

---

## ✅ Opções VIÁVEIS

### **Opção 1: VPS Completo (Servidor na Nuvem)** ⭐⭐⭐⭐⭐

#### Como funciona:
```
[VPS na nuvem - 24/7 online]
  ├── Bitcoin Core (200GB)
  ├── Ord indexador (177GB)  
  ├── Scripts Python
  ├── Backend Node.js (API)
  └── Arquivos JSON
       ↓ (HTTPS)
  [Firebase Hosting - Frontend]
       ↓
  [Usuários]
```

#### Custos mensais:
| Provedor | RAM | Disco | Custo/mês |
|----------|-----|-------|-----------|
| **Hetzner** | 8GB | 160GB | €20 (~R$120) ⭐ |
| **Contabo** | 30GB | 600GB | €15 (~R$90) ⭐⭐ |
| **DigitalOcean** | 8GB | 160GB | $48 (~R$240) |
| **Vultr** | 8GB | 160GB | $48 (~R$240) |

#### Vantagens:
- ✅ Seu PC totalmente livre
- ✅ Servidor 24/7 online
- ✅ IP fixo
- ✅ Escalável
- ✅ Profissional

#### Desvantagens:
- ❌ Custo mensal (R$90-240)
- ❌ Precisa migrar tudo
- ❌ Sincronização inicial lenta (pode levar dias)

#### Melhor para:
- 🎯 Projeto de longo prazo
- 🎯 Muitos usuários
- 🎯 Disponibilidade 24/7

---

### **Opção 2: Híbrido - PC + Cloudflare Tunnel** ⭐⭐⭐⭐

#### Como funciona:
```
[Seu PC - Backend]
  ├── Bitcoin Core
  ├── Ord
  ├── Scripts
  └── API Node.js :3001
       ↓ (túnel criptografado)
  [Cloudflare Tunnel - GRÁTIS]
       ↓ (HTTPS)
  [api.seudominio.com]
       ↓
  [Firebase - Frontend]
       ↓
  [Usuários]
```

#### Custos:
- **Cloudflare Tunnel**: GRÁTIS ✅
- **Domínio**: R$40/ano (opcional, pode usar subdomínio do Cloudflare)
- **Total**: R$0-40/ano

#### Vantagens:
- ✅ **GRÁTIS** ou muito barato
- ✅ Seu PC faz todo o trabalho
- ✅ HTTPS automático
- ✅ Fácil de configurar
- ✅ Sem mexer em roteador/firewall

#### Desvantagens:
- ❌ **PC precisa estar SEMPRE ligado**
- ❌ Se PC cair, site fica offline
- ❌ Depende da sua internet (upload precisa ser bom)
- ❌ Latência pode ser maior

#### Melhor para:
- 🎯 Teste/MVP
- 🎯 Poucos usuários
- 🎯 Baixo orçamento
- 🎯 PC que já fica ligado 24/7

#### Documentação:
Ver: `/docs/setup-cloudflare-tunnel.md`

---

### **Opção 3: Híbrido - PC + Firebase Realtime Database**

#### Como funciona:
```
[Seu PC - Processamento]
  ├── Bitcoin Core
  ├── Ord
  └── Scripts Python
       ↓ (publica dados)
  [Firebase Realtime DB]
       ↓
  [Firebase Hosting - Frontend]
       ↓
  [Usuários]
```

#### Script de sincronização:
```python
# sync_to_firebase.py
import firebase_admin
from firebase_admin import credentials, db
import json

# Inicializar Firebase
cred = credentials.Certificate('serviceAccountKey.json')
firebase_admin.initialize_app(cred, {
    'databaseURL': 'https://dogdata.firebaseio.com'
})

# Ler dados locais
with open('dog_holders.json') as f:
    holders = json.load(f)

with open('dog_transactions.json') as f:
    transactions = json.load(f)

# Enviar para Firebase
ref = db.reference('/')
ref.update({
    'holders': holders,
    'transactions': transactions,
    'last_update': datetime.now().isoformat()
})

print("✅ Dados sincronizados com Firebase!")
```

#### Custos:
- **Firebase Spark (free)**: Até 1GB de dados, 10GB de download/mês
- **Firebase Blaze (pay-as-you-go)**: ~$5-20/mês

#### Vantagens:
- ✅ Frontend e dados na mesma plataforma
- ✅ Tempo real (WebSocket)
- ✅ Offline support
- ✅ Fácil de usar no frontend

#### Desvantagens:
- ❌ PC ainda precisa estar ligado para processar
- ❌ Limite de 1GB no plano free (pode não caber)
- ❌ Custo sobe com muitos usuários
- ❌ Script precisa rodar periodicamente

#### Melhor para:
- 🎯 Dados "cached" (não precisa ser tempo real)
- 🎯 Atualização a cada X minutos
- 🎯 Frontend reativo

---

### **Opção 4: APIs Públicas de Terceiros** ⭐⭐

#### Exemplos:
- **UniSat API**: https://unisat.io/
- **OKX Web3 API**: https://www.okx.com/web3
- **Magic Eden API**: https://magiceden.io/

#### Como funciona:
```
[API de Terceiros]
       ↓ (REST/GraphQL)
  [Firebase - Frontend]
       ↓
  [Usuários]
```

#### Custos:
- Varia por provedor
- Muitos têm free tier
- Pode ter rate limits

#### Vantagens:
- ✅ Zero infraestrutura
- ✅ Zero processamento
- ✅ Dados sempre atualizados
- ✅ Seu PC livre

#### Desvantagens:
- ❌ Dependência de terceiros
- ❌ Pode não ter TODOS os dados que você quer
- ❌ Rate limits
- ❌ Possível custo futuro
- ❌ Menos controle

#### ⚠️ Precisa verificar se tem:
- Lista de holders do DOG
- Ranking atualizado
- Histórico completo de transações
- Identificação de novos holders

---

## 🎯 Recomendação Final

### Para começar AGORA (Curto prazo):
**Opção 2: Cloudflare Tunnel** 
- Grátis
- Rápido de configurar (1-2 horas)
- Testa se o projeto tem tração

### Para crescer (Médio/Longo prazo):
**Opção 1: VPS (Hetzner/Contabo)**
- ~R$90-120/mês
- Profissional
- Escalável
- 24/7 confiável

### Caminho evolutivo sugerido:
```
1. Começar: Cloudflare Tunnel (grátis)
2. Testar: 30-60 dias, ver acesso dos usuários
3. Se tiver tração: Migrar para VPS
4. Se explodir: Escalar o VPS ou adicionar CDN
```

---

## 📊 Comparação Rápida

| Critério | VPS | Cloudflare Tunnel | Firebase Sync | APIs Públicas |
|----------|-----|-------------------|---------------|---------------|
| **Custo** | R$90-240/mês | Grátis | R$0-50/mês | Grátis-Pago |
| **Confiabilidade** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Setup** | Difícil | Fácil | Médio | Muito Fácil |
| **PC precisa ligado** | ❌ Não | ✅ Sim | ✅ Sim | ❌ Não |
| **Controle total** | ✅ Sim | ✅ Sim | ⚠️ Parcial | ❌ Não |
| **Escalabilidade** | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |

---

## 🚀 Próximos Passos

1. **Decidir qual opção testar primeiro**
2. **Se Cloudflare Tunnel**: Seguir `/docs/setup-cloudflare-tunnel.md`
3. **Se VPS**: Pesquisar provedores e fazer orçamento
4. **Se APIs públicas**: Testar endpoints disponíveis


