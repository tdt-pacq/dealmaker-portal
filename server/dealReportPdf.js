/**
 * Letter-size deal report PDF.
 * pdfkit draws the pages directly. No Chromium process, so a Render
 * Starter instance (512MB) is not asked to launch a browser for this export.
 * Browser print headers (date, title, URL) are a print-dialog setting this
 * file does not imitate and cannot be removed with CSS.
 */

const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const sharp = require('sharp');

const PAGE_W = 612;
const PAGE_H = 792;
const ML = 40;
const MR = 40;
const CW = PAGE_W - ML - MR;
const TOP = 40;
const BOTTOM = PAGE_H - 46;

const INK = '#1c1917';
const MUTED = '#57534e';
const LINE = '#e6dfd6';
const COPPER = '#C4592F';
const WASH = '#f8efe8';
const RED = '#b91c1c';
const BLUE = '#1d4ed8';
const PURPLE = '#6d28d9';

const { fmtMoney, fmtParen, fmtPct } = require('../shared/dealReport.mjs');

function logoPaths() {
  const root = path.join(__dirname, '..');
  return {
    phoenix: path.join(root, 'client', 'public', 'phoenix-icon.png'),
    // Full cobrand strip. Only the Peterson wordmark pixels are drawn.
    lockup: path.join(root, 'client', 'src', 'assets', 'peterson-logo.png'),
  };
}

// Glyph bounds of "PETERSON ACQUISITIONS" inside peterson-logo.png.
// The same file also holds The Deal Team and a second phoenix; those are not used.
const PETERSON_WORDMARK = { left: 508, top: 100, width: 474, height: 48 };

async function loadBrand(assets = logoPaths()) {
  for (const file of [assets.phoenix, assets.lockup]) {
    if (!fs.existsSync(file)) throw new Error(`Brand asset missing: ${file}`);
  }
  const wordmark = await sharp(assets.lockup).extract(PETERSON_WORDMARK).png().toBuffer();
  return { phoenix: assets.phoenix, wordmark };
}

function renderDealReportPdf(report, assets) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'LETTER',
      margins: { top: TOP, bottom: 52, left: ML, right: MR },
      bufferPages: true,
      autoFirstPage: true,
      info: {
        Title: `${report.meta.dealName} — Market Price Report`,
        Author: 'Peterson Acquisitions',
        Subject: 'QSI Market Price Analyzer discussion draft',
      },
    });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    loadBrand(assets).then(brand => {
      try {
        draw(doc, report, brand);
        stampFooters(doc, report);
        doc.end();
      } catch (err) {
        reject(err);
      }
    }).catch(reject);
  });
}

function draw(doc, report, assets) {
  const page = { doc, y: TOP, index: 0 };
  masthead(page, report, assets);
  summary(page, report);
  const byId = Object.fromEntries(report.sections.map(s => [s.id, s]));
  if (byId.spread) financials(page, report, byId.spread);
  if (byId.fmv) valuation(page, report, byId.fmv);
  if (byId.industry) industry(page, report, byId.industry);
  if (byId.dscr) dscr(page, report, byId.dscr);
  if (byId.seller) seller(page, report, byId.seller);
  if (byId.roi) roi(page, report, byId.roi);
  if (byId.sources) sources(page, report, byId.sources);
  if (byId.proceeds) proceeds(page, report, byId.proceeds);
  if (byId.nlb) nlb(page, report, byId.nlb);
  if (byId.narrative) narrative(page, report, byId.narrative);
}

const CONTENT_H = BOTTOM - TOP;

function need(page, h) {
  if (page.y + h <= BOTTOM) return;
  page.doc.addPage();
  page.index += 1;
  page.y = TOP;
}

// Move a block that fits on one page onto the next page instead of starting it in the leftover space.
function ensureBlock(page, h) {
  if (h <= CONTENT_H && page.y + h > BOTTOM) need(page, CONTENT_H);
}

function gap(page, h) { page.y += h; }

function text(page, str, x, y, width, opts = {}) {
  const doc = page.doc;
  const savedY = doc.y;
  const savedX = doc.x;
  doc.font(opts.font || 'Helvetica').fontSize(opts.size || 9).fillColor(opts.color || INK);
  doc.text(str == null ? '' : String(str), x, y, {
    width,
    align: opts.align || 'left',
    lineGap: opts.lineGap ?? 1,
  });
  doc.x = savedX;
  doc.y = savedY;
}

function heightOf(page, str, width, opts = {}) {
  const doc = page.doc;
  doc.font(opts.font || 'Helvetica').fontSize(opts.size || 9);
  return doc.heightOfString(str == null ? '' : String(str), { width, lineGap: opts.lineGap ?? 1 });
}

function rule(page, color = LINE, weight = 0.6) {
  page.doc.save();
  page.doc.moveTo(ML, page.y).lineTo(ML + CW, page.y).lineWidth(weight).strokeColor(color).stroke();
  page.doc.restore();
}

