/* ═══════════════════════════════════════════════════════
   Mesh AI — Express Backend
   Proxies Fal AI API calls (key stays server-side)
   ═══════════════════════════════════════════════════════ */

const fs       = require('fs');
const path     = require('path');
const express  = require('express');
const multer   = require('multer');

// ─── Load .env manually (no dotenv dependency) ──────
(() => {
  try {
    const envPath = path.join(__dirname, '.env');
    if (fs.existsSync(envPath)) {
      fs.readFileSync(envPath, 'utf8')
        .split('\n')
        .forEach(line => {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) return;
          const eqIdx = trimmed.indexOf('=');
          if (eqIdx === -1) return;
          const key = trimmed.slice(0, eqIdx).trim();
          const val = trimmed.slice(eqIdx + 1).trim();
          if (!process.env[key]) process.env[key] = val;
        });
    }
  } catch (_) { /* ignore */ }
})();

const FAL_KEY = process.env.FAL_KEY || '';
const FAL_BASE = 'https://queue.fal.run/fal-ai/triposr';
const PORT = process.env.PORT || 8090;

const app = express();

// ─── Middleware ──────────────────────────────────────
app.use(express.json({ limit: '30mb' }));
app.use(express.urlencoded({ extended: true, limit: '30mb' }));

// Static files
app.use(express.static(__dirname, { maxAge: 0 }));

// Uploaded images directory
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
app.use('/uploads', express.static(uploadsDir));

// Multer for multipart file uploads
const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.png';
    cb(null, `img_${Date.now()}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

/** Shared headers for every Fal request */
function falHeaders() {
  return {
    'Content-Type':  'application/json',
    'Authorization': `Key ${FAL_KEY}`,
  };
}

// ─── Health / config check ──────────────────────────
app.get('/api/status', (_req, res) => {
  res.json({
    ok: true,
    hasApiKey: !!FAL_KEY && FAL_KEY !== 'your_api_key_here',
  });
});

// ─── POST: Create image-to-model task ───────────────
app.post('/api/image-to-3d', upload.single('image'), async (req, res) => {
  try {
    // ── Validate API key
    if (!FAL_KEY || FAL_KEY === 'your_api_key_here') {
      return res.status(400).json({
        error: 'FAL_KEY is not configured. Create a .env file with your key.',
      });
    }

    // ── Resolve the image URL to send to Fal
    let imageUrl  = '';

    if (req.file) {
      // Multipart upload — build a data URI
      const filePath   = req.file.path;
      const fileBuffer = fs.readFileSync(filePath);
      const mime       = req.file.mimetype || 'image/png';
      imageUrl  = `data:${mime};base64,${fileBuffer.toString('base64')}`;
    } else if (req.body.image_base64) {
      // Base64 data URI from the frontend
      imageUrl  = req.body.image_base64;
    } else if (req.body.image_url) {
      // Public URL
      imageUrl  = req.body.image_url;
    }

    if (!imageUrl) {
      return res.status(400).json({ error: 'No image provided.' });
    }

    // ── POST to Fal queue endpoint
    const falRes = await fetch(FAL_BASE, {
      method: 'POST',
      headers: falHeaders(),
      body: JSON.stringify({
        image_url: imageUrl
      }),
    });

    const falData = await falRes.json();

    if (!falRes.ok) {
      console.error('[Fal POST error]', falRes.status, falData);
      return res.status(falRes.status).json({
        error: falData.detail || 'Fal AI error',
        detail: falData,
      });
    }

    // Fal returns { request_id: "..." }
    const requestId = falData.request_id;
    if (!requestId) {
      console.error('[Fal POST] no request_id in response', falData);
      return res.status(502).json({
        error: 'No request_id returned from Fal.',
        detail: falData,
      });
    }

    return res.json({ request_id: requestId });
  } catch (err) {
    console.error('[POST /api/image-to-3d]', err);
    return res.status(500).json({ error: err.message });
  }
});

// ─── GET: Poll task status ──────────────────────────
app.get('/api/image-to-3d/:requestId', async (req, res) => {
  try {
    if (!FAL_KEY || FAL_KEY === 'your_api_key_here') {
      return res.status(400).json({ error: 'API key not configured.' });
    }

    const { requestId } = req.params;

    // GET https://queue.fal.run/fal-ai/triposr/requests/{request_id}
    const falRes = await fetch(`${FAL_BASE}/requests/${encodeURIComponent(requestId)}`, {
      method: 'GET',
      headers: falHeaders(),
    });

    const falData = await falRes.json();

    if (!falRes.ok) {
      console.error('[Fal GET error]', falRes.status, falData);
      return res.status(falRes.status).json({
        error: falData.detail || 'Fal API error',
        detail: falData,
      });
    }

    // Normalise the Fal response into what the frontend expects:
    // { status, progress, output, ... }
    return res.json({
      status:    falData.status || 'unknown',
      output:    falData, // The full data object if COMPLETED
      task_error: falData.error || null,
      _raw: falData,  // pass-through for debugging
    });
  } catch (err) {
    console.error('[GET /api/image-to-3d/:requestId]', err);
    return res.status(500).json({ error: err.message });
  }
});

// ─── Start ──────────────────────────────────────────
app.listen(PORT, () => {
  console.log('');
  console.log('  ┌──────────────────────────────────────────┐');
  console.log(`  │  Mesh AI server running on port ${PORT}        │`);
  console.log(`  │  http://localhost:${PORT}                    │`);
  console.log('  │                                          │');
  if (FAL_KEY && FAL_KEY !== 'your_api_key_here') {
    console.log('  │  ✓ Fal AI API key loaded                 │');
  } else {
    console.log('  │  ✗ No Fal AI API key — set FAL_KEY       │');
    console.log('  │    in .env to enable live conversion     │');
  }
  console.log('  └──────────────────────────────────────────┘');
  console.log('');
});
