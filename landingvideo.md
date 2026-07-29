# landingvideo.md — the DogCity launch film for X

Plan for a professional launch video of the DogCity landing page (`/dogcity`),
cut for X. Written 2026-07-29.

---

## 0. TL;DR — the decision

**Build it in Remotion, from deterministic frame captures of the real page plus
the Blender assets we already have. Use Higgsfield sparingly, if at all.**

The single most important fact about this project: **almost all the footage
already exists.** We are not producing a film from nothing — we are *editing*
one. The hero is already a 180-frame rendered time-lapse. The park already has
four cinematic plates. The city already has a master Blender scene with a locked
camera. The work is assembly, timing and sound, not generation.

---

## 1. Tooling audit — verified on this machine, 2026-07-29

| Tool | Status | Notes |
|---|---|---|
| **Blender** | ✅ `5.1.2` | The three scenes below are on disk |
| **Higgsfield CLI** | ✅ `1.1.19`, authenticated | `limadevbtc@proton.me` — **basic plan, 52 credits** |
| **Playwright (MCP)** | ✅ available | Drives a real Chrome; can screenshot deterministically |
| **Remotion** | ❌ **not installed** | Must be added — see §2 for *where* |
| **ffmpeg** | ❌ **not on PATH** | Blocking for any encode done outside Remotion |

### 1.1 Assets already on disk

| Asset | Where | Why it matters |
|---|---|---|
| 180 city-construction frames | `DogData-v1/public/landing/seq/*.webp` (22 MB) | **This is already a video.** Locked camera, city builds itself. The film's spine. |
| City master scene | `blender/dogcity-landing.blend` | New camera moves — flythroughs, push-ins — are possible |
| Anim scene (180 frames) | `blender/dogcity-landing-anim.blend` | The scene that produced the sequence above |
| Runestone park scene | `blender/runestone-park.blend` | The monolith, the boardwalk, the basin |
| 46 stills | `bitcoin-fullstack/*.png` | `RUNESTONE-PARK-{hero,wide,finger,detail}`, `DOGCITY-HERO-*`, `DOGCITY-PHASE-01..05`, plaza, spaceport, commercial ring |
| Runestone GLTF | `DogData-v1/public/runestone3d.gltf` (3.97 MB) | The actual artifact, riggable in Blender |
| The live page | `localhost:3111/dogcity` | The choreography itself is the product |

---

## 2. ⚠️ Hard constraint: where Remotion may be installed

**Remotion must NOT be added to `DogData-v1/package.json`.**

That file is held back with `git update-index --skip-worktree`. Two consequences,
both bad:

1. A local `npm i remotion` there would never reach the committed `package.json`,
   so nothing would change for anyone else — the install would be invisible.
2. If it *did* get committed (the auto-commit bot sweeps the working tree), the
   Vercel build would install a video toolchain it does not need, and — worse —
   this is exactly the failure mode that froze production for ~37h when
   `astronomy-engine` reached the committed manifest without its code.

**Therefore:** the video project lives in its own npm workspace, outside the app:

```
/home/bitmax/Projects/bitcoin-fullstack/video/     ← new, self-contained
  package.json          (remotion + @remotion/cli only)
  src/                  (compositions)
  captures/             (frames pulled from the live page — gitignored)
  out/                  (renders — gitignored)
```

Add `video/node_modules`, `video/captures`, `video/out` to `.gitignore`.
Remotion bundles its own ffmpeg, which also resolves the missing-ffmpeg gap for
this workflow. **If we ever need ffmpeg outside Remotion, it must be installed
separately** (`apt install ffmpeg`) — flag before relying on it.

---

## 3. Why Remotion and not the alternatives

| Approach | Verdict |
|---|---|
| **Remotion** | ✅ **Chosen.** React — the same mental model as the landing. We can literally import the page's own `motion.tsx` easing curve and type scale so the film and the site share a language. Frame-exact, deterministic, re-renderable. Bundles ffmpeg. |
| Playwright real-time screen recording | ❌ as the primary method. Headless Chrome recording drops frames, and a cold load streams 180 webp frames — the capture would show the poster and progressive refinement. Fine as a *reference*, not as the master. |
| **Playwright deterministic frame capture** | ✅ **as a source.** Not recording — *stepping*. Scroll to N exact offsets, screenshot each, feed the sequence to Remotion. Result is perfectly smooth because nothing is real-time. See §5.1. |
| Blender new camera moves | ✅ for the money shots. Real 3D, real light. Slow: **CYCLES CPU only** — EEVEE segfaults headless on this box. Budget generously. |
| Higgsfield | ⚠️ sparingly. 52 credits is not much. Best used for *one* thing, if anything (§6). |
| OBS / screen capture | ❌ not installed, not needed, not deterministic. |

