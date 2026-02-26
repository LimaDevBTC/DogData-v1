# DOG DATA - Design System "Terminal Luxe"

## Visao Geral

Redesign do design system do DOG DATA (explorador Bitcoin/DOG rune) com foco em:
1. Nova paleta de cores baseada na imagem `paleta de cores.jpg`
2. Experiencia mobile completamente nova com bottom navigation
3. Tipografia com hierarquia visual (Syne display + JetBrains Mono data)
4. Fundamentos primeiro - paginas herdam automaticamente via componentes

---

## Nova Paleta de Cores

Extraida da imagem `/paleta de cores.jpg`:

```
DARK VOID     #151419  RGB(21,20,25)   → Background principal (substitui #000000)
LIQUID LAVA   #F56E0F  RGB(245,110,15) → Cor primaria/accent (substitui #f7931a)
GLUON GREY    #1B1B1E  RGB(27,27,30)   → Superficie de cards (substitui #1a1a1a)
SLATE GREY    #262626  RGB(38,38,38)   → Bordas/elevacoes (substitui #2a2a2a)
DUSTY GREY    #878787  RGB(135,135,135)→ Texto secundario (substitui #999999)
SNOW          #FBFBFB  RGB(251,251,251)→ Texto principal (substitui #ffffff)
```

Cores derivadas (calculadas):
```
LAVA LIGHT    #FF8C3A  → Hover/light variant (substitui #ffa726)
LAVA DARK     #D45D0D  → Pressed/dark variant (substitui #e65100)
```

### Estrategia de Transicao Zero-Breakage

Os tokens antigos do Tailwind (`black`, `gray-800`, `orange-500`, `white`, etc.) serao REDIRECIONADOS para os novos valores hex. Isso significa que TODAS as 14+ paginas e 25+ componentes que usam `bg-gray-800`, `text-orange-500`, `border-gray-700` etc. automaticamente passam a usar as novas cores SEM editar nenhum arquivo de pagina.

---

## Tipografia

| Uso | Fonte | Pesos | Como carregar |
|-----|-------|-------|---------------|
| Display (headings, hero, titulos de secao) | **Syne** | 600, 700, 800 | `next/font/google` |
| Data (numeros, tabelas, enderecos, badges) | **JetBrains Mono** | 300-700 | `next/font/google` |
| Body (descricoes, paragrafos) | **Inter** | 300-700 | Google Fonts CDN (ja carregado) |

Mudancas:
- ADICIONAR: Syne como font display
- MANTER: JetBrains Mono (ja carregado) e Inter (CDN)
- REMOVER: DM_Sans (nao usado), Ubuntu (substituir por Syne italic no credito "bitmax")

---

## Arquivos a Modificar (10 arquivos, em ordem)

---

### PASSO 1: `tailwind.config.ts`

**Caminho**: `/DogData-v1/tailwind.config.ts`
**Motivo**: Source of truth de todo o design system. Modificar primeiro.

Mudancas:

1. Adicionar tokens semanticos no `extend.colors`:
```ts
// Novos tokens semanticos
'void': '#151419',
'surface': '#1B1B1E',
'elevated': '#262626',
'lava': {
  DEFAULT: '#F56E0F',
  light: '#FF8C3A',
  dark: '#D45D0D',
},
'dusty': '#878787',
'snow': '#FBFBFB',
```

2. Redirecionar tokens legados (backward compatibility):
```ts
'black': '#151419',        // era #000000
'gray': {
  900: '#151419',          // era #111111 → agora void
  800: '#1B1B1E',          // era #1a1a1a → agora surface
  700: '#262626',          // era #2a2a2a → agora elevated
  600: '#404040',          // manter
  500: '#666666',          // manter
  400: '#878787',          // era #999999 → agora dusty
  300: '#cccccc',          // manter
  200: '#e5e5e5',          // manter
  100: '#f5f5f5',          // manter
},
'white': '#FBFBFB',        // era #ffffff → agora snow
'orange': {
  500: '#F56E0F',          // era #f7931a → agora lava
  400: '#FF8C3A',          // era #ffa726
  600: '#D45D0D',          // era #e65100
},
'dog-orange': '#F56E0F',   // legacy alias
```

