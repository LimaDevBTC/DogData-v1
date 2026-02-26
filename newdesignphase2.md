# DOG DATA - Phase 2: AAA+ Quality Polish

## Visao Geral

A Phase 1 (newdesign.md) implementou a fundacao "Terminal Luxe": novos tokens de cor, Syne font, mobile bottom nav, header/footer/card/button/badge atualizados. Porem, **todas as 8 paginas e ~10 componentes restantes ainda usam tokens antigos** e tem layouts mobile ruins. O problema principal: um unico card de dado ocupa quase a tela inteira do celular.

---

## Causas Raiz da Experiencia Mobile Ruim

| Problema | Causa | Impacto |
|----------|-------|---------|
| Card ocupa tela inteira | `min-h-[190px]` + `gap-6` (24px) + `text-3xl` | Cada stat card tem ~220px num celular de 667px |
| Scroll infinito | `grid-cols-1` no mobile = cada card largura total | 8 cards = 8 telas de scroll |
| Tabela Markets ilegivel | Desktop table exibida no mobile (cards mobile existem mas `hidden`!) | Dados cortados |
| Sem hierarquia visual | Tudo usa `font-mono` — headings nao usam `font-display` (Syne) | Monotono |
| Cores legadas | Paginas ainda usam `text-gray-400`, `text-orange-400`, `bg-black` | Inconsistente |

---

## Arquivos a Modificar (19 arquivos, em ordem)

---

### PASSO 1: `components/ui/section-divider.tsx`

**Caminho**: `/DogData-v1/components/ui/section-divider.tsx` (44 linhas)
**Motivo**: Usado em TODAS as paginas. Propaga automaticamente.

Mudancas:

1. Gradient line:
```tsx
// ERA:
"bg-gradient-to-r from-transparent via-orange-500/30 to-transparent"
// VIRA:
"bg-gradient-to-r from-transparent via-lava/30 to-transparent"
```

2. Container com font-display:
```tsx
// ERA:
<div className="flex items-center gap-3 px-6 py-2 bg-black/80 backdrop-blur-sm border border-orange-500/20 font-mono">
  {Icon && <Icon className="w-4 h-4 text-orange-400" />}
  <span className="text-sm font-medium text-orange-400 uppercase tracking-wider">
// VIRA:
<div className="flex items-center gap-3 px-6 py-2 bg-void/80 backdrop-blur-sm border border-lava/20 font-mono">
  {Icon && <Icon className="w-4 h-4 text-lava" />}
  <span className="text-sm font-medium text-lava uppercase tracking-wider font-display">
```

3. Badge:
```tsx
// ERA:
"px-2 py-0.5 text-xs font-mono bg-orange-500/20 text-orange-300 border border-orange-500/30"
// VIRA:
"px-2 py-0.5 text-xs font-mono bg-lava/20 text-lava-light border border-lava/30"
```

4. Spacing mobile: `my-8` → `my-4 md:my-8` (ambos os dividers)

---

### PASSO 2: `components/loading-screen.tsx`

**Caminho**: `/DogData-v1/components/loading-screen.tsx` (35 linhas)
**Motivo**: Primeira coisa que o usuario ve ao carregar.

Mudancas:

```tsx
// ERA:
<div className="min-h-screen bg-black flex items-center justify-center">
// VIRA:
<div className="min-h-screen bg-void flex items-center justify-center">

// ERA:
<div className="w-16 h-16 border-4 border-orange-500/30 border-t-orange-500 rounded-full animate-spin"></div>
<div className="absolute inset-0 w-16 h-16 bg-orange-500/10 rounded-full animate-pulse"></div>
// VIRA:
<div className="w-16 h-16 border-4 border-lava/30 border-t-lava rounded-full animate-spin"></div>
<div className="absolute inset-0 w-16 h-16 bg-lava/10 rounded-full animate-pulse"></div>

// ERA:
<h2 className="text-white font-mono text-xl font-bold">{message}</h2>
// VIRA:
<h2 className="text-snow font-display text-xl font-bold">{message}</h2>

// ERA (bouncing dots):
<div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" ...
// VIRA:
<div className="w-2 h-2 bg-lava rounded-full animate-bounce" ...
```

