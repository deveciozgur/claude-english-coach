// Runs after `next build` (see package.json). Assembles the shared-hosting release and zips it:
//
//   hosting-release/              (app/hosting-release, also zipped to ../hosting-release.zip)
//     index.html  _next/  icon.svg  robots.txt ...   static app from out/
//     api.php  config.php  .htaccess  .env.example   PHP server side
//     CLAUDE.md                                      coaching rules (Gemini system instruction)
//     data-seed/                                     first-run copy of the coach files
//     KURULUM.txt                                    short install guide (Turkish)
//
// api.php creates data/ from data-seed/ on the first request, so uploading a new release never
// overwrites the learner's progress. No zip tool needed: the archive is written here.

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
  console.error('out/index.html is missing. Check that next.config.mjs has output: "export".');
  process.exit(1);
}

fs.rmSync(STAGE, { recursive: true, force: true });
fs.cpSync(OUT, STAGE, { recursive: true });
for (const f of ['api.php', 'config.php', '.htaccess', '.env.example']) fs.copyFileSync(path.join(APP, 'php', f), path.join(STAGE, f));
fs.copyFileSync(path.join(REPO, 'CLAUDE.md'), path.join(STAGE, 'CLAUDE.md'));

const SEED = path.join(STAGE, 'data-seed');
fs.mkdirSync(path.join(SEED, 'sessions'), { recursive: true });
for (const f of ['profile.json', 'vocabulary.md', 'error_ledger.md']) fs.copyFileSync(path.join(REPO, f), path.join(SEED, f));
for (const f of fs.readdirSync(path.join(REPO, 'sessions')).filter((n) => n.endsWith('.md'))) fs.copyFileSync(path.join(REPO, 'sessions', f), path.join(SEED, 'sessions', f));
fs.writeFileSync(path.join(SEED, '.htaccess'), '<IfModule mod_authz_core.c>\n  Require all denied\n</IfModule>\n<IfModule !mod_authz_core.c>\n  Order allow,deny\n  Deny from all\n</IfModule>\n');
fs.writeFileSync(path.join(SEED, 'index.html'), '');

fs.writeFileSync(
  path.join(STAGE, 'KURULUM.txt'),
  `Lumos AI English Coach v1.0 - Paylasimli hosting kurulumu
=========================================================

1. Bu klasordeki HER SEYI (gizli .htaccess ve .env.example dahil) FTP ile
   sitenin kok klasorune (public_html veya alt alan adinin klasoru) yukleyin.
2. .env.example dosyasinin bir kopyasini .env adiyla olusturun ve doldurun:
     APP_SECRET_PIN=   giris PIN'iniz (zorunlu)
     APP_SESSION_SECRET=   uzun rastgele bir metin (onerilir)
     GEMINI_API_KEY=   Google Gemini anahtari (istege bagli, AI icin)
   Daha guvenli: .env dosyasini public_html'in BIR UST klasorune koyun.
3. Siteyi acin ve PIN'inizi girin. data/ klasoru ilk acilista otomatik olusur.

Guncellemede data/ klasorune ve .env dosyasina DOKUNMAYIN: ilerlemeniz oradadir.
Ayrintilar: depodaki DEPLOYMENT_v1.md
`,
);

// ---------- minimal ZIP writer (deflate, UTF-8 names) ----------
function walk(dir, base = '') {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((d) => (d.isDirectory() ? walk(path.join(dir, d.name), `${base}${d.name}/`) : [{ abs: path.join(dir, d.name), name: `${base}${d.name}` }]));
}

const now = new Date();
const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
const locals = [];
const centrals = [];
let offset = 0;
for (const { abs, name } of walk(STAGE)) {
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
