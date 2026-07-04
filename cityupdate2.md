# DogCity 2.0 — O Salto AAA (`cityupdate2.md`)

> **Meta:** sair de "WebGL indie bem feito" para **visual de estúdio multimilionário** —
> física respeitada, arquitetura em proporção áurea, cinematografia que faz um estranho
> perguntar "que jogo é esse?". Sucessor do `cityupdate.md` (fases 1–4 e 8 parciais entregues).
>
> **Como este plano nasceu (2026-07-04):** 4 agentes especializados rodaram em paralelo —
> (1) auditoria brutal do código atual, (2) estado da arte de rendering web 2026,
> (3) física para web, (4) Fibonacci/assets/MCPs. Este documento é a síntese.

---

## O diagnóstico — os 3 assassinos da ilusão AAA (auditoria)

A cena atual tem ~25 luzes, água com shader real, bloom e color grading — e mesmo assim
"parece WebGL". A auditoria achou o porquê, em ordem de dano:

1. **ZERO sombras.** `renderer.shadowMap.enabled = false` (`city-3d.tsx:353`). Nenhum
   jogo AAA outdoor sai sem sombra desde 2005. Sem sombra, os 13k prédios *flutuam*.
2. **Textura de janela de 48×64 px** (`city-3d.tsx:63`) — 8 janelas por tile, sem
   anisotropy. Quadriculado visível em qualquer close. Correção de 20 min, dobra o close-up.
3. **Bloom global** (`UnrealBloomPass`, threshold 0.28) — a neve dos picos (lum > 0.28)
   vira néon azul à distância. Precisa de bloom seletivo por emissive HDR/layer.

Outros achados críticos: `scene.environment` **nunca é setado** (prédios têm
metalness 0.18 refletindo nada); o composer **anula o MSAA** → a cena roda sem
anti-aliasing nenhum (shimmer nos topos); terreno/vegetação/estradas são
`MeshBasicMaterial` (o searchlight do helicóptero não ilumina o chão!); oceano é um
plano de **2 triângulos** (Gerstner impossível); tráfego são `Points` de 2.6px;
estradas não-mergeadas gastam ~40–60 draw calls; bounding sphere dos InstancedMesh
não recomputada (torres tier 8–9 podem sumir por culling errado).

---

## O norte estético — 3 pilares

| Pilar | Tradução técnica |
|---|---|
| **Luz com peso** (Rockstar/CDPR) | Sombra da lua + AO + bloom seletivo + envmap real + LUT teal-orange + rua molhada refletindo néon |
| **Matéria com física** | Vento real nas árvores (shader), banking de aeronaves, buoyancy Gerstner nos barcos, partículas GPU (chuva/fumaça/vapor), boids, Rapier para o futuro modo exploração |
| **Geometria com harmonia (φ)** | Setbacks das torres em razão áurea, janelas em retângulo áureo, parques em phyllotaxis (137.5°), landmark no ponto áureo do skyline |

---

## BLOCO 0 — Quick wins (~2–3h no total, ≈40% do ganho visual de uma semana)

Direto da auditoria, com arquivo:linha. Fazer TUDO antes de qualquer obra:

| # | Fix | Onde | Tempo |
|---|---|---|---|
| QW1 | `tex.anisotropy = renderer.capabilities.getMaxAnisotropy()` na winTex | `city-3d.tsx:93` | 15min |
| QW2 | Sky dome `SphereGeometry(r, 48, 24)` — mata banding do horizonte | `city-environment.ts:254` | 5min |
| QW3 | `scene.environment = reflectRT.texture` pós-captura — vidros passam a refletir a cidade | `city-3d.tsx:~1218` | 5min |
| QW4 | `computeBoundingSphere()` / `frustumCulled=false` nas torres tier 8–9 | `city-3d.tsx:593` | 10min |
| QW5 | Merge dos ribbons de estrada (`mergeGeometries`) → 2 draw calls em vez de ~50 | `city-environment.ts:767` | 30min |
| QW6 | winTex 48×64 → **256×128** (4 col × 8 linhas, persianas/variação) | `city-3d.tsx:63` | 20min |
| QW7 | Banner cloth: JS loop 58 vértices/frame → vertex shader (`uTime`) | `city-3d.tsx:1081` | 45min |
| QW8 | `SMAAPass` antes do OutputPass — devolve o anti-aliasing que o composer matou | `city-3d.tsx:409` | 15min |
| QW9 | Oceano `PlaneGeometry(…, 32, 32)` — base geométrica p/ Gerstner | `city-3d.tsx:864` | 5min |
| QW10 | Pinheiros `ConeGeometry(…, 12)` (hoje 7 lados); copas `Icosahedron(2.6, 2)` | `city-environment.ts:487` | 5min |

