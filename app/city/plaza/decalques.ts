// ═══════════════════════════════════════════════════════════════════════════
// OS DECALQUES DE CHÃO: a especificidade que nenhum chão da cidade tem hoje.
//
// ⚠️ ESTE MÓDULO É O EMPREGO NOVO DE lotes.ts. `lotes.ts` (568 linhas) media a
// demarcação dos 52.984 lotes e não era importado por ninguém: em 30/08 o
// fundador decidiu que o lote NÃO APARECE (a cidade mostra infraestrutura, não
// divisa, porque nada foi mintado ainda), e a decisão foi reafirmada em 02/09.
// O que sobrevive dali não é o código, é a TÉCNICA, e ela já veio medida:
//
//   decal projetivo:  30,03 ms POR PEÇA (26,5 min de CPU pra cidade inteira)
//   atlas de textura por peça: 1,24 gigatexel (um atlas do tamanho da cidade)
//   quad instanciado, desenho no fragmento: 0,47 a 0,66 ms pra 52.984 peças
//
// A terceira opção venceu lá e vence aqui. A diferença é COMO o fragmento
// desenha: `lotes.ts` calculava a divisa por SDF (distância até a borda, em
// GLSL, sem textura nenhuma). Aqui o desenho é grande demais em variedade
// (remendo, trinca, tampa, poeira, ejecta...) pra valer a pena como fórmula;
// em vez disso um ATLAS ÚNICO de 2048×2048 (16 células de 512²) é gerado uma
// vez em canvas, como `materiais.ts` já faz pras seis superfícies, e cada
// instância escolhe uma célula. Nada de PNG no bundle, nada de rede.
//
// ⚠️ MeshStandardMaterial COM onBeforeCompile, E NÃO ShaderMaterial CRU, pelo
// mesmo motivo de `lotes.ts`: onBeforeCompile sobre o Standard entrega sombra
// recebida, log-depth, tonemapping, espaço de cor e o ambiente lunar de
// graça. Um ShaderMaterial cru reescreveria os seis includes à mão e ainda
// divergiria da resposta de luz do terreno e da via. Continua 1 material, 1
// programa (`customProgramCacheKey` fixo).
//
// ── POR QUE UM ATLAS AQUI NÃO É O "1,24 GIGATEXEL" QUE lotes.ts REJEITOU ────
// O número rejeitado era um atlas com espaço PRÓPRIO por lote (52.984 peças
// de testada variável, 6 a 168 m). Aqui o atlas é COMPARTILHADO: 16 receitas
// fixas, reaproveitadas por até 20.000 instâncias via um índice de célula por
// instância. O atlas custa 2048² × 4 bytes = 16.777.216 bytes = 16,0 MiB
// (≈21,3 MiB com a cadeia de mipmap, 4/3 do base). Isso é FIXO,
// independente de quantas instâncias existem: é o preço de 16 receitas, não
// de 20.000 peças.
//
// ── A GEOMETRIA: MAIS SIMPLES QUE lotes.ts, E É DE PROPÓSITO ────────────────
// `lotes.ts` amarrava os QUATRO CANTOS do quad na malha do terreno (bilinear)
// porque um lote mede até 168 m e cruza vários triângulos de 59 m — plano
// teria deixado o terreno "passar por cima" do lote em até 3,3 m no pior
// caso. O maior decalque daqui mede 3,0 × 0,5 m: sobre um triângulo de 59 m
// isso é ruído. Um único plano TILTADO a partir do gradiente local (altura
// central + duas amostras de `heightAt`, um passo de 0,4 m) já cobre o caso:
// com a inclinação medida em lotes.ts (mediana 1,72°, p95 3,80°, máximo
// 6,11°), o pior erro de um plano tiltado sobre 1 m de meio-raio é
// tan(6,11°) × 1 m ≈ 10,7 cm SEM tilt (chapado) e ≈ 0 por construção COM
// tilt (o plano É a tangente local). Por isso aqui são 3 chamadas de
// `heightAt` por instância (centro, +X, +Z), não 4 cantos + 5 sondas como em
// lotes.ts: o decalque é pequeno demais pra cruzar a diagonal de um triângulo
// de 59 m, que era o problema que as 5 sondas de lotes.ts resolviam.
//
// ── A BANDEIRA É `?decalque=1`, PRÓPRIA, NÃO `?look=2` ─────────────────────
// O bot de auto-commit publica pra `origin/main` de hora em hora. Como
// `look.ts` e `materiais.ts` (`?relevo=1`), um sistema de decalque inteiro
// não estreia sem o fundador ver a chapa antes de virar padrão pro visitante
// da hora seguinte.
//
// ── O CONSTRUTOR NUNCA VARRE: A VARREDURA É FATIADA EM `atualizar` ─────────
// ⚠️ DEFEITO MEDIDO PELO FUNDADOR (03/09), E CORRIGIDO. A primeira versão
// deste módulo fazia a varredura inteira (≈7.854 células, cada uma com hash,
// `heightAt` e `naVia`/`sobreQue`) DENTRO do construtor, síncrona. Enquanto só
// a zona 'regolito' nascia (antes de `naVia` chegar pela opção) o custo era
// pequeno e passava despercebido; assim que a máscara de via ligou, o custo
// real apareceu: com `?decalque=1`, o portão de carga da cidade não abria em
// 600 s, sem erro de console — porque o portão espera a promessa que monta a
// cidade, essa promessa espera o construtor deste módulo, e o construtor não
// devolvia o controle até varrer tudo.
//
// A correção não foi otimizar a varredura, foi tirá-la do caminho crítico:
// `buildDecalques` devolve NA HORA, com o grupo vazio e a malha de 0
// instâncias, e quem varre é `atualizar(camera)`, chamado por quadro pelo
// laço de animação da cena — que não é esperado por promessa nenhuma. A
// varredura roda em FATIAS orçadas por tempo (`ORCAMENTO_QUADRO_MS`, medido
// com `performance.now()` a cada `CHECA_A_CADA` células, não a cada uma, pra
// não pagar o relógio mais do que o trabalho): quando o orçamento da fatia
// estoura, o laço para e retoma exatamente de onde parou no quadro seguinte.
// As instâncias já escritas ficam visíveis a cada fatia (`geo.instanceCount`
// sobe aos poucos): o decalque aparece aos poucos depois que a cidade abre,
// nunca trava o portão. Se a câmera andar muito no meio de uma varredura, ela
// termina com a âncora com que começou e a PRÓXIMA varredura (dispara
// sozinha, no quadro seguinte) já nasce centrada na posição nova — atraso de
// alguns quadros, nunca abortada no meio de uma perseguição rápida de câmera.
//
// A cada varredura fechada, o console publica células varridas, instâncias
// nascidas e milissegundos totais — o equivalente do `mascaraMs` que
// `vias.ts` já publica, sem o qual ninguém, nem quem escreve o módulo, sabe
// se o tamanho da fatia está certo.
//
// ⚠️ A GERAÇÃO DO ATLAS CONTINUA SÍNCRONA NO CONSTRUTOR, DE PROPÓSITO — ela
// NÃO era a causa do bloqueio (a comparação do fundador isolou a variável:
// só ligar `naVia` travou o portão, e a geração do atlas roda igual nos dois
// lados da comparação). É custo FIXO (12 receitas em células de 512², a
// mesma ordem de grandeza do que `materiais.ts` já gera síncrono no boot da
// cena pras seis superfícies), não custo que cresce com o tamanho da
// cidade — fatiar não muda o comportamento no limite, só complicaria o
// código. O que crescia sem limite era a varredura por célula do mundo, e é
// só ela que saiu do construtor.
//
// ── O CUSTO POR CÉLULA, MEDIDO: 1,73 ms, E A CAUSA É CRUZADA ────────────────
// ⚠️ MEDIDO PELO FUNDADOR (03/09), COM O FATIAMENTO JÁ NO AR: o portão abre,
// mas a primeira varredura de verdade (10.201 células, raio 300 m) mediu
// 17.689,5 ms TOTAIS, ou seja 1,73 ms POR CÉLULA — um hash, uma consulta de
// altura e uma de máscara deveriam custar microssegundos, não milissegundos.
// A 2,5 ms de orçamento por quadro, uma varredura inteira levava perto de
// dois minutos de RELÓGIO pra fechar, e recomeçava do zero a cada 40 m de
// câmera: na prática a rua nunca ficava povoada, mesmo com o portão aberto.
//
// A causa é CRUZADA, e só existe porque cinco frentes rodam juntas: a frente
// de terreno fino somou micro-relevo dentro de `heightAt`, e esse
// micro-relevo é ZERO sob pavimento — o que ela resolve consultando
// `vias.naVia` DE DENTRO de `heightAt`, mais um fbm de várias oitavas. Nada
// disso aparece no código DESTE módulo; só aparece no tempo que a chamada
// devolve. Por célula, o custo pago aqui era: a NOSSA chamada de `naVia`
// (até duas, pra classificar via/borda/regolito), mais a NOSSA chamada de
// `heightAt` — que por dentro chama `naVia` de novo E roda o fbm — TRÊS
// vezes (centro, +X, +Z, pro gradiente), e só nas células que passam no
// sorteio de densidade.
//
// ⚠️ PRIMEIRO PASSO: INSTRUMENTAR, NÃO ADIVINHAR. Antes de cortar qualquer
// chamada, o módulo passou a medir, com `performance.now()` em volta da
// FRONTEIRA de cada família (o que ESTE módulo chama; o que roda dentro de
// `heightAt` é conta de outra frente e cai junto no balde dela, de
// propósito — é o tempo que ELE devolve que importa aqui, não uma auditoria
// do código alheio): `msMascara`/`nMascara` (naVia + sobreQue, que ainda não
// chegou) e `msAltura`/`nAltura` (heightAt). A cada varredura fechada, o
// console publica os três baldes (máscara, altura, resto) e o custo por
// célula — sem esse número, o próximo corte seria chute igual ao primeiro.
//
// SEGUNDO PASSO: OS CORTES ÓBVIOS, SEM TOCAR NO QUE ESTÁ CERTO.
//   1. `naVia` agora é consultado com a folga LARGA primeiro. A maioria das
//      células cai longe de qualquer via — regolito aberto — e o código
//      velho pagava DUAS chamadas (folga 0 falha, depois FOLGA_BORDA falha)
//      pra chegar nessa conclusão. Testando a folga larga primeiro, o caso
//      majoritário resolve com UMA chamada; só a minoria dentro da folga
//      paga a segunda, que distingue via exata de faixa de borda.
//   2. `heightAt` já era chamado só DEPOIS do sorteio de densidade passar
//      (ver `amostrarAltura`, sempre foi assim) — ou seja das 10.201
//      células só as ~675 que de fato ganham decalque pagam as três
//      chamadas. Essa parte não precisou de correção, só de confirmação:
//      o número "93% de desperdício" da hipótese do fundador era condicional
//      ("SE você está chamando antes de decidir") e a resposta medida é que
//      não estava.
//   3. `CHECA_A_CADA` caiu de 64 pra 1 (ver a constante): 64 só fazia
//      sentido se a célula custasse microssegundos; a 1,73 ms por célula,
//      64 delas estouravam o orçamento de 2,5 ms por QUARENTA E QUATRO
//      vezes antes de o relógio ser sequer consultado — o oposto do que o
//      fatiamento existe pra evitar. Isto sozinho já deveria encolher o
//      engasgo por quadro em ordem de grandeza, independente de onde o
//      tempo por célula estiver indo.
//
// ⚠️ TERCEIRO PASSO, QUE ESTE MÓDULO NÃO FAZ SOZINHO: remedir. A regra da
// casa proíbe abrir navegador; o número novo por célula, e se ele já é
// aceitável, é o fundador quem publica na próxima chapa. Se depois da
// instrumentação e dos três cortes o custo continuar alto, o log agora
// aponta ONDE (máscara, altura ou resto), o que faltava pra saber.
//
// ⚠️ E A CONTAGEM POR ZONA (via/borda/regolito) FOI JUNTO, por uma pergunta
// separada que o fundador levantou: 675 instâncias em 10.201 células com
// raio de 300 m PARECE pouco pra uma rua que devia ter remendo e junta
// visíveis. Isso pode ser a densidade orçada funcionando exatamente como
// escrito sobre uma área que É majoritariamente regolito aberto (via real
// ocupa uma fração pequena de qualquer disco de 300 m — é largura de rua
// contra área de quarteirão), não um defeito de densidade. O log agora
// publica quantas células caíram em cada zona ANTES do sorteio: se
// `regolito` domina de forma desproporcional à área real de via dentro do
// raio, a resposta é RAIO ou POSIÇÃO DE PARTIDA, não densidade — e isso
// também só se decide olhando o número, não confiando na primeira leitura.
//
// Three.js puro (regra da casa: nada de react-three-fiber).
// ═══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three'

