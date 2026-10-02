/**
 * TechSkill Academy — API (Netlify Function).
 *
 * All backend logic lives here (with helpers in ./_shared). The function is
 * served at /api/* via a redirect in netlify.toml, and works with BOTH
 * Netlify Functions v2 (Request/Response) and v1 (event/context) signatures.
 */
import { ensureSeeded } from './_shared/seed.mjs';
import { matchRoute } from './_shared/routes.mjs';
import { HttpError, jsonResponse, errorResponse } from './_shared/http.mjs';
import { requireUser } from './_shared/auth.mjs';

const MAX_BODY_CHARS = 8_000_000;

export default async function (reqOrEvent) {
  // ---- Netlify Functions v2: receive a standard Request ----
  if (reqOrEvent && typeof reqOrEvent === 'object' && typeof reqOrEvent.headers?.get === 'function') {
    return handle(reqOrEvent);
  }
  // ---- Netlify Functions v1: receive an event object ----
  const ev = reqOrEvent || {};
  const url = `https://netlify.local${ev.rawUrl || ev.path || '/'}`;
  const headers = new Headers(ev.headers || {});
  const method = ev.httpMethod || 'GET';
  const init = { method, headers };
  if (ev.body && method !== 'GET' && method !== 'HEAD') {
    init.body = ev.isBase64Encoded ? Buffer.from(ev.body, 'base64') : ev.body;
  }
  const res = await handle(new Request(url, init));
  const resHeaders = {};
  res.headers.forEach((v, k) => { resHeaders[k] = v; });
  return {
    statusCode: res.status,
    headers: resHeaders,
    body: Buffer.from(await res.arrayBuffer()).toString('base64'),
    isBase64Encoded: true,
  };
}

export async function handle(req) {
  try {
    await ensureSeeded();

    const url = new URL(req.url);
    const match = url.pathname.match(/\/api\/(.*)$/);
    const routePath = (match ? match[1] : '').replace(/\/+$/, '');
    const found = matchRoute(req.method, routePath);

    if (!found) throw new HttpError(404, `Unknown endpoint: ${req.method} /api/${routePath}`);

    const { route, params } = found;
    const user = route.roles ? await requireUser(req) : null;
    if (route.roles && route.roles !== 'any' && !route.roles.includes(user.role)) {
      throw new HttpError(403, 'You do not have permission to do that.');
    }

    let body = null;
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      const contentType = (req.headers.get('content-type') || '').toLowerCase();
      if (contentType.includes('application/json')) {
        const raw = await req.text();
        if (raw.length > MAX_BODY_CHARS) throw new HttpError(413, 'Payload too large.');
        try {
          body = raw ? JSON.parse(raw) : {};
        } catch {
          throw new HttpError(400, 'Invalid JSON body.');
        }
      } else {
        body = {};
      }
    }

    const query = Object.fromEntries(url.searchParams.entries());
    const result = await route.handler({ req, user, params, query, body });
    if (result instanceof Response) return result;
    return jsonResponse(200, result);
  } catch (err) {
    return errorResponse(err);
  }
}
