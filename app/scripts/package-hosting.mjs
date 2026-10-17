// Runs after `next build` (see package.json). Assembles the clean shared-hosting release and zips it.
// Only what the live site needs goes in; unzip it into public_html, add .env, done.
//
//   hosting-release/              (app/hosting-release, zipped to ../hosting-release.zip)
//     index.html  404.html  _next/  _not-found/  icon.svg  robots.txt   static app (from out/)
//     api.php  config.php  rules.php  .htaccess  .env.example           PHP server side
//     curriculum.json                                                  A1.1-C2.2 curriculum for Gemini
//     data/  profile.json  vocabulary.md  error_ledger.md  sessions/    starting data
//
// rules.php is CLAUDE.md compiled into PHP (the Gemini system instruction), so no .md file sits in
// the web root. Left out on purpose: CLAUDE.md, .env, index.txt and the __next.*.txt router payloads
// (the app is a single page and never fetches them), data-seed/, KURULUM.txt, sources, node_modules.

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.resolve(APP, '..');
const OUT = path.join(APP, 'out');
const STAGE = path.join(APP, 'hosting-release');
const ZIP = path.join(REPO, 'hosting-release.zip');

if (!fs.existsSync(path.join(OUT, 'index.html'))) {
  console.error('out/ is missing. Run `npm run build`, which runs next build first.');
  process.exit(1);
}

const DENY_HTACCESS = '<IfModule mod_authz_core.c>\n  Require all denied\n</IfModule>\n<IfModule !mod_authz_core.c>\n  Order allow,deny\n  Deny from all\n</IfModule>\n';

fs.rmSync(STAGE, { recursive: true, force: true });
fs.mkdirSync(STAGE);

// Static app: the page, its assets and the not-found page. No .txt router payloads.
for (const f of ['index.html', '404.html', 'icon.svg', 'robots.txt', '_next', '_not-found']) {
  const from = path.join(OUT, f);
  if (fs.existsSync(from)) fs.cpSync(from, path.join(STAGE, f), { recursive: true });
}

// PHP server side.
for (const f of ['api.php', 'config.php', '.htaccess', '.env.example']) fs.copyFileSync(path.join(APP, 'php', f), path.join(STAGE, f));
// The curriculum Gemini reads on the server (the app bundles its own copy; .htaccess denies direct access).
fs.copyFileSync(path.join(APP, 'src', 'data', 'curriculum.json'), path.join(STAGE, 'curriculum.json'));

// Coaching rules as PHP: returns the CLAUDE.md text, and a direct request gets an empty 403.
const rules = fs.readFileSync(path.join(REPO, 'CLAUDE.md'), 'utf8').replace(/\r\n/g, '\n');
if (/^\s*LUMOS_RULES;?\s*$/m.test(rules)) throw new Error('CLAUDE.md contains the line LUMOS_RULES, which would end the nowdoc');
fs.writeFileSync(
  path.join(STAGE, 'rules.php'),
  `<?php\n// Generated from CLAUDE.md by scripts/package-hosting.mjs: the coaching rules sent to Gemini.\nif (!defined('LUMOS')) {\n    http_response_code(403);\n    exit;\n}\n\nreturn <<<'LUMOS_RULES'\n${rules.trimEnd()}\nLUMOS_RULES;\n`,
);

// Starting data, straight in data/ (protected; api.php adds .version, backups/ etc. at runtime).
const DATA = path.join(STAGE, 'data');
fs.mkdirSync(path.join(DATA, 'sessions'), { recursive: true });
for (const f of ['profile.json', 'vocabulary.md', 'error_ledger.md']) fs.copyFileSync(path.join(REPO, f), path.join(DATA, f));
for (const f of fs.readdirSync(path.join(REPO, 'sessions')).filter((n) => /^\d{4}-\d{2}-\d{2}\.md$/.test(n))) fs.copyFileSync(path.join(REPO, 'sessions', f), path.join(DATA, 'sessions', f));
fs.writeFileSync(path.join(DATA, '.htaccess'), DENY_HTACCESS);
fs.writeFileSync(path.join(DATA, 'index.html'), '');

// Guard: nothing that must stay out may slip in.
const FORBIDDEN = /(^|\/)(CLAUDE\.md|\.env|\.git|\.gitignore|data-seed|KURULUM\.txt|index\.txt|_not-found\.txt|node_modules|src|package\.json|tsconfig\.json)(\/|$)|(^|\/)__next\.[^/]*\.txt$/;

// ---------- minimal ZIP writer (deflate, UTF-8 names) ----------
function walk(dir, base = '') {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((d) => (d.isDirectory() ? walk(path.join(dir, d.name), `${base}${d.name}/`) : [{ abs: path.join(dir, d.name), name: `${base}${d.name}` }]));
}

const files = walk(STAGE);
const leaked = files.filter((f) => FORBIDDEN.test(f.name) && !f.name.startsWith('_not-found/'));
if (leaked.length) throw new Error(`Refusing to package: ${leaked.map((f) => f.name).join(', ')}`);

const now = new Date();
const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
const locals = [];
const centrals = [];
let offset = 0;
for (const { abs, name } of files) {
  const data = fs.readFileSync(abs);
  const deflated = zlib.deflateRawSync(data, { level: 9 });
  const useDeflate = deflated.length < data.length;
  const body = useDeflate ? deflated : data;
  const nameBuf = Buffer.from(name, 'utf8');
  const crc = zlib.crc32(data);
  const head = Buffer.alloc(30);
  head.writeUInt32LE(0x04034b50, 0);
  head.writeUInt16LE(20, 4);
  head.writeUInt16LE(0x0800, 6); // UTF-8 names
  head.writeUInt16LE(useDeflate ? 8 : 0, 8);
  head.writeUInt16LE(dosTime, 10);
  head.writeUInt16LE(dosDate, 12);
  head.writeUInt32LE(crc, 14);
  head.writeUInt32LE(body.length, 18);
  head.writeUInt32LE(data.length, 22);
  head.writeUInt16LE(nameBuf.length, 26);
  locals.push(head, nameBuf, body);
  const cen = Buffer.alloc(46);
  cen.writeUInt32LE(0x02014b50, 0);
  cen.writeUInt16LE(20, 4);
  cen.writeUInt16LE(20, 6);
  cen.writeUInt16LE(0x0800, 8);
  cen.writeUInt16LE(useDeflate ? 8 : 0, 10);
  cen.writeUInt16LE(dosTime, 12);
  cen.writeUInt16LE(dosDate, 14);
  cen.writeUInt32LE(crc, 16);
  cen.writeUInt32LE(body.length, 20);
  cen.writeUInt32LE(data.length, 24);
  cen.writeUInt16LE(nameBuf.length, 28);
  cen.writeUInt32LE(offset, 42);
  centrals.push(cen, nameBuf);
  offset += head.length + nameBuf.length + body.length;
}
const central = Buffer.concat(centrals);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(centrals.length / 2, 8);
end.writeUInt16LE(centrals.length / 2, 10);
end.writeUInt32LE(central.length, 12);
end.writeUInt32LE(offset, 16);
fs.writeFileSync(ZIP, Buffer.concat([...locals, central, end]));

console.log(`hosting-release.zip ready (${centrals.length / 2} files, ${(fs.statSync(ZIP).size / 1024).toFixed(0)} KB) -> ${path.relative(process.cwd(), ZIP)}`);
