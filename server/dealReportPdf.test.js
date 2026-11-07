const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { buildDealReport } = require('../shared/dealReport.mjs');
const { willowAshSampleState } = require('../shared/willowAshSample.cjs');
const { renderDealReportPdf, PAGE_W, PAGE_H } = require('./dealReportPdf');

const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');

async function load(buffer) {
  return pdfjs.getDocument({ data: new Uint8Array(buffer), disableWorker: true }).promise;
}

async function pagesOf(buffer) {
  const doc = await load(buffer);
  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const items = content.items.filter(item => item.str && item.str.trim());
    pages.push({ viewport, items, text: items.map(item => item.str).join('\n') });
  }
  return pages;
}

function assertInside(pages, label) {
  pages.forEach((page, i) => {
    assert.equal(Math.round(page.viewport.width), PAGE_W, `${label} page ${i + 1} width`);
    assert.equal(Math.round(page.viewport.height), PAGE_H, `${label} page ${i + 1} height`);
    assert.ok(page.items.length > 3, `${label} page ${i + 1} is blank`);
    for (const item of page.items) {
      const x = item.transform[4];
      const right = x + item.width;
      assert.ok(x >= 24, `${label} page ${i + 1} "${item.str}" starts at ${x.toFixed(1)}`);
      assert.ok(right <= page.viewport.width - 24, `${label} page ${i + 1} "${item.str}" ends at ${right.toFixed(1)}`);
    }
  });
}

test('Willow Ash PDF is letter size, numbered, and does not clip or invent the old contradictions', async () => {
  const report = buildDealReport(willowAshSampleState(), { preparedDate: '2026-11-07' });
  const pdf = await renderDealReportPdf(report);
  const pages = await pagesOf(pdf);
  assert.ok(pages.length >= 4 && pages.length <= 8, `page count ${pages.length}`);
  assertInside(pages, 'willow');
  const all = pages.map(p => p.text).join('\n');
  assert.match(all, /Willow Ash/);
  assert.match(all, /Michael R\. Moore/);
  assert.match(all, /\$152,903/);
  assert.match(all, /\$77,903/);
  assert.match(all, /\$412,837/);
  assert.equal(all.includes('Deal Team'), false);
  assert.equal(all.includes('$387,000'), false);
  const ytdPage = pages.find(p => p.text.includes('Year to date and annualized'));
  assert.match(ytdPage.text, /YTD \(9 mo\)/);
  assert.match(ytdPage.text, /Weighted average SDE/);
  assert.match(ytdPage.text, /\$70,475/);
  const dscrPage = pages.find(p => p.text.includes('Debt Service Coverage Ratio'));
  assert.match(dscrPage.text, /2023/);
  assert.match(dscrPage.text, /2024/);
  assert.match(dscrPage.text, /2025/);
  assert.match(dscrPage.text, /Sizing reference only/);
  const chartPage = pages.find(p => p.text.includes('Performance charts') && p.text.includes('Revenue to SDE'));
  assert.ok(chartPage);
  assert.match(chartPage.text, /EBITDA margin/);
  assert.match(chartPage.text, /Gross margin/);
  assert.match(all, /\$69,565/);
  assert.match(all, /\$65,468/);
  assert.match(all, /\$33,356/);
  assert.match(all, /Business Brokerage Press 2026/);
  assert.equal(all.includes('2026 2026'), false);
  assert.equal(all.includes('portal.thedealteam.co'), false);
  assert.match(all, /Sizing reference only/);
  assert.match(all, /1 \/ \d/);
  assert.match(pages[pages.length - 1].text, new RegExp(`${pages.length} \\/ ${pages.length}`));
  assert.match(all, /Market price/);
  assert.equal(/\bLOI\b/.test(all), false);
  assert.equal(all.includes('Asking price'), false);
  // The old report's poisoned outcome.
  assert.equal(all.includes('-$152,903'), false);
});

test('long names and a missing sale price stay inside the page and do not print a fake proceeds total', async () => {
  const state = willowAshSampleState();
  state.dealName = 'Willow Ash Roofing and Exterior Services of the Greater Southeast Region';
  state.advisorName = 'Alexandria Montgomery-Harrington, Certified Business Intermediary';
  state.su.marketPrice = '';
  state.np.gross = '';
  state.years = [2018, 2019, 2020, 2021, 2022, 2023].map((yr, i) => ({
    year: yr,
    entityType: '1120',
    revenue: i === 5 ? 0 : 250000 * (i + 1),
    cogs: i === 2 ? 900000 : 100000,
    opx: 80000,
    interest: i === 4 ? -1200 : 0,
    taxes: 500,
    depreciation: 0,
    amortization: 0,
    ownerComp: 0,
    addBacks: [],
  }));
  state.ytdEnabled = true;
  state.ytdThrough = '2026-04';
  state.ytdData = { year: 'YTD', entityType: '1120', revenue: 80000, cogs: 30000, opx: 20000, interest: 0, taxes: 0, depreciation: 0, amortization: 0, ownerComp: 0, addBacks: [] };
  const pdf = await renderDealReportPdf(buildDealReport(state, { preparedDate: 'November 7, 2026' }));
  const pages = await pagesOf(pdf);
  assertInside(pages, 'long');
  const all = pages.map(p => p.text).join('\n');
  const flat = all.replace(/\s+/g, ' ');
  assert.match(flat, /Greater Southeast Region/);
  assert.match(all, /Alexandria Montgomery-Harrington/);
  assert.match(all, /Sale price is not entered/);
  assert.equal(all.includes('Estimated net proceeds'), false);
  assert.match(all, /-\$/); // negative gross profit or interest is visible
});

test('sample pdf artifact path is the renderer used by the route', () => {
  const route = fs.readFileSync(path.join(__dirname, 'routes', 'analyzerReport.js'), 'utf8');
  assert.match(route, /renderDealReportPdf/);
  assert.equal(route.includes('puppeteer'), false);
});
