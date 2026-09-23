// ═══════════════════════════════════════════════════════════════════════════
// O OVERRIDE DE PALCO, SÓ DESENVOLVIMENTO. Um lugar só para a conta que TODO
// leitor de `/city/cidade.json`, `/city/cidade-malha.json`,
// `/city/cidade-lotes*.bin` e `/city/cidade-cotas.bin` repetia igual (23/09,
// depois espalhada de novo pela tarefa de selagem fora do git): `?reg=NOME`
// aponta esses quatro arquivos para `public/city/NOME/` em vez de
// `public/city/`, para testar um registro novo (o v4 de teste, ou o palco de
// uma rodada de selagem) sem tocar no que a Vercel publica.
//
// ⚠️ SEM O PARÂMETRO, NADA MUDA. `regBase()` devolve `/city`, o caminho de
// sempre; todo chamador continua montando a URL com o mesmo template
// (`${regBase()}/cidade.json`), então o comportamento padrão é bit a bit
// igual ao de antes de este arquivo existir.
//
// ⚠️ NOME É LIVRE, NÃO SÓ `_v4teste`. A primeira versão (em vias.ts, tecido.ts
// e arborizacao.ts) testava `=== '_v4teste'` à mão, três vezes; a tarefa de
// selagem pediu um palco com nome próprio (fora do git, dentro de
// `public/city/` porque é dali que o navegador serve estático), e o parâmetro
// já aceitava qualquer string, só a comparação estava presa a um valor. Lido
// direto (`get('reg')`), sem lista de nomes válidos: quem aponta para uma
// pasta que não existe recebe 404 do próprio `fetch`, que é o erro certo.
export function regBase(): string {
  if (typeof window === 'undefined') return '/city'
  const nome = new URLSearchParams(window.location.search).get('reg')
  return nome ? `/city/${nome}` : '/city'
}