// ── o catálogo, e ele é LUNAR ────────────────────────────────────────────
// Não há chuva, não há erosão de vento, não há mato na junta. FORA: poça,
// musgo, mancha de água, folha seca, limo — tudo o que pede clima que a Lua
// não tem. DENTRO, o que aquele chão de fato faria:
//
//   remendo de pavimento (borda irregular + junta de execução), em duas
//     silhuetas (redondo e vala alongada, a "remendo-vala")
//   junta de concretagem da calçada / trinca de retração, em duas silhuetas
//     (junta reta + ramo, e trinca solta só ramificada)
//   tampa de poço, grelha de boca de lobo, caixa de inspeção
//   poeira de regolito acumulada no pé do meio-fio e na sarjeta
//   rastro de pneu de rover e trilha de pisada nos atalhos que a teia não
//     previu
//   ejecta clara ao redor de cratera pequena
//   pintura de faixa desgastada (gasta na trilha de roda, inteira no
//     acostamento)
//
// ⚠️ `naVia` NÃO DISTINGUE PISTA DE CALÇADA, SÓ "É VIA" DE "NÃO É VIA" — E
// ISSO JÁ TEM PONTE PRONTA PRA QUANDO MUDAR. A consulta que existe hoje
// (`vias.naVia`) devolve um booleano único pra pista, sarjeta E calçada
// juntas (ver o comentário dela em vias.ts); por isso remendo de asfalto e
// junta de calçada competem pela mesma zona larga ('via') no caminho sem
// `sobreQue`. A frente de vias está preparando `sobreQue(x, z)`, devolvendo
// `'pista' | 'sarjeta' | 'calcada' | null`, e este módulo já aceita essa
// opção (`DecalquesOpts.sobreQue`, ver abaixo): quando ela chegar, cada tipo
// do catálogo já sabe em qual das três superfícies finas nasce
// (`TipoDecal.superficies`) e o caminho largo por `naVia` vira só o
// FALLBACK pra quando `sobreQue` não vier ou devolver `null` (fora de
// via — aí quem decide continua sendo `naVia` com folga, como hoje). Nada
// neste módulo precisa mudar de novo quando a outra ponta ligar; troca-se
// só o valor da opção na chamada de `buildDecalques`, em `plaza-scene.tsx`.
//
// ⚠️ "EJECTA AO REDOR DE CRATERA" NÃO ESTÁ ANCORADA EM CRATERA DE VERDADE. As
// 56 crateras carimbadas da receita de regolito foram REMOVIDAS em 01/09
// (ver materiais.ts, amostraRegolito) e nenhuma posição real de cratera
// pequena é publicada em lugar nenhum do terreno hoje. O decalque de ejecta
// existe, mas espalhado no regolito por hash, não em volta de uma cratera
// que exista na malha. NÃO DISPONÍVEL até o terreno publicar posição de
// cratera.
//
// ⚠️ A "TRILHA DE PISADA" TAMBÉM É APROXIMAÇÃO. Um atalho de verdade nasce de
// tráfego simulado que este módulo não tem. Aqui ela é uma faixa compactada
// espalhada por hash no regolito longe da via — lê como "caminho gasto" de
// longe, não é literalmente o rastro de ninguém.
//
// ⚠️ "FAIXA DE PINTURA" NÃO SABE A DIREÇÃO DA PISTA. Orientar a faixa ao
// longo do eixo real da via pediria o rumo local, que `naVia` não devolve
// (só booleano). Aqui ela nasce com rotação aleatória por célula, como
// qualquer outro tipo da zona 'via' — plausível como remendo de pintura
// isolado, não como uma faixa contínua acompanhando a pista.
//
// ── COMO A REPETIÇÃO FOI QUEBRADA (a regra que materiais.ts já escreveu:
// "um ladrilho só pode conter o que o olho não consegue identificar
// individualmente" — um decalque TEM posição, mas se o mesmo remendo
// aparecer 20 vezes na quadra o efeito é o mesmo carimbo) ──────────────────
//   1. DUAS SILHUETAS por categoria maior (remendo e junta/trinca têm cada
//      uma duas receitas de atlas), escolhidas por hash da célula.
//   2. ROTAÇÃO contínua 0..2π por instância.
//   3. ESPELHO (flip de U) por instância: dá uma segunda leitura de graça
//      pras formas assimétricas (grelha, faixa, remendo-vala).
//   4. ESCALA 0,85 a 1,15 por instância.
//   5. TINTA por instância (±8% por canal), como `lotes.ts` fazia pro MIOLO.
//   6. DENSIDADE BAIXA por zona (11,25% via, 78,75% borda, 2,25% regolito —
//      ver DENSIDADE abaixo, já reajustada pro passo de 6 m): a mesma
//      quantidade de decalque por metro quadrado de antes da correção do
//      jitter, ver a seção seguinte.
//   7. JITTER DENTRO DA CÉLULA (ver a seção seguinte): sem ele, a grade
//      regular por si só desenha um RITMO reconhecível mesmo com forma e
//      cor variando — o mesmo erro das 56 crateras carimbadas de
//      materiais.ts, só que na cadência da colocação, não no desenho.
//
// ── O ARTEFATO DE TRANSPARÊNCIA, E COMO ELE FOI EVITADO ─────────────────────
// Decalque de chão empilhado é o caso clássico de "transparência sem ordem":
// `THREE.InstancedMesh`/`InstancedBufferGeometry` NÃO ordena instâncias por
// profundidade entre si, só o OBJETO inteiro entra na fila de transparência
// ordenada por distância à câmera. Se duas instâncias desta malha ocupassem
// o mesmo fragmento, a ordem de desenho entre elas seria a ordem do índice,
// arbitrária, e o resultado piscaria ao mover a câmera.
//
// ⚠️ A PRIMEIRA VERSÃO GARANTIA "NUNCA HÁ SOBREPOSIÇÃO" COM CENTRO FIXO NO
// MEIO DE CADA CÉLULA, SEM JITTER, E ISSO ERA A LIÇÃO CERTA APLICADA NO
// LUGAR ERRADO. A garantia geométrica estava correta; a consequência não:
// colocação presa a uma grade regular DESENHA A GRADE. Com 35% de densidade
// na borda, a poeira do pé do meio-fio caía a cada 4 m com regularidade de
// régua, e a 1,7 m o olho lê isso na hora — o mesmo defeito das 56 crateras
// carimbadas removidas de materiais.ts em 01/09, só que repetindo o RITMO
// da colocação em vez do DESENHO do carimbo. "Um ladrilho só pode conter o
// que o olho não identifica individualmente" vale igual pra posição: uma
// grade sem jitter é tão identificável quanto uma cratera copiada e colada.
//
// A saída é GRADE ESTRATIFICADA COM JITTER LIMITADO: cada célula ainda dá
// no máximo um decalque (a estratificação, que é o que evita amontoado),
// mas o centro anda dentro de um disco de raio `r` ao redor do centro da
// célula em vez de ficar cravado nele. `r` tem que ser pequeno o bastante
// pra dois vizinhos ORTOGONAIS na grade (distância de centro a centro =
// passo `P`, no pior caso) nunca se tocarem, mesmo se os dois forem o maior
// decalque do catálogo (diagonal `D`) e o jitter empurrar os dois um contra
// o outro:
//
//     centro a centro no pior caso = P − 2r  ≥  D   ⟺   r ≤ (P − D) / 2
//
// Com o passo antigo (P = 4,0 m) e D = 3,04 m (a faixa desgastada,
// 3,0 × 0,5 m, o maior decalque do catálogo — o segundo é o rastro de
// pneu, 2,6 × 1,4 m, diagonal 2,95 m), o jitter seguro era r ≤ 0,48 m: de
// menos de meio metro, pouco pra disfarçar a régua. Abrindo o passo pra
// P = 6,0 m, com o MESMO D = 3,04 m, o limite sobe pra r ≤ 1,48 m — mais de
// 3× o raio anterior, e agora o jitter é grande o bastante pra apagar a
// grade a olho. `JITTER_R = 1,40 m` fica um pouco abaixo do limite teórico
// (0,08 m de folga sobre o arredondamento de ponto flutuante do seno e
// cosseno da amostragem em disco).
//
// O jitter sai do MESMO hash determinista da célula que já escolhe tipo,
// rotação, escala, espelho e tinta (salts 9 e 10 de `hashCelula`, amostragem
// UNIFORME EM DISCO — ângulo de um hash, raio de `JITTER_R · √h` do outro,
// não `JITTER_R · h` sem raiz, que empilharia ponto perto do centro porque
// área cresce com o raio ao quadrado). A mesma célula (ci, cj) cai sempre no
// mesmo ponto jitterado, em toda sessão: nada armazenado, nada carregado, a
// garantia de determinismo do cabeçalho continua de pé.
//
// O passo maior (6,0 m em vez de 4,0 m) sobe a área por célula de 16 m²
// pra 36 m², 2,25×, e é por isso que `DENSIDADE` também sobe 2,25× abaixo:
// a MESMA quantidade de decalque por metro quadrado de antes, numa grade
// mais larga com folga pro jitter.
//
// O que sobra é o encontro com o CHÃO por baixo (terreno, via, lote): esse
// caso é o mesmo que `lotes.ts` já resolveu, e a resposta é a mesma —
// ALTURA, não profundidade de rasterizador. `ALTURA_DECALQUE = 0,02 m`
// reaproveita a constante medida em lotes.ts (segura de 300 a 9.000 m com
// buffer de profundidade logarítmico desligado, que é o padrão desta cena
// desde que `near` passou a acompanhar a distância). `depthWrite: false` +
// `transparent: true` deixam a borda do decalque suave (a receita entrega
// alfa gradiente, não recortado) sem gerar zbuffer competindo consigo mesma.
//
// ⚠️ RISCO RESIDUAL, DECLARADO E NÃO CONSERTADO: SANGRAMENTO DE MIPMAP NO
// ATLAS. Cada receita já deixa uma margem de 10 a 20% até a borda da própria
// célula (nenhuma vai a alfa > 0 encostada no limite 0..1), o que cobre a
// maioria dos níveis de mipmap intermediários. Mas em mips muito grosseiros
// (a malha inteira do atlas cabendo em poucos texels) qualquer decalque já
// está pequeno demais pra o olho notar a cor errada. NÃO MEDIDO na tela: se
// aparecer halo de cor vizinha na borda de um decalque visto de longe, o
// conserto é encolher a margem de amostragem de UV por célula (deixar de
// amostrar os últimos 2 a 4 texels de cada lado) ou desligar mipmap abaixo
// de um nível — nenhum dos dois está feito aqui.
// ═══════════════════════════════════════════════════════════════════════════

