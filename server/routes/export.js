const express = require('express');
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const { getDb, logEvent } = require('../database');
const { OUTPUT_ROOT } = require('../paths');
const { ensurePageFit } = require('../pageFit');
const { saveDocument } = require('../marketingEdit');

const router = express.Router();

async function renderToPDF(html, outputPath, singlePage = false) {
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
    const pdfOptions = {
      path: outputPath,
      format: 'Letter',
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    };
    if (singlePage) pdfOptions.pageRanges = '1';
    await page.pdf(pdfOptions);
  } finally {
    await browser.close();
  }
}

async function fitForExport(dealId, kind, html) {
  const fitted = await ensurePageFit(html, kind);
  if (fitted.html !== html) saveDocument(dealId, kind, fitted.html, 'page-fit', null);
  return fitted;
}

// POST /api/export/flyer/:id
router.post('/flyer/:id', async (req, res) => {
  const deal = getDb().prepare('SELECT * FROM deals WHERE id = ?').get(req.params.id);
  if (!deal) return res.status(404).json({ error: 'Deal not found' });
  if (!deal.flyer_html) return res.status(400).json({ error: 'Flyer not yet generated. Run Generate Flyer first.' });

  const outputDir = path.join(OUTPUT_ROOT, req.params.id);
  fs.mkdirSync(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, 'flyer.pdf');

  try {
    const fitted = await fitForExport(req.params.id, 'flyer', deal.flyer_html);
    await renderToPDF(fitted.html, outputPath, true);
    logEvent(req.params.id, req.user, 'pdf_exported', 'One-page flyer exported to PDF');
    res.json({
      success: true,
      path: `/output/${req.params.id}/flyer.pdf`,
      page_fit: { fit: fitted.fit, flagged: fitted.flagged },
    });
  } catch (err) {
    console.error('Flyer PDF error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/export/cbr/:id
router.post('/cbr/:id', async (req, res) => {
  const deal = getDb().prepare('SELECT * FROM deals WHERE id = ?').get(req.params.id);
  if (!deal) return res.status(404).json({ error: 'Deal not found' });
  if (!deal.cbr_html) return res.status(400).json({ error: 'CBR not yet generated. Run Generate CBR first.' });

  const outputDir = path.join(OUTPUT_ROOT, req.params.id);
  fs.mkdirSync(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, 'cbr.pdf');

  try {
    const fitted = await fitForExport(req.params.id, 'cbr', deal.cbr_html);
    await renderToPDF(fitted.html, outputPath, false);
    logEvent(req.params.id, req.user, 'pdf_exported', 'CBR exported to PDF');
    res.json({
      success: true,
      path: `/output/${req.params.id}/cbr.pdf`,
      page_fit: { fit: fitted.fit, flagged: fitted.flagged },
    });
  } catch (err) {
    console.error('CBR PDF error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
