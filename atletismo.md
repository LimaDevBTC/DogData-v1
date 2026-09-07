# DOG Athletics

Estádio aberto de atletismo do complexo esportivo da DogCity. Pista nominal de
400 m com oito raias, reta de 100 m, corredores de salto em distância/triplo,
salto com vara, salto em altura e áreas de lançamento. Não há campo, gols ou
marcação de futebol. Arquibancada com 18 fileiras e duas coberturas laterais;
capacidade de público não foi calculada nem publicada.

O desenho usa raio interno de 36,50 m, retas de 84,39 m e raias de 1,22 m. A
linha de medição da raia 1, a 0,30 m da borda, resulta em 400,0012 m no desenho
analítico. Referência dimensional: [guia de atletismo do governo da Austrália
Ocidental](https://www.cits.wa.gov.au/sport-and-recreation/sports-dimensions-guide/athletics-track-events).
A malha para navegador aproxima as curvas por segmentos; não é projeto de
homologação de instalação física.

## Endereço na cidade

`ATLETISMO_MOD = { i: 11, nr: 3, j: 42, ns: 2 }`: o bloco entre a avenida de 90°
e o $DOG ARENA, definido em `app/city/plaza/atletismo.ts`. Centro, giro e
polígono derivam de `caixaDoModulo`/`polyDoModulo`; nenhuma coordenada absoluta
assenta o prédio.

⚠️ **Mudou em 07/09/2026.** O primeiro endereço era `{i:15, nr:2, j:50, ns:3}`,
no anel de fora (r 4.042), 760 m da Geode e 926 m do futebol. Passava em toda a
verificação e ainda assim estava errado na chapa: as três arenas liam como três
ilhas soltas, cada uma com base de formato diferente, e aquele bloco tinha
466 × 895 m para uma peça de 320 × 240, ou seja a peça ocupava 18% dele. O sítio
novo põe as três no mesmo anel (r 3.294), 615,079 m uma da outra, dentro de uma
parcela só. O plano do conjunto está em `campus.md`.

Medição em 07/09/2026: centro derivado em (3.284,79; 246,16), rumo 94,286°,
615,08 m do $DOG ARENA e 1.224,79 m de THE GEODE. A implantação física mede
304 × 220 m; a verificação considera 320 × 240 m, e o pódio quadrado do campus
tem 344 m de lado. A peça tem 49,6 m de folga até a avenida de 90°, que é a via
grande mais próxima, e 250,9 m até a peça de programa mais próxima. Nenhum ponto
molhado.

O bloco não entra mais sozinho na máscara de parcelas das vias: quem entra é a
parcela do campus (`CAMPUS_MOD`), que cobre as três peças e apaga também as duas
ruas radiais que separavam uma da outra.

O terreno sob a peça é terraplanado na cota −26,0 m (terraço do campus), com
0,004 m de desnível residual em 19.481 sondas. O assentamento continua sondando
a superfície a cada 8 m incluindo as bordas, só que agora a superfície que ele
encontra é o topo do pódio, e a folga de pouso é 0,40 m. A saia de 5,5 m do
modelo fica enterrada.

O verificador cruza vias publicadas, avenidas ativas, anéis, autopistas, canais,
70 reservas publicadas, 69 reservas reencaixadas e a Sphere. O $DOG ARENA e THE
GEODE saíram da lista de ocupação porque agora dividem a parcela do atletismo por
construção; quem confere o conjunto é `scripts/city/verificar-campus.ts`. Não
regenera o loteamento nem fixa lotes de holders antes do snapshot; o gerador
futuro deve consumir também esta reserva.

## Modelo e carga

Gerador: `../blender/build_atletismo.py`. Fonte editável:
`../blender/dog-athletics.blend`. Exportação Draco, escala 1 unidade = 1 metro,
origem no centro da implantação, conversão Blender `(x,y,z)` → Three `(x,z,-y)`.
O script valida os orçamentos antes de publicar cada arquivo atomicamente.

| Fase | Arquivo | Transferência | Triângulos | Primitivas | Texturas |
|---|---|---:|---:|---:|---:|
| Base, todos os aparelhos | `dog-athletics-base.glb` | 59.816 bytes | 13.146 | 12 | 0 |
| Detalhe, desktop próximo | `dog-athletics-detail.glb` | 70.768 bytes | 13.296 | 7 | 0 |
| Total próximo no desktop | ambos | 130.584 bytes | 26.442 | 19 | 0 |

`atletismo-loader.ts` só inicia a base depois de a cidade abrir. O detalhe é
um arquivo separado, aditivo, solicitado após permanecer 600 ms a menos de
1.100 m da peça. Celular, qualidade baixa e economia de dados nunca o pedem.
O detalhe se oculta a 1.400 m e reaparece a 1.100 m, reutilizando o download.
A base permanece visível a até 4.700 m no celular e 7.000 m no desktop (eram
5.500 no sítio antigo; o corte acompanha o raio da peça sozinho).
O grupo é filho direto da cena, requisito para o cálculo de distância.

Os atributos descomprimidos ocupam 506.940 bytes na base e 724.416 bytes no
detalhe. Contando uma cópia no JavaScript e outra na GPU, são aproximadamente
0,97 MiB para a base; não inclui estruturas do renderer ou programas de shader.

Sem novas luzes, imagens ou trabalho de animação contínua. A sondagem de
distância roda cinco vezes por segundo. Os materiais recebem o ambiente da
cidade e aquecimento de shaders antes de aparecer. Falhas de rede são
isoladas e não bloqueiam o portão; resultados assíncronos tardios são
descartados ao sair da cena. `?atletismo=0` desliga peça e reserva de vias.

A arquibancada tem faces voltadas para dentro, validadas no gerador, e pisos
de concreto para reduzir padrões de interferência no mapa mobile. As nervuras
ficam sob as coberturas. A membrana projeta sombra, mas não recebe o mapa de
sombras global, evitando pontos pretos na superfície clara.

## Conferência

```bash
npx tsc --noEmit --incremental false -p tsconfig.json
npx tsx scripts/city/verificar-campus.ts
npx tsx scripts/city/verificar-atletismo.ts
npx tsx scripts/city/verificar-atletismo-carga.ts
node scripts/city/conferir-atletismo.mjs
node scripts/city/conferir-atletismo.mjs --mobile
```

Executar os dois últimos sequencialmente: uma cidade e um navegador por vez.
O portão usa o mesmo Playwright instalado de `scripts/city/chapas.mjs`, com
Chrome e aceleração gráfica. Bloqueia HMR somente na aba de conferência para
que edições paralelas não invalidem a carga. Espera `__plazaPronto` e fecha o
navegador no `finally`. Grava imagens, requisições,
contagem de primitivas/triângulos e console em `/tmp/dogcity-atletismo/browser/`.
O perfil mobile é emulado; não equivale a uma medição em telefone físico.

Conferência de 07/09/2026 aprovada em Chrome com GTX 1650: TypeScript,
implantação e ciclo de carga; no navegador, base solicitada após o portão,
um download no mobile e dois no desktop após aproximação, sem texturas da
peça, pedidos duplicados ou perda de contexto WebGL. Os testes de ciclo
cobrem também economia de dados, qualidade baixa, passagem rápida,
reaproximação, falha de rede e descarte durante uma carga pendente.

Evidências finais: [complexo](docs/atletismo/desktop-complexo.jpg),
[desktop próximo](docs/atletismo/desktop-perto.jpg),
[mobile próximo](docs/atletismo/mobile-perto.jpg),
[relatório desktop](docs/atletismo/desktop.json),
[relatório mobile](docs/atletismo/mobile.json) e
[orçamento dos modelos](docs/atletismo/modelo.json).

O console da cidade não está totalmente limpo: registrou descarte da obra
Winter Park por leitura de `pontos` em valor indefinido no módulo
`inverno-detalhe.ts`, além de avisos de dois props externos (`torch-pillar`
e `pedestal`). Esses módulos não foram alterados nesta frente. A falha não
impediu a conferência do estádio; os relatórios guardam o console completo
de erros e avisos. FPS mostrado nas imagens é da máquina de desenvolvimento,
não uma promessa para aparelhos móveis.

Entradas: `/city?view=atletismo&live=0`, `/city?view=atletismoalto&live=0`,
`/city?view=atletismoperto&live=0` e `/city?view=esportes&live=0`.
O menu Places inclui Sports district e DOG Athletics.

## Pesquisa de acervo

Busca feita na API oficial do Sketchfab em 07/09/2026. O [Low Poly Running
Race Track](https://sketchfab.com/3d-models/low-poly-running-race-track-game-ready-asset-23ec0c80500e4269976b6e434fab2f67)
(Jackson.Charles, CC-BY, 22.767 faces) inclui campo de futebol na descrição.
Os [assentos de anDDDres](https://sketchfab.com/3d-models/low-poly-stadiumsports-arena-seats-6bbe4c85d2a4489dbe5918831be5d886)
(CC-BY, 3.880 faces) são genéricos. Nenhum modelo foi incorporado: a construção
paramétrica permite controlar a pista e os dois orçamentos de carga.