3. Adicionar Syne ao fontFamily:
```ts
fontFamily: {
  'mono': ['var(--font-mono)', 'JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
  'sans': ['Inter', 'system-ui', 'sans-serif'],
  'display': ['var(--font-display)', 'Syne', 'Inter', 'system-ui', 'sans-serif'],
},
```

4. Atualizar boxShadow glow: `rgba(245, 110, 15, ...)` (era `rgba(247, 147, 26, ...)`)

5. Atualizar keyframes glow: mesma mudanca de cor

6. Atualizar backgroundImage gradient-orange e grid-pattern com nova cor lava

7. Adicionar spacing para bottom nav:
```ts
spacing: {
  // ...existente
  '18': '4.5rem',
  '20': '5rem',  // bottom nav clearance (80px)
},
```

---

### PASSO 2: `app/globals.css`

**Caminho**: `/DogData-v1/app/globals.css` (866 linhas)
**Motivo**: CSS custom properties, estilos base, glassmorphism.

Mudancas:

1. Atualizar import Google Fonts (linha 1):
```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
```
Remover JetBrains Mono e Ubuntu do CDN (JetBrains vai via next/font, Ubuntu removido).
Syne tambem via next/font, nao precisa no CDN.

2. Atualizar `:root` CSS custom properties:
```css
:root {
  /* Nova Paleta Semantica */
  --color-void: #151419;
  --color-surface: #1B1B1E;
  --color-elevated: #262626;
  --color-lava: #F56E0F;
  --color-lava-light: #FF8C3A;
  --color-lava-dark: #D45D0D;
  --color-dusty: #878787;
  --color-snow: #FBFBFB;

  /* Aliases legados (redirects) */
  --color-black: #151419;
  --color-dark-gray: #151419;
  --color-gray-900: #151419;
  --color-gray-800: #1B1B1E;
  --color-gray-700: #262626;
  --color-gray-600: #404040;
  --color-gray-500: #666666;
  --color-gray-400: #878787;
  --color-gray-300: #cccccc;
  --color-gray-200: #e5e5e5;
  --color-gray-100: #f5f5f5;
  --color-white: #FBFBFB;
  --color-orange: #F56E0F;
  --color-orange-light: #FF8C3A;
  --color-orange-dark: #D45D0D;

  /* Glassmorphism atualizado para darks mais quentes */
  --glass-bg: rgba(27, 27, 30, 0.6);
  --glass-border: rgba(251, 251, 251, 0.08);
  --glass-blur: blur(16px);

  /* Shadows atualizados */
  --shadow-glow: 0 0 20px rgba(245, 110, 15, 0.3);

  /* Grid pattern com nova lava */
  --grid-color: rgba(245, 110, 15, 0.015);

  /* Typography e Spacing - manter como estao */
}
```

3. Atualizar body:
```css
body {
  font-family: var(--font-mono, 'JetBrains Mono'), 'Fira Code', 'Monaco', 'Consolas', monospace;
  background: var(--color-void);
  color: var(--color-snow);
  overflow-x: hidden;
  position: relative;
}
```

4. Atualizar `.font-display`:
```css
.font-display {
  font-family: var(--font-display, 'Syne'), -apple-system, BlinkMacSystemFont, sans-serif;
  font-weight: 700;
  letter-spacing: -0.02em;
}
```

5. REMOVER `.font-ubuntu` (linha ~199-201)

6. Atualizar `.gradient-text`:
```css
.gradient-text {
  background: linear-gradient(135deg, var(--color-lava), var(--color-lava-light));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
```

