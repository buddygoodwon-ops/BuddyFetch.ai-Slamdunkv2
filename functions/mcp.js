/**
 * SlamDunk Technologies MCP Server (Streamable HTTP) — v2
 * Hosted as a Cloudflare Pages Function at https://slamdunktechnologies.com/mcp
 *
 * Lets AI assistants (Claude, ChatGPT, Cursor, ...) work with SlamDunk:
 *   - Company Brain knowledge base            get_company_brain
 *   - services list and any site page         list_services, get_page_content
 *   - contact info, demo booking, quotes      get_contact_info, book_demo, request_quote
 *   - live chat with the team (Chatwoot)      start_live_chat, send_chat_message, get_chat_replies
 *   - text the team (RingCentral)             send_text_to_team
 *   - email the team (Resend)                 send_email_to_team
 *
 * Self-contained (no npm deps, no bindings) so it deploys with the site via git push.
 * Texts and emails ONLY go to the team numbers/addresses below; the AI can never pick the recipient.
 *
 * Settings come from Cloudflare Pages > Settings > Variables and Secrets (Production):
 *   Live chat:  CHATWOOT_INBOX_IDENTIFIER   (Chatwoot > Inboxes > your API inbox > Configuration)
 *   Texting:    RINGCENTRAL_CLIENT_ID, RINGCENTRAL_CLIENT_SECRET, RINGCENTRAL_JWT  (secrets)
 *   Email:      RESEND_API_KEY (secret), optional EMAIL_FROM (default mcp@slamdunktechnologies.com)
 * Any tool whose settings are missing replies with a polite "not set up yet" and the phone number.
 */

const SERVER_INFO = { name: 'slamdunk-mcp', version: '2.0.0' };
const PROTOCOL_VERSION = '2025-06-18';

// ---------- Fixed team settings (edit here) ----------
const SITE = 'https://slamdunktechnologies.com';
const COMPANY = 'SlamDunk Technologies';
const MAIN_PHONE = '(619) 642-2585';
const BOOKING_URL = 'https://calendly.com/glenn-wilbor-birdrockfunding/30min';
const BUDDY_URL = 'https://www.buddyfetch.ai/slamdunk';
const TEAM_EMAIL_TO = 'buddy@buddyfetch.ai';
const TEAM_SMS_TO = ['+16196422585'];
const SMS_FROM = '+16198377326';
const SMS_LABEL = 'AI Text from SlamDunk Technologies';
const CHATWOOT_BASE = 'https://app.chatwoot.com';
const RINGCENTRAL_SERVER = 'https://platform.ringcentral.com';

