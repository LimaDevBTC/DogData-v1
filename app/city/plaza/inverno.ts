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
// teleféricos, a floresta inteira (até 1.303 candidatos) e os penhascos
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
// `Obra`, fatiada, nunca de uma vez): a floresta densa completa (até 1.303
// candidatos, MEDIDO em `gerarCandidatosFloresta` com o `heightAt` real, nota
// de `FLORESTA_TETO_PERTO` mais abaixo: 450 instâncias reais + resto em
// cone), o pacote de rochas (até 140 instâncias, até 430.640 triângulos no
// pior caso, ambos já medidos e documentados na seção "OS PENHASCOS"), e a
// estação em detalhe (troca a caixa placeholder pela estação real de
// `estacao-inverno.ts`, integrada pelo coordenador em 03/09). Nada disso é
// reduzido nem simplificado: é o MESMO conteúdo "top 1
// mundo" que o fundador pediu, só adiado pra quando alguém está perto o
// bastante pra ver a diferença.
//
// `INVERNO_R_DET = 4000` (4 km), medido a partir do mesmo ponto que já ancora
// o culler do grupo inteiro (`r=7800, az=268`, ver o fim do arquivo).
// Justificativa: é mais que o triplo de `FLORESTA_R_CHEIA` (1.300 m, o raio
// em que a floresta cheia já troca cone por malha real, ponto a ponto) — dá
// margem pra a `Obra` terminar de construir a camada perto (fatiada, poucos
// ms por quadro) ANTES de a câmera chegar perto o bastante pra notar a malha
// de longe ainda em pé. Comparado ao raio de descarte do grupo inteiro
// (26.000 m, `o.culler?.add`), 4.000 m ainda é bem menor, então o gatilho
// nunca dispara depois que o parque já teria sumido por distância.
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
// ⚠️ OS DOIS RELEVOS ASSADOS (script Python, fora deste arquivo, dos scans
// fotogramétricos reais: ver a nota "SEGUNDA CORREÇÃO" acima) NÃO SÃO MAIS
// `import`. Ver "FRENTE CARREGAMENTO" no cabeçalho: eram `./dados/*.json`
// estático (145 KB no pacote de TODO visitante, bandeira ligada ou não);
// agora são `fetch('/city/inverno/*.json')`, carregados só quando
// `INVERNO_ATIVO`, e o arquivo mudou de `app/city/plaza/dados/` pra
// `public/city/inverno/` porque só `public/` é servido por URL.

// ── A BANDEIRA ───────────────────────────────────────────────────────────────
export const INVERNO_ATIVO =
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('inverno') === '1'

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
const R_CRISTA_PICO = 8280
const R_QUEDA = 8650
/** expoente da face de rocha: mantém a curva perto de 1 quase até o topo e
 *  desaba no último trecho, o oposto do suave01 puro. Continua valendo:
 *  isto é o envelope de EXISTÊNCIA (onde o maciço pode aparecer), não a
 *  forma fina dele, que agora vem das feições reais abaixo. */
const EXP_FACE_ROCHA = 2.4

