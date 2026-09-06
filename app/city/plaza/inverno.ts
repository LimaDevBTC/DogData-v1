// ═══════════════════════════════════════════════════════════════════════════
// O PARQUE DE INVERNO: a região montanhosa do maciço oeste esculpida em pista
// profissional, snowboard park, halfpipe e teleféricos. Pedido do fundador,
// palavra por palavra: "quero que aquela região montanhosa seja mexida e lá
// temos que ter o parque de inverno. Pista de esqui profissional, snowboarding,
// nível top 1 mundo hoje. Se preciso aumente a elevação, crie as montanhas,
// mas isso é inegociável."
//
// ⚠️ ATRÁS DE `?inverno=1`, SEM EXCEÇÃO, pelo mesmo motivo de `terreno-fino.ts`:
// o bot de auto-commit publica de hora em hora. `INVERNO_ATIVO` é lido uma vez,
// no módulo, com a mesma guarda de `typeof window`. `alturaInvernoAt` devolve 0
// na primeira linha quando a bandeira está desligada, e `x + 0 === x` em ponto
// flutuante IEEE754 não tem exceção: `terrain.ts` soma este retorno a
// `heightAt` exatamente como soma `microRelevoAt`, e sem a bandeira a soma é
// bit a bit a mesma conta de hoje. A prova está no teste offline descrito no
// relatório, não neste arquivo.
//
// ── TAREFA 1, RESPONDIDA ANTES DE DESENHAR QUALQUER PISTA ───────────────────
// A abóbada é uma calota esférica (`dome.ts`, `DOME_R = 9050`). Medido com a
// geometria REAL (`crown - rim = f`, `Rc = (R² + f²) / 2f`, `yc = crown - Rc`,
// `casca(r) = yc + sqrt(Rc² - min(r,R)²)`), com os valores que `plaza-scene.tsx`
// de fato passa hoje (`crown: 2619`, `rim: 53`, logo `f = 2566`):
//
//   pico medido por `alpino.ts` (x=-8234, z=-902, r=8283,3 m): 321,7 m
//   casca no mesmo raio, hoje (f=2566):                        499,1 m
//   folga:                                                     177,4 m livres
//
// NÃO FURA. O pico de hoje já mora dentro da casca, com margem. Isto foi
// medido duas vezes por duas frentes independentes (esta e a frente da casca)
// e bateu: 499,1 contra 499 m, 177,4 contra 177 m.
//
// Mas o parque top 1 mundo pede muito mais altura que 321,7 m (ver Tarefa 2),
// e a casca de hoje (f=2566) não aguenta uma montanha maior: a folga cai para
// 130,7 m já em r=8.500 e para -183,7 m (FURA) em r=9.050, o raio da própria
// casca. A frente da casca abriu a forma para mudança e propõe uma flecha
// maior; este módulo foi projetado para `f = 5.500` (crown = 5.553, rim = 53),
// que mede:
//
//   casca em r=8.283 com f=5.500:                            1.302,4 m
//   folga sobre o pico de HOJE (321,7 m):                      980,7 m
// O cume novo (busca real em `heightAt`, não suposto) nasce em r=8.330,
// azimute 268°, com 1.065,9 m. A casca no mesmo raio (f=5.500) mede 1.236,4 m:
// folga de 170,5 m livres, medida, não estimada.
//
// ⚠️ ACHADO SEPARADO, E É UM DEFEITO QUE JÁ EXISTE HOJE, sem este módulo e sem
// qualquer flecha nova: o RIM da casca (53 m) é FIXO por construção, porque a
// calota sempre passa por `(0, crown)` e `(DOME_R, rim)`, então `casca(DOME_R) = rim`
// SEMPRE, não importa a flecha. O terreno real do maciço oeste, medido hoje
// sem nenhuma montanha nova, já passa de 280 m nos últimos 200 m antes da
// borda (r > 8.700, pior rumo ~251-277°) e a casca ali despenca para 53 m no
// limite: a 9.050 m o terreno mede até 289,9 m contra uma casca de 53 m, ou
// seja **-236,9 m, JÁ FURADO, hoje, sem eu ter tocado em nada**. Aumentar a
// flecha empurra o cruzamento para fora (de r≈8.700 com f=2.566 para r≈8.925
// com f=5.500, medido) mas não apaga o problema, porque o rim continua em
// 53 m nos dois casos. Isto não é problema meu de resolver (não teria como,
// sem mudar `rim` ou a régua do pódio, e as duas são de `dome.ts`): é um
// aviso para quem for fechar a casca. Este módulo fica DELIBERADAMENTE dentro
// de r ≤ 8.650, uma boa margem antes de onde a fratura de hoje começa em
// QUALQUER das duas flechas medidas, para não empilhar problema sobre problema.
//
// ── A PERGUNTA DE PROJETO: crescer ONDE ESTÁ ou migrar para dentro? ─────────
// Medido: migrar para dentro (r < 7.150) esbarra em DOIS obstáculos reais, não
// hipotéticos. Primeiro, urbanístico: `public/city/cidade.json` → `programa`
// já tem a Floresta de Extrativismo do Poente (VP02, 107,52 ha) centrada em
// r=6.762, rumo 236°, e o Reservatório e as Hortas do Poente mais perto ainda
// (r=4.530 e 4.700). Segundo, e mais duro: o PRÓPRIO PÓDIO DA ABÓBADA
// (`dome.ts` → `PODIO_R0..R3`, que `terrain.ts` já aplica) nivela à força o
// anel de r=6.150 a 8.300 até a cota 13 m, com peso PLENO (100%) entre 6.950 e
// 7.150, que é a antiga borda da casca menor, hoje uma cicatriz plana no meio
// da cidade. Qualquer relevo que eu somasse ali seria multiplicado por
// `(1 - peso)` e devolvido quase zero: medido, 97,8% de supressão em r=7.250,
// caindo a 17% em r=8.000 e a 2% só em r=8.200. A montanha não pode nascer no
// meio dessa faixa, ela seria apagada pela própria fundação da cidade.
//
// A RECOMENDAÇÃO: a montanha CRESCE ONDE ESTÁ, no arco oeste (rumo 248° a
// 288°, que cobre com folga os 251-277° onde o terreno de hoje já é mais alto
// em qualquer raio medido). O anel de 6.150 a 8.100 m, que o pódio já deixa
// plano, vira a PISTA VERDE DE ACESSO e a vila-base (estação, garagem dos
// teleféricos): um uso, não um desperdício, do nivelamento que já existe. A
// montanha de verdade (a crista, os ombros, os corredores) mora de r≈8.150 a
// r≈8.650, onde o pódio já solta a mão (supressão ≤ 5%) e a Floresta do
// Poente não chega.
//
// ── TAREFA 2, AS NORMAS, CONFERIDAS (WebSearch, não copiadas de memória) ────
// Desnível de homologação FIS, por disciplina, nível olímpico/Copa do Mundo:
//   descida (downhill), masculino:      até 1.100 m       (feminino: até 800 m)
//   super-G, nível olímpico/CM:         400 a 650 m (masc), 400 a 600 m (fem)
//   slalom gigante:                     250 a 450 m (masc), 250 a 400 m (fem)
//   slalom:                             180 a 220 m (masc), 140 a 220 m (fem)
//   halfpipe olímpico:                  parede 22 pés = 6,71 m; ~600 pés =
//                                        182,9 m de comprimento; rampa 16-18°
//   slopestyle:                         6 módulos típicos (3 saltos + 3 rails)
//   snowboardcross (boardercross):      percurso 800-1.200 m, desnível
//                                        100-250 m, declive médio 7-11°
// Classificação por inclinação (gradiente), sem g nenhum na conta: verde até
// ~16-25%, azul 25-40%, vermelha até ~47%, preta 40%+ sem teto fixado por
// norma nenhuma. Fontes no relatório final.
//
// Conclusão da Tarefa 2: o parque PRECISA de pelo menos ~900-1.100 m de
// desnível para a descida (a peça mais exigente) ler como "top 1 mundo" de
// verdade. O sítio de hoje tem 311 m de relevo natural (321,7 pico menos
// 10,6 mediana). A diferença, os outros ~600 a 800 m, é a montanha que este
// módulo esculpe, somando ao relevo real, não substituindo.
//
// ── TAREFA 3, A CONTA DE 1/6 g, E ELA É O PARTIDO DE ARTE DO PARQUE ─────────
// g_lua = 1,625 m/s² (o mesmo valor de `plano-diretor.md` § 5.3, não 1,62: a
// razão balística de lá, 6,035 = 9,81/1,625, é reaproveitada aqui ponto a
// ponto para não introduzir uma segunda constante concorrente no mesmo
// projeto). Três perguntas, três contas:
//
// 1. "Uma pista preta na Terra continua preta aqui?" A CLASSIFICAÇÃO não muda:
//    verde/azul/vermelha/preta é definida por GRADIENTE (subida/percurso), uma
//    razão geométrica que não tem g dentro. Uma rampa de 40% de inclinação é
//    preta na Terra e continua sendo preta na Lua, pela letra da norma.
//    Mas a ACELERAÇÃO que essa rampa produz, a·sin(θ), SIM muda, e por um
//    fator duro: a(θ) = g·sen(θ). Numa rampa de θ=21,8° (40%, preta de
//    entrada), a Terra dá 9,81×0,371 = 3,64 m/s²; a Lua dá 1,625×0,371 =
//    0,60 m/s². Pior: o TETO físico da aceleração lunar, numa parede vertical
//    hipotética de 90°, é o próprio g_lua = 1,625 m/s², e isso é MENOS do que
//    uma pista VERDE terrestre de 9,54° (16,8% de rampa) já produz
//    (9,81×sen(9,54°) = 1,625 m/s², a igualdade exata). Conclusão dura e
//    honesta: NENHUMA inclinação lunar, nem a mais vertical, reproduz a
//    aceleração de uma pista azul, vermelha ou preta terrestre. "Inclinação
//    equivalente" não existe para além do próprio limite físico da Lua. A
//    dificuldade de uma pista preta lunar não pode vir de g-force de reta:
//    tem que vir de percurso comprido (a velocidade final por conservação de
//    energia, v = √(2·g·h), só depende do DESNÍVEL, não da inclinação nem de
//    g diretamente no expoente (cai só com √6,035 = 2,457, não com 6,035),
//    de curva técnica estreita e de neve rala. Por isso este módulo faz a
//    pista SERPENTEAR (ver `AUTORIA_PISTAS`), não descer na linha de maior
//    declive: é o jeito de ganhar percurso sem exigir rampa impossível do
//    relevo.
//
// 2. "Um halfpipe de parede de 6,7 m projetado pra Terra faz o que a 1/6 g?"
//    A parede (a curva de transição) não muda: ela é geometria de quadris e
//    joelhos, não de queda livre, e `plano-diretor.md` já fixou esse
//    princípio no skatepark ("coping e muro ficam iguais"). O que muda é a
//    conversão de VELOCIDADE DE SAÍDA em ALTURA DE VOO, h = v²/(2g), para o
//    MESMO impulso muscular (que não depende de g: perna empurra igual aqui e
//    lá). O recorde mundial de amplitude num superpipe de 22 pés é 8,04 m
//    (Joffrey Pollet-Villard, Mundial FIS 2015). Na Lua, o MESMO impulso que
//    produziu 8,04 m na Terra produz 8,04 × 6,035 = 48,5 m de voo LIVRE acima
//    do coping. A parede de 6,7 m continua sendo a parede; o que precisa
//    crescer 6 vezes é o CÉU acima dela.
//
// 3. "Qual é a dimensão CERTA de halfpipe, mesa de salto e boardercross pra
//    Lua?" Resposta, com a mesma régua (parede/rampa iguais à Terra, envelope
//    de voo × 6,035):
//      halfpipe:  parede 6,71 m (igual), pé-a-pé 182,9 m (igual: ver Tarefa 3
//                 nota abaixo sobre por que o comprimento NÃO escala),
//                 folga de ar exigida acima do coping: 48,5 m (era 8,04 m)
//      mesa de salto (kicker/table): mesma rampa de saída (mesmo ângulo, ~30
//                 a 40 graus, igual à Terra: é a geometria do lip, não a
//                 física da queda), MAS o alcance R = v²·sen(2φ)/g escala por
//                 6,035 para a MESMA velocidade de entrada: uma mesa que na
//                 Terra manda o atleta a 25 m manda a 150,9 m aqui. A zona de
//                 pouso (knuckle) tem que ser 6,035× mais comprida, ou a
//                 velocidade de entrada tem que cair para 1/√6,035 = 40,7%
//                 da terrestre para pousar no mesmo lugar (opção que este
//                 módulo NÃO escolhe: a mesa lunar é a mesa que só existe
//                 aqui, então ela é a mesa longa, não a mesa capada)
//      boardercross: percurso 800-1.200 m (igual: é bitola de pista, não
//                 física de projétil) com saltos e rolos cujo alcance também
//                 escala por 6,035, exatamente como a mesa de salto acima
//
//    ⚠️ POR QUE O COMPRIMENTO DO HALFPIPE NÃO ESCALA (a pegadinha da conta
//    ingênua): para uma rampa de comprimento L e inclinação θ CONSTANTES, a
//    velocidade de saída por conservação de energia é v² = 2·g·sen(θ)·L, e a
//    altura de voo é h = v²/(2g) = sen(θ)·L: o g DOS DOIS LADOS DA CONTA
//    SE CANCELA. Se a velocidade vier de queda livre pela MESMA rampa (não de
//    impulso muscular extra), o comprimento do half-pipe não precisa mudar
//    nem um metro: o voo já sai maior sozinho, de graça, só porque a Lua devolve
//    de volta a mesma altura da queda, e essa é a "moeda" desta seção do plano
//    diretor. O fator 6,035 só aparece quando alguém ADICIONA energia por
//    músculo (pump) por cima da queda livre, e é exatamente aí, na
//    amplitude do pump, não no desenho do cano, que a Lua paga o prêmio.
//
// Este é o partido de arte do parque inteiro: não é uma estação alpina
// copiada da Terra posta na Lua, é a estação que SÓ poderia nascer aqui,
// onde a queda dá o dobro e meio de altura de volta de graça (√6,035), o
// pump multiplica por seis inteiros, e a pista precisa de percurso, não de
// parede vertical, porque a própria gravidade não empresta o "murro" que uma
// preta terrestre empresta de graça.
//
// ═══════════════════════════════════════════════════════════════════════════
// SEGUNDA CORREÇÃO DO FUNDADOR, MESMO DIA (03/09): "as montanha ta bem feia,
// parece uma repetição de blocos, 4 na sequência, um maior que outro". O
// diagnóstico do coordenador foi exato: eu esculpia por PERFIL RADIAL com
// cosseno de um lado e potência do outro, e somava alguns "ombros" (cumes
// COLOCADOS por fórmula, com espaçamento angular parecido). Cosseno é
// periódico por definição; somar N cumes parecidos e igualmente espaçados
// produz exatamente "blocos em fileira". A conta estava certa, a FAMÍLIA de
// função estava errada: montanha de verdade é o que sobra depois da erosão,
// não uma soma de bumps colocados.
//
// ⚠️ E A PRIMEIRA INSTRUÇÃO PARA CONSERTAR ISSO (ruído multifractal com
// crista + deformação de domínio) TAMBÉM FOI CORRIGIDA, na sequência, pelo
// mesmo motivo que já tinha corrigido a sequoia horas antes: esta casa tem
// API do Sketchfab conectada (`blender/sketchfab_fetch.py`), e um scan
// fotogramétrico real de montanha JÁ CARREGA erosão de verdade (vale
// ramificado, crista irregular, sela de altura variável) que ruído
// procedural não sabe imitar de graça. A ordem certa, dita pelo fundador:
// BUSQUE PRIMEIRO, meça, e só use ruído no que o acervo não resolver.
//
// ⚠️ O QUE FOI BUSCADO E MEDIDO, não suposto:
//   `weisse-wand-mountain.glb`   scan CC-BY de Shahriar Shahrabi, pico
//                                austríaco Weisse Wand (2.517 m de verdade),
//                                444.814 faces cru, decimado pra 15.000 aqui
//   `zwoelfernock-mountain.glb`  mesmo autor, pico Zwölfernock (2.516 m),
//                                534.842 faces cru, decimado pra 15.000
// Os DOIS scans crus (pré-conversão, `blender/assets-sketchfab/*/scene.gltf`
// + `.bin`, glTF simples sem DRACO) foram assados OFFLINE (script Python,
// não neste arquivo) numa grade de altura 96×96, MESMA ideia do heightmap
// SLDEM2015 que `terrain.ts` já usa pro sítio inteiro: rasteriza a nuvem de
// vértices num grid, guarda só a altura normalizada. O resultado mora em
// `/public/city/inverno/relevo-weisse-wand.json` e `relevo-zwoelfernock.json`
// (⚠️ MUDOU DE LUGAR E DE FORMA DE CARGA em 03/09: ver a seção "FRENTE
// CARREGAMENTO" mais abaixo. Eram `import` estático de `./dados/*.json`, hoje
// são `fetch()` a partir de `public/`. `alturaInvernoAt` continua pura em
// (x, z) e continua devolvendo 0 sem dado, só que agora "sem dado" também
// cobre "a rede ainda não respondeu", não só "a bandeira está desligada").
//
// ⚠️ AS DUAS FEIÇÕES ENTRAM TRÊS VEZES (`FEICOES` abaixo), NÃO DUAS: o
// Zwölfernock uma vez como pico principal, o Weisse Wand duas vezes, em
// posição/giro/escala DIFERENTES cada uma. Reusar a mesma fonte com
// transform diferente é a técnica normal de "stamps" de terreno de
// verdade (é a mesma lógica das 9 sequoias diferentes resolvendo a floresta
// hoje): o que gera repetição não é reusar dado, é reusar POSIÇÃO e ESCALA
// junto. Cada uma das 3 feições tem centro, giro e raio próprios, medidos
// contra o layout do maciço, não copiados.
//
// ⚠️ RUÍDO ENTRA SÓ COMO TEMPERO, DEPOIS: `temperoFino` é ridged multifractal
// de verdade (fórmula do Musgrave/libnoise: `signal = (1 - |ruído|)²`, peso
// do próximo octave realimentado pelo `signal` do anterior, não persistência
// fixa) mais deformação de domínio (a coordenada de amostragem é deslocada
// por outro ruído de célula grande ANTES de qualquer coisa, pra quebrar o
// alinhamento radial que o perfil ainda tem). A amplitude dele é pequena
// contra a das feições reais: ele preenche a escala fina que 96×96 não
// resolve, não desenha a montanha.
//
// ⚠️ A PISTA CONTINUA CAVADA, E A CAVA AGORA TAMBÉM SUPRIME O TEMPERO por
// perto do eixo, não só soma profundidade fixa por cima: relevo com ruído de
// verdade embaixo de uma cava de profundidade constante ainda mostraria
// solavanco, porque subtrair uma constante não achata bump. `pistaPeso`
// (0..1) desliga `temperoFino` perto da fita ANTES do corte entrar, então a
// pista fica lisa como uma pista preparada de verdade, sem virar
// montanha-russa.
// ═══════════════════════════════════════════════════════════════════════════
//
// ═══════════════════════════════════════════════════════════════════════════
// FRENTE CARREGAMENTO, 03/09: o fundador quer o parque "impecável" pro evento
// de hype deste fim de semana, mas foi explícito: "se pesar demais pro user
// entrar fica ruim, precisamos ser muito eficientes nisso". E decidiu, quando
// perguntado, que o parque fica FORA da fila obrigatória de carga, do mesmo
// jeito que o Runestone Park (`park.ts`) já funciona hoje: ninguém espera por
// ele para entrar na cidade, e o peso pesado só entra quando a câmera se
// aproxima ou alguém pede.
//
// ── ACHADO 1: OS DOIS JSON PESAVAM PRA TODO MUNDO, SEMPRE ───────────────────
// `import relevoWeisseWand from './dados/relevo-weisse-wand.json'` e o par
// dele eram `import` ESTÁTICO: 72 KB cada, 145 KB juntos, e um `import`
// estático entra no pacote de JavaScript pra QUALQUER visitante, porque o
// bundler não sabe que `INVERNO_ATIVO` vai dar `false` em produção pra quase
// todo mundo. `terrain.ts` e `alpino.ts` importam `alturaInvernoAt`,
// `zonaEsquiavelAt`, `fatorRochaAt` e `INVERNO_ATIVO` deste arquivo, e os dois
// são NÚCLEO da cidade (sempre carregados, `?inverno=1` ou não). Ou seja: hoje,
// com a bandeira desligada, todo visitante de `/city` baixa 145 KB que nunca
// vai usar, só porque o módulo que ele NUNCA liga mora no mesmo arquivo do
// módulo que ele sempre usa.
//
// O CONSERTO: os dois JSON saíram de `import` estático e viraram `fetch()` em
// tempo de execução, a partir de `/public/city/inverno/*.json` (mudaram de
// `app/city/plaza/dados/` pra `public/`, porque só `public/` é servido por
// URL). `FEICOES` (a lista que `alturaInvernoAt` soma) nasce VAZIA e só ganha
// conteúdo quando o fetch resolve; `alturaInvernoAt` devolve 0 (o MESMO
// neutro de bandeira desligada) enquanto `FEICOES` estiver vazia, guarda
// explícita, não acidente de loop vazio. O CONTRATO das quatro funções
// exportadas (`alturaInvernoAt`, `zonaEsquiavelAt`, `fatorRochaAt`,
// `INVERNO_ATIVO`) fica EXATAMENTE como estava: mesmo nome, mesma assinatura,
// mesmo tipo de retorno, mesmo "não faz nada sem dado". `terrain.ts` e
// `alpino.ts` não mudam uma linha. A prova é o teste offline descrito no
// relatório (roda com o fetch nunca resolvendo e confere que as quatro
// funções batem bit a bit com o comportamento de hoje).
//
// ⚠️ ISSO ABRIA UMA CORRIDA, E A FRENTE DE NEVE MEDIU O ESTRAGO DELA ANTES
// de eu fechar esta frente: `terrain.ts` monta a malha do terreno UMA VEZ,
// cedo no `boot()`, chamando `alturaInvernoAt` por vértice; testado com o
// fetch do relevo forçado a perder a corrida contra o heightmap do terreno,
// o maciço nascia no PERFIL ANTIGO (~322 m em vez de ~1.098 m) e FICAVA
// ASSIM PARA SEMPRE naquela carga de página, porque a malha não é
// reconstruída depois. "Disparar cedo" (o gatilho logo abaixo, no `import`
// deste módulo) reduz a chance de perder a corrida, mas não a elimina, e não
// dá pra torcer pra ganhar corrida onde o resultado errado congela pra
// sempre. A CORREÇÃO fica exportada logo depois do gatilho:
// `aguardaRelevoInverno()`, que `plaza-scene.tsx` precisa chamar (`await`)
// ANTES de montar a malha (`loadTerrain(...)`, ver a nota completa junto da
// função). Isto NÃO afeta o parque em si (pistas/floresta/rochas/estação):
// aquele usa o `heightAt` que já vem pronto de fora, não depende do relevo
// pra nada, e continua na fila de rede pós-portão (ver "QUANDO COMEÇAR A
// REDE").
//
// ── ACHADO 2: O PARQUE TRAVAVA A CIDADE INTEIRA PRA QUEM LIGAVA A BANDEIRA ──
// `buildInverno` era chamado dentro de `daCidade.push(...)` em
// `plaza-scene.tsx`, e `daCidade` é esperado por `Promise.allSettled` antes de
// `stepDone('cidade')`, um dos 12 passos que o portão de carga espera. Com a
// bandeira desligada isso não custava nada (`buildInverno` sai na primeira
// linha), mas com `?inverno=1` ligado — exatamente o link que o fundador vai
// mandar pro hype deste fim de semana — o visitante ficava preso na tela de
// carga até TODA a construção terminar: pistas, halfpipe, vila, dois
// teleféricos, a floresta inteira (5.637 candidatos, medidos em 04/09) e os penhascos
// (até 140 instâncias), mais a rede e o parse Draco de 12 arquivos `.glb`
// (10 espécies de árvore + estação + pacote de rochas), tudo numa função
// `async` só, sem um `yield` sequer. Isso contraria a decisão do fundador.
//
// MEDIDO OFFLINE (Node 20, `tsx`, 03/09, sem abrir navegador), com um
// `heightAt` sintético (rampa natural de 10 a 310 m somada a `alturaInvernoAt`
// de verdade, pra cair na faixa de elevação que a floresta planta) e um
// `gltf` FALSO (resolve na hora com uma malha mínima, isolando o LAÇO de
// construção do parse real do Draco, que só existe no navegador):
//
//     775,37 ms   gerarCandidatosFloresta (o laço de grade inteiro, cold)
//      50,63 ms   pistas + halfpipe + teleféricos + vila-caixa (cold, sem gltf)
//      14,48 ms   (incluso acima) medirPista × 7
//      62,0  ms   floresta + rochas: só o LAÇO de instanciar (InstancedMesh,
//                 compose de matriz), geometria FAKE no lugar do `.glb` real
//     ───────────
//     ~887 ms     soma da CPU pura medida aqui
//
// NÃO MEDIDO, por depender de navegador: o parse Draco real dos 12 `.glb`
// (o `gltf` fake não baixa nem decodifica nada) e o custo de
// `terrain.superficieAt` de verdade, que É mais caro que o `heightAt`
// sintético usado acima (ela chama `cavaEm`, `baseAt`, `bacia`, `monteEm`,
// `podioPeso`, `parkReach`, `parkCore` e `microRelevoAt` a cada chamada, e
// `gerarCandidatosFloresta` chama `heightAt` até 5× por candidato, ~19 mil
// vezes no total). Por analogia com o que esta casa já mediu em produção
// (Chalé OrdCards, 3 assets, 7.648 ms numa tarefa só; Runestone Park, mais
// pesado ainda, 21.257 ms), é seguro dizer que o total real passa de
// segundos quando rodado de uma vez: os ~887 ms medidos aqui já são maiores
// que meia dúzia de tarefas que a `Obra` já trata como "trava real" em
// outras partes desta cidade, e faltam somar rede + parse de 12 arquivos.
//
// O CONSERTO: o mesmo padrão de `parkComoTrabalho` (`park.ts`), com o nome
// `invernoComoTrabalho`. Uma função `async` que só faz REDE (os dois JSON de
// relevo — best-effort, pra `terrain.ts`/`alpino.ts`, não bloqueia o parque
// em si — mais o `.load()` dos 12 `.glb`) e devolve rápido; um `Trabalho`
// (`obra.ts`) cujo gerador `*fatia()` faz a CONSTRUÇÃO cedendo o controle a
// cada poucos ms, do jeito que `park.ts` já mede e reporta com `?stats=1`; e
// um `aoPronto`, chamado quando a fatia termina, onde `plaza-scene.tsx` marca
// o parque como pronto e revela o grupo (`revela(iv.group)`, a mesma forma
// que já existe pro Runestone Park).
//
// ── ACHADO 3: O ORÇAMENTO EM DUAS CAMADAS ───────────────────────────────────
// O pedido do fundador tem duas metades que puxam pra lados opostos: "nível
// top 1 mundo" (detalhe absurdo) e "muito eficiente" (nada pesa pra entrar).
// A resposta não é escolher um lado, é SEPARAR por distância, o mesmo
// princípio do "anel de detalhe" (`R_DET`) já descrito em
// `fundacao-gta5.md` § 2 pro resto da cidade (aqui é uma constante própria,
// não a mesma variável: a escala do maciço, ~1.500 m de ponta a ponta, não
// tem nada a ver com a escala de um meio-fio).
//
// CAMADA LONGE (sempre construída, pela `Obra`, mas NUNCA some e NUNCA espera
// aproximação): a silhueta do maciço. O relevo em si (as `FEICOES` somadas em
// `terrain.ts`) já é de graça aqui — inverno.ts não desenha terreno, só lê
// `heightAt` de fora. O que ESTE módulo constrói sempre e barato:
//   - as 7 fitas de pista + o halfpipe + os 2 teleféricos + a vila-caixa
//     placeholder: ~2.268 triângulos, MEDIDO acima (o "buildInverno total"
//     de 50,63 ms sem gltf, que é exatamente essa lista);
//   - uma floresta ESPARSA, só CONE (8 tri cada, a mesma silhueta de longe
//     que a floresta cheia já usa pra quem está longe dela), teto de 220
//     árvores. Proposto dentro da faixa pedida (150 a 300): o maciço cobre
//     um arco de 40° entre r 7.150 e 8.650 visto da praça a ~8 km, ou seja
//     cada árvore da silhueta cobre um ângulo minúsculo — 220 pontos bem
//     espalhados (reaproveitando o MESMO sorteio de posição da floresta
//     cheia, por passo, não uma segunda grade) bastam pra quebrar a
//     sensação de "montanha pelada" sem custar mais que 220×8 = 1.760
//     triângulos.
//   Total da camada longe: ~4.000 triângulos, a maior fatia medida (a
//   geração de candidatos, 775 ms cold) FATIADA pela `Obra` como tudo aqui,
//   então mesmo esse custo nunca trava um quadro.
//
// CAMADA PERTO (só entra quando a câmera cruza `INVERNO_R_DET`, pela MESMA
// `Obra`, fatiada, nunca de uma vez): a floresta densa completa (5.637
// candidatos, MEDIDO em `gerarCandidatosFloresta` com o `heightAt` real, nota
// de `FLORESTA_TETO_PERTO` mais abaixo: as 450 MAIS PRÓXIMAS da câmera em
// malha real, o resto em cone com a silhueta da espécie), o pacote de rochas (até 140 instâncias, até 430.640 triângulos no
// pior caso, ambos já medidos e documentados na seção "OS PENHASCOS"), e a
// estação em detalhe (troca a caixa placeholder pela estação real de
// `estacao-inverno.ts`, integrada pelo coordenador em 03/09). Nada disso é
// reduzido nem simplificado: é o MESMO conteúdo "top 1
// mundo" que o fundador pediu, só adiado pra quando alguém está perto o
// bastante pra ver a diferença.
//
// `INVERNO_R_DET = 6000` (6 km, era 4.000 até 04/09), medido a partir do mesmo
// ponto que já ancora o culler do grupo inteiro (`r=7800, az=268`, ver o fim do
// arquivo). Justificativa antiga: dar margem pra a `Obra` terminar de construir
// a camada perto ANTES de a câmera chegar perto o bastante pra notar a malha de
// longe ainda em pé. Justificativa NOVA, e ela é medida: as câmeras de contrato
// de `scripts/city/chapas.mjs` ficam a 3.997 m (`inverno`) e 4.580 m
// (`silhueta`) deste ponto, ou seja a chapa da CADEIA INTEIRA nunca via a
// camada perto e a outra passava por três metros. Ver a nota da constante.
// Comparado ao raio de descarte do grupo inteiro (26.000 m, `o.culler?.add`),
// 6.000 m ainda é bem menor, então o gatilho nunca dispara depois que o parque
// já teria sumido por distância.
//
// ⚠️ A CAMADA PERTO NÃO PODE USAR A `Obra` COMPARTILHADA (a mesma instância
// que `plaza-scene.tsx` cria em `boot()` e passa pra chalé/monumentos/parque):
// aquela `Obra` é SELADA (`obra.sela()`) no fim do `boot()`, e `põe()` recusa
// qualquer trabalho novo depois disso (ver a nota de `selado` em `obra.ts`).
// Como a câmera pode cruzar `INVERNO_R_DET` MINUTOS depois do portão abrir
// (o visitante andando pela cidade antes de ir até o parque), qualquer
// `põe()` tardio na `Obra` compartilhada seria recusado e a camada perto
// nunca subiria. A CAMADA LONGE usa a `Obra` compartilhada normalmente (entra
// durante o `boot()`, igual ao parque/chalé/monumentos); a CAMADA PERTO usa
// uma `Obra` PRÓPRIA deste módulo, instanciada uma vez, cujo `.passo()` é
// chamado de dentro do `update(cam)` do próprio parque — o mesmo `update`
// que `plaza-scene.tsx` já chama todo quadro (`inverno?.update(camera.position)`,
// sem mudar essa linha). É o MESMO mecanismo (a classe `Obra`, o mesmo
// orçamento por quadro, o mesmo "uma peça que cai não derruba a cidade"),
// só uma segunda instância, porque a primeira já fechou as portas.
//
// ── QUANDO COMEÇAR A REDE ────────────────────────────────────────────────
// A rede do inverno (os 2 JSON + os 12 `.glb`) só começa DEPOIS que
// `abrirPortaoInverno()` é chamado, e a única chamada dela fica em
// `plaza-scene.tsx`, dentro de `stepDone`, no mesmo instante em que `pronto`
// vira `true` (o portão da cidade abre). Antes disso a chamada fica
// suspensa numa Promise. MOTIVO: no instante em que o portão abre, o boot já
// disparou dezenas de outros fetches e `.glb` (chalé, monumentos, parque,
// adereços, fundadores, galeria) — competir por conexão HTTP nesse momento
// atrasaria exatamente os arquivos que SEGURAM a tela de carga. Esperar o
// portão abrir e só então disparar a rede do parque bota a rede dele numa
// fila que não compete com nada crítico, e ainda assim começa cedo o
// bastante (no instante em que a cidade abre, não quando a câmera chega
// perto) pra o parque estar pronto ou quase pronto quando o visitante for
// até lá por Tour ou por Places. A CONSTRUÇÃO (o que pesa de verdade) nunca
// entra nessa conta: ela é sempre `Obra`, sempre fatiada, o portão nunca
// espera por ela — nem pela camada longe, nem pela perto.
// ═══════════════════════════════════════════════════════════════════════════

