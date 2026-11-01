const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const sharp = require('sharp');
const { parseFinancialRatios, ratioCellCount } = require('../shared/industryExtras.cjs');

sharp.cache(false);
sharp.concurrency(1);

const TARGET_DPI = 200;
const LETTER_SHORT_IN = 8.5;
const LETTER_LONG_IN = 11;
const MAX_UPSCALE = 1.5;
const SOURCE_MAX_EDGE = Math.round(LETTER_LONG_IN * TARGET_DPI);
const SOURCE_MAX_SHORT = Math.round(LETTER_SHORT_IN * TARGET_DPI);
const OUTPUT_MAX_EDGE = Math.round(SOURCE_MAX_EDGE * MAX_UPSCALE);
const OUTPUT_MAX_PIXELS = Math.round(SOURCE_MAX_SHORT * MAX_UPSCALE) * OUTPUT_MAX_EDGE;
const INPUT_PIXEL_LIMIT = 48_000_000;
const RSS_SKIP_BYTES = 300 * 1024 * 1024;
const STITCH_PREV_FRAC = 80 / 1734;
const STITCH_NEXT_FRAC = 50 / 1734;
const RATIO_GRID_THRESHOLD = 170;

function execFileAsync(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: 25000, maxBuffer: 8 * 1024 * 1024, ...options }, (err, stdout, stderr) => {
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

function ratioRssLimit() {
  const mb = Number(process.env.RATIO_RSS_LIMIT_MB);
  if (Number.isFinite(mb) && mb > 0) return mb * 1024 * 1024;
  return RSS_SKIP_BYTES;
}

function ratioStepBlocked() {
  const rss = process.memoryUsage().rss;
  const limit = ratioRssLimit();
  if (rss > limit) {
    console.error(`[extract/pdf] skipping financial ratio OCR; RSS ${Math.round(rss / 1024 / 1024)} MiB`);
    return true;
  }
  return false;
}

function releaseImage(image) {
  if (image && image.bytes) image.bytes = null;
}

function sourceCap(width, height) {
  const portrait = !width || !height || height >= width;
  const maxW = portrait ? SOURCE_MAX_SHORT : SOURCE_MAX_EDGE;
  const maxH = portrait ? SOURCE_MAX_EDGE : SOURCE_MAX_SHORT;
  if (!width || !height) return { width: maxW, height: maxH, scale: 1 };
  const scale = Math.min(1, maxW / width, maxH / height, SOURCE_MAX_EDGE / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    scale,
  };
}

function upscaleFor(width, height) {
  if (!width || !height) return 1;
  const fit = Math.min(
    MAX_UPSCALE,
    OUTPUT_MAX_EDGE / Math.max(width, height),
    Math.sqrt(OUTPUT_MAX_PIXELS / (width * height))
  );
  if (!Number.isFinite(fit) || fit < 1) return 1;
  return fit;
}

function sharpInput(input) {
  return sharp(input, {
    failOn: 'none',
    sequentialRead: true,
    limitInputPixels: INPUT_PIXEL_LIMIT,
    animated: false,
  });
}

async function materializeCapped(image, dest) {
  const width = Number(image.width) || 0;
  const height = Number(image.height) || 0;
  if (!image.bytes || !image.bytes.length) {
    throw new Error('page image is empty');
  }
  if (width && height && sourceCap(width, height).scale >= 0.999) {
    fs.writeFileSync(dest, image.bytes);
    return { width, height, resized: false };
  }
  const meta = await sharpInput(image.bytes).metadata();
  const cap = sourceCap(meta.width || width, meta.height || height);
  if (!meta.width || !meta.height || cap.scale >= 0.999) {
    fs.writeFileSync(dest, image.bytes);
    image.width = meta.width || width;
    image.height = meta.height || height;
    return { width: image.width, height: image.height, resized: false };
  }
  await sharpInput(image.bytes)
    .resize({ width: cap.width, height: cap.height, fit: 'fill', withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toFile(dest);
  console.log(`[extract/pdf] downscaled page to ${cap.width}x${cap.height}`);
  image.width = cap.width;
  image.height = cap.height;
  return { width: cap.width, height: cap.height, resized: true };
}

async function preparePageFiles(images, dir) {
  for (let index = 0; index < images.length; index += 1) {
    const image = images[index];
    if (!image || !image.bytes || !image.bytes.length) continue;
    const dest = path.join(dir, `page-${String(index).padStart(2, '0')}.jpg`);
    try {
      await materializeCapped(image, dest);
      image.file = dest;
      releaseImage(image);
    } catch (err) {
      console.error('Page image cap failed:', err.message);
      const pixels = (Number(image.width) || 0) * (Number(image.height) || 0);
      if (pixels > OUTPUT_MAX_PIXELS) releaseImage(image);
    }
  }
}

function parseTsv(stdout) {
  const words = [];
  const lines = String(stdout || '').split(/\n/);
  for (let i = 1; i < lines.length; i += 1) {
    const parts = lines[i].split('\t');
    if (parts.length < 12) continue;
    const text = parts[11].trim();
    if (!text) continue;
    const conf = Number(parts[10]);
    if (!Number.isFinite(conf) || conf < 0) continue;
    words.push({
      x: Number(parts[6]),
      y: Number(parts[7]),
      w: Number(parts[8]) || 0,
      h: Number(parts[9]) || 20,
      text,
    });
  }
  return words;
}

function tableBox(words, width, height) {
  const hits = words.filter((word) => /ratio|quartile|ebit|debt|worth|receiv|inventor|payable|officer|comp|depre|amort|sales\s*\/|fixed\s*\/|quick/i.test(word.text));
  if (hits.length < 5 || !width || !height) return null;
  // Keep the top of the page. A row split across the previous page sits in the
  // first lines, and a text-only pass often misses those words.
  const header = words.filter((word) => /ratios|quartile/i.test(word.text));
  const top = header.length
    ? Math.max(0, Math.min(...header.map((word) => word.y)) - 80)
    : 0;
  const bottom = Math.min(height, Math.max(...hits.map((word) => word.y + word.h)) + 72);
  const boxHeight = bottom - top;
  if (boxHeight < 80 || boxHeight > height * 0.92) return null;
  return { left: 0, top, width, height: boxHeight };
}

function tesseractEnv() {
  return { ...process.env, OMP_THREAD_LIMIT: '1', OMP_NUM_THREADS: '1' };
}

async function tesseractText(file) {
  const stdout = await execFileAsync('tesseract', [file, 'stdout', '-l', 'eng', '--psm', '6'], {
    timeout: 30000,
    env: tesseractEnv(),
  });
  return String(stdout || '');
}

async function tesseractTsv(file) {
  const stdout = await execFileAsync('tesseract', [file, 'stdout', '-l', 'eng', '--psm', '6', 'tsv'], {
    timeout: 30000,
    env: tesseractEnv(),
  });
  return parseTsv(stdout);
}

async function renderRatioRaster(source, dest, box) {
  const meta = await sharpInput(source).metadata();
  const width = meta.width || 0;
  const height = meta.height || 0;
  const top = box ? Math.max(0, Math.min(height - 1, box.top)) : 0;
  const cropWidth = width;
  const cropHeight = box ? Math.max(1, Math.min(height - top, box.height)) : height;
  const scale = upscaleFor(cropWidth, cropHeight);
  let pipeline = sharpInput(source).extract({ left: 0, top, width: cropWidth, height: cropHeight }).grayscale().normalise();
  if (scale > 1.01) {
    pipeline = pipeline.resize({
      width: Math.max(1, Math.round(cropWidth * scale)),
      height: Math.max(1, Math.round(cropHeight * scale)),
      kernel: 'lanczos3',
      fit: 'fill',
    });
  }
  await pipeline.threshold(RATIO_GRID_THRESHOLD).jpeg({ quality: 90 }).toFile(dest);
}

function quartileLineCount(text) {
  return String(text || '').split('\n').filter((line) => /\b(upper|median|lower)\b/i.test(line) && /\d/.test(line)).length;
}

async function writeStitch(prevFile, nextFile, dest) {
  const topMeta = await sharpInput(prevFile).metadata();
  const botMeta = await sharpInput(nextFile).metadata();
  const width = Math.min(topMeta.width || 0, botMeta.width || 0);
  const takePrev = Math.min(topMeta.height || 0, Math.max(24, Math.round((topMeta.height || 0) * STITCH_PREV_FRAC)));
  const takeNext = Math.min(botMeta.height || 0, Math.max(20, Math.round((botMeta.height || 0) * STITCH_NEXT_FRAC)));
  if (!width || takePrev < 8 || takeNext < 8) throw new Error('page boundary is too small to stitch');
  const prev = await sharpInput(prevFile)
    .extract({ left: 0, top: (topMeta.height || takePrev) - takePrev, width, height: takePrev })
    .grayscale()
    .normalise()
    .toBuffer();
  const next = await sharpInput(nextFile)
    .extract({ left: 0, top: 0, width, height: takeNext })
    .grayscale()
    .normalise()
    .toBuffer();
  const scale = upscaleFor(width, takePrev + takeNext);
  await sharp({
    create: {
      width,
      height: takePrev + takeNext,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .composite([
      { input: prev, top: 0, left: 0 },
      { input: next, top: takePrev, left: 0 },
    ])
    .resize({
      width: Math.max(1, Math.round(width * scale)),
      height: Math.max(1, Math.round((takePrev + takeNext) * scale)),
      kernel: 'nearest',
      fit: 'fill',
    })
    .jpeg({ quality: 90 })
    .toFile(dest);
}

function anchorDecimals(line) {
  if (!/\b(upper|median|lower)\b/i.test(line)) return line;
  const tokens = line.match(/-?\d+(?:\.\d+)?/g);
  if (!tokens || tokens.length < 2) return line;
  const values = tokens.map(Number);
  const small = values.filter((value) => Math.abs(value) < 10);
  if (!small.length) return line;
  const mid = [...small].sort((a, b) => a - b)[Math.floor(small.length / 2)];
  let index = 0;
  return line.replace(/-?\d+(?:\.\d+)?/g, (token) => {
    const value = values[index];
    index += 1;
    if (!Number.isInteger(value) || Math.abs(value) < 10) return token;
    const scaled = Math.round(value) / 10;
    const near = Math.abs(scaled - mid) < Math.abs(value - mid);
    if (near && Math.abs(scaled) <= Math.max(1, Math.abs(mid) * 8)) return String(scaled);
    return token;
  });
}

function normalizeRatioLine(line) {
  return anchorDecimals(String(line || '').trim().replace(/^[CO0Q]urrent\b/i, 'Current'));
}

function ratioPageIndexes(pageTexts, imageCount) {
  const hits = [];
  pageTexts.forEach((text, index) => {
    if (/ratios|quartile|ebit\s*\/\s*interest|debt\s*\/\s*worth|sales\s*\/\s*receivables|ebitda\s*\/\s*sales/i.test(text || '')) {
      hits.push(index);
    }
  });
  if (!hits.length) return [];
  const set = new Set();
  for (const index of hits) {
    for (const near of [index - 1, index, index + 1]) {
      if (near >= 0 && near < imageCount) set.add(near);
    }
  }
  return [...set].sort((a, b) => a - b);
}

function dropSandwichedNoise(lines) {
  const out = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const prev = out[out.length - 1] || '';
    const next = lines[i + 1] || '';
    const noise = !/\d/.test(line) && !/\b(upper|median|lower|quartile)\b/i.test(line);
    const prevRow = /\b(upper|median|lower)\b/i.test(prev) && /\d/.test(prev);
    const nextRow = /\b(median|lower)\b/i.test(next) && /\d/.test(next);
    if (noise && prevRow && nextRow) continue;
    out.push(line);
  }
  return out;
}

function assembleRatioText(pageLines, stitchText) {
  const lines = pageLines.flat().map(normalizeRatioLine).filter(Boolean);
  const start = lines.findIndex((line) => (
    /quartile/i.test(line) || (/\b(upper|median|lower)\b/i.test(line) && /\d/.test(line))
  ));
  const sliced = start >= 0 ? lines.slice(start) : lines;
  const yearLine = lines.find((line) => (line.match(/20\d{2}\s*[-–—]\s*\d{2}/g) || []).length >= 2 && !/\b(upper|median|lower)\b/i.test(line));
  const stitchLines = String(stitchText || '')
    .split('\n')
    .map(normalizeRatioLine)
    .filter((line) => /current/i.test(line) && /upper/i.test(line) && /\d/.test(line));
  const hasCurrentUpper = sliced.some((line) => /current/i.test(line) && /upper/i.test(line));
  const extra = hasCurrentUpper ? [] : stitchLines;
  const body = dropSandwichedNoise(sliced.filter((line) => line !== yearLine));
  return [
    'Ratios (providing the upper quartile, median, and lower quartile values)',
    yearLine || '',
    ...extra,
    ...body,
    'Type of Statement',
  ].filter(Boolean).join('\n');
}

async function readFinancialRatiosFromImages(images, pageTexts = []) {
  if (!images || !images.length) return null;
  try {
    if (!(await systemTesseractAvailable())) return null;
    if (ratioStepBlocked()) return null;
    const indexes = ratioPageIndexes(pageTexts, images.length);
    if (!indexes.length) return null;
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pacq-ratio-'));
    try {
      const needed = new Set();
      for (const index of indexes) {
        needed.add(index);
        if (index > 0) needed.add(index - 1);
      }
      images.forEach((image, index) => {
        if (!needed.has(index)) releaseImage(image);
      });
      for (const index of [...needed].sort((a, b) => a - b)) {
        const image = images[index];
        if (!image || image.file) continue;
        if (!image.bytes) continue;
        const dest = path.join(dir, `src-${index}.jpg`);
        await materializeCapped(image, dest);
        image.file = dest;
        releaseImage(image);
      }

      const pageLines = [];
      const stitchChunks = [];
      for (const index of indexes) {
        if (ratioStepBlocked()) break;
        const image = images[index];
        const source = image && image.file;
        if (!source) continue;
        try {
          const words = await tesseractTsv(source);
          const meta = await sharpInput(source).metadata();
          const box = tableBox(words, meta.width || 0, meta.height || 0);
          const ocrFile = path.join(dir, `ocr-${index}.jpg`);
          await renderRatioRaster(source, ocrFile, box);
          let text = await tesseractText(ocrFile);
          if (box && quartileLineCount(text) < 4) {
            await renderRatioRaster(source, ocrFile, null);
            text = await tesseractText(ocrFile);
          }
          pageLines.push(text.split('\n'));
        } catch (err) {
          console.error('Financial ratio page OCR failed:', err.message);
          pageLines.push([]);
        }
        if (index > 0 && images[index - 1] && images[index - 1].file && source) {
          try {
            const stitch = path.join(dir, `stitch-${index}.jpg`);
            await writeStitch(images[index - 1].file, source, stitch);
            stitchChunks.push(await tesseractText(stitch));
          } catch (err) {
            console.error('Ratio boundary OCR failed:', err.message);
          }
        }
        releaseImage(images[index - 1]);
        releaseImage(image);
      }
      const text = assembleRatioText(pageLines, stitchChunks.join('\n'));
      if (process.env.RATIO_DEBUG) fs.writeFileSync(process.env.RATIO_DEBUG, text);
      const parsed = parseFinancialRatios(text);
      return ratioCellCount(parsed) >= 12 ? parsed : null;
    } finally {
      images.forEach(releaseImage);
      fs.rmSync(dir, { recursive: true, force: true });
    }
  } catch (err) {
    console.error('Financial ratio OCR failed:', err.message);
    return null;
  }
}

module.exports = {
  readFinancialRatiosFromImages,
  ratioPageIndexes,
  assembleRatioText,
  preparePageFiles,
  ratioStepBlocked,
  sourceCap,
  upscaleFor,
  MAX_UPSCALE,
  releaseImage,
};