7. Atualizar keyframe `glow`:
```css
@keyframes glow {
  0%, 100% { box-shadow: 0 0 20px rgba(245, 110, 15, 0.3); }
  50% { box-shadow: 0 0 30px rgba(245, 110, 15, 0.6); }
}
```

8. Adicionar mobile utilities:
```css
/* Bottom nav clearance no mobile */
@media (max-width: 767px) {
  .container-fluid {
    padding-bottom: 5rem;
  }
}

/* Touch-friendly targets */
.touch-target {
  min-height: 44px;
  min-width: 44px;
}
```

9. Atualizar `.loading-skeleton` com novas cores surface/elevated

10. **NAO MEXER** nos overrides do Recharts (linhas ~469-866). Eles funcionam por selector matching contra fills SVG do Recharts e o risco de quebrar e alto. A diferenca visual entre `rgba(247,147,26,0.3)` e `rgba(245,110,15,0.3)` em shadows e imperceptivel.

---

### PASSO 3: `app/layout.tsx`

**Caminho**: `/DogData-v1/app/layout.tsx` (74 linhas)
**Motivo**: Font loading, body classes, metadata.

Mudancas:

1. Atualizar imports de fontes:
```tsx
import { JetBrains_Mono, Syne } from 'next/font/google'
// REMOVER: import { Inter, DM_Sans } from 'next/font/google'

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
})

const syne = Syne({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-display',
  display: 'swap',
})
```

2. Atualizar body className:
```tsx
<body className={`${jetbrainsMono.variable} ${syne.variable} font-mono`}>
```

3. Atualizar wrapper div:
```tsx
<div className="min-h-screen bg-void">
```
(era: `bg-gradient-to-br from-dog-gray-900 via-black to-dog-gray-900`)

4. Atualizar themeColor: `'#F56E0F'` (era `'#f97316'`)

5. Remover `viewport` do metadata object (Next.js 15 usa export separado, gera warning)

---

### PASSO 4a: `components/ui/card.tsx`

**Caminho**: `/DogData-v1/components/ui/card.tsx` (96 linhas)

Mudancas:

1. Padding responsivo no Card:
```tsx
"p-4 md:p-6 transition-all duration-300 hover:bg-snow/[0.02] hover:border-snow/20"
```
(era: `p-6` fixo)

2. Variantes atualizadas:
```tsx
const variants = {
  default: "bg-surface/50 border border-elevated/50",
  glass: "glass bg-snow/5 backdrop-blur-lg border border-snow/10",
  elevated: "bg-surface/80 border border-elevated/50 shadow-xl"
}
```

3. CardTitle com font-display e tamanhos responsivos:
```tsx
const variants = {
  default: "text-snow font-display font-semibold text-base md:text-lg",
  gradient: "gradient-text font-display font-bold text-lg md:text-xl",
  mono: "text-snow font-mono font-semibold text-sm md:text-lg"
}
```

4. CardDescription:
```tsx
className={cn("text-dusty text-xs md:text-sm font-mono", className)}
```

---

### PASSO 4b: `components/ui/button.tsx`

**Caminho**: `/DogData-v1/components/ui/button.tsx` (70 linhas)

Mudancas:

1. Variantes de cor atualizadas:
```tsx
variant: {
  default: "bg-lava hover:bg-lava-dark text-snow",
  glass: "bg-snow/5 hover:bg-snow/10 text-snow border border-snow/20 hover:border-snow/30",
  outline: "border border-elevated hover:border-dusty text-dusty hover:text-snow hover:bg-surface/30",
  ghost: "text-dusty hover:text-snow hover:bg-surface/20",
  destructive: "bg-red-500/20 hover:bg-red-500/25 text-red-400 border border-red-500/30",
},
```

2. Nova variante de tamanho para mobile:
```tsx
size: {
  default: "h-10 px-4 py-2",
  sm: "h-8 px-3 text-sm",
  lg: "h-12 px-8 text-lg",
  icon: "h-10 w-10",
  touch: "h-11 min-w-[44px] px-4 py-2.5", // NOVO
},
```