function sectionHead(page, section) {
  need(page, 72);
  text(page, `SECTION ${section.number}`, ML, page.y, CW, { size: 8, font: 'Helvetica-Bold', color: COPPER });
  page.y += 11;
  text(page, section.title, ML, page.y, CW, { size: 13, font: 'Helvetica-Bold', color: INK });
  page.y += heightOf(page, section.title, CW, { size: 13, font: 'Helvetica-Bold' }) + 4;
  rule(page, COPPER, 1.25);
  page.y += 8;
}

function paragraph(page, str, size = 9) {
  const h = heightOf(page, str, CW, { size, color: MUTED });
  need(page, h + 8);
  text(page, str, ML, page.y, CW, { size, color: MUTED });
  page.y += h + 8;
}

function masthead(page, report, assets) {
  const phoenixH = 22;
  const phoenixW = phoenixH * (110 / 128);
  const wordH = 13;
  page.doc.image(assets.phoenix, ML, page.y, { height: phoenixH });
  page.doc.image(assets.wordmark, ML + phoenixW + 8, page.y + (phoenixH - wordH) / 2, { height: wordH });
  text(page, 'CONFIDENTIAL', ML, page.y + 2, CW, { size: 8, font: 'Helvetica-Bold', color: COPPER, align: 'right' });
  text(page, 'QSI™ MARKET PRICE ANALYZER', ML, page.y + 12, CW, { size: 8, color: MUTED, align: 'right' });
  page.y += phoenixH + 8;
  text(page, report.meta.dealName, ML, page.y, CW, { size: 18, font: 'Helvetica-Bold' });
  page.y += heightOf(page, report.meta.dealName, CW, { size: 18, font: 'Helvetica-Bold' }) + 3;
  const meta = [
    report.meta.advisorName ? `Prepared by ${report.meta.advisorName}` : '',
    report.meta.prepared,
  ].filter(Boolean).join('  ·  ');
  text(page, meta, ML, page.y, CW, { size: 9, color: MUTED });
  page.y += 14;
  rule(page, COPPER, 2);
  page.y += 8;
  paragraph(page, report.disclaimer, 8.5);
}

function summary(page, report) {
  const figs = report.summary || [];
  if (!figs.length) return;
  const cols = figs.length >= 4 ? 4 : Math.max(figs.length, 1);
  const gutter = 8;
  const w = (CW - gutter * (cols - 1)) / cols;
  const heights = figs.map(fig => {
    const valueH = heightOf(page, fig.value, w - 12, { size: 11, font: 'Helvetica-Bold' });
    const noteH = fig.note ? heightOf(page, fig.note, w - 12, { size: 7 }) : 0;
    return 16 + valueH + (noteH ? noteH + 2 : 0) + 8;
  });
  const rowH = [];
  for (let i = 0; i < figs.length; i += cols) {
    rowH.push(Math.max(...heights.slice(i, i + cols)));
  }
  const totalH = rowH.reduce((s, h) => s + h, 0) + gutter * (rowH.length - 1);
  need(page, totalH + 4);
  figs.forEach((fig, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = ML + col * (w + gutter);
    const y = page.y + rowH.slice(0, row).reduce((s, h) => s + h + gutter, 0);
    const h = rowH[row];
    page.doc.save();
    page.doc.roundedRect(x, y, w, h, 4).fill(WASH);
    page.doc.restore();
    text(page, fig.label.toUpperCase(), x + 6, y + 5, w - 12, { size: 7, font: 'Helvetica-Bold', color: MUTED });
    text(page, fig.value, x + 6, y + 16, w - 12, { size: 11, font: 'Helvetica-Bold', color: INK });
    if (fig.note) {
      const valueH = heightOf(page, fig.value, w - 12, { size: 11, font: 'Helvetica-Bold' });
      text(page, fig.note, x + 6, y + 16 + valueH + 2, w - 12, { size: 7, color: MUTED });
    }
  });
  page.y += totalH + 12;
}

function rowHeight(page, columns, row) {
  const size = row.size || 8;
  const font = row.bold || row.isSde ? 'Helvetica-Bold' : 'Helvetica';
  let h = 12;
  const bits = [row.label, ...(row.cells || [])];
  bits.forEach((bit, i) => {
    h = Math.max(h, heightOf(page, bit, columns[i].width - 6, { size, font }) + 6);
  });
  return h;
}

function tableHeight(page, columns, rows, caption) {
  const captionH = caption ? 16 : 0;
  const body = rows.reduce((sum, row) => sum + rowHeight(page, columns, row), 0);
  return captionH + 16 + body + 8;
}

