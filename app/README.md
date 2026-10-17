# Lumos AI English Coach v1.0 — Web App

Next.js 16 (TypeScript, Tailwind v4) app for the coach in `../CLAUDE.md`, built as a **static export** for plain shared hosting: the coach logic runs in the browser and a single `api.php` (PIN, file storage, Gemini) does the server work. No Node.js on the server. Install guide: [`../DEPLOYMENT_v1.md`](../DEPLOYMENT_v1.md).

```bash
npm install
npm run dev        # UI on http://localhost:3000 (needs api.php: see "Local development")
npm test           # node --test on src/lib/core (store, SM-2, motivation)
npm run typecheck  # tsc --noEmit
npm run build      # next build (out/) + ../hosting-release.zip
```

It reads and writes the same state files as the coach does:

| File | Updated when |
|---|---|
| `profile.json` | Every finished activity and review: sub-bands, Can-Dos, gamification, SRS queue, progress, stats, history |
| `vocabulary.md` | Task key words and feedback upgrades, with SM-2 interval, ease factor, repetitions and next review |
| `error_ledger.md` | Errors from writing/speaking feedback, with count and correct-use streak |
| `sessions/YYYY-MM-DD.md` | A 5-line `## Session Summary` at the top, refreshed after every activity, plus the `## Activity Log` |

## Learning rules (from `../CLAUDE.md`)

Aligned with the **CEFR Companion Volume** (action-oriented Can-Do assessment), the **ACTFL Proficiency Guidelines** (error tolerance by level) and **SM-2** spaced repetition.

- **Sub-bands:** each skill moves A1.1 → A1.2 → A2.1 … after one **Transactional**, one **Interactional** and one **Evaluative** task at its current level, each passed at 80%+ and each a different task (tasks used for A1.1 cannot count again for A1.2). The overall sub-band is the floor of the four skills' average. Every skill has 6+ tasks per level at A1-A2, two of each function; B1-B2 coverage is still partial.
- **Can-Do:** passing a task records the matching Can-Do statement (skill × level × function) in `can_do_mastered`. Statements live in `src/lib/cefr-data.ts` and are shown in Vault → Can-Do.
- **ACTFL tolerance:** at A1-A2, slips that keep the meaning clear cost little and are modelled through a natural **recast**; at B2+ register, idiomaticity and cultural fit are scored.
- **SM-2:** reviews are graded on the quality scale 0-5 (Vault flashcards) or Again / Hard / Good / Easy = 1 / 3 / 4 / 5 (warm-up); q < 3 is a lapse; intervals 1 → 3 → 7 → 14 → 30 days, then × ease factor (starts 2.50, minimum 1.30). A lapse returns to 1 day. The Studio opens with a 3-minute warm-up of up to 6 due words; the sidebar shows words due and the Vault Confidence Index (`src/lib/vault.ts`).
- **Error ledger:** a pattern resolves itself after correct use in 3 later sessions in a row.
- **Motivation:** XP, streak, confidence index (starts at 80), milestones, Frustration Shield after 2 rounds under 60%, Low-Effort Mode, Daily Loot, interest-led themes.
- **Older files:** `profile.json` blocks from earlier versions (`user` / `motivation`) are read and converted on the next save, keeping all data.

## `profile.json`

`overall_cefr`, `sub_band`, `target_cefr`, `skills`, `skill_bands`, `can_do_mastered`, `gamification` (`streak_days`, `xp_total`, `confidence_index`, …), `srs_queue` (derived snapshot of upcoming reviews), `interests`, `progress`, `stats`, `metrics`, `diagnostic`, `history`. Full template in `../CLAUDE.md`, section 6.C.

## Feedback engine

- **Gemini (recommended):** set `GEMINI_API_KEY` in `.env` next to `api.php`. Feedback follows the full `CLAUDE.md` rules (sent as the system instruction) with the learner profile and recurring errors in the prompt, and comes back as JSON against the feedback schema. The Coach chat streams through `api.php`. Model: `GEMINI_MODEL` (default `gemini-flash-latest`).
- **Offline rules (default without a key):** a built-in rule engine for common Turkish-L1 errors (age with "have", 3rd-person -s, articles, prepositions of time, "listen music", …), i+1 vocabulary upgrades, register/cohesion notes, and IPA tips. It only catches known patterns.

## Browser features

- **Listening** uses the Web Speech *synthesis* API (all modern browsers).
- **Speaking** uses Web Speech *recognition* for live dictation (Chrome / Edge; Chrome needs internet for it) and `MediaRecorder` so you can play back your own voice. In other browsers you can record and type the transcript.

## Configuration

`.env` next to `api.php` (or one folder above it, outside the web root). Template: `php/.env.example`.

| Variable | Default | Purpose |
|---|---|---|
| `APP_SECRET_PIN` | none | Master PIN for the lock screen. Required: api.php refuses every request without it |
| `APP_SESSION_SECRET` | empty | Mixed into the `lumos_auth` cookie signature; change it to sign everyone out |
| `GEMINI_API_KEY` | none | Enables the Coach chat and AI feedback |
| `GEMINI_MODEL` | `gemini-flash-latest` | Gemini model id |
| `DATA_DIR` | `data` | Where the state files live (relative to api.php, or absolute) |
| `BASE_PATH` (build time) | empty | Build for a sub-folder, e.g. `BASE_PATH=/coach npm run build` |

## Local development

`npm run dev` serves the UI; for data it calls `api.php` on the same origin. Easiest: build once and serve the release with PHP's built-in server (no `.htaccess` there, so only for local use):

```bash
npm run build && cd hosting-release && cp .env.example .env   # set APP_SECRET_PIN in .env
php -S localhost:8080
```

## Design system

Editorial, warm-paper look, defined as CSS variables in `src/app/globals.css` that switch automatically with the system light/dark setting.

- **Type:** Newsreader (serif, optical sizes) for reading texts, prompts, feedback and headings; Geist for the interface; Geist Mono for CEFR codes and figures. All self-hosted via `@fontsource`, no external font requests.
- **Colour:** warm stone paper surfaces and deep slate ink. Interactive elements use ink; colour only carries meaning: amber = A levels and hints, emerald = B levels and correct answers, indigo = C levels and phonetics, brick = errors.
- **Shape:** panels 16px, inputs 10px, buttons, badges and tabs fully rounded.
- **Motion:** `motion` for state changes only (tab indicator, accordion, score arc, entries). Respects `prefers-reduced-motion`.
- **Icons:** Phosphor.

## Structure

```
src/app/                 Static export: page.tsx (studio + lock screen), layout.tsx, globals.css
src/api.ts               Data layer: runs the coach store on the files from api.php, saves after every change
src/lib/remote-fs.ts     In-memory copy of the files, synced with ?action=get_state / save_state (versioned)
src/lib/core/            Coach logic, shared with the tests: store (sub-bands, ledger, sessions), srs (SM-2 0-5),
                         motivation, schema, markdown (table parser), heuristics (offline engine), feedback (Gemini JSON)
src/lib/                 cefr-data, vault stats, diff
src/components/          CoachApp, Sidebar, Studio (Reading / Writing / Listening / Speaking), FeedbackCard,
                         Flashcards (0-5), WarmUp, CoachChat, Gatekeeper, Vault, SessionsView
src/data/tasks.ts        Task bank by CEFR level (A1–B2); add tasks here
php/                     api.php, config.php, .htaccess, .env.example: the shared-hosting server side
scripts/package-hosting.mjs   Assembles hosting-release/ and writes ../hosting-release.zip (no zip tool needed)
```