---

### PASSO 3: `components/ui/input.tsx`

**Caminho**: `/DogData-v1/components/ui/input.tsx` (27 linhas)
**Motivo**: Usado em search bars de Transactions e Holders.

Mudancas:

```tsx
// ERA:
"flex h-10 w-full bg-transparent border border-gray-700/50 px-3 py-2 text-sm text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 disabled:cursor-not-allowed disabled:opacity-50 font-mono"
// VIRA:
"flex h-10 w-full bg-transparent border border-elevated/50 px-3 py-2 text-sm text-snow placeholder:text-dusty focus:outline-none focus:ring-2 focus:ring-lava focus:border-lava disabled:cursor-not-allowed disabled:opacity-50 font-mono min-h-[44px] md:min-h-0"
```

---

### PASSO 4: `components/ui/trend-indicator.tsx`

**Caminho**: `/DogData-v1/components/ui/trend-indicator.tsx` (57 linhas)
**Motivo**: Indicador visual de tendencia.

Mudancas:

```tsx
// ERA:
const colorClass = isNeutral ? 'text-gray-400' : isPositive ? 'text-green-400' : 'text-red-400'
const bgClass = isNeutral ? 'bg-gray-500/10' : isPositive ? 'bg-green-500/10' : 'bg-red-500/10'
// VIRA:
const colorClass = isNeutral ? 'text-dusty' : isPositive ? 'text-green-400' : 'text-red-400'
const bgClass = isNeutral ? 'bg-dusty/10' : isPositive ? 'bg-green-500/10' : 'bg-red-500/10'
```

---

### PASSO 5: `components/ui/price-cards.tsx`

**Caminho**: `/DogData-v1/components/ui/price-cards.tsx` (693 linhas)
**Motivo**: Cards de preco na home. Grande impacto visual.

Mudancas (search & replace):

1. Cores de texto:
   - `text-gray-400` → `text-dusty` (replace_all)
   - `text-gray-500` → `text-dusty/70` (replace_all)
   - `text-white` → `text-snow` (replace_all, EXCETO dentro de className de gradients)

2. Backgrounds:
   - `bg-gray-700/50` → `bg-elevated/50` (replace_all)
   - `bg-gray-700/30` → `bg-elevated/30` (replace_all)
   - `bg-gray-600` → `bg-elevated` (cuidado com gradients from-gray-600)
   - `from-gray-600 to-gray-700` → `from-elevated to-elevated`

3. Layout gap mobile:
```tsx
// ERA:
<div className="space-y-6">
// VIRA:
<div className="space-y-4 md:space-y-6">
```

4. Price text responsivo:
```tsx
// ERA:
<div className="text-xl font-bold font-mono bg-gradient-to-r ..."
// VIRA:
<div className="text-lg md:text-xl font-bold font-mono bg-gradient-to-r ..."
```

5. **NAO MEXER** nas cores especificas de exchanges (from-blue-400, from-purple-400, etc.) — sao cores de marca.

---

### PASSO 6: `app/page.tsx` (Overview/Home)

**Caminho**: `/DogData-v1/app/page.tsx` (605 linhas)
**Motivo**: Primeira pagina que o usuario ve. Maior impacto.

Mudancas:

1. **Hero section — compactar mobile**:
```tsx
// ERA:
<div className="text-center space-y-1 md:space-y-2 animate-fade-in px-4 mt-8 md:mt-10">
// VIRA:
<div className="text-center space-y-1 md:space-y-2 animate-fade-in px-4 mt-4 md:mt-10">
```