function table(page, columns, rows, caption, keepTogether = false) {
  const headerH = 16;
  const captionH = caption ? 16 : 0;
  const totalH = tableHeight(page, columns, rows, caption);
  if (keepTogether) ensureBlock(page, totalH);
  if (page.y + captionH + headerH + 22 > BOTTOM) {
    page.doc.addPage();
    page.index += 1;
    page.y = TOP;
  }
  if (caption) {
    text(page, caption, ML, page.y, CW, { size: 8, font: 'Helvetica-Bold', color: MUTED });
    page.y += captionH;
  }
  const drawHeader = () => {
    need(page, headerH + 14);
    page.doc.save();
    page.doc.rect(ML, page.y, CW, headerH).fill('#f7f3ee');
    page.doc.restore();
    let x = ML;
    columns.forEach(col => {
      text(page, col.label, x + 3, page.y + 4, col.width - 6, {
        size: 7, font: 'Helvetica-Bold', color: MUTED, align: col.align || 'left',
      });
      x += col.width;
    });
    page.y += headerH;
  };
  drawHeader();
  rows.forEach(row => {
    const size = row.size || 8;
    const font = row.bold || row.isSde ? 'Helvetica-Bold' : 'Helvetica';
    const h = rowHeight(page, columns, row);
    if (page.y + h > BOTTOM) drawHeader();
    if (row.isSde) {
      page.doc.save();
      page.doc.rect(ML, page.y, CW, h).fill(WASH);
      page.doc.restore();
    }
    let x = ML;
    const colorFor = (i, value) => {
      if (row.isSde && i > 0 && columns[i].align === 'right' && !String(columns[i].label).includes('%')) return COPPER;
      if (String(value).startsWith('-') || String(value).startsWith('(')) return RED;
      return row.bold ? INK : '#292524';
    };
    text(page, row.label, x + 3, page.y + 3, columns[0].width - 6, { size, font, color: row.isSde ? COPPER : INK });
    x += columns[0].width;
    (row.cells || []).forEach((cell, i) => {
      text(page, cell, x + 3, page.y + 3, columns[i + 1].width - 6, {
        size, font, color: colorFor(i + 1, cell), align: columns[i + 1].align || 'right',
      });
      x += columns[i + 1].width;
    });
    page.y += h;
    page.doc.save();
    page.doc.moveTo(ML, page.y).lineTo(ML + CW, page.y).lineWidth(0.4).strokeColor(LINE).stroke();
    page.doc.restore();
  });
  gap(page, 8);
}

function fitColumns(labels, firstWidth) {
  const rest = Math.max(labels.length - 1, 1);
  const each = (CW - firstWidth) / rest;
  return labels.map((label, i) => ({
    label,
    width: i === 0 ? firstWidth : each,
    align: i === 0 ? 'left' : 'right',
  }));
}

function financials(page, report, section) {
  sectionHead(page, section);
  paragraph(page, "Seller's discretionary earnings start from net operating income and add back interest, taxes, depreciation, amortization, owner's compensation, and legitimate add-backs. " + report.salaryNote);
  report.spread.groups.forEach((group, idx) => {
    const caption = report.spread.groups.length > 1
      ? (idx === 0 ? 'Historical years' : 'Historical years, continued')
      : '';
    table(page, fitColumns(['Metric', ...group.columns], 150), group.rows, caption);
  });
  const foot = [
    `Weighted average SDE ${fmtMoney(report.sde.rawWeighted)}`,
    `Most recent SDE ${fmtMoney(report.sde.rawRecent)}`,
    `Valuation basis: ${report.sde.basisName} ${fmtMoney(report.sde.rawBasis)}`,
  ];
  if (report.spread.ytd && report.spread.ytd.annualizedSde != null) {
    foot.splice(2, 0, `Annualized YTD SDE ${fmtMoney(report.spread.ytd.annualizedSde)} (before buyer salary)`);
  }
  const footText = foot.join('   ·   ');
  if (report.spread.ytd) {
    const cols = fitColumns(['Metric', ...report.spread.ytd.columns], 150);
    const block = tableHeight(page, cols, report.spread.ytd.rows, 'Year to date and annualized')
      + heightOf(page, footText, CW, { size: 8 }) + 8;
    ensureBlock(page, block);
    table(page, cols, report.spread.ytd.rows, 'Year to date and annualized', true);
  }
  paragraph(page, footText, 8);
}

