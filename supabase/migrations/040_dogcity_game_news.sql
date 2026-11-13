-- Migration 040: DogCity game news (feature cards shown at login, with a button that takes the player there).
-- NOT APPLIED YET. The founder applies it in the Supabase SQL Editor BEFORE merging the PR that adds the routes.
--
-- Two small tables behind /api/game/news, /api/game/news/seen and /api/game/news/click (see lib/game/news.ts):
--   dogcity_game_news       one row per card. Content lives here, so a new card never needs a game deploy. The game
--                           resolves the picture as url('novidades/<image>.webp') and the button through its own
--                           registry of destinations (cta.destino). texts holds one object per locale, "en" required:
--                           {"en": {"title","body","cta"}, "pt-BR": {...}, ...}. Limits (title 60, body 160, cta 24
--                           characters) are enforced by the route, not by the database.
--   dogcity_game_news_seen  one row per (wallet, card): seen_at when the card was shown, clicked_at when the player
--                           pressed the button. The primary key makes both POSTs idempotent.
--
-- Written and read ONLY by server routes (service role). RLS on, ZERO policies, like 033/034/036/037/038/039:
-- the anon role sees nothing. The card content is public by design (GET /api/game/news is open), but it is served
-- by the route, never straight from the table. Wallet addresses already live in dogcity_profiles; no new personal
-- data. Public repo: no secret here.
--
-- Safe order: apply BEFORE merging the code. Without the tables the routes answer 500 and the game simply shows no cards.
--
-- Seed: the Marina boats card (published) and the DOG MOTORS card (NOT published: the founder flips published to
-- true when the showroom is live). "on conflict do nothing" keeps a re-run from overwriting later edits.

create table if not exists public.dogcity_game_news (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9_-]{2,63}$'),
  tag text not null check (tag in ('new', 'event', 'update')),
  priority int not null default 0,              -- higher shows first; the highest active card is the hero
  starts_at timestamptz not null default now(),
  ends_at timestamptz,                          -- null = no end
  audience text[] not null default '{all}',     -- subset of {all,guest,no_lot,lot,licence}; the game filters on it
  image text not null check (image ~ '^[a-z0-9_-]{3,64}$'),
  cta jsonb not null default '{}'::jsonb,       -- {"destino": "<id in the game's destinations registry>"}
  texts jsonb not null,                         -- {"en": {"title","body","cta"}, "pt-BR": {...}, ...}; "en" required
  published boolean not null default false,
  created_at timestamptz not null default now(),
  check (cardinality(audience) > 0 and audience <@ array['all', 'guest', 'no_lot', 'lot', 'licence']),
  check (coalesce(jsonb_typeof(texts -> 'en'), '') = 'object')
);

alter table public.dogcity_game_news enable row level security;

create table if not exists public.dogcity_game_news_seen (
  wallet text not null check (length(wallet) between 26 and 90),
  news_id text not null references public.dogcity_game_news(id) on delete cascade,
  seen_at timestamptz not null default now(),
  clicked_at timestamptz,
  primary key (wallet, news_id)
);

alter table public.dogcity_game_news_seen enable row level security;

-- Belt and braces: RLS with zero policies already hides the rows; also take the table grants away from the
-- client roles, so only the service role (server routes) touches them.
revoke all on table public.dogcity_game_news from anon, authenticated;
revoke all on table public.dogcity_game_news_seen from anon, authenticated;

