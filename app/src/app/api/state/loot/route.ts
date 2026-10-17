import { route } from '@/lib/server/http';
import { dailyLoot } from '@/lib/server/store';


export const GET = route(async (req) => Response.json(await dailyLoot(new URL(req.url).searchParams.get('date') ?? undefined)));
