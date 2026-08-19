# Lista de ajustes da praça (fundador, 2026-08-19)

O quadro de tarefas desta frente. **Toda tarefa entra aqui antes de ser feita** e
sai daqui com o commit que a fechou; é este arquivo que impede a equipe de se
perder entre as tarefas. Regras da casa continuam valendo: nada genérico, cada
peça com razão de existir, licença CC0/CC-BY com crédito em `sf-assets.ts`,
orçamento de triângulos, e o padrão de trabalho (agentes baratos garimpam e
levantam, eu curo, monto e confiro por imagem).

**Contexto que muda o horizonte:** os outros projetos de cidade (cityupdate3.md,
crosschaincity.md, reorganizecity.md, masterplan.md) vão ser MOVIDOS para cá. A
cidade cresce em volta desta praça, que já está em produção. Nada aqui é
provisório.

| # | Tarefa | Estado | Notas |
|---|---|---|---|
| 1 | Escrever **BITFLOW** na face de trás do prédio | **feito** | letreiro em canvas na face −z, mesma altura do da frente |
| 2 | **Padronizar o exterior** da BitFlow e da Kray: têm formas e elementos que não conversam com o entorno | aberto | levantar o que destoa antes de mexer |
| 3 | **Retirar os pináculos brancos pontiagudos** em volta das placas dos fundadores | **feito** | eram o WATER_JET_RING da Needle (raio 81, 30 m); removido, e a animação junto |
| 4 | **Tour virtual inicial** ao entrar na cidade | aberto | usar as vistas do menu Places como roteiro |
| 5 | **Revisar todas as placas**: algumas têm informação cortada | **feito (1ª rodada)** | auditoria automática mediu 15 textos: 4 de risco alto corrigidos (título do White Paper, "PAGE n OF 9", as duas linhas do Círculo dos Fundadores) |
| 6 | **"Live mempool" no topo da página** | aberto | faixa fixa com o feed que já existe |
| 7 | **Tirar o vídeo com scroll da home** (modelos antigos, ultrapassado) | aberto | o hero de 180 quadros da landing |
| 8 | **CTA de doação dentro da cidade** | aberto | ligado ao Círculo dos Fundadores |
| 9 | **Capa na estátua do Leonidas** | aberto | o modelo do Sketchfab não tem capa |
| 10 | **Mais ordinals no parque** + a coleção **Dog Social Club** completa perto da torre Kray | aberto | o PFP do fundador é dessa coleção |
| 11 | **Padronizar o nível das árvores**: nenhuma árvore simples; menos árvores, muito mais detalhadas, emblemáticas. Sai tudo que é genérico (inclusive os coqueiros "murchos" que sobraram) | aberto | hoje há milhares de árvores procedurais |
| 12 | **Atualizar a landing** com fotos novas e criar o **post inicial** | aberto | as chapas atuais são de antes da reforma |
| 13 | **Retirar todos os carros** | **feito** | levantamento achou SITE_TRAFFIC nas duas torres e SP_Taxi0..4 no spaceport; removidos na carga. Ficam as vias (PlazaRingRoad, estrada do parque) |
| 14 | **Templo do Leonidas**: está torto, deve ser **preto e laranja** e ficar **escondido dentro das montanhas**, com caminho secreto | aberto | hoje está sobre o pódio, à vista |

## Ordem de ataque

Primeiro o que é subtração e correção (3, 13, 11, 5), depois o que é peça nova
(1, 2, 9, 14, 10), depois o que é página e narrativa (6, 8, 4, 12, 7).

## Levantamentos concluídos (2026-08-19)

- **Carros**: `SITE_TRAFFIC` (bitflow e kray) e `SP_Taxi0..4` (spaceport). Feito.
- **Placas**: 15 textos medidos; 4 de risco alto corrigidos, o resto dentro da
  margem. Repetir a auditoria quando entrar placa nova.
- **Árvores emblemáticas**: seis candidatos de fotogrametria/alta qualidade
  (oliveira antiga 100k faces, tamareira 40k, cerejeira 284k, árvore retorcida
  845k, bordo japonês 40k, árvore mediterrânea 78k). Entram no item 11 com
  orçamento de triângulos e substituindo as procedurais.
- **Dog Social Club**: **não encontrada** em API pública nenhuma (Magic Eden
  fora do ar no momento, ordinals.com sem a coleção, Hiro descontinuada, ord.io
  não resolve). Precisa do fundador: o **id de uma inscrição** da coleção, ou o
  link da coleção no marketplace que ele usa. Com um id eu puxo o resto pelo
  nosso próprio nó (o repositório tem o `ord`).
