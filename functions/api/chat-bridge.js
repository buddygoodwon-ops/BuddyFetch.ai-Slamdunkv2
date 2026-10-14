/**
 * Chatwoot → VAPI Buddy Chat Agent bridge
 * Hosted as a Cloudflare Pages Function at https://slamdunktechnologies.com/api/chat-bridge
 *
 * Replicates the BirdRock Funding live-chat pipeline: when a visitor sends a
 * message in the Chatwoot widget (SlamDunk Technologies inbox), this endpoint
 * receives the `message_created` webhook, feeds the conversation history to the
 * VAPI Buddy assistant's Chat API, and posts the reply back into the same
 * Chatwoot conversation so the visitor sees Buddy answer in the chat.
 *
 * Self-contained (no npm deps, no KV bindings) so it deploys with the site via git push.
 * Secrets come from Cloudflare Pages env vars:
 *   VAPI_API_KEY, VAPI_ASSISTANT_ID, CHATWOOT_ACCOUNT_ID, CHATWOOT_WEBHOOK_SECRET,
 *   CHATWOOT_SESSION_EMAIL, CHATWOOT_SESSION_PASSWORD (session auth with auto re-login,
 *   because Chatwoot Cloud gates the persistent Application API token per account)
 */

const SLAMDUNK_INBOX_ID = 133705;
// Inbox → VAPI chat assistant map (Glenn 9/22: "have VAPI Chat Bot manning my Chatwoot").
// Each brand site's widget posts to its own inbox; the bridge routes to that brand's agent.
const INBOX_ASSISTANTS = {
  133705: '74e74f38-c879-43dd-8f8c-4e0466fd2317', // SlamDunk Technologies Chat Agent
  139577: 'c13ce732-8d3f-4b7f-b185-783c52580f72', // Americas Best Lenders → Buddy Goodwon Chat Agent (mortgage)
  139833: '5eabf5c1-af1f-42cc-b51e-26e1fb704b35', // BirdRock Commercial → Buddy BirdRock Commercial
  139834: 'f17d5e8f-ef94-4721-87c6-b2f529e3d3e0', // BirdRock Management → Lorne Goodwon BRM Property Management
};
// Human-readable source label per inbox (Kate spec 10/10: visible channel/source tags).
const SOURCE_BY_INBOX = {
  133705: 'slamdunktechnologies.com',
  139577: 'americasbestlenders.com',
  139833: 'birdrockcommercial.com',
  139834: 'birdrockmanagement.com',
};
// Phone-only tools that must NEVER be offered in a text/chat channel (Kate spec 10/10).
const PHONE_ONLY_TOOLS = new Set([
  '891f24cb-cfae-42a7-915b-3c2ea52d8a78', // transfer_to_live_agent
  'df23f6e2-48f7-411b-9bbc-f1df4b133669', // leave_birdrock_voicemail
  'eca43747-3dea-4ddf-ab8e-927617723d2f', // leave_abl_voicemail
]);
let TEXT_TOOL_CACHE = {}; // assistantId -> { ids, provider, model, at }
async function textToolIds(assistantId, apiKey) {
  const c = TEXT_TOOL_CACHE[assistantId];
  if (c && Date.now() - c.at < 30 * 60 * 1000) return c; // full entry, not just ids
  try {
    const r = await fetch('https://api.vapi.ai/assistant/' + assistantId, { headers: { Authorization: 'Bearer ' + apiKey } });
    const a = await r.json();
    if (a && a.model && Array.isArray(a.model.toolIds)) {
      const ids = a.model.toolIds.filter((id) => !PHONE_ONLY_TOOLS.has(id));
      const entry = { ids, provider: a.model.provider, model: a.model.model, at: Date.now() };
      TEXT_TOOL_CACHE[assistantId] = entry;
      return entry;
    }
  } catch { /* best effort */ }
  return null;
}
// ProProcessing.online assistant repurposed for SlamDunk website chat on 2026-09-07.
// Keep this as a code fallback while the Pages secret is updated, so a stale
// VAPI_ASSISTANT_ID cannot silently route visitors to the old BirdRock agent.
const SLAMDUNK_CHAT_ASSISTANT_ID = '74e74f38-c879-43dd-8f8c-4e0466fd2317';
const MAX_HISTORY = 24;
const CHATWOOT_BASE = 'https://app.chatwoot.com';

