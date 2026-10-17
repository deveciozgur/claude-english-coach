import { route } from '@/lib/server/http';
import { dueVocabulary } from '@/lib/server/store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const WARMUP_MAX = 6; // CLAUDE.md section 1: at most 6 due words in the 3-minute warm-up
const VAULT_MAX = 50; // the Vault's own review session (?scope=vault) may go through more

export const GET = route(async (req) => {
  const params = new URL(req.url).searchParams;
  const max = params.get('scope') === 'vault' ? VAULT_MAX : WARMUP_MAX;
  return Response.json(await dueVocabulary(Math.min(max, Number(params.get('limit')) || max)));
});