// Three.js puro (regra da casa: nada de react-three-fiber).
// ═══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { DistanceCuller, PerfProfile } from './perf'
import { Obra, emFatias, type Tarefa, type Trabalho } from './obra'
import { buildEstacaoInverno, type EstacaoInverno } from './estacao-inverno'
import { buildInvernoDetalhe } from './inverno-detalhe'

// ⚠️ DEFEITO ACHADO E CONSERTADO EM 03/09, DEPOIS DE LIGAR O PADRÃO POR
// PADRÃO. Medido ao vivo: os `gltf.load()` desta rodada (pinheiro, sequoia,
// pacote de rocha, todos convertidos hoje) disparam e NUNCA voltam, nem
// sucesso, nem erro, nem progresso. O decodificador Draco embutido
// (`public/draco/`, de 09/07) parece travar silenciosamente em cima de um
// bitstream codificado por uma versão mais nova do exportador, sem nunca
// postar erro de volta pro worker principal. Sem limite de tempo, a Promise
// que `carregarInstanciavel`/`carregarPacoteRochas` devolvem FICA PENDENTE
// PARA SEMPRE, e como `baixaAtivosInverno` é aguardada ANTES de
// `invernoComoTrabalho` devolver o `Trabalho`, a função inteira nunca
// retorna: nenhuma pista, halfpipe, teleférico, vila ou floresta jamais
// entra na cena, mesmo a camada BARATA que não depende de espécie nenhuma.
//
// A regra que sai daqui, e que vale para qualquer `gltf.load()` desta cena:
// UM RECURSO EXTERNO (rede, worker, decodificador) NUNCA TEM PERMISSÃO DE
// TRAVAR A CENA PARA SEMPRE. Toda promessa de carga precisa de um teto de
// tempo, e estourar o teto é uma FALHA COMO QUALQUER OUTRA (a espécie fica de
// fora, o peso dela é redistribuído), nunca um travamento silencioso.
/**
 * ⚠️ 8.000 ms ERA CURTO DEMAIS, E O DIAGNÓSTICO ESTAVA ERRADO NA MENSAGEM.
 *
 * Em 06/09 as ONZE espécies da floresta e o pacote de rochas estouravam o teto
 * numa conferência de chapa, todas juntas, e a mensagem culpava "rede lenta".
 * Medido: os arquivos existem e o `next dev` os entrega em **2 ms**
 * (`curl` direto), e o loader é o da cena, com `DRACOLoader`. Ou seja, nem rede
 * nem decodificador faltando.
 *
 * O que acontece é STARVATION DA THREAD PRINCIPAL. O portão do inverno abre no
 * mesmo instante em que a cidade abre, e nesse instante a `Obra` está fatiando
 * o parque, o chalé, os monumentos e os adereços. Os 12 GLB são Draco + WebP:
 * o worker termina, mas o CALLBACK precisa da thread principal, e ela está
 * ocupada. O relógio de 8 s é de PAREDE e vence a corrida sem que nada esteja
 * quebrado.
 *
 * O teto continua existindo, e pelo motivo original: um recurso externo nunca
 * pode travar a cena PARA SEMPRE. Mas 8 s não é "para sempre" numa cena que
 * leva 40 s para montar. `TETO_CARGA` é a nova referência, e a mensagem agora
 * diz quanto tempo passou de verdade, para a próxima pessoa não voltar a
 * culpar a rede.
 */
const TETO_CARGA = 45000

function comLimiteDeTempo<T>(p: Promise<T>, ms: number, rotulo: string): Promise<T> {
  const t0 = performance.now()
  return Promise.race([
    p.then((v) => {
      const dt = performance.now() - t0
      if (dt > 4000) console.warn(`${rotulo}: subiu em ${(dt / 1000).toFixed(1)} s (thread principal congestionada)`)
      return v
    }),
    new Promise<T>((_res, rej) => setTimeout(
      () => rej(new Error(
        `${rotulo}: sem resposta em ${ms} ms. Antes de culpar a rede, confira: `
        + `o arquivo existe em public/? o loader tem DRACOLoader? Se as duas forem sim, `
        + `é a thread principal congestionada e o teto é que está curto.`)),
      ms,
    )),
  ])
}
// ⚠️ OS DOIS RELEVOS ASSADOS (script Python, fora deste arquivo, dos scans
// fotogramétricos reais: ver a nota "SEGUNDA CORREÇÃO" acima) NÃO SÃO MAIS
// `import`. Ver "FRENTE CARREGAMENTO" no cabeçalho: eram `./dados/*.json`
// estático (145 KB no pacote de TODO visitante, bandeira ligada ou não);
// agora são `fetch('/city/inverno/*.json')`, carregados só quando
// `INVERNO_ATIVO`, e o arquivo mudou de `app/city/plaza/dados/` pra
// `public/city/inverno/` porque só `public/` é servido por URL.

// ═══════════════════════════════════════════════════════════════════════════
// A RODADA DA MONTANHA, 04/09/2026. Quartel em `montanha.md`, na raiz do repo.
// O fundador nomeou cinco defeitos; três moram neste arquivo, e o que segue é
// o que mudou aqui, sempre com o número MEDIDO OFFLINE (Node 20, `tsx`,
// `heightAt` REAL de `terrain.ts` sobre o heightmap real, sem abrir navegador).
//
// 1. "AS SEQUOIAS ESTÃO SEM TRONCO". `carregarInstanciavel` parava na PRIMEIRA
//    malha do GLB, e o exportador glTF quebra a malha em uma primitiva POR
//    MATERIAL. Em 8 dos 9 `sq-*.glb` a folha vem primeiro e o tronco ia fora;
//    o pinheiro (metade da floresta) era desenhado com 11 dos 3.199 triângulos
//    dele, 0,3% do modelo. Agora é uma `InstancedMesh` por parte, o padrão que
//    `props.ts:381` já usava. A árvore média foi de 917 para 2.957 triângulos.
//
// 2. "OS PICOS ESTÃO ABSURDAMENTE PONTIAGUDOS". Talude médio nos primeiros
//    400 m do cume, média de 32 rumos: 57,5 graus antes, 34,5 depois. Em 500 m:
//    54,0 antes, 35,5 depois. Cume 1.147,7 -> 1.043,8 m (a faixa pedida era
//    1.000 a 1.150). Área do maciço acima de 400 m: 9,2% -> 18,7% da cunha, ou
//    seja a montanha ganhou CORPO em vez de perder altura. Três mecanismos
//    novos, cada um documentado onde vive: `faixaR` (perfil radial próprio da
//    crista, fora do envelope do avental), `contraste` (desbaste do gume no
//    VALOR do dado assado) e `suavizaCelula` (passa-baixa de uma célula, que
//    era uma agulha de 152 m em 50 m). Mais quatro feições novas (duas selas e
//    dois contrafortes) ligando os três cumes: a cadeia deixou de ser três
//    agulhas soltas e passou a ter crista e colo.
//
// 3. "A VEGETAÇÃO É COMPLETAMENTE ESPARSA". Três causas medidas e as três
//    consertadas: a camada esparsa levava 220 cones para 5.637 candidatos (uma
//    árvore a cada 236 m, e é ELA que toda chapa de contrato fotografava,
//    porque `INVERNO_R_DET` era menor que a distância das câmeras de contrato);
//    o cone de longe tinha 60% da altura e 42% da largura da árvore que
//    substitui; e as 450 árvores de malha real eram um SORTEIO FIXO, então 92%
//    do que estava ao redor do visitante era cone mesmo a 30 m. A faixa de
//    plantio também ia só até 190 m num maciço de 1.044.
//
// O que NÃO mudou, de propósito: o avental do Fuji (raioM 6.600, peso 420) e o
// `envelopeRadial` inteiro estão bit a bit como estavam, e a adição em r < 6.900
// continua medindo os mesmos 146,3 m. A regra desta rodada era não crescer para
// dentro do tecido da cidade, e ela é verificável a qualquer hora com o mesmo
// laudo offline.
//
// ── OBRA 2, MESMO DIA: o que os revisores acharam, e a lagoa ────────────────
// 4. "A CAMADA PERTO TRIPLICOU DE CUSTO E NÃO OLHA PARA A MÁQUINA". Ela nunca
//    tinha lido `PerfProfile`: celular e desktop instanciavam as mesmas 450
//    árvores em 22 chamadas de desenho, as mesmas 140 rochas, tudo com
//    `castShadow`. Agora o orçamento sai do perfil (`orcamentoPerto`, com a
//    tabela medida de ponta a ponta): o desktop fica IGUAL ao de antes, o
//    celular cai para 35% do custo e sai do passe de sombra, o LOW para 25%.
// 5. "OS TOPOS DE TELEFÉRICO NÃO ESTÃO NO TOPO". Estavam, além disso, escritos
//    em DOIS lugares com números diferentes (cabo em r 8.280/8.220, cabines em
//    8.200/8.150). Virou uma tabela só, `VAOS_TELEFERICO`, e os dois topos
//    foram para o máximo MEDIDO de cada rumo, de 25 em 25 m.
// 6. A LAGOA ALPINA ganhou a BACIA (a água é da frente seguinte, que importa
//    `LAGOA_CENTRO`, `LAGOA_RAIO` e `LAGOA_COTA` daqui): 5,41 ha de lâmina a
//    407 m de cota, 21,2 m de profundidade máxima e 14,2 graus de orla nos
//    primeiros 30 m, na sela entre o cume sul e o contraforte sul.
//
// ── OBRA 3, 05/09: o fundador viu o pico EM PRODUÇÃO e aprovou a forma ──────
// "Acabei de ver o pico em produção, está ótimo. Muito realista." A FORMA está
// fechada, e nada aqui a toca. Faltavam duas coisas, e as duas eram desta
// frente:
// 7. "OS LAGOS DA REGIÃO DAS MONTANHAS", no plural, como o pedido original já
//    dizia. A bacia única virou a tabela `BACIAS`, com CINCO corpos de 1,17 a
//    5,46 ha em cotas de 256 a 683 m, três deles num degrau só. 18,18 ha de
//    água contra 5,41. O primeiro corpo é o de ontem, bit a bit, e os três
//    exports antigos viraram apelidos dele. Ver a seção "OS LAGOS ALPINOS".
// 8. "A DESCIDA AINDA SOBE", achado do revisor da obra 2 e defeito que qualquer
//    pessoa que esquia vê na hora. Mexer no `rInicio` nunca ia resolver, porque
//    az 268 não é o eixo do cume: o alto da cadeia está em az 262, 82 m acima.
//    A pista mudou de RUMO e passou de 189,07 m de subida somada para 0,00, em
//    90 passos. Ver a tabela do conserto acima de `ESPECIFICACOES`.
// ═══════════════════════════════════════════════════════════════════════════

// ── A BANDEIRA ───────────────────────────────────────────────────────────────
// ⚠️ PADRÃO INVERTIDO EM 03/09/2026, decisão do fundador: o parque virou o
// ponto alto do hype do fim de semana e passou a ser o que todo visitante vê.
// `?inverno=0` vira a VOLTA DE EMERGÊNCIA (mesmo espírito de `look.ts`), até o
// dia em que a bandeira for apagada de vez.
//
// ⚠️ `typeof window !== 'undefined'` CONTINUA NO LADO ESQUERDO, e isso não é
// detalhe. Este componente é `'use client'`, mas o Next.js ainda o renderiza
// uma vez NO SERVIDOR para montar o HTML inicial, e o `if (INVERNO_ATIVO) void
// carregarRelevo()` logo abaixo roda na AVALIAÇÃO DO MÓDULO, fora de qualquer
// `useEffect`. Inverter para `typeof window === 'undefined' || ...` (que seria
// o espelho ingênuo do padrão de cima) faria essa condição valer `true` NO
// SERVIDOR, disparando um `fetch('/city/inverno/...')` com URL relativa dentro
// do runtime Node do SSR, que não tem base para resolver e lança. Mantendo o
// `typeof window` do jeito que sempre foi, o servidor nunca vê `INVERNO_ATIVO`
// como verdadeiro, e só o navegador decide.
// ⚠️ A LAGOA É OPT-IN, E A BANDEIRA MORA AQUI POR UM DEFEITO MEDIDO EM 04/09.
// A bacia (relevo) e a água (malha) nasceram em frentes diferentes na mesma
// rodada: a água ficou atrás de `?lagoa=1` e a bacia entrou pelo caminho
// padrão de `alturaInvernoAt`. O que foi ao ar foi uma COVA SECA de 5,4 ha e
// 20,7 m de profundidade na encosta, sem uma gota dentro. As duas metades
// passam a ler a MESMA constante, e `lagoa.ts` importa esta em vez de reler a
// query: duas leituras da mesma bandeira é como o defeito nasceu.
export const LAGOA_ATIVA =
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('lagoa') === '1'

export const INVERNO_ATIVO =
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('inverno') !== '0'

// ── A GEOGRAFIA, EM NÚMERO (ver a conta completa no cabeçalho) ──────────────
/** o pico medido por `alpino.ts`, tal como está hoje, sem este módulo */
export const PICO_MEDIDO = { x: -8234, z: -902, r: 8283.3, azimuteGraus: 264 }

/** janela angular da crista nova, em rumo (0 = -Z, sentido horário) */
const AZ0 = 248
const AZ1 = 288

/** bandas radiais do perfil, redesenhado em 03/09 depois da chapa reprovar
 *  a montanha como duna sem aresta. A versão anterior tinha um PLANALTO
 *  (R_CRISTA0 a R_CRISTA1, 270 m de topo achatado): é exatamente isso que lê
 *  como cúpula de areia. Uma crista de verdade é uma ARESTA, não um platô:
 *  um raio SÓ no topo (R_CRISTA_PICO), subida mansa de um lado (o versante
 *  esquiável, para a cidade) e queda ABRUPTA do outro (a face de rocha, para
 *  fora). R_PE é o pé, dentro do anel que o pódio da abóbada já deixa
 *  plano; R_QUEDA é onde a adição volta a zero, antes da fratura de borda
 *  medida na Tarefa 1. */
const R_PE = 7150
/** ⚠️ ESTE RAIO VOLTOU A SER SÓ DO AVENTAL EM 04/09, e a volta é deliberada.
 *  Mexer nele para consertar a crista foi TENTADO E MEDIDO nesta mesma rodada,
 *  e o resultado reprovou: levar 8.280 para 8.100 subia a adição em r 6.900 de
 *  146,3 para ~161 m (fura a regra de não crescer dentro do tecido da cidade),
 *  e levar para 8.380 arrastava o cume para r 8.240, colado em `R_QUEDA`, onde
 *  8 dos 32 rumos despencam 920 m em 500 m. A crista agora tem faixa radial
 *  PRÓPRIA (`faixaR`) e não passa mais por este envelope, então o avental
 *  ficou com ele inteiro, do jeito que o fundador aprovou. */
const R_CRISTA_PICO = 8280
const R_QUEDA = 8650
/**
 * ⚠️ O AVENTAL, 03/09/2026, e ele é a resposta a um defeito de FORMA que o
 * fundador descreveu assim: "hoje temos um pico único, queremos declives
 * controlados no entorno, para as mansões... hoje parece que só tem pista pra
 * atletas avançados".
 *
 * ⚠️ A CAUSA ESTAVA NA FONTE, e ela se lê num número só. O maciço era carimbado
 * a partir de dois scans de PAREDÃO, e o Weisse Wand mede 900 x 901 x 902 m:
 * altura igual à largura, razão 0,997. Uma forma com essa proporção não tem
 * declive habitável em lugar nenhum, e nenhum acabamento cria um. Medido na
 * superfície como construída (grade de 12,3 m, `topo.mjs`), o maciço subia 988 m
 * em 750 m de percurso — 132% de grau, com um trecho de 234% — e da cunha de
 * 12,68 km² sobrava: 27,1% de penhasco (>60%), e de terra mansa acima de 120 m,
 * 216,7 ha, dos quais ~200 ATRÁS da crista, onde ninguém chega.
 *
 * ⚠️ E ESPALHAR NÃO CUSTA CIDADE. Medido em `cidade-lotes.bin`: na cunha do
 * maciço (rumos 246-292) existem ZERO lotes entre r 5.500 e 6.900, e 26 entre
 * 5.000 e 5.500 — 0,03% da cidade. O declive de paredão já reprovava aquela
 * terra no teste de 4° do gerador. O avental não come cidade: ele recupera
 * 13,5 km² que estavam sendo desperdiçados.
 *
 * A fonte nova é o Mount Fuji Wide Area (DEM de 41,6 x 34,2 km por 3.573 m,
 * razão 0,086 — onze vezes mais manso), e o gradiente dele foi medido no
 * próprio DEM antes de entrar: 37-41% no cone (0-4 km do cume), 25% em 4-6 km,
 * 15,5% em 6-8 km e 10,4% em 8-12 km. Essa faixa de 10-15% é a de Beverly
 * Hills, que é a referência que o fundador deu.
 */
const R_AVENTAL = 5500
/** expoente da face de rocha do AVENTAL. Continua valendo: isto é o envelope de
 *  EXISTÊNCIA (onde o avental pode aparecer), não a forma fina do maciço.
 *
 *  ⚠️ O COMENTÁRIO ANTIGO ("mantém a curva perto de 1 quase até o topo e desaba
 *  no último trecho") DESCREVE A CURVA AO CONTRÁRIO, e vale corrigir porque
 *  alguém vai voltar aqui: `t` vale 1 na crista e 0 em `R_QUEDA`, e para t em
 *  (0,1) tem-se t^2,4 < t com derivada 2,4 em t=1. Ou seja o expoente faz a
 *  curva desabar LOGO onde a crista começa e depois arrastar uma cauda fina, o
 *  oposto do que está escrito. O número fica em 2,4 mesmo assim: quem sofria
 *  com ele era a crista, e a crista saiu deste envelope (ver `faixaR`). Para o
 *  avental, que em r 8.280 já é baixo, a cauda fina é o pé macio que se quer. */
const EXP_FACE_ROCHA = 2.4
/** expoente da face EXTERNA da crista (a queda de `faixaR`, de r2 a r3).
 *  Menor que 1 de propósito, e o motivo é aritmético: entre o fim do platô da
 *  faixa (r 8.110) e `R_QUEDA` sobram 540 m de corrida para ~824 m de relevo,
 *  e um `suave01`
 *  puro gasta essa corrida devagar no começo, deixando a queda inteira para o
 *  fim. Medido no envelope: em r 8.570 o suave01 puro retém 5,8% do peso e
 *  ^0,7 retém 13,5%, o que tira ~100 m da queda de cada rumo externo. Abaixo de
 *  0,7 o pé vira um degrau (com ^0,5 seriam 26 m nos últimos 10 m de raio), e
 *  degrau no pé é exatamente a "mesa com beirada cortada" que esta rodada foi
 *  proibida de fabricar. */
const EXP_FACE_CRISTA = 0.7

function suave01(t: number): number {
  const u = t < 0 ? 0 : t > 1 ? 1 : t
  return u * u * (3 - 2 * u)
}

/**
 * Rampa de 0 a 1 com um TRECHO RETO no meio e as duas pontas arredondadas em
 * `macio` (fração do percurso). Existe porque `suave01` não serve para desenhar
 * uma encosta longa: ele é plano nas duas pontas e paga isso com o dobro no
 * meio, com derivada máxima 1,5 vezes a média. Numa encosta de 824 m em 1.250 m
 * (a subida interna da crista, ver `faixaR`) isso significa 33,4 graus de
 * talude médio virando 44,7 no meio da encosta, e era esse trecho do meio que
 * aparecia como parede. Com `macio` 0,20 a derivada máxima cai para 1,25 vezes
 * a média (39,7 graus no mesmo caso) e as pontas continuam suaves, sem vinco.
 *
 * Conferido por continuidade: em `u = macio` os dois ramos valem `k·macio/2` e
 * têm a mesma derivada `k`, então a curva é C¹ nas duas emendas.
 */
function rampaReta(t: number, macio: number): number {
  const u = t < 0 ? 0 : t > 1 ? 1 : t
  const m = Math.min(0.499, Math.max(1e-4, macio))
  const k = 1 / (1 - m)
  if (u < m) return (k * u * u) / (2 * m)
  if (u > 1 - m) { const v = 1 - u; return 1 - (k * v * v) / (2 * m) }
  return k * (u - m / 2)
}

/** diferença angular mínima entre dois rumos em graus, sempre em [-180,180] */
function difAngulo(a: number, b: number): number {
  let d = (a - b) % 360
  if (d > 180) d -= 360
  if (d < -180) d += 360
  return d
}

function azimuteDe(x: number, z: number): number {
  const a = (Math.atan2(x, -z) * 180) / Math.PI
  return (a + 360) % 360
}

