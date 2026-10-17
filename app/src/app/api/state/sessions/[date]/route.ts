import { route } from '@/lib/server/http';
import { readSession } from '@/lib/server/store';


export const GET = route<{ params: Promise<{ date: string }> }>(async (req, { params }) => {
  const { date } = await params;
  return new Response(await readSession(date), { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } });
});
