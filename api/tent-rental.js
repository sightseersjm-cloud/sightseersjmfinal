/**
 * /api/tent-rental  — receives a submitted Camping Tent Rental Agreement
 * and emails it to Sight Seers via Resend (https://resend.com).
 *
 * Required environment variable (set in Vercel → Project → Settings → Environment Variables):
 *   RESEND_API_KEY   Your Resend API key (starts with "re_")
 *
 * Optional environment variables:
 *   TENT_RENTAL_TO    Recipient inbox      (default: info@sightseerscaribbean.com)
 *   TENT_RENTAL_FROM  Verified sender      (default: onboarding@resend.dev — for testing only)
 *
 * NOTE: To send FROM your own domain (e.g. agreements@sightseerscaribbean.com)
 * you must first verify that domain in Resend. Until then Resend only allows the
 * onboarding@resend.dev sender, which can deliver to the account owner's email.
 */

const esc = (s) =>
  String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      ok: false,
      error:
        'Email is not configured yet. Add a RESEND_API_KEY environment variable in Vercel to enable submissions.',
    });
  }

  let data = req.body;
  if (typeof data === 'string') {
    try { data = JSON.parse(data); } catch { data = {}; }
  }
  data = data || {};

  // Minimal validation
  const required = ['name', 'email', 'pickup', 'return', 'signName'];
  const missing = required.filter((k) => !String(data[k] || '').trim());
  if (missing.length) {
    return res.status(400).json({ ok: false, error: 'Missing required fields: ' + missing.join(', ') });
  }

  const to = process.env.TENT_RENTAL_TO || 'info@sightseerscaribbean.com';
  const from = process.env.TENT_RENTAL_FROM || 'Sight Seers Agreements <onboarding@resend.dev>';

  const row = (k, v) =>
    `<tr><td style="padding:6px 12px;color:#6e6e73;border-bottom:1px solid #eee;white-space:nowrap;vertical-align:top">${esc(k)}</td>` +
    `<td style="padding:6px 12px;border-bottom:1px solid #eee;color:#1d1d1f"><b>${esc(v) || '<span style="color:#bbb">—</span>'}</b></td></tr>`;

  const ack = (label, checked) =>
    `<li>${checked ? '✅' : '⬜️'} ${esc(label)}</li>`;

  const html = `
  <div style="font-family:-apple-system,Segoe UI,Arial,sans-serif;max-width:640px;margin:0 auto;color:#1d1d1f">
    <h2 style="color:#062E4B;margin:0 0 4px">New Camping Tent Rental Agreement</h2>
    <p style="color:#6e6e73;margin:0 0 18px">Submitted ${esc(new Date().toISOString())}</p>

    <h3 style="color:#6FC55C;font-size:13px;text-transform:uppercase;letter-spacing:.04em;margin:18px 0 6px">Renter</h3>
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      ${row('Full name', data.name)}
      ${row('Phone', data.phone)}
      ${row('Email', data.email)}
      ${row('Address', data.address)}
      ${row('ID type & last 4', data.id)}
      ${row('Group / tour reference', data.ref)}
    </table>

    <h3 style="color:#6FC55C;font-size:13px;text-transform:uppercase;letter-spacing:.04em;margin:18px 0 6px">Rental period &amp; fees</h3>
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      ${row('Pickup date & time', data.pickup)}
      ${row('Return date & time', data.return)}
      ${row('Pickup / return location', data.location)}
      ${row('Rental rate', data.rate)}
      ${row('Total rental fee', data.total)}
      ${row('Security deposit', data.deposit)}
      ${row('Payment method', data.payment)}
    </table>

    <h3 style="color:#6FC55C;font-size:13px;text-transform:uppercase;letter-spacing:.04em;margin:18px 0 6px">Acknowledgements</h3>
    <ul style="font-size:14px;line-height:1.9;list-style:none;padding:0;margin:0">
      ${ack('Security deposit terms (Section 4)', data.ackDeposit)}
      ${ack('Renter responsibilities (Section 6)', data.ackResp)}
      ${ack('Damage, charges & replacement (Sections 7–9)', data.ackDamage)}
      ${ack('Assumption of risk & liability (Section 11)', data.ackRisk)}
      ${ack('General terms · governed by the laws of Jamaica (Section 12)', data.ackGeneral)}
    </ul>
    <p style="font-size:14px;margin:8px 0 0">Initials confirming Sections 7–9: <b>${esc(data.initials)}</b></p>

    <h3 style="color:#6FC55C;font-size:13px;text-transform:uppercase;letter-spacing:.04em;margin:18px 0 6px">Signature</h3>
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      ${row('Signed (typed legal name)', data.signName)}
      ${row('Date signed', data.date)}
    </table>
    ${data.signature && String(data.signature).startsWith('data:image')
      ? `<p style="font-size:13px;color:#6e6e73;margin:10px 0 4px">Drawn signature:</p>
         <img src="${esc(data.signature)}" alt="signature" style="max-width:360px;border:1px solid #eee;border-radius:8px;background:#fff"/>`
      : '<p style="font-size:13px;color:#bbb;margin:10px 0 0">No drawn signature captured.</p>'}

    <p style="font-size:12px;color:#86868b;margin-top:24px;border-top:1px solid #eee;padding-top:12px">
      Sight Seers Caribbean Adventures · Two Person Tent Rental Agreement (JELUCAMP 1–2 person dome).
      This message was generated from the website rental-agreement form.
    </p>
  </div>`;

  const payload = {
    from,
    to: [to],
    subject: `Tent Rental Agreement — ${data.name}`,
    html,
    reply_to: data.email,
  };

  // Attach the drawn signature as a PNG when present
  if (data.signature && String(data.signature).startsWith('data:image')) {
    const base64 = String(data.signature).split(',')[1] || '';
    if (base64) {
      payload.attachments = [{ filename: 'renter-signature.png', content: base64 }];
    }
  }

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!r.ok) {
      const detail = await r.text().catch(() => '');
      return res.status(502).json({ ok: false, error: 'Email service rejected the request.', detail });
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Could not reach email service.', detail: String(err && err.message || err) });
  }
};
