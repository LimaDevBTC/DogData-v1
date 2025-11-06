# 🎨 Partner Banner - Especificações de Design

## 📐 Dimensões da Imagem

### Dimensões Recomendadas (PNG/JPG):

```
Largura:  1400px  (largura máxima do container-fluid)
Altura:   140px   (altura desktop - similar aos cards)

Formato:  16:10 aproximadamente
Resolução: 72-150 DPI (web)
```

### Dimensões Responsivas:

| Dispositivo | Largura Container | Altura Banner | Padding |
|-------------|-------------------|---------------|---------|
| **Mobile**  | 100% (min 360px) | 120px | 16px |
| **Tablet**  | 100% (max 1400px) | 130px | 32px |
| **Desktop** | 1400px | 140px | 32px |

---

## 🎨 Estilo Visual

### Seguir o Design System do Site:

**Cores principais:**
- **Primária:** `#f97316` (Orange-500)
- **Secundária:** `#fb923c` (Orange-400)
- **Background:** `#111827` a `#1f2937` (Gray-900 a Gray-800)
- **Texto:** `#ffffff` (White) ou `#9ca3af` (Gray-400)

**Tipografia:**
- Font: **Monospace** (similar ao site)
- Peso: **Bold** para títulos
- Estilo: **Tech/Modern**

**Layout:**
- ❌ **SEM border-radius** (conforme solicitado)
- ✅ **Border:** `1px solid rgba(249, 115, 22, 0.2)` (orange-500/20)
- ✅ **Hover effect:** Border fica mais visível
- ✅ **Badge "Sponsored"** no canto superior direito (automático)

---

## 📁 Como Usar

### 1. Criar a imagem do banner

**Ferramentas recomendadas:**
- Figma, Photoshop, Canva
- Dimensões: **1400x140px**
- Formato: **PNG** (com transparência) ou **JPG**

### 2. Exportar e salvar

```bash
# Salvar no diretório public/
/public/partner-banner.png
```

**Ou outro nome:**
```bash
/public/parceiro-nome-banner.png
```

### 3. Atualizar o componente (se necessário)

Editar `/components/layout.tsx` linha 43-47:

```tsx
<PartnerBanner 
  imageUrl="/seu-banner.png"        // ← Nome do arquivo
  link="https://link-parceiro.com"  // ← Link do parceiro
  alt="Nome do Parceiro"             // ← Descrição
/>
```

---

## 🖼️ Template de Exemplo

### Layout Sugerido:

```
┌─────────────────────────────────────────────────────────────────┐
│                                                     [Sponsored]  │
│                                                                  │
│   [Logo Parceiro]    Texto Promocional aqui                     │
│                      Call to Action →                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
     1400px width                    140px height
```

### Exemplo de Conteúdo:

**Opção 1 - Logo + Texto:**
```
┌─────────────────────────────────────────────────────────────────┐
│  [LOGO]  |  Trade DOG with zero fees • Best liquidity on BTC   │
│           |  Visit ExchangeName.com →                     [SP]  │
└─────────────────────────────────────────────────────────────────┘
```

