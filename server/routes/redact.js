/**
 * redact.js
 * Tax Return Redactor — pure-JavaScript PII redaction, no native dependencies.
 *
 * Pipeline:
 *   1. Claude reads the PDF as a document → returns exact PII text strings
 *   2. pdfjs-dist (text extraction only, no canvas/rendering) finds each string's
 *      coordinates on every page
 *   3. pdf-lib draws opaque black rectangles over those coordinates in-place
 *
 * Routes:
 *   POST /api/redact              → start job, returns { jobId }
 *   GET  /api/redact/jobs/:id     → poll { status, progress?, error? }
 *   GET  /api/redact/download/:id → stream completed redacted PDF
 */

const express   = require('express');
const multer    = require('multer');
const Anthropic = require('@anthropic-ai/sdk');
const { v4: uuidv4 } = require('uuid');
const { PDFDocument, rgb } = require('pdf-lib');

const router    = express.Router();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Job Store ────────────────────────────────────────────────────────────────
const jobs = new Map();
setInterval(() => {
  const cutoff = Date.now() - 30 * 60 * 1000;
  for (const [id, job] of jobs) if (job.createdAt < cutoff) jobs.delete(id);
}, 10 * 60 * 1000);

// ─── Upload ───────────────────────────────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 30 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf');
    ok ? cb(null, true) : cb(new Error('PDF files only'));
  },
});

// ─── pdfjs-dist (text-only, no canvas) ───────────────────────────────────────
let _pdfjsLib;
function getPdfjs() {
  if (!_pdfjsLib) {
    _pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
    _pdfjsLib.GlobalWorkerOptions.workerSrc = ''; // no worker in Node
  }
  return _pdfjsLib;
}

// ─── Step 1: Claude identifies PII text strings ───────────────────────────────
async function identifyPiiStrings(pdfBuffer) {
  const resp = await anthropic.messages.create({
    model:      'claude-opus-4-5',
    max_tokens: 2048,
    messages: [{
      role: 'user',
      content: [
        {
          type:   'document',
          source: { type: 'base64', media_type: 'application/pdf', data: pdfBuffer.toString('base64') },
        },
        {
          type: 'text',
          text: `This is a U.S. business tax return. List every piece of sensitive personal information that must be redacted before sharing with a buyer.

Return ONLY this JSON object (no other text):
{
  "ssns":               [],  // Social Security Numbers EXACTLY as they appear (e.g. "123-45-6789")
  "itins":              [],  // ITINs exactly as they appear
  "ptins":              [],  // Preparer PTINs exactly as they appear (e.g. "P-01234567")
  "preparer_names":     [],  // Paid preparer's personal name exactly as shown
  "preparer_firm":      [],  // Preparer's firm/company name exactly as shown
  "preparer_address":   [],  // Each address line separately (street, city/state/zip as separate items)
  "preparer_phone":     [],  // Preparer's phone number exactly as shown
  "preparer_ein":       [],  // Preparer FIRM's EIN (NOT the business's EIN)
  "personal_addresses": []   // Owner personal home addresses (Schedule C only — not the business address)
}

Rules:
- Include the EXACT text string with its exact formatting (dashes, spaces, parentheses).
- Do NOT include: business name, business EIN, business address, financial figures, tax year, dates.
- If nothing exists for a category, leave it as an empty array.`,
        },
      ],
    }],
  }, { timeout: 90_000 });

  const text = resp.content.filter(b => b.type === 'text').map(b => b.text).join('');
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return { targets: [], hasPreparerBlock: false };

  try {
    const obj = JSON.parse(match[0]);
    const targets = [
      ...(obj.ssns               || []),
      ...(obj.itins              || []),
      ...(obj.ptins              || []),
      ...(obj.preparer_names     || []),
      ...(obj.preparer_firm      || []),
      ...(obj.preparer_address   || []).flatMap(a => a.split(/[\n,]+/)),
      ...(obj.preparer_phone     || []),
      ...(obj.preparer_ein       || []),
      ...(obj.personal_addresses || []).flatMap(a => a.split(/[\n,]+/)),
    ].map(s => s?.trim()).filter(s => s && s.length >= 3);

    const hasPreparerBlock =
      (obj.preparer_names?.length > 0) || (obj.preparer_firm?.length > 0);

    return { targets: [...new Set(targets)], hasPreparerBlock };
  } catch {
    return { targets: [], hasPreparerBlock: false };
  }
}

