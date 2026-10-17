import { route } from '@/lib/server/http';
import { listSessions } from '@/lib/server/store';


export const GET = route(async () => Response.json(await listSessions()));
