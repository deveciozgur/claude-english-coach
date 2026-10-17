// Runs once when the Next.js server starts. Brings older coach files to the current schema
// (idempotent: files already in the canonical format are left byte-for-byte unchanged).
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { DATA_DIR, migrateFiles } = await import('./lib/server/store');
  try {
    const migrated = await migrateFiles();
    console.log(`Lumos data directory: ${DATA_DIR}${migrated.length ? ` (migrated: ${migrated.join(', ')})` : ''}`);
    if (!process.env.APP_SECRET_PIN) console.warn('APP_SECRET_PIN is not set: production requests are refused until it is.');
  } catch (err) {
    console.error(`Lumos could not read its data in ${DATA_DIR}: ${err.message}`);
  }
}