// ─── Step 2: pdfjs finds coordinates for each target string ──────────────────
async function findRedactionBoxes(pdfBuffer, targets, redactPreparerBlock) {
  const lib = getPdfjs();
  const loadingTask = lib.getDocument({
    data: new Uint8Array(pdfBuffer),
    useSystemFonts: true,
  });

  const pdfDoc   = await loadingTask.promise;
  const numPages = pdfDoc.numPages;
  const pageBoxes = [];

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page        = await pdfDoc.getPage(pageNum);
    const textContent = await page.getTextContent();
    const viewport    = page.getViewport({ scale: 1.0 });
    const pageWidth   = viewport.width;

    // Filter to non-empty items
    const items = textContent.items.filter(item => item.str?.trim());

    // Build a virtual concatenated string so we can search across item boundaries
    let fullText   = '';
    const bounds   = [];
    for (const item of items) {
      const start = fullText.length;
      fullText   += item.str;
      bounds.push({ start, end: fullText.length, item });
      fullText   += ' '; // separator
    }
    const lower = fullText.toLowerCase();

    const boxes = [];
    const PAD   = 4; // extra pixels around each match

    // Search for each target string
    for (const target of targets) {
      const targetLower = target.toLowerCase();
      let pos = lower.indexOf(targetLower);
      while (pos !== -1) {
        const spanEnd  = pos + target.length;
        const spanned  = bounds.filter(b => b.start < spanEnd && b.end > pos);
        if (spanned.length) {
          const xs   = spanned.map(b => b.item.transform[4]);
          const ys   = spanned.map(b => b.item.transform[5]);
          const x2s  = spanned.map(b => b.item.transform[4] + Math.abs(b.item.width  || 0));
          const fontH = Math.abs(spanned[0].item.height || 12);
          boxes.push({
            x: Math.max(0, Math.min(...xs)  - PAD),
            y: Math.max(0, Math.min(...ys)  - PAD),
            w: Math.max(...x2s) - Math.min(...xs) + PAD * 2,
            h: fontH + PAD * 2,
          });
        }
        pos = lower.indexOf(targetLower, pos + 1);
      }
    }

    // Redact the entire "Paid Preparer Use Only" block if found on this page
    if (redactPreparerBlock) {
      const KEYWORDS = ['paid preparer', 'preparer use only', "preparer's signature"];
      for (const b of bounds) {
        if (KEYWORDS.some(kw => b.item.str.toLowerCase().includes(kw))) {
          // Black out from the bottom of the page up through (and including) this label row
          const labelY = b.item.transform[5];
          const fontH  = Math.abs(b.item.height || 12);
          boxes.push({ x: 0, y: 0, w: pageWidth, h: labelY + fontH + 6 });
          break;
        }
      }
    }

    pageBoxes.push({ pageIndex: pageNum - 1, boxes });
    page.cleanup();
  }

  pdfDoc.destroy();
  return { pageBoxes, numPages };
}

// ─── Step 3: pdf-lib draws opaque black rectangles ───────────────────────────
async function applyPdfRedactions(pdfBuffer, pageBoxes) {
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const pages  = pdfDoc.getPages();

  for (const { pageIndex, boxes } of pageBoxes) {
    if (!boxes.length) continue;
    const page = pages[pageIndex];
    const { width: pw, height: ph } = page.getSize();

    for (const box of boxes) {
      page.drawRectangle({
        x:       Math.max(0, box.x),
        y:       Math.max(0, Math.min(box.y, ph - 1)),
        width:   Math.min(box.w, pw),
        height:  Math.min(box.h, ph),
        color:   rgb(0, 0, 0),
        opacity: 1,
      });
    }
  }

  return Buffer.from(await pdfDoc.save());
}

// ─── Main Pipeline ────────────────────────────────────────────────────────────
async function runRedaction(jobId, pdfBuffer) {
  const job = jobs.get(jobId);
  if (!job) return;

  try {
    // Phase 1 — Claude identifies what to redact
    job.progress.message = 'Scanning document for sensitive information…';
    const { targets, hasPreparerBlock } = await identifyPiiStrings(pdfBuffer);
    console.log(`[Redact] Job ${jobId}: ${targets.length} target string(s) identified`);

    // Phase 2 — pdfjs locates each string
    job.progress.message = 'Locating fields in document…';
    const { pageBoxes, numPages } = await findRedactionBoxes(pdfBuffer, targets, hasPreparerBlock);
    job.progress.total   = numPages;
    job.progress.current = numPages;

    // Phase 3 — pdf-lib applies rectangles
    job.progress.message = 'Applying redactions…';
    const redactedPdf = await applyPdfRedactions(pdfBuffer, pageBoxes);

    const totalBoxes = pageBoxes.reduce((n, p) => n + p.boxes.length, 0);
    console.log(`[Redact] Job ${jobId} complete — ${totalBoxes} redaction(s) on ${numPages} page(s)`);

    job.status    = 'complete';
    job.pdfBuffer = redactedPdf;
    job.progress.message = 'Done';

  } catch (err) {
    job.status = 'error';
    job.error  = err.message;
    console.error(`[Redact] Job ${jobId} failed:`, err.message);
  }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

router.post('/', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No PDF file provided.' });

  const jobId    = uuidv4();
  const safeName = (req.file.originalname || 'return').replace(/\.pdf$/i, '');

  jobs.set(jobId, {
    status:    'processing',
    progress:  { current: 0, total: 0, message: 'Starting…' },
    pdfBuffer: null,
    error:     null,
    filename:  `${safeName}_REDACTED.pdf`,
    createdAt: Date.now(),
  });

  runRedaction(jobId, req.file.buffer).catch(console.error);
  res.json({ jobId });
});

router.get('/jobs/:id', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found or expired.' });
  if (job.status === 'complete') return res.json({ status: 'complete', filename: job.filename });
  if (job.status === 'error')   return res.json({ status: 'error',    error:    job.error });
  res.json({ status: 'processing', progress: job.progress });
});

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
