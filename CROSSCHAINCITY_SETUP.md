# CrossChainCity — operator setup

Implements `crosschaincity.md` (Blocks A–E). The code ships **safe by default**: until
you run the steps below, `/api/city/data` falls back to the v3 generator and the page
looks exactly as it does today. The registry only takes over once it's populated.

## 1. Create the tables (once)

Run in the Supabase SQL editor:

```
migrations/006_dogcity_lots.sql
```

Creates `dogcity_lots` (permanent lots), `dogcity_cursors` (transactional lot
allocation), `dogcity_events` (the breathing event ring) and the
`dogcity_reserve_lots()` RPC.

## 2. Backfill the registry (once)

Populates every current holder's permanent lot. BTC is fully offline; SOL/STX pull
the top holders from the live API (start `npm run dev` first, or point at prod):

```bash
# BTC + SOL + STX (needs the app running for SOL/STX)
npx tsx scripts/dogcity_backfill.ts

# BTC only, fully offline
npx tsx scripts/dogcity_backfill.ts --btc-only
```

Idempotent — re-running only mints addresses that don't yet have a lot.
After it runs, `/api/city/data` serves `meta.source: "registry"` with 3 zones.

## 3. Hourly delta job (the city breathes — BLOCO C)

Just after each hourly snapshot (~min 28), commit the diff so buildings
construct/implode/resize and the client can animate them:

```
GET /api/city/deltas?commit=1&key=$CITY_DELTA_SECRET
```

Set `CITY_DELTA_SECRET` in the env to protect it (optional but recommended). Wire it
to cron/systemd, e.g.:

```cron
28 * * * * curl -s "http://localhost:3000/api/city/deltas?commit=1&key=$CITY_DELTA_SECRET" >/dev/null
```

The live client polls `GET /api/city/deltas?since=<id>` (breathing) and
`GET /api/city/txfeed` (vehicles) on its own.

## 4. Visual QA (required — real GPU)

Per the project's sacred rule (no headless screenshots → OOM), QA the 3D layer on a
real GPU via the Playwright MCP: open `/city/explore` and check
- the three zones render (BTC core + SOL/STX islands across the water),
- TX vehicles appear and are clickable (car/truck/heli by value, tinted by chain),
- delta pillars play after a commit (green construct / red implode / pulse resize).

Island placement + fog reach are tuned in `city-3d.tsx` (`zoneReach`); adjust
`ZONE_CENTERS` in `lib/city/zones.ts` if you want the islands nearer/farther.

## Files

| File | Role |
|---|---|
| `migrations/006_dogcity_lots.sql` | tables + transactional allocator (BLOCO A) |
| `lib/city/zones.ts` | deterministic geometry: zones, spiral minting, street names (A + E) |
| `lib/city/registry.ts` | Supabase read/write, resolve, diff engine (A + C) |
| `lib/city/snapshots.ts` | per-chain holder snapshots for the diff |
| `scripts/dogcity_backfill.ts` | initial migration over the 3 chains (A.4) |
| `app/api/city/data/route.ts` | registry-first reader + 3 zones, legacy fallback (B) |
| `app/api/city/deltas/route.ts` | commit (cron) + poll (client) events (C) |
| `app/api/city/txfeed/route.ts` | TX → lot resolution, vehicle class by value (D) |
| `app/city/explore/tx-layer.ts` | client overlay: vehicles + breathing pillars (D + C) |
| `app/city/explore/city-3d.tsx` | wiring: layer, TX panel, island fog/camera reach |

## Notes / scope

- **Layout change:** building positions are now permanent facts (spiral per district),
  replacing the old `sort(dog)→plot` road-grid alignment — this is the inversion the
  plan calls for. Roads/water/parks still render as environment.
- **SOL/STX are top-N** from the live sources, so their snapshots are treated as
  *partial*: the diff never implodes a wallet a partial snapshot simply didn't list.
- **Ambient traffic recede** (BLOCO D.6) is left as-is; TX vehicles ride on top with a
  special glow. Tuning ambient density against live TX volume is a follow-up.