// ---------- Company Brain ----------
const COMPANY_BRAIN = {
  company: {
    name: 'SlamDunk Technologies',
    poweredBy: 'BuddyFetch.AI',
    tagline: 'The Agentic AI Team',
    website: 'https://slamdunktechnologies.com',
    description:
      'SlamDunk Technologies deploys intelligent BuddyFetch.AI agents for small and medium businesses - an agentic AI operating layer that mines prospects, runs workflows, handles marketing, and adapts to scale, all managed by phone, text, and email.',
  },
  team: [
    { name: 'Glenn Wilbor', title: 'Founder & CEO', phone: '(858) 449-0541' },
    { name: 'Buddy Goodwon', title: 'Co-Founder, CMO & CTO', phone: '(619) 642-2585', email: 'buddy@buddyfetch.ai' },
  ],
  technologyDeployments: {
    count: 9,
    summary:
      '9 deployments of the technology: 4 core features on the Home page (AI-Optimized Workflows, Autonomous Agents, Built In Marketing Skills, Scalable. Smart. Adaptable.) plus 5 enhanced features on The Wild Wide Open Future page (Company Brain, Distribution of Intelligence, Custom Virtual Company Mascot, MCP Server Conversion of Website, AI Avatar App). The fifth Home page card links to The Wild Wide Open Future page.',
  },
  contact: {
    mainContact: 'Buddy Goodwon, Co-Founder, CMO & CTO',
    phone: MAIN_PHONE,
    email: 'buddy@buddyfetch.ai',
    website: 'slamdunktechnologies.com',
    address: '5234 Cushman Place #300, San Diego, CA 92110',
    bookDemo: `${BOOKING_URL} (30 minutes with Glenn Wilbor, Founder & CEO)`,
  },
  mainFeatures: [
    {
      name: 'AI-Optimized Workflows',
      page: `${SITE}/workflows.html`,
      tagline: 'Utilizing new or existing Apps.',
      description:
        'Connect the tools your team already uses - your Website, POS, CRM, Fulfillment Software and Scheduling - so info flows with no need to input and export CSV files or manually enter redundant info. We add the tools you are missing, from Live Chat run by an AI worker to configured APIs, Zapier, Cloudflare Webhooks, Endpoints, and Nodes - creating an AI operating layer that turns scattered work into a clear, repeatable path.',
    },
    {
      name: 'Autonomous Agents',
      page: `${SITE}/agents.html`,
      tagline: 'Managed By Phone, Text & Emails.',
      description:
        'Autonomous Agents. BuddyFetch.Ai agents plan, act, and deliver across complex tasks - eliminating repetitive but complex work from data mining to web scraping. Set up the roles, responsibilities, and tasks for each BuddyFetch.Ai agent to handle, from Social Media to Admin, with the context and persistence to take work from start to finish.',
    },
    {
      name: 'Built In Marketing Skills',
      page: `${SITE}/marketing.html`,
      tagline: 'Mass Calling, Text & Emailing.',
      description:
        'Built in Marketing Skills. Marketing execution on demand: Scalable Calling Agents that follow pre-programmed sales funnels to find real interested people, capture their answers, and feed them into your Point of Sale systems - then seamlessly transfer the call to employees prescreened and looking for service or a type of business. Mass email and text outreach campaigns and follow-up workflows. Real-time messaging and returned calls.',
    },
    {
      name: 'Scalable. Smart. Adaptable.',
      page: `${SITE}/smart.html`,
      tagline: 'Consistency, 24/7. Built to scale',
      description:
        'Scalable. Smart. Adaptable. We automated your business and your BuddyFetch.Ai agent handles, maintenance, upgrades and execution including scalability analyzing based on volume and turn times, interpreting when to add more AI Agents or more Humans, anticipating the need to change and adapt; additional Systems and/or refinement of Roles and Delegation. Build an operating layer that can handle the next client, campaign, and opportunity without rebuilding the business from scratch.',
    },
    {
      name: 'The Wild Wide Open Future',
      page: `${SITE}/future.html`,
      tagline: 'Enhanced Features.',
      description:
        'The Wild Wide Open Future! SlamDunk deploys intelligent BuddyFetch.AI agents. But that is only the Beginning. We have several Additional Features to take you from Wow to No WAY!',
      futureFeatures: [
        {
          name: 'Company Brain',
          page: `${SITE}/company-brain.html`,
          tagline: 'Accessible by AI and Humans.',
          description:
            'A knowledge base accessible to both AI and humans, built on Googles new OKF format, so every agent and every teammate draws from the same page that not only serves up the info but fills it out customized ready to deliver.',
        },
        {
          name: 'Distribution of Intelligence',
          page: `${SITE}/distribution.html`,
          tagline: 'Delegated Permission Authority.',
          description: 'Delegating the right information to the right agents and employees with Delegated Permission Authority.',
        },
        {
          name: 'Custom Virtual Company Mascot',
          page: `${SITE}/virtual-mascot.html`,
          tagline: 'Unique and Fun Live Chat sessions.',
          description: 'Unique and fun interactions that bring functionality to your brand.',
        },
        {
          name: 'MCP Server Conversion of Website',
          page: `${SITE}/mcp-server.html`,
          tagline: 'Allows AI to interact with your Website.',
          description: 'Allows AI agents to interact with your website so it can book an appointment, get a quote, or even make a purchase.',
        },
        {
          name: 'AI Avatar App',
          page: `${SITE}/avatar-app.html`,
          tagline: 'Managed BuddyFetch AIs through LIVE app.',
          description:
            'Manage your BuddyFetch.AIs Company Mascot through a LIVE app like a FaceTime call; employees can access it too through Delegated Permission Authority; have it attend meetings through a Zoom call. It is Wild!',
          buddyFetchLink: BUDDY_URL,
        },
      ],
    },
  ],
};

