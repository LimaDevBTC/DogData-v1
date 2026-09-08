# Força tarefa da Sphere

Registro dos achados dos especialistas. Este arquivo é CHECKPOINT: cada rodada
custa centenas de milhares de tokens e a rodada 1 perdeu 8 de 9 agentes no limite
de sessão. O que está aqui não se paga duas vezes.

Transcrições completas (um JSON por agente, com o retorno inteiro):
`~/.claude/projects/-home-bitmax-Projects-bitcoin-fullstack/<sessão>/subagents/workflows/<run>/journal.jsonl`

- rodada 1: `wf_57f1f65c-0cb` (1 de 9 concluiu)
- rodada 2: `wf_89c2c49f-c1c`

---

## Rodada 1, arquitetura de conteúdo: o registro de longe

O único agente que terminou. Três achados críticos.

### 1. O registro de longe nunca mostrou um valor inteiro, de azimute nenhum

Não é defeito de implementação, é aritmética. Com 16 casas na volta e um valor de
7 caracteres, `repetirNaVolta` produz 2 cópias de período 8. A janela legível de
um azimute satura em `casas/3` = 5,33 casas, porque o arco com compressão de
largura acima de 0,5 satura em 120°. Para ver uma cópia inteira são precisas 7
casas. **5,33 < 7, em qualquer distância, para sempre.**

Fração de azimutes com o valor de 7 caracteres INTEIRO à vista, tela da live:

| registro | 300m | 620m | 799m | 1500m | 3000m | 4734m | 7520m |
|---|---|---|---|---|---|---|---|
| esc 8 (32 casas) | 0% | 14% | 21% | 33% | 39% | **42%** | 43% |
| esc 10 (24 casas) | 0% | 0% | 0% | 3% | 8% | 9% | 11% |
| esc 12 (21 casas) | 0% | 0% | 0% | 0% | 0% | 0% | 0% |
| esc 16 (16 casas) | 0% | 0% | 0% | 0% | 0% | 0% | **0%** |

Modelo validado contra o número já publicado no próprio arquivo: em D/R = 3,21
devolve 11,1% contra os 13% que `sphere.ts:637` mediu para a esfera de 196 m.

### 2. O invariante que fecha a questão

Numa fonte 5x7 sobre grade equirretangular, casas por volta e altura da letra são
inversamente acopladas:

    casas x altura = 1,75 x π x R

Ele não depende da grade (COLS e ROWS se cancelam), só de R. **Toda tentativa de
comprar alcance vende janela de leitura**, e a janela já é o gargalo. A escala 8 é
o único ponto da curva em que um valor de 7 caracteres chega a aparecer inteiro.

Portanto: registro único, escala 8 mais escala 4, sem troca. Aceitar o limite e
deixar a faixa virar anel liso além dele.

### 3. A troca disparava com a câmera PARADA

`distTexto` sai de `uPxAng`, que vem de `spherePxAng(fov, alturaCss, governor.pixelRatio)`.
O `FrameGovernor` mexe no `pixelRatio` sozinho por carga de quadro, em passos de
x0,9 e x1,08. **A amplitude que ele percorre é maior que a banda morta da
histerese**, então o layout trocava sem ninguém mover a câmera: bastava a taxa de
quadro cair. Pior que a queixa do fundador.

### Mapa de remoção (linhas da época; conferir antes de aplicar)

Sai: o bloco de doc e `FX_LONGE_ESCALA`; `FX_MARGEM` fica morto; `SPHERE_CHARS_LONGE`
(exportado, zero consumidores); o parâmetro `longe` de `pintarTextura`; o ramo
`if (longe)`; `let longe`; o bloco `queroLonge`.

Muda: `FX_MARGEM_PERTO` volta a ser `FX_MARGEM`; `uTextoDist` deixa de dobrar; o
degrau de fillrate deixa de usar `distTexto * 2`.

⚠️ **Duas coisas que não podem quebrar junto.** Primeira: o degrau de fillrate no
celular hoje nunca entra (dá 17.981 m, além do `sphereCull` de 14.000) e passa a
entrar em 8.991 m; dentro da cidade nada muda, mas a vista `montanharasante`
(12.631 m) passa a usar o material liso. Segunda: a faixa tem 128 linhas e o
comentário diz que foi "para caber o registro de longe". Tirado o registro, o
próximo leitor encolhe de volta para 108 e move o texto. A razão nova é melhor e
precisa ficar escrita: com margem 18 o miolo da linha grande cai na linha 414, a
2,18 m do centro óptico da silhueta.

### 4. Os comentários do arquivo estão mentindo desde que a esfera cresceu

Publicados para a esfera de 196 m, e nunca remedidos. Com a peça em 401,0 m:

| | comentário diz | é |
|---|---|---|
| passo do LED | 30,07 cm | **61,51 cm** |
| letra grande | 16,84 m | **34,45 m** |
| letra pequena | 8,42 m | **17,22 m** |
| alcance na tela da live | 2.757 m | **5.639 m** |

`SPHERE_PASSO`, `SPHERE_LETRA_ALTURA` e `SPHERE_TEXTO_PX` precisam de revisão.