2. **Hero title — font-display**:
```tsx
// ERA:
<span className="text-gray-400 font-mono tracking-wider block">
// VIRA:
<span className="text-dusty font-display tracking-wider block">
```

3. **Hero badge**:
```tsx
// ERA:
<Badge variant="outline" className="border-orange-500/30 text-orange-400 font-mono text-xs md:text-sm">
// VIRA:
<Badge variant="outline" className="border-lava/30 text-lava font-mono text-xs md:text-sm">
```

4. **Stats Grid — CRITICO PARA MOBILE**:
```tsx
// ERA:
<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
// VIRA:
<div className="grid grid-cols-2 md:grid-cols-2 xl:grid-cols-4 gap-3 md:gap-6">

// ERA:
const cardBaseClass = "stagger-item min-h-[190px] h-full"
// VIRA:
const cardBaseClass = "stagger-item md:min-h-[190px] h-full"
```

5. **Stat values — responsivos**:
```tsx
// TODOS os "text-3xl font-bold text-white font-mono" VIRAM:
"text-xl md:text-3xl font-bold text-snow font-mono"
```

6. **Card labels/descriptions**:
```tsx
// text-gray-400 → text-dusty (replace_all na pagina)
// text-gray-300 → text-snow/80 (replace_all na pagina)
// text-white → text-snow (replace_all na pagina)
// text-orange-500 → text-lava
// text-orange-400 → text-lava
// text-green-500 → text-green-400
// border-orange-500/20 → border-lava/20
```

7. **TradingView chart — altura responsiva**:
```tsx
// ERA:
<div style={{ height: "600px" }}>
// VIRA:
<div className="h-[350px] md:h-[600px]">
```

8. **Loading state**:
```tsx
// ERA:
<div className="text-gray-400 font-mono">Loading chart...</div>
// VIRA:
<div className="text-dusty font-mono">Loading chart...</div>
```

---

### PASSO 7: `app/markets/page.tsx`

**Caminho**: `/DogData-v1/app/markets/page.tsx` (396 linhas)
**Motivo**: Tabela ilegivel no mobile. Cards mobile ja existem mas estao `hidden`.

Mudancas:

1. **Hero — font-display + cores**:
```tsx
// ERA:
<BarChart3 className="w-8 h-8 md:w-12 md:h-12 text-orange-500" />
<h1 className="... bg-gradient-to-r from-orange-400 via-orange-500 to-orange-600 ... font-mono">
<p className="text-gray-400 ...">
// VIRA:
<BarChart3 className="w-8 h-8 md:w-12 md:h-12 text-lava" />
<h1 className="... bg-gradient-to-r from-lava via-lava to-lava-dark ... font-display">
<p className="text-dusty ...">
```

2. **Market overview cards — grid 2-col mobile**:
```tsx
// ERA:
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
// VIRA:
<div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
```

3. **Cores nos cards**:
   - `text-gray-400` → `text-dusty`
   - `text-white` → `text-snow`
   - `text-gray-500` → `text-dusty/70`

4. **CRITICO — Tabela: esconder no mobile, mostrar cards**:
```tsx
// ERA: Desktop table wrapper
<div>
  <table className="w-full table-fixed">
// VIRA:
<div className="hidden md:block">
  <table className="w-full table-fixed">

// ERA: Mobile cards
<div className="hidden">
  {sortedTickers.map(...)}
// VIRA:
<div className="md:hidden space-y-3">
  {sortedTickers.map(...)}
```

5. **Sort controls — cores**:
```tsx
// ERA:
className="bg-gray-800/50 border border-gray-700 text-white ..."
// VIRA:
className="bg-surface/50 border border-elevated text-snow ..."

// ERA:
"focus:border-orange-500"
// VIRA:
"focus:border-lava"

// ERA:
"hover:border-orange-500"
// VIRA:
"hover:border-lava"
```

6. **Table header**:
```tsx
// ERA:
<tr className="border-b border-dog-gray-700">
<th className="... text-dog-orange ...">
// VIRA:
<tr className="border-b border-elevated">
<th className="... text-lava ...">
```

