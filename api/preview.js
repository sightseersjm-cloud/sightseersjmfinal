// Free, limited taste: rewrites the summary + 3 weakest bullets. Rate-limited per visitor and globally per day.
const crypto = require('crypto');
const { getCount, setCount } = require('./_store');
const MODEL = process.env.PREVIEW_MODEL || 'claude-haiku-5-5';
const DAILY_CAP = parseInt(process.env.FREE_DAILY_CAP || '100', 10);

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'Free sample is not available yet.' });
  const { resume = '', job = '' } = req.body || {};
  if (String(resume).trim().length < 80 || String(resume).length > 12000) return res.status(400).json({ error: 'Please add your résumé text first.' });

  const day = new Date().toISOString().slice(0, 10);
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();
  const vKey = 'preview/' + crypto.createHash('sha256').update(ip + day).digest('hex').slice(0, 24);
  const gKey = 'previewtotal/' + day;
  if (await getCount(vKey) >= 1) return res.status(429).json({ error: 'You\'ve used today\'s free sample. Unlock the full rewrite below, or come back tomorrow.', limited: true });
  const total = await getCount(gKey);
  if (total >= DAILY_CAP) return res.status(429).json({ error: 'Free samples are all taken for today. Unlock the full rewrite below, or try again tomorrow.', limited: true });

  const system = `You are an expert résumé writer. Using ONLY facts in the résumé (never invent employers, dates, tools or numbers; use bracketed placeholders like [add % result] where a metric would help), return STRICT JSON only, no other text:
{"summary":"a 2-3 line professional summary","bullets":[{"before":"original weak bullet","after":"improved bullet"},{...},{...}]}
Pick the 3 weakest bullets/lines of experience. Plain text, no markdown. If a job posting is given, use its keywords only where truthful.`;
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODEL, max_tokens: 700, system, messages: [{ role: 'user', content: `JOB POSTING: ${String(job).slice(0, 3000) || '(none)'}\n\nRÉSUMÉ:\n${String(resume)}` }] })
    });
    if (!r.ok) { console.error('preview', r.status, await r.text()); return res.status(502).json({ error: 'Sample is busy right now. Please try again shortly.' }); }
    const text = ((await r.json()).content || []).map(b => b.text || '').join('');
    const out = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
    if (!out.summary || !Array.isArray(out.bullets)) throw new Error('bad shape');
    await setCount(vKey, 1); await setCount(gKey, total + 1);
    return res.json({ summary: String(out.summary), bullets: out.bullets.slice(0, 3).map(b => ({ before: String(b.before || ''), after: String(b.after || '') })) });
  } catch (e) { console.error(e); return res.status(502).json({ error: 'Could not build your sample. Please try again.' }); }
};