3. Touch target no base:
```tsx
"inline-flex items-center justify-center font-medium transition-all duration-300 min-h-[44px] md:min-h-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lava focus-visible:ring-offset-2 focus-visible:ring-offset-void disabled:pointer-events-none disabled:opacity-50"
```

---

### PASSO 4c: `components/ui/badge.tsx`

**Caminho**: `/DogData-v1/components/ui/badge.tsx` (37 linhas)

Mudancas:

1. Atualizar variantes CVA:
```tsx
const badgeVariants = cva(
  "inline-flex items-center border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-lava focus:ring-offset-2 font-mono",
  {
    variants: {
      variant: {
        default: "border-transparent bg-lava text-snow shadow",
        secondary: "border-transparent bg-surface text-dusty",
        destructive: "border-transparent bg-red-600 text-snow shadow",
        outline: "text-dusty border-elevated",
        success: "border-transparent bg-green-600 text-snow shadow",
        warning: "border-transparent bg-yellow-600 text-snow shadow",
      },
    },
    defaultVariants: { variant: "default" },
  }
)
```

---

### PASSO 5: `components/header.tsx`

**Caminho**: `/DogData-v1/components/header.tsx` (193 linhas)

Mudancas:

1. Atualizar header background:
```tsx
<header className="fixed top-0 left-0 right-0 z-50 bg-void/90 backdrop-blur-xl border-b border-elevated/50">
```

2. Reduzir altura mobile: `h-14 md:h-20` (era `h-16 md:h-20`)

3. Logo text usar font-display:
```tsx
<span className="text-snow font-display text-lg md:text-2xl font-bold tracking-wider hover:text-lava transition-colors duration-300 whitespace-nowrap">
  DOG DATA
</span>
```

4. Nav buttons atualizados:
```tsx
isActive
  ? 'bg-lava/20 text-lava border border-lava/30'
  : 'text-dusty hover:text-snow hover:bg-surface/30 border border-transparent hover:border-elevated/30'
```

5. Donate button gradient: `from-lava to-lava-dark`

6. Live status: `bg-surface/50 border border-elevated/50`

7. **REMOVER** completamente:
   - Estado `mobileMenuOpen` e `setMobileMenuOpen`
   - Botao hamburger (Menu/X icons)
   - Todo o bloco `{mobileMenuOpen && (...)}` do mobile dropdown
   - Imports de `Menu` e `X` do lucide-react

8. Manter refresh button visivel no mobile (remover `hidden sm:block`):
```tsx
<button className="px-3 py-2 md:py-3 bg-surface/50 border border-elevated/50 ..."  >
```

---

### PASSO 6 (NOVO): `components/mobile-bottom-nav.tsx`

**Caminho**: `/DogData-v1/components/mobile-bottom-nav.tsx`
**Arquivo NOVO a ser criado.**

Design:
- Barra fixa no rodape, APENAS visivel abaixo de `md` breakpoint (`md:hidden`)
- Background: `bg-void/95 backdrop-blur-xl border-t border-elevated/50`
- Altura: 64px + safe area inset
- Z-index: 50

Nav items (5 max):
```
1. Overview  → icone: BarChart3
2. Txns      → icone: CreditCard
3. Holders   → icone: Users
4. Metrics   → icone: Zap
5. More      → icone: LayoutGrid (abre overlay)
```

"More" menu overlay:
```
Markets        → icone: TrendingUp
Airdrop        → icone: Sparkles
Bitcoin Network→ icone: Network
Donate         → icone: Heart
```
- Overlay aparece acima do bottom nav em grid 2x2
- `bg-surface/95 backdrop-blur-xl border border-elevated rounded-t-lg`
- Dismiss: tap fora ou tap "More" novamente
- Animacao: slide up com opacity