function valuation(page, report, section) {
  sectionHead(page, section);
  paragraph(page, `Multiples apply to ${report.basisName.toLowerCase()} SDE of ${fmtMoney(report.sde.rawBasis)}, before buyer salary. The selected market price is the figure carried into Sources & Uses.`);
  const cards = report.multiples;
  const gutter = 8;
  const w = (CW - gutter * (cards.length - 1)) / cards.length;
  const h = 52;
  need(page, h + 8);
  cards.forEach((card, i) => {
    const x = ML + i * (w + gutter);
    page.doc.save();
    page.doc.roundedRect(x, page.y, w, h, 4).lineWidth(card.selected ? 1.4 : 0.6).strokeColor(card.selected ? COPPER : LINE).stroke();
    if (card.selected) page.doc.roundedRect(x, page.y, w, h, 4).fill(WASH);
    page.doc.restore();
    text(page, `${card.multiple.toFixed(1)}× SDE`, x + 4, page.y + 6, w - 8, { size: 8, font: 'Helvetica-Bold', color: card.selected ? COPPER : MUTED, align: 'center' });
    text(page, fmtMoney(card.price), x + 4, page.y + 20, w - 8, { size: 12, font: 'Helvetica-Bold', color: card.selected ? COPPER : INK, align: 'center' });
    if (card.selected) text(page, 'SELECTED', x + 4, page.y + 36, w - 8, { size: 7, font: 'Helvetica-Bold', color: COPPER, align: 'center' });
  });
  page.y += h + 8;
  if (report.marketPrice > 0) {
    const line = `Market price ${fmtMoney(report.marketPrice)}${report.marketMultiple != null ? ` (${report.marketMultiple.toFixed(2)}× ${report.basisName.toLowerCase()} SDE)` : ''}.`;
    paragraph(page, line, 9);
  }
}

function industry(page, report, section) {
  sectionHead(page, section);
  const ind = report.industry;
  if (ind.empty) {
    paragraph(page, 'No industry benchmarks are imported. This section stays blank rather than filling in comparison figures.');
    return;
  }
  const head = [ind.name, ind.naics ? `NAICS ${ind.naics}` : '', ind.citation].filter(Boolean).join('  ·  ');
  paragraph(page, head, 9);
  const years = ind.years || [];
  for (let i = 0; i < Math.max(years.length, 1); i += 3) {
    const slice = years.slice(i, i + 3);
    const columns = fitColumns(['Metric', 'Industry', ...slice.map(y => String(y.year))], 130);
    const bench = ind.grossBenchmark;
    const row = (label, pick, benchmark, higherBetter) => ({
      label,
      cells: [
        benchmark == null ? '—' : `${Number(benchmark).toFixed(1)}%`,
        ...slice.map(y => {
          const v = pick(y);
          if (v == null) return '—';
          const arrow = benchmark == null ? '' : (higherBetter ? (v >= benchmark ? ' up' : ' down') : '');
          return `${v.toFixed(1)}%${arrow}`;
        }),
      ],
    });
    table(page, columns, [
      row('Gross margin', y => y.grossMargin, bench, true),
      row('EBITDA', y => y.ebitda, null, true),
      row('Net income', y => y.net, null, true),
    ], '', true);
  }
  const dealX = ind.dealMult == null ? '—' : `${ind.dealMult.toFixed(2)}×`;
  const implied = ind.tierMult > 0 && ind.recSde ? fmtMoney(ind.recSde * ind.tierMult) : '—';
  const ruleImplied = ind.ruleSde && ind.recSde ? fmtMoney(ind.recSde * ind.ruleSde) : '—';
  const revImplied = ind.ruleRevenue && ind.recRev ? fmtMoney(ind.recRev * ind.ruleRevenue / 100) : '—';
  table(page, fitColumns(['Multiple', 'Industry', 'This deal', 'Implied value'], 170), [
    { label: `MVIC/SDE (${ind.tierLabel})`, cells: [ind.tierMult > 0 ? `${ind.tierMult.toFixed(2)}×` : '—', dealX, implied] },
    { label: 'Rules of thumb — × SDE', cells: [ind.ruleSde ? `${ind.ruleSde.toFixed(1)}×` : '—', dealX, ruleImplied] },
    { label: 'Rules of thumb — % of revenue', cells: [ind.ruleRevenue ? `${ind.ruleRevenue}%` : '—', ind.dealRevPct == null ? '—' : `${ind.dealRevPct.toFixed(1)}%`, revImplied] },
  ], '', true);
  if (ind.marketPrice > 0) paragraph(page, `Market price ${fmtMoney(ind.marketPrice)}.`, 9);
}

function dscr(page, report, section) {
  const d = report.dscr;
  const intro = d.mode === 'deal'
    ? `Annual debt service is the payment on the Sources & Uses loan of ${fmtMoney(d.deal.loanAmount)} (${d.deal.detail}). Each year's SDE is before buyer salary. Strong means at least ${d.rows[0] ? d.rows[0].strongAt.toFixed(2) : (d.minimum + 0.25).toFixed(2)}×. The required minimum is ${d.minimum.toFixed(2)}×.`
    : (!d.sizing.usable
      ? `No market price is selected, and SDE after buyer salary is not positive, so no debt service is calculated. Required minimum ${d.minimum.toFixed(2)}×.`
      : `No market price is selected, so this table uses only the 3× after-salary sizing reference. It is not a financed Sources & Uses loan. Required minimum ${d.minimum.toFixed(2)}×.`);
  const dscrRows = d.rows.map(r => ({
    label: r.year,
    bold: true,
    cells: [fmtMoney(r.sde), r.annualDebtService > 0 ? fmtMoney(r.annualDebtService) : '—', r.ratio == null ? '—' : r.ratio.toFixed(2), r.assessment],
  }));
  const cols = fitColumns(['Year', 'SDE (before salary)', 'Annual debt service', 'DSCR', 'Assessment'], 70);
  const notesH = heightOf(page, d.sizing.note, CW, { size: 8 }) + 8
    + (d.roiContrast ? heightOf(page, d.roiContrast, CW, { size: 8 }) + 8 : 0);
  ensureBlock(page, 48 + heightOf(page, intro, CW, { size: 9 }) + 8 + tableHeight(page, cols, dscrRows, '') + notesH);
  sectionHead(page, section);
  paragraph(page, intro);
  table(page, cols, dscrRows, '', true);
  paragraph(page, d.sizing.note, 8);
  if (d.roiContrast) paragraph(page, d.roiContrast, 8);
}

