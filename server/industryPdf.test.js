const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const express = require('express');

const {
  pdfTextIsSparse,
  industryExtractionIsUseful,
  parseBrgIndustryReport,
  INDUSTRY_EXTRACT_FAILED,
} = require('../shared/industryBenchmarks.cjs');
const { extractAnalyzerPdf, extractEmbeddedPageJpegs } = require('./industryPdf');

const INDUSTRY_PROMPT = 'Extract industry benchmarks including sdeMultUnder1M.';
const TAX_PROMPT = 'Extract the tax return income statement.';

const BRG_FIXTURE = `
© Copyright 2026 Business Brokerage Press, Inc. All Rights Reserved.

Roofing Contractors
Industry Quick View
NAICS Businesses/Units Revenue
238160 24,000 $69.9 billion

Under $1 Million Net Sales
+ MVIC/Net Sales: 0.55
+ MVIC/Gross Profit: 0.88
+ MVIC/SDE: 1.66
+ MVIC/EBITDA: 2.20

$1 Million - $5 Million Net Sales
+ MVIC/Net Sales: 0.36
+ MVIC/SDE: 2.07
+ MVIC/EBITDA: 3.15

Over $5 Million Net Sales
+ MVIC/Net Sales: 0.59
+ MVIC/SDE: 3.31
+ MVIC/EBITDA: 4.04

Income Data (as a percentage of Net Sales)
2023-24 2024-25 2025-26
Gross Profit 31.4 32.2 32.8
Profit Before Taxes 8.1 8.7 8.0

Expenses (% of Annual Sales) from Our Industry Experts
+ Cost of Goods: 38.0%
+ Profit (pretax): 10.0%
`;

function footerOnly(pages = 15) {
  return Array.from({ length: pages }, () => '© Copyright 2026 Business Brokerage Press, Inc. All Rights Reserved.').join('\n\n');
}

function jpegDict(width, height, payload) {
  const header = `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Length ${payload.length} /Filter /DCTDecode >>\nstream\n`;
  return Buffer.concat([Buffer.from(header), payload, Buffer.from('\nendstream\n')]);
}

test('footer-only Business Reference Guide text is sparse and a real text layer is not', () => {
  assert.equal(pdfTextIsSparse('', 15), true);
  assert.equal(pdfTextIsSparse(footerOnly(15), 15), true);
  const rich = Array.from({ length: 20 }, (_, i) => `Revenue year ${2000 + i} amount ${100000 + i * 17}`).join('\n');
  assert.equal(pdfTextIsSparse(`${rich}\n${footerOnly(2)}`, 4), false);
});

test('maps a Deal Studio Business Reference Guide into the review fields', () => {
  const data = parseBrgIndustryReport(BRG_FIXTURE);
  assert.ok(data);
  assert.equal(data.name, 'Roofing Contractors');
  assert.equal(data.naics, '238160');
  assert.equal(data.source, 'Business Brokerage Press 2026');
  assert.equal(data.reportYear, 2026);
  assert.equal(data.grossMarginPct, 32.8);
  assert.equal(data.cogsPct, 67.2);
  assert.equal(data.preTaxProfitPct, 8);
  assert.equal(data.netMarginPct, null);
  assert.equal(data.sdeMultUnder1M, 1.66);
  assert.equal(data.sdeMult1to5M, 2.07);
  assert.equal(data.sdeMultOver5M, 3.31);
  assert.equal(data.ebitdaMultUnder1M, 2.2);
  assert.equal(data.ebitdaMult1to5M, 3.15);
  assert.equal(data.ebitdaMultOver5M, 4.04);
  assert.equal(data.sdeMult, null);
  assert.equal(data.revenueMultPct, null);
  assert.equal(data.ebitMult, null);
  assert.equal(data.ebitdaMult, null);
});

