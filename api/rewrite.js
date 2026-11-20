// Vercel serverless function: verifies a paid Stripe Checkout session, then asks Claude to do the rewrite.
// Env vars: ANTHROPIC_API_KEY, STRIPE_SECRET_KEY, (optional) BLOB_READ_WRITE_TOKEN, ALLOW_UNPAID=1 for testing.
const PLANS = { 999: 'starter', 4500: 'pro', 7500: 'premium' };
const MAX_RUNS = 3;            // generations allowed per payment
const MAX_INPUT = 20000;       // characters
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
const memUsage = new Map();    // fallback when Blob isn't configured (per-instance only)

async function stripeSession(id) {
  if (!/^cs_[A-Za-z0-9_]+$/.test(id || '')) return null;
  const r = await fetch('https://api.stripe.com/v1/checkout/sessions/' + id, {
    headers: { Authorization: 'Bearer ' + process.env.STRIPE_SECRET_KEY }
  });
  if (!r.ok) return null;
  const s = await r.json();
  if (s.payment_status !== 'paid') return null;
  return PLANS[s.amount_total] ? { plan: PLANS[s.amount_total] } : null;
}

async function getRuns(id) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return memUsage.get(id) || 0;
  try {
    const { head } = require('@vercel/blob');
    const h = await head('runs/' + id + '.txt');
    return parseInt(await (await fetch(h.url)).text(), 10) || 0;
  } catch { return 0; }
}
async function setRuns(id, n) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return memUsage.set(id, n);
  const { put } = require('@vercel/blob');
  await put('runs/' + id + '.txt', String(n), { access: 'public', addRandomSuffix: false, allowOverwrite: true });
}

function buildPrompt(plan) {
  const parts = ['RESUME'];
  if (plan !== 'starter') parts.push('COVER LETTER', 'LINKEDIN', 'INTERVIEW PREP');
  if (plan === 'premium') parts.push('ALT VERSION 1', 'ALT VERSION 2');
  parts.push('NOTES');
  const system = `You are an expert résumé writer and career coach. Rewrite the user's résumé so it is clear, ATS-friendly and results-focused.
Hard rules:
- Use ONLY facts in the provided résumé/details. NEVER invent employers, titles, dates, degrees, tools or numbers.
- Where a metric would help but is missing, write a bracketed placeholder like [add % or $ result] so the customer fills in the truth.
- Start bullets with strong action verbs, remove filler ("responsible for"), keep it concise, plain text only (no markdown symbols like ** or #).
- Tailor wording and keywords to the target job. If a JOB POSTING is supplied, mirror its important keywords ONLY where the customer's real experience supports them; never claim skills they lack. In NOTES, list the posting's key requirements the résumé does not cover.
Output EXACTLY these sections, each starting on its own line with "=====NAME=====" (names in this order): ${parts.join(', ')}.
- RESUME: complete rewritten résumé (contact line, summary, skills, experience, education).
- COVER LETTER: ~250 words tailored to the target job.
- LINKEDIN: a headline (max 220 chars) then an About section (~150 words).
- INTERVIEW PREP, in this order with plain-text sub-headings: (1) LIKELY QUESTIONS: the 8 questions most likely for this job and résumé, each with a 1–2 line answer angle built ONLY from the customer's real experience (flag gaps honestly); (2) HOW TO STAND OUT: 5 practical tips specific to this role and industry (what interviewers look for, what to research beforehand, how to handle the weakest spot on the résumé); (3) QUESTIONS TO ASK THEM: 4 smart questions for the interviewer; (4) FIRST-MINUTE PITCH: a 30-second "tell me about yourself" script. Never invent facts about the employer; if the company is unknown, say what to research.
- ALT VERSION 1/2: shorter résumé variants emphasising different strengths (state the angle on the first line).
- NOTES: 3-6 short bullets telling the customer what to double-check or add (missing metrics, gaps, placeholders you left).`;
  return { system, parts };
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const unpaid = process.env.ALLOW_UNPAID === '1';
  const sid = (req.method === 'GET' ? req.query.session_id : (req.body || {}).session_id) || '';
  let info = null;
  if (unpaid) info = { plan: ['starter', 'pro', 'premium'].includes(req.query.plan) ? req.query.plan : 'premium' };
  else {
    if (!process.env.STRIPE_SECRET_KEY) return res.status(503).json({ error: 'Payments are not configured yet.' });
    info = await stripeSession(sid);
  }
  if (!info) return res.status(402).json({ error: 'Payment not found. Please complete checkout first.' });
  const key = unpaid ? 'test' : sid;
  const used = await getRuns(key);

  if (req.method === 'GET') return res.json({ plan: info.plan, remaining: Math.max(0, MAX_RUNS - used) });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'AI is not configured yet.' });
  if (used >= MAX_RUNS) return res.status(429).json({ error: 'You have used all revisions for this order.' });

  const { resume = '', target = '', extra = '', job = '' } = req.body || {};
  if (String(resume).trim().length < 80) return res.status(400).json({ error: 'Please paste your full résumé.' });
  if (String(resume).length + String(extra).length + String(job).length > MAX_INPUT) return res.status(400).json({ error: 'Input too long.' });

  const { system, parts } = buildPrompt(info.plan);
  const user = `TARGET JOB: ${String(target).slice(0, 300) || '(not specified — keep general)'}\n\nJOB POSTING:\n${String(job).slice(0, 6000) || '(none supplied)'}\n\nCUSTOMER NOTES/REVISION REQUESTS: ${String(extra).slice(0, 2000) || '(none)'}\n\nCURRENT RÉSUMÉ:\n${String(resume)}`;

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODEL, max_tokens: 5000, system, messages: [{ role: 'user', content: user }] })
    });
    if (!r.ok) { console.error('anthropic', r.status, await r.text()); return res.status(502).json({ error: 'The writer is busy. Please try again in a minute (you were not charged a revision).' }); }
    const text = ((await r.json()).content || []).map(b => b.text || '').join('');
    const sections = {};
    text.split(/^=====(.+?)=====\s*$/m).forEach((chunk, i, arr) => { if (i % 2 === 1) sections[chunk.trim()] = (arr[i + 1] || '').trim(); });
    if (!sections.RESUME) return res.status(502).json({ error: 'Could not format the result. Please try again.' });
    await setRuns(key, used + 1);
    return res.json({ plan: info.plan, remaining: MAX_RUNS - used - 1, order: parts, sections });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
};