function seller(page, report, section) {
  sectionHead(page, section);
  const s = report.seller;
  paragraph(page, `Compares prices using SDE of ${fmtMoney(s.rawBasis)} before the ${fmtMoney(s.buyerSalary)} buyer salary. Payments here are on price x (1 - down payment), not the fee-financed Sources & Uses loan. Adjusted DSCR subtracts the salary. Contingency is ${s.contingencyPct}% of SDE.`);
  const cols = fitColumns(['', ...s.columns.map(c => c.label)], 150);
  const cell = (col, pick, money = true) => col.price == null ? '—' : (money ? fmtMoney(pick(col)) : pick(col));
  table(page, cols, [
    { label: 'Price', bold: true, cells: s.columns.map(c => cell(c, x => x.price)) },
    { label: 'Down payment', cells: s.columns.map(c => cell(c, x => x.down)) },
    { label: 'Loan before fees', cells: s.columns.map(c => cell(c, x => x.loan)) },
    { label: 'Annual debt service', cells: s.columns.map(c => cell(c, x => x.annual)) },
    { label: 'Raw DSCR', cells: s.columns.map(c => c.rawDscr == null ? '—' : c.rawDscr.toFixed(2)) },
    { label: 'DSCR after salary', cells: s.columns.map(c => c.adjDscr == null ? '—' : c.adjDscr.toFixed(2)) },
    { label: 'Cash left after salary, debt, contingency', cells: s.columns.map(c => c.price == null ? '—' : fmtMoney(c.cashLeft)) },
  ]);
}

function roi(page, report, section) {
  sectionHead(page, section);
  const r = report.roi;
  paragraph(page, `Cash flow uses SDE after buyer salary (${fmtMoney(r.sde)}), not the ${fmtMoney(report.sde.rawBasis)} valuation SDE. The loan payment is on ${fmtMoney(r.sbaLoan)} at ${fmtPct(r.rate, 2)} / ${r.years} years. Guarantee fee and closing costs are in cash to close, not inside this payment.`);
  const stats = [
    ['Cash to close', fmtMoney(r.cashToClose)],
    ['Cash-on-cash', r.cashOnCash == null ? '—' : fmtPct(r.cashOnCash, 1)],
    ['Leverage', r.leverage == null ? '—' : `${r.leverage.toFixed(1)}:1`],
  ];
  const w = (CW - 16) / 3;
  need(page, 42);
  stats.forEach((s, i) => {
    const x = ML + i * (w + 8);
    page.doc.save();
    page.doc.roundedRect(x, page.y, w, 36, 4).strokeColor(LINE).lineWidth(0.6).stroke();
    page.doc.restore();
    text(page, s[0].toUpperCase(), x + 4, page.y + 5, w - 8, { size: 7, font: 'Helvetica-Bold', color: MUTED, align: 'center' });
    text(page, s[1], x + 4, page.y + 16, w - 8, { size: 12, font: 'Helvetica-Bold', align: 'center' });
  });
  page.y += 44;
  const rows = [
    { label: 'SDE after buyer salary', cells: [fmtMoney(r.sde), fmtMoney(r.sde / 12)], isSde: true },
    { label: 'SBA payment on market-price loan', cells: [fmtParen(r.sbaAnnual), fmtParen(r.sbaMonthly)] },
  ];
  if (r.sellerAnnual > 0) rows.push({ label: 'Seller financing', cells: [fmtParen(r.sellerAnnual), fmtParen(r.sellerAnnual / 12)] });
  rows.push({ label: 'Net cash flow', bold: true, cells: [fmtMoney(r.netCashFlow), fmtMoney(r.netCashFlow / 12)] });
  table(page, fitColumns(['Year 1', 'Annual', 'Monthly'], 240), rows);
  paragraph(page, `Exit year ${r.exitYears}. Exit SDE ${fmtMoney(r.exitSde)} after ${(r.growth * 100).toFixed(1)}% annual growth. Exit multiple source: ${r.exitMultipleSource}.`, 8);
  table(page, fitColumns(['Scenario', ...r.scenarioLabels], 120), [
    { label: 'Multiple', cells: r.scenarios.map(s => `${s.multiple.toFixed(1)}×`) },
    { label: 'Total return', cells: r.scenarios.map(s => fmtMoney(s.total)) },
    { label: 'Total ROI', cells: r.scenarios.map(s => s.roiPct == null ? '—' : `${s.roiPct.toFixed(0)}%`) },
    { label: 'CAGR', cells: r.scenarios.map(s => s.cagr == null ? '—' : fmtPct(s.cagr * 100, 1)) },
  ]);
}