function suave01(t: number): number {
  const u = t < 0 ? 0 : t > 1 ? 1 : t
  return u * u * (3 - 2 * u)
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
const ESPECIFICACOES: EspecPista[] = [
  {
    nome: 'Descida do Mar da Tranquilidade', dificuldade: 'preta', largura: 30,
    rInicio: 8330, rFim: 7150, azCentro: 268, amplitude: 6, oscilacoes: 1, amostras: 90,
  },
  {
    nome: 'Super-G Regolito', dificuldade: 'preta', largura: 27,
    // ⚠️ RETUNADO EM 03/09, SEGUNDA VEZ: a troca do relevo por dado real
    // (Zwölfernock/Weisse Wand) moveu o flanco íngreme de novo. Medido de
    // novo por `medirPista`: 565 m de desnível, dentro de 400-650.
    rInicio: 7900, rFim: 7600, azCentro: 268, amplitude: 2, oscilacoes: 1, amostras: 60,
  },
  {
    nome: 'Slalom Gigante Cratera Rasa', dificuldade: 'vermelha', largura: 22,
    // ⚠️ RETUNADO EM 03/09, SEGUNDA VEZ, mesmo motivo. Medido: 408 m, dentro
    // de 250-450.
    rInicio: 7780, rFim: 7600, azCentro: 268, amplitude: 2, oscilacoes: 1, amostras: 50,
  },
  {
    nome: 'Slalom Poeira Fina', dificuldade: 'azul', largura: 18,
    // ⚠️ RETUNADO EM 03/09, SEGUNDA VEZ. Medido: 208 m, dentro de 180-220.
    rInicio: 7650, rFim: 7530, azCentro: 268, amplitude: 2, oscilacoes: 1, amostras: 40,
  },
  {
    nome: 'Boardercross Baixa Gravidade', dificuldade: 'parque', largura: 30,
    // ⚠️ RETUNADO EM 03/09, SEGUNDA VEZ. Medido: 1.192 m de percurso (alvo
    // 800-1.200), 249 m de desnível (alvo 100-250), 11,8° de grau médio
    // (alvo FIS 7-11°, 0,8° acima: os três critérios juntos não fecham
    // perfeito no relevo novo, e ficar 0,8° acima do teto de uma
    // RECOMENDAÇÃO, não de uma regra de homologação, foi a troca aceita
    // em vez de furar o percurso ou o desnível).
    rInicio: 7650, rFim: 7350, azCentro: 268, amplitude: 2, oscilacoes: 1, amostras: 50,
  },
  {
    nome: 'Slopestyle Um Sexto', dificuldade: 'parque', largura: 24,
    // ⚠️ RETUNADO EM 03/09, SEGUNDA VEZ. Sem norma FIS estrita; 164 m de
    // queda numa progressão razoável de freestyle.
    rInicio: 7850, rFim: 7600, azCentro: 260, amplitude: 2, oscilacoes: 1, amostras: 40,
  },
  {
    nome: 'Pista Verde de Acesso', dificuldade: 'verde', largura: 20,
    // o anel que o pódio da abóbada já deixa plano (r ≤ 7.150): o retorno
    // manso até a vila-base, de graça, em cima do nivelamento que já existe.
    rInicio: 7150, rFim: 6850, azCentro: 266, amplitude: 1, oscilacoes: 0.5, amostras: 30,
  },
]

export const PISTAS: Pista[] = ESPECIFICACOES.map((e) => ({
  nome: e.nome, dificuldade: e.dificuldade, largura: e.largura, pontos: gerarSerpentina(e),
}))

/** envelope radial ASSIMÉTRICO: sobe em cosseno do pé até a crista (o
 *  versante esquiável, moderado), cai em `Math.pow(suave01, EXP_FACE_ROCHA)`
 *  da crista até a queda externa (a face de rocha, que fica perto de 1 quase
 *  até o topo e desaba no último trecho). Continua a mesma forma da primeira
 *  correção: isto é só o envelope de EXISTÊNCIA, não a forma fina. */
function envelopeRadial(r: number): number {
  if (r <= R_PE || r >= R_QUEDA) return 0
  if (r <= R_CRISTA_PICO) return suave01((r - R_PE) / (R_CRISTA_PICO - R_PE))
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
interface FeicaoReal { cx: number; cz: number; giro: number; raioM: number; pesoAltura: number; dados: DadosRelevo }

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
function montarFeicoes(weisse: DadosRelevo, zwoelfernock: DadosRelevo): FeicaoReal[] {
  const [x1, z1] = pontoEmRumo(8280, 266)
  const [x2, z2] = pontoEmRumo(7950, 250)
  const [x3, z3] = pontoEmRumo(8100, 284)
  return [
    { cx: x1, cz: z1, giro: 0.35, raioM: 820, pesoAltura: 900, dados: zwoelfernock },
    { cx: x2, cz: z2, giro: 1.10, raioM: 620, pesoAltura: 640, dados: weisse },
    // ⚠️ MESMO ARQUIVO QUE A FEIÇÃO ANTERIOR, GIRO E RAIO DIFERENTES: é a
    // técnica de "carimbo" reaproveitado com transform distinto (mesma ideia
    // das 9 sequoias resolvendo a floresta hoje). O que causaria repetição
    // seria repetir posição E escala juntas, não repetir a fonte de dado.
    { cx: x3, cz: z3, giro: 4.20, raioM: 520, pesoAltura: 430, dados: weisse },
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
      const [weisse, zwoelfernock] = await Promise.all([
        fetch('/city/inverno/relevo-weisse-wand.json').then((r) => r.json() as Promise<DadosRelevo>),
        fetch('/city/inverno/relevo-zwoelfernock.json').then((r) => r.json() as Promise<DadosRelevo>),
      ])
      FEICOES = montarFeicoes(weisse, zwoelfernock)
    } catch (err) {
      console.error('[inverno] os relevos reais (weisse-wand/zwoelfernock) NÃO CARREGARAM. O maciço fica só com envelope + tempero, sem os dois picos reais, até recarregar a página.', err)
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
  const u = lx / f.raioM * 0.5 + 0.5
  const v = lz / f.raioM * 0.5 + 0.5
  const fx = Math.min(g - 1.001, Math.max(0, u * (g - 1)))
  const fz = Math.min(g - 1.001, Math.max(0, v * (g - 1)))
  const i = Math.floor(fx), j = Math.floor(fz)
  const tx = fx - i, tz = fz - j
  const A = f.dados.alturas
  const H = (ii: number, jj: number) => A[jj * g + ii]
  const h = (H(i, j) * (1 - tx) + H(i + 1, j) * tx) * (1 - tz) + (H(i, j + 1) * (1 - tx) + H(i + 1, j + 1) * tx) * tz
  // ⚠️ FALLOFF CIRCULAR, NÃO QUADRADO: a grade é quadrada (u,v em [0,1]²),
  // mas cortar no quadrado desenharia uma aresta reta na chapa. O raio
  // normalizado (`distNorm`) já é a distância euclidiana, então o desvanece
  // é um círculo de verdade em torno de `(cx, cz)`.
  const falloff = 1 - suave01((distNorm - 0.72) / 0.28)
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
function temperoFino(x: number, z: number, env: number, pesoPista: number): number {
  if (env <= 0 || pesoPista >= 1) return 0
  const [wx, wz] = deformarDominio(x, z)
  const rm = ridgedMultifractal(wx, wz, 260, 901, 4) // 0..1
  const centralizado = (rm - 0.5) * 2 // -1..1 aprox: sobe E desce, não só cava
  return centralizado * AMPLITUDE_TEMPERO * env * (1 - pesoPista)
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
  let baseReal = 0
  for (const f of FEICOES) baseReal = Math.max(baseReal, amostrarFeicao(f, x, z))
  const pesoPista = pistaProximidade01(x, z)
  const relevo = baseReal * env + temperoFino(x, z, env, pesoPista)
  return relevo - PROFUNDIDADE_CORTE * pesoPista
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
const FLORESTA_ALTO = 190
const FLORESTA_PLUMA = 22
const FLORESTA_PASSO = 30
/** ⚠️ MEDIDO OFFLINE DEPOIS DA TROCA DE ESPÉCIE, NÃO SUPOSTO: a varredura
 *  continua gerando 1.303 candidatos (a posição não mudou, só a espécie).
 *  Com os pesos de `ARVORES` e as dez malhas carregando, o teto de 450 aloca
 *  231 pinheiro, 76 sq-small, 108 sq-med (as 4 juntas), 33 sq-big (as 3
 *  juntas) e 1 sq-rh: 1.328.152 triângulos de perto mais 10.424 no pior caso
 *  do balde de longe, 1.338.576 no total declarado. Ajuste este número pra
 *  cima se a chapa pedir mais densidade de perto. */
const FLORESTA_TETO_PERTO = 450
const FLORESTA_R_CHEIA = 1300
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
interface EspecieArvore { id: string; url: string; peso: number; escMin: number; escMax: number }
const ARVORES: EspecieArvore[] = [
  { id: 'pinheiro', url: '/city/sf/tree-pine.glb', peso: 0.50, escMin: 0.80, escMax: 1.35 },
  { id: 'sq-small-1', url: '/city/sf/sq-small-1.glb', peso: 0.16, escMin: 0.85, escMax: 1.15 },
  { id: 'sq-med-1', url: '/city/sf/sq-med-1.glb', peso: 0.065, escMin: 0.85, escMax: 1.10 },
  { id: 'sq-med-2', url: '/city/sf/sq-med-2.glb', peso: 0.065, escMin: 0.85, escMax: 1.10 },
  { id: 'sq-med-3', url: '/city/sf/sq-med-3.glb', peso: 0.06, escMin: 0.85, escMax: 1.10 },
  { id: 'sq-med-4', url: '/city/sf/sq-med-4.glb', peso: 0.06, escMin: 0.85, escMax: 1.10 },
  { id: 'sq-big-1', url: '/city/sf/sq-big-1.glb', peso: 0.03, escMin: 0.90, escMax: 1.08 },
  { id: 'sq-big-2', url: '/city/sf/sq-big-2.glb', peso: 0.025, escMin: 0.90, escMax: 1.08 },
  { id: 'sq-big-3', url: '/city/sf/sq-big-3.glb', peso: 0.02, escMin: 0.90, escMax: 1.08 },
  // ⚠️ RARO DE PROPÓSITO: 80 m é quase a escala do bosque que este módulo
  // usava antes. Peso de 0,3% num sorteio de ~1.300 candidatos dá uns 3 a 5
  // exemplares no maciço inteiro: marco visual, não repetição.
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
          if (inc <= FLORESTA_INC_MAX && distanciaAPistaMaisProxima(x, z) >= FLORESTA_FOLGA_PISTA) {
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

/** carrega um `.glb` e devolve a geometria e o material do primeiro mesh
 *  achado, prontos pra instanciar. `null` se não achar mesh OU se o
 *  carregamento falhar, e falha AGORA GRITA no console (`console.error`),
 *  em vez do `.catch(() => null)` silencioso que já custou dois buracos
 *  nesta casa no mesmo dia (este módulo e `loadSf`). O chamador ainda decide
 *  o que fazer sem a árvore (a espécie perdida é redistribuída entre as que
 *  carregaram, ver `construirFloresta`), mas ninguém fica sem SABER. */
async function carregarInstanciavel(
  gltf: GLTFLoader, especie: EspecieArvore,
): Promise<{ geo: THREE.BufferGeometry; mat: THREE.Material } | null> {
  try {
    const cena = await new Promise<THREE.Group>((res, rej) => gltf.load(especie.url, (g) => res(g.scene), undefined, rej))
    let achado: THREE.Mesh | null = null
    cena.traverse((o) => { if (!achado && (o as THREE.Mesh).isMesh) achado = o as THREE.Mesh })
    if (!achado) {
      console.error(`[inverno] floresta: ${especie.url} carregou mas não tem mesh nenhum dentro. Espécie '${especie.id}' fica de fora, redistribuída.`)
      return null
    }
    const mesh = achado as THREE.Mesh
    return { geo: mesh.geometry, mat: mesh.material as THREE.Material }
  } catch (e) {
    console.error(`[inverno] floresta: ${especie.url} NÃO CARREGOU (espécie '${especie.id}'). Ela fica de fora e o peso dela é redistribuído entre as outras; a densidade não cai, só perde essa silhueta. Motivo:`, e)
    return null
  }
}

/**
 * O cone barato de longe (8 triângulos), MESMA forma que `alpino.ts` usa:
 * todas as espécies precisam ler como uma silhueta só quando a câmera está
 * a quilômetros, senão o horizonte ganha costura visível entre elas.
 */
function geoConeLonge(): THREE.BufferGeometry {
  const g = new THREE.ConeGeometry(2.3, 11.5, 4, 1, false)
  g.translate(0, 5.75, 0)
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
  gltf: GLTFLoader,
): Promise<{ especie: EspecieArvore; dados: { geo: THREE.BufferGeometry; mat: THREE.Material } }[]> {
  const carregadas = await Promise.all(ARVORES.map((esp) => carregarInstanciavel(gltf, esp)))
  const vivas = ARVORES
    .map((esp, i) => ({ especie: esp, dados: carregadas[i] }))
    .filter((v): v is { especie: EspecieArvore; dados: { geo: THREE.BufferGeometry; mat: THREE.Material } } => v.dados !== null)
  if (vivas.length === 0) {
    console.error('[inverno] floresta: NENHUMA espécie carregou. A camada perto sobe sem árvore real; a esparsa (cone) continua de pé.')
  } else if (vivas.length < ARVORES.length) {
    console.warn(`[inverno] floresta: subiu com ${vivas.length}/${ARVORES.length} espécies (ver os erros acima por nome de arquivo).`)
  }
  return vivas
}

/** REDE: o pacote de rochas, cru (só o par geo/mat do primeiro mesh achado).
 *  `null` sem `gltf`, se o `.glb` falhar, ou se não tiver mesh dentro. */
async function carregarPacoteRochas(gltf?: GLTFLoader): Promise<{ geo: THREE.BufferGeometry; mat: THREE.Material } | null> {
  if (!gltf) {
    console.warn('[inverno] sem `gltf`: sem penhasco de verdade, só a cor de rocha do vértice.')
    return null
  }
  try {
    const cena = await new Promise<THREE.Group>((res, rej) => gltf.load('/city/sf/rocks-stylized-pack.glb', (g) => res(g.scene), undefined, rej))
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
 * camada perto termina, ver `dispararCamadaPerto`). CPU tão barata (≤300
 * itens) que não precisa ceder: uma função comum, não geradora.
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
  const escala1 = new THREE.Vector3(1, 1, 1)
  for (let i = 0; i < amostra.length; i++) {
    const c = amostra[i]
    vp.set(c.x, c.y, c.z)
    ve.set(0, c.giro, 0)
    vq.setFromEuler(ve)
    m4.compose(vp, vq, escala1)
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
 * pros `candidatosBase` inteiros (até 1.303, `FLORESTA_TETO_PERTO` = 450 com
 * malha real e o resto no balde de longe interno, MESMA régua de sempre —
 * ver a nota de `FLORESTA_TETO_PERTO` mais abaixo). Idêntica, item por item,
 * ao antigo `construirFloresta`: só mudou de forma (gerador que cede, recebe
 * `vivas`/`candidatosBase` já prontos em vez de carregar e gerar sozinha) e
 * de lugar (não roda mais durante o boot, só quando a câmera cruza
 * `INVERNO_R_DET`). Escreve o resultado em `saida.floresta`, padrão de
 * `constroiParque` em `park.ts` (gerador não pode `return` valor com
 * `--downlevelIteration` desligado; `saida` sai da mesma forma sem depender
 * disso).
 */
function* instanciarFlorestaDensa(
  vivas: { especie: EspecieArvore; dados: { geo: THREE.BufferGeometry; mat: THREE.Material } }[],
  candidatosBase: CandidatoFloresta[],
  sombra: boolean,
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

  // desbaste determinístico se passar do teto de perto (o balde de longe não
  // tem teto: cone de 8 tri é barato o bastante pra sobrar todo mundo nele)
  let paraPerto = candidatos
  if (candidatos.length > FLORESTA_TETO_PERTO) {
    const manter = FLORESTA_TETO_PERTO / candidatos.length
    paraPerto = candidatos.filter((_, i) => hash01(i * 2654435761) < manter)
  }
  yield
  const paraPertoSet = new Set(paraPerto)

  const group = new THREE.Group()
  group.name = 'inverno:floresta:densa'
  let triangulos = 0

  const instPerto: (THREE.InstancedMesh | null)[] = new Array(vivas.length).fill(null)
  for (const it = emFatias(vivas, (v, i) => {
    const cap = Math.max(1, paraPerto.filter((c) => c.especieIdx === i).length)
    const inst = new THREE.InstancedMesh(v.dados.geo, v.dados.mat, cap)
    inst.name = `inverno:floresta:${v.especie.id}:perto`
    inst.castShadow = sombra
    inst.frustumCulled = false
    inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    group.add(inst)
    const triUnit = v.dados.geo.index ? v.dados.geo.index.count / 3 : v.dados.geo.attributes.position.count / 3
    triangulos += triUnit * cap
    instPerto[i] = inst
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

  const m4 = new THREE.Matrix4(), vp = new THREE.Vector3(), vq = new THREE.Quaternion()
  const ve = new THREE.Euler(), vs = new THREE.Vector3()

  const update = (cam: THREE.Vector3) => {
    const contagens = new Array(vivas.length).fill(0)
    let nLonge = 0
    for (const c of candidatos) {
      const d = Math.hypot(c.x - cam.x, c.z - cam.z)
      const perto = d < FLORESTA_R_CHEIA && paraPertoSet.has(c)
      const especie = vivas[c.especieIdx].especie
      const esc = especie.escMin + c.tEsc * (especie.escMax - especie.escMin)
      vp.set(c.x, c.y, c.z)
      ve.set(0, c.giro, 0)
      vq.setFromEuler(ve)
      vs.set(esc, esc, esc)
      m4.compose(vp, vq, vs)
      const inst = perto ? instPerto[c.especieIdx] : null
      if (inst) inst.setMatrixAt(contagens[c.especieIdx]++, m4)
      else longe.setMatrixAt(nLonge++, m4)
    }
    for (let i = 0; i < vivas.length; i++) {
      const inst = instPerto[i]
      if (!inst) continue
      inst.count = contagens[i]
      inst.instanceMatrix.needsUpdate = true
    }
    longe.count = nLonge
    longe.instanceMatrix.needsUpdate = true
  }
  update(new THREE.Vector3(0, 0, 0))
  for (const inst of instPerto) inst?.computeBoundingSphere()
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
        if (inc >= 28 && pistaProximidade01(x, z) <= 0.15 && hash2(ir, Math.round(azz * 10), 603) <= 0.35) {
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
  saida: { mesh: THREE.InstancedMesh | null; triangulos: number },
): Tarefa {
  let usar = candidatosRocha
  if (candidatosRocha.length > TETO_ROCHA) {
    const manter = TETO_ROCHA / candidatosRocha.length
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
 *  quebrar a sensação de "montanha pelada" sem custar mais que 220 × 8 tri
 *  = 1.760 triângulos. Ver "ACHADO 3" no cabeçalho. */
const FLORESTA_TETO_LONGE = 220

/** ⚠️ O RAIO DA CAMADA PERTO, medido a partir do mesmo ponto que já ancora o
 *  culler do grupo inteiro (`r=7800, az=268`, definido logo abaixo). É mais
 *  que o triplo de `FLORESTA_R_CHEIA` (1.300 m, o raio em que a floresta
 *  cheia já troca cone por malha real, ponto a ponto): dá margem pra a
 *  `Obra` privada da camada perto (ver `invernoComoTrabalho`) terminar de
 *  construir ANTES de a câmera chegar perto o bastante pra notar a malha de
 *  longe ainda em pé. Comparado ao raio de descarte do grupo inteiro
 *  (26.000 m, `culler?.add` abaixo), 4.000 m ainda é bem menor, então o
 *  gatilho nunca dispara depois que o parque já teria sumido por distância.
 *  Ver "ACHADO 3" no cabeçalho pra justificativa completa. */
const INVERNO_R_DET = 4000
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
  arvores: { especie: EspecieArvore; dados: { geo: THREE.BufferGeometry; mat: THREE.Material } }[]
  rochas: { geo: THREE.BufferGeometry; mat: THREE.Material } | null
}

// ⚠️ A ESTAÇÃO DEIXOU DE SER UM `.glb` CRU BUSCADO AQUI, 03/09. A frente
// dedicada de estação entregou `buildEstacaoInverno` (chalé, bilheteria,
// canhão de neve, cerca, rede, cabines no cabo, placa), que já resolve a
// própria rede de vários `.glb` e não precisa entrar em `Promise.all` com o
// resto: ela é disparada dentro de `dispararCamadaPerto`, fire-and-forget,
// e substitui a caixa placeholder quando terminar (ver lá embaixo).
async function baixaAtivosInverno(o: InvernoOpts): Promise<AtivosDoInverno> {
  void carregarRelevo()
  const [arvores, rochas] = await Promise.all([
    o.gltf ? carregarEspeciesArvore(o.gltf) : Promise.resolve([]),
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
  const ativos = await baixaAtivosInverno(o)

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

      // os teleféricos
      const t1 = construirTeleferico(7000, 268, 8280, 268, 6, o.heightAt)
      t1.pilones.name = 'inverno:teleferico:principal:pilones'
      t1.cabo.name = 'inverno:teleferico:principal:cabo'
      group.add(t1.pilones, t1.cabo)
      triangulos += t1.triangulos

      const t2 = construirTeleferico(6950, 273, 8220, 261, 4, o.heightAt)
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
      // (ver o cabeçalho dele), bem menor que os 4.000 m de `INVERNO_R_DET`,
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
              const g = instanciarFlorestaDensa(ativos.arvores, candidatos, o.sombra ?? true, saidaFl)
              while (!g.next().done) yield
              if (saidaFl.floresta) {
                group.remove(florestaEsparsa.group)
                disposeGrupo(florestaEsparsa.group)
                group.add(saidaFl.floresta.group)
                florestaAtual = saidaFl.floresta
                console.log(`[inverno] camada perto: floresta densa, ${saidaFl.floresta.arvores.toLocaleString('pt-BR')} árvores`)
              }
            }
            if (ativos.rochas) {
              const candidatosRocha: CandidatoRocha[] = []
              for (const it2 = varrerCandidatosRocha(o.heightAt, (c) => candidatosRocha.push(c)); !it2.next().done; ) yield
              const saidaRo: { mesh: THREE.InstancedMesh | null; triangulos: number } = { mesh: null, triangulos: 0 }
              const g2 = instanciarPenhascos(ativos.rochas.geo, ativos.rochas.mat, candidatosRocha, o.sombra ?? true, saidaRo)
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
          cabos: [
            { rBase: 7000, azBase: 268, rTopo: 8280, azTopo: 268, nCabines: 10 },
            { rBase: 6950, azBase: 273, rTopo: 8220, azTopo: 261, nCabines: 6 },
          ],
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