// Chatwoot webhooks send message_type as a STRING ('incoming'/'outgoing'/'activity'/'template'),
// while the REST API returns integers (0/1/2/3). Normalize both to the numeric form used internally.
function normalizeMessageType(t) {
  if (t === undefined || t === null) return t;
  if (typeof t === 'number') return t;
  const s = String(t).toLowerCase();
  if (s === 'incoming' || s === '0') return 0;
  if (s === 'outgoing' || s === '1') return 1;
  if (s === 'activity' || s === '2') return 2;
  if (s === 'template' || s === '3') return 3;
  const n = Number(s);
  return Number.isNaN(n) ? t : n;
}

// Cached devise_token_auth session for the Chatwoot worker account
let sessionCache = null; // { headers, expiresAt }

async function getChatwootSession(env) {
  if (sessionCache && Date.now() < sessionCache.expiresAt) return sessionCache.headers;
  const email = env.CHATWOOT_SESSION_EMAIL;
  const password = env.CHATWOOT_SESSION_PASSWORD;
  if (!email || !password) throw new Error('chatwoot session not configured');
  const res = await fetch(`${CHATWOOT_BASE}/auth/sign_in`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      // Non-browser UA: when Buddy's session cap (5) is reached, Chatwoot auto-evicts
      // the oldest session for non-Mozilla clients instead of returning the 409 picker.
      // Browser UAs get a 409 session-picker response that would break this bridge.
      'user-agent': 'slamdunk-chat-bridge/1.0',
    },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`chatwoot login ${res.status}`);
  const headers = {
    'access-token': res.headers.get('access-token') || '',
    client: res.headers.get('client') || '',
    uid: res.headers.get('uid') || '',
    'token-type': 'Bearer',
  };
  const expiry = Number(res.headers.get('expiry')) * 1000 || Date.now() + 14 * 24 * 3600 * 1000;
  sessionCache = { headers, expiresAt: Math.min(expiry - 60_000, Date.now() + 6 * 24 * 3600 * 1000) };
  return headers;
}