function sources(page, report, section) {
  sectionHead(page, section);
  const s = report.sources;
  paragraph(page, `The SBA loan finances ${fmtPct(100 - s.downPct, 0)} of the project plus the guarantee fee and closing costs. Buyer cash at closing on this page is the ${fmtPct(s.downPct, 0)} down payment. Fee and closing costs are uses, not extra cash, on this page.`);
  const colW = (CW - 16) / 2;
  const left = [
    [`SBA loan (${fmtPct(100 - s.downPct, 0)} + fee + closing)`, fmtMoney(s.sbaLoan)],
    [`Buyer down payment (${fmtPct(s.downPct, 0)})`, fmtMoney(s.downPayment)],
    ...(s.sellerNote > 0 ? [['Seller financing note', fmtMoney(s.sellerNote)]] : []),
    ['Total sources', fmtMoney(s.sourcesTotal)],
  ];
  const right = [
    ['Market price', fmtMoney(s.marketPrice)],
    ...(s.reVal > 0 ? [['Real estate', fmtMoney(s.reVal)]] : []),
    ...(s.wc > 0 ? [['Working capital', fmtMoney(s.wc)]] : []),
    ...(s.arVal > 0 ? [['Accounts receivable', fmtMoney(s.arVal)]] : []),
    ...(s.invVal > 0 ? [['Inventory', fmtMoney(s.invVal)]] : []),
    ['SBA guarantee fee', fmtMoney(s.guaranteeFee)],
    ['Closing costs', fmtMoney(s.closing)],
    ['Total uses', fmtMoney(s.usesTotal)],
  ];
  const rowH = 16;
  const rows = Math.max(left.length, right.length);
  need(page, 18 + rows * rowH);
  text(page, 'SOURCES', ML, page.y, colW, { size: 8, font: 'Helvetica-Bold', color: COPPER });
  text(page, 'USES', ML + colW + 16, page.y, colW, { size: 8, font: 'Helvetica-Bold', color: COPPER });
  page.y += 14;
  const start = page.y;
  const paint = (items, x) => {
    let y = start;
    items.forEach((item, i) => {
      const last = i === items.length - 1;
      text(page, item[0], x, y, colW * 0.62, { size: 8, font: last ? 'Helvetica-Bold' : 'Helvetica', color: MUTED });
      text(page, item[1], x + colW * 0.62, y, colW * 0.38 - 4, { size: 8, font: last ? 'Helvetica-Bold' : 'Helvetica', align: 'right', color: INK });
      y += rowH;
    });
    return y;
  };
  const y1 = paint(left, ML);
  const y2 = paint(right, ML + colW + 16);
  page.y = Math.max(y1, y2) + 4;
  if (s.sellerNote > 0) {
    paragraph(page, 'The seller note is an additional source on this page and is not subtracted from the SBA loan. Buyer ROI does subtract a seller note from the loan it amortizes.', 8);
  }
  if (!s.balanced) paragraph(page, `Sources ${fmtMoney(s.sourcesTotal)} and uses ${fmtMoney(s.usesTotal)} do not match.`, 8);
}

function proceeds(page, report, section) {
  sectionHead(page, section);
  const p = report.proceeds;
  paragraph(page, 'Seller proceeds deduct debt, commission, legal fees, tax, and a seller closing cost only when one is entered. The buyer SBA guarantee fee and buyer closing costs stay in Sources & Uses and buyer cash to close. A missing sale price is not reported as $0.');
  if (!p.available) {
    paragraph(page, 'Sale price is not entered, so net proceeds are not calculated.', 9);
    return;
  }
  table(page, fitColumns(['', 'Amount'], 340), p.lines.map(line => ({
    label: line.label,
    cells: [line.sign === '-' ? fmtParen(line.amount) : fmtMoney(line.amount)],
  })).concat([{ label: 'Estimated net proceeds', bold: true, isSde: true, cells: [fmtMoney(p.net)] }]));
}

