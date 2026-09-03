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
 * `compileAsync` faz o contrário: dispara todas as compilações e pergunta com
 * `COMPLETION_STATUS_KHR`, que é a consulta NÃO bloqueante da extensão
 * `KHR_parallel_shader_compile`. O driver compila várias em paralelo, em
 * segundo plano, e nós esperamos numa Promise.
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
// ⚠️ TIPADO FROUXO DE PROPÓSITO, e não por preguiça. A assinatura real do
// three é `compileAsync(scene: Object3D, camera: Camera, targetScene?: Scene)`,
// e ela NÃO aceita `Scene | null` no terceiro parâmetro em todas as versões dos
// tipos. Amarrar aqui obriga este módulo a importar THREE só para um tipo, num
// arquivo que hoje não depende de three nenhum e por isso pode ser testado
// fora do navegador. O `unknown` no lugar de `object` é o que faz um
// `WebGLRenderer` de verdade encaixar: `object` não aceita o tipo nominal.
type ComCompile = {
  compileAsync?: (cena: never, camera: never, alvo?: never) => Promise<unknown>
}

export async function aquece(
  renderer: unknown,
  cena: unknown,
  camera: unknown,
  trecho?: unknown,
): Promise<void> {
  const r = renderer as ComCompile
  if (typeof r.compileAsync !== 'function') return
  try {
    await r.compileAsync((trecho ?? cena) as never, camera as never, (trecho ? cena : undefined) as never)
  } catch (err) {
    // ⚠️ AQUECER NUNCA PODE DERRUBAR A CIDADE. É otimização: se falhar, o
    // caminho normal do render compila do mesmo jeito, só que travando.
    console.warn('[obra] aquecimento de shader falhou, seguindo sem ele', err)
  }
}