// ── ruído determinístico local (mesmo esquema de hash de `alpino.ts`, sem
// importar de lá: os dois módulos não precisam compartilhar estado, e cada
// hash tem semente própria) ──────────────────────────────────────────────
function hash01(i: number): number {
  let t = (i + 0x9e3779b9) >>> 0
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
function hash2(ix: number, iz: number, semente: number): number {
  return hash01((ix * 73856093) ^ (iz * 19349663) ^ (semente * 83492791))
}
function ruido(x: number, z: number, celula: number, semente: number): number {
  const fx = x / celula, fz = z / celula
  const ix = Math.floor(fx), iz = Math.floor(fz)
  const tx = fx - ix, tz = fz - iz
  const sx = tx * tx * (3 - 2 * tx), sz = tz * tz * (3 - 2 * tz)
  const a = hash2(ix, iz, semente), b = hash2(ix + 1, iz, semente)
  const c = hash2(ix, iz + 1, semente), d = hash2(ix + 1, iz + 1, semente)
  return (a + (b - a) * sx) * (1 - sz) + (c + (d - c) * sx) * sz
}

function pontoEmRumo(r: number, azGraus: number): [number, number] {
  const a = (azGraus * Math.PI) / 180
  return [Math.sin(a) * r, -Math.cos(a) * r]
}

// ── AUTORIA DAS PISTAS ───────────────────────────────────────────────────────
// ⚠️ AS PISTAS SERPENTEIAM DE PROPÓSITO, NÃO DESCEM PELA LINHA DE MAIOR
// DECLIVE. A Tarefa 3 mediu por quê: a aceleração de rampa cai por 6,035 na
// Lua, então a velocidade e a dificuldade desta pista não podem vir de ângulo,
// têm que vir de PERCURSO. Cada ponto é (raio, rumo); a altura de cada um é
// lida de `heightAt` na hora de desenhar, nunca suposta aqui.
//
// Desnível de cada pista, medido no perfil real (script de medição, az 268°,
// que é o eixo do pico principal): ver a tabela completa no relatório final.
// Aqui só a autoria; a conferência do número é depois de `heightAt` existir.
export type Dificuldade = 'verde' | 'azul' | 'vermelha' | 'preta' | 'parque'
export interface Pista {
  nome: string
  dificuldade: Dificuldade
  /** largura da fita, em metros */
  largura: number
  pontos: { r: number; az: number }[]
}

/**
 * ⚠️ A PRIMEIRA AUTORIA (waypoints soltos, 5 a 8 pontos por pista) errou por
 * um motivo medido, não por acaso: um salto de 30° de rumo com o raio quase
 * parado é uma DIAGONAL enorme (a 7.500 m de raio, 30° são 3.927 m de arco),
 * então o "serpenteio" virou zigue-zague gigante: 22,7 km de pista para
 * 1.053 m de desnível, 2,7° de grau médio, mais raso que uma calçada. Uma
 * pista de verdade serpenteia em CURVA CONTÍNUA, não em cotovelo. Por isso a
 * autoria agora é paramétrica: raio varre em linha reta de início a fim, o
 * rumo oscila em seno em torno de um eixo, e o número de amostras é alto o
 * bastante para a fita seguir a curva de perto. `medirPista` (abaixo) fecha o
 * ciclo: mede o resultado de verdade e é o que decidiu `oscilacoes` e
 * `amplitude` de cada pista, não o contrário.
 */
interface EspecPista {
  nome: string
  dificuldade: Dificuldade
  largura: number
  rInicio: number
  rFim: number
  azCentro: number
  /** meia-amplitude da serpentina, em graus */
  amplitude: number
  /** quantas oscilações completas de início a fim */
  oscilacoes: number
  amostras: number
}

function gerarSerpentina(e: EspecPista): { r: number; az: number }[] {
  const pts: { r: number; az: number }[] = []
  for (let i = 0; i <= e.amostras; i++) {
    const t = i / e.amostras
    const r = e.rInicio + (e.rFim - e.rInicio) * t
    const az = e.azCentro + e.amplitude * Math.sin(t * Math.PI * 2 * e.oscilacoes)
    pts.push({ r, az })
  }
  return pts
}

// As especificações abaixo foram tuneladas contra `medirPista` de verdade
// (varredura de amplitude × oscilações no script de medição, não suposição).
// ⚠️ A PRIMEIRA RODADA DE AJUSTE ENSINOU UMA SEGUNDA COISA, além da diagonal
// gigante: quanto MAIS a fita serpenteia, MAIS RASA ela fica (mais percurso
// para o mesmo desnível), então a amplitude certa é a MENOR que ainda cobre o
// desnível pedido pela norma, não a maior. E o pé da montanha (r < 7.700,
// dentro da faixa que o pódio da abóbada ainda suprime em parte) é fisicamente
// mais manso que a crista: as provas técnicas curtas (Super-G, Gigante,
// Slalom) foram por isso realocadas para o FLANCO onde o relevo esculpido já
// é íngreme de verdade (r ≈ 7.500 a 8.000), não empurradas à força com
// serpentina. Números finais, medidos, no relatório.
//
// ⚠️ TODAS AS SETE FORAM REVÃOS EM 04/09, E NÃO POR GOSTO: a crista saiu de
// r 8.280 para r ~8.150 e o flanco esquiável passou a ocupar de 6.700 a 8.200
// (ver `faixaR`). Com os raios antigos, a Descida COMEÇAVA 130 m fora do cume e
// SUBIA antes de descer (medido: 92 m de subida no pior passo) e as provas
// curtas perdiam metade do desnível de homologação (Super-G 615 -> 285 m,
// Gigante 493 -> 198 m). Números medidos com `medirPista` sobre o `heightAt`
// REAL de `terrain.ts` (offline, Node 20, sem abrir navegador), antes e depois:
//
//   pista                   norma FIS      antes          depois
//   Descida                 até 1.100 m    855 m          890 m
//   Super-G                 400 a 650      615            564
//   Slalom Gigante          250 a 450      493 (fora)     413
//   Slalom                  180 a 220      193            204
//   Boardercross            100 a 250      257 (fora)     227
//   Slopestyle              sem norma      108            236
//   Verde                   16 a 25% grau  4,0° (7%)      9,0° (16%)
//
// E a monotonia, que é o que decide se a fita é esquiável: a maior SUBIDA num
// passo caiu de 92/82/72/41 m (Descida/Super-G/Gigante/Slalom) para
// 47/13/5/10 m.
//
// ⚠️ UMA LINHA MUDOU DE NOVO EM 04/09, NA OBRA 2, e só uma: a DESCIDA. O cume
// do rumo 268 foi remedido de 25 em 25 m (a nota de `VAOS_TELEFERICO` traz a
// tabela) e ele está em r 8.150, não em r 8.200. Com a partida no 8.200 a fita
// subia 21 m antes de descer. Remedido na MESMA régua da tabela acima
// (`heightAt`, Node 20, offline): 890 -> 885 m de desnível e a maior subida num
// passo de 47 -> 36 m. As outras seis não foram tocadas e continuam medindo o
// mesmo, conferido nesta rodada: 564 / 413 / 204 / 227 / 236 / 9,0°.
//
// ⚠️ E AQUELE CONSERTO DE 04/09 NÃO RESOLVEU: A DESCIDA CONTINUAVA SUBINDO,
// 05/09. Mexer no `rInicio` só trocava o degrau de lugar, porque o defeito nunca
// esteve no ponto de partida: estava no TRAÇADO. Medida ponto a ponto no eixo da
// fita (91 amostras, `heightAt` real de `terrain.ts`, offline), a serpentina de
// az 268 / amplitude 6 subia em 18 dos 90 passos, 189,1 m de subida somada, com
// dois degraus grandes e ambos estruturais, não ruído:
//
//   passos  1 a  7   r 8.150 -> 8.049   +79,9 m   a fita entra no ombro de az 271
//   passos 27 a 36   r 7.774 -> 7.630   +75,5 m   o contraforte interno de az 272
//
// (o tempero fino não entra nessa conta: a cava da pista o desliga no eixo, ver
// `temperoFino`, então o que sobe ali é a montanha, não o ruído.)
//
// A CAUSA, e ela é geográfica: az 268 NÃO é o eixo do cume. Varrendo a
// superfície macro de 2,5 em 2,5 m de raio e de 0,02 em 0,02 grau de rumo
// (326.851 amostras), o alto da cadeia mora em az 261 a 262, e é o mesmo ponto
// que `montanha.md` já tinha achado por outro caminho (o máximo de
// `superficieAt` em (-8.041, 1.130), que é r 8.120 / az 262). Em az 268 o topo
// vale 925,4 m; em az 261, 1.007,8 m. Descer 880 m a partir de um ombro, com o
// cume 82 m acima e ao lado, obriga a fita a subir antes: qualquer serpentina
// que saia de az 268 esbarra no ombro ou no contraforte, e por isso mexer no
// `rInicio` nunca ia resolver.
//
// O CONSERTO: a Descida mudou de RUMO, não de ponto de partida. Ela desceu do
// ombro para a linha do cume, az 262, ao lado do topo do teleférico 2
// (`VAOS_TELEFERICO[1]`, r 8.100 / az 261, a 183 m da largada). Varredura de
// 1,7 milhão de traçados (rInicio × rFim × azCentro × amplitude × oscilações),
// triados numa grade polar e os finalistas reconferidos um a um na função real,
// com TRÊS filtros duros: zero subida, desnível dentro da norma FIS e folga de
// eixo contra as outras seis pistas. O escolhido é o de MAIOR percurso entre os
// que passam nos três, que é a doutrina desta tabela (na Lua a dificuldade vem
// de percurso, não de ângulo, porque a rampa acelera 6,035 vezes menos).
//
//   Descida                    antes (az 268)   depois (az 262)
//   maior subida num passo         35,76 m          0,00 m
//   subida somada                 189,07 m          0,00 m
//   passos que sobem               18 de 90         0 de 90
//   desnível                      885,4 m          854,6 m   (FIS: até 1.100)
//   percurso                      3.799 m          2.459 m
//   grau médio                     13,1°            19,2°
//   cota da largada               922,2 m          992,2 m
//   folga de eixo à pista vizinha       0 m          101 m
//   folga entre as BORDAS das fitas   -30 m           +74 m
//
// ⚠️ A LINHA DA FOLGA É A QUE QUASE PASSOU DESPERCEBIDA. O primeiro traçado que
// zerou a subida (az 261, amplitude 3,25) cruzava o Slopestyle a 4 m de eixo, ou
// seja as duas fitas se sobrepunham por 23 m: consertar a subida e entregar uma
// pista de velocidade atravessando o parque de manobras é trocar um defeito por
// outro. A folga entrou como filtro da varredura, não como conferência depois.
const ESPECIFICACOES: EspecPista[] = [
  {
    nome: 'Descida do Mar da Tranquilidade', dificuldade: 'preta', largura: 30,
    // ⚠️ AZ 262 É O CUME MEDIDO, E AZ 268 NUNCA FOI. Ver a tabela do conserto de
    // 05/09 acima: 0,00 m de subida em 90 passos, contra 189,07 m. A largada fica
    // a 183 m do topo do teleférico 2 (r 8.100 / az 261), e a chegada a 454 m da
    // Pista Verde de Acesso, que é o retorno manso para a vila-base.
    // ⚠️ AMPLITUDE 1,75 COM DUAS OSCILAÇÕES, e os dois números são o mínimo que
    // serve, não o gosto: a serpentina existe para alongar o percurso, e cada
    // décimo a mais de amplitude neste eixo empurra a fita de volta para o
    // contraforte de az 264 e reintroduz subida. Medido, não estimado.
    rInicio: 8050, rFim: 6875, azCentro: 262.25, amplitude: 1.75, oscilacoes: 2, amostras: 90,
  },
  {
    nome: 'Super-G Regolito', dificuldade: 'preta', largura: 27,
    // ⚠️ RETUNADO EM 04/09, TERCEIRA VEZ, agora sobre a crista larga. Medido
    // por `medirPista`: 564 m de desnível, dentro de 400-650.
    rInicio: 8150, rFim: 7350, azCentro: 268, amplitude: 2, oscilacoes: 1, amostras: 60,
  },
  {
    nome: 'Slalom Gigante Cratera Rasa', dificuldade: 'vermelha', largura: 22,
    // ⚠️ RETUNADO EM 04/09, mesmo motivo. Medido: 413 m, dentro de 250-450
    // (com os raios antigos dava 493, fora da norma).
    rInicio: 7700, rFim: 7250, azCentro: 268, amplitude: 2, oscilacoes: 1, amostras: 50,
  },
  {
    nome: 'Slalom Poeira Fina', dificuldade: 'azul', largura: 18,
    // ⚠️ RETUNADO EM 04/09. Medido: 204 m, dentro de 180-220.
    rInicio: 7430, rFim: 7200, azCentro: 268, amplitude: 2, oscilacoes: 1, amostras: 40,
  },
  {
    nome: 'Boardercross Baixa Gravidade', dificuldade: 'parque', largura: 30,
    // ⚠️ RETUNADO EM 04/09. Medido: 1.127 m de percurso (alvo 800-1.200),
    // 227 m de desnível (alvo 100-250), 11,4° de grau médio (alvo FIS 7-11°,
    // 0,4° acima). Os três critérios juntos continuam não fechando perfeito, e
    // ficar 0,4° acima do teto de uma RECOMENDAÇÃO, não de uma regra de
    // homologação, continua sendo a troca aceita: era 0,8° antes.
    rInicio: 7500, rFim: 7270, azCentro: 268, amplitude: 2, oscilacoes: 1, amostras: 50,
  },
  {
    nome: 'Slopestyle Um Sexto', dificuldade: 'parque', largura: 24,
    // ⚠️ RETUNADO EM 04/09. Sem norma FIS estrita; 236 m de queda medidos,
    // numa progressão razoável de freestyle.
    rInicio: 7420, rFim: 7180, azCentro: 260, amplitude: 2, oscilacoes: 1, amostras: 40,
  },
  {
    nome: 'Pista Verde de Acesso', dificuldade: 'verde', largura: 20,
    // o anel que o pódio da abóbada já deixa plano: o retorno manso até a
    // vila-base, em cima do nivelamento que já existe. ⚠️ RECUADO 50 m EM
    // 04/09 (7.150-6.850 para 7.100-6.800) porque a crista nova encosta o pé
    // dela em r 7.150: com os raios antigos a "verde" media 13,7 graus (24% de
    // grau, o limite da cor); recuada, mede 9,0 graus (16%), que é verde de
    // verdade.
    rInicio: 7100, rFim: 6800, azCentro: 266, amplitude: 1, oscilacoes: 0.5, amostras: 30,
  },
]

/**
 * ⚠️ AS PISTAS SAIRAM DA CENA EM 05/09/2026, POR DECISAO DO FUNDADOR, e o
 * motivo esta na palavra dele: "as pista de esqui descendo a montanha
 * completamente artificial abaixo da linha da neve, pode tirar".
 *
 * O defeito que ele viu e real e tem causa medida. A reforma da linha de neve
 * (obra 3) levou a neve para o alto: 53,6% dela passou a morar acima de 600 m
 * e so 4,8% abaixo de 400 m, que e como uma montanha de 1.043 m se comporta.
 * As sete fitas, porem, continuaram descendo ate r 6.800, muito abaixo da
 * linha. Uma pista e uma faixa de neve compactada; sem neve embaixo ela vira
 * uma calha de 3,2 m cavada na rocha, sete cicatrizes retas na face de uma
 * montanha que o fundador tinha acabado de aprovar como "muito realista".
 *
 * ⚠️ NAO APAGUEI NADA. A tabela `ESPECIFICACOES`, a serpentina, a homologacao
 * FIS, os teleféricos e a estacao continuam inteiros e testados: o que mudou e
 * que a LISTA sai vazia por padrao. `?pistas=1` devolve tudo como estava.
 * Vazia, ela desliga sozinha os quatro consumidores, porque todos iteram sobre
 * ela: a cava do relevo aqui (`pistaProximidade01` devolve 0 e a subtracao de
 * `PROFUNDIDADE_CORTE` vira zero), a neve de pista de `alpino.ts`, as fitas de
 * `inverno-detalhe.ts` e as cercas de `estacao-inverno.ts`.
 *
 * ⚠️ E `zonaEsquiavelAt` NAO depende desta lista (so do envelope), entao a
 * forma da montanha, a mata e a linha de neve ficam bit a bit como estao.
 * Isto e a retirada das cicatrizes, nao uma mudanca de relevo.
 */
export const PISTAS_ATIVAS =
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('pistas') === '1'

export const PISTAS: Pista[] = PISTAS_ATIVAS
  ? ESPECIFICACOES.map((e) => ({
      nome: e.nome, dificuldade: e.dificuldade, largura: e.largura, pontos: gerarSerpentina(e),
    }))
  : []

/** envelope radial ASSIMÉTRICO: sobe em cosseno do pé até a crista (o
 *  versante esquiável, moderado), cai em `Math.pow(suave01, EXP_FACE_ROCHA)`
 *  da crista até a queda externa (a face de rocha, que fica perto de 1 quase
 *  até o topo e desaba no último trecho). Continua a mesma forma da primeira
 *  correção: isto é só o envelope de EXISTÊNCIA, não a forma fina. */
function envelopeRadial(r: number): number {
  // ⚠️ ABRE EM `R_AVENTAL`, NÃO EM `R_PE`, e isso NÃO engorda os picos: os
  // carimbos de crista têm faixa radial PRÓPRIA (`faixaR`, ver `FeicaoReal`) e
  // são zero por construção antes de r 6.700. Quem existe na faixa nova é o
  // carimbo do avental, que tem raio grande de propósito. Sem abrir aqui, o
  // avental nasceria recortado no pé.
  if (r <= R_AVENTAL || r >= R_QUEDA) return 0
  if (r <= R_CRISTA_PICO) return suave01((r - R_AVENTAL) / (R_CRISTA_PICO - R_AVENTAL))
  const t = suave01((R_QUEDA - r) / (R_QUEDA - R_CRISTA_PICO))
  return Math.pow(t, EXP_FACE_ROCHA)
}

/** janela angular de existência, em platô entre AZ0 e AZ1 com 10° de
 *  transição suave em cada ponta. Substitui os "ombros" da primeira
 *  correção: aquilo desenhava a FORMA do cume (era o próprio defeito, cumes
 *  colocados); isto só diz ONDE o maciço pode existir, e quem desenha a
 *  forma agora são as feições reais (`FEICOES`) mais o tempero fino. */
function envelopeAzimute(az: number): number {
  if (az <= AZ0 - 10 || az >= AZ1 + 10) return 0
  if (az >= AZ0 && az <= AZ1) return 1
  if (az < AZ0) return suave01((az - (AZ0 - 10)) / 10)
  return suave01((AZ1 + 10 - az) / 10)
}

// ═══════════════════════════════════════════════════════════════════════════
// AS FEIÇÕES REAIS: dois scans fotogramétricos (ver a nota "SEGUNDA
// CORREÇÃO" no cabeçalho do arquivo), usados TRÊS vezes com posição, giro e
// raio DIFERENTES cada uma: é isso que evita repetição, não a quantidade de
// arquivos. Amostragem por vizinho bilinear na grade 96×96 assada offline,
// com falloff circular suave (não quadrado) na borda de cada feição, e
// combinadas por MÁXIMO (mesma convenção de `monteEm` em `terrain.ts`): onde
// duas feições se sobrepõem, a mais alta vence e a transição sai suave
// porque as duas já desvanecem para 0 nas próprias bordas.
// ═══════════════════════════════════════════════════════════════════════════
interface DadosRelevo { grid: number; alturas: number[] }
interface FeicaoReal {
  cx: number; cz: number; giro: number; raioM: number; pesoAltura: number; dados: DadosRelevo
  /**
   * onde o desvanece circular COMEÇA, em raio normalizado (0..1). Padrão 0,72,
   * que é o valor de sempre e o que o avental continua usando.
   *
   * ⚠️ ESTE NÚMERO ERA O PRINCIPAL FABRICANTE DE PAREDE, e dá pra ver na conta:
   * com 0,72 o carimbo cai de cheio a zero em 0,28 do raio, ou seja 230 m num
   * `raioM` de 820. O Zwölfernock guarda 0,88 do peso (790 m com peso 900) no
   * anel de distNorm 0,55, então eram 790 m de queda em 230 m: 74 graus, uma
   * parede, e ela aparecia em TODOS os rumos ao mesmo tempo, que é a definição
   * de agulha. Baixar o início do desvanece para 0,38-0,45 espalha a mesma
   * massa por 0,55-0,62 do raio.
   */
  inicioQueda?: number
  /**
   * A FAIXA RADIAL PRÓPRIA DA FEIÇÃO, em metros de raio do centro da cidade:
   * `[r0, r1, r2, r3]` sobe de 0 em r0 a cheio em r1, segura até r2 e volta a
   * zero em r3. Um trapézio, e ele é o perfil radial DA MONTANHA, não uma
   * guarda de segurança.
   *
   * ⚠️ QUEM TEM `faixaR` NÃO PASSA PELO `envelopeRadial` (ver `alturaInvernoAt`):
   * seria contar a mesma queda duas vezes, e a queda do envelope é do avental,
   * calibrada para outra coisa. Esta é a mudança de arquitetura de 04/09 e é o
   * que finalmente permitiu escolher onde o cume mora.
   *
   * ⚠️ A CONTA QUE DECIDIU OS QUATRO NÚMEROS, e ela é dura: a crista só pode
   * existir entre r 6.700 (abaixo disso a adição tem de ficar sob a do avental,
   * senão o tecido da cidade sobe) e r 8.650 (`R_QUEDA`, antes da fratura do
   * rim da casca). São 1.950 m de corrida para ~824 m de relevo. O cume não vai
   * no meio: ele vai onde as PISTAS precisam dele, r ~8.100, porque as sete
   * fitas de `ESPECIFICACOES` descem de r 8.200 para r 6.800 e um cume mais
   * para dentro faria a Super-G e o slalom gigante subirem antes de descer.
   * Com o platô da faixa em 7.950-8.110 sobram 1.250 m de corrida para dentro
   * (6.700 a 7.950) e 540 para fora (8.110 a 8.650),
   * e é por isso que a face externa é a íngreme: ela é a FACE DE ROCHA, que é o
   * que o projeto sempre quis ali, e a encosta esquiável é a de dentro.
   *
   * ⚠️ `r3` É SEMPRE `R_QUEDA`: a feição morre exatamente onde o envelope do
   * avental já morria, então sair do envelope NÃO afrouxou o limite externo
   * que protege o rim da casca. Isso é invariante, não coincidência.
   */
  faixaR?: [number, number, number, number]
  /**
   * ESTE É O DESBASTE DO GUME que a nota antiga deixou pendente, e ele mora no
   * VALOR do dado, não no raio. `h' = média + (h - média) · contraste`, com a
   * média medida no próprio disco do arquivo (ver `mediaDoDisco`). 1 é o dado
   * cru, que é o que o avental continua usando.
   *
   * ⚠️ POR QUE PRECISA EXISTIR, em número medido nos três arquivos assados
   * (perfil por anel de raio normalizado, 20 anéis):
   *
   *              máximo por anel        mínimo por anel      média por anel
   *   zwölfernock  1,00 -> 0,84          0,56 -> 0,55         0,59 -> 0,89
   *   weisse wand  1,00 -> 0,68          0,18 -> 0,33         ~0,53 chapado
   *   fuji         ~0,74 chapado         0,61 -> 0,00         0,67 -> 0,34
   *
   * Ou seja: o Zwölfernock não é um cone, é um PLANALTO de ~0,85 com uma rede
   * de vales cavados até 0,36, e o pico é uma célula solta em 1,00. Esticar
   * esse arquivo de `raioM` 820 para 1.900 estica a PLANTA dos vales por 2,3
   * mas não mexe na altura deles: com peso 950, aquele intervalo de 0,64
   * normalizado vira 608 m de ravina dentro do carimbo, e o pico vira uma
   * agulha de ~280 m sobre o próprio entorno. Não adianta alargar a montanha se
   * a textura da fonte carrega meio quilômetro de relevo por conta própria.
   *
   * Quem passa a desenhar a FORMA é `faixaR` (o trapézio radial) vezes o
   * desvanece circular; o arquivo fica com o papel de textura, com amplitude
   * reduzida. O tempero fino (`temperoFino`, 55 m de ridged multifractal) e o
   * relevo natural por baixo continuam intactos, então isto não vira plástico.
   */
  contraste?: number
  /** liga o passa-baixa de uma célula na amostragem da grade (ver
   *  `amostrarFeicao`). O avental não usa: com `raioM` 6.600 a célula dele já
   *  mede 139 m e não existe pico de célula única para tirar. */
  suavizaCelula?: boolean
  /** média do arquivo dentro do disco, calculada uma vez em `montarFeicoes`
   *  (9.216 células) e NÃO escrita à mão: é o eixo em torno do qual
   *  `contraste` comprime. */
  mediaDisco?: number
}

/** ⚠️ PESO EM METROS, MEDIDO CONTRA O ALVO, NÃO CHUTADO: o terreno natural no
 *  arco da crista mede 260-320 m (Tarefa 1); o alvo de cume é ~1.150 m
 *  (Tarefa 2, e a folga da casca com a borda nova do arco oeste, 353,9 m
 *  medidos pela frente da casca, já foi reconferida pra esse valor). O
 *  Zwölfernock carrega o grosso (900 m no seu próprio pico), os dois usos do
 *  Weisse Wand ficam abaixo dele (640 e 430 m) pra não competir pelo posto
 *  de cume mais alto e ler como dois picos iguais de novo.
 *
 *  ⚠️ MONTA AS 3 FEIÇÕES A PARTIR DOS DOIS JSON JÁ BAIXADOS. Antes era uma
 *  IIFE de módulo (`const FEICOES = (() => {...})()`) porque os dois arquivos
 *  chegavam por `import` estático, prontos no instante em que o módulo
 *  carregava. Agora chegam por `fetch` (ver "FRENTE CARREGAMENTO" no
 *  cabeçalho), então a montagem virou uma função comum, chamada quando os
 *  dois `.json` resolvem, não mais no carregamento do módulo. */
/** média do arquivo DENTRO do disco amostrado (o falloff é circular, então a
 *  moldura fora do círculo não conta). 9.216 células por arquivo, três
 *  arquivos: 27.648 somas, uma vez na vida da página. É o eixo de compressão
 *  de `contraste`, e sai do dado, não de constante escrita à mão. */
function mediaDoDisco(d: DadosRelevo): number {
  const g = d.grid
  let soma = 0, n = 0
  for (let j = 0; j < g; j++) {
    for (let i = 0; i < g; i++) {
      const u = (i / (g - 1)) * 2 - 1, v = (j / (g - 1)) * 2 - 1
      if (u * u + v * v >= 1) continue
      soma += d.alturas[j * g + i]
      n++
    }
  }
  return n > 0 ? soma / n : 0.5
}

function montarFeicoes(weisse: DadosRelevo, zwoelfernock: DadosRelevo,
                       fuji: DadosRelevo): FeicaoReal[] {
  const mW = mediaDoDisco(weisse), mZ = mediaDoDisco(zwoelfernock), mF = mediaDoDisco(fuji)
  // os três cumes da cordilheira e as quatro feições que os ligam. O raio
  // desceu de 8.280/7.950/8.100 para a faixa 7.860-7.960 (ver a nota do
  // orçamento radial logo abaixo) e a abertura em azimute subiu de 34 para 40
  // graus, para os secundários ficarem a 12 graus do principal em vez de 16-18.
  const [x1, z1] = pontoEmRumo(8070, 266) // cume principal, Zwölfernock
  const [x2, z2] = pontoEmRumo(8090, 254) // secundário norte, Weisse Wand A
  const [x3, z3] = pontoEmRumo(8040, 278) // secundário sul, Weisse Wand B
  const [s1x, s1z] = pontoEmRumo(8060, 260) // sela entre o principal e o norte
  const [s2x, s2z] = pontoEmRumo(8050, 272) // sela entre o principal e o sul
  const [c1x, c1z] = pontoEmRumo(8080, 246) // contraforte de ponta, norte
  const [c2x, c2z] = pontoEmRumo(8020, 286) // contraforte de ponta, sul
  // ⚠️ O AVENTAL É CARIMBO GRANDE E BAIXO, centrado no MESMO cume: `Math.max`
  // em `alturaInvernoAt` faz o pico real vencer no alto (900 m contra os 560 do
  // avental ali) e o avental vencer sozinho no pé, onde o pico já não alcança.
  // Não há mistura a calibrar: a soma é um máximo, e cada um manda onde é maior.
  //
  // ⚠️ OS DOIS NÚMEROS SÃO PRIMEIRA ESTIMATIVA E TÊM DE SER MEDIDOS. `raioM`
  // 4.600 põe o pé do avental em r 5.500 (o falloff começa em 0,72 do raio, ou
  // seja 3.312 m do centro) e `pesoAltura` 560 sai da conta do perfil assado
  // (queda de 0,89 para 0,18 ao longo do raio, ver `assar_relevo_dem.py`): dá
  // ~13% de grau médio na faixa habitável. Estimativa não é medição — a regra
  // desta casa é conferir na superfície como construída (`topo.mjs` mais o
  // histograma de declive) e ajustar os dois escalares contra o número, não
  // contra o desenho.
  const [xa, za] = pontoEmRumo(8280, 266)
  return [
    // ⚠️ 6.600 / 420 SÃO MEDIDOS, e a primeira estimativa (4.600 / 560, sobre o
    // DEM inteiro) foi REPROVADA pela medição: ela piorava o maciço. Com o Fuji
    // inteiro o carimbo trazia junto o cone dele (0-4 km do cume, 37-41% de
    // grau) e só a ponta da cauda chegava perto da cidade — terra plana caía de
    // 638,9 para 355,7 ha e penhasco subia de 360,0 para 469,8. O conserto foi
    // no ASSADO, não aqui: `--anel=0.42,1.0` recorta só a cauda e a rezera.
    //
    // Os dois números saem de varredura offline (o modelo replica
    // `alturaInvernoAt` e soma o candidato à base recuperada de 42.926 amostras
    // da superfície como construída, ver o script da frente). Contra o maciço de
    // hoje, na cunha az 240-298 entre r 5.300 e 8.900:
    //
    //                        hoje    com o avental
    //   8-15% (habitável)    17,5%      22,5%
    //   >60% (penhasco)      13,9%      14,6%
    //   terra de mansão       802 ha    1.137 ha   (+42%)
    //   cume                1.112 m     1.113 m    (intacto, que era a ordem)
    //
    // A queda do <8% (24,7% para 13,0%) NÃO é regressão: aquele "plano" era o
    // pódio a 13 m no pé da cunha, chão liso sem vista nem cota. Ele virou
    // encosta habitável, que é o pedido.
    { cx: xa, cz: za, giro: 0.0, raioM: 6600, pesoAltura: 420, dados: fuji },
    // ── A CRISTA, REDESENHADA EM 04/09 ─────────────────────────────────────
    // ⚠️ O DESBASTE DO GUME TINHA FICADO DE FORA POR CAUSA DA CASCA, e a casca
    // funda (flecha 5.500) virou o padrão: a trava caiu. O que a nota antiga
    // temia (alargar o carimbo LEVANTA o cume) não acontece, e isso é
    // aritmética do amostrador, não opinião: `amostrarFeicao` normaliza a
    // grade 96x96 por `raioM`, então mexer no raio muda só a PLANTA; a cota do
    // pico é `h_max · pesoAltura · envelope`, e `h_max` é 1,0 nos três dados.
    // Alargar espalha, não sobe.
    //
    // ⚠️ E O QUE ESTAVA ERRADO ERA A PLANTA, medido na cena viva pelo laudo da
    // rodada: talude médio de 53,9 a 61,1 graus nos primeiros 400 m do cume, em
    // 32 rumos. Montanha de rocha real fica em 25 a 35. Três coisas faziam a
    // agulha, e as três estão consertadas aqui:
    //   1. `raioM` de 520 a 820 m para 860 m de relevo (razão altura/raio > 1);
    //   2. `inicioQueda` de 0,72, que despejava 790 m em 230 m de desvanece;
    //   3. os três cumes a 16-18 graus de azimute um do outro e NADA entre
    //      eles além do envelope liso, ou seja três agulhas, nunca uma
    //      cordilheira.
    //
    // ⚠️ O ORÇAMENTO RADIAL É DURO E NÃO TEM SAÍDA, e é honesto deixá-lo
    // escrito: a montanha só pode existir entre r 6.700 (onde o pódio nivela o
    // anel da vila-base e da pista verde) e r 8.650 (`R_QUEDA`, antes da
    // fratura do rim da casca, ver o cabeçalho). São 1.950 m para 850 m de
    // relevo: um cone simétrico dentro dessa faixa mede 41 graus de talude
    // radial no melhor caso. Por isso a montanha nova NÃO é um cone: é uma
    // CRISTA deitada no azimute, onde o espaço não acaba (a janela de 248 a
    // 288 graus dá 5,6 km de arco em r 8.000). O talude gentil mora ao longo
    // da crista; o radial fica íngreme, que é o que uma cordilheira de região
    // de lagos faz mesmo.
    //
    // ⚠️ CENTRO PUXADO PARA DENTRO (8.280 -> 8.070): é a única direção com
    // espaço. Com o centro em 8.280 sobravam 370 m até `R_QUEDA`, e um cume ali
    // obriga a face externa a despejar 824 m nesses 370 m, 66 graus. Com o
    // centro em 8.070 e o platô da faixa terminando em 8.110, a face externa
    // ganha 540 m de corrida, e o cume MEDIDO acabou em r 8.016 (a massa do
    // arquivo puxa um pouco mais para dentro que o centro do carimbo), o que dá
    // 634 m reais de corrida externa.
    //
    // ⚠️ E A HIERARQUIA DA CADEIA NÃO SE LÊ EM `pesoAltura`, porque cada feição
    // tem `contraste` e `mediaDisco` diferentes. A cota de pico EFETIVA de cada
    // uma é `pesoAltura · (mediaDisco + (máximo - mediaDisco) · contraste)`,
    // e é ela que decide quem é cume e quem é colo:
    //
    //   Zwölfernock  (266)   950 × 0,820 = 779 m   cume principal
    //   Weisse A     (254)   930 × 0,644 = 599 m   secundário norte
    //   Weisse B     (278)   850 × 0,644 = 548 m   secundário sul
    //   Fuji sela    (260)   900 × 0,534 = 481 m   colo norte
    //   Fuji sela    (272)   870 × 0,534 = 465 m   colo sul
    //   Weisse contraf. (246) 700 × 0,644 = 451 m  ombro de ponta norte
    //   Weisse contraf. (286) 660 × 0,644 = 425 m  ombro de ponta sul
    { cx: x1, cz: z1, giro: 0.35, raioM: 1900, pesoAltura: 950, inicioQueda: 0.34, faixaR: [6700, 7950, 8110, 8650], suavizaCelula: true, contraste: 0.20, mediaDisco: mZ, dados: zwoelfernock },
    { cx: x2, cz: z2, giro: 1.10, raioM: 1550, pesoAltura: 930, inicioQueda: 0.40, faixaR: [6700, 7950, 8110, 8650], suavizaCelula: true, contraste: 0.25, mediaDisco: mW, dados: weisse },
    // ⚠️ MESMO ARQUIVO QUE A FEIÇÃO ANTERIOR, GIRO E RAIO DIFERENTES: é a
    // técnica de "carimbo" reaproveitado com transform distinto (mesma ideia
    // das 9 sequoias resolvendo a floresta hoje). O que causaria repetição
    // seria repetir posição E escala juntas, não repetir a fonte de dado.
    { cx: x3, cz: z3, giro: 4.20, raioM: 1450, pesoAltura: 850, inicioQueda: 0.40, faixaR: [6700, 7950, 8110, 8650], suavizaCelula: true, contraste: 0.25, mediaDisco: mW, dados: weisse },
    // ── AS SELAS E OS CONTRAFORTES: o que faz virar cordilheira ────────────
    // Um cume principal (266), dois secundários (254 e 278) e as cristas que os
    // ligam. Sem estas quatro feições, entre um cume e outro só existia o
    // envelope liso, e três picos soltos num avental leem como três agulhas.
    //
    // ⚠️ AS SELAS USAM O DADO DO FUJI, DE PROPÓSITO, e a escolha vem do perfil
    // medido de cada arquivo (média por anel de raio normalizado, 12 anéis):
    //   fuji           0,63 no centro caindo monotônico a 0,34 na borda -> domo
    //   zwölfernock    0,59 no centro, 0,88 num ANEL em 0,55, 0,65 na borda
    //   weisse wand    ~0,52 chapado em toda a área, com um espinho de 1,0
    // Uma sela é uma passagem, não um pico: precisa de uma forma que suba manso
    // e não tenha anel nem espinho. O Fuji é o único dos três com esse perfil.
    // Os contrafortes de ponta usam o Weisse porque ali a chapa QUER pedra
    // quebrada, e o patamar de 0,52 dele é justamente um ombro.
    //
    // ⚠️ COTA EFETIVA ABAIXO DOS CUMES, DE PROPÓSITO (481 e 465 m contra os
    // 779 do principal, ver a tabela acima). Com `Math.max`, uma sela só
    // aparece onde os cumes já não alcançam, então a cota dela é literalmente
    // a cota do colo. Medido na crista final, cota máxima por rumo de 2 em 2
    // graus: 1.023 m em 262, 993 em 270, 965 em 266, contra 736 em 258 e 724
    // em 278. Colo de 250 a 300 m abaixo do cume é o que separa cordilheira de
    // serra dentada, e é onde a Fase 2 vai procurar a bacia da lagoa.
    { cx: s1x, cz: s1z, giro: 2.60, raioM: 1300, pesoAltura: 900, inicioQueda: 0.44, faixaR: [6700, 7950, 8110, 8650], suavizaCelula: true, contraste: 0.34, mediaDisco: mF, dados: fuji },
    { cx: s2x, cz: s2z, giro: 5.10, raioM: 1300, pesoAltura: 870, inicioQueda: 0.44, faixaR: [6700, 7950, 8110, 8650], suavizaCelula: true, contraste: 0.34, mediaDisco: mF, dados: fuji },
    { cx: c1x, cz: c1z, giro: 3.30, raioM: 1350, pesoAltura: 700, inicioQueda: 0.42, faixaR: [6700, 7950, 8110, 8650], suavizaCelula: true, contraste: 0.25, mediaDisco: mW, dados: weisse },
    { cx: c2x, cz: c2z, giro: 0.80, raioM: 1300, pesoAltura: 660, inicioQueda: 0.42, faixaR: [6700, 7950, 8110, 8650], suavizaCelula: true, contraste: 0.25, mediaDisco: mW, dados: weisse },
  ]
}

/** Vazio até o fetch resolver: `alturaInvernoAt` trata "vazio" como "sem
 *  dado" e devolve 0, o mesmo neutro de bandeira desligada (ver a guarda
 *  explícita nela, não um efeito colateral de "loop vazio soma 0"). */
let FEICOES: FeicaoReal[] = []

let relevoPromessa: Promise<void> | null = null

/**
 * Dispara (uma vez; chamadas repetidas devolvem a MESMA promessa) o fetch
 * dos dois relevos assados e, quando os dois chegarem, monta `FEICOES`. Sem
 * `?inverno=1` isto nunca é chamado (ver o gatilho logo abaixo), então
 * nenhum visitante sem a bandeira paga um fetch sequer.
 *
 * ⚠️ FALHA AQUI NÃO DERRUBA NADA: se a rede cair, `FEICOES` continua vazia
 * pra sempre e `alturaInvernoAt` continua devolvendo 0 pra sempre — o mesmo
 * comportamento de bandeira desligada, só que com a bandeira ligada. O
 * maciço nasce só com o envelope + tempero (que já existiam antes desta
 * frente), sem os dois picos reais. Avisado no console, nunca silencioso.
 */
function carregarRelevo(): Promise<void> {
  if (relevoPromessa) return relevoPromessa
  relevoPromessa = (async () => {
    try {
      const [weisse, zwoelfernock, fuji] = await Promise.all([
        fetch('/city/inverno/relevo-weisse-wand.json').then((r) => r.json() as Promise<DadosRelevo>),
        fetch('/city/inverno/relevo-zwoelfernock.json').then((r) => r.json() as Promise<DadosRelevo>),
        fetch('/city/inverno/relevo-fuji-avental.json').then((r) => r.json() as Promise<DadosRelevo>),
      ])
      FEICOES = montarFeicoes(weisse, zwoelfernock, fuji)
    } catch (err) {
      console.error('[inverno] os relevos reais (weisse-wand/zwoelfernock/fuji-avental) NÃO CARREGARAM. O maciço fica só com envelope + tempero, sem os dois picos reais, até recarregar a página.', err)
    }
  })()
  return relevoPromessa
}

// ⚠️ O GATILHO MORA AQUI, NÃO NUM CALLER EXTERNO: `INVERNO_ATIVO` já é
// conhecido no instante em que este módulo é avaliado (lê a URL, síncrono),
// então disparar o fetch aqui mesmo, no import, dá a ele a MAIOR vantagem de
// tempo possível sobre a montagem da malha do terreno em `terrain.ts`. Isto
// NÃO conflita com "a rede do PARQUE só começa depois do portão abrir" (ver
// "QUANDO COMEÇAR A REDE"): são dois fetches diferentes, com dois motivos
// diferentes. Este aqui é para `terrain.ts`/`alpino.ts` (o relevo somado à
// malha, que só pode ser corrigido ANTES da malha nascer, ver
// `aguardaRelevoInverno` logo abaixo); o outro é para o parque em si
// (pistas, floresta, rochas, estação), que não tem essa pressa e pode
// esperar a fila de rede do boot esvaziar.
if (INVERNO_ATIVO) void carregarRelevo()

/**
 * ⚠️ ACHADO DA FRENTE DE NEVE, 03/09: testando o cenário em que o fetch do
 * relevo perde a corrida contra o heightmap do terreno, o maciço nascia no
 * PERFIL ANTIGO (~322 m em vez de ~1.098 m) e FICAVA ASSIM PARA SEMPRE
 * naquela carga de página, porque a malha de `terrain.ts` é síncrona,
 * construída uma vez, nunca reconstruída. "Disparar cedo" (o gatilho acima)
 * reduz a chance de perder a corrida, mas não a elimina — e não dá pra
 * torcer pra ganhar corrida onde a malha errada fica congelada pra sempre.
 *
 * A CORREÇÃO: exportar um jeito de ESPERAR o relevo, pra quem monta a malha
 * chamar ANTES de montá-la, exatamente o caminho (a) que a Obra já favorece
 * aqui (rede primeiro, construção fatiada depois, mesmo formato de
 * `parkComoTrabalho`). `aguardaRelevoInverno()` resolve na hora, sem fetch
 * nenhum, se `?inverno=1` estiver desligado (então não custa nada pra quase
 * todo visitante); com a bandeira ligada, resolve só quando `FEICOES` está
 * pronta (ou quando a rede falhar de vez — nesse caso resolve com o
 * envelope neutro mesmo, avisado no console por `carregarRelevo`, nunca
 * trava pra sempre).
 *
 * QUEM PRECISA CHAMAR ISTO, E ONDE: `plaza-scene.tsx`, dentro de `boot()`,
 * ANTES de `const terrain = await loadTerrain(...)` (a chamada que monta a
 * malha do maciço). Uma linha: `await aguardaRelevoInverno()` logo antes
 * daquele `await`. Isto NÃO é o mesmo fetch do parque em si (pistas,
 * floresta, rochas, estação): aquele pode esperar o portão abrir (ver
 * "QUANDO COMEÇAR A REDE"), porque o parque não precisa do relevo pra nada
 * (usa o `heightAt` que já vem pronto de fora). Este aqui é sobre a FORMA da
 * montanha dentro da malha do terreno, que só pode ser corrigida uma vez, e
 * por isso precisa da garantia, não da torcida.
 */
export function aguardaRelevoInverno(): Promise<void> {
  return INVERNO_ATIVO ? carregarRelevo() : Promise.resolve()
}

function amostrarFeicao(f: FeicaoReal, x: number, z: number): number {
  const dx = x - f.cx, dz = z - f.cz
  const c = Math.cos(-f.giro), s = Math.sin(-f.giro)
  const lx = dx * c - dz * s
  const lz = dx * s + dz * c
  const distNorm = Math.hypot(lx, lz) / f.raioM
  if (distNorm >= 1) return 0
  const g = f.dados.grid
  const A = f.dados.alturas
  const H = (ii: number, jj: number) => A[jj * g + ii]
  /** uma amostra bilinear da grade, em coordenada LOCAL da feição (metros) */
  const amostra = (ax: number, az: number): number => {
    const u = (ax / f.raioM) * 0.5 + 0.5
    const v = (az / f.raioM) * 0.5 + 0.5
    const fx = Math.min(g - 1.001, Math.max(0, u * (g - 1)))
    const fz = Math.min(g - 1.001, Math.max(0, v * (g - 1)))
    const i = Math.floor(fx), j = Math.floor(fz)
    const tx = fx - i, tz = fz - j
    return (H(i, j) * (1 - tx) + H(i + 1, j) * tx) * (1 - tz) + (H(i, j + 1) * (1 - tx) + H(i + 1, j + 1) * tx) * tz
  }
  // ⚠️ O PASSA-BAIXA DE UMA CÉLULA, E ELE É A AGULHA DO CUME EM PESSOA. Medido
  // com o cume novo em pé: a adição caía de 831,4 m para 679,2 m em 50 m de
  // distância, média de 32 rumos. São 152 m em meia célula, e a célula é o
  // motivo: com `raioM` 1.500 a grade 96x96 tem 31,6 m por célula, e a célula
  // do máximo do Zwölfernock vale 1,00 num vizinhança que vale ~0,57 (medido
  // por anel: no anel central o máximo é 1,00 e a média é 0,59). Uma célula
  // solta virava uma torre de 150 m. A cruz de 5 amostras a ±1 célula é um
  // passa-baixa exatamente na escala do artefato: derruba um pico de célula
  // única para 20% dele e não toca em nada com 3 células ou mais de largura,
  // que é toda a forma que interessa. Custo: 5 bilineares por feição de crista
  // em vez de 1, e só dentro da cunha (o `envelopeAzimute` já corta antes).
  let h = f.suavizaCelula
    ? (() => {
      const p = (2 * f.raioM) / (g - 1)
      return (amostra(lx, lz) + amostra(lx + p, lz) + amostra(lx - p, lz) + amostra(lx, lz + p) + amostra(lx, lz - p)) / 5
    })()
    : amostra(lx, lz)
  // o desbaste do gume, ver `contraste`. Sem o campo não roda nada: o avental
  // continua com o dado cru, bit a bit.
  if (f.contraste !== undefined && f.mediaDisco !== undefined) {
    h = f.mediaDisco + (h - f.mediaDisco) * f.contraste
  }
  // ⚠️ FALLOFF CIRCULAR, NÃO QUADRADO: a grade é quadrada (u,v em [0,1]²),
  // mas cortar no quadrado desenharia uma aresta reta na chapa. O raio
  // normalizado (`distNorm`) já é a distância euclidiana, então o desvanece
  // é um círculo de verdade em torno de `(cx, cz)`.
  const q = f.inicioQueda ?? 0.72
  let falloff = 1 - suave01((distNorm - q) / (1 - q))
  // o trapézio radial da crista: ver `faixaR`. Nem entra quando a feição não
  // tem faixa própria (o avental), que continua no envelope compartilhado.
  if (f.faixaR) {
    const [r0, r1, r2, r3] = f.faixaR
    const rMundo = Math.hypot(x, z)
    if (rMundo <= r0 || rMundo >= r3) return 0
    // encosta interna (a esquiável): rampa de trecho reto, ver `rampaReta`.
    // encosta externa (a face de rocha): a mesma rampa com expoente < 1, que é
    // o que segura cota no meio da face com só 540 m de corrida até `R_QUEDA`.
    if (rMundo < r1) falloff *= rampaReta((rMundo - r0) / (r1 - r0), 0.20)
    else if (rMundo > r2) falloff *= Math.pow(rampaReta((r3 - rMundo) / (r3 - r2), 0.20), EXP_FACE_CRISTA)
  }
  return h * f.pesoAltura * falloff
}

// ═══════════════════════════════════════════════════════════════════════════
// O TEMPERO FINO: ridged multifractal (Musgrave/libnoise) com deformação de
// domínio, pesquisados antes de escrever (fonte: libnoise RidgedMulti e
// Inigo Quilez, "Domain Warping"). Isto NÃO desenha a montanha (isso é
// `FEICOES` acima); preenche a escala que a grade 96×96 não resolve, com
// amplitude pequena de propósito.
// ═══════════════════════════════════════════════════════════════════════════

/** deformação de domínio: desloca (x, z) por outro ruído de célula GRANDE
 *  (1.100 m, bem maior que a escala do tempero, 260 m) antes de amostrar
 *  qualquer coisa. É o que Quilez descreve: o campo de deformação varia mais
 *  devagar no espaço que o detalhe que ele desloca, senão vira tremedeira em
 *  vez de dobra suave. Isto quebra o alinhamento radial que o envelope ainda
 *  tem, sem isto mesmo com dado real o eco do raio poderia aparecer. */
function deformarDominio(x: number, z: number): [number, number] {
  const forca = 200
  const wx = (ruido(x, z, 1100, 811) * 2 - 1) * forca
  const wz = (ruido(x, z, 1100, 812) * 2 - 1) * forca
  return [x + wx, z + wz]
}

/** uma oitava em crista: `signal = (1 - |ruído|)²`. O valor absoluto dobra
 *  os lóbulos negativos pra cima, criando um VINCO exatamente onde o ruído
 *  cru cruza zero, e vinco é o que uma crista É. Elevar ao quadrado afia o
 *  vinco e achata o vale, que é a assinatura de "cume fino, vale largo" que
 *  o fundador pediu. */
function ridgedOitava(x: number, z: number, celula: number, semente: number): number {
  const n = ruido(x, z, celula, semente) * 2 - 1
  const sinal = 1 - Math.abs(n)
  return sinal * sinal
}

/** a parte MULTIFRACTAL, que é o que distingue isto de fBm comum: o peso de
 *  cada oitava não é uma persistência fixa, é REALIMENTADO pelo `signal` da
 *  oitava ANTERIOR (`peso = clamp(signal · ganho, 0, 1)`, fórmula exata do
 *  `RidgedMulti` do libnoise). Onde a oitava anterior já saiu alta (perto de
 *  uma crista), a próxima ganha até 2× de peso e fica mais áspera; onde saiu
 *  baixa (um vale), a próxima fica quase lisa. É por isso que o alto de uma
 *  montanha de verdade é mais rugoso que o baixo, em qualquer escala. */
function ridgedMultifractal(x: number, z: number, celulaBase: number, semente: number, oitavas: number): number {
  let soma = 0, somaAmp = 0, amp = 1, peso = 1, celula = celulaBase
  const lacunaridade = 2.0, ganho = 2.0
  for (let o = 0; o < oitavas; o++) {
    const sinal = ridgedOitava(x, z, celula, semente + o * 7) * peso
    peso = Math.min(1, Math.max(0, sinal * ganho))
    soma += sinal * amp
    somaAmp += amp
    celula /= lacunaridade
    amp *= 0.5
  }
  return somaAmp > 0 ? soma / somaAmp : 0 // ~0..1
}

/** amplitude do tempero, em metros: pequena contra as feições reais
 *  (430-900 m no pico), grande o bastante pra ler como rocha fraturada nas
 *  chapas de perto (`invernope`). `pesoPista` (0..1, ver `pistaProximidade01`)
 *  desliga o tempero perto da fita ANTES do corte entrar: senão a cava de
 *  profundidade constante deixaria os solavancos do ruído por baixo dela e a
 *  pista viraria montanha-russa, exatamente o defeito que foi apontado. */
const AMPLITUDE_TEMPERO = 55
/**
 * ⚠️ A AMPLITUDE CRESCE NA CRISTA, 04/09, E É A COMPENSAÇÃO DO `contraste`.
 * O desbaste do gume (ver `FeicaoReal.contraste`) tira relevo do arquivo assado
 * na escala de 500 a 1.000 m, que é a escala que fabricava parede; sem devolver
 * nada, a montanha vira duna, e "duna sem aresta" já foi motivo de reprovação
 * de chapa nesta mesma região. O tempero devolve aspereza na escala de 260 m,
 * que é curta o bastante para NÃO entrar na conta de talude médio de 500 m (o
 * ruído é centrado, sobe e desce, e a média de 32 rumos cancela), e é
 * exatamente a escala de rocha quebrada que a chapa de perto pede.
 *
 * ⚠️ E CRESCE SÓ ACIMA DE r 7.000, o que não é detalhe estético: com 85 m em
 * toda a área, a adição máxima em r < 6.900 subia de 146,3 para 155,4 m
 * (medido), e crescer dentro do tecido da cidade é proibido nesta rodada.
 * Abaixo de 7.000 a amplitude é 55 m, o MESMO número de sempre, bit a bit.
 */
const AMPLITUDE_TEMPERO_CRISTA = 85
const R_TEMPERO_0 = 7000
const R_TEMPERO_1 = 7800
function temperoFino(x: number, z: number, env: number, pesoPista: number): number {
  if (env <= 0 || pesoPista >= 1) return 0
  const [wx, wz] = deformarDominio(x, z)
  const rm = ridgedMultifractal(wx, wz, 260, 901, 4) // 0..1
  const centralizado = (rm - 0.5) * 2 // -1..1 aprox: sobe E desce, não só cava
  const k = suave01((Math.hypot(x, z) - R_TEMPERO_0) / (R_TEMPERO_1 - R_TEMPERO_0))
  const amplitude = AMPLITUDE_TEMPERO + (AMPLITUDE_TEMPERO_CRISTA - AMPLITUDE_TEMPERO) * k
  return centralizado * amplitude * env * (1 - pesoPista)
}

/**
 * ⚠️ A PISTA É CAVADA, NÃO PINTADA. Uma fita de cor sobre a superfície lisa
 * lê como estrada. Pista de esqui de verdade é um corte na mata e no
 * relevo: uma calha rasa com talude nas duas bordas. `pistaProximidade01`
 * mede a distância ao segmento mais próximo de CADA pista (as mesmas
 * `PISTAS` que a fita desenha por cima) e devolve 1 no eixo, decaindo em
 * cosseno até 0 na borda do talude, o MESMO peso serve pra desligar
 * `temperoFino` (acima) e pra escalar a profundidade do corte (abaixo), os
 * dois lidos de uma distância só, não duas.
 *
 * ⚠️ CUSTO: soma de segmentos de TODAS as pistas, por chamada. ~360 pontos
 * ao todo (7 pistas, 30 a 90 amostras cada); cada `alturaInvernoAt` já
 * descarta cedo por envelope antes de chegar aqui, então isto só roda
 * dentro da zona do parque. NÃO MEDI o custo total de construção da malha
 * com isto ligado; se a chapa acusar, o corte é trocar a busca linear por
 * uma grade de baldes (bucket) pelas mesmas `PISTAS`.
 */
const PROFUNDIDADE_CORTE = 3.2
const TALUDE_CORTE = 8
const PISTAS_MUNDO = PISTAS.map((p) => ({
  meiaLargura: p.largura / 2,
  pontos: p.pontos.map((pt) => {
    const [x, z] = pontoEmRumo(pt.r, pt.az)
    return { x, z }
  }),
}))

function pistaProximidade01(x: number, z: number): number {
  let melhorDist = Infinity
  let melhorMeiaLarg = 0
  for (const pista of PISTAS_MUNDO) {
    const pts = pista.pontos
    for (let i = 0; i < pts.length - 1; i++) {
      const ax = pts[i].x, az_ = pts[i].z, bx = pts[i + 1].x, bz = pts[i + 1].z
      const dx = bx - ax, dz = bz - az_
      const lenSq = dx * dx + dz * dz || 1
      let t = ((x - ax) * dx + (z - az_) * dz) / lenSq
      t = t < 0 ? 0 : t > 1 ? 1 : t
      const px = ax + dx * t, pz = az_ + dz * t
      const d = Math.hypot(x - px, z - pz)
      if (d < melhorDist) { melhorDist = d; melhorMeiaLarg = pista.meiaLargura }
    }
  }
  const alcance = melhorMeiaLarg + TALUDE_CORTE
  if (melhorDist >= alcance) return 0
  if (melhorDist <= melhorMeiaLarg) return 1
  const t = (melhorDist - melhorMeiaLarg) / TALUDE_CORTE
  return suave01(1 - t)
}

// ═══════════════════════════════════════════════════════════════════════════
// OS LAGOS ALPINOS: as BACIAS, que são a parte de relevo. A água em si é da
// frente seguinte, que lê a tabela `LAGOS` daqui (e os três exports antigos,
// enquanto ela não migrar) em vez de adivinhar. Pedido do fundador na rodada da
// montanha: "a cadeia de montanhas que são características de lagos... gostaria
// de floresta e lagoa naquela região", e reforçado em 05/09 depois de ver o
// pico em produção: "outra coisa são os LAGOS da região das montanhas".
//
// ⚠️ ERA UMA BACIA SÓ ATÉ 05/09, E O PLURAL SEMPRE FOI O PEDIDO. Região de lagos
// não tem um espelho d'água, tem uma FAMÍLIA: corpos de tamanhos diferentes, em
// cotas diferentes, encaixados nas selas e nos degraus entre os cumes. A bacia
// única virou a TABELA `BACIAS` abaixo, com cinco corpos, e `LAGOA_CENTRO`,
// `LAGOA_RAIO` e `LAGOA_COTA` passaram a ser apelidos do PRIMEIRO deles, que é
// o que já existia, bit a bit. Nada do que a frente da água mediu se move.
//
// ── COMO OS CINCO SÍTIOS FORAM ESCOLHIDOS (varredura offline, `heightAt` REAL
//    de `terrain.ts`, contra o relevo e as SETE PISTAS de hoje) ──────────────
// A varredura testou 6 classes de tamanho (raio de projeto 60 a 210 m) em cada
// ponto de uma grade polar de r 7.100 a 8.450, de 25 em 25 m, e az 249 a 287, de
// meio em meio grau. Cinco filtros duros, todos medidos:
//
//   1. a PEGADA inteira (não o centro) a ≥ 280 m do eixo das sete pistas e dos
//      dois vãos de teleférico;
//   2. a pegada inteira dentro do envelope do maciço e da janela angular;
//   3. cota da lâmina entre 200 e 700 m;
//   4. aterro máximo ≤ 62 m, ou seja MENOS terra movida que a lagoa que já
//      existe (74,8 m na mesma régua);
//   5. resíduo p99 do ajuste da base ≤ lábio − 3 m, que é a trava contra
//      vazamento: se o resíduo passar do lábio, a lâmina fura o próprio anel.
//
// E um sexto filtro, este entre os corpos: o ALCANCE de qualquer bacia não pode
// entrar na zona de substituição plena de outra (`raio + orla + fade` de uma
// contra `raio + orla` da outra, mais 20 m). Sem isso duas bacias se pisariam e
// a lâmina de uma seria reescrita pela orla da outra. A pior folga da família é
// de 30 m, medida par a par.
//
// A cota de cada corpo NÃO foi escolhida: é a mediana ponderada de
// `superfície − perfil da cuba` na pegada, ou seja o nível que minimiza a terra
// movida. O que se lê abaixo é o resultado dessa conta, arredondado ao metro.
//
//   corpo              r     az   cota   raio  prof  ha    terra movida (média)
//   Saddle Lake     8.000  285,0   407    130    20   5,31        37,9 m
//   Twin Lake       7.875  280,0   388    130    20   5,31        33,0 m
//   North Tarn      8.125  251,0   683    110    14   3,80        25,4 m
//   Step Tarn       8.400  282,0   381     85    10   2,27        12,6 m
//   Lower Pool      7.500  283,0   256     60     7   1,13        12,7 m
//
// ⚠️ TRÊS DELES SÃO UM DEGRAU SÓ, e é isso que faz região de lagos parecer
// região de lagos em vez de poça isolada: Saddle Lake (407 m), Twin Lake (388) e
// Step Tarn (381) ficam dentro de um triângulo de 587 a 704 m de lado, com 26 m
// de cota entre o mais alto e o mais baixo. North Tarn é o extremo oposto: 683 m
// de cota, na ponta NORTE da cadeia, 4,7 km dali. Lower Pool fecha a escada por
// baixo, a 256 m.
//
// ── E O QUE SAIU DA TERRA, MEDIDO NA BACIA CONSTRUÍDA ──────────────────────
// Não é o projeto: é `heightAt` real com `?lagoa=1`, varrido em 180 rumos com
// passo de 0,5 m para a linha d'água e 360 rumos no anel do lábio.
//
//   corpo         cota  raio inscrito  lâmina   prof máx  prof média  lábio mín
//   Saddle Lake    407      121,0 m    5,36 ha   21,16 m    15,08 m     +4,05 m
//   Twin Lake      388      118,5 m    5,46 ha   22,65 m    15,44 m     +3,86 m
//   North Tarn     683       99,0 m    3,92 ha   15,64 m    11,09 m     +4,27 m
//   Step Tarn      381       79,5 m    2,27 ha   10,76 m     7,47 m     +5,64 m
//   Lower Pool     256       57,0 m    1,17 ha    7,10 m     5,04 m     +5,76 m
//
// 18,18 ha de água em cinco corpos, contra 5,41 ha em um. O lábio fica ACIMA da
// lâmina em TODOS os 360 rumos de todos os cinco: nenhum vaza. E a lâmina é
// irregular de propósito (a margem de Saddle Lake vai de 121 a 145 m conforme o
// rumo, a de Twin Lake de 119 a 151): a faixa entre o raio inscrito e a margem
// real é praia de leito exposto, que é o que margem de lago é mesmo.
//
// ⚠️ E A SAIA DE NENHUM DELES É MAIS ÍNGREME QUE A MONTANHA QUE ELA SUBSTITUI,
// que é o teste de "isto lê como obra?". Talude médio do anel de desvanece, 180
// rumos, passo de 4 m, terreno natural contra terreno com a bacia:
// 31,8 → 21,5 / 33,3 → 24,7 / 36,3 → 29,1 / 31,3 → 30,1 / 33,9 → 30,8 graus. Os
// cinco AMANSAM a encosta; e o talude máximo não sobe (78,6 → 73,4 no maior),
// porque o pico dele é o tempero fino, não a saia.
//
// ⚠️ O PRIMEIRO CORPO FOI RECONFERIDO E NÃO SE MOVEU: 5,36 ha medidos aqui
// contra os 5,41 que a frente da água publicou em 04/09 (régua de amostragem
// diferente, mesma água), lâmina em 407, lábio +4,05 contra +4,1. O
// `raioInscrito` dele fica em 120 e não nos 121,0 medidos, de propósito: é o
// número que `lagoa.ts` já usa, e arredondar para baixo nunca faz um disco
// flutuar.
//
// ⚠️ NÃO EXISTE CORPO MAIOR QUE 5,4 ha, E ISSO FOI MEDIDO, NÃO ASSUMIDO. As
// classes de 9,08 e 13,85 ha foram varridas junto com as outras. A de 13,85
// não devolveu um sítio sequer; a de 9,08 só devolveu sítios em r 7.275 a 7.300
// / az 251 a 253, e todos movem de 56,5 a 66,5 m de terra em média, contra os
// 37,9 da lagoa que já existe. Um terraço desses lê como obra, não como lago:
// a montanha simplesmente não tem uma cova grande e rasa para oferecer.
//
// ⚠️ POR QUE CADA BACIA PRECISA DE UM AJUSTE DA BASE NATURAL, e isto é o miolo
// do problema: `alturaInvernoAt` devolve a ADIÇÃO, não a cota. Água parada é
// NIVELADA, ou seja precisa de cota absoluta, e a cota absoluta é
// `base natural + adição`. Este módulo não pode ler a base (seria importar
// `terrain.ts`, que já importa este arquivo). A saída é medir a base offline e
// carregar aqui a superfície que melhor a descreve: um ajuste QUADRÁTICO por
// mínimos quadrados, 6 coeficientes por corpo, sobre a base real no disco da
// pegada mais 20 m. Resíduo p99 medido, corpo a corpo: 4,92 / 4,83 / 4,27 /
// 1,36 / 0,30 m, todos abaixo do lábio de cada um (9 / 9 / 8 / 7 / 6 m). É essa
// diferença que vira a folga do lábio, e é por isso que ela é medida.
//
// ⚠️ E É POR CAUSA DESSE RESÍDUO QUE `raioInscrito` NÃO É O RAIO DE PROJETO. O
// desenho põe a linha d'água no `raio`; o resíduo faz a linha real oscilar
// conforme o rumo. Um disco do raio de projeto ficaria FLUTUANDO sobre terra
// seca no rumo em que a margem fecha mais cedo. O que se exporta é o raio
// INSCRITO, o maior disco submerso em TODOS os rumos, medido na bacia
// CONSTRUÍDA com varredura de 180 rumos e passo de 0,5 m.
// ═══════════════════════════════════════════════════════════════════════════
interface Bacia {
  nome: string
  cx: number
  cz: number
  /** cota da lâmina, em metros */
  cota: number
  /** raio de PROJETO da linha d'água (onde o perfil cruza a cota) */
  raio: number
  /** raio do fundo plano: dentro dele a profundidade é a máxima */
  fundoR: number
  /** profundidade máxima da cuba, em metros abaixo de `cota` */
  prof: number
  /** largura da orla, da linha d'água até o lábio */
  orla: number
  /** ⚠️ ALTURA DO LÁBIO SOBRE A LÂMINA, E ELE É A TRAVA CONTRA VAZAMENTO: tem
   *  de ser maior que o resíduo do ajuste da base neste sítio (ver o cabeçalho).
   *  E não pode ser grande demais: uma orla de 40 graus vira banheira e nenhuma
   *  árvore encosta na água. Os cinco ficam entre 11,3 e 12,7 graus nominais. */
  orlaAlt: number
  /** quanto a bacia leva para voltar ao terreno natural depois do lábio. É a
   *  saia externa do dique, e por isso é maior nos corpos maiores. */
  fade: number
  /** raio INSCRITO MEDIDO na bacia construída: o maior disco submerso em TODOS
   *  os rumos. É este que a frente da água recebe. */
  raioInscrito: number
  /** os 6 coeficientes do ajuste quadrático da base natural, em METROS de
   *  deslocamento a partir do centro: `[c0, cx, cz, cxx, cxz, czz]` */
  base: readonly number[]
}

const BACIAS: readonly Bacia[] = [
  // ⚠️ O PRIMEIRO CORPO É O DE ONTEM, BIT A BIT: mesmo centro (`pontoEmRumo(8000,
  // 285)`), mesma cota, mesma cuba e os MESMOS coeficientes de ajuste que a
  // frente da água mediu em 04/09 (lâmina de 5,41 ha, lábio mínimo +4,1 m). A
  // pluralização não pode mover a única água que já foi medida.
  { nome: 'Saddle Lake', cx: -7727.407, cz: -2070.552, cota: 407, raio: 130, fundoR: 78, prof: 20, orla: 40, orlaAlt: 9, fade: 260, raioInscrito: 120,
    base: [141.673, -0.124475, -0.316860, 5.71731e-5, 3.74732e-4, -4.02521e-4] },
  { nome: 'Twin Lake', cx: -7755.361, cz: -1367.479, cota: 388, raio: 130, fundoR: 78, prof: 20, orla: 40, orlaAlt: 9, fade: 260, raioInscrito: 118,
    base: [-1.34943, -0.0946840, 0.0635577, 6.12678e-4, -1.22212e-3, 2.98777e-4] },
  { nome: 'North Tarn', cx: -7682.338, cz: 2645.241, cota: 683, raio: 110, fundoR: 66, prof: 14, orla: 38, orlaAlt: 8, fade: 190, raioInscrito: 99,
    base: [235.258, -0.214067, 0.0681174, -3.63589e-4, 2.90615e-4, 7.35683e-5] },
  // ⚠️ ESTE RECUOU 25 m EM 05/09, E A SAIA ENCURTOU DE 150 PARA 130, POR UM
  // DEGRAU MEDIDO. Na primeira escolha (r 8.425, saia 150) o alcance da bacia ia
  // até r 8.694, e `R_QUEDA` é 8.650: `alturaInvernoAt` devolve 0 antes de a
  // bacia entrar dali para fora, então a saia era DECEPADA. Corte radial no rumo
  // 282, de 2 em 2 m: 28,2 m acima do terreno natural em r 8.640 e zero em
  // r 8.650, ou seja um paredão de 21,32 m em 10 m de corrida. Com r 8.400 e
  // saia 130 o alcance para em r 8.649 e o peso ali já é 0: a saia morre sozinha,
  // dentro do envelope. E o sítio novo é melhor em tudo: aterro máximo 34,5 m
  // contra 48,4, resíduo p99 do ajuste 1,36 m contra 1,96.
  { nome: 'Step Tarn', cx: -8216.440, cz: -1746.458, cota: 381, raio: 85, fundoR: 51, prof: 10, orla: 34, orlaAlt: 7, fade: 130, raioInscrito: 79,
    base: [168.754, -0.493587, -0.151774, 3.80001e-5, -6.13674e-4, 2.62902e-4] },
  { nome: 'Lower Pool', cx: -7307.775, cz: -1687.133, cota: 256, raio: 60, fundoR: 36, prof: 7, orla: 30, orlaAlt: 6, fade: 120, raioInscrito: 57,
    base: [33.3932, -0.0835847, -0.0960709, -1.44996e-4, 3.91558e-4, 3.31144e-5] },
]

/** alcance total de cada bacia (lâmina + orla + desvanece), pré-calculado: a
 *  porta rápida de `comBaciaDosLagos` roda por vértice da malha do terreno
 *  inteiro, e `raio + orla + fade` é constante. */
const BACIA_ALCANCE: readonly number[] = BACIAS.map((b) => b.raio + b.orla + b.fade)

/**
 * A TABELA PÚBLICA DOS CORPOS D'ÁGUA. `lagoa.ts` (a lâmina) e `alpino.ts` (o
 * furo na casca de neve) leem isto pelo MÓDULO, não por importação nomeada, e
 * os dois já trazem a queda para os três exports antigos: ver o comentário de
 * `tabelaDoRelevo` em `lagoa.ts`. O `raio` publicado é o INSCRITO medido, nunca
 * o de projeto, porque quem desenha um disco precisa de um que não flutue.
 */
export const LAGOS: readonly { nome: string; centro: { x: number; z: number }; raio: number; cota: number; prof: number }[] =
  BACIAS.map((b) => ({ nome: b.nome, centro: { x: b.cx, z: b.cz }, raio: b.raioInscrito, cota: b.cota, prof: b.prof }))

// ── OS TRÊS EXPORTS ANTIGOS, APONTANDO PARA O PRIMEIRO CORPO ────────────────
// ⚠️ FICAM ATÉ `lagoa.ts` E `alpino.ts` MIGRAREM PARA `LAGOS`, e a razão é de
// calendário, não de gosto: as três frentes correm na mesma rodada, o bot de
// auto-commit publica de hora em hora e `tsc --noEmit` limpo é portão de saída
// de cada uma. Tirar estes três hoje derrubaria a árvore no minuto seguinte.
// Eles são DERIVADOS de `LAGOS[0]`, nunca valor copiado: a dívida de constante
// craveada é exatamente a que custou 242 m de erro nas vistas de `chapas.mjs`
// nesta mesma rodada.
/** @deprecated use `LAGOS`. Apelido do primeiro corpo. */
export const LAGOA_CENTRO: { x: number; z: number } = LAGOS[0].centro
/** @deprecated use `LAGOS`. Apelido do primeiro corpo. */
export const LAGOA_RAIO: number = LAGOS[0].raio
/** @deprecated use `LAGOS`. Apelido do primeiro corpo. */
export const LAGOA_COTA: number = LAGOS[0].cota

function lagoBaseAt(b: Bacia, dx: number, dz: number): number {
  const c = b.base
  return c[0] + c[1] * dx + c[2] * dz + c[3] * dx * dx + c[4] * dx * dz + c[5] * dz * dz
}

/** o perfil da cuba em metros RELATIVOS a `b.cota`: fundo plano, banco submerso
 *  até a linha d'água, orla mansa e lábio. */
function lagoPerfil(b: Bacia, d: number): number {
  if (d <= b.fundoR) return -b.prof
  if (d <= b.raio) return -b.prof * (1 - suave01((d - b.fundoR) / (b.raio - b.fundoR)))
  if (d <= b.raio + b.orla) return b.orlaAlt * rampaReta((d - b.raio) / b.orla, 0.3)
  return b.orlaAlt
}

/**
 * Cada bacia entra SUBSTITUINDO o relevo dentro da lâmina e da orla, não somando
 * por cima dele, e isso é deliberado: `temperoFino` tem 85 m de amplitude na
 * crista, e ruído de 85 m sob um fundo de lagoa de 20 m deixaria pedra saindo
 * da água. Subtrair uma constante não achata bump (é a mesma lição que a cava
 * da pista já tinha aprendido); substituir, sim. Do lábio para fora o peso cai
 * em `suave01` até 0 no fim do desvanece, e ali o terreno de sempre volta
 * inteiro, bit a bit.
 *
 * ⚠️ AS BACIAS SE APLICAM EM SEQUÊNCIA, UMA SOBRE O RESULTADO DA ANTERIOR, e não
 * somadas nem escolhidas por proximidade. Somar duas contaminaria a lâmina de
 * uma com a orla da outra; escolher a mais próxima abriria um degrau exatamente
 * na linha em que os dois pesos se igualam, porque os dois alvos são diferentes
 * ali. Encadear é contínuo em todo ponto (cada passo é uma interpolação) e é
 * EXATO dentro de cada lâmina: onde o peso vale 1 o resultado é o alvo daquele
 * corpo, não importa o que veio antes. É por isso que o filtro de separação da
 * família exige que o alcance de uma bacia nunca entre na zona de substituição
 * plena de outra: assim a ordem da tabela só decide a mistura no desvanece, que
 * é onde ela não muda cota nenhuma de água.
 *
 * ⚠️ NENHUMA DELAS FURA O QUE JÁ EXISTE, e cada guarda tem número: as cinco
 * pegadas ficam a ≥ 1.139 m do eixo da pista mais próxima e a ≥ 1.123 m do vão
 * de teleférico mais próximo (o filtro exigia 280 m), todas dentro do envelope
 * radial do maciço e da janela angular `AZ0` 248 a `AZ1` 288.
 */
function comBaciaDosLagos(x: number, z: number, relevo: number): number {
  // sem a bandeira não há água, e cova sem água é buraco: devolve o relevo
  // intacto, bit a bit, antes de qualquer conta. Foi a cova seca de 5,4 ha que
  // ensinou isto em 04/09.
  if (!LAGOA_ATIVA) return relevo
  let h = relevo
  for (let i = 0; i < BACIAS.length; i++) {
    const b = BACIAS[i]
    const alcance = BACIA_ALCANCE[i]
    const dx = x - b.cx, dz = z - b.cz
    // porta rápida em caixa antes da raiz quadrada: `alturaInvernoAt` é chamada
    // por vértice da malha do terreno inteiro, e os lagos são um ponto dela.
    if (dx <= -alcance || dx >= alcance || dz <= -alcance || dz >= alcance) continue
    const d = Math.hypot(dx, dz)
    if (d >= alcance) continue
    const cheio = b.raio + b.orla
    const w = d <= cheio ? 1 : 1 - suave01((d - cheio) / b.fade)
    const alvo = b.cota + lagoPerfil(b, d) - lagoBaseAt(b, dx, dz)
    h = h * (1 - w) + alvo * w
  }
  return h
}

/** true quando o ponto está debaixo d'água de QUALQUER corpo (ou na faixa de
 *  1,5 m que a onda molha). Serve para floresta e penhasco não nascerem dentro
 *  dos lagos: é o MESMO teste de cota que a linha d'água usa, então a borda da
 *  mata segue a margem de verdade, e não um círculo aproximado. */
function naLagoa(x: number, z: number, y: number): boolean {
  // idem: sem bandeira não existe lâmina, e responder `true` aqui abriria uma
  // clareira na mata por causa de uma água que não foi construída.
  if (!LAGOA_ATIVA) return false
  for (const b of BACIAS) {
    if (y > b.cota + 1.5) continue
    const alcance = b.raio + b.orla
    const dx = x - b.cx, dz = z - b.cz
    if (dx <= -alcance || dx >= alcance || dz <= -alcance || dz >= alcance) continue
    if (dx * dx + dz * dz < alcance * alcance) return true
  }
  return false
}

/**
 * A altura ADICIONADA pelo parque de inverno, em metros, para somar direto a
 * `heightAt` (mesmo contrato de `microRelevoAt`): 0 bit a bit sem a
 * bandeira, puro em (x, z), sem depender de câmera nem de estado. A forma
 * vem das `FEICOES` reais (multiplicadas pelo envelope de existência), o
 * tempero fino vem do ruído em crista, e a pista cava por cima dos dois.
 *
 * ⚠️ 0 TAMBÉM ENQUANTO `FEICOES` ESTIVER VAZIA (rede ainda não respondeu, ver
 * "FRENTE CARREGAMENTO" no cabeçalho), NÃO SÓ SEM A BANDEIRA. Guarda
 * EXPLÍCITA, de propósito: sem ela, `baseReal` ficaria 0 (o `for` sobre um
 * array vazio não muda nada), mas `temperoFino` ainda somaria ruído e
 * `pistaProximidade01` ainda cavaria a pista, e o retorno NÃO seria mais 0
 * bit a bit — quebraria exatamente o contrato que este comentário promete.
 * Este `return 0` cedo é o que faz "sem dado" e "sem bandeira" darem o
 * MESMO resultado, sempre.
 */
export function alturaInvernoAt(x: number, z: number): number {
  if (!INVERNO_ATIVO) return 0
  if (FEICOES.length === 0) return 0
  const r = Math.hypot(x, z)
  const envR = envelopeRadial(r)
  if (envR <= 0) return 0
  const az = azimuteDe(x, z)
  const envAz = envelopeAzimute(az)
  if (envAz <= 0) return 0
  const env = envR * envAz
  // ⚠️ DUAS FAMÍLIAS DE FEIÇÃO, E ELAS NÃO PASSAM PELO MESMO ENVELOPE, 04/09.
  // Quem NÃO tem `faixaR` (o avental) continua exatamente como sempre:
  // multiplicado pelo `envelopeRadial` compartilhado. Quem TEM (os cumes, as
  // selas, os contrafortes) já traz o perfil radial dentro de si, então
  // multiplicar pelo envelope de novo somaria duas quedas em cima da mesma
  // encosta, que é literalmente o que fazia a agulha: a queda do carimbo (790 m
  // em 230 m de desvanece) vinha multiplicada pela queda do envelope (100% a 0%
  // em 370 m). As duas famílias se combinam por `Math.max`, a mesma convenção
  // de sempre, então onde o avental é maior ele vence, e vice-versa.
  let comEnvelope = 0
  let comFaixa = 0
  for (const f of FEICOES) {
    const h = amostrarFeicao(f, x, z)
    if (f.faixaR) { if (h > comFaixa) comFaixa = h } else if (h > comEnvelope) comEnvelope = h
  }
  // `envAz` (a janela angular de existência) vale para as DUAS famílias: ela é
  // o que diz que o maciço só existe no arco oeste, e nenhuma faixa radial
  // substitui isso. Só o `envR` é que ficou sendo do avental.
  const baseReal = Math.max(comEnvelope * envR, comFaixa) * envAz
  const pesoPista = pistaProximidade01(x, z)
  const relevo = baseReal + temperoFino(x, z, env, pesoPista)
  // ⚠️ AS BACIAS DOS LAGOS ENTRAM AQUI, no MESMO ponto em que as feições e o
  // tempero já entram, e ANTES da cava da pista: a pegada mais próxima de uma
  // fita está a 1.287 m dela, então a ordem não muda um milímetro hoje, mas se
  // alguém puxar uma pista para perto de um lago um dia é a cava que tem de
  // vencer (a fita é a peça que o atleta pisa), não a água.
  return comBaciaDosLagos(x, z, relevo) - PROFUNDIDADE_CORTE * pesoPista
}

/**
 * Quanto (0..1) um ponto pertence à zona esculpida pelo parque de inverno.
 * `alpino.ts` usa isto para baixar a cota de neve SÓ onde a montanha nova
 * está, sem gelar encostas de outro rumo que não têm nada com este módulo.
 * 0 bit a bit sem `?inverno=1`, mesmo contrato de `alturaInvernoAt`.
 */
export function zonaEsquiavelAt(x: number, z: number): number {
  if (!INVERNO_ATIVO) return 0
  const r = Math.hypot(x, z)
  const envR = envelopeRadial(r)
  if (envR <= 0) return 0
  const az = azimuteDe(x, z)
  return envR * envelopeAzimute(az)
}
/**
 * ⚠️ ROCHA EXPOSTA. A mesma regra de `alpino.ts` (neve não gruda acima de
 * ~30°, zero em 55°): acima disso o que aparece não pode ser regolito
 * marrom, tem que ser pedra. `terrain.ts` chama isto (ele é o dono da cor
 * por vértice da malha grossa, `regolithColor`) com a inclinação que ELE já
 * calcula ao montar a malha, e mistura a cor pra um cinza de rocha onde o
 * fator voltar > 0. 0 fora da zona do parque (não pinta rocha na cidade),
 * 0 dentro da zona mas em terreno manso (< 30°): a transição usa a MESMA
 * faixa 30-55° que a neve usa, de propósito, para rocha e neve se encaixarem
 * sem uma tira de regolito sobrando entre as duas.
 */
export function fatorRochaAt(x: number, z: number, inclinacaoGraus: number): number {
  if (!INVERNO_ATIVO) return 0
  const zona = zonaEsquiavelAt(x, z)
  if (zona <= 0) return 0
  const porInclinacao = suave01((inclinacaoGraus - 30) / 25)
  return zona * porInclinacao
}


const CORES: Record<Dificuldade, THREE.Color> = {
  verde: new THREE.Color('#3DBB4C'),
  azul: new THREE.Color('#1E6FD9'),
  vermelha: new THREE.Color('#D92B2B'),
  preta: new THREE.Color('#202024'),
  parque: new THREE.Color('#E8660D'),
}

/** comprimento e desnível reais de uma pista, medidos em cima de `heightAt`
 *  de verdade: a conferência dos alvos de projeto, não a suposição deles. */
export function medirPista(p: Pista, heightAt: (x: number, z: number) => number) {
  let comprimento = 0
  let yMax = -Infinity, yMin = Infinity
  let anterior: THREE.Vector3 | null = null
  for (const pt of p.pontos) {
    const [x, z] = pontoEmRumo(pt.r, pt.az)
    const y = heightAt(x, z)
    yMax = Math.max(yMax, y); yMin = Math.min(yMin, y)
    const v = new THREE.Vector3(x, y, z)
    if (anterior) comprimento += anterior.distanceTo(v)
    anterior = v
  }
  return { comprimento, desnivel: yMax - yMin, grauMedio: (Math.atan2(yMax - yMin, comprimento) * 180) / Math.PI }
}

export interface InvernoOpts {
  /** ⚠️ passe `terrain.superficieAt`, a mesma regra de `alpino.ts`: quem
   *  desenha coisa que ENCOSTA no chão usa a superfície que a câmera vê, não
   *  a função contínua. */
  heightAt: (x: number, z: number) => number
  /** ⚠️ O LOADER DA CENA, NÃO UM CRU. As dez malhas de árvore em `ARVORES`
   *  (`tree-pine.glb` mais as nove sequoias, `sq-*.glb`) vêm comprimidas em
   *  DRACO (mesma armadilha documentada em `montanha.ts`: falham em
   *  `GLTFLoader` sem `DRACOLoader`). Sem `gltf`, a floresta não sobe
   *  (avisado no console, não silencioso) e o resto do módulo (pistas,
   *  halfpipe, teleféricos) sobe normalmente: a floresta é aditiva, não
   *  trava o parque. Falha de UM `.glb` também não trava nada: ver o
   *  cabeçalho da seção "A FLORESTA". */
  gltf?: GLTFLoader
  sombra?: boolean
  profile?: PerfProfile
  culler?: DistanceCuller
}

export interface Inverno {
  group: THREE.Group
  triangulos: number
  /** as medições reais de cada pista, para `?stats=1` e para o relatório */
  medidas: { nome: string; dificuldade: Dificuldade; comprimento: number; desnivel: number; grauMedio: number }[]
  /** quantas árvores reais (pinheiro + sequoia) subiram, para o log de boot */
  arvores: number
  /** troca o LOD por distância de câmera, mesmo contrato de `alpino.ts` */
  update(cam: THREE.Vector3): void
  dispose(): void
}

const LEVANTE_FITA = 0.5

/** uma fita de pista: tira de quads seguindo os pontos, elevada sobre o chão,
 *  cor sólida por dificuldade. Mesmo princípio de `alpino.ts`: malha própria,
 *  não cor por vértice do terreno de outro módulo. */
function construirFita(p: Pista, heightAt: (x: number, z: number) => number): THREE.BufferGeometry {
  const cor = CORES[p.dificuldade]
  const centro: THREE.Vector3[] = p.pontos.map((pt) => {
    const [x, z] = pontoEmRumo(pt.r, pt.az)
    return new THREE.Vector3(x, heightAt(x, z) + LEVANTE_FITA, z)
  })
  const pos: number[] = [], nor: number[] = [], cores: number[] = [], uv: number[] = []
  const meiaLarg = p.largura / 2
  const up = new THREE.Vector3(0, 1, 0)
  let acumulado = 0
  for (let i = 0; i < centro.length; i++) {
    const atual = centro[i]
    const dir = new THREE.Vector3()
    if (i === 0) dir.subVectors(centro[1], centro[0])
    else if (i === centro.length - 1) dir.subVectors(centro[i], centro[i - 1])
    else dir.subVectors(centro[i + 1], centro[i - 1])
    dir.y = 0
    if (dir.lengthSq() < 1e-6) dir.set(1, 0, 0)
    dir.normalize()
    const lado = new THREE.Vector3().crossVectors(up, dir).normalize()
    const a = new THREE.Vector3().copy(atual).addScaledVector(lado, meiaLarg)
    const b = new THREE.Vector3().copy(atual).addScaledVector(lado, -meiaLarg)
    pos.push(a.x, a.y, a.z, b.x, b.y, b.z)
    nor.push(0, 1, 0, 0, 1, 0)
    cores.push(cor.r, cor.g, cor.b, cor.r, cor.g, cor.b)
    if (i > 0) acumulado += atual.distanceTo(centro[i - 1])
    uv.push(0, acumulado / 20, 1, acumulado / 20)
  }
  const idx: number[] = []
  for (let i = 0; i < centro.length - 1; i++) {
    const a = i * 2, b = i * 2 + 1, c = i * 2 + 2, d = i * 2 + 3
    idx.push(a, c, b, b, c, d)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(cores, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  return g
}

// ── O HALFPIPE ────────────────────────────────────────────────────────────
// Parede 6,71 m (22 pés, igual à Terra: ver Tarefa 3), pé-a-pé 182,9 m
// (600 pés, igual à Terra), largura de boca 19,5 m (64 pés). A folga de ar
// exigida ACIMA da parede (48,5 m, o recorde mundial de amplitude vezes
// 6,035) não é geometria desenhada aqui: é orçamento de câmera, escrito no
// relatório para quem for enquadrar a cena.
const PIPE_PAREDE = 6.71
const PIPE_MEIA_BOCA = 19.5 / 2
const PIPE_COMPRIMENTO = 182.9
const PIPE_FATIAS = 10
const PIPE_PERFIL = 8 // pontos atravessando a boca, de uma parede a outra

function perfilPipe(s: number): number {
  // s em [-1,1]; 0 no fundo do canal, 1 na boca de cada lado
  return PIPE_PAREDE * Math.pow(Math.abs(s), 1.6)
}

function construirHalfpipe(
  centroR: number, centroAz: number, rumoDescida: number,
  heightAt: (x: number, z: number) => number,
): THREE.BufferGeometry {
  const [cx, cz] = pontoEmRumo(centroR, centroAz)
  const yBase = heightAt(cx, cz)
  const dirRad = (rumoDescida * Math.PI) / 180
  const dir = new THREE.Vector3(Math.sin(dirRad), 0, -Math.cos(dirRad))
  const lado = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), dir).normalize()
  const pos: number[] = [], nor: number[] = [], cores: number[] = []
  const corGelo = new THREE.Color('#DCE7EE')
  const linhas: THREE.Vector3[][] = []
  for (let i = 0; i <= PIPE_FATIAS; i++) {
    const t = i / PIPE_FATIAS
    const centro = new THREE.Vector3(cx, yBase, cz).addScaledVector(dir, (t - 0.5) * PIPE_COMPRIMENTO)
    const linha: THREE.Vector3[] = []
    for (let j = 0; j <= PIPE_PERFIL; j++) {
      const s = (j / PIPE_PERFIL) * 2 - 1
      const alturaParede = perfilPipe(s)
      const p = new THREE.Vector3().copy(centro)
        .addScaledVector(lado, s * PIPE_MEIA_BOCA)
        .add(new THREE.Vector3(0, alturaParede - PIPE_PAREDE, 0)) // canal escavado: fundo abaixo do chão
      linha.push(p)
    }
    linhas.push(linha)
  }
  for (let i = 0; i < linhas.length - 1; i++) {
    for (let j = 0; j < PIPE_PERFIL; j++) {
      const a = linhas[i][j], b = linhas[i][j + 1], c = linhas[i + 1][j], d = linhas[i + 1][j + 1]
      const n1 = new THREE.Triangle(a, c, b).getNormal(new THREE.Vector3())
      pos.push(a.x, a.y, a.z, c.x, c.y, c.z, b.x, b.y, b.z)
      pos.push(b.x, b.y, b.z, c.x, c.y, c.z, d.x, d.y, d.z)
      for (let k = 0; k < 6; k++) { nor.push(n1.x, n1.y, n1.z); cores.push(corGelo.r, corGelo.g, corGelo.b) }
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(cores, 3))
  return g
}

// ── OS TELEFÉRICOS ────────────────────────────────────────────────────────
// Dois cabos: o principal, da vila-base ao ombro do pico; o do parque, da
// vila-base ao colo do halfpipe. Pilone de 16 m (referência de estação de
// esqui comum; NÃO É NORMA FIS, não existe norma FIS para pilone de
// teleférico, dito por honestidade, não por descuido).
const PILONE_ALTURA = 16

/**
 * ⚠️ OS DOIS VÃOS VIRARAM UMA FONTE SÓ EM 04/09, E ISSO CONSERTA UM DEFEITO
 * MEDIDO, não é arrumação. Os pilones e o cabo nasciam de números escritos à
 * mão dentro de `*fatia()` (topos em r 8.280 e r 8.220) e as CABINES nasciam de
 * outros números, escritos à mão na chamada de `buildEstacaoInverno` (topos em
 * r 8.200 e r 8.150): 80 e 70 m de divergência entre o cabo desenhado e as
 * cabines penduradas nele. O cabeçalho de `estacao-inverno.ts` já previa
 * exatamente este caso e já dizia o conserto: "se os dois módulos divergirem
 * visualmente, o conserto é `inverno.ts` exportar os vãos e este arquivo
 * importar, não uma segunda adivinhação daqui".
 *
 * ⚠️ E OS DOIS TOPOS ESTAVAM FORA DO CUME NOS DOIS CONJUNTOS DE NÚMEROS. O
 * comentário anterior afirmava que "a crista nova culmina em r 8.200 (rumo 268)
 * e r ~8.150 (rumo 261)", medido de 50 em 50 m. Remedido de 25 em 25 m, e nas
 * DUAS réguas que esta cena tem, porque elas discordam pela flecha da corda:
 *
 *   rumo   régua           máximo    r 8.100   r 8.150   r 8.200   r 8.280
 *    268   superficieAt    8.150     ---       906,6     879,5     804,6
 *    268   heightAt        8.150     ---       922,2     910,6     788,1
 *    261   superficieAt    8.100     977,4     959,4     928,9     811,3
 *    261   heightAt        8.050     ---       955,0     928,3     808,3
 *
 * No rumo 268 as duas réguas apontam a MESMA célula. No 261 elas ficam a uma
 * célula de distância (8.050 contra 8.100), e o topo vai no 8.100: `o.heightAt`
 * é `terrain.superficieAt` (é o que `plaza-scene.tsx` passa), e é sobre a
 * superfície DESENHADA que o pilone, o cabo e a cabine assentam. Uma estação de
 * topo 50 m depois do cume já está na descida da face oposta, que é o defeito
 * que a nota antiga dizia estar evitando e não evitava.
 */
export interface VaoTeleferico {
  rBase: number; azBase: number
  rTopo: number; azTopo: number
  nPilones: number; nCabines: number
}
export const VAOS_TELEFERICO: VaoTeleferico[] = [
  { rBase: 7000, azBase: 268, rTopo: 8150, azTopo: 268, nPilones: 6, nCabines: 10 },
  { rBase: 6950, azBase: 273, rTopo: 8100, azTopo: 261, nPilones: 4, nCabines: 6 },
]

function construirTeleferico(
  deR: number, deAz: number, paraR: number, paraAz: number, nPilones: number,
  heightAt: (x: number, z: number) => number,
): { pilones: THREE.InstancedMesh; cabo: THREE.Mesh; triangulos: number } {
  const pontos: THREE.Vector3[] = []
  for (let i = 0; i <= nPilones + 1; i++) {
    const t = i / (nPilones + 1)
    const r = deR + (paraR - deR) * t
    const az = deAz + (paraAz - deAz) * t
    const [x, z] = pontoEmRumo(r, az)
    pontos.push(new THREE.Vector3(x, heightAt(x, z) + PILONE_ALTURA, z))
  }
  const gPilone = new THREE.CylinderGeometry(0.5, 0.7, PILONE_ALTURA, 6)
  const matPilone = new THREE.MeshStandardMaterial({ color: '#8A8D93', roughness: 0.8 })
  const pilones = new THREE.InstancedMesh(gPilone, matPilone, pontos.length)
  const m4 = new THREE.Matrix4()
  for (let i = 0; i < pontos.length; i++) {
    m4.makeTranslation(pontos[i].x, pontos[i].y - PILONE_ALTURA / 2, pontos[i].z)
    pilones.setMatrixAt(i, m4)
  }
  pilones.instanceMatrix.needsUpdate = true
  pilones.name = 'inverno:pilones'

  // o cabo: uma curva suave pelos topos dos pilones, levemente arriada entre
  // cada par (a mesma ideia de catenária de um cabo real, sem resolver a
  // catenária de verdade: é detalhe de fundo, visto de longe)
  const comArrio: THREE.Vector3[] = []
  for (let i = 0; i < pontos.length; i++) {
    comArrio.push(pontos[i])
    if (i < pontos.length - 1) {
      const meio = pontos[i].clone().lerp(pontos[i + 1], 0.5)
      meio.y -= 1.4
      comArrio.push(meio)
    }
  }
  const curva = new THREE.CatmullRomCurve3(comArrio)
  const gCabo = new THREE.TubeGeometry(curva, comArrio.length * 4, 0.12, 5, false)
  const matCabo = new THREE.MeshStandardMaterial({ color: '#2B2B2E', roughness: 0.6, metalness: 0.3 })
  const cabo = new THREE.Mesh(gCabo, matCabo)
  cabo.name = 'inverno:cabo'

  const triPilone = gPilone.index ? gPilone.index.count / 3 : gPilone.attributes.position.count / 3
  const triCabo = gCabo.index ? gCabo.index.count / 3 : gCabo.attributes.position.count / 3
  return { pilones, cabo, triangulos: Math.round(triPilone * pontos.length + triCabo) }
}

// ═══════════════════════════════════════════════════════════════════════════
// A FLORESTA (03/09, redesenhada no mesmo dia). A chapa apontou "árvores
// esparsas no pé e nada na montanha": a faixa de mata que `alpino.ts`
// adaptou e as coníferas de 34 triângulos dele são de propósito UM FUNDO
// visto de 6 a 9 km, não uma floresta que aguenta câmera perto do maciço.
//
// ⚠️ COLISÃO ENTRE FRENTES, 03/09: este módulo usava `sequoia-mass.glb`
// (84,69 m, um BOSQUE inteiro por instância, ver a nota que existia aqui). A
// frente de espécies aposentou esse arquivo (e `sequoia.glb`) no mesmo dia:
// achou no acervo Sketchfab sequoias de verdade, com casca texturizada, mais
// baratas (2.536-3.339 tri contra 10.336 do gerado por código, que lia como
// brócolis facetado). O `.catch(() => null)` que eu já tinha evitou a
// quebra, mas produziu um BURACO SILENCIOSO: 404 no console, floresta sem
// sequoia, ninguém sabendo, o mesmo defeito que `loadSf` teve em outro
// lugar da cena no mesmo dia. Duas correções aqui: (1) a fonte trocou para
// as novas; (2) falha de carregamento agora GRITA (`console.error`) por
// arquivo, nunca mais silenciosa.
//
// ⚠️ AS NOVAS SÃO ÁRVORES, NÃO BOSQUES, e isso muda a lógica inteira de
// densidade. `sequoia-mass.glb` entrava RARA (3,5% dos candidatos, só abaixo
// de 70 m) porque cada instância já valia uma clareira cheia. As novas
// medem 16 a 40 m (`sq-small-1`, `sq-med-1..4`, `sq-big-1..3`, medido no
// binário glTF, accessor min/max), na mesma ordem de grandeza do pinheiro
// (11 m), só mais altas: uma sequoia de verdade emerge acima do dossel de
// coníferas, não domina a clareira sozinha. Por isso a fração sobe de 3,5%
// para a maior parte da mistura (ver `ARVORES` abaixo) e passa a valer em
// toda a faixa de elevação, não só embaixo.
//
// ⚠️ `sq-rh.glb` MEDE 80 M, quase a escala do bosque antigo, só que é UMA
// árvore só (General Sherman de verdade passa de 80 m). É o "exemplar
// isolado de destaque perto da câmera" que a origem do modelo já descreve:
// entra no MESMO sorteio de todo mundo, mas com peso baixíssimo, então dá
// só um punhado de exemplares no maciço inteiro: raro e dramático, não repetido.
//
// ⚠️ OITO SILHUETAS DISTINTAS (nove com `sq-rh`) MATAM DE GRAÇA A FLORESTA
// DE CLONES: o defeito conhecido desta cidade (`props.ts` nunca chamou
// `setColorAt`, toda cópia de uma espécie saía bit a bit igual). Aqui cada
// candidato sorteia a PEÇA pelo MESMO hash determinístico que já decide
// posição, então a escolha é estável (recarregar a página planta a mesma
// árvore no mesmo lugar) sem custar um for-loop de cor por instância.
//
// ⚠️ SE UMA ESPÉCIE FALHA AO CARREGAR, OS CANDIDATOS DELA NÃO SOMEM: a
// tabela de peso cumulativo é reconstruída só com quem carregou, e o hash
// de espécie é resolvido contra ESSA tabela: outra espécie absorve a fatia,
// sem buraco silencioso na densidade. Só some a SILHUETA daquela espécie,
// nunca a árvore inteira.
//
// ⚠️ DOIS NÍVEIS DE DETALHE, MESMO CONTRATO DE `alpino.ts`: perto (r_cam <
// `FLORESTA_R_CHEIA`) usa a malha real carregada; longe usa um cone de 4
// lados (8 triângulos), a MESMA forma que `alpino.ts` já usa pro fundo dele,
// para todas as espécies lerem como uma silhueta só de longe. `update(cam)`
// troca o balde a cada chamada, como alpino faz.
//
// ⚠️ CUSTO DECLARADO NA CONSTRUÇÃO, NÃO SUPOSTO: contagem real no relatório
// final (`triangulos`/`arvores` do retorno). Teto duro de candidatos perto
// (`FLORESTA_TETO_PERTO`) para o orçamento não fugir se a densidade medida
// vier maior que a esperada.
const FLORESTA_BAIXO = 15
/**
 * ⚠️ 190 -> 550 EM 04/09, E ESTA É A MAIOR PARTE DA QUEIXA "vegetação
 * completamente esparsa". Não era só densidade: era ONDE. A faixa de plantio
 * ia de 15 a 190 m de cota, num maciço que agora chega a 1.044 m, ou seja a
 * mata existia nos 18% de baixo e o resto era pedra pelada. Cordilheira de
 * região de lagos tem mata na metade de baixo inteira, e é isso que 550 dá:
 * 53% da montanha arborizada, rocha e neve acima.
 *
 * MEDIDO OFFLINE (`heightAt` real de `terrain.ts`, varredura completa da cunha):
 *
 *   FLORESTA_ALTO   candidatos   cota mediana   cone (8 tri cada)
 *        190           2.483         135 m         19.864
 *        320           3.893         158 m         31.144
 *        430           4.929         178 m         39.432
 *        550           5.637         204 m         45.096
 *
 * O custo de perto NÃO muda com isto (o teto de 450 é quem manda); o que
 * cresce é o balde de cone, 8 triângulos por árvore. Mais que dobrar a mata
 * custou 25.232 triângulos, que é 0,65% da praça.
 *
 * ⚠️ A CONTAGEM DE HOJE É 6.340, NÃO 5.637, e as duas estão certas na data
 * delas: a bacia da lagoa (ver `LAGOA_CENTRO`) pôs 516 candidatos novos na
 * pegada dela (banco plano e orla mansa dentro da faixa de plantio, onde antes
 * era rocha em pé reprovada pelo filtro de 42 graus) e a partida da Descida
 * recuada de r 8.200 para 8.150 mexeu no resto. Medido com
 * `gerarCandidatosFloresta` sobre o `superficieAt` real. Todo número de "5.637"
 * que sobrou nos comentários abaixo é de 04/09 de manhã, antes da lagoa, e está
 * marcado como histórico, não como o estado de hoje.
 */
const FLORESTA_ALTO = 550
/** ⚠️ 22 -> 70. A pluma é o desvanece da densidade nas duas pontas da faixa de
 *  cota, e com 22 m o limite superior da mata era uma LINHA horizontal de 44 m
 *  de espessura contornando a montanha, que é exatamente o que não existe na
 *  natureza. Com a faixa indo até 550 m, 70 m dissolve o limite superior ao
 *  longo de ~140 m de desnível: a mata rareia antes de acabar. */
const FLORESTA_PLUMA = 70
const FLORESTA_PASSO = 30
/**
 * ⚠️ O TETO CONTINUA 450, E ISSO AGORA É UMA DECISÃO MEDIDA, não a inércia.
 * O que mudou foi o SIGNIFICADO: até 04/09 as 450 eram um sorteio fixo por
 * hash, e o resto ficava cone para sempre; agora são as 450 MAIS PRÓXIMAS da
 * câmera (ver `instanciarFlorestaDensa`). Com a floresta de hoje, medida
 * offline (Node 20, `tsx`, `heightAt` real de `terrain.ts` sobre o heightmap
 * real, sem abrir navegador): 5.637 candidatos numa cunha de 12,28 km², ou 459
 * árvores por km². As 450 mais próximas cobrem 0,98 km² em volta de quem olha,
 * um raio de 559 m de mata REAL, e além disso o cone com a silhueta certa.
 *
 * ⚠️ E O CUSTO DELAS TRIPLICOU DE PROPÓSITO. Com o carregador consertado
 * (`carregarInstanciavel`), a árvore média custa 2.960 triângulos em vez de
 * 900: as 450 saem por 1,33 milhão, que é EXATAMENTE o número que este
 * comentário já declarava desde 03/09 e que a cena nunca pagou de verdade
 * (rodava a 30% dele, com tronco faltando). Subir o teto agora tem preço
 * medido, e ele fica registrado para quem for mexer:
 *
 *   teto   malha real   + cones     total      contra a praça inteira (3,88 M)
 *    450    1.330.587    45.096    1.375.683        35%
 *    600    1.774.116    45.096    1.819.212        47%
 *    800    2.365.487    45.096    2.410.583        62%
 *
 * A abóbada sozinha já é 2,1 M dos 3,88 M da praça (`perf.ts`), então passar
 * de 450 antes de a chapa pedir seria gastar metade de um orçamento de cena
 * numa coisa só.
 *
 * ⚠️ E ESTE NÚMERO PASSOU A SER O TETO DO DESKTOP, NÃO O TETO DE TODO MUNDO,
 * em 04/09 (obra 2): ver `orcamentoPerto`. Até aqui a camada perto não olhava
 * para `PerfProfile` uma vez sequer, e o celular pagava exatamente a conta do
 * desktop.
 */
const FLORESTA_TETO_PERTO = 450

/**
 * ⚠️ O ORÇAMENTO DA CAMADA PERTO POR APARELHO, E ELE FALTAVA INTEIRO. A camada
 * perto (floresta densa em malha real + penhascos) triplicou de custo quando
 * `carregarInstanciavel` foi consertado, e nada disso passava por `PerfProfile`:
 * um celular no LOW instanciava as MESMAS 450 árvores de malha real, as MESMAS
 * 22 chamadas de desenho e as MESMAS 140 rochas que um desktop no HIGH, todas
 * com `castShadow` ligado. O celular desta cena acabou de ser consertado com o
 * espelho KTX2 e não pode voltar a levar carga de desktop.
 *
 * MEDIDO DE PONTA A PONTA, não estimado: `buildInverno` rodado offline (Node 20,
 * `tsx`) com o `superficieAt` REAL de `terrain.ts` e um `GLTFLoader` falso cujas
 * malhas têm a contagem de triângulo e o `alphaTest` de CADA primitiva dos 11
 * `.glb` de verdade (decodificação no nível de accessor glTF: pinheiro
 * 11/37/234 opacos + 2.917 MASK, sequoia 860 opaco + 1.676-1.928 MASK, sq-rh
 * 1.851 opaco + 1.488 MASK, rocha 3.076 opaco). Depois a câmera é posta dentro
 * do maciço, a `Obra` da camada perto roda até o fim e a árvore de objetos é
 * contada instância por instância:
 *
 *   perfil             floresta densa   malhas   passe de sombra   penhascos
 *   desktop HIGH        1.318.828 tri      23    1.247.800 em 22   114 = 350.664
 *   desktop BALANCED    1.318.828 tri      23    1.247.800 em 22   114 = 350.664
 *   mobile  BALANCED      459.574 tri      11            0 em  0    41 = 126.116
 *   qualquer LOW          328.314 tri      11            0 em  0    29 =  89.204
 *   sem `profile`       1.318.828 tri      23    1.247.800 em 22   114 = 350.664
 *
 * Somando a rocha, o que a GPU desenha na camada perto sai de 1.669.492 tri
 * (desktop) para 585.690 (celular, 35%) e 417.518 (LOW, 25%), e o que entra no
 * PASSE DE SOMBRA sai de 1.598.464 para ZERO nos dois perfis fracos. As
 * chamadas de desenho da floresta caem de 23 para 11.
 *
 * ⚠️ AS ROCHAS PARAM ANTES DO TETO NO DESKTOP: o teto é 140 e a varredura só
 * acha 114 candidatos com o relevo de hoje, ou seja no desktop quem manda é a
 * oferta, não o orçamento. No celular (45) e no LOW (35) o teto é que manda, e
 * o filtro é por hash, então saem 41 e 29.
 *
 * ⚠️ O TOPO NÃO PIORA, E ISSO É REGRA DESTA RODADA: `desktop HIGH` está bit a
 * bit como estava antes desta obra (450, 140, 10 espécies, sombra em tudo,
 * folha inclusive). `desktop BALANCED` também ficou intacto, e de propósito: é
 * o perfil da máquina do fundador e o das chapas de contrato, e a medição que
 * justificaria cortá-lo é tempo de quadro, que só o navegador dá e esta frente
 * não abre navegador. Cortar sem medir seria trocar um palpite por outro.
 *
 * ⚠️ POR QUE A SOMBRA CAI INTEIRA NOS PERFIS FRACOS, em vez de "só o tronco
 * projeta". A conta é do texel: no celular o mapa de sombra é 1.024
 * (`perf.ts`), e com a caixa de 650 m que `followShadow` usa quando alguém está
 * dentro da mata o texel mede 1,27 m. Um tronco tem menos de 1 m de largura, ou
 * seja a sombra dele não chega a um texel; quem se vê é a COPA, e a copa é
 * `alphaMode: MASK`, o passe caro (alpha-test no mapa de profundidade mata o
 * early-Z, que é justamente o que uma GPU de celular menos perdoa). Deixar só o
 * tronco projetando pagaria o passe e não entregaria imagem: ou vai a árvore
 * inteira, ou não vai nada. No desktop vai inteira.
 */
interface OrcamentoPerto {
  arvores: number
  rochas: number
  /** elenco enxuto de espécies (ver `EspecieArvore.noEnxuto`) */
  enxuto: boolean
  /** a floresta densa e os penhascos entram no passe de sombra */
  sombra: boolean
}
function orcamentoPerto(p?: PerfProfile): OrcamentoPerto {
  // ⚠️ SEM PERFIL É DESKTOP BALANCED, e isso não é chute: o único caminho que
  // não passa `profile` é `buildInverno` (a função de compatibilidade) e a
  // medição offline. Os dois precisam do comportamento de hoje, bit a bit.
  const tier = p?.tier ?? 'desktop'
  const quality = p?.quality ?? 'balanced'
  if (quality === 'low') return { arvores: 110, rochas: 35, enxuto: true, sombra: false }
  if (tier === 'mobile') return { arvores: 150, rochas: 45, enxuto: true, sombra: false }
  return { arvores: FLORESTA_TETO_PERTO, rochas: TETO_ROCHA, enxuto: false, sombra: true }
}
/** folga da capacidade por espécie sobre a fatia esperada do teto: as N mais
 *  próximas não respeitam a mistura de pesos exatamente, e faltar buffer
 *  faria a espécie sumir no lugar de virar cone. Custa buffer, não triângulo. */
const FOLGA_CAP = 1.5
/**
 * ⚠️ 1.300 -> 2.600 EM 04/09, E O NÚMERO SAI DE DUAS CONTAS, não de gosto.
 *
 * (1) De DENTRO: com o corte por distância, este raio virou um TETO, não a
 * régua. Quem decide é `FLORESTA_TETO_PERTO`; 2.600 m só garante que o corte
 * nunca fique preso num raio menor que a mata que o orçamento paga.
 *
 * (2) De FORA, e aqui está a razão de NÃO subir mais: a chapa de contrato
 * `inverno` (`scripts/city/chapas.mjs`) fica a 4.526 m do alvo e a `silhueta` a
 * 4.753 m. Nessa distância, com 1.600 px de largura e 42 graus de campo, um
 * pixel vale 2,4 m: uma árvore de 19 m mede 8 px. Malha real e cone de
 * silhueta certa são indistinguíveis em 8 px, e o cone custa 8 triângulos
 * contra 2.960. Deixar o raio abaixo da distância de contrato é o que mantém a
 * chapa de longe barata E uniforme (mata inteira em cone, sem uma faixa
 * detalhada colada na borda de baixo, que é o que aconteceria com um raio
 * grande e um teto pequeno).
 *
 * O que fazia a chapa de contrato ler como mato ralo NÃO era este raio: era o
 * teto da camada esparsa (220 cones para 5.771 candidatos) e o tamanho do cone
 * (60% da altura e 42% da largura da árvore real). Os dois estão consertados
 * logo abaixo e em `geoConeLonge`.
 */
const FLORESTA_R_CHEIA = 2600
/** acima disto (inclinação em graus) não planta: mesma regra de `alpino.ts` */
const FLORESTA_INC_MAX = 42
/** folga além da meia-largura da pista mais próxima antes de plantar */
const FLORESTA_FOLGA_PISTA = 10

/**
 * ⚠️ AS ESPÉCIES, COM PESO RELATIVO NO SORTEIO. `peso` não precisa somar 1:
 * o código normaliza pela soma de quem CARREGOU (ver `construirFloresta`).
 * Pesos escolhidos por bom senso de estrutura de floresta real (mudas
 * pequenas são a maioria, exemplares grandes são raros, o gigante isolado é
 * rariíssimo), não medidos, dito por honestidade: é a única parte deste
 * módulo que não vem de conta.
 */
interface EspecieArvore {
  id: string; url: string; peso: number; escMin: number; escMax: number
  /**
   * ⚠️ SOBREVIVE NO ELENCO ENXUTO, o do celular e do LOW (ver `orcamentoPerto`).
   * As quatro marcadas foram escolhidas por SILHUETA, não pelas quatro maiores
   * fatias do sorteio: uma de cada porte (pinheiro, pequena, média, grande),
   * porque quatro sequoias médias com textura diferente leem como uma árvore
   * repetida quatro vezes, e o defeito que a floresta densa existe para
   * consertar é justamente a repetição.
   *
   * O que o corte economiza, MEDIDO nos binários (decodificação do GLB no nível
   * de accessor, `.glb` e imagens embutidas): 6 arquivos a menos, 1.154 KB de
   * rede, 12 chamadas de desenho a menos (22 -> 10) e 26,7 MB de textura no
   * caminho SEM o espelho KTX2. Com o espelho ligado (que é o caso do celular
   * hoje, `plaza-scene.tsx` troca `/city/sf/` por `/city/sf-ktx2/`) as mesmas
   * 512x512 viram ETC2 e custam 0,17 MB cada em vez de 1,33: a economia de
   * textura cai para ~3,3 MB e quem manda passa a ser a rede e a chamada de
   * desenho. Está escrito assim de propósito, para ninguém repetir a conta do
   * caminho errado.
   */
  noEnxuto?: boolean
}
const ARVORES: EspecieArvore[] = [
  { id: 'pinheiro', url: '/city/sf/tree-pine.glb', peso: 0.50, escMin: 0.80, escMax: 1.35, noEnxuto: true },
  { id: 'sq-small-1', url: '/city/sf/sq-small-1.glb', peso: 0.16, escMin: 0.85, escMax: 1.15, noEnxuto: true },
  { id: 'sq-med-1', url: '/city/sf/sq-med-1.glb', peso: 0.065, escMin: 0.85, escMax: 1.10, noEnxuto: true },
  { id: 'sq-med-2', url: '/city/sf/sq-med-2.glb', peso: 0.065, escMin: 0.85, escMax: 1.10 },
  { id: 'sq-med-3', url: '/city/sf/sq-med-3.glb', peso: 0.06, escMin: 0.85, escMax: 1.10 },
  { id: 'sq-med-4', url: '/city/sf/sq-med-4.glb', peso: 0.06, escMin: 0.85, escMax: 1.10 },
  { id: 'sq-big-1', url: '/city/sf/sq-big-1.glb', peso: 0.03, escMin: 0.90, escMax: 1.08, noEnxuto: true },
  { id: 'sq-big-2', url: '/city/sf/sq-big-2.glb', peso: 0.025, escMin: 0.90, escMax: 1.08 },
  { id: 'sq-big-3', url: '/city/sf/sq-big-3.glb', peso: 0.02, escMin: 0.90, escMax: 1.08 },
  // ⚠️ RARO DE PROPÓSITO: 80 m é quase a escala do bosque que este módulo
  // usava antes. Peso de 0,3% num sorteio de ~1.300 candidatos dá uns 3 a 5
  // exemplares no maciço inteiro: marco visual, não repetição. Fora do elenco
  // enxuto porque é o arquivo mais caro dos dez (443 KB, 5 texturas) para 0,3%
  // do sorteio.
  { id: 'sq-rh', url: '/city/sf/sq-rh.glb', peso: 0.003, escMin: 0.95, escMax: 1.05 },
]

interface CandidatoFloresta {
  x: number; z: number; y: number; giro: number
  /** hash cru 0..1 pra resolver espécie DEPOIS do carregamento (ver cabeçalho) */
  tEspecie: number
  /** hash cru 0..1 pra resolver a escala dentro da faixa da espécie sorteada */
  tEsc: number
}

/** distância ao segmento de pista mais próximo, reusando `PISTAS_MUNDO`
 *  (a mesma tabela que `corteDePistaAt` já monta) para não plantar árvore em
 *  cima da fita nem do talude dela. */
function distanciaAPistaMaisProxima(x: number, z: number): number {
  let melhor = Infinity
  for (const pista of PISTAS_MUNDO) {
    const pts = pista.pontos
    for (let i = 0; i < pts.length - 1; i++) {
      const ax = pts[i].x, azp = pts[i].z, bx = pts[i + 1].x, bz = pts[i + 1].z
      const dx = bx - ax, dz = bz - azp
      const lenSq = dx * dx + dz * dz || 1
      let t = ((x - ax) * dx + (z - azp) * dz) / lenSq
      t = t < 0 ? 0 : t > 1 ? 1 : t
      const px = ax + dx * t, pz = azp + dz * t
      const d = Math.hypot(x - px, z - pz)
      if (d < melhor) melhor = d
      if (melhor < pista.meiaLargura) return melhor // já colou, não precisa continuar
    }
  }
  return melhor
}

/**
 * O laço de verdade: varre a grade inteira e chama `aoAchar` pra cada
 * candidato que passa em todos os filtros. Cede pelo relógio (mesmo padrão
 * de `emFatias`/`porIndice` em `obra.ts`/`park.ts`: contagem fixa dá fatia de
 * 2 ms num trecho e 900 ms no seguinte, ceder por tempo não).
 *
 * ⚠️ EXTRAÍDO EM 03/09 (frente carregamento) PRA TER UMA VERSÃO QUE CEDE.
 * MEDIDO OFFLINE (Node, `heightAt` sintético): 775 ms cold pra varrer a grade
 * inteira — o item mais caro deste módulo fora do parse de GLB (ver o
 * cabeçalho). `gerarCandidatosFloresta` (abaixo) chama isto e roda até o
 * fim de uma vez, MESMO COMPORTAMENTO de sempre; `invernoComoTrabalho` usa
 * este gerador direto, cedendo, pra nunca travar um quadro com o laço.
 */
function* varrerCandidatosFloresta(
  heightAt: (x: number, z: number) => number,
  aoAchar: (c: CandidatoFloresta) => void,
  msPorFatia = 4,
): Tarefa {
  const passos = Math.ceil((R_QUEDA - R_PE + 200) / FLORESTA_PASSO)
  let t0 = performance.now()
  let n = 0
  for (let ir = 0; ir <= passos; ir++) {
    const r = R_PE - 100 + ir * FLORESTA_PASSO
    if (r < R_PE - 100 || r > R_QUEDA) continue
    // passo angular menor perto do centro pra não desperdiçar amostra, maior
    // longe: mantém a densidade LINEAR (metros entre candidatos) constante
    const passoAz = (FLORESTA_PASSO / r) * (180 / Math.PI)
    for (let az = AZ0 - 8; az <= AZ1 + 8; az += passoAz) {
      const jr = (hash2(ir, Math.round(az * 10), 501) - 0.5) * FLORESTA_PASSO * 0.8
      const jaz = (hash2(ir, Math.round(az * 10), 502) - 0.5) * passoAz * 0.8
      const rr = r + jr, azz = az + jaz
      const [x, z] = pontoEmRumo(rr, azz)
      n++
      const zona = zonaEsquiavelAt(x, z)
      if (zona > 0.04) {
        const y = heightAt(x, z)
        const dens = suave01((y - (FLORESTA_BAIXO - FLORESTA_PLUMA)) / (2 * FLORESTA_PLUMA))
          * (1 - suave01((y - (FLORESTA_ALTO - FLORESTA_PLUMA)) / (2 * FLORESTA_PLUMA)))
        if (dens > 0.03 && hash2(ir, Math.round(azz * 10), 503) <= dens) {
          const d = 15
          const dhx = (heightAt(x + d, z) - heightAt(x - d, z)) / (2 * d)
          const dhz = (heightAt(x, z + d) - heightAt(x, z - d)) / (2 * d)
          const inc = (Math.atan(Math.hypot(dhx, dhz)) * 180) / Math.PI
          // ⚠️ NÃO PLANTA DENTRO DA LAGOA, e o teste é de COTA, não de raio: a
          // linha d'água oscila de 122 a 145 m conforme o rumo (ver
          // `LAGOA_RAIO`), então um círculo deixaria árvore com o pé submerso
          // num rumo e um anel pelado no outro. `naLagoa` pergunta se o chão
          // do candidato está abaixo da lâmina, que é a mesma pergunta que a
          // margem responde. O fundo da bacia mede 386 m de cota e a faixa de
          // plantio vai até 550, então sem esta guarda a mata nasceria no leito
          // inteiro no instante em que a água subir.
          if (inc <= FLORESTA_INC_MAX && distanciaAPistaMaisProxima(x, z) >= FLORESTA_FOLGA_PISTA && !naLagoa(x, z, y)) {
            aoAchar({
              x, z, y,
              giro: hash2(ir, Math.round(azz * 10), 506) * Math.PI * 2,
              tEspecie: hash2(ir, Math.round(azz * 10), 504),
              tEsc: hash2(ir, Math.round(azz * 10), 505),
            })
          }
        }
      }
      if (n % 64 === 0 && performance.now() - t0 > msPorFatia) {
        yield
        t0 = performance.now()
      }
    }
  }
}

/** ⚠️ SÍNCRONA, MESMO COMPORTAMENTO DE SEMPRE: roda `varrerCandidatosFloresta`
 *  até o fim de uma vez, sem ceder. Existe pra quem precisa da lista inteira
 *  na hora (compat e testes); `invernoComoTrabalho` usa o gerador direto. */
export function gerarCandidatosFloresta(heightAt: (x: number, z: number) => number): CandidatoFloresta[] {
  const candidatos: CandidatoFloresta[] = []
  const g = varrerCandidatosFloresta(heightAt, (c) => candidatos.push(c))
  while (!g.next().done) { /* roda tudo de uma vez, de propósito */ }
  return candidatos
}

/** uma primitiva do `.glb`: geometria, material e a matriz de mundo do nó que
 *  a carrega DENTRO do modelo (a mesma `local` de `props.ts`, aplicada por
 *  instância em `setMatrixAt`). `tri` fica junto porque o orçamento é
 *  declarado por parte, não estimado depois. */
interface ParteArvore { geo: THREE.BufferGeometry; mat: THREE.Material; local: THREE.Matrix4; tri: number }

/** o modelo inteiro de uma espécie: as partes e a CAIXA medida no GLB
 *  carregado. A caixa não é constante escrita à mão: ela sai de
 *  `computeBoundingBox` das próprias geometrias, e serve pro LOD de longe
 *  ter a mesma silhueta que a malha real que ele substitui (ver `update`
 *  em `instanciarFlorestaDensa`). */
interface MalhaArvore { partes: ParteArvore[]; alturaM: number; larguraM: number; triangulos: number }

/**
 * carrega um `.glb` e devolve TODAS as primitivas dele, prontas pra
 * instanciar. `null` se não achar mesh OU se o carregamento falhar, e falha
 * AGORA GRITA no console (`console.error`), em vez do `.catch(() => null)`
 * silencioso que já custou dois buracos nesta casa no mesmo dia (este módulo
 * e `loadSf`). O chamador ainda decide o que fazer sem a árvore (a espécie
 * perdida é redistribuída entre as que carregaram, ver
 * `instanciarFlorestaDensa`), mas ninguém fica sem SABER.
 *
 * ⚠️ TODAS AS PRIMITIVAS, NÃO A PRIMEIRA, E ESTE É O CONSERTO DA QUEIXA
 * "as sequoias estão sem tronco". O exportador glTF quebra a malha em uma
 * primitiva POR MATERIAL, então `traverse` + "para na primeira malha"
 * guardava um pedaço e jogava o resto fora. `props.ts:381` já tinha resolvido
 * o MESMO bug com uma InstancedMesh por parte ("instanciar só a primeira
 * deixava as palmeiras sem folha e as colunas sem capitel"); este arquivo
 * nunca tinha recebido o padrão.
 *
 * MEDIDO OFFLINE (Node 20, decodificação dos GLB no nível de accessor glTF,
 * sem abrir navegador), o que a linha antiga guardava de cada arquivo:
 *
 *   tree-pine.glb   4 primitivas (11 / 37 / 234 / 2.917 tri)   ficava com 11 = 0,3%
 *   sq-small-1.glb  2 primitivas (folha MASK 1.676, tronco 860) ficava com 66,1%
 *   sq-med-*.glb    2 primitivas (folha MASK 1.928, tronco 860) ficava com 69,2%
 *   sq-big-*.glb    2 primitivas (folha MASK 1.928, tronco 860) ficava com 69,2%
 *   sq-rh.glb       2 primitivas (1.851 + arbusto MASK 1.488)   ficava com 55,4%
 *
 * Em 8 dos 9 `sq-*.glb` a FOLHA vem primeiro e o TRONCO era descartado; o
 * pinheiro, que é metade da floresta, era desenhado com 0,3% do modelo.
 *
 * ⚠️ MATERIAL POR PARTE, NÃO UNIFICADO: a folha é `alphaMode: MASK` (o
 * `GLTFLoader` traduz isso pra `alphaTest`) e o tronco é opaco. Juntar os dois
 * num material só devolveria folha quadrada ou tronco furado. Cada parte fica
 * com o material que veio do arquivo.
 *
 * ⚠️ `local` VEM DE `matrixWorld`, não da identidade: hoje os 10 arquivos têm
 * um nó só, sem transform (medido no mesmo laudo acima), mas o conversor de
 * Sketchfab pode passar a emitir hierarquia a qualquer momento, e aí a parte
 * com transform próprio nasceria fora de lugar. `updateMatrixWorld(true)`
 * antes do `traverse` é o que torna isso verdade agora e depois.
 */
async function carregarInstanciavel(
  gltf: GLTFLoader, especie: EspecieArvore,
): Promise<MalhaArvore | null> {
  try {
    const cena = await comLimiteDeTempo(
      new Promise<THREE.Group>((res, rej) => gltf.load(especie.url, (g) => res(g.scene), undefined, rej)),
      TETO_CARGA, `[inverno] floresta: ${especie.url}`,
    )
    cena.updateMatrixWorld(true)
    const partes: ParteArvore[] = []
    const caixa = new THREE.Box3()
    cena.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh || !m.geometry) return
      const mat = Array.isArray(m.material) ? m.material[0] : m.material
      if (!mat) return
      const geo = m.geometry
      const tri = geo.index ? geo.index.count / 3 : geo.attributes.position.count / 3
      partes.push({ geo, mat: mat as THREE.Material, local: m.matrixWorld.clone(), tri })
      if (!geo.boundingBox) geo.computeBoundingBox()
      if (geo.boundingBox) caixa.union(geo.boundingBox.clone().applyMatrix4(m.matrixWorld))
    })
    if (!partes.length) {
      console.error(`[inverno] floresta: ${especie.url} carregou mas não tem mesh nenhum dentro. Espécie '${especie.id}' fica de fora, redistribuída.`)
      return null
    }
    const tam = caixa.isEmpty() ? new THREE.Vector3(1, 1, 1) : caixa.getSize(new THREE.Vector3())
    return {
      partes,
      alturaM: Math.max(0.01, tam.y),
      larguraM: Math.max(0.01, (tam.x + tam.z) / 2),
      triangulos: Math.round(partes.reduce((s, p) => s + p.tri, 0)),
    }
  } catch (e) {
    console.error(`[inverno] floresta: ${especie.url} NÃO CARREGOU (espécie '${especie.id}'). Ela fica de fora e o peso dela é redistribuído entre as outras; a densidade não cai, só perde essa silhueta. Motivo:`, e)
    return null
  }
}