7. **Table cells**:
   - `text-dog-gray-300` → `text-snow/80`
   - `text-gray-300` → `text-snow/80`
   - `text-gray-500` → `text-dusty/70`
   - `text-orange-400` → `text-lava`
   - `border-gray-700/50` → `border-elevated/50`

---

### PASSO 8: `app/donate/page.tsx`

**Caminho**: `/DogData-v1/app/donate/page.tsx` (317 linhas)

Mudancas:

1. **Hero — font-display**:
```tsx
// ERA:
<h1 className="text-4xl font-bold text-white font-mono ...">
  <Heart className="w-10 h-10 mr-4 text-dog-orange" />
// VIRA:
<h1 className="text-3xl md:text-4xl font-bold text-snow font-display ...">
  <Heart className="w-8 h-8 md:w-10 md:h-10 mr-3 md:mr-4 text-lava" />
```

2. **Cores gerais**:
   - `text-dog-gray-400` → `text-dusty`
   - `text-dog-orange` → `text-lava`
   - `text-white` → `text-snow`
   - `text-gray-400` → `text-dusty`
   - `text-gray-300` → `text-snow/80`
   - `text-orange-400` → `text-lava`
   - `border-orange-500/20` → `border-lava/20`
   - `border-orange-500/60` → `border-lava/60`
   - `border-orange-500/40` → `border-lava/40`
   - `bg-orange-500/10` → `bg-lava/10`
   - `bg-orange-500/20` → `bg-lava/20`
   - `bg-orange-500/5` → `bg-lava/5`
   - `border-orange-500/30` → `border-lava/30`

3. **Donation logos — menor no mobile**:
```tsx
// ERA:
<div className="relative w-32 h-32 group-hover:scale-110 ...">
// VIRA:
<div className="relative w-24 h-24 md:w-32 md:h-32 group-hover:scale-110 ...">
```

4. **Card padding — menor no mobile**:
```tsx
// ERA:
<CardContent className="p-8 flex flex-col ...">
// VIRA:
<CardContent className="p-5 md:p-8 flex flex-col ...">
```

5. **Modal — bg-void**:
```tsx
// ERA:
"fixed inset-0 bg-black/90 backdrop-blur-sm z-50 ..."
// VIRA:
"fixed inset-0 bg-void/90 backdrop-blur-sm z-50 ..."
```

---

### PASSO 9: `app/transactions/page.tsx`

**Caminho**: `/DogData-v1/app/transactions/page.tsx` (~700 linhas)
**Motivo**: Pagina pesada com tabela complexa.

Mudancas:

1. **Color token sweep** (replace_all no arquivo):
   - `text-gray-400` → `text-dusty`
   - `text-gray-300` → `text-snow/80`
   - `text-gray-500` → `text-dusty/70`
   - `text-white` → `text-snow`
   - `text-orange-400` → `text-lava`
   - `text-orange-500` → `text-lava`
   - `bg-black` → `bg-void`
   - `bg-gray-800` → `bg-surface`
   - `bg-gray-900` → `bg-void`
   - `border-gray-800` → `border-surface`
   - `border-gray-700` → `border-elevated`
   - `border-orange-500` → `border-lava`
   - `hover:bg-gray-700` → `hover:bg-elevated`
   - `hover:border-gray-600` → `hover:border-dusty`
   - `ring-orange-500` → `ring-lava`
   - `shadow-orange-500` → `shadow-lava`
   - `from-orange-500` → `from-lava`
   - `to-orange-600` → `to-lava-dark`

2. **Headings — font-display** nos titulos de secao

3. **Stats summary grid — 2-col mobile**:
   - Qualquer `grid-cols-1 md:grid-cols-2` → `grid-cols-2 md:grid-cols-2`
   - `gap-6` → `gap-3 md:gap-6`
   - Stat values `text-3xl` → `text-xl md:text-3xl`