export interface DecalquesOpts {
  /** ⚠️ Mesma exigência de lotes.ts: use `terrain.superficieAt`, que é o
   *  plano que a malha do terreno realmente desenha, não `heightAt` cru. */
  heightAt: (x: number, z: number) => number
  /** A mesma máscara que a arborização usa (vias.naVia). Sem ela E sem
   *  `sobreQue`, só a zona 'regolito' nasce (rastro, trilha, ejecta) — ver a
   *  nota longa acima sobre `naVia` não distinguir superfície. Continua
   *  sendo o FALLBACK de `sobreQue` pro que cai fora de via. */
  naVia?: (x: number, z: number, folga?: number) => boolean
  /** ⚠️ PONTA PREPARADA, AINDA NÃO LIGADA (02/09). A frente de vias vai
   *  publicar esta consulta fina; quando vier, cada tipo do catálogo já
   *  sabe em qual superfície nasce (`TipoDecal.superficies`) e o balde
   *  largo por `naVia` vira só o fallback pro que `sobreQue` devolve `null`
   *  (fora de via). Sem ela, o módulo funciona exatamente como hoje — não
   *  precisa voltar a este arquivo quando a outra ponta ligar, só passar o
   *  valor na chamada de `buildDecalques`. */
  sobreQue?: (x: number, z: number) => Superficie | null
  sombra?: boolean
  /** raio do anel de detalhe, em metros. ⚠️ NÃO HÁ AINDA UM `R_DET`
   *  COMPARTILHADO PELA CENA (conferido: nenhum módulo declara essa
   *  constante hoje). O valor de partida do plano da fundação é 300 m,
   *  repetido aqui como padrão isolado; quando a cena ganhar um R_DET
   *  próprio e medido no Bloco 0, é ESTE campo que recebe o valor dela. */
  raio?: number
}

export interface Decalques {
  group: THREE.Group
  /** quantas instâncias estão desenhando agora (muda a cada `atualizar`) */
  instancias: number
  /** teto duro: 20.000 × 2 tri = 40.000 triângulos, sempre, em 1 chamada */
  triangulosMax: number
  /** memória do atlas, com mipmap, em MiB — fixa, não cresce com instância */
  atlasMiB: number
  /** Chame no laço de quadro. Só COMEÇA uma varredura nova quando a câmera
   *  anda mais que PASSO_REFAZ (o padrão de `mobiliario-urbano.ts`); a
   *  varredura em si é FATIADA por orçamento de tempo (ORCAMENTO_QUADRO_MS
   *  por quadro, ver o cabeçalho) e pode levar vários quadros pra fechar —
   *  o construtor NUNCA varre, só este método varre. */
  atualizar(camera: THREE.Camera): void
  dispose(): void
}

// ── a bandeira ──────────────────────────────────────────────────────────
// ⚠️ ATRÁS DE `?decalque=1`, PRÓPRIA DESTE MÓDULO. O bot de auto-commit
// publica de hora em hora; um sistema de decalque inteiro, novo, não visto
// pelo fundador numa chapa, não pode estrear ligado por padrão.
const DECALQUE_ON =
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('decalque') === '1'

// ── as cotas medidas ou herdadas ──────────────────────────────────────────
/** herdado de lotes.ts, mesma medição: segura de 300 a 9.000 m sem cintilar */
const ALTURA_DECALQUE = 0.02
/** passo da amostra de gradiente. Pequeno porque o maior decalque mede 3 m:
 *  um passo maior que meio decalque leria a inclinação do QUARTEIRÃO vizinho,
 *  não a do próprio pé. */
const PASSO_GRAD = 0.4
/** teto duro de instâncias — ver o orçamento no cabeçalho */
const TETO = 20000
/** passo `P` da grade estratificada, em metros. ⚠️ NÃO É GOSTO, É METADE DA
 *  DESIGUALDADE DE JITTER — ver a nota longa do cabeçalho sobre o artefato
 *  de transparência: com a maior diagonal do catálogo D = 3,04 m, o jitter
 *  seguro é r ≤ (P − D) / 2. P = 4,0 m só permitia r ≤ 0,48 m, pouco demais
 *  pra apagar a régua da grade; P = 6,0 m libera r ≤ 1,48 m. */
