// Runs after `next build` (see package.json). Makes .next/standalone a complete, self-contained
// server folder: Next.js leaves the static assets and public/ out of it on purpose.
//
//   .next/standalone/
//     server.js  .next/  node_modules/  package.json     (from next build)
//     .next/static/   public/                            (copied here)
//     data/           seed copy of the coach files       (only if missing; never overwritten)
//     ecosystem.config.cjs  .env.example                 (PM2 + settings template)
//
// Upload that folder, add .env, start with `node server.js` or `pm2 start ecosystem.config.cjs`.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.resolve(APP, '..');
const OUT = path.join(APP, '.next', 'standalone');

if (!fs.existsSync(path.join(OUT, 'server.js'))) {
  console.error('.next/standalone/server.js is missing. Check that next.config.mjs has output: "standalone".');
  process.exit(1);
}

const copy = (from, to) => fs.existsSync(from) && fs.cpSync(from, to, { recursive: true });

copy(path.join(APP, '.next', 'static'), path.join(OUT, '.next', 'static'));
copy(path.join(APP, 'public'), path.join(OUT, 'public'));
for (const f of ['ecosystem.config.cjs', '.env.example']) copy(path.join(APP, f), path.join(OUT, f));

const DATA = path.join(OUT, 'data');
if (!fs.existsSync(path.join(DATA, 'profile.json'))) {
  fs.mkdirSync(path.join(DATA, 'sessions'), { recursive: true });
  for (const f of ['CLAUDE.md', 'profile.json', 'vocabulary.md', 'error_ledger.md']) copy(path.join(REPO, f), path.join(DATA, f));
  copy(path.join(REPO, 'sessions'), path.join(DATA, 'sessions'));
}

console.log('Standalone server ready in .next/standalone (server.js, .next/static, public, data, ecosystem.config.cjs, .env.example)');
