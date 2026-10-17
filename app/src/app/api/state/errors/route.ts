import { asList, body, route } from '@/lib/server/http';
import { logErrors, readErrors } from '@/lib/server/store';


export const GET = route(async () => Response.json(await readErrors()));
export const POST = route(async (req) => Response.json(await logErrors(asList(await body(req))), { status: 201 }));