function nlb(page, report, section) {
  sectionHead(page, section);
  const n = report.nlb;
  paragraph(page, 'Illustration only. The down payment is the NLB tab’s percent of net proceeds. Target price assumes that down payment is 10% of the next acquisition. Estimated SDE is the target price divided by 3 unless a next-business SDE was entered. This is not a valuation and not a listing.');
  if (!n.available) {
    paragraph(page, n.reason, 9);
    if (n.curSDE) paragraph(page, `Current business SDE (most recent, before buyer salary): ${fmtMoney(n.curSDE)}.`, 9);
    return;
  }
  table(page, fitColumns(['', 'Amount'], 320), [
    { label: 'Net proceeds from sale', cells: [fmtMoney(n.net)] },
    { label: `Down payment for the next acquisition (${fmtPct(n.pct, 0)} of proceeds)`, cells: [fmtMoney(n.downPayment)] },
    { label: 'Proceeds left after that down payment', cells: [fmtMoney(n.remaining)] },
    { label: 'Current business SDE (before buyer salary)', cells: [fmtMoney(n.curSDE)] },
    { label: 'Target price (down payment ÷ 10%)', cells: [fmtMoney(n.target)] },
    { label: n.nextSdeEstimated ? 'Estimated next SDE (target price ÷ 3)' : 'Next business SDE (entered)', cells: [fmtMoney(n.nextSDE)] },
    { label: 'Illustrated income difference', bold: true, cells: [fmtMoney(n.incomeIncrease)] },
  ]);
}

function narrative(page, report, section) {
  const n = report.narrative;
  if (!n.hasFinancials) {
    sectionHead(page, section);
    paragraph(page, 'No completed year with revenue is entered, so trend charts are omitted.', 9);
  } else {
    const lead = `Most recent year with revenue: ${n.year}. Charts use completed years only.`;
    const charts = n.charts || [];
    const chH = 156;
    const chartRows = Math.ceil(charts.length / 2);
    const wfH = n.waterfall.length ? 190 : 0;
    const visualH = 46 + heightOf(page, lead, CW, { size: 8 }) + 8 + 52
      + 16 + chartRows * (chH + 8) + wfH;
    ensureBlock(page, visualH);
    sectionHead(page, section);
    paragraph(page, lead, 8);
    const cols = 4;
    const gutter = 8;
    const w = (CW - gutter * (cols - 1)) / cols;
    n.kpis.forEach((kpi, i) => {
      const x = ML + i * (w + gutter);
      page.doc.save();
      page.doc.roundedRect(x, page.y, w, 44, 3).strokeColor(LINE).lineWidth(0.5).stroke();
      page.doc.restore();
      text(page, kpi.label.toUpperCase(), x + 4, page.y + 4, w - 8, { size: 7, font: 'Helvetica-Bold', color: MUTED });
      text(page, kpi.value, x + 4, page.y + 15, w - 8, { size: 10, font: 'Helvetica-Bold' });
      if (kpi.detail) text(page, kpi.detail, x + 4, page.y + 28, w - 8, { size: 6.5, color: MUTED });
    });
    page.y += 52;
    if (charts.length) {
      text(page, 'Performance charts', ML, page.y, CW, { size: 8, font: 'Helvetica-Bold', color: MUTED });
      page.y += 14;
    }
    for (let i = 0; i < charts.length; i += 2) {
      const pair = charts.slice(i, i + 2);
      const chW = (CW - 12) / 2;
      if (page.y + chH > BOTTOM) {
        need(page, chH + 8);
        text(page, 'Performance charts, continued', ML, page.y, CW, { size: 8, font: 'Helvetica-Bold', color: MUTED });
        page.y += 14;
      }
      pair.forEach((chart, idx) => barChart(page, ML + idx * (chW + 12), page.y, chW, chH, chart));
      page.y += chH + 8;
    }
    if (n.waterfall.length) {
      if (page.y + wfH > BOTTOM) {
        need(page, wfH);
        text(page, 'Performance charts, continued', ML, page.y, CW, { size: 8, font: 'Helvetica-Bold', color: MUTED });
        page.y += 14;
      }
      text(page, `Revenue to SDE — ${n.year}`, ML, page.y, CW, { size: 8, font: 'Helvetica-Bold', color: MUTED });
      page.y += 12;
      waterfall(page, ML, page.y, CW, 168, n.waterfall);
      page.y += 174;
    }
  }
  if (n.text) {
    n.text.split('\n').forEach(line => {
      const heading = line.match(/^\*\*(.+?)\*\*$/);
      if (!line.trim()) { gap(page, 6); return; }
      if (heading) {
        need(page, 18);
        text(page, heading[1], ML, page.y, CW, { size: 11, font: 'Helvetica-Bold' });
        page.y += 16;
        return;
      }
      const plain = line.replace(/\*\*(.+?)\*\*/g, '$1');
      paragraph(page, plain, 9);
    });
  }
}

