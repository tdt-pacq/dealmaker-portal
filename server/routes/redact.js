/**
 * redact.js
 * Tax Return Redactor — automatically black out PII (SSNs, preparer info, etc.)
 * before sharing returns with buyers in data rooms.
 *
 * Pipeline per PDF:
 *   1. multer receives PDF (up to 30 MB)
 *   2. pdfjs-dist + canvas  → renders each page as PNG
 *   3. Claude Vision        → identifies PII bounding boxes on each page
 *   4. sharp                → draws black rectangles over PII regions
 *   5. pdf-lib              → assembles redacted pages into a new PDF
 *
 * Routes:
 *   POST /api/redact                → start job, returns { jobId, pageCount? }
 *   GET  /api/redact/jobs/:id       → poll status / progress
 *   GET  /api/redact/download/:id   → stream completed redacted PDF
 */

const express  = require('express');
const multer   = require('multer');
const Anthropic = require('@anthropic-ai/sdk');
const { v4: uuidv4 } = require('uuid');
const pdfParse = require('pdf-parse');
const sharp    = require('sharp');
const { PDFDocument } = require('pdf-lib');

const router    = express.Router();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── In-Memory Job Store ──────────────────────────────────────────────────────
const jobs = new Map();

// Auto-purge after 30 min
setInterval(() => {
  const cutoff = Date.now() - 30 * 60 * 1000;
  for (const [id, job] of jobs) {
    if (job.createdAt < cutoff) jobs.delete(id);
  }
}, 10 * 60 * 1000);

// ─── File Upload ──────────────────────────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 30 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf');
    ok ? cb(null, true) : cb(new Error('PDF files only'));
  },
});

// ─── pdfjs-dist + canvas Setup ────────────────────────────────────────────────
let _pdfjsLib;
function getPdfjs() {
  if (!_pdfjsLib) {
    _pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
    // Disable the worker — we run on the main thread in Node
    _pdfjsLib.GlobalWorkerOptions.workerSrc = '';
  }
  return _pdfjsLib;
}

const { createCanvas } = require('canvas');

// Canvas factory required by pdfjs-dist for Node.js rendering
const nodeCanvasFactory = {
  create(w, h) {
    const canvas = createCanvas(w, h);
    return { canvas, context: canvas.getContext('2d') };
  },
  reset(cc, w, h) { cc.canvas.width = w; cc.canvas.height = h; },
  destroy(cc)     { cc.canvas.width = 0; cc.canvas.height = 0; },
};

/**
 * Render all pages of a PDF buffer to PNG buffers.
 * @returns {{ numPages: number, pages: Array<{buffer, width, height}> }}
 */
async function renderPdfPages(pdfBuffer, scale = 2.0) {
  const lib = getPdfjs();
  const loadingTask = lib.getDocument({
    data: new Uint8Array(pdfBuffer),
    useSystemFonts: true,
    disableFontFace: true,
  });

  const pdfDoc = await loadingTask.promise;
  const numPages = pdfDoc.numPages;
  const pages = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = createCanvas(Math.round(viewport.width), Math.round(viewport.height));
    const ctx = canvas.getContext('2d');

    await page.render({
      canvasContext:  ctx,
      viewport,
      canvasFactory:  nodeCanvasFactory,
    }).promise;

    pages.push({
      buffer: canvas.toBuffer('image/png'),
      width:  Math.round(viewport.width),
      height: Math.round(viewport.height),
    });

    page.cleanup();
  }

  pdfDoc.destroy();
  return { numPages, pages };
}

// ─── Claude Vision — PII Detection ───────────────────────────────────────────
const PII_PROMPT = `This is a page from a U.S. business tax return (Form 1120-S, 1065, 1120, or Schedule C).
Your job is to locate sensitive personal information that must be redacted before this document is shared with a business buyer.

Find and return bounding boxes for ALL of the following on this page:
1. Social Security Numbers — format XXX-XX-XXXX, partially masked (e.g., XXX-XX-1234), or 9 consecutive digits
2. Individual Taxpayer Identification Numbers (ITINs) — same format as SSN
3. Preparer Tax Identification Numbers (PTINs) — format P-XXXXXXXX
4. The ENTIRE "Paid Preparer Use Only" section — including the preparer's personal name, firm name, firm address, phone number, and the PREPARER'S firm EIN (not the business's EIN)
5. Personal home addresses of the taxpayer (relevant for Schedule C sole proprietors — the owner's personal home address, NOT the business's operating address)
6. Spouse name and spouse SSN (if this appears to be a joint individual return)

Do NOT redact:
- Business name or trade name
- Business EIN (format XX-XXXXXXX — this is the company's tax ID and buyers need it)
- Business operating address
- Any dollar amounts, line numbers, revenue, expense, or income figures
- Tax year, fiscal year, or date information
- Entity type, state of incorporation, or industry codes

Return ONLY a JSON array — no other text, no markdown, no explanation:
[{"label":"SSN"|"PTIN"|"preparer_block"|"personal_address"|"spouse_info","x_pct":<number>,"y_pct":<number>,"w_pct":<number>,"h_pct":<number>}]

x_pct = left edge of bounding box as a percentage of total page width (0–100)
y_pct = top edge of bounding box as a percentage of total page height (0–100)
w_pct = width of bounding box as a percentage of total page width (0–100)
h_pct = height of bounding box as a percentage of total page height (0–100)

Add generous padding — it is better to redact a few extra pixels than to leave any part of an SSN visible.
If nothing needs to be redacted on this page, return: []`;

/**
 * Send a page PNG to Claude Vision and get back PII bounding boxes.
 * @returns {Array<{label, x_pct, y_pct, w_pct, h_pct}>}
 */
