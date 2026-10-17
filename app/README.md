# Seyyahname AI English Coach v1.0 — Web App

Next.js 16 (TypeScript, Tailwind v4) app for the coach in `../CLAUDE.md`, built as a **static export** for plain shared hosting: the coach logic runs in the browser and a single `api.php` (PIN, file storage, Gemini) does the server work. No Node.js on the server. Install guide: [`../DEPLOYMENT_v1.md`](../DEPLOYMENT_v1.md).

```bash
npm install
npm run dev        # UI on http://localhost:3000 (needs api.php: see "Local development")
npm test           # node --test on src/lib/core (store, SM-2, motivation)
npm run typecheck  # tsc --noEmit
npm run build      # next build (out/) + ../hosting-release.zip
```

Interface: Concept C "Dark Elegance" with a light theme (tokens in `src/app/globals.css`, toggle and persistence in `src/lib/theme.ts`), Turkish UI strings (`src/lib/tr.ts`; learning content stays English).

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
- **Master English Curriculum:** `src/data/curriculum.json` defines 12 sub-bands (A1.1-C2.2), each with grammar targets, lexical domains, 4 Can-Do statements, Turkish L1 interference alerts and speaking scenarios. A Can-Do is mastered after 3 different speaking/writing tasks at 80%+ that the feedback confirms (`can_do_ids`); it is then added to `can_do_mastered` with its curriculum id. When a band's 4 Can-Dos are done, the next band opens (`profile.curriculum`). Engine: `src/lib/core/curriculum.ts`; view: Müfredat & Yol Haritası. `api.php` injects the active band (targets, i+1 language rules, next-band Polish) into Gemini's system instruction.
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
# note: this data/ is a copy; changes made here do not reach the repository's files
php -S localhost:8080
```

## Design system

Concept C "Dark Elegance", defined as CSS variables in `src/app/globals.css`. Dark is the base palette; `<html data-theme="light">` switches to the light one. The default is **Sistem**: the page follows `prefers-color-scheme` live. The Sistem / Koyu / Açık switch in the top bar stores a manual choice in `localStorage['lumos.theme']` that overrides the system (choosing Sistem removes it). An inline script in `layout.tsx` applies it before first paint.

**Layout:** learner sheet and navigation on the left, the active view in the centre and, from 1280px (`xl`), the coach chat as a persistent right-hand column that stays open across views (below that, Koç is a tab). Centre views use container queries (`@container` on `<main>`) so their grids follow the space left by the chat column.

- **Type:** Geist for everything (headings tight at -0.03em), Geist Mono for CEFR codes, figures and meta. Self-hosted via `@fontsource`, no external font requests.
- **Colour:** dark `#0A0A0B` / `#111113` surfaces with `#232327` hairlines and `#EDEDEF` ink; light `#F4F4F5` / `#FFFFFF` with `#18181B` ink. One accent, champagne `#E8C07D` (bronze `#946318` in light), for progress and the CEFR ladder. Meaning colours: emerald = strengths and correct answers, indigo = recasts and phonetics, brick = deletions.
- **Shape:** panels 14px with a coloured hairline on top of the feedback cards, inputs 10px, buttons, badges and tabs fully rounded. Shadows only in the light theme.
- **Motion:** `motion` for state changes only (tab indicator, accordion, score arc, theme switch). Respects `prefers-reduced-motion`.
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
scripts/package-hosting.mjs   Assembles the clean hosting-release/ (static app, PHP, rules.php from CLAUDE.md, data/)
                              and writes ../hosting-release.zip (no zip tool needed)
```
