import { body, route } from '@/lib/server/http';
import { completeQuickPlay } from '@/lib/server/store';


export const POST = route(async (req) => Response.json(await completeQuickPlay(await body(req))));