const PASSO = 6.0
/** raio de jitter dentro da célula, em metros: r ≤ (PASSO − D) / 2 =
 *  (6,0 − 3,04) / 2 = 1,48 m; usa-se 1,40 m, com 0,08 m de folga sobre o
 *  limite teórico pra absorver o arredondamento de ponto flutuante do
 *  seno/cosseno da amostragem em disco. Sai do MESMO hash da posição
 *  (salts 9 e 10 de `hashCelula`): estável entre sessões, como todo o resto. */
const JITTER_R = 1.40
/** raio de partida do anel de detalhe. NÃO MEDIDO como constante de cena —
 *  ver a nota em DecalquesOpts.raio. */
const RAIO_PADRAO = 300
/** a câmera precisa andar isto pra lista de decalques ser refeita. Maior que
 *  o PASSO_REFAZ de 30 m do mobiliário (mobiliario-urbano.ts) porque o
 *  laço daqui varre uma grade contínua (ver o orçamento no relatório), não
 *  uma lista de postes já filtrada por avenida: NÃO MEDIDO o custo real de
 *  um refazimento, este número é uma escolha conservadora, não uma medição. */
const PASSO_REFAZ = 40
/** orçamento de tempo por FATIA da varredura, em ms — não confundir com
 *  PASSO_REFAZ (que decide QUANDO uma varredura nova começa). O fundador
 *  pediu "algo como 2 a 3 ms, medido com performance.now()"; 2,5 m fica no
 *  meio, e é o mesmo valor a reduzir se a chapa mostrar engasgo mesmo assim
 *  (NÃO MEDIDO em navegador). */
const ORCAMENTO_QUADRO_MS = 2.5
/** quantas células rodam entre uma checagem de relógio e outra, dentro de
 *  uma fatia.
 *
 *  ⚠️ ERA 64, E A SUPOSIÇÃO POR TRÁS DISSO CAIU MEDIDA (03/09). O comentário
 *  antigo achava que a célula custava "poucos microssegundos" e por isso
 *  amortizava `performance.now()` a cada 64. A primeira chapa com `naVia`
 *  de verdade mediu 1,73 ms POR CÉLULA em média — quatro ordens de grandeza
 *  acima do suposto. Com 64 células a esse custo, uma fatia só CHECAVA o
 *  relógio depois de já ter gasto ≈110 ms (64 × 1,73 ms), 44× o orçamento
 *  de 2,5 ms de ORCAMENTO_QUADRO_MS: a fatia estourava o quadro por engano,
 *  o oposto do que o fatiamento existe pra evitar. A 1, o pior excesso
 *  possível é o custo de UMA célula, que é exatamente o "parar quando
 *  estourar" que foi pedido. O custo do relógio em si (dezenas de
 *  nanossegundos) é irrelevante perto de uma célula na casa do milissegundo:
 *  a suposição que justificava 64 só valia NUM MUNDO onde a célula fosse
 *  barata, e não é o mundo medido. */
const CHECA_A_CADA = 1
/** largura da faixa de poeira/sujeira fora da via, medida a partir do fio da
 *  via (folga positiva de `naVia`). Não é medição de campo, é escala de
 *  desenho: a sarjeta em V do Bloco B mede 0,30 m e o meio-fio 0,15 m: uma
 *  faixa de acúmulo de 1,6 m cobre os dois e ainda pega um pouco do
 *  passeio, que é onde poeira de sarjeta de verdade se deposita. */
const FOLGA_BORDA = 1.6

// ── densidade por zona, em fração de candidato aprovado (0..1) ────────────
// ⚠️ REAJUSTADA JUNTO COM O PASSO DA GRADE (4,0 m → 6,0 m, ver PASSO acima):
// área por célula sobe (6,0/4,0)² = 2,25×, então a densidade sobe 2,25×
// junto, pra manter a MESMA quantidade de decalque por metro quadrado que o
// valor antigo já orçava (0,05 → 0,1125, 0,35 → 0,7875, 0,01 → 0,0225). NÃO
// MEDIDO EM CHAPA — a proporção entre zonas continua a mesma escolha de
// antes: borda mais densa porque poeira de sarjeta é quase contínua na vida
// real, regolito aberto mais raro porque rastro e ejecta são acidente, não
// textura.
const DENSIDADE: Record<Zona, number> = { via: 0.1125, borda: 0.7875, regolito: 0.0225 }

type Zona = 'via' | 'borda' | 'regolito'

/** as três superfícies finas que `sobreQue` (vias.ts, ainda não publicada)
 *  vai devolver. Ver a nota em DecalquesOpts.sobreQue. */
export type Superficie = 'pista' | 'sarjeta' | 'calcada'

interface TipoDecal {
  nome: string
  /** índice da célula na grade 4×4 do atlas, 0..15 */
  cel: number
  zona: Zona
  /** onde este tipo nasce quando `sobreQue` está disponível — ver a nota em
   *  DecalquesOpts.sobreQue. Os três tipos de regolito (rastro, trilha,
   *  ejecta) não declaram: `sobreQue` só classifica ponto QUE ESTÁ em via, e
   *  esses três nunca estão. */
  superficies?: Superficie[]
  /** footprint em metros, ANTES da variação de escala por instância */
  sx: number
  sz: number
  /** pinta um texel do atlas: (u,v) em 0..1 dentro da própria célula */
  pintar: (u: number, v: number) => Amostra
}

interface Amostra { a: number; r: number; g: number; b: number }

// ── ruído local, duplicado de propósito ────────────────────────────────
// A mesma dupla hash2/vnoise de materiais.ts, mas SEM o `per` periódico: lá
// ele existe pra a textura dar a volta e ladrilhar sem costura; aqui cada
// receita é um carimbo ÚNICO dentro da própria célula, nunca repetido lado a
// lado consigo mesmo, então não há emenda pra costurar. Duplicada porque
// materiais.ts não a exporta (mesma razão que lotes.ts dava pro seu hash01).
function hash2(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0
  h = (h ^ (h >>> 13)) * 1274126177
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}
function vnoise(x: number, y: number): number {
  const xi = Math.floor(x), yi = Math.floor(y)
  const xf = x - xi, yf = y - yi
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf)
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1)
  return (a + (b - a) * u) + ((c + (d - c) * u) - (a + (b - a) * u)) * v
}
function fbm(x: number, y: number, oct: number): number {
  let s = 0, amp = 0.5, f = 1, norm = 0
  for (let i = 0; i < oct; i++) { s += amp * vnoise(x * f, y * f); norm += amp; amp *= 0.5; f *= 2 }
  return s / norm
}
function smooth(e0: number, e1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}
function mistura(a: number, b: number, t: number): number { return a + (b - a) * t }

// ── determinismo por célula de mundo: sem estado, sem carga ──────────────
// A mesma cidade em toda visita, sem nada salvo: o hash da célula (ci, cj) é
// a única fonte de aleatoriedade. `salt` separa presença, tipo, rotação,
// escala, espelho e tinta na MESMA célula sem eles colidirem.
function hashCelula(ci: number, cj: number, salt: number): number {
  let h = (ci * 374761393 + cj * 668265263 + salt * 2246822519) | 0
  h = (h ^ (h >>> 13)) * 1274126177
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}

// ── as doze receitas ───────────────────────────────────────────────────
// Cada uma devolve alfa (0 fora do decalque, 1 no miolo) e cor linear 0..255.
// A cor sai multiplicada pela tinta da instância no fragmento; o alfa NUNCA
// é tocado pela instância, só pela receita — "o alfa vem do atlas".

function tRemendoA(u: number, v: number): Amostra {
  const dx = u - 0.5, dz = v - 0.5
  const ang = Math.atan2(dz, dx)
  const perturb = fbm(Math.cos(ang) * 2.4 + 4, Math.sin(ang) * 2.4 + 4, 3)
  const raio = 0.30 + (perturb - 0.5) * 0.14
  const r = Math.hypot(dx, dz)
  const aBase = 1 - smooth(raio - 0.012, raio + 0.012, r)
  // junta de execução: anel escuro por dentro da borda
  const juntaR = raio - 0.035
  const juntaBanda = smooth(juntaR - 0.02, juntaR, r) * (1 - smooth(juntaR, juntaR + 0.02, r))
  const macha = fbm(u * 9, v * 9, 3)
  const tom = 0.85 + macha * 0.3
  const rC = 78 * tom, gC = 74 * tom, bC = 68 * tom
  const t = juntaBanda
  return { a: aBase, r: mistura(rC, 40, t), g: mistura(gC, 38, t), b: mistura(bC, 35, t) }
}

function tRemendoB(u: number, v: number): Amostra {
  // remendo-vala: retângulo arredondado (SDF de caixa com canto), alongado —
  // a marca de valeta reaterrada, diferente da mancha redonda de tRemendoA
  const dx = u - 0.5, dz = v - 0.5
  const hx = 0.40, hz = 0.20
  const qx = Math.abs(dx) - hx, qz = Math.abs(dz) - hz
  const fora = Math.hypot(Math.max(qx, 0), Math.max(qz, 0))
  const dentro = Math.min(Math.max(qx, qz), 0)
  const perturb = (fbm(u * 12, v * 12, 2) - 0.5) * 0.03
  const d = fora + dentro - 0.03 - perturb
  const aBase = 1 - smooth(-0.01, 0.01, d)
  const junta = smooth(-0.03, -0.012, d) * (1 - smooth(-0.012, 0.006, d))
  const macha = fbm(u * 7 + 5, v * 7 + 5, 3)
  const tom = 0.85 + macha * 0.3
  const rC = 76 * tom, gC = 72 * tom, bC = 66 * tom
  const t = junta
  return { a: aBase, r: mistura(rC, 40, t), g: mistura(gC, 38, t), b: mistura(bC, 35, t) }
}

