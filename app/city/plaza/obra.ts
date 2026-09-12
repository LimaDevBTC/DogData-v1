// ═══════════════════════════════════════════════════════════════════════════
// A OBRA: construção da cidade com ORÇAMENTO DE QUADRO.
//
// ⚠️ POR QUE ISTO EXISTE, E O NÚMERO QUE OBRIGOU. Medido em 02/09/2026 com
// `PerformanceObserver` em `longtask`, no boot de `/city`: **60,3 s de thread
// bloqueada em 29 tarefas, num boot de 63 s**. Ou seja a thread principal fica
// presa 96% do tempo. E a forma é pior que o total:
//
//     21.257 ms  numa ÚNICA tarefa   Runestone Park
//      7.648 ms  numa única tarefa   Chalé OrdCards
//      5.490 ms  + 4.498 ms          monumentos
//      4.155 ms  + 2.790 + 2.488     terreno, domo, tecido
//
// Quatro monolitos respondem por 53 dos 60 segundos.
//
// ⚠️ E É POR ISSO QUE "ABRIR CEDO E CONSTRUIR EM SEGUNDO PLANO" JÁ FALHOU. O
// fundador viveu isso: a cidade abria e travava durante o primeiro minuto. Não
// existe segundo plano numa thread só. Enquanto a peça for uma função síncrona
// de 21 segundos, mostrar a câmera antes só troca uma espera honesta por um
// travamento que o visitante lê como app quebrado.
//
// A saída não é começar a desenhar mais cedo. É a construção virar
// INTERROMPÍVEL. Uma peça deixa de ser `function build()` e vira um gerador que
// cede o controle; o escalonador gasta no máximo `orcamentoMs` por quadro e
// devolve a thread para o render. O custo por quadro passa a ser um teto que
// escolhemos, não uma consequência do tamanho da peça.
//
// ⚠️ O ORÇAMENTO NÃO É O QUADRO INTEIRO. A 60 fps o quadro tem 16,7 ms e o
// render da cena já usa boa parte dele: medido em 02/09, `/city` roda entre 28
// e 41 fps no desktop com a cidade completa, ou seja 24 a 36 ms de render. O
// orçamento aqui é o que sobra para CONSTRUIR sem estourar o alvo, e por isso o
// padrão é conservador. Preferimos a cidade nascer mais devagar e a câmera
// nunca engasgar do que o contrário: engasgo é o que o fundador reclamou.
// ═══════════════════════════════════════════════════════════════════════════

/** Uma peça em construção. Cede o controle sempre que puder. */
export type Tarefa = Generator<void, void, unknown>

/** Quem constrói se registra assim. `fatia` é chamada até o gerador acabar. */
export interface Trabalho {
  /** rótulo para o log e para a barra de progresso */
  nome: string
  /** peso relativo, só para a barra andar de forma honesta */
  peso: number
  /** 0 = a cidade não abre sem isto. 1 = perto da câmera. 2 = fundo. */
  faixa: 0 | 1 | 2
  /** o gerador que faz o trabalho. Pode ceder quantas vezes quiser. */
  fatia(): Tarefa
}

export interface ObraOpts {
  /** teto de milissegundos gastos construindo POR QUADRO. Padrão 6. */
  orcamentoMs?: number
  /** chamado quando o progresso muda, com 0..1 e o rótulo corrente */
  aoAndar?: (fracao: number, nome: string) => void
  /** chamado quando a faixa 0 termina: é a hora de abrir a cidade */
  aoAbrir?: () => void
  /** chamado quando não sobra nada a construir */
  aoTerminar?: () => void
}

export class Obra {
  private fila: Trabalho[] = []
  private corrente: { t: Trabalho; g: Tarefa } | null = null
  private pesoFeito = 0
  private pesoTotal = 0
  private abriu = false
  private morto = false
  // ⚠️ A OBRA SÓ PODE ACABAR DEPOIS DE SELADA, e isto é conserto de um bug que
  // chegou a PRODUÇÃO em 03/09/2026. `animate()` começa a rodar ANTES de
  // `boot()` enfileirar qualquer coisa, então o primeiro `passo()` encontrava a
  // fila vazia, concluía "acabou", punha `morto = true` e disparava
  // `aoTerminar`. A partir dali todo `põe()` caía no `if (this.morto) return` e
  // o laço nunca mais chamava `passo()`.
  //
  // O estrago não apareceu em nenhum teste porque ele é SILENCIOSO: nada
  // quebra, nada loga, o console fica limpo. O parque, os monumentos e o chalé
  // simplesmente nunca nascem, e o grupo deles fica vazio e invisível na cena.
  // Eu ainda medi "zero travamento depois do portão" e quase reportei como
  // vitória: não havia travamento porque não havia obra.
  //
  // Fila vazia significa "sem trabalho AGORA", nunca "sem trabalho NUNCA MAIS".
  // Só `sela()` diz a segunda coisa.
  private selado = false
  private readonly orcamento: number
  private readonly opts: ObraOpts

