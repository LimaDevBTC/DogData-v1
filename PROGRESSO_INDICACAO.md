# PROGRESSO indicação (frente H, 17/11) - apagar no último commit
Worktrees: mint dogcity-mint-wt-reffeed (claude/referral-feed), DogData DogData-v1-rewards (claude/referral-rewards).
- [x] mint: GET /api/mint/cron/referral-feed (Bearer CRON_SECRET, 503 sem segredo), commit 3f74b71, testes ok
- [ ] DogData: migração 043, regras puras + testes, job /api/cron/lot-referrals, GET /api/dogcity/referral-items, ranking
Sem node_modules nos worktrees: symlinks para dogcity-mint-wt-ref e DogData-v1-dc-points (não versionados).
