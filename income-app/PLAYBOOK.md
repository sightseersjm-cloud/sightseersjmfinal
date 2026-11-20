# ResumeRush — Setup & Launch

The site now does the rewrite itself: customer pays → returns to the site → pastes résumé → Claude writes it (résumé, cover letter, LinkedIn, alt versions by plan). Max 3 generations per payment.

## One-time setup (~20 min)
1. **Vercel env vars** (Project → Settings → Environment Variables):
   - `ANTHROPIC_API_KEY` — from console.anthropic.com (add a few dollars of credit; each rewrite costs roughly 5–15¢)
   - `STRIPE_SECRET_KEY` — Stripe dashboard → Developers → API keys
   - `BLOB_READ_WRITE_TOKEN` — (recommended) Vercel → Storage → create a Blob store; stops people re-using one payment forever
2. **Stripe Payment Links** — create 3 one-time prices: **$9.99, $45, $75** (the server maps amount → plan, so use exactly these).
   For each link: *After payment → Redirect to your website* → `https://YOUR-DOMAIN/income-app/?session_id={CHECKOUT_SESSION_ID}`
3. Paste the 3 links into `CONFIG.payLinks` at the bottom of `income-app/index.html`.
4. Redeploy. **Test first:** buy your own $9.99 link once (or use Stripe test mode keys + test links) and run a rewrite end to end.

## Testing without Stripe
Set `ALLOW_UNPAID=1` in a *preview* deployment only, then open `/income-app/?session_id=cs_test_x`. Never set it in production.

## Launch (hours 1–24)
Post the free-score link where job seekers are (Facebook job groups, LinkedIn, r/resumes where rules allow, friends/family/classmates). Script:
"Free instant résumé score: <link>. Full pro rewrite + cover letter in minutes from $9.99."

## Be straight with customers
Output is AI-drafted and may contain `[bracketed placeholders]` where it needs their real numbers — the page tells them to fill these in. Keep refunds easy; it builds referrals.
