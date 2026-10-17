import { body, route } from '@/lib/server/http';
import { completeActivity } from '@/lib/server/store';


export const POST = route(async (req) => Response.json(await completeActivity((await body(req)) ?? {})));
