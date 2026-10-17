// Assembles release/: everything the server needs, nothing it does not.
// Run through `npm run build` (vite build first). Upload release/ to the server, then
// `npm ci --omit=dev` and `pm2 start ecosystem.config.cjs` (see ../HOSTING_DEPLOY_GUIDE.md).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.resolve(APP, '..');
const OUT = path.join(APP, 'release');

const copy = (from, to, filter) => fs.cpSync(from, to, { recursive: true, filter });

if (!fs.existsSync(path.join(APP, 'dist', 'index.html'))) {
  console.error('dist/ is missing: run `npm run build`, not this script on its own.');
  process.exit(1);
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT);

copy(path.join(APP, 'dist'), path.join(OUT, 'dist'));
copy(path.join(APP, 'server'), path.join(OUT, 'server'), (f) => !f.endsWith('.test.js'));
copy(path.join(APP, 'shared'), path.join(OUT, 'shared'));
for (const f of ['package-lock.json', 'ecosystem.config.cjs', 'app.cjs', '.env.example']) copy(path.join(APP, f), path.join(OUT, f));

// package.json with only the start script; devDependencies stay listed so the lock file matches.
const pkg = JSON.parse(fs.readFileSync(path.join(APP, 'package.json'), 'utf8'));
pkg.scripts = { start: 'node server/index.js' };
fs.writeFileSync(path.join(OUT, 'package.json'), `${JSON.stringify(pkg, null, 2)}\n`);

// Seed data: the coach files as they are now. On later updates, do NOT upload data/ over the server's copy.
const DATA = path.join(OUT, 'data');
fs.mkdirSync(path.join(DATA, 'sessions'), { recursive: true });
for (const f of ['CLAUDE.md', 'profile.json', 'vocabulary.md', 'error_ledger.md']) copy(path.join(REPO, f), path.join(DATA, f));
copy(path.join(REPO, 'sessions'), path.join(DATA, 'sessions'));

const size = (dir) => fs.readdirSync(dir, { recursive: true, withFileTypes: true }).filter((d) => d.isFile()).reduce((n, d) => n + fs.statSync(path.join(d.parentPath, d.name)).size, 0);
console.log(`release/ ready (${(size(OUT) / 1024).toFixed(0)} KB): dist, server, shared, data, package.json, package-lock.json, ecosystem.config.cjs, app.cjs, .env.example`);