const PAGES = {
  'index.html': 'Home',
  'workflows.html': 'AI-Optimized Workflows',
  'agents.html': 'Autonomous Agents',
  'marketing.html': 'Built In Marketing Skills',
  'smart.html': 'Scalable. Smart. Adaptable.',
  'future.html': 'The Wild Wide Open Future',
  'company-brain.html': 'Company Brain',
  'distribution.html': 'Distribution of Intelligence',
  'virtual-mascot.html': 'Custom Virtual Company Mascot',
  'mcp-server.html': 'MCP Server Conversion of Website',
  'avatar-app.html': 'AI Avatar App',
  'book-a-demo.html': 'Book a Demo',
};

// ---------- helpers ----------
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Mcp-Session-Id, Mcp-Protocol-Version, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
};
function jsonOk(body, sessionId) {
  const headers = { 'Content-Type': 'application/json', ...CORS };
  if (sessionId) headers['Mcp-Session-Id'] = sessionId;
  return new Response(JSON.stringify(body), { status: 200, headers });
}
function jsonError(id, code, message) {
  return jsonOk({ jsonrpc: '2.0', id: id ?? null, error: { code, message } });
}
const text = (t) => ({ content: [{ type: 'text', text: t }] });
const fail = (t) => ({ isError: true, content: [{ type: 'text', text: t }] });
const clean = (s, max) => String(s ?? '').replace(/[\u0000-\u0008\u000B-\u001F]/g, '').trim().slice(0, max);
const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || ''));
const notSetUp = (what) =>
  fail(`${what} isn't set up yet. The user can call or text ${MAIN_PHONE}, or book a demo at ${BOOKING_URL}.`);

function htmlToText(html) {
  return html
    .replace(/<(head|script|style|noscript|svg)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>|<\/(p|div|h[1-6]|li|section)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;|&apos;|&rsquo;/g, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/g, '"')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}
function metaDescription(html) {
  const m = html.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i);
  return m ? htmlToText(m[1]) : '';
}

// Best-effort abuse limit: 5 sends per visitor IP per minute (per server instance).
const SEND_LOG = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const hits = (SEND_LOG.get(ip) || []).filter((t) => now - t < 60_000);
  if (hits.length >= 5) { SEND_LOG.set(ip, hits); return true; }
  hits.push(now); SEND_LOG.set(ip, hits);
  if (SEND_LOG.size > 5000) SEND_LOG.clear();
  return false;
}

