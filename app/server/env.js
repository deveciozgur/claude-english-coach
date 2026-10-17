// Loads app/.env (if present) before any other module reads process.env.
// Imported first in index.js; ES modules run their imports in order.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const envFile = path.join(APP_ROOT, '.env');
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);

// The release package (npm run build) has no src/ folder: treat it as production.
export const IS_RELEASE = process.env.NODE_ENV === 'production' || !fs.existsSync(path.join(APP_ROOT, 'src'));
