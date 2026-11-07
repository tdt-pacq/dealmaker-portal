const express = require('express');
const { buildDealReport } = require('../../shared/dealReport.cjs');
const { renderDealReportPdf } = require('../dealReportPdf');

const router = express.Router();

// Letter PDF for the deal report. pdfkit only — do not render this through
// Puppeteer. A Chromium launch is the wrong memory trade on a 512MB instance,
// and the marketing flyer/CBR exports already own that path.
router.post('/report.pdf', async (req, res) => {
  const state = req.body && req.body.state;
  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    return res.status(400).json({ error: 'Analyzer state is required.' });
  }
  try {
    const report = buildDealReport(state, {
      narrative: typeof req.body.narrative === 'string' ? req.body.narrative : '',
      preparedDate: req.body.preparedDate,
      sections: req.body.sections && typeof req.body.sections === 'object' ? req.body.sections : undefined,
    });
    const pdf = await renderDealReportPdf(report);
    const filename = `${report.meta.fileSlug}-market-price-report.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdf);
  } catch (err) {
    console.error('Deal report PDF error:', err);
    res.status(500).json({ error: 'Could not build the report PDF.' });
  }
});

module.exports = router;
