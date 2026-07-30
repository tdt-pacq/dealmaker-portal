const express = require('express');
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const { getDb } = require('../database');

const router = express.Router();

async function renderToPDF(html, outputPath, landscape = false) {
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
    const pdfOptions = {
      path: outputPath,
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 }
    };
    if (landscape) {
      pdfOptions.width = '1920px';
      pdfOptions.height = '1080px';
      pdfOptions.landscape = true;
    } else {
      pdfOptions.format = 'Letter';
      pdfOptions.pageRanges = '1';
    }
    await page.pdf(pdfOptions);
  } finally {
    await browser.close();
  }
}

// POST /api/export/flyer/:id
router.post('/flyer/:id', async (req, res) => {
  const deal = getDb().prepare('SELECT * FROM deals WHERE id = ?').get(req.params.id);
  if (!deal) return res.status(404).json({ error: 'Deal not found' });
  if (!deal.flyer_html) return res.status(400).json({ error: 'Flyer not yet generated. Run Generate Flyer first.' });

  const outputDir = path.join(__dirname, '..', '..', 'output', req.params.id);
  fs.mkdirSync(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, 'flyer.pdf');

  try {
    await renderToPDF(deal.flyer_html, outputPath, false);
    res.json({ success: true, path: `/output/${req.params.id}/flyer.pdf` });
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

  const outputDir = path.join(__dirname, '..', '..', 'output', req.params.id);
  fs.mkdirSync(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, 'cbr.pdf');

  try {
    await renderToPDF(deal.cbr_html, outputPath, true);
    res.json({ success: true, path: `/output/${req.params.id}/cbr.pdf` });
  } catch (err) {
    console.error('CBR PDF error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