---

## BLOCO 1 — Fundação de luz (impacto ★★★★★, esforço M, WebGL2/r162)

A camada que separa "render" de "fotografia". Tudo compatível com o stack atual.

1. **Sombra da lua** — `shadowMap.enabled = true` (PCFSoft), `castShadow` SÓ na
   DirectionalLight da lua, 2048², frustum apertado no downtown visível. 1 shadow pass;
   o maior ganho de "peso físico" disponível.
2. **Migrar pós para `postprocessing` (pmndrs v6.39.x)** — substitui UnrealBloomPass:
   - **Bloom HDR seletivo**: `luminanceThreshold ~0.9` + emissive das janelas/néon com
     `emissiveIntensity 2–3` (>1.0 = só emissores estouram o threshold). Neve volta a ser neve.
   - **SSAO half-res** (`resolutionScale 0.5`, ~1–2ms) — prédios "encostam" no chão.
   - **SMAA** integrado ao mesmo composer.
   - **LUTEffect 3D** — grade teal-orange vira LUT profissional (~0.3ms, melhor
     razão impacto/custo do pipeline inteiro).
   - Portar o grade custom atual (vignette + grain já existem lá prontos).
3. **Materiais que reagem à luz** — terreno/vegetação: `MeshBasicMaterial` →
   `MeshStandardMaterial` (roughness 0.92, vertex colors como albedo). O searchlight
   do helicóptero passa a varrer o chão de verdade.
4. **IBL por distrito** (fase 2 do bloco): cubemap 256px por zona — distrito
   industrial âmbar, downtown ciano. Baked no load, custo runtime ~0.

## BLOCO 2 — Arquitetura Fibonacci (impacto ★★★★★, esforço L)

O pedido central: **beleza que será apreciada**. Regras paramétricas concretas, todas
no gerador (`route.ts`) + construção de geometria no cliente.

1. **Setbacks em razão áurea (tiers 6–9)** — torre em 3 degraus merged numa única
   geometria por tier (resolve também o gap "prisma puro"):

   ```
   φ = 1.618
   h0 = H / (1 + φ + φ²)      // base
   h1 = φ·h0                   // corpo
   h2 = H − h0 − h1            // coroa
   largura recua W/φ a cada degrau (Empire State / UN Secretariat: H = 1.618·W)
   ```

2. **Janelas em retângulo áureo** — no novo atlas 256×128: `ww = floorW/φ`,
   `wh = ww·φ`, gap `ww/φ²`. Atlas com 4 variações + offset UV por hash de instância
   (mata a repetição clonada denunciada pela auditoria, `city-3d.tsx:559`).
3. **Interior mapping nas janelas do downtown** (técnica Spider-Man/Cyberpunk —
   `three-interior-mapping` ou three-fenestra, custo ~0ms): cômodos falsos com
   parallax real atrás do vidro nas torres tier 7–9. **É o efeito que faz gritar "AAA".**
4. **Flicker de janelas** — `uTime` + hash de instância no shader emissivo:
   1–2 janelas mudando por segundo na cidade inteira. Cidade habitada, custo zero.
5. **Phyllotaxis (Vogel) nos parques e praças** — substituir `Math.random()`:

   ```
   r(n) = scale·√n·(R/√N);  θ(n) = n · 137.50776°
   N em números de Fibonacci (21, 34, 55)
   ```

   Padrão de girassol em parques, postes de rotatória e vegetação de orla — orgânico
   e matematicamente perfeito, de graça.
6. **Anéis urbanos Fibonacci** — densidade/altura decaindo do centro em razões da
   sequência (1-2-3-5-8-13 quarteirões por anel) — formaliza o decay que já existe.
