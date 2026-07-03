# DogCity — Plano de Evolução Visual & Metaverso (`cityupdate.md`)

> **Meta:** a cidade 3D mais foda que a crypto já viu. Nível de referência AAA,
> digna de post viral no X — e uma plataforma de monetização (monumentos,
> publicidade, claims de prédios) construída sobre dados reais de 89k carteiras $DOG.

---

## Referências de qualidade (a barra que estamos perseguindo)

| Referência | O que roubar dela |
|---|---|
| **Night City** (Cyberpunk 2077, CD Projekt Red) | Direção de arte noturna: neon em camadas, poluição luminosa, silhuetas contra névoa, densidade vertical do downtown. É a melhor cidade noturna já renderizada. |
| **NYC do Marvel's Spider-Man** (Insomniac) | Cidade *viva*: janelas com interiores falsos (parallax), tráfego contínuo, rooftop props (caixas d'água, antenas, AC). A tecnologia de "cidade que respira". |
| **Microsoft Flight Simulator / Google Earth** | Horizonte infinito: o mundo nunca "acaba", só se dissolve em névoa atmosférica. LOD agressivo — o que não se vê não é renderizado. |
| **Bruno Simon (bruno-simon.com) / demos pmndrs** | A barra do "uau" em WebGL no browser: interação lúdica + performance. Prova de que web 3D viraliza. |
| **The Sandbox / Decentraland / Otherside** | O que **não** fazer: mundos vazios sem dados reais. Nosso diferencial: cada prédio É uma carteira on-chain. Nenhum metaverso crypto tem isso. |

**Posicionamento:** "Night City construída a partir da blockchain" — dados reais,
estética AAA noturna, aberta no browser sem instalar nada.

---

## Estado atual (entregue até 2026-07-03)

- ✅ Cidade procedural: ~13k prédios instanciados, 10 distritos voronoi, click → carteira
- ✅ Água shader animada (lagos/rio/oceano): ondas, fresnel, especular lunar, espuma de margem
- ✅ Terreno ridged-noise com neve, vegetação de vale e rim de poluição luminosa
- ✅ Vegetação instanciada: pinheiros 3 camadas + copas largas (parques, margens, encostas)
- ✅ Céu gradiente + lua com halo; estrelas atrás do terreno
- ✅ Tráfego (faróis/lanternas) nas avenidas e pontes
- ✅ **Fase 0 — Mundo sem bordas**: fog casado com a cor exata do horizonte do céu
  (`FOG_COLOR 0x201822`), skirt de chão 24.000u, oceano 9.000×18.000u, 9 cordilheiras
  fantasma a 2.900–4.200u, grid de ruas cortado na costa
- ✅ **Hotfixes pós-review top-down (2026-07-03)**: pontes realinhadas às ruas reais
  (centerlines a `-1080 + 192k`; estavam 24u deslocadas — pareciam sair dos prédios);
  GridHelper decorativo substituído por **geometria de rua nas posições exatas do
  gerador** (vista de cima = malha viária, não xadrez); tráfego movido para as
  centerlines; borda plana dos patches de terreno dissolvida na cor do chão (fim do
  efeito "adesivo retangular" visto de cima)

Arquivos: `app/city/explore/city-3d.tsx` (cena), `app/city/explore/city-environment.ts`
(kit de ambiente), `app/api/city/data/route.ts` (gerador de layout).

**Dependências pesquisadas:** nada a instalar — three r162 embarca tudo
(GLTFLoader, postprocessing, RenderTarget). Opcional na Fase 3: `postprocessing`
(pmndrs) para bloom seletivo + SMAA de qualidade superior.

---

## Fase 1 — Malha urbana orgânica, estilo Tóquio (impacto: ★★★★★, esforço: L)

**A maior lição do review top-down:** cidade real vista de cima não é um tabuleiro.
O mapa de Tóquio é: contorno orgânico, avenidas radiais + anéis viários, grade local
distorcida, densidade que decai do centro, baía mordendo a costa. Tudo isso é
trabalho no **gerador** (`app/api/city/data/route.ts`), não no renderer.

1. **Contorno orgânico da cidade** — substituir o quadrado ±1200 por uma máscara
   `raio(θ) = R·(1 + 0.35·noise(θ))` (elipse deformada por ruído). Fora da máscara,
   densidade decai exponencialmente (subúrbios esparsos → zero). A cidade ganha
   penínsulas e reentrâncias como Tóquio.
2. **Rede viária hierárquica** (gerada como grafo, retornada pela API):
   - **2 anéis viários** (inner ring ~r400, outer ring ~r900) — polígonos suavizados
   - **6–8 avenidas radiais** saindo da Praça Satoshi até a borda
   - **Grade local distorcida** — domain warping: `(x,z) += noise_field(x,z)·A` com A
     crescendo do centro (downtown reto americano) para a periferia (orgânico japonês)
   - **Vias costeiras e marginais** — uma seguindo a curva da costa, duas seguindo o rio
   - **Diagonais** — 2–3 boulevards cortando a grade (efeito Broadway/Aoyama-dori)