Active state:
- Icone + label em cor lava
- Linha 2px lava acima do icone ativo
- Icone scale 1.05x
- Itens inativos: icone dusty, label snow/60

Touch targets: cada item minimo 44px largura, 48px altura
Labels: `text-[10px] font-mono uppercase tracking-wide`
Safe area: `pb-[env(safe-area-inset-bottom)]`

Tap feedback: `active:scale-95 transition-transform duration-100`

Estrutura do componente:
```tsx
"use client"

import { useState } from "react"
import { BarChart3, CreditCard, Users, Zap, LayoutGrid, X, Sparkles, Network, Heart, TrendingUp } from "lucide-react"

type PageType = 'overview' | 'holders' | 'airdrop' | 'bitcoin-network' | 'markets' | 'transactions' | 'metrics' | 'donate'

const primaryNav = [
  { name: 'Overview', page: 'overview' as PageType, icon: BarChart3 },
  { name: 'Txns', page: 'transactions' as PageType, icon: CreditCard },
  { name: 'Holders', page: 'holders' as PageType, icon: Users },
  { name: 'Metrics', page: 'metrics' as PageType, icon: Zap },
]

const moreNav = [
  { name: 'Markets', page: 'markets' as PageType, icon: TrendingUp },
  { name: 'Airdrop', page: 'airdrop' as PageType, icon: Sparkles },
  { name: 'Bitcoin', page: 'bitcoin-network' as PageType, icon: Network },
  { name: 'Donate', page: 'donate' as PageType, icon: Heart },
]

interface MobileBottomNavProps {
  currentPage: PageType
  setCurrentPage: (page: PageType) => void
}

export default function MobileBottomNav({ currentPage, setCurrentPage }: MobileBottomNavProps) {
  const [moreOpen, setMoreOpen] = useState(false)
  const isMoreActive = moreNav.some(item => item.page === currentPage)

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50">
      {/* More overlay */}
      {/* Main bottom bar */}
      {/* 5 nav items (4 primary + More) */}
    </div>
  )
}
```

---

### PASSO 7: `components/layout.tsx`

**Caminho**: `/DogData-v1/components/layout.tsx` (53 linhas)

Mudancas:

1. Importar MobileBottomNav:
```tsx
import MobileBottomNav from "./mobile-bottom-nav"
```

2. CORRIGIR BUG CRITICO de padding mobile:
```tsx
<main className="relative pt-16 md:pt-20 flex-1 pb-20 md:pb-0">
```
(era: `pt-[25px] md:pt-20` - conteudo ficava atras do header de 64px!)
- `pt-16` (64px) = header h-14 (56px) + 8px respiro
- `pb-20` (80px) = bottom nav clearance no mobile
- `md:pb-0` = sem padding extra no desktop

3. Atualizar wrapper:
```tsx
<div className="min-h-screen bg-void text-snow grid-container flex flex-col">
```

4. Adicionar bottom nav antes do `</div>` final:
```tsx
<Footer currentPage={currentPage} setCurrentPage={handleSetCurrentPage} />
<MobileBottomNav currentPage={currentPage} setCurrentPage={handleSetCurrentPage} />
```

---

### PASSO 8: `components/footer.tsx`

**Caminho**: `/DogData-v1/components/footer.tsx` (321 linhas)

Mudancas:

1. Atualizar TODAS as cores:
   - `orange-500` → `lava`
   - `orange-400` → `lava`/`lava-light`
   - `orange-600` → `lava-dark`
   - `text-white` → `text-snow`
   - `bg-black` → `bg-void`
   - `border-gray-800` → `border-elevated`
   - `bg-gray-800` → `bg-surface`
   - `border-gray-700` → `border-elevated`
   - `text-gray-400` → `text-dusty`
   - `text-gray-300` → `text-snow/80`
   - `text-gray-500` → `text-dusty/70`