function tJuntaA(u: number, v: number): Amostra {
  const onda = (fbm(v * 6, 0.5, 2) - 0.5) * 0.04
  const distJunta = Math.abs((u - 0.5) - onda)
  const aJunta = 1 - smooth(0.006, 0.016, distJunta)
  // ramo secundário diagonal, só na metade de cima da célula
  const dx2 = (u - 0.5) - (v - 0.5) * 0.6
  const jitter2 = (fbm(v * 9 + 11, u * 9 + 11, 3) - 0.5) * 0.05
  const distTrinca = Math.abs(dx2 - jitter2)
  const presenca = v > 0.5 ? 1 : 0
  const aTrinca = presenca * (1 - smooth(0.004, 0.010, distTrinca))
  const a = Math.max(aJunta, aTrinca)
  return { a, r: 32, g: 31, b: 29 }
}

function tTrincaB(u: number, v: number): Amostra {
  // trinca de retração solta, só ramificada, sem a junta reta
  const meandro = (fbm(v * 5, 2.0, 3) - 0.5) * 0.5
  const xCentro = 0.5 + meandro
  let d = Math.abs(u - xCentro)
  if (v > 0.55) {
    const xRamo = xCentro + (v - 0.55) * 0.9
    d = Math.min(d, Math.abs(u - xRamo))
  }
  const a = 1 - smooth(0.006, 0.018, d)
  return { a, r: 30, g: 30, b: 32 }
}

function tTampa(u: number, v: number): Amostra {
  const dx = u - 0.5, dz = v - 0.5
  const r = Math.hypot(dx, dz)
  const raioBase = 0.46
  const aBase = 1 - smooth(raioBase - 0.01, raioBase + 0.01, r)
  const ang = Math.atan2(dz, dx)
  const nervuras = 0.5 + 0.5 * Math.sin(ang * 14)
  const aneis = 0.5 + 0.5 * Math.sin(r * 70)
  const relevo = nervuras * 0.5 + aneis * 0.5
  const tom = 0.55 + relevo * 0.30
  const rC = 64 * tom, gC = 62 * tom, bC = 58 * tom
  const aro = smooth(raioBase - 0.09, raioBase - 0.06, r)
  return { a: aBase, r: mistura(rC, rC * 0.7, aro), g: mistura(gC, gC * 0.7, aro), b: mistura(bC, bC * 0.7, aro) }
}

function tGrelha(u: number, v: number): Amostra {
  const dx = Math.abs(u - 0.5), dz = Math.abs(v - 0.5)
  const aBox = (1 - smooth(0.44, 0.45, dx)) * (1 - smooth(0.40, 0.41, dz))
  const barra = Math.abs(((u * 11) % 1) - 0.5)
  const vao = barra < 0.20
  const tom = vao ? 0.42 * 0.35 : 0.42
  const gray = 70 * tom
  return { a: aBox, r: gray, g: gray, b: gray * 1.02 }
}

function tCaixa(u: number, v: number): Amostra {
  const dx = Math.abs(u - 0.5), dz = Math.abs(v - 0.5)
  const aBox = (1 - smooth(0.42, 0.432, dx)) * (1 - smooth(0.42, 0.432, dz))
  const seam = Math.min(Math.abs(u - 0.5), Math.abs(v - 0.5)) < 0.01 ? 1 : 0
  const cantos: [number, number][] = [[0.18, 0.18], [0.82, 0.18], [0.18, 0.82], [0.82, 0.82]]
  let bolt = 0
  for (const [cx, cz] of cantos) if (Math.hypot(u - cx, v - cz) < 0.025) bolt = 1
  const tom = 0.82 - seam * 0.28 - bolt * 0.35
  const gray = 150 * tom
  return { a: aBox, r: gray, g: gray * 0.99, b: gray * 0.95 }
}

function tPoeira(u: number, v: number): Amostra {
  // mais forte perto do meio-fio (u pequeno), esvaece pro passeio
  const grad = 1 - smooth(0.1, 0.85, u)
  const mancha = fbm(u * 6, v * 6, 3)
  const a = Math.max(0, Math.min(1, grad * 0.75 + (mancha - 0.5) * 0.25))
  const tom = 0.9 + mancha * 0.2
  return { a, r: 118 * tom, g: 112 * tom, b: 104 * tom }
}

function tRastro(u: number, v: number): Amostra {
  const fadeV = smooth(0.03, 0.14, v) * (1 - smooth(0.86, 0.97, v))
  const ruido = fbm(u * 20, v * 6, 2)
  const banda = Math.min(Math.abs(u - 0.35), Math.abs(u - 0.65))
  const a = fadeV * (1 - smooth(0.05 + ruido * 0.02, 0.09 + ruido * 0.02, banda))
  return { a, r: 75, g: 72, b: 67.5 }
}

function tTrilha(u: number, v: number): Amostra {
  const meandro = (fbm(v * 4, 1.0, 3) - 0.5) * 0.18
  const centro = 0.5 + meandro
  const largura = 0.14 + fbm(v * 8, 3.0, 2) * 0.04
  const d = Math.abs(u - centro)
  const fadeV = smooth(0.04, 0.18, v) * (1 - smooth(0.82, 0.96, v))
  const a = fadeV * (1 - smooth(largura * 0.7, largura, d))
  const tom = 1.06
  return { a, r: 118 * tom, g: 113 * tom, b: 105 * tom }
}

function tEjecta(u: number, v: number): Amostra {
  const dx = u - 0.5, dz = v - 0.5
  const r = Math.hypot(dx, dz)
  const ang = Math.atan2(dz, dx)
  const raios = 0.5 + 0.5 * Math.sin(ang * 9 + fbm(ang * 2, 0.7, 2) * 6)
  const anel = smooth(0.06, 0.20, r) * (1 - smooth(0.34, 0.48, r))
  const a = Math.max(0, anel * (0.4 + raios * 0.6))
  const tom = 1.18
  return { a, r: 118 * tom, g: 112 * tom, b: 104 * tom }
}

function tFaixa(u: number, v: number): Amostra {
  const dz = Math.abs(v - 0.5)
  const aBanda = 1 - smooth(0.30, 0.32, dz)
  // desgaste: gasta perto da trilha de roda (u baixo), inteira no acostamento (u alto)
  const erosaoBase = mistura(0.35, 0.95, smooth(0.15, 0.85, u))
  const ruido = fbm(u * 14, v * 14, 3)
  const cobre = ruido < erosaoBase ? 1 : 0
  const tom = 0.92 + ruido * 0.16
  return { a: aBanda * cobre, r: 215 * tom, g: 205 * tom, b: 175 * tom }
}

// ── o catálogo, com o índice de célula do atlas 4×4 (0..15) e a(s)
// superfície(s) fina(s) onde cada tipo nasce quando `sobreQue` existir ─────
const TIPOS: TipoDecal[] = [
  { nome: 'remendo',      cel: 0,  zona: 'via',      superficies: ['pista'],   sx: 1.6,  sz: 1.6,  pintar: tRemendoA },
  { nome: 'junta',        cel: 1,  zona: 'via',      superficies: ['calcada'], sx: 1.8,  sz: 1.8,  pintar: tJuntaA },
  { nome: 'tampa',        cel: 2,  zona: 'via',      superficies: ['pista'],   sx: 0.75, sz: 0.75, pintar: tTampa },
  { nome: 'grelha',       cel: 3,  zona: 'via',      superficies: ['sarjeta'], sx: 0.9,  sz: 0.45, pintar: tGrelha },
  { nome: 'caixa',        cel: 4,  zona: 'via',      superficies: ['calcada'], sx: 0.6,  sz: 0.6,  pintar: tCaixa },
  { nome: 'poeira',       cel: 5,  zona: 'borda',    superficies: ['sarjeta'], sx: 2.2,  sz: 1.0,  pintar: tPoeira },
  { nome: 'rastro',       cel: 6,  zona: 'regolito',                          sx: 2.6,  sz: 1.4,  pintar: tRastro },
  { nome: 'trilha',       cel: 7,  zona: 'regolito',                          sx: 2.0,  sz: 1.2,  pintar: tTrilha },
  { nome: 'ejecta',       cel: 8,  zona: 'regolito',                          sx: 1.3,  sz: 1.3,  pintar: tEjecta },
  { nome: 'faixa',        cel: 9,  zona: 'via',      superficies: ['pista'],   sx: 3.0,  sz: 0.5,  pintar: tFaixa },
  { nome: 'remendo-vala', cel: 10, zona: 'via',      superficies: ['pista'],   sx: 2.4,  sz: 1.0,  pintar: tRemendoB },
  { nome: 'trinca',       cel: 11, zona: 'via',      superficies: ['calcada'], sx: 1.4,  sz: 1.4,  pintar: tTrincaB },
]
// células 12..15 do atlas ficam em branco (alfa 0): reserva pro próximo tipo
// que entrar no catálogo, sem precisar redimensionar o atlas.
const GRID = 4
const CEL_PX = 512
const ATLAS_PX = GRID * CEL_PX

