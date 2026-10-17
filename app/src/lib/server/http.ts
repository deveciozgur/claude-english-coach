// Small helpers shared by the route handlers in src/app/api/.

import 'server-only';

type Handler<C> = (req: Request, ctx: C) => Promise<Response> | Response;

/** Turns thrown errors into JSON responses; errors may carry an HTTP `status` (default 500). */
export function route<C = unknown>(fn: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      return await fn(req, ctx);
    } catch (err) {
      const status = typeof err?.status === 'number' ? err.status : 500;
      if (status >= 500) console.error(err);
      return Response.json({ error: status >= 500 ? 'Server error' : err.message }, { status });
    }
  };
}

/** Parses a JSON body; an empty or invalid body is a 400. */
export async function body<T = any>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw Object.assign(new Error('Request body must be JSON'), { status: 400 });
  }
}

export const asList = <T,>(v: T | T[]): T[] => (Array.isArray(v) ? v : [v]);