/**
 * O cone barato de longe (8 triângulos), MESMA forma que `alpino.ts` usa:
 * todas as espécies precisam ler como uma silhueta só quando a câmera está
 * a quilômetros, senão o horizonte ganha costura visível entre elas.
 *
 * ⚠️ A FORMA CONTINUA A MESMA (raio 2,3 m, altura 11,5 m), O TAMANHO É QUE
 * PASSOU A SER ESCALADO POR QUEM USA. Medido offline nas caixas dos 10 GLB
 * (decodificação dos accessors POSITION, sem abrir navegador), a árvore média
 * da tabela `ARVORES`, ponderada pelo peso de sorteio, mede 19,24 m de altura
 * por 11,11 m de largura. O cone nominal tem 11,5 x 4,6: ele desenhava 60% da
 * altura e 42% da largura da árvore que substitui, ou seja ~21% da área de
 * silhueta. Isso, e não a contagem, é o que fazia a mata sumir de longe na
 * chapa de contrato, que é justamente a distância em que TUDO ali é cone.
 * Quem instancia agora escala (ver `ESCALA_CONE_MEDIA` e a escala por espécie
 * em `instanciarFlorestaDensa`), o que custa zero triângulo a mais.
 */
/** o cone nominal, em metros: a MESMA forma de `alpino.ts`, guardada em
 *  constante porque agora ela é o denominador de toda escala de LOD longe. */
