'use strict';

/**
 * Letter-size page fit for the flyer and CBR.
 * Content is shortened or moved onto a continuation page before anything
 * is allowed to paint past the bottom edge. overflow:hidden is only a
 * backstop after that split — it is not how extra copy is "handled".
 */

const VOID_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link',
  'meta', 'param', 'source', 'track', 'wbr',
]);

const FIT_MARKER = 'data-pacq-page-fit';

const CBR_FIT_CSS = `
@page { size: 8.5in 11in; margin: 0; }
.content-page, .section-divider {
  height: 11in;
  max-height: 11in;
  overflow: hidden;
  box-sizing: border-box;
}
.content-page { display: flex; flex-direction: column; }
.content-page .content-body { flex: 1; min-height: 0; display: flex; overflow: hidden; }
.content-page .main-col { min-height: 0; min-width: 0; }
.content-page .sidebar { min-height: 0; overflow: hidden; }
.content-page .page-footer { flex-shrink: 0; margin-top: auto; }
.content-page.tight p { font-size: 13px; line-height: 1.4; margin-bottom: 6px; }
.content-page.tight .section-block { margin-bottom: 12px; }
.content-page.tight li { font-size: 13px; line-height: 1.35; padding-top: 2px; padding-bottom: 2px; }
.content-page.fit-step-1 p, .content-page.fit-step-1 li { font-size: 12px; line-height: 1.3; }
.content-page.fit-step-2 p, .content-page.fit-step-2 li { font-size: 11px; line-height: 1.25; }
.content-page.fit-step-2 .page-title { font-size: 22px; }
.section-divider { break-before: page; }
`;

const FLYER_FIT_CSS = `
@page { size: 8.5in 11in; margin: 0; }
html, body { width: 8.5in; height: 11in; margin: 0; padding: 0; }
.page { width: 8.5in; height: 11in; max-height: 11in; overflow: hidden; display: flex; flex-direction: column; }
.page ul li { line-height: 1.3; }
.page.fit-step-1 ul li, .page.fit-step-1 .hero-desc { font-size: 10px; line-height: 1.25; }
.page.fit-step-2 ul li { font-size: 9px; line-height: 1.2; }
`;

function stripTags(html) {
  return String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function findClassElements(html, className) {
  const re = /<\/?([a-zA-Z][\w:-]*)([^>]*)>/g;
  const found = [];
  const stack = [];
  let match;
  while ((match = re.exec(html))) {
    const raw = match[0];
    const tag = match[1].toLowerCase();
    const attrs = match[2] || '';
    const closing = raw.startsWith('</');
    if (closing) {
      for (let i = stack.length - 1; i >= 0; i -= 1) {
        if (stack[i].tag !== tag) continue;
        const el = stack.splice(i, 1)[0];
        if (el.capture) {
          el.end = re.lastIndex;
          found.push(el);
        }
        break;
      }
      continue;
    }
    const selfClosing = /\/\s*$/.test(attrs) || VOID_TAGS.has(tag);
    const classMatch = attrs.match(/\bclass\s*=\s*("([^"]*)"|'([^']*)')/i);
    const classValue = classMatch ? (classMatch[2] || classMatch[3] || '') : '';
    const capture = classValue.split(/\s+/).includes(className);
    if (!selfClosing) {
      stack.push({ tag, start: match.index, capture, end: null });
    }
  }
  return found
    .filter((el) => Number.isInteger(el.end))
    .map((el) => ({
      tag: el.tag,
      start: el.start,
      end: el.end,
      html: html.slice(el.start, el.end),
    }));
}

function addClassToken(html, className, extra) {
  const re = new RegExp(
    `(<[a-zA-Z][\\w:-]*[^>]*\\bclass\\s*=\\s*")([^"]*\\b${className}\\b[^"]*)(")`,
    'i'
  );
  return html.replace(re, (full, open, classes, close) => {
    if (classes.split(/\s+/).includes(extra)) return full;
    return `${open}${classes} ${extra}${close}`;
  });
}

function continuationPage(originalPage, blocksHtml) {
  let shell = addClassToken(originalPage, 'content-page', 'tight');
  const blocks = findClassElements(shell, 'section-block');
  for (let i = blocks.length - 1; i >= 0; i -= 1) {
    shell = shell.slice(0, blocks[i].start) + shell.slice(blocks[i].end);
  }
  const main = findClassElements(shell, 'main-col')[0];
  if (!main) {
    return `<div class="content-page tight"><div class="content-body"><div class="main-col">${blocksHtml}</div></div></div>`;
  }
  const at = main.end - `</${main.tag}>`.length;
  shell = shell.slice(0, at) + blocksHtml + shell.slice(at);
  return shell.replace(
    /(<[^>]*class="[^"]*\bpage-title\b[^"]*"[^>]*>)([\s\S]*?)(<\/)/,
    (full, open, text, close) => (
      /continued/i.test(text) ? full : `${open}${text} (continued)${close}`
    )
  );
}

function splitOneContentPage(pageHtml) {
  let current = stripTags(pageHtml).length > 2200
    ? addClassToken(pageHtml, 'content-page', 'tight')
    : pageHtml;
  const removed = [];
  while (true) {
    const blocks = findClassElements(current, 'section-block');
    if (blocks.length < 2 || stripTags(current).length <= 2000) break;
    const last = blocks[blocks.length - 1];
    removed.unshift(current.slice(last.start, last.end));
    current = current.slice(0, last.start) + current.slice(last.end);
  }
  if (!removed.length) return [current];
  return [current, continuationPage(pageHtml, removed.join('\n'))];
}

function splitLongContentPages(html) {
  const pages = findClassElements(html, 'content-page');
  if (!pages.length) return html;
  let out = html;
  for (let i = pages.length - 1; i >= 0; i -= 1) {
    const page = pages[i];
    const parts = splitOneContentPage(out.slice(page.start, page.end));
    if (parts.length === 1 && parts[0] === out.slice(page.start, page.end)) continue;
    out = out.slice(0, page.start) + parts.join('\n') + out.slice(page.end);
  }
  return out;
}

function injectFitCss(html, kind) {
  if (!html || html.includes(FIT_MARKER)) return html;
  const css = kind === 'flyer' ? FLYER_FIT_CSS : CBR_FIT_CSS;
  const tag = `<style ${FIT_MARKER}="1">${css}</style>`;
  if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, `${tag}</head>`);
  return `${tag}${html}`;
}