7. **Landmark no ponto áureo** — o monumento âncora da Praça Satoshi reposicionado em
   `x = W_skyline/φ` (0.618 da largura, não no centro): tensão visual clássica de
   composição barroca.
8. **Greebling instanciado** — AC units, dutos, rebordos, antenas por hash nas fachadas
   altas e rooftops (1 draw call por tipo). Mata o "caixote" de vez.

## BLOCO 3 — Física viva (impacto ★★★★★, esforço L)

Pesquisa: **Rapier** (`@dimforge/rapier3d-compat ^0.19`) é a engine — addon oficial
`three/addons/physics/RapierPhysics.js`, vehicle + character controller nativos,
2–5× mais rápida em 2025, roadmap GPU. Jolt só se precisarmos de cloth real; Havok/PhysX
descartados. **Mas 80% da "física percebida" não precisa de engine:**

**3a. Física visual sem engine (fazer já):**
1. **Vento nas árvores** — vertex shader (sin + noise em world-space, amplitude por
   vertex color copa/tronco). Custo ~0. A vegetação estática atual é morta.
2. **Banking de aeronaves** — tangente da spline → `quaternion.slerp` de pitch/roll
   proporcional à curva. Helicóptero inclina ao curvar. <0.2ms.
3. **Barcos com buoyancy Gerstner real** — as ondas Gerstner (agora possíveis com o
   oceano 32×32 do QW9) espelhadas em CPU: mesma `wave[]` dos uniforms avaliada em
   `gerstnerHeight(x,z,t)`, 4–6 probes por casco → pitch/roll físico. Zero readback GPU.
4. **Wake dos barcos** — render-to-texture 512² ping-pong com dissipação (técnica
   Tidewater) ou TrailRenderer para os distantes.
5. **Partículas GPU** (`GPUComputationRenderer`, já embarcado no three): **chuva**
   (20k gotas, o gatilho da rua molhada do Bloco 4), **fumaça de chaminés**, **vapor
   de bueiro** (efeito NYC), faíscas. 50–100k partículas @ 1.5–2ms GPU.
6. **Pássaros boids** — adaptar exemplo oficial `webgl_gpgpu_birds` (GPGPU, ~1ms).
   Bando circulando as torres ao longe = vida.
7. **Bandeiras verlet** (<200 partículas CPU) nos mastros da orla e da Praça Satoshi.

**3b. Fundação Rapier (preparar o modo exploração):**
- Rapier em **Web Worker** + SharedArrayBuffer; mundo estático: **1 cuboid por prédio**
  (nunca trimesh!) → BVH build único, queries <1ms; heightfield por distrito.
- Depois (gameplay): `KinematicCharacterController` (a pé) e
  `DynamicRayCastVehicleController` (dirigir pela cidade — exemplo oficial pronto).
- Budget medido: step estático+player ~0.5–1ms. Dentro dos 3–4ms.

## BLOCO 4 — Cinematografia total (impacto ★★★★★, esforço M)

1. **Rua molhada refletindo néon** (o frame Cyberpunk) — caminho WebGL2:
   `screen-space-reflections` (0beqz) com `roughnessFade` + roughnessMap dinâmica no
   asfalto (poças rough 0.05, seco 0.7), half-res ~3ms. Fallback barato: cubemap
   blur + envMapIntensity. Ligar junto com a chuva GPU do Bloco 3 = **evento de clima**.
2. **Lens flare anamórfico** (`lensflare-threejs-vanilla`, ektogamat) na lua + streaks
   horizontais nas luzes fortes. ~0.8ms.
3. **DOF no tour e modo foto** (`DepthOfFieldEffect`) — foco = `controls.target`.
   Desligado no orbit livre.
4. **Height fog com aerial perspective** — densidade `exp(-y·k)` + tint atmosférico por
   depth: os prédios distantes se dissolvem em azul da noite (profundidade de MSFS).
5. **God rays** raymarched (50 steps + blue noise ~1.5ms) no searchlight do helicóptero
   e nos beacons de evento on-chain.
6. **Nuvens**: billboards iluminados por baixo pela cidade (0.2ms) agora;
   `@takram/three-clouds` (volumétricas Bruneton) como opção high-end depois.

