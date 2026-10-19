/**
 * /api/avatar-start — token proxy for SlamDunk Library Mode.
 *
 * The browser cannot call buddyfetch.ai/api/start directly (cross-origin), and the
 * LiveKit admin key must never reach the client. This function brokers the call
 * server-side and returns only { token, url, room } to the page.
 *
 * Query: ?room=gingerv3-demo&participant=library-123
 */

const START_ORIGIN = 'https://www.buddyfetch.ai';
const ALLOWED_ROOMS = new Set([
  'gingerv3-demo', // Ginger (Kate Trulove) — Library Mode voice
]);

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
    },
  });
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const room = url.searchParams.get('room') || 'gingerv3-demo';
  const participant = url.searchParams.get('participant') || 'library-visitor';

  if (!ALLOWED_ROOMS.has(room)) {
    return json({ error: 'room not allowed in Library Mode' }, 400);
  }

  const target =
    `${START_ORIGIN}/api/start?room=${encodeURIComponent(room)}` +
    `&participant=${encodeURIComponent(participant)}` +
    `&dispatch=0&t=${Date.now()}`;

  try {
    const r = await fetch(target, { headers: { 'cache-control': 'no-store' } });
    const text = await r.text();
    if (!r.ok) {
      return json({ error: `token service ${r.status}`, detail: text.slice(0, 200) }, 502);
    }
    let d;
    try {
      d = JSON.parse(text);
    } catch {
      return json({ error: 'token service returned non-JSON', detail: text.slice(0, 200) }, 502);
    }
    if (!d || !d.token || !d.url) {
      return json({ error: 'token service missing token/url', detail: text.slice(0, 200) }, 502);
    }
    // Only ever hand the browser what it needs.
    return json({ token: d.token, url: d.url, room: d.room || room });
  } catch (e) {
    return json({ error: 'token proxy failed', detail: String(e && e.message ? e.message : e) }, 502);
  }
}