function prepareMarketingHtml(html, kind) {
  if (!html) return html;
  let out = injectFitCss(html, kind);
  if (kind === 'cbr') out = splitLongContentPages(out);
  return out;
}

function applyTightenStep(html, step) {
  const token = `fit-step-${step}`;
  let out = html;
  if (html.includes('class="content-page') || html.includes("class='content-page")) {
    out = out.replace(
      /(<[^>]*\bclass\s*=\s*")([^"]*\bcontent-page\b[^"]*)(")/gi,
      (full, open, classes, close) => (
        classes.split(/\s+/).includes(token) ? full : `${open}${classes} ${token}${close}`
      )
    );
  }
  if (html.includes('class="page') || html.includes("class='page")) {
    out = out.replace(
      /(<[^>]*\bclass\s*=\s*")([^"]*\bpage\b[^"]*)(")/gi,
      (full, open, classes, close) => {
        const names = classes.split(/\s+/);
        if (names.includes('content-page') || names.includes('page-title') || names.includes('page-footer')) return full;
        if (!names.includes('page') || names.includes(token)) return full;
        return `${open}${classes} ${token}${close}`;
      }
    );
  }
  return out;
}

function hasPrintPages(html) {
  return /class\s*=\s*["'][^"']*\b(content-page|section-divider|page)\b/.test(String(html || ''));
}

async function measureOverflow(html) {
  const puppeteer = require('puppeteer');
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 816, height: 1056, deviceScaleFactor: 1 });
    await page.emulateMediaType('print');
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 20000 });
    const measured = await page.evaluate(() => {
      const nodes = [...document.querySelectorAll('.content-page, .section-divider, .page')];
      return nodes
        .filter((el) => el.classList.contains('content-page') || el.classList.contains('section-divider') || (
          el.classList.contains('page') && !el.classList.contains('page-title') && !el.classList.contains('page-footer')
        ))
        .map((el) => ({
          scrollHeight: el.scrollHeight,
          clientHeight: el.clientHeight,
        }));
    });
    return overflowFromMeasurements(measured);
  } finally {
    await browser.close();
  }
}

async function ensurePageFit(html, kind) {
  let current = prepareMarketingHtml(html, kind);
  if (!hasPrintPages(current)) {
    return { html: current, fit: true, report: [], flagged: false };
  }
  let report = [];
  try {
    for (let step = 0; step <= 2; step += 1) {
      report = await measureOverflow(current);
      if (!report.some((page) => page.overflow)) {
        return { html: current, fit: true, report, flagged: false };
      }
      if (step === 2) break;
      current = applyTightenStep(current, step + 1);
    }
  } catch (err) {
    return { html: current, fit: false, report, flagged: true, error: err.message };
  }
  return {
    html: current,
    fit: false,
    report,
    flagged: true,
  };
}

function overflowFromMeasurements(pages) {
  return (pages || []).map((page, index) => {
    const scrollHeight = Number(page.scrollHeight) || 0;
    const clientHeight = Number(page.clientHeight) || 0;
    const overflowPx = Math.max(0, scrollHeight - clientHeight);
    return {
      index,
      scrollHeight,
      clientHeight,
      overflowPx,
      overflow: overflowPx > 2,
    };
  });
}

module.exports = {
  CBR_FIT_CSS,
  FLYER_FIT_CSS,
  stripTags,
  findClassElements,
  splitLongContentPages,
  prepareMarketingHtml,
  applyTightenStep,
  overflowFromMeasurements,
  hasPrintPages,
  measureOverflow,
  ensurePageFit,
};
