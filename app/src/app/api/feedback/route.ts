import { body, route } from '@/lib/server/http';
import { generateFeedback } from '@/lib/server/feedback';


export const POST = route(async (req) => {
  const input = await body(req);
  if (!['writing', 'speaking'].includes(input?.mode) || typeof input?.text !== 'string' || !input.text.trim()) {
    return Response.json({ error: 'mode (writing|speaking) and non-empty text are required' }, { status: 400 });
  }
  return Response.json(await generateFeedback(input));
});