## BLOCO 5 — Migração WebGPU/r185 (impacto ★★★★☆, esforço XL — o futuro)

A pesquisa aponta (⚠️ *confirmar na doc oficial antes de executar — versões r183+
são posteriores ao conhecimento base*): three **r185** com `ClusteredLighting`
(Forward+) nativo — centenas de point lights reais (janelas-chave, postes, néons) em
vez de ~25; `TRAANode` (anti-aliasing temporal real); SSR nativo; `LightProbeGrid`
(IBL por zona); compute shaders TSL (1M partículas).

- WebGPU já é baseline (~95% dos browsers, fallback WebGL2 automático).
- **Custo**: shaders GLSL (água, céu, grade) reescritos em TSL (~1 semana, transpiler
  oficial ajuda). `EffectComposer` → `RenderPipeline`.
- **Regra de decisão**: executar blocos 0–4 no stack atual PRIMEIRO (nada depende do
  WebGPU); migrar quando (a) quisermos +100 luzes reais via clustered, ou (b) o modo
  exploração exigir compute/física GPU. Não misturar migração com feature work.
- Upgrade intermediário sem WebGPU: r162 → r16x/17x para ganhar `BatchedMesh` maduro e
  `@three.ez/instanced-mesh` (frustum culling BVH per-instance + LOD automático nos
  13k prédios — culling típico de ~70% da cidade fora do frustum).

## BLOCO 6 — Assets, monumentos & pipeline IA (impacto ★★★★☆, esforço M)

1. **Kits CC0**: **Quaternius Downtown City MegaKit** (+ Cars/Streets/Nature packs) e
   Kenney City Kit — carros low-poly reais para substituir os Points do tráfego
   (auditoria GAP 8), mobiliário urbano, props de rooftop. Poly Haven para PBR/HDRI.
2. **Pipeline de otimização** (obrigatório para qualquer GLB que entrar):
   ```bash
   npm i -g @gltf-transform/cli
   gltf-transform optimize in.glb out.glb --texture-compress ktx2 --compress draco --simplify
   ```
   (200MB → 15–25MB; KTX2 = 8× menos VRAM que PNG). Loader: DRACOLoader + KTX2Loader.
3. **Monumentos via IA 3D** (Fase 7 do plano anterior — monetização): **Meshy**
   ($20/mês Pro, licença comercial, MCP oficial) para landmarks por texto;
   Rodin/Hyper3D via blender-mcp para peças multi-referência. Workflow:
   Meshy → (Blender ajuste) → gltf-transform → registry `/api/city/monuments` →
   screenshot QA via Playwright MCP.

---

## Tooling — o que já está instalado e o que falta

**✅ Instalado nesta sessão:**
- **Playwright MCP** (projeto, `.mcp.json`): QA visual da cena com browser real —
  `claude mcp add -s project playwright -- npx -y @playwright/mcp@latest` (feito).
  ⚠️ Regra de ouro do projeto continua: nada de screenshot headless por software na
  cena cheia (OOM). Com Playwright usar a GPU real (GTX 1650), viewport moderada e
  `?noreflect=1` quando possível.

**⏳ Requer ação do dono (1 comando cada):**
- **Skills Three.js da comunidade** (CloudAI-X/threejs-skills: 10 skills — PBR,
  lighting, shaders, postprocessing, loaders…). O clone já foi baixado e validado,
  mas a instalação em `.claude/skills/` requer aprovação humana (política de
  segurança — skills são instruções carregadas no startup). Para instalar:
  ```bash
  git clone --depth 1 https://github.com/CloudAI-X/threejs-skills.git /tmp/tjs \
    && mkdir -p .claude/skills && cp -r /tmp/tjs/skills/threejs-* .claude/skills/
  ```
- **blender-mcp** (`claude mcp add blender -- uvx blender-mcp`) — requer instalar
  antes: Blender 3.0+ (`sudo apt install blender` ou snap) + `uv`
  (`curl -LsSf https://astral.sh/uv/install.sh | sh`) + addon.py no Blender.
  Vale a pena na hora dos monumentos (Bloco 6), não antes.
