const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const pdfParse = require('pdf-parse/lib/pdf-parse.js');
const {
  INDUSTRY_EXTRACT_FAILED,
  isIndustryPrompt,
  pdfTextIsSparse,
  industryExtractionIsUseful,
  parseBrgIndustryReport,
} = require('../shared/industryBenchmarks.cjs');

const MAX_PAGES = 20;
const MAX_TEXT_CHARS = 120000;
const TEXT_MODEL = 'claude-opus-4-5';
const VISION_MODEL = 'claude-sonnet-4-6';
const MIN_PAGE_PX = 400;

function fail(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function execFileAsync(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: 25000, maxBuffer: 4 * 1024 * 1024, ...options }, (err, stdout, stderr) => {
      if (err) {
        err.stderr = stderr;
        reject(err);
        return;
      }
      resolve(stdout || '');
    });
  });
}

let tesseractAvailable;
function systemTesseractAvailable() {
  if (tesseractAvailable !== undefined) return Promise.resolve(tesseractAvailable);
  tesseractAvailable = execFileAsync('tesseract', ['--version'], { timeout: 4000 })
    .then(() => true)
    .catch(() => false);
  return tesseractAvailable;
}

let pdftoppmAvailable;
function pdftoppmIsAvailable() {
  if (pdftoppmAvailable !== undefined) return Promise.resolve(pdftoppmAvailable);
  pdftoppmAvailable = execFileAsync('pdftoppm', ['-v'], { timeout: 4000 })
    .then(() => true)
    .catch(() => false);
  return pdftoppmAvailable;
}

function extractEmbeddedPageJpegs(buffer) {
  const data = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const images = [];
  let from = 0;
  while (from < data.length) {
    const idx = data.indexOf('/Subtype', from);
    if (idx < 0) break;
    const window = data.subarray(idx, Math.min(data.length, idx + 32)).toString('latin1');
    if (!/^\/Subtype\s*\/Image\b/.test(window)) {
      from = idx + 8;
      continue;
    }
    const dictStart = data.lastIndexOf('<<', idx);
    const dictEnd = data.indexOf('>>', idx);
    if (dictStart < 0 || dictEnd < 0 || idx - dictStart > 2500) {
      from = idx + 8;
      continue;
    }
    const dict = data.subarray(dictStart, dictEnd + 2).toString('latin1');
    from = dictEnd + 2;
    if (!/\/Filter\s*(?:\/DCTDecode|\[\s*\/DCTDecode\s*\])/.test(dict)) continue;
    const width = Number((dict.match(/\/Width\s+(\d+)/) || [])[1] || 0);
    const height = Number((dict.match(/\/Height\s+(\d+)/) || [])[1] || 0);
    const length = Number((dict.match(/\/Length\s+(\d+)/) || [])[1] || 0);
    if (!length || width < MIN_PAGE_PX || height < MIN_PAGE_PX) continue;
    const streamAt = data.indexOf('stream', dictEnd);
    if (streamAt < 0 || streamAt > dictEnd + 20) continue;
    let start = streamAt + 6;
    if (data[start] === 13 && data[start + 1] === 10) start += 2;
    else if (data[start] === 10 || data[start] === 13) start += 1;
    const bytes = data.subarray(start, start + length);
    if (bytes.length !== length || bytes[0] !== 0xff || bytes[1] !== 0xd8) continue;
    images.push({ bytes: Buffer.from(bytes), mediaType: 'image/jpeg', width, height });
    from = start + length;
  }
  return images.slice(0, MAX_PAGES);
}

async function renderWithPdftoppm(buffer) {
  if (!(await pdftoppmIsAvailable())) return [];
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pacq-pdf-'));
  try {
    const pdfPath = path.join(dir, 'in.pdf');
    fs.writeFileSync(pdfPath, buffer);
    await execFileAsync('pdftoppm', [
      '-jpeg', '-r', '120', '-f', '1', '-l', String(MAX_PAGES),
      pdfPath, path.join(dir, 'page'),
    ], { timeout: 45000 });
    return fs.readdirSync(dir)
      .filter((name) => name.endsWith('.jpg'))
      .sort()
      .map((name) => ({
        bytes: fs.readFileSync(path.join(dir, name)),
        mediaType: 'image/jpeg',
      }));
  } catch (err) {
    console.error('pdftoppm failed:', err.message);
    return [];
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

async function loadPageImages(buffer) {
  const embedded = extractEmbeddedPageJpegs(buffer);
  if (embedded.length) return embedded;
  return renderWithPdftoppm(buffer);
}

async function mapPool(items, limit, fn) {
  const out = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      out[index] = await fn(items[index], index);
    }
  }
  const workers = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: workers }, worker));
  return out;
}

