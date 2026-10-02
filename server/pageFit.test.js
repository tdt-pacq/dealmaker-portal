const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  splitLongContentPages,
  findClassElements,
  overflowFromMeasurements,
  measureOverflow,
  ensurePageFit,
} = require('./pageFit');

function longPage() {
  const para = `<p>${'The roastery serves the White Mountains and keeps a steady morning rush. '.repeat(40)}</p>`;
  const block = (title) => `<div class="section-block"><h2 class="sub-heading">${title}</h2>${para}</div>`;
  return `<div class="content-page"><div class="content-body"><div class="main-col"><h1 class="page-title">BUSINESS OVERVIEW</h1>${para}${block('BUSINESS DETAILS')}${block('KEY SYSTEMS')}</div><aside class="sidebar">Asking price</aside></div><div class="page-footer">footer</div></div>`;
}

test('overflow measurements flag a page taller than its box', () => {
  const report = overflowFromMeasurements([
    { scrollHeight: 1400, clientHeight: 1056 },
    { scrollHeight: 1056, clientHeight: 1056 },
  ]);
  assert.equal(report[0].overflow, true);
  assert.equal(report[0].overflowPx, 344);
  assert.equal(report[1].overflow, false);
});

test('a long Business Overview splits onto a continuation page', () => {
  const out = splitLongContentPages(`<body>${longPage()}</body>`);
  const pages = findClassElements(out, 'content-page');
  assert.equal(pages.length, 2);
  assert.match(pages[1].html, /continued/);
  assert.match(pages[1].html, /KEY SYSTEMS/);
  assert.doesNotMatch(pages[0].html, /KEY SYSTEMS/);
  assert.equal((out.match(/class="sidebar"/g) || []).length, 2);
});

test('print measurement detects overflow and tightening clears it', async () => {
  const copy = 'The business overview must stay on its own letter page. '.repeat(70);
  const html = `<!DOCTYPE html><html><head><style>
    .content-page { height: 420px; max-height: 420px; overflow: hidden; }
    .content-page p { font-size: 28px; line-height: 1.45; }
  </style></head><body><div class="content-page"><p>${copy}</p></div></body></html>`;
  const before = await measureOverflow(html);
  assert.ok(before.some((page) => page.overflow), 'expected the tall page to overflow');

  const fitted = await ensurePageFit(html, 'cbr');
  assert.equal(typeof fitted.flagged, 'boolean');
  assert.ok(fitted.html.includes('data-pacq-page-fit'));
  const after = await measureOverflow(fitted.html);
  if (fitted.fit) {
    assert.ok(after.every((page) => !page.overflow));
  } else {
    assert.equal(fitted.flagged, true);
  }
});
