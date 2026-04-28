const { put, list } = require('@vercel/blob');

const SETTINGS_PATH = 'ss-admin/settings.json';

async function readSettings() {
  try {
    const { blobs } = await list({ prefix: 'ss-admin/' });
    const blob = blobs.find(b => b.pathname === SETTINGS_PATH);
    if (!blob) return {};
    const res = await fetch(blob.url + '?t=' + Date.now());
    if (!res.ok) return {};
    return await res.json();
  } catch {
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
  if (req.method === 'GET') {
    const data = await readSettings();
    return res.status(200).json(data);
  }

  if (req.method === 'POST') {
    const { key, value } = req.body;
    const current = await readSettings();
    current[key] = value;
    await writeSettings(current);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
};