3. **Quarteirões pelos vãos** — prédios preenchem os polígonos entre vias, rotacionados
   para alinhar com a via local mais próxima (hoje todos apontam para o norte)
4. **Densidade realista** — altura E densidade caem do centro: downtown vertical
   compacto → mid-rise → subúrbio de casas esparsas → campo
5. **API v2**: `roads: {class, polyline[]}[]` + `bridges[]` derivadas do grafo
   (ponte = aresta de via que cruza o rio ⇒ alinhamento perfeito por construção)
6. **Renderer**: vias como fitas emissivas com largura por classe (anel 32u, avenida
   24u, local 10u) — de cima, a cidade vira o mapa de Tóquio à noite; tráfego segue
   as polylines do grafo (curvas incluídas)

*Este rework elimina de vez a classe de bugs "ponte fora da rua" — a geometria
urbana inteira passa a derivar de uma única fonte de verdade (o grafo).*

## Fase 2 — Água nível AAA (impacto: ★★★★★, esforço: M)

O upgrade de maior retorno visual por hora investida.

1. **Reflexo real dos prédios na água** — CubeCamera 128px renderizada 1× no load
   (cidade é estática) → envMap no shader da água, modulado pelo fresnel. As torres
   do downtown refletidas no rio = o frame do post viral.
2. **Ondas Gerstner no oceano** — substituir fbm plano por 3 ondas Gerstner
   direcionais no vertex shader (plano com segmentos), quebrando perto da costa.
3. **Wakes/marolas** — anéis de propagação onde o rio encontra pilares de ponte.
4. **Barcos** — 6–10 barcos low-poly instanciados com luz de mastro (vermelho/verde),
   movendo devagar no oceano + 2 balsas cruzando o rio. Vida na água.

## Fase 3 — Cinematografia (impacto: ★★★★☆, esforço: M)

1. **Bloom seletivo por layers** — janelas/neon bloomam, neve e areia não
   (`npm i postprocessing`, trocar UnrealBloomPass por SelectiveBloomEffect + SMAA).
2. **Color grading** — LUT sutil teal-and-orange (é o esquema exato da cidade:
   janelas âmbar vs noite azul). ACESFilmic já ativo, falta o grade.
3. **Vignette + film grain leves** — mata o aspecto "render cru de WebGL".
4. **Lens flare anamórfico da lua** + streak horizontal nas luzes mais fortes.
5. **DOF no modo foto** (só quando parado — sem custo no orbit).

## Fase 4 — Cidade que respira (impacto: ★★★★★, esforço: L)

1. **Janelas piscando** — no shader das janelas, flicker por hash de instância
   (~1 janela muda por segundo na cena inteira; percepção de gente morando).
2. **Aviões** — 2–3 jatos cruzando alto com strobe branco + luzes de asa; 1
   helicóptero com searchlight sobre o downtown (o searchlight varrendo prédios
   é cinematográfico demais).
3. **Billboards LED** — telões animados (canvas texture com shader scroll) nas
   empenas das torres tier 7–9 do centro. *Base técnica da publicidade da Fase 7.*