-- Seed 1: boats come with every licence. Published.
insert into public.dogcity_game_news (id, tag, priority, starts_at, image, cta, audience, texts, published)
values (
  'marina-boats', 'new', 100, now(), 'marina_barcos',
  '{"destino": "marina_publica"}'::jsonb,
  '{all}',
  $json$
  {
    "en": {
      "title": "Boats are here",
      "body": "Every licence now comes with its own boat: Runabout, Cruiser or Yacht. Call yours at the Marina and take it out on the bay.",
      "cta": "Go to the Marina"
    },
    "pt-BR": {
      "title": "Os barcos chegaram",
      "body": "Cada licença agora vem com o seu próprio barco: Runabout, Cruiser ou Yacht. Chame o seu na Marina e saia pela baía.",
      "cta": "Ir para a Marina"
    },
    "es": {
      "title": "Los barcos ya están aquí",
      "body": "Cada licencia incluye ahora su propio barco: Runabout, Cruiser o Yacht. Llama al tuyo en la Marina y sal a la bahía.",
      "cta": "Ir a la Marina"
    },
    "it": {
      "title": "Le barche sono arrivate",
      "body": "Ogni licenza include ora la sua barca: Runabout, Cruiser o Yacht. Chiama la tua alla Marina ed esci in baia.",
      "cta": "Vai alla Marina"
    },
    "de": {
      "title": "Die Boote sind da",
      "body": "Jede Lizenz enthält jetzt ein eigenes Boot: Runabout, Cruiser oder Yacht. Ruf deins an der Marina und fahr damit auf die Bucht hinaus.",
      "cta": "Zur Marina"
    },
    "fr": {
      "title": "Les bateaux sont arrivés",
      "body": "Chaque licence inclut désormais son propre bateau : Runabout, Cruiser ou Yacht. Appelez le vôtre à la Marina et prenez la baie.",
      "cta": "Aller à la Marina"
    },
    "zh-CN": {
      "title": "船来了",
      "body": "每份许可证现在都附带一艘专属船只：Runabout、Cruiser 或 Yacht。在码头召唤你的船，驶向海湾吧。",
      "cta": "前往码头"
    },
    "ja": {
      "title": "ボートが登場",
      "body": "ライセンスごとに専用ボートが付きます。Runabout、Cruiser、Yacht。マリーナで呼び出して、湾へ出かけましょう。",
      "cta": "マリーナへ行く"
    }
  }
  $json$::jsonb,
  true
)
on conflict (id) do nothing;

-- Seed 2: the DOG MOTORS showroom. NOT published: flip published to true when the building is live.
insert into public.dogcity_game_news (id, tag, priority, starts_at, image, cta, audience, texts, published)
values (
  'dog-motors', 'new', 110, now(), 'dog_motors',
  '{"destino": "dog_motors"}'::jsonb,
  '{all}',
  $json$
  {
    "en": {
      "title": "DOG MOTORS is open",
      "body": "The city's supercar showroom is live. Walk the Salon, pick your car and take it for a test drive on the DOG RING.",
      "cta": "Test drive now"
    },
    "pt-BR": {
      "title": "A DOG MOTORS abriu",
      "body": "O showroom de supercarros da cidade está no ar. Percorra o Salão, escolha o seu carro e faça um test drive no DOG RING.",
      "cta": "Test drive agora"
    },
    "es": {
      "title": "DOG MOTORS ya está abierta",
      "body": "El showroom de superdeportivos de la ciudad ya está en marcha. Recorre el Salón, elige tu coche y pruébalo en el DOG RING.",
      "cta": "Probar ahora"
    },
    "it": {
      "title": "DOG MOTORS è aperta",
      "body": "Lo showroom di supercar della città è attivo. Percorri il Salone, scegli la tua auto e provala sul DOG RING.",
      "cta": "Prova subito"
    },
    "de": {
      "title": "DOG MOTORS ist eröffnet",
      "body": "Der Supersportwagen-Showroom der Stadt ist live. Geh durch den Salon, such dir dein Auto aus und fahr es Probe auf dem DOG RING.",
      "cta": "Jetzt Probe fahren"
    },
    "fr": {
      "title": "DOG MOTORS est ouvert",
      "body": "Le showroom de supercars de la ville est en ligne. Parcourez le Salon, choisissez votre voiture et essayez-la sur le DOG RING.",
      "cta": "Essayer maintenant"
    },
    "zh-CN": {
      "title": "DOG MOTORS 开业了",
      "body": "城市超跑展厅正式上线。逛逛展厅，挑选你的爱车，并在 DOG RING 上试驾。",
      "cta": "立即试驾"
    },
    "ja": {
      "title": "DOG MOTORS オープン",
      "body": "街のスーパーカーショールームが公開されました。サロンを歩いて車を選び、DOG RING で試乗しましょう。",
      "cta": "今すぐ試乗"
    }
  }
  $json$::jsonb,
  false
)
on conflict (id) do nothing;