const CONE_ALTURA = 11.5
const CONE_LARGURA = 4.6
/** média ponderada das caixas dos 10 GLB de `ARVORES` (19,24 m de altura por
 *  11,11 m de largura), sobre o cone nominal. Medida offline, ver
 *  `geoConeLonge`; só a camada esparsa usa, porque ela sobe sem modelo. */
const ESCALA_CONE_MEDIA = { y: 19.24 / CONE_ALTURA, xz: 11.11 / CONE_LARGURA }

function geoConeLonge(): THREE.BufferGeometry {
  const g = new THREE.ConeGeometry(CONE_LARGURA / 2, CONE_ALTURA, 4, 1, false)
  g.translate(0, CONE_ALTURA / 2, 0)
  const n = g.attributes.position.count
  const cor = new THREE.Color('#3E5140')
  const arr = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) { arr[i * 3] = cor.r; arr[i * 3 + 1] = cor.g; arr[i * 3 + 2] = cor.b }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3))
  return g
}

interface Floresta {
  group: THREE.Group
  triangulos: number
  arvores: number
  update(cam: THREE.Vector3): void
}

/** Descarta geometria e material de tudo dentro de um grupo, depois o
 *  esvazia. A mesma varredura que `buildInverno` fazia no `dispose()`;
 *  virou função porque agora há mais de um grupo pra descartar (a floresta
 *  esparsa some quando a densa sobe, ver `dispararCamadaPerto`). */
