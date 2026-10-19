/**
 * /api/library-ask — typed half of SlamDunk Library Mode.
 *
 * POST { message, history:[{role,content}] } -> { reply }
 *
 * Same VAPI Chat API pattern the live chat widget uses (/api/chat-bridge), minus
 * Chatwoot: this is an on-page text conversation, so we talk to the VAPI chat
 * assistant directly and return the answer to the page.
 *
 * Env (already set for chat-bridge): VAPI_API_KEY
 * Optional: LIBRARY_ASSISTANT_ID (defaults to the SlamDunk chat agent)
 */

const SLAMDUNK_CHAT_ASSISTANT_ID = '74e74f38-c879-43dd-8f8c-4e0466fd2317';

// Phone-only tools must never be offered in a typed channel.
const PHONE_ONLY_TOOLS = new Set([
  '891f24cb-cfae-42a7-915b-3c2ea52d8a78', // transfer_to_live_agent
  'df23f6e2-48f7-411b-9bbc-f1df4b133669', // leave_birdrock_voicemail
  'eca43747-3dea-4ddf-ab8e-927617723d2f', // leave_abl_voicemail
]);

const CHANNEL_TAG =
  '[CHANNEL WEB_TEXT (Library Mode, slamdunktechnologies.com) - typed website chat, not a phone call, not SMS.]';

let TOOL_CACHE = {};

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

export async function onRequestPost(context) {
  const { request, env } = context;
  const apiKey = env.VAPI_API_KEY;
  if (!apiKey) return json({ error: 'library not configured' }, 500);

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'bad json' }, 400);
  }

  const message = String(payload.message || '').trim().slice(0, 2000);
  if (!message) return json({ error: 'empty message' }, 400);

  const assistantId = env.LIBRARY_ASSISTANT_ID || SLAMDUNK_CHAT_ASSISTANT_ID;

  // Build the conversation: prior turns, then the new user turn tagged with the channel.
  const items = [];
  if (Array.isArray(payload.history)) {
    for (const turn of payload.history.slice(-8)) {
      if (!turn || !turn.content) continue;
      const role = turn.role === 'assistant' ? 'assistant' : 'user';
      const content = String(turn.content).slice(0, 2000);
      if (items.length && items[items.length - 1].role === role) {
        items[items.length - 1].content += `\n${content}`;
      } else {
        items.push({ role, content });
      }
    }
  }
  // Drop a trailing duplicate of the message we were just handed.
  const last = items[items.length - 1];
  if (last && last.role === 'user' && last.content.trim() === message) items.pop();
  items.push({ role: 'user', content: `${CHANNEL_TAG}\n\n${message}` });

  const tm = await textModel(assistantId, apiKey);
  const body = { assistantId, input: items };
  if (tm) {
    body.assistantOverrides = { model: { provider: tm.provider, model: tm.model, toolIds: tm.ids } };
  }

  try {
    const r = await fetch('https://api.vapi.ai/chat', {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const d = await r.json().catch(() => null);
    if (!r.ok || !d) {
      return json({ error: `vapi ${r.status}`, detail: JSON.stringify(d).slice(0, 300) }, 502);
    }
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
  return json({ ok: true, service: 'library-ask', method: 'POST {message, history}' });
}
