# BBF BUILD — Torre BitFlow "The Set Wave" 🌊

> Plano final de implementação do prédio-âncora da BitFlow na Satoshi Plaza.
> Nível: landmark, par da Kray Tower (320) — needle central (500) continua reinando o céu.
> Fontes: brandguide oficial da Bitflow no Figma (extraído 2026-07-10), site bitflow.finance,
> concept de arquitetura + spec técnico Three.js (agentes especializados).

---

## 1. Brand kit (extraído do Figma oficial)

**Paleta** (nomes oficiais — todos temáticos de praia):

| Nome | Hex | Uso no prédio |
|---|---|---|
| **sea color** | `#00D1AC` | teal primário — vidro, sinalização, luz |
| **beach sand** | `#E3DED3` | creme — massa/painéis "precast", o corpo do prédio |
| **salamander** | `#F78116` | laranja — SÓ 3 usos racionados (ver §4) |
| **black flow** | `#0B0E0B` | quase-preto — sombras, molduras, portal |

**Logo**: marca **pixel-wave** (onda 8-bit em blocos) + wordmark BITFLOW em sans modular pesada (VTC Du Bois). Redução: "Bf".
**Motivos**: dither de pixels (pixels se dissolvendo como spray do mar), faixas de onda pixelada, grid modular estrito, iconografia 8-bit.
**Vibe**: surfer × Bitcoin. Retro-pixel, sun-bleached, mas engenheirado em grid rigoroso. **NÃO** é glass-box corporativo, **NÃO** é cyberpunk.
**Voz** (site): *"The future is BTC denominated and the liquidity must flow."* Produtos: swaps BTC/sBTC/Runes, HODLMM, DCA, agregador DEX.

Asset local: `/public/Bitflow.png` (mark laranja + wordmark creme) — **referência visual apenas**; o letreiro será procedural (§6).

---

## 2. O conceito — "The Set Wave"

**Parti**: uma onda quebrando, renderizada na língua nativa da Bitflow: **pixels**. Cinco volumes-barra sobem em escada 8-bit ao longo dos 175 do lote, crescem até a crista em 320, e o topo arremessa um balanço de 30 unidades de volta sobre o degrau anterior — **o curl de uma onda congelada no meio da quebra**. De longe, a silhueta É o logomark extrudado; de perto, resolve num grid rigoroso de pixels 10×10 creme que se dissolve em dither rumo ao céu, com uma **guarita de salva-vidas laranja** no cume. Miami Beach modernism (lajes empilhadas, sombra profunda, cobogó) encontra arquitetura voxel. Kray = monolito negro esguio; BitFlow = onda larga em degraus — personalidades opostas, mesmo nível.

**Disciplina modular (a regra do jogo inteiro)**: tudo deriva de um voxel de massa **25 (comprimento X) × 27 (profundidade Z) × 20 (altura Y)**. O lote fecha exato: 175 = 7 baias, 82 ≈ 3 baias, 320 = 16 lifts. Nenhuma meia-medida, nenhuma curva. Pixel de fachada = **10×10** (5×2 por baia/lift).

---

## 3. Massing — lista de volumes (espaço local)

Convenções (validadas contra kray-tower.ts:192-193): grupo em `(b.x, 4, b.z)`, `rotation.y = b.face`; para a âncora norte `face = π` → **local +Z = fachada da praça**. Local X percorre os 175 (`w`), local Z os 82 (`d`). Base em y=0.
A onda sobe **oeste→leste** (local −X → +X).

| # | Volume | Centro X | Dim X×Y×Z | Y (base→topo) | Material |
|---|---|---|---|---|---|
| 1 | **Podium "a duna"** | 0 | 175×40×82 | 0→40 | sand + arcada cobogó |
| 2 | Stack A (baias 1-2) | −62.5 | 50×60×78 | 40→100 | fachada atlas |
| 3 | Stack B (baia 3) | −25 | 25×120×70 | 40→160 | fachada atlas |
| 4 | Stack C (baia 4) | 0 | 25×180×64 | 40→220 | fachada atlas |
| 5 | Stack D (baia 5) | +25 | 25×240×58 | 40→280 | fachada atlas |
| 6 | **Crista** (baias 6-7) | +62.5 | 50×240×82 | 40→280 | fachada atlas |
| 7 | **The Curl** (lip, shift −30) | +32.5 | 50×40×82 | 280→320 | fachada atlas + soffit teal |
| 8 | **Lifeguard Station** | +32.5 | 25×20×27 (Z sul: +27) | 320→340 | salamander sólido |
| 9 | **Break Canopy** | 0 | 100×3×15 (Z: d/2+7) | y≈20 | black + luz teal por baixo |

