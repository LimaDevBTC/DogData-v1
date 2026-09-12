// ═══════════════════════════════════════════════════════════════════════════
// carga-glb.ts — A CARGA DE GLB DESTA CENA, COM DOIS RELÓGIOS SEPARADOS.
//
// HISTÓRICO MEDIDO (não re-descubra, está tudo registrado em `inverno.ts`):
//   03/09  `gltf.load()` de arquivo Draco podia disparar e NUNCA voltar (nem
//          sucesso, nem erro, nem progresso). Isso acontece DEPOIS que o
//          arquivo chegou: é DECODIFICAÇÃO, não rede. Nasceu daí o teto.
//   06/09  o teto de 8 s derrubava as 11 espécies da floresta com os arquivos
//          sendo servidos em 2 ms por `curl`: STARVATION DA THREAD PRINCIPAL.
//          O teto virou 45 s e a carga virou fila de dois.
//   11/09  ainda caiu 1 de 12: `sq-med-4.glb` (154.160 bytes, medido no disco)
//          com "sem resposta em 45000 ms". 154 KB do `next dev` não levam 45 s
//          de rede: o que estourou foi o relógio de PAREDE cobrindo rede,
//          parse Draco e callback na mesma corrida.
//
// A REGRA QUE SAI DAQUI, e vale para qualquer GLB desta cena:
//   REDE   teto CURTO e CANCELÁVEL DE VERDADE (`controller.abort()`, que mata
//          também o corpo em voo). Estourar aqui significa rede, e a mensagem
//          pode dizer isso sem mentir.
//   PARSE  relógio de parede FOLGADO, que existe SÓ contra o defeito de 03/09
//          (decodificador que não volta). NÃO é medida de congestionamento:
//          thread ocupada tem de caber dentro dele sem falhar.
//
// ⚠️ O PARSE NÃO É CANCELÁVEL. O three 0.162 não expõe cancelamento
// (`FileLoader.js:80` traz o comentário literal "An abort controller could be
// added within a future PR"). Vencido o teto de parse, o trabalho continua vivo
// em segundo plano e o resultado é descartado. É o preço de não travar para
// sempre, e é por isso que o teto de parse é folgado: ele nunca deve vencer por
// congestionamento, só por defeito.
// ═══════════════════════════════════════════════════════════════════════════
import { LoaderUtils } from 'three'
import type * as THREE from 'three'
import type { GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

/** Teto da REDE. Herdado do `TETO_CARGA` de 06/09: é o único valor desta casa
 *  com medição por trás. Encurtar exige medir no PERFIL DE CELULAR contra os
 *  arquivos do ESPELHO, que são MAIORES por peça (`rocks-stylized-pack.glb`:
 *  42.060 bytes no original contra 62.072 no espelho), nunca contra o
 *  `next dev` do desktop. */
export const TETO_REDE = 45000

/** Teto do PARSE. ⚠️ NÃO É NÚMERO MEDIDO, e não deve ser tratado como um: é
 *  rede de segurança contra o Draco de 03/09 (pendência eterna). Só deve vencer
 *  quando algo está de fato quebrado. Se ele começar a vencer numa conferência
 *  de chapa, o conserto NÃO é subir o número, é achar o worker. */
export const TETO_PARSE = 120000

export interface TetosGlb { rede?: number; parse?: number }

export interface MedidaCarga {
  /** a URL como o chamador pediu (a que vai nos rótulos e nos erros) */
  url: string
  /** a URL realmente pedida, depois do `setURLModifier` (espelho KTX2) */
  urlReal: string
  bytes: number
  redeMs: number
  parseMs: number
}

/** REDE, e só rede: do início da requisição ao último byte do corpo.
 *
 *  ⚠️ `controller.abort()` NO TIMER, NÃO UM `Promise.race` CONTRA O `fetch()`.
 *  `fetch` resolve nos CABEÇALHOS; os bytes do GLB vêm no `arrayBuffer()`. Um
 *  race contra a primeira promessa deixaria um corpo travado no meio escapar do
 *  teto, que é exatamente o defeito que estamos consertando.
 *
 *  ⚠️ `if (!res.ok) throw`: `fetch` NÃO rejeita em 404 (o `FileLoader` do three
 *  é que trata qualquer status fora de 200/0 como erro, FileLoader.js:91 e
 *  :163). Sem isto, a página HTML de 404 do Next entraria no `parseAsync` e o
 *  erro sairia como "Unexpected token '<'", apagando o status. E 404 de espelho
 *  é modo de falha vivo: a lista `CIDADE_ESPELHADA` (plaza-scene.tsx) é escrita
 *  à mão e tem de casar com `CIDADE_COM_TEXTURA` (scripts/city/ktx2.mjs). */
export async function baixarComTeto(url: string, ms: number, rotulo: string): Promise<ArrayBuffer> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    if (!res.ok) throw new Error(`${rotulo}: HTTP ${res.status} em ${url}`)
    return await res.arrayBuffer()
  } catch (e) {
    if ((e as { name?: string } | null)?.name === 'AbortError') {
      throw new Error(
        `${rotulo}: a REDE não entregou ${url} em ${ms} ms, requisição abortada. `
        + `Isto agora é rede de verdade: o parse tem relógio próprio. Confira se o arquivo `
        + `existe em public/ e, no perfil de celular, se o ESPELHO tem este nome.`)
    }
    throw e
  } finally {
    clearTimeout(timer)
  }
}

