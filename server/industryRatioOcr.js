const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const jpeg = require('jpeg-js');
const { parseFinancialRatios, ratioCellCount } = require('../shared/industryExtras.cjs');

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

function decodeJpeg(buffer) {
  return jpeg.decode(buffer, { useTArray: true, formatAsRGBA: true });
}

function stretchGray(decoded) {
  const { width, height, data } = decoded;
  const gray = new Uint8Array(width * height);
  const hist = new Uint32Array(256);
  for (let p = 0, i = 0; p < gray.length; p += 1, i += 4) {
    const y = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) | 0;
    gray[p] = y;
    hist[y] += 1;
  }
  const cut = gray.length * 0.01;
  let lo = 0;
  let hi = 255;
  let seen = 0;
  for (; lo < 255; lo += 1) {
    seen += hist[lo];
    if (seen > cut) break;
  }
  seen = 0;
  for (; hi > 0; hi -= 1) {
    seen += hist[hi];
    if (seen > cut) break;
  }
  if (hi <= lo) {
    lo = 0;
    hi = 255;
  }
  const span = hi - lo || 1;
  for (let i = 0; i < gray.length; i += 1) {
    gray[i] = Math.max(0, Math.min(255, ((gray[i] - lo) * 255) / span));
  }
  return { gray, width, height };
}

function encodeGrayBilinear(gray, width, height, scale) {
  const nw = width * scale;
  const nh = height * scale;
  const out = Buffer.alloc(nw * nh * 4);
  const at = (x, y) => gray[Math.max(0, Math.min(height - 1, y)) * width + Math.max(0, Math.min(width - 1, x))];
  for (let y = 0; y < nh; y += 1) {
    const sy = (y + 0.5) / scale - 0.5;
    const y0 = Math.floor(sy);
    const dy = sy - y0;
    for (let x = 0; x < nw; x += 1) {
      const sx = (x + 0.5) / scale - 0.5;
      const x0 = Math.floor(sx);
      const dx = sx - x0;
      const v = at(x0, y0) * (1 - dx) * (1 - dy)
        + at(x0 + 1, y0) * dx * (1 - dy)
        + at(x0, y0 + 1) * (1 - dx) * dy
        + at(x0 + 1, y0 + 1) * dx * dy;
      const o = (y * nw + x) * 4;
      const byte = Math.max(0, Math.min(255, Math.round(v)));
      out[o] = byte;
      out[o + 1] = byte;
      out[o + 2] = byte;
      out[o + 3] = 255;
    }
  }
  return jpeg.encode({ data: out, width: nw, height: nh }, 90).data;
}

function encodeGray(gray, width, height, scale) {
  const nw = width * scale;
  const nh = height * scale;
  const out = Buffer.alloc(nw * nh * 4);
  for (let y = 0; y < nh; y += 1) {
    const sy = Math.min(height - 1, (y / scale) | 0);
    const row = sy * width;
    for (let x = 0; x < nw; x += 1) {
      const sx = Math.min(width - 1, (x / scale) | 0);
      const v = gray[row + sx];
      const o = (y * nw + x) * 4;
      out[o] = v;
      out[o + 1] = v;
      out[o + 2] = v;
      out[o + 3] = 255;
    }
  }
  return jpeg.encode({ data: out, width: nw, height: nh }, 85).data;
}

function cropGray(src, width, height, x, y, w, h) {
  const gray = new Uint8Array(w * h);
  for (let row = 0; row < h; row += 1) {
    for (let col = 0; col < w; col += 1) {
      gray[row * w + col] = src[((y + row) * width) + (x + col)];
    }
  }
  return gray;
}

function preprocessJpeg(buffer, scale = 2) {
  const stretched = stretchGray(decodeJpeg(buffer));
  return encodeGray(stretched.gray, stretched.width, stretched.height, scale);
}

function stitchBoundary(prevBuffer, nextBuffer) {
  const topSrc = stretchGray(decodeJpeg(prevBuffer));
  const botSrc = stretchGray(decodeJpeg(nextBuffer));
  const takePrev = Math.min(80, topSrc.height);
  const takeNext = Math.min(50, botSrc.height);
  const width = Math.min(topSrc.width, botSrc.width);
  const gray = new Uint8Array(width * (takePrev + takeNext));
  const prev = cropGray(topSrc.gray, topSrc.width, topSrc.height, 0, topSrc.height - takePrev, width, takePrev);
  const next = cropGray(botSrc.gray, botSrc.width, botSrc.height, 0, 0, width, takeNext);
  gray.set(prev, 0);
  gray.set(next, prev.length);
  return encodeGray(gray, width, takePrev + takeNext, 3);
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
      h: Number(parts[9]) || 20,
      text,
    });
  }
  return words;
}

function wordsToLines(words) {
  const sorted = [...words].sort((a, b) => a.y - b.y || a.x - b.x);
  const lines = [];
  for (const word of sorted) {
    const last = lines[lines.length - 1];
    const tol = Math.max(14, word.h * 0.65);
    if (!last || Math.abs(word.y - last.y) > tol) lines.push({ y: word.y, words: [word] });
    else {
      last.words.push(word);
      last.y = (last.y * last.words.length + word.y) / (last.words.length + 1);
    }
  }
  return lines.map((line) => ({
    y: line.y,
    text: line.words.sort((a, b) => a.x - b.x).map((word) => word.text).join(' '),
  }));
}