2. Esconder NAVIGATION e RESOURCES no mobile:
```tsx
{/* Quick Links - Hidden on mobile (bottom nav handles this) */}
<div className="hidden md:block space-y-6">
  {/* ... NAVIGATION column ... */}
</div>

{/* Resources - Hidden on mobile */}
<div className="hidden md:block space-y-6">
  {/* ... RESOURCES column ... */}
</div>
```

3. Substituir `font-ubuntu` por `font-display italic`:
```tsx
<a className="text-lava font-display font-semibold italic tracking-tight hover:text-lava-light transition-colors duration-300">
  bitmax
</a>
```

4. Section headings com Syne:
```tsx
<h4 className="text-snow font-display text-lg font-bold tracking-wider">NAVIGATION</h4>
```

5. Adicionar bottom padding no mobile:
```tsx
<footer className="border-t border-lava/20 mt-20 relative pb-24 md:pb-0">
```

6. Simplificar donate section no mobile:
```tsx
<div className="flex flex-col lg:flex-row items-center justify-between gap-6">
  {/* Icon + text: stack no mobile */}
  <div className="flex items-center space-x-4 md:space-x-6">
    <div className="w-12 h-12 md:w-16 md:h-16 bg-gradient-to-br from-lava to-lava-dark flex items-center justify-center">
      <Heart className="w-6 h-6 md:w-8 md:h-8 text-snow" />
    </div>
    <div>
      <h3 className="text-snow font-display text-lg md:text-2xl font-bold tracking-wider">SUPPORT DOG DATA</h3>
      <p className="text-dusty text-xs md:text-sm font-mono tracking-wide">
        Keep the project free and open source
      </p>
    </div>
  </div>
  {/* Button responsivo */}
  <button className="w-full md:w-auto px-6 md:px-8 py-3 md:py-4 bg-gradient-to-r from-lava to-lava-dark ...">
    ...
  </button>
</div>
```

---

## Verificacao Pos-Implementacao

1. **Build**: `cd DogData-v1 && npm run build` → deve compilar sem erros
2. **Dev**: `npm run dev` → verificar visualmente:

### Desktop (>= 768px):
- [ ] Cores novas aplicadas (background #151419, nao #000000)
- [ ] Syne aparece nos headings
- [ ] Glassmorphism com tons mais quentes
- [ ] Layout mantido (nenhuma pagina quebrada)
- [ ] Glow/shadow com cor lava (#F56E0F)

### Mobile (< 768px):
- [ ] Bottom nav visivel com 5 itens
- [ ] Header sem hamburger, apenas logo + live + refresh
- [ ] Cards com padding menor (16px vs 24px)
- [ ] Footer simplificado (sem NAV e RESOURCES columns)
- [ ] "More" menu abre/fecha corretamente no bottom nav
- [ ] Touch targets minimo 44px em botoes
- [ ] Sem conteudo atras do header (pt-16 funciona)
- [ ] Sem conteudo atras do bottom nav (pb-20 funciona)
- [ ] Safe area funciona no iPhone (notch/home indicator)

### Testar em Chrome DevTools:
- [ ] iPhone SE (375px)
- [ ] iPhone 14 (390px)
- [ ] Pixel 7 (412px)
- [ ] iPad Mini (768px - breakpoint md)

---

## Resumo de Riscos

| Risco | Nivel | Mitigacao |
|-------|-------|-----------|
| Cores legadas quebrarem | Baixo | Tokens antigos redirecionados para novos valores |
| Recharts overrides pararem de funcionar | Medio | NAO mexer nos overrides (linhas 469-866 do globals.css) |
| Remover mobile menu antes do bottom nav estar pronto | Alto | Implementar bottom nav (passo 6) ANTES de remover menu do header (passo 5) |
| Font loading duplicado (CDN + next/font) | Baixo | Remover JetBrains Mono do CDN, manter apenas Inter |
| Content layout shift com novas fontes | Baixo | `display: 'swap'` no next/font config |