async function chatwootApi(env, path, options = {}, externalHeaders = null) {
  const doCall = async (headers) =>
    fetch(`https://app.chatwoot.com/api/v1/accounts/${env.CHATWOOT_ACCOUNT_ID}${path}`, {
      ...options,
      headers: { ...headers, 'content-type': 'application/json', ...(options.headers || {}) },
    });
  // Prefer a session passed in by the caller (e.g. the poller's long-lived devise session):
  // avoids a per-request /auth/sign_in, which Chatwoot rate-limits (~5/60s) → 429 crashes.
  if (externalHeaders) {
    let extRes = await doCall(externalHeaders);
    if (extRes.status !== 401 && extRes.status !== 403) return extRes;
  }
  let res = await doCall(await getChatwootSession(env));
  if (res.status === 401 || res.status === 403) {
    sessionCache = null;
    res = await doCall(await getChatwootSession(env));
  }
  return res;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export async function onRequestPost(context) {
  const env = context.env || {};
  const {
    VAPI_API_KEY,
    VAPI_ASSISTANT_ID,
    CHATWOOT_ACCOUNT_ID,
    CHATWOOT_WEBHOOK_SECRET,
  } = env;

  const url = new URL(context.request.url);
  const providedSecret = url.searchParams.get('secret') || context.request.headers.get('x-chatwoot-secret');
  if (!CHATWOOT_WEBHOOK_SECRET || providedSecret !== CHATWOOT_WEBHOOK_SECRET) {
    return json({ ok: false, error: 'unauthorized' }, 401);
  }

  if (!VAPI_API_KEY || !CHATWOOT_ACCOUNT_ID) {
    return json({ ok: false, error: 'bridge not configured' }, 500);
  }

  let payload;
  try {
    payload = await context.request.json();
  } catch {
    return json({ ok: false, error: 'bad json' }, 400);
  }

  if (payload.event !== 'message_created') {
    return json({ ok: true, ignored: payload.event });
  }

  // message_type: 0=incoming (visitor), 1=outgoing (agent/bot), 2=activity, 3=template
  // Webhook payloads use string labels; the Chatwoot REST API uses integers. Normalize both.
  const message = payload.message_type !== undefined
    ? { type: normalizeMessageType(payload.message_type), content: payload.content, id: payload.id }
    : { type: normalizeMessageType(payload.data?.message?.message_type), content: payload.data?.message?.content, id: payload.data?.message?.id };
  const conversationId = payload.conversation?.id || payload.conversation_id || payload.data?.conversation?.id;
  const inboxId = payload.inbox?.id || payload.data?.inbox?.id;

  // Only react to real visitor text messages in a VAPI-manned inbox
  if (message.type !== 0 || !message.content || message.content.trim() === '') {
    return json({ ok: true, ignored: 'not an incoming text message' });
  }
  const assignedAssistant = INBOX_ASSISTANTS[inboxId];
  if (!assignedAssistant) {
    return json({ ok: true, ignored: 'inbox not VAPI-manned' });
  }
  if (!conversationId) {
    return json({ ok: false, error: 'missing conversation id' }, 400);
  }

  // Wrap the Chatwoot/VAPI pipeline so any thrown error (login 429/401, network,
  // non-JSON response) returns a JSON 502 the poller can retry, instead of an
  // uncaught crash that surfaces as a Cloudflare HTML 500 page.
  try {
    const externalHeaders = {
      uid: context.request.headers.get('x-cw-uid') || null,
      client: context.request.headers.get('x-cw-client') || null,
      'access-token': context.request.headers.get('x-cw-token') || null,
    };
    const hasExternal = Boolean(externalHeaders.uid && externalHeaders.client && externalHeaders['access-token']);
    const routedInboxId = inboxId || (payload.inbox?.id || payload.data?.inbox?.id || null);
    return await processMessage(context.env, message, conversationId, hasExternal ? externalHeaders : null, assignedAssistant, routedInboxId);
  } catch (e) {
    return json({ ok: false, error: `bridge: ${e && e.message ? e.message : String(e)}` }, 502);
  }
}

async function processMessage(env, message, conversationId, externalHeaders = null, assignedAssistant = SLAMDUNK_CHAT_ASSISTANT_ID, inboxId = null) {
  const { VAPI_API_KEY, CHATWOOT_ACCOUNT_ID } = env;
  if (!VAPI_API_KEY || !CHATWOOT_ACCOUNT_ID) {
    return json({ ok: false, error: 'bridge not configured' }, 500);
  }
  // Unified person-memory (Kate 10/10/2026): resolve this visitor's ids BEFORE Kate speaks.
  // Stable web key = Chatwoot contact id (persists per browser widget across conversations);
  // attach email/phone when the visitor has shared them so web memory merges with phone/SMS.
  let memMarker = '';
  let channelTag = `[CHANNEL WEB_CHAT - this is a WEBSITE CHAT from ${SOURCE_BY_INBOX[inboxId] || 'a website'}. Not a phone call, not SMS, not email. Capabilities: text replies, links, tools that send chat/SMS/email. You CANNOT transfer a call here - if they need a human/call, offer a callback or take a message instead.]`;
  try {
    const convRes = await chatwootApi(env, `/conversations/${conversationId}`, {}, externalHeaders);
    if (convRes.ok) {
      const conv = (await convRes.json()) || {};
      const contact = conv.payload?.contact || conv.contact || {};
      const ids = [`web:visitor_cwcontact_${contact.id || 'unknown'}`];
      let visitorId = 'unknown';
      if (contact.email) ids.push(`email:${String(contact.email).toLowerCase()}`);
      if (contact.phone_number) ids.push(String(contact.phone_number));
      visitorId = `web:visitor_cwcontact_${contact.id || 'unknown'}`;
      memMarker = `[MEM-ID ${ids.join('; ')}]`;
      // Channel tag (Kate spec 10/10): tell Kate this is a WEB CHAT, not SMS/email/call.
      channelTag = `[CHANNEL WEB_CHAT - this is a WEBSITE CHAT from ${SOURCE_BY_INBOX[inboxId] || 'a website'} (visitor: ${visitorId}). Not a phone call, not SMS, not email. Capabilities: text replies, links, tools that send chat/SMS/email. You CANNOT transfer a call here - if they need a human/call, offer a callback or take a message instead.]`;
      // Human-visible channel label (Kate spec 10/10): tag the Chatwoot conversation once so
      // Glenn/Travis instantly see this is a WEB CHAT, its source, and the visitor id.
      try {
        const srcLabel = SOURCE_BY_INBOX[inboxId] || 'website';
        const labels = (conv.payload && conv.payload.labels) || conv.labels || [];
        if (!labels.includes('channel:web_chat')) {
          await chatwootApi(env, `/conversations/${conversationId}/labels`, { method: 'POST', body: JSON.stringify({ labels: ['channel:web_chat', `source:${srcLabel}`] }) }, externalHeaders);
          await chatwootApi(env, `/conversations/${conversationId}/messages`, { method: 'POST', body: JSON.stringify({ content: `Channel: Web Chat
Source: ${srcLabel}
Visitor: ${visitorId}
Display: Kate - Web Chat - ${srcLabel} - ${visitorId}`, message_type: 'outgoing', private: true }) }, externalHeaders);
        }
      } catch { /* label is best-effort */ }
    }
  } catch { /* memory marker is best-effort; chat continues without it */ }
  // 1) Pull conversation history from Chatwoot (visitor + agent text messages)
  const histRes = await chatwootApi(env, `/conversations/${conversationId}/messages`, {}, externalHeaders);
  if (!histRes.ok) {
    return json({ ok: false, error: `chatwoot history ${histRes.status}` }, 502);
  }
  const histData = await histRes.json();
  const items = (histData.payload || histData.data?.messages || [])
    .slice()
    .sort((a, b) => (a.id || 0) - (b.id || 0))
    .filter((m) => {
      const t = normalizeMessageType(m.message_type);
      return (t === 0 || t === 1) && m.content && m.content.trim() !== '';
    })
    .slice(-MAX_HISTORY)
    .map((m) => {
      const t = normalizeMessageType(m.message_type);
      return { role: t === 0 ? 'user' : 'assistant', content: String(m.content).slice(0, 2000) };
    });

  if (!items.length || items[items.length - 1].role !== 'user') {
    items.push({ role: 'user', content: String(message.content).slice(0, 2000) });
  }
  // Tag the CURRENT turn with the visitor's memory ids (kept out of the Chatwoot history;
  // only injected into the VAPI input so load/save_person_memory keys on a stable id).
  const tags = [];
  if (channelTag) tags.push(channelTag);
  if (memMarker) tags.push(memMarker);
  if (tags.length) {
    const last = items[items.length - 1];
    if (last.role === 'user' && !last.content.includes('[CHANNEL ')) {
      last.content = `${tags.join('\n')}\n\n${last.content}`;
    }
  }

  // 2) Ask the VAPI Buddy Chat Agent
  const vapiRes = await fetch('https://api.vapi.ai/chat', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${VAPI_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      // Route each brand's chat to that brand's VAPI assistant.
      assistantId: assignedAssistant,
      input: items,
      ...(await (async () => {
        const tt = await textToolIds(assignedAssistant, VAPI_API_KEY);
        // Only send the override when we have a COMPLETE model (provider+model+ids).
        // A partial model (e.g. {}) makes VAPI /chat return HTTP 400.
        if (tt && Array.isArray(tt.ids) && tt.provider && tt.model) {
          return { assistantOverrides: { model: { provider: tt.provider, model: tt.model, toolIds: tt.ids } } };
        }
        return {};
      })()),
    }),
  });
  const vapiData = await vapiRes.json().catch(() => null);
  if (!vapiRes.ok || !vapiData) {
    return json({ ok: false, error: `vapi ${vapiRes.status}` }, 502);
  }
  const output = Array.isArray(vapiData.output)
    ? vapiData.output.filter((o) => o.role === 'assistant').map((o) => o.content).join('\n').trim()
    : (typeof vapiData.output === 'string' ? vapiData.output : '').trim();
  if (!output) {
    return json({ ok: false, error: 'empty vapi output' }, 502);
  }

  // 3) Post Buddy's reply back into the Chatwoot conversation
  const replyRes = await chatwootApi(env, `/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content: output, message_type: 'outgoing', private: false }),
  }, externalHeaders);
  if (!replyRes.ok) {
    return json({ ok: false, error: `chatwoot reply ${replyRes.status}` }, 502);
  }

  return json({ ok: true, conversationId, replied: output.slice(0, 120) });
}

export async function onRequestGet(context) {
  return json({
    ok: true,
    service: 'slamdunk-vapi-chat-bridge',
    target: 'VAPI Buddy Chat Agent',
    configured: Boolean(
      context.env && context.env.VAPI_API_KEY && context.env.VAPI_ASSISTANT_ID && context.env.CHATWOOT_SESSION_EMAIL
    ),
  });
}
