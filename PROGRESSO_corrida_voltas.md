# Corrida da perimetral AN7: o servidor (frente S)

Plano: `assets_carros/projeto/PLANO_CORRIDA_PERIMETRAL.md` (regra do prêmio, padrões propostos, contrato jogo <-> servidor v1).
Cliente: PR #404 do dogcity-mundo (`src/corrida/contrato.ts`, `simulador.ts`, `tracado.ts`). Branch `claude/corrida-voltas`, de `main` em `9b5d083121`.
Regras desta frente: migration só como arquivo (quem aplica é o fundador), nada de deploy, nada de variável de ambiente.

- [S0] worktree reaproveitada (`DogData-v1-corrida`, branch `claude/corrida-voltas`, já em origin/main); `node_modules` é link para o da árvore principal (não entra em commit).