const POR_ZONA: Record<Zona, TipoDecal[]> = {
  via: TIPOS.filter((t) => t.zona === 'via'),
  borda: TIPOS.filter((t) => t.zona === 'borda'),
  regolito: TIPOS.filter((t) => t.zona === 'regolito'),
}

/** ⚠️ PONTA PREPARADA PRO `sobreQue` (ver DecalquesOpts.sobreQue), montada
 *  aqui e não dentro do laço de `atualizar`: filtrar `TIPOS` por instância é
 *  8 comparações × milhares de células por refazimento; a tabela pronta é
 *  um lookup. */
const POR_SUPERFICIE: Record<Superficie, TipoDecal[]> = {
  pista: TIPOS.filter((t) => t.superficies?.includes('pista')),
  sarjeta: TIPOS.filter((t) => t.superficies?.includes('sarjeta')),
  calcada: TIPOS.filter((t) => t.superficies?.includes('calcada')),
}

/** gera o atlas 2048×2048 em canvas, uma vez, no boot — igual materiais.ts */
function gerarAtlas(): THREE.CanvasTexture {
  const dados = new Uint8ClampedArray(ATLAS_PX * ATLAS_PX * 4) // zero = transparente
  for (const tipo of TIPOS) {
    const gx = tipo.cel % GRID, gy = Math.floor(tipo.cel / GRID)
    const ox = gx * CEL_PX, oy = gy * CEL_PX
    for (let py = 0; py < CEL_PX; py++) {
      for (let px = 0; px < CEL_PX; px++) {
        const u = (px + 0.5) / CEL_PX, v = (py + 0.5) / CEL_PX
        const s = tipo.pintar(u, v)
        const ix = ((oy + py) * ATLAS_PX + (ox + px)) * 4
        dados[ix] = s.r; dados[ix + 1] = s.g; dados[ix + 2] = s.b
        dados[ix + 3] = Math.max(0, Math.min(255, s.a * 255))
      }
    }
  }
  const cv = document.createElement('canvas')
  cv.width = ATLAS_PX; cv.height = ATLAS_PX
  const ctx = cv.getContext('2d')!
  ctx.putImageData(new ImageData(dados, ATLAS_PX, ATLAS_PX), 0, 0)
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  // ⚠️ CLAMP, NÃO REPEAT: cada célula é uma ilha isolada dentro do atlas; s
  // repetisse, a borda de uma célula puxaria o pixel da vizinha.
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping
  tex.anisotropy = 8
  return tex
}