/** Relógio de parede puro, sem cancelamento, para a metade que o three não
 *  deixa cancelar. Limpa o timer quando a promessa assenta, para não manter o
 *  processo acordado nem logar depois do fato. */
function comTetoDeParede<T>(p: Promise<T>, ms: number, msg: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const relogio = new Promise<T>((_res, rej) => { timer = setTimeout(() => rej(new Error(msg)), ms) })
  return Promise.race([p.finally(() => { if (timer) clearTimeout(timer) }), relogio])
}

/**
 * Carrega um GLB com os DOIS relógios, usando a MESMA instância de loader da
 * cena (Draco, KTX2 e gerente de URL vêm de lá).
 *
 * ⚠️ `gltf.manager.resolveURL()` É OBRIGATÓRIO, NÃO ZELO. Quem aplica o
 * `setURLModifier` do espelho KTX2 é o `FileLoader` DENTRO do `load()`
 * (FileLoader.js:29-31), não o `GLTFLoader`. Um `fetch(url)` cru serviria ao
 * celular o acervo ORIGINAL, sem erro nenhum, só VRAM: é a queda de memória que
 * já foi medida e consertada nesta cena.
 * ⚠️ A ORDEM É A DO `FileLoader`: `this.path + url` PRIMEIRO, `resolveURL`
 * DEPOIS. Hoje as duas ordens coincidem porque `setPath` não é chamado em
 * nenhum lugar de `app/city/plaza`; se alguém chamar um dia, esta ordem é que
 * está certa.
 *
 * ⚠️ O `base` DO `parseAsync` SAI DA URL ORIGINAL, NUNCA DA RESOLVIDA. É o que
 * o `load()` faz (GLTFLoader.js:193-203, `extractUrlBase` sobre a url antes de
 * qualquer resolução). Hoje é inerte (zero `uri` externa nos GLB desta casa), e
 * é justamente por isso que a regressão seria CALADA: `loadTexture` tem
 * `.catch(() => null)` e `assignTexture` aceita null, ou seja material sem mapa
 * e nenhuma linha no console, no dia em que alguém exportar textura separada.
 *
 * ⚠️ `itemStart`/`itemEnd`/`itemError` À MÃO, E NÃO POR CONTABILIDADE. O
 * comentário do three, na linha acima da chamada (GLTFLoader.js:206-208), diz o
 * porquê: o item externo garante que `manager.onLoad()` NÃO dispare cedo. As
 * texturas embutidas do GLB registram no MESMO gerente durante o parse
 * (`ImageBitmapLoader(options.manager)`), e `sq-med-4.glb` tem 3 imagens,
 * `sq-rh.glb` tem 5. Sem o item externo, o par `itemStart`/`itemEnd` de cada
 * textura iguala `itemsLoaded` a `itemsTotal` e o gerente "fecha" no meio do
 * parse de cada árvore. Hoje ninguém escuta o gerente (só `setURLModifier`),
 * então isto é o que impede a mina, não o que conserta um defeito de hoje.
 * `itemEnd` vai no `finally`: se ficar preso, qualquer `onLoad` futuro nunca
 * dispara, que é a falha oposta e pior.
 */
export async function carregarGlb(
  gltf: GLTFLoader, url: string, rotulo: string,
  tetos: TetosGlb = {}, aoMedir?: (m: MedidaCarga) => void,
): Promise<GLTF> {
  const tetoRede = tetos.rede ?? TETO_REDE
  const tetoParse = tetos.parse ?? TETO_PARSE
  const urlReal = gltf.manager.resolveURL((gltf.path ?? '') + url)
  const base = gltf.resourcePath !== ''
    ? gltf.resourcePath
    : gltf.path !== ''
      ? LoaderUtils.resolveURL(LoaderUtils.extractUrlBase(url), gltf.path)
      : LoaderUtils.extractUrlBase(url)

  gltf.manager.itemStart(url)
  try {
    const t0 = performance.now()
    const bytes = await baixarComTeto(urlReal, tetoRede, rotulo)
    const redeMs = performance.now() - t0

    const t1 = performance.now()
    const g = await comTetoDeParede(
      gltf.parseAsync(bytes, base), tetoParse,
      `${rotulo}: o PARSE não terminou em ${tetoParse} ms (${bytes.byteLength} bytes já baixados em `
      + `${redeMs.toFixed(0)} ms de rede). Aqui só cabe decodificador travado: worker Draco que não `
      + `responde, ou /draco/ e /basis/ que não foram baixados. Thread principal ocupada NÃO deve `
      + `chegar neste teto. O trabalho continua vivo em segundo plano: o three não cancela parse.`,
    )
    const parseMs = performance.now() - t1
    aoMedir?.({ url, urlReal, bytes: bytes.byteLength, redeMs, parseMs })
    return g
  } catch (e) {
    gltf.manager.itemError(url)
    throw e
  } finally {
    gltf.manager.itemEnd(url)
  }
}

/** Açúcar para quem só quer a cena (é o que os quatro chamadores do inverno
 *  faziam com `gltf.load(url, (g) => res(g.scene), ...)`). */
export async function carregarCenaGlb(
  gltf: GLTFLoader, url: string, rotulo: string,
  tetos: TetosGlb = {}, aoMedir?: (m: MedidaCarga) => void,
): Promise<THREE.Group> {
  return (await carregarGlb(gltf, url, rotulo, tetos, aoMedir)).scene
}
