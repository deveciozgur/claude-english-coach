import { asList, body, route } from '@/lib/server/http';
import { appendVocabulary, readVocabulary } from '@/lib/server/store';


export const GET = route(async () => Response.json(await readVocabulary()));
export const POST = route(async (req) => Response.json(await appendVocabulary(asList(await body(req))), { status: 201 }));