async function ocrWithSystemTesseract(images) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pacq-ocr-'));
  try {
    const files = images.map((image, index) => {
      const file = path.join(dir, `page-${String(index).padStart(2, '0')}.jpg`);
      fs.writeFileSync(file, image.bytes);
      return file;
    });
    const texts = await mapPool(files, 4, (file) => execFileAsync(
      'tesseract',
      [file, 'stdout', '--psm', '6', '-l', 'eng'],
      {
        timeout: 20000,
        env: { ...process.env, OMP_THREAD_LIMIT: '1', OMP_NUM_THREADS: '1' },
      }
    ));
    return texts.join('\n\n');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

async function ocrWithTesseractJs(images) {
  const { createWorker } = require('tesseract.js');
  const workerCount = Math.min(2, images.length);
  const workers = await Promise.all(Array.from({ length: workerCount }, () => createWorker('eng', 1, {
    cachePath: path.join(os.tmpdir(), 'pacq-tesseract'),
    logger: () => {},
  })));
  try {
    let cursor = 0;
    const texts = new Array(images.length);
    async function run(worker) {
      while (cursor < images.length) {
        const index = cursor;
        cursor += 1;
        const result = await worker.recognize(images[index].bytes);
        texts[index] = result?.data?.text || '';
      }
    }
    await Promise.all(workers.map(run));
    return texts.join('\n\n');
  } finally {
    await Promise.all(workers.map((worker) => worker.terminate().catch(() => {})));
  }
}

async function ocrPageImages(images) {
  if (!images.length) return '';
  try {
    if (await systemTesseractAvailable()) return await ocrWithSystemTesseract(images);
    return await ocrWithTesseractJs(images);
  } catch (err) {
    console.error('Industry PDF OCR failed:', err.message);
    return '';
  }
}

function stripFences(raw) {
  return String(raw || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
}

function truncate(text) {
  return text.length > MAX_TEXT_CHARS
    ? text.slice(0, MAX_TEXT_CHARS) + '\n\n[Document truncated — first 120,000 characters used]'
    : text;
}

async function anthropicMessage(body, fetchImpl, timeoutMs) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw fail(500, 'ANTHROPIC_API_KEY not configured on server.');
  let upstream;
  try {
    upstream = await fetchImpl('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      throw fail(500, 'Extraction timed out. Please retry.');
    }
    throw err;
  }
  if (!upstream.ok) {
    const errBody = await upstream.json().catch(() => ({}));
    throw fail(upstream.status, errBody.error?.message || `Anthropic error ${upstream.status}`);
  }
  const data = await upstream.json();
  return stripFences((data.content || []).find((block) => block.type === 'text')?.text || '');
}

function completeFromText(prompt, pdfText, fetchImpl) {
  return anthropicMessage({
    model: TEXT_MODEL,
    max_tokens: 2048,
    messages: [{
      role: 'user',
      content: `${prompt}\n\n<document>\n${truncate(pdfText)}\n</document>`,
    }],
  }, fetchImpl, 120000);
}

function completeFromImages(prompt, images, fetchImpl) {
  const selected = [];
  let bytes = 0;
  for (const image of images) {
    if (selected.length >= 16) break;
    if (bytes + image.bytes.length > 8 * 1024 * 1024) break;
    selected.push(image);
    bytes += image.bytes.length;
  }
  return anthropicMessage({
    model: VISION_MODEL,
    max_tokens: 2048,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'text',
          text: `${prompt}\n\nThe PDF text layer is empty. The attached images are the report pages in order. Read the tables and return the JSON.`,
        },
        ...selected.map((image) => ({
          type: 'image',
          source: {
            type: 'base64',
            media_type: image.mediaType || 'image/jpeg',
            data: image.bytes.toString('base64'),
          },
        })),
      ],
    }],
  }, fetchImpl, 90000);
}

function gateIndustryResult(prompt, modelText) {
  if (!isIndustryPrompt(prompt)) return modelText;
  let parsed;
  try {
    parsed = JSON.parse(modelText);
  } catch {
    throw fail(422, INDUSTRY_EXTRACT_FAILED);
  }
  if (!industryExtractionIsUseful(parsed)) throw fail(422, INDUSTRY_EXTRACT_FAILED);
  return modelText;
}

async function extractAnalyzerPdf(buffer, prompt, options = {}) {
  const fetchImpl = options.fetchImpl || ((...args) => fetch(...args));
  const readImages = options.loadPageImages || loadPageImages;
  const readText = options.ocrImages || ocrPageImages;

  let pdfText = '';
  let numpages = 1;
  try {
    const parsed = options.readPdfText
      ? await options.readPdfText(buffer)
      : await pdfParse(buffer);
    pdfText = (parsed.text || '').trim();
    numpages = parsed.numpages || 1;
  } catch (err) {
    if (!isIndustryPrompt(prompt)) {
      throw fail(422, 'Could not extract text from PDF. The file may be scanned/image-only. Try a searchable PDF.');
    }
  }

  const sparse = pdfTextIsSparse(pdfText, numpages);
  if (!isIndustryPrompt(prompt) || !sparse) {
    if (!pdfText) {
      throw fail(422, 'Could not extract text from PDF. The file may be scanned/image-only. Try a searchable PDF.');
    }
    const modelText = await completeFromText(prompt, pdfText, fetchImpl);
    return gateIndustryResult(prompt, modelText);
  }

  const images = await readImages(buffer);
  if (!images.length) {
    throw fail(422, 'This PDF has almost no selectable text, and its pages could not be read as images. Upload a text-based report or enter the benchmarks manually.');
  }

  const ocrText = await readText(images);
  const combined = [pdfText, ocrText].filter((part) => part && part.trim()).join('\n\n');
  const parsed = parseBrgIndustryReport(combined);
  if (parsed) {
    console.log(`[extract/pdf] image-only industry report: ${images.length} page image(s), mapped from OCR`);
    return JSON.stringify(parsed);
  }
  if (ocrText && !pdfTextIsSparse(ocrText, images.length)) {
    console.log(`[extract/pdf] image-only industry report: sending ${ocrText.length} OCR chars to the text model`);
    const modelText = await completeFromText(prompt, combined, fetchImpl);
    return gateIndustryResult(prompt, modelText);
  }
  console.log(`[extract/pdf] image-only industry report: vision fallback for ${images.length} page(s)`);
  const visionText = await completeFromImages(prompt, images, fetchImpl);
  return gateIndustryResult(prompt, visionText);
}

module.exports = {
  extractAnalyzerPdf,
  extractEmbeddedPageJpegs,
  loadPageImages,
  ocrPageImages,
  MAX_PAGES,
};
