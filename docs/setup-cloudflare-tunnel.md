# Configuração: Cloudflare Tunnel para Expor Backend Local

## 🎯 Objetivo
Expor o backend Node.js rodando no seu PC para a internet de forma segura, permitindo que o frontend hospedado no Firebase acesse os dados.

## ✅ Vantagens
- ✅ **GRÁTIS** (Cloudflare Tunnel é free)
- ✅ HTTPS automático
- ✅ Sem precisar de IP fixo
- ✅ Sem configurar roteador/firewall
- ✅ Proteção DDoS da Cloudflare
- ✅ Seu PC continua processando os dados

## ⚙️ Passo a Passo

### 1. Instalar Cloudflared
```bash
# Linux
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb
```

### 2. Fazer Login na Cloudflare
```bash
cloudflared tunnel login
```
Isso abrirá o navegador para você autorizar.

### 3. Criar um Túnel
```bash
# Criar túnel chamado "dogdata-backend"
cloudflared tunnel create dogdata-backend

# Isso vai gerar um arquivo de configuração e um ID único
```

### 4. Configurar o Túnel
Criar arquivo de configuração:

```bash
nano ~/.cloudflared/config.yml
```

Conteúdo:
```yaml
tunnel: <SEU-TUNNEL-ID>
credentials-file: /home/bitmax/.cloudflared/<SEU-TUNNEL-ID>.json

ingress:
  # Rota para o backend Node.js
  - hostname: api-dogdata.seudominio.com
    service: http://localhost:3001
  # Fallback (obrigatório)
  - service: http_status:404
```

### 5. Configurar DNS na Cloudflare
```bash
cloudflared tunnel route dns dogdata-backend api-dogdata.seudominio.com
```

### 6. Rodar o Túnel
```bash
# Testar primeiro
cloudflared tunnel run dogdata-backend

# Se funcionar, rodar como serviço persistente
sudo cloudflared service install
sudo systemctl start cloudflared
sudo systemctl enable cloudflared
```

### 7. Atualizar Frontend
No Firebase, configure a URL da API:
```javascript
// frontend/config.js
const API_URL = 'https://api-dogdata.seudominio.com';
```

## 🔒 Segurança Adicional

### Adicionar Autenticação no Backend
```javascript
// backend/src/server.js
const ALLOWED_ORIGINS = [
  'https://seu-app.web.app',
  'https://seu-app.firebaseapp.com'
];

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  next();
});
```

### Rate Limiting
```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100 // limite de 100 requests
});

app.use(limiter);
```

## 📊 Arquitetura Final

```
[Usuário] 
    ↓
[Firebase Hosting - Frontend]
    ↓ (HTTPS)
[Cloudflare Tunnel]
    ↓ (via túnel criptografado)
[Seu PC - Backend Node.js :3001]
    ↓
[Bitcoin Core + Ord + Scripts Python]
```

## ⚠️ Considerações

### Vantagens:
- ✅ Grátis
- ✅ Seu PC processa tudo
- ✅ Fácil de configurar
- ✅ Seguro

### Desvantagens:
- ⚠️ Seu PC precisa estar SEMPRE LIGADO
- ⚠️ Se seu PC cair, o site fica offline
- ⚠️ Latência pode ser maior (depende da sua internet)
- ⚠️ Upload da sua internet precisa ser bom

## 🔧 Monitoramento

Criar script para monitorar se o túnel está ativo:

```bash
#!/bin/bash
# ~/monitor_tunnel.sh

while true; do
    if ! systemctl is-active --quiet cloudflared; then
        echo "⚠️ Cloudflare Tunnel caiu! Reiniciando..."
        sudo systemctl restart cloudflared
        # Enviar notificação (opcional)
    fi
    sleep 60
done
```

## 📱 Alternativa: ngrok

Se preferir ngrok (mais simples mas pago para domínio custom):

```bash
# Instalar ngrok
snap install ngrok

# Autenticar (precisa criar conta grátis)
ngrok authtoken SEU_TOKEN

# Expor backend
ngrok http 3001

# Isso vai gerar uma URL tipo: https://abc123.ngrok.io
```

**Limitações do ngrok free:**
- ❌ URL muda a cada reinício
- ❌ Sem domínio customizado
- ✅ Mais simples de configurar

**ngrok Pro ($8/mês):**
- ✅ Domínio fixo
- ✅ Mais túneis simultâneos