4. **NAO MEXER** na logica de fetch/cache/validation — apenas UI.

---

### PASSO 10: `app/holders/page.tsx`

**Caminho**: `/DogData-v1/app/holders/page.tsx` (~700 linhas)

Mudancas:

1. **Mesmo color token sweep** do PASSO 9

2. **Stat cards — 2-col mobile**:
   - `grid-cols-1` → `grid-cols-2` para stat summary
   - `gap-6` → `gap-3 md:gap-6`

3. **Pagination — touch targets**: botoes minimo 44px

4. **Headings — font-display**

---

### PASSO 11: `app/metrics/page.tsx`

**Caminho**: `/DogData-v1/app/metrics/page.tsx`

Mudancas:
1. Color token sweep (mesmo padrao)
2. `font-display` nos headings
3. Grid stat cards `grid-cols-2` no mobile
4. `gap-3 md:gap-6`
5. **NAO MEXER** nos MutationObserver hacks do Recharts

---

### PASSO 12: `app/airdrop/page.tsx`

**Caminho**: `/DogData-v1/app/airdrop/page.tsx`

Mudancas:
1. Color token sweep
2. `font-display` nos headings
3. Grid `grid-cols-2` no mobile para stat cards
4. `gap-3 md:gap-6`

---

### PASSO 13: `app/bitcoin-network/page.tsx`

**Caminho**: `/DogData-v1/app/bitcoin-network/page.tsx`

Mudancas:
1. Color token sweep
2. `font-display` nos headings
3. Grid `grid-cols-2` no mobile
4. `gap-3 md:gap-6`

---

### PASSO 14: `components/c2-blockchain-banner.tsx`

**Caminho**: `/DogData-v1/components/c2-blockchain-banner.tsx` (64 linhas)

Mudancas:
```tsx
// ERA:
"bg-black border border-orange-500/20 hover:border-orange-500/40 ... hover:shadow-orange-500/10"
// VIRA:
"bg-void border border-lava/20 hover:border-lava/40 ... hover:shadow-lava/10"

// ERA:
"text-gray-400 text-[8px] ..."
// VIRA:
"text-dusty text-[8px] ..."

// ERA:
<ExternalLink className="w-2 h-2 md:w-3 md:h-3 text-gray-400" />
// VIRA:
<ExternalLink className="w-2 h-2 md:w-3 md:h-3 text-dusty" />

// ERA:
fontFamily: 'var(--font-dm-sans)',
// VIRA:
fontFamily: 'var(--font-display)',
```

---

### PASSO 15: `components/partner-banner.tsx`

**Caminho**: `/DogData-v1/components/partner-banner.tsx` (49 linhas)

Mudancas:
```tsx
// ERA:
"bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 border border-orange-500/20 hover:border-orange-500/40"
// VIRA:
"bg-gradient-to-r from-void via-surface to-void border border-lava/20 hover:border-lava/40"

// ERA:
"bg-orange-500/90"
// VIRA:
"bg-lava/90"

// ERA:
"text-white text-[9px] ..."
// VIRA:
"text-snow text-[9px] ..."

// ERA:
"bg-orange-500/0 group-hover:bg-orange-500/5"
// VIRA:
"bg-lava/0 group-hover:bg-lava/5"
```

---

### PASSO 16: `components/realtime-status.tsx`

**Caminho**: `/DogData-v1/components/realtime-status.tsx` (51 linhas)

Mudancas:
```tsx
// ERA:
"text-green-600 border-green-600"
// VIRA:
"text-green-400 border-green-400"
```
(Minimo — usa Badge que ja foi atualizado na Phase 1)

---

### PASSO 17: `components/address-badge.tsx`

**Caminho**: `/DogData-v1/components/address-badge.tsx` (121 linhas)

