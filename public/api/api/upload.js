/**
 * /api/upload.js
 * ─────────────────────────────────────────────────────────────────────────────
 * POST /api/upload
 *   Body (JSON): { filename: string, data: string (base64), type: string }
 *   Response:    { url: string }  — public CDN URL from Vercel Blob
 *
 * Requires: BLOB_READ_WRITE_TOKEN env var.
 * Set it in Vercel dashboard → Storage → Create Database → Blob,
 * then add BLOB_READ_WRITE_TOKEN to Environment Variables.
 *
 * Images are stored publicly so they can be used directly as <img src="…">.
 * Max file size via this route: 4 MB (Vercel serverless body limit).
 * For larger images use the client-upload pattern from @vercel/blob/client.
 */

const { put } = require('@vercel/blob');

// 4 MB limit for base64 body (≈ 3 MB actual image)
const MAX_BASE64_BYTES = 4 * 1024 * 1024;

// Allowed MIME types for uploads
const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/svg+xml'
]);

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { filename, data, type } = req.body || {};

    /* ── Validation ───────────────────────────────────────── */
    if (!filename || typeof filename !== 'string') {
      return res.status(400).json({ error: 'Missing filename' });
    }
    if (!data || typeof data !== 'string') {
      return res.status(400).json({ error: 'Missing base64 image data' });
    }
    if (data.length > MAX_BASE64_BYTES) {
      return res.status(413).json({ error: 'Image too large. Max ~3 MB.' });
    }

    const mimeType = type || 'image/jpeg';
    if (!ALLOWED_TYPES.has(mimeType)) {
      return res.status(400).json({ error: 'Unsupported image type: ' + mimeType });
    }

    /* ── Decode & upload ─────────────────────────────────── */
    const buffer = Buffer.from(data, 'base64');

    // Sanitise filename – only keep safe characters
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 120);

    const blob = await put('site-images/' + safeName, buffer, {
      access: 'public',
      contentType: mimeType,
      // Cache for 1 year – images are content-addressed by timestamp
      cacheControlMaxAge: 31536000
    });

    return res.status(200).json({
      ok: true,
      url: blob.url,
      pathname: blob.pathname,
      size: buffer.length
    });

  } catch (err) {
    console.error('[api/upload] Error:', err);
    return res.status(500).json({
      error: 'Upload failed',
      detail: err.message
    });
  }
};