Regras anti-z-fighting (spec técnico): sobrepor verticalmente 0.2u entre stacks; shifts laterais ≥ 0.5u ou exatamente 0; planos de sign flutuam ≥ 1.0u da placa.

**Leitura à distância**: rampa em degraus subindo, cabeça alta com gancho em balanço, ponto laranja no cume. Isso é uma onda de pixel. Lê de qualquer canto da praça.

---

## 4. Sistema de fachada

**4 estados de pixel** (grid 10×10):
1. **SAND-SOLID** — painel creme `#E3DED3`, fosco.
2. **GLASS** — janela teal `#00D1AC` recuada em moldura sand (a profundidade Miami).
3. **OPEN** — célula vazada (loggia), só perto do topo.
4. **BLACK** — `#0B0E0B`, só na fileira-sombra sob cada balanço/degrau.

**Gradiente dither (assinatura)**: base 70% solid / 30% glass (pesada, duna) → meio 50/50 checker → topo da crista 20% solid / 50% glass / 30% open — **o prédio se dissolve em spray de pixels contra o céu**. É o motivo dither da marca em 340 unidades de altura.

**Laranja racionado a EXATAMENTE 3 usos**:
(a) Lifeguard Station inteira; (b) uma faixa vertical de 10u na face norte da crista ("the leash" — core de serviço expresso); (c) revelo interno das células OPEN. Em mais lugar nenhum. Escassez é o que faz estourar.

**Lógica noturna** (a cidade é vista à noite): GLASS acende teal-branco, SAND fica quente-escuro, BLACK morre, OPEN brilha borda laranja. O gradiente inverte lindamente: base escura pesada, topo cintilante.

---

## 5. Elementos-assinatura

1. **The Curl** (280→320, balanço −30 oeste) — o pixel-chave do logo em escala habitável. Soffit inferior 30×82 = plano de luz teal ("o barrel acendendo").
2. **Lifeguard Station** (voxel laranja 320→340, borda sul do teto do curl) — o ícone mais literal de praia abstraído na cor de acento; à noite é o farol do prédio.
3. **Bf Mark** (face sul da crista, elev. 230–290) — "Bf" de 60u construído NO grid de pixels da fachada (6×4 pixels teal retroiluminados), não um letreiro parafusado.
4. **Surf Deck** (teto do Stack C, elev. 220) — piscina infinita em balanço +10 sul, água com glow teal, deck sand, 6 palmeiras voxel. Uma piscina pendurada numa onda.
5. **Break Canopy** (face da praça, elev. 20) — marquise 100×15 com borda frontal em degraus de 10u traçando um ciclo do logo. Underside teal.

**Térreo/praça (+Z)**: arcada cobogó dupla-altura (tela sand perfurada em dither, células 5×5), lobby brilhando teal através dos furos "como água por um recife"; corte de entrada de 30u com portal black-flow; 2 fileiras de palmeiras (7 por lado, espaçamento 25); piso checker 10×10 em dois tons de creme; rack de pranchas de surf gigantes contra a tela. Canto leste = "The Shack" (café laranja). O térreo diz *beach club*, não *lobby de banco*.

---

## 6. Implementação Three.js

### 6.1 Módulo e contrato

Criar `app/city/explore/bitflow-tower.ts`:
```ts
export function buildBitflowTower(
  b: { x: number; z: number; w: number; d: number; face: number },
): { group: THREE.Group; animate: (t: number) => void }
```

