# Lumos AI English Coach v1.0 — Web App

Next.js 16 (App Router, TypeScript, Tailwind v4) app for the coach in `../CLAUDE.md`. It reads and writes the same state files as the coach does, so everything you do in the browser lands in your project files. Builds to a self-contained Node.js server (`output: 'standalone'`) for your own host: see [`../DEPLOYMENT_v1.md`](../DEPLOYMENT_v1.md).

```bash
npm install
npm run dev        # http://localhost:3000, reads the files in the repository root
npm test           # node --test on src/lib/server (store, SM-2, motivation, auth)
npm run typecheck  # tsc --noEmit
npm run build      # next build + assemble .next/standalone (static, public, data, PM2 config)
```

| File | Updated when |
|---|---|
| `../profile.json` | Every finished activity and review: sub-bands, Can-Dos, gamification, SRS queue, progress, stats, history |
| `../vocabulary.md` | Task key words and feedback upgrades, with SM-2 interval, ease factor, repetitions and next review |
| `../error_ledger.md` | Errors from writing/speaking feedback, with count and correct-use streak |
| `../sessions/YYYY-MM-DD.md` | A 5-line `## Session Summary` at the top, refreshed after every activity, plus the `## Activity Log` |

## Learning rules (from `../CLAUDE.md`)

Aligned with the **CEFR Companion Volume** (action-oriented Can-Do assessment), the **ACTFL Proficiency Guidelines** (error tolerance by level) and **SM-2** spaced repetition.

- **Sub-bands:** each skill moves A1.1 → A1.2 → A2.1 … after one **Transactional**, one **Interactional** and one **Evaluative** task at its current level, each passed at 80%+ and each a different task (tasks used for A1.1 cannot count again for A1.2). The overall sub-band is the floor of the four skills' average. Every skill has 6+ tasks per level at A1-A2, two of each function; B1-B2 coverage is still partial.
- **Can-Do:** passing a task records the matching Can-Do statement (skill × level × function) in `can_do_mastered`. Statements live in `src/lib/cefr-data.ts` and are shown in Vault → Can-Do.
- **ACTFL tolerance:** at A1-A2, slips that keep the meaning clear cost little and are modelled through a natural **recast**; at B2+ register, idiomaticity and cultural fit are scored.
- **SM-2:** reviews are graded on the quality scale 0-5 (Vault flashcards) or Again / Hard / Good / Easy = 1 / 3 / 4 / 5 (warm-up); q < 3 is a lapse; intervals 1 → 3 → 7 → 14 → 30 days, then × ease factor (starts 2.50, minimum 1.30). A lapse returns to 1 day. The Studio opens with a 3-minute warm-up of up to 6 due words; the sidebar shows words due and the Vault Confidence Index (`src/lib/vault.ts`).
- **Error ledger:** a pattern resolves itself after correct use in 3 later sessions in a row.
- **Motivation:** XP, streak, confidence index (starts at 80), milestones, Frustration Shield after 2 rounds under 60%, Low-Effort Mode, Daily Loot, interest-led themes.
- **Migration:** on start (`src/instrumentation.ts`), the server rewrites `profile.json`, `vocabulary.md` and `error_ledger.md` in the current schema, keeping all data. Older `user` / `motivation` profile blocks are converted.

## `profile.json`

`overall_cefr`, `sub_band`, `target_cefr`, `skills`, `skill_bands`, `can_do_mastered`, `gamification` (`streak_days`, `xp_total`, `confidence_index`, …), `srs_queue` (derived snapshot of upcoming reviews), `interests`, `progress`, `stats`, `metrics`, `diagnostic`, `history`. Full template in `../CLAUDE.md`, section 6.C.

## Feedback engine

- **Claude API (recommended):** set `ANTHROPIC_API_KEY` before starting. Feedback then follows the full `CLAUDE.md` coach rules, with your profile and recurring errors as context. Default model: `claude-opus-5-5` (override with `COACH_MODEL`). Server-side refusal fallback is enabled (`fallbacks: "default"`).
- **Offline rules (default without a key):** a built-in rule engine for common Turkish-L1 errors (age with "have", 3rd-person -s, articles, prepositions of time, "listen music", …), i+1 vocabulary upgrades, register/cohesion notes, and IPA tips. It only catches known patterns.

## Browser features

- **Listening** uses the Web Speech *synthesis* API (all modern browsers).
- **Speaking** uses Web Speech *recognition* for live dictation (Chrome / Edge; Chrome needs internet for it) and `MediaRecorder` so you can play back your own voice. In other browsers you can record and type the transcript.

## Configuration

Put these in `.env` (template: `.env.example`): in `app/` for development, next to `server.js` in production.

| Variable | Default | Purpose |
|---|---|---|
| `APP_SECRET_PIN` | none | Master PIN for the lock screen. Required in production (requests get 503 without it); local dev runs unlocked |
| `APP_SESSION_SECRET` | empty | Mixed into the `lumos_auth` cookie signature; rotate to sign everyone out |
| `PORT` / `HOSTNAME` | `3000` / `0.0.0.0` | Where `server.js` listens (`ecosystem.config.cjs` sets 3001 / 127.0.0.1) |
| `COACH_DATA_DIR` | `./data` in production; in dev `app/data/` if it has a profile, else `..` | Where the state files live |
| `ANTHROPIC_API_KEY` | none | Enables the Coach chat and Claude feedback |
| `COACH_MODEL` | `claude-opus-5-5` | Model for feedback and chat |

## Design system

Editorial, warm-paper look, defined as CSS variables in `src/app/globals.css` that switch automatically with the system light/dark setting.

- **Type:** Newsreader (serif, optical sizes) for reading texts, prompts, feedback and headings; Geist for the interface; Geist Mono for CEFR codes and figures. All self-hosted via `@fontsource`, no external font requests.
- **Colour:** warm stone paper surfaces and deep slate ink. Interactive elements use ink; colour only carries meaning: amber = A levels and hints, emerald = B levels and correct answers, indigo = C levels and phonetics, brick = errors.
- **Shape:** panels 16px, inputs 10px, buttons, badges and tabs fully rounded.
- **Motion:** `motion` for state changes only (tab indicator, accordion, score arc, entries). Respects `prefers-reduced-motion`.
- **Icons:** Phosphor.

## Structure

```
src/app/                 App Router: page.tsx (studio), unlock/ (lock screen), layout.tsx, globals.css
src/app/api/state/*      File-backed state: profile, vocabulary (+ due, review), errors, sessions, activity, quickplay, mode, loot
src/app/api/auth/*       verify (PIN -> lumos_auth cookie), status, logout
src/app/api/chat         Streaming Coach chat (SSE), CLAUDE.md + learner state as system prompt
src/app/api/feedback     Triple-Layer feedback (Claude, or the offline engine)
src/proxy.ts             Gatekeeper: checks the cookie on every page and API call
src/lib/server/          Server-only: store (file I/O, atomic writes), srs (SM-2), motivation, schema,
                         markdown (table parser), heuristics (offline engine), feedback, chat, auth + tests
src/lib/                 Shared, client-safe: cefr-data, auth-token (Web Crypto), vault stats, diff
src/components/          Client components: CoachApp, Sidebar, Studio (Reading / Writing / Listening / Speaking),
                         FeedbackCard, Flashcards (0-5), WarmUp, CoachChat, Gatekeeper, Vault, SessionsView
src/data/tasks.ts        Task bank by CEFR level (A1–B2); add tasks here
scripts/assemble-standalone.mjs   Completes .next/standalone after next build
```