async function detectPii(pngBuffer) {
  const resp = await anthropic.messages.create({
    model:      'claude-opus-4-5',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: [
        {
          type:   'image',
          source: { type: 'base64', media_type: 'image/png', data: pngBuffer.toString('base64') },
        },
        { type: 'text', text: PII_PROMPT },
      ],
    }],
  }, { timeout: 60_000 });

  const text = (resp.content || []).filter(b => b.type === 'text').map(b => b.text).join('');

  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return [];

  try {
    const raw = JSON.parse(match[0]);
    return raw
      .filter(b => b && typeof b.x_pct === 'number' && typeof b.y_pct === 'number')
      .map(b => ({
        label: b.label || 'redacted',
        x_pct: Math.max(0, Math.min(99, b.x_pct)),
        y_pct: Math.max(0, Math.min(99, b.y_pct)),
        w_pct: Math.max(0.5, Math.min(100 - b.x_pct, b.w_pct)),
        h_pct: Math.max(0.5, Math.min(100 - b.y_pct, b.h_pct)),
      }));
  } catch {
    return [];
  }
}

// ─── Sharp — Draw Redaction Boxes ─────────────────────────────────────────────
const REDACTION_PADDING = 6; // extra pixels around each box for safety

async function applyRedactions(pngBuffer, boxes, width, height) {
  if (!boxes.length) return pngBuffer;

  const rects = boxes.map(b => {
    const x = Math.max(0, Math.floor((b.x_pct / 100) * width) - REDACTION_PADDING);
    const y = Math.max(0, Math.floor((b.y_pct / 100) * height) - REDACTION_PADDING);
    const w = Math.min(width - x, Math.ceil((b.w_pct / 100) * width) + REDACTION_PADDING * 2);
    const h = Math.min(height - y, Math.ceil((b.h_pct / 100) * height) + REDACTION_PADDING * 2);
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="black"/>`;
  }).join('');

  const svg = Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${rects}</svg>`
  );

  return sharp(pngBuffer)
    .composite([{ input: svg, top: 0, left: 0 }])
    .png()
    .toBuffer();
}

// ─── pdf-lib — Assemble Final PDF ────────────────────────────────────────────
async function assemblePdf(pages) {
  const pdfDoc = await PDFDocument.create();

  for (const { buffer, width, height } of pages) {
    const pngImage = await pdfDoc.embedPng(buffer);
    // Rendered at 2× — divide back to standard 72-DPI point dimensions
    const ptWidth  = width  / 2;
    const ptHeight = height / 2;
    const page = pdfDoc.addPage([ptWidth, ptHeight]);
    page.drawImage(pngImage, { x: 0, y: 0, width: ptWidth, height: ptHeight });
  }

  return Buffer.from(await pdfDoc.save());
}

// ─── Main Pipeline ────────────────────────────────────────────────────────────
async function runRedaction(jobId, pdfBuffer) {
  const job = jobs.get(jobId);
  if (!job) return;

  try {
    // Render all pages
    job.progress.message = 'Rendering pages…';
    const { numPages, pages: renderedPages } = await renderPdfPages(pdfBuffer);
    job.progress.total = numPages;

    const redactedPages = [];

    for (let i = 0; i < numPages; i++) {
      job.progress.current = i;
      job.progress.message = `Scanning page ${i + 1} of ${numPages}…`;

      const { buffer, width, height } = renderedPages[i];

      // Detect PII with Claude Vision
      const boxes = await detectPii(buffer);

      // Draw black boxes
      const redacted = await applyRedactions(buffer, boxes, width, height);

      redactedPages.push({ buffer: redacted, width, height });

      const found = boxes.length;
      console.log(`[Redact] Page ${i + 1}/${numPages} — ${found} item(s) redacted`);
    }

    // Assemble final PDF
    job.progress.message = 'Assembling redacted PDF…';
    const pdfOut = await assemblePdf(redactedPages);

    job.status    = 'complete';
    job.pdfBuffer = pdfOut;
    job.progress.current = numPages;
    job.progress.message = 'Done';

    console.log(`[Redact] Job ${jobId} complete — ${numPages} pages processed`);

  } catch (err) {
    job.status = 'error';
    job.error  = err.message;
    console.error(`[Redact] Job ${jobId} failed:`, err.message);
  }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * POST /api/redact
 * Accepts a PDF upload, starts async pipeline, returns { jobId }.
 */
router.post('/', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No PDF file provided.' });

  const jobId   = uuidv4();
  const safeName = (req.file.originalname || 'return').replace(/\.pdf$/i, '');

  jobs.set(jobId, {
    status:    'processing',
    progress:  { current: 0, total: 0, message: 'Starting…' },
    pdfBuffer: null,
    error:     null,
    filename:  `${safeName}_REDACTED.pdf`,
    createdAt: Date.now(),
  });

  // Fire and forget
  runRedaction(jobId, req.file.buffer).catch(console.error);

  res.json({ jobId });
});

/**
 * GET /api/redact/jobs/:id
 * Poll job status. Returns { status, progress?, filename?, error? }.
 */
router.get('/jobs/:id', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found or expired.' });

  if (job.status === 'complete') {
    return res.json({ status: 'complete', filename: job.filename });
  }
  if (job.status === 'error') {
    return res.json({ status: 'error', error: job.error });
  }
  res.json({ status: 'processing', progress: job.progress });
});

/**
 * GET /api/redact/download/:id
 * Stream the completed redacted PDF to the client.
 */
router.get('/download/:id', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job || job.status !== 'complete' || !job.pdfBuffer) {
    return res.status(404).json({ error: 'Redacted PDF not ready.' });
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${job.filename}"`);
  res.end(job.pdfBuffer);
});

module.exports = router;