**Opção 2 - Centralizado:**
```
┌─────────────────────────────────────────────────────────────────┐
│                                                            [SP]  │
│           🚀 DOG Trading Now Live on ExchangeName 🚀            │
│              Get 10% Bonus on First Trade →                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🎯 Posicionamento no Site

**Onde aparece:**
- ✅ Topo de **TODAS as páginas**
- ✅ Logo abaixo do Header
- ✅ Acima de todo conteúdo

**Páginas:**
- Overview (/)
- Holders
- Markets
- Transactions
- Bitcoin Network
- Airdrop
- Donate

---

## 💻 Especificações Técnicas Implementadas

### Componente: `PartnerBanner`

**Features:**
- ✅ Imagem responsiva (Next.js Image)
- ✅ Link externo com `rel="sponsored"`
- ✅ Badge "Sponsored" automático
- ✅ Hover effects (escala + borda)
- ✅ Border orange no estilo do site
- ✅ **SEM border-radius** (sharp corners)
- ✅ Loading lazy (priority para primeira dobra)

**CSS aplicado:**
```css
border: 1px solid rgba(249, 115, 22, 0.2)
hover:border: rgba(249, 115, 22, 0.4)
background: gradient gray-900 → gray-800
height: 120px (mobile) / 140px (desktop)
width: 100% (max 1400px)
```

---

## 📊 Dimensões Finais por Dispositivo

### Mobile (< 768px)
- **Container width:** 100% (com padding 16px)
- **Banner display width:** ~360-750px
- **Banner height:** 120px
- **Imagem visível:** Centralizada e responsiva

### Desktop (>= 768px)
- **Container width:** 1400px
- **Banner display width:** 1400px (full width)
- **Banner height:** 140px
- **Imagem visível:** Full width, object-fit: contain

---

## ✅ Checklist para Criação da Imagem

### Antes de exportar:

- [ ] Dimensões: 1400x140px
- [ ] Formato: PNG (transparência) ou JPG (fundo escuro)
- [ ] Resolução: 72 DPI (web) ou 150 DPI (alta qualidade)
- [ ] Background: Transparente OU gradiente dark (#111827 → #1f2937)
- [ ] Cores: Orange (#f97316) para destaque
- [ ] Tipografia: Monospace/Tech style
- [ ] Elementos alinhados: Centro ou esquerda
- [ ] Espaço para badge "Sponsored": Deixe ~100px livre no canto superior direito
- [ ] Contraste: Texto legível em fundo escuro

### Após exportar:

- [ ] Arquivo salvo em `/public/partner-banner.png`
- [ ] Link do parceiro configurado em `layout.tsx`
- [ ] Testado em mobile e desktop
- [ ] Verificado hover effect

---

## 🧪 Teste Visual

Após adicionar a imagem:

1. **Acesse:** http://localhost:3000
2. **Verifique:**
   - ✅ Banner aparece no topo (abaixo do header)
   - ✅ Badge "Sponsored" visível no canto superior direito
   - ✅ Imagem centralizada e proporcional
   - ✅ Hover: borda fica orange-500/40
   - ✅ Hover: imagem dá zoom leve
   - ✅ Click: abre link do parceiro em nova aba

3. **Teste responsivo:**
   - Redimensione a janela
   - Verifique mobile (360px)
   - Verifique desktop (1400px+)

---

## 🔧 Customização Avançada

### Múltiplos Banners (Rotação)

Se quiser rotacionar entre parceiros:

```tsx
// layout.tsx
const partnerBanners = [
  { image: '/partner1.png', link: 'https://partner1.com' },
  { image: '/partner2.png', link: 'https://partner2.com' },
]

const [bannerIndex, setBannerIndex] = useState(0)

useEffect(() => {
  const interval = setInterval(() => {
    setBannerIndex(i => (i + 1) % partnerBanners.length)
  }, 30000) // Trocar a cada 30s
  return () => clearInterval(interval)
}, [])

// Usar:
<PartnerBanner 
  imageUrl={partnerBanners[bannerIndex].image}
  link={partnerBanners[bannerIndex].link}
/>
```

### Banner por Página

Se quiser banners diferentes por página:

```tsx
{currentPage === 'markets' && (
  <PartnerBanner 
    imageUrl="/partner-exchange.png"
    link="https://exchange.com"
  />
)}

{currentPage === 'transactions' && (
  <PartnerBanner 
    imageUrl="/partner-wallet.png"
    link="https://wallet.com"
  />
)}
```

---

## 📝 Próximos Passos

### Para você (designer):

1. **Criar imagem 1400x140px**
   - Use as cores do site (orange-500, gray-800)
   - Tipografia monospace
   - Fundo escuro ou transparente

2. **Exportar como PNG**
   - Nome: `partner-banner.png`
   - Salvar em: `/public/`

3. **Atualizar link do parceiro**
   - Editar `components/layout.tsx` linha 45
   - Trocar `https://link-do-parceiro.com` pelo link real

### Para testar:

```bash
# Colocar imagem
cp sua-imagem.png public/partner-banner.png

# Acessar site
http://localhost:3000

# Verificar todas as páginas
```

---

## 🎯 Resultado Final

Você terá:

✅ **Banner profissional** no topo de todas as páginas  
✅ **Sem border-radius** (estilo sharp do site)  
✅ **Badge "Sponsored"** transparente  
✅ **Hover effects** suaves  
✅ **Responsivo** (mobile e desktop)  
✅ **Performance otimizada** (Next.js Image)  
✅ **SEO friendly** (rel="sponsored")  

---

**Pronto!** Crie a imagem com **1400x140px** e me avise quando estiver pronta! 🎨

