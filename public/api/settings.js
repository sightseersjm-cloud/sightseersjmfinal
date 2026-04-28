/**
 * /api/settings.js — stores site settings as a JSON file in Vercel Blob
 * No KV needed. Only one storage service (Blob) for both settings + images.
 *
 * GET  /api/settings  → returns all saved settings
 * POST /api/settings  → saves { key, value } pair
 */
const { put, list } = require('@vercel/blob');

const SETTINGS_PATH = 'ss-admin/settings.json';
const ALLOWED_KEYS = new Set([
  'ss_site_settings','ss_page_editor_settings',
  'ss_customer_gallery','ss_stay_page_settings','ss_tours_data'
]);

async function readSettings() {
  try {
    const { blobs } = await list({ prefix: 'ss-admin/' });
    const blob = blobs.find(b => b.pathname === SETTINGS_PATH);
    if (!blob) return {};
    const res = await fetch(blob.url + '?t=' + Date.now()); // bust cache
    if (!res.ok) return {};
    return await res.json();
  } catch (e) {
    return {};
  }
}

async function writeSettings(data) {
  await put(SETTINGS_PATH, JSON.stringify(data), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    try {
      const data = await readSettings();
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json(data);
    } catch (err) {
      console.error('Settings GET error:', err);
      return res.status(200).json({}); // return empty so site still loads
    }
  }

  if (req.method === 'POST') {
    try {
      const { key, value } = req.body || {};
      if (!key || !ALLOWED_KEYS.has(key)) {
        return res.status(400).json({ error: 'Invalid key' });
      }
      const current = await readSettings();
      current[key] = value;
      await writeSettings(current);
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error('Settings POST error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