---

## 4. The film — structure

**LOCKED 2026-07-29 by the user:**
- **Primary: 1080×1350 (4:5).** The one that gets posted.
- Secondary: 1920×1080 (16:9) for the reply/thread and the site.
- **With sound.**
- **No new copy is written for the film.** Everything on screen comes from the
  page itself — it is already written there.
- **The live fund figure is shown as-is at render time.** Accepted that this
  dates the video; it is real, and real is the point.

**Length: 35–45 s** (was 30–40; the partners beat below earns the extra seconds).
X autoplays **muted**, so even with sound the film must read completely silent.
Sound is a second layer, never the carrier of meaning.

**Frame rate: 30 fps** (the source sequence is a time-lapse; 60 buys nothing and
doubles render time).

### 4.1 Beat sheet

| # | Beat | Duration | Source | Note |
|---|---|---|---|---|
| 1 | **Cold open — the survey grid** | 0–3 s | `seq/f_0022` onward, held | Empty lunar terrain, faint orange grid. Type: `MARE TRANQUILLITATIS · 0.674°N 23.473°E`. Establishes *this is a real place* before anything else. |
| 2 | **The build** | 3–14 s | `seq/` frames 22→150, retimed | The spine. The city constructs itself. Strongest 11 seconds available, and it already exists. |
| 3 | **The wallet becomes a property** | 14–20 s | Page capture: `#deed` | The deed being issued — scanline, then the sheet unmasking in the district colour. The one moment that is *about the viewer*. |
| 4 | **One city, three chains** | 20–25 s | Page capture: masterplan torch | The torch sweeping the plate. Counters landing on 97,673 / 86,029 / 11,303 / 341. |
| 5 | **The anchors — Kray Tower & BitFlow HQ** | 25–32 s | ⏳ **BLOCKED** — partners section in progress | See §4.2. Real companies with real buildings. This is the credibility beat. |
| 6 | **The park** | 32–38 s | Blender: new camera move on `runestone-park.blend` | The quiet beat. Slow push toward the monolith. *Leave no footprints.* |
| 7 | **Card out** | 38–43 s | Remotion composition | `dogdata.xyz/dogcity` + the live raised figure. Nothing else. |

**Deliberately NOT in the film:** the tier cards, the donation addresses, the
comparison ledger. They are the *page's* job. A launch film sells the place, not
the pricing table.

### 4.2 Beat 5 — institutional partners ⏳ WAITING ON THE USER

The user is building a partners section (`app/dogcity/sections/partners.tsx`,
already wired into `page.tsx` between Masterplan and Park) carrying rendered
**Kray Tower** and **BitFlow HQ**. **Production does not start until it lands** —
the user asked to wait, and the beat is structural, not decorative.

Why it changes the film rather than just adding to it: beats 1–4 argue *this is a
real place with real rules*. Beat 5 is the only one that says *other people have
already committed to it*. That is the strongest thing a launch film can show, and
it is why it sits immediately before the park's quiet close rather than being
tucked in at the end.

Existing assets that may already serve it — to check against whatever the section
ships with:
- `blender/dogcity-landing.blend` — the master city scene, where both towers stand
- `bitcoin-fullstack/city-kray-*.jpeg`, `kray-v3..v6-*.jpeg` — many Kray Tower angles
- `kray-tower-for-tom.zip`, `DOGCITY-commercial-ring*.png`
- Per project memory, BitFlow's tower ("The Set Wave") was built from `bbfbuild.md`
  with brand hex taken from Figma — the film must use those exact brand values.

**Do not proceed past step 3 of §8 until this section is finished.**

---

## 5. Production steps

### 5.1 Capture the page deterministically (the key technique)

Not screen recording. Stepping:

```
for i in 0..N:
    scrollTo(exact offset i)          # instant, not smooth
    wait for the frame to settle      # canvas drawn, reveals fired
    screenshot → captures/page_####.png
```