- **Meshy MCP** — requer conta Pro + `MESHY_API_KEY`. Idem: só no Bloco 6.
- Skill WebGPU/TSL (dgreenheck/webgpu-claude-skill) — só quando o Bloco 5 começar
  (requer three r171+).

---

## Budget de frame (GTX 1650 @ 1080p — nossa GPU de referência local)

A GTX 1650 é ~15–20% mais fraca que a RTX 3050 usada na pesquisa; margens ajustadas:

| Etapa | ms estimado |
|---|---|
| 13k prédios instanciados + culled | 5–6 |
| Sombra da lua (1 cascade, 2048²) | 1.5 |
| Bloom seletivo + SMAA + LUT + vignette/grain | 2.0 |
| SSAO half-res | 1.5 |
| SSR half-res (só com chuva ativa) | 3.0 |
| Partículas GPU (chuva OU fumaça+vapor) | 1.5 |
| Física CPU (Gerstner probes + banking) | 0.3 (CPU, paralelo) |
| **Total pior caso (chuva + tudo)** | **~15ms** ✓ 60fps |

Regra: **SSR e chuva são o mesmo evento** (clima) — nunca somam com god rays de clima
seco. DPR adaptativo (Fase 6 do plano anterior) continua pendente e vira o seguro
de 60fps. Mobile: SSR→cubemap blur, sem god rays, SMAA only, DPR 1.25.

---

## Ordem de execução

```
BLOCO 0 (quick wins, ~3h)
  → BLOCO 1 (fundação de luz: sombra+AO+bloom seletivo+LUT)     ← "parece outro jogo"
  → BLOCO 2 (Fibonacci: setbacks φ, interior mapping, Vogel)    ← "parece caro"
  → BLOCO 3a (física visual: vento, banking, buoyancy, chuva)   ← "parece vivo"
  → BLOCO 4 (cinematografia: rua molhada, flares, height fog)   ← o vídeo viral
  → BLOCO 6 (assets/monumentos — habilita monetização Fase 7 do plano 1)
  → BLOCO 3b (Rapier worker + colliders)                        ← prepara exploração
  → BLOCO 5 (WebGPU/r185 — quando 0–4 estiverem colhidos)
```

Racional: 0→1 resolve os 3 assassinos da auditoria; 2 entrega a assinatura estética
(φ é a diferença entre "cidade genérica" e "cidade projetada"); 3a+4 constroem o
momento "chuva de néon" — o frame do post no X; 6 liga o negócio; 3b+5 são as
fundações do metaverso jogável.

## Métricas de aceite (herda as do plano 1, adiciona)

- [ ] Sombras visíveis e coerentes com a lua em qualquer ângulo
- [ ] Close-up de fachada aguenta screenshot 4K (interior mapping + atlas 256px)
- [ ] Neve NÃO blooma; janelas e néon SIM (bloom seletivo comprovado)
- [ ] Setbacks áureos visíveis na silhueta do downtown (comparar antes/depois)
- [ ] Parques em padrão phyllotaxis reconhecível de cima (`?view=top`)
- [ ] Evento de chuva: gotas GPU + rua espelhando néon + wipers de som futuro
- [ ] Árvores se movem; nenhum objeto orgânico 100% estático em frame algum
- [ ] 60fps na GTX 1650 local com tudo ligado exceto SSR; ≥50fps com chuva
- [ ] Teste final: estranho vê o vídeo e pergunta "que jogo é esse?"

---

## Notas de ambiente (inalteradas e sagradas)

- **Não rodar screenshots headless por software** na cena cheia — OOM mata o processo
  (ver cityupdate.md). Playwright MCP com GPU real + viewport pequena é o caminho novo.
- Gates seguros: `tsc`, validação da API por curl/node, e agora Playwright/GPU.
- Cuidado com `next dev` zumbis comendo RAM.
- Arquivos-alvo: `app/city/explore/city-3d.tsx`, `app/city/explore/city-environment.ts`,
  `app/api/city/data/route.ts`. A modularização proposta pela auditoria
  (`core/ + systems/ + data/`) deve acontecer **junto com o Bloco 1** — quebrar o
  monolito de 1500 linhas antes dos blocos 2–4 tocarem nele.