export function buildDecalques(o: DecalquesOpts): Decalques {
  const group = new THREE.Group()
  group.name = 'decalques'
  const atlasMiB = (ATLAS_PX * ATLAS_PX * 4 * (4 / 3)) / (1024 * 1024)

  if (!DECALQUE_ON) {
    // bandeira desligada: grupo vazio, sem atlas, sem custo nenhum
    return {
      group, instancias: 0, triangulosMax: 0, atlasMiB: 0,
      atualizar() {}, dispose() {},
    }
  }

  if (!o.naVia && !o.sobreQue) {
    console.warn('[decalques] sem `naVia` nem `sobreQue`: só a zona regolito nasce (rastro, trilha, ejecta); ' +
      'remendo, junta, tampa, grelha, caixa, faixa e poeira dependem de uma das duas')
  }
  const naVia = o.naVia
  const sobreQue = o.sobreQue
  const RAIO = o.raio ?? RAIO_PADRAO

  const atlas = gerarAtlas()

  const base = new THREE.PlaneGeometry(1, 1)
  base.rotateX(-Math.PI / 2) // deitado, normal pra cima; ver lotes.ts
  const geo = new THREE.InstancedBufferGeometry()
  geo.setIndex(base.getIndex())
  geo.setAttribute('position', base.getAttribute('position'))
  geo.setAttribute('normal', base.getAttribute('normal'))
  geo.setAttribute('uv', base.getAttribute('uv'))

  const iOff = new Float32Array(TETO * 2)
  const iY = new Float32Array(TETO)
  const iGrad = new Float32Array(TETO * 2)
  const iRot = new Float32Array(TETO)
  const iSize = new Float32Array(TETO * 2)
  const iCel = new Float32Array(TETO)
  const iFlip = new Float32Array(TETO)
  const iTint = new Float32Array(TETO * 3)
  const attrOff = new THREE.InstancedBufferAttribute(iOff, 2); attrOff.setUsage(THREE.DynamicDrawUsage)
  const attrY = new THREE.InstancedBufferAttribute(iY, 1); attrY.setUsage(THREE.DynamicDrawUsage)
  const attrGrad = new THREE.InstancedBufferAttribute(iGrad, 2); attrGrad.setUsage(THREE.DynamicDrawUsage)
  const attrRot = new THREE.InstancedBufferAttribute(iRot, 1); attrRot.setUsage(THREE.DynamicDrawUsage)
  const attrSize = new THREE.InstancedBufferAttribute(iSize, 2); attrSize.setUsage(THREE.DynamicDrawUsage)
  const attrCel = new THREE.InstancedBufferAttribute(iCel, 1); attrCel.setUsage(THREE.DynamicDrawUsage)
  const attrFlip = new THREE.InstancedBufferAttribute(iFlip, 1); attrFlip.setUsage(THREE.DynamicDrawUsage)
  const attrTint = new THREE.InstancedBufferAttribute(iTint, 3); attrTint.setUsage(THREE.DynamicDrawUsage)
  geo.setAttribute('iOff', attrOff)
  geo.setAttribute('iY', attrY)
  geo.setAttribute('iGrad', attrGrad)
  geo.setAttribute('iRot', attrRot)
  geo.setAttribute('iSize', attrSize)
  geo.setAttribute('iCel', attrCel)
  geo.setAttribute('iFlip', attrFlip)
  geo.setAttribute('iTint', attrTint)
  geo.instanceCount = 0
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 9200) // frustumCulled=false: inerte, só por segurança

  const mat = new THREE.MeshStandardMaterial({
    roughness: 0.92,
    metalness: 0,
    // ⚠️ transparent+depthWrite:false é seguro aqui porque a grade
    // estratificada com jitter limitado garante que duas instâncias nunca
    // compartilham fragmento — ver a nota longa do cabeçalho.
    transparent: true,
    depthWrite: false,
  })
  mat.name = 'decalque'
  mat.map = atlas
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace(
        '#include <common>',
        /* glsl */`
        #include <common>
        attribute vec2 iOff;
        attribute float iY;
        attribute vec2 iGrad;
        attribute float iRot;
        attribute vec2 iSize;
        attribute float iCel;
        attribute float iFlip;
        attribute vec3 iTint;
        varying vec3 vTint;
        `,
      )
      .replace(
        '#include <beginnormal_vertex>',
        /* glsl */`
        // a normal é a tangente do plano tiltado pelo gradiente local, já em
        // eixos de MUNDO (iGrad foi amostrado em X/Z de mundo na CPU, ao
        // contrário de lotes.ts que precisava desgirar a normal local do
        // lote — aqui não há giro pra desfazer).
        vec3 objectNormal = normalize(vec3(-iGrad.x, 1.0, -iGrad.y));
        `,
      )
      .replace(
        '#include <begin_vertex>',
        /* glsl */`
        float lc = cos(iRot);
        float ls = sin(iRot);
        vec2 lm = position.xz * iSize;
        vec2 off = vec2(lm.x * lc + lm.y * ls, -lm.x * ls + lm.y * lc);
        vec2 wxz = iOff + off;
        // o plano segue a TANGENTE local (gradiente), não um valor achatado:
        // ver a conta do cabeçalho (tan 6,11° × 1 m ≈ 10,7 cm sem tilt).
        float hy = iY + iGrad.x * off.x + iGrad.y * off.y;
        vec3 transformed = vec3(wxz.x, hy + ${ALTURA_DECALQUE.toFixed(3)}, wxz.y);
        vTint = iTint;
        // ⚠️ UV REESCRITO AQUI, DEPOIS DE uv_vertex, como em lotes.ts: o
        // índice de célula escolhe o quadrante 4×4 do atlas, o espelho troca
        // U antes de entrar no atlas.
        float _gx = mod(iCel + 0.5, ${GRID.toFixed(1)});
        float _gy = floor((iCel + 0.5) / ${GRID.toFixed(1)});
        vec2 uvLocal = uv;
        if (iFlip > 0.5) uvLocal.x = 1.0 - uvLocal.x;
        #ifdef USE_MAP
          vMapUv = (vec2(_gx, _gy) + uvLocal) / ${GRID.toFixed(1)};
        #endif
        `,
      )
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        /* glsl */`
        #include <common>
        varying vec3 vTint;
        `,
      )
      .replace(
        '#include <map_fragment>',
        /* glsl */`
        #include <map_fragment>
        // a cor sai do atlas (mesmo o alfa); a tinta só multiplica o RGB.
        diffuseColor.rgb *= vTint;
        `,
      )
  }
  mat.customProgramCacheKey = () => 'dogcity:decalque'

  const mesh = new THREE.Mesh(geo, mat)
  mesh.name = 'decalques:quad'
  mesh.frustumCulled = false
  mesh.receiveShadow = o.sombra ?? true
  mesh.castShadow = false
  // desenha depois do chão (terreno/via/lote, que usam renderOrder 0 ou 1)
  mesh.renderOrder = 2
  group.add(mesh)

  console.log(
    `[decalques] atlas ${ATLAS_PX}×${ATLAS_PX} (${GRID}×${GRID} células de ${CEL_PX}²), ` +
    `${TIPOS.length} tipos, ${atlasMiB.toFixed(1)} MiB com mipmap, teto ${TETO.toLocaleString('pt-BR')} ` +
    `instâncias (${(TETO * 2).toLocaleString('pt-BR')} triângulos), 1 material, 1 chamada` +
    `${DECALQUE_ON ? '' : ' (bandeira desligada, nada nasce)'}`,
  )

  // ── amostra de altura+gradiente por célula, com cache entre chamadas ────
  // ⚠️ O CACHE NÃO É LIMPO ENTRE `atualizar`, DE PROPÓSITO. A câmera anda
  // aos poucos e a área varrida se sobrepõe muito de uma chamada pra outra
  // (PASSO_REFAZ = 40 m contra um raio de varredura de RAIO); reamostrar a
  // mesma célula de novo seria `heightAt` jogado fora. NÃO MEDIDO quanto o
  // cache economiza; ele só é limpo se crescer demais (ver o teto abaixo).
  const cacheAltura = new Map<number, { h: number; dx: number; dz: number }>()
  const CACHE_TETO = 200000

  // ── instrumentação por família de chamada (03/09), pedida antes de
  // qualquer corte. A hipótese do fundador é CRUZADA: a frente de terreno
  // fino somou micro-relevo dentro de `heightAt`, e esse micro-relevo é
  // ZERO sob pavimento — o que ela resolve consultando `vias.naVia` DE
  // DENTRO de `heightAt`. Nada disso aparece no NOSSO código; só aparece no
  // TEMPO que a chamada devolve. Por isso o relógio fica em volta da
  // FRONTEIRA (o que ESTE módulo chama), não de uma contagem de linha: o
  // que `heightAt` faz por dentro é conta de outra frente. `sobreQue` cai no
  // mesmo balde de `naVia` porque as duas são a mesma família — consulta de
  // máscara — mesmo que hoje `sobreQue` nunca chegue (ainda não foi ligada).
  let msMascara = 0, nMascara = 0
  let msAltura = 0, nAltura = 0
  const chamarNaVia = naVia
    ? (x: number, z: number, folga?: number): boolean => {
        const t0 = performance.now()
        const r = naVia(x, z, folga)
        msMascara += performance.now() - t0
        nMascara++
        return r
      }
    : undefined
  const chamarSobreQue = sobreQue
    ? (x: number, z: number): Superficie | null => {
        const t0 = performance.now()
        const r = sobreQue(x, z)
        msMascara += performance.now() - t0
        nMascara++
        return r
      }
    : undefined

  const amostrarAltura = (ci: number, cj: number, wx: number, wz: number) => {
    const chave = (ci + 65536) * 131072 + (cj + 65536)
    const visto = cacheAltura.get(chave)
    if (visto) return visto
    if (cacheAltura.size > CACHE_TETO) cacheAltura.clear()
    const t0 = performance.now()
    const h0 = o.heightAt(wx, wz)
    const hx = o.heightAt(wx + PASSO_GRAD, wz)
    const hz = o.heightAt(wx, wz + PASSO_GRAD)
    msAltura += performance.now() - t0
    nAltura += 3
    const r = { h: h0, dx: (hx - h0) / PASSO_GRAD, dz: (hz - h0) / PASSO_GRAD }
    cacheAltura.set(chave, r)
    return r
  }

  const alvo = new THREE.Vector3()
  const camAnterior = new THREE.Vector3(1e9, 1e9, 1e9)
  let primeira = true
  let instancias = 0

  // ── o estado de uma varredura em fatias, ver a nota longa do cabeçalho ──
  // ⚠️ NADA DISTO EXISTE NO CONSTRUTOR. O construtor devolveu o grupo vazio
  // lá em cima; é `atualizar`, chamado por quadro, que avança este estado
  // aos poucos. `varrendo` é o único sinal de "há trabalho pendente" — sem
  // ele, `atualizar` sai na primeira linha sempre que não há nada a fazer,
  // como antes da correção.
  let varreCx = 0, varreCz = 0, varreReach = 0, varreLargura = 0, varreTotal = 0
  let varreIdx = 0
  let varreK = 0
  let varreT0 = 0
  let varreCelulas = 0
  let varrendo = false
  // ⚠️ CONTAGEM POR ZONA (03/09), pedida junto com a instrumentação de custo:
  // "675 instâncias em 10.201 células com raio de 300 m parece pouco" só se
  // resolve olhando pra quantas células caíram em cada zona ANTES do sorteio
  // de densidade — se quase tudo é regolito aberto longe de via, o problema
  // é RAIO/POSIÇÃO, não a densidade orçada (ver a nota no cabeçalho).
  let contVia = 0, contBorda = 0, contRegolito = 0
  let instVia = 0, instBorda = 0, instRegolito = 0

  function atualizar(camera: THREE.Camera) {
    camera.getWorldPosition(alvo)
    const moveu = primeira || alvo.distanceToSquared(camAnterior) >= PASSO_REFAZ * PASSO_REFAZ

    // ⚠️ SÓ COMEÇA VARREDURA NOVA SE NÃO HOUVER UMA EM ANDAMENTO. Se a
    // câmera andar de novo no meio de uma fatia, a varredura corrente
    // termina com a âncora com que começou (ela fica levemente atrasada
    // por alguns quadros) e a PRÓXIMA, dez linhas abaixo, já nasce
    // centrada na posição nova — preferível a abortar no meio e nunca
    // fechar nada numa perseguição rápida de câmera.
    if (moveu && !varrendo) {
      primeira = false
      camAnterior.copy(alvo)

      // ⚠️ GRADE ANCORADA NA ORIGEM DO MUNDO (ci = round(x/PASSO)), NÃO NA
      // CÂMERA: se a grade se movesse com a câmera, a célula de cada ponto
      // do mundo mudaria a cada refazimento e a "colocação determinística
      // por célula" do cabeçalho deixaria de valer entre uma chamada e a
      // próxima. O jitter (ver a nota longa do cabeçalho) desloca o CENTRO
      // dentro da célula; a célula em si continua fixa no mundo.
      //
      // ⚠️ ARITMÉTICA DE CÉLULAS VARRIDAS, PRO PASSO DE 6 m: com RAIO =
      // 300 m, reach = ceil(300 / 6,0) = 50; a caixa varrida é
      // (2·50+1)² = 10.201 células, das quais ficam dentro do círculo
      // π·50² ≈ 7.854 (contra ≈17.671 no passo antigo de 4 m — a grade
      // mais larga varre MENOS, não mais). TETO = 20.000 continua sendo só
      // o teto de segurança: com ≈7.854 células candidatas por varredura e
      // densidade máxima de 78,75% (zona 'borda'), o pior caso teórico
      // (~6.185 instâncias se TODA célula caísse na zona mais densa) já
      // fica bem abaixo do teto — TETO não deveria ser o fator limitante
      // na prática. NÃO MEDIDO em navegador.
      varreReach = Math.ceil(RAIO / PASSO)
      varreCx = Math.round(alvo.x / PASSO)
      varreCz = Math.round(alvo.z / PASSO)
      varreLargura = 2 * varreReach + 1
      varreTotal = varreLargura * varreLargura
      varreIdx = 0
      varreK = 0
      varreCelulas = 0
      varreT0 = performance.now()
      varrendo = true
      msMascara = 0; nMascara = 0
      msAltura = 0; nAltura = 0
      contVia = 0; contBorda = 0; contRegolito = 0
      instVia = 0; instBorda = 0; instRegolito = 0
    }
    if (!varrendo) return // nada pendente: sai na primeira linha, como antes da correção

    const r2max = RAIO * RAIO
    const tFatia0 = performance.now()
    let desdeChecagem = 0

    // ⚠️ UMA FATIA ORÇADA POR TEMPO, NÃO POR NÚMERO DE CÉLULAS. `varreIdx` é
    // um índice LINEAR (0..varreTotal-1); `di`/`dj` saem dele por divisão e
    // resto, o mesmo laço duplo de antes, só que RETOMÁVEL: parar e recomeçar
    // no meio não perde nem repete célula nenhuma.
    while (varreIdx < varreTotal && varreK < TETO) {
      const di = Math.floor(varreIdx / varreLargura) - varreReach
      const dj = (varreIdx % varreLargura) - varreReach
      varreIdx++
      varreCelulas++
      const ci = varreCx + di, cj = varreCz + dj

      // ⚠️ AMOSTRAGEM UNIFORME EM DISCO: ângulo de um hash, raio de
      // `JITTER_R · √h` do outro. `JITTER_R · h`, sem raiz, empilharia
      // ponto perto do centro, porque área cresce com o raio ao quadrado.
      const ang = hashCelula(ci, cj, 9) * Math.PI * 2
      const rad = JITTER_R * Math.sqrt(hashCelula(ci, cj, 10))
      const wx = ci * PASSO + Math.cos(ang) * rad
      const wz = cj * PASSO + Math.sin(ang) * rad

      // ⚠️ O TESTE DE RAIO USA A POSIÇÃO JÁ JITTERADA, não o centro da
      // célula: é o ponto onde o decalque REALMENTE nasce que precisa
      // caber no anel de detalhe, não a âncora da grade. ⚠️ E USA `alvo`
      // CONGELADO NO INÍCIO DESTA VARREDURA (não recapturado por fatia):
      // a varredura inteira tem que julgar contra a MESMA posição de
      // câmera com que começou, senão o raio muda de fatia pra fatia.
      const ddx = wx - camAnterior.x, ddz = wz - camAnterior.z
      if (ddx * ddx + ddz * ddz > r2max) continue

      // ── classificação: `sobreQue` fino primeiro, `naVia` como
      // fallback (ver a nota longa no topo do arquivo e em
      // DecalquesOpts.sobreQue) ──────────────────────────────────────
      //
      // ⚠️ ORDEM TROCADA DE PROPÓSITO (03/09), depois de medir. A maioria
      // das células cai longe de qualquer via — é regolito aberto, não
      // via nem borda — e o código antigo pagava DUAS chamadas de `naVia`
      // pra chegar nessa conclusão (uma com folga 0, que falha, depois uma
      // com FOLGA_BORDA, que também falha). Checando a folga LARGA
      // primeiro, o caso majoritário (fora da folga inteira) resolve com
      // UMA chamada; só a minoria que está DENTRO da folga paga a segunda,
      // que distingue via exata de faixa de borda. Não muda o resultado,
      // muda só quantas vezes `naVia` é chamado pra chegar nele — e cada
      // chamada tem custo real, ver `msMascara` no relatório da varredura.
      let zona: Zona
      const fina: Superficie | null = chamarSobreQue ? chamarSobreQue(wx, wz) : null
      if (fina) {
        zona = 'via'
      } else if (chamarNaVia) {
        if (!chamarNaVia(wx, wz, FOLGA_BORDA)) zona = 'regolito'
        else if (chamarNaVia(wx, wz, 0)) zona = 'via'
        else zona = 'borda'
      } else {
        zona = 'regolito'
      }
      if (zona === 'via') contVia++
      else if (zona === 'borda') contBorda++
      else contRegolito++

      // com superfície fina, o balde é por AFINIDADE (só os tipos que
      // nascem em 'pista', 'sarjeta' ou 'calcada'), não a zona larga
      // 'via' inteira; se a superfície não bater com tipo nenhum do
      // catálogo de hoje (não deveria acontecer), cai no balde largo
      // como rede de segurança, pra não perder a instância.
      let candidatos: TipoDecal[]
      if (fina) {
        candidatos = POR_SUPERFICIE[fina]
        if (!candidatos.length) candidatos = POR_ZONA.via
      } else {
        candidatos = POR_ZONA[zona]
      }
      if (candidatos.length) {
        const presenca = hashCelula(ci, cj, 1)
        if (presenca <= DENSIDADE[zona]) {
          const hTipo = hashCelula(ci, cj, 2)
          const tipo = candidatos[Math.min(candidatos.length - 1, Math.floor(hTipo * candidatos.length))]

          // ⚠️ A ALTURA (E O GRADIENTE JUNTO DELA) SÓ É PEDIDA AQUI, DEPOIS
          // DO SORTEIO DE DENSIDADE PASSAR — já era assim antes desta
          // correção, e continua sendo o que evita pagar `heightAt` nas
          // 93%+ das células que não recebem decalque nenhum.
          const g = amostrarAltura(ci, cj, wx, wz)
          const hRot = hashCelula(ci, cj, 3)
          const hEsc = hashCelula(ci, cj, 4)
          const hFlip = hashCelula(ci, cj, 5)
          const hT0 = hashCelula(ci, cj, 6), hT1 = hashCelula(ci, cj, 7), hT2 = hashCelula(ci, cj, 8)

          const escala = 0.85 + hEsc * 0.30
          const k = varreK
          iOff[k * 2] = wx; iOff[k * 2 + 1] = wz
          iY[k] = g.h
          iGrad[k * 2] = g.dx; iGrad[k * 2 + 1] = g.dz
          iRot[k] = hRot * Math.PI * 2
          iSize[k * 2] = tipo.sx * escala; iSize[k * 2 + 1] = tipo.sz * escala
          iCel[k] = tipo.cel
          iFlip[k] = hFlip < 0.5 ? 0 : 1
          const tintJitter = 0.92 + 0.16 * hT0
          iTint[k * 3] = tintJitter
          iTint[k * 3 + 1] = tintJitter * (0.98 + 0.04 * hT1)
          iTint[k * 3 + 2] = tintJitter * (0.97 + 0.05 * hT2)
          varreK++
          if (zona === 'via') instVia++
          else if (zona === 'borda') instBorda++
          else instRegolito++
        }
      }

      // ⚠️ O RELÓGIO SÓ É CONSULTADO A CADA CHECA_A_CADA CÉLULAS — ver a
      // constante no cabeçalho. `performance.now()` tem custo, e checar a
      // cada célula pagaria o relógio mais do que o trabalho.
      desdeChecagem++
      if (desdeChecagem >= CHECA_A_CADA) {
        desdeChecagem = 0
        if (performance.now() - tFatia0 > ORCAMENTO_QUADRO_MS) break
      }
    }

    // ⚠️ instanceCount SEMPRE REFLETE O QUE JÁ FOI ESCRITO NESTA VARREDURA,
    // mesmo parcial: é assim que o decalque aparece AOS POUCOS em vez de
    // pipocar tudo de uma vez quando a varredura inteira fecha.
    instancias = varreK
    geo.instanceCount = varreK
    attrOff.needsUpdate = true
    attrY.needsUpdate = true
    attrGrad.needsUpdate = true
    attrRot.needsUpdate = true
    attrSize.needsUpdate = true
    attrCel.needsUpdate = true
    attrFlip.needsUpdate = true
    attrTint.needsUpdate = true

    const fechou = varreIdx >= varreTotal || varreK >= TETO
    if (fechou) {
      varrendo = false
      const ms = performance.now() - varreT0
      const msResto = Math.max(0, ms - msMascara - msAltura)
      const porCelula = varreCelulas > 0 ? ms / varreCelulas : 0
      // ⚠️ O NÚMERO QUE FALTAVA (03/09): sem a QUEBRA por família, ninguém,
      // nem quem escreve o módulo, sabe ONDE o tempo foi — só que foi
      // gasto. Mesmo idioma do `mascaraMs` que vias.ts publica, mas em três
      // baldes: máscara (naVia/sobreQue — inclui a chamada NOSSA, não o que
      // roda dentro de `heightAt`), altura (heightAt — inclui QUALQUER
      // coisa que rode dentro dela, de outra frente, como micro-relevo e
      // fbm), e resto (hash, jitter, gravação nos arrays — MAS TAMBÉM
      // qualquer tempo ocioso entre quadros, porque `ms` é RELÓGIO de
      // parede do início ao fim da varredura, o mesmo campo que o fundador
      // já usou pra calcular 1,73 ms/célula, não soma de CPU pura das
      // fatias; então "resto" alto não prova hash/gravação caros, só que
      // sobrou tempo fora de máscara e altura, ocioso ou não). A contagem
      // por zona responde a outra pergunta, a da densidade: se `regolito`
      // domina MUITO acima do que a área abrigaria (via costuma ser minoria
      // da área de um raio de 300 m), o raio ou a posição de partida é que
      // estão errados, não a fração orçada por zona.
      console.log(
        `[decalques] varredura completa: ${varreCelulas.toLocaleString('pt-BR')} células, ` +
        `${varreK.toLocaleString('pt-BR')} instâncias, ${ms.toFixed(1)} ms totais, ` +
        `${porCelula.toFixed(3)} ms/célula` +
        `${varreK >= TETO ? ' (parou no teto de 20.000)' : ''}` +
        `; máscara ${msMascara.toFixed(1)} ms (${nMascara.toLocaleString('pt-BR')} chamadas), ` +
        `altura ${msAltura.toFixed(1)} ms (${nAltura.toLocaleString('pt-BR')} chamadas), ` +
        `resto ${msResto.toFixed(1)} ms` +
        `; zonas varridas: via ${contVia.toLocaleString('pt-BR')}, ` +
        `borda ${contBorda.toLocaleString('pt-BR')}, regolito ${contRegolito.toLocaleString('pt-BR')}` +
        `; instâncias por zona: via ${instVia.toLocaleString('pt-BR')}, ` +
        `borda ${instBorda.toLocaleString('pt-BR')}, regolito ${instRegolito.toLocaleString('pt-BR')}`,
      )
    }
  }

  return {
    group,
    get instancias() { return instancias },
    triangulosMax: TETO * 2,
    atlasMiB,
    atualizar,
    dispose() {
      base.dispose()
      geo.dispose()
      mat.dispose()
      atlas.dispose()
    },
  }
}