  constructor(opts: ObraOpts = {}) {
    this.opts = opts
    this.orcamento = opts.orcamentoMs ?? 6
  }

  /** Enfileira. Pode ser chamado depois da obra já ter começado. */
  põe(t: Trabalho) {
    if (this.morto) return
    if (this.selado) {
      console.warn(`[obra] "${t.nome}" chegou depois de selada e foi recusado`)
      return
    }
    this.fila.push(t)
    this.pesoTotal += t.peso
    // ⚠️ ORDENA POR FAIXA, ESTÁVEL. `Array.prototype.sort` é estável desde a
    // ES2019 em todo motor que nos interessa, então dentro da mesma faixa a
    // ordem de registro é respeitada: quem depende de quem continua funcionando
    // sem o módulo precisar declarar dependência.
    this.fila.sort((a, b) => a.faixa - b.faixa)
  }

  /**
   * Gasta até `orcamentoMs` construindo. CHAME UMA VEZ POR QUADRO, antes do
   * render.
   *
   * ⚠️ O RELÓGIO É CHECADO ENTRE CESSÕES, NÃO DENTRO DELAS. Se uma peça ceder
   * de 200 em 200 ms, o orçamento de 6 ms não a segura: ele só decide se a
   * PRÓXIMA fatia começa. Quem escreve a peça é responsável por ceder fino. A
   * regra prática que uso nos briefings: ceda a cada algumas centenas de itens,
   * e meça, não presuma.
   */
  passo() {
    if (this.morto) return
    const fim = performance.now() + this.orcamento
    while (performance.now() < fim) {
      if (!this.corrente) {
        const t = this.fila.shift()
        if (!t) break
        this.corrente = { t, g: t.fatia() }
        this.opts.aoAndar?.(this.fracao(), t.nome)
      }
      let pronto = false
      try {
        pronto = !!this.corrente.g.next().done
      } catch (err) {
        // ⚠️ UMA PEÇA QUE MORRE NÃO PODE LEVAR A CIDADE. Antes, com tudo atrás
        // de um `Promise.all`, uma exceção em qualquer módulo segurava o portão
        // fechado para sempre e o visitante ficava na barra de progresso sem
        // nenhuma mensagem. Aqui a peça cai, o log conta, e a obra segue.
        console.error(`[obra] "${this.corrente.t.nome}" caiu e foi descartada`, err)
        pronto = true
      }
      if (pronto) {
        this.pesoFeito += this.corrente.t.peso
        const faixaFeita = this.corrente.t.faixa
        this.corrente = null
        this.opts.aoAndar?.(this.fracao(), '')
        if (!this.abriu && faixaFeita === 0 && !this.fila.some((t) => t.faixa === 0)) {
          this.abriu = true
          this.opts.aoAbrir?.()
        }
      }
    }
    // ⚠️ `selado` É O QUE SEPARA "fila vazia" DE "obra acabada". Ver a nota no
    // campo. Sem ele isto matava a obra no primeiro quadro.
    if (this.selado && !this.corrente && !this.fila.length) {
      if (!this.abriu) { this.abriu = true; this.opts.aoAbrir?.() }
      this.opts.aoTerminar?.()
      this.morto = true
    }
  }

  private fracao() {
    return this.pesoTotal ? Math.min(1, this.pesoFeito / this.pesoTotal) : 0
  }

  /** Avisa que não vem mais trabalho. Sem isto a obra NUNCA se dá por encerrada,
   *  o que é de propósito: ver a nota em `selado`. Chame no fim do `boot`. */
  sela() { this.selado = true }

  get terminou() { return this.morto }
  get pendentes() { return this.fila.length + (this.corrente ? 1 : 0) }

  descarta() { this.morto = true; this.fila.length = 0; this.corrente = null }
}