Mudancas:
```tsx
// ERA:
"text-orange-400" (Award icon e community badge)
// VIRA:
"text-lava"

// ERA:
"text-gray-300" (nome do verificado)
// VIRA:
"text-snow/80"

// ERA:
"bg-white/10"
// VIRA:
"bg-snow/10"

// ERA:
"text-orange-300" (hover community link)
// VIRA:
"text-lava-light"

// AddressBadgeInline:
// ERA:
<code className="text-white text-xs break-all">
// VIRA:
<code className="text-snow text-xs break-all">
```

---

### PASSO 18: `components/transaction-row.tsx`

**Caminho**: `/DogData-v1/components/transaction-row.tsx` (210 linhas)

Mudancas:
```tsx
// ERA:
"border-b border-gray-800/30 hover:bg-gray-800/20"
// VIRA:
"border-b border-surface/30 hover:bg-surface/20"

// ERA:
"text-orange-400" (amount)
// VIRA:
"text-lava"

// ERA:
"text-gray-400" (time)
// VIRA:
"text-dusty"

// ERA:
"text-gray-500" (+N indicators)
// VIRA:
"text-dusty/70"

// ERA:
"text-white" (txid)
// VIRA:
"text-snow"
```

---

### PASSO 19: `components/transaction-details-modal.tsx`

**Caminho**: `/DogData-v1/components/transaction-details-modal.tsx` (291 linhas)

Mudancas:

1. **Modal overlay**:
```tsx
// ERA:
"fixed inset-0 bg-black bg-opacity-50 ..."
// VIRA:
"fixed inset-0 bg-void/50 backdrop-blur-sm ..."
```

2. **Modal container**:
```tsx
// ERA:
"bg-dog-gray-900 border border-dog-gray-600 rounded-lg max-w-4xl ..."
// VIRA:
"bg-void border border-elevated rounded-lg max-w-4xl ..."
```

3. **Color token sweep**:
   - `text-dog-orange` → `text-lava`
   - `text-dog-gray-300` → `text-snow/80`
   - `text-dog-gray-400` → `text-dusty`
   - `text-dog-green` → `text-green-400`
   - `text-dog-red` → `text-red-400`
   - `text-dog-blue` → `text-blue-400`
   - `bg-dog-gray-800` → `bg-surface`
   - `bg-dog-gray-700` → `bg-elevated`
   - `bg-dog-red` → `bg-red-500`
   - `bg-dog-green` → `bg-green-500`
   - `border-dog-gray-600` → `border-elevated`
   - `text-white` → `text-snow`

4. **Heading — font-display**:
```tsx
// ERA:
<h2 className="text-2xl font-bold text-white">
// VIRA:
<h2 className="text-xl md:text-2xl font-bold text-snow font-display">
```

5. **Grid responsivo**:
```tsx
// ERA:
<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
// VIRA:
<div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
```

---

## Regra Global de Substituicao de Cores

Use esta tabela para qualquer arquivo:

| Token Antigo | Token Novo | Nota |
|-------------|-----------|------|
| `text-white` | `text-snow` | |
| `text-gray-400` | `text-dusty` | |
| `text-gray-300` | `text-snow/80` | |
| `text-gray-500` | `text-dusty/70` | |
| `text-orange-400` | `text-lava` | |
| `text-orange-500` | `text-lava` | |
| `text-orange-300` | `text-lava-light` | |
| `bg-black` | `bg-void` | |
| `bg-gray-900` | `bg-void` | |
| `bg-gray-800` | `bg-surface` | |
| `bg-gray-700` | `bg-elevated` | |
| `border-gray-800` | `border-surface` | |
| `border-gray-700` | `border-elevated` | |
| `border-orange-500` | `border-lava` | |
| `from-orange-500` | `from-lava` | |
| `to-orange-600` | `to-lava-dark` | |
| `via-orange-500` | `via-lava` | |
| `ring-orange-500` | `ring-lava` | |
| `shadow-orange-500` | `shadow-lava` | |
| `text-dog-orange` | `text-lava` | |
| `text-dog-gray-400` | `text-dusty` | |
| `text-dog-gray-300` | `text-snow/80` | |
| `bg-dog-gray-800` | `bg-surface` | |
| `bg-dog-gray-700` | `bg-elevated` | |
| `bg-dog-gray-900` | `bg-void` | |
| `border-dog-gray-600` | `border-elevated` | |
| `border-dog-gray-700` | `border-elevated` | |

