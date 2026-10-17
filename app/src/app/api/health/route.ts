import { route } from '@/lib/server/http';
import { DATA_DIR } from '@/lib/server/store';
import { llmConfigured, MODEL } from '@/lib/server/feedback';


export const GET = route(async () => Response.json({ ok: true, version: '1.0.0', dataDir: DATA_DIR, llm: llmConfigured(), model: MODEL }));
