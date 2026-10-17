import { route } from '@/lib/server/http';
import { streamChat } from '@/lib/server/chat';


export const maxDuration = 300;

/** Streams a coach reply (SSE). CLAUDE.md plus the learner's current state is the system prompt. */
export const POST = route(async (req) => streamChat(await req.json().catch(() => null), req.signal));
