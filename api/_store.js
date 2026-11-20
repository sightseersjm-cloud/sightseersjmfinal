// Tiny counter store: Vercel Blob if configured, else in-memory (per serverless instance, best-effort).
const mem = new Map();
async function getCount(key) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return mem.get(key) || 0;
  try { const { head } = require('@vercel/blob'); const h = await head(key + '.txt'); return parseInt(await (await fetch(h.url)).text(), 10) || 0; }
  catch { return 0; }
}
async function setCount(key, n) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return void mem.set(key, n);
  const { put } = require('@vercel/blob');
  await put(key + '.txt', String(n), { access: 'public', addRandomSuffix: false, allowOverwrite: true });
}
module.exports = { getCount, setCount };