async function tesseractLines(jpegBuffer, dir, name) {
  const file = path.join(dir, `${name}.jpg`);
  fs.writeFileSync(file, jpegBuffer);
  const stdout = await execFileAsync('tesseract', [file, 'stdout', '--psm', '6', '-l', 'eng', 'tsv'], {
    timeout: 30000,
    env: { ...process.env, OMP_THREAD_LIMIT: '1', OMP_NUM_THREADS: '1' },
  });
  return wordsToLines(parseTsv(stdout));
}

async function refineCompLines(jpegBuffer, lineObjs, dir, index) {
  const lines = lineObjs.map((line) => line.text);
  const compAt = lineObjs.findIndex((line) => /officer|owner/i.test(line.text) && /comp/i.test(line.text));
  if (compAt < 0) return lines;
  try {
    const stretched = stretchGray(decodeJpeg(jpegBuffer));
    const y = Math.round(lineObjs[compAt].y / 2);
    const top = Math.max(0, y - 8);
    const height = Math.min(110, stretched.height - top);
    const gray = cropGray(stretched.gray, stretched.width, stretched.height, 0, top, stretched.width, height);
    const encoded = encodeGrayBilinear(gray, stretched.width, height, 4);
    const refined = String(await tesseractText(encoded, dir, `comp-${index}`))
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => /\d/.test(line) && /upper|median|lower|officer|comp/i.test(line));
    const upper = refined.find((line) => /upper|officer|comp/i.test(line) && (line.match(/-?\d+(?:\.\d+)?/g) || []).length >= 3);
    if (!upper) return lines;
    const originalNums = lines[compAt].match(/-?\d+(?:\.\d+)?/g) || [];
    const refinedNums = upper.match(/-?\d+(?:\.\d+)?/g) || [];
    const agree = originalNums.filter((n, i) => refinedNums[i] === n).length;
    if (agree < Math.min(2, originalNums.length)) return lines;
    const next = [...lines];
    next[compAt] = upper;
    const median = refined.find((line) => /\bmedian\b/i.test(line));
    const lower = refined.find((line) => /\blower\b/i.test(line));
    if (median && /\bmedian\b/i.test(next[compAt + 1] || '')) next[compAt + 1] = median;
    if (lower && /\blower\b/i.test(next[compAt + 2] || '')) next[compAt + 2] = lower;
    return next;
  } catch (err) {
    console.error('Owner-comp row OCR failed:', err.message);
    return lines;
  }
}

async function tesseractText(jpegBuffer, dir, name) {
  const file = path.join(dir, `${name}.jpg`);
  fs.writeFileSync(file, jpegBuffer);
  const stdout = await execFileAsync('tesseract', [file, 'stdout', '--psm', '6', '-l', 'eng'], {
    timeout: 30000,
    env: { ...process.env, OMP_THREAD_LIMIT: '1', OMP_NUM_THREADS: '1' },
  });
  return String(stdout || '');
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

function assembleRatioText(pageLines, stitchText) {
  const lines = pageLines.flat().map((line) => String(line || '').trim()).filter(Boolean);
  const start = lines.findIndex((line) => (
    /quartile/i.test(line) || (/\b(upper|median|lower)\b/i.test(line) && /\d/.test(line))
  ));
  const sliced = start >= 0 ? lines.slice(start) : lines;
  const yearLine = lines.find((line) => (line.match(/20\d{2}\s*[-–—]\s*\d{2}/g) || []).length >= 2 && !/\b(upper|median|lower)\b/i.test(line));
  const stitchLines = String(stitchText || '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /current/i.test(line) && /upper/i.test(line) && /\d/.test(line));
  const hasCurrentUpper = sliced.some((line) => /current/i.test(line) && /upper/i.test(line));
  const extra = hasCurrentUpper ? [] : stitchLines;
  return [
    'Ratios (providing the upper quartile, median, and lower quartile values)',
    yearLine || '',
    ...extra,
    ...sliced.filter((line) => line !== yearLine),
    'Type of Statement',
  ].filter(Boolean).join('\n');
}

async function readFinancialRatiosFromImages(images, pageTexts = []) {
  if (!images || !images.length) return null;
  if (!(await systemTesseractAvailable())) return null;
  const indexes = ratioPageIndexes(pageTexts, images.length);
  if (!indexes.length) return null;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pacq-ratio-'));
  try {
    const pageLines = [];
    const stitchChunks = [];
    for (const index of indexes) {
      const prepared = preprocessJpeg(images[index].bytes, 2);
      const lineObjs = await tesseractLines(prepared, dir, `p${index}`);
      const lines = await refineCompLines(images[index].bytes, lineObjs, dir, index);
      pageLines.push(lines);
      if (index > 0) {
        try {
          const stitch = stitchBoundary(images[index - 1].bytes, images[index].bytes);
          stitchChunks.push(await tesseractText(stitch, dir, `stitch-${index}`));
        } catch (err) {
          console.error('Ratio boundary OCR failed:', err.message);
        }
      }
    }
    const stitchText = stitchChunks.join('\n');
    const text = assembleRatioText(pageLines, stitchText);
    if (process.env.RATIO_DEBUG) fs.writeFileSync(process.env.RATIO_DEBUG, text);
    const parsed = parseFinancialRatios(text);
    return ratioCellCount(parsed) >= 12 ? parsed : null;
  } catch (err) {
    console.error('Financial ratio OCR failed:', err.message);
    return null;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

module.exports = {
  readFinancialRatiosFromImages,
  ratioPageIndexes,
  assembleRatioText,
  preprocessJpeg,
};