// ---------- Chatwoot (public client API, API-channel inbox) ----------
async function chatwoot(env, path, init = {}) {
  const res = await fetch(`${CHATWOOT_BASE}/public/api/v1/inboxes/${env.CHATWOOT_INBOX_IDENTIFIER}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  if (!res.ok) throw new Error(`Live chat error (HTTP ${res.status})`);
  return res.json();
}

// ---------- RingCentral ----------
let rcToken = null; // { token, expiresAt }
async function ringCentralToken(env) {
  if (rcToken && Date.now() < rcToken.expiresAt) return rcToken.token;
  const res = await fetch(`${RINGCENTRAL_SERVER}/restapi/oauth/token`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + btoa(`${env.RINGCENTRAL_CLIENT_ID}:${env.RINGCENTRAL_CLIENT_SECRET}`),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: env.RINGCENTRAL_JWT }),
  });
  if (!res.ok) throw new Error(`Texting sign-in failed (HTTP ${res.status})`);
  const j = await res.json();
  rcToken = { token: j.access_token, expiresAt: Date.now() + Math.max(60, (j.expires_in || 3600) - 120) * 1000 };
  return rcToken.token;
}
async function sendText(env, body) {
  const token = await ringCentralToken(env);
  const res = await fetch(`${RINGCENTRAL_SERVER}/restapi/v1.0/account/~/extension/~/sms`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: { phoneNumber: env.RINGCENTRAL_FROM_NUMBER || SMS_FROM },
      to: TEAM_SMS_TO.map((n) => ({ phoneNumber: n })),
      text: body,
    }),
  });
  if (!res.ok) throw new Error(`Text failed (HTTP ${res.status})`);
}
const smsReady = (env) => !!(env.RINGCENTRAL_CLIENT_ID && env.RINGCENTRAL_CLIENT_SECRET && env.RINGCENTRAL_JWT);

// ---------- Email (Resend) ----------
async function sendEmail(env, { replyTo, replyName, subject, body }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: `${COMPANY} Website AI <${env.EMAIL_FROM || 'mcp@slamdunktechnologies.com'}>`,
      to: [TEAM_EMAIL_TO],
      reply_to: replyName ? `${replyName} <${replyTo}>` : replyTo,
      subject: `[Website AI] ${subject}`,
      text: body,
    }),
  });
  if (!res.ok) throw new Error(`Email failed (HTTP ${res.status})`);
}

// ---------- Tool definitions ----------
const obj = (properties, required = []) => ({ type: 'object', properties, required });
const str = (description) => ({ type: 'string', description });

const TOOLS = [
  {
    name: 'get_company_brain',
    description:
      'Get the SlamDunk Technologies Company Brain knowledge base: company info, team (founders), the 9 technology deployments, contact, and all service features with page links.',
    inputSchema: obj({}),
  },
  {
    name: 'list_services',
    description: 'List everything SlamDunk Technologies offers, with a short description and page link for each.',
    inputSchema: obj({}),
  },
  {
    name: 'get_page_content',
    description: 'Read the current text of any page on slamdunktechnologies.com. Pages: ' + Object.keys(PAGES).join(', '),
    inputSchema: obj({ page: str('Page filename, e.g. company-brain.html or index.html') }, ['page']),
  },
  {
    name: 'get_contact_info',
    description: 'How to reach SlamDunk Technologies: phone, email, address, team, demo link and live chat.',
    inputSchema: obj({}),
  },
  {
    name: 'book_demo',
    description:
      "Get the link to book a 30-minute demo with Glenn Wilbor, Founder & CEO (Calendly). Give the link to the user so they can pick a time. Call this when a user wants a demo or to talk to a person.",
    inputSchema: obj({ name: str('User name (optional, pre-fills the form)'), email: str('User email (optional, pre-fills the form)') }),
  },
  {
    name: 'request_quote',
    description:
      'Request a quote for BuddyFetch.AI agentic AI services for the user. When email is set up, the request is emailed straight to the team and they reply to the user.',
    inputSchema: obj(
      { name: str("User's name"), email: str("User's email for the reply"), company: str('Company name'), needs: str('What they need a quote for') },
      ['name', 'email']
    ),
  },
  {
    name: 'start_live_chat',
    description:
      "Start a live chat with the SlamDunk Technologies team for the user and send their first message. Returns chat_token and conversation_id; keep them to send more messages and read replies.",
    inputSchema: obj(
      { name: str("User's name"), email: str("User's email (optional)"), message: str('First message to the team') },
      ['name', 'message']
    ),
  },
  {
    name: 'send_chat_message',
    description: 'Send another message in a live chat started with start_live_chat.',
    inputSchema: obj(
      { chat_token: str('chat_token from start_live_chat'), conversation_id: { type: 'number', description: 'conversation_id from start_live_chat' }, message: str('Message') },
      ['chat_token', 'conversation_id', 'message']
    ),
  },
  {
    name: 'get_chat_replies',
    description: "Read the conversation so far in a live chat started with start_live_chat, including the team's replies.",
    inputSchema: obj(
      { chat_token: str('chat_token from start_live_chat'), conversation_id: { type: 'number', description: 'conversation_id from start_live_chat' } },
      ['chat_token', 'conversation_id']
    ),
  },
  {
    name: 'send_text_to_team',
    description:
      'Send a text message (SMS) to the SlamDunk Technologies team for the user, e.g. a callback request. The text always goes to the team; it cannot be sent to anyone else.',
    inputSchema: obj(
      { name: str("User's name"), reply_phone: str('Number the team should reply to (optional)'), message: str('Message (max 500 characters)') },
      ['name', 'message']
    ),
  },
  {
    name: 'send_email_to_team',
    description:
      "Send an email to the SlamDunk Technologies team for the user. Replies go to the user's email. The email always goes to the team; it cannot be sent to anyone else.",
    inputSchema: obj(
      { name: str("User's name"), email: str("User's email for the team's reply"), subject: str('Subject'), message: str('Message') },
      ['name', 'email', 'subject', 'message']
    ),
  },
];

// ---------- Tool implementations ----------
async function handleTool(name, a, env, ip) {
  switch (name) {
    case 'get_company_brain':
      return text(JSON.stringify(COMPANY_BRAIN, null, 2));

    case 'list_services': {
      const rows = [];
      for (const f of COMPANY_BRAIN.mainFeatures) {
        rows.push(`- ${f.name}: ${f.tagline} ${f.page}`);
        for (const ff of f.futureFeatures || []) rows.push(`   - ${ff.name}: ${ff.tagline} ${ff.page}`);
      }
      return text(`${COMPANY} services (9 technology deployments):\n${rows.join('\n')}\n\nBook a demo: ${BOOKING_URL}`);
    }

    case 'get_page_content': {
      let page = String(a.page || 'index.html').replace(/^\/+/, '').split('?')[0].split('#')[0];
      if (!page.endsWith('.html')) page += '.html';
      if (!PAGES[page]) return fail(`Unknown page "${page}". Available pages: ${Object.keys(PAGES).join(', ')}`);
      try {
        const resp = await fetch(`${SITE}/${page}`, { redirect: 'follow', headers: { 'User-Agent': 'SlamDunk-MCP' } });
        if (!resp.ok) return fail(`Could not load ${page} (HTTP ${resp.status})`);
        return text(`${PAGES[page]} - ${SITE}/${page}\n\n${htmlToText(await resp.text()).slice(0, 8000)}`);
      } catch (e) {
        return fail(`Failed to fetch page: ${e.message}`);
      }
    }

    case 'get_contact_info': {
      const c = COMPANY_BRAIN.contact;
      return text(
        [
          COMPANY,
          `Main contact: ${c.mainContact} - ${c.phone}`,
          ...COMPANY_BRAIN.team.filter((m) => m.phone !== c.phone).map((m) => `${m.name}, ${m.title}: ${m.phone}`),
          `Email: ${c.email}`,
          `Website: ${c.website}`,
          `Address: ${c.address}`,
          `Book a demo: ${BOOKING_URL}`,
          `Talk to Buddy (AI assistant): ${BUDDY_URL}`,
          'Live chat: use the start_live_chat tool, or the chat bubble on the website.',
        ].join('\n')
      );
    }

    case 'book_demo': {
      const params = new URLSearchParams();
      if (a.name) params.set('name', clean(a.name, 100));
      if (isEmail(a.email)) params.set('email', String(a.email));
      const url = BOOKING_URL + (params.toString() ? '?' + params : '');
      return text(
        `Book a demo with ${COMPANY} here: ${url}\n` +
          "It's a 30-minute call with the founder, Glenn Wilbor, on Calendly. The page shows open times; pick one and confirm to book.\n" +
          `Need help right away? Call ${MAIN_PHONE}.`
      );
    }

    case 'request_quote': {
      if (!a.name || !isEmail(a.email)) return fail('A name and a valid email are required.');
      const n = clean(a.name, 100);
      const co = clean(a.company, 150);
      const subject = `Quote Request - ${n}${co ? ' - ' + co : ''}`;
      const body =
        'Hi Buddy,\n\nWe are interested in a quote for BuddyFetch.AI agentic AI services.\n\n' +
        `Name: ${n}\nCompany: ${co || '-'}\nWhat we need: ${clean(a.needs, 3000) || '-'}\n\nPlease reach me at ${a.email}.\n\nThank you!`;
      if (env.RESEND_API_KEY) {
        if (rateLimited(ip)) return fail('Too many requests. Please wait a minute and try again.');
        try {
          await sendEmail(env, { replyTo: a.email, replyName: n, subject, body: `${body}\n\n(Sent through an AI assistant via the ${COMPANY} MCP server.)` });
          return text(`Quote request sent to the ${COMPANY} team. They'll reply to ${a.email}.\nTo talk sooner, book a demo: ${BOOKING_URL}`);
        } catch { /* fall through to manual version */ }
      }
      return text(
        `Quote request prepared for ${n} (${a.email}).\n\n` +
          `Send it via email to ${TEAM_EMAIL_TO}, subject "${subject}":\nmailto:${TEAM_EMAIL_TO}?subject=${encodeURIComponent(subject)}\n\n` +
          `Email template body:\n"${body}"\n\nAlternative: call ${MAIN_PHONE} or book a demo at ${BOOKING_URL}`
      );
    }

    case 'start_live_chat': {
      if (!env.CHATWOOT_INBOX_IDENTIFIER) return notSetUp('Live chat through AI assistants');
      if (!a.name || !a.message) return fail('A name and a message are required.');
      if (rateLimited(ip)) return fail('Too many requests. Please wait a minute and try again.');
      try {
        const contact = await chatwoot(env, '/contacts', {
          method: 'POST',
          body: JSON.stringify({ name: clean(a.name, 100), ...(isEmail(a.email) ? { email: a.email } : {}) }),
        });
        const token = contact.source_id;
        const conv = await chatwoot(env, `/contacts/${token}/conversations`, { method: 'POST', body: '{}' });
        await chatwoot(env, `/contacts/${token}/conversations/${conv.id}/messages`, {
          method: 'POST',
          body: JSON.stringify({ content: `[Via AI assistant] ${clean(a.message, 2000)}` }),
        });
        return text(
          `Chat started with the ${COMPANY} team. Message delivered.\nchat_token: ${token}\nconversation_id: ${conv.id}\n` +
            'Use get_chat_replies in a little while to see the answer.'
        );
      } catch (e) {
        return fail(`${e.message}. The user can call or text ${MAIN_PHONE} directly.`);
      }
    }

    case 'send_chat_message': {
      if (!env.CHATWOOT_INBOX_IDENTIFIER) return notSetUp('Live chat through AI assistants');
      const token = encodeURIComponent(clean(a.chat_token, 200));
      const id = Number(a.conversation_id);
      if (!token || !Number.isInteger(id) || !a.message) return fail('chat_token, conversation_id and message are required.');
      try {
        await chatwoot(env, `/contacts/${token}/conversations/${id}/messages`, {
          method: 'POST',
          body: JSON.stringify({ content: clean(a.message, 2000) }),
        });
        return text('Message sent.');
      } catch (e) {
        return fail(e.message);
      }
    }

    case 'get_chat_replies': {
      if (!env.CHATWOOT_INBOX_IDENTIFIER) return notSetUp('Live chat through AI assistants');
      const token = encodeURIComponent(clean(a.chat_token, 200));
      const id = Number(a.conversation_id);
      if (!token || !Number.isInteger(id)) return fail('chat_token and conversation_id are required.');
      try {
        const msgs = await chatwoot(env, `/contacts/${token}/conversations/${id}/messages`);
        const list = (Array.isArray(msgs) ? msgs : msgs.payload || [])
          .filter((m) => m.content && !m.private && (m.message_type === 0 || m.message_type === 1))
          .map((m) => `${m.message_type === 0 ? 'User' : COMPANY}: ${m.content}`);
        return text(list.length ? list.join('\n') : 'No messages yet.');
      } catch (e) {
        return fail(e.message);
      }
    }

    case 'send_text_to_team': {
      if (!smsReady(env)) return notSetUp('Texting');
      if (!a.name || !a.message) return fail('A name and a message are required.');
      if (rateLimited(ip)) return fail('Too many requests. Please wait a minute and try again.');
      const body =
        `${SMS_LABEL}\nFrom: ${clean(a.name, 100)}${a.reply_phone ? ` (${clean(a.reply_phone, 30)})` : ''}\n` +
        `${clean(a.message, 500)}\n(Sent by a visitor's AI assistant via slamdunktechnologies.com)`;
      try {
        await sendText(env, body);
        return text(`Text sent to the ${COMPANY} team. They'll get back to ${a.reply_phone ? clean(a.reply_phone, 30) : 'you'} soon.`);
      } catch (e) {
        return fail(`${e.message}. The user can call ${MAIN_PHONE} directly.`);
      }
    }

    case 'send_email_to_team': {
      if (!env.RESEND_API_KEY) return notSetUp('Email');
      if (!a.name || !isEmail(a.email) || !a.subject || !a.message) return fail('Name, a valid email, subject and message are required.');
      if (rateLimited(ip)) return fail('Too many requests. Please wait a minute and try again.');
      const n = clean(a.name, 100);
      try {
        await sendEmail(env, {
          replyTo: a.email,
          replyName: n,
          subject: clean(a.subject, 150),
          body: `From: ${n} <${a.email}>\nSent through an AI assistant via the ${COMPANY} MCP server.\n\n${clean(a.message, 5000)}`,
        });
        return text(`Email sent to the ${COMPANY} team. They'll reply to ${a.email}.`);
      } catch (e) {
        return fail(`${e.message}. The user can call ${MAIN_PHONE}.`);
      }
    }

    default:
      return fail(`Unknown tool: ${name}`);
  }
}