**MANTER** (nao substituir):
- `text-green-400`, `text-red-400`, `text-blue-400`, `text-cyan-400` — cores semanticas de status
- `text-yellow-400`, `text-purple-400` — cores de categoria
- `bg-green-*`, `bg-red-*`, `bg-blue-*` — badges de status
- Cores de exchanges nos price-cards (from-blue-400, from-purple-400, etc.)
- Todos os overrides de Recharts no globals.css (linhas 482-865)

---

## Regra Global de Layout Mobile

| Padrao Antigo | Padrao Novo |
|--------------|------------|
| `grid-cols-1 md:grid-cols-2` (stat cards) | `grid-cols-2 md:grid-cols-2` |
| `grid-cols-1 md:grid-cols-2 xl:grid-cols-4` | `grid-cols-2 md:grid-cols-2 xl:grid-cols-4` |
| `gap-6` | `gap-3 md:gap-6` |
| `gap-8` | `gap-4 md:gap-8` |
| `min-h-[190px]` | `md:min-h-[190px]` |
| `text-3xl` (valores de stats) | `text-xl md:text-3xl` |
| `text-2xl` (valores menores) | `text-lg md:text-2xl` |
| `my-8` (section dividers) | `my-4 md:my-8` |
| `mt-8` (hero spacing) | `mt-4 md:mt-8` |
| `height: "600px"` (charts) | `h-[350px] md:h-[600px]` |
| Heading `font-mono` | `font-display` |

---

## Verificacao Pos-Implementacao

1. **Build**: `cd DogData-v1 && npm run build` → deve compilar sem erros

2. **Dev**: `npm run dev` → verificar visualmente:

### Desktop (>= 768px):
- [ ] Cores novas aplicadas uniformemente (nenhum text-gray-400 ou text-orange-400 restante)
- [ ] Syne aparece em headings (hero, section dividers, card titles, modal titles)
- [ ] Layout mantido (nenhuma pagina quebrada)
- [ ] Markets table funcional

### Mobile (< 768px):
- [ ] Stats cards em grid 2x2 (nao mais 1 por linha!)
- [ ] Cards SEM min-h-[190px] — compactos
- [ ] Gaps menores (12px vs 24px)
- [ ] Section dividers com margin menor
- [ ] Markets page mostra CARDS em vez de tabela
- [ ] Donate logos menores (96px vs 128px)
- [ ] TradingView chart menor (350px vs 600px)
- [ ] Transaction modal responsivo
- [ ] Inputs com min-height 44px (touch target)

### Testar em Chrome DevTools:
- [ ] iPhone SE (375px)
- [ ] iPhone 14 (390px)
- [ ] Pixel 7 (412px)
- [ ] iPad Mini (768px - breakpoint md)

---

## Resumo de Riscos

| Risco | Nivel | Mitigacao |
|-------|-------|-----------|
| Replace_all quebrar algo | Medio | Testar build apos cada batch |
| Grid 2-col cortar texto | Baixo | text-xl (nao text-3xl) no mobile |
| Markets mobile cards incompletos | Baixo | Cards ja existem no codigo, so estao hidden |
| Recharts quebrar com novas cores | Nulo | NAO mexer nos overrides (linhas 482-865) |
| Price-cards exchange colors quebrar | Baixo | NAO substituir cores de marca (blue-400, purple-400, etc.) |
| Transaction-row memoization quebrar | Nulo | Mudancas sao apenas className, nao afetam memo comparison |