function disposeGrupo(group: THREE.Group) {
  group.traverse((k) => {
    const mesh = k as THREE.Mesh
    if (!mesh.isMesh) return
    mesh.geometry?.dispose()
    const mat = mesh.material as THREE.Material | THREE.Material[]
    if (Array.isArray(mat)) mat.forEach((m) => m.dispose()); else mat?.dispose?.()
  })
  group.clear()
}

/**
 * REDE: as 10 espécies de árvore (`ARVORES`). Falha PARCIAL não é erro: quem
 * não carregar fica de fora e o peso dela é redistribuído entre as outras
 * (ver `instanciarFlorestaDensa`); falha TOTAL devolve lista vazia e a
 * camada perto sobe sem floresta real (a esparsa, cone-only, continua de
 * pé, ver "ACHADO 3" no cabeçalho).
 */
async function carregarEspeciesArvore(
  gltf: GLTFLoader, enxuto: boolean,
): Promise<{ especie: EspecieArvore; malha: MalhaArvore }[]> {
  // ⚠️ O ELENCO É ESCOLHIDO ANTES DA REDE, não depois: no perfil enxuto os seis
  // arquivos que não entram nem são BAIXADOS (1.154 KB e 6 parses de Draco a
  // menos). Filtrar depois de carregar economizaria triângulo e não economizaria
  // nem rede nem memória, que é o que dói no celular. Ver `EspecieArvore.noEnxuto`.
  const elenco = enxuto ? ARVORES.filter((a) => a.noEnxuto) : ARVORES
  // ⚠️ EM FILA DE DOIS, NÃO TODAS DE UMA VEZ. Com `Promise.all` as onze espécies
  // disparavam juntas no instante em que o portão abre, que é o instante em que
  // a `Obra` está fatiando parque, chalé, monumentos e adereços. O worker do
  // Draco termina, mas o CALLBACK precisa da thread principal, e onze callbacks
  // disputando uma thread ocupada é uma fila em que ninguém chega.
  //
  // Medido em 06/09, na conferência de chapa: com teto de 8 s falhavam as 11;
  // subindo o teto para 45 s passaram 3 (entre elas o pinheiro, que é metade da
  // floresta) e falharam 8. Ou seja não era o teto, era a CONCORRÊNCIA: quem
  // chega primeiro passa, o resto morre de fome esperando a thread.
  //
  // Em fila de dois, cada carga pega a thread por vez e termina bem dentro do
  // teto. O tempo total de parede cresce, e não custa nada: a floresta sobe
  // FORA da fila da cidade (ver "FORA DE `daCidade`" em `plaza-scene.tsx`), o
  // visitante já está andando pela praça enquanto ela carrega.
  const carregadas: (MalhaArvore | null)[] = new Array(elenco.length).fill(null)
  let proxima = 0
  async function trabalhador() {
    for (;;) {
      const i = proxima++
      if (i >= elenco.length) return
      carregadas[i] = await carregarInstanciavel(gltf, elenco[i])
    }
  }
  await Promise.all([trabalhador(), trabalhador()])
  const vivas = elenco
    .map((esp, i) => ({ especie: esp, malha: carregadas[i] }))
    .filter((v): v is { especie: EspecieArvore; malha: MalhaArvore } => v.malha !== null)
  if (vivas.length === 0) {
    console.error('[inverno] floresta: NENHUMA espécie carregou. A camada perto sobe sem árvore real; a esparsa (cone) continua de pé.')
  } else if (vivas.length < elenco.length) {
    console.warn(`[inverno] floresta: subiu com ${vivas.length}/${elenco.length} espécies (ver os erros acima por nome de arquivo).`)
  }
  return vivas
}

