import { permanentRedirect } from "next/navigation"

// ═══════════════════════════════════════════════════════════════════════════
// /donate: APOSENTADA em 27/08/2026.
//
// Esta rota servia a landing antiga de crowdfunding ("The city can't be
// bought. It can be built."), que o fundador encerrou porque a landing atual
// em /dogcity ja faz tudo o que ela fazia: o mesmo fundo lido da mesma
// /api/donate/leaderboard, o mesmo plot deed por carteira, a mesma escada de
// licencas e os mesmos parceiros.
//
// O que era exclusivo dela foi movido antes de apagar, e nao se perdeu:
//   · REGISTRO DE FUNDADORES (por chegada e por volume) virou a secao
//     app/dogcity/sections/founders-register.tsx, ancorada em /dogcity#founders
//   · "Don't trust. Verify." (a tesouraria conferivel) entrou no fim dos
//     metodos de pagamento em app/dogcity/sections/construction-fund.tsx,
//     agora apontando pra nossa propria pagina de endereco
//   · plot-map.tsx, que a secao do deed ja importava daqui, mudou de casa pra
//     app/dogcity/sections/plot-map.tsx
//
// A rota CONTINUA existindo de proposito, so que como redirecionamento: o
// endereco /donate foi divulgado, esta em post e em conversa, e devolver 404
// pra quem chega por um link antigo perde justamente a pessoa que veio doar.
// Redirecionamento permanente (308) para o fundo dentro da landing.
// ═══════════════════════════════════════════════════════════════════════════

export default function DonateRetired() {
  permanentRedirect("/dogcity#build")
}
