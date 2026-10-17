import { body, route } from '@/lib/server/http';
import { readProfile, writeProfile } from '@/lib/server/store';


export const GET = route(async () => Response.json(await readProfile()));
export const PUT = route(async (req) => {
  await writeProfile(await body(req));
  return Response.json(await readProfile());
});