/** REDE: o pacote de rochas, cru (só o par geo/mat do primeiro mesh achado).
 *  `null` sem `gltf`, se o `.glb` falhar, ou se não tiver mesh dentro.
 *
 *  ⚠️ AQUI "PRIMEIRO MESH" NÃO É O DEFEITO QUE `carregarInstanciavel` acabou de
 *  consertar, E ISSO FOI MEDIDO, não suposto: `rocks-stylized-pack.glb` tem UMA
 *  primitiva só (3.076 triângulos, material `RocksStylized_M`, opaco), então o
 *  primeiro mesh É o modelo inteiro. Se o pacote de rocha for trocado por um
 *  arquivo de vários materiais, este caminho passa a jogar peça fora igual ao
 *  outro, e aí a correção é a mesma: uma `InstancedMesh` por parte. */
async function carregarPacoteRochas(gltf?: GLTFLoader): Promise<{ geo: THREE.BufferGeometry; mat: THREE.Material } | null> {
  if (!gltf) {
    console.warn('[inverno] sem `gltf`: sem penhasco de verdade, só a cor de rocha do vértice.')
    return null
  }
  try {
    const cena = await comLimiteDeTempo(
      new Promise<THREE.Group>((res, rej) => gltf.load('/city/sf/rocks-stylized-pack.glb', (g) => res(g.scene), undefined, rej)),
      TETO_CARGA, '[inverno] penhascos (rocks-stylized-pack.glb)',
    )
    let malha: THREE.Mesh | null = null
    cena.traverse((k) => { if (!malha && (k as THREE.Mesh).isMesh) malha = k as THREE.Mesh })
    if (!malha) {
      console.error('[inverno] rocks-stylized-pack.glb carregou mas não tem mesh dentro. Sem penhasco.')
      return null
    }
    return { geo: (malha as THREE.Mesh).geometry, mat: (malha as THREE.Mesh).material as THREE.Material }
  } catch (e) {
    console.error('[inverno] penhascos (rocks-stylized-pack.glb) NÃO CARREGARAM. A face fica só com a cor de rocha, sem volume.', e)
    return null
  }
}

/**
 * A CAMADA LONGE da floresta: um recorte por PASSO dos MESMOS candidatos que
 * a densa vai usar depois (mesma posição, mesma seleção de onde plantar —
 * não uma segunda grade, não um segundo `heightAt`), só CONE (8 triângulos),
 * sem depender de `gltf` nem de espécie nenhuma carregada. Sempre construída
 * pela camada longe, nunca some sozinha (só é trocada pela densa quando a
 * camada perto termina, ver `dispararCamadaPerto`).
 *
 * ⚠️ O TETO PASSOU DE 220 PARA TODO MUNDO (ver `FLORESTA_TETO_LONGE`), então o
 * "CPU tão barata (≤300 itens)" do comentário antigo precisa de número novo:
 * medido offline (Node 20, `THREE.Matrix4` de verdade, 5.671 itens, média de
 * 20 repetições), o laço de matriz custa 0,80 ms. Continua sendo função comum,
 * não geradora: 0,80 ms cabe num quadro de 16,7 ms com folga, e esta camada
 * roda UMA vez.
 */
function construirFlorestaEsparsa(candidatos: CandidatoFloresta[], teto: number): Floresta {
  const passo = Math.max(1, Math.ceil(candidatos.length / teto))
  const amostra = candidatos.filter((_, i) => i % passo === 0)
  const geo = geoConeLonge()
  const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: 0.95, flatShading: true })
  const inst = new THREE.InstancedMesh(geo, mat, Math.max(1, amostra.length))
  inst.name = 'inverno:floresta:esparsa'
  inst.castShadow = false
  inst.frustumCulled = false
  const m4 = new THREE.Matrix4(), vp = new THREE.Vector3(), vq = new THREE.Quaternion(), ve = new THREE.Euler()
  // ⚠️ ESCALA MÉDIA, NÃO 1. Esta camada sobe ANTES de qualquer `.glb` chegar,
  // então ela não tem a caixa medida de espécie nenhuma pra consultar: usa a
  // média ponderada de `ARVORES` (19,24 m x 11,11 m, medida offline nos 10
  // arquivos, ver `geoConeLonge`) sobre o cone nominal de 11,5 x 4,6.
  const escalaMedia = new THREE.Vector3(ESCALA_CONE_MEDIA.xz, ESCALA_CONE_MEDIA.y, ESCALA_CONE_MEDIA.xz)
  for (let i = 0; i < amostra.length; i++) {
    const c = amostra[i]
    vp.set(c.x, c.y, c.z)
    ve.set(0, c.giro, 0)
    vq.setFromEuler(ve)
    m4.compose(vp, vq, escalaMedia)
    inst.setMatrixAt(i, m4)
  }
  inst.count = amostra.length
  inst.instanceMatrix.needsUpdate = true
  inst.computeBoundingSphere()
  const group = new THREE.Group()
  group.name = 'inverno:floresta:esparsa:grupo'
  group.add(inst)
  const triUnit = geo.index ? geo.index.count / 3 : geo.attributes.position.count / 3
  return { group, triangulos: Math.round(amostra.length * triUnit), arvores: amostra.length, update() { /* sempre cone, nunca troca de LOD sozinha */ } }
}

/**
 * A CAMADA PERTO da floresta: a malha real das espécies vivas, instanciada
 * pros `candidatosBase` inteiros (5.637 medidos hoje), com
 * `FLORESTA_TETO_PERTO` = 450 delas em malha real e o resto no balde de cone
 * interno. Três coisas mudaram em 04/09 e estão explicadas onde acontecem:
 * uma `InstancedMesh` POR PARTE do modelo (o tronco existir), o cone de longe
 * com a silhueta da espécie que ele substitui, e as 450 de perto sendo as
 * MAIS PRÓXIMAS da câmera em vez de um sorteio fixo. Escreve o resultado em
 * `saida.floresta`, padrão de
 * `constroiParque` em `park.ts` (gerador não pode `return` valor com
 * `--downlevelIteration` desligado; `saida` sai da mesma forma sem depender
 * disso).
 */
function* instanciarFlorestaDensa(
  vivas: { especie: EspecieArvore; malha: MalhaArvore }[],
  candidatosBase: CandidatoFloresta[],
  sombra: boolean,
  /** teto de árvores em malha real, POR PERFIL DE APARELHO (ver `orcamentoPerto`) */
  teto: number,
  saida: { floresta: Floresta | null },
): Tarefa {
  const pesoTotal = vivas.reduce((s, v) => s + v.especie.peso, 0)
  const cumulativo: { ateT: number; idx: number }[] = []
  let acc = 0
  for (let i = 0; i < vivas.length; i++) { acc += vivas[i].especie.peso / pesoTotal; cumulativo.push({ ateT: acc, idx: i }) }
  const resolverEspecie = (t: number): number => {
    for (const c of cumulativo) if (t <= c.ateT) return c.idx
    return cumulativo.length - 1
  }

  const candidatos: (CandidatoFloresta & { especieIdx: number })[] = []
  for (const it = emFatias(candidatosBase, (c) => candidatos.push({ ...c, especieIdx: resolverEspecie(c.tEspecie) })); !it.next().done; ) yield

  // ⚠️ O TETO DE PERTO DEIXOU DE SER UM SORTEIO FIXO, 04/09, E ISSO É A QUEIXA
  // "vegetação completamente esparsa" VISTA DE DENTRO. Antes, 450 candidatos
  // eram escolhidos POR HASH, uma vez, e só eles podiam virar malha real; os
  // outros ficavam cone para sempre, inclusive a 30 m do visitante. Medido com
  // a floresta de hoje (5.637 candidatos), isso quer dizer que 92% das árvores
  // ao redor de quem está DENTRO do maciço eram pirâmides de 8 triângulos.
  // Nenhum aumento de teto conserta isso: o problema não era quantas, era
  // QUAIS. Agora o teto é um ORÇAMENTO e quem entra nele são as MAIS PERTO da
  // câmera, decidido a cada `update` (ver o histograma lá embaixo). Mesmo custo
  // de triângulo, densidade percebida completamente diferente.
  //
  // ⚠️ A CAPACIDADE POR ESPÉCIE SAI DO PESO, NÃO DA CONTAGEM DO SORTEIO, porque
  // a mistura das N mais próximas varia com o lugar da câmera. `FOLGA_CAP` de
  // 1,5 cobre essa variação: para o pinheiro (peso 0,50) o esperado entre 450
  // são 225 e a capacidade fica em 338. O custo dessa folga é buffer de
  // matriz, não triângulo desenhado (`count` é o que a GPU paga), e o buffer
  // inteiro dá ~90 KB.
  yield

  const group = new THREE.Group()
  group.name = 'inverno:floresta:densa'
  let triangulos = 0

  // ⚠️ UMA `InstancedMesh` POR PARTE DO MODELO, não por espécie: é o padrão de
  // `props.ts:381` trazido pra cá (ver `carregarInstanciavel`). Todas as partes
  // de uma espécie recebem a MESMA lista de posições, cada uma multiplicada
  // pela matriz da parte dentro do modelo, então o tronco e a folha andam
  // juntos. Custo de chamada de desenho, medido nos arquivos de hoje: 4 partes
  // no pinheiro e 2 em cada uma das outras 9 = 22 malhas onde antes eram 10.
  const instPerto: (THREE.InstancedMesh[] | null)[] = new Array(vivas.length).fill(null)
  const capPerto: number[] = new Array(vivas.length).fill(0)
  for (const it = emFatias(vivas, (v, i) => {
    const cap = Math.min(
      candidatos.length,
      Math.max(4, Math.ceil((teto * v.especie.peso / pesoTotal) * FOLGA_CAP)),
    )
    capPerto[i] = cap
    const malhas: THREE.InstancedMesh[] = []
    v.malha.partes.forEach((parte, p) => {
      const inst = new THREE.InstancedMesh(parte.geo, parte.mat, cap)
      inst.name = `inverno:floresta:${v.especie.id}:perto:${p}`
      inst.castShadow = sombra
      inst.frustumCulled = false
      inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      group.add(inst)
      // ⚠️ O ORÇAMENTO DECLARADO É O QUE A GPU PAGA, não o que o buffer aloca:
      // `count` nunca passa do `teto` do perfil somado sobre as espécies, então
      // a conta usa a fatia ESPERADA da espécie, não a capacidade com folga.
      // Alocar a mais custa memória de matriz, não triângulo.
      triangulos += parte.tri * (teto * v.especie.peso / pesoTotal)
      malhas.push(inst)
    })
    instPerto[i] = malhas
  }); !it.next().done; ) yield

  const geoLonge = geoConeLonge()
  const matLonge = new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: 0.95, flatShading: true })
  const longe = new THREE.InstancedMesh(geoLonge, matLonge, Math.max(1, candidatos.length))
  longe.name = 'inverno:floresta:longe-lod'
  longe.castShadow = false
  longe.frustumCulled = false
  longe.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  group.add(longe)
  const triLonge = geoLonge.index ? geoLonge.index.count / 3 : geoLonge.attributes.position.count / 3
  triangulos += candidatos.length * triLonge // pior caso: todo mundo no balde de longe
  yield

  const m4 = new THREE.Matrix4(), mParte = new THREE.Matrix4()
  const vp = new THREE.Vector3(), vq = new THREE.Quaternion()
  const ve = new THREE.Euler(), vs = new THREE.Vector3()

  // ⚠️ O CONE DE LONGE PASSA A TER A SILHUETA DA ESPÉCIE QUE ELE SUBSTITUI.
  // A caixa vem medida do próprio GLB (`carregarInstanciavel`), então a troca
  // de LOD não muda mais o tamanho da árvore: antes um pinheiro de 10,97 m por
  // 12,79 m virava um cone de 11,5 m por 4,6 m ao cruzar `FLORESTA_R_CHEIA`, e
  // uma sequoia de 39,96 m encolhia pra 11,5 m. Escala NÃO uniforme de
  // propósito (largura e altura têm razões diferentes), e custa zero triângulo.
  const escalaLonge = vivas.map((v) => ({
    y: v.malha.alturaM / CONE_ALTURA,
    xz: v.malha.larguraM / CONE_LARGURA,
  }))

  // histograma radial reusado a cada quadro (sem alocar): ver `update`
  const BINS = 48
  const histo = new Int32Array(BINS)

  const update = (cam: THREE.Vector3) => {
    const contagens = new Array(vivas.length).fill(0)
    let nLonge = 0
    // ⚠️ PASSO 1, O CORTE POR DISTÂNCIA. Histograma de 48 anéis até
    // `FLORESTA_R_CHEIA` e soma acumulada até estourar o teto do perfil:
    // devolve o raio em que cabem ~`teto` árvores. É O(n) com aritmética
    // inteira, sem ordenar nada (ordenar 5.637 por quadro seria o caminho
    // óbvio e o caro), e custa 0,164 ms por quadro medidos offline com a
    // contagem real de 5.637. O raio anda macio com a câmera, então a troca
    // de LOD continua acontecendo por distância, como sempre aconteceu.
    histo.fill(0)
    const largura = FLORESTA_R_CHEIA / BINS
    for (const c of candidatos) {
      const d = Math.hypot(c.x - cam.x, c.z - cam.z)
      if (d < FLORESTA_R_CHEIA) histo[Math.min(BINS - 1, (d / largura) | 0)]++
    }
    let soma = 0
    // piso de um anel: se o primeiro anel sozinho já estourasse o teto (uma
    // moita densa colada na câmera), sem isto o corte seria 0 e QUEM ESTÁ
    // DENTRO DA MATA veria só cone, que é o defeito que este bloco existe pra
    // consertar. O `capPerto` por espécie segura o excesso de qualquer jeito.
    let corte = largura
    for (let b = 0; b < BINS; b++) {
      if (soma + histo[b] > teto) break
      soma += histo[b]
      corte = (b + 1) * largura
    }
    for (const c of candidatos) {
      const d = Math.hypot(c.x - cam.x, c.z - cam.z)
      const perto = d < corte && contagens[c.especieIdx] < capPerto[c.especieIdx]
      const especie = vivas[c.especieIdx].especie
      const esc = especie.escMin + c.tEsc * (especie.escMax - especie.escMin)
      vp.set(c.x, c.y, c.z)
      ve.set(0, c.giro, 0)
      vq.setFromEuler(ve)
      const malhas = perto ? instPerto[c.especieIdx] : null
      if (malhas) {
        vs.set(esc, esc, esc)
        m4.compose(vp, vq, vs)
        const k = contagens[c.especieIdx]++
        const partes = vivas[c.especieIdx].malha.partes
        for (let p = 0; p < malhas.length; p++) {
          mParte.multiplyMatrices(m4, partes[p].local)
          malhas[p].setMatrixAt(k, mParte)
        }
      } else {
        const e = escalaLonge[c.especieIdx]
        vs.set(esc * e.xz, esc * e.y, esc * e.xz)
        m4.compose(vp, vq, vs)
        longe.setMatrixAt(nLonge++, m4)
      }
    }
    for (let i = 0; i < vivas.length; i++) {
      const malhas = instPerto[i]
      if (!malhas) continue
      for (const inst of malhas) {
        inst.count = contagens[i]
        inst.instanceMatrix.needsUpdate = true
      }
    }
    longe.count = nLonge
    longe.instanceMatrix.needsUpdate = true
  }
  update(new THREE.Vector3(0, 0, 0))
  for (const malhas of instPerto) malhas?.forEach((inst) => inst.computeBoundingSphere())
  longe.computeBoundingSphere()

  saida.floresta = { group, triangulos: Math.round(triangulos), arvores: candidatos.length, update }
}