test('rules of thumb use a single figure and ignore ranges', () => {
  const single = parseBrgIndustryReport(`
Roofing Contractors
Industry Quick View
NAICS
238160
Rules of Thumb
2.5 x SDE
40% of annual sales
4 x EBIT
4.5 x EBITDA
Pricing Tips
3 to 3.5 x SDE
`);
  assert.equal(single.sdeMult, 2.5);
  assert.equal(single.revenueMultPct, 40);
  assert.equal(single.ebitMult, 4);
  assert.equal(single.ebitdaMult, 4.5);

  const ranged = parseBrgIndustryReport(`${BRG_FIXTURE}\nRules of Thumb\n3 to 3.5 x SDE\n`);
  assert.equal(ranged.sdeMult, null);
});

test('source and year alone are not a successful extraction', () => {
  assert.equal(industryExtractionIsUseful({
    source: 'Business Brokerage Press 2026',
    reportYear: 2026,
    name: null,
    grossMarginPct: null,
  }), false);
  assert.match(INDUSTRY_EXTRACT_FAILED, /could not find industry benchmarks/i);
});

test('embedded full-page JPEGs are extracted and tiny images are ignored', () => {
  const payload = Buffer.from([0xff, 0xd8, 0xff, 0xd9, 1, 2, 3, 4]);
  const blob = Buffer.concat([
    Buffer.from('%PDF-1.4\n'),
    jpegDict(10, 10, payload),
    jpegDict(1330, 1734, payload),
  ]);
  const images = extractEmbeddedPageJpegs(blob);
  assert.equal(images.length, 1);
  assert.equal(images[0].width, 1330);
  assert.equal(images[0].bytes.length, payload.length);
  assert.equal(images[0].bytes[0], 0xff);
});

test('a text industry PDF still goes to the text model', async () => {
  const lines = Array.from({ length: 25 }, (_, i) => `Gross profit note ${i} value ${30 + i}`).join('\n');
  const calls = [];
  process.env.ANTHROPIC_API_KEY = 'test-key';
  const result = await extractAnalyzerPdf(Buffer.from('%PDF'), INDUSTRY_PROMPT, {
    readPdfText: async () => ({ text: lines, numpages: 2 }),
    fetchImpl: async (_url, opts) => {
      calls.push(JSON.parse(opts.body));
      return {
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: '{"name":"Dental Practices","naics":"621210","grossMarginPct":55,"sdeMultUnder1M":2.4}' }],
        }),
      };
    },
    loadPageImages: async () => { throw new Error('text PDFs must not be rendered'); },
  });
  const data = JSON.parse(result);
  assert.equal(data.name, 'Dental Practices');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].model, 'claude-opus-4-5');
  assert.equal(typeof calls[0].messages[0].content, 'string');
  assert.match(calls[0].messages[0].content, /Gross profit note 0/);
});

test('an image-only industry PDF is mapped from OCR without calling the model', async () => {
  const result = await extractAnalyzerPdf(Buffer.from('%PDF'), INDUSTRY_PROMPT, {
    readPdfText: async () => ({ text: footerOnly(8), numpages: 8 }),
    loadPageImages: async () => [{ bytes: Buffer.from([0xff, 0xd8]), mediaType: 'image/jpeg' }],
    ocrImages: async () => BRG_FIXTURE,
    fetchImpl: async () => { throw new Error('model should not be called'); },
  });
  const data = JSON.parse(result);
  assert.equal(data.name, 'Roofing Contractors');
  assert.equal(data.sdeMult1to5M, 2.07);
  assert.equal(data.grossMarginPct, 32.8);
});

test('image-only industry extraction that finds nothing returns a clear error', async () => {
  await assert.rejects(
    () => extractAnalyzerPdf(Buffer.from('%PDF'), INDUSTRY_PROMPT, {
      readPdfText: async () => ({ text: footerOnly(4), numpages: 4 }),
      loadPageImages: async () => [],
    }),
    (err) => {
      assert.equal(err.statusCode, 422);
      assert.match(err.message, /almost no selectable text/i);
      return true;
    }
  );
});