// ---------- MCP request handling ----------
async function handlePost(request, env) {
  const body = await request.json().catch(() => null);
  if (!body || body.jsonrpc !== '2.0') return jsonError(null, -32600, 'Invalid Request: JSON-RPC 2.0 expected');
  const { id, method, params } = body;
  const sessionId = request.headers.get('Mcp-Session-Id') || crypto.randomUUID();
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';

  switch (method) {
    case 'initialize':
      return jsonOk(
        {
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: PROTOCOL_VERSION,
            capabilities: { tools: { listChanged: false } },
            serverInfo: SERVER_INFO,
            instructions:
              'This MCP server exposes SlamDunk Technologies (slamdunktechnologies.com, powered by BuddyFetch.AI). ' +
              'Use get_company_brain for the knowledge base, list_services or get_page_content for details, book_demo to schedule with the founder, ' +
              'request_quote for quotes, and start_live_chat / send_text_to_team / send_email_to_team to reach the team.',
          },
        },
        sessionId
      );
    case 'notifications/initialized':
      return new Response(null, { status: 202, headers: CORS });
    case 'ping':
      return jsonOk({ jsonrpc: '2.0', id, result: {} }, sessionId);
    case 'tools/list':
      return jsonOk({ jsonrpc: '2.0', id, result: { tools: TOOLS } }, sessionId);
    case 'tools/call': {
      const { name, arguments: args } = params || {};
      if (!name) return jsonError(id, -32602, 'Invalid params: tool name required');
      if (!TOOLS.find((t) => t.name === name)) return jsonError(id, -32602, `Unknown tool: ${name}`);
      try {
        return jsonOk({ jsonrpc: '2.0', id, result: await handleTool(name, args || {}, env || {}, ip) }, sessionId);
      } catch (e) {
        return jsonOk({ jsonrpc: '2.0', id, result: fail(`Tool error: ${e.message}`) }, sessionId);
      }
    }
    default:
      if (id === undefined) return new Response(null, { status: 202, headers: CORS }); // other notifications
      return jsonError(id, -32601, `Method not found: ${method}`);
  }
}

// GET: friendly page for browsers; SSE stream for MCP clients
function handleGet(request, url) {
  if ((request.headers.get('Accept') || '').includes('text/html')) {
    return new Response(
      `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${COMPANY} MCP Server</title>` +
        `<body style="font-family:system-ui;max-width:640px;margin:40px auto;padding:0 16px;line-height:1.5">` +
        `<h1>${COMPANY} MCP Server</h1><p>This address lets AI assistants connect to ${COMPANY}: learn about our services, book a demo, request a quote, live chat, text or email the team.</p>` +
        `<p>In Claude: Settings &rarr; Connectors &rarr; Add custom connector &rarr; paste <code>${url.origin}/mcp</code></p>` +
        `<p><a href="${SITE}">Back to the website</a></p></body>`,
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`event: endpoint\ndata: ${url.pathname}\n\n`));
    },
  });
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', ...CORS } });
}

// ---------- Pages Function entry ----------
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...CORS, 'Access-Control-Max-Age': '86400' } });
  if (request.method === 'GET') return handleGet(request, url);
  if (request.method === 'POST') return handlePost(request, env);
  if (request.method === 'DELETE') return new Response(null, { status: 204, headers: CORS });
  return new Response('Method Not Allowed', { status: 405 });
}