Integração em `city-3d.tsx` (~linha 1874, espelhando o branch da Kray):
```ts
import { buildBitflowTower } from './bitflow-tower'   // junto às linhas 7-8

for (const a of P.anchors) {
  if (a.name === 'Kray') { ... }
  else if (a.name === 'BitFlow') {
    const { group, animate } = buildBitflowTower(a)
    plazaGroup.add(group); flyers.push(animate)
  } else addCommerce(a, 130, true)
}
```
Isso remove automaticamente a caixa teal genérica E o banner `ENV.makeBannerTexture` — **o letreiro próprio (Bf + BITFLOW) é obrigatório** ou a âncora perde o nome.

`animate(t)` entra em `flyers` (t = `clock.elapsedTime` em segundos, city-3d.tsx:2036). Chamar `buildBitflowTower` só dentro do useEffect (client component) — nunca em top-level de módulo (canvas/document).

### 6.2 Geometria — orçamento e técnica

Three `^0.162.0` → usar **`mergeGeometries`** de `three/examples/jsm/utils/BufferGeometryUtils.js` (nome novo, não `mergeBufferGeometries`).

- **Massing**: ~24 BoxGeometry clonados+transladados+UV-remapeados → `mergeGeometries` → **3 meshes mesclados por material** (sand / fachada-emissiva / black) = 3 draw calls. Dispor as geometrias-fonte após o merge.
- **Spray de pixels**: `InstancedMesh(smallBoxGeo, tealBasicMat, ~60)` — cubos 0.5–1.5u cascateando do topo da crista (o dither 3D) = 1 draw call. Precedente: discos open-space city-3d.tsx:1889-1902.
- **Peças hero individuais**: canopy, cobogó (plane com alphaMap dither), piscina (plane teal), soffit do curl, lifeguard, 6 palmeiras (geo/mat compartilhados), 2 placas+2 planos de sign.
- **Sombras**: `castShadow/receiveShadow` SÓ nos 3 meshes mesclados (padrão Kray: só o body, kray-tower.ts:226-227). Instanced/signs/decoração = false.

**Orçamento total**: ≤ 30 draw calls, ~25k tris, **2 point lights**, 3 texturas (~11 MB):
1024² atlas de fachada + 2048×512 sign + 256×64 strip de onda.

### 6.3 Fachada — atlas + UV remap

Padrão Kray (kray-tower.ts:115-148): canvas baked **uma vez** → `CanvasTexture` como `emissiveMap` em `MeshStandardMaterial` (`emissive: 0xffffff`, base escura), `anisotropy = 8`.

- Atlas 1024² em grid 4×4 de tiles 256²: variantes de densidade dither (70/30, 50/50, 20/50/30), tile lobby, tile solid-dark para faces ±Y (tetos não brilham).
- **flipY gotcha** (kray-tower.ts:123): canvas y=0 = TOPO do prédio. Lobby desenha embaixo.
- Por box antes do merge: remapear `geo.attributes.uv` para o tile do atlas. **Quantizar dimensões dos boxes em múltiplos do módulo de janela** (larguras múltiplas de 25, alturas de 20) para o tile assignment ler correto sem repeat.
- Rejeitado: canvas por box (24 texturas) e `texture.offset` compartilhado (offset é por-textura, não por-mesh).
- Teal crítico de marca em material **`toneMapped: false`** (ACES a 0.98 esmaga emissivos — por isso toda sinalização existente usa isso, kray-tower.ts:282).

### 6.4 Sinalização — procedural, sem PNG

**Não carregar** `/public/Bitflow.png` (274 KB; um pixel-mark é trivialmente exato em canvas com borda crisp em qualquer zoom):

```ts
const WAVE: number[][] = [ /* bitmap 16×6 do mark, 1 = quadrado preenchido */ ]
// canvas 2048×512 (4:1, disciplina do sign da Kray)
// passo 1: halo — shadowColor 'rgba(0,209,172,0.9)', shadowBlur 50, fill '#00D1AC'
// passo 2: core crisp — shadowBlur 0, fill '#7CFFE9'
// células: cell 40, gap 6 (o gutter dá a leitura "pixelada")
// wordmark "BITFLOW" à direita: '700 300px "Helvetica Neue"', duplo passo halo+core creme #E3DED3/#fff
```

