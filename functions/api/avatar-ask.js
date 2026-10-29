/**
 * /api/avatar-ask — typed + voice-to-text half of the BuddyFetch.ai Fetch Mode avatar pages.
 * (New file: /api/library-ask is untouched.)
 *
 * POST {persona, message, history:[{role,content}]} -> {reply}
 * Content-Type may be text/plain (keeps the browser call "simple", no CORS preflight).
 *
 * persona -> VAPI assistant. Only these assistants can be reached from the web.
 * Env: VAPI_API_KEY (already set for this project)
 */

const PERSONAS = {
  slamdunk: { assistant: '74e74f38-c879-43dd-8f8c-4e0466fd2317', page: 'buddyfetch.ai/slamdunk' },  // SlamDunk Technologies Chat Agent
  lorne:    { assistant: 'f17d5e8f-ef94-4721-87c6-b2f529e3d3e0', page: 'buddyfetch.ai/YoLorne' },   // Lorne Goodwon BRM Property Management
  slash:    { assistant: '21e0d8ce-2326-421b-a518-aea245007e54', page: 'buddyfetch.ai/SupSlash' },      // Slash Goodwon ABL Superhero
  destiny:  { assistant: '97061722-64c1-42f9-8563-b56cf2cd02b2', page: 'buddyfetch.ai/HeyHeyDestiny' }, // Destiny Trulove ABL Superhero
};

// Phone-only tools must never be offered in a typed/web channel.
const PHONE_ONLY_TOOLS = new Set([
  '891f24cb-cfae-42a7-915b-3c2ea52d8a78', // transfer_to_live_agent
  'df23f6e2-48f7-411b-9bbc-f1df4b133669', // leave_birdrock_voicemail
  'eca43747-3dea-4ddf-ab8e-927617723d2f', // leave_abl_voicemail
]);

let TOOL_CACHE = {};

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, GET, OPTIONS',
  'access-control-allow-headers': 'content-type',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...CORS },
  });
}

async function textModel(assistantId, apiKey) {
  const c = TOOL_CACHE[assistantId];
  if (c && Date.now() - c.at < 30 * 60 * 1000) return c;
  try {
    const r = await fetch(`https://api.vapi.ai/assistant/${assistantId}`, {
      headers: { authorization: `Bearer ${apiKey}` },
    });
    if (!r.ok) return null;
    const a = await r.json();
    const model = a && a.model ? a.model : null;
    if (!model || !model.provider || !model.model) return null;
    const ids = Array.isArray(model.toolIds) ? model.toolIds.filter((id) => !PHONE_ONLY_TOOLS.has(id)) : [];
    const entry = { provider: model.provider, model: model.model, ids, at: Date.now() };
    TOOL_CACHE[assistantId] = entry;
    return entry;
  } catch {
    return null;
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const apiKey = env.VAPI_API_KEY;
  if (!apiKey) return json({ error: 'avatar-ask not configured' }, 500);

  let payload;
  try {
    payload = JSON.parse(await request.text());
  } catch {
    return json({ error: 'bad json' }, 400);
  }

  const key = String(payload.persona || 'slamdunk').toLowerCase();
  const persona = PERSONAS[key];
  if (!persona || !persona.assistant) return json({ error: `persona '${key}' not available yet` }, 400);

  const message = String(payload.message || '').trim().slice(0, 4000);
  if (!message) return json({ error: 'empty message' }, 400);

  const channelTag =
    `[CHANNEL WEB_FETCH_MODE (${persona.page}) - live talking avatar on the website; the visitor hears your reply spoken by the avatar and reads it as text. Not a phone call, not SMS.]`;

  const items = [];
  if (Array.isArray(payload.history)) {
    for (const turn of payload.history.slice(-8)) {
      if (!turn || !turn.content) continue;
      const role = turn.role === 'assistant' ? 'assistant' : 'user';
      const content = String(turn.content).slice(0, 2000);
      if (items.length && items[items.length - 1].role === role) items[items.length - 1].content += `\n${content}`;
      else items.push({ role, content });
    }
  }
  const last = items[items.length - 1];
  if (last && last.role === 'user' && last.content.trim() === message) items.pop();
  items.push({ role: 'user', content: `${channelTag}\n\n${message}` });

  const tm = await textModel(persona.assistant, apiKey);
  const body = { assistantId: persona.assistant, input: items };
  if (tm) body.assistantOverrides = { model: { provider: tm.provider, model: tm.model, toolIds: tm.ids } };

  try {
    const r = await fetch('https://api.vapi.ai/chat', {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const d = await r.json().catch(() => null);
    if (!r.ok || !d) return json({ error: `vapi ${r.status}`, detail: JSON.stringify(d).slice(0, 300) }, 502);
    const out = Array.isArray(d.output)
      ? d.output.filter((o) => o && o.role === 'assistant').map((o) => o.content).join('\n').trim()
      : (typeof d.output === 'string' ? d.output.trim() : '');
    if (!out) return json({ error: 'empty reply' }, 502);
    return json({ reply: out });
  } catch (e) {
    return json({ error: 'vapi call failed', detail: String(e && e.message ? e.message : e) }, 502);
  }
}

export async function onRequestGet() {
  return json({ ok: true, service: 'avatar-ask', personas: Object.keys(PERSONAS).filter((k) => PERSONAS[k].assistant) });
}