/**
 * Açúcar para transformar um laço comum em tarefa que cede.
 *
 * ⚠️ CEDER POR TEMPO E NÃO POR CONTAGEM. Ceder "a cada 500 itens" parece
 * equivalente e não é: o custo por item varia com o item (um triângulo perto da
 * margem custa muito mais que um no miolo, ver o campo de distância em
 * `lago.ts`), então contagem fixa dá fatia de 2 ms num trecho e de 900 ms no
 * seguinte. Medir o relógio a cada `passo` itens custa uma chamada barata e
 * limita o pior caso de verdade.
 */
export function* emFatias<T>(
  itens: ArrayLike<T>,
  faz: (item: T, i: number) => void,
  msPorFatia = 4,
  passo = 64,
): Tarefa {
  let t0 = performance.now()
  for (let i = 0; i < itens.length; i++) {
    faz(itens[i] as T, i)
    if (i % passo === 0 && performance.now() - t0 > msPorFatia) {
      yield
      t0 = performance.now()
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// AQUECIMENTO DE SHADER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Compila os programas de um trecho da cena SEM bloquear a thread.
 *
 * ⚠️ POR QUE ISTO É PARTE DO PLANO DE ABRIR CEDO, e não um extra. Compilar
 * shader é a única parte do boot que a thread principal NÃO controla: quem
 * compila é o driver. O three só pergunta se terminou, e a pergunta é que
 * decide se a espera bloqueia.
 *
 * O caminho normal (`renderer.render`) descobre o programa na hora do primeiro
 * desenho e, dentro de `onFirstUse`, chama `gl.getProgramInfoLog` e
 * `gl.getProgramParameter(LINK_STATUS)`: as duas param a thread até aquele
 * programa ficar pronto, um por um. Medido em 02/09 nesta cena, com 373
 * programas, isso era o maior item de CPU do boot depois do campo de distância
 * do lago ser consertado.
 *
 * `compileAsync` fazia o contrário: disparava todas as compilações e perguntava
 * com `COMPLETION_STATUS_KHR`, a consulta NÃO bloqueante da extensão
 * `KHR_parallel_shader_compile`. NÓS NÃO USAMOS MAIS `compileAsync`, e o motivo
 * é um defeito dele, medido em 12/09/2026.
 *
 * ⚠️ NUNCA VOLTE A CHAMAR `renderer.compileAsync()`. Ele sonda os materiais numa
 * corrente própria de `setTimeout` e lê `properties.get(material).currentProgram`
 * sem guarda (three.module.js:29691-29694). Material descartado durante a
 * sondagem (aqui: `disposeGrupo(florestaEsparsa.group)`, inverno.ts, quando a
 * câmera entra nos 6.000 m da montanha) apaga esse mapa (three.module.js:29393)
 * e o `program.isReady()` ESTOURA DENTRO DO TIMER: o erro escapa de qualquer
 * `try/catch` em volta do `await` e vira `pageerror` (o portão de chapas
 * reprova), e a promessa NUNCA assenta, porque o único reagendamento
 * (three.module.js:29714) está depois do `forEach`. Grupo que depende dela para
 * acender fica invisível para sempre, e no inverno isso ficou MASCARADO porque
 * quem acende aquele grupo é o culler (perf.ts:289-294), não o `revela`.
 *
 * A saída é DIRIGIR a sondagem: `renderer.compile()` é público e devolve o MESMO
 * `Set<Material>` que o `compileAsync` usaria (three.module.js:29588 e 29672), e
 * `renderer.properties` está exposto no renderizador (three.module.js:29000).
 * No laço nosso, `currentProgram === undefined` quer dizer "este material foi
 * embora" e a resposta certa é TIRAR DO SET, nunca estourar. Isso dá de graça o
 * que o `compileAsync` não tem: cancelamento e teto.
 *
 * ⚠️ E POR ISSO ELE PRECISA SER CHAMADO POR FAIXA, NÃO UMA VEZ SÓ. `compile`
 * varre a cena que EXISTE naquele instante. Se chamarmos só antes de abrir,
 * cada peça que a faixa 2 acrescentar depois traz programa novo, e o engasgo
 * volta, agora com a câmera andando, que é o pior lugar para ele aparecer.
 * Aqueça o grupo ANTES de pendurá-lo na cena.
 *
 * ⚠️ SEM A EXTENSÃO, `isReady()` do three devolve true na primeira pergunta, e
 * esta função vira quase um no-op caro: ela não trava, mas também não garante
 * nada. Não dá para depender dela como se fosse sincronização.
 */
// ⚠️ TIPADO FROUXO DE PROPÓSITO, e não por preguiça. Este módulo NÃO importa
// three (é o que permite testá-lo fora do navegador), e os tipos instalados são
// de outra versão: o repo roda three 0.162.0 contra @types/three 0.185.0, que
// entra como dependência TRANSITIVA (package-lock.json) e não está no
// package.json. Amarrar tipo aqui é dívida disfarçada.
type Programa = { isReady: () => boolean }
type ComCompile = {
  compile?: (cena: never, camera: never, alvo?: never) => Set<unknown>
  properties?: { get?: (obj: unknown) => unknown }
}

/** Teto de parede do aquecimento. ⚠️ NÃO É NÚMERO MEDIDO, e não deve ser tratado
 *  como um: é a MESMA doutrina do `TETO_PARSE` de `carga-glb.ts`. Rede contra
 *  pendência eterna, nunca mecanismo de assentamento, e por isso FOLGADO.
 *  O que ESTÁ medido (12/09/2026, /city?stats=1, GTX 1650, extensão presente):
 *  latência de link p50 16.296 ms, p90 43.800 ms, máx 43.887 ms sobre 194
 *  programas, e buracos de fome do temporizador de até 39.281 ms enquanto a
 *  camada perto do inverno constrói. Qualquer teto abaixo de ~45 s VENCE em
 *  desktop com GPU de verdade, e teto que vence por congestionamento devolve o
 *  engasgo que o aquecimento existe para evitar. Se este número começar a vencer
 *  numa conferência, o conserto é MEDIR, não subir o número no escuro. */
export const TETO_AQUECE = 120000

/** Intervalo da nossa sondagem. O three usa 10 ms (three.module.js:29714); 16 ms
 *  é o quadro, e a pergunta (`COMPLETION_STATUS_KHR`) não bloqueia. */
const PASSO_SONDA = 16

/** Sentinela: a API interna que a sondagem lê não existe nesta versão do three. */
const SEM_API = Symbol('aquece:sem-api')

/** ⚠️ O ÚNICO LUGAR DESTA CASA QUE TOCA `renderer.properties`. É API não
 *  documentada (three.module.js:29000), e por isso está isolada aqui com
 *  fallback: se `properties`, `get` ou `currentProgram` não existirem, o laço
 *  assume pronto e LOGA. Reconferir em todo upgrade de three.
 *  Devolve: o programa; `undefined` se o material FOI DESCARTADO durante a
 *  sondagem (three.module.js:29393 apaga o mapa, e `properties.get` recria um
 *  `{}` vazio em vez de devolver undefined, e é por isso que a mensagem do
 *  defeito era "reading 'isReady'" e nunca "reading 'currentProgram'"); ou
 *  `SEM_API`. */
function programaDe(r: ComCompile, material: unknown): Programa | undefined | typeof SEM_API {
  const props = r.properties
  if (!props || typeof props.get !== 'function') return SEM_API
  const mapa = props.get(material) as { currentProgram?: unknown } | null | undefined
  if (!mapa || typeof mapa !== 'object') return SEM_API
  const prog = mapa.currentProgram as { isReady?: () => boolean } | undefined | null
  if (!prog || typeof prog.isReady !== 'function') return undefined
  return prog as Programa
}

export interface AqueceOpts {
  /** Nome do grupo. ⚠️ NÃO É ENFEITE: é o instrumento. Visibilidade NÃO serve de
   *  prova (o culler reescreve `.visible` todo quadro, perf.ts:289-294), então a
   *  única evidência de que um aquecimento assentou é esta linha de log. */
  nome?: string
  /** Enquanto devolver false o aquecimento para e assenta como 'cancelado'.
   *  É o `disposed` de `plaza-scene.tsx`. `compileAsync` não tinha isto. */
  vivo?: () => boolean
  tetoMs?: number
}

export interface RegAquece {
  nome: string
  materiais: number
  /** 'em voo' enquanto sonda; depois 'pronto', 'pronto (N descartado(s)...)',
   *  'teto', 'cancelado', 'sem-api', 'sem-compile' ou 'compile-falhou'. */
  motivo: string
  ms: number
  restaram: number
  descartados: number
  passadas: number
}

/** Registro VIVO dos aquecimentos desta página, publicado em
 *  `window.__plazaAquece` com `?stats=1`. Quem ficar em 'em voo' para sempre é o
 *  pendurado, e isso é leitura de máquina, não palpite. */
export const AQUECIMENTOS: RegAquece[] = []

export async function aquece(
  renderer: unknown,
  cena: unknown,
  camera: unknown,
  trecho?: unknown,
  opts?: AqueceOpts,
): Promise<void> {
  const r = renderer as ComCompile
  const nome = opts?.nome ?? '(grupo sem nome)'
  const teto = opts?.tetoMs ?? TETO_AQUECE
  const t0 = performance.now()
  const reg: RegAquece = { nome, materiais: 0, motivo: 'em voo', ms: 0, restaram: 0, descartados: 0, passadas: 0 }
  AQUECIMENTOS.push(reg)
  const fecha = (motivo: string, resta: number) => {
    reg.motivo = motivo
    reg.ms = Math.round(performance.now() - t0)
    reg.restaram = resta
  }
  if (typeof r.compile !== 'function') {
    fecha('sem-compile', 0)
    console.warn(`[aquece] ${nome}: renderer sem compile(), segui SEM aquecer`)
    return
  }
  let set: Set<unknown>
  try {
    // mesma assinatura que o `compileAsync` usava: trecho primeiro, cena como
    // `targetScene` (é de onde o three tira as LUZES, three.module.js:29599)
    set = r.compile((trecho ?? cena) as never, camera as never, (trecho ? cena : undefined) as never)
  } catch (err) {
    fecha('compile-falhou', 0)
    console.warn(`[aquece] ${nome}: compile() falhou, segui SEM aquecer`, err)
    return
  }
  const n = set.size
  reg.materiais = n
  const motivo = await new Promise<string>((resolve) => {
    const passo = () => {
      if (opts?.vivo && !opts.vivo()) { resolve('cancelado'); return }
      if (set.size === 0) { resolve(reg.descartados ? `pronto (${reg.descartados} descartado(s) na sondagem)` : 'pronto'); return }
      reg.passadas++
      // ⚠️ CÓPIA DO SET e UM `try` POR MATERIAL. O defeito do three é justamente
      // um material derrubar o lote inteiro dentro de um `forEach`
      // (three.module.js:29689): quem sonda por fora não pode herdar isso.
      for (const material of Array.from(set)) {
        let prog: Programa | undefined | typeof SEM_API
        try { prog = programaDe(r, material) } catch { prog = undefined }
        if (prog === SEM_API) { resolve('sem-api'); return }
        // material sem programa = FOI EMBORA (dispose do material, ou
        // renderer.dispose trocando a WeakMap inteira, three.module.js:29313).
        // A resposta é tirar do Set. NUNCA estourar: era este estouro o defeito.
        if (prog === undefined) { set.delete(material); reg.descartados++; continue }
        let pronto = true
        try { pronto = prog.isReady() !== false } catch { pronto = true }
        if (pronto) set.delete(material)
      }
      if (set.size === 0) { resolve(reg.descartados ? `pronto (${reg.descartados} descartado(s) na sondagem)` : 'pronto'); return }
      if (performance.now() - t0 > teto) { resolve('teto'); return }
      setTimeout(passo, PASSO_SONDA)
    }
    passo()
  })
  fecha(motivo, set.size)
  const linha = `[aquece] ${nome}: ${n} materiais, ${motivo}, ${reg.ms} ms`
  if (motivo === 'teto') {
    console.warn(`[aquece] segui SEM aquecer o grupo ${nome} depois de ${reg.ms} ms: `
      + `${set.size} de ${n} materiais não ficaram prontos. O grupo acende assim mesmo, `
      + `porque engasgo de um quadro é melhor que peça invisível. `
      + `Se isto virar rotina, MEÇA a latência de link antes de subir TETO_AQUECE.`)
  } else if (motivo === 'sem-api') {
    console.warn(`${linha}. renderer.properties/currentProgram não existem nesta versão do three: `
      + `o aquecimento virou no-op caro. Reconferir a cada upgrade de three.`)
  } else if (motivo === 'cancelado') {
    console.log(`${linha} (a cena morreu durante a sondagem)`)
  } else if (reg.passadas === 1 && reg.descartados === n && n > 0) {
    console.warn(`${linha}. TODOS os materiais apareceram SEM currentProgram na primeira passada: `
      + `ou a cena descartou o grupo inteiro, ou o campo mudou de nome no three. Reconferir.`)
  } else {
    console.log(linha)
  }
}