Montagem estilo Kray (kray-tower.ts:274-291): plano + placa de backing escura na banda alta, faces **+Z (praça) e −Z**, cópia traseira com `rotation.y = π` (texto não espelha). Sign plane ≥1.0u à frente da placa. `anisotropy 16`, mipmaps.

O **Bf Mark** da fachada sul (§5.3) é separado: pixels teal desenhados direto no tile do atlas da crista (parte da parede, não letreiro).

### 6.5 Animação (zero alocações) e luzes

Padrão: closure com referências pré-capturadas, só escalares/`Math.sin`/writes (kray-tower.ts:377-390).

| Efeito | Técnica | Custo |
|---|---|---|
| **The Set** — faixa teal sobe a onda | strip 256×64 `wrapS=RepeatWrapping`, `tex.offset.x = (t*0.02)%1` no flanco da crista (padrão LED-ring, central-tower.ts:267) | 1 linha |
| **Barrel glow** — soffit do curl pulsa | `soffitMat.opacity = 0.7 + 0.3*sin(t*0.35)` (~18s ciclo) | grátis |
| **Farol laranja** — lifeguard respira | `beaconLight.intensity = 0.5 + 0.5*sin(t*0.785)` (~8s) + opacity do emissivo | grátis |
| **Bf mark** | ESTÁTICO — a marca fica parada enquanto o prédio se move | zero |

**2 point lights** (orçamento igual Kray/central):
- `PointLight(0x00D1AC, 1.0, 160, 2)` na altura do sign — halo teal da coroa.
- `PointLight(0xF78116, 0.6, 120, 2)` no lobby local +Z — calor de entrada (espelha kray-tower.ts:373-375).

Opcional (gate noturno): exportar `setDaylight(day)` e escalar intensidades por `(1-day)`, padrão blimp city-3d.tsx:1718-1728.

### 6.6 Pitfalls (do spec técnico)

- **Raycast**: dblclick raycasta a cena toda (city-3d.tsx:2150) — merged mesh ganha pivot-targeting de graça; single-click de wallet só intersecta `tierMeshes` → torre nunca dispara `dogcity:click` falso. Sprites já excluídos.
- **Nunca redesenhar canvas por frame** — tudo baked uma vez.
- **Disposal**: seguir precedente (sem método dispose no contrato), mas SIM descartar as 24 geometrias temporárias logo após o merge.
- Piscina/soffit `transparent:true` → `depthWrite:false` se houver ghosting.

---

## 7. As 3 armadilhas (o que NÃO fazer)

1. **Deriva cyberpunk** — nada de magenta/roxo/laser/facade-vídeo. 4 cores, teal lidera, laranja racionado, animação é água lenta, não Blade Runner.
2. **Suavizar a onda** — qualquer borda curva mata a identidade pixel. Degraus, balanços e recortes hard-snapped no grid 25/27/20 e 10×10. A onda é implícita por escadas, nunca desenhada por spline.
3. **Recaída glass-box** — vidro nunca >50% de fachada, sempre recuado em moldura sand. Se o creme virar "moldura" em vez de massa, vira mais um HQ de curtain-wall.

---

## 8. Checklist de aceite

- [ ] `bitflow-tower.ts` criado, integrado no branch da praça; caixa genérica + banner removidos.
- [ ] Silhueta lê como onda pixelada dos 4 cantos da praça; crista 320, beacon 340 (par da Kray; needle 500 intocada).
- [ ] Paleta estrita: `#00D1AC` / `#E3DED3` / `#F78116` / `#0B0E0B`; laranja em exatamente 3 usos.
- [ ] Sign BITFLOW + pixel-wave procedural nas duas faces largas; Bf mark no grid da fachada sul.
- [ ] Curl em balanço + soffit teal; lifeguard laranja respirando ~8s; strip "The Set" subindo a crista.
- [ ] ≤30 draw calls, 2 point lights, 3 texturas, zero alocações no animate, sombras só nos merges.
- [ ] `next build` verde (client-only, sem canvas em top-level de módulo).
- [ ] Dblclick na torre recentra a câmera; nenhum clique falso de wallet.

---

*Plano gerado 2026-07-10 · brandguide Figma "Brandguide – Bitflow (External)" · concept "The Set Wave" + spec técnico por agentes de design/3D.*