4. **Rooftops** — antenas, caixas d'água, AC units, helipads instanciados nos
   topos por hash (tier alto = helipad, médio = caixa d'água). Mata o "caixote".
5. **Luzes vermelhas de obstáculo** piscando no topo das 20 torres mais altas.
6. **Postes de rua instanciados** nas avenidas principais (pontos âmbar, sem
   PointLight real — só sprite/emissive).

## Fase 5 — Relevo & natureza contínuos (impacto: ★★★★☆, esforço: M)

> Prioridade elevada após o review top-down: os patches de montanha ainda são
> "adesivos" (o rim já dissolve na cor do chão, mas o relevo não é contínuo).

1. **Terreno unificado** — hoje montanhas são "adesivos" no plano. Gerar um
   heightmap único de baixa amplitude para todo o chão (city plana, subúrbio
   ondulado, montanhas nas bordas) e assentar prédios/árvores/água nele.
2. **Costa orgânica** — a linha da costa é reta; curvá-la com noise (baías,
   penínsulas), praia acompanhando.
3. **Rio com nascente e foz** — o rio deve nascer na montanha sul (cachoeira
   pequena = billboard animado) e desaguar no oceano com delta.
4. **Nuvens** — 2 camadas de sprites volumétricos esparsos sobre os picos +
   nuvens finas iluminadas por baixo pela cidade (skybox vivo).

## Fase 6 — Performance & alcance (impacto: ★★★☆☆, esforço: M)

1. **LOD 2 níveis** — além de ~600u, trocar tier 0–3 por impostor plano emissivo.
2. **DPR adaptativo** — medir FPS 2s; <45fps → pixelRatio 1.25, sem bloom em mobile.
3. **Frustum culling por distrito** (BVH simples por bounding box de distrito).
4. **Preload + skeleton** — a cena monta em <2s percebido (dados já em cache).
5. Meta: 60fps desktop médio, 30fps mobile, sem jank no orbit.

## Fase 7 — Monumentos, publicidade & metaverso $DOG (impacto: ★★★★★, esforço: L)

A camada de negócio. A cidade vira mídia + token sink.

**Inventário de espaços (escasso por design):**
| Espaço | Qtd | O quê |
|---|---|---|
| **Praça Satoshi** (centro) | 1 | Monumento âncora — o "Times Square" da DogCity |
| **Orla do oceano** | 6 | Monumentos frente-mar (vistos de todo o oeste) |
| **Mirante da montanha sul** | 1 | Letreiro estilo Hollywood — visível da cidade inteira |
| **Ilhas do rio** | 3 | Monumentos médios nas curvas do rio |
| **Billboards LED downtown** | 12 | Telões animados das torres (Fase 4.3) |
| **Naming rights de distrito** | 10 | "Distrito X apresentado por…" no sidebar + placa 3D |

**Tiers de patrocínio (preços em DOG, ajustáveis):**
- **Billboard LED** — arte animada 30d: aluguel mensal (ex.: 100k DOG/mês)
- **Monumento** — modelo GLTF custom aprovado, 90d–1a (ex.: 1M DOG)
- **Landmark permanente / naming rights** — leilão (ex.: 5M+ DOG)
- **Claim de prédio** (holders): 10k DOG "recognized" (X handle no painel da
  carteira) / 50k DOG "commercial" (loja futura) — já especificado, ver memória
  do projeto: verificação por pagamento originado da própria carteira via indexer
  Ord/Metashrew + tabela Supabase `dogcity_claims`.

**Pipeline técnico:**
1. `public/data/city-monuments.json` — registry (plot id, sponsor, gltf url,
   billboard texture url, expiry) servido por `/api/city/monuments`
2. Render: GLTFLoader (já no three) com budget por asset (≤15k tris, ≤2 texturas
   1024², KTX2 se possível); billboards = CanvasTexture/VideoTexture
3. Placeholder bonito nos plots vagos: hologramas "AVAILABLE — YOUR PROJECT HERE"
   girando (o placeholder em si já é marketing)
4. Admin: aprovação manual de assets antes de entrar no registry (curadoria de
   qualidade + brand safety)
5. Painel de clique do monumento: logo, link, X handle do patrocinador

## Fase 8 — Viralização (impacto: ★★★★★, esforço: S–M)

O que transforma qualidade em alcance:

1. **Flythrough cinematográfico** — botão "▶ Tour": câmera em spline (costa →
   mergulho no rio sob as pontes → subida em espiral no downtown → revelação da
   cidade inteira contra as montanhas). 30s, easing perfeito. *É o vídeo do post no X.*
2. **Modo foto** — pausa, esconde UI, DOF, render 4K offscreen, watermark
   discreto `dogdata.xyz/city` → download PNG.
3. **Find your building** — colar endereço/handle → câmera voa até o prédio +
   spotlight. Cada holder posta o próprio prédio = viral loop distribuído.
4. **Deep links** — `/city/explore?wallet=…` e `?district=…` com OG image
   renderizada (screenshot do prédio) para preview rico no X.
5. **Eventos ao vivo** — transação grande on-chain → o prédio correspondente
   pulsa + beacon de luz por 30s ("a cidade reage à chain em tempo real").

---

## Ordem de execução recomendada

```
Fase 1 (malha urbana Tóquio)  →  Fase 2 (água AAA)  →  Fase 4 (cidade viva)
  →  Fase 3 (cinematografia)  →  Fase 8 (viralização)  →  Fase 7 (monetização)
  →  Fase 5/6 (relevo contínuo + performance)
```

Racional: a Fase 1 corrige a *fundação* (nenhum polish esconde um layout de
tabuleiro — foi a lição do review top-down); 2+4+3 constroem o vídeo viral;
8 o distribui; 7 monetiza a atenção gerada; 5–6 sustentam o crescimento.
Billboards (4.3) já nascem prontos para a Fase 7 — construir uma vez, vender depois.

## Métricas de "pronto para o X"

- [ ] Nenhuma borda de mundo visível em qualquer ângulo/zoom permitido
- [ ] Água indistinguível de referência AAA em screenshot estático
- [ ] 3+ elementos em movimento em qualquer frame (tráfego, água, aviões, billboards)
- [ ] Flythrough 30s gravável direto da tela sem edição
- [ ] 60fps em desktop médio (M1 / RTX 3050)
- [ ] Um estranho vendo o vídeo pergunta "que jogo é esse?" — teste final