test('a text PDF with no text layer still tells the user to upload a searchable file', async () => {
  await assert.rejects(
    () => extractAnalyzerPdf(Buffer.from('%PDF'), TAX_PROMPT, {
      readPdfText: async () => ({ text: '', numpages: 1 }),
    }),
    (err) => {
      assert.equal(err.statusCode, 422);
      assert.match(err.message, /searchable PDF/i);
      return true;
    }
  );
});

test('empty model output does not open a review full of blank fields', async () => {
  const lines = Array.from({ length: 20 }, (_, i) => `Benchmark narrative line ${i} ${5000 + i}`).join('\n');
  process.env.ANTHROPIC_API_KEY = 'test-key';
  await assert.rejects(
    () => extractAnalyzerPdf(Buffer.from('%PDF'), INDUSTRY_PROMPT, {
      readPdfText: async () => ({ text: lines, numpages: 1 }),
      fetchImpl: async () => ({
        ok: true,
        json: async () => ({ content: [{ type: 'text', text: '{"name":null,"source":"Business Brokerage Press 2026","reportYear":2026}' }] }),
      }),
      loadPageImages: async () => { throw new Error('text PDFs must not be rendered'); },
    }),
    (err) => {
      assert.equal(err.statusCode, 422);
      assert.equal(err.message, INDUSTRY_EXTRACT_FAILED);
      return true;
    }
  );
});

function app() {
  const server = express();
  server.use('/api/extract', require('./routes/extract'));
  return server;
}

async function postPdf(buffer, prompt) {
  const server = app();
  const httpServer = await new Promise((resolve) => {
    const listening = server.listen(0, '127.0.0.1', () => resolve(listening));
  });
  try {
    const form = new FormData();
    form.append('prompt', prompt);
    form.append('file', new Blob([buffer], { type: 'application/pdf' }), 'industry.pdf');
    const res = await fetch(`http://127.0.0.1:${httpServer.address().port}/api/extract/pdf`, {
      method: 'POST',
      body: form,
    });
    return { status: res.status, json: await res.json() };
  } finally {
    await new Promise((resolve, reject) => httpServer.close((err) => (err ? reject(err) : resolve())));
  }
}

test('attached Business Reference Guide PDF populates the benchmark form', { timeout: 120000, skip: !process.env.BRG_PDF }, async () => {
  const buffer = fs.readFileSync(process.env.BRG_PDF);
  const images = extractEmbeddedPageJpegs(buffer);
  assert.ok(images.length >= 15, `expected at least 15 page images, got ${images.length}`);
  const previous = global.fetch;
  global.fetch = (url, opts) => {
    if (String(url).startsWith('http://127.0.0.1')) return previous(url, opts);
    throw new Error('text layer was not sparse or OCR mapping failed');
  };
  try {
    const { status, json } = await postPdf(buffer, INDUSTRY_PROMPT);
    assert.equal(status, 200, JSON.stringify(json));
    const data = JSON.parse(json.result);
    assert.equal(data.name, 'Roofing Contractors');
    assert.equal(data.naics, '238160');
    assert.equal(data.source, 'Business Brokerage Press 2026');
    assert.equal(data.reportYear, 2026);
    assert.equal(data.grossMarginPct, 32.8);
    assert.equal(data.cogsPct, 67.2);
    assert.equal(data.preTaxProfitPct, 8);
    assert.equal(data.sdeMultUnder1M, 1.66);
    assert.equal(data.sdeMult1to5M, 2.07);
    assert.equal(data.sdeMultOver5M, 3.31);
    assert.equal(data.ebitdaMultUnder1M, 2.2);
    assert.equal(data.ebitdaMult1to5M, 3.15);
    assert.equal(data.ebitdaMultOver5M, 4.04);
    assert.equal(data.netMarginPct, null);
    assert.equal(data.sdeMult, null);
    assert.equal(industryExtractionIsUseful(data), true);
  } finally {
    global.fetch = previous;
  }
});
