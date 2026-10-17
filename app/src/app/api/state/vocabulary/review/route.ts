import { body, route } from '@/lib/server/http';
import { reviewVocabulary } from '@/lib/server/store';


/** Body: { original, grade } where grade is an SM-2 quality 0-5 or again | hard | good | easy. */
export const POST = route(async (req) => {
  const b = await body(req);
  return Response.json(await reviewVocabulary(b?.original, b?.grade ?? b?.quality ?? b?.result));
});