Three things make this work, and all three are already true of the page:
- The hero's scrub is a pure function of scroll offset — same offset, same frame.
- Reveals are `once: true`, so they fire predictably on first pass.
- The document is 19,000 px tall and the sections are at known anchors.

**Preload gate:** before capturing, wait until all 180 hero frames are decoded
(`performance.getEntriesByType('resource')` filtered on `/landing/seq/`), or the
capture will contain the progressive-refinement poster instead of the city.

**Disable before capturing:** the site's film-grain overlay is fine, but the
mobile CTA bar and the fixed header should be hidden for the clean cut — inject
CSS in the capture harness, do not change the app.

### 5.2 Blender pass (beat 5, optionally beat 2 at higher res)

- `runestone-park.blend`: new 6-second camera move, slow dolly toward the
  monolith, ending just short of the boardwalk's finger.
- **CYCLES CPU.** EEVEE segfaults headless on this machine.
- Render to PNG sequence at 1350 px tall (so the 4:5 cut needs no upscale).
- Budget: this is the long pole. Start it first and let it run while everything
  else is built.

### 5.3 Assemble in Remotion

- Import the landing's easing (`cubic-bezier(0.16, 1, 0.3, 1)`) so cuts and type
  moves feel like the site.
- Type: Syne for display, JetBrains Mono for the technical labels — the same two
  faces the page uses.
- Palette: `#000000` void, `#F56E0F` lava, `#FFAD42` amber, `#F0F0F2` snow.
- Grain + vignette as a top layer, matching the site's own overlay.

### 5.4 Encode

- Remotion → H.264 MP4, yuv420p, ~8–12 Mbps for 1080×1350.
- X accepts MP4/H.264 + AAC, ≤512 MB, ≤2:20 for standard accounts.

---

## 6. Higgsfield — spend or skip

52 credits. Recommendation: **skip for v1.**

The film's strength is that every frame is *real* — real DEM terrain, real
Blender renders, real live numbers. Dropping in a generated shot weakens exactly
the claim the landing spends 500vh establishing.

If we do spend, spend on **one** thing: a 3–4 s cinematic establishing shot of
the Moon before beat 1 (Seedance/`image-to-video` seeded from an existing render).
Rules from prior runs, learned the hard way:
- `--image` is **mandatory**; without it the model goes text-only and wastes credits.
- Style-refs contaminate partial frames (they "complete" the city) — only use a
  style-ref on empty frames or frames identical to the reference.

---

## 7. Sound — confirmed IN

X autoplays muted, so the film is cut silent-first and sound is layered on top of
a cut that already works without it.

Direction: one low sub-bass drone that builds through beat 2 as the city rises,
a floor-drop into the near-silence of the park (beat 6), and a single hit on the
cut to the card. **No music bed. No voiceover.** The page's register is an
instrument panel and a masterplan document — a track with a melody would fight it.

Discrete accents worth having, all tied to something on screen: the survey grid
snapping in, the deed's scanline pass, the counters landing.

Sources: Higgsfield `seed_audio` (text-to-audio) can generate the drone and the
hits — this is a better use of the 52 credits than a generated establishing shot
(§6). Licensed audio is the alternative. Mix to **−14 LUFS**, and check the cut
at 0% volume before signing off.

---

## 8. Order of work

1. `apt install ffmpeg` — or confirm Remotion's bundled binary is sufficient. **Blocking check.**
2. Scaffold `video/` outside the app (§2). Add gitignore entries.
3. Start the Blender park render (§5.2) — longest pole, run it in the background.
4. ⏳ **GATE — wait for the partners section (§4.2).** Nothing past here starts
   until it is finished; the user is building it in parallel and asked us to hold.
5. Build the Playwright capture harness (§5.1); capture beats 3, 4 and 5.
6. Assemble in Remotion; cut the 4:5 master.
7. Sound pass (§7).
8. Export the 16:9 secondary from the same timeline.
9. Review, then post.

Steps 1–3 are safe to run before the gate — they touch nothing the user is
editing. Everything from 5 onward needs the finished section.

---

## 9. Decisions — settled

| Question | Answer (2026-07-29) |
|---|---|
| Aspect | **4:5 primary**, 16:9 secondary |
| Sound | **Yes** — see §7 |
| Copy | **None written for the film.** It is already on the page |
| Live fund figure | **Show it as-is**, dating accepted |
| Higgsfield credits | Spend on **audio**, not on a generated shot |