function barChart(page, x, y, w, h, chart) {
  const doc = page.doc;
  doc.save();
  doc.roundedRect(x, y, w, h, 3).strokeColor(LINE).lineWidth(0.5).stroke();
  doc.restore();
  text(page, chart.title, x + 8, y + 6, w - 16, { size: 8, font: 'Helvetica-Bold', color: MUTED });
  const points = chart.points || [];
  if (!points.length) return;
  const plotX = x + 36;
  const plotY = y + 22;
  const plotW = w - 48;
  const plotH = h - 46;
  const vals = points.map(p => p.value);
  const max = Math.max(...vals, 0);
  const min = Math.min(...vals, 0);
  const range = (max - min) || 1;
  const yAt = v => plotY + plotH * (1 - (v - min) / range);
  doc.save();
  doc.strokeColor('#e7e5e4').lineWidth(0.4);
  for (let t = 0; t <= 3; t++) {
    const v = min + (range / 3) * t;
    const yy = yAt(v);
    doc.moveTo(plotX, yy).lineTo(plotX + plotW, yy).stroke();
    const tick = chart.format === 'pct' ? `${v.toFixed(0)}%` : compactMoney(v);
    text(page, tick, x + 2, yy - 4, 32, { size: 6, color: MUTED, align: 'right' });
  }
  const zero = yAt(0);
  doc.strokeColor('#a8a29e').moveTo(plotX, zero).lineTo(plotX + plotW, zero).stroke();
  const gap = plotW / points.length;
  const bw = Math.max(8, gap * 0.55);
  points.forEach((p, i) => {
    const bx = plotX + gap * i + (gap - bw) / 2;
    const y1 = yAt(p.value);
    const top = Math.min(y1, zero);
    const bh = Math.max(Math.abs(y1 - zero), 1);
    doc.fillColor(chart.color || COPPER).rect(bx, top, bw, bh).fill();
    text(page, p.label, plotX + gap * i, y + h - 16, gap, { size: 7, color: MUTED, align: 'center' });
  });
  doc.restore();
}

function waterfall(page, x, y, w, h, steps) {
  const doc = page.doc;
  let running = 0;
  const bars = steps.map(s => {
    let lo; let hi;
    if (s.type === 'start') { lo = 0; hi = s.val != null ? s.val : s.value; running = hi; }
    else if (s.type === 'step') {
      const v = s.value;
      if (v >= 0) { lo = running; hi = running + v; } else { hi = running; lo = running + v; }
      running += v;
    } else { lo = 0; hi = running; }
    return { ...s, lo: Math.min(lo, hi), hi: Math.max(lo, hi), running };
  });
  const max = Math.max(...bars.map(b => b.hi), 1);
  const min = Math.min(...bars.map(b => b.lo), 0);
  const range = max - min || 1;
  const plotX = x + 36;
  const plotY = y + 8;
  const plotW = w - 44;
  const plotH = h - 36;
  const yAt = v => plotY + plotH * (1 - (v - min) / range);
  const gap = plotW / bars.length;
  const bw = Math.max(10, gap * 0.62);
  doc.save();
  doc.strokeColor('#e7e5e4').lineWidth(0.4);
  for (let t = 0; t <= 3; t++) {
    const v = min + (range / 3) * t;
    const yy = yAt(v);
    doc.moveTo(plotX, yy).lineTo(plotX + plotW, yy).stroke();
    text(page, compactMoney(v), x, yy - 4, 34, { size: 6, color: MUTED, align: 'right' });
  }
  bars.forEach((b, i) => {
    const bx = plotX + gap * i + (gap - bw) / 2;
    const top = yAt(b.hi);
    const bot = yAt(b.lo);
    const color = b.label === 'SDE' ? COPPER : b.label === 'EBITDA' ? PURPLE : (b.value < 0 ? RED : (b.type === 'total' || b.type === 'start' ? BLUE : '#44403c'));
    doc.fillColor(color).rect(bx, top, bw, Math.max(bot - top, 1)).fill();
    text(page, compactMoney(b.type === 'step' ? b.value : b.running), bx - 4, top - 9, bw + 8, { size: 6, color, align: 'center' });
    text(page, b.label, plotX + gap * i, y + h - 16, gap, { size: 6, color: MUTED, align: 'center' });
  });
  doc.restore();
}

function compactMoney(v) {
  const n = Number(v) || 0;
  const sign = n < 0 ? '-' : '';
  const a = Math.abs(n);
  if (a >= 1000000) return `${sign}$${(a / 1000000).toFixed(1)}M`;
  if (a >= 1000) return `${sign}$${Math.round(a / 1000)}k`;
  return `${sign}$${Math.round(a)}`;
}

function stampFooters(doc, report) {
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(i);
    doc.save();
    doc.moveTo(ML, PAGE_H - 38).lineTo(PAGE_W - MR, PAGE_H - 38).lineWidth(0.5).strokeColor(LINE).stroke();
    doc.font('Helvetica').fontSize(8).fillColor(MUTED);
    doc.text('QSI™ Market Price Analyzer  ·  Peterson Acquisitions  ·  Confidential  ·  For discussion only', ML, PAGE_H - 28, {
      width: CW - 56, lineBreak: false, height: 12,
    });
    doc.text(`${i + 1} / ${range.count}`, PAGE_W - MR - 48, PAGE_H - 28, {
      width: 48, align: 'right', lineBreak: false, height: 12,
    });
    doc.restore();
  }
}

module.exports = { renderDealReportPdf, logoPaths, PAGE_W, PAGE_H };
