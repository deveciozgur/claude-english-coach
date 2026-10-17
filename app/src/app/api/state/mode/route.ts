import { body, route } from '@/lib/server/http';
import { setMode } from '@/lib/server/store';


export const POST = route(async (req) => Response.json(await setMode((await body(req))?.mode)));