interface CandidatoRocha { x: number; z: number; y: number; esc: number; giro: number }

/**
 * A grade dos penhascos, extraída de dentro de `buildInverno` em 03/09 pra
 * ceder (mesmo padrão de `varrerCandidatosFloresta`): ~4.500 células no pior
 * caso (arco de 50° entre `R_PE` e `R_QUEDA`, passo de 45 m), cada uma com
 * até 3 chamadas de `heightAt`. NÃO MEDIDO em separado (a soma do módulo
 * inteiro está no cabeçalho), mas é a mesma FAMÍLIA de laço que a floresta,
 * então cede pelo mesmo relógio, por precaução.
 */
function* varrerCandidatosRocha(
  heightAt: (x: number, z: number) => number,
  aoAchar: (c: CandidatoRocha) => void,
  msPorFatia = 4,
): Tarefa {
  const passos = Math.ceil((R_QUEDA - R_PE) / 45)
  let t0 = performance.now()
  let n = 0
  for (let ir = 0; ir <= passos; ir++) {
    const r = R_PE + ir * 45
    const passoAz = (45 / r) * (180 / Math.PI)
    for (let az = AZ0 - 5; az <= AZ1 + 5; az += passoAz) {
      const jr = (hash2(ir, Math.round(az * 10), 601) - 0.5) * 45 * 0.8
      const jaz = (hash2(ir, Math.round(az * 10), 602) - 0.5) * passoAz * 0.8
      const rr = r + jr, azz = az + jaz
      const [x, z] = pontoEmRumo(rr, azz)
      n++
      const zona = zonaEsquiavelAt(x, z)
      if (zona > 0.05) {
        const y = heightAt(x, z)
        const d = 15
        const dhx = (heightAt(x + d, z) - heightAt(x - d, z)) / (2 * d)
        const dhz = (heightAt(x, z + d) - heightAt(x, z - d)) / (2 * d)
        const inc = (Math.atan(Math.hypot(dhx, dhz)) * 180) / Math.PI
        // só nas faces expostas (a mesma faixa da rocha exposta), e um pouco
        // além, pra ancorar visualmente o pé do penhasco também
        // mesma guarda da floresta: pedra dentro da lâmina vira pedra boiando
        // assim que a água subir (ver `naLagoa`)
        if (inc >= 28 && pistaProximidade01(x, z) <= 0.15 && !naLagoa(x, z, y) && hash2(ir, Math.round(azz * 10), 603) <= 0.35) {
          aoAchar({
            x, z, y,
            esc: 0.6 + hash2(ir, Math.round(azz * 10), 604) * 1.2,
            giro: hash2(ir, Math.round(azz * 10), 605) * Math.PI * 2,
          })
        }
      }
      if (n % 64 === 0 && performance.now() - t0 > msPorFatia) { yield; t0 = performance.now() }
    }
  }
}

/** ⚠️ OS PENHASCOS: rocha espalhada de verdade, não só cor de vértice.
 *  Segunda técnica do fundador pra atacar "parece bloco repetido", e a mais
 *  barata das três (ele mesmo disse): mesmo com o relevo vindo de scan
 *  real, uma silhueta 100% lisa nas encostas ainda lê como escultura. O
 *  pacote (`rocks-stylized-pack.glb`, CC-BY, PolyOne Studio) virou UM mesh
 *  só na conversão (o Blender uniu as peças do pack), então cada instância
 *  aqui é um agrupamento pequeno de pedras, não uma pedra igual repetida:
 *  ESCALA e GIRO por instância ainda variam, o que evita ler como carimbo. */
const TETO_ROCHA = 140

function* instanciarPenhascos(
  geoRocha: THREE.BufferGeometry, matRocha: THREE.Material,
  candidatosRocha: CandidatoRocha[], sombra: boolean,
  /** teto de instâncias, POR PERFIL DE APARELHO (ver `orcamentoPerto`) */
  teto: number,
  saida: { mesh: THREE.InstancedMesh | null; triangulos: number },
): Tarefa {
  let usar = candidatosRocha
  if (candidatosRocha.length > teto) {
    const manter = teto / candidatosRocha.length
    usar = candidatosRocha.filter((_, i) => hash01(i * 2654435761 + 17) < manter)
  }
  yield
  const inst = new THREE.InstancedMesh(geoRocha, matRocha, Math.max(1, usar.length))
  inst.name = 'inverno:penhascos'
  inst.castShadow = sombra
  inst.receiveShadow = true
  inst.frustumCulled = false
  const m4r = new THREE.Matrix4(), vpr = new THREE.Vector3(), vqr = new THREE.Quaternion(), ver = new THREE.Euler(), vsr = new THREE.Vector3()
  for (const it = emFatias(usar, (c, i) => {
    vpr.set(c.x, c.y, c.z)
    ver.set(0, c.giro, 0)
    vqr.setFromEuler(ver)
    vsr.set(c.esc, c.esc, c.esc)
    m4r.compose(vpr, vqr, vsr)
    inst.setMatrixAt(i, m4r)
  }); !it.next().done; ) yield
  inst.count = usar.length
  inst.instanceMatrix.needsUpdate = true
  inst.computeBoundingSphere()
  const triRocha = geoRocha.index ? geoRocha.index.count / 3 : geoRocha.attributes.position.count / 3
  saida.mesh = inst
  saida.triangulos = Math.round(triRocha * usar.length)
}

/** ⚠️ TETO DA CAMADA LONGE, dentro da faixa pedida (150 a 300): o maciço
 *  cobre um arco de 40° entre r 7.150 e 8.650, visto da praça a ~8 km de
 *  distância — cada árvore da silhueta cobre um ângulo minúsculo daquele
 *  arco, então 220 pontos bem espalhados (reaproveitando o MESMO sorteio de
 *  posição da floresta cheia, por passo, não uma segunda grade) bastam pra
 *  quebrar a sensação de "montanha pelada". ERRADO, E MEDIDO ERRADO EM 04/09:
 *  são 5.637 candidatos, e 220 deles é UMA ÁRVORE A CADA 236 m numa cunha de
 *  12,28 km². Isso não é "silhueta quebrada", é savana, e é literalmente o que
 *  a chapa de contrato fotografa toda vez que a câmera está além de
 *  `INVERNO_R_DET` (a camada densa nem chegou a existir). O teto novo é maior
 *  que a contagem de candidatos DE PROPÓSITO: a camada esparsa passa a levar
 *  todo mundo. O preço é 5.637 × 8 = 45.096 triângulos (contra 1.760), ou
 *  1,2% da praça, e 0,80 ms de CPU no laço de matriz (medido offline, Node 20
 *  com o `THREE.Matrix4` de verdade, 20 repetições com 5.671 itens), ainda barato o bastante
 *  para não precisar ceder em fatias. Ver "ACHADO 3" no cabeçalho.
 *
 *  ⚠️ 6.000 -> 8.000 EM 04/09 (obra 2), E ESTE TETO TINHA ACABADO DE VIRAR UMA
 *  ARMADILHA. `construirFlorestaEsparsa` amostra por PASSO
 *  (`ceil(candidatos / teto)`), então ele não corta o excedente: ele PULA DE UM
 *  EM UM assim que a contagem passa do teto. A bacia da lagoa (516 candidatos
 *  novos na pegada dela, medidos) levou a floresta de 5.637 para 6.340
 *  candidatos, e com o teto em 6.000 o passo viraria 2, ou seja a camada
 *  esparsa cairia para 3.170 cones: METADE da mata, e justamente na camada que
 *  TODA chapa de contrato fotografa. 8.000 recoloca o passo em 1 e ainda deixa
 *  folga para a próxima feição.
 *
 *  ⚠️ E O CONE CUSTA 12 TRIÂNGULOS, NÃO 8. O "8 tri cada" repetido nos
 *  comentários desta seção desde 03/09 é conta de papel; medido na geometria de
 *  verdade (`geoConeLonge().index.count / 3`, offline), `ConeGeometry(2,3;
 *  11,5; 4, 1, false)` emite 8 triângulos de flanco mais 4 de tampa = 12. A
 *  camada esparsa de hoje mede, então, 6.340 × 12 = 76.080 triângulos numa
 *  chamada de desenho só (1,96% da praça), e o grupo inteiro da camada longe
 *  mede 78.348. Os dois números saem do objeto construído, não da fórmula. */
const FLORESTA_TETO_LONGE = 8000

/** ⚠️ 4.000 -> 6.000 EM 04/09, E O NÚMERO SAI DAS CHAPAS DE CONTRATO, não de
 *  gosto. `INVERNO_R_DET` é medido a partir de (`INVERNO_CX`, `INVERNO_CZ`) =
 *  r 7.800, azimute 268, que é (-7.795, 272). Distâncias medidas das câmeras
 *  de `scripts/city/chapas.mjs` até esse ponto:
 *
 *    inverno    câmera (-3.800, 400)    3.997 m   passava por 3 m
 *    silhueta   câmera (-3.220,  54)    4.580 m   NÃO passava
 *    florestaolho (-7.096, -248)          871 m   passava
 *
 *  Ou seja a chapa de contrato da CADEIA INTEIRA nunca via a camada perto:
 *  nem floresta densa, nem penhasco, nem estação. E a chapa `inverno` passava
 *  por três metros, o que é sorte, não projeto. 6.000 m cobre as duas com
 *  folga e continua muito abaixo do raio de descarte do grupo inteiro
 *  (26.000 m, `culler?.add` abaixo), então o gatilho nunca dispara depois que
 *  o parque já teria sumido por distância. Ver "ACHADO 3" no cabeçalho. */
const INVERNO_R_DET = 6000
const [INVERNO_CX, INVERNO_CZ] = pontoEmRumo(7800, 268)

/**
 * REDE: tudo que `invernoComoTrabalho` precisa antes de começar a construir,
 * numa função só (mesmo formato de `baixaAtivos` em `park.ts`). Dispara
 * também `carregarRelevo()` (o fetch dos dois JSON de relevo, que serve
 * `terrain.ts`/`alpino.ts`, não o parque em si — ver a nota "ACHADO 1" no
 * cabeçalho): não é `await`ado aqui, é best-effort em paralelo, porque o
 * parque não depende dele pra nada (usa o `heightAt` que já vem pronto de
 * fora).
 */
interface AtivosDoInverno {
  arvores: { especie: EspecieArvore; malha: MalhaArvore }[]
  rochas: { geo: THREE.BufferGeometry; mat: THREE.Material } | null
}

// ⚠️ A ESTAÇÃO DEIXOU DE SER UM `.glb` CRU BUSCADO AQUI, 03/09. A frente
// dedicada de estação entregou `buildEstacaoInverno` (chalé, bilheteria,
// canhão de neve, cerca, rede, cabines no cabo, placa), que já resolve a
// própria rede de vários `.glb` e não precisa entrar em `Promise.all` com o
// resto: ela é disparada dentro de `dispararCamadaPerto`, fire-and-forget,
// e substitui a caixa placeholder quando terminar (ver lá embaixo).
async function baixaAtivosInverno(o: InvernoOpts, orc: OrcamentoPerto): Promise<AtivosDoInverno> {
  void carregarRelevo()
  const [arvores, rochas] = await Promise.all([
    o.gltf ? carregarEspeciesArvore(o.gltf, orc.enxuto) : Promise.resolve([]),
    carregarPacoteRochas(o.gltf),
  ])
  return { arvores, rochas }
}

// ═══════════════════════════════════════════════════════════════════════════
// O PORTÃO DA REDE DO PARQUE. Ver "QUANDO COMEÇAR A REDE" no cabeçalho: a
// rede do parque (os 2 JSON de relevo real e os 12 `.glb`) fica suspensa até
// `abrirPortaoInverno()` ser chamado, e a única chamada dela deve ficar em
// `plaza-scene.tsx`, dentro de `stepDone`, no mesmo instante em que o portão
// da CIDADE abre (`pronto` vira `true`). Isto evita que os fetches do parque
// compitam por conexão HTTP com os fetches que ainda estão segurando a tela
// de carga (chalé, monumentos, parque, adereços, fundadores, galeria).
// ═══════════════════════════════════════════════════════════════════════════
let resolverPortaoInverno: (() => void) | null = null
const portaoInvernoAberto = new Promise<void>((res) => { resolverPortaoInverno = res })

/** Chame quando o portão da cidade abrir. Chamar mais de uma vez não tem
 *  efeito (resolver uma Promise já resolvida é no-op); chamar sem nunca ter
 *  `?inverno=1` também não tem efeito (a rede nem existe pra liberar, ver
 *  `invernoComoTrabalho`). */
export function abrirPortaoInverno() { resolverPortaoInverno?.() }

/** O parque de inverno como peça da `Obra`, no mesmo espírito de
 *  `parkComoTrabalho` (`park.ts`). O grupo nasce vazio e some visível=false
 *  até a camada longe terminar; `parque` reflete o estado corrente. */
export interface InvernoTrabalho extends Trabalho {
  readonly group: THREE.Group
  readonly parque: Inverno | null
}

/**
 * O parque de inverno inteiro, como `Trabalho`. Ver "ACHADO 2" e "ACHADO 3"
 * no cabeçalho pro raciocínio completo; aqui só a forma.
 *
 * Uso: `const t = await invernoComoTrabalho({...}); scene.add(t.group);
 * obra.põe(t)` — IDÊNTICO ao uso de `parkComoTrabalho`. `aoPronto` dispara
 * quando a CAMADA LONGE termina (pistas, halfpipe, teleféricos, vila-caixa,
 * floresta esparsa): é a hora de revelar o grupo. A CAMADA PERTO (floresta
 * densa, penhascos, estação em detalhe) sobe depois, sozinha, quando a
 * câmera cruza `INVERNO_R_DET` — sem aviso, sem segurar nada, ela só troca
 * de conteúdo por baixo do visitante enquanto ele já está lá.
 */
export async function invernoComoTrabalho(
  o: InvernoOpts & { aoPronto?: (parque: Inverno) => void; peso?: number },
): Promise<InvernoTrabalho> {
  const group = new THREE.Group()
  group.name = 'inverno'
  const medidas: Inverno['medidas'] = []

  // ⚠️ DEFESA EM PROFUNDIDADE: sem `?inverno=1` isto devolve na primeira
  // fatia, sem um fetch, sem um triângulo. Quem esquecer de checar a
  // bandeira antes de chamar isto não quebra nada (mesma regra de
  // `terreno-fino.ts`).
  if (!INVERNO_ATIVO) {
    const vazio: Inverno = { group, triangulos: 0, medidas, arvores: 0, update() {}, dispose() { group.clear() } }
    return {
      nome: 'Winter Park', peso: 0, faixa: 2, group,
      get parque() { return vazio },
      *fatia() { o.aoPronto?.(vazio) },
    }
  }

  // ── REDE: suspensa até o portão da cidade abrir, depois dispara tudo em
  // paralelo e decodifica antes de entrar na fila de construção. ──────────
  await portaoInvernoAberto
  // ⚠️ O ORÇAMENTO DA CAMADA PERTO SAI DO `PerfProfile` E É LIDO AQUI, ANTES DA
  // REDE, porque o elenco de espécies (que decide QUANTOS `.glb` baixar) faz
  // parte dele. Ver `orcamentoPerto`.
  const orc = orcamentoPerto(o.profile)
  const ativos = await baixaAtivosInverno(o, orc)

  const saida: { parque: Inverno | null } = { parque: null }
  return {
    nome: 'Winter Park',
    peso: o.peso ?? 14,
    faixa: 2,
    group,
    get parque() { return saida.parque },
    *fatia() {
      // ══ CAMADA LONGE: sempre construída, barata, nunca espera aproximação ══
      let triangulos = 0
      const matFita = new THREE.MeshStandardMaterial({
        vertexColors: true, roughness: 0.9, metalness: 0, polygonOffset: true,
        polygonOffsetFactor: -1, polygonOffsetUnits: -1,
      })
      for (const p of PISTAS) {
        const g = construirFita(p, o.heightAt)
        const mesh = new THREE.Mesh(g, matFita)
        mesh.name = `inverno:pista:${p.nome}`
        mesh.receiveShadow = o.sombra ?? true
        mesh.castShadow = false
        group.add(mesh)
        triangulos += g.index ? g.index.count / 3 : g.attributes.position.count / 3
        const med = medirPista(p, o.heightAt)
        medidas.push({ nome: p.nome, dificuldade: p.dificuldade, ...med })
      }
      yield

      // o halfpipe: no colo entre o ombro sul e o pico principal, já fora da
      // faixa pesada do pódio (r > 8.100, supressão ≤ 17%, ver cabeçalho)
      const gPipe = construirHalfpipe(8220, 261, 264, o.heightAt)
      const matPipe = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.05 })
      const meshPipe = new THREE.Mesh(gPipe, matPipe)
      meshPipe.name = 'inverno:halfpipe'
      meshPipe.receiveShadow = o.sombra ?? true
      group.add(meshPipe)
      triangulos += gPipe.attributes.position.count / 3

      // a vila-base: caixa placeholder até a camada perto trocar pela
      // estação real (`ativos.estacao`, se tiver carregado)
      const matVila = new THREE.MeshStandardMaterial({ color: '#6B5B4A', roughness: 0.85 })
      let vilaMesh: THREE.Mesh | null = null
      {
        const [r, az, largura, altura] = [6920, 273, 30, 12] as const
        const [x, z] = pontoEmRumo(r, az)
        const y = o.heightAt(x, z)
        const geo = new THREE.BoxGeometry(largura, altura, largura * 0.6)
        vilaMesh = new THREE.Mesh(geo, matVila)
        vilaMesh.position.set(x, y + altura / 2, z)
        vilaMesh.rotation.y = (az * Math.PI) / 180
        vilaMesh.name = 'inverno:vila'
        vilaMesh.castShadow = o.sombra ?? true
        vilaMesh.receiveShadow = true
        group.add(vilaMesh)
        triangulos += geo.index ? geo.index.count / 3 : geo.attributes.position.count / 3
      }
      yield

      // os teleféricos: os DOIS vãos saem de `VAOS_TELEFERICO`, a mesma
      // tabela que as cabines de `estacao-inverno.ts` recebem lá embaixo.
      // Ver a nota da constante: antes eram dois pares de números escritos à
      // mão em lugares diferentes, e eles divergiam em 80 e 70 m.
      const v1 = VAOS_TELEFERICO[0], v2 = VAOS_TELEFERICO[1]
      const t1 = construirTeleferico(v1.rBase, v1.azBase, v1.rTopo, v1.azTopo, v1.nPilones, o.heightAt)
      t1.pilones.name = 'inverno:teleferico:principal:pilones'
      t1.cabo.name = 'inverno:teleferico:principal:cabo'
      group.add(t1.pilones, t1.cabo)
      triangulos += t1.triangulos

      const t2 = construirTeleferico(v2.rBase, v2.azBase, v2.rTopo, v2.azTopo, v2.nPilones, o.heightAt)
      t2.pilones.name = 'inverno:teleferico:parque:pilones'
      t2.cabo.name = 'inverno:teleferico:parque:cabo'
      group.add(t2.pilones, t2.cabo)
      triangulos += t2.triangulos
      for (const m of [t1.pilones, t2.pilones]) { m.castShadow = o.sombra ?? true; m.frustumCulled = false }
      yield

      // a grade da floresta inteira (o item mais caro do módulo, 775 ms cold
      // medido no relatório): cedida pelo relógio, os candidatos servem TANTO
      // a floresta esparsa de agora QUANTO a densa de quando a câmera chegar
      // perto, uma varredura só, nunca duas.
      const candidatos: CandidatoFloresta[] = []
      for (const it = varrerCandidatosFloresta(o.heightAt, (c) => candidatos.push(c)); !it.next().done; ) yield

      const florestaEsparsa = construirFlorestaEsparsa(candidatos, FLORESTA_TETO_LONGE)
      group.add(florestaEsparsa.group)
      triangulos += florestaEsparsa.triangulos
      yield

      // ⚠️ INVERNO-DETALHE (corduroy da pista, rastro de esqui, pegada,
      // 2 rochas de granito de destaque) MONTA JÁ NA CAMADA LONGE, e isso é
      // deliberado: o módulo se esconde SOZINHO por um raio próprio de 120 m
      // (ver o cabeçalho dele), bem menor que os 6.000 m de `INVERNO_R_DET`,
      // então esperar pela camada perto só atrasaria o momento em que ele
      // aparece pra quem já estiver perto quando a camada perto disparar. O
      // custo de construção dele é barato (quads + 2 GLB pequenos), não
      // precisa de `Obra`.
      const detalhe = buildInvernoDetalhe({
        heightAt: o.heightAt, zonaEsquiavelAt, gltf: o.gltf, sombra: o.sombra ?? true,
      })
      group.add(detalhe.group)
      yield

      // ══ CAMADA PERTO: só entra quando a câmera cruza INVERNO_R_DET ══
      // Não pode usar a `Obra` compartilhada (ela é SELADA no fim do
      // `boot()`, e a câmera pode chegar minutos depois): uma `Obra` PRÓPRIA,
      // cujo `.passo()` é chamado de dentro do `update(cam)` abaixo, o mesmo
      // `update` que `plaza-scene.tsx` já chama todo quadro. Ver "ACHADO 3"
      // no cabeçalho.
      let florestaAtual: Floresta = florestaEsparsa
      let pertoDisparado = false
      let estacaoAtual: EstacaoInverno | null = null
      // ⚠️ SÓ PRA ESTA CORRIDA: `buildEstacaoInverno` é assíncrona de verdade
      // (busca 4 `.glb` próprios) e pode resolver DEPOIS que o visitante já
      // saiu e `dispose()` já rodou. Sem esta guarda, o `.then()` colaria a
      // estação de volta num `group` já esvaziado.
      let dispostoDeVerdade = false
      const obraPerto = new Obra({ orcamentoMs: 4 })

      const dispararCamadaPerto = () => {
        if (pertoDisparado) return
        pertoDisparado = true
        obraPerto.põe({
          nome: 'inverno:camada-perto',
          peso: 1,
          faixa: 2,
          *fatia() {
            if (ativos.arvores.length > 0) {
              const saidaFl: { floresta: Floresta | null } = { floresta: null }
              // ⚠️ A SOMBRA DA CAMADA PERTO É `o.sombra` **E** O PERFIL, não só
              // `o.sombra`: `?sombra=0` continua desligando tudo, mas o celular
              // e o LOW ficam fora do passe mesmo com a sombra ligada (a conta
              // do texel está em `orcamentoPerto`).
              const g = instanciarFlorestaDensa(ativos.arvores, candidatos, (o.sombra ?? true) && orc.sombra, orc.arvores, saidaFl)
              while (!g.next().done) yield
              if (saidaFl.floresta) {
                group.remove(florestaEsparsa.group)
                disposeGrupo(florestaEsparsa.group)
                group.add(saidaFl.floresta.group)
                florestaAtual = saidaFl.floresta
                console.log(`[inverno] camada perto: floresta densa, ${saidaFl.floresta.arvores.toLocaleString('pt-BR')} árvores, ${saidaFl.floresta.triangulos.toLocaleString('pt-BR')} triângulos (${orc.arvores} em malha real no perfil ${o.profile?.tier ?? 'desktop'}/${o.profile?.quality ?? 'balanced'}, ${ativos.arvores.length} espécies, sombra ${(o.sombra ?? true) && orc.sombra ? 'sim' : 'não'}; o resto em cone)`)
              }
            }
            if (ativos.rochas) {
              const candidatosRocha: CandidatoRocha[] = []
              for (const it2 = varrerCandidatosRocha(o.heightAt, (c) => candidatosRocha.push(c)); !it2.next().done; ) yield
              const saidaRo: { mesh: THREE.InstancedMesh | null; triangulos: number } = { mesh: null, triangulos: 0 }
              const g2 = instanciarPenhascos(ativos.rochas.geo, ativos.rochas.mat, candidatosRocha, (o.sombra ?? true) && orc.sombra, orc.rochas, saidaRo)
              while (!g2.next().done) yield
              if (saidaRo.mesh) {
                group.add(saidaRo.mesh)
                console.log(`[inverno] camada perto: ${saidaRo.mesh.count.toLocaleString('pt-BR')} penhascos, ${saidaRo.triangulos.toLocaleString('pt-BR')} triângulos`)
              }
            }
          },
        })
        // ⚠️ A ESTAÇÃO REAL RODA FORA DA `Obra`, EM PARALELO, DE PROPÓSITO. Ela
        // é `async` por natureza (busca 4 `.glb` próprios) e não fatia CPU
        // pesada nenhuma (só um `Box3` e um `traverse` por peça, cada um sobre
        // um objeto só), então entrar na `Obra` só atrasaria sem ceder nada de
        // verdade. Sobe assim que a rede terminar, troca a caixa placeholder,
        // e se falhar a caixa continua de pé (mesma regra de toda falha
        // parcial deste módulo).
        buildEstacaoInverno({
          heightAt: o.heightAt, gltf: o.gltf, sombra: o.sombra ?? true, culler: o.culler,
          vilaBase: { r: 6920, az: 273 },
          // ⚠️ A MESMA TABELA QUE OS PILONES E O CABO USAM, não uma segunda
          // cópia: ver a nota de `VAOS_TELEFERICO`. Enquanto eram duas listas
          // escritas à mão, o cabo terminava em r 8.280/8.220 e as cabines em
          // r 8.200/8.150, ou seja as cabines penduravam fora do cabo por 80 e
          // 70 m. Os topos de hoje são o MÁXIMO MEDIDO de cada rumo (r 8.150 no
          // 268 e r 8.100 no 261, grade de 25 m).
          cabos: VAOS_TELEFERICO.map((v) => ({
            rBase: v.rBase, azBase: v.azBase, rTopo: v.rTopo, azTopo: v.azTopo, nCabines: v.nCabines,
          })),
          trilhas: PISTAS,
        })
          .then((est) => {
            if (dispostoDeVerdade) { est.dispose(); return }
            estacaoAtual = est
            if (vilaMesh) { group.remove(vilaMesh); vilaMesh.geometry.dispose(); vilaMesh = null }
            group.add(est.group)
            console.log(`[inverno] estação real no lugar da caixa placeholder, ${est.triangulos.toLocaleString('pt-BR')} triângulos`)
          })
          .catch((err) => console.error('[inverno] estação não subiu, a caixa placeholder continua de pé', err))
      }

      const [ccx, ccz] = [INVERNO_CX, INVERNO_CZ]
      o.culler?.add(group, 26000, new THREE.Vector3(ccx, 0, ccz))

      const parque: Inverno = {
        group,
        triangulos: Math.round(triangulos),
        medidas,
        get arvores() { return florestaAtual.arvores },
        update(cam: THREE.Vector3) {
          if (obraPerto.pendentes > 0) obraPerto.passo()
          if (!pertoDisparado) {
            const d = Math.hypot(cam.x - ccx, cam.z - ccz)
            if (d < INVERNO_R_DET) dispararCamadaPerto()
          }
          florestaAtual.update(cam)
          // ⚠️ ADAPTADOR: `Inverno.update` só recebe a POSIÇÃO da câmera (é o
          // contrato de toda esta cena, `plaza-scene.tsx` chama com
          // `camera.position`), mas `InvernoDetalhe.atualizar` pede o objeto
          // `THREE.Camera` inteiro, porque ele lê por `getWorldPosition`. Em
          // vez de mudar o contrato de `Inverno` (que outros lugares podem
          // depender), um objeto mínimo que só sabe responder
          // `getWorldPosition` resolve os dois lados sem gambiarra maior.
          detalhe.atualizar({ getWorldPosition: (v: THREE.Vector3) => v.copy(cam) } as unknown as THREE.Camera)
        },
        dispose() {
          dispostoDeVerdade = true
          obraPerto.descarta()
          detalhe.dispose()
          estacaoAtual?.dispose()
          disposeGrupo(group)
        },
      }
      saida.parque = parque
      o.aoPronto?.(parque)
    },
  }
}

/**
 * ⚠️ COMPATIBILIDADE, NÃO CAMINHO RECOMENDADO. `plaza-scene.tsx` hoje
 * importa `buildInverno` e chama dentro de `daCidade.push(...)` — é
 * EXATAMENTE o "ACHADO 2" do cabeçalho, o defeito que esta frente existe pra
 * consertar. Esta função existe só pra `import { buildInverno }` continuar
 * compilando enquanto a troca pro padrão novo (`invernoComoTrabalho`, linha
 * exata no relatório) não é colada em `plaza-scene.tsx`; ela NÃO conserta a
 * trava, só preserva a assinatura antiga (mesmo espírito de `loadPark` em
 * `park.ts`, que existe pelo mesmo motivo).
 *
 * Por dentro já é `invernoComoTrabalho` rodado até o fim de uma vez (sem
 * ceder, sem `Obra`): `abrirPortaoInverno()` é chamado aqui mesmo, porque
 * este caminho não conhece o portão da cidade (não faz sentido esperar por
 * um evento que só existe no caminho novo).
 */
export async function buildInverno(o: InvernoOpts): Promise<Inverno> {
  abrirPortaoInverno()
  const t = await invernoComoTrabalho(o)
  const g = t.fatia()
  while (!g.next().done) { /* roda tudo de uma vez, de propósito: ver a nota acima */ }
  return t.parque as Inverno
}
